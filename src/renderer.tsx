/**
 * @architecture arch.chat.workspace
 * @implements RESP-CHAT-WORKSPACE
 */
import { appBuildInfo } from "./build-info";
import { projectNativeActivity } from "./native-activity";
import { CommandView } from "./command-card";
import { NativeActivityView, ResourceActivitySidebar } from "./native-activity-view";
import { ChatMessage } from "./chat-message";
import { ChatDetails, ChatRowMemoryContext, type ChatRowMemory } from "./chat-row-state";
import { reduceConversationEvents, liveChatInput, slashCommand, type ConversationEventState, blankReadingState, belongsToConversation, conversationKey, currentTurnEvents, draftWithQuote, eventThreadId, MAX_PROMPT_CHARS, type ConversationReadingState } from "./chat-state";
import { createActivitySidebarState, projectActivitySidebar, updateActivitySidebarSnapshot } from "./activity-sidebar";
import { ReportsView } from "./reports-view";
import { EcosystemView } from "./ecosystem-view";
import { RpaStandardView } from "./rpa-standard-view";
import { DashboardView } from "./dashboard-view";
import { SessionApiProvider, useSessionApi } from "./session-api";
import { SessionTabs } from "./session-tabs";
import { ChatComposer } from "./chat-composer";
import { chatStatus, isVerificationCommand } from "./chat-status";
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { executionResultCounts, MAX_OUTPUT_CODE_UNITS, project, type Block, type Projection } from "./projection";
import type { AppEvent, ConversationSummary, TurnState, WorkspaceSelection, SelectionRef, ScopedAppEvent, ResourceSnapshot, ResourceScope, ProjectInfo, ConversationSelection, WwwApi } from "./shared";
import type { NativeTimingEvent, ChatTheme, DashboardSnapshot, DashboardWork, NativeModelOption, NativeSessionSummary } from "./shared";

document.title = `WWW ${appBuildInfo.label}`;

declare global { interface Window { www: WwwApi } }

const MAX_RAW_EVENTS = 2_000;

const afterTwoFrames = () => new Promise<void>((resolve) =>
  requestAnimationFrame(() =>
    requestAnimationFrame(() => resolve())
  )
);
const waitForEvent = async (method: string, timeoutMs = 15000): Promise<AppEvent> => {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const event = (await window.www.workspace().then((selected) => window.www.events(selected))).find((entry) => entry.method === method);
    if (event) return event;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Probe timed out waiting for ${method}`);
};

function blockKey(block: Block): string {
  if (block.kind === "approval") return block.id;
  return `${block.kind}-${block.id}`;
}

function fileStatus(block: Extract<Block, { kind: "files" }>): string {
  if (block.running               ) return "진행 중";
  if (block.status === "completed") return "완료";
  if (block.status === "failed"   ) return "실패";
  if (block.status === "declined") return "거절";
  return "결과 미확인";
}

function BlockView({ block, decide, quote }: { block: Exclude<Block, { kind: "command" }>; decide(id: string | number, decision: string, approvalToken: string | null): void; quote(text: string): void }) {
  if (block.kind === "user") {
    return <div className={`user request-${block.state}`} data-testid="user-request"><span className="chat-role chat-role-question">내 질문</span><div>{block.text}</div><span className="muted">{block.steerStatus ? block.steerStatus === "pending" ? "추가 지시 · 전송 중" : block.steerStatus === "accepted" ? "추가 지시 · 접수됨 · 반영 여부는 후속 행동에서 확인" : block.steerStatus === "uncertain" ? `추가 지시 · 접수 여부 미확인 · ${block.error ?? "다시 보내기 전 결과를 확인하세요"}` : `추가 지시 · 전송 실패 · ${block.error ?? "원인 미확인"}` : block.state === "sending" ? "요청을 보내는 중" : block.state === "accepted" ? "요청을 받았습니다" : `요청을 보내지 못했습니다 · ${block.error ?? "원인 미확인"}`}</span></div>;
  }
  if (block.kind === "explanation") {
    if (!block.text) return null;
    return <div aria-label={block.source === "reasoningSummary" ? "Native 공개 추론 요약" : block.source === "commentary" ? "Native 공개 설명" : "Native 공개 계획"} className={`explanation ${block.streaming ? "streaming" : ""}`} data-testid="public-explanation"><ChatMessage text={block.text} streaming={block.streaming} label="Native 공개 설명"/>{block.summaryTruncated && <div className="muted">공개 요약은 앞 {MAX_OUTPUT_CODE_UNITS.toLocaleString("ko-KR")} UTF-16 코드 단위까지만 표시합니다. 나머지는 생략됐습니다.</div>}</div>;
  }
  if (block.kind === "answer" ) return <div className={`agent ${block.streaming ? "streaming" : ""}`}><span className="chat-role chat-role-answer">Codex 답변</span><ChatMessage text={block.text} streaming={block.streaming} onQuote={quote}/></div>;
  if (block.kind === "files"  ) return <div className={`files item-${block.status}`} data-testid="file-change"><div>파일 변경 · {fileStatus(block)}</div>{block.changes.length ? block.changes.map((change) => <ChatDetails key={change.path} memoryKey={`${block.id}:${change.path}`}><summary>{change.path}</summary>{change.diff === null ? <div className="muted">변경 내용 미제공</div> : <pre data-testid="file-diff">{change.diff || "제공된 변경 내용이 비어 있습니다."}</pre>}{change.truncated && <div className="muted">변경 내용의 최근 {MAX_OUTPUT_CODE_UNITS.toLocaleString("ko-KR")} UTF-16 코드 단위만 보관합니다. 앞부분은 복원할 수 없습니다.</div>}</ChatDetails>) : "파일 정보 미제공"}</div>;
  const approvalToken = "approvalToken" in block && typeof block.approvalToken === "string" ? block.approvalToken : null;
  return <div className={`approval ${block.open ? "open" : ""}`} data-testid="approval-card"><div className="ahead">{!block.supported ? "지원하지 않는 요청" : block.state === "open" && block.open && approvalToken !== null ? "승인 필요" : block.state === "responding" ? "응답 전송 중" : block.state === "responded" ? "응답 전송됨" : "응답 결과 미확인"}</div><div className="abody">{block.summary}</div>{block.supported && block.open && approvalToken !== null && <div className="aact"><button data-decision="accept" onClick={() => decide(block.requestId, "accept", approvalToken)}>허용</button><button data-decision="acceptForSession" onClick={() => decide(block.requestId, "acceptForSession", approvalToken)}>세션 허용</button><button data-decision="decline" onClick={() => decide(block.requestId, "decline", approvalToken)}>거절</button><button data-decision="cancel" onClick={() => decide(block.requestId, "cancel", approvalToken)}>중단</button></div>}</div>;
}

function elapsedLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}분 ${seconds % 60}초`;
}

// 명령 블록은 모두 스칼라 필드다. React의 얕은 비교로 출력 전체의 직렬화를 피한다.
const MemoCommandView = memo((block: Extract<Block, { kind: "command" }>) => <CommandView block={block}/>);
const MemoBlockView = memo(BlockView, (previous, next) => previous.decide === next.decide && previous.quote === next.quote && (previous.block === next.block || JSON.stringify(previous.block) === JSON.stringify(next.block)));

function timingParams(event: AppEvent): NativeTimingEvent | null {
  if (event.method !== "diagnostics/timing" || !event.params || typeof event.params !== "object") return null;
  const value = event.params;
  if (!("traceId" in value) || typeof value.traceId !== "string"
    || !("phase" in value) || typeof value.phase !== "string"
    || !("status" in value) || !["started", "completed", "failed", "cancelled"].includes(String(value.status))
    || !("elapsedMs" in value) || typeof value.elapsedMs !== "number" || !Number.isFinite(value.elapsedMs)
    || !("source" in value) || !["www", "native"].includes(String(value.source))
    || !("threadId" in value) || (value.threadId !== null && typeof value.threadId !== "string")) return null;
  // main의 고정 메타데이터만 읽는다. 이 값으로 다른 프로세스 시계를 빼지 않는다.
  return value as NativeTimingEvent;
}

function NativePreparation({ events, sinceSeq }: { events: readonly AppEvent[]; sinceSeq: number }) {
  const timings = events.filter(event => !event.historical && event.seq >= sinceSeq)
    .map(timingParams).filter((event): event is NativeTimingEvent => event !== null);
  const latest = timings.at(-1);
  if (!latest) return null;
  const trace = timings.filter(event => event.traceId === latest.traceId);
  const labels: Record<string, string> = {
    request: "요청 준비", connect: "Native 연결", initialize: "Native 초기화",
    "thread/start": "새 대화 준비", "thread/read": "대화 읽기", "thread/resume": "대화 재개",
    "thread/turns/list": "대화 이력 확인", "turn/start": "요청 전달", "first-native": "첫 작업 소식 수신",
  };
  const stage = labels[latest.phase] ?? "요청 준비";
  const state = latest.status === "started" ? "진행 중" : latest.status === "failed" ? "실패" : latest.status === "cancelled" ? "취소" : "확인됨";
  return <section className="work-flow" data-testid="native-preparation" aria-label="Native 요청 준비">
    <p role="status">앱 관측 · {stage} {state}</p>
    <details><summary>준비 시간 확인</summary><p className="muted">main 프로세스의 요청 시작부터 경과한 시간입니다. 첫 작업 소식 수신과 업무 완료는 다릅니다.</p>
      <ol>{trace.map((item, index) => <li key={index}>{labels[item.phase] ?? item.phase} · {item.status === "started" ? "시작" : item.status === "completed" ? "확인" : item.status === "failed" ? "실패" : "취소"} · {(item.elapsedMs / 1000).toFixed(2)}초</li>)}</ol>
    </details>
  </section>;
}

function WorkFlow({ turn, blocks, events, transport, interrupt }: {
  turn      : TurnState               ;
  blocks    : readonly Block[]         ;
  events    : readonly AppEvent[]      ;
  transport : Projection["transport"] ;
  interrupt : Projection["interrupt"] ;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (turn !== 'running' && turn !== 'starting') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [turn]);
  const explanations = blocks.filter((block): block is Extract<Block, { kind: "explanation" }> => block.kind === "explanation");

  const commands = blocks.filter((block): block is Extract<Block, { kind: "command" }> => block.kind === "command");

  const files = blocks.filter((block): block is Extract<Block, { kind: "files" }> => block.kind === "files");

  const answers = blocks.filter((block): block is Extract<Block, { kind: "answer" }> => block.kind === "answer");

  const active = turn === "starting" || turn === "running";
  const finished = turn === "completed" || turn === "interrupted" || turn === "failed";
  const approvals = blocks.filter((block): block is Extract<Block, { kind: "approval" }> => block.kind === "approval" && block.open);
  const currentTurnId = blocks.find((block) => block.turnId !== null)?.turnId ?? null;
  const observed = currentTurnEvents(events, currentTurnId).filter((event) =>
    !event.historical
    && Number.isFinite(Date.parse(event.at))
  );
  const startedAt = observed.find((event) => event.method === "turn/userPrompt" || event.method === "turn/startAccepted" || event.method === "turn/started");
  const lastActivity = observed.at(-1);
  const elapsed = startedAt ? elapsedLabel(now - Date.parse(startedAt.at)) : null;
  const quiet = active && lastActivity ? Math.max(0, now - Date.parse(lastActivity.at)) : null;
  const latestCommand = commands.at(-1);
  const observedProgress = latestCommand
    ? latestCommand.running ? "명령을 실행하고 출력을 받고 있습니다."
      : latestCommand.status === "failed" ? "명령 실패를 관측했습니다. 후속 설명과 실행 결과를 확인할 수 있습니다."
        : latestCommand.status === "completed" ? "명령 실행이 종료됐습니다. 제공된 결과를 아래에서 확인할 수 있습니다."
          : "명령은 관측됐지만 최종 결과는 아직 확인되지 않았습니다."
    : files.length ? "파일 변경 사건을 받았습니다. 제공된 변경 내역을 아래에서 확인할 수 있습니다."
      : null;
  if (turn === "idle" && blocks.length === 0) return null;
  let label = "작업 상태를 확인하는 중";
  if (turn === "starting"   ) label = "작업 시작을 기다리는 중";
  if (turn === "running"    ) label = explanations.length > 0 ? "설명과 실행이 이어지고 있습니다" : "첫 작업 소식을 기다리는 중";
  if (turn === "completed"  ) label = "응답이 끝났습니다";
  if (turn === "interrupted") label = "중단 결과를 확인했습니다";
  if (turn === "failed"     ) label = "작업이 실패했습니다";
  if (active && quiet !== null && quiet >= 15_000) label = "새 활동을 기다리는 중";
  if (approvals.length > 0) label = "사용자 결정을 기다리는 중";
  if (interrupt === "requested" || interrupt === "accepted") label = "중단 결과를 기다리는 중";
  if (transport === "disconnected" || transport === "error") label = "Native 연결을 확인할 수 없습니다";
  return <section className={`work-flow ${active ? "is-active" : ""}`} aria-label="작업 흐름" data-testid="work-flow">
    <div className="work-flow-heading"><strong>작업 흐름</strong><span>{active ? `진행 중${elapsed ? ` · ${elapsed}` : ""}` : finished ? "종료" : "결과 확인 필요"}</span></div>
    <p role="status" aria-live="polite">{label}</p>
    {observedProgress && <p data-testid="observed-progress">앱 관측 · {observedProgress}</p>}
    {active && lastActivity && <p className="work-flow-time">마지막 활동 {elapsedLabel(now - Date.parse(lastActivity.at))} 전</p>}
    <div className="work-flow-facts">
      <span>공개 설명 {explanations.length}개</span>
      <span>명령 {commands.length}개</span>
      <span>파일 변경 {files.length}개</span>
      <span>답변 {answers.length > 0 ? "수신" : "대기"}</span>
    </div>
    {active && explanations.length === 0 && <p className="work-flow-note">Native의 공개 설명을 기다리고 있습니다. 관측되는 실행은 아래에 즉시 표시합니다.</p>}
  </section>;
}

