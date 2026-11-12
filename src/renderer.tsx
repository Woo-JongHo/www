import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MAX_OUTPUT_CODE_UNITS, project, type Block } from "./projection";
import type { AppEvent, TurnState, WorkspaceInfo, WwwApi } from "./shared";

declare global { interface Window { www: WwwApi } }

const MAX_RAW_EVENTS = 2_000;
const afterTwoFrames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const waitForEvent = async (method: string, timeoutMs = 3000): Promise<AppEvent> => {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const event = (await window.www.events()).find((entry) => entry.method === method);
    if (event) return event;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Probe timed out waiting for ${method}`);
};

function mergeEvents(current: readonly AppEvent[], incoming: readonly AppEvent[]): AppEvent[] {
  const bySequence = new Map(current.map((event) => [event.seq, event]));
  for (const event of incoming) bySequence.set(event.seq, event);
  return [...bySequence.values()].sort((left, right) => left.seq - right.seq).slice(-MAX_RAW_EVENTS);
}

function blockKey(block: Block): string {
  if (block.kind === "approval") return block.id;
  return `${block.kind}-${block.id}`;
}

function fileStatus(block: Extract<Block, { kind: "files" }>): string {
  if (block.running) return "진행 중";
  if (block.status === "completed") return "완료";
  if (block.status === "failed") return "실패";
  return "결과 미확인";
}

function BlockView({ block, decide }: { block: Block; decide(id: string | number, decision: string): void }) {
  if (block.kind === "user") {
    return <div className={`user request-${block.state}`} data-testid="user-request"><div>{block.text}</div><span className="muted">{block.state === "sending" ? "전송 중" : block.state === "accepted" ? `요청 연결됨 · ${block.turnId ?? "턴 확인 중"}` : `전송 실패 · ${block.error ?? "원인 미확인"}`}</span></div>;
  }
  if (block.kind === "explanation") {
    return <div className={`explanation ${block.streaming ? "streaming" : ""}`} data-testid="public-explanation"><span className="prov">{block.source === "commentary" ? "Native 공개 설명" : "Native 공개 계획"}</span><div>{block.text || "내용 미제공"}</div></div>;
  }
  if (block.kind === "answer") return <div className={`agent ${block.streaming ? "streaming" : ""}`}>{block.text || "응답 내용 미제공"}</div>;
  if (block.kind === "command") return <CommandView block={block}/>;
  if (block.kind === "files") return <div className={`files item-${block.status}`} data-testid="file-change"><div>파일 변경 · {fileStatus(block)}</div>{block.changes.length ? block.changes.map((change) => <details key={change.path}><summary>{change.path}</summary>{change.diff === null ? <div className="muted">변경 내용 미제공</div> : <pre data-testid="file-diff">{change.diff || "제공된 변경 내용이 비어 있습니다."}</pre>}{change.truncated && <div className="muted">변경 내용의 최근 {MAX_OUTPUT_CODE_UNITS.toLocaleString("ko-KR")} UTF-16 코드 단위만 보관합니다. 앞부분은 복원할 수 없습니다.</div>}</details>) : "파일 정보 미제공"}</div>;
  return <div className={`approval ${block.open ? "open" : ""}`} data-testid="approval-card"><div className="ahead">{!block.supported ? "지원하지 않는 요청" : block.state === "open" ? "승인 필요" : block.state === "responding" ? "응답 전송 중" : block.state === "responded" ? "응답 전송됨" : "응답 결과 미확인"}</div><div className="abody">{block.summary}</div>{block.supported && block.open && <div className="aact"><button data-decision="accept" onClick={() => decide(block.requestId, "accept")}>허용</button><button data-decision="acceptForSession" onClick={() => decide(block.requestId, "acceptForSession")}>세션 허용</button><button data-decision="decline" onClick={() => decide(block.requestId, "decline")}>거절</button><button data-decision="cancel" onClick={() => decide(block.requestId, "cancel")}>중단</button></div>}</div>;
}

function CommandView({ block }: { block: Extract<Block, { kind: "command" }> }) {
  const defaultOpen = block.running || block.status !== "completed";
  const [open, setOpen] = useState(defaultOpen);
  const userToggled = useRef(false);
  useEffect(() => {
    if (!userToggled.current) setOpen(defaultOpen);
  }, [defaultOpen]);
  const state = block.running
    ? "실행 중"
    : block.status === "completed"
      ? block.exitCode === null ? "완료 · 종료 코드 미제공" : "성공"
      : block.status === "failed"
        ? block.exitCode === null ? "실패" : `실패 ${block.exitCode}`
        : "종료 결과 미확인";
  return <details open={open} className={`cmd item-${block.status}`} data-testid="command-card"><summary onClick={(event) => { event.preventDefault(); userToggled.current = true; setOpen((current) => !current); }}><span className="cmdline">{block.command || "명령 정보 미제공"}</span><span className="cmdstate">{state}</span></summary>{block.cwd && <div className="muted">작업 경로: {block.cwd}</div>}{block.output && <pre>{block.output}</pre>}{block.outputTruncated && <div className="muted">최근 {MAX_OUTPUT_CODE_UNITS.toLocaleString("ko-KR")} UTF-16 코드 단위만 표시합니다. 앞부분은 메모리에서 제거되어 복원할 수 없습니다.</div>}</details>;
}

function turnLabel(turn: TurnState): string {
  if (turn === "idle") return "요청 전";
  if (turn === "starting") return "요청 접수 확인 중";
  if (turn === "running") return "실행 중";
  if (turn === "completed") return "실행 종료";
  if (turn === "interrupted") return "중단 확인";
  if (turn === "failed") return "실행 실패";
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

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"overview" | "events">("overview");
  const [newContent, setNewContent] = useState(false);
  const [sending, setSending] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const followTail = useRef(true);
  const sendingRef = useRef(false);
  const projection = useMemo(() => project(events), [events]);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = window.www.onEvent((event) => {
      if (!disposed) setEvents((current) => mergeEvents(current, [event]));
    });
    void window.www.workspace().then((value) => { if (!disposed) setWorkspace(value); });
    void window.www.events().then((snapshot) => { if (!disposed) setEvents((current) => mergeEvents(current, snapshot)); });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element) return;
    if (followTail.current) {
      element.scrollTop = element.scrollHeight;
      setNewContent(false);
    } else {
      setNewContent(true);
    }
  }, [events]);

  const run = async () => {
    const text = prompt.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    setPrompt("");
    try {
      let id = threadId;
      if (!id) {
        id = (await window.www.startThread()).threadId;
        setThreadId(id);
      }
      await window.www.startTurn(id, text);
    } catch (failure) {
      setPrompt((current) => current || text);
      setError(String(failure));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  const choose = async () => {
    try {
      const value = await window.www.chooseWorkspace();
      if (value) setWorkspace(value);
    } catch (failure) {
      setError(String(failure));
    }
  };
  const decide = async (id: string | number, decision: string) => {
    try {
      await window.www.respond(id, decision);
    } catch (failure) {
      setError(String(failure));
    }
  };
  const interrupt = async () => {
    if (!threadId || !projection.turnId) return;
    try {
      await window.www.interrupt(threadId, projection.turnId);
    } catch (failure) {
      setError(String(failure));
    }
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
      let developmentCompletion: { rejected: true; reason: string } | { rejected: false; workId: string; status: string; statusAfter: string; canCompleteAfter: boolean } | null = null;
      if (ready.developmentWorkId) {
        if (!developmentStatus || developmentStatus.workId !== ready.developmentWorkId.toLowerCase() || developmentStatus.canComplete !== (ready.expectDevelopmentComplete === true)) throw new Error("Probe development status did not match the requested completion scenario");
        if (typeof window.www.completeDevelopmentWork !== "function") throw new Error("Probe development completion bridge is unavailable");
        if (ready.expectDevelopmentComplete) {
          const result = await window.www.completeDevelopmentWork(ready.developmentWorkId);
          const after = await window.www.developmentStatus(ready.developmentWorkId);
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
      const runningCommand = document.querySelector('[data-testid="command-card"]');
      if (!(runningCommand instanceof HTMLDetailsElement)) throw new Error("Probe expected running command");
      const summary = runningCommand.querySelector("summary");
      if (!(summary instanceof HTMLElement)) throw new Error("Probe expected command summary");
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
        if ((await window.www.events()).some((event) => event.method === "turn/completed")) throw new Error("Probe fixture completed before the pending interval could be inspected");
        if (!interruptButton.isConnected || !interruptButton.disabled) throw new Error("Probe enabled interrupt again before the turn completed");
        interruptButton.click();
        await afterTwoFrames();
        const counts = (await window.www.events()).filter((event) => event.method === "fixture/interruptRequest").map((event) => (event.params as { count?: number }).count);
        if (counts.length !== 1 || counts[0] !== 1) throw new Error("Probe expected one Native fixture interrupt request");
        interruptPending = { rpcAccepted: true, buttonDisabled: interruptButton.disabled, duplicateClickAttempted: true, requestCount: 1 };
      }
      const completed = await waitForEvent("turn/completed");
      if (ready.checkInterruptPending) {
        const counts = (await window.www.events()).filter((event) => event.method === "fixture/interruptRequest").map((event) => (event.params as { count?: number }).count);
        if (counts.length !== 1 || counts[0] !== 1 || (completed.params as { turn?: { status?: string } }).turn?.status !== "interrupted") throw new Error("Probe did not confirm a single interrupt and interrupted completion");
      }
      await afterTwoFrames();
      const command = document.querySelector('[data-testid="command-card"]');
      const userRequest = document.querySelector('[data-testid="user-request"]');
      if (!(command instanceof HTMLDetailsElement) || !userRequest) throw new Error("Probe did not render request and command");
      if (textarea.value !== "보존할 입력 초안" || textarea.selectionStart !== 3 || textarea.selectionEnd !== 7) throw new Error("Probe lost draft or selection");
      if (command.open) throw new Error("Probe lost manual command collapse state");
      if (!document.querySelector(".new-content")) throw new Error("Probe did not preserve historical scroll position");
      if (!document.querySelector(".cmd.item-failed") || !document.body.textContent?.includes("UTF-16 코드 단위")) throw new Error("Probe did not render failure and long-output boundary");
      await window.www.probeFinish({
        readinessMs: ready.readinessMs,
        readinessDefinition: "native entry to the second requestAnimationFrame callback after React mount",
        interactionPath: "rendered controls",
        developmentPolicy,
        developmentStatus,
        developmentCompletion,
        interruptPending,
        approvalId: approval.requestId,
        approvalIdType: typeof approval.requestId,
        approvalRoundtrip: true,
        interruptStatus: (completed.params as { turn?: { status?: string } })?.turn?.status,
        requestRendered: true,
        commandRendered: true,
        manualCommandCollapsePreserved: true,
        historicalScrollPreserved: true,
        failedCommandRendered: true,
        longOutputBoundaryRendered: true,
        draftPreserved: true,
        selectionPreserved: true,
        notificationMethods: (await window.www.events()).map((event) => event.method)
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
  const approvals = activeBlocks.filter((block): block is Extract<Block, { kind: "approval" }> => block.kind === "approval" && block.open);
  const commands = activeBlocks.filter((block): block is Extract<Block, { kind: "command" }> => block.kind === "command");
  const files = activeBlocks.filter((block): block is Extract<Block, { kind: "files" }> => block.kind === "files");
  const explanations = activeBlocks.filter((block): block is Extract<Block, { kind: "explanation" }> => block.kind === "explanation");
  const verificationCommands = commands.filter((block) => isVerificationCommand(block.command));
  const failedCommands = commands.filter((block) => block.status === "failed");
  const unresolvedCommands = commands.filter((block) => block.status === "unknown" || block.running);
  const statusTone = approvals.length ? "blocked" : projection.turn === "failed" || projection.transport === "error" ? "failed" : projection.working ? "working" : "idle";
  const statusText = approvals.length ? "사용자 결정 대기" : turnLabel(projection.turn);
  const verificationText = verificationCommands.length
    ? `실제 검사 ${verificationCommands.length}개 · 성공 ${verificationCommands.filter((block) => block.status === "completed").length} · 실패 ${verificationCommands.filter((block) => block.status === "failed").length} · 미확인 ${verificationCommands.filter((block) => block.status === "unknown" || block.running).length}`
    : "검사로 식별할 실행 근거 없음 · 미검증";

  return <>
    <aside className="sidebar"><div className="brand">WWW</div><div className="sec">작업 공간 <button className="icon" onClick={choose} disabled={!!threadId}>＋</button></div><div><div className="srow active"><span className="avatar">W</span><span className="name">{workspace?.name ?? "선택 중"}</span><span className="right">{workspace?.branch ?? "git 아님"}</span></div></div><div className="agents"><div className="group">CODEX</div><div className="srow"><span className="agentmark"/><span>{statusText}</span></div></div><div className="footer"><span className="muted">{workspace?.path}</span><span>{workspace?.changes ?? 0} changes</span></div></aside>
    <main className="work"><div className="tabrow"><button className="tab active">대화</button><span className="spacer"/><button className="tool selected">Codex app-server</button></div><section className="stage"><div className="pane focused"><div className="title"><span className="name">Codex</span><span className="path">{workspace?.name}</span></div><div className="body conversation"><div className="transcript" ref={transcriptRef} onScroll={(event) => { const element = event.currentTarget; followTail.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48; if (followTail.current) setNewContent(false); }}>{projection.historyTruncated && <div className="history-warning">최근 {MAX_RAW_EVENTS.toLocaleString("ko-KR")}개 사건만 있어 이전 흐름은 완전히 복원할 수 없습니다.</div>}{projection.blocks.length === 0 ? <div className="empty">작업 폴더를 확인하고 메시지를 입력하세요.</div> : projection.blocks.map((block) => <BlockView key={blockKey(block)} block={block} decide={decide}/>)}</div>{newContent && <button className="secondary new-content" onClick={() => { followTail.current = true; transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }); setNewContent(false); }}>새 내용으로 이동</button>}<div className="compose"><span className="prompt">›</span><textarea data-testid="prompt-input" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void run(); } }} placeholder="Codex에게 작업 요청"/><div className="actions">{projection.working && <button data-testid="interrupt-button" className="secondary" onClick={interrupt} disabled={projection.interrupt === "requested"}>{projection.interrupt === "requested" ? "중단 요청 중" : "중단"}</button>}<button data-testid="send-button" className="primary" onClick={run} disabled={!prompt.trim() || sending}>{sending ? "전송 중" : "보내기"}</button></div></div></div></div></section></main>
    <aside className="panel"><div className="phead"><span className="logo"/><span className="title">Codex</span><span className="pill">{threadId ?? "새 스레드"}</span></div><div className="ptabs"><button className={`ptab ${panel === "overview" ? "active" : ""}`} onClick={() => setPanel("overview")}>개요</button><button className={`ptab ${panel === "events" ? "active" : ""}`} onClick={() => setPanel("events")}>이벤트</button><span className="aside">{events.length}{projection.historyTruncated ? "+" : ""}</span></div><div className="pbody">{panel === "overview" ? <><div className={`headline t-${statusTone}`}><span className="glyph">{approvals.length ? "!" : projection.working ? "·" : projection.turn === "failed" ? "×" : "○"}</span><div><div className="h">{statusText}</div><div className="sub">연결 {projection.transport} · 중단 {projection.interrupt} · 턴 {projection.turn}</div></div></div><div className="counts"><div className="count"><div className="n">{commands.length}</div><div className="l">현재 명령</div></div><div className="count blocked"><div className="n">{approvals.length}</div><div className="l">현재 요청</div></div><div className="count"><div className="n">{files.length}</div><div className="l">현재 변경</div></div></div><div className="ledger"><div className="entry"><span className="prov">공개 설명</span><span>{explanations.length ? explanations.map((block) => block.text).filter(Boolean).join(" · ") : "Native 공개 설명 미제공"}</span></div><div className="entry"><span className="prov">관측 결과</span><span>현재 턴 명령 {commands.length} · 파일 변경 {files.length} · 실패 {failedCommands.length} · 미확인 {unresolvedCommands.length}</span></div><div className="entry"><span className="prov">실제 검증</span><span>{verificationText}</span></div><div className="entry"><span className="prov">미해결</span><span>{approvals.length ? `승인 ${approvals.length}건 대기` : failedCommands.length ? `실패 명령 ${failedCommands.length}건` : unresolvedCommands.length ? `결과 미확인 명령 ${unresolvedCommands.length}건` : projection.transport !== "connected" ? `연결 ${projection.transport}` : "현재 턴에서 관측된 차단 없음"}</span></div></div></> : <div className="ledger">{projection.historyTruncated && <div className="history-warning">이벤트 앞부분이 없어 완전한 기록이 아닙니다.</div>}{events.map((event) => <div className="entry" key={event.seq}><span className="seq">{event.seq}</span><span className="prov">{event.kind}</span><span>{event.method}</span></div>)}</div>}</div><div className="pfooter"><span className="src">로컬 Codex CLI · Native 출력은 신뢰하지 않는 데이터 · 승인 UI는 OS sandbox 보장이 아님</span></div></aside>
    <footer className="status"><span>{statusText}</span><span>연결 {projection.transport} · workspace-write · on-request</span><span className="grow"/><span className="err">{error}</span></footer>
  </>;
}

createRoot(document.getElementById("root")!).render(<App/>);
