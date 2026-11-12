import { useEffect, useMemo, useState } from "react";
import type { AppEvent } from "./shared";
import { projectNativeActivity, type ActivityEntry, type ActivityStatus, type ActivityTurn, type UsageBreakdown } from "./native-activity";

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
  return <li className={`na-entry na-state-${entry.status}`} data-testid="activity-entry"><div className="na-track-dot" aria-hidden="true"/><details open={open} data-testid="activity-event-details"><summary aria-label={`${entry.label} 상세, ${statusLabel(entry.status)}`} onClick={(event) => { event.preventDefault(); onToggle(entry.id); }}><div className="na-entry-title"><span>{entry.label}</span><span className="na-entry-status">{statusLabel(entry.status)}</span></div><div className="na-entry-meta"><time dateTime={entry.at}>{clockTime(entry.at)}</time><span>{entry.kind === "skill" || entry.kind === "hook" ? evidence : entry.kind === "answer" ? "공개 답변" : ""}</span></div></summary><div className="na-entry-detail">{entry.description ? <pre>{entry.description}</pre> : <p>상세 내용 미제공</p>}<p>{evidence}{entry.source === "file_read" ? " · 적용 성공 여부는 확인되지 않았습니다." : entry.source === "request" ? " · 실행 여부는 확인되지 않았습니다." : ""}</p>{entry.durationMs !== null && <p>관측 소요 {(entry.durationMs / 1000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}초</p>}</div></details></li>;
}

function TurnBody({ turn, expanded, onToggle }: { turn: ActivityTurn; expanded: ReadonlySet<string>; onToggle: (id: string) => void }) {
  return <><section className="na-turn-intro"><p>{turn.prompt || turn.title}</p></section>{turn.plan.length > 0 && <section className="na-plan" aria-label="작업 계획"><h3>진행 계획</h3><ul>{turn.plan.map((step, index) => <li key={`${index}-${step.step}`} className={`na-plan-${step.status}`}><span aria-hidden="true">{step.status === "completed" ? "✓" : step.status === "inProgress" ? "◉" : "○"}</span><span>{step.step}<small>{step.status === "completed" ? "완료" : step.status === "inProgress" ? "진행 중" : "대기"}</small></span></li>)}</ul></section>}<section className="na-timeline" aria-label="답변 활동 시간순 기록"><div className="na-section-heading"><h3>작업의 흐름</h3><span className="na-subtle">{turn.entries.length}개 사건</span></div>{turn.entries.length ? <ol className="na-track">{turn.entries.map((entry) => <EntryView key={entry.id} entry={entry} expanded={expanded} onToggle={onToggle}/>)}</ol> : <p className="na-empty">사건을 기다리고 있습니다. Native가 보고한 활동이 이곳에 이어집니다.</p>}</section></>;
}

export function NativeActivityView({ events, threadId, hidden = false, onShowOverview, onShowEvents }: { events: readonly AppEvent[]; threadId: string | null; hidden?: boolean; onShowOverview?: () => void; onShowEvents?: () => void }) {
  const projection = useMemo(() => projectNativeActivity(events, threadId), [events, threadId]);
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
  const ticking   = !hidden && active                                                                      ;
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking, turn?.id]);
  const live = turn?.status === "running";
  return <aside className="native-activity-panel" hidden={hidden} aria-label="Native 답변 활동" data-testid="activity-panel"><header className="na-header"><div className="na-heading"><h2>답변의 흐름</h2><span className={`na-live-state ${live && !hidden ? "na-live" : ""}`}><i aria-hidden="true"/>{turn ? statusLabel(turn.status) : "요청 대기"}</span></div><div className="na-nav">{onShowOverview && <button onClick={onShowOverview}>개요</button>}{onShowEvents && <button onClick={onShowEvents}>사건</button>}</div><div className="na-turn-picker"><select data-testid="activity-turn-select" aria-label="활동을 볼 답변 선택" value={turn?.id ?? ""} onChange={(event) => setSelection({ threadId, id: event.target.value })}>{!projection.turns.length && <option value="">답변이 아직 없습니다</option>}{projection.turns.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title || "답변"}</option>)}{!following && !turn && <option value="">선택한 답변의 이력 없음</option>}</select><button className={following ? "na-follow active" : "na-follow"} aria-pressed={following} onClick={() => setSelection(null)}>현재 답변 따라가기</button></div><div className="na-model-row"><span>{turn?.model?.basis === "rerouted" ? "전환 관측 모델" : "설정 모델"}</span><strong data-testid="activity-model">{turn?.model?.name ?? "모델 정보 대기"}</strong>{turn?.model?.provider && <span>{turn.model.provider}</span>}</div><div className="na-time-row"><span>{turn?.model?.basis === "configured" ? "실제 실행 모델은 별도 확인 필요" : "Native가 제공한 정보"}</span><time aria-label="답변 관측 경과 시간">{turn ? elapsed(turn.startedAt, turn.endedAt ?? (active ? null : projection.updatedAt), now) : "시간 대기"}</time></div></header><div className="na-scroll" tabIndex={0} aria-label="활동 기록 스크롤"><UsageView turn={turn} cumulative={projection.usage}/>{turn ? <TurnBody key={turn.id} turn={turn} expanded={expanded} onToggle={onToggle}/> : <section className="na-empty na-empty-turn"><span aria-hidden="true">○</span><h3>{following ? "다음 답변을 기다립니다" : "선택한 답변의 이력이 없습니다"}</h3><p>{following ? "메시지를 보내면 명령, 도구, 파일 변경과 공개 답변이 시간순으로 쌓입니다." : "보관 범위를 벗어난 사건은 복원할 수 없습니다. 현재 답변을 따라가면 최근 활동을 볼 수 있습니다."}</p></section>}{projection.sessionEntries.length > 0 && <section className="na-session"><h3>턴 연결이 없는 세션 사건</h3><ol className="na-track">{projection.sessionEntries.map((entry) => <EntryView key={entry.id} entry={entry} expanded={expanded} onToggle={onToggle}/>)}</ol></section>}{projection.limits.length > 0 && <details className="na-limits"><summary>계정 사용 한도</summary><p className="na-subtle">계정 수준의 사용 비율입니다. 모델별 요금이나 토큰 사용량이 아닙니다.</p>{projection.limits.map((limit) => <div className="na-limit" key={limit.id}><strong>{limit.name}</strong>{limit.model && <span>{limit.model}</span>}{[limit.primary, limit.secondary].map((window, index) => window && <div key={index}><span>{window.windowDurationMins === null ? "기간 미제공" : `${window.windowDurationMins}분 구간`}</span><span>{tokenNumber(window.usedPercent)}{window.usedPercent === null ? "" : "% 사용"}</span>{window.resetsAt !== null && <span className="na-limit-reset">{limitResetTime(window.resetsAt)}</span>}</div>)}</div>)}</details>}<footer className="na-source-note"><p>Native가 보고한 사건만 표시합니다. 비동기 훅은 제공되지 않을 수 있고, 스킬은 문서 읽기 관측과 실제 실행을 구별합니다.</p>{projection.historyTruncated && <p className="na-warning" data-testid="activity-history-truncated">최근 2,000개 사건만 보관하여 이전의 이력이 잘렸습니다. 앞선 활동·사용량은 복원할 수 없습니다.</p>}</footer></div></aside>;
}
