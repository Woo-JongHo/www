#!/usr/bin/env node
// 실제 Electron과 IPC 응답을 사용하고 컴포넌트에 전달하는 순서만 제어한다.
import { execFileSync, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = await fs.mkdtemp(path.join(root, ".www/evidence/dashboard-race-"));
const workspace = path.join(evidence, "workspace");
const profile = path.join(evidence, "profile");
const ids = ["work-11111111-1111-4111-8111-111111111111", "work-22222222-2222-4222-8222-222222222222"];
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
await fs.mkdir(profile, { recursive: true });
for (const [index, id] of ids.entries()) {
  const folder = path.join(workspace, "docs/work/Fixture", String(index));
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, "work.json"), JSON.stringify({ schemaVersion: 1, id, title: `경합 ${index}`, status: "in_progress", blockedReason: null, areas: ["ui"], owner: "ui", criteria: [{ id: "AC-1", description: `기준 ${index}`, required: true, result: "unverified" }] }));
}
const entry = path.join(evidence, "race-entry.tsx");
const bundle = path.join(evidence, "race-bundle.js");
await fs.writeFile(entry, `import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardView } from ${JSON.stringify(path.join(root, "src/dashboard-view.tsx"))};
(async () => {
  const selection = await window.www.workspace();
  const snapshot = await window.www.dashboard(selection);
  const project = snapshot.projects.find(item => item.project.path === ${JSON.stringify(workspace)});
  if (!project || project.cards.length !== 2) throw Error('실제 IPC fixture 카드가 두 개가 아닙니다.');
  const state = { pending: [], errors: [], calls: 0, failNext: false, initialSnapshot: snapshot };
  window.__raceProbe = state;
  const onLoadWork = async card => {
    state.calls++;
    if (state.failNext) { state.failNext=false; throw Error("상세 갱신 실패 fixture"); }
    try {
      const value = await window.www.dashboardWork(selection, card.projectKey, card.id);
      await new Promise(resolve => state.pending.push({ id: card.id, value, release: resolve }));
      return ${process.argv.includes("--retention") ? "value" : "{ ...value, sourcePath: 'docs/work/Latest/work.json', owner: 'ops', areas: ['dev'] }"};
    } catch (error) { state.errors.push(String(error)); throw error; }
  };
  const container = document.createElement('div');
  container.id = 'race-probe';
  Object.assign(container.style, { position: 'fixed', inset: '0', zIndex: '99999', background: '#111', overflow: 'auto' });
  document.body.appendChild(container);
  function Probe() { const [current,setCurrent]=useState(snapshot); state.setSnapshot=setCurrent; return React.createElement(DashboardView, { snapshot:current, loading:false,error:null,projectKey:project.project.key,onRefresh:()=>{},onLoadWork }); }
  createRoot(container).render(React.createElement(Probe));
})().catch(error => { window.__raceError = String(error); });`);
const buildOutput = execFileSync("bun", ["build", entry, "--target", "browser", "--format", "iife", "--outfile", bundle], { cwd: root, encoding: "utf8" });
await fs.writeFile(path.join(evidence, "bundle.log"), buildOutput);
const server = createServer();
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw Error("CDP 포트가 없습니다.");
const port = address.port;
await new Promise<void>(resolve => server.close(() => resolve()));
const stdout = await fs.open(path.join(evidence, "electron.stdout"), "w");
const stderr = await fs.open(path.join(evidence, "electron.stderr"), "w");
const env: NodeJS.ProcessEnv = { ...process.env, WWW_PROBE_PATH: path.join(evidence, "disabled.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: workspace, WWW_PROBE_NATIVE_REPORTS: "0", WWW_CODEX_BIN: path.join(root, "test/fixtures/sessions-app-server.ts"), WWW_SESSION_FIXTURE_DIR: evidence };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"), [root, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`], { cwd: root, env, stdio: ["ignore", stdout.fd, stderr.fd] });
let socket: WebSocket | null = null;
const checks: string[] = [];
try {
  let endpoint = "";
  for (let i = 0; i < 400 && !endpoint; i++) {
    if (child.exitCode !== null) throw Error(`Electron 조기 종료: ${child.exitCode}`);
    try { const targets: unknown = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (Array.isArray(targets)) endpoint = String(object(targets.find(item => object(item).type === "page")).webSocketDebuggerUrl ?? ""); } catch { /* 시작 대기 */ }
    if (!endpoint) await pause(50);
  }
  if (!endpoint) throw Error("CDP 연결 실패");
  socket = new WebSocket(endpoint);
  await new Promise<void>((resolve, reject) => { socket!.addEventListener("open", () => resolve(), { once: true }); socket!.addEventListener("error", () => reject(Error("CDP 오류")), { once: true }); });
  let nextId = 0;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  socket.addEventListener("message", event => { const message = object(JSON.parse(String(event.data))); if (typeof message.id !== "number") return; const waiter = pending.get(message.id); if (!waiter) return; pending.delete(message.id); clearTimeout(waiter.timer); if (message.error) waiter.reject(Error(JSON.stringify(message.error))); else waiter.resolve(message.result); });
  const command = (method: string, params: Record<string, unknown> = {}) => new Promise<unknown>((resolve, reject) => { const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP 시간 초과: ${method}`)); }, 12000); pending.set(id, { resolve, reject, timer }); socket!.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression: string) => { const response = object(await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true })); if (response.exceptionDetails) throw Error(JSON.stringify(response.exceptionDetails)); return object(response.result).value; };
  const wait = async (expression: string, label: string) => { for (let i = 0; i < 400; i++) { if (await evaluate(expression)) { checks.push(label); return; } const error = await evaluate("window.__raceError || window.__raceProbe?.errors?.[0]"); if (error) throw Error(String(error)); await pause(50); } throw Error(`검증 시간 초과: ${label}`); };
  const click = async (selector: string) => {
    const point = object(await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!(e instanceof HTMLElement))throw Error('대상 없음');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('대상 비가시');return {x:r.x+r.width/2,y:r.y+r.height/2}})()`));
    await command("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1 });
    await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount: 1 });
  };
  await wait("Boolean(window.www && document.querySelector('[data-testid=view-page]'))", "실제 Electron 및 preload 준비");
  await evaluate(await fs.readFile(bundle, "utf8"));
  await wait("document.querySelectorAll('#race-probe .dashboard-card').length===2", "실제 목록 IPC를 사용한 컴포넌트 mount");
  const card = (index: number) => `#race-probe [data-work-id="${ids[index]}"]`;
  for (const [position, index] of [0, 1, 0, 1].entries()) {
    await click(card(index));
    await wait(`window.__raceProbe?.pending.length===${position + 1} && window.__raceProbe.pending[${position}].id===${JSON.stringify(ids[index])}`, `실제 상세 IPC ${position + 1} 도착`);
  }
  await evaluate("window.__raceProbe.pending[3].release()");
  await wait("document.querySelector('#race-probe .dashboard-criteria')?.textContent.includes('기준 1')", "최신 B 응답 표시");
  for (const index of [2, 1, 0]) {
    await evaluate(`window.__raceProbe.pending[${index}].release()`);
    await pause(150);
    if (!await evaluate("document.querySelector('#race-probe .dashboard-detail h3')?.textContent==='경합 1' && document.querySelector('#race-probe .dashboard-criteria')?.textContent.includes('기준 1') && !document.querySelector('#race-probe .dashboard-criteria')?.textContent.includes('기준 0')")) throw Error(`이전 응답 ${index}가 최신 B를 덮었습니다.`);
    checks.push(`이전 응답 ${index} 해제 후 B 유지`);
  }
  if (!process.argv.includes("--retention")) {
    if (!await evaluate("(()=>{const e=document.querySelector('#race-probe .dashboard-detail');return e?.textContent.includes('docs/work/Latest/work.json') && e?.textContent.includes('ops') && e?.textContent.includes('dev') && !e?.textContent.includes('docs/work/Fixture/1/work.json')})()")) throw Error("상세 응답의 경로·담당·영역 요약 불일치");
    checks.push("같은 최신 상세 응답의 경로·담당·영역 표시");
  }
  const capture = object(await command("Page.captureScreenshot", { format: "png" }));
  await fs.writeFile(path.join(evidence, "latest-b.png"), Buffer.from(String(capture.data), "base64"));
  await click(card(0));
  await wait("window.__raceProbe.pending.length===5", "닫기 전 실제 A 상세 IPC 도착");
  await click('#race-probe [aria-label="작업 상세 닫기"]');
  await evaluate("window.__raceProbe.pending[4].release()");
  await pause(150);
  if (!await evaluate("!document.querySelector('#race-probe .dashboard-detail') && window.__raceProbe.calls===5 && window.__raceProbe.errors.length===0")) throw Error("닫힌 상세가 늦은 응답으로 복원됐습니다.");
  checks.push("닫기 뒤 지연 응답이 상세를 복원하지 않음");
  await click(card(1));
  await wait("window.__raceProbe.pending.length===6", "보존 검사 B 상세 도착");
  await evaluate("window.__raceProbe.pending[5].release()");
  await wait("document.querySelector('#race-probe .dashboard-criteria')?.textContent.includes('기준 1')", "보존 검사 정상 B 표시");
  await evaluate("window.__raceProbe.setSnapshot(current=>({...current,projects:current.projects.map(item=>({...item,coverage:'partial',cards:[]}))}))");
  await pause(200);
  if (!await evaluate("document.querySelector('#race-probe .dashboard-criteria')?.textContent.includes('기준 1')")) throw Error("부분 수집에서 정상 상세 소실");
  checks.push("부분 수집의 카드 부재에도 정상 상세 유지");
  await wait("window.__raceProbe.pending.length===7", "부분 수집 갱신 실제 상세 IPC");
  await evaluate("(()=>{const value=window.__raceProbe.pending[6].value;value.title='부분 갱신 응답 표식 7';value.criteria[0].description='부분 갱신 고유 기준 표식 7';})()");
  if (!await evaluate("document.querySelector('#race-probe .dashboard-criteria')?.textContent.includes('기준 1') && !document.querySelector('#race-probe .dashboard-detail')?.textContent.includes('부분 갱신 고유 기준 표식 7') && document.querySelector('#race-probe .dashboard-detail-captured')?.textContent.includes('갱신 중')")) throw Error("새 갱신 해제 전의 이전 상세·갱신 중 전제 불일치");
  checks.push("갱신 응답 해제 전에는 고유 표식이 없고 이전 상세와 갱신 중 표시가 있음");
  await evaluate("window.__raceProbe.pending[6].release()");
  await wait("document.querySelector('#race-probe .dashboard-detail h3')?.textContent==='부분 갱신 응답 표식 7' && document.querySelector('#race-probe .dashboard-criteria')?.textContent.includes('부분 갱신 고유 기준 표식 7') && !document.querySelector('#race-probe .dashboard-detail-captured')?.textContent.includes('갱신 중')", "부분 수집 갱신 응답의 새 제목·고유 기준 적용 및 갱신 중 해제");
  await evaluate("window.__raceProbe.failNext=true;window.__raceProbe.setSnapshot(current=>({...current}))");
  await wait("document.querySelector('#race-probe [role=alert]')?.textContent.includes('상세 갱신 실패 fixture')", "상세 갱신 실패 명시");
  if (!await evaluate("document.querySelector('#race-probe .dashboard-criteria')?.textContent.includes('부분 갱신 고유 기준 표식 7')")) throw Error("실패 갱신이 최신 정상 상세를 소실시킴");
  checks.push("실패 갱신에서도 같은 선택의 정상 상세 유지");
  await evaluate("window.__raceProbe.setSnapshot(current=>({...current,projects:current.projects.map(item=>({...item,coverage:'complete',cards:[]}))}))");
  await wait("!document.querySelector('#race-probe .dashboard-detail')", "완전 수집의 작업 부재는 상세 보존과 구분");
  await evaluate("window.__raceProbe.setSnapshot(current=>({...current,projects:current.projects.map(item=>({...item,coverage:'partial'}))}))");
  await pause(200);
  if (!await evaluate("!document.querySelector('#race-probe .dashboard-detail')")) throw Error("완전 수집의 부재가 다음 부분 수집에서 복원됨");
  checks.push("완전 수집에서 사라진 선택을 다음 부분 수집이 복원하지 않음");
  await evaluate("window.__raceProbe.setSnapshot(window.__raceProbe.initialSnapshot)");
  await wait("document.querySelectorAll('#race-probe .dashboard-card').length===2", "다른 선택 실패 검사 카드 복원");
  await click(card(1));
  await wait("window.__raceProbe.pending.length===8", "다른 선택 실패 직전 실제 정상 B 상세 IPC 도착");
  await evaluate("(()=>{const value=window.__raceProbe.pending[7].value;value.title='직전 정상 B 제목 표식 8';value.criteria[0].description='직전 정상 B 기준 표식 8';value.documents[0].status='available';value.documents[0].content='직전 정상 B 문서 표식 8';window.__raceProbe.pending[7].release();})()");
  await wait("document.querySelector('#race-probe .dashboard-detail h3')?.textContent==='직전 정상 B 제목 표식 8' && document.querySelector('#race-probe .dashboard-criteria')?.textContent.includes('직전 정상 B 기준 표식 8') && document.querySelector('#race-probe .dashboard-detail-content')?.textContent.includes('직전 정상 B 문서 표식 8')", "A 실패 검사 직전 정상 B 제목·기준·문서가 실제 표시됨");
  await evaluate("window.__raceProbe.failNext=true");
  await click(card(0));
  await wait("document.querySelector('#race-probe [role=alert]')?.textContent.includes('상세 갱신 실패 fixture')", "정상 B에서 A 선택 후 A 실패 표시");
  if (!await evaluate("document.querySelector('#race-probe .dashboard-detail h3')?.textContent==='경합 0' && !document.querySelector('#race-probe .dashboard-detail-content') && !document.querySelector('#race-probe .dashboard-detail')?.textContent.includes('직전 정상 B 제목 표식 8') && !document.querySelector('#race-probe .dashboard-detail')?.textContent.includes('직전 정상 B 기준 표식 8') && !document.querySelector('#race-probe .dashboard-detail')?.textContent.includes('직전 정상 B 문서 표식 8')")) throw Error("정상 B 직후 A 실패에 이전 B 제목·기준·문서가 표시됨");
  checks.push("정상 B 직후 A 실패에는 이전 B 제목·기준·문서를 표시하지 않음");
  const summary = { result: "passed", evidence, checks, coverage: "실제 Electron·React DashboardView·preload IPC와 정상 backend 조회 응답을 사용한다. 별도 mount에서 snapshot·응답 전달 순서를 제어하고, 상세 응답의 요약 필드·검증 표식을 합성 변경하며 renderer API 실패를 주입했다. 실제 backend 오류·앱 전체 연결·자연 발생 경합·실제 Native 모델/환경의 검증 증거는 아니다." };
  await fs.writeFile(path.join(evidence, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} catch (error) {
  await fs.writeFile(path.join(evidence, "failure.txt"), `${String(error)}\n${JSON.stringify(checks, null, 2)}\n`);
  console.error(`실패 증거: ${evidence}`);
  throw error;
} finally {
  socket?.close();
  child.kill("SIGTERM");
  await Promise.race([new Promise<void>(resolve => child.once("close", () => resolve())), pause(3000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
  await stdout.close();
  await stderr.close();
}
