/** Chat/007 AC-05. 실제 Electron IPC와 공급자 오류를 반환하는 로컬 Native fixture의 전송 경계를 확인한다. */
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { once } from "node:events";

const root = process.cwd();
// 실물 시험본의 원문과 현재 소스에서 재현하는 CDP 입력 순서를 별도 근거로 보존한다.
const physicalPath = "docs/work/Chat/007-실시간 세션 모니터와 채팅 가독성/evidence/macos-physical-enter.json";
const physical = JSON.parse(await fs.readFile(path.join(root, physicalPath), "utf8")).afterFirstFix;
interface PhysicalEvent { type: string; trusted: boolean | null; enter: boolean; shift: boolean; requests: number; expectedValue: string }
const events: PhysicalEvent[] = physical.events;
if (physical.turnStartCount !== 1 || physical.submittedTextMatchesGa !== true
  || !events.some(e => e.type === "keydown" && e.trusted && e.enter && !e.shift && e.expectedValue === "가")
  || !events.some(e => e.type === "enter-settled" && e.requests === 1 && e.expectedValue === "빈 값")) throw Error("과거 macOS 실물 증거 불충분");
execFileSync("bun", ["run", "build.ts"], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
const currentIme = JSON.parse(execFileSync("node", ["scripts/verify-chat.ts", "--ime-enter-only"], { cwd: root, encoding: "utf8", timeout: 120000 }));
if (currentIme.result !== "passed" || currentIme.scope !== "ime-enter-only") throw Error("현재 Electron 한글 이벤트 순서 회귀 실패");
const directory = await fs.mkdtemp(path.join(root, ".www/evidence/ime-failure-"));
const profile = path.join(directory, "profile");
const workspace = path.join(directory, "workspace");
await fs.mkdir(workspace);
const executable: string = createRequire(import.meta.url)("electron");
const env: NodeJS.ProcessEnv = { ...process.env, WWW_PROBE_PATH: path.join(directory, "disabled.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: workspace,
  WWW_CODEX_BIN: path.join(root, "test/fixtures/chat-ui-app-server.ts"), WWW_PROBE_NATIVE_REPORTS: "0" };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, [root, "--remote-debugging-port=0", "--user-data-dir=" + profile], { env, cwd: root, stdio: "ignore" });
const closed = once(child, "close");
let socket: WebSocket | undefined;

async function until<T>(sample: () => Promise<T | undefined>, label: string): Promise<T> {
  const deadline = Date.now() + 20000;
  do {
    if (child.exitCode !== null || child.signalCode) throw Error("Electron 종료: " + label);
    const observed = await sample();
    if (observed !== undefined) return observed;
    await pause(50);
  } while (Date.now() < deadline);
  throw Error("관찰 시간 초과: " + label);
}

try {
  const endpoint = await until(async () => {
    const port = (await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8").catch(() => "")).split("\n")[0];
    if (!/^\d+$/.test(port)) return;
    const targets = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json() as { type: string; webSocketDebuggerUrl: string }[];
    return targets.find(t => t.type === "page")?.webSocketDebuggerUrl;
  }, "CDP 준비");
  const connection = new WebSocket(endpoint);
  socket = connection;
  await Promise.race([once(connection, "open"), closed.then(() => { throw Error("CDP 연결 전 종료"); })]);
  let id = 0;
  async function evaluate(expression: string) {
    const request = ++id;
    const response = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => { connection.removeEventListener("message", read); reject(Error("CDP 응답 시간 초과")); }, 5000);
      function read(event: MessageEvent) {
        const value = JSON.parse(String(event.data));
        if (value.id !== request) return;
        clearTimeout(timer);
        connection.removeEventListener("message", read);
        if (value.error || value.result?.exceptionDetails) reject(Error(JSON.stringify(value)));
        else resolve(value.result?.result?.value);
      }
      connection.addEventListener("message", read);
    });
    connection.send(JSON.stringify({ id: request, method: "Runtime.evaluate", params: { expression, returnByValue: true, userGesture: true } }));
    return response;
  }
  const wait = (expression: string, label: string) => until(async () => await evaluate(expression) ? true : undefined, label);
  async function click(selector: string) {
    const element = "document.querySelector(" + JSON.stringify(selector) + ")";
    await wait(element + " && !" + element + ".disabled", selector);
    await evaluate(element + ".click()");
  }
  await click('[data-testid="open-current-workspace"]');
  await click('[data-testid="chat-nav"]');
  const draft = "  한글 전송 실패 확인 각\n";
  const field = 'document.querySelector(\'[data-testid="prompt-input"]\')';
  await wait(field + " && !" + field + ".disabled", "입력 준비");
  await evaluate("(()=>{const e=" + field + ";Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e," + JSON.stringify(draft) + ");e.dispatchEvent(new Event('input',{bubbles:true}))})()");
  await wait('!document.querySelector(\'[data-testid="send-button"]\').disabled', "초안 수용");
  await evaluate("(()=>{const e=" + field + ";e.focus();for(const repeat of [false,true]) e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',repeat,bubbles:true,cancelable:true}));document.querySelector('[data-testid=send-button]').click();e.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}));})()");
  await wait(field + ".value===" + JSON.stringify(draft) + " && document.querySelector('.status')?.innerText.includes('합성 전송 실패')", "정확한 초안·오류 복원");
  async function starts() {
    const lines = (await fs.readFile(path.join(workspace, "fixture-calls.jsonl"), "utf8")).trim().split("\n");
    return lines.map(line => JSON.parse(line)).filter(call => call.method === "turn/start").map(call => call.params.input[0].text);
  }
  const first = await starts();
  await pause(500);
  const settled = await starts();
  if (JSON.stringify(first) !== JSON.stringify([draft.trim()]) || JSON.stringify(settled) !== JSON.stringify(first)) throw Error("연속 입력 또는 실패 뒤 중복 전송: " + JSON.stringify(settled));
  const summary = { physicalCandidate: physical.candidate, currentImeChecks: currentIme.checks, platform: process.platform, draft, submitted: first, afterFailure: settled, draftAfterFailure: await evaluate(field + ".value"), settleMs: 500 };
  await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, directory }));
} finally {
  socket?.close();
  child.kill();
  await Promise.race([closed, pause(2000)]);
  if (child.exitCode === null && !child.signalCode) child.kill("SIGKILL");
}
