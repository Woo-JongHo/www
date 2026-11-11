import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { project, type Block } from "./projection";
import type { AppEvent, WorkspaceInfo, WwwApi } from "./shared";
declare global { interface Window { www: WwwApi } }

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

function BlockView({ block, decide }: { block: Block; decide(id: string | number, decision: string): void }) {
  if (block.kind === "answer") return <div className={`agent ${block.streaming ? "streaming" : ""}`}>{block.text}</div>;
  if (block.kind === "command") return <CommandView block={block}/>;
  if (block.kind === "files") return <div className="files">{block.paths.length ? block.paths.join(", ") : "파일 변경"} · {block.running ? "진행 중" : "완료"}</div>;
  return <div className={`approval ${block.open ? "open" : ""}`}><div className="ahead">{!block.supported ? "지원하지 않는 요청" : block.state === "open" ? "승인 필요" : block.state === "responding" ? "응답 전송 중" : block.state === "responded" ? "응답 전송됨" : "응답 결과 미확인"}</div><div className="abody">{block.summary}</div>{block.supported && block.open && <div className="aact"><button onClick={() => decide(block.requestId, "accept")}>허용</button><button onClick={() => decide(block.requestId, "acceptForSession")}>세션 허용</button><button onClick={() => decide(block.requestId, "decline")}>거절</button><button onClick={() => decide(block.requestId, "cancel")}>중단</button></div>}</div>;
}

