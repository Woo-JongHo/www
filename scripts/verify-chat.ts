#!/usr/bin/env node
// 실제 Electron 화면·IPC·stdio와 디스크를 유지한 재시작을 검증한다. 모델은 합성 fixture다.
import { spawn, type ChildProcess } from "node:child_process";
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
await fs.mkdir(workspace);
const checks  : string[] = []                                                                      ;
const metrics : Data[]   = []                                                                      ;
const pause              = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) ;

const reviewOutput = '{"id":"review-readable","provider":"anthropic","model":"opus","verdict":"not_run","readOnly":true,"execution":{"exitCode":1,"error":null},"large":9007199254740993,"path":"' + 'long-path/'.repeat(70) + '","findings":[]}\n';

async function seedHistory() {
  const output    = Array.from({ length: 11 }, (_, index) => `    명령 출력 ${index + 1}`).join("\n")                                                                                                      ;
  const wideTable = "| " + Array.from({ length: 24 }, (_, index) => `열 ${index + 1}`).join(" | ") + " |\n| " + Array(24).fill("---").join(" | ") + " |\n| " + Array(24).fill("값").join(" | ") + " |\n\n" ;

  const answer = "## 저장된 답변\n\n**이어갈 작업**을 확인했습니다.\n\n| 항목 | 상태 |\n| --- | --- |\n| 저장 | 완료 |\n\n" + wideTable + "```ts\n    const saved = true;\n" + "    // 긴 코드 " + "x".repeat(1200) + "\n```\n\n[긴 URL](https://example.com/" + "path".repeat(400) + ")\n\nhttps://example.com/" + "long".repeat(400) + "\n\n" + Array.from({ length: 35 }, (_, index) => `기록 문단 ${index}\n\n`).join("") + "마지막 문장 접근 확인.";
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

async function start(round: number, selectedWorkspace = workspace) {
  const port   = await freePort()                                                          ;
  const stdout = await fs.open(path.join(directory, "electron-" + round + ".stdout"), "w") ;
  const stderr = await fs.open(path.join(directory, "electron-" + round + ".stderr"), "w") ;
  const env    = { ...process.env }                                                        ;
  delete env.ELECTRON_RUN_AS_NODE;
  const binary = path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
  const child: ChildProcess = spawn(binary, [root, "--remote-debugging-port=" + port, "--user-data-dir=" + path.join(directory, "profile")], {
    cwd: root, stdio: ["ignore", stdout.fd, stderr.fd],
    env: { ...env, WWW_PROBE_PATH: path.join(directory, "disabled-probe.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: selectedWorkspace, WWW_CODEX_BIN: path.join(root, "test/fixtures/chat-ui-app-server.ts"), WWW_PROBE_NATIVE_REPORTS: "0" }
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
    const wait = async (expression: string, label: string, timeoutMs = 20_000) => {
      const until = Date.now() + timeoutMs;
      while (Date.now() < until) {
        if (await evaluate("(async()=>Boolean(await (" + expression + ")))()")) { checks.push(label); return; }
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
          if (size.clientWidth <= 0 || size.scrollWidth <= size.clientWidth || to <= from || !['auto', 'scroll'].includes(size.overflowX)) failures.push(key + ' 내부 가로 스크롤 불가');
        }
        return result;
      })()`));
      metrics.push({ label, ...measurement });
      return measurement;
    };
    await command("Emulation.setFocusEmulationEnabled", { enabled: true });
    await wait("document.querySelector('[data-thread-id=\"history-a\"]')", "프로젝트 저장 대화 목록");
    return { command, evaluate, wait, click, input, screenshot, measureLayout, measureNavigation, terminate };
  } catch (error) { await terminate(); throw error; }
}

// AppEvent를 주입하지 않고 실제 버튼·preload IPC·fixture stdio로만 경계를 만든다.
let session: Awaited<ReturnType<typeof start>> | null = null;
async function verifyChat() {
try {
  await seedHistory();
  session = await start(1);
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
  const reviewCard = '.command-card:has(.command-review)';
  const cardSession = session;
  const activateByKey = async (selector: string, label: string, space = false) => {
    await cardSession.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await cardSession.wait(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`, label + ' 포커스');
    const key = space ? ' ' : 'Enter';
    const code = space ? 'Space' : 'Enter';
    const text = space ? ' ' : '\r';
    const keyCode = space ? 32 : 13;
    await cardSession.command('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text, unmodifiedText: text, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await cardSession.command('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  };

  await session.wait(`(() => { const c=document.querySelector('${reviewCard}'); return c?.innerText.includes('실행 종료') && c.innerText.includes('종료 코드 0') && c.innerText.includes('미실행') && c.innerText.includes('보고값') && c.querySelector('[data-testid="command-preview"]').textContent.includes('\\n  "id": "review-readable"'); })()`, "종료 코드 0과 검토 미실행 분리·JSON 2칸 정렬");
  await session.wait(`(() => { const c=document.querySelector('${reviewCard}'); const key=c.querySelector('.syntax-key'); const string=c.querySelector('pre .syntax-string'); const number=c.querySelector('pre .syntax-number'); const literal=c.querySelector('pre .syntax-literal'); return [key,string,number,literal].every(Boolean) && new Set([key,string,number,literal].map(n=>getComputedStyle(n).color)).size===4 && c.querySelector('.cmdline .syntax-option') && c.querySelector('.cmdline').scrollWidth>c.querySelector('.cmdline').clientWidth; })()`, "실제 JSON 4종 색상·셸 옵션 강조·명령 내부 가로 스크롤");
  await activateByKey(reviewCard + ' summary', '출력 펼침 Enter');
  await session.wait(`document.querySelector('${reviewCard} details pre').textContent.includes('9007199254740993') && document.querySelector('${reviewCard} details pre').scrollWidth>document.querySelector('${reviewCard} details pre').clientWidth`, "정렬된 전체 출력의 큰 정수 보존·긴 줄 내부 스크롤");
  await session.evaluate(`document.querySelector('${reviewCard}').scrollIntoView({block:'start'})`);
  await session.screenshot('command-json-formatted');
  await session.evaluate(`document.querySelector('${reviewCard} button[aria-pressed]').focus()`);
  await session.wait(`document.activeElement===document.querySelector('${reviewCard} button[aria-pressed]')`, "원문 전환 버튼 키보드 포커스");
  await session.command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await session.wait(`document.querySelector('${reviewCard} button[aria-pressed]').getAttribute('aria-pressed')==='true' && document.querySelector('${reviewCard} details pre').textContent===` + JSON.stringify(reviewOutput), "키보드 원문 전환과 종료 개행까지 원본 일치");
  await activateByKey(reviewCard + ' .command-output-tools button:last-of-type', '원문 복사 Enter');
  await session.wait(`document.querySelector('${reviewCard} [role="status"]').textContent==='원문 복사됨'`, "원문 클립보드 쓰기 성공 안내");
  await session.wait("navigator.clipboard.readText().then(text=>text===" + JSON.stringify(reviewOutput) + ")", "실제 클립보드 원문 완전 일치");
  await session.click(reviewCard + ' button[aria-pressed]');
  await activateByKey(reviewCard + ' summary', '출력 접기 Space', true);
  await session.wait(`document.querySelector('${reviewCard} details').open===false && document.querySelector('${reviewCard} [data-testid="command-preview"]').getBoundingClientRect().height>0`, 'Space로 출력 한 번 접기·미리보기 유지');
  await session.evaluate("(() => { const transcript=document.querySelector('.transcript'); transcript.scrollTop=transcript.scrollHeight; transcript.dispatchEvent(new Event('scroll')); })()");
  await session.wait("(() => { const t=document.querySelector('.transcript'); const last=document.querySelector('.agent .chat-markdown>:last-child'); const input=document.querySelector('.compose'); return last.textContent.includes('마지막 문장 접근 확인') && last.getBoundingClientRect().bottom<=t.getBoundingClientRect().bottom+1 && t.getBoundingClientRect().bottom<=input.getBoundingClientRect().top+1; })()", "긴 답변 마지막 문장과 입력창 분리");
  await session.measureLayout("기준선 DOM 치수");
  await session.wait("document.documentElement.scrollWidth<=window.innerWidth && document.querySelector('.chat-code pre').scrollWidth>document.querySelector('.chat-code pre').clientWidth", "긴 URL과 코드의 가로 넘침 격리");
  for (const [width, height] of [[1040, 680], [1040, 900], [1440, 680], [860, 680], [1440, 900]]) {
    await session.command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await session.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    const measurement = await session.measureLayout(`viewport ${width}x${height}`);
    if (object(measurement.viewport).width !== width || object(measurement.viewport).height !== height || !Array.isArray(measurement.failures) || measurement.failures.length) throw Error("창 치수 검증 실패: " + JSON.stringify(measurement));
    checks.push(`창 ${width}x${height} 전체 넘침·프레임 가시 범위·본문 세로 이동·코드/긴 표 가로 이동`);
    await session.wait("(() => { const t=document.querySelector('.transcript'); const input=document.querySelector('.compose'); return t.clientHeight>0 && t.getBoundingClientRect().bottom<=input.getBoundingClientRect().top+1 && input.getBoundingClientRect().bottom<window.innerHeight && document.documentElement.scrollWidth<=window.innerWidth; })()", `창 폭 ${width}에서 본문·입력 접근`);
    await session.wait(`(() => { const c=document.querySelector('${reviewCard}'); const t=document.querySelector('.transcript'); return c.getBoundingClientRect().width<=t.clientWidth && c.querySelector('.cmdline').scrollWidth>c.querySelector('.cmdline').clientWidth && document.documentElement.scrollWidth<=innerWidth; })()`, `창 ${width} 명령 카드 가로 넘침 격리`);
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
  const sidebarToggle = '[data-testid="resource-sidebar-toggle"]';
  const detailToggle = '[data-testid="detail-monitor-toggle"]';
  const panelState = (sidebar: boolean, detail: boolean, sidebarEnabled = sidebar) => `(() => {
    const visible = (node) => node instanceof HTMLElement && !node.hidden && getComputedStyle(node).visibility !== 'hidden' && node.getClientRects().length > 0 && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
    const sidebar = document.querySelector('[data-testid="resource-sidebar"]');
    const detail = document.querySelector('[data-testid="activity-panel"]');
    return sidebar instanceof HTMLElement && detail instanceof HTMLElement
      && visible(sidebar) === ${sidebar} && visible(detail) === ${detail}
      && document.querySelector(${JSON.stringify(sidebarToggle)})?.getAttribute('aria-pressed') === '${sidebarEnabled}'
      && document.querySelector(${JSON.stringify(detailToggle)})?.getAttribute('aria-pressed') === '${detail}';
  })()`;
  const noSidebarCatalog = `(() => {
    const sidebar = document.querySelector('[data-testid="resource-sidebar"]');
    const catalog = document.querySelectorAll('[data-testid="activity-panel"] [data-testid="www-artifact"].www-unobserved');
    return sidebar instanceof HTMLElement && catalog.length > 0
      && !sidebar.querySelector('[data-testid="www-artifact"], [data-testid="activity-skill-row"], [data-testid="activity-hook-row"]')
      && Array.from(catalog).every((row) => !Array.from(sidebar.querySelectorAll('.na-row-copy strong')).some((label) => label.textContent === row.querySelector('strong')?.textContent));
  })()`;
  await session.wait(panelState(true, false), "기본 사이드바 가시성과 상세 모니터 닫힘");
  await session.wait(noSidebarCatalog, "기본 사이드바에 미관측 카탈로그 행 없음");
  await session.input("모니터 전환 뒤 보존할 초안");
  await session.evaluate("(() => { const t=document.querySelector('.transcript'); t.scrollTop=80; t.dispatchEvent(new Event('scroll')); })()");
  const monitorScrollTop = Number(await session.evaluate("document.querySelector('.transcript').scrollTop"));
  const chatPreserved = `(() => {
    const t=document.querySelector('.transcript');
    const input=document.querySelector('[data-testid="prompt-input"]');
    const rect=input.getBoundingClientRect();
    return input.value==='모니터 전환 뒤 보존할 초안' && !input.disabled
      && Math.abs(t.scrollTop-${monitorScrollTop})<2 && t.scrollHeight>t.clientHeight
      && rect.width>0 && rect.height>0 && rect.top>=0 && rect.bottom<=innerHeight && rect.left>=0 && rect.right<=innerWidth;
  })()`;
  await session.click(sidebarToggle);
  await session.wait(panelState(false, false), "리소스 사이드바만 닫기: 실제 패널 숨김");
  await session.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await session.wait(chatPreserved, "사이드바 닫은 뒤 초안·과거 읽기·입력 접근 유지");
  await session.click(sidebarToggle);
  await session.wait(panelState(true, false), "리소스 사이드바만 열기: 실제 패널 복원");
  await session.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await session.wait(chatPreserved, "사이드바 다시 연 뒤 초안·과거 읽기·입력 접근 유지");
  await session.click(detailToggle);
  await session.wait(panelState(false, true, true), "상세 모니터 열기: 사이드바 설정을 유지하며 상세 패널 표시");
  await session.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await session.wait(noSidebarCatalog, "상세 조회 중에도 기본 사이드바에 카탈로그 행을 섞지 않음");
  await session.wait(chatPreserved, "상세 조회 중 초안·과거 읽기·입력 접근 유지");
  await session.click(detailToggle);
  await session.wait(panelState(true, false), "상세 모니터 닫기: 기본 사이드바 복원");
  await session.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await session.wait(chatPreserved, "상세 닫은 뒤 초안·과거 읽기·입력 접근 복원");
  await session.evaluate("document.querySelector('[data-testid=\"prompt-input\"]').focus()");
  await session.wait("document.activeElement===document.querySelector('[data-testid=\"prompt-input\"]')", "모니터 왕복 뒤 입력창 포커스 접근");
  await session.click(detailToggle);
  await session.wait(panelState(false, true, true), "키보드 닫기 검증을 위한 상세 열기");
  await session.wait("document.activeElement===document.querySelector('[data-testid=\"activity-panel\"]')", "상세 패널 열기 포커스");
  await session.command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await session.command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await session.wait(panelState(true, false), "Escape로 상세만 닫고 사이드바 복원");
  await session.evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await session.wait("document.activeElement===document.querySelector('[data-testid=\"detail-monitor-toggle\"]')", "상세 닫기 뒤 기존 토글 focus ref로 복귀");
  await session.wait(chatPreserved, "키보드 상세 왕복 뒤 초안·읽기 위치 유지");
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
  const currentSidebar = "document.querySelector('[data-testid=\"resource-sidebar\"] .na-monitor')";
  await session.wait("!document.querySelector('[data-testid=\"resource-sidebar\"]').hidden && document.querySelector('[data-testid=\"activity-panel\"]').hidden", "신규 계약은 실제 보이는 기본 사이드바에서 검사");
  await session.input("사이드바 첫 요청 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait(currentSidebar + ".innerText.includes('첫 요청 전용 단계') && " + currentSidebar + ".innerText.includes('preToolUse') && " + currentSidebar + ".innerText.includes('진행 관측')", "기본 사이드바에 실제 첫 요청 plan과 Hook 시작 반영");
  await session.wait("Array.from(" + currentSidebar + ".querySelectorAll('.na-row')).filter(row=>row.innerText.includes('preToolUse')).length===2 && " + currentSidebar + ".innerText.includes('실패 관측') && " + currentSidebar + ".innerText.includes('완료 관측') && !document.querySelector('[data-testid=\"new-conversation\"]').disabled", "동명 두 Hook 핸들러의 실패·완료를 기본 사이드바에서 각각 보전");
  await session.wait("(async()=>{const selected=await window.www.workspace();const state=await window.www.activityResources(selected);const docs=state.observations.filter(row=>row.resource.kind==='document');return docs.length===2 && new Set(docs.map(row=>row.resource.identity)).size===2 && docs.every(row=>/^document-sha256:[a-f0-9]{64}$/.test(row.resource.identity)) && !JSON.stringify(state.observations).includes('.private-');})()", "실제 main 해시 경계에서 미등록 문서 두 개·중복 병합·비공개 경로 비저장 확인");
  await session.screenshot("sidebar-first-request");
  await session.input("사이드바 두 번째 요청 확인");
  await session.click('[data-testid="send-button"]');
  await session.wait(currentSidebar + ".innerText.includes('전송 중') && !" + currentSidebar + ".innerText.includes('첫 요청 전용 단계') && !" + currentSidebar + ".innerText.includes('preToolUse')", "B 전송 중 기본 사이드바에서 A plan·Hook 결과를 제거");
  await session.wait(currentSidebar + ".innerText.includes('단계·체크리스트 미제공') && " + currentSidebar + ".innerText.includes('실제 Skill/Hook 호출 미제공') && !" + currentSidebar + ".innerText.includes('전송 중')", "B 수락 후 plan·호출 미제공을 이전 A 완료로 채우지 않음");
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
  await session.click(detailToggle);
  await session.wait(panelState(false, true, true), "실시간 통신 관측용 상세 모니터 열기");
  await session.input("실시간 카드 확인");
  await session.evaluate("document.querySelector('.transcript').scrollTop=0; document.querySelector('.transcript').dispatchEvent(new Event('scroll'))");
  const started = Date.now();
  await session.click('[data-testid="send-button"]');
  await session.wait("document.querySelector('[data-testid=\"work-flow\"]')?.innerText.match(/진행 중 · [0-4]초/) && document.querySelector('[data-testid=\"work-flow\"]')?.innerText.includes('마지막 활동')", "후속 요청 경과 시간은 현재 턴에서 시작");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.innerText.includes('printf live') && card.innerText.includes('실행 중') && card.querySelector('[data-testid=\"command-preview\"]')?.textContent.startsWith('    실시간 출력 2'))", "턴 종료 전 실시간 카드 최근 10줄");
  await session.wait("document.querySelector('[data-testid=\"activity-live-monitor\"]')?.innerText.includes('최근 통신 경고') && document.querySelector('[data-testid=\"activity-live-monitor\"]')?.innerText.includes('Native 연결됨') && !document.querySelector('.status')?.innerText.includes('연결 error')", "잘못된 JSON 경고와 살아 있는 연결·명령 스트리밍 구분");
  checks.push("요청 클릭→실시간 카드 관측 " + (Date.now() - started) + "ms (수신→반영 지연과 별개)");
  await session.wait("document.querySelector('.new-content') && document.querySelector('.transcript').scrollTop<2", "실시간 사건 중 과거 읽기 위치 유지");
  await session.wait("Array.from(document.querySelectorAll('.command-card')).some((card)=>card.innerText.includes('printf live') && card.classList.contains('item-failed') && card.querySelector('details')?.open===true && card.querySelector('[data-testid=\"command-preview\"]')?.textContent.startsWith('    실시간 출력 1'))", "실패 종료 후 앞 10줄과 보관 출력 펼침");
  await session.wait("!document.querySelector('[data-testid=\"new-conversation\"]')?.disabled", "실시간 카드 턴 종료");
  await session.click(detailToggle);
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
  await session.wait("(async () => { const selected = await window.www.workspace(); const state = await window.www.activityResources(selected); return state?.observations.length > 0 && state.storage === 'saved' && state.revision === state.durableRevision; })()", "재시작 뒤 실제 대화 원장과 마지막 저장 revision 복원");
  const beforeA = object(await session.evaluate("(async () => { const selected = await window.www.workspace(); return { selected, resources: await window.www.activityResources(selected) }; })()"));
  const selectedA = object(beforeA.selected);
  const rowsA = object(beforeA.resources).observations;
  if (!Array.isArray(rowsA)) throw Error("프로젝트 A의 관측 배열이 없습니다.");
  const idsA = rowsA.map((row) => String(object(row).id)).sort();
  const favoriteA = `button[aria-label=${JSON.stringify(path.basename(workspace) + " 즐겨찾기 추가")}]`;
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
  await session.wait("(async () => { const selected = await window.www.workspace(); const state = await window.www.activityResources(selected); return state?.scope.threadId === 'history-a' && state.observations.length > 0; })()", "같은 thread 문자열의 프로젝트 B 관측 복원");
  const beforeB = object(await session.evaluate("(async () => { const selected = await window.www.workspace(); return { selected, resources: await window.www.activityResources(selected) }; })()"));
  const selectedB = object(beforeB.selected);
  const rowsB = object(beforeB.resources).observations;
  if (!Array.isArray(rowsB) || selectedB.workspaceKey === selectedA.workspaceKey) throw Error("다른 실제 프로젝트 경계가 합쳐졌습니다.");
  const idsB = rowsB.map((row) => String(object(row).id)).sort();
  if (idsB.some((id) => idsA.includes(id))) throw Error("서로 다른 프로젝트의 관측 ID가 섞였습니다.");
  const staleProject = await session.evaluate("(async () => { try { await window.www.startTurn(" + JSON.stringify(selectedA) + ", 'history-a', 'stale-project-must-not-run'); return 'allowed'; } catch(error) { return String(error); } })()");
  if (typeof staleProject !== "string" || !staleProject.includes("프로젝트 선택이 변경")) throw Error("이전 프로세스·프로젝트 요청이 차단되지 않았습니다.");
  const nativeCallsB = path.join(workspaceB, "fixture-calls.jsonl");
  const initializations = async () => (await fs.readFile(nativeCallsB, "utf8")).trim().split("\n").map((line) => object(JSON.parse(line))).filter((call) => call.method === "initialize").length;
  const ownerInitializations = await initializations();
  const secondaryEnv = { ...process.env };
  delete secondaryEnv.ELECTRON_RUN_AS_NODE;
  const secondary = spawn(path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"), [root, "--user-data-dir=" + path.join(directory, "profile")], {
    cwd: root, stdio: "ignore", env: { ...secondaryEnv, WWW_PROBE_PATH: path.join(directory, "secondary-disabled-probe.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: workspaceB, WWW_CODEX_BIN: path.join(root, "test/fixtures/chat-ui-app-server.ts"), WWW_PROBE_NATIVE_REPORTS: "0" }
  });
  const secondaryExit = await Promise.race([new Promise<number | null>((resolve, reject) => { secondary.once("error", reject); secondary.once("close", resolve); }), pause(5000).then(() => null)]);
  if (secondaryExit !== 0) { secondary.kill("SIGTERM"); throw Error("비소유 Electron main이 정상 종료하지 않았습니다: " + secondaryExit); }
  if (await initializations() !== ownerInitializations) throw Error("비소유 main이 두 번째 Native를 시작했습니다.");
  const switchA = `button[title=${JSON.stringify(workspace)}]`;
  const switchB = `button[title=${JSON.stringify(workspaceB)}]`;
  await session.input("프로젝트 B만의 초안");
  await session.click(switchA);
  await session.wait("document.querySelector(" + JSON.stringify(switchA) + ")?.getAttribute('aria-current') === 'true' && document.querySelector('[data-testid=\"conversation-item\"][data-thread-id=\"history-a\"]')", "실제 프로젝트 전환과 대화 목록 재연결");
  await session.click(a);
  await session.wait("document.body.innerText.includes('같은 대화 후속 요청')", "프로젝트 A의 원래 Native 대화 재연결");
  const afterA = object(await session.evaluate("(async () => { const selected = await window.www.workspace(); return await window.www.activityResources(selected); })()"));
  if (!Array.isArray(afterA.observations) || JSON.stringify(afterA.observations.map((row) => String(object(row).id)).sort()) !== JSON.stringify(idsA)) throw Error("전환 뒤 프로젝트 A의 누적 ID가 유실되거나 중복됐습니다.");
  if (await session.evaluate("document.querySelector('[data-testid=\"prompt-input\"]').value") === "프로젝트 B만의 초안") throw Error("다른 프로젝트의 동일 thread에 초안이 섞였습니다.");
  await session.input("프로젝트 A만의 초안");
  await session.click(switchB);
  await session.wait("document.querySelector(" + JSON.stringify(switchB) + ")?.getAttribute('aria-current') === 'true' && document.querySelector('[data-testid=\"conversation-item\"][data-thread-id=\"history-a\"]')", "프로젝트 B 복귀");
  await session.click(a);
  await session.wait("document.querySelector('[data-testid=\"prompt-input\"]').value === '프로젝트 B만의 초안'", "동일 thread 문자열의 프로젝트별 초안 격리·복원");
  await session.screenshot("project-isolation");
  const projectEvidence = { workspaceA: selectedA.workspaceKey, workspaceB: selectedB.workspaceKey, threadId: "history-a", observationIdsA: idsA, observationIdsB: idsB, staleRequestRejected: true, secondaryExit, duplicateNativeStarted: false, favoritesRestored: true, draftsIsolated: true };
  await fs.writeFile(path.join(directory, "project-isolation.json"), JSON.stringify(projectEvidence, null, 2));
  checks.push("서로 다른 프로젝트의 동일 thread 관측·초안 격리", "재시작 후 즐겨찾기·누적 원장 복원", "동일 userData의 두 번째 main은 Native 시작 없이 종료", "이전 선택 요청과 승인 중 프로젝트 전환 차단");
  const ledgerFile = path.join(directory, "profile", "activity-v1", String(selectedB.workspaceKey), createHash("sha256").update("history-a").digest("hex") + ".json");
  const preservedLedger = ledgerFile + ".probe-preserved";
  await fs.rename(ledgerFile, preservedLedger);
  await fs.mkdir(ledgerFile);
  try {
    await session.input("원장 저장 실패 확인");
    await session.click('[data-testid="send-button"]');
    await session.wait("(async()=>{const selected=await window.www.workspace();const state=await window.www.activityResources(selected);return state?.storage==='volatile' && state.revision>state.durableRevision && !document.querySelector('[data-testid=\"new-conversation\"]').disabled;})()", "격리 profile 실제 파일 경로 방해로 원장 저장 실패와 미확정 revision 재현");
    await session.click(switchA);
    await session.wait("document.querySelector(" + JSON.stringify(switchA) + ")?.getAttribute('aria-current')==='true' && document.querySelector('.project-storage-warning')?.textContent.includes('workspace-b')", "다른 프로젝트로 전환해도 이전 B의 저장 미확정 경고 보전");
    const failureStillBelongsToB = "(()=>{const node=document.querySelector('.project-storage-warning');if(!node?.hasAttribute('data-failed-scopes'))return false;const scopes=JSON.parse(node.getAttribute('data-failed-scopes'));return Array.isArray(scopes)&&scopes.length===1&&scopes[0].workspaceKey===" + JSON.stringify(selectedB.workspaceKey) + "&&scopes[0].threadId==='history-a';})()";
    await session.wait(failureStillBelongsToB, "전체 flush의 실제 실패 scope B만 진단하고 정상 A로 귀속하지 않음");
    await session.wait("(async()=>{const selected=await window.www.workspace();return selected.workspaceKey===" + JSON.stringify(selectedA.workspaceKey) + " && await window.www.activityResources(selected)===null;})()", "이전 저장 경고를 새 프로젝트의 원장 데이터로 수용하지 않음");
    await session.click('button[aria-label="프로젝트 목록 새로고침"]');
    await session.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    await session.wait("!document.querySelector('button[aria-label=\"프로젝트 목록 새로고침\"]').disabled && " + failureStillBelongsToB, "목록 갱신 완료·새 선택의 일반 오류 초기화 뒤에도 실제 실패 scope 진단 유지");
    await session.screenshot("project-storage-warning");
    await session.click(switchB);
    await session.wait("document.querySelector(" + JSON.stringify(switchB) + ")?.getAttribute('aria-current')==='true' && " + failureStillBelongsToB, "B 실패 후 정상 A에서 다시 전환해도 A를 실패 대상으로 덮지 않음");
    await session.wait("(async()=>{const selected=await window.www.workspace();return selected.workspaceKey===" + JSON.stringify(selectedB.workspaceKey) + " && await window.www.activityResources(selected)===null;})()", "미선택 실패 thread의 경고와 새 빈 대화 리소스는 왕복 뒤에도 분리");
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
  const repeated = calls.filter((call) => call.method === "turn/start" && JSON.stringify(call.params).includes("한글 합성 조합 확인"));
  if (repeated.length !== 1) throw Error("반복 Enter가 요청을 중복 전송했습니다: " + repeated.length);
  checks.push("반복 Enter는 실제 stdio 요청 1개");
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
