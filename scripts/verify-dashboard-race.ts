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
await fs.writeFile(entry, `import React from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardView } from ${JSON.stringify(path.join(root, "src/dashboard-view.tsx"))};
(async () => {
  const selection = await window.www.workspace();
  const snapshot = await window.www.dashboard(selection);
  const project = snapshot.projects.find(item => item.project.path === ${JSON.stringify(workspace)});
  if (!project || project.cards.length !== 2) throw Error('실제 IPC fixture 카드가 두 개가 아닙니다.');
  const state = { pending: [], errors: [], calls: 0 };
  window.__raceProbe = state;
  const onLoadWork = async card => {
    state.calls++;
    try {
      const value = await window.www.dashboardWork(selection, card.projectKey, card.id);
      await new Promise(resolve => state.pending.push({ id: card.id, value, release: resolve }));
      return value;
    } catch (error) { state.errors.push(String(error)); throw error; }
  };
  const container = document.createElement('div');
  container.id = 'race-probe';
  Object.assign(container.style, { position: 'fixed', inset: '0', zIndex: '99999', background: '#111', overflow: 'auto' });
  document.body.appendChild(container);
  createRoot(container).render(React.createElement(DashboardView, { snapshot, loading: false, error: null, projectKey: project.project.key, onRefresh: () => {}, onLoadWork }));
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
  const capture = object(await command("Page.captureScreenshot", { format: "png" }));
  await fs.writeFile(path.join(evidence, "latest-b.png"), Buffer.from(String(capture.data), "base64"));
  await click(card(0));
  await wait("window.__raceProbe.pending.length===5", "닫기 전 실제 A 상세 IPC 도착");
  await click('#race-probe [aria-label="작업 상세 닫기"]');
  await evaluate("window.__raceProbe.pending[4].release()");
  await pause(150);
  if (!await evaluate("!document.querySelector('#race-probe .dashboard-detail') && window.__raceProbe.calls===5 && window.__raceProbe.errors.length===0")) throw Error("닫힌 상세가 늦은 응답으로 복원됐습니다.");
  checks.push("닫기 뒤 지연 응답이 상세를 복원하지 않음");
  const summary = { result: "passed", evidence, checks, coverage: "실제 Electron·React DashboardView·preload IPC와 실제 backend 응답. 별도 mount에서 응답 전달 순서만 주입했으며 앱 전체 연결 또는 자연 발생 경합의 증거는 아니다." };
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
