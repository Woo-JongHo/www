import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeArchitecture } from "./generate-architecture.ts";

type Data = Record<string, unknown>;
function isObject(value: unknown): value is Data { return value !== null && typeof value === "object" && !Array.isArray(value); }
function object(value: unknown): Data { return isObject(value) ? value : {}; }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = await fs.mkdtemp(path.join(root, ".www/evidence/architecture-"));
const checks: string[] = [];
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
let child: ChildProcess | null = null;
let socket: WebSocket | null = null;

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("검사용 포트가 없습니다.");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

try {
  const snapshot = writeArchitecture(root, true);
  checks.push(`현재 소스 snapshot 일치: ${snapshot.digest}`);
  const port = await freePort();
  const env = { ...process.env };
  for (const key of ["ELECTRON_RUN_AS_NODE", "WWW_PROBE_ACTIVITY", "WWW_PROBE_REPORTS", "WWW_PROBE_NATIVE_REPORTS", "WWW_PROBE_DEVELOPMENT_WORK_ID"]) delete env[key];
  const binary = process.platform === "darwin" ? path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron") : path.join(root, "node_modules/electron/dist", process.platform === "win32" ? "electron.exe" : "electron");
  const output = await fs.open(path.join(directory, "electron.log"), "w");
  try {
    child = spawn(binary, [root, `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(directory, "profile")}`], {
      cwd: root, stdio: ["ignore", output.fd, output.fd],
      env: { ...env, WWW_PROBE_PATH: path.join(directory, "disabled-probe.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: root, WWW_CODEX_BIN: path.join(root, "test/fixtures/fake-app-server.ts") },
    });
    let spawnError: Error | null = null;
    child.once("error", (error) => { spawnError = error; });
    const deadline = Date.now() + 25_000;
    let endpoint = "";
    while (!endpoint && Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw Error(`Electron 조기 종료: ${child.exitCode}`);
      try {
        const targets: unknown = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        if (Array.isArray(targets)) {
          const target = targets.map(object).find((item) => item.type === "page");
          if (target && typeof target.webSocketDebuggerUrl === "string") endpoint = target.webSocketDebuggerUrl;
        }
      } catch {}
      if (!endpoint) await pause(60);
    }
    if (!endpoint) throw Error("Electron debugger 연결 시간 초과");
    const ws = new WebSocket(endpoint);
    socket = ws;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("debugger WebSocket 연결 시간 초과")), 12_000);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener("error", () => { clearTimeout(timer); reject(Error("debugger WebSocket 오류")); }, { once: true });
    });
    let nextId = 0;
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
    ws.addEventListener("message", (event) => {
      const message = object(JSON.parse(String(event.data)));
      if (typeof message.id !== "number") return;
      const waiting = pending.get(message.id);
      if (!waiting) return;
      pending.delete(message.id);
      clearTimeout(waiting.timer);
      if (message.error) waiting.reject(Error(JSON.stringify(message.error)));
      else waiting.resolve(message.result);
    });
    const command = (method: string, params: Data = {}): Promise<unknown> => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP 시간 초과: ${method}`)); }, 12_000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression: string): Promise<unknown> => {
      const result = object(await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }));
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return object(result.result).value;
    };
    const assert = async (expression: string, label: string) => {
      const until = Date.now() + 10_000;
      while (Date.now() < until) {
        if (await evaluate(`Boolean(${expression})`)) { checks.push(label); return; }
        await pause(40);
      }
      throw Error(`화면 조건 실패: ${label}`);
    };
    const click = async (selector: string) => {
      await evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(!(node instanceof HTMLElement)) throw Error('클릭 대상 없음'); node.click(); })()`);
      await pause(80);
    };
    const search = async (value: string) => {
      await evaluate(`(() => { const input=document.querySelector('.blueprint-work input'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      await pause(80);
    };
    const key = async (value: string, code = value) => {
      await command("Input.dispatchKeyEvent", { type: "keyDown", key: value, code });
      await command("Input.dispatchKeyEvent", { type: "keyUp", key: value, code });
      await pause(50);
    };
    const capture = async (name: string) => {
      const result = object(await command("Page.captureScreenshot", { format: "png" }));
      if (typeof result.data !== "string") throw Error("화면 캡처 데이터가 없습니다.");
      await fs.writeFile(path.join(directory, `${name}.png`), Buffer.from(result.data, "base64"));
    };
    await assert("document.querySelector('[data-testid=ecosystem-nav]')", "앱 준비");
    await click('[data-testid="ecosystem-nav"]');
    await assert("document.querySelectorAll('.blueprint-node').length===6 && document.querySelector('.blueprint-detail h2').textContent==='화면과 상호작용'", "기본 계층 개요와 계층 책임");
    await assert(`document.querySelector('.blueprint-summary code').title===${JSON.stringify(snapshot.digest)}`, "실제 Electron 번들이 현재 snapshot을 수용");
    await capture("overview-desktop");
    await evaluate("document.querySelector('.blueprint-node').focus()");
    await key("ArrowDown");
    await key(" ", "Space");
    await assert("document.querySelector('.blueprint-detail h2').textContent==='상태와 투영'", "실제 키보드 방향키와 Space 계층 선택");
    await search("RENDERER.TSX");
    await assert("document.querySelector('.ecosystem-results button').textContent==='renderer'", "대소문자 무관 파일 검색");
    await click(".ecosystem-results button");
    await assert("document.querySelector('.blueprint-detail h2').textContent==='renderer' && document.querySelectorAll('.blueprint-edge.is-connected').length>0 && document.querySelectorAll('.blueprint-edge.is-type').length>0", "모듈 선택과 관련 참조·타입 전용 표시");
    await click(".ecosystem-clear");
    await evaluate("document.querySelector('.blueprint-connection details').open=true");
    await assert("document.querySelector('.blueprint-connection pre').textContent.includes('import') && document.querySelector('.blueprint-connection code').textContent.includes('.tsx:')", "import 원문과 출처 파일·행");
    const zoomBefore = Number(await evaluate("document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%','')"));
    await click('[aria-label="설계도 확대"]');
    await assert(`Number(document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%',''))>${zoomBefore}`, "확대");
    await click('[aria-label="설계도 축소"]');
    await assert(`Number(document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%',''))===${zoomBefore}`, "축소");
    await click('[data-testid="architecture-fit"]');
    await assert("document.querySelector('.blueprint-svg').getBoundingClientRect().width<=document.querySelector('.blueprint-viewport').clientWidth && document.querySelector('.blueprint-svg').getBoundingClientRect().height<=document.querySelector('.blueprint-viewport').clientHeight", "전체 보기 크기 맞춤");
    await click('[data-layer="contract"]');
    await assert("document.querySelectorAll('.blueprint-node').length===2", "계층 필터");
    await search("존재하지않는모듈");
    await assert("document.querySelector('.ecosystem-results').textContent.includes('일치하는 모듈이 없습니다')", "검색 빈 결과와 초기화");
    await click(".ecosystem-clear");
    await search("renderer.tsx");
    await click(".ecosystem-results button");
    await click(".ecosystem-clear");
    await evaluate("document.querySelector('[data-node-id=\"src/renderer.tsx\"]').focus()");
    await key("Enter");
    await assert("document.activeElement.getAttribute('aria-pressed')==='true'", "실제 키보드 Enter 모듈 선택");
    await key("Tab");
    await assert("document.activeElement.matches('.blueprint-node') && document.activeElement.getAttribute('data-node-id')!=='src/renderer.tsx'", "실제 Tab 모듈 탐색");
    await assert("[...document.querySelectorAll('.blueprint-node')].every(n=>{const r=n.querySelector('rect');return [...n.querySelectorAll('text')].every(t=>t.getBBox().x+t.getBBox().width<=Number(r.getAttribute('width'))-8)})", "모듈 레이블이 노드 폭 안에 표시");
    for (let step = 0; step < 4; step++) await click('[aria-label="설계도 확대"]');
    await evaluate("(() => {const view=document.querySelector('.blueprint-viewport'); view.scrollLeft=0; view.scrollTop=0;})()");
    const point = object(await evaluate("(() => {const r=document.querySelector('.blueprint-viewport').getBoundingClientRect();return {x:r.left+8,y:r.top+r.height/2};})()"));
    if (typeof point.x !== "number" || typeof point.y !== "number") throw Error("드래그 좌표가 없습니다.");
    await command("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1 });
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x - 70, y: point.y - 70, button: "left", buttons: 1 });
    await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x - 70, y: point.y - 70, button: "left", buttons: 0, clickCount: 1 });
    await assert("document.querySelector('.blueprint-viewport').scrollLeft>0 && document.querySelector('.blueprint-viewport').scrollTop>0", "실제 포인터 배경 드래그 이동");
    await evaluate("document.querySelector('[data-node-id=\"src/renderer.tsx\"]').focus()");
    await capture("module-desktop");
    await command("Emulation.setDeviceMetricsOverride", { width: 760, height: 560, deviceScaleFactor: 1, mobile: false });
    await pause(150);
    await assert("document.documentElement.scrollWidth<=innerWidth && document.querySelector('.ecosystem-page').scrollHeight>document.querySelector('.ecosystem-page').clientHeight", "좁은 화면 수평 넘침 없음·상세까지 세로 스크롤");
    await capture("module-narrow");
    await evaluate("document.querySelector('.ecosystem-page').scrollTop=100000");
    await assert("document.querySelector('.blueprint-detail').getBoundingClientRect().top<innerHeight", "좁은 화면에서 근거 패널 접근");
    await capture("detail-narrow");
    await click('[data-testid="ecosystem-guide-tab"]');
    await assert("document.querySelector('.eco-node') && !document.querySelector('.blueprint-node')", "수동 생태계 안내 분리");
    const result = { result: "passed", checks, evidence: path.relative(root, directory), coverage: "실제 Electron DOM·CDP 입력·화면 캡처, Native는 합성 fixture" };
    await fs.writeFile(path.join(directory, "result.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally { await output.close(); }
} catch (error) {
  const result = { result: "failed", error: String(error), checks, evidence: path.relative(root, directory) };
  await fs.writeFile(path.join(directory, "result.json"), JSON.stringify(result, null, 2) + "\n");
  console.error(JSON.stringify(result));
  process.exitCode = 1;
} finally {
  socket?.close();
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([new Promise<void>((resolve) => child!.once("close", () => resolve())), pause(3000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}