function ResultSummary({ blocks, turn }: { blocks: readonly Block[]; turn: TurnState }) {
  if (!["completed", "interrupted", "failed", "unknown"].includes(turn)) return null;
  const commands = blocks.filter((block): block is Extract<Block, { kind: "command" }> => block.kind === "command");
  const files = blocks.filter((block): block is Extract<Block, { kind: "files" }> => block.kind === "files");
  const answers = blocks.filter((block): block is Extract<Block, { kind: "answer" }> => block.kind === "answer");
  const counts = executionResultCounts(blocks);
  const verification = commands.filter((block) => isVerificationCommand(block.command));
  const verificationPassed = verification.filter((block) => block.status === "completed").length;
  return <section className="result-summary" aria-label="결과 요약" data-testid="result-summary">
    <div className="result-summary-heading"><strong>결과 요약</strong><span>{turn === "completed" ? "응답 종료" : turn === "interrupted" ? "중단됨" : turn === "failed" ? "실패" : "결과 미확인"}</span></div>
    <dl>
      <div><dt>최종 답변</dt><dd>{answers.length > 0 ? "수신됨" : "미제공"}</dd></div>
      <div><dt>실행</dt><dd>명령 {counts.commands}개 · 파일 변경 {counts.files}개</dd></div>
      <div><dt>검증</dt><dd>{verification.length > 0 ? `${verificationPassed}/${verification.length}개 성공` : "식별된 검사 없음"}</dd></div>
      <div><dt>확인 필요</dt><dd>{counts.failed > 0 || counts.unresolved > 0 || counts.declined > 0 ? `실패 ${counts.failed}개 · 거절 ${counts.declined}개 · 결과 미확인 ${counts.unresolved}개` : "관측된 실행 차단 없음"}</dd></div>
    </dl>
    <p>응답 종료는 요청한 업무의 검증 완료와 다를 수 있습니다. 위 최종 답변과 실제 실행 근거를 함께 확인하세요.</p>
  </section>;
}


function turnLabel(turn: TurnState): string {
  if (turn === "idle"       ) return "요청 전";
  if (turn === "starting"   ) return "요청 접수 확인 중";
  if (turn === "running"    ) return "실행 중";
  if (turn === "completed"  ) return "실행 종료";
  if (turn === "interrupted") return "중단 확인";
  if (turn === "failed"     ) return "실행 실패";
  return "실행 결과 미확인";
}


function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

