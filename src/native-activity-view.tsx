import { useEffect, useMemo, useRef, useState } from "react";
import { projectActivitySidebarState, type ActivitySidebarRow, type ActivitySidebarState } from "./activity-sidebar";
import type { AppEvent } from "./shared";

type ReactionPhase = "a" | "b";

function clockTime(value: string | null): string {
  if (!value) return "아직 활동 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "시간 미제공" : date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function ActivityRow({ row, reaction }: { row: ActivitySidebarRow; reaction: ReactionPhase | null }) {
  const observed = row.lastActivitySeq !== null;
  const reacting = reaction !== null;
  const state    = reacting ? "새 활동" : observed ? `최근 ${row.lastActivityLabel}` : row.enabled ? "대기" : "꺼짐";
  return <li
    className={`na-row ${observed ? "has-activity" : ""} ${reaction ? `is-reacting reaction-${reaction}` : ""} ${row.enabled ? "" : "is-disabled"}`}
    data-row-id={row.id}
    data-testid={`activity-${row.kind}-row`}
  >
    <span className="na-row-dot" aria-hidden="true"/>
    <span className="na-row-copy"><strong>{row.label}</strong><small>{row.detail ?? (row.catalogued ? "등록됨" : "감지됨")}</small></span>
    <span className="na-row-state" aria-label={`${row.label}: ${state}`}><span>{state}</span><time dateTime={row.lastActivityAt ?? undefined}>{clockTime(row.lastActivityAt)}</time></span>
  </li>;
}

function ActivityList({ title, rows, reactions }: { title: string; rows: readonly ActivitySidebarRow[]; reactions: ReadonlyMap<string, ReactionPhase> }) {
  return <section className="na-list"><div className="na-section-heading"><h3>{title}</h3><span>{rows.length}</span></div>{rows.length > 0
    ? <ul>{rows.map((row) => <ActivityRow key={row.id} row={row} reaction={reactions.get(row.id) ?? null}/>)}</ul>
    : <p className="na-empty">{title.startsWith("감지된") ? "아직 감지된 항목이 없습니다." : "등록된 항목이 없습니다."}</p>}</section>;
}

function configuredThread(events: readonly AppEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event  = events[index];
    const params = event?.params;
    if (event?.method === "thread/configured" && params && typeof params === "object" && !Array.isArray(params) && "threadId" in params && typeof params.threadId === "string" && params.threadId) return params.threadId;
  }
  return null;
}

export function NativeActivityView({ activityState, events, threadId, hidden = false, onShowOverview, onShowEvents }: {
  activityState  : ActivitySidebarState    ;
  events          : readonly AppEvent[] ;
  threadId        : string | null       ;
  hidden?         : boolean             ;
  onShowOverview? : () => void          ;
  onShowEvents?   : () => void          ;
}) {
  const effectiveThreadId = useMemo(() => threadId ?? configuredThread(events), [events, threadId]);
  const projection        = useMemo(() => projectActivitySidebarState(activityState, effectiveThreadId), [activityState, effectiveThreadId]);
  const [reactions, setReactions]       = useState<ReadonlyMap<string, ReactionPhase>>(() => new Map());
  const [announcement, setAnnouncement] = useState("");
  const processed = useRef<{ seq: number; ids: Set<string> }>({ seq: 0, ids: new Set() });
  const timers    = useRef(new Map<string, number>());

  useEffect(() => {
    const next = new Set<string>();
    for (const pulse of projection.pulses) {
      if (pulse.seq < processed.current.seq) continue;
      if (pulse.seq > processed.current.seq) {
        processed.current.seq = pulse.seq;
        processed.current.ids.clear();
      }
      if (processed.current.ids.has(pulse.id)) continue;
      processed.current.ids.add(pulse.id);
      if (!hidden) next.add(pulse.rowId);
    }
    if (next.size === 0) return;
    setReactions((current) => {
      const updated = new Map(current);
      for (const rowId of next) updated.set(rowId, current.get(rowId) === "a" ? "b" : "a");
      return updated;
    });
    const rows   = [...projection.skills, ...projection.hooks];
    const labels = [...next].map((id) => rows.find((row) => row.id === id)?.label).filter(Boolean);
    setAnnouncement(`${labels.join(", ")} 새 활동`);
    for (const rowId of next) {
      const previous = timers.current.get(rowId);
      if (previous !== undefined) window.clearTimeout(previous);
      const timer = window.setTimeout(() => {
        setReactions((current) => {
          const remaining = new Map(current);
          remaining.delete(rowId);
          return remaining;
        });
        timers.current.delete(rowId);
      }, 760);
      timers.current.set(rowId, timer);
    }
  }, [hidden, projection]);

  useEffect(() => {
    if (!hidden) return;
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
    setReactions(new Map());
  }, [hidden]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
  }, []);

  const connection = projection.transport === "connected" ? "연결됨" : projection.transport === "closed" ? "연결 종료" : projection.transport === "error" ? "연결 오류" : "연결 대기";
  return <aside className="native-activity-panel" hidden={hidden} aria-label="Skills와 Hooks 활동" data-testid="activity-panel">
    <header className="na-header"><div className="na-heading"><div><h2>활동</h2><p>Skills · Hooks</p></div><span className={`na-connection is-${projection.transport}`}><i aria-hidden="true"/>{connection}</span></div><div className="na-nav">{onShowOverview && <button onClick={onShowOverview}>개요</button>}{onShowEvents && <button onClick={onShowEvents}>사건</button>}</div></header>
    <div className="na-scroll" tabIndex={0} aria-label="Skills와 Hooks 목록">
      <ActivityList title={projection.skillsComplete ? "Skills" : "감지된 Skills"} rows={projection.skills} reactions={reactions}/>
      <ActivityList title={projection.hooksComplete ? "Hooks" : "감지된 Hooks"} rows={projection.hooks} reactions={reactions}/>
      <footer className="na-source-note"><p>Skill은 구조화된 지침 문서 읽기, Hook은 동기 실행 시작을 관측했을 때만 반응합니다.</p><p>반응은 시작·읽기 관측이며 적용 성공이나 작업 완료를 뜻하지 않습니다.</p>{projection.historyTruncated && <p className="na-warning" data-testid="activity-history-truncated">최근 2,000개 사건만 있어 이전 활동은 완전히 복원할 수 없습니다.</p>}</footer>
    </div>
    <span className="na-live-announcement" aria-live="polite">{announcement}</span>
  </aside>;
}
