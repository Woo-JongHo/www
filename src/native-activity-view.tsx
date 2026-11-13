import { useEffect, useMemo, useRef, useState } from "react";
import { projectActivitySidebar, projectActivitySidebarState, type ActivitySidebarRow, type ActivitySidebarState } from "./activity-sidebar";
import type { AppEvent } from "./shared";
import { projectNativeActivity, type ActivityEntry, type ActivityStatus, type ActivityTurn, type NativeActivityProjection, type UsageBreakdown } from "./native-activity";
import { WWW_ARTIFACTS, type WwwArtifact } from "./www-activity";

type ReactionPhase = "a" | "b";

function sidebarClockTime(value: string | null): string {
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
    <span className="na-row-state" aria-label={`${row.label}: ${state}`}><span>{state}</span><time dateTime={row.lastActivityAt ?? undefined}>{sidebarClockTime(row.lastActivityAt)}</time></span>
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


function ActivityInventory({ activityState, events, threadId, hidden = false, onShowOverview, onShowEvents }: {
  activityState? : ActivitySidebarState    ;
  events          : readonly AppEvent[] ;
  threadId        : string | null       ;
  hidden?         : boolean             ;
  onShowOverview? : () => void          ;
  onShowEvents?   : () => void          ;
}) {
  const effectiveThreadId = useMemo(() => threadId ?? configuredThread(events), [events, threadId]);
  const projection        = useMemo(() => activityState ? projectActivitySidebarState(activityState, effectiveThreadId) : projectActivitySidebar(events, effectiveThreadId), [activityState, effectiveThreadId]);
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

  return <>
      <ActivityList title={projection.skillsComplete ? "Skills" : "감지된 Skills"} rows={projection.skills} reactions={reactions}/>
      <ActivityList title={projection.hooksComplete ? "Hooks" : "감지된 Hooks"} rows={projection.hooks} reactions={reactions}/>
      <p className="na-source-note">Skill은 구조화된 지침 문서 읽기, Hook은 동기 실행 시작을 관측했을 때만 반응합니다. 반응은 적용 성공이나 작업 완료를 뜻하지 않습니다.</p>
      <span className="na-live-announcement" aria-live="polite">{announcement}</span>
    </>;
}

function statusLabel(status: ActivityStatus): string {
  switch (status) {
    case "pending"    : return "대기";
    case "running"    : return "진행 중";
    case "completed"  : return "완료";
    case "failed"     : return "실패";
    case "blocked"    : return "승인 대기";
    case "interrupted": return "중단";
    default: return "결과 미확인";
  }
}

function tokenNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "미제공" : value.toLocaleString("ko-KR");
}