async function verifyNativeActivity(textarea: HTMLTextAreaElement, send: HTMLButtonElement) {
  const openMonitor = document.querySelector('[aria-label="상세 실행 모니터 열기"]');
  if (openMonitor instanceof HTMLButtonElement) { openMonitor.click(); await afterTwoFrames(); }
  await waitForEvent("fixture/inventoryRaceComplete");
  const inventoryDeadline = performance.now() + 5_000;
  let snapshot = await window.www.workspace().then((selected) => window.www.events(selected));
  while (performance.now() < inventoryDeadline && !snapshot.some((entry) => entry.method === "activity/skillsListed" && JSON.stringify(entry.params).includes("www-design"))) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    snapshot = await window.www.workspace().then((selected) => window.www.events(selected));
  }
  const configured = [...snapshot].reverse().find((event) => event.method === "thread/configured");
  const params     = configured?.params && typeof configured.params === "object" && !Array.isArray(configured.params) ? configured.params as Record<string, unknown> : {};
  const threadId   = typeof params.threadId === "string" ? params.threadId : null;
  if (!threadId) throw new Error("Activity probe expected a configured thread");
  await waitForEvent("turn/completed");
  const before = projectActivitySidebar(snapshot, threadId);
  const panel  = document.querySelector('[data-testid="activity-panel"]');
  if (!(panel instanceof HTMLElement) || panel.hidden) throw new Error("Activity probe expected the visible activity panel");
  const skillLabels = [...panel.querySelectorAll('[data-testid="activity-skill-row"] .na-row-copy strong')].map((node) => node.textContent);
  const hookLabels  = [...panel.querySelectorAll('[data-testid="activity-hook-row"] .na-row-copy strong')].map((node) => node.textContent);
  const skillsListed = before.skillsComplete && skillLabels.join("|") === "www-design|unused-skill|www-design";
  const hooksListed  = before.hooksComplete && hookLabels.join("|") === "sessionStart|preToolUse";
  const raceStarted  = snapshot.find((event) => event.method === "fixture/inventoryRequest2Started")?.seq ?? 0;
  const raceFailed   = snapshot.find((event) => event.method === "fixture/inventoryRequest2Failed")?.seq ?? 0;
  const raceComplete = snapshot.find((event) => event.method === "fixture/inventoryRaceComplete")?.seq ?? 0;
  const skillLists   = snapshot.filter((event) => event.method === "activity/skillsListed");
  const inventoryRaceSuppressed = raceStarted > 0
    && raceFailed > raceStarted
    && raceComplete > raceFailed
    && !skillLists.some((entry) => JSON.stringify(entry.params).includes("stale-skill"))
    && skillLists.some((entry) => JSON.stringify(entry.params).includes("www-design"));
  const initialNative = projectNativeActivity(await window.www.workspace().then((selected) => window.www.events(selected)), threadId);
  const initialTurn = initialNative.turns.at(-1);
  const turnSelect = panel.querySelector('[data-testid="activity-turn-select"]');
  if (!initialTurn || !(turnSelect instanceof HTMLSelectElement)) throw new Error("Activity probe expected a turn selector");
  turnSelect.value = initialTurn.id;
  turnSelect.dispatchEvent(new Event("change", { bubbles: true }));
  await afterTwoFrames();
  const draft          = textarea.value          ;
  const selectionStart = textarea.selectionStart ;
  const selectionEnd   = textarea.selectionEnd   ;
  document.querySelector<HTMLButtonElement>('[data-testid="chat-nav"]')?.click();
  await afterTwoFrames();
  setTextareaValue(textarea, "활동 패널 두 번째 답변 검증");
  await afterTwoFrames();
  send.click();
  // 실시간 반응을 관찰할 패널을 다음 IPC 알림 전에 연다. 숨긴 동안의 과거 반응은 재생하지 않는다.
  document.querySelector<HTMLButtonElement>('[data-testid="monitoring-nav"]')?.click();
  await afterTwoFrames();
  const deadline = performance.now() + 5000;
  let observed   = projectActivitySidebar(await window.www.workspace().then((selected) => window.www.events(selected)), threadId);
  let skillsReacted = false;
  let secondSkillReacted = false;
  let hooksReacted  = false;
  while (performance.now() < deadline) {
    observed      = projectActivitySidebar(await window.www.workspace().then((selected) => window.www.events(selected)), threadId);
    skillsReacted = skillsReacted || panel.querySelector('[data-row-id="skill:/fixture/skills/www-design/SKILL.md"].is-reacting') !== null;
    secondSkillReacted = secondSkillReacted || panel.querySelector('[data-row-id="skill:/fixture/skills/unused/SKILL.md"].is-reacting') !== null;
    hooksReacted  = hooksReacted || panel.querySelector('[data-row-id="hook:pre-tool"].is-reacting') !== null;
    if (observed.pulses.length >= before.pulses.length + 3 && skillsReacted && secondSkillReacted && hooksReacted) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const skillsObserved = observed.skills.find((row) => row.label === "www-design")?.lastActivityLabel === "읽기" && skillsReacted;
  const multipleSkillsObserved = observed.skills.find((row) => row.label === "unused-skill")?.lastActivityLabel === "읽기" && secondSkillReacted;
  const hooksObserved  = observed.hooks.find((row) => row.label === "preToolUse")?.lastActivityLabel === "시작" && hooksReacted;
  const fixedOrder     = skillLabels.join("|") === [...panel.querySelectorAll('[data-testid="activity-skill-row"] .na-row-copy strong')].map((node) => node.textContent).join("|")
    && hookLabels.join("|") === [...panel.querySelectorAll('[data-testid="activity-hook-row"] .na-row-copy strong')].map((node) => node.textContent).join("|");
  const privateReasoningHidden = !document.body.textContent?.includes("PRIVATE_REASONING_DO_NOT_RENDER");
  await new Promise((resolve) => setTimeout(resolve, 820));
  const extendedRow = panel.querySelector('[data-row-id="skill:/fixture/skills/www-design/SKILL.md"]');
  const extendedHighlight = extendedRow instanceof HTMLElement
    && extendedRow.classList.contains("is-reacting")
    && getComputedStyle(extendedRow).backgroundColor !== "rgba(0, 0, 0, 0)";
  const overview = [...panel.querySelectorAll(".na-nav button")].find((button) => button.textContent === "개요");
  if (!(overview instanceof HTMLButtonElement)) throw new Error("Activity probe expected overview navigation");
  overview.click();
  await afterTwoFrames();
  const activityTab = [...document.querySelectorAll(".panel .ptab")].find((button) => button.textContent === "흐름");
  if (!(activityTab instanceof HTMLButtonElement)) throw new Error("Activity probe expected activity navigation");
  activityTab.click();
  await afterTwoFrames();
  const nativeProjection = projectNativeActivity(await window.www.workspace().then((selected) => window.www.events(selected)), threadId, (await window.www.workspace())?.path);
  const historySelectionPreserved = turnSelect.value === initialTurn.id && turnSelect.options.length === 2;
  const selectedTurn = nativeProjection.turns.at(-1);
  turnSelect.value = selectedTurn?.id ?? "";
  turnSelect.dispatchEvent(new Event("change", { bubbles: true }));
  await afterTwoFrames();
  const second = nativeProjection.turns[1];
  const turnGrouping = nativeProjection.turns.length === 2 && initialTurn.turnId !== selectedTurn?.turnId;
  const usageNotDuplicated = second?.usage?.totalTokens === 1000;
  const modelRerouted =
       second?.model?.basis                                               === "rerouted"
    && second.model.name                                                  === "fixture-model-b"
    && panel.querySelector('[data-testid="activity-model"]')?.textContent === "fixture-model-b";
  const wwwFlow = panel.querySelector('[data-testid="www-flow"]');
  const wwwRolesObserved = wwwFlow?.querySelector('[data-artifact-id="www-dev"]')?.textContent?.includes("읽기 명령 관측") === true;
  const wwwSkillsObserved = wwwFlow?.querySelector('[data-artifact-id="www-design"]')?.textContent?.includes("읽기 완료") === true;
  const generic = panel.querySelector('[data-testid="native-activity-details"]');
  const generalHooksSecondary = generic instanceof HTMLDetailsElement && !generic.open;
  const hookFailureExplained = generic?.textContent?.includes("신뢰 검토 필요") === true;
  const historyNotReplayed = panel.querySelector(".is-reacting") === null;
  const completionBaseline = Math.max(0, ...(await window.www.workspace().then((selected) => window.www.events(selected))).filter((event) => event.method === "turn/completed").map((event) => event.seq));
  const finishButton = document.querySelector<HTMLElement>("[data-testid=interrupt-button]");
  if (!(finishButton instanceof HTMLButtonElement) || finishButton.disabled) throw new Error("Activity probe expected the second running turn");
  document.querySelector<HTMLButtonElement>('[data-testid="chat-nav"]')?.click();
  await afterTwoFrames();
  finishButton.click();
  const finishDeadline = performance.now() + 5_000;
  let secondTurnFinished = false;
  while (performance.now() < finishDeadline) {
    secondTurnFinished = (await window.www.workspace().then((selected) => window.www.events(selected))).some((event) => event.method === "turn/completed" && event.seq > completionBaseline);
    if (secondTurnFinished) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (!secondTurnFinished) throw new Error("Activity probe did not finish the second turn before conversation restore");
  await afterTwoFrames();
  const selectConversationForProbe = async (id: string): Promise<void> => {
    const deadline = performance.now() + 5_000;
    let clicked = false;
    while (performance.now() < deadline) {
      const current = document.querySelector(`[data-testid="conversation-item"][data-thread-id="${id}"]`);
      if (current?.getAttribute("aria-current") === "true") return;
      if (!clicked && current instanceof HTMLButtonElement && !current.disabled) {
        current.click();
        clicked = true;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Activity probe did not switch to conversation ${id}`);
  };
  await waitForEvent('serverRequest/resolved');
  const interruptApprovalResolved = (await window.www.workspace().then((selected) => window.www.events(selected))).some((event) => {
    const params = event.params;
    return event.method === 'serverRequest/resolved' && event.seq > completionBaseline && !!params && typeof params === 'object' && 'requestId' in params && params.requestId === 42;
  });
  if (!interruptApprovalResolved) throw new Error('Activity probe expected explicit approval resolution before conversation restore');
  await selectConversationForProbe("thread-saved");
  await waitForEvent("fixture/lateHookAfterRestore");
  await selectConversationForProbe(threadId);
  await afterTwoFrames();
  const restoredHook = panel.querySelector('[data-row-id="hook:session-start"]');
  const conversationRestoreDedupe = restoredHook instanceof HTMLElement && !restoredHook.classList.contains("is-reacting");
  setTextareaValue(textarea, draft);
  await afterTwoFrames();
  textarea.setSelectionRange(selectionStart, selectionEnd);
  if (textarea.value !== draft || textarea.selectionStart !== selectionStart || textarea.selectionEnd !== selectionEnd) throw new Error("Activity probe lost draft or selection after the second turn");
  const result = { skillsListed, hooksListed, interruptApprovalResolved, inventoryRaceSuppressed, skillsObserved, multipleSkillsObserved, hooksObserved, fixedOrder, extendedHighlight, historyNotReplayed, conversationRestoreDedupe, privateReasoningHidden, turnGrouping, historySelectionPreserved, usageNotDuplicated, modelRerouted, wwwRolesObserved, wwwSkillsObserved, generalHooksSecondary, hookFailureExplained };
  if (Object.values(result).some((value) => !value)) throw new Error(`Activity probe failed: ${JSON.stringify(result)}`);
  return result;
}

function LineIcon({ kind }: { kind: "folder" | "star" | "refresh" | "chat" | "map" | "report" }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{kind === "folder" ? <path d="M3 7V5h6l2 2h10v13H3V7Z"/> : kind === "star" ? <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z"/> : kind === "chat" ? <path d="M4 4h16v12H9l-5 4V4Z"/> : kind === "map" ? <path d="M3 3h6v6H3V3Zm12 12h6v6h-6v-6ZM9 6h9v9M6 9v9h9"/> : kind === "report" ? <path d="M5 3h14v18H5V3Zm3 5h8M8 12h8M8 16h5"/> : <path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>}</svg>;
}

interface SessionCloseState { allowed: boolean; reason?: string }

const chatThemes = [
  { value: "terminal-basic", label: "Terminal Basic" },
  { value: "www-mint", label: "WWW Mint" },
] as const;

function ChatOptionPicker<Value extends string>({ heading, theme, options, current, saving = false, onChoose, onCancel }: {
  heading: string;
  theme: ChatTheme;
  options: readonly { value: Value; label: string }[];
  current: Value | null;
  saving?: boolean;
  onChoose(value: Value): void;
  onCancel(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useLayoutEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); };
  }, []);
  return <dialog className="chat-model-picker" data-chat-theme={theme} ref={dialog} aria-labelledby={title} onCancel={(event) => { event.preventDefault(); if (!saving) onCancel(); }}>
    <h2 id={title}>{heading}</h2>
    {current !== null && !options.some(({ value }) => value === current) && <p className="muted" data-testid="unavailable-current-option">현재 선택 · {current} (선택 목록에 없음)</p>}
    <div className="chat-model-options">
      {options.map(({ value, label }) => <button type="button" className="secondary" key={value}
        disabled={saving} autoFocus={value === current} aria-pressed={value === current} onClick={() => onChoose(value)}>{label}</button>)}
    </div>
    <button type="button" className="secondary" disabled={saving} onClick={onCancel}>취소</button>
  </dialog>;
}

function App({ session, active, initial, theme, themeReady, onThemeChange, onCloseState }: {
  session: NativeSessionSummary; active: boolean; initial: boolean;
  theme: ChatTheme;
  themeReady: boolean;
  onThemeChange(theme: ChatTheme): Promise<void>;
  onCloseState: (id: string, state: SessionCloseState) => void;
}) {
  const api = useSessionApi();
  const sessionId = session.id;
  const latestSession = useRef(session);
  latestSession.current = session;
  const [projectListOpen, setProjectListOpen] = useState(initial);
  const projectListButton = useRef<HTMLButtonElement>(null);
  const listPanel = useRef<HTMLElement>(null);
  const closeProjectList = () => { setProjectListOpen(false); requestAnimationFrame(() => projectListButton.current?.focus()); };
  useEffect(() => { if (projectListOpen) listPanel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, [projectListOpen]);
  const [view, setView] = useState<"home" | "dashboard" | "chat" | "ecosystem" | "reports" | "monitoring" | "rpa-standard">(initial ? "home" : "chat");
  const [mapNavigationOpen, setMapNavigationOpen] = useState(false);
  const [reportsOpened, setReportsOpened] = useState(false);
  useEffect(() => { if (view === "reports") setReportsOpened(true); }, [view]);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const dashboardGeneration = useRef(0);
  const [autoReportHint, setAutoReportHint] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceSelection | null>(null);
  const selectionRef = useRef<WorkspaceSelection | null>(null);
  const [projects, setProjects] = useState<readonly ProjectInfo[]>([]);
  const showRpaStandard = workspace?.hasRpaProfile === true && projects.some(project => project.workspaceKey === workspace.workspaceKey);
  const [projectError, setProjectError] = useState("");
  const [projectStorageWarnings, setProjectStorageWarnings] = useState<readonly ResourceScope[]>([]);
  const projectStorageWarning = projectStorageWarnings.length ? "전환 시점 리소스 저장을 확인하지 못한 대화: " + projectStorageWarnings.map((scope) => `${projects.find((item) => item.workspaceKey === scope.workspaceKey)?.name ?? scope.workspaceKey} · ${scope.threadId}`).join("; ") : "";
  const [projectLoading, setProjectLoading] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [resources, setResources] = useState<ResourceSnapshot | null>(null);
  const resourceRef = useRef<ResourceSnapshot | null>(null);
  const resourceVersion = useRef(0);
  const liveConnection = useRef(0);
  const resourceQueue = useRef<ResourceSnapshot[]>([]);

  const monitorButton = useRef<HTMLButtonElement>(null);
  const requireSelection = (): WorkspaceSelection => {
    if (!selectionRef.current) throw new Error("프로젝트 선택을 기다려 주세요.");
    return selectionRef.current;
  };
  const matchesSelection = (value: SelectionRef, selected = selectionRef.current) => selected !== null && value.sessionId === selected.sessionId && value.processEpoch === selected.processEpoch && value.workspaceKey === selected.workspaceKey && value.selectionEpoch === selected.selectionEpoch;
  const acceptResources = (snapshot: ResourceSnapshot) => {
    if (!matchesSelection({ ...snapshot, workspaceKey: snapshot.scope.workspaceKey }) || snapshot.scope.threadId !== threadRef.current) return;
    const previous = resourceRef.current;
    if (previous && previous.scope.workspaceKey === snapshot.scope.workspaceKey && previous.scope.threadId === snapshot.scope.threadId && previous.selectionEpoch === snapshot.selectionEpoch && (previous.revision > snapshot.revision || (previous.revision === snapshot.revision && previous.durableRevision > snapshot.durableRevision))) return;
    resourceRef.current = snapshot;
    resourceVersion.current++;
    setResources(snapshot);
  };
  const [events, setEvents] = useState<ScopedAppEvent[]>([]);
  const [activityState, setActivityState] = useState(createActivitySidebarState);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [promptSnapshot, setPromptSnapshot] = useState({ text: "", revision: 0 });
  const [hasDraft, setHasDraft] = useState(false);
  const setPrompt = useCallback((text: string) => {
    promptRef.current = text;
    setHasDraft(text.length > 0);
    setPromptSnapshot((current) => ({ text, revision: current.revision + 1 }));
  }, []);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [listCursor, setListCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [switching, setSwitching] = useState(false);
  const [inputNotice, setInputNotice] = useState("");
  const threadRef = useRef<string | null>(null);
  const promptRef = useRef("");
  const switchingRef = useRef(false);
  const switchGeneration = useRef(0);
  const queuedEvents = useRef<ScopedAppEvent[]>([]);
  const transcriptState = useRef<ConversationEventState>({ events: [], reconnect: null });
  const bootstrapPending = useRef(true);
  const consumeEvents = (snapshot: readonly ScopedAppEvent[], live: readonly ScopedAppEvent[], reset = false, resetActivity = false) => {
    const selected = selectionRef.current;
    if (!selected) return;
    const batch = reduceConversationEvents(reset ? { events: [], reconnect: null } : transcriptState.current, snapshot, live, selected, threadRef.current);
    transcriptState.current = batch;
    // 같은 선택의 재연결은 진행 중 전송의 성공·실패 처리를 취소하지 않는다.
    liveConnection.current = Math.max(0, batch.reconnect?.connectionGeneration ?? 0, ...batch.events.map((event) => event.connectionGeneration));
    setEvents(batch.events);
    setActivityState((current) => updateActivitySidebarSnapshot(resetActivity || batch.replaced ? createActivitySidebarState() : current, batch));
  };
  const listGeneration = useRef(0);
  const readingStates = useRef(new Map<string, ConversationReadingState>());
  const rowMemories = useRef(new Map<string, ChatRowMemory>());
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const currentKey = conversationKey(workspace?.path ?? "", threadId);
  let rowMemory = rowMemories.current.get(currentKey);
  if (!rowMemory) {
    rowMemory = new Map();
    rowMemories.current.set(currentKey, rowMemory);
  }

  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"activity" | "overview" | "events">("activity");
  const [monitorVisible] = useState(() => window.innerWidth >= 1000);
  const [newContent, setNewContent] = useState(false);
  const [sending, setSending] = useState(false);
  const [modelPicker, setModelPicker] = useState<{ models: NativeModelOption[]; current: string | null } | null>(null);
  const modelChoice = useRef<string | undefined>(undefined);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const returnPromptFocus = useRef(false);
  useLayoutEffect(() => {
    if (active && modelPicker === null && !themePickerOpen && returnPromptFocus.current) {
      returnPromptFocus.current = false;
      promptInput.current?.focus();
    }
  }, [active, modelPicker, themePickerOpen]);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [sendEventStart, setSendEventStart] = useState<number>(Infinity);
  const timingReceipts = useRef(new Map<string, number | null>());
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const failedDraftRef = useRef<string | null>(null);
  const transcriptRef       = useRef<HTMLDivElement>(null)             ;
  const transcriptScrollTop = useRef(0)                                ;
  const followTail          = useRef(true)                             ;
  const sendGeneration = useRef(0);
  const sendingRef          = useRef(false)                            ;
  const retainedApprovals = matchesSelection(session.workspace, workspace) && session.threadId === threadId
    && session.connectionGeneration >= liveConnection.current ? session.pendingApprovalEvents : undefined;
  const projection = useMemo(() => {
    if (!retainedApprovals?.length) return project(events);
    const history = new Map(events.map(event => [event.seq, event]));
    for (const event of retainedApprovals) {
      if (!history.has(event.seq)) history.set(event.seq, event);
    }
    return project([...history.values()].sort((left, right) => left.seq - right.seq));
  }, [events, retainedApprovals]);
  const chatInput = liveChatInput(session, workspace, threadId, liveConnection.current, projection);

  const compaction = matchesSelection(session.workspace, workspace) && session.threadId === threadId ? session.compaction : null;
  const compacting = compaction?.state === "pending" || compaction?.state === "running";
  const compactionNotice = compaction?.state === "failed" ? compaction.message
    : compaction?.state === "completed" ? "대화 압축 완료"
      : compaction?.state === "pending" ? "대화 압축 접수 대기"
        : compaction?.state === "running" ? "대화 압축 중" : "";
  const selectionBlocked = failedDraft !== null || chatInput.working || sending || switching || compacting || chatInput.approvals > 0;

  useEffect(() => {
    const reason = compacting ? "대화 압축이 끝난 뒤 닫을 수 있습니다."
      : sending || switching ? "요청·대화 준비가 끝난 뒤 닫을 수 있습니다."
      : chatInput.working ? "실행을 중단하고 결과를 확인한 뒤 닫아 주세요."
        : chatInput.approvals > 0 ? "승인 요청을 처리한 뒤 닫아 주세요."
          : failedDraft !== null ? "실패한 요청을 복원하거나 버린 뒤 닫아 주세요."
            : hasDraft || [...readingStates.current].some(([key, state]) => key !== currentKey && state.draft.length > 0)
              ? "이 탭의 대화에 남은 초안을 보내거나 비운 뒤 닫아 주세요." : undefined;
    onCloseState(sessionId, { allowed: reason === undefined, ...(reason ? { reason } : {}) });
  }, [sessionId, currentKey, sending, switching, compacting, chatInput.working, chatInput.approvals, failedDraft, hasDraft, onCloseState]);

  const refreshConversations = async (cursor?: string) => {
    const selected = requireSelection();
    const generation = ++listGeneration.current;
    setListLoading(true);
    setListError("");
    try {
      const result = await api.listConversations(requireSelection(), cursor);
      if (generation !== listGeneration.current || !matchesSelection(selected)) return;
      setConversations((current) => cursor
        ? [...new Map([...current, ...result.threads].map((item) => [item.id, item])).values()]
        : result.threads);
      setListCursor(result.nextCursor);
    } catch (failure) {
      if (generation === listGeneration.current && matchesSelection(selected)) setListError(String(failure));
    } finally {
      if (generation === listGeneration.current && matchesSelection(selected)) setListLoading(false);
    }
  };

  useEffect(() => {
    setConversations([]);
    setListCursor(null);
    if (workspace && (view === "chat" || (view === "ecosystem" && mapNavigationOpen))) void refreshConversations();
    return () => { listGeneration.current += 1; };
  }, [workspace?.path, workspace?.selectionEpoch, view === "chat", view === "ecosystem" && mapNavigationOpen]);

  useEffect(() => {
    if (!workspace || view !== "chat") return;
    void api.refreshActivity(requireSelection()).catch((failure: unknown) => setError(String(failure)));
  }, [workspace?.workspaceKey, workspace?.selectionEpoch, view === "chat"]);

  useEffect(() => {
    readingStates.current.set(currentKey, {
      draft: promptRef.current,
      scrollTop: transcriptScrollTop.current,
      followTail: followTail.current
    });
  }, [currentKey, promptSnapshot]);

  const rememberReading = () => {
    readingStates.current.set(currentKey, {
      draft: promptRef.current,
      scrollTop: transcriptRef.current?.scrollTop ?? transcriptScrollTop.current,
      followTail: followTail.current
    });
  };

  const restoreReading = (id: string | null, path = workspace?.path ?? "") => {
    const remembered = readingStates.current.get(conversationKey(path, id)) ?? blankReadingState();
    transcriptScrollTop.current = remembered.scrollTop;
    followTail.current = remembered.followTail;
    promptRef.current = remembered.draft;
    setPrompt(remembered.draft);
    setNewContent(false);
    setInputNotice("");
  };

  const selectConversation = async (id: string | null) => {
    if (selectionBlocked || switchingRef.current || id === threadRef.current) return;
    rememberReading();
    switchingRef.current = true;
    setSwitching(true);
    queuedEvents.current = [];
    const generation = ++switchGeneration.current;
    setError("");
    try {
      const selected = requireSelection();
      const restored = id === null
        ? await api.newConversation(selected)
        : await api.openConversation(selected, id);
      if (generation !== switchGeneration.current) return;
      selectionRef.current = restored.workspace;
      setWorkspace(restored.workspace);
      threadRef.current = restored.threadId;
      resourceRef.current = null;
      setResources(null);
      if (restored.resources) acceptResources(restored.resources);
      for (const snapshot of resourceQueue.current) acceptResources(snapshot);
      resourceQueue.current = [];
      restoreReading(restored.threadId, restored.workspace.path);
      setThreadId(restored.threadId);
      const arrived = queuedEvents.current.filter((event) => matchesSelection(event, restored.workspace) && belongsToConversation(event, restored.threadId));
      consumeEvents(restored.events, arrived, true);
      setView("chat");
      void refreshConversations();
      void refreshProjects();
    } catch (failure) {
      const arrived = queuedEvents.current.filter((event) => matchesSelection(event) && belongsToConversation(event, threadRef.current));
      consumeEvents([], arrived);
      for (const snapshot of resourceQueue.current) acceptResources(snapshot);
      resourceQueue.current = [];
      setError(String(failure));
    } finally {
      if (generation === switchGeneration.current) {
        queuedEvents.current = [];
        switchingRef.current = false;
        setSwitching(false);
      }
    }
  };

  const quote = useCallback((text: string) => {
    const next = draftWithQuote(promptRef.current, text);
    if (next.length > MAX_PROMPT_CHARS) {
      setInputNotice("인용문이 입력 한도를 넘어 추가하지 않았습니다.");
      return;
    }
    promptRef.current = next;
    setPrompt(next);
    requestAnimationFrame(() => {
      promptInput.current?.focus();
      promptInput.current?.setSelectionRange(next.length, next.length);
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    const acceptEvent = (event: ScopedAppEvent) => {
      if (disposed) return;
      const timing = timingParams(event);
      if (timing && !event.historical) {
        const key = timing.traceId + ":" + event.seq;
        const receipts = timingReceipts.current;
        if (!receipts.has(key)) receipts.set(key, performance.now());
        if (receipts.size > 128) {
          const oldest = receipts.keys().next().value;
          if (oldest !== undefined) receipts.delete(oldest);
        }
      }
      if (switchingRef.current || bootstrapPending.current || !selectionRef.current) { queuedEvents.current.push(event); return; }
      if (!matchesSelection(event) || event.connectionGeneration < liveConnection.current) return;
      if (event.method === "thread/configured" && sendingRef.current && threadRef.current === null) threadRef.current = eventThreadId(event);
      if (!belongsToConversation(event, threadRef.current)) return;
      consumeEvents([], [event]);
      if (event.method === "turn/completed") void refreshConversations();
      if (event.method === "activity/resourcesUnavailable") setError("리소스 복원 실패 · 채팅은 계속 사용할 수 있습니다.");
      if (event.method === "reports/autoState" && event.params && typeof event.params === "object" && "status" in event.params) setAutoReportHint(event.params.status === "saved" ? "새 보고서" : event.params.status === "judging" ? "판단 중" : event.params.status === "failed" ? "확인 필요" : "");
      if (event.method === "reports/autoError" && event.params && typeof event.params === "object" && "message" in event.params) setError(`자동 보고서: ${String(event.params.message)}`);
    };
    // 두 구독을 먼저 설치한 뒤 초기 상태를 요청한다.
    const unsubscribe = api.onEvent(acceptEvent);
    const unsubscribeResources = api.onActivityResources((snapshot) => {
      if (disposed) return;
      if (switchingRef.current || !selectionRef.current) { resourceQueue.current.push(snapshot); return; }
      acceptResources(snapshot);
    });
    void (async () => {
      const selected = await api.workspace();
      if (disposed) return;
      selectionRef.current = selected;
      setWorkspace(selected);
      const snapshot = await api.events(selected);
      bootstrapPending.current = false;
      if (disposed || switchingRef.current || !matchesSelection(selected)) return;
      const configured = [...snapshot].reverse().find((event) => event.method === "thread/configured");
      const currentSession = latestSession.current;
      const id = matchesSelection(currentSession.workspace, selected) ? currentSession.threadId : configured ? eventThreadId(configured) : null;
      if (threadRef.current === null && !sendingRef.current) { threadRef.current = id; setThreadId(id); }
      const current = snapshot.filter((event) => matchesSelection(event) && belongsToConversation(event, threadRef.current));
      const queued = queuedEvents.current;
      queuedEvents.current = [];
      consumeEvents(current, queued);
      for (const resource of resourceQueue.current) acceptResources(resource);
      resourceQueue.current = [];
      const version = resourceVersion.current;
      const initialResources = await api.activityResources(selected);
      if (disposed || !matchesSelection(selected)) return;
      if (initialResources && (version === resourceVersion.current || !resourceRef.current || initialResources.revision > resourceRef.current.revision || initialResources.durableRevision > resourceRef.current.durableRevision)) acceptResources(initialResources);
    })().catch((failure: unknown) => {
      bootstrapPending.current = false;
      if (!disposed) {
        consumeEvents([], queuedEvents.current);
        queuedEvents.current = [];
      }
      if (!disposed) setError(String(failure));
    });
    return () => {
      disposed = true;
      timingReceipts.current = new Map();
      unsubscribe();
      unsubscribeResources();
    };
  }, []);

  useEffect(() => {
    const receipts = timingReceipts.current;
    if (!receipts.size || !Number.isFinite(sendEventStart)) return;
    const committed: { seq: number; timing: NativeTimingEvent; receivedAt: number }[] = [];
    for (const event of events) {
      if (event.historical || event.seq < sendEventStart) continue;
      const timing = timingParams(event);
      if (!timing) continue;
      const key = timing.traceId + ":" + event.seq;
      const receivedAt = receipts.get(key);
      if (typeof receivedAt !== "number") continue;
      committed.push({ seq: event.seq, timing, receivedAt });
      receipts.set(key, null);
    }
    if (!committed.length) return;
    void afterTwoFrames().then(() => {
      if (timingReceipts.current !== receipts) return;
      const frameAt = performance.now();
      for (const { seq, timing, receivedAt } of committed) {
        if (performance.getEntriesByName("www:renderer-commit-frame").length >= 128) performance.clearMarks("www:renderer-commit-frame");
        performance.mark("www:renderer-commit-frame", { detail: {
          traceId: timing.traceId, phase: timing.phase, status: timing.status, seq,
          mainElapsedMs: timing.elapsedMs, rendererReceiveToFrameMs: frameAt - receivedAt,
          chatVisible: view === "chat", definition: "renderer receive to second animation frame after React commit; main clock is separate",
        } });
      }
    });
  }, [events, sendEventStart, view]);

  const refreshProjects = async () => {
    const selected = requireSelection();
    setProjectLoading(true);
    setProjectError("");
    try {
      const result = await api.listProjects(selected);
      if (matchesSelection(selected)) setProjects(result);
    } catch (failure) { if (matchesSelection(selected)) setProjectError(String(failure)); }
    finally { if (matchesSelection(selected)) setProjectLoading(false); }
  };
  const refreshDashboard = async () => {
    if (!selectionRef.current) return;
    const selected = requireSelection();
    const generation = ++dashboardGeneration.current;
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const result = await api.dashboard(selected);
      if (generation === dashboardGeneration.current && matchesSelection(selected)) setDashboard(result);
    } catch (failure) {
      if (generation === dashboardGeneration.current && matchesSelection(selected)) setDashboardError(String(failure));
    } finally {
      if (generation === dashboardGeneration.current) setDashboardLoading(false);
    }
  };
  const loadDashboardWork = useCallback(async (card: DashboardWork) => {
    const selected = requireSelection();
    const result = await api.dashboardWork(selected, card.projectKey, card.id);
    if (!matchesSelection(selected)) throw new Error("프로젝트가 변경되어 이전 작업 상세를 표시하지 않습니다.");
    return result;
  }, [api]);
  useEffect(() => {
    if (!workspace || (view !== "home" && view !== "dashboard")) return;
    void refreshDashboard();
    const timer = window.setInterval(() => { void refreshDashboard(); }, 15_000);
    return () => { window.clearInterval(timer); dashboardGeneration.current++; };
  }, [workspace?.workspaceKey, workspace?.selectionEpoch, view === "home", view === "dashboard"]);
  useEffect(() => { if (workspace) void refreshProjects(); }, [workspace?.workspaceKey, workspace?.selectionEpoch]);
  const changeProject = async (key?: string) => {
    if (!selectionRef.current || selectionBlocked || switchingRef.current || key === selectionRef.current.workspaceKey) return;
    rememberReading();
    const selected = requireSelection();
    switchingRef.current = true;
    setSwitching(true);
    queuedEvents.current = [];
    try {
      const result: ConversationSelection | null = key
        ? key === "www" ? await api.selectWww(selected) : await api.switchProject(selected, key)
        : await api.chooseWorkspace(selected);
      if (!result) return;
      if (result.resourceStorageWarnings?.length) setProjectStorageWarnings(result.resourceStorageWarnings);
      liveConnection.current = 0;
      selectionRef.current = result.workspace;
      setWorkspace(result.workspace);
      threadRef.current = null;
      setThreadId(null);
      setConversations([]);
      setListCursor(null);
      setConversationSearch("");
      setAutoReportHint("");
      setReportsOpened(false);
      resourceRef.current = null;
      setResources(null);
      restoreReading(null, result.workspace.path);
      const arrived = queuedEvents.current.filter((event) => matchesSelection(event) && belongsToConversation(event, null));
      consumeEvents(result.events, arrived, true, true);
      setError("");
      setTargetKey(key === "www" || result.workspace.path === dashboard?.projects.find(item => item.project.kind === "www")?.project.path ? "www" : result.workspace.workspaceKey);
      setView("dashboard");
      setProjectListOpen(false);
    } catch (failure) { setError(String(failure)); }
    finally {
      switchingRef.current = false;
      setSwitching(false);
      const arrived = queuedEvents.current.filter((event) => matchesSelection(event) && belongsToConversation(event, threadRef.current));
      queuedEvents.current = [];
      consumeEvents([], arrived);
      for (const snapshot of resourceQueue.current) acceptResources(snapshot);
      resourceQueue.current = [];
    }
  };
  const openDashboardProject = (key: string) => {
    if (!workspace || !selectionRef.current) return;
    const project = dashboard?.projects.find(item => item.project.key === key)?.project;
    if (key === workspace.workspaceKey || (project !== undefined && project.path === workspace.path)) {
      setTargetKey(key);
      if (view === "home") setView("dashboard");
      closeProjectList();
    } else { void changeProject(key); }
  };
  const toggleFavorite = async (item: ProjectInfo) => {
    if (favoritePending) return;
    const selected = requireSelection();
    setFavoritePending(true);
    setProjectError("");
    try {
      await api.setProjectFavorite(selected, item.workspaceKey, !item.favorite);
      if (matchesSelection(selected)) await refreshProjects();
    } catch (failure) { if (matchesSelection(selected)) setProjectError(`즐겨찾기 저장 실패: ${String(failure)}`); }
    finally { setFavoritePending(false); }
  };

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element || !active || view !== "chat") return;
    if (followTail.current) {
      element.scrollTop = element.scrollHeight;
      setNewContent(false);
    } else {
      element.scrollTop = transcriptScrollTop.current;
      setNewContent(true);
    }
  }, [events, view, active]);

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element || !active || view !== "chat") return;
    const resize = new ResizeObserver(() => {
      if (followTail.current) element.scrollTop = element.scrollHeight;
    });
    resize.observe(element);
    for (const child of element.children) resize.observe(child);
    return () => resize.disconnect();
  }, [view, monitorVisible, active]);

  const closeModelPicker = () => {
    returnPromptFocus.current = true;
    setModelPicker(null);
  };

  const closeThemePicker = () => {
    returnPromptFocus.current = true;
    setThemePickerOpen(false);
  };

  const selectTheme = async (selected: ChatTheme) => {
    setSavingTheme(true);
    try {
      await onThemeChange(selected);
    } catch (failure) {
      setInputNotice(`테마를 저장하지 못했습니다. ${failure instanceof Error ? failure.message : String(failure)}`);
    } finally {
      setSavingTheme(false);
      closeThemePicker();
    }
  };

  const runSlash = async (command: NonNullable<ReturnType<typeof slashCommand>>) => {
    if (command === "theme") {
      if (!themeReady) { setInputNotice("테마 설정을 불러오는 중입니다."); return; }
      setInputNotice("");
      promptRef.current = "";
      setPrompt("");
      setThemePickerOpen(true);
      return;
    }
    if (session.busy || session.approvalCount > 0) {
      setInputNotice("현재 실행이 끝난 뒤 명령을 실행해 주세요.");
      return;
    }
    const selected = requireSelection();
    const thread = threadRef.current;
    if (command === "compact" && thread === null) {
      setInputNotice("압축할 이력이 있는 대화를 먼저 열어 주세요.");
      return;
    }
    const isCurrent = () => matchesSelection(selected) && threadRef.current === thread;
    sendingRef.current = true;
    setSending(true);
    setInputNotice("");
    promptRef.current = "";
    setPrompt("");
    try {
      if (command === "compact" && thread !== null) {
        await api.compactThread(selected, thread);
        return;
      }
      setInputNotice("모델 목록을 불러오는 중");
      const models = await api.listModels(selected);
      if (!isCurrent()) return;
      const configured = [...transcriptState.current.events].reverse().find(event => event.method === "thread/configured")?.params;
      const configuredModel = configured && typeof configured === "object" && "model" in configured && typeof configured.model === "string" ? configured.model : null;
      const current = modelChoice.current ?? configuredModel ?? models.find(item => item.isDefault)?.model ?? null;
      if (!models.length && current === null) throw new Error("선택할 수 있는 모델이 없습니다.");
      setModelPicker({ models, current });
      setInputNotice("");
    } catch (failure) {
      if (isCurrent()) setInputNotice(failure instanceof Error ? failure.message : String(failure));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const run = async () => {
    const draft = promptRef.current;
    const text = draft.trim();
    if (!selectionRef.current || !text || failedDraftRef.current !== null || sendingRef.current || switchingRef.current || text.length > MAX_PROMPT_CHARS) return;
    const command = slashCommand(text);
    if (command) {
      await runSlash(command);
      return;
    }
    const current = latestSession.current;
    if (current.compaction.state === "pending" || current.compaction.state === "running") return;
    const input = liveChatInput(current, selectionRef.current, threadRef.current, liveConnection.current, projection);
    const status = chatStatus({ ...input, sending: sendingRef.current, switching: switchingRef.current });
    if ((input.working && !status.steer) || input.approvals > 0) { setInputNotice(status.reason); return; }
    const steerTarget = status.steer && input.turnId && threadRef.current ? { thread: threadRef.current, turn: input.turnId, message: crypto.randomUUID() } : null;
    const selected = requireSelection();
    const generation = ++sendGeneration.current;
    const currentRequest = () => generation === sendGeneration.current && matchesSelection(selected);
    sendingRef.current = true;
    setSendEventStart((transcriptState.current.events.at(-1)?.seq ?? 0) + 1);
    performance.clearMarks("www:renderer-send");
    performance.mark("www:renderer-send");
    setSending(true);
    if (!steerTarget) setPendingPrompt(text);
    setError("");
    promptRef.current = "";
    setPrompt("");
    try {
      if (steerTarget) {
        const response = await api.steerTurn(selected, steerTarget.thread, steerTarget.turn, draft, steerTarget.message);
        if (!currentRequest()) return;
        if (response.turnId !== steerTarget.turn) throw new Error('추가 지시의 접수 턴이 일치하지 않습니다. 접수 여부 미확인');
        return;
      }
      let id = threadId;
      if (!id) {
        id = (await api.startThread(selected)).threadId;
        if (!currentRequest()) return;
        threadRef.current = id;
        readingStates.current.set(conversationKey(workspace?.path ?? "", id), { draft: "", scrollTop: 0, followTail: true });
        readingStates.current.delete(conversationKey(workspace?.path ?? "", null));
        setThreadId(id);
        const version = resourceVersion.current;
        void api.activityResources(selected).then((snapshot) => {
          if (snapshot && matchesSelection(selected) && (version === resourceVersion.current || !resourceRef.current || snapshot.revision > resourceRef.current.revision || snapshot.durableRevision > resourceRef.current.durableRevision)) acceptResources(snapshot);
        }).catch((failure: unknown) => { if (matchesSelection(selected)) setError(`리소스 복원 실패: ${String(failure)}`); });
      }
      await api.startTurn(selected, id, text, modelChoice.current);
      if (!currentRequest()) return;
      void refreshConversations();
    } catch (failure) {
      if (!currentRequest()) return;
      if (promptRef.current !== "") {
        failedDraftRef.current = draft;
        setFailedDraft(draft);
      } else {
        promptRef.current = draft;
        setPrompt(draft);
      }
      setError(String(failure));
    } finally {
      if (currentRequest()) {
        setPendingPrompt(null);
        sendingRef.current = false;
        setSending(false);
      }
    }
  };
  const restoreFailedDraft = () => {
    const draft = failedDraftRef.current;
    if (draft === null || promptRef.current !== "") return;
    promptRef.current = draft;
    setPrompt(draft);
    failedDraftRef.current = null;
    setFailedDraft(null);
    promptInput.current?.focus();
  };
  const discardFailedDraft = () => {
    failedDraftRef.current = null;
    setFailedDraft(null);
  };
  const choose = () => changeProject();
  const decide = useCallback(async (id: string | number, decision: string, approvalToken: string | null) => {
    if (approvalToken === null) return;
    const selected = requireSelection();
    try { await api.respond(selected, id, decision, approvalToken); }
    catch (failure) { if (matchesSelection(selected)) setError(String(failure)); }
  }, [api]);
  const interrupt = async () => {
    if (!threadId || !chatInput.turnId) return;
    const selected = requireSelection();
    try { await api.interrupt(selected, threadId, chatInput.turnId); }
    catch (failure) { if (matchesSelection(selected)) setError(String(failure)); }
  };

  useEffect(() => {
    void (async () => {
      await afterTwoFrames();
      const ready = await api.probeReady();
      if (!ready.enabled || !initial) return;
      const entryDeadline = performance.now() + 15000;
      while (!document.querySelector('[data-testid="open-current-workspace"]') && performance.now() < entryDeadline) await new Promise(resolve => setTimeout(resolve, 20));
      const currentWorkspace = document.querySelector('[data-testid="open-current-workspace"]');
      if (!(currentWorkspace instanceof HTMLButtonElement)) throw new Error("Probe expected View Page project entry");
      currentWorkspace.click();
      await afterTwoFrames();
      const chatEntry = document.querySelector('[data-testid="chat-nav"]');
      if (!(chatEntry instanceof HTMLButtonElement)) throw new Error("Probe expected project Chat navigation");
      chatEntry.click();
      await afterTwoFrames();
      const developmentPolicy = ready.developmentPolicyAvailable ? await api.developmentPolicy() : null;
      if (ready.developmentPolicyAvailable && (!developmentPolicy || developmentPolicy.id !== "www-dev-review" || developmentPolicy.primaryModel !== "opus" || !/^[a-f0-9]{64}$/.test(developmentPolicy.hash))) throw new Error("Probe did not receive the bundled development policy");
      if (ready.expectDevelopmentComplete && !ready.developmentWorkId) throw new Error("Probe completion verification requires a development work UUID");
      const developmentStatus = ready.developmentWorkId ? await api.developmentStatus(ready.developmentWorkId) : null;
      let developmentCompletion: {
        rejected : true   ;
        reason   : string
      } | {
        rejected         : false   ;
        workId           : string  ;
        status           : string  ;
        statusAfter      : string  ;
        canCompleteAfter : boolean ;
      } | null = null;
      if (ready.developmentWorkId) {
        if (!developmentStatus || developmentStatus.workId !== ready.developmentWorkId.toLowerCase() || developmentStatus.canComplete !== (ready.expectDevelopmentComplete === true)) throw new Error("Probe development status did not match the requested completion scenario");
        if (typeof api.completeDevelopmentWork !== "function") throw new Error("Probe development completion bridge is unavailable");
        if (ready.expectDevelopmentComplete) {
          const result = await api.completeDevelopmentWork(ready.developmentWorkId) ;
          const after  = await api.developmentStatus(ready.developmentWorkId)       ;
          if (result.workId !== developmentStatus.workId || result.status !== "done" || after.status !== "done" || after.canComplete !== true) throw new Error("Probe did not observe canonical development completion through IPC");
          developmentCompletion = { rejected: false, workId: result.workId, status: result.status, statusAfter: after.status, canCompleteAfter: after.canComplete };
        } else {
          let rejection: string | null = null;
          try { await api.completeDevelopmentWork(ready.developmentWorkId); }
          catch (failure) { rejection = String(failure); }
          if (!rejection?.includes("현재 증거로 완료할 수 없습니다")) throw new Error("Probe did not receive the development completion gate rejection");
          developmentCompletion = { rejected: true, reason: rejection };
        }
      }
      const textarea = document.querySelector('[data-testid="prompt-input"]');
      if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("Probe expected textarea");
      setTextareaValue(textarea, "fixture probe");
      await afterTwoFrames();
      const send = document.querySelector('[data-testid="send-button"]');
      if (!(send instanceof HTMLButtonElement)) throw new Error("Probe expected send button");
      send.click();
      const approval = await waitForEvent("item/commandExecution/requestApproval");
      if (approval.requestId !== 42) throw new Error("Probe expected numeric approval ID 42");
      setTextareaValue(textarea, "보존할 입력 초안");
      textarea.focus();
      textarea.setSelectionRange(3, 7);
      await afterTwoFrames();
      const runningCommand = document.querySelector('[data-testid="command-card"]');
      if (!(runningCommand instanceof HTMLElement)) throw new Error("Probe expected running command");
      const outputToggle = runningCommand.querySelector('button[aria-expanded]');
      if (!(outputToggle instanceof HTMLButtonElement)) throw new Error("Probe expected command output toggle");
      if (outputToggle.getAttribute("aria-expanded") !== "true") outputToggle.click();
      await afterTwoFrames();
      outputToggle.click();
      await afterTwoFrames();
      const transcript = document.querySelector(".transcript");
      if (!(transcript instanceof HTMLDivElement) || transcript.scrollHeight <= transcript.clientHeight) throw new Error("Probe expected scrollable transcript");
      transcript.scrollTop = 0;
      transcript.dispatchEvent(new Event("scroll", { bubbles: true }));
      await afterTwoFrames();
      if (transcript.scrollTop !== 0) throw new Error("Probe did not reach historical scroll position");
      const decline = document.querySelector('[data-decision="decline"]');
      if (!(decline instanceof HTMLButtonElement)) throw new Error("Probe expected decline button");
      decline.click();
      await waitForEvent("fixture/approvalResponse");
      const interruptButton = document.querySelector('[data-testid="interrupt-button"]');
      if (!(interruptButton instanceof HTMLButtonElement)) throw new Error("Probe expected interrupt button");
      interruptButton.click();
      let interruptPending: { rpcAccepted: boolean; buttonDisabled: boolean; duplicateClickAttempted: boolean; requestCount: number } | null = null;
      if (ready.checkInterruptPending) {
        await waitForEvent("turn/interruptAcknowledged");
        await afterTwoFrames();
        if ((await api.workspace().then((selected) => api.events(selected))).some((event) => event.method === "turn/completed")) throw new Error("Probe fixture completed before the pending interval could be inspected");
        if (!interruptButton.isConnected || !interruptButton.disabled) throw new Error("Probe enabled interrupt again before the turn completed");
        interruptButton.click();
        await afterTwoFrames();
        const counts = (await api.workspace().then((selected) => api.events(selected))).filter((event) => event.method === "fixture/interruptRequest").map((event) => (event.params as { count?: number }).count);
        if (counts.length !== 1 || counts[0] !== 1) throw new Error("Probe expected one Native fixture interrupt request");
        interruptPending = { rpcAccepted: true, buttonDisabled: interruptButton.disabled, duplicateClickAttempted: true, requestCount: 1 };
      }
      const completed = await waitForEvent("turn/completed");
      if (ready.checkInterruptPending) {
        const counts = (await api.workspace().then((selected) => api.events(selected))).filter((event) => event.method === "fixture/interruptRequest").map((event) => (event.params as { count?: number }).count);
        if (counts.length !== 1 || counts[0] !== 1 || (completed.params as { turn?: { status?: string } }).turn?.status !== "interrupted") throw new Error("Probe did not confirm a single interrupt and interrupted completion");
      }
      await afterTwoFrames();
      const command     = document.querySelector('[data-testid="command-card"] button[aria-expanded]') ;
      const userRequest = document.querySelector('[data-testid="user-request"]') ;
      if (!(command instanceof HTMLButtonElement) || !userRequest) throw new Error("Probe did not render request and command");
      const workFlow = document.querySelector('[data-testid="work-flow"]');
      if (!(workFlow instanceof HTMLElement) || !workFlow.textContent?.includes("작업 흐름") || !userRequest.textContent?.includes("요청을 받았습니다")) throw new Error("Probe did not connect request acceptance to the work flow");
      const resultSummary = document.querySelector('[data-testid="result-summary"]');
      if (!(resultSummary instanceof HTMLElement) || !resultSummary.textContent?.includes("결과 요약") || !resultSummary.textContent?.includes("실패 1개")) throw new Error("Probe did not render the observed result summary");
      if (textarea.value !== "보존할 입력 초안" || textarea.selectionStart !== 3 || textarea.selectionEnd !== 7) throw new Error("Probe lost draft or selection");
      if (command.getAttribute("aria-expanded") === "true") throw new Error("Probe lost manual command collapse state");
      if (!document.querySelector(".new-content")) throw new Error("Probe did not preserve historical scroll position");
      if (!document.querySelector(".cmd.item-failed") || !document.body.textContent?.includes("UTF-16 코드 단위")) throw new Error("Probe did not render failure and long-output boundary");
      const ecosystemNavigation = document.querySelector('[data-testid="ecosystem-nav"]');
      if (!(ecosystemNavigation instanceof HTMLButtonElement)) throw new Error("Probe expected ecosystem navigation");
      const readingPosition = transcript.scrollTop;
      ecosystemNavigation.click();
      await afterTwoFrames();
      if (!document.querySelector('.ecosystem-shell:not([hidden]) > .ecosystem-page:not([hidden]) .ecosystem-work') || !document.querySelector('.work[hidden]')) throw new Error("Probe did not open ecosystem view");
      if (!document.querySelector('.blueprint-work')?.getBoundingClientRect().width) throw new Error("Probe did not open code blueprint by default");
      const guideTab = document.querySelector('[data-testid="ecosystem-guide-tab"]');
      if (!(guideTab instanceof HTMLButtonElement)) throw new Error("Probe expected ecosystem guide tab");
      guideTab.click();
      await afterTwoFrames();
      const reviewNode = document.querySelector('.eco-node[aria-label^="독립 검토,"]');
      if (!(reviewNode instanceof SVGElement)) throw new Error("Probe expected review node");
      reviewNode.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await afterTwoFrames();
      if (document.querySelector('.ecosystem-page:not([hidden]) .ecosystem-detail h2')?.textContent !== "독립 검토") throw new Error("Probe did not select review node with keyboard");
      const ecosystemSearch = document.querySelector('.ecosystem-page:not([hidden]) .ecosystem-search input');
      if (!(ecosystemSearch instanceof HTMLInputElement)) throw new Error("Probe expected ecosystem search");
      const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      inputSetter?.call(ecosystemSearch, "EVIDENCE.TS");
      ecosystemSearch.dispatchEvent(new Event("input", { bubbles: true }));
      await afterTwoFrames();
      const searchResult = document.querySelector('.ecosystem-page:not([hidden]) .ecosystem-results button');
      if (!(searchResult instanceof HTMLButtonElement) || searchResult.textContent !== "검증 증거") throw new Error("Probe did not search ecosystem source path");
      searchResult.click();
      await afterTwoFrames();
      if (document.querySelector('.ecosystem-page:not([hidden]) .ecosystem-detail h2')?.textContent !== "검증 증거") throw new Error("Probe did not navigate to search result");
      const chatNavigation = document.querySelector('[data-testid="chat-nav"]');
      if (!(chatNavigation instanceof HTMLButtonElement)) throw new Error("Probe expected chat navigation");
      chatNavigation.click();
      await afterTwoFrames();
      if (textarea.value !== "보존할 입력 초안" || textarea.selectionStart !== 3 || textarea.selectionEnd !== 7 || command.getAttribute("aria-expanded") === "true" || transcript.scrollTop !== readingPosition) throw new Error("Probe lost conversation state after ecosystem navigation");
      let reportId : string | null = null  ;
      let nativeAutomaticReport    = false ;
      if (ready.checkNativeReports) {
        const deadline = performance.now() + 20_000;
        while (performance.now() < deadline) {
          const automatic = await api.nativeReportStatus();
          if (automatic.jobs.some((job) => job.status === "failed")) throw new Error("Probe automatic Native report failed");
          if (automatic.jobs.some((job) => job.status === "saved" && job.reportId)) { nativeAutomaticReport = true; break; }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (!nativeAutomaticReport) throw new Error("Probe did not observe an automatic report after Native turn completion");
      }
      if (ready.checkReports) {
        const catalog = await api.listReports()                               ;
        const saved   = catalog.reports.find((report) => report.kind === "authored") ;
        if (!saved || catalog.warnings.length) throw new Error("Probe expected an authored report from the selected repository");
        reportId = saved.id;
        const reportNavigation = document.querySelector('[data-testid="reports-nav"]');
        if (!(reportNavigation instanceof HTMLButtonElement)) throw new Error("Probe expected report navigation");
        reportNavigation.click();
        const deadline = performance.now() + 15_000;
        while (!document.querySelector('.report-frame') && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 30));
        const frame = document.querySelector('.report-frame');
        if (!(frame instanceof HTMLIFrameElement) || frame.getAttribute("sandbox") !== "" || !frame.srcdoc.includes(saved.title) || /<script\b/i.test(frame.srcdoc)) throw new Error("Probe expected sandboxed, static report HTML");
        const reportSearch = document.querySelector('.reports-search input');
        if (!(reportSearch instanceof HTMLInputElement)) throw new Error("Probe expected report search");
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(reportSearch, "존재하지않는보고서");
        reportSearch.dispatchEvent(new Event("input", { bubbles: true }));
        await afterTwoFrames();
        if (!document.querySelector('.reports-empty-list')?.textContent?.includes("일치하는 보고서가 없습니다")) throw new Error("Probe expected empty report search results");
        chatNavigation.click();
        await afterTwoFrames();
        if (textarea.value !== "보존할 입력 초안" || command.getAttribute("aria-expanded") === "true" || transcript.scrollTop !== readingPosition) throw new Error("Probe lost conversation state after report navigation");
        reportNavigation.click();
        await afterTwoFrames();
        if (!document.querySelector('.reports-screen:not([hidden])')) throw new Error("Probe did not reopen the report view");
        const restoredSearch = document.querySelector('.reports-screen:not([hidden]) .reports-search input');
        if (!(restoredSearch instanceof HTMLInputElement) || restoredSearch.value !== "존재하지않는보고서" || !document.querySelector('.reports-screen:not([hidden]) .reports-empty-list')?.textContent?.includes("일치하는 보고서가 없습니다")) throw new Error("Probe lost the report search after navigation");
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(restoredSearch, "");
        restoredSearch.dispatchEvent(new Event("input", { bubbles: true }));
        const opened = performance.now() + 15_000;
        while (!document.querySelector('.reports-screen:not([hidden]) .report-frame') && performance.now() < opened) await new Promise((resolve) => setTimeout(resolve, 30));
        const restoredFrame = document.querySelector('.reports-screen:not([hidden]) .report-frame');
        if (!(restoredFrame instanceof HTMLIFrameElement) || restoredFrame.getAttribute("sandbox") !== "" || !restoredFrame.srcdoc.includes(saved.title)) throw new Error("Probe did not restore the selected report after clearing search");
      }
      let nativeActivity = null;
      if (ready.checkActivity) {
        chatNavigation.click();
        setPanel("activity");
        const detailToggle = document.querySelector<HTMLButtonElement>('[data-testid="monitoring-nav"]');
        if (!detailToggle) throw new Error("Probe detail monitor control missing");
        detailToggle.click();
        await afterTwoFrames();
        nativeActivity = await verifyNativeActivity(textarea, send);
        detailToggle.click();
        await afterTwoFrames();
        const visibleActivity = document.querySelector('[data-testid=activity-panel]:not([hidden])');
        if (!(visibleActivity instanceof HTMLElement) || !visibleActivity.querySelector('.na-row')) throw new Error('Probe did not reopen the activity panel for capture');
      }
      await api.probeFinish({
        ...(ready.checkActivity ? { nativeActivity } : {}),
        readinessMs         : ready.readinessMs                                                             ,
        readinessDefinition : "native entry to the second requestAnimationFrame callback after React mount" ,
        interactionPath     : "rendered controls"                                                           ,
        ...(ready.checkReports ? {
          reportsNavigation     : true ,
          reportsSandboxed      : true ,
          reportsEmptySearch    : true ,
          reportsDraftPreserved : true ,
          reportId
        } : {}),
        ...(ready.checkNativeReports ? { nativeAutomaticReport } : {}),

        ecosystemNavigation                       : true ,
        ecosystemKeyboardSelection                : true ,
        ecosystemSourceSearch                     : true ,
        ecosystemDraftAndReadingPositionPreserved : true ,

        developmentPolicy     ,
        developmentStatus     ,
        developmentCompletion ,
        interruptPending      ,

        approvalId        : approval.requestId        ,
        approvalIdType    : typeof approval.requestId ,
        approvalRoundtrip : true                      ,

        interruptStatus: (completed.params as { turn?: { status?: string } })?.turn?.status,

        requestRendered                : true ,
        commandRendered                : true ,
        manualCommandCollapsePreserved : true ,
        historicalScrollPreserved      : true ,
        failedCommandRendered          : true ,
        longOutputBoundaryRendered     : true ,
        draftPreserved                 : true ,
        selectionPreserved             : true ,

        notificationMethods: (await api.workspace().then((selected) => api.events(selected))).map((event) => event.method)
      });
    })().catch(async (failure) => {
      try {
        await api.probeFinish({ error: String(failure) });
      } catch {
        setError(String(failure));
      }
    });
  }, []);

  const visibleTurnId = chatInput.turnId ?? projection.turnId;
  const activeBlocks = useMemo(() => projection.blocks.filter((block) => {
    if (block.kind === "user") return block.turnId === visibleTurnId || block.state !== "accepted";
    return block.turnId === visibleTurnId;
  }), [projection.blocks, visibleTurnId]);
  const transcriptRows = useMemo(() => projection.blocks.map(block =>
    <div className="chat-flow-item" key={`${currentKey}:${blockKey(block)}`}>
      {block.kind === "command" ? <MemoCommandView {...block}/> : <MemoBlockView block={block} decide={decide} quote={quote}/>}
      {block.kind === "user" && !block.steerStatus && (block.turnId === visibleTurnId || block.state !== "accepted")
        && <WorkFlow turn={chatInput.turn} blocks={activeBlocks} events={events} transport={chatInput.transport} interrupt={chatInput.interrupt}/>}
    </div>
  ), [projection.blocks, currentKey, decide, quote, visibleTurnId, chatInput.turn, activeBlocks, events, chatInput.transport, chatInput.interrupt]);
  const approvals    = activeBlocks.filter((block): block is Extract<Block, { kind: "approval" }> => block.kind === "approval" && block.open) ;
  const commands     = activeBlocks.filter((block): block is Extract<Block, { kind: "command" }> => block.kind === "command"                ) ;
  const files        = activeBlocks.filter((block): block is Extract<Block, { kind: "files" }> => block.kind === "files"                    ) ;
  const explanations = activeBlocks.filter((block): block is Extract<Block, { kind: "explanation" }> => block.kind === "explanation"        ) ;

  const verificationCommands = commands.filter((block) => isVerificationCommand(block.command)       ) ;
  const observedResults = executionResultCounts(activeBlocks);

  const configuredPolicy = [...events].reverse().find((event) => event.method === "thread/configured")?.params;
  const policyLabel = configuredPolicy && typeof configuredPolicy === "object" && "approvalPolicy" in configuredPolicy && typeof configuredPolicy.approvalPolicy === "string" && "sandbox" in configuredPolicy && typeof configuredPolicy.sandbox === "string"
    ? `${configuredPolicy.sandbox} · ${configuredPolicy.approvalPolicy}`
    : "기본 정책: Bypass · danger-full-access · never";

  const liveTurnEvents = currentTurnEvents(events, visibleTurnId).filter((event) => !event.historical && Number.isFinite(Date.parse(event.at)));
  const startedEvent = liveTurnEvents.find((event) => event.method === 'turn/started');
  const hasPendingApproval = chatInput.approvals > 0 || approvals.length > 0;
  const statusTone = hasPendingApproval ? "blocked" : chatInput.turn === "failed" || chatInput.transport === "error" ? "failed" : chatInput.working ? "working" : "idle";
  const statusText = hasPendingApproval ? "사용자 결정 대기" : turnLabel(chatInput.turn);
  const verificationText = verificationCommands.length
    ? `실제 검사 ${verificationCommands.length}개 · 성공 ${verificationCommands.filter((block) => block.status === "completed").length} · 실패 ${verificationCommands.filter((block) => block.status === "failed").length} · 미확인 ${verificationCommands.filter((block) => block.status === "unknown" || block.running).length}`
    : "검사로 식별할 실행 근거 없음 · 미검증";

  return <>
    {active && themePickerOpen && <ChatOptionPicker heading="채팅 테마 선택" theme={theme} options={chatThemes} current={theme}
      saving={savingTheme} onCancel={closeThemePicker} onChoose={(selected) => { void selectTheme(selected); }}/>}
    {active && modelPicker && <ChatOptionPicker heading="모델 선택" theme={theme} current={modelPicker.current}
      options={modelPicker.models.map(({ model, displayName }) => ({ value: model, label: displayName }))}
      onCancel={closeModelPicker} onChoose={(model) => { modelChoice.current = model; closeModelPicker(); }}/>}
    {projectListOpen && <aside ref={listPanel} onKeyDown={(event) => { if (event.key === "Escape" && view !== "home") closeProjectList(); }} className="sidebar home-sidebar" aria-label="프로젝트 선택"><div className="brand">WWW <small>{appBuildInfo.label}</small></div><div className="home-list-actions">{view !== "home" && <button className="secondary" data-testid="project-list-close" onClick={closeProjectList}>현재 화면으로 돌아가기</button>}<button className="secondary" data-testid="global-dashboard-nav" onClick={() => { setView("home"); setProjectListOpen(true); }}>전체 대시보드</button></div><div className="home-project-heading"><strong>RPA</strong><button className="secondary" aria-label="RPA 프로젝트 추가" onClick={choose} disabled={selectionBlocked || !workspace}>+</button></div><div className="home-project-list">{projects.filter(item => item.path !== dashboard?.projects.find(entry => entry.project.kind === "www")?.project.path).map(item => <div className="home-project-row" key={item.workspaceKey}><button className="secondary grow" data-testid={item.workspaceKey === workspace?.workspaceKey ? "open-current-workspace" : undefined} disabled={selectionBlocked && item.workspaceKey !== workspace?.workspaceKey} onClick={() => openDashboardProject(item.workspaceKey)} title={item.path}>{item.name}</button><button className="icon" aria-label={`${item.name} 즐겨찾기 ${item.favorite ? "해제" : "추가"}`} aria-pressed={item.favorite} onClick={() => { void toggleFavorite(item); }} disabled={favoritePending}>☆</button></div>)}{!projectLoading && projects.filter(item => item.path !== dashboard?.projects.find(entry => entry.project.kind === "www")?.project.path).length === 0 && <p className="muted">등록된 RPA 프로젝트가 없습니다.</p>}</div><button className="secondary home-www" data-testid={dashboard?.projects.find(item => item.project.kind === "www")?.project.path === workspace?.path ? "open-current-workspace" : "open-www"} disabled={!workspace || (selectionBlocked && dashboard?.projects.find(item => item.project.kind === "www")?.project.path !== workspace.path)} onClick={() => openDashboardProject("www")}>WWW</button>{projectError && <p role="alert">{projectError}</p>}<p className="muted home-scope-note">프로젝트를 선택하기 전 전체 작업 기록을 볼 수 있습니다.</p></aside>}
    <aside id={`workspace-sidebar-${sessionId}`} className="sidebar target-sidebar" hidden={projectListOpen}><div className="brand" title={`커밋 ${appBuildInfo.commit} · 소스 ${appBuildInfo.sourceDigest}`} >WWW <small data-testid="build-version">{appBuildInfo.label}</small></div><div className="sec"><button className="secondary" ref={projectListButton} data-testid="view-page-nav" onClick={() => setProjectListOpen(true)}>← 프로젝트 목록</button><button className="icon" aria-label="프로젝트 폴더 선택" onClick={choose} disabled={selectionBlocked || !workspace}><LineIcon kind="folder"/></button></div><div><div className="srow active"><span className="avatar">W</span><span className="name">{workspace?.name ?? "선택 중"}</span><span className="right">{workspace?.branch ?? "git 아님"}</span></div><nav className="workspace-nav" aria-label="화면 선택"><button aria-current={view === "dashboard" ? "page" : undefined} onClick={() => setView("dashboard")} data-testid="dashboard-nav"><LineIcon kind="map"/><span className="nav-label">대시보드</span></button>{showRpaStandard && <button data-testid="rpa-standard-nav" aria-current={view === "rpa-standard" ? "page" : undefined} onClick={() => setView("rpa-standard")}><LineIcon kind="map"/><span className="nav-label">RPA 표준</span></button>}<button data-testid="chat-nav" aria-label="대화" title="대화" aria-current={view === "chat" ? "page" : undefined} onClick={() => setView("chat")}><LineIcon kind="chat"/><span className="nav-label">대화</span>{failedDraft !== null && <span className="nav-hint">실패한 요청 확인</span>}</button><button aria-label="생태계 구조 지도" title="생태계 구조 지도" aria-current={view === "ecosystem" ? "page" : undefined} onClick={() => setView("ecosystem")} data-testid="ecosystem-nav"><LineIcon kind="map"/><span className="nav-label">생태계</span><span className="nav-hint">구조 지도</span></button><button aria-label="리포트" title="리포트" aria-current={view === "reports" ? "page" : undefined} onClick={() => { setView("reports"); setAutoReportHint(""); }} data-testid="reports-nav"><LineIcon kind="report"/><span className="nav-label">리포트</span><span className="nav-hint">{autoReportHint || "작업 이야기"}</span></button><button ref={monitorButton} aria-label="세션 모니터링" title="세션 모니터링" aria-current={view === 'monitoring' ? 'page' : undefined} onClick={() => { setView('monitoring'); setPanel('activity'); }} data-testid="monitoring-nav"><LineIcon kind="map"/><span className="nav-label">모니터링</span></button></nav></div><div className="agents"><div className="group">CODEX</div><div className="srow"><span className="agentmark"/><span>{statusText}</span></div><section className="chat-conversations" aria-label="저장된 대화" hidden={view !== "chat" && view !== "ecosystem"}><div className="chat-conversation-heading"><strong>대화</strong><button type="button" data-testid="new-conversation" disabled={selectionBlocked} onClick={() => { void selectConversation(null); }}>새 대화</button></div><label className="chat-search"><span className="sr-only">불러온 대화 검색</span><input data-testid="conversation-search" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="불러온 대화 검색"/></label><div className="chat-list-tools"><span>{listLoading ? "불러오는 중…" : `불러온 대화 ${conversations.length}개`}</span><button type="button" disabled={listLoading || switching} onClick={() => { void refreshConversations(); }} aria-label="대화 목록 새로고침">새로고침</button></div>{listError && <div role="status" className="chat-list-error">{listError}</div>}<div className="chat-conversation-list" data-testid="conversation-list">{conversations.filter((item) => `${item.title} ${item.preview}`.toLocaleLowerCase("ko-KR").includes(conversationSearch.toLocaleLowerCase("ko-KR"))).map((item) => <button type="button" key={item.id} data-testid="conversation-item" data-thread-id={item.id} className={item.id === threadId ? "is-current" : ""} aria-current={item.id === threadId ? "true" : undefined} disabled={selectionBlocked} onClick={() => { void selectConversation(item.id); }}><strong>{item.title || item.preview || "제목 없는 대화"}</strong><span>{item.preview || "내용 미제공"}</span>{item.updatedAt !== null && Number.isFinite(new Date(item.updatedAt * 1000).getTime()) && <time dateTime={new Date(item.updatedAt * 1000).toISOString()}>{new Date(item.updatedAt * 1000).toLocaleDateString("ko-KR")}</time>}</button>)}</div>{!listLoading && conversations.length === 0 && !listError && <p className="muted">이 작업 폴더에 저장된 대화가 없습니다.</p>}{conversations.length > 0 && conversationSearch && !conversations.some((item) => `${item.title} ${item.preview}`.toLocaleLowerCase("ko-KR").includes(conversationSearch.toLocaleLowerCase("ko-KR"))) && <p className="muted">불러온 대화 중 일치하는 항목이 없습니다.</p>}{listCursor && <button type="button" className="chat-load-more" data-testid="load-more-conversations" disabled={listLoading || switching} onClick={() => { void refreshConversations(listCursor); }}>이전 대화 더 불러오기</button>}</section></div><div className="footer"><span className="muted">{workspace?.path}</span><span>{workspace?.changes ?? 0} changes</span></div></aside>
    <section className="dashboard-shell" hidden={view !== "home" && view !== "dashboard"} data-testid={view === "home" ? "view-page" : "target-dashboard"}><DashboardView key={`${workspace?.workspaceKey}:${workspace?.selectionEpoch}`} snapshot={dashboard} loading={dashboardLoading} error={dashboardError || null} projectKey={view === "dashboard" ? targetKey ?? dashboard?.projects.find(item => item.project.path === workspace?.path)?.project.key ?? workspace?.workspaceKey : undefined} onRefresh={() => { void refreshDashboard(); }} onOpenProject={openDashboardProject} onLoadWork={loadDashboardWork}/>{view === "dashboard" && targetKey !== "www" && <p className="dashboard-scope-note">생태계는 현재 WWW 빌드의 구조를 표시합니다. 선택 프로젝트의 자동 분석은 제공하지 않습니다.</p>}</section>
    <main className="work" data-chat-theme={theme} hidden={view !== "chat"}><div className="tabrow"><button className="tab active">대화</button><span className="spacer"/>{/* 기존 상세 모니터·세션 모니터 토글은 모니터링 메뉴로 통합했습니다.
<button ref={monitorButton} className="tool" data-testid="detail-monitor-toggle" aria-label="상세 실행 모니터" aria-pressed={detailsVisible} onClick={() => setDetailsVisible((visible) => !visible)}>상세 모니터 {detailsVisible ? "닫기" : "열기"}</button><button className="tool" data-testid="resource-sidebar-toggle" aria-label="실시간 리소스 사이드바" aria-pressed={monitorVisible} onClick={() => setMonitorVisible((visible) => !visible)}>세션 모니터 {monitorVisible ? "접기" : "열기"}</button>
*/}<span className="tool selected">Codex app-server</span></div><section className="stage"><div className="pane focused"><div className="title"><span className="name">Codex</span><span className="path">{workspace?.name}</span></div><div className="body conversation"><div className="transcript" tabIndex={0} aria-label="대화 내용" ref={transcriptRef} onScroll={(event) => { if (view !== "chat") return; const element = event.currentTarget; transcriptScrollTop.current = element.scrollTop; followTail.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48; readingStates.current.set(currentKey, { draft: promptRef.current, scrollTop: element.scrollTop, followTail: followTail.current }); if (followTail.current) setNewContent(false); }}>{projection.historyTruncated && <div className="history-warning">최근 {MAX_RAW_EVENTS.toLocaleString("ko-KR")}개 사건만 있어 이전 흐름은 완전히 복원할 수 없습니다.</div>}<div className="transcript-content"><ChatRowMemoryContext.Provider value={rowMemory}>{pendingPrompt && !projection.blocks.some((block) => block.kind === "user" && block.text === pendingPrompt && block.state === "sending") && <div className="chat-flow-item"><div className="user request-sending" data-testid="pending-user-request"><span className="chat-role chat-role-question">내 질문</span><div>{pendingPrompt}</div><span className="muted">요청을 보내는 중</span></div><WorkFlow turn="starting" blocks={[]} events={[]} transport={chatInput.transport} interrupt={chatInput.interrupt} /></div>}{projection.blocks.length === 0 && !pendingPrompt ? <div className="empty">{switching ? "대화를 불러오는 중입니다." : "작업 폴더를 확인하고 메시지를 입력하거나 저장된 대화를 여세요."}</div> : transcriptRows}<NativePreparation events={events} sinceSeq={sendEventStart}/><ResultSummary blocks={activeBlocks} turn={projection.turn}/></ChatRowMemoryContext.Provider></div></div>{newContent && <button className="secondary new-content" onClick={() => { followTail.current = true; transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }); setNewContent(false); }}>새 내용으로 이동</button>}{failedDraft !== null && <section className="history-warning" data-testid="failed-request" aria-label="실패한 요청" style={{ margin: "0 14px", maxHeight: 180, overflow: "auto" }}><strong>실패한 요청</strong><pre data-testid="failed-request-text" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{failedDraft}</pre><p role="status">{hasDraft ? "새 초안이 있습니다. 입력창을 비운 뒤 원문을 복원할 수 있습니다." : "실패한 원문을 복원하거나 버려 주세요."} 해결 전에는 다음 전송과 대화·프로젝트 전환이 일시 중지됩니다.</p><button type="button" className="secondary" data-testid="restore-failed-request" onClick={restoreFailedDraft} disabled={hasDraft}>입력창으로 복원</button><button type="button" className="secondary" data-testid="discard-failed-request" onClick={discardFailedDraft}>실패한 요청 버리기</button></section>}<ChatComposer snapshot={promptSnapshot} inputRef={promptInput} onDraft={(text) => { promptRef.current = text; setHasDraft(text.length > 0); readingStates.current.set(currentKey, { draft: text, scrollTop: transcriptScrollTop.current, followTail: followTail.current }); }} onSubmit={() => { void run(); }} onInterrupt={() => { void interrupt(); }} status={chatStatus({ ...chatInput, sending, switching })} disabled={switching || compacting} blocked={!workspace || failedDraft !== null} sending={sending} working={chatInput.working} interruptPending={chatInput.interrupt === 'requested' || chatInput.interrupt === 'accepted'} notice={inputNotice || compactionNotice} startedAt={startedEvent ? Date.parse(startedEvent.at) : null} lastActivityAt={liveTurnEvents.length ? Date.parse(liveTurnEvents.at(-1)!.at) : null}/></div></div></section></main>
    <ResourceActivitySidebar events={events} resources={resources} threadId={threadId} workspacePath={workspace?.path} sending={sending || pendingPrompt !== null} hidden={!active || view !== "chat" || !monitorVisible} onOpenMonitor={() => { setView("monitoring"); setPanel("activity"); }}/>
    <section className="monitoring-work" data-chat-theme={theme} hidden={!active || view !== 'monitoring'} data-testid="session-monitoring" aria-label="현재 세션 모니터링">
      <header className="monitoring-identity"><h1>세션 모니터링</h1><p>{workspace?.name ?? '프로젝트 준비 중'} · 세션 <code>{sessionId}</code> · 대화 <code>{threadId ?? '새 대화 · 아직 생성하지 않음'}</code></p><p>현재 선택한 탭의 공개 관측입니다. 실행 종료와 업무 완료는 다릅니다.</p><button className="secondary" data-testid="monitoring-return-chat" onClick={() => { setView('chat'); requestAnimationFrame(() => promptInput.current?.focus()); }}>대화로 돌아가기{approvals.length ? ` · 승인 ${approvals.length}건 처리` : ''}</button></header>
      <ResourceActivitySidebar events={events} resources={resources} threadId={threadId} workspacePath={workspace?.path} sending={sending} hidden={!active || view !== 'monitoring'} testId="monitoring-overview" onOpenMonitor={() => setPanel('activity')}/>
    <NativeActivityView key={workspace?.workspaceKey ?? "initial"} activityState={activityState} events={events} threadId={threadId} workspacePath={workspace?.path} hidden={!active || view !== "monitoring" || panel !== "activity"} onClose={() => { setView("chat"); requestAnimationFrame(() => monitorButton.current?.focus()); }} onShowOverview={() => setPanel("overview")} onShowEvents={() => setPanel("events")}/>
    <aside className="panel" data-chat-theme={theme} onKeyDown={(event) => { if (event.key === "Escape") { setView("chat"); requestAnimationFrame(() => monitorButton.current?.focus()); } }} hidden={!active || view !== "monitoring" || panel === "activity"}><div className="phead"><span className="logo"/><span className="title">Codex</span><span className="pill">{threadId ?? "새 스레드"}</span></div><div className="ptabs"><button aria-label="상세 모니터 닫기" onClick={() => { setView("chat"); requestAnimationFrame(() => monitorButton.current?.focus()); }}>닫기</button><button className="ptab" onClick={() => setPanel("activity")}>흐름</button><button className={`ptab ${panel === "overview" ? "active" : ""}`} onClick={() => setPanel("overview")}>개요</button><button className={`ptab ${panel === "events" ? "active" : ""}`} onClick={() => setPanel("events")}>이벤트</button><span className="aside">{events.length}{projection.historyTruncated ? "+" : ""}</span></div><div className="pbody">{panel === "overview" ? <><div className={`headline t-${statusTone}`}><span className="glyph">{approvals.length ? "!" : projection.working ? "·" : projection.turn === "failed" ? "×" : "○"}</span><div><div className="h">{statusText}</div><div className="sub">연결 {chatInput.transport} · 중단 {chatInput.interrupt === "accepted" ? "접수됨 · 최종 결과 대기" : chatInput.interrupt} · 턴 {chatInput.turn}</div></div></div><div className="counts"><div className="count"><div className="n">{commands.length}</div><div className="l">현재 명령</div></div><div className="count blocked"><div className="n">{approvals.length}</div><div className="l">현재 요청</div></div><div className="count"><div className="n">{files.length}</div><div className="l">현재 변경</div></div></div><div className="ledger"><div className="entry"><span className="prov">공개 설명</span><span>{explanations.length ? explanations.map((block) => block.text).filter(Boolean).join(" · ") : "Native 공개 설명 미제공"}</span></div><div className="entry"><span className="prov">관측 결과</span><span>현재 턴 명령 {commands.length} · 파일 변경 {files.length} · 실패 {observedResults.failed} · 거절 {observedResults.declined} · 미확인 {observedResults.unresolved}</span></div><div className="entry"><span className="prov">실제 검증</span><span>{verificationText}</span></div><div className="entry"><span className="prov">미해결</span><span>{approvals.length ? `승인 ${approvals.length}건 대기` : observedResults.failed ? `실패 실행 ${observedResults.failed}건` : observedResults.declined ? `거절된 실행 ${observedResults.declined}건` : observedResults.unresolved ? `결과 미확인 실행 ${observedResults.unresolved}건` : chatInput.transport !== "connected" ? `연결 ${chatInput.transport}` : "현재 턴에서 관측된 차단 없음"}</span></div></div></> : <div className="ledger">{projection.historyTruncated && <div className="history-warning">이벤트 앞부분이 없어 완전한 기록이 아닙니다.</div>}{events.map((event) => <div className="entry" key={`${event.processEpoch}:${event.connectionGeneration}:${event.seq}`}><span className="seq">{event.seq}</span><span className="prov">{event.kind}</span><span>{event.method}</span></div>)}</div>}</div><div className="pfooter"><span className="src">로컬 Codex CLI · Native 출력은 신뢰하지 않는 데이터 · 승인 UI는 OS sandbox 보장이 아님</span></div></aside>
    </section>
    <EcosystemView hidden={!active || view !== "ecosystem"} namespace={sessionId} onNavigationChange={setMapNavigationOpen}/>
    {active && view === "rpa-standard" && showRpaStandard && workspace && <RpaStandardView key={`${workspace.workspaceKey}:${workspace.selectionEpoch}`} workspace={workspace}/>}
    {reportsOpened && <div key={workspace?.workspaceKey} className="reports-screen" hidden={view !== "reports"}><ReportsView/></div>}
    <footer className="status"><span title={`커밋 ${appBuildInfo.commit} · 소스 ${appBuildInfo.sourceDigest}`} data-testid="build-identity">{appBuildInfo.label}</span><span>{statusText}</span><span>연결 {chatInput.transport} · {policyLabel}</span>{projection.protocolWarning && <span className="comm-warning" title={projection.protocolWarning.message}>최근 통신 경고 · <time dateTime={projection.protocolWarning.at}>{new Date(projection.protocolWarning.at).toLocaleTimeString("ko-KR")}</time></span>}{projectStorageWarning && <span className="project-storage-warning" role="status" title={projectStorageWarning} data-failed-scopes={JSON.stringify(projectStorageWarnings)}>{projectStorageWarning}</span>}<span className="grow"/><span className="err">{error}</span></footer>
  </>;
}

function SessionShell() {
  const [theme, setTheme] = useState<ChatTheme | null>(null);
  useEffect(() => {
    let disposed = false;
    void window.www.chatTheme().then(
      value => { if (!disposed) setTheme(value); },
      () => { if (!disposed) setTheme("terminal-basic"); },
    );
    return () => { disposed = true; };
  }, []);
  const saveTheme = async (selected: ChatTheme) => {
    setTheme(await window.www.setChatTheme(selected));
  };
  const [sessions, setSessions] = useState<NativeSessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [closeStates, setCloseStates] = useState(new Map<string, SessionCloseState>());
  const defaultId = useRef<string | null>(null);
  const updateSerial = useRef(0);
  useEffect(() => {
    let disposed = false;
    const accept = (next: NativeSessionSummary[]) => {
      if (disposed) return;
      if (!defaultId.current) defaultId.current = next[0]?.id ?? null;
      setSessions(next);
      setActiveId(previous => next.some(session => session.id === previous) ? previous : next[0]?.id ?? null);
    };
    const unsubscribe = window.www.onSessions((next) => { updateSerial.current++; accept(next); });
    const serial = updateSerial.current;
    void window.www.listSessions().then((next) => { if (serial === updateSerial.current) accept(next); })
      .catch((failure: unknown) => { if (!disposed) setError(String(failure)); });
    return () => { disposed = true; unsubscribe(); };
  }, []);
  const onCloseState = useCallback((id: string, next: SessionCloseState) => {
    setCloseStates(previous => {
      const old = previous.get(id);
      if (old?.allowed === next.allowed && old.reason === next.reason) return previous;
      const updated = new Map(previous);
      updated.set(id, next);
      return updated;
    });
  }, []);
  const canClose = (id: string): SessionCloseState => {
    if (sessions.length <= 1) return { allowed: false, reason: "마지막 대화 탭은 유지합니다." };
    const session = sessions.find(item => item.id === id);
    if (!session) return { allowed: false, reason: "이미 닫힌 탭입니다." };
    if (session.busy || session.approvalCount > 0) return { allowed: false, reason: "실행·승인 처리가 끝난 뒤 닫아 주세요." };
    return closeStates.get(id) ?? { allowed: false, reason: "대화 상태를 확인하고 있습니다." };
  };
  const create = async () => {
    if (creating || !activeId) return;
    setCreating(true);
    setError("");
    try {
      const selection = await window.www.workspace(activeId);
      const session = await window.www.createSession(selection);
      setSessions(previous => previous.some(item => item.id === session.id) ? previous : [...previous, session]);
      setActiveId(session.id);
      requestAnimationFrame(() => document.getElementById(`session-tab-${session.id}`)?.focus());
    } catch (failure) { setError(String(failure)); }
    finally { setCreating(false); }
  };
  const close = async (id: string) => {
    const permission = canClose(id);
    if (!permission.allowed) { setError(permission.reason ?? "이 탭을 닫을 수 없습니다."); return; }
    setError("");
    try {
      await window.www.closeSession(id);
      setSessions(previous => previous.filter(item => item.id !== id));
      setCloseStates(previous => { const next = new Map(previous); next.delete(id); return next; });
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus());
    } catch (failure) { setError(String(failure)); }
  };
  return <div className="session-shell">
    <SessionTabs tabs={sessions} activeId={activeId ?? ""} creating={creating} canCreate={activeId !== null} error={error || undefined}
      onSelect={setActiveId} onCreate={() => { void create(); }} onClose={(id) => { void close(id); }} canClose={canClose}/>
    <div className="session-surfaces">{sessions.length === 0 && <p role="status">{error || "대화 탭을 준비하고 있습니다."}</p>}
      {sessions.map(session => <section key={session.id} id={`session-panel-${session.id}`} role="tabpanel" aria-labelledby={`session-tab-${session.id}`}
        data-session-id={session.id} className="session-surface" hidden={session.id !== activeId}>
        <SessionApiProvider id={session.id}><App session={session} theme={theme ?? "terminal-basic"} themeReady={theme !== null} onThemeChange={saveTheme} active={session.id === activeId} initial={session.id === defaultId.current} onCloseState={onCloseState}/></SessionApiProvider>
      </section>)}
    </div>
  </div>;
}

createRoot(document.getElementById("root")!).render(<SessionShell/>);
