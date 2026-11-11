import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { project, type Block } from "./projection";
import type { AppEvent, WorkspaceInfo, WwwApi } from "./shared";
declare global { interface Window { www: WwwApi } }

function BlockView({ block, decide }: { block: Block; decide(id: string | number, decision: string): void }) {
  if (block.kind === "answer") return <div className={`agent ${block.streaming ? "streaming" : ""}`}>{block.text}</div>;
  if (block.kind === "command") return <details className={`cmd ${block.exitCode && block.exitCode !== 0 ? "failed" : ""}`} open><summary><span className="cmdline">{block.command}</span><span className="cmdstate">{block.running ? "실행 중" : `종료 ${block.exitCode ?? "?"}`}</span></summary>{block.output && <pre>{block.output}</pre>}</details>;
  if (block.kind === "files") return <div className="files">{block.paths.length ? block.paths.join(", ") : "파일 변경"} · {block.running ? "진행 중" : "완료"}</div>;
  return <div className={`approval ${block.open ? "open" : ""}`}><div className="ahead">{block.supported ? "승인 필요" : "지원하지 않는 요청"}</div><div className="abody">{block.summary}</div>{block.supported && <div className="aact"><button onClick={() => decide(block.requestId, "accept")}>허용</button><button onClick={() => decide(block.requestId, "acceptForSession")}>세션 허용</button><button onClick={() => decide(block.requestId, "decline")}>거절</button><button onClick={() => decide(block.requestId, "cancel")}>중단</button></div>}</div>;
}

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"overview" | "events">("overview");
  const projection = useMemo(() => project(events), [events]);
  useEffect(() => { void window.www.workspace().then(setWorkspace); void window.www.events().then(setEvents); return window.www.onEvent((event) => setEvents((old) => [...old, event])); }, []);
  const run = async () => { const text = prompt.trim(); if (!text) return; setError(""); setPrompt(""); try { let id = threadId; if (!id) { id = (await window.www.startThread()).threadId; setThreadId(id); } await window.www.startTurn(id, text); } catch (e) { setError(String(e)); } };
  const choose = async () => { try { const value = await window.www.chooseWorkspace(); if (value) setWorkspace(value); } catch (e) { setError(String(e)); } };
  const decide = async (id: string | number, decision: string) => { try { await window.www.respond(id, decision); } catch (e) { setError(String(e)); } };
  const interrupt = async () => { if (threadId && projection.turnId) try { await window.www.interrupt(threadId, projection.turnId); } catch (e) { setError(String(e)); } };
  const approvals = projection.blocks.filter((b) => b.kind === "approval").length;
  return <>
    <aside className="sidebar"><div className="brand">WWW</div><div className="sec">작업 공간 <button className="icon" onClick={choose} disabled={!!threadId}>＋</button></div><div><div className="srow active"><span className="avatar">W</span><span className="name">{workspace?.name ?? "선택 중"}</span><span className="right">{workspace?.branch ?? "git 아님"}</span></div></div><div className="agents"><div className="group">CODEX</div><div className="srow"><span className="agentmark"/><span>{projection.working ? "작업 중" : threadId ? "대기" : "연결 전"}</span></div></div><div className="footer"><span className="muted">{workspace?.path}</span><span>{workspace?.changes ?? 0} changes</span></div></aside>
    <main className="work"><div className="tabrow"><button className="tab active">대화</button><span className="spacer"/><button className="tool selected">Codex app-server</button></div><section className="stage"><div className="pane focused"><div className="title"><span className="name">Codex</span><span className="path">{workspace?.name}</span></div><div className="body conversation"><div className="transcript">{projection.blocks.length === 0 ? <div className="empty">작업 폴더를 확인하고 메시지를 입력하세요.</div> : projection.blocks.map((block, i) => <BlockView key={`${block.kind}-${i}`} block={block} decide={decide}/>)}</div><div className="compose"><span className="prompt">›</span><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void run(); } }} placeholder="Codex에게 작업 요청"/><div className="actions">{projection.working && <button className="secondary" onClick={interrupt}>중단</button>}<button className="primary" onClick={run} disabled={!prompt.trim()}>보내기</button></div></div></div></div></section></main>
    <aside className="panel"><div className="phead"><span className="logo"/><span className="title">Codex</span><span className="pill">{threadId ?? "새 스레드"}</span></div><div className="ptabs"><button className={`ptab ${panel === "overview" ? "active" : ""}`} onClick={() => setPanel("overview")}>개요</button><button className={`ptab ${panel === "events" ? "active" : ""}`} onClick={() => setPanel("events")}>이벤트</button><span className="aside">{events.length}</span></div><div className="pbody">{panel === "overview" ? <><div className={`headline t-${approvals ? "blocked" : projection.working ? "working" : "idle"}`}><span className="glyph">{approvals ? "!" : projection.working ? "·" : "✓"}</span><div><div className="h">{approvals ? "검토 필요" : projection.working ? "작업 중" : "대기 중"}</div><div className="sub">관찰된 app-server 이벤트만 표시합니다.</div></div></div><div className="counts"><div className="count"><div className="n">{events.length}</div><div className="l">이벤트</div></div><div className="count blocked"><div className="n">{approvals}</div><div className="l">요청</div></div><div className="count"><div className="n">{projection.blocks.length}</div><div className="l">항목</div></div></div></> : <div className="ledger">{events.map((e) => <div className="entry" key={e.seq}><span className="seq">{e.seq}</span><span className="prov">{e.kind}</span><span>{e.method}</span></div>)}</div>}</div><div className="pfooter"><span className="src">로컬 Codex CLI · 자격 증명 미처리</span></div></aside>
    <footer className="status"><span>{projection.working ? "● 실행 중" : "○ 준비"}</span><span>workspace-write · on-request</span><span className="grow"/><span className="err">{error}</span></footer>
  </>;
}
createRoot(document.getElementById("root")!).render(<App/>);
