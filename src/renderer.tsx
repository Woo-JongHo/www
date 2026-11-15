/**
 * @architecture arch.chat.workspace
 * @implements RESP-CHAT-WORKSPACE
 */
import { projectNativeActivity } from "./native-activity";
import { CommandView } from "./command-card";
import { NativeActivityView, ResourceActivitySidebar } from "./native-activity-view";
import { ChatMessage } from "./chat-message";
import { ChatDetails, ChatRowMemoryContext, type ChatRowMemory } from "./chat-row-state";
import { blankReadingState, belongsToConversation, composerFull, conversationKey, currentTurnEvents, draftWithQuote, eventThreadId, MAX_PROMPT_CHARS, pasteOverflow, type ConversationReadingState } from "./chat-state";
import { ActivitySnapshotBoundary, createActivitySidebarState, projectActivitySidebar, updateActivitySidebarSnapshot, updateActivitySidebarState } from "./activity-sidebar";
import { ReportsView } from "./reports-view";
import { EcosystemView } from "./ecosystem-view";
import { handlePromptKeyDown, normalizeCompositionEnd } from "./input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { executionResultCounts, MAX_OUTPUT_CODE_UNITS, project, type Block, type Projection } from "./projection";
import type { AppEvent, ConversationSummary, TurnState, WorkspaceSelection, SelectionRef, ScopedAppEvent, ResourceSnapshot, ResourceScope, ProjectInfo, ConversationSelection, WwwApi } from "./shared";

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

function mergeEvents(current: readonly ScopedAppEvent[], incoming: readonly ScopedAppEvent[]): ScopedAppEvent[] {
  const key = (event: ScopedAppEvent) => `${event.processEpoch}:${event.connectionGeneration}:${event.seq}`;
  const bySequence = new Map(current.map((event) => [key(event), event]));
  for (const event of incoming) bySequence.set(key(event), event);
  return [...bySequence.values()].sort((left, right) => left.connectionGeneration - right.connectionGeneration || left.seq - right.seq).slice(-MAX_RAW_EVENTS);
}

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

function BlockView({ block, decide, quote }: { block: Block; decide(id: string | number, decision: string): void; quote(text: string): void }) {
  if (block.kind === "user") {
    return <div className={`user request-${block.state}`} data-testid="user-request"><div>{block.text}</div><span className="muted">{block.state === "sending" ? "요청을 보내는 중" : block.state === "accepted" ? "요청을 받았습니다" : `요청을 보내지 못했습니다 · ${block.error ?? "원인 미확인"}`}</span></div>;
  }
  if (block.kind === "explanation") {
    if (!block.text) return null;
    return <div aria-label={block.source === "reasoningSummary" ? "Native 공개 추론 요약" : block.source === "commentary" ? "Native 공개 설명" : "Native 공개 계획"} className={`explanation ${block.streaming ? "streaming" : ""}`} data-testid="public-explanation"><ChatMessage text={block.text} streaming={block.streaming} label="Native 공개 설명"/>{block.summaryTruncated && <div className="muted">공개 요약은 앞 {MAX_OUTPUT_CODE_UNITS.toLocaleString("ko-KR")} UTF-16 코드 단위까지만 표시합니다. 나머지는 생략됐습니다.</div>}</div>;
  }
  if (block.kind === "answer" ) return <div className={`agent ${block.streaming ? "streaming" : ""}`}><ChatMessage text={block.text} streaming={block.streaming} onQuote={quote}/></div>;
  if (block.kind === "command") return <CommandView block={block}/>;
  if (block.kind === "files"  ) return <div className={`files item-${block.status}`} data-testid="file-change"><div>파일 변경 · {fileStatus(block)}</div>{block.changes.length ? block.changes.map((change) => <ChatDetails key={change.path} memoryKey={`${block.id}:${change.path}`}><summary>{change.path}</summary>{change.diff === null ? <div className="muted">변경 내용 미제공</div> : <pre data-testid="file-diff">{change.diff || "제공된 변경 내용이 비어 있습니다."}</pre>}{change.truncated && <div className="muted">변경 내용의 최근 {MAX_OUTPUT_CODE_UNITS.toLocaleString("ko-KR")} UTF-16 코드 단위만 보관합니다. 앞부분은 복원할 수 없습니다.</div>}</ChatDetails>) : "파일 정보 미제공"}</div>;
  return <div className={`approval ${block.open ? "open" : ""}`} data-testid="approval-card"><div className="ahead">{!block.supported ? "지원하지 않는 요청" : block.state === "open" ? "승인 필요" : block.state === "responding" ? "응답 전송 중" : block.state === "responded" ? "응답 전송됨" : "응답 결과 미확인"}</div><div className="abody">{block.summary}</div>{block.supported && block.open && <div className="aact"><button data-decision="accept" onClick={() => decide(block.requestId, "accept")}>허용</button><button data-decision="acceptForSession" onClick={() => decide(block.requestId, "acceptForSession")}>세션 허용</button><button data-decision="decline" onClick={() => decide(block.requestId, "decline")}>거절</button><button data-decision="cancel" onClick={() => decide(block.requestId, "cancel")}>중단</button></div>}</div>;
}

function elapsedLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}분 ${seconds % 60}초`;
}

function WorkFlow({ turn, blocks, events, transport, interrupt, now }: {
  turn      : TurnState               ;
  blocks    : readonly Block[]         ;
  events    : readonly AppEvent[]      ;
  transport : Projection["transport"] ;
  interrupt : Projection["interrupt"] ;
  now       : number                  ;
}) {
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
  const attention = turn !== "completed" || counts.failed > 0 || counts.unresolved > 0 || answers.length === 0;
  return <details className="result-summary" open={attention} aria-label="실행 기록" data-testid="result-summary">
    <summary className="result-summary-heading"><strong>실행 기록</strong><span>{turn === "completed" ? "응답 종료" : turn === "interrupted" ? "중단됨" : turn === "failed" ? "실패" : "결과 미확인"}{attention ? " · 확인 필요" : ""}</span></summary>
    <dl>
      <div><dt>최종 답변</dt><dd>{answers.length > 0 ? "수신됨" : "미제공"}</dd></div>
      <div><dt>실행</dt><dd>명령 {counts.commands}개 · 파일 변경 {counts.files}개</dd></div>
      <div><dt>검증</dt><dd>{verification.length > 0 ? `${verificationPassed}/${verification.length}개 성공` : "식별된 검사 없음"}</dd></div>
      <div><dt>확인 필요</dt><dd>{counts.failed > 0 || counts.unresolved > 0 ? `실패 ${counts.failed}개 · 결과 미확인 ${counts.unresolved}개` : "관측된 실행 차단 없음"}</dd></div>
    </dl>
    <p>응답 종료는 요청한 업무의 검증 완료와 다를 수 있습니다. 위 최종 답변과 실제 실행 근거를 함께 확인하세요.</p>
  </details>;
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

function isVerificationCommand(command: string): boolean {
  return /(?:^|\s)(?:npm\s+(?:run\s+)?(?:check|test|typecheck|build)|bun\s+test|cargo\s+(?:test|check)|tsc(?:\s|$)|node\s+--test)(?:\s|$)/i.test(command);
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
  setTextareaValue(textarea, "활동 패널 두 번째 답변 검증");
  await afterTwoFrames();
  send.click();
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
  const result = { skillsListed, hooksListed, inventoryRaceSuppressed, skillsObserved, multipleSkillsObserved, hooksObserved, fixedOrder, extendedHighlight, historyNotReplayed, conversationRestoreDedupe, privateReasoningHidden, turnGrouping, historySelectionPreserved, usageNotDuplicated, modelRerouted, wwwRolesObserved, wwwSkillsObserved, generalHooksSecondary, hookFailureExplained };
  if (Object.values(result).some((value) => !value)) throw new Error(`Activity probe failed: ${JSON.stringify(result)}`);
  return result;
}

function LineIcon({ kind }: { kind: "folder" | "star" | "refresh" | "chat" | "map" | "report" }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{kind === "folder" ? <path d="M3 7V5h6l2 2h10v13H3V7Z"/> : kind === "star" ? <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z"/> : kind === "chat" ? <path d="M4 4h16v12H9l-5 4V4Z"/> : kind === "map" ? <path d="M3 3h6v6H3V3Zm12 12h6v6h-6v-6ZM9 6h9v9M6 9v9h9"/> : kind === "report" ? <path d="M5 3h14v18H5V3Zm3 5h8M8 12h8M8 16h5"/> : <path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>}</svg>;
}

function App() {
  const [view, setView] = useState<"chat" | "ecosystem" | "reports">("chat");
  const [autoReportHint, setAutoReportHint] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceSelection | null>(null);
  const selectionRef = useRef<WorkspaceSelection | null>(null);
  const [projects, setProjects] = useState<readonly ProjectInfo[]>([]);
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
  const [detailsVisible, setDetailsVisible] = useState(false);
  const monitorButton = useRef<HTMLButtonElement>(null);
  const requireSelection = (): WorkspaceSelection => {
    if (!selectionRef.current) throw new Error("프로젝트 선택을 기다려 주세요.");
    return selectionRef.current;
  };
  const matchesSelection = (value: SelectionRef, selected = selectionRef.current) => selected !== null && value.processEpoch === selected.processEpoch && value.workspaceKey === selected.workspaceKey && value.selectionEpoch === selected.selectionEpoch;
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
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [listCursor, setListCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [switching, setSwitching] = useState(false);
  const [inputNotice, setInputNotice] = useState("");
  const threadRef = useRef<string | null>(null);
  const promptRef = useRef(prompt);
  const switchingRef = useRef(false);
  const switchGeneration = useRef(0);
  const queuedEvents = useRef<ScopedAppEvent[]>([]);
  const activityBoundary = useRef(new ActivitySnapshotBoundary());
  const pendingActivityBoundary = useRef<number | null>(null);
  const beginActivityBoundary = () => {
    if (pendingActivityBoundary.current !== null) activityBoundary.current.cancel(pendingActivityBoundary.current);
    const token = activityBoundary.current.begin();
    pendingActivityBoundary.current = token;
    return token;
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
  promptRef.current = prompt;
  const composing          = useRef(false)               ;
  const lastCompositionEnd = useRef<number | null>(null) ;
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"activity" | "overview" | "events">("activity");
  const [monitorVisible, setMonitorVisible] = useState(() => window.innerWidth >= 1000);
  const [newContent, setNewContent] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const transcriptRef       = useRef<HTMLDivElement>(null)             ;
  const transcriptScrollTop = useRef(0)                                ;
  const followTail          = useRef(true)                             ;
  const sendingRef          = useRef(false)                            ;
  const projection          = useMemo(() => project(events), [events]) ;

  useEffect(() => {
    setNow(Date.now());
    if (!projection.working) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [projection.working, projection.turnId]);

  const selectionBlocked = projection.working || sending || switching || projection.blocks.some((block) => block.kind === "approval" && block.open);

  const refreshConversations = async (cursor?: string) => {
    const selected = requireSelection();
    const generation = ++listGeneration.current;
    setListLoading(true);
    setListError("");
    try {
      const result = await window.www.listConversations(requireSelection(), cursor);
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
    if (workspace) void refreshConversations();
    return () => { listGeneration.current += 1; };
  }, [workspace?.path, workspace?.selectionEpoch]);

  useEffect(() => {
    readingStates.current.set(currentKey, {
      draft: prompt,
      scrollTop: transcriptScrollTop.current,
      followTail: followTail.current
    });
  }, [currentKey, prompt]);

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
    const activityToken = beginActivityBoundary();
    setError("");
    try {
      const selected = requireSelection();
      const restored = id === null
        ? await window.www.newConversation(selected)
        : await window.www.openConversation(selected, id);
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
      setEvents(mergeEvents(restored.events, arrived));
      const activityBatch = activityBoundary.current.complete(activityToken, restored.events);
      if (activityBatch) setActivityState((current) => updateActivitySidebarState(updateActivitySidebarSnapshot(current, activityBatch), arrived, { emitPulses: false }));
      setView("chat");
      void refreshConversations();
      void refreshProjects();
    } catch (failure) {
      const arrived = queuedEvents.current.filter((event) => matchesSelection(event) && belongsToConversation(event, threadRef.current));
      setEvents((current) => mergeEvents(current, arrived));
      const activityBatch = activityBoundary.current.fail(activityToken);
      if (activityBatch) setActivityState((current) => updateActivitySidebarState(updateActivitySidebarSnapshot(current, activityBatch), arrived, { emitPulses: true }));
      for (const snapshot of resourceQueue.current) acceptResources(snapshot);
      resourceQueue.current = [];
      setError(String(failure));
    } finally {
      activityBoundary.current.cancel(activityToken);
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
    setPrompt(next);
    requestAnimationFrame(() => {
      promptInput.current?.focus();
      promptInput.current?.setSelectionRange(next.length, next.length);
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    const activityToken = beginActivityBoundary();
    const acceptEvent = (event: ScopedAppEvent) => {
      if (disposed) return;
      if (switchingRef.current || !selectionRef.current) { queuedEvents.current.push(event); return; }
      if (!matchesSelection(event) || event.connectionGeneration < liveConnection.current) return;
      liveConnection.current = event.connectionGeneration;
      if (event.method === "thread/configured" && sendingRef.current && threadRef.current === null) threadRef.current = eventThreadId(event);
      if (!belongsToConversation(event, threadRef.current)) return;
      if (!activityBoundary.current.queue(event)) setActivityState((current) => updateActivitySidebarState(current, [event], { emitPulses: !event.historical }));
      setEvents((current) => mergeEvents(current, [event]));
      if (event.method === "turn/completed") void refreshConversations();
      if (event.method === "activity/resourcesUnavailable") setError("리소스 복원 실패 · 채팅은 계속 사용할 수 있습니다.");
      if (event.method === "reports/autoState" && event.params && typeof event.params === "object" && "status" in event.params) setAutoReportHint(event.params.status === "saved" ? "새 보고서" : event.params.status === "judging" ? "판단 중" : event.params.status === "failed" ? "확인 필요" : "");
      if (event.method === "reports/autoError" && event.params && typeof event.params === "object" && "message" in event.params) setError(`자동 보고서: ${String(event.params.message)}`);
    };
    // 두 구독을 먼저 설치한 뒤 초기 상태를 요청한다.
    const unsubscribe = window.www.onEvent(acceptEvent);
    const unsubscribeResources = window.www.onActivityResources((snapshot) => {
      if (disposed) return;
      if (switchingRef.current || !selectionRef.current) { resourceQueue.current.push(snapshot); return; }
      acceptResources(snapshot);
    });
    void (async () => {
      const selected = await window.www.workspace();
      if (disposed) return;
      selectionRef.current = selected;
      setWorkspace(selected);
      const snapshot = await window.www.events(selected);
      if (disposed || switchingRef.current || !matchesSelection(selected)) return;
      const configured = [...snapshot].reverse().find((event) => event.method === "thread/configured");
      const id = configured ? eventThreadId(configured) : null;
      if (threadRef.current === null && !sendingRef.current) { threadRef.current = id; setThreadId(id); }
      const current = snapshot.filter((event) => matchesSelection(event) && belongsToConversation(event, threadRef.current));
      const activityBatch = activityBoundary.current.complete(activityToken, current);
      if (activityBatch) setActivityState((state) => updateActivitySidebarSnapshot(state, activityBatch));
      setEvents((state) => mergeEvents(state, current));
      const queued = queuedEvents.current;
      queuedEvents.current = [];
      for (const event of queued) acceptEvent(event);
      for (const resource of resourceQueue.current) acceptResources(resource);
      resourceQueue.current = [];
      const version = resourceVersion.current;
      const initialResources = await window.www.activityResources(selected);
      if (disposed || !matchesSelection(selected)) return;
      if (initialResources && (version === resourceVersion.current || !resourceRef.current || initialResources.revision > resourceRef.current.revision || initialResources.durableRevision > resourceRef.current.durableRevision)) acceptResources(initialResources);
      await window.www.refreshActivity(selected);
    })().catch((failure: unknown) => {
      const batch = activityBoundary.current.fail(activityToken);
      if (batch && !disposed) setActivityState((state) => updateActivitySidebarSnapshot(state, batch));
      if (!disposed) setError(String(failure));
    });
    return () => { disposed = true; activityBoundary.current.cancel(activityToken); unsubscribe(); unsubscribeResources(); };
  }, []);

  const refreshProjects = async () => {
    const selected = requireSelection();
    setProjectLoading(true);
    setProjectError("");
    try {
      const result = await window.www.listProjects(selected);
      if (matchesSelection(selected)) setProjects(result);
    } catch (failure) { if (matchesSelection(selected)) setProjectError(String(failure)); }
    finally { if (matchesSelection(selected)) setProjectLoading(false); }
  };
  useEffect(() => { if (workspace) void refreshProjects(); }, [workspace?.workspaceKey, workspace?.selectionEpoch]);
  const changeProject = async (key?: string) => {
    if (!selectionRef.current || selectionBlocked || switchingRef.current || key === selectionRef.current.workspaceKey) return;
    rememberReading();
    const selected = requireSelection();
    switchingRef.current = true;
    setSwitching(true);
    queuedEvents.current = [];
    const token = beginActivityBoundary();
    try {
      const result: ConversationSelection | null = key
        ? await window.www.switchProject(selected, key)
        : await window.www.chooseWorkspace(selected);
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
      resourceRef.current = null;
      setResources(null);
      restoreReading(null, result.workspace.path);
      const arrived = queuedEvents.current.filter((event) => matchesSelection(event) && belongsToConversation(event, null));
      setEvents(mergeEvents(result.events, arrived));
      const batch = activityBoundary.current.complete(token, result.events);
      setActivityState(batch ? updateActivitySidebarState(updateActivitySidebarSnapshot(createActivitySidebarState(), batch), arrived, { emitPulses: true }) : createActivitySidebarState());
      setError("");
      setView("chat");
    } catch (failure) { setError(String(failure)); }
    finally {
      activityBoundary.current.cancel(token);
      switchingRef.current = false;
      setSwitching(false);
      const arrived = queuedEvents.current.filter((event) => matchesSelection(event) && belongsToConversation(event, threadRef.current));
      queuedEvents.current = [];
      setEvents((current) => mergeEvents(current, arrived));
      setActivityState((current) => updateActivitySidebarState(current, arrived, { emitPulses: true }));
      for (const snapshot of resourceQueue.current) acceptResources(snapshot);
      resourceQueue.current = [];
    }
  };
  const toggleFavorite = async (item: ProjectInfo) => {
    if (favoritePending) return;
    const selected = requireSelection();
    setFavoritePending(true);
    setProjectError("");
    try {
      await window.www.setProjectFavorite(selected, item.workspaceKey, !item.favorite);
      if (matchesSelection(selected)) await refreshProjects();
    } catch (failure) { if (matchesSelection(selected)) setProjectError(`즐겨찾기 저장 실패: ${String(failure)}`); }
    finally { setFavoritePending(false); }
  };

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element || view !== "chat") return;
    if (followTail.current) {
      element.scrollTop = element.scrollHeight;
      setNewContent(false);
    } else {
      element.scrollTop = transcriptScrollTop.current;
      setNewContent(true);
    }
  }, [events, view]);

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element || view !== "chat") return;
    const resize = new ResizeObserver(() => {
      if (followTail.current) element.scrollTop = element.scrollHeight;
    });
    resize.observe(element);
    for (const child of element.children) resize.observe(child);
    return () => resize.disconnect();
  }, [events, view, monitorVisible, detailsVisible]);

  const run = async () => {
    const text = prompt.trim();
    if (!selectionRef.current || !text || sendingRef.current || switchingRef.current || text.length > MAX_PROMPT_CHARS) return;
    const selected = requireSelection();
    sendingRef.current = true;
    setSending(true);
    setPendingPrompt(text);
    setError("");
    setPrompt("");
    try {
      let id = threadId;
      if (!id) {
        id = (await window.www.startThread(selected)).threadId;
        if (!matchesSelection(selected)) return;
        threadRef.current = id;
        readingStates.current.set(conversationKey(workspace?.path ?? "", id), { draft: "", scrollTop: 0, followTail: true });
        readingStates.current.delete(conversationKey(workspace?.path ?? "", null));
        setThreadId(id);
        const version = resourceVersion.current;
        void window.www.activityResources(selected).then((snapshot) => {
          if (snapshot && matchesSelection(selected) && (version === resourceVersion.current || !resourceRef.current || snapshot.revision > resourceRef.current.revision || snapshot.durableRevision > resourceRef.current.durableRevision)) acceptResources(snapshot);
        }).catch((failure: unknown) => { if (matchesSelection(selected)) setError(`리소스 복원 실패: ${String(failure)}`); });
      }
      await window.www.startTurn(selected, id, text);
      if (!matchesSelection(selected)) return;
      void refreshConversations();
    } catch (failure) {
      if (!matchesSelection(selected)) return;
      setPrompt((current) => current || text);
      setError(String(failure));
    } finally {
      setPendingPrompt(null);
      sendingRef.current = false;
      setSending(false);
    }
  };
  const choose = () => changeProject();
  const decide = async (id: string | number, decision: string) => {
    const selected = requireSelection();
    try { await window.www.respond(selected, id, decision); }
    catch (failure) { if (matchesSelection(selected)) setError(String(failure)); }
  };
  const interrupt = async () => {
    if (!threadId || !projection.turnId) return;
    const selected = requireSelection();
    try { await window.www.interrupt(selected, threadId, projection.turnId); }
    catch (failure) { if (matchesSelection(selected)) setError(String(failure)); }
  };

  useEffect(() => {
    void (async () => {
      await afterTwoFrames();
      const ready = await window.www.probeReady();
      if (!ready.enabled) return;
      const developmentPolicy = ready.developmentPolicyAvailable ? await window.www.developmentPolicy() : null;
      if (ready.developmentPolicyAvailable && (!developmentPolicy || developmentPolicy.id !== "www-dev-review" || developmentPolicy.primaryModel !== "opus" || !/^[a-f0-9]{64}$/.test(developmentPolicy.hash))) throw new Error("Probe did not receive the bundled development policy");
      if (ready.expectDevelopmentComplete && !ready.developmentWorkId) throw new Error("Probe completion verification requires a development work UUID");
      const developmentStatus = ready.developmentWorkId ? await window.www.developmentStatus(ready.developmentWorkId) : null;
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
        if (typeof window.www.completeDevelopmentWork !== "function") throw new Error("Probe development completion bridge is unavailable");
        if (ready.expectDevelopmentComplete) {
          const result = await window.www.completeDevelopmentWork(ready.developmentWorkId) ;
          const after  = await window.www.developmentStatus(ready.developmentWorkId)       ;
          if (result.workId !== developmentStatus.workId || result.status !== "done" || after.status !== "done" || after.canComplete !== true) throw new Error("Probe did not observe canonical development completion through IPC");
          developmentCompletion = { rejected: false, workId: result.workId, status: result.status, statusAfter: after.status, canCompleteAfter: after.canComplete };
        } else {
          let rejection: string | null = null;
          try { await window.www.completeDevelopmentWork(ready.developmentWorkId); }
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
      const runningCommand = document.querySelector('[data-testid="command-card"] details');
      if (!(runningCommand instanceof HTMLDetailsElement)) throw new Error("Probe expected running command");
      const summary = runningCommand.querySelector("summary");
      if (!(summary instanceof HTMLElement)) throw new Error("Probe expected command summary");
      if (!runningCommand.open) summary.click();
      await afterTwoFrames();
      summary.click();
      const transcript = document.querySelector(".transcript");
      if (!(transcript instanceof HTMLDivElement)) throw new Error("Probe expected transcript");
      transcript.scrollTop = 0;
      transcript.dispatchEvent(new Event("scroll", { bubbles: true }));
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
        if ((await window.www.workspace().then((selected) => window.www.events(selected))).some((event) => event.method === "turn/completed")) throw new Error("Probe fixture completed before the pending interval could be inspected");
        if (!interruptButton.isConnected || !interruptButton.disabled) throw new Error("Probe enabled interrupt again before the turn completed");
        interruptButton.click();
        await afterTwoFrames();
        const counts = (await window.www.workspace().then((selected) => window.www.events(selected))).filter((event) => event.method === "fixture/interruptRequest").map((event) => (event.params as { count?: number }).count);
        if (counts.length !== 1 || counts[0] !== 1) throw new Error("Probe expected one Native fixture interrupt request");
        interruptPending = { rpcAccepted: true, buttonDisabled: interruptButton.disabled, duplicateClickAttempted: true, requestCount: 1 };
      }
      const completed = await waitForEvent("turn/completed");
      if (ready.checkInterruptPending) {
        const counts = (await window.www.workspace().then((selected) => window.www.events(selected))).filter((event) => event.method === "fixture/interruptRequest").map((event) => (event.params as { count?: number }).count);
        if (counts.length !== 1 || counts[0] !== 1 || (completed.params as { turn?: { status?: string } }).turn?.status !== "interrupted") throw new Error("Probe did not confirm a single interrupt and interrupted completion");
      }
      await afterTwoFrames();
      const command     = document.querySelector('[data-testid="command-card"] details') ;
      const userRequest = document.querySelector('[data-testid="user-request"]') ;
      if (!(command instanceof HTMLDetailsElement) || !userRequest) throw new Error("Probe did not render request and command");
      const workFlow = document.querySelector('[data-testid="work-flow"]');
      if (!(workFlow instanceof HTMLElement) || !workFlow.textContent?.includes("작업 흐름") || !userRequest.textContent?.includes("요청을 받았습니다")) throw new Error("Probe did not connect request acceptance to the work flow");
      const resultSummary = document.querySelector('[data-testid="result-summary"]');
      if (!(resultSummary instanceof HTMLElement) || !resultSummary.textContent?.includes("결과 요약") || !resultSummary.textContent?.includes("실패 1개")) throw new Error("Probe did not render the observed result summary");
      if (textarea.value !== "보존할 입력 초안" || textarea.selectionStart !== 3 || textarea.selectionEnd !== 7) throw new Error("Probe lost draft or selection");
      if (command.open) throw new Error("Probe lost manual command collapse state");
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
      const chatNavigation = document.querySelector('.workspace-nav button');
      if (!(chatNavigation instanceof HTMLButtonElement)) throw new Error("Probe expected chat navigation");
      chatNavigation.click();
      await afterTwoFrames();
      if (textarea.value !== "보존할 입력 초안" || textarea.selectionStart !== 3 || textarea.selectionEnd !== 7 || command.open || transcript.scrollTop !== readingPosition) throw new Error("Probe lost conversation state after ecosystem navigation");
      let reportId : string | null = null  ;
      let nativeAutomaticReport    = false ;
      if (ready.checkNativeReports) {
        const deadline = performance.now() + 20_000;
        while (performance.now() < deadline) {
          const automatic = await window.www.nativeReportStatus();
          if (automatic.jobs.some((job) => job.status === "failed")) throw new Error("Probe automatic Native report failed");
          if (automatic.jobs.some((job) => job.status === "saved" && job.reportId)) { nativeAutomaticReport = true; break; }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (!nativeAutomaticReport) throw new Error("Probe did not observe an automatic report after Native turn completion");
      }
      if (ready.checkReports) {
        const catalog = await window.www.listReports()                               ;
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
        if (textarea.value !== "보존할 입력 초안" || command.open || transcript.scrollTop !== readingPosition) throw new Error("Probe lost conversation state after report navigation");
        reportNavigation.click();
        const opened = performance.now() + 15_000;
        while (!document.querySelector('.report-frame') && performance.now() < opened) await new Promise((resolve) => setTimeout(resolve, 30));
        if (!document.querySelector('.report-frame')) throw new Error("Probe did not reopen the report view");
      }
      let nativeActivity = null;
      if (ready.checkActivity) {
        chatNavigation.click();
        setPanel("activity");
        const detailToggle = document.querySelector<HTMLButtonElement>('[data-testid="detail-monitor-toggle"]');
        if (!detailToggle) throw new Error("Probe detail monitor control missing");
        if (detailToggle.getAttribute("aria-pressed") !== "true") detailToggle.click();
        await afterTwoFrames();
        nativeActivity = await verifyNativeActivity(textarea, send);
      }
      await window.www.probeFinish({
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

        notificationMethods: (await window.www.workspace().then((selected) => window.www.events(selected))).map((event) => event.method)
      });
    })().catch(async (failure) => {
      try {
        await window.www.probeFinish({ error: String(failure) });
      } catch {
        setError(String(failure));
      }
    });
  }, []);

  const activeBlocks = projection.blocks.filter((block) => {
    if (block.kind === "approval") return block.turnId === projection.turnId;
    if (block.kind === "user") return block.turnId === projection.turnId || block.state !== "accepted";
    return block.turnId === projection.turnId;
  });
  const approvals    = activeBlocks.filter((block): block is Extract<Block, { kind: "approval" }> => block.kind === "approval" && block.open) ;
  const commands     = activeBlocks.filter((block): block is Extract<Block, { kind: "command" }> => block.kind === "command"                ) ;
  const files        = activeBlocks.filter((block): block is Extract<Block, { kind: "files" }> => block.kind === "files"                    ) ;
  const explanations = activeBlocks.filter((block): block is Extract<Block, { kind: "explanation" }> => block.kind === "explanation"        ) ;

  const verificationCommands = commands.filter((block) => isVerificationCommand(block.command)       ) ;
  const failedCommands       = commands.filter((block) => block.status === "failed"                  ) ;
  const unresolvedCommands   = commands.filter((block) => block.status === "unknown" || block.running) ;

  const policyLabel = events.some((event) => event.method === "thread/configured" && event.params && typeof event.params === "object" && "isNew" in event.params && event.params.isNew === false) ? "Native 저장 정책" : "workspace-write · on-request";

  const statusTone = approvals.length ? "blocked" : projection.turn === "failed" || projection.transport === "error" ? "failed" : projection.working ? "working" : "idle" ;
  const statusText = approvals.length ? "사용자 결정 대기" : turnLabel(projection.turn)                                                                                   ;
  const verificationText = verificationCommands.length
    ? `실제 검사 ${verificationCommands.length}개 · 성공 ${verificationCommands.filter((block) => block.status === "completed").length} · 실패 ${verificationCommands.filter((block) => block.status === "failed").length} · 미확인 ${verificationCommands.filter((block) => block.status === "unknown" || block.running).length}`
    : "검사로 식별할 실행 근거 없음 · 미검증";

  return <>
    <aside id="workspace-sidebar" className="sidebar"><div className="brand">WWW</div><div className="sec">작업 공간 <button className="icon" aria-label="프로젝트 폴더 선택" onClick={choose} disabled={selectionBlocked || !workspace}><LineIcon kind="folder"/></button></div><div><div className="srow active"><span className="avatar">W</span><span className="name">{workspace?.name ?? "선택 중"}</span><span className="right">{workspace?.branch ?? "git 아님"}</span></div><nav className="workspace-nav" aria-label="화면 선택"><button aria-label="대화" title="대화" aria-current={view === "chat" ? "page" : undefined} onClick={() => setView("chat")}><LineIcon kind="chat"/><span className="nav-label">대화</span></button><button aria-label="생태계 구조 지도" title="생태계 구조 지도" aria-current={view === "ecosystem" ? "page" : undefined} onClick={() => setView("ecosystem")} data-testid="ecosystem-nav"><LineIcon kind="map"/><span className="nav-label">생태계</span><span className="nav-hint">구조 지도</span></button><button aria-label="리포트" title="리포트" aria-current={view === "reports" ? "page" : undefined} onClick={() => { setView("reports"); setAutoReportHint(""); }} data-testid="reports-nav"><LineIcon kind="report"/><span className="nav-label">리포트</span><span className="nav-hint">{autoReportHint || "작업 이야기"}</span></button></nav></div><div className="agents"><section className="chat-conversations" aria-label="로컬 프로젝트"><div className="chat-conversation-heading"><strong>프로젝트</strong><button disabled={projectLoading || switching || !workspace} onClick={() => { void refreshProjects(); }} aria-label="프로젝트 목록 새로고침"><LineIcon kind="refresh"/></button></div>{projectLoading && <p role="status">프로젝트 불러오는 중…</p>}{projectError && <p role="alert" className="chat-list-error">{projectError}</p>}<div className="chat-conversation-list" aria-label="프로젝트 목록">{[true, false].map((favorite) => <section key={String(favorite)} aria-label={favorite ? "즐겨찾기 프로젝트" : "최근 프로젝트"}><div className="group">{favorite ? "즐겨찾기" : "최근 프로젝트"}</div><div className="chat-conversation-list">{projects.filter((item) => item.favorite === favorite).map((item) => <div className={`srow ${workspace?.workspaceKey === item.workspaceKey ? "active" : ""}`} key={item.workspaceKey}><button className="name grow" aria-current={workspace?.workspaceKey === item.workspaceKey ? "true" : undefined} disabled={selectionBlocked} onClick={() => { void changeProject(item.workspaceKey); }} title={item.path}><LineIcon kind="folder"/> {item.name}</button><button className="icon" aria-label={`${item.name} 즐겨찾기 ${item.favorite ? "해제" : "추가"}`} aria-pressed={item.favorite} disabled={switching || favoritePending} onClick={() => { void toggleFavorite(item); }}><LineIcon kind="star"/></button></div>)}</div></section>)}</div>{favoritePending && <p role="status">즐겨찾기 저장 중…</p>}</section><div className="group">CODEX</div><div className="srow"><span className="agentmark"/><span>{statusText}</span></div><section className="chat-conversations" aria-label="저장된 대화"><div className="chat-conversation-heading"><strong>대화</strong><button type="button" data-testid="new-conversation" disabled={selectionBlocked} onClick={() => { void selectConversation(null); }}>새 대화</button></div><label className="chat-search"><span className="sr-only">불러온 대화 검색</span><input data-testid="conversation-search" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="불러온 대화 검색"/></label><div className="chat-list-tools"><span>{listLoading ? "불러오는 중…" : `불러온 대화 ${conversations.length}개`}</span><button type="button" disabled={listLoading || switching} onClick={() => { void refreshConversations(); }} aria-label="대화 목록 새로고침">새로고침</button></div>{listError && <div role="status" className="chat-list-error">{listError}</div>}<div className="chat-conversation-list" data-testid="conversation-list">{conversations.filter((item) => `${item.title} ${item.preview}`.toLocaleLowerCase("ko-KR").includes(conversationSearch.toLocaleLowerCase("ko-KR"))).map((item) => <button type="button" key={item.id} data-testid="conversation-item" data-thread-id={item.id} className={item.id === threadId ? "is-current" : ""} aria-current={item.id === threadId ? "true" : undefined} disabled={selectionBlocked} onClick={() => { void selectConversation(item.id); }}><strong>{item.title || item.preview || "제목 없는 대화"}</strong><span>{item.preview || "내용 미제공"}</span>{item.updatedAt !== null && Number.isFinite(new Date(item.updatedAt * 1000).getTime()) && <time dateTime={new Date(item.updatedAt * 1000).toISOString()}>{new Date(item.updatedAt * 1000).toLocaleDateString("ko-KR")}</time>}</button>)}</div>{!listLoading && conversations.length === 0 && !listError && <p className="muted">이 작업 폴더에 저장된 대화가 없습니다.</p>}{conversations.length > 0 && conversationSearch && !conversations.some((item) => `${item.title} ${item.preview}`.toLocaleLowerCase("ko-KR").includes(conversationSearch.toLocaleLowerCase("ko-KR"))) && <p className="muted">불러온 대화 중 일치하는 항목이 없습니다.</p>}{listCursor && <button type="button" className="chat-load-more" data-testid="load-more-conversations" disabled={listLoading || switching} onClick={() => { void refreshConversations(listCursor); }}>이전 대화 더 불러오기</button>}</section></div><div className="footer"><span className="muted">{workspace?.path}</span><span>{workspace?.changes ?? 0} changes</span></div></aside>
    <main className="work" hidden={view !== "chat"}><div className="tabrow"><button className="tab active">대화</button><span className="spacer"/><button ref={monitorButton} className="tool" data-testid="detail-monitor-toggle" aria-label="상세 실행 모니터" aria-pressed={detailsVisible} onClick={() => setDetailsVisible((visible) => !visible)}>상세 모니터 {detailsVisible ? "닫기" : "열기"}</button><button className="tool" data-testid="resource-sidebar-toggle" aria-label="실시간 리소스 사이드바" aria-pressed={monitorVisible} onClick={() => setMonitorVisible((visible) => !visible)}>세션 모니터 {monitorVisible ? "접기" : "열기"}</button><span className="tool selected">Codex app-server</span></div><section className="stage"><div className="pane focused"><div className="title"><span className="name">Codex</span><span className="path">{workspace?.name}</span></div><div className="body conversation"><div className="transcript" tabIndex={0} aria-label="대화 내용" ref={transcriptRef} onScroll={(event) => { if (view !== "chat") return; const element = event.currentTarget; transcriptScrollTop.current = element.scrollTop; followTail.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48; readingStates.current.set(currentKey, { draft: promptRef.current, scrollTop: element.scrollTop, followTail: followTail.current }); if (followTail.current) setNewContent(false); }}>{projection.historyTruncated && <div className="history-warning">최근 {MAX_RAW_EVENTS.toLocaleString("ko-KR")}개 사건만 있어 이전 흐름은 완전히 복원할 수 없습니다.</div>}<ChatRowMemoryContext.Provider value={rowMemory}>{pendingPrompt && !projection.blocks.some((block) => block.kind === "user" && block.text === pendingPrompt && block.state === "sending") && <div className="chat-flow-item"><div className="user request-sending" data-testid="pending-user-request"><div>{pendingPrompt}</div><span className="muted">요청을 보내는 중</span></div><WorkFlow turn="starting" blocks={[]} events={[]} transport={projection.transport} interrupt={projection.interrupt} now={now}/></div>}{projection.blocks.length === 0 && !pendingPrompt ? <div className="empty">{switching ? "대화를 불러오는 중입니다." : "작업 폴더를 확인하고 메시지를 입력하거나 저장된 대화를 여세요."}</div> : projection.blocks.map((block) => <div className="chat-flow-item" key={`${currentKey}:${blockKey(block)}`}><BlockView block={block} decide={decide} quote={quote}/>{block.kind === "user" && (block.turnId === projection.turnId || block.state !== "accepted") && <WorkFlow turn={projection.turn} blocks={activeBlocks} events={events} transport={projection.transport} interrupt={projection.interrupt} now={now}/>}</div>)}<ResultSummary blocks={activeBlocks} turn={projection.turn}/></ChatRowMemoryContext.Provider></div>{newContent && <button className="secondary new-content" onClick={() => { followTail.current = true; transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }); setNewContent(false); }}>새 내용으로 이동</button>}<div className="compose"><span className="prompt">›</span><textarea ref={promptInput} data-testid="prompt-input" value={prompt} maxLength={MAX_PROMPT_CHARS} disabled={switching} aria-label="Codex에게 작업 요청" onChange={(event) => { setPrompt(event.target.value); setInputNotice(composerFull(event.target.value.length, MAX_PROMPT_CHARS) ? "입력 한도에 도달했습니다." : ""); }} onPaste={(event) => { const count = pasteOverflow(prompt, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, event.clipboardData.getData("text/plain"), MAX_PROMPT_CHARS); if (count > 0) { event.preventDefault(); setInputNotice(`붙여넣을 내용이 입력 한도를 ${count.toLocaleString("ko-KR")}자 넘어서 추가하지 않았습니다.`); } }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={(event) => { composing.current = false; lastCompositionEnd.current = normalizeCompositionEnd(event.nativeEvent.timeStamp); }} onBlur={() => { composing.current = false; }} onKeyDown={(event) => { handlePromptKeyDown(event, () => { void run(); }, composing.current, lastCompositionEnd.current); }} placeholder="Codex에게 작업 요청"/><div className="actions">{projection.working && <button data-testid="interrupt-button" className="secondary" onClick={interrupt} disabled={projection.interrupt === "requested" || projection.interrupt === "accepted"}>{projection.interrupt === "accepted" ? "중단 접수됨" : projection.interrupt === "requested" ? "중단 요청 중" : "중단"}</button>}<button data-testid="send-button" className="primary" onClick={run} disabled={!workspace || !prompt.trim() || sending || switching || prompt.length > MAX_PROMPT_CHARS}>{sending ? "전송 중" : "보내기"}</button></div></div><div className="chat-compose-note" role="status">{inputNotice || (switching ? "저장된 대화를 여는 중입니다." : `Enter 전송 · Shift+Enter 줄바꿈 · ${prompt.length.toLocaleString("ko-KR")}/${MAX_PROMPT_CHARS.toLocaleString("ko-KR")}`)}</div></div></div></section></main>
    <ResourceActivitySidebar events={events} resources={resources} threadId={threadId} workspacePath={workspace?.path} sending={sending || pendingPrompt !== null} hidden={view !== "chat" || !monitorVisible || detailsVisible} onOpenMonitor={() => setDetailsVisible(true)}/>
    <NativeActivityView key={workspace?.workspaceKey ?? "initial"} activityState={activityState} events={events} threadId={threadId} workspacePath={workspace?.path} hidden={view !== "chat" || !detailsVisible || panel !== "activity"} onClose={() => { setDetailsVisible(false); monitorButton.current?.focus(); }} onShowOverview={() => setPanel("overview")} onShowEvents={() => setPanel("events")}/>
    <aside className="panel" onKeyDown={(event) => { if (event.key === "Escape") { setDetailsVisible(false); monitorButton.current?.focus(); } }} hidden={view !== "chat" || !detailsVisible || panel === "activity"}><div className="phead"><span className="logo"/><span className="title">Codex</span><span className="pill">{threadId ?? "새 스레드"}</span></div><div className="ptabs"><button aria-label="상세 모니터 닫기" onClick={() => { setDetailsVisible(false); monitorButton.current?.focus(); }}>닫기</button><button className="ptab" onClick={() => setPanel("activity")}>흐름</button><button className={`ptab ${panel === "overview" ? "active" : ""}`} onClick={() => setPanel("overview")}>개요</button><button className={`ptab ${panel === "events" ? "active" : ""}`} onClick={() => setPanel("events")}>이벤트</button><span className="aside">{events.length}{projection.historyTruncated ? "+" : ""}</span></div><div className="pbody">{panel === "overview" ? <><div className={`headline t-${statusTone}`}><span className="glyph">{approvals.length ? "!" : projection.working ? "·" : projection.turn === "failed" ? "×" : "○"}</span><div><div className="h">{statusText}</div><div className="sub">연결 {projection.transport} · 중단 {projection.interrupt === "accepted" ? "접수됨 · 최종 결과 대기" : projection.interrupt} · 턴 {projection.turn}</div></div></div><div className="counts"><div className="count"><div className="n">{commands.length}</div><div className="l">현재 명령</div></div><div className="count blocked"><div className="n">{approvals.length}</div><div className="l">현재 요청</div></div><div className="count"><div className="n">{files.length}</div><div className="l">현재 변경</div></div></div><div className="ledger"><div className="entry"><span className="prov">공개 설명</span><span>{explanations.length ? explanations.map((block) => block.text).filter(Boolean).join(" · ") : "Native 공개 설명 미제공"}</span></div><div className="entry"><span className="prov">관측 결과</span><span>현재 턴 명령 {commands.length} · 파일 변경 {files.length} · 실패 {failedCommands.length} · 미확인 {unresolvedCommands.length}</span></div><div className="entry"><span className="prov">실제 검증</span><span>{verificationText}</span></div><div className="entry"><span className="prov">미해결</span><span>{approvals.length ? `승인 ${approvals.length}건 대기` : failedCommands.length ? `실패 명령 ${failedCommands.length}건` : unresolvedCommands.length ? `결과 미확인 명령 ${unresolvedCommands.length}건` : projection.transport !== "connected" ? `연결 ${projection.transport}` : "현재 턴에서 관측된 차단 없음"}</span></div></div></> : <div className="ledger">{projection.historyTruncated && <div className="history-warning">이벤트 앞부분이 없어 완전한 기록이 아닙니다.</div>}{events.map((event) => <div className="entry" key={`${event.processEpoch}:${event.connectionGeneration}:${event.seq}`}><span className="seq">{event.seq}</span><span className="prov">{event.kind}</span><span>{event.method}</span></div>)}</div>}</div><div className="pfooter"><span className="src">로컬 Codex CLI · Native 출력은 신뢰하지 않는 데이터 · 승인 UI는 OS sandbox 보장이 아님</span></div></aside>
    <EcosystemView hidden={view !== "ecosystem"}/>
    {view === "reports" && <ReportsView/>}
    <footer className="status"><span>{statusText}</span><span>연결 {projection.transport} · {policyLabel}</span>{projection.protocolWarning && <span className="comm-warning" title={projection.protocolWarning.message}>최근 통신 경고 · <time dateTime={projection.protocolWarning.at}>{new Date(projection.protocolWarning.at).toLocaleTimeString("ko-KR")}</time></span>}{projectStorageWarning && <span className="project-storage-warning" role="status" title={projectStorageWarning} data-failed-scopes={JSON.stringify(projectStorageWarnings)}>{projectStorageWarning}</span>}<span className="grow"/><span className="err">{error}</span></footer>
  </>;
}

createRoot(document.getElementById("root")!).render(<App/>);
