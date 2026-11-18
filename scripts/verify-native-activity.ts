#!/usr/bin/env node
// 실제 Electron과 합성 subprocess의 활동 표시 연결을 검사한다. 실제 모델·계정 검증은 아니다.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const uiOnly = process.argv.slice(2).includes("--ui-only");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await fs.mkdir(path.join(root, ".www/evidence"), { recursive: true });
const directory = await fs.mkdtemp(path.join(root, ".www/evidence/native-activity-"));

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function run(name: string, command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const stdout = await fs.open(path.join(directory, `${name}.stdout.log`), "w") ;
  const stderr = await fs.open(path.join(directory, `${name}.stderr.log`), "w") ;
  try {
    await new Promise<void>((resolve, reject) => {
      const child  = spawn(command, args, { cwd: root, env, stdio: ["ignore", stdout.fd, stderr.fd] }) ;
      let timedOut = false                                                                             ;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, 150_000);
      const forced = setTimeout(() => child.kill("SIGKILL"), 155_000);
      child.once("error", (error) => { clearTimeout(timer); clearTimeout(forced); reject(error); });
      child.once("close", (code, signal) => {
        clearTimeout(timer);
        clearTimeout(forced);
        if (code === 0 && !signal && !timedOut) resolve();
        else reject(new Error(`${name}: 종료 ${code}, signal=${signal}, timeout=${timedOut}`));
      });
    });
  } finally {
    await stdout.close();
    await stderr.close();
  }
}

