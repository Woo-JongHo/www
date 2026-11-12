#!/usr/bin/env node
// 실제 Electron 화면·IPC·stdio와 디스크를 유지한 재시작을 검증한다. 모델은 합성 fixture다.
import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Data = Record<string, unknown>;
const object = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = await fs.mkdtemp(path.join(root, ".www/evidence/chat-ui-"));
const workspace = path.join(directory, "workspace");
await fs.mkdir(workspace);
const checks: string[] = [];
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("검사용 포트가 없습니다.");
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function start(round: number) {
  const port = await freePort();
  const stdout = await fs.open(path.join(directory, "electron-" + round + ".stdout"), "w");
  const stderr = await fs.open(path.join(directory, "electron-" + round + ".stderr"), "w");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const binary = path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
  const child: ChildProcess = spawn(binary, [root, "--remote-debugging-port=" + port, "--user-data-dir=" + path.join(directory, "profile")], {
    cwd: root, stdio: ["ignore", stdout.fd, stderr.fd],
    env: { ...env, WWW_PROBE_PATH: path.join(directory, "disabled-probe.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: workspace, WWW_CODEX_BIN: path.join(root, "test/fixtures/chat-ui-app-server.ts"), WWW_PROBE_NATIVE_REPORTS: "0" }
  });
  let ws: WebSocket | null = null;
  const terminate = async () => {
    ws?.close();
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([new Promise<void>((resolve) => child.once("close", () => resolve())), pause(3000)]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await stdout.close();
    await stderr.close();
  };
  try {
    const deadline = Date.now() + 25_000;
    let endpoint = "";
    while (!endpoint && Date.now() < deadline) {
      if (child.exitCode !== null) throw Error("Electron 조기 종료: " + child.exitCode);
      try {
        const value: unknown = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
        if (Array.isArray(value)) {
          const target = value.map(object).find((entry) => entry.type === "page");
          if (target && typeof target.webSocketDebuggerUrl === "string") endpoint = target.webSocketDebuggerUrl;
        }
      } catch {}
      if (!endpoint) await pause(60);
    }
    if (!endpoint) throw Error("Electron debugger 연결 제한 시간");
    const socket = new WebSocket(endpoint);
    ws = socket;
    await new Promise<void>((resolve, reject) => { socket.addEventListener("open", () => resolve(), { once: true }); socket.addEventListener("error", () => reject(Error("debugger WebSocket 오류")), { once: true }); });
    let nextId = 0;
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
    socket.addEventListener("message", (event) => {
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
      const timer = setTimeout(() => { pending.delete(id); reject(Error("CDP 제한 시간: " + method)); }, 12_000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression: string): Promise<unknown> => {
      const result = object(await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }));
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return object(result.result).value;
    };
    const wait = async (expression: string, label: string) => {
      const until = Date.now() + 12_000;
      while (Date.now() < until) {
        if (await evaluate("Boolean(" + expression + ")")) { checks.push(label); return; }
        await pause(40);
      }
      throw Error("화면 조건 실패: " + label + " / " + String(await evaluate("document.body.innerText")));
    };
    const click = async (selector: string) => {
      await evaluate("(() => { const node=document.querySelector(" + JSON.stringify(selector) + "); if(!(node instanceof HTMLElement))throw Error('요소 없음'); if(node instanceof HTMLButtonElement && node.disabled)throw Error('비활성 요소'); node.click(); })()");
    };
    const input = async (value: string) => {
      await evaluate("(() => { const node=document.querySelector('[data-testid=\"prompt-input\"]'); const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(node," + JSON.stringify(value) + "); node.dispatchEvent(new Event('input',{bubbles:true})); })()");
      await wait("document.querySelector('[data-testid=\"prompt-input\"]').value===" + JSON.stringify(value), "입력 반영");
    };
    const screenshot = async (name: string) => {
      const result = object(await command("Page.captureScreenshot", { format: "png" }));
      if (typeof result.data !== "string") throw Error("화면 캡처가 없습니다.");
      await fs.writeFile(path.join(directory, name + ".png"), Buffer.from(result.data, "base64"));
    };
    await command("Emulation.setFocusEmulationEnabled", { enabled: true });
    await wait("document.querySelector('[data-thread-id=\"history-a\"]')", "프로젝트 저장 대화 목록");
    return { command, evaluate, wait, click, input, screenshot, terminate };
  } catch (error) { await terminate(); throw error; }
}

let session: Awaited<ReturnType<typeof start>> | null = null;
try {
  session = await start(1);
  const a = '[data-thread-id="history-a"]';
  const b = '[data-thread-id="history-b"]';
  await session.click(a);
  await session.wait("document.querySelector('.chat-markdown h2')?.textContent==='저장된 답변'", "저장 대화 Markdown 복원");
  await session.wait("document.querySelector('.chat-markdown table') && document.querySelector('.chat-code pre')", "표와 fenced code 실제 DOM");
  await session.wait("!document.body.innerText.includes('PRIVATE_REASONING_DO_NOT_RENDER')", "비공개 reasoning 미노출");
  await session.screenshot("restored-chat");
  await session.click('.chat-code button');
  await session.wait("document.querySelector('.chat-code button')?.textContent.includes('복사됨')", "코드 복사 클릭 성공");
  await session.click('.chat-message-actions button:last-child');
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value.includes('> ## 저장된 답변')", "인용은 초안에 추가");
  const draft = String(await session.evaluate("document.querySelector('[data-testid=\"prompt-input\"]').value"));
  await session.evaluate("document.querySelector('.transcript').scrollTop=0; document.querySelector('.transcript').dispatchEvent(new Event('scroll'))");
  await session.click(b);
  await session.wait("document.body.innerText.includes('두 번째 저장 대화')", "다른 저장 대화 선택");
  await session.input("B의 보존할 초안");
  await session.click(a);
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value===" + JSON.stringify(draft), "대화별 인용 초안 보존");
  await session.wait("document.querySelector('.transcript').scrollTop<2", "대화별 읽기 위치 보존");
  await session.input("같은 대화 후속 요청");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.body.innerText.includes('같은 대화에서 이어졌습니다.')", "재개 후 실제 turn 요청과 답변");
  await session.input("승인 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-decision=\"accept\"]')", "Native 승인 대기 표시");
  await session.wait("document.querySelector('[data-testid=\"new-conversation\"]')?.disabled===true", "실행 중 대화 변경 차단");
  await session.click('[data-decision="accept"]');
  await session.wait("!document.querySelector('[data-decision=\"accept\"]')", "승인 응답 왕복");
  await session.input("중단 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-testid=\"interrupt-button\"]')", "실행 중 중단 버튼");
  await session.click('[data-testid="interrupt-button"]');
  await session.wait("document.querySelector('.status')?.innerText.includes('중단 확인')", "중단 최종 결과 확인");
  await session.click('[data-testid="new-conversation"]');
  await session.wait("!document.querySelector('.chat-markdown h2')", "새 대화 이력 분리");
  await session.input("새 대화 시작");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.body.innerText.includes('같은 대화에서 이어졌습니다.')", "새 Native 스레드 요청");
  await session.screenshot("new-chat");
  await session.terminate();
  session = await start(2);
  await session.click(a);
  await session.wait("document.body.innerText.includes('같은 대화 후속 요청')", "앱 재시작 뒤 Native 저장 이력 재열기");
  await session.screenshot("restart-chat");
  await session.terminate();
  session = null;
  const calls = (await fs.readFile(path.join(workspace, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map((line) => object(JSON.parse(line)));
  const resumed = calls.some((call) => call.method === "thread/resume" && object(call.params).threadId === "history-a");
  const followed = calls.some((call) => call.method === "turn/start" && object(call.params).threadId === "history-a");
  if (!resumed || !followed) throw Error("동일 Native thread 요청 근거가 없습니다.");
  const summary = { result: "passed", evidence: path.relative(root, directory), coverage: "실제 Electron DOM·preload IPC·stdio·합성 Native 원장·앱 재시작. 실제 모델·Windows·실제 한국어 IME는 미검증.", checks, sameNativeThread: true };
  await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} catch (error) {
  await session?.terminate();
  await fs.writeFile(path.join(directory, "failure.txt"), String(error));
  console.error(String(error) + "\n증거: " + directory);
  process.exitCode = 1;
}