function CommandView({ block }: { block: Extract<Block, { kind: "command" }> }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (details.current) details.current.open = block.running || block.exitCode !== 0;
  }, []);
  return <details ref={details} className={`cmd ${block.exitCode !== null && block.exitCode !== 0 ? "failed" : ""}`}><summary><span className="cmdline">{block.command || "명령 정보 미제공"}</span><span className="cmdstate">{block.running ? "실행 중" : block.exitCode === null ? "종료 상태 미확인" : block.exitCode === 0 ? "성공" : `실패 ${block.exitCode}`}</span></summary>{block.cwd && <div className="muted">작업 경로: {block.cwd}</div>}{block.output && <pre>{block.output}</pre>}{block.outputTruncated && <div className="muted">최근 32 KiB만 표시합니다. 앞부분은 메모리에서 제거되어 복원할 수 없습니다.</div>}</details>;
}

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"overview" | "events">("overview");
  const [newContent, setNewContent] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const followTail = useRef(true);
  const projection = useMemo(() => project(events), [events]);
  useEffect(() => { void window.www.workspace().then(setWorkspace); void window.www.events().then(setEvents); return window.www.onEvent((event) => setEvents((old) => [...old, event])); }, []);
  useEffect(() => {
    void (async () => {
      await afterTwoFrames();
      const ready = await window.www.probeReady();
      if (!ready.enabled) return;
      setPrompt("보존할 입력 초안");
      await afterTwoFrames();
      const textarea = document.querySelector("textarea");
      if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("Probe expected textarea");
      textarea.focus();
      textarea.setSelectionRange(3, 7);
      const started = await window.www.startThread();
      const turn = await window.www.startTurn(started.threadId, "fixture probe");
      const approval = await waitForEvent("item/commandExecution/requestApproval");
      if (approval.requestId !== 42) throw new Error("Probe expected numeric approval ID 42");
      await window.www.respond(approval.requestId, "decline");
      await waitForEvent("fixture/approvalResponse");
      await window.www.interrupt(started.threadId, turn.turnId);
      const completed = await waitForEvent("turn/completed");
      await afterTwoFrames();
      if (textarea.value !== "보존할 입력 초안" || textarea.selectionStart !== 3 || textarea.selectionEnd !== 7) throw new Error("Probe lost draft or selection");
      await window.www.probeFinish({
        readinessMs: ready.readinessMs,
        readinessDefinition: "native entry to the second requestAnimationFrame callback after React mount",
        approvalId: approval.requestId,
        approvalIdType: typeof approval.requestId,
        approvalRoundtrip: true,
        interruptStatus: (completed.params as { turn?: { status?: string } })?.turn?.status,
        draftPreserved: true,
        selectionPreserved: true,
        notificationMethods: (await window.www.events()).map((event) => event.method)
      });
    })().catch(async (error) => {
      try { await window.www.probeFinish({ error: String(error) }); } catch { setError(String(error)); }
    });
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
  const run = async () => { const text = prompt.trim(); if (!text) return; setError(""); setPrompt(""); try { let id = threadId; if (!id) { id = (await window.www.startThread()).threadId; setThreadId(id); } await window.www.startTurn(id, text); } catch (e) { setError(String(e)); } };
  const choose = async () => { try { const value = await window.www.chooseWorkspace(); if (value) setWorkspace(value); } catch (e) { setError(String(e)); } };
  const decide = async (id: string | number, decision: string) => { try { await window.www.respond(id, decision); } catch (e) { setError(String(e)); } };
  const interrupt = async () => { if (threadId && projection.turnId) try { await window.www.interrupt(threadId, projection.turnId); } catch (e) { setError(String(e)); } };
  const approvals = projection.blocks.filter((b) => b.kind === "approval" && b.open).length;
  const commands = projection.blocks.filter((b) => b.kind === "command");
  const files = projection.blocks.filter((b) => b.kind === "files");
  const failedCommands = commands.filter((b) => b.exitCode !== null && b.exitCode !== 0).length;
  return <>
    <aside className="sidebar"><div className="brand">WWW</div><div className="sec">작업 공간 <button className="icon" onClick={choose} disabled={!!threadId}>＋</button></div><div><div className="srow active"><span className="avatar">W</span><span className="name">{workspace?.name ?? "선택 중"}</span><span className="right">{workspace?.branch ?? "git 아님"}</span></div></div><div className="agents"><div className="group">CODEX</div><div className="srow"><span className="agentmark"/><span>{projection.working ? "작업 중" : threadId ? "대기" : "연결 전"}</span></div></div><div className="footer"><span className="muted">{workspace?.path}</span><span>{workspace?.changes ?? 0} changes</span></div></aside>
    <main className="work"><div className="tabrow"><button className="tab active">대화</button><span className="spacer"/><button className="tool selected">Codex app-server</button></div><section className="stage"><div className="pane focused"><div className="title"><span className="name">Codex</span><span className="path">{workspace?.name}</span></div><div className="body conversation"><div className="transcript" ref={transcriptRef} onScroll={(event) => { const element = event.currentTarget; followTail.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48; if (followTail.current) setNewContent(false); }}>{projection.blocks.length === 0 ? <div className="empty">작업 폴더를 확인하고 메시지를 입력하세요.</div> : projection.blocks.map((block, i) => <BlockView key={`${block.kind}-${"id" in block ? block.id : String(block.requestId)}-${i}`} block={block} decide={decide}/>)}</div>{newContent && <button className="secondary" onClick={() => { followTail.current = true; transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }); setNewContent(false); }}>새 내용으로 이동</button>}<div className="compose"><span className="prompt">›</span><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void run(); } }} placeholder="Codex에게 작업 요청"/><div className="actions">{projection.working && <button className="secondary" onClick={interrupt} disabled={projection.interrupt === "requested"}>{projection.interrupt === "requested" ? "중단 요청 중" : "중단"}</button>}<button className="primary" onClick={run} disabled={!prompt.trim()}>보내기</button></div></div></div></div></section></main>
    <aside className="panel"><div className="phead"><span className="logo"/><span className="title">Codex</span><span className="pill">{threadId ?? "새 스레드"}</span></div><div className="ptabs"><button className={`ptab ${panel === "overview" ? "active" : ""}`} onClick={() => setPanel("overview")}>개요</button><button className={`ptab ${panel === "events" ? "active" : ""}`} onClick={() => setPanel("events")}>이벤트</button><span className="aside">{events.length}</span></div><div className="pbody">{panel === "overview" ? <><div className={`headline t-${approvals ? "blocked" : projection.working ? "working" : "idle"}`}><span className="glyph">{approvals ? "!" : projection.working ? "·" : "✓"}</span><div><div className="h">{approvals ? "검토 필요" : projection.working ? "작업 중" : "대기 중"}</div><div className="sub">관찰된 app-server 이벤트만 표시합니다.</div></div></div><div className="counts"><div className="count"><div className="n">{events.length}</div><div className="l">이벤트</div></div><div className="count blocked"><div className="n">{approvals}</div><div className="l">요청</div></div><div className="count"><div className="n">{projection.blocks.length}</div><div className="l">항목</div></div></div><div className="ledger"><div className="entry"><span className="prov">공개 설명</span><span>Native가 별도 설명을 제공하지 않음</span></div><div className="entry"><span className="prov">관측 결과</span><span>명령 {commands.length} · 파일 변경 {files.length} · 실패 {failedCommands}</span></div><div className="entry"><span className="prov">검증</span><span>Native의 완료 보고와 별개이며 이 화면에서 자동 통과 처리하지 않음</span></div><div className="entry"><span className="prov">미해결</span><span>{approvals ? `승인 ${approvals}건 대기` : failedCommands ? `실패 명령 ${failedCommands}건` : "관측된 차단 없음"}</span></div></div></> : <div className="ledger">{events.map((e) => <div className="entry" key={e.seq}><span className="seq">{e.seq}</span><span className="prov">{e.kind}</span><span>{e.method}</span></div>)}</div>}</div><div className="pfooter"><span className="src">로컬 Codex CLI · 자격 증명 미처리 · 승인 UI는 OS sandbox 보장이 아님</span></div></aside>
    <footer className="status"><span>{projection.working ? "● 실행 중" : "○ 준비"}</span><span>workspace-write · on-request</span><span className="grow"/><span className="err">{error}</span></footer>
  </>;
}
createRoot(document.getElementById("root")!).render(<App/>);