function elapsed(start: string, end: string | null, now: number): string {
  const startTime = Date.parse(start)                    ;
  const endTime   = end === null ? now : Date.parse(end) ;
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return "시간 미제공";
  const seconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
  return seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

function clockTime(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "시간 미제공" : date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function limitResetTime(at: number): string {
  const date = new Date(at * 1000);
  if (Number.isNaN(date.getTime())) return "재설정 시간 미제공";
  return `재설정 예정 ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return <span className="na-subtle">관측 누적 대기</span>;
  const maximum = Math.max(1, ...values)                                                                                      ;
  const points  = values.map((value, index) => `${index / (values.length - 1) * 100},${25 - value / maximum * 23}`).join(" ") ;
  return <svg className="na-sparkline" viewBox="0 0 100 28" role="img" aria-label={`누적 토큰 관측 ${values.length}회`}><polyline points={points}/></svg>;
}

function TokenMeter({ usage }: { usage: UsageBreakdown | null }) {
  const input       = usage?.inputTokens                                                               ;
  const output      = usage?.outputTokens                                                              ;
  const known       = input !== null && input !== undefined && output !== null && output !== undefined ;
  const total       = known ? input + output : 0                                                       ;
  const inputWidth  = known && total > 0 ? input / total * 100 : 0                                     ;
  const outputWidth = known && total > 0 ? output / total * 100 : 0                                    ;
  return <svg className="na-meter" viewBox="0 0 100 4" preserveAspectRatio="none" role="img" aria-label={known ? `입력 ${tokenNumber(input)} 토큰, 출력 ${tokenNumber(output)} 토큰` : "입출력 토큰 미제공"}><rect className="na-meter-track" width="100" height="4" rx="2"/><rect className="na-meter-input" width={inputWidth} height="4"/><rect className="na-meter-output" x={inputWidth} width={outputWidth} height="4"/></svg>;
}

function UsageRows({ usage }: { usage: UsageBreakdown | null }) {
  return <dl className="na-usage-rows"><div><dt>입력</dt><dd>{tokenNumber(usage?.inputTokens)}</dd></div><div><dt>출력</dt><dd>{tokenNumber(usage?.outputTokens)}</dd></div></dl>;
}

function UsageView({ turn, cumulative }: { turn: ActivityTurn | null; cumulative: UsageBreakdown | null }) {
  return <section className="na-usage" aria-label="실측 토큰 사용량" data-testid="activity-token-stats"><div className="na-section-heading"><h3>토큰 관측</h3><span className="na-subtle">실측</span></div><div className="na-usage-title"><span>선택한 답변</span><strong>{tokenNumber(turn?.usage?.totalTokens)}</strong></div><TokenMeter usage={turn?.usage ?? null}/><UsageRows usage={turn?.usage ?? null}/><p className="na-subtle na-usage-basis">{turn?.usageBasis === "total_delta" ? "누적 관측값의 턴 차이" : "턴 사용량 미제공"}</p><Sparkline values={turn?.usageSeries ?? []}/><details className="na-token-details"><summary>누적·최근 요청과 세부 토큰</summary><div className="na-token-detail-group"><span>스레드 누적 관측</span><strong>{tokenNumber(cumulative?.totalTokens)}</strong><UsageRows usage={cumulative}/></div><div className="na-token-detail-group"><span>최근 모델 요청</span><strong>{tokenNumber(turn?.lastRequestUsage?.totalTokens)}</strong><UsageRows usage={turn?.lastRequestUsage ?? null}/></div><dl className="na-subsets"><div><dt>입력 중 캐시 읽기</dt><dd>{tokenNumber(turn?.usage?.cachedInputTokens)}</dd></div><div><dt>입력 중 캐시 쓰기</dt><dd>{tokenNumber(turn?.usage?.cacheWriteInputTokens)}</dd></div><div><dt>출력 중 추론 토큰</dt><dd>{tokenNumber(turn?.usage?.reasoningOutputTokens)}</dd></div></dl><p className="na-subtle">캐시·추론은 입출력의 세부 항목이며 합계에 다시 더하지 않습니다.</p></details></section>;
}

function EntryView({ entry, expanded, onToggle }: { entry: ActivityEntry; expanded: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const open     = expanded.has(entry.id)                                                                                         ;
  const evidence = entry.source === "file_read" ? "문서 읽기 관측" : entry.source === "request" ? "요청에 명시됨" : "Native 사건" ;
  return <li className={`na-entry na-state-${entry.status}`} data-testid="activity-entry"><div className="na-track-dot" aria-hidden="true"/><details open={open} data-testid="activity-event-details"><summary aria-label={`${entry.label} 상세, ${(entry.kind === "skill" && entry.source === "request" ? "요청됨" : statusLabel(entry.status))}`} onClick={(event) => { event.preventDefault(); onToggle(entry.id); }}><div className="na-entry-title"><span>{entry.label}</span><span className="na-entry-status">{entry.kind === "skill" && entry.source === "request" ? "요청됨" : statusLabel(entry.status)}</span></div><div className="na-entry-meta"><time dateTime={entry.at}>{clockTime(entry.at)}</time><span>{entry.kind === "skill" || entry.kind === "hook" ? evidence : entry.kind === "answer" ? "공개 답변" : entry.kind === "progress" ? "공개 진행 설명" : ""}</span></div></summary><div className="na-entry-detail">{entry.description ? <pre>{entry.description}</pre> : <p>상세 내용 미제공</p>}<p>{evidence}{entry.source === "file_read" ? " · 적용 성공 여부는 확인되지 않았습니다." : entry.source === "request" ? " · 실행 여부는 확인되지 않았습니다." : ""}</p>{entry.durationMs !== null && <p>관측 소요 {(entry.durationMs / 1000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}초</p>}</div></details></li>;
}

function artifactStatus(entry: ActivityEntry | undefined): string {
  if (!entry) return "관측 없음";
  if (entry.source === "request") return "요청됨";
  if (entry.source === "command_reference") return entry.status === "failed" ? "읽기 명령 실패" : "읽기 명령 관측";
  if (entry.status === "running") return "읽는 중";
  if (entry.status === "completed") return "읽기 완료";
  if (entry.status === "failed") return "읽기 실패";
  return "읽기 결과 미확인";
}

function ArtifactRow({ artifact, entries, memoryKey, expanded, onToggle }: { artifact: WwwArtifact; entries: readonly ActivityEntry[]; memoryKey: string; expanded: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const observed = entries.filter((entry) => entry.wwwArtifact?.id === artifact.id).at(-1);
  return <li className={`www-artifact ${observed ? `www-observed na-state-${observed.status}` : "www-unobserved"} ${observed?.source === "command_reference" ? "www-command-reference" : ""}`} data-testid="www-artifact" data-artifact-id={artifact.id}>
    <details open={expanded.has(memoryKey)}><summary onClick={(event) => { event.preventDefault(); onToggle(memoryKey); }}><span className="www-artifact-light" aria-hidden="true"/><span className="www-artifact-name"><strong>{artifact.id}</strong><small>{artifact.label}</small></span><span className="www-artifact-state">{artifactStatus(observed)}</span></summary>
      <div className="www-artifact-evidence"><code>{artifact.path}</code>{observed ? <><p>{observed.source === "command_reference" ? "정본 파일을 가리키는 리터럴 cat 명령을 관측했습니다. 개별 문서의 읽기 성공이나 실제 적용을 확인한 것은 아닙니다." : observed.source === "request" ? "입력에 명시된 요청입니다. 읽기나 적용 성공은 미확인입니다." : "Native의 구조화된 파일 읽기 근거입니다. 문서 읽기와 실제 적용은 구분합니다."}</p><time dateTime={observed.at}>{clockTime(observed.at)}</time><p>관측된 명령 상태: {statusLabel(observed.status)}</p></> : <p>이 질문에서 관측된 요청·문서 읽기가 없습니다. 필요할 때 사용하는 역할·스킬이며 모두 순서대로 실행되는 것은 아닙니다.</p>}</div>
    </details>
  </li>;
}

function WwwFlow({ turn, expanded, onToggle }: { turn: ActivityTurn | null; expanded: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const entries = turn?.entries ?? [];
  return <section className="www-flow" aria-label="WWW 전용 에이전트와 스킬" data-testid="www-flow">
    <div className="na-section-heading"><h3>{turn?.historical ? "복원된 WWW 흐름" : "WWW 전용 흐름"}</h3><span className="na-subtle">{entries.filter((entry) => entry.wwwArtifact).length}개 관측</span></div>
    <p className="www-flow-note">선택한 질문에서 어떤 전용 문서를 요청하거나 읽었는지 확인합니다.</p>
    <h4>전용 에이전트</h4><ul>{WWW_ARTIFACTS.filter((artifact) => artifact.kind === "role").map((artifact) => <ArtifactRow key={artifact.id} artifact={artifact} entries={entries} memoryKey={`${turn?.id}:www:${artifact.id}`} expanded={expanded} onToggle={onToggle}/>)}</ul>
    <h4>개발 스킬</h4><ul>{WWW_ARTIFACTS.filter((artifact) => artifact.kind === "skill").map((artifact) => <ArtifactRow key={artifact.id} artifact={artifact} entries={entries} memoryKey={`${turn?.id}:www:${artifact.id}`} expanded={expanded} onToggle={onToggle}/>)}</ul>
    <p className="www-flow-note">문서 읽기 관측을 실제 역할·스킬 적용 완료로 표시하지 않습니다.</p>
  </section>;
}

function Monitor({ projection, now, following, onFollow }: { projection: NativeActivityProjection; now: number; following: boolean; onFollow: () => void }) {
  const current = projection.turns.at(-1) ?? null;

  const running = current !== null && !current.historical && !current.endedAt;

  const connected = projection.transport === "connected";

  const connectionLabel = connected ? "Native 연결됨" : projection.transport === "error" ? "연결 오류" : projection.transport === "closed" ? "연결 끊김" : "연결 상태 미확인";

  return <section className="na-monitor" aria-label="현재 세션 모니터" data-testid="activity-live-monitor">
    <div className="na-section-heading"><h3>현재 요청</h3><span className={`na-live-state ${running ? "na-live" : ""}`}><i aria-hidden="true"/>{current ? current.historical ? "복원된 이력" : current.status === "completed" ? "응답 종료" : statusLabel(current.status) : "요청 대기"}</span></div>
    <p className="na-current-title">{current?.title ?? "메시지를 보내면 작업 상태가 표시됩니다."}</p>
    <div className="na-monitor-times"><span>{connectionLabel}</span><time aria-label="현재 작업 경과 시간">{current ? current.historical ? "이력 시간 미제공" : elapsed(current.startedAt, current.endedAt ?? (running ? null : current.lastActivityAt), now) : "시간 대기"}</time></div>
    {projection.protocolWarning && <details className="na-protocol-warning"><summary>최근 통신 경고 · <time dateTime={projection.protocolWarning.at}>{clockTime(projection.protocolWarning.at)}</time></summary><p>{projection.protocolWarning.message}</p><p>연결 종료와 별개인 경고입니다. 관측한 작업 상태는 계속 표시합니다.</p></details>}
    {current && <p className="na-last-activity"><time dateTime={current.lastActivityAt}>마지막 활동 {clockTime(current.lastActivityAt)}</time>{running ? ` · ${elapsed(current.lastActivityAt, null, now)} 전` : ""}</p>}
    {current?.status === "blocked" && <p className="na-monitor-warning" role="status">승인을 기다리고 있습니다. 채팅의 승인 요청을 확인하세요.</p>}
    {current?.status === "failed" && <p className="na-monitor-warning" role="status">작업이 실패했습니다. 아래 흐름에서 실패한 사건을 확인하세요.</p>}
    {!following && <button className="na-return-current" onClick={onFollow}>현재 작업으로 돌아가기</button>}
  </section>;
}

function TurnBody({ turn, expanded, onToggle }: { turn: ActivityTurn; expanded: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const progressProvided = turn.entries.some((entry) => entry.kind === "progress");

  return <><section className="na-turn-intro"><details><summary>{turn.title || "요청 전체 보기"}</summary><p>{turn.prompt || "입력 원문 미제공"}</p></details></section>
    {turn.plan.length > 0 && <section className="na-plan" aria-label="작업 계획"><h3>진행 계획</h3><ul>{turn.plan.map((step, index) => <li key={`${index}-${step.step}`} className={`na-plan-${step.status}`}><span aria-hidden="true">{step.status === "completed" ? "✓" : step.status === "inProgress" ? "◉" : "○"}</span><span>{step.step}<small>{step.status === "completed" ? "완료" : step.status === "inProgress" ? "진행 중" : "대기"}</small></span></li>)}</ul></section>}
    <section className="na-timeline" aria-label="답변 활동 시간순 기록"><div className="na-section-heading"><h3>작업의 흐름</h3><span className="na-subtle">{turn.historical ? "복원된 이력" : `${turn.entries.length}개 사건`}</span></div>{!progressProvided && <p className="na-subtle na-no-signals">공개 진행 설명 미제공 · 관측한 도구 상태만 표시합니다.</p>}{turn.entries.length ? <ol className="na-track">{turn.entries.map((entry) => <EntryView key={entry.id} entry={entry} expanded={expanded} onToggle={onToggle}/>)}</ol> : <p className="na-empty">사건을 기다리고 있습니다. Native가 보고한 활동이 이곳에 이어집니다.</p>}</section></>;
}

export function NativeActivityView({ activityState, events, threadId, hidden = false, onShowOverview, onShowEvents, workspacePath }: { activityState?: ActivitySidebarState; events: readonly AppEvent[]; threadId: string | null; hidden?: boolean; onShowOverview?: () => void; onShowEvents?: () => void; workspacePath?: string }) {
  const projection = useMemo(() => projectNativeActivity(events, threadId, workspacePath), [events, threadId, workspacePath]);
  const [selection, setSelection] = useState<{ threadId: string | null; id: string } | null>(null);
  const [now, setNow] = useState(Date.now);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const onToggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const following = selection === null || selection.threadId !== threadId                                  ;
  const latest    = projection.turns.at(-1) ?? null                                                        ;
  const turn      = following ? latest : projection.turns.find((item) => item.id === selection.id) ?? null ;
  const active    = turn?.status === "running" || turn?.status === "blocked"                               ;
  const ticking   = !hidden && ((active && !turn?.historical) || (latest !== null && !latest.historical && !latest.endedAt)) ;
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking, turn?.id, latest?.id]);
  const live = latest?.status === "running" && !latest.historical;
  const hooks = [...(turn?.entries ?? []), ...projection.sessionEntries].filter((entry) => entry.kind === "hook");
  const hookFailures = hooks.filter((entry) => entry.status === "failed").length;
  const hookTrustRequired = hooks.filter((entry) => entry.status === "failed" && entry.description?.includes("hook approval required")).length;
  const nativeMemoryKey = `native-details:${turn?.id ?? "empty"}`;
  return <aside className="native-activity-panel" hidden={hidden} aria-label="WWW 개발 흐름" data-testid="activity-panel">
    <header className="na-header">
      <div className="na-heading"><h2>WWW 개발 흐름</h2><span className={`na-live-state ${live && !hidden ? "na-live" : ""}`}><i aria-hidden="true"/>{latest ? latest.historical ? "복원된 이력" : latest.status === "completed" ? "응답 종료" : statusLabel(latest.status) : "요청 대기"}</span></div>
      <div className="na-nav">{onShowOverview && <button onClick={onShowOverview}>개요</button>}{onShowEvents && <button onClick={onShowEvents}>사건</button>}</div>
      <div className="na-turn-picker"><select data-testid="activity-turn-select" aria-label="활동을 볼 답변 선택" value={turn?.id ?? ""} onChange={(event) => setSelection({ threadId, id: event.target.value })}>{!projection.turns.length && <option value="">답변이 아직 없습니다</option>}{projection.turns.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title || "답변"}</option>)}{!following && !turn && <option value="">선택한 답변의 이력 없음</option>}</select><button className={following ? "na-follow active" : "na-follow"} aria-pressed={following} onClick={() => setSelection(null)}>현재 답변 따라가기</button></div>
    </header>
    <div className="na-scroll" tabIndex={0} aria-label="활동 기록 스크롤">
      <Monitor projection={projection} now={now} following={following} onFollow={() => setSelection(null)}/>
      <ActivityInventory activityState={activityState} events={events} threadId={threadId} hidden={hidden}/>
      <WwwFlow key={turn?.id ?? "empty"} turn={turn} expanded={expanded} onToggle={onToggle}/>
      <details className="www-native-details" key={`native-${turn?.id ?? "empty"}`} data-testid="native-activity-details" open={expanded.has(nativeMemoryKey)}>
        <summary onClick={(event) => { event.preventDefault(); onToggle(nativeMemoryKey); }}><strong>일반 Native 활동</strong><span>{hooks.length ? `Hook ${hooks.length}건` : "명령·공개 과정"}{hookFailures > 0 ? ` · 실패 ${hookFailures}건` : ""}{hookTrustRequired > 0 ? ` · 신뢰 검토 필요 ${hookTrustRequired}건` : ""}</span></summary>
        <p className="www-detail-note">범용 Hook과 전체 도구 기록입니다. Hook 실패는 WWW 에이전트·스킬 적용 실패와 별개입니다. 턴에 귀속되지 않은 Hook은 세션 기록으로 표시합니다.</p>
        {turn ? <TurnBody key={turn.id} turn={turn} expanded={expanded} onToggle={onToggle}/> : <p className="na-empty">선택한 질문의 활동이 아직 없습니다.</p>}
        {projection.sessionEntries.length > 0 && <section className="na-session"><h3>턴 연결이 없는 세션 사건</h3><ol className="na-track">{projection.sessionEntries.map((entry) => <EntryView key={entry.id} entry={entry} expanded={expanded} onToggle={onToggle}/>)}</ol></section>}
      </details>
      <details className="na-secondary-usage"><summary>모델·토큰·계정 관측</summary>
        <div className="na-model-row"><span>{turn?.model?.basis === "rerouted" ? "전환 관측 모델" : "설정 모델"}</span><strong data-testid="activity-model">{turn?.model?.name ?? "모델 정보 대기"}</strong>{turn?.model?.provider && <span>{turn.model.provider}</span>}</div>
        <p className="na-subtle">{turn?.model?.basis === "configured" ? "실제 실행 모델은 별도 확인 필요" : "Native가 제공한 정보"}</p>
        <UsageView turn={turn} cumulative={projection.usage}/>
        {projection.limits.length > 0 && <section className="na-limits"><h3>계정 사용 한도</h3><p className="na-subtle">계정 수준의 사용 비율이며 모델별 요금이 아닙니다.</p>{projection.limits.map((limit) => <div className="na-limit" key={limit.id}><strong>{limit.name}</strong>{limit.model && <span>{limit.model}</span>}{[limit.primary, limit.secondary].map((window, index) => window && <div key={index}><span>{window.windowDurationMins === null ? "기간 미제공" : `${window.windowDurationMins}분 구간`}</span><span>{tokenNumber(window.usedPercent)}{window.usedPercent === null ? "" : "% 사용"}</span>{window.resetsAt !== null && <span className="na-limit-reset">{limitResetTime(window.resetsAt)}</span>}</div>)}</div>)}</section>}
      </details>
      <footer className="na-source-note"><p>등록 문서와 관측한 읽기·요청을 구별합니다. 실제 역할·스킬 적용을 확인한 근거가 없으면 완료로 추정하지 않습니다.</p>{projection.historyTruncated && <p className="na-warning" data-testid="activity-history-truncated">최근 2,000개 사건만 보관하여 이전 이력이 잘렸습니다. 앞선 활동·사용량은 복원할 수 없습니다.</p>}</footer>
    </div>
  </aside>;
}