/** 현재 dist의 추가 관측 시나리오다. 빌드는 부모의 통합 검증이 소유한다. */
async function verifyObservability(): Promise<void> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("CDP 포트가 없습니다.");
  const port = address.port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  const stdout = await fs.open(path.join(directory, "observability.stdout.log"), "w");
  const stderr = await fs.open(path.join(directory, "observability.stderr.log"), "w");
  const env: NodeJS.ProcessEnv = { ...process.env, WWW_NATIVE_PROBE: "1", WWW_PROBE_PATH: path.join(directory, "disabled.json"), WWW_PROBE_WORKSPACE: root, WWW_CODEX_BIN: path.join(root, "test/fixtures/activity-app-server.ts"), WWW_STAGE_PROBE: "1", WWW_STAGE_WORK_ID: "work-36d312bc-a767-4e3e-a581-01898b35f75f", WWW_PROBE_NATIVE_REPORTS: "0" };
  delete env.ELECTRON_RUN_AS_NODE;
  const binary = process.platform === "darwin" ? path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron") : path.join(root, "node_modules/electron/dist/electron");
  const child = spawn(binary, [root, `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(directory, "profile")}`], { cwd: root, env, stdio: ["ignore", stdout.fd, stderr.fd] });
  let socket: WebSocket | null = null;
  const checks: string[] = [];
  const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
  try {
    let endpoint = "";
    for (let attempt = 0; attempt < 400 && !endpoint; attempt++) {
      if (child.exitCode !== null) throw new Error(`Electron 조기 종료: ${child.exitCode}`);
      try { const targets: unknown = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (Array.isArray(targets)) { const page = targets.find(value => object(value) && value.type === "page"); if (object(page) && typeof page.webSocketDebuggerUrl === "string") endpoint = page.webSocketDebuggerUrl; } } catch { /* CDP 준비 중 */ }
      if (!endpoint) await pause(50);
    }
    if (!endpoint) throw new Error("CDP 연결 시간 초과");
    socket = new WebSocket(endpoint);
    await new Promise<void>((resolve, reject) => { socket!.addEventListener("open", () => resolve(), { once: true }); socket!.addEventListener("error", () => reject(new Error("CDP 연결 오류")), { once: true }); });
    let nextId = 0;
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
    socket.addEventListener("message", event => { const raw: unknown = JSON.parse(String(event.data)); if (!object(raw) || typeof raw.id !== "number") return; const waiter = pending.get(raw.id); if (!waiter) return; pending.delete(raw.id); if (raw.error) waiter.reject(new Error(JSON.stringify(raw.error))); else waiter.resolve(raw.result); });
    const command = (method: string, params: Record<string, unknown> = {}): Promise<unknown> => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket!.send(JSON.stringify({ id, method, params })); });
    const evaluate = async (expression: string): Promise<unknown> => { const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (!object(result) || result.exceptionDetails) throw new Error(JSON.stringify(result)); return object(result.result) ? result.result.value : null; };
    const wait = async (expression: string, label: string) => { for (let attempt = 0; attempt < 300; attempt++) { if (await evaluate(`(async()=>Boolean(await (${expression})))()`)) { checks.push(label); return; } await pause(50); } throw new Error(`${label}: ${String(await evaluate("document.body.innerText"))}`); };
    const click = async (selector: string) => { await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!(e instanceof HTMLElement)||e.closest('[hidden]')||e.disabled)throw Error('클릭 불가');e.click()})()`); };
    const screenshot = async (name: string) => { const result = await command("Page.captureScreenshot", { format: "png" }); if (!object(result) || typeof result.data !== "string") throw new Error("화면 캡처 실패"); await fs.writeFile(path.join(directory, name), Buffer.from(result.data, "base64")); };
    await wait("(()=>{const e=document.querySelector('[data-testid=\"open-current-workspace\"]');return document.querySelector('.dashboard-captured') && e instanceof HTMLButtonElement && !e.disabled && !e.closest('[hidden]') && e.getBoundingClientRect().width>0})()", "WWW 보드 수집·프로젝트 진입 버튼 활성 준비");
    await click('[data-testid="open-current-workspace"]');
    await wait("document.querySelector('[data-testid=\"chat-nav\"]')", "대화 메뉴 준비");
    await click('[data-testid="chat-nav"]');
    const first: unknown = await evaluate("window.www.listSessions().then(s=>s[0]?.id)");
    if (typeof first !== "string") throw new Error("첫 탭 식별자가 없습니다.");
    const surface = `[data-session-id="${first}"]`;
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(surface + ' [data-testid="prompt-input"]')});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'단계 관측 유지');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await wait(`!document.querySelector(${JSON.stringify(surface + ' [data-testid="send-button"]')})?.disabled`, "입력 수용");
    await click(surface + ' [data-testid="send-button"]');
    await wait(`window.www.workspace(${JSON.stringify(first)}).then(s=>window.www.events(s)).then(e=>e.some(x=>x.method==='www/developmentStage'))`, "실제 main 단계 선언 수신");
    await click(surface + ' [data-testid="monitoring-nav"]');
    const monitor = surface + ' [data-testid="monitoring-overview"]';
    await wait(`document.querySelector(${JSON.stringify(monitor + ' [data-skill-id="www-build"]')})?.textContent.includes('진행 선언')`, "구현 역할 선언 DOM 수용");
    await wait(`document.querySelector(${JSON.stringify(monitor + ' [data-testid="agent-progress"]')})?.textContent.includes('계획 미연결 공개 진행 설명')`, "계획 없는 공개 설명 DOM 수용");
    await wait(`document.querySelector(${JSON.stringify(monitor)})?.textContent.includes('하네스 실행 미연결')`, "역할 선언과 실제 하네스 구분");
    await wait(`document.querySelectorAll(${JSON.stringify(monitor + ' .ao-skill-state')}).length===5 && !Array.from(document.querySelectorAll(${JSON.stringify(monitor + ' .ao-skill-state')})).some(x=>x.textContent==='대기')`, "미관측 스킬을 대기로 꾸미지 않음");
    await screenshot("observability-desktop.png");
    await click('[aria-label="새 대화 탭 추가"]');
    await wait("window.www.listSessions().then(s=>s.length===2)", "두 번째 탭 생성");
    const second: unknown = await evaluate(`window.www.listSessions().then(s=>s.find(x=>x.id!==${JSON.stringify(first)})?.id)`);
    if (typeof second !== "string") throw new Error("두 번째 탭 식별자가 없습니다.");
    await wait(`document.querySelector(${JSON.stringify('[data-session-id="' + second + '"] [data-testid="monitoring-nav"]')})`, "두 번째 탭 화면 준비");
    await click(`[data-session-id="${second}"] [data-testid="monitoring-nav"]`);
    await wait(`!document.querySelector(${JSON.stringify('[data-session-id="' + second + '"] [data-testid="monitoring-overview"]')})?.textContent.includes('진행 선언')`, "다른 탭으로 단계 선언 누출 없음");
    await click(`[id="session-tab-${first}"]`);
    await wait(`document.querySelector(${JSON.stringify(monitor + ' [data-skill-id="www-build"]')})?.textContent.includes('진행 선언')`, "원래 탭의 단계 보존");
    await command("Emulation.setDeviceMetricsOverride", { width: 760, height: 900, deviceScaleFactor: 1, mobile: false });
    await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await pause(100);
    const geometry = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(monitor)});return {width:e.getBoundingClientRect().width,overflow:e.scrollWidth>e.clientWidth,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}})()`);
    if (!object(geometry) || geometry.overflow !== false || geometry.reducedMotion !== true) throw new Error("좁은 화면·모션 축소 관측 실패");
    checks.push("760px 화면·모션 축소");
    await screenshot("observability-narrow.png");
    // Electron의 최소 창 폭과 별개로 실제 모니터 컴포넌트를 340px에 제약한다.
    // 물리 창·OS 입력·실제 backend 장애 관측으로 확대하지 않는다.
    const constrained = await evaluate(`(()=>{
      const panel=document.querySelector(${JSON.stringify(monitor)});
      if(!(panel instanceof HTMLElement))throw Error('모니터 없음');
      const original=panel.getAttribute('style');
      const before=panel.innerText;
      panel.style.setProperty('width','340px','important');
      panel.style.setProperty('min-width','340px','important');
      panel.style.setProperty('max-width','340px','important');
      panel.style.setProperty('flex','0 0 340px','important');
      const rect=panel.getBoundingClientRect();
      const controls=Array.from(panel.querySelectorAll('button,select,summary')).filter(e=>e instanceof HTMLElement&&e.getBoundingClientRect().width>0&&!e.closest('[hidden]'));
      const outside=controls.filter(e=>{const r=e.getBoundingClientRect();return r.left<rect.left-1||r.right>rect.right+1}).map(e=>e.textContent);
      const focus=controls.find(e=>e instanceof HTMLButtonElement&&!e.disabled);
      if(focus instanceof HTMLElement)focus.focus();
      return {original,width:rect.width,clientWidth:panel.clientWidth,scrollWidth:panel.scrollWidth,
        overflow:panel.scrollWidth>panel.clientWidth,contentPreserved:panel.innerText===before,
        skillCount:panel.querySelectorAll('.ao-skills>li').length,
        progress:panel.querySelector('[data-testid="agent-progress"]')?.textContent,
        controlCount:controls.length,outside,focusAccepted:!!focus&&document.activeElement===focus,
        reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
    })()`);
    await fs.writeFile(path.join(directory, "observability-340.json"), JSON.stringify(constrained, null, 2));
    if (!object(constrained) || constrained.width !== 340 || constrained.overflow !== false
      || constrained.contentPreserved !== true || constrained.skillCount !== 5
      || typeof constrained.progress !== "string" || !constrained.progress.includes("계획 미연결 공개 진행 설명")
      || typeof constrained.controlCount !== "number" || constrained.controlCount < 1
      || !Array.isArray(constrained.outside) || constrained.outside.length !== 0
      || constrained.focusAccepted !== true || constrained.reducedMotion !== true) {
      throw new Error("실제 모니터 340px 제약·정보·조작·모션 축소 관측 실패");
    }
    checks.push("실제 Electron 모니터 340px 컨테이너·동일 내용·조작 초점·모션 축소");
    await screenshot("observability-340.png");
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(monitor)});const original=${JSON.stringify(object(constrained) ? constrained.original : null)};if(original===null)e.removeAttribute('style');else e.setAttribute('style',original)})()`);
    const sourceEvents = await evaluate(`window.www.workspace(${JSON.stringify(first)}).then(s=>window.www.events(s))`);
    await fs.writeFile(path.join(directory, "observability-events.json"), JSON.stringify(sourceEvents, null, 2));
    await evaluate(`(async()=>{const s=await window.www.workspace(${JSON.stringify(first)});const e=await window.www.events(s);const t=e.find(x=>x.method==='turn/started').params;await window.www.interrupt(s,t.threadId,t.turn.id)})()`);
    await wait(`window.www.listSessions().then(s=>!s.find(x=>x.id===${JSON.stringify(first)})?.busy)`, "관측 중인 턴 중단 수용");
    const summary = { result: "passed", mode: "observability", coverage: "현재 dist의 실제 Electron·IPC·합성 stdio·340px 모니터 컨테이너 제약. 물리 340px 창·OS 입력·모델 도구 사용·실제 하네스·실계정은 검증하지 않음", checks, geometry, constrained, build: JSON.parse(await fs.readFile(path.join(root, "dist/build-info.json"), "utf8")) };
    await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ ...summary, evidence: path.relative(root, directory) }));
  } finally {
    socket?.close();
    child.kill("SIGTERM");
    await Promise.race([new Promise<void>(resolve => child.once("close", () => resolve())), pause(3000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
    await Promise.all([stdout.close(), stderr.close()]);
  }
}

if (process.argv.includes("--observability")) {
  try { await verifyObservability(); } catch (error) { await fs.writeFile(path.join(directory, "failure.txt"), String(error)); console.error(`${String(error)}\n증거: ${directory}`); process.exitCode = 1; }
  process.exit(process.exitCode ?? 0);
}

try {
  if (process.platform === "win32") throw new Error("이 합성 fixture의 직접 실행은 Windows 실기에서 지원·검증하지 않았습니다.");
  if (uiOnly) {
    await run("focused", "bun", ["test", "test/activity-sidebar.test.ts", "test/native-activity.test.ts", "test/projection.test.ts", "--timeout", "30000"]);
    await run("build", "npm", ["run", "build"]);
  } else {
    await run("repository", "npm", ["run", "check"]);
  }
  const fixture    = await fs.mkdtemp(path.join(directory, "workspace-")) ;
  const reportPath = path.join(directory, "probe.json")                   ;
  const binary = process.platform === "darwin"
    ? path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron")
    : path.join(root, "node_modules/electron/dist/electron");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    WWW_CODEX_BIN       : path.join(root, "test/fixtures/activity-app-server.ts") ,
    WWW_PROBE_PATH      : reportPath                                              ,
    WWW_PROBE_WORKSPACE : fixture                                                 ,
    WWW_PROBE_ACTIVITY  : "1"
  };
  for (const key of ["ELECTRON_RUN_AS_NODE", "WWW_NATIVE_PROBE", "WWW_PROBE_REPORTS", "WWW_PROBE_NATIVE_REPORTS", "WWW_PROBE_REPORT_JUDGE_BIN", "WWW_PROBE_DEVELOPMENT_WORK_ID", "WWW_PROBE_EXPECT_DEVELOPMENT_COMPLETE"]) delete env[key];
  await run("electron", binary, [root, `--user-data-dir=${path.join(directory, "profile")}`], env);
  const result: unknown = JSON.parse(await fs.readFile(reportPath, "utf8"));
  if (!object(result)) throw new Error("Electron probe 객체가 없습니다.");
  if (result.error) throw new Error(String(result.error));
  if (!object(result.nativeActivity)) throw new Error("활동 시나리오 결과가 없습니다.");
  for (const key of ["skillsListed", "hooksListed", "inventoryRaceSuppressed", "skillsObserved", "multipleSkillsObserved", "hooksObserved", "fixedOrder", "extendedHighlight", "historyNotReplayed", "conversationRestoreDedupe", "privateReasoningHidden", "turnGrouping", "historySelectionPreserved", "usageNotDuplicated", "modelRerouted", "wwwRolesObserved", "wwwSkillsObserved", "generalHooksSecondary", "hookFailureExplained"]) {
    if (result.nativeActivity[key] !== true) throw new Error(`활동 시나리오 실패: ${key}`);
  }
  const artifacts = object(result.activityArtifacts) ? result.activityArtifacts : {};
  if (
       typeof artifacts.width    !== "number"
    || artifacts.width           <=  0
    || artifacts.overflow        !== false
    || artifacts.reducedMotion   !== true
    || artifacts.rowAnimation    !== "none"
  ) throw new Error("좁은 활동 패널·모션 축소 관측이 없습니다.");
  const captures = (await fs.readdir(directory)).filter((name) => name.endsWith(".png"));
  if (captures.length === 0) throw new Error("Electron 화면 캡처가 없습니다.");
  for (const capture of captures) {
    if ((await fs.stat(path.join(directory, capture))).size === 0) throw new Error(`화면 캡처가 비었습니다: ${capture}`);
  }
  const summary = {
    result            : "passed"                                                                                                                                               ,
    mode              : uiOnly ? "ui-only" : "full"                                                                                                                            ,
    typecheck         : uiOnly ? "not_run" : "passed"                                                                                                                          ,
    evidence          : path.relative(root, directory)                                                                                                                         ,
    coverage          : `실제 Electron + 합성 Native subprocess. 실제 모델·계정·Windows 실기는 검증하지 않음${uiOnly ? ". 명시 UI 전용 실행으로 전체 타입검사를 제외함" : ""}` ,
    nativeActivity    : result.nativeActivity                                                                                                                                  ,
    activityArtifacts : artifacts                                                                                                                                              ,
    captures
  };
  await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} catch (error) {
  await fs.writeFile(path.join(directory, "failure.txt"), String(error));
  console.error(`${String(error)}\n증거: ${directory}`);
  process.exitCode = 1;
}
