#!/usr/bin/env node
// 실제 Electron 화면·CDP 입력·IPC를 검증한다. Native는 기존 합성 fixture다.
import { execFileSync, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Data = Record<string, unknown>;
const object = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function run(mode: "empty" | "multiple") {
const evidence = await fs.mkdtemp(path.join(root, `.www/evidence/home-${mode}-`));
const workspace = path.join(evidence, "rpa-a");
const workspaceB = path.join(evidence, "rpa-b");
const profile = path.join(evidence, "profile");
await fs.mkdir(profile);
if (mode === "multiple") {
  for (const [directory, title, id] of [[workspace, "RPA A 고유 카드", "work-11111111-1111-4111-8111-111111111111"], [workspaceB, "RPA B 고유 카드", "work-22222222-2222-4222-8222-222222222222"]]) {
    const work = path.join(directory!, "docs/work/Fixture/001-board");
    await fs.mkdir(work, { recursive: true });
    await fs.writeFile(path.join(work, "work.json"), JSON.stringify({ schemaVersion: 1, id, title, status: "in_progress", blockedReason: null, areas: ["ui"], owner: "ui", criteria: [{ id: "AC-1", required: true, result: "unverified" }] }));
  }
  const modulePath = "../src/projects.ts";
  const { createProjectRegistry } = await import(modulePath);
  const registry = createProjectRegistry({ userData: profile });
  await registry.register(workspace);
  await registry.register(workspaceB);
}
const checks: string[] = [];
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const server = createServer();
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw Error("CDP 포트가 없습니다.");
const port = address.port;
await new Promise<void>(resolve => server.close(() => resolve()));
const stdout = await fs.open(path.join(evidence, "electron.stdout"), "w");
const stderr = await fs.open(path.join(evidence, "electron.stderr"), "w");
const env: NodeJS.ProcessEnv = { ...process.env, WWW_PROBE_PATH: path.join(evidence, "disabled.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: mode === "empty" ? root : workspace, WWW_CODEX_BIN: path.join(root, "test/fixtures/sessions-app-server.ts"), WWW_PROBE_NATIVE_REPORTS: "0", WWW_SESSION_FIXTURE_DIR: evidence };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"), [root, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`], { cwd: root, env, stdio: ["ignore", stdout.fd, stderr.fd] });
let socket: WebSocket | null = null;
let evaluate: ((expression: string) => Promise<unknown>) | null = null;
let failure: unknown = null;
try {
  let endpoint = "";
  for (let i = 0; i < 400 && !endpoint; i++) {
    if (child.exitCode !== null) throw Error(`Electron 조기 종료: ${child.exitCode}`);
    try { const targets: unknown = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (Array.isArray(targets)) endpoint = String(object(targets.find(value => object(value).type === "page")).webSocketDebuggerUrl ?? ""); } catch {}
    if (!endpoint) await pause(50);
  }
  if (!endpoint) throw Error("Electron CDP 연결 실패");
  socket = new WebSocket(endpoint);
  await new Promise<void>((resolve, reject) => { socket!.addEventListener("open", () => resolve(), { once: true }); socket!.addEventListener("error", () => reject(Error("CDP WebSocket 오류")), { once: true }); });
  let nextId = 0;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  socket.addEventListener("message", event => { const message = object(JSON.parse(String(event.data))); if (typeof message.id !== "number") return; const waiter = pending.get(message.id); if (!waiter) return; pending.delete(message.id); clearTimeout(waiter.timer); if (message.error) waiter.reject(Error(JSON.stringify(message.error))); else waiter.resolve(message.result); });
  const command = (method: string, params: Data = {}): Promise<unknown> => new Promise((resolve, reject) => { const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(Error("CDP 시간 초과: " + method)); }, 12_000); pending.set(id, { resolve, reject, timer }); socket!.send(JSON.stringify({ id, method, params })); });
  evaluate = async (expression: string) => { const result = object(await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true })); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return object(result.result).value; };
  const evalPage = evaluate;
  const wait = async (expression: string, label: string) => { for (let i = 0; i < 400; i++) { if (await evalPage(`(async()=>Boolean(await (${expression})))()`)) { checks.push(label); return; } await pause(50); } throw Error(`${label}: ${String(await evalPage("document.body.innerText"))}`); };
  const click = async (selector: string) => {
    const point = object(await evalPage(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!(n instanceof HTMLElement)||n.closest('[hidden]')||('disabled' in n&&n.disabled))throw Error('클릭 불가: '+${JSON.stringify(selector)});n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();if(!r.width||!r.height)throw Error('대상 비가시');return {x:r.left+r.width/2,y:r.top+r.height/2}})()`));
    await command("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1 });
    await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount: 1 });
  };
  const screenshot = async (name: string) => { const result = object(await command("Page.captureScreenshot", { format: "png" })); await fs.writeFile(path.join(evidence, name + ".png"), Buffer.from(String(result.data), "base64")); };
  const visible = (selector: string) => `(()=>{const n=document.querySelector(${JSON.stringify(selector)});return n instanceof HTMLElement && !n.closest('[hidden]') && n.getBoundingClientRect().width>0 && n.getBoundingClientRect().height>0})()`;
  const target = async (label: string, expectedPath: string) => {
    await wait(`${visible('[data-testid="target-dashboard"]')} && document.querySelector('.target-sidebar .srow.active .name')?.textContent===${JSON.stringify(path.basename(expectedPath))} && window.www.workspace().then(w=>w.path===${JSON.stringify(expectedPath)})`, `${label} 대상 대시보드와 화면 프로젝트명·선택 경로`);
    await wait(`JSON.stringify(Array.from(document.querySelectorAll('.workspace-nav > button')).map(n=>n.dataset.testid))===${JSON.stringify(JSON.stringify(["dashboard-nav", "chat-nav", "ecosystem-nav", "reports-nav"]))}`, `${label} 네 공통 메뉴 순서`);
    for (const [name, selector, panel] of [
      ["대시보드", "dashboard-nav", '[data-testid="target-dashboard"]'],
      ["대화", "chat-nav", "main.work"],
      ["생태계", "ecosystem-nav", ".ecosystem-shell"],
      ["리포트", "reports-nav", "main.reports-work"],
    ]) {
      await click(`[data-testid="${selector}"]`);
      await wait(`${visible(panel!)} && document.querySelector('[data-testid="${selector}"]').getAttribute('aria-current')==='page' && window.www.workspace().then(w=>w.path===${JSON.stringify(expectedPath)})`, `${label} ${name} 실제 클릭·화면·선택 대상 유지`);
      await screenshot(`${label}-${selector}`);
    }
    await click('[data-testid="dashboard-nav"]');
    await wait(`${visible('[data-testid="target-dashboard"]')} && document.querySelector('[data-testid="dashboard-nav"]').getAttribute('aria-current')==='page'`, `${label} 대시보드 복귀`);
  };
  const noNative = async (label: string) => {
    await pause(200);
    const calls = await fs.readFile(path.join(evidence, "calls.jsonl"), "utf8").catch(error => { if (object(error).code === "ENOENT") return ""; throw error; });
    const rows = execFileSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" }).split("\n").flatMap(line => { const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/); return match ? [{ pid: Number(match[1]), parent: Number(match[2]), command: match[3]! }] : []; });
    const descendants = new Set<number>([child.pid!]);
    for (let changed = true; changed;) { changed = false; for (const row of rows) if (descendants.has(row.parent) && !descendants.has(row.pid)) { descendants.add(row.pid); changed = true; } }
    const fixtures = rows.filter(row => descendants.has(row.pid) && row.command.includes("sessions-app-server.ts"));
    if (calls.length || fixtures.length) throw Error(`${label}: Native가 시작됐습니다: ${JSON.stringify({ calls, fixtures })}`);
    checks.push(label + " 실제 자손 fixture 프로세스 0·fixture 호출 0");
  };
  await wait(`${visible('[data-testid="view-page"]')} && ${visible('[aria-label="RPA 프로젝트 추가"]')}`, "전체 보기와 RPA 추가 버튼 표시");
  await wait("document.querySelector('[aria-label=\"RPA 프로젝트 추가\"]')?.disabled===false", "RPA 추가 버튼 활성");
  if (mode === "empty") {
    await wait("document.querySelector('.home-project-list')?.textContent.includes('등록된 RPA 프로젝트가 없습니다.') && document.querySelectorAll('.home-project-row').length===0 && document.querySelector('[data-testid=\"open-current-workspace\"]')?.disabled===false", "RPA 0개 빈 문구·행 0·별도 WWW");
    await wait("document.querySelector('.dashboard-captured') && document.querySelectorAll('.dashboard-card').length>0", "RPA 0개 전체 WWW 보드 수집");
    await noNative("RPA 0개 전체 보드 조회");
    await screenshot("empty-view-page");
    await click('[data-testid="open-current-workspace"]');
    await wait(`${visible('[data-testid="target-dashboard"]')} && document.querySelector('.dashboard-captured')`, "RPA 0개 WWW 대상 보드 조회");
    await noNative("RPA 0개 WWW 보드 조회");
    await screenshot("empty-www-dashboard");
  } else {
    await wait("document.querySelectorAll('.home-project-row').length===2 && document.querySelector('[data-testid=\"open-current-workspace\"]')?.disabled===false && document.querySelector('.dashboard-captured')", "등록 RPA 두 개와 전체 보드 준비");
    const cards = `Array.from(document.querySelectorAll('.dashboard-card')).map(n=>({project:n.querySelector('.dashboard-card-project').textContent,title:n.querySelector('strong').textContent}))`;
    await wait(`(()=>{const x=${cards};return x.some(c=>c.project==='rpa-a'&&c.title==='RPA A 고유 카드')&&x.some(c=>c.project==='rpa-b'&&c.title==='RPA B 고유 카드')&&x.some(c=>c.project==='WWW')})()`, "전체 보드에 RPA A·B와 WWW 실제 카드");
    const globalCards = await evalPage(cards);
    if (!Array.isArray(globalCards)) throw Error("전체 카드 집합 없음");
    const group = (name: string) => globalCards.map(object).filter(card => card.project === name).map(card => String(card.title)).sort();
    const cardsA = group("rpa-a");
    const cardsB = group("rpa-b");
    const cardsWww = group("WWW");
    if (cardsA.length !== 1 || cardsB.length !== 1 || !cardsWww.length) throw Error("전체 보드 프로젝트별 fixture 집합 오류");
    await noNative("다중 RPA 전체 보드 조회");
    await screenshot("multiple-global-board");
    await click('[data-testid="open-current-workspace"]');
    await wait(`${visible('[data-testid="target-dashboard"]')} && JSON.stringify((${cards}).map(c=>c.title).sort())===${JSON.stringify(JSON.stringify(cardsA))}`, "RPA A 보드 카드 집합은 A만");
    await noNative("RPA A 대상 보드 조회");
    await screenshot("multiple-rpa-board");
    await click('[data-testid="view-page-nav"]');
    await wait(visible('[data-testid="view-page"]'), "보드 비교 중 전체 보기 복귀");
    await noNative("RPA 보드에서 전체 보기 복귀");
    await click('[data-testid="open-www"]');
    await wait(`${visible('[data-testid="target-dashboard"]')} && JSON.stringify((${cards}).map(c=>c.title).sort())===${JSON.stringify(JSON.stringify(cardsWww))}`, "WWW 대상 보드 카드 집합은 WWW만");
    await noNative("WWW 대상 보드 조회");
    await screenshot("multiple-www-board");
    await click('[data-testid="view-page-nav"]');
    await wait(visible('[data-testid="view-page"]'), "WWW 보드에서 전체 보기 복귀");
    await noNative("WWW 보드에서 전체 보기 복귀");
    await click(`button[title=${JSON.stringify(workspace)}]`);
    await target("RPA", workspace);
    await click('[data-testid="view-page-nav"]');
    await wait(visible('[data-testid="view-page"]'), "RPA에서 전체 보기 복귀");
    await click('[data-testid="open-www"]');
    await target("WWW", root);
    await click('[data-testid="view-page-nav"]');
    await wait(visible('[data-testid="view-page"]'), "WWW에서 전체 보기 복귀");
    await screenshot("view-page-return");
  }
  const summary = { result: "passed", evidence, checks, mode, coverage: "실제 Electron·CDP 포인터·preload IPC, 합성 Native fixture. RPA 0개는 내부 WWW workspace 선택 상태다. 폴더 선택 OS 대화상자 성공·취소·실패와 실제 모델·Windows는 이 검사 범위 밖." };
  await fs.writeFile(path.join(evidence, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} catch (error) {
  await fs.writeFile(path.join(evidence, "partial-checks.json"), JSON.stringify(checks, null, 2));
  if (evaluate) { try { await fs.writeFile(path.join(evidence, "failure-dom.txt"), String(await evaluate("document.body.innerText"))); } catch {} }
  await fs.writeFile(path.join(evidence, "failure.txt"), String(error));
  console.error(String(error) + "\n증거: " + evidence);
  failure = error;
} finally {
  socket?.close();
  child.kill("SIGTERM");
  await Promise.race([new Promise<void>(resolve => child.once("close", () => resolve())), pause(3000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
  await stdout.close();
  await stderr.close();
}

if (failure) throw failure;
}

await run("empty");
await run("multiple");
