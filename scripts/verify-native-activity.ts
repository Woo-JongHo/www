#!/usr/bin/env node
// 실제 Electron과 합성 subprocess의 활동 표시 연결을 검사한다. 실제 모델·계정 검증은 아니다.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openWork } from "./workflow/work.ts";

const chat007 = process.argv.includes("--chat007-monitor");
const uiOnly = process.argv.slice(2).includes("--ui-only");
const liveObservability = process.argv.includes("--observability-live");
const livePlan = process.argv.includes("--plan-document-live");
const planProbe = livePlan || process.argv.includes("--plan-document");
const liveHarness = process.argv.includes("--harness-receipt-live");
const failedHarness = process.argv.includes("--harness-receipt-failed");
const harnessProbe = liveHarness || failedHarness || process.argv.includes("--harness-receipt");
const observabilityWorkId = "work-36d312bc-a767-4e3e-a581-01898b35f75f";
const liveAttemptId = "dashboard-live-observation";
const livePrompt = "읽기 전용 WWW 단계 관측 검증 표본입니다. 구현, 파일 변경, 명령 실행, 하네스 실행 없이 제공된 www_development_stage 도구를 정확히 두 번 호출하세요. 작업 ID는 "
  + observabilityWorkId + ", phase는 verify, attemptId는 " + liveAttemptId + "이며 첫 status는 selected, 둘째 status는 running입니다. 두 결과를 확인한 뒤 관측을 마쳤다고 답하세요.";

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
  let planPath = "docs/work/Chat/015-WWW 스킬 단계와 Plan 및 Progress 관측 누락/tasks.md";
  const fixturePlan = planProbe && !livePlan;
  const workspace = harnessProbe || fixturePlan ? path.join(directory, "workspace") : root;
  const workflowEntry = path.join(root, "scripts/workflow.ts");
  const nodeBinary = process.execPath;
  const args = failedHarness ? ["-e", "process.exit(7)"] : ["--version"];
  const verifier = { command: nodeBinary, args, criterionIds: ["PROCESS"] };
  const request = "독립 검증 공간에서 승인된 읽기 전용 Node 명령을 실행합니다.";
  let workId = observabilityWorkId;
  let otherPlanWorkId = "";
  let otherPlanSha = "";
  if (workspace !== root) {
    await fs.mkdir(path.join(workspace, "docs/work"), { recursive: true });
    await fs.writeFile(path.join(workspace, "docs/work/INDEX.md"), "# 작업 목차\n");
    await fs.cp(path.join(root, "dist"), path.join(workspace, "dist"), { recursive: true });
    await fs.writeFile(path.join(workspace, "package.json"), JSON.stringify({ name: "www", version: "0.1.0", main: "dist/main.js" }));
  }
  if (harnessProbe) {
    const work = await openWork({
      repo: workspace, role: "www-dev", direct: true, requestId: "harness-sample", request,
      decision: { intent: "verify", area: "Chat", title: "대화 실행 근거 검증", criteria: [{ id: "PROCESS", description: "공식 검증에서 프로세스가 실제 종료한다." }] },
      approval: { verifierCommands: [JSON.stringify([nodeBinary, ...args])] }, inputs: ["package.json"],
    });
    workId = work.record.id;
  }
  if (fixturePlan) {
    async function addFixturePlan(title: string) {
      const work = await openWork({
        repo: workspace, role: "www-dev", direct: true, requestId: title, request: title,
        decision: { intent: "verify", area: "Chat", title, criteria: [{ id: "PLAN", description: "현재 계획 원문과 버전을 관측한다." }] },
        approval: {}, inputs: ["package.json"],
      });
      const file = path.join(path.dirname(work.path), "tasks.md");
      const content = `# ${title}\n\n현재 구현 범위는 Electron 계획 문서 검증이다.\n`;
      await fs.writeFile(file, content);
      return { workId: work.record.id, path: path.relative(workspace, file), sha: createHash("sha256").update(content).digest("hex") };
    }
    const requested = await addFixturePlan("현재 계획 검증");
    const competing = await addFixturePlan("다른 작업 계획 검증");
    workId = requested.workId;
    planPath = requested.path;
    otherPlanWorkId = competing.workId;
    otherPlanSha = competing.sha;
  }
  const planSha = planProbe ? createHash("sha256").update(await fs.readFile(path.join(workspace, planPath))).digest("hex") : "";
  const workflowOptions = { repo: workspace, role: "www-dev", direct: true, execute: true, request, decision: { intent: "verify", workId }, verifier };
  const usesLiveModel = liveObservability || livePlan || liveHarness;
  const env: NodeJS.ProcessEnv = { ...process.env, WWW_NATIVE_PROBE: "1", WWW_PROBE_PATH: path.join(directory, "disabled.json"), WWW_PROBE_WORKSPACE: workspace, WWW_CODEX_BIN: usesLiveModel ? process.env.WWW_CODEX_BIN || "codex" : path.join(root, "test/fixtures/activity-app-server.ts"), WWW_STAGE_PROBE: "1", WWW_CHAT007_PROBE: chat007 ? "1" : "0", WWW_STAGE_WORK_ID: workId, WWW_PROBE_NATIVE_REPORTS: "0", WWW_PLAN_PROBE_SHA256: planSha,
    ...(harnessProbe && !liveHarness ? { WWW_HARNESS_PROBE_ENTRY: workflowEntry, WWW_HARNESS_PROBE_OPTIONS: JSON.stringify(workflowOptions) } : {}),
  };
  if (fixturePlan) {
    env.WWW_PLAN_PROBE_OTHER_WORK = otherPlanWorkId;
    env.WWW_PLAN_PROBE_OTHER_SHA256 = otherPlanSha;
  }
  delete env.ELECTRON_RUN_AS_NODE;
  const binary = process.platform === "darwin" ? path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron") : path.join(root, "node_modules/electron/dist/electron");
  const child = spawn(binary, [workspace, `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(directory, "profile")}`], { cwd: root, env, stdio: ["ignore", stdout.fd, stderr.fd] });
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
    const wait = async (expression: string, label: string) => { for (let attempt = 0; attempt < (usesLiveModel ? 1_800 : 300); attempt++) { if (await evaluate(`(async()=>Boolean(await (${expression})))()`)) { checks.push(label); return; } await pause(50); } throw new Error(`${label}: ${String(await evaluate("document.body.innerText"))}`); };
    const click = async (selector: string) => { await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!(e instanceof HTMLElement)||e.closest('[hidden]')||e.disabled)throw Error('클릭 불가');e.click()})()`); };
    const screenshot = async (name: string) => { const result = await command("Page.captureScreenshot", { format: "png" }); if (!object(result) || typeof result.data !== "string") throw new Error("화면 캡처 실패"); await fs.writeFile(path.join(directory, name), Buffer.from(result.data, "base64")); };
    await wait("(()=>{const e=document.querySelector('[data-testid=\"open-current-workspace\"]');return document.querySelector('.dashboard-captured') && e instanceof HTMLButtonElement && !e.disabled && !e.closest('[hidden]') && e.getBoundingClientRect().width>0})()", "WWW 보드 수집·프로젝트 진입 버튼 활성 준비");
    await click('[data-testid="open-current-workspace"]');
    await wait("document.querySelector('[data-testid=\"chat-nav\"]')", "대화 메뉴 준비");
    await click('[data-testid="chat-nav"]');
    const first: unknown = await evaluate("window.www.listSessions().then(s=>s[0]?.id)");
    if (typeof first !== "string") throw new Error("첫 탭 식별자가 없습니다.");
    const surface = `[data-session-id="${first}"]`;
    const sidebar = chat007 ? await evaluate(`(() => {
      const root = document.querySelector(${JSON.stringify(surface + ' [data-testid="resource-sidebar"]')});
      const text = e => e?.checkVisibility({opacityProperty:true,visibilityProperty:true}) && e.getBoundingClientRect().width > 0 ? e.innerText.trim() : "";
      return {agent: text(root?.querySelector(".ao-agent-root h3")), sidebar: Array.from(root?.querySelectorAll(".ao-skills > li") ?? [], row => text(row.querySelector("strong")) + ":" + text(row.querySelector("small")))};
    })()`) : undefined;
    const prompt = liveHarness ? `현재 독립 검증 공간의 아래 읽기 전용 명령 한 번을 승인합니다. 먼저 www_development_stage에 workId ${workId}, phase verify, status running, attemptId harness-sample을 전달하세요. 응답의 실행 ID를 다음 공식 명령의 eventId 값에 넣어 정확히 한 번 실행하세요. ${JSON.stringify(nodeBinary)} ${JSON.stringify(workflowEntry)} '${JSON.stringify({...workflowOptions,eventId:"여기에-발급-ID"})}' 이어 www_observe_harness에 동일 workId와 phase verify, attemptId harness-sample을 전달한 뒤 종료하세요. 다른 파일이나 명령은 실행하지 마세요.`
      : harnessProbe ? "실제 하네스 영수증 검증 유지"
      : livePlan ? `/plan ${observabilityWorkId}\n파일 쓰기나 다른 도구 없이 www_link_plan을 한 번 호출하세요. 확인할 SHA-256은 ${planSha}입니다.`
      : planProbe ? `/plan ${workId}\n계획 문서 연결 유지` : liveObservability ? livePrompt : "단계 관측 유지";
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(surface + ' [data-testid="prompt-input"]')});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(prompt)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await wait(`!document.querySelector(${JSON.stringify(surface + ' [data-testid="send-button"]')})?.disabled`, "입력 수용");
    await click(surface + ' [data-testid="send-button"]');
    const method = harnessProbe ? "www/harnessObserved" : planProbe ? "www/planLinked" : "www/developmentStage";
    await wait(`window.www.workspace(${JSON.stringify(first)}).then(s=>window.www.events(s)).then(e=>e.some(x=>x.method===${JSON.stringify(method)}))`, "실제 main 관측 사건 수신");
    await click(surface + ' [data-testid="monitoring-nav"]');
    const monitor = surface + ' [data-testid="monitoring-overview"]';
    if (chat007) {
      const flow = JSON.stringify(surface + ' [data-testid="www-flow"]');
      await evaluate(`Array.from(document.querySelector(${flow}).querySelectorAll("[data-artifact-id] details:not([open]) summary"), e => e.click())`);
      await wait(`document.querySelector(${flow})?.querySelectorAll("[data-artifact-id] details[open]").length === 8`, "상세 정의 8개 펼침");
      const details = await evaluate(`(() => {
        const root = document.querySelector(${JSON.stringify(surface + ' [data-testid="www-flow"]')});
        const text = e => e?.checkVisibility({opacityProperty:true,visibilityProperty:true}) && e.getBoundingClientRect().width > 0 ? e.innerText.trim() : "";
        const rows = Array.from(root?.querySelectorAll("[data-artifact-id]") ?? []);
        return { detail: rows.map(row => {
          return [text(row.querySelector("strong")), text(row.querySelector("small")), text(row.querySelector("code")), text(row.querySelector(".www-artifact-state"))];
        }), applicationEvidence: text(root?.querySelector(".www-flow-note:last-child")) };
      })()`);
      if (!object(sidebar) || !object(details)) throw Error("AC-11 화면 읽기 실패");
      console.log(JSON.stringify({ ...sidebar, ...details }));
      return;
    }
    if (harnessProbe) {
      const expected = failedHarness ? "실패" : "성공";
      const skill = monitor + ' [data-skill-id="www-verify"]';
      const events = `window.www.workspace(${JSON.stringify(first)}).then(scope=>window.www.events(scope))`;
      await wait(`document.querySelector(${JSON.stringify(skill)})?.textContent.includes(${JSON.stringify("하네스 실행 확인 · " + expected)}) && document.querySelector(${JSON.stringify(skill)})?.textContent.includes('업무 수용 미확인')`, "공식 하네스 결과와 업무 수용의 구분");
      if (!liveHarness) {
        await wait(`${events}.then(e=>e.some(x=>x.method==='fixture/harnessProcess' && x.params.exitCode===${failedHarness ? 1 : 0} && x.params.duplicateRejected) && e.filter(x=>x.method==='www/harnessObserved').length===1
          && e.some(x=>x.method==='fixture/stageResponse' && x.params.callId==='before-process' && !x.params.success)
          && e.some(x=>x.method==='fixture/stageResponse' && x.params.callId==='outside-turn' && !x.params.success)
          && e.some(x=>x.method==='fixture/stageResponse' && x.params.callId==='repeat-process' && x.params.success))`, "프로세스 실행 전·타 턴·위조·중복을 실제 근거에서 제외");
      }
      const evidence = await evaluate(`${events}.then(e=>e.filter(x=>x.method==='www/harnessObserved').map(x=>x.params))`);
      if (!Array.isArray(evidence) || evidence.length !== 1 || !object(evidence[0]) || evidence[0].workId !== workId
        || evidence[0].attemptId !== "harness-sample" || evidence[0].phase !== "verify") throw new Error("영수증과 현재 단계 식별 불일치");
      await screenshot("harness-receipt.png");
      await click('[aria-label="새 대화 탭 추가"]');
      const tab = await evaluate(`window.www.listSessions().then(s=>s.find(x=>x.id!==${JSON.stringify(first)})?.id)`);
      if (typeof tab !== "string") throw new Error("두 번째 탭 식별자가 없습니다.");
      const other = `[data-session-id="${tab}"]`;
      await wait(`document.querySelector(${JSON.stringify(other + ' [data-testid="monitoring-nav"]')})`, "두 번째 탭 준비");
      await click(other + ' [data-testid="monitoring-nav"]');
      await wait(`document.querySelector(${JSON.stringify(other + ' [data-testid="agent-tree"]')}) && !document.querySelector(${JSON.stringify(other + ' [data-testid="agent-tree"]')})?.textContent.includes('하네스 실행 확인')`, "다른 탭에 영수증 미노출");
      const summary = { result: "passed", mode: liveHarness ? "harness-receipt-live" : "harness-receipt", checks, receipts: evidence, evidence: path.relative(root, directory) };
      await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
      console.log(JSON.stringify(summary));
      return;
    }
    if (planProbe) {
      const panel = monitor + ' [data-testid="agent-plan-document"]';
      await wait(`document.querySelector(${JSON.stringify(panel)})?.dataset.documentStatus==='available'`, "정확한 문서 버전과 출처 DOM 표시");
      await click(panel + " summary");
      await wait(`document.querySelector(${JSON.stringify(panel + " details[open]")})?.textContent.includes(${JSON.stringify(planSha)}) && document.querySelector(${JSON.stringify(panel + " pre")})?.textContent.includes('현재 구현 범위')`, "확인한 계획 원문과 SHA 열기");
      if (!livePlan) {
        await wait(`document.querySelector(${JSON.stringify(monitor + ' [data-testid="agent-plan"]')})?.textContent.includes('Native 계획 항목')`, "Native 계획과 계획 문서의 동시 표시");
        await wait(`window.www.workspace(${JSON.stringify(first)}).then(s=>window.www.events(s)).then(e=>e.filter(x=>x.method==='www/planLinked').length===1 && e.filter(x=>x.method==='fixture/stageResponse').length>=5 && e.some(x=>x.method==='fixture/stageResponse' && x.params.callId==='foreign-work-plan' && x.params.success===false))`, "타 작업·타 턴·동명 알림·중복이 계획 사건으로 게시되지 않음");
      }
      await screenshot("plan-document.png");
      await click('[aria-label="새 대화 탭 추가"]');
      const tab = await evaluate(`window.www.listSessions().then(s=>s.find(x=>x.id!==${JSON.stringify(first)})?.id)`);
      if (typeof tab !== "string") throw new Error("두 번째 탭 식별자가 없습니다.");
      const other = `[data-session-id="${tab}"]`;
      await wait(`document.querySelector(${JSON.stringify(other + ' [data-testid="monitoring-nav"]')})`, "두 번째 탭 준비");
      await click(other + ' [data-testid="monitoring-nav"]');
      await wait(`document.querySelector(${JSON.stringify(other + ' [data-testid="agent-plan"]')}) && !document.querySelector(${JSON.stringify(other + ' [data-testid="agent-plan-document"]')})`, "다른 탭에는 연결한 계획이 없음");
      if (!livePlan) {
        await click(other + ' [data-testid="chat-nav"]');
        const sendPrompt = async (text: string) => {
          await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(other + ' [data-testid="prompt-input"]')});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
          await wait(`!document.querySelector(${JSON.stringify(other + ' [data-testid="send-button"]')})?.disabled`, "현재 요청 입력 수용");
          await click(other + ' [data-testid="send-button"]');
        };
        const events = `window.www.workspace(${JSON.stringify(tab)}).then(scope=>window.www.events(scope))`;
        await sendPrompt(`계획 문서 연결 유지 표본에서 일반 요청의 작업 UUID는 ${workId}입니다. 구현 진행을 유지하세요.`);
        await wait(`${events}.then(events=>events.filter(event=>event.method==='fixture/stageResponse'&&event.params.callId==='plan-link'&&event.params.success===false).length===2 && !events.some(event=>event.method==='www/planLinked'))`, "일반 요청에 UUID가 있어도 명시 요청 전에는 문서를 연결하지 않음");
        await sendPrompt(`/plan ${otherPlanWorkId}\n합성 추가 지시 거절`);
        await wait(`${events}.then(events=>events.some(event=>event.method==='turn/steerFailed' && event.params.text.includes('합성 추가 지시 거절')))`, "거절된 추가 지시 확인");
        await sendPrompt(`/plan ${workId}`);
        await wait(`${events}.then(events=>events.some(event=>event.method==='www/planLinked'&&event.params.workId===${JSON.stringify(workId)}) && !events.some(event=>event.method==='www/planAmbiguous'))`, "거절된 요청을 제외하고 수용한 추가 지시의 작업 계획을 연결");
        await sendPrompt(`/plan ${otherPlanWorkId}\n합성 추가 지시 접수 미확인`);
        await wait(`${events}.then(events=>{const steer=events.find(event=>event.method==='turn/steerUncertain');return steer && events.some(event=>event.method==='www/planAmbiguous'&&event.params.reason==='steer_uncertain') && events.some(event=>event.method==='fixture/stageResponse'&&event.params.callId===steer.params.clientUserMessageId&&event.params.success===false) && events.filter(event=>event.method==='www/planLinked').length===1})`, "접수 미확인 추가 지시의 새 작업을 수용하지 않음");
        await click(other + ' [data-testid="monitoring-nav"]');
        await wait(`document.querySelector(${JSON.stringify(other + ' [data-testid="agent-plan-uncertain"]')}) && !document.querySelector(${JSON.stringify(other + ' [data-testid="agent-plan-document"]')})`, "접수 미확인으로 이전 문서를 현재 계획에서 숨김");
        await click(other + ' [data-testid="chat-nav"]');
        await sendPrompt(`/plan ${otherPlanWorkId}\n도구 미호출 표본`);
        await wait(`${events}.then(events=>events.some(event=>event.method==='www/planAmbiguous'&&event.params.reason!=='steer_uncertain') && events.filter(event=>event.method==='www/planLinked').length===1 && !events.some(event=>event.method==='www/planLinked'&&event.params.workId===${JSON.stringify(otherPlanWorkId)}))`, "복수 작업 요청에서 새 문서를 임의로 연결하지 않음");
        await click(other + ' [data-testid="monitoring-nav"]');
        await wait(`document.querySelector(${JSON.stringify(other + ' [data-testid="agent-plan-ambiguous"]')}) && !document.querySelector(${JSON.stringify(other + ' [data-testid="agent-plan-document"]')})`, "복수 작업의 계획 모호성을 화면에 표시");
        await click('[aria-label="새 대화 탭 추가"]');
        const third = await evaluate(`window.www.listSessions().then(s=>s.find(x=>x.id!==${JSON.stringify(first)}&&x.id!==${JSON.stringify(tab)})?.id)`);
        if (typeof third !== "string") throw new Error("수집 실패를 검증할 대화 탭이 없습니다.");
        const unavailable = `[data-session-id="${third}"]`;
        const input = unavailable + ' [data-testid="prompt-input"]';
        await wait(`document.querySelector(${JSON.stringify(input)})`, "수집 실패 표본의 대화 준비");
        const missing = "/plan work-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\n없는 작업의 계획 확인 유지";
        await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(input)});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(missing)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
        await wait(`!document.querySelector(${JSON.stringify(unavailable + ' [data-testid="send-button"]')})?.disabled`, "파일을 찾을 수 없는 계획 연결 요청 수용");
        await click(unavailable + ' [data-testid="send-button"]');
        await wait(`window.www.workspace(${JSON.stringify(third)}).then(scope=>window.www.events(scope)).then(events=>events.some(event=>event.method==='www/planLinked'&&event.params.status==='failed'&&event.params.path===null))`, "작업 확인 실패에 가상의 계획 경로를 부여하지 않음");
        await click(unavailable + ' [data-testid="monitoring-nav"]');
        await wait(`document.querySelector(${JSON.stringify(unavailable + ' [data-testid="agent-plan-document"][data-document-status="failed"]')})`, "명시 요청의 수집 실패를 실제 Plan 화면에 표시");
      }
      const summary = { result: "passed", mode: livePlan ? "plan-document-live" : "plan-document", checks, planPath, evidence: path.relative(root, directory) };
      await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
      console.log(JSON.stringify(summary));
      return;
    }
    if (liveObservability) {
      await wait(`document.querySelector(${JSON.stringify(monitor + ' [data-skill-id="www-verify"]')})?.textContent.includes('진행 선언')`, "실제 모델의 verify 진행 선언이 모니터에 표시됨");
      const stageEvents: unknown = await evaluate(`window.www.workspace(${JSON.stringify(first)}).then(s=>window.www.events(s)).then(events=>events.filter(event=>event.method==='www/developmentStage').map(event=>event.params))`);
      if (!Array.isArray(stageEvents) || stageEvents.length !== 2) throw new Error("실제 단계 선언 두 건이 필요합니다.");
      const [selected, running] = stageEvents.map(value => object(value) ? value : {});
      if (!selected || !running || selected.status !== "selected" || running.status !== "running" || typeof selected.threadId !== "string" ||
        typeof selected.turnId !== "string" || selected.threadId !== running.threadId || selected.turnId !== running.turnId || ![selected, running].every(stage =>
          stage.workId === observabilityWorkId && stage.attemptId === liveAttemptId && stage.phase === "verify" && stage.source === "role_declaration")) {
        throw new Error("실제 단계 선언의 작업·세션·턴·시도 또는 순서가 일치하지 않습니다.");
      }
      await screenshot("native-stage-live.png");
      await wait(`window.www.listSessions().then(s=>!s.find(x=>x.id===${JSON.stringify(first)})?.busy)`, "실제 관측용 턴 종료");
      const summary = { result: "passed", mode: "observability-live", checks, stages: stageEvents,
        coverage: "실제 Electron·Native 모델의 역할 선언 및 DOM. 실제 하네스 영수증과 제보 세션은 별도 근거다.", evidence: path.relative(root, directory) };
      await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
      console.log(JSON.stringify(summary));
      return;
    }
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
    const activeTurn = await evaluate(`window.www.listSessions().then(s=>s.find(x=>x.id===${JSON.stringify(first)}))`);
    if (!object(activeTurn) || typeof activeTurn.threadId !== "string" || typeof activeTurn.activeTurnId !== "string") {
      throw new Error("절단 검증의 현재 Native 턴이 없습니다.");
    }
    const selector = `window.www.workspace(${JSON.stringify(first)})`;
    const thread = JSON.stringify(activeTurn.threadId);
    const turn = JSON.stringify(activeTurn.activeTurnId);
    await evaluate(`${selector}.then(scope=>window.www.steerTurn(scope,${thread},${turn},'관측 검증 이력 절단',crypto.randomUUID()))`);
    await wait(`${selector}.then(scope=>window.www.events(scope)).then(events=>events.length===2000 && !events.some(event=>event.method==='www/developmentStage') && events.some(event=>event.method==='fixture/stageOverflow'))`, "실제 Electron에 전달하는 관측 사건 2,000건 절단");
    await wait(`document.querySelector(${JSON.stringify(monitor)})?.textContent.includes('일부 이력만 보관') && !document.querySelector(${JSON.stringify(monitor)})?.textContent.includes('진행 선언')`, "절단된 단계의 현재 연결과 이전 계획이 미확인으로 표시됨");
    await evaluate(`${selector}.then(scope=>window.www.interrupt(scope,${thread},${turn}))`);
    await wait(`window.www.listSessions().then(s=>!s.find(x=>x.id===${JSON.stringify(first)})?.busy)`, "관측 중인 턴 중단 수용");
    await command("Emulation.clearDeviceMetricsOverride");
    await click(surface + ' [data-testid="chat-nav"]');
    await wait(`document.querySelector(${JSON.stringify(surface + ' [data-thread-id="stage-probe-restored"]')})`, "읽기 전용으로 복원할 대화 선택 준비");
    await click(surface + ' [data-thread-id="stage-probe-restored"]');
    await wait(`${selector}.then(scope=>window.www.events(scope)).then(events=>events.some(event=> event.historical && event.params?.item?.id==='restored-public-commentary'))`, "Native 재개에서 실제 복원 표본 수신");
    await click(surface + ' [data-testid="monitoring-nav"]');
    await wait(`document.querySelector(${JSON.stringify(monitor)})?.textContent.includes('복원 대화의 단계 관측 미연결') && !document.querySelector(${JSON.stringify(monitor)})?.textContent.includes('진행 선언')`, "복원 대화에서 이전 작업의 단계 선언을 새 연결로 표시하지 않음");
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

if (chat007 || process.argv.includes("--observability") || liveObservability || planProbe || harnessProbe) {
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
