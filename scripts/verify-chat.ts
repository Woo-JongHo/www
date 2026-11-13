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

async function seedHistory() {
  const output = Array.from({ length: 11 }, (_, index) => `    명령 출력 ${index + 1}`).join("\n");

  const answer = "## 저장된 답변\n\n**이어갈 작업**을 확인했습니다.\n\n| 항목 | 상태 |\n| --- | --- |\n| 저장 | 완료 |\n\n```ts\n    const saved = true;\n" + "    // 긴 코드 " + "x".repeat(1200) + "\n```\n\n[긴 URL](https://example.com/" + "path".repeat(400) + ")\n\nhttps://example.com/" + "long".repeat(400) + "\n\n" + Array.from({ length: 35 }, (_, index) => `기록 문단 ${index}\n\n`).join("") + "마지막 문장 접근 확인.";
  await fs.writeFile(path.join(workspace, "fixture-history.json"), JSON.stringify({
    "history-a": [{ id: "saved-turn-a", status: "completed", items: [
      {
        id: "saved-user", type: "userMessage",
        content: [{ type: "text", text: "저장된 작업 요청" }]
      },
      {
        id: "saved-summary", type: "reasoning",
        summary: ["공개 요약입니다."], content: ["PRIVATE_REASONING_DO_NOT_RENDER"]
      },
      {
        id: "saved-command", type: "commandExecution", command: "printf saved", cwd: workspace,
        status: "completed", exitCode: 0, aggregatedOutput: output
      },
      {
        id: "failed-command", type: "commandExecution", command: "printf failed", cwd: workspace,
        status: "failed", exitCode: 1, aggregatedOutput: "    실패한 출력\n    오류 확인"
      },
      {
        id: "truncated-command", type: "commandExecution", command: "printf truncated", cwd: workspace,
        status: "failed", exitCode: 1, aggregatedOutput: Array.from({ length: 5000 }, (_, index) => `    긴 출력 ${index + 1}`).join("\n")
      },
      {
        id: "auto-transition-command", type: "commandExecution", command: "printf auto-transition", cwd: workspace,
        status: "completed", exitCode: 0, aggregatedOutput: "자동 상태 전환 확인"
      },
      {
        id: "saved-answer", type: "agentMessage",
        phase: "final_answer", text: answer
      }
    ] }],
    "history-b": [{ id: "saved-turn-b", status: "completed", items: [{ id: "b-answer", type: "agentMessage", text: "두 번째 저장 대화" }] }]
  }));
}

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
      await evaluate("(() => { const selector=" + JSON.stringify(selector) + "; const node=document.querySelector(selector); if(!(node instanceof HTMLElement))throw Error('요소 없음: '+selector); if(node instanceof HTMLButtonElement && node.disabled)throw Error('비활성 요소: '+selector); node.click(); })()");
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
  await seedHistory();
  session = await start(1);
  const a = '[data-thread-id="history-a"]';
  const b = '[data-thread-id="history-b"]';
  await session.click(a);
  await session.wait("document.querySelector('.chat-markdown h2')?.textContent==='저장된 답변'", "저장 대화 Markdown 복원");
  await session.wait("document.querySelector('.chat-markdown table') && document.querySelector('.chat-code pre')", "표와 fenced code 실제 DOM");
  await session.wait("!document.body.innerText.includes('PRIVATE_REASONING_DO_NOT_RENDER')", "비공개 reasoning 미노출");
  await session.wait("document.querySelector('[data-testid=\"command-preview\"]')?.textContent.split('\\n').length===10", "명령 카드 10줄 미리보기");
  await session.wait("document.querySelector('[data-testid=\"command-preview\"]')?.textContent.startsWith('    명령 출력 1')", "명령 출력 들여쓰기와 종료 후 앞 10줄");
  await session.wait("document.querySelector('.command-card.item-failed details')?.open===true", "실패 카드 보관 출력 자동 펼침");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.innerText.includes('printf truncated') && card.innerText.includes('보관된 출력의 앞 10줄') && card.innerText.includes('보관 범위 안에서') && card.innerText.includes('제거된 원본 줄 수는 미확인') && card.querySelector('details')?.open===true)", "한도 초과 실패 출력의 보관 범위 안내와 자동 펼침");
  await session.click('.command-card.item-completed summary');
  await session.wait("document.querySelector('.command-card.item-completed details')?.open===true", "보관된 전체 출력 펼치기");
  await session.click('.command-card.item-completed summary');
  await session.wait("document.querySelector('.command-card.item-completed details')?.open===false && document.querySelector('[data-testid=\"command-preview\"]')?.getBoundingClientRect().height>0", "출력을 접어도 미리보기 유지");
  await session.evaluate("(() => { const transcript=document.querySelector('.transcript'); transcript.scrollTop=transcript.scrollHeight; transcript.dispatchEvent(new Event('scroll')); })()");
  await session.wait("(() => { const t=document.querySelector('.transcript'); const last=document.querySelector('.agent .chat-markdown>:last-child'); const input=document.querySelector('.compose'); return last.textContent.includes('마지막 문장 접근 확인') && last.getBoundingClientRect().bottom<=t.getBoundingClientRect().bottom+1 && t.getBoundingClientRect().bottom<=input.getBoundingClientRect().top+1; })()", "긴 답변 마지막 문장과 입력창 분리");
  await session.wait("document.documentElement.scrollWidth<=window.innerWidth && document.querySelector('.chat-code pre').scrollWidth>document.querySelector('.chat-code pre').clientWidth", "긴 URL과 코드의 가로 넘침 격리");
  for (const width of [1040, 860, 1440]) {
    await session.command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await session.wait("(() => { const t=document.querySelector('.transcript'); const input=document.querySelector('.compose'); return t.clientHeight>0 && t.getBoundingClientRect().bottom<=input.getBoundingClientRect().top+1 && input.getBoundingClientRect().bottom<window.innerHeight && document.documentElement.scrollWidth<=window.innerWidth; })()", `창 폭 ${width}에서 본문·입력 접근`);
    await session.screenshot(`chat-width-${width}`);
  }
  await session.click('.tabrow button[aria-pressed]');
  await session.wait("document.querySelector('.tabrow button[aria-pressed]')?.getAttribute('aria-pressed')==='false'", "세션 모니터 접기");
  await session.click('.tabrow button[aria-pressed]');
  await session.wait("document.querySelector('.tabrow button[aria-pressed]')?.getAttribute('aria-pressed')==='true'", "세션 모니터 열기");
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
  const history = object(JSON.parse(await fs.readFile(path.join(workspace, "fixture-history.json"), "utf8")));
  for (const turn of Array.isArray(history["history-a"]) ? history["history-a"] : []) {
    const items = object(turn).items;
    for (const item of Array.isArray(items) ? items : []) {
      if (["saved-command", "auto-transition-command"].includes(String(object(item).id))) Object.assign(object(item), { status: "failed", exitCode: 1 });
    }
  }
  await fs.writeFile(path.join(workspace, "fixture-history.json"), JSON.stringify(history));
  await session.click(a);
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value===" + JSON.stringify(draft), "대화별 인용 초안 보존");
  await session.wait("document.querySelector('.transcript').scrollTop<2", "대화별 읽기 위치 보존");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.innerText.includes('printf auto-transition') && card.classList.contains('item-failed') && card.querySelector('details')?.open===true)", "재마운트 뒤 자동 상태는 새 실패를 펼침");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.querySelector('.cmdline')?.textContent==='printf saved' && card.classList.contains('item-failed') && card.querySelector('details')?.open===false)", "재마운트 뒤 수동 접힘은 새 실패에도 유지");
  await session.input("영문 Enter keyboard");
  await session.evaluate("document.querySelector('[data-testid=\"prompt-input\"]').focus()");
  await session.command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value==='' && document.body.innerText.includes('영문 Enter keyboard')", "Electron 키보드 Enter 전송");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled", "키보드 전송 종료");
  await session.input("Shift 줄바꿈");
  await session.evaluate("(() => { const t=document.querySelector('[data-testid=\"prompt-input\"]'); t.focus(); t.setSelectionRange(t.value.length,t.value.length); })()");
  await session.command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", modifiers: 8, windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", modifiers: 8, windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value==='Shift 줄바꿈\\n'", "Electron Shift+Enter 줄바꿈");
  await session.input("한글 합성 조합 확인");
  await session.evaluate("(() => { const t=document.querySelector('[data-testid=\"prompt-input\"]'); t.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'인'})); t.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',code:'Enter',isComposing:true,keyCode:229})); })()");
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value==='한글 합성 조합 확인'", "합성 한국어 조합 Enter는 전송하지 않음");
  await session.evaluate("document.querySelector('[data-testid=\"prompt-input\"]').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'인'}))");
  await pause(20);
  await session.evaluate("(() => { const t=document.querySelector('[data-testid=\"prompt-input\"]'); t.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',code:'Enter',keyCode:13})); t.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',code:'Enter',keyCode:13})); })()");
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value===''", "합성 조합 종료 후 별도 Enter 전송");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled", "합성 조합 전송 종료");
  await session.input("전송 실패 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value==='전송 실패 확인' && document.querySelector('.status')?.innerText.includes('합성 전송 실패')", "전송 실패 뒤 초안 보존과 오류 표시");
  await session.input("실시간 카드 확인");
  await session.evaluate("document.querySelector('.transcript').scrollTop=0; document.querySelector('.transcript').dispatchEvent(new Event('scroll'))");
  const started = Date.now();
  await session.click('[data-testid="send-button"]');
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.innerText.includes('printf live') && card.innerText.includes('실행 중') && card.querySelector('[data-testid=\"command-preview\"]')?.textContent.startsWith('    실시간 출력 2'))", "턴 종료 전 실시간 카드 최근 10줄");
  await session.wait("document.querySelector('[data-testid=\"activity-live-monitor\"]')?.innerText.includes('최근 통신 경고') && document.querySelector('[data-testid=\"activity-live-monitor\"]')?.innerText.includes('Native 연결됨') && !document.querySelector('.status')?.innerText.includes('연결 error')", "잘못된 JSON 경고와 살아 있는 연결·명령 스트리밍 구분");
  checks.push("요청 클릭→실시간 카드 관측 " + (Date.now() - started) + "ms (수신→반영 지연과 별개)");
  await session.wait("document.querySelector('.new-content') && document.querySelector('.transcript').scrollTop<2", "실시간 사건 중 과거 읽기 위치 유지");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.innerText.includes('printf live') && card.classList.contains('item-failed') && card.querySelector('details')?.open===true && card.querySelector('[data-testid=\"command-preview\"]')?.textContent.startsWith('    실시간 출력 1'))", "실패 종료 후 앞 10줄과 보관 출력 펼침");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled", "실시간 카드 턴 종료");
  await session.evaluate("Array.from(document.querySelectorAll('.command-card')).find((card)=>card.innerText.includes('printf live'))?.scrollIntoView({block:'center'})");
  await session.screenshot("live-command");
  for (const [prompt, command, expected] of [
    ["명령 거절 확인", "printf declined", "거절"],
    ["턴 중단 확인", "printf unfinished", "턴 중단 · 명령 결과 미확인"]
  ]) {
    await session.input(prompt);
    await session.click('[data-testid="send-button"]');
    await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.querySelector('.cmdline')?.textContent===" + JSON.stringify(command) + " && card.querySelector('.command-state')?.textContent.includes(" + JSON.stringify(expected) + "))", prompt + "은 실제 수신 상태를 표시");
    await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled", prompt + " 턴 종료");
  }
  await session.input("같은 대화 후속 요청");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.body.innerText.includes('같은 대화에서 이어졌습니다.')", "재개 후 실제 turn 요청과 답변");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled", "후속 요청 최종 종료");
  await session.input("승인 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-decision=\"accept\"]')", "Native 승인 대기 표시");
  await session.wait("document.querySelector('[data-testid=\"new-conversation\"]')?.disabled===true", "실행 중 대화 변경 차단");
  await session.click('[data-decision="accept"]');
  await session.wait("!document.querySelector('[data-decision=\"accept\"]')", "승인 응답 왕복");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled && !document.querySelector('[data-testid=\"interrupt-button\"]')", "승인 턴 실제 종료 뒤 다음 요청 허용");
  await session.input("중단 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("Array.from(document.querySelectorAll('[data-testid=\"user-request\"]')).at(-1)?.textContent.startsWith('중단 확인') && document.querySelector('[data-testid=\"interrupt-button\"]')", "현재 중단 요청의 실행 중 중단 버튼");
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
  const repeated = calls.filter((call) => call.method === "turn/start" && JSON.stringify(call.params).includes("한글 합성 조합 확인"));
  if (repeated.length !== 1) throw Error("반복 Enter가 요청을 중복 전송했습니다: " + repeated.length);
  checks.push("반복 Enter는 실제 stdio 요청 1개");
  const summary = { result: "passed", evidence: path.relative(root, directory), coverage: "실제 Electron DOM·preload IPC·stdio·합성 Native 원장·앱 재시작. 실제 모델·Windows·실제 한국어 IME는 미검증.", checks, sameNativeThread: true };
  await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} catch (error) {
  await fs.writeFile(path.join(directory, "partial-checks.json"), JSON.stringify(checks, null, 2));
  if (session) {
    try {
      await session.screenshot("failure-screen");
      await fs.writeFile(path.join(directory, "failure-dom.txt"), String(await session.evaluate("document.body.innerText")));
    } catch {}
  }
  await session?.terminate();
  await fs.writeFile(path.join(directory, "failure.txt"), String(error));
  console.error(String(error) + "\n증거: " + directory);
  process.exitCode = 1;
}
