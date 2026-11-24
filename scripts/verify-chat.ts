#!/usr/bin/env node
// 실제 Electron 화면·IPC·stdio와 디스크를 유지한 재시작을 검증한다. 모델은 합성 fixture다.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Data = Record<string, unknown>;
const object    = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {} ;
const root      = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")                                           ;
const directory = await fs.mkdtemp(path.join(root, ".www/evidence/chat-ui-"))                                                ;
const workspace = path.join(directory, "workspace")                                                                          ;
const nativeSlash = process.argv.includes("--native-slash");
const nativeSteer = process.argv.includes("--native-steer");
const nativeProbe = nativeSlash || nativeSteer;
await fs.mkdir(workspace);
const checks  : string[] = []                                                                      ;
const metrics : Data[]   = []                                                                      ;
const pause              = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) ;

const reviewOutput = '{"id":"review-readable","provider":"anthropic","model":"opus","verdict":"not_run","readOnly":true,"execution":{"exitCode":1,"error":null},"large":9007199254740993,"path":"' + 'long-path/'.repeat(70) + '","findings":[]}\n';

async function seedHistory() {
  const output    = Array.from({ length: 11 }, (_, index) => `    명령 출력 ${index + 1}`).join("\n")                                                                                                      ;
  const wideTable = "| " + Array.from({ length: 24 }, (_, index) => `열 ${index + 1}`).join(" | ") + " |\n| " + Array(24).fill("---").join(" | ") + " |\n| " + Array(24).fill("값").join(" | ") + " |\n\n" ;

  const answer = "## 저장된 답변\n\n**이어갈 작업**을 확인했습니다. [검증 문서](https://example.com/verification)\n\n| 항목 | 상태 |\n| --- | --- |\n| 저장 | 완료 |\n\n" + wideTable + "```ts\n    const saved = true;\n" + "    // 긴 코드 " + "x".repeat(1200) + "\n```\n\n[긴 URL](https://example.com/" + "path".repeat(400) + ")\n\nhttps://example.com/" + "long".repeat(400) + "\n\n" + Array.from({ length: 35 }, (_, index) => `기록 문단 ${index}\n\n`).join("") + "마지막 문장 접근 확인.";
  await fs.writeFile(path.join(workspace, "fixture-history.json"), JSON.stringify({
    "history-a": [{ id: "saved-turn-a", status: "completed", items: [
      ...((process.argv.includes("--performance-only") || process.argv.includes("--editing-layout-only")) ? Array.from({length:60}, (_, index) => ({id:`perf-${index}`,type:"commandExecution",command:`printf performance-${index}`,cwd:workspace,status:"completed",exitCode:0,aggregatedOutput:JSON.stringify({index,output:"기록 ".repeat(7500)})})) : []),
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
        id: "review-readable", type: "commandExecution", command: "node --input-type=module -e '" + "console.log(review);".repeat(30) + "'", cwd: workspace,
        status: "completed", exitCode: 0, aggregatedOutput: reviewOutput
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

async function resolveNativeExecutable() {
  const selected = execFileSync("/usr/bin/which", ["codex"], { encoding: "utf8" }).trim();
  const executable = await fs.realpath(selected);
  const version = execFileSync(executable, ["--version"], { encoding: "utf8", timeout: 10_000 }).trim();
  if (!/^codex-cli \d+\.\d+\.\d+/.test(version)) throw new Error("Native 검증에 사용할 Codex CLI 버전을 확인하지 못했습니다.");
  return { selected, executable, version };
}

const nativeExecutable = nativeProbe ? await resolveNativeExecutable() : null;
if (nativeExecutable) await fs.writeFile(path.join(directory, "native-executable.json"), JSON.stringify(nativeExecutable, null, 2));

async function start(round: number, selectedWorkspace = workspace) {
  const callsBefore = await fs.readFile(path.join(selectedWorkspace, "fixture-calls.jsonl"), "utf8").catch(() => "");

  const port   = await freePort()                                                          ;
  const stdout = await fs.open(path.join(directory, "electron-" + round + ".stdout"), "w") ;
  const stderr = await fs.open(path.join(directory, "electron-" + round + ".stderr"), "w") ;
  const env    = { ...process.env }                                                        ;
  delete env.ELECTRON_RUN_AS_NODE;
  const binary = path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
  const child: ChildProcess = spawn(binary, [root, "--remote-debugging-port=" + port, "--user-data-dir=" + path.join(directory, "profile")], {
    cwd: root, stdio: ["ignore", stdout.fd, stderr.fd],
    env: { ...env, WWW_PROBE_SHOW_WINDOW: process.argv.includes("--performance-only") ? "1" : "0", WWW_PROBE_PATH: path.join(directory, "disabled-probe.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: selectedWorkspace, WWW_CODEX_BIN: nativeExecutable?.executable ?? path.join(root, "test/fixtures/chat-ui-app-server.ts"), WWW_PROBE_NATIVE_REPORTS: "0" }
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
    const deadline = Date.now() + 25_000 ;
    let endpoint   = ""                  ;
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
    let nextId    = 0                                                                                                                      ;
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>() ;
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
      const id    = ++nextId                                                                                     ;
      const timer = setTimeout(() => { pending.delete(id); reject(Error("CDP 제한 시간: " + method)); }, 12_000) ;
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression: string): Promise<unknown> => {
      const result = object(await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }));
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return object(result.result).value;
    };
    const wait = async (expression: string, label: string, timeoutMs = 20_000, retryResourceTransition = false) => {
      const until     = Date.now() + timeoutMs                                                                                                  ;
      const transient = "Error invoking remote method 'activity:resources': Error: 대화를 전환하고 있습니다. 리소스 조회를 다시 시도해 주세요." ;
      const predicate = retryResourceTransition
        ? "(async()=>{try{return Boolean(await (" + expression + "));}catch(error){if(error instanceof Error && error.message===" + JSON.stringify(transient) + ")return false;throw error;}})()"
        : "(async()=>Boolean(await (" + expression + ")))()";
      while (Date.now() < until) {
        if (await evaluate(predicate)) { checks.push(label); return; }
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
    const screenshot = async (name: string, selector?: string) => {
      const clip = selector ? await evaluate(`(() => {
        const {x,y,width,height}=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return {x,y,width,height,scale:1};
      })()`) : undefined;
      const result = object(await command("Page.captureScreenshot", { format: "png", ...(clip ? {clip} : {}) }));
      if (typeof result.data !== "string") throw Error("화면 캡처가 없습니다.");
      await fs.writeFile(path.join(directory, name + ".png"), Buffer.from(result.data, "base64"));
    };
    const measureNavigation = async (label: string) => {
      const measurement = object(await evaluate(`(() => {
        const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
        const failures = [];
        const rows = Array.from(document.querySelectorAll('.sidebar .srow, .sidebar .srow>*, .workspace-nav button')).map(node => {
          const rect = node.getBoundingClientRect();
          if (rect.width > 0 && (rect.left < sidebar.left - 1 || rect.right > sidebar.right + 1)) failures.push(node.className || node.tagName);
          return { className: node.className, left: rect.left, right: rect.right };
        });
        return { sidebar: { left: sidebar.left, right: sidebar.right }, rows, failures };
      })()`));
      metrics.push({ label, ...measurement });
      if (!Array.isArray(measurement.failures) || measurement.failures.length) throw Error("탐색 행이 사이드바 밖으로 침범했습니다: " + JSON.stringify(measurement));
      checks.push(label + " 선택행·아이콘·탐색 배경의 지역 경계 보전");
    };
    const measureLayout = async (label: string) => {
      await measureNavigation(label);
      const measurement = object(await evaluate(`(() => {
        const failures = [];
        const dimensions = (node) => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
            width: rect.width, height: rect.height, clientWidth: node.clientWidth,
            clientHeight: node.clientHeight, scrollWidth: node.scrollWidth,
            scrollHeight: node.scrollHeight, scrollTop: node.scrollTop, scrollLeft: node.scrollLeft,
            overflowX: getComputedStyle(node).overflowX, overflowY: getComputedStyle(node).overflowY };
        };
        const visible = (rect) => rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
        const documentSize = dimensions(document.documentElement);
        const bodySize = dimensions(document.body);
        if (documentSize.scrollWidth > innerWidth || documentSize.scrollHeight > innerHeight) failures.push('documentElement 전체 넘침');
        if (bodySize.scrollWidth > innerWidth || bodySize.scrollHeight > innerHeight) failures.push('body 전체 넘침');
        const result = { viewport: { width: innerWidth, height: innerHeight }, documentElement: documentSize, body: bodySize, failures };
        for (const [key, selector] of [['root', '#root'], ['footer', 'footer.status'], ['compose', '.compose'], ['transcript', '.transcript']]) {
          const node = document.querySelector(selector);
          if (!node) { failures.push(selector + ' 없음'); continue; }
          const size = dimensions(node);
          result[key] = size;
          if (!visible(size)) failures.push(selector + ' 가시 범위 이탈');
          if (key === 'transcript') {
            const original = node.scrollTop;
            node.scrollTop = 0;
            const from = node.scrollTop;
            node.scrollTop = Math.min(64, node.scrollHeight - node.clientHeight);
            const to = node.scrollTop;
            node.scrollTop = original;
            result.transcriptMovement = { from, to, restored: node.scrollTop };
            if (size.scrollHeight <= size.clientHeight || to <= from) failures.push('transcript 내부 세로 스크롤 불가');
          }
        }
        if (result.transcript && result.compose && result.transcript.bottom > result.compose.top + 1) failures.push('transcript와 compose 겹침');
        for (const [key, node] of [['code', document.querySelector('.chat-code pre')], ['table', Array.from(document.querySelectorAll('.chat-markdown table')).at(-1)]]) {
          if (!node) { failures.push(key + ' 없음'); continue; }
          const size = dimensions(node);
          const original = node.scrollLeft;
          node.scrollLeft = 0;
          const from = node.scrollLeft;
          node.scrollLeft = Math.min(64, node.scrollWidth - node.clientWidth);
          const to = node.scrollLeft;
          node.scrollLeft = original;
          result[key] = { ...size, movement: { from, to, restored: node.scrollLeft } };
          if (key==='table' && (size.clientWidth<=0 || size.scrollWidth<=size.clientWidth || to<=from || !['auto','scroll'].includes(size.overflowX))) failures.push('table 가로 이동 불가');
          if(key==='code' && (size.scrollWidth>size.clientWidth+1 || size.overflowY==='auto' || size.overflowY==='scroll')) failures.push('code 독립 스크롤 또는 넘침');
        }
        return result;
      })()`));
      metrics.push({ label, ...measurement });
      return measurement;
    };
    await command("Emulation.setFocusEmulationEnabled", { enabled: true });
    await wait("document.querySelector('[data-testid=\"view-page\"]') && document.querySelector('[data-testid=\"open-current-workspace\"]')", "프로젝트 선택 전 전체 보기");
    await pause(250);
    const callsAtHome = await fs.readFile(path.join(selectedWorkspace, "fixture-calls.jsonl"), "utf8").catch(() => "");
    if (callsAtHome !== callsBefore) throw Error("프로젝트 선택 전 Native 호출이 발생했습니다.");
    checks.push("전체 보기에서 Native 자동 실행 없음");
    await screenshot("home-" + round);
    await click('[data-testid="open-current-workspace"]');
    await wait("document.querySelector('[data-testid=\"target-dashboard\"]')", "현재 프로젝트 대시보드 진입");
    await click('[data-testid="chat-nav"]');
    if (!nativeProbe) await wait("document.querySelector('[data-thread-id=\"history-a\"]')", "프로젝트 저장 대화 목록");
    const toggleMonitor = async () => { const opened = await evaluate("!document.querySelector('[data-testid=\"session-monitoring\"]').hidden"); await click(opened ? '[data-testid="chat-nav"]' : '[data-testid="monitoring-nav"]'); };
    return { command, evaluate, wait, click, input, screenshot, measureLayout, measureNavigation, terminate, toggleMonitor };
  } catch (error) { await terminate(); throw error; }
}

// AppEvent를 주입하지 않고 실제 버튼·preload IPC·fixture stdio로만 경계를 만든다.
async function verifyNativeBoundaries(session: Awaited<ReturnType<typeof start>>) {
  const readCalls = async () => (await fs.readFile(path.join(workspace, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map((line) => object(JSON.parse(line)));
  const readEvents = async () => {
    const events = await session.evaluate("(async()=>{const selected=await window.www.workspace();return window.www.events(selected);})()");
    if (!Array.isArray(events)) throw Error("실제 IPC 사건 배열이 없습니다.");
    return events.map(object);
  };
  const submit = async (prompt: string) => {
    const monitored = await session.evaluate("!document.querySelector('[data-testid=\"session-monitoring\"]').hidden");
    if (monitored) await session.click('[data-testid="chat-nav"]');
    await session.input(prompt); await session.click('[data-testid="send-button"]');
    if (monitored) await session.click('[data-testid="monitoring-nav"]');
  }                                                                                                                                                                                                                                                 ;
  const idle            = (label: string) => session.wait("!document.querySelector('[data-testid=\"new-conversation\"]').disabled && !document.querySelector('[data-testid=\"interrupt-button\"]')", label)                                                                                                                                                                              ;
  const visibleApproval = (command: string) => `(() => { const cards=Array.from(document.querySelectorAll('.approval.open')); const button=cards[0]?.querySelector('[data-decision="accept"]'); return cards.length===1 && cards[0].innerText.includes(${JSON.stringify(command)}) && button instanceof HTMLButtonElement && !button.disabled && button.getClientRects().length>0; })()` ;
  const approval = async (command: string) => {
    await session.wait(visibleApproval(command), command + "은 실제 main이 허용한 승인 버튼 표시");
    const event = (await readEvents()).reverse().find((event) => event.kind === "request" && event.supported === true && object(event.params).command === command);
    if (!event || typeof event.approvalToken !== "string" || !event.approvalToken || (typeof event.requestId !== "number" && typeof event.requestId !== "string")) throw Error("main 발급 승인 token/ID가 없습니다: " + command);
    return event;
  };
  const rejectOldToken = async (event: Data, oldToken: string, command: string) => {
    const before = (await readCalls()).filter((call) => call.method === "response").length;
    // 고정된 새 계약: respond(selection, id, decision, token). 옛 3인자 API로 낮추지 않는다.
    const result = object(await session.evaluate("(async()=>{const selected=await window.www.workspace();try{await window.www.respond(selected," + JSON.stringify(event.requestId) + ",'decline'," + JSON.stringify(oldToken) + ");return {rejected:false};}catch(error){return {rejected:true,message:String(error)};}})()"));
    if (result.rejected !== true || (await readCalls()).filter((call) => call.method === "response").length !== before) throw Error("이전 승인 token이 실제 Native 응답까지 전달됐습니다.");
    await session.wait(visibleApproval(command), "오래된 token 거부 뒤 새 승인 버튼 보존");
    checks.push("실제 IPC는 이전 token 응답을 거부하고 fixture response 수를 늘리지 않음");
  };
  const repeatedBefore = await readCalls();
  await submit("경계 승인 ID 재사용");
  const tokens: string[] = [];
  for (let index = 0; index < 4; index++) {
    const command = "printf boundary-approval-" + (index + 1) ;
    const event   = await approval(command)                   ;
    const token   = String(event.approvalToken)               ;
    if (event.requestId !== (index < 2 ? 42 : "42") || tokens.includes(token)) throw Error("ID 형식 또는 승인별 token 고유성이 유지되지 않았습니다.");
    if (index === 1 || index === 3) await rejectOldToken(event, tokens[index - 1], command);
    tokens.push(token);
    await session.click('.approval.open [data-decision="accept"]');
  }
  await idle("동일 프로세스 numeric/string 승인 ID 네 번의 실제 응답 완료");
  const repeatedCalls     = (await readCalls()).slice(repeatedBefore.length)           ;
  const repeatedResponses = repeatedCalls.filter((call) => call.method === "response") ;
  if (JSON.stringify(repeatedResponses.map((call) => call.id)) !== JSON.stringify([42, 42, "42", "42"]) || new Set(repeatedResponses.map((call) => call.pid)).size !== 1 || repeatedResponses.some((call) => object(call.result).decision !== "accept")) throw Error("같은 Native process의 ID 재사용 응답 원문이 다릅니다.");
  checks.push("같은 Native PID에서 42/42/문자열42/문자열42를 각각 한 번 승인");

  await submit("경계 승인 해소 대기");
  const resolved = await approval("printf boundary-resolved-first");
  await session.click('[data-testid="interrupt-button"]');
  await session.wait("(async()=>{const selected=await window.www.workspace();const events=await window.www.events(selected);return events.some(event=>event.method==='serverRequest/resolved' && event.params?.requestId==='boundary-resolved') && !events.some(event=>event.method==='turn/completed' && event.params?.turn?.id===" + JSON.stringify(object(resolved.params).turnId) + ") && !document.querySelector('.approval.open') && !!document.querySelector('[data-testid=\"interrupt-button\"]');})()", "실제 resolved 알림만으로 턴 종료 전에 대기 승인 카드 닫힘");
  await fs.writeFile(path.join(workspace, "fixture-resolved-release"), "release\n");
  await idle("승인 해소 뒤 실제 interrupted 종료와 선택 복구");
  await submit("경계 해소 ID 후속 승인");
  const nextResolved = await approval("printf boundary-resolved-next");
  if (nextResolved.requestId !== resolved.requestId || nextResolved.approvalToken === resolved.approvalToken) throw Error("해소한 ID 재사용에 새 token이 발급되지 않았습니다.");
  await rejectOldToken(nextResolved, String(resolved.approvalToken), "printf boundary-resolved-next");
  await session.click('.approval.open [data-decision="accept"]');
  await idle("해소한 request ID를 새 token으로 정상 승인");

  await submit("경계 공개 설명 교차 순서");
  await session.wait("Array.from(document.querySelectorAll('.transcript [data-testid=\"public-explanation\"]')).map(node=>node.textContent.trim()).filter(text=>['경계 요약 A','경계 설명 B','경계 요약 C'].includes(text)).join('|')==='경계 요약 A|경계 설명 B|경계 요약 C'", "실제 stdio summary A·commentary B·summary C의 DOM 수신 순서");
  await fs.writeFile(path.join(workspace, "fixture-summary-release"), "release\n");
  await session.wait("Array.from(document.querySelectorAll('.transcript [data-testid=\"public-explanation\"]')).map(node=>node.textContent.trim()).filter(text=>['경계 요약 A','경계 설명 B','경계 요약 C','경계 최종 요','약','경계 최종 요약'].includes(text)).join('|')==='경계 최종 요|경계 설명 B|약'", "완료 요약은 기존 두 조각 위치와 commentary 상대 순서를 보존하고 A/C를 제거");
  await session.wait("document.querySelector('.comm-warning')?.getAttribute('title')==='공개 요약 완료 내용이 정정되어 조각별 시간 위치의 대응은 미확인입니다.'", "정정된 요약 조각의 시간 위치 대응은 미확인 경고로 명시");
  await idle("교차 공개 설명 턴 종료");

  await session.toggleMonitor();
  await session.wait("!document.querySelector('[data-testid=\"activity-panel\"]').hidden", "복원 pulse를 검사할 실제 상세 모니터 열기");
  await submit("경계 유휴 종료 준비");
  await session.wait("document.querySelector('[data-row-id=\"hook:boundary-hook\"]')?.classList.contains('has-activity')", "Native Hook 사건은 실제 카탈로그 행에 관측됨");
  await session.wait("(async()=>{const selected=await window.www.workspace();const events=await window.www.events(selected);return events.some(event=>event.method==='transport/closed') && !document.querySelector('[data-testid=\"new-conversation\"]').disabled;})()", "idle Native subprocess 종료를 실제 transport closed로 수신");
  await session.wait("document.querySelector('[data-row-id=\"hook:boundary-hook\"]') && !document.querySelector('[data-row-id=\"hook:boundary-hook\"]').classList.contains('is-reacting')", "종료 전 실제 Hook pulse가 끝난 뒤 복원 관측 시작");
  const beforeReconnect = await readCalls()                                                                                                                          ;
  const idleCall        = [...beforeReconnect].reverse().find((call) => call.method === "turn/start" && JSON.stringify(call.params).includes("경계 유휴 종료 준비")) ;
  if (!idleCall || typeof idleCall.pid !== "number") throw Error("종료한 Native PID 근거가 없습니다.");
  await session.evaluate(`(() => {
    globalThis.__chatBoundaryReactions=[];
    const inspect=(node)=>{if(node instanceof Element){const rows=[...(node.matches('[data-row-id="hook:boundary-hook"]')?[node]:[]),...node.querySelectorAll('[data-row-id="hook:boundary-hook"]')];for(const row of rows)if(row.classList.contains('is-reacting'))globalThis.__chatBoundaryReactions.push(row.className);}};
    globalThis.__chatBoundaryObserver=new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')inspect(record.target);else for(const node of record.addedNodes)inspect(node);}});
    globalThis.__chatBoundaryObserver.observe(document.querySelector('[data-testid="activity-panel"]'),{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  })()`);
  await submit("경계 유휴 종료 후 이어가기");
  await session.wait("Array.from(document.querySelectorAll('.transcript .chat-markdown')).filter(node=>node.textContent.trim()==='경계 유휴 종료 이전 답변').length===1 && Array.from(document.querySelectorAll('.transcript .chat-markdown')).filter(node=>node.textContent.trim()==='경계 재연결 새 공개 설명').length===1 && Array.from(document.querySelectorAll('.transcript .chat-markdown')).filter(node=>node.textContent.trim()==='경계 재연결 후속 답변').length===1", "재연결은 과거 본문을 한 번 교체하고 새 live 설명·답변을 보존");
  await idle("idle 종료 뒤 동일 thread 후속 턴 완료");
  const reconnectedEvents = await readEvents()                                                                            ;
  const marker            = [...reconnectedEvents].reverse().find((event) => event.method === "conversation/reconnected") ;
  const markerParams      = object(marker?.params)                                                                        ;
  if (!marker || markerParams.threadId !== "history-a" || !Array.isArray(markerParams.events)) throw Error("main의 실제 conversation/reconnected snapshot이 없습니다.");
  const snapshot = markerParams.events.map(object);
  if (!snapshot.length || snapshot.some((event) => event.historical !== true || event.method === "conversation/reconnected" || typeof event.seq !== "number" || typeof marker.seq !== "number" || event.seq >= marker.seq || event.workspaceKey !== marker.workspaceKey || event.selectionEpoch !== marker.selectionEpoch || event.processEpoch !== marker.processEpoch)) throw Error("복원 snapshot의 역사·선택 scope·marker 이전 seq 경계가 다릅니다.");
  const freshPrompt = reconnectedEvents.find((event) => event.method === "turn/userPrompt" && object(event.params).text === "경계 유휴 종료 후 이어가기");
  if (!freshPrompt || typeof freshPrompt.seq !== "number" || typeof marker.seq !== "number" || freshPrompt.seq <= marker.seq || freshPrompt.historical === true) throw Error("새 요청이 복원 marker 뒤 live 사건으로 보전되지 않았습니다.");
  const newCalls     = (await readCalls()).slice(beforeReconnect.length)                                                                                                        ;
  const resumedTurn  = newCalls.find((call) => call.method === "turn/start" && JSON.stringify(call.params).includes("경계 유휴 종료 후 이어가기"))                              ;
  const startIndex   = newCalls.indexOf(resumedTurn ?? {})                                                                                                                      ;
  const priorMethods = newCalls.slice(0, startIndex).filter((call) => call.pid === resumedTurn?.pid && object(call.params).threadId === "history-a").map((call) => call.method) ;
  if (!resumedTurn || resumedTurn.pid === idleCall.pid || object(resumedTurn.params).threadId !== "history-a" || !["thread/read", "thread/resume", "thread/turns/list"].every((method) => priorMethods.includes(method))) throw Error("새 Native process에서 같은 thread의 read/resume/원장 읽기가 후속 turn보다 먼저 실행되지 않았습니다.");
  const reactions = await session.evaluate("(() => {globalThis.__chatBoundaryObserver.disconnect();return globalThis.__chatBoundaryReactions;})()");
  if (!Array.isArray(reactions) || reactions.length !== 0) throw Error("복원된 과거 Hook을 새 pulse로 재생했습니다: " + JSON.stringify(reactions));
  checks.push("재연결 marker는 scope가 같은 historical snapshot이며 fresh userPrompt보다 앞섬", "새 Native PID의 read/resume/turns-list 뒤 같은 thread 후속 요청", "복원 중 과거 Hook pulse 추가 0개");
  await session.toggleMonitor();

  await submit("경계 재연결 실패 준비");
  await session.wait("(async()=>{const selected=await window.www.workspace();const events=await window.www.events(selected);const start=events.findLast(event=>event.method==='turn/userPrompt' && event.params?.text==='경계 재연결 실패 준비');return start && events.some(event=>event.method==='transport/closed' && event.seq>start.seq) && !document.querySelector('[data-testid=\"new-conversation\"]').disabled;})()", "실패 복구 검사 전 idle Native 종료");
  const beforeFailure = await readCalls()                   ;
  const failedDraft   = "  경계 재연결 후 전송 실패 확인\n" ;
  const failedText    = failedDraft.trim()                  ;
  await submit(failedDraft);
  await session.wait("(async()=>{const selected=await window.www.workspace();const events=await window.www.events(selected);return events.some(event=>event.method==='conversation/reconnected' && event.seq>" + marker.seq + ") && events.some(event=>event.method==='fixture/reconnectFailureReady') && document.querySelector('.transcript')?.textContent.includes('경계 재연결 실패 이전 답변');})()", "전송 오류 전에 실제 재연결 snapshot이 화면에 수용됨");
  const failureMarker = [...await readEvents()].reverse().find((event) => event.method === "conversation/reconnected") ;
  const failureCalls  = (await readCalls()).slice(beforeFailure.length)                                                ;
  const failedTurn = failureCalls.find((call) => {
    const input = object(call.params).input;
    return call.method === "turn/start" && Array.isArray(input) && object(input[0]).text === failedText;
  });
  const failedIndex     = failureCalls.indexOf(failedTurn ?? {})                                                                                                                       ;
  const restoredMethods = failureCalls.slice(0, failedIndex).filter((call) => call.pid === failedTurn?.pid && object(call.params).threadId === "history-a").map((call) => call.method) ;
  if (!failureMarker || !failedTurn || !["thread/read", "thread/resume", "thread/turns/list"].every((method) => restoredMethods.includes(method))) throw Error("실패 요청 전에 실제 Native read/resume/snapshot 경계를 통과하지 않았습니다.");
  await fs.writeFile(path.join(workspace, "fixture-reconnect-failure-release"), "release\n");
  await session.wait("document.body.innerText.includes('합성 재연결 전송 실패') && document.querySelector('[data-testid=\"prompt-input\"]').value===" + JSON.stringify(failedDraft) + " && !document.querySelector('[data-testid=\"send-button\"]').disabled", "재연결 뒤 같은 turn/start 실패는 비운 초안을 정확 복원");
  const failedTurns = (await readCalls()).slice(beforeFailure.length).filter((call) => call.method === "turn/start" && JSON.stringify(call.params).includes(failedText));
  if (failedTurns.length !== 1) throw Error("재연결 실패 요청을 자동 재전송했습니다.");
  await fs.writeFile(path.join(directory, "reconnect-draft.json"), JSON.stringify({ draft: failedDraft, preserved: true, markerSeq: failureMarker.seq, nativePid: failedTurn.pid, restoredMethods, turnStartCount: failedTurns.length }, null, 2));
  checks.push("실제 idle 종료→read/resume→snapshot 수용 뒤 turn/start 오류에서도 초안 보존·자동 재전송 0회");
  await session.input("");

  await fs.rm(path.join(workspace, "fixture-reconnect-failure-release"), { force: true });
  const conflictBefore = await readCalls()                                                      ;
  const conflictSeq    = Math.max(0, ...(await readEvents()).map((event) => Number(event.seq))) ;
  const newDraft       = "  전송 중 작성한 새 초안\n"                                           ;
  await submit(failedDraft);
  await session.wait("(async()=>{const selected=await window.www.workspace();return (await window.www.events(selected)).some(event=>event.method==='fixture/reconnectFailureReady' && event.seq>" + conflictSeq + ");})()", "충돌 검사 요청이 실제 Native 오류 gate에서 대기함");
  await session.input(newDraft);
  await fs.writeFile(path.join(workspace, "fixture-reconnect-failure-release"), "release\n");
  await session.wait("document.querySelector('[data-testid=\"failed-request-text\"]')?.textContent===" + JSON.stringify(failedDraft) + " && document.querySelector('[data-testid=\"prompt-input\"]').value===" + JSON.stringify(newDraft), "실제 전송 실패 원문과 새 초안을 공백·줄바꿈까지 별도로 보존");
  await session.wait("document.querySelector('[data-testid=\"restore-failed-request\"]').disabled && document.querySelector('[data-testid=\"send-button\"]').disabled && document.querySelector('[data-testid=\"new-conversation\"]').disabled && document.querySelector('button[aria-label=\"프로젝트 폴더 선택\"]').disabled && document.querySelector('[data-testid=\"failed-request\"]').innerText.includes('대화·프로젝트 전환이 일시 중지')", "충돌 원문을 해결하기 전 중복 전송·선택 전환을 막고 이유와 해결 버튼 표시");
  await session.screenshot("reconnect-draft-conflict");
  await session.click('[data-testid="reports-nav"]');
  await session.wait("document.querySelector('main.work').hidden && document.querySelector('.workspace-nav button[aria-label=\"대화\"]').innerText.includes('실패한 요청 확인')", "리포트 화면에서도 실패 원문을 확인할 대화 복귀 안내 표시");
  await session.click('.workspace-nav button[aria-label="대화"]');
  await session.wait("document.querySelector('[data-testid=\"failed-request\"]').getClientRects().length>0", "화면 전환 뒤에도 대화 탭으로 돌아와 원문 해결 가능");
  await session.input("");
  await session.wait("!document.querySelector('[data-testid=\"restore-failed-request\"]').disabled", "새 초안을 비운 뒤 원문 복원 허용");
  await session.click('[data-testid="restore-failed-request"]');
  await session.wait("!document.querySelector('[data-testid=\"failed-request\"]') && document.querySelector('[data-testid=\"prompt-input\"]').value===" + JSON.stringify(failedDraft) + " && !document.querySelector('[data-testid=\"send-button\"]').disabled", "명시적 원문 복원은 입력창만 채우고 충돌 보관을 해제");
  const conflictTurns = (await readCalls()).slice(conflictBefore.length).filter((call) => call.method === "turn/start");
  if (conflictTurns.length !== 1) throw Error("실패 원문 보관·복원 또는 화면 전환 중 자동 전송이 발생했습니다.");
  await fs.writeFile(path.join(directory, "reconnect-draft-conflict.json"), JSON.stringify({ failedDraft, newDraft, bothPreserved: true, explicitRestoreOnly: true, viewReturnAvailable: true, turnStartCount: conflictTurns.length }, null, 2));
  checks.push("전송 중 새 초안과 실패 원문을 따로 보존하고 명시적 복원만 허용·자동 전송 0회");
  await session.input("");

  const activeBefore = await readCalls();
  await submit("경계 실행 중 종료");
  await session.wait("(async()=>{const selected=await window.www.workspace();const events=await window.www.events(selected);const start=events.findLast(event=>event.method==='turn/userPrompt' && event.params?.text==='경계 실행 중 종료');return start && events.some(event=>event.method==='transport/closed' && event.seq>start.seq);})()", "실행 중 Native subprocess 종료 수신");
  await session.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  const afterCrash      = (await readCalls()).slice(activeBefore.length)            ;
  const afterCrashTurns = afterCrash.filter((call) => call.method === "turn/start") ;
  if (afterCrashTurns.length !== 1 || !JSON.stringify(afterCrashTurns[0]?.params).includes("경계 실행 중 종료")) throw Error("실행 중 단절 뒤 사용자의 새 요청 없이 Native mutation을 자동 전송했습니다.");
  await idle("실행 중 단절 결과를 확인한 뒤 수동 요청 가능");
  await session.click('[data-testid="conversation-item"][data-thread-id="history-b"]');
  await session.wait("document.querySelector('[data-thread-id=\"history-b\"]')?.getAttribute('aria-current')==='true' && document.querySelector('.transcript')?.textContent.includes('두 번째 저장 대화')", "미확정 턴 뒤 다른 대화를 실제 UI로 명시적으로 열기");
  await session.wait("(() => { const button=document.querySelector('[data-testid=\"conversation-item\"][data-thread-id=\"history-a\"]'); return button instanceof HTMLButtonElement && !button.disabled && button.getClientRects().length>0; })()", "목록 갱신 뒤 원래 대화 A 버튼 표시·활성 대기");
  await session.click('[data-testid="conversation-item"][data-thread-id="history-a"]');
  await session.wait("document.querySelector('[data-thread-id=\"history-a\"]')?.getAttribute('aria-current')==='true' && document.querySelector('.transcript')?.textContent.includes('경계 유휴 종료 이전 답변') && !document.querySelector('[data-testid=\"new-conversation\"]').disabled", "원래 Native 대화를 명시적으로 다시 열어 수동 복구 허용");
  await submit("경계 실행 종료 후 수동 후속");
  await session.wait("Array.from(document.querySelectorAll('.transcript .chat-markdown')).some(node=>node.textContent.trim()==='경계 수동 복구 후속 답변')", "명시한 수동 후속 요청의 새 실제 답변 수신");
  await idle("단절 뒤 사용자가 명시한 새 후속 요청만 완료");
  const finalCalls = (await readCalls()).slice(activeBefore.length);
  if (finalCalls.filter((call) => call.method === "turn/start" && JSON.stringify(call.params).includes("경계 실행 중 종료")).length !== 1 || finalCalls.filter((call) => call.method === "turn/start" && JSON.stringify(call.params).includes("경계 실행 종료 후 수동 후속")).length !== 1) throw Error("미확정 요청이 수동 복구 도중 재전송됐습니다.");
  checks.push("실행 중 단절의 미확정 turn/start는 자동·수동 복구 뒤에도 총 1회");
  await fs.writeFile(path.join(directory, "native-boundaries.json"), JSON.stringify({ repeatedApprovalIds: repeatedResponses.map((call) => call.id), repeatedApprovalPid: repeatedResponses[0]?.pid, staleTokensRejected: true, resolvedBeforeTurnCompleted: true, idleNativePid: idleCall.pid, resumedNativePid: resumedTurn.pid, threadId: "history-a", restoreMarkerSeq: marker.seq, freshPromptSeq: freshPrompt.seq, historicalSnapshotEvents: snapshot.length, replayedHookPulses: reactions.length, interruptedTurnSentOnce: true }, null, 2));
}

type ImeScenario = "반복" | "확정 우선" | "취소" | "줄바꿈";

// CDP에서 실행한다. 비신뢰 키 이벤트는 OS IME를 구동하지 않아 조합 확정 input도 명시한다.
function dispatchImeGesture(scenario: ImeScenario, prefix: string) {
  const input = document.querySelector('[data-testid="prompt-input"]');
  if (!(input instanceof HTMLTextAreaElement)) throw Error("입력창이 없습니다.");
  input.focus();
  const key = (type: string, code: number, composing = false, repeat = false) => input.dispatchEvent(new KeyboardEvent(type, {
    bubbles: true, cancelable: true, key: code === 229 ? "Process" : "Enter", code: "Enter",
    keyCode: code, isComposing: composing, repeat, shiftKey: scenario === "줄바꿈",
  }));
  const compose = (type: string, data: string) => input.dispatchEvent(new CompositionEvent(type, { bubbles: true, data }));
  const commitText = (text: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) throw Error("입력값 설정자를 찾을 수 없습니다.");
    setter.call(input, text);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "각", inputType: "insertCompositionText" }));
  };
  compose("compositionstart", "가");
  if (scenario !== "확정 우선") key("keydown", 229, true);
  if (scenario === "반복") key("keydown", 229, true, true);
  compose("compositionend", scenario === "취소" ? "" : "각");
  commitText(scenario === "취소" ? prefix : prefix + "각");
  if (scenario === "확정 우선") key("keydown", 229);
  if (scenario === "반복") key("keydown", 13);
  key("keyup", 13);
}

async function verifyImeEnter(session: Awaited<ReturnType<typeof start>>) {
  const readStarts = async () => {
    const log = await fs.readFile(path.join(workspace, "fixture-calls.jsonl"), "utf8");
    return log.trim().split("\n").filter(Boolean).map(line => object(JSON.parse(line))).filter(call => call.method === "turn/start").map(call => {
      const input = object(call.params).input;
      return Array.isArray(input) ? object(input[0]).text : null;
    });
  };
  const before = (await readStarts()).length;
  const expected: string[] = [];
  const field = "document.querySelector('[data-testid=\u0022prompt-input\u0022]')";
  const scenarios: ImeScenario[] = ["취소", "줄바꿈", "반복", "확정 우선"];
  for (const scenario of scenarios) {
    const prefix = "합성 한글 " + scenario + " ";
    await session.input(prefix + "가");
    await session.evaluate("(" + dispatchImeGesture.toString() + ")(" + JSON.stringify(scenario) + "," + JSON.stringify(prefix) + ")");
    if (scenario === "취소" || scenario === "줄바꿈") {
      await session.wait(field + ".value===" + JSON.stringify(scenario === "취소" ? prefix : prefix + "각"), scenario + "는 조합 입력을 전송하지 않음");
      continue;
    }
    expected.push(prefix + "각");
    await session.wait(field + ".value==='' && document.querySelector('.transcript').textContent.includes(" + JSON.stringify(prefix + "각") + ") && !document.querySelector('[data-testid=\u0022new-conversation\u0022]').disabled", scenario + " Enter 한 번으로 최종 받침 전송 완료");
    const actual = (await readStarts()).slice(before);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error("조합 요청의 횟수 또는 본문 불일치 " + JSON.stringify({ expected, actual }));
  }
  checks.push("IME 확정 순서별 최종 본문을 fixture turn/start에서 각각 1회 확인");
}

let session: Awaited<ReturnType<typeof start>> | null = null;
async function verifyChat() {
try {
  if (!nativeProbe) await seedHistory();
  session = await start(1);
  if (process.argv.includes("--ime-enter-only")) {
    await verifyImeEnter(session);
    await session.terminate();
    session = null;
    const summary = { result: "passed", scope: "ime-enter-only", evidence: directory, checks };
    await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
    return;
  }
  if (nativeSteer) {
    await session.input("도구를 사용하지 말고 001부터 250까지 숫자를 한 줄에 하나씩 출력하세요.");
    await session.click('[data-testid="send-button"]');
    await session.wait("document.querySelector('.transcript .agent .chat-markdown')?.textContent.match(/00[1-9]/) && document.querySelector('[data-testid=\"send-button\"]').textContent.includes('Steer')", "실제 Native 응답 스트리밍과 추가 지시 버튼", 35_000);
    await session.input("현재 응답의 끝에 확인이라고 덧붙여 주세요.");
    await session.click('[data-testid="send-button"]');
    await session.wait(`(async()=>{const events=await window.www.workspace().then(scope=>window.www.events(scope));
      const start=events.find(event=>event.method==='turn/started');
      return !!start && events.some(event=>event.method==='turn/steerAccepted'
        && event.params.threadId===start.params.threadId && event.params.turnId===start.params.turn.id);})()`, "실제 Native가 스트리밍 중 같은 턴에 추가 지시를 접수", 30_000);
    await session.wait("!document.querySelector('[data-testid=\"interrupt-button\"]')", "실제 턴 종료 뒤 검사용 앱 종료", 45_000);
    await fs.writeFile(path.join(directory, "native-steer-summary.txt"), checks.join("\n") + "\n");
    await session.terminate();
    session = null;
    console.log(JSON.stringify({ evidence: directory, nativeExecutable, checks }));
    return;
  }
  if (nativeSlash) {
    await session.input("/model");
    await session.click('[data-testid="send-button"]');
    await session.wait("document.querySelectorAll('dialog[open] .chat-model-options button').length>0", "실제 Native 모델 목록 표시", 30_000);
    await session.click('dialog[open] > button');
    await session.input("도구를 사용하지 말고 검증 준비 완료라고 한 문장으로 답하세요.");
    await session.click('[data-testid="send-button"]');
    await session.wait("document.querySelector('[data-testid=\"working-status\"]').textContent.includes('응답 종료')", "실제 Native 대화 이력 생성", 45_000);
    await session.input("/compact");
    await session.click('[data-testid="send-button"]');
    await session.wait("document.querySelector('.chat-compose-note').textContent.includes('대화 압축 완료')", "실제 Native 압축 완료 표시", 80_000);
    await session.terminate();
    session = null;
    console.log(JSON.stringify({ evidence: directory, checks }));
    return;
  }
  if (process.argv.includes("--renderer-timing-only")) {
    await session.input("프레임 계측 확인");
    await session.click('[data-testid="send-button"]');
    const timingSummary = `(async () => {
      const events = await window.www.events(await window.www.workspace());
      const timings = events.filter(e => !e.historical && e.method === 'diagnostics/timing');
      const first = timings.find(e => e.params.phase === 'first-native' && e.params.status === 'completed');
      if (!first) return null;
      const trace = timings.filter(e => e.params.traceId === first.params.traceId);
      if (!trace.some(e => e.params.phase === 'request' && e.params.status === 'completed')) return null;
      if (!events.some(e => e.seq >= first.seq && e.method === 'turn/completed' && e.params?.threadId === first.params.threadId)) return null;
      const expected = trace.map(e => e.seq);
      const details = performance.getEntriesByName('www:renderer-commit-frame').map(e => e.detail);
      const actual = details.filter(e => e.traceId === first.params.traceId).map(e => e.seq);
      return { expected, actual };
    })()`;
    await session.wait(`(async () => {
      const summary = await ${timingSummary};
      return summary && summary.expected.length > 1 && summary.expected.length === summary.actual.length
        && summary.expected.every((seq, i) => seq === summary.actual[i]);
    })()`, "새 대화의 모든 timing 사건이 같은 순서로 프레임에 한 번씩 연결됨");
    const summary = await session.evaluate(timingSummary);
    await fs.writeFile(path.join(directory, "renderer-timing.json"), JSON.stringify(summary));
    console.log(JSON.stringify({ evidence: directory, summary }));
    await session.terminate();
    session = null;
    return;
  }
  if (process.argv.includes("--editing-layout-only")) {
    const input = "document.querySelector('[data-testid=prompt-input]')";
    await session.command("Emulation.setDeviceMetricsOverride", { width: 860, height: 680, deviceScaleFactor: 1, mobile: false });
    await session.command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await session.input("/theme");
    await session.click('[data-testid="send-button"]');
    await session.wait("document.querySelector('dialog[open]')", "테마 선택기 열림");
    await session.evaluate("Array.from(document.querySelectorAll('dialog[open] button')).find(b=>b.textContent==='WWW Mint').click()");
    await session.click('[data-thread-id="history-a"]');
    await session.wait("document.querySelectorAll('.command-card').length>=65 && innerWidth===860 && matchMedia('(prefers-reduced-motion: reduce)').matches && document.querySelector('main.work').dataset.chatTheme==='www-mint'", "좁은 창과 모션 축소, Mint에서 긴 대화 복원");
    await session.input("편집 상태 중단 확인");
    await session.click('[data-testid="send-button"]');
    const status = "document.querySelector('[data-testid=working-status]')";
    await session.wait(status + ".textContent.includes('Working')", "긴 대화의 실제 실행 상태 표시");
    const transcript = "document.querySelector('.transcript')";
    await session.evaluate(input + ".focus({preventScroll:true});" + transcript + ".scrollTop=0;" + transcript + ".dispatchEvent(new Event('scroll'))");
    await session.command("Input.insertText", { text: "첫 끝" });
    await session.evaluate(input + ".setSelectionRange(2, 2)");
    await session.evaluate(input + ".addEventListener('compositionstart', () => document.body.dataset.editingComposition='started', { once: true })");
    await session.command("Input.imeSetComposition", { text: "가운", selectionStart: 2, selectionEnd: 2 });
    await session.wait("document.body.dataset.editingComposition==='started' && " + input + ".value.includes('가운')", "실행 중 입력칸에서 Chromium 한글 조합 시작");
    await session.command("Input.insertText", { text: "가운데 " });
    await session.wait(input + ".value==='첫 가운데 끝' && " + input + ".selectionStart===6", "커서 위치에서 중간 편집 후 캐럿 보존");
    await session.evaluate(input + ".setSelectionRange(2, 5)");
    const pasteAllowed = await session.evaluate(`(() => {
      const node = ${input};
      const dispatch = text => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', text);
        return node.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
      };
      return !dispatch('가'.repeat(node.maxLength + 1)) && node.value === '첫 가운데 끝' && dispatch('두 줄\\n내용');
    })()`);
    if (!pasteAllowed) throw Error("붙여넣기 한도 초과 보호 또는 선택 범위 허용 실패");
    checks.push("합성 클립보드 사건으로 초과 붙여넣기 거부·초안 보존·정상 길이 허용");
    await session.command("Input.insertText", { text: "두 줄\n내용" });
    await session.wait(input + ".value===" + JSON.stringify("첫 두 줄\n내용 끝") + " && document.activeElement===" + input, "선택 구간 여러 줄 교체와 포커스 보존");
    await session.wait(transcript + ".scrollHeight>" + transcript + ".clientHeight+100 && " + transcript + ".scrollTop<40 && (()=>{const r=" + status + ".getBoundingClientRect();return r.height>0 && r.top>=0 && r.bottom<=innerHeight})()", "지난 대화를 읽는 위치와 고정 상태줄 유지");
    const history = JSON.parse(await fs.readFile(path.join(workspace, "fixture-history.json"), "utf8"));
    await session.click('.chat-message-actions button:last-child');
    const answer = history["history-a"][0].items.find((item: Data) => item.id === "saved-answer")?.text;
    if (typeof answer !== "string" || !answer.startsWith("## 저장된 답변")) throw Error("인용 원문을 확인할 수 없습니다.");
    const draft = "첫 두 줄\n내용 끝\n\n" + answer.split("\n").map(line => "> " + line).join("\n") + "\n\n";
    await session.wait(input + ".value===" + JSON.stringify(draft), "현재 초안에 원래 답변 전체가 인용됨");
    await session.click('[data-testid="interrupt-button"]');
    await session.wait("!document.querySelector('[data-testid=interrupt-button]') && !" + status + ".textContent.includes('Working') && " + input + ".value===" + JSON.stringify(draft), "중단 후 상태가 바뀌고 편집 초안 보존");
    await session.click('[data-thread-id="history-b"]');
    await session.wait("document.querySelector('.transcript').textContent.includes('두 번째 저장 대화') && " + input + ".value!==" + JSON.stringify(draft), "다른 대화로 전환해 초안 격리 확인");
    await session.click('[data-thread-id="history-a"]');
    await session.wait(input + ".value===" + JSON.stringify(draft), "원래 대화에 돌아와 인용과 여러 줄 초안 복원");
    const summary = { checks, viewport: [860, 680], theme: "www-mint", reducedMotion: true, limits: ["여러 줄 입력은 CDP Input.insertText로 전달했다. OS 시스템 클립보드와 실제 IME는 별도 관찰 대상이다."] };
    await fs.writeFile(path.join(directory, "editing-layout.json"), JSON.stringify(summary, null, 2));
    await session.terminate();
    session = null;
    console.log(JSON.stringify({ directory, summary }));
    return;
  }
  if (process.argv.includes("--theme-only")) {
    const openPicker = async () => {
      await session!.input("/theme");
      await session!.click('[data-testid="send-button"]');
      await session!.wait("document.querySelector('dialog[open] h2')?.textContent==='채팅 테마 선택'", "테마 선택기 열기");
    };
    const key = async (name: string, code: number, text?: string) => {
      const physical = name === " " ? "Space" : name;
      await session!.command("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: physical, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(text ? { text, unmodifiedText: text } : {}) });
      await session!.command("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: physical, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
    };
    const themeFile = path.join(directory, "profile", "chat-theme.json");
    const mint = `document.querySelector('.session-surface:not([hidden]) main.work').dataset.chatTheme==='www-mint'`;
    const basic = 'getComputedStyle(document.querySelector(".session-surface:not([hidden]) main.work")).backgroundColor==="rgb(21, 21, 21)"';
    const focused = "document.activeElement===document.querySelector('[data-testid=\"prompt-input\"]')";
    const panelColors = (background: string, foreground: string) => `(() => {
      const surface=document.querySelector('.session-surface:not([hidden])');
      const panels=['.target-sidebar','[data-testid="resource-sidebar"]'];
      return innerWidth>=1000 && panels.every(selector=>{
        const panel=surface?.querySelector(selector);
        if(!panel||panel.getBoundingClientRect().width===0) return false;
        const style=getComputedStyle(panel);
        return style.backgroundColor===${JSON.stringify(background)} && style.color===${JSON.stringify(foreground)};
      });
    })()`;
    const basicPanels = panelColors("rgb(21, 21, 21)", "rgb(237, 237, 237)");
    const mintPanels = panelColors("rgb(12, 14, 13)", "rgb(230, 232, 230)");
    await session.click('[data-thread-id="history-a"]');
    await session.wait("document.querySelector('.command-card')", "기존 명령 카드가 있는 대화 열기");
    await session.wait(`${basic} && getComputedStyle(document.querySelector('.command-card')).backgroundColor==='rgb(32, 32, 32)'`, "미설정 프로필의 기본 배경색이 채팅과 명령 카드에 적용");
    await session.wait(basicPanels, "넓은 창의 대화 목록과 Agent 패널에 Basic 배경색·글자색 적용");
    for (let step = 0; step < 160; step++) {
      await key("Tab", 9);
      if (await session.evaluate(`document.activeElement.matches('.session-surface:not([hidden]) textarea:focus-visible')`)) break;
    }
    const ratios = await session.evaluate(`(() => {
      const luminance = rgb => rgb.match(/[\\d.]+/g).slice(0, 3).map(Number).map(channel => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
      const surface = document.querySelector('.session-surface:not([hidden])');
      const status = surface.querySelector('[data-testid="working-status"]');
      const original = status?.className;
      const check = (selector, focus = false) => {
        const element = surface.querySelector(selector);
        const minimum = focus ? 3 : 4.5;
        if (!element || !element.checkVisibility({opacityProperty:true, visibilityProperty:true})) return {selector, ratio: 0, minimum};
        let node = element;
        while (node && getComputedStyle(node).backgroundColor === "rgba(0, 0, 0, 0)") node = node.parentElement;
        if (!node) return {selector, ratio: 0, minimum};
        const style = getComputedStyle(element);
        if (focus && (document.activeElement !== element || style.outlineStyle === 'none' || parseFloat(style.outlineWidth) < 2)) return {selector, ratio: 0, minimum};
        const ink = focus ? style.outlineColor : style.color;
        if (!ink.startsWith("rgb(") || !getComputedStyle(node).backgroundColor.startsWith("rgb(")) return {selector, ratio: 0, minimum};
        for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
          if (Number(getComputedStyle(ancestor).opacity) !== 1) return {selector, ratio: 0, minimum};
        }
        if (focus && -parseFloat(style.outlineOffset) < parseFloat(style.outlineWidth)) return {selector, ratio: 0, minimum};
        const fg = luminance(ink), bg = luminance(getComputedStyle(node).backgroundColor);
        return {selector, ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), minimum};
      };
      try {
        const text = ['main.work','textarea','.command-card .cmdline','.target-sidebar','[data-testid="resource-sidebar"]','.chat-markdown a'];
        const rows = text.map(selector => check(selector));
        for (const tone of ['waiting', 'failed']) {
          if (status) status.className = 'chat-working-status is-' + tone;
          rows.push(check('[data-testid="working-status"].is-' + tone));
        }
        return [...rows, check('textarea:focus-visible', true)];
      } finally { if (status) status.className = original; }
    })()`);
    if (!Array.isArray(ratios) || ratios.length !== 9 || ratios.some(row => typeof row.ratio !== "number" || !(row.ratio >= row.minimum))) throw Error("Basic 화면 명암비 부족: " + JSON.stringify(ratios));
    checks.push("Basic 화면 텍스트·초점 명암비 " + JSON.stringify(ratios));
    await session.screenshot("terminal-basic", ".session-surface:not([hidden]) main.work");
    await openPicker();
    await session.wait("document.querySelector('dialog[open] button[aria-pressed=true]')?.textContent==='Terminal Basic'", "Basic 기본 선택 표시");
    await key("Tab", 9);
    await session.wait("document.activeElement?.textContent==='WWW Mint'", "키보드로 WWW Mint 이동");
    await key(" ", 32, " ");
    await session.wait(`${mint} && ${focused} && !document.querySelector('dialog[open]')`, "키보드 적용·입력창 초점 복귀");
    await session.wait(mintPanels, "테마를 선택하면 대화 목록과 Agent 패널도 Mint로 전환");
    await session.wait("getComputedStyle(document.querySelector('.command-card')).backgroundColor==='rgb(20, 24, 21)'", "명령 카드의 배경색도 Mint로 전환");
    await openPicker();
    await key("Escape", 27);
    await session.wait(`${mint} && ${focused} && !document.querySelector('dialog[open]')`, "Escape 취소 시 테마·입력창 초점 유지");
    await session.click(".session-tab-create");
    await session.wait(`${mint} && document.querySelectorAll('main.work[data-chat-theme=www-mint]').length===2`, "기존 탭과 새 탭에 같은 테마 적용");
    await session.click("button[role=tab]");
    await openPicker();
    await fs.rename(themeFile, themeFile + ".preserved");
    await fs.mkdir(themeFile);
    try {
      await session.click("dialog[open] .chat-model-options button");
      await session.wait(`${mint} && document.querySelector('.chat-compose-note').textContent.includes('테마를 저장하지 못했습니다')`, "저장 실패 알림과 기존 테마 유지");
    } finally {
      await fs.rmdir(themeFile);
      await fs.rename(themeFile + ".preserved", themeFile);
    }
    const calls = (await fs.readFile(path.join(workspace, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => object(JSON.parse(line)));
    if (calls.some(call => call.method === "turn/start" || call.method === "turn/steer")) throw Error("테마 명령이 Native 사용자 요청을 발행했습니다.");
    await session.terminate();
    session = await start(2);
    await session.wait(`${mint} && ${mintPanels}`, "같은 앱 프로필 재시작 후 대화와 두 패널에 선택 테마 복원");
    await session.terminate();
    session = null;
    await fs.writeFile(themeFile, '"obsolete-theme"');
    session = await start(3);
    await session.wait(basic, "지원하지 않는 저장값에서 Basic 적용");
    await session.terminate();
    session = null;
    console.log(JSON.stringify({ evidence: directory, checks }));
    return;
  }
  if (process.argv.includes("--slash-only")) {
    const input = '[data-testid="prompt-input"]';
    const key = async (name: string, code: number) => {
      await session!.command("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
      await session!.command("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
    };
    const focusInput = async () => { await session!.evaluate("document.querySelector(" + JSON.stringify(input) + ").focus()"); };
    const turnStarts = async () => (await fs.readFile(path.join(workspace, "fixture-calls.jsonl"), "utf8").catch(() => "")).split("\n").filter(Boolean).map((line) => object(JSON.parse(line))).filter((call) => call.method === "turn/start").length;
    await session.input("/");
    await session.wait("document.querySelectorAll('[data-testid=slash-command-option]').length===3 && document.querySelector('[data-testid=slash-command-list]')", "빈 입력의 슬래시 명령 세 개 표시");
    await session.screenshot("slash-command-menu", '[data-testid="slash-command-list"]');
    await session.input("/mo");
    await session.wait("document.querySelectorAll('[data-testid=slash-command-option]').length===1 && document.querySelector('[data-testid=slash-command-option]').textContent==='/model'", "접두어에 따른 슬래시 명령 필터링");
    await focusInput();
    await key("Escape", 27);
    await session.wait("!document.querySelector('[data-testid=slash-command-list]') && document.querySelector(" + JSON.stringify(input) + ").value==='/mo'", "Escape로 메뉴만 닫고 초안 유지");
    await session.input("/");
    await focusInput();
    await key("ArrowUp", 38);
    await session.wait("document.querySelectorAll('[data-testid=slash-command-option]')[2]?.getAttribute('aria-selected')==='true'", "방향키로 앞 명령 선택");
    const before = await turnStarts();
    await key("Enter", 13);
    await session.wait("document.querySelector('dialog[open] h2')?.textContent==='채팅 테마 선택'", "Enter 선택은 기존 테마 명령 실행");
    if (await turnStarts() !== before) throw Error("슬래시 메뉴의 Enter 선택이 일반 turn/start를 발행했습니다.");
    await session.click("dialog[open] button:last-child");
    await session.wait("!document.querySelector('dialog[open]') && document.activeElement===document.querySelector(" + JSON.stringify(input) + ")", "테마 명령 취소 뒤 입력창 초점 복귀");
    await session.input("/the");
    await session.wait("document.querySelectorAll('[data-testid=slash-command-option]').length===1 && document.querySelector('[data-testid=slash-command-option]').textContent==='/theme'", "마우스 선택 전 theme 후보 확인");
    await session.click('[data-testid="slash-command-option"]');
    await session.wait("document.querySelector('dialog[open] h2')?.textContent==='채팅 테마 선택'", "마우스 선택은 기존 테마 명령 실행");
    if (await turnStarts() !== before) throw Error("슬래시 메뉴의 마우스 선택이 일반 turn/start를 발행했습니다.");
    await session.click("dialog[open] button:last-child");
    await session.wait("!document.querySelector('dialog[open]') && document.activeElement===document.querySelector(" + JSON.stringify(input) + ")", "마우스 테마 명령 취소 뒤 입력창 초점 복귀");
    const submit = async (value: string) => {
      await session!.input(value);
      await session!.click('[data-testid="send-button"]');
    };
    await submit("/compact");
    await session.wait("document.querySelector('.chat-compose-note').textContent.includes('압축할 이력')", "빈 대화 압축 방지");
    await submit("/model");
    await session.wait("document.querySelector('dialog[open] button[aria-pressed=true]')?.textContent==='기본 모델'", "현재 모델 선택기에 표시");
    await session.click('dialog[open] .chat-model-options button:nth-child(2)');
    await submit("/model");
    await session.wait("document.querySelector('dialog[open] button[aria-pressed=true]')?.textContent==='다른 모델'", "선택한 모델 유지");
    await session.click('dialog[open] > button');
    await session.wait("document.activeElement===document.querySelector('[data-testid=\"prompt-input\"]')", "모델 선택 취소 시 입력창으로 초점 복귀");
    const hideOtherModel = path.join(workspace, "fixture-hide-other-model");
    await fs.writeFile(hideOtherModel, "hide");
    try {
      await submit("/model");
      await session.wait("document.querySelector('[data-testid=\"unavailable-current-option\"]')?.textContent.includes('fixture-other') && document.querySelector('dialog[open] .chat-model-options').textContent.includes('기본 모델') && !document.querySelector('dialog[open] button[aria-pressed=true]')", "목록에서 빠진 현재 모델과 선택 가능한 모델을 함께 표시");
      await session.click('dialog[open] > button');
    } finally {
      await fs.rm(hideOtherModel);
    }
    await submit("/model이 아닌 일반 요청");
    await session.wait("document.querySelector('[data-testid=\"working-status\"]').textContent.includes('응답 종료')", "문장에 포함된 슬래시 일반 전송");
    const rejectCompaction = path.join(workspace, "fixture-compact-reject");
    await fs.writeFile(rejectCompaction, "reject");
    try {
      await submit("/compact");
      await session.wait("document.querySelector('.chat-compose-note').textContent.includes('합성 압축 요청 거절') && !document.querySelector('.chat-compose-note').textContent.includes('대화 압축 중')", "Native 접수 거절 알림과 압축 잠금 해제");
    } finally {
      await fs.rm(rejectCompaction);
    }
    await submit("/compact");
    await session.wait("document.querySelector('.chat-compose-note').textContent.includes('대화 압축 중')", "Native 압축 진행 표시");
    await session.wait("document.querySelector('.chat-compose-note').textContent.includes('대화 압축 완료')", "Native 압축 완료 표시");
    await submit("성능 스트리밍 중단 확인");
    await session.wait("document.querySelector('[data-testid=interrupt-button]')", "실행 중 입력 상태");
    await session.input("/");
    await session.wait("!document.querySelector('[data-testid=slash-command-list]')", "실행 중에는 슬래시 명령을 열지 않음");
    await session.click('[data-testid="interrupt-button"]');
    await session.wait("!document.querySelector('[data-testid=interrupt-button]')", "중단 뒤 슬래시 명령 입력 게이트 해제");
    const calls = (await fs.readFile(path.join(workspace, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => object(JSON.parse(line)));
    const turns = calls.filter(call => call.method === "turn/start");
    const compactions = calls.filter(call => call.method === "thread/compact/start");
    if (turns.length !== 2 || compactions.length !== 2 || object(turns[1]?.params).model !== "fixture-other" ||
      compactions.some(call => object(call.params).threadId !== object(turns[1]?.params).threadId) || calls.some(call => call.method === "turn/steer")) {
      throw Error("슬래시 명령의 stdio 전달 범위가 일치하지 않습니다.");
    }
    await session.terminate();
    session = null;
    const summary = { result: "passed", scope: "slash-only", evidence: directory, checks: [...checks, "슬래시 메뉴의 키보드·마우스 선택은 기존 명령을 실행하고 turn/start를 발행하지 않음"] };
    await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
    return;
  }
  if (process.argv.includes('--performance-only')) {
    const measure = async (label: string) => {
      const value = await session!.evaluate(`(async()=>{
        const node=document.querySelector('[data-testid="prompt-input"]');
        const probe=await window.www.probeReady();
        if (!probe.windowVisible || document.visibilityState!=="visible") throw Error("표시된 Electron 창에서만 입력 성능을 측정합니다.");
        const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
        const durations=[], tasks=[];let mutations=0;
        const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));
        observer.observe({type:'longtask',buffered:false});
        const changes=new MutationObserver(records=>{mutations+=records.length});
        document.querySelectorAll('.command-card').forEach(card=>changes.observe(card,{childList:true,subtree:true,characterData:true}));
        node.focus();
        for(let i=0;i<40;i++){
          const before=performance.now();setter.call(node,'입력 계측 '+i+' 가운데 편집');node.dispatchEvent(new Event('input',{bubbles:true}));
          await new Promise(resolve=>requestAnimationFrame(resolve));
          if (document.hidden || document.activeElement!==node) throw Error("표본 수집 중 창 가시성 또는 입력 포커스 변경");
          durations.push(performance.now()-before);
          if(node.value!=='입력 계측 '+i+' 가운데 편집')throw Error('입력 원문 누락');
        }
        changes.disconnect();observer.disconnect();durations.sort((a,b)=>a-b);
        return {windowVisible:probe.windowVisible,visibility:document.visibilityState,samples:durations.length,p50:durations[19],p95:durations[37],max:durations.at(-1),longTasks:tasks,commandDomMutations:mutations,commands:document.querySelectorAll('.command-card').length,viewport:{width:innerWidth,height:innerHeight},userAgent:navigator.userAgent};
      })()`);
      metrics.push({label,...object(value)});
    };
    await measure('short');
    await session.click('[data-thread-id="history-a"]');
    await session.wait("document.querySelectorAll('.command-card').length>=65", '성능 최대 보관 출력·완료 카드 60개 복원');
    await measure('long-idle');
    const scrollStart=await session.evaluate(`(() => {
      const node=document.querySelector('.transcript');node.scrollTop=0;
      const r=node.getBoundingClientRect();const intervals=[];let last=performance.now();
      window.__wwwBenchScroll={intervals,active:true,start:node.scrollTop};
      const step=now=>{if(!window.__wwwBenchScroll.active)return;intervals.push(now-last);last=now;requestAnimationFrame(step);};
      requestAnimationFrame(step);
      return {x:Math.floor(r.x+r.width/2),y:Math.floor(r.y+r.height/2),max:node.scrollHeight-node.clientHeight};
    })()`);
    for(let n=0;n<12;n++){
      await session.command('Input.dispatchMouseEvent',{type:'mouseWheel',x:object(scrollStart).x,y:object(scrollStart).y,deltaX:0,deltaY:120});
      await pause(20);
    }
    const scroll=await session.evaluate(`(() => {
      const state=window.__wwwBenchScroll;state.active=false;
      const node=document.querySelector('.transcript');const intervals=state.intervals.slice(1).sort((a,b)=>a-b);
      return {samples:intervals.length,scrolled:node.scrollTop-state.start,p95:intervals[Math.ceil(intervals.length*.95)-1],max:intervals.at(-1)};
    })()`);
    if(Number(object(scroll).scrolled)<=0||Number(object(scroll).samples)<10)throw Error('휠 스크롤 프레임이 확인되지 않았습니다.');
    metrics.push({label:'scroll-long-idle',...object(scroll)});
    await session.input('성능 스트리밍 중단 확인');
    await session.click('[data-testid="send-button"]');
    await session.wait("document.querySelector('[data-testid=\"interrupt-button\"]')", '성능 실행 중 상태');
    await measure('long-running');
    const serialization = await session.evaluate(`(async()=>{
      const original=JSON.stringify;
      let calls=0, units=0;
      JSON.stringify=function(value,...rest){
        if(value?.kind==="command" && typeof value.output==="string"){calls++;units+=value.output.length;}
        return original.call(JSON,value,...rest);
      };
      const transcript=document.querySelector('.transcript');
      let mutations=0;
      const observer=new MutationObserver(changes=>{mutations+=changes.length;});
      observer.observe(transcript,{childList:true,characterData:true,subtree:true});
      try{await new Promise(done=>setTimeout(done,350));}
      finally {JSON.stringify=original;observer.disconnect();}
      return {calls,units,mutations};
    })()`);
    metrics.push({label:"stream-command-serialization",...object(serialization)});
    await session.screenshot('performance');await session.terminate();session=null;
    await fs.writeFile(path.join(directory,'performance.json'),JSON.stringify({metrics,checks,build:JSON.parse(await fs.readFile(path.join(root,'dist/build-info.json'),'utf8')),limitations:['합성 input→다음 frame 근사이며 OS 키보드/IME·React commit 측정과 다름','현재 fixture 실행 상태의 출력 빈도에 한정','최대 사건 2000개 경계는 별도 projection 집중검사']},null,2));
    console.log(JSON.stringify({evidence:directory,metrics}));return;
  }
  if (process.argv.includes("--steer-tabs-only")) {
    const active = ".session-surface:not([hidden])";
    const send = '[data-testid="send-button"]';
    const draft = '[data-testid="prompt-input"]';
    const requests = '[data-testid="user-request"]';
    await session.input("탭 격리 중단 확인");
    await session.click(send);
    await session.wait("document.querySelector('[data-testid=send-button]').textContent.includes('Steer')", "첫 탭에서 활성 턴 확인");
    const prefix = "첫 추가 지시 ";
    await session.input(prefix + "가");
    await session.evaluate("(" + dispatchImeGesture.toString() + ")(\"반복\"," + JSON.stringify(prefix) + ")");
    await session.wait("Array.from(document.querySelectorAll('[data-testid=user-request]')).some(row=>row.textContent.includes('첫 추가 지시') && row.textContent.includes('접수됨'))", "첫 추가 지시 접수");
    await session.input("대기 추가 지시");
    await session.click(send);
    await session.wait("document.querySelector('[data-testid=send-button]').disabled", "두 번째 추가 지시 접수 대기");
    await session.click(".session-tab-create");
    await session.wait("document.querySelectorAll('.session-surface').length===2 && !document.querySelectorAll('.session-surface')[1].hidden", "두 번째 탭으로 전환");
    const otherInput = JSON.stringify(active + " " + draft);
    await session.evaluate(`(() => { const node=document.querySelector(${otherInput});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(node,'둘째 탭 초안');node.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await fs.writeFile(path.join(workspace,"fixture-steer-release"),"release");
    await session.wait("Array.from(document.querySelectorAll('.session-surface[hidden] [data-testid=user-request]')).some(row=>row.textContent.includes('대기 추가 지시') && row.textContent.includes('접수됨'))", "배경 첫 탭에서 두 번째 지시 접수");
    const visibleRows = JSON.stringify(active + " " + requests);
    await session.wait(`document.querySelector(${otherInput}).value==='둘째 탭 초안' && document.querySelectorAll(${visibleRows}).length===0`, "현재 탭에 첫 탭 지시 유입 없이 초안 보존");
    await session.click("button[role=tab]");
    await session.wait("Array.from(document.querySelectorAll('.session-surface:not([hidden]) [data-testid=user-request]')).filter(row=>row.textContent.includes('접수됨')).length===2", "첫 탭 복귀 후 두 지시 각각 한 번 접수");
    const calls = (await fs.readFile(path.join(workspace,"fixture-calls.jsonl"),"utf8")).trim().split("\n").map(line=>object(JSON.parse(line)));
    const starts = calls.filter(call=>call.method==="turn/start");
    const steers = calls.filter(call=>call.method==="turn/steer").map(call=>object(call.params));
    const turns = steers.map(steer=>steer.expectedTurnId);
    const ids = steers.map(steer=>steer.clientUserMessageId);
    const texts = steers.map(steer=>Array.isArray(steer.input) && object(steer.input[0]).text);
    if (starts.length!==1 || steers.length!==2 || calls.some(call=>call.method==="turn/interrupt") ||
        !turns[0] || new Set(turns).size!==1 || ids.some(id=>!id) || new Set(ids).size!==2 ||
        steers.some(steer=>steer.threadId!==object(starts[0]?.params).threadId) ||
        JSON.stringify(texts)!==JSON.stringify(["첫 추가 지시 각","대기 추가 지시"])) throw Error("탭 사이의 Native 호출 또는 지시 원문 불일치");
    await session.terminate();session=null;
    await fs.writeFile(path.join(directory,"steer-tabs.json"),JSON.stringify({checks,starts:starts.length,steers},null,2));
    console.log(directory);return;
  }
  if (process.argv.includes("--side-question-only")) {
    const active = '[role=tabpanel]:not([hidden])';
    const side = active + ' [data-testid="side-question"]';
    const approval = active + " .approval.open";
    await session.click('[data-thread-id="history-a"]');
    await session.wait("document.querySelector('[data-thread-id=history-a]')?.getAttribute('aria-current')==='true' && document.querySelector('.transcript')?.textContent.includes('이어갈 작업')", "현재 저장 대화의 공개 맥락 준비");
    await session.input("/bt");
    await session.wait("document.querySelector('[data-testid=slash-command-option]')?.textContent==='/btw'", "슬래시 목록에서 사이드 질문 발견");
    await session.click('[data-testid="slash-command-option"]');
    await session.wait("document.querySelector('.chat-compose-note')?.textContent.includes('짧은 질문을 입력')", "인자 없는 사이드 명령 사용법 안내");
    await session.input("경계 사이드 질문 승인 대기");
    await session.click('[data-testid="send-button"]');
    await session.wait(`document.querySelector(${JSON.stringify(approval)})?.textContent.includes('printf side-question-approval')`, "기본 턴의 승인 요청을 열린 상태로 유지");
    await session.input("/btw 저장된 대화의 다음 작업은?");
    await session.click(active + ' [data-testid="send-button"]');
    await session.wait(`document.querySelector(${JSON.stringify(side)})?.textContent.includes('저장 대화 맥락에서 읽은 별도 답변') && !!document.querySelector(${JSON.stringify(approval)}) && !document.querySelector(${JSON.stringify(active + ' .transcript')})?.textContent.includes('저장 대화 맥락에서 읽은 별도 답변')`, "실행 중 별도 답변 완료, 원래 승인과 이력 유지");
    await session.click(".session-tab-create");
    await session.wait(`document.querySelectorAll('[role=tab]').length===2 && document.querySelector('[role=tablist] .session-tab-item:last-child [role=tab]').getAttribute('aria-selected')==='true' && !document.querySelector(${JSON.stringify(side)})`, "새 탭에서 원래 사이드 질문과 답변이 보이지 않음");
    await session.click('[role=tablist] .session-tab-item:first-child [role=tab]');
    await session.wait(`!!document.querySelector(${JSON.stringify(side)}) && !!document.querySelector(${JSON.stringify(approval)})`, "원래 탭의 질문·답변과 승인이 유지됨");
    await session.click(approval + ' [data-decision="accept"]');
    await session.wait(`!document.querySelector(${JSON.stringify(approval)}) && document.querySelector(${JSON.stringify(active + ' .transcript')})?.textContent.includes('후속 요청 완료')`, "사이드 답변 후 기본 턴을 계속 완료");
    await session.evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(active + " textarea")});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'/btw 사이드 실패 확인');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await session.click(active + ' [data-testid="send-button"]');
    await session.wait(`document.querySelector(${JSON.stringify(side)})?.textContent.includes('사이드 질문 실행에 실패')`, "사이드 프로세스 오류를 해당 탭에 표시");
    const calls = (await fs.readFile(path.join(workspace, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => object(JSON.parse(line)));
    const turns = calls.filter(call => call.method === "turn/start");
    if (turns.length !== 1 || !JSON.stringify(turns[0]).includes("경계 사이드 질문 승인 대기") || calls.some(call => call.method === "turn/steer" || call.method === "thread/fork")) throw Error("사이드 질문이 기본 Native 턴으로 전달되었습니다.");
    checks.push("기본 Native 연결에는 초기 턴 1회, 사이드 질문과 추가 지시 0회");
    await session.terminate();
    session = null;
    const summary = { result: "passed", scope: "side-question-only", evidence: directory, checks };
    await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
    return;
  }
  if (process.argv.includes('--steer-only')) {
    await session.input('스트리밍 이력 절단 중단 확인');await session.click('[data-testid="send-button"]');
    await session.wait(`(async()=>{const events=await window.www.workspace().then(scope=>window.www.events(scope));
      return events.length===2000 && !events.some(event=>['transport/connected','turn/started','turn/startAccepted'].includes(event.method))
        && document.querySelector('.transcript').textContent.includes('이력 절단 뒤에도 들어온 응답');})()`, '연결과 턴 시작이 이력에서 밀려난 뒤에도 스트리밍 표시');
    await session.wait("document.querySelector('[data-testid=\"working-status\"]').textContent.includes('Working') && document.querySelector('[data-testid=\"send-button\"]').textContent.includes('Steer')", '같은 입력창의 Steer와 고정 Working');
    await session.wait("document.querySelector('.agentmark')?.nextElementSibling?.textContent==='실행 중' && document.querySelector('footer.status').textContent.includes('연결 connected') && document.querySelector('footer.status').textContent.includes('실행 중')", '이력이 잘려도 사이드바와 하단에 현재 실행 상태 표시');
    await session.click('[data-testid="monitoring-nav"]');
    await session.click('.panel button.ptab:nth-of-type(3)');
    await session.wait("document.querySelector('.panel .headline .h')?.textContent==='실행 중' && document.querySelector('.panel .headline .sub')?.textContent.includes('연결 connected') && document.querySelector('.panel .headline .sub')?.textContent.includes('턴 running')", '상세 모니터에도 현재 Native 연결과 실행 턴 표시');
    await session.click('.panel button[aria-label="상세 모니터 닫기"]');
    await session.input('대기 추가 지시');await session.click('[data-testid="send-button"]');
    await session.input('접수 중 작성한 다음 초안');
    await session.wait("document.querySelector('[data-testid=\"send-button\"]').disabled && !document.querySelector('[data-testid=\"prompt-input\"]').disabled", '추가 지시 pending 중 편집 허용·중복 전송 잠금');
    await session.evaluate("document.querySelector('[data-testid=\"send-button\"]').click()");
    await fs.writeFile(path.join(workspace,'fixture-steer-release'),'release');
    await session.wait("Array.from(document.querySelectorAll('[data-testid=\"user-request\"]')).some(node=>node.textContent.includes('대기 추가 지시')&&node.textContent.includes('접수됨')) && document.querySelector('[data-testid=\"prompt-input\"]').value==='접수 중 작성한 다음 초안'", '접수는 원문과 다음 초안을 보존하고 반영 완료와 구분');
    await session.input('대기 추가 지시');await session.click('[data-testid="send-button"]');
    await session.wait("Array.from(document.querySelectorAll('[data-testid=\"user-request\"]')).filter(node=>node.textContent.includes('대기 추가 지시')&&node.textContent.includes('접수됨')).length===2", '같은 원문 두 번의 의도적 추가 지시는 두 메시지');
    await session.input('mismatch');await session.click('[data-testid="send-button"]');
    await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value==='mismatch' && document.querySelector('.transcript').textContent.includes('접수 여부 미확인')", '응답 턴 불일치는 미확인과 원문 복원·자동재전송 없음');
    await session.click('[data-testid="view-page-nav"]');
    await session.wait("!document.querySelector('main.work').hidden", '실행 중 프로젝트 목록은 중앙 대화를 유지');
    await session.click('[data-testid="project-list-close"]');
    await session.click('[data-testid="monitoring-nav"]');await session.screenshot('steer-monitoring');
    await session.click('[data-testid="monitoring-return-chat"]');
    await session.wait("document.querySelector('[data-testid=\"working-status\"]').textContent.includes('Working')", '모니터 왕복에도 같은 활성 턴 유지');
    await session.click('[data-testid="interrupt-button"]');
    await session.wait("!document.querySelector('[data-testid=\"interrupt-button\"]')", '별도 중단 조작 후 실제 턴 종료');
    await session.wait("document.querySelector('[data-testid=\"working-status\"]').textContent.includes('중단됨') && document.querySelector('[data-testid=\"result-summary\"] .result-summary-heading')?.textContent.includes('중단됨')", '시작 사건이 잘린 뒤에도 실제 중단 결과와 요약 표시');
    const calls=(await fs.readFile(path.join(workspace,'fixture-calls.jsonl'),'utf8')).trim().split('\n').map(line=>object(JSON.parse(line)));
    const turns=calls.filter(call=>call.method==='turn/start'), steers=calls.filter(call=>call.method==='turn/steer'), stops=calls.filter(call=>call.method==='turn/interrupt');
    if(turns.length!==1||steers.length!==3||stops.length!==1||new Set(steers.map(call=>object(call.params).clientUserMessageId)).size!==3||new Set(steers.map(call=>object(call.params).expectedTurnId)).size!==1)throw Error('Steer 실제 stdio 중복/같은턴 경계 오류');
    await session.input('스트리밍 승인 보존');
    await session.click('[data-testid="send-button"]');
    await session.wait(`(async()=>{const scope=await window.www.workspace();const events=await window.www.events(scope);
      return events.length===2000 && !events.some(event=>event.kind==='request') && Array.from(document.querySelectorAll('.approval.open')).some(node=>node.textContent.includes('printf retained-approval') && !node.querySelector('[data-decision="decline"]')?.disabled);})()`, '원본 승인 사건이 이력에서 빠져도 거절 버튼을 제공');
    await session.click('.approval.open [data-decision="decline"]');
    await session.wait("!document.querySelector('.approval.open') && document.querySelector('[data-testid=\"working-status\"]').textContent.includes('응답 종료')", '보존한 승인 요청을 실제 거절하면 대기가 해소됨');
    await session.terminate();session=null;await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify({result:'passed',scope:'steer-only',checks,turnStarts:turns.length,steers:steers.length,interrupts:stops.length,limitations:['합성 Native 및 실제 Electron. 실제 모델의 추가 지시 반영과 OS IME는 별도 근거']},null,2));console.log(JSON.stringify({evidence:directory,checks}));return;
  }
  let falsePredicateRejected = false;
  try { await session.wait("Promise.resolve(false)", "의도적인 비동기 false 조건", 100); }
  catch (error) {
    if (!String(error).includes("화면 조건 실패: 의도적인 비동기 false 조건")) throw error;
    falsePredicateRejected = true;
  }
  if (!falsePredicateRejected) throw Error("비동기 false 조건을 참으로 오인했습니다.");
  checks.push("실제 비동기 false 조건은 대기 만료로 거부");
  const a = '[data-thread-id="history-a"]' ;
  const b = '[data-thread-id="history-b"]' ;
  await session.click(a);
  await session.wait("document.querySelector('.chat-markdown h2')?.textContent==='저장된 답변'", "저장 대화 Markdown 복원");
  metrics.push({ label: "renderer timing", entries: await session.evaluate("performance.getEntriesByName('www:renderer-commit-frame').map(e=>({name:e.name,startTime:e.startTime,detail:e.detail}))") });
  await session.wait("document.querySelector('.chat-markdown table') && document.querySelector('.chat-code pre')", "표와 fenced code 실제 DOM");
  await session.wait("!document.body.innerText.includes('PRIVATE_REASONING_DO_NOT_RENDER')", "비공개 reasoning 미노출");
  await session.wait("document.querySelector('[data-testid=\"command-preview\"]')?.textContent.split('\\n').length===10", "명령 카드 10줄 미리보기");
  await session.wait("document.querySelector('[data-testid=\"command-preview\"]')?.textContent.startsWith('    명령 출력 1')", "명령 출력 들여쓰기와 종료 후 앞 10줄");
  const savedCard = '.command-card:has(.cmdline[aria-label="실행 명령"])';
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some(c=>c.querySelector('.cmdline')?.textContent==='printf failed' && c.querySelectorAll('pre').length===1 && !c.querySelector('[aria-expanded]') && c.querySelector('pre').textContent.includes('오류 확인'))", "짧은 실패 출력은 단일 pre에 전체 표시하고 확장 버튼 없음");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some(c=>c.innerText.includes('printf truncated') && c.innerText.includes('제거된 원본 줄 수는 미확인') && c.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')==='true' && c.querySelectorAll('pre').length===1)", "한도 초과 실패 출력 자동 펼침과 보관 범위 안내");
  await session.click(savedCard + ' [aria-expanded]');
  await session.wait("document.querySelector('.command-card.item-completed [aria-expanded]')?.getAttribute('aria-expanded')==='true'", "보관된 전체 출력 펼치기");
  await session.click(savedCard + ' [aria-expanded]');
  await session.wait("document.querySelector('.command-card.item-completed [aria-expanded]')?.getAttribute('aria-expanded')==='false' && document.querySelector('.command-card.item-completed').querySelectorAll('pre').length===1 && !document.querySelector('.command-card.item-completed pre').textContent.includes('명령 출력 11')", "접힌 출력은 단일 pre에 앞 10줄만 표시");
  const reviewCard  = '.command-card:has(.command-review)' ;
  const cardSession = session                              ;
  const activateByKey = async (selector: string, label: string, space = false) => {
    await cardSession.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await cardSession.wait(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`, label + ' 포커스');
    const key     = space ? ' ' : 'Enter'     ;
    const code    = space ? 'Space' : 'Enter' ;
    const text    = space ? ' ' : '\r'        ;
    const keyCode = space ? 32 : 13           ;
    await cardSession.command('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text, unmodifiedText: text, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await cardSession.command('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  };

  const toggleShortcut = async (selector: string) => {
    await cardSession.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await cardSession.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 't', code: 'KeyT', modifiers: 2, windowsVirtualKeyCode: 84, nativeVirtualKeyCode: 84 });
    await cardSession.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 't', code: 'KeyT', modifiers: 2, windowsVirtualKeyCode: 84, nativeVirtualKeyCode: 84 });
  };
  await toggleShortcut(savedCard + ' pre');
  await session.wait(`document.querySelector(${JSON.stringify(savedCard)}).querySelector('[aria-expanded]').getAttribute('aria-expanded')==='true' && document.querySelector('${reviewCard} [aria-expanded]').getAttribute('aria-expanded')==='false'`, 'Ctrl+T는 포커스된 첫 카드만 펼침');
  await toggleShortcut(reviewCard + ' pre');
  await session.wait(`document.querySelector(${JSON.stringify(savedCard)}).querySelector('[aria-expanded]').getAttribute('aria-expanded')==='true' && document.querySelector('${reviewCard} [aria-expanded]').getAttribute('aria-expanded')==='true'`, 'Ctrl+T는 두 번째 카드만 독립 전환');
  await toggleShortcut(savedCard + ' pre');
  await toggleShortcut(reviewCard + ' pre');
  await session.wait(`document.querySelector(${JSON.stringify(savedCard)}).querySelector('[aria-expanded]').getAttribute('aria-expanded')==='false' && document.querySelector('${reviewCard} [aria-expanded]').getAttribute('aria-expanded')==='false'`, '각 카드 Ctrl+T 접힘 독립 유지');
  await session.wait(`(() => { const c=document.querySelector('${reviewCard}'); return c?.innerText.includes('실행 종료') && c.innerText.includes('종료 코드 0') && c.innerText.includes('미실행') && c.innerText.includes('보고값') && c.querySelector('[data-testid="command-preview"]').textContent.includes('\\n  "id": "review-readable"'); })()`, "종료 코드 0과 검토 미실행 분리·JSON 2칸 정렬");
  await session.wait(`(() => { const c=document.querySelector('${reviewCard}'); const key=c.querySelector('.syntax-key'); const string=c.querySelector('pre .syntax-string'); const number=c.querySelector('pre .syntax-number'); const literal=c.querySelector('pre .syntax-literal'); return [key,string,number,literal].every(Boolean) && new Set([key,string,number,literal].map(n=>getComputedStyle(n).color)).size===4 && c.querySelector('.cmdline .syntax-option') && c.querySelector('.cmdline').scrollWidth<=c.querySelector('.cmdline').clientWidth+1; })()`, "실제 JSON 4종 색상·셸 옵션 강조·명령 줄바꿈");
  await activateByKey(reviewCard + ' [aria-expanded]', '출력 펼침 Enter');
  await session.wait(`document.querySelector('${reviewCard} pre').textContent.includes('9007199254740993') && document.querySelector('${reviewCard} pre').scrollWidth<=document.querySelector('${reviewCard} pre').clientWidth+1`, "정렬된 전체 출력의 큰 정수 보존·긴 줄 줄바꿈");
  await session.evaluate(`document.querySelector('${reviewCard}').scrollIntoView({block:'start'})`);
  await session.screenshot('command-json-formatted');
  await session.evaluate(`document.querySelector('${reviewCard} button[aria-pressed]').focus()`);
  await session.wait(`document.activeElement===document.querySelector('${reviewCard} button[aria-pressed]')`, "원문 전환 버튼 키보드 포커스");
  await session.command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.wait(`document.querySelector('${reviewCard} button[aria-pressed]').getAttribute('aria-pressed')==='true' && document.querySelector('${reviewCard} pre').textContent===` + JSON.stringify(reviewOutput), "키보드 원문 전환과 종료 개행까지 원본 일치");
  await activateByKey(reviewCard + ' .command-output-tools button:last-of-type', '원문 복사 Enter');
  await session.wait(`document.querySelector('${reviewCard} [role="status"]').textContent==='원문 복사됨'`, "원문 클립보드 쓰기 성공 안내");
  await session.wait("navigator.clipboard.readText().then(text=>text===" + JSON.stringify(reviewOutput) + ")", "실제 클립보드 원문 완전 일치");
  await session.click(reviewCard + ' button[aria-pressed]');
  await activateByKey(reviewCard + ' [aria-expanded]', '출력 접기 Space', true);
  await session.wait(`document.querySelector('${reviewCard} [aria-expanded]').getAttribute('aria-expanded')==='false' && document.querySelector('${reviewCard} [data-testid="command-preview"]').getBoundingClientRect().height>0`, 'Space로 출력 한 번 접기·미리보기 유지');
  await session.evaluate("(() => { const c=Array.from(document.querySelectorAll('.command-card')).find(n=>n.innerText.includes('printf truncated')); c.scrollIntoView({block:'start'}); c.querySelector('pre').scrollTop=c.querySelector('pre').scrollHeight; })()");
  const wheelBefore = object(await session.evaluate(`(() => { const t=document.querySelector('.transcript'); const p=Array.from(document.querySelectorAll('.command-card')).find(n=>n.innerText.includes('printf truncated')).querySelector('pre'); const r=p.getBoundingClientRect(); const input=document.querySelector('[data-testid="prompt-input"]').getBoundingClientRect(); return { x:r.left+Math.min(20,r.width/2), y:Math.max(0,Math.min(innerHeight-1,r.top+Math.min(20,r.height/2))), transcript:t.scrollTop, document:document.documentElement.scrollTop, body:document.body.scrollTop, input:{x:input.x,y:input.y,width:input.width,height:input.height} }; })()`));
  await session.command('Input.dispatchMouseEvent', { type: 'mouseWheel', x: wheelBefore.x, y: wheelBefore.y, deltaX: 0, deltaY: 400 });
  await pause(150);
  checks.push('출력 내부 끝에서 실제 휠 입력');
  const blankPoint = object(await session.evaluate(`(() => { const t=document.querySelector('.transcript'); const r=t.getBoundingClientRect(); return {x:r.right-3,y:r.top+3,top:t.scrollTop}; })()`));
  await session.command('Input.dispatchMouseEvent', { type: 'mouseWheel', x: blankPoint.x, y: blankPoint.y, deltaX: 0, deltaY: -300 });
  await session.wait(`document.querySelector('.transcript').scrollTop<${blankPoint.top}`, '대화 빈 영역 휠은 대화 스크롤');
  const wheelAfter = object(await session.evaluate(`(() => { const input=document.querySelector('[data-testid="prompt-input"]').getBoundingClientRect(); return {document:document.documentElement.scrollTop,body:document.body.scrollTop,input:{x:input.x,y:input.y,width:input.width,height:input.height}}; })()`));
  metrics.push({ label: '실제 CDP 휠 전후', before: wheelBefore, after: wheelAfter });
  if (wheelAfter.document !== wheelBefore.document || wheelAfter.body !== wheelBefore.body || JSON.stringify(wheelAfter.input) !== JSON.stringify(wheelBefore.input)) throw Error('휠이 문서 또는 입력 위치를 변경했습니다: ' + JSON.stringify({ wheelBefore, wheelAfter }));
  checks.push('실제 휠 전후 문서 scrollTop과 입력 사각형 불변');
  await session.evaluate("(() => { const transcript=document.querySelector('.transcript'); transcript.scrollTop=transcript.scrollHeight; transcript.dispatchEvent(new Event('scroll')); })()");
  await session.wait("(() => { const t=document.querySelector('.transcript'); const last=document.querySelector('.agent .chat-markdown>:last-child'); const input=document.querySelector('.compose'); return last.textContent.includes('마지막 문장 접근 확인') && last.getBoundingClientRect().bottom<=t.getBoundingClientRect().bottom+1 && t.getBoundingClientRect().bottom<=input.getBoundingClientRect().top+1; })()", "긴 답변 마지막 문장과 입력창 분리");
  await session.measureLayout("기준선 DOM 치수");
  await session.wait("document.documentElement.scrollWidth<=window.innerWidth && document.querySelector('.chat-code pre').scrollWidth<=document.querySelector('.chat-code pre').clientWidth+1", "긴 URL과 코드 줄바꿈으로 가로 넘침 방지");
  for (const [width, height] of [[1040, 680], [1040, 900], [1440, 680], [860, 680], [1440, 900]]) {
    await session.command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await session.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    const measurement = await session.measureLayout(`viewport ${width}x${height}`);
    if (object(measurement.viewport).width !== width || object(measurement.viewport).height !== height || !Array.isArray(measurement.failures) || measurement.failures.length) throw Error("창 치수 검증 실패: " + JSON.stringify(measurement));
    checks.push(`창 ${width}x${height} 전체 넘침·프레임 가시 범위·본문 세로 이동·코드/긴 표 가로 이동`);
    await session.wait("(() => { const t=document.querySelector('.transcript'); const input=document.querySelector('.compose'); return t.clientHeight>0 && t.getBoundingClientRect().bottom<=input.getBoundingClientRect().top+1 && input.getBoundingClientRect().bottom<window.innerHeight && document.documentElement.scrollWidth<=window.innerWidth; })()", `창 폭 ${width}에서 본문·입력 접근`);
    await session.wait(`(() => { const c=document.querySelector('${reviewCard}'); const t=document.querySelector('.transcript'); return c.getBoundingClientRect().width<=t.clientWidth && c.querySelector('.cmdline').scrollWidth<=c.querySelector('.cmdline').clientWidth+1 && document.documentElement.scrollWidth<=innerWidth; })()`, `창 ${width} 명령 카드 가로 넘침 격리`);
    await session.screenshot(height === 900 ? `chat-width-${width}` : `chat-viewport-${width}x${height}`);
  }
  if (process.argv.includes('--command-cards')) {
    await session.terminate();
    session = null;
    const summary = { ok: true, scope: 'command-cards', evidence: directory, fixture: '합성 Native 이력의 명령 카드·원문·클립보드·폭별 레이아웃만 검사. 실제 모델·후속 재연결·Windows·OS IME는 미검증.', checks, metrics };
    await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
    return;
  }
  const panelState = (sidebar: boolean, detail: boolean, _sidebarEnabled = sidebar) => `(() => {
    const visible = node => node instanceof HTMLElement && node.getClientRects().length>0 && node.getBoundingClientRect().width>0;
    return visible(document.querySelector('[data-testid="resource-sidebar"]'))===${sidebar} && visible(document.querySelector('[data-testid="activity-panel"]'))===${detail};
  })()`;
  const wheelFrame = async (selector: string, atEnd: boolean, label: string) => {
    const before = object(await cardSession.evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(${atEnd})node.scrollTop=node.scrollHeight; const r=node.getBoundingClientRect(); const input=document.querySelector('[data-testid="prompt-input"]').getBoundingClientRect(); return { x:r.right-4,y:r.top+4,document:document.documentElement.scrollTop,body:document.body.scrollTop,input:{x:input.x,y:input.y,width:input.width,height:input.height} }; })()`));
    await cardSession.command('Input.dispatchMouseEvent', { type: 'mouseWheel', x: before.x, y: before.y, deltaX: 0, deltaY: 400 });
    await pause(150);
    const after = object(await cardSession.evaluate(`(() => { const input=document.querySelector('[data-testid="prompt-input"]').getBoundingClientRect(); return {document:document.documentElement.scrollTop,body:document.body.scrollTop,input:{x:input.x,y:input.y,width:input.width,height:input.height}}; })()`));
    metrics.push({ label, before, after });
    if (after.document !== before.document || after.body !== before.body || JSON.stringify(after.input) !== JSON.stringify(before.input)) throw Error(label + ' 프레임 이동: ' + JSON.stringify({ before, after }));
    checks.push(label + ' 실제 휠 뒤 문서 scrollTop·입력 사각형 유지');
  };
  await session.wait(panelState(true,false), '기본 Agent 개요와 모니터링 분리');
  await session.wait("document.querySelectorAll('[data-testid=\"resource-sidebar\"] [data-skill-id]').length===5 && !document.querySelector('[data-testid=\"resource-sidebar\"] [data-testid=\"activity-hook-row\"]')", '기본 Skills 다섯 개와 상세 Hook 분리');
  await session.wait("!document.querySelector('[data-testid=\"detail-monitor-toggle\"]') && !document.querySelector('[data-testid=\"resource-sidebar-toggle\"]')", '기존 토글은 DOM과 초점 순서에 없음');
  await session.input('모니터 전환 뒤 보존할 초안');
  await session.evaluate("(()=>{const t=document.querySelector('.transcript');t.scrollTop=80;t.dispatchEvent(new Event('scroll'));})()");
  const monitorScrollTop = Number(await session.evaluate("document.querySelector('.transcript').scrollTop"))                                                                                                ;
  const chatPreserved    = `document.querySelector('[data-testid="prompt-input"]').value==='모니터 전환 뒤 보존할 초안' && Math.abs(document.querySelector('.transcript').scrollTop-${monitorScrollTop})<2` ;
  await session.click('[data-testid="view-page-nav"]');
  await session.wait("document.querySelector('.home-sidebar') && !document.querySelector('main.work').hidden", '프로젝트 목록 탐색 중 중앙 대화 유지');
  await session.click('[data-testid="open-current-workspace"]');
  await session.wait(chatPreserved, '현재 프로젝트 재선택은 초안과 읽기 위치 보존');
  await session.toggleMonitor();
  await session.wait(panelState(false,true), '모니터링 메뉴의 세션 상세');
  await session.wait("document.querySelector('[data-testid=\"session-monitoring\"]').innerText.includes('세션') && document.querySelector('[data-testid=\"session-monitoring\"]').innerText.includes('history-a')", '관측 대상 세션과 대화 식별');
  await session.screenshot('session-monitoring');
  await session.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await session.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await session.wait(panelState(true,false), 'Escape로 대화 복귀');
  await session.wait(chatPreserved, '모니터링 왕복 후 초안과 과거 읽기 보존');
  await session.wait("document.activeElement===document.querySelector('[data-testid=\"monitoring-nav\"]')", '모니터 닫기 뒤 의미 있는 메뉴 초점 복귀');
  await session.input("");
  await session.screenshot("restored-chat");
  await session.click('.chat-code button');
  await session.wait("document.querySelector('.chat-code button')?.textContent.includes('복사됨')", "코드 복사 클릭 성공");
  await session.click('.chat-message-actions button:last-child');
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value.includes('> ## 저장된 답변')", "인용은 초안에 추가");
  const draft = String(await session.evaluate("document.querySelector('[data-testid=\"prompt-input\"]').value"));
  await session.evaluate("document.querySelector('.transcript').scrollTop=0; document.querySelector('.transcript').dispatchEvent(new Event('scroll'))");
  await session.click(b);
  await session.wait("document.body.innerText.includes('두 번째 저장 대화')", "다른 저장 대화 선택");
  await wheelFrame('.transcript', true, '짧은 대화 여백');
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
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.innerText.includes('printf auto-transition') && card.classList.contains('item-failed') && !card.querySelector('[aria-expanded]'))", "재마운트 뒤 짧은 실패는 확장 버튼 없음");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.querySelector('.cmdline')?.textContent==='printf saved' && card.classList.contains('item-failed') && card.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')==='false')", "재마운트 뒤 수동 접힘은 새 실패에도 유지");
  const currentSidebar = "document.querySelector('[data-testid=\"resource-sidebar\"] .na-monitor')";
  await session.wait("!document.querySelector('[data-testid=\"resource-sidebar\"]').hidden && document.querySelector('[data-testid=\"activity-panel\"]').hidden", "신규 계약은 실제 보이는 기본 사이드바에서 검사");
  await session.input("사이드바 첫 요청 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-testid=\"subagent-list\"] [data-agent-id=\"sidebar-child\"][data-agent-status=\"running\"]')", "실제 Native 하위 작업 시작");
  await session.wait("(async()=>{await new Promise(r=>setTimeout(r,300));return document.querySelector('[data-testid=\"subagent-list\"] [data-agent-id=\"sidebar-child\"][data-agent-status=\"running\"]')})()", "도구 호출 완료만으로 하위 작업 완료 처리하지 않음");
  await session.wait("document.querySelector('[data-testid=\"subagent-list\"] [data-agent-id=\"sidebar-child\"][data-agent-status=\"completed\"]')", "Native 상태 완료 후 하위 작업 완료 표시");
  await session.wait(currentSidebar + ".innerText.includes('첫 요청 전용 단계') && !document.querySelector('[data-testid=\"resource-sidebar\"]').innerText.includes('preToolUse')", "기본 사이드바의 실제 첫 요청 plan과 Hook 제외");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]').disabled", "첫 요청 종료");
  await session.toggleMonitor();
  await session.click('[data-testid="native-activity-details"] > summary');
  await session.wait("(() => { const rows=Array.from(document.querySelectorAll('[data-testid=\"native-activity-details\"] [data-testid=\"activity-entry\"]')).filter(row=>row.innerText.includes('preToolUse')); return rows.length===2 && rows.some(row=>row.innerText.includes('실패')) && rows.some(row=>row.innerText.includes('완료')); })()", "상세 모니터에 두 Hook 실패·완료 보존");
  await session.toggleMonitor();
  await session.wait("(async()=>{const selected=await window.www.workspace();const state=await window.www.activityResources(selected);const docs=state.observations.filter(row=>row.resource.kind==='document');return docs.length===2 && new Set(docs.map(row=>row.resource.identity)).size===2 && docs.every(row=>/^document-sha256:[a-f0-9]{64}$/.test(row.resource.identity)) && !JSON.stringify(state.observations).includes('.private-');})()", "실제 main 해시 경계에서 미등록 문서 두 개·중복 병합·비공개 경로 비저장 확인", 20_000, true);
  await session.screenshot("sidebar-first-request");
  await session.input("사이드바 두 번째 요청 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait(currentSidebar + ".innerText.includes('전송 중') && !" + currentSidebar + ".innerText.includes('첫 요청 전용 단계') && !" + currentSidebar + ".innerText.includes('preToolUse')", "B 전송 중 기본 사이드바에서 A plan·Hook 결과를 제거");
  await session.wait(currentSidebar + ".innerText.includes('단계·체크리스트 미제공') && !" + currentSidebar + ".innerText.includes('전송 중')", "B 수락 후 plan·호출 미제공을 이전 A 완료로 채우지 않음");
  await session.wait(currentSidebar + ".innerText.includes('두 번째 요청 전용 단계') && !" + currentSidebar + ".innerText.includes('첫 요청 전용 단계') && !" + currentSidebar + ".innerText.includes('preToolUse')", "B의 새 plan만 기본 사이드바에 갱신");
  await session.screenshot("sidebar-second-request");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]').disabled", "기본 사이드바 두 번째 요청 종료");
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
  await verifyImeEnter(session);
  await session.input("전송 실패 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value==='전송 실패 확인' && document.querySelector('.status')?.innerText.includes('합성 전송 실패')", "전송 실패 뒤 초안 보존과 오류 표시");
  await session.input("실시간 카드 확인");
  await session.evaluate("document.querySelector('.transcript').scrollTop=0; document.querySelector('.transcript').dispatchEvent(new Event('scroll'))");
  const started = Date.now();
  await session.click('[data-testid="send-button"]');
  await session.toggleMonitor();
  await session.wait(panelState(false,true), "실시간 관측은 모니터링 페이지에서 확인");
  await session.wait("document.querySelector('[data-testid=\"work-flow\"]')?.innerText.match(/진행 중 · [0-4]초/) && document.querySelector('[data-testid=\"work-flow\"]')?.innerText.includes('마지막 활동')", "후속 요청 경과 시간은 현재 턴에서 시작");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.innerText.includes('printf live') && card.innerText.includes('실행 중') && card.querySelector('[data-testid=\"command-preview\"]')?.textContent.startsWith('    실시간 출력 2'))", "턴 종료 전 실시간 카드 최근 10줄");
  await session.wait("document.querySelector('[data-testid=\"activity-live-monitor\"]')?.innerText.includes('최근 통신 경고') && document.querySelector('[data-testid=\"activity-live-monitor\"]')?.innerText.includes('Native 연결됨') && !document.querySelector('.status')?.innerText.includes('연결 error')", "잘못된 JSON 경고와 살아 있는 연결·명령 스트리밍 구분");
  checks.push("요청 클릭→실시간 카드 관측 " + (Date.now() - started) + "ms (수신→반영 지연과 별개)");
  await session.wait("document.querySelector('.new-content') && document.querySelector('.transcript').scrollTop<2", "실시간 사건 중 과거 읽기 위치 유지");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.innerText.includes('printf live') && card.classList.contains('item-failed') && card.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')==='true' && card.querySelector('[data-testid=\"command-preview\"]')?.textContent.startsWith('    실시간 출력 1'))", "실패 종료 후 앞 10줄과 보관 출력 펼침");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled", "실시간 카드 턴 종료");
  await session.toggleMonitor();
  await session.wait(panelState(true, false), "실시간 관측 뒤 상세 닫기와 기본 사이드바 복원");
  await session.input("무활동 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-testid=\"work-flow\"]')?.innerText.includes('새 활동을 기다리는 중') && document.querySelector('[data-testid=\"work-flow\"]')?.innerText.match(/마지막 활동 1[5-9]초 전/)", "15초 무활동은 실패가 아닌 대기로 표시");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled", "무활동 턴 종료");
  await session.input("결과 미확인 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-testid=\"work-flow\"]')?.innerText.includes('결과 확인 필요') && document.querySelector('[data-testid=\"result-summary\"]')?.innerText.includes('결과 미확인')", "알 수 없는 종료의 흐름과 결과 요약");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled", "결과 미확인 턴 종료");
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
  await session.wait("document.querySelector('[data-testid=\"work-flow\"]')?.innerText.includes('사용자 결정을 기다리는 중')", "작업 흐름의 승인 대기 우선 표시");
  await session.wait("document.querySelector('[data-testid=\"new-conversation\"]')?.disabled===true", "실행 중 대화 변경 차단");
  const busyProject = await session.evaluate("(async () => { const selected = await window.www.workspace(); try { await window.www.switchProject(selected, selected.workspaceKey); return 'allowed'; } catch (error) { return String(error); } })()");
  if (typeof busyProject !== "string" || !busyProject.includes("실행 또는 승인")) throw Error("승인 중 프로젝트 전환이 보전되지 않았습니다: " + String(busyProject));
  await session.wait("document.querySelector('[data-decision=\"accept\"]')", "프로젝트 전환 거부 후 기존 승인 보전");
  await session.click('[data-decision="accept"]');
  await session.wait("!document.querySelector('[data-decision=\"accept\"]')", "승인 응답 왕복");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled && !document.querySelector('[data-testid=\"interrupt-button\"]')", "승인 턴 실제 종료 뒤 다음 요청 허용");
  await verifyNativeBoundaries(session);
  await session.input("중단 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait("Array.from(document.querySelectorAll('[data-testid=\"user-request\"]')).at(-1)?.textContent.startsWith('중단 확인') && document.querySelector('[data-testid=\"interrupt-button\"]')", "현재 중단 요청의 실행 중 중단 버튼");
  await session.click('[data-testid="interrupt-button"]');
  await session.wait("document.querySelector('.status')?.innerText.includes('중단 확인')", "중단 최종 결과 확인");
  await session.wait("document.querySelector('[data-testid=\"result-summary\"]')?.innerText.includes('중단됨')", "중단 결과 요약");
  await session.click('[data-testid="new-conversation"]');
  await session.wait("!document.querySelector('.chat-markdown h2')", "새 대화 이력 분리");
  await session.input("새 대화 시작");
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-testid=\"pending-user-request\"]')?.innerText.includes('요청을 보내는 중')", "새 스레드 생성 전 낙관적 접수 카드");
  await session.wait("document.body.innerText.includes('같은 대화에서 이어졌습니다.')", "새 Native 스레드 요청");
  await session.screenshot("new-chat");
  await session.terminate();
  session = await start(2);
  await session.click(a);
  await session.wait("document.body.innerText.includes('같은 대화 후속 요청')", "앱 재시작 뒤 Native 저장 이력 재열기");
  await session.screenshot("restart-chat");
  await session.wait("(async () => { const selected = await window.www.workspace(); const state = await window.www.activityResources(selected); return state?.observations.length > 0 && state.storage === 'saved' && state.revision === state.durableRevision; })()", "재시작 뒤 실제 대화 원장과 마지막 저장 revision 복원", 20_000, true);
  const beforeA   = object(await session.evaluate("(async () => { const selected = await window.www.workspace(); return { selected, resources: await window.www.activityResources(selected) }; })()")) ;
  const selectedA = object(beforeA.selected)                                                                                                                                                           ;
  const rowsA     = object(beforeA.resources).observations                                                                                                                                             ;
  if (!Array.isArray(rowsA)) throw Error("프로젝트 A의 관측 배열이 없습니다.");
  const idsA      = rowsA.map((row) => String(object(row).id)).sort()                                   ;
  const favoriteA = `button[aria-label=${JSON.stringify(path.basename(workspace) + " 즐겨찾기 추가")}]` ;
  await session.click('[data-testid="view-page-nav"]');
  await session.wait("document.querySelector('.home-sidebar')", "즐겨찾기 조작을 위한 프로젝트 목록");
  await session.evaluate("document.querySelector(" + JSON.stringify(favoriteA) + ").focus()");
  await session.wait("document.activeElement===document.querySelector(" + JSON.stringify(favoriteA) + ")", "접근 가능한 이름으로 프로젝트 즐겨찾기 키보드 초점 접근");
  await session.command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.wait("(async () => { const selected = await window.www.workspace(); const projects = await window.www.listProjects(selected); return projects.some(project => project.workspaceKey === selected.workspaceKey && project.favorite); })()", "실제 즐겨찾기 저장");
  await session.terminate();
  const workspaceB = path.join(directory, "workspace-b-아주 긴 한국어 프로젝트 이름과 경계 확인");
  await fs.mkdir(workspaceB);
  session = await start(3, workspaceB);
  await session.command("Emulation.setDeviceMetricsOverride", { width: 860, height: 680, deviceScaleFactor: 1, mobile: false });
  await session.measureNavigation("긴 한국어 프로젝트 860×680");
  await session.screenshot("project-navigation-narrow");
  await session.command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await session.wait("(async () => { const selected = await window.www.workspace(); const projects = await window.www.listProjects(selected); return projects.length === 2 && projects.some(project => project.path === " + JSON.stringify(workspace) + " && project.favorite); })()", "다른 프로젝트 앱 재시작에서 최근·즐겨찾기 복원");
  await session.click(a);
  await session.wait("(async () => { const selected = await window.www.workspace(); const state = await window.www.activityResources(selected); return state?.scope.threadId === 'history-a' && state.observations.length > 0; })()", "같은 thread 문자열의 프로젝트 B 관측 복원", 20_000, true);
  const beforeB   = object(await session.evaluate("(async () => { const selected = await window.www.workspace(); return { selected, resources: await window.www.activityResources(selected) }; })()")) ;
  const selectedB = object(beforeB.selected)                                                                                                                                                           ;
  const rowsB     = object(beforeB.resources).observations                                                                                                                                             ;
  if (!Array.isArray(rowsB) || selectedB.workspaceKey === selectedA.workspaceKey) throw Error("다른 실제 프로젝트 경계가 합쳐졌습니다.");
  const idsB = rowsB.map((row) => String(object(row).id)).sort();
  if (idsB.some((id) => idsA.includes(id))) throw Error("서로 다른 프로젝트의 관측 ID가 섞였습니다.");
  const staleBefore  = await fs.readFile(path.join(workspaceB, "fixture-calls.jsonl"), "utf8")                                                                                                                                                  ;
  const staleProject = await session.evaluate("(async () => { try { await window.www.startTurn(" + JSON.stringify(selectedA) + ", 'history-a', 'stale-project-must-not-run'); return 'allowed'; } catch(error) { return String(error); } })()") ;
  const staleAfter   = await fs.readFile(path.join(workspaceB, "fixture-calls.jsonl"), "utf8")                                                                                                                                                  ;
  if (typeof staleProject !== "string" || !["프로젝트 선택이 변경", "세션을 찾을 수 없습니다"].some(message => staleProject.includes(message)) || staleAfter.slice(staleBefore.length).includes("stale-project-must-not-run")) throw Error("이전 프로세스·프로젝트 요청이 Native에 차단되지 않았습니다: " + String(staleProject));
  const nativeCallsB         = path.join(workspaceB, "fixture-calls.jsonl")                                                                                                                           ;
  const initializations      = async () => (await fs.readFile(nativeCallsB, "utf8")).trim().split("\n").map((line) => object(JSON.parse(line))).filter((call) => call.method === "initialize").length ;
  const ownerInitializations = await initializations()                                                                                                                                                ;
  const secondaryEnv         = { ...process.env }                                                                                                                                                     ;
  delete secondaryEnv.ELECTRON_RUN_AS_NODE;
  const secondary = spawn(path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"), [root, "--user-data-dir=" + path.join(directory, "profile")], {
    cwd: root, stdio: "ignore", env: { ...secondaryEnv, WWW_PROBE_PATH: path.join(directory, "secondary-disabled-probe.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: workspaceB, WWW_CODEX_BIN: path.join(root, "test/fixtures/chat-ui-app-server.ts"), WWW_PROBE_NATIVE_REPORTS: "0" }
  });
  const secondaryExit = await Promise.race([new Promise<number | null>((resolve, reject) => { secondary.once("error", reject); secondary.once("close", resolve); }), pause(5000).then(() => null)]);
  if (secondaryExit !== 0) { secondary.kill("SIGTERM"); throw Error("비소유 Electron main이 정상 종료하지 않았습니다: " + secondaryExit); }
  if (await initializations() !== ownerInitializations) throw Error("비소유 main이 두 번째 Native를 시작했습니다.");
  const switchA = `button[title=${JSON.stringify(workspace)}]`  ;
  const switchB = `button[title=${JSON.stringify(workspaceB)}]` ;
  const switchProject = async (selector: string, key: unknown, label: string) => {
    await session!.click('[data-testid="view-page-nav"]');
    await session!.wait("document.querySelector('.home-sidebar')", label + " 프로젝트 목록");
    await session!.click(selector);
    await session!.wait("document.querySelector('[data-testid=\"target-dashboard\"]') && window.www.workspace().then(s=>s.workspaceKey===" + JSON.stringify(key) + ")", label + " 대시보드");
    await session!.click('[data-testid="chat-nav"]');
    await session!.wait("document.querySelector('[data-testid=\"conversation-item\"][data-thread-id=\"history-a\"]')", label + " 대화 목록");
  };
  await session.input("프로젝트 B만의 초안");
  await switchProject(switchA, selectedA.workspaceKey, "실제 프로젝트 전환과 대화 목록 재연결");
  await session.click(a);
  await session.wait("document.body.innerText.includes('같은 대화 후속 요청')", "프로젝트 A의 원래 Native 대화 재연결");
  const afterA = object(await session.evaluate("(async () => { const selected = await window.www.workspace(); return await window.www.activityResources(selected); })()"));
  if (!Array.isArray(afterA.observations) || JSON.stringify(afterA.observations.map((row) => String(object(row).id)).sort()) !== JSON.stringify(idsA)) throw Error("전환 뒤 프로젝트 A의 누적 ID가 유실되거나 중복됐습니다.");
  if (await session.evaluate("document.querySelector('[data-testid=\"prompt-input\"]').value") === "프로젝트 B만의 초안") throw Error("다른 프로젝트의 동일 thread에 초안이 섞였습니다.");
  await session.input("프로젝트 A만의 초안");
  await switchProject(switchB, selectedB.workspaceKey, "프로젝트 B 복귀");
  await session.click(a);
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value === '프로젝트 B만의 초안'", "동일 thread 문자열의 프로젝트별 초안 격리·복원");
  await session.screenshot("project-isolation");
  const projectEvidence = { workspaceA: selectedA.workspaceKey, workspaceB: selectedB.workspaceKey, threadId: "history-a", observationIdsA: idsA, observationIdsB: idsB, staleRequestRejected: true, secondaryExit, duplicateNativeStarted: false, favoritesRestored: true, draftsIsolated: true };
  await fs.writeFile(path.join(directory, "project-isolation.json"), JSON.stringify(projectEvidence, null, 2));
  checks.push("서로 다른 프로젝트의 동일 thread 관측·초안 격리", "재시작 후 즐겨찾기·누적 원장 복원", "동일 userData의 두 번째 main은 Native 시작 없이 종료", "이전 선택 요청과 승인 중 프로젝트 전환 차단");
  const ledgerFile      = path.join(directory, "profile", "activity-v1", String(selectedB.workspaceKey), createHash("sha256").update("history-a").digest("hex") + ".json") ;
  const preservedLedger = ledgerFile + ".probe-preserved"                                                                                                                  ;
  await fs.rename(ledgerFile, preservedLedger);
  await fs.mkdir(ledgerFile);
  try {
    await session.input("원장 저장 실패 확인");
    await session.click('[data-testid="send-button"]');
    await session.wait("(async()=>{const selected=await window.www.workspace();const state=await window.www.activityResources(selected);return state?.storage==='volatile' && state.revision>state.durableRevision && !document.querySelector('[data-testid=\"new-conversation\"]').disabled;})()", "격리 profile 실제 파일 경로 방해로 원장 저장 실패와 미확정 revision 재현", 20_000, true);
    await switchProject(switchA, selectedA.workspaceKey, "저장 실패 뒤 A 전환");
    await session.wait("document.querySelector('.project-storage-warning')?.textContent.includes('workspace-b')", "다른 프로젝트로 전환해도 이전 B의 저장 미확정 경고 보전");
    const failureStillBelongsToB = "(()=>{const node=document.querySelector('.project-storage-warning');if(!node?.hasAttribute('data-failed-scopes'))return false;const scopes=JSON.parse(node.getAttribute('data-failed-scopes'));return Array.isArray(scopes)&&scopes.length===1&&scopes[0].workspaceKey===" + JSON.stringify(selectedB.workspaceKey) + "&&scopes[0].threadId==='history-a';})()";
    await session.wait(failureStillBelongsToB, "전체 flush의 실제 실패 scope B만 진단하고 정상 A로 귀속하지 않음");
    await session.wait("(async()=>{const selected=await window.www.workspace();return selected.workspaceKey===" + JSON.stringify(selectedA.workspaceKey) + " && await window.www.activityResources(selected)===null;})()", "이전 저장 경고를 새 프로젝트의 원장 데이터로 수용하지 않음", 20_000, true);
    await session.click('[data-testid="view-page-nav"]');
    await session.wait("document.querySelector('.home-sidebar') && " + failureStillBelongsToB, "전체 보기에서도 실제 실패 scope 진단 유지");
    await session.screenshot("project-storage-warning");
    await session.click(switchB);
    await session.wait("document.querySelector('[data-testid=\"target-dashboard\"]') && " + failureStillBelongsToB, "B 실패 후 정상 A에서 다시 전환해도 A를 실패 대상으로 덮지 않음");
    await session.click('[data-testid="chat-nav"]');
    await session.wait("(async()=>{const selected=await window.www.workspace();return selected.workspaceKey===" + JSON.stringify(selectedB.workspaceKey) + " && await window.www.activityResources(selected)===null;})()", "미선택 실패 thread의 경고와 새 빈 대화 리소스는 왕복 뒤에도 분리", 20_000, true);
    await session.screenshot("project-storage-warning-roundtrip");
  } finally {
    await fs.rmdir(ledgerFile);
    await fs.rename(preservedLedger, ledgerFile);
  }
  await session.terminate();
  session = null;
  const calls    = (await fs.readFile(path.join(workspace, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map((line) => object(JSON.parse(line))) ;
  const resumed  = calls.some((call) => call.method === "thread/resume" && object(call.params).threadId === "history-a")                               ;
  const followed = calls.some((call) => call.method === "turn/start" && object(call.params).threadId === "history-a")                                  ;
  if (!resumed || !followed) throw Error("동일 Native thread 요청 근거가 없습니다.");
  const summary = { result: "passed", evidence: path.relative(root, directory), coverage: "실제 Electron DOM·preload IPC·stdio·합성 Native 원장·앱 재시작. 창 크기 검사는 CDP renderer viewport이며 폭 999px 이하는 실제 Native 최소 창보다 작은 합성 viewport다. 실제 모델·Windows·실제 한국어 IME는 미검증.", checks, metrics, sameNativeThread: true };
  await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} catch (error) {
  await fs.writeFile(path.join(directory, "partial-checks.json"), JSON.stringify(checks, null, 2));
  await fs.writeFile(path.join(directory, "partial-metrics.json"), JSON.stringify(metrics, null, 2));
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

}

await verifyChat();
