#!/usr/bin/env node
// 실제 Electron 화면·CDP 입력·IPC를 검증한다. Native는 기존 합성 fixture다.
import { execFileSync, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanVerificationCaches, stopVerificationApp } from "./evidence-retention.ts";

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
  for (const [directory, title, id] of [[workspace, "RPA A 고유 카드", "work-11111111-1111-4111-8111-111111111111"], [workspaceB, "RPA B 고유 카드", "work-11111111-1111-4111-8111-111111111111"]]) {
    const work = path.join(directory!, "docs/work/Fixture/001-board");
    await fs.mkdir(work, { recursive: true });
    await fs.writeFile(path.join(work, "work.json"), JSON.stringify({ schemaVersion: 1, id, title, status: "in_progress", blockedReason: null, areas: ["ui"], owner: "ui", criteria: [{ id: "AC-1", description: `${title}의 작업 계획과 검증 근거를 확인한다`, required: true, result: "unverified" }] }));
    if (directory === workspaceB) await fs.writeFile(path.join(work, "spec.md"), "# RPA B 전용 명세\n\n공유 UUID이지만 B 프로젝트 본문입니다.\n");
    if (directory === workspace) {
      await fs.writeFile(path.join(work, "spec.md"), "# 칸반 상세 명세\n\n카드에서 같은 작업의 계획을 확인하고 돌아온다.\n\n<script>window.__dashboardInjected=true</script>\n\n[외부 링크](https://example.com)\n\n![원격 이미지](https://example.com/tracker.png)\n");
      await fs.writeFile(path.join(work, "tasks.md"), "# 실행 계획\n\n| 할 일 | 확인 방법 |\n|---|---|\n| 작업 상세 읽기 | 실제 화면에서 확인 |\n");
      await fs.writeFile(path.join(work, "verification.md"), "");
    }
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
    await wait(`JSON.stringify(Array.from(document.querySelectorAll('.workspace-nav > button')).map(n=>n.dataset.testid))===${JSON.stringify(JSON.stringify(["dashboard-nav", "chat-nav", "ecosystem-nav", "reports-nav", "monitoring-nav"]))}`, `${label} 다섯 공통 메뉴 순서`);
    for (const [name, selector, panel] of [
      ["대시보드", "dashboard-nav", '[data-testid="target-dashboard"]'],
      ["대화", "chat-nav", "main.work"],
      ["생태계", "ecosystem-nav", ".ecosystem-shell"],
      ["리포트", "reports-nav", "main.reports-work"],
      ["모니터링", "monitoring-nav", '[data-testid="session-monitoring"]'],
    ]) {
      await click(`[data-testid="${selector}"]`);
      await wait(`${visible(panel!)} && document.querySelector('[data-testid="${selector}"]').getAttribute('aria-current')==='page' && window.www.workspace().then(w=>w.path===${JSON.stringify(expectedPath)})`, `${label} ${name} 실제 클릭·화면·선택 대상 유지`);
      await screenshot(`${label}-${selector}`);
    }
    await click('[data-testid="monitoring-return-chat"]');
    await wait(`${visible("main.work")} && document.querySelector('[data-testid="chat-nav"]').getAttribute('aria-current')==='page' && window.www.workspace().then(w=>w.path===${JSON.stringify(expectedPath)})`, `${label} 모니터링에서 대화 복귀·선택 대상 유지`);
    await click('[data-testid="dashboard-nav"]');
    await wait(`${visible('[data-testid="target-dashboard"]')} && document.querySelector('[data-testid="dashboard-nav"]').getAttribute('aria-current')==='page' && window.www.workspace().then(w=>w.path===${JSON.stringify(expectedPath)})`, `${label} 대시보드 복귀·선택 대상 유지`);
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
    const scopedCards = await evalPage("Array.from(document.querySelectorAll('.dashboard-card')).map(n=>({project:n.querySelector('.dashboard-card-project')?.textContent,key:n.dataset.projectKey,id:n.dataset.workId}))");
    if (!Array.isArray(scopedCards)) throw Error("프로젝트별 카드 식별 없음");
    const scopedCard = (name: string): string => {
      const card = scopedCards.map(object).find(value => value.project === name);
      if (!card || typeof card.key !== "string" || card.id !== "work-11111111-1111-4111-8111-111111111111") throw Error("공유 UUID fixture 식별 실패: " + name);
      return "[data-project-key=" + JSON.stringify(card.key) + "][data-work-id=" + JSON.stringify(card.id) + "]";
    };
    const workA = scopedCard("rpa-a");
    const workB = scopedCard("rpa-b");
    if (workA === workB) throw Error("같은 UUID의 서로 다른 프로젝트 key가 필요합니다.");
    let workAFile = path.join(workspace, 'docs/work/Fixture/001-board/work.json');
    const changedWork = object(JSON.parse(await fs.readFile(workAFile, 'utf8')));
    changedWork.status = 'done';
    changedWork.owner = 'dev';
    changedWork.areas = ['dev', 'ops'];
    changedWork.criteria = [{ id: 'AC-1', description: 'RPA A 고유 카드의 작업 계획과 검증 근거를 확인한다', required: true, result: 'passed' }];
    await fs.rename(path.dirname(workAFile), path.join(workspace, 'docs/work/Fixture/001-relocated'));
    workAFile = path.join(workspace, 'docs/work/Fixture/001-relocated/work.json');
    await fs.writeFile(workAFile, JSON.stringify(changedWork));
    await click(workA);
    await wait("document.querySelector('.dashboard-criteria')?.textContent.includes('RPA A 고유 카드의 작업 계획') && document.querySelectorAll('.dashboard-document').length===4", "카드 선택에서 실제 IPC·같은 UUID 기준·네 문서 읽기");
    await wait("document.activeElement===document.querySelector('.dashboard-detail h2')", "상세 제목으로 키보드 초점 이동");
    await wait("document.querySelector('.dashboard-detail dl')?.textContent.includes('완료 (done)') && document.querySelector('.dashboard-detail dl')?.textContent.includes('1/1') && document.querySelector('.dashboard-criteria')?.textContent.includes('통과')", "목록 수집 이후 원장 변경에도 상세 요약과 기준은 동일 응답");
    await wait("(()=>{const value=label=>Array.from(document.querySelectorAll('.dashboard-detail dt')).find(n=>n.textContent===label)?.nextElementSibling?.textContent;return value('담당')==='dev'&&value('영역')==='dev, ops'&&value('원본 경로')==='docs/work/Fixture/001-relocated/work.json'})()", "상세 담당·영역·원본 경로도 새 상세 원장 응답을 사용");
    await click('.dashboard-document:nth-of-type(1) summary');
    await wait("document.querySelector('.dashboard-markdown')?.textContent.includes('칸반 상세 명세') && !document.querySelector('.dashboard-detail script,.dashboard-detail img,.dashboard-detail a') && !window.__dashboardInjected", "명세 Markdown 표시·스크립트·링크·원격 이미지 비활성");
    await click('.dashboard-document:nth-of-type(3) summary');
    await wait("document.querySelector('.dashboard-document:nth-of-type(3) table')?.textContent.includes('작업 상세 읽기')", "같은 작업의 Todo·검사 방법 표 표시");
    await click('.dashboard-document:nth-of-type(4) summary');
    await wait("document.querySelector('.dashboard-document:nth-of-type(4)')?.textContent.includes('문서가 비어 있습니다.')", "빈 검증 문서와 미작성 문서 구분");
    const beforeCapture = await evalPage("document.querySelector('.dashboard-detail-captured time')?.dateTime");
    await click('.dashboard-header > button');
    await wait(`document.querySelector('.dashboard-detail-captured time')?.dateTime!==${JSON.stringify(beforeCapture)} && !document.querySelector('.dashboard-detail-captured [role="status"]') && document.querySelector('.dashboard-document:nth-of-type(3)')?.open===true && document.querySelector('.dashboard-document:nth-of-type(3) table')?.textContent.includes('작업 상세 읽기')`, "보드 재수집과 상세 응답 완료 뒤 펼친 계획 문서 유지");
    const refreshBoard = async (label: string) => {
      await wait("document.querySelector('.dashboard-header > button')?.disabled===false", label + " 새로고침 준비");
      const captured = await evalPage("document.querySelector('.dashboard-captured time')?.dateTime");
      await click('.dashboard-header > button');
      await wait(`document.querySelector('.dashboard-captured time')?.dateTime!==${JSON.stringify(captured)} && document.querySelector('.dashboard-header > button')?.disabled===false`, label + " 새 snapshot 반영");
    };
    const publicProject = async () => object(await evalPage(`(async()=>{const selection=await window.www.workspace();const snapshot=await window.www.dashboard(selection);return snapshot.projects.find(item=>item.project.path===${JSON.stringify(workspace)})})()`));
    const sibling = path.join(workspace, 'docs/work/Fixture/002-readable');
    await fs.mkdir(sibling);
    await fs.writeFile(path.join(sibling, 'work.json'), JSON.stringify({ ...changedWork, id: 'work-33333333-3333-4333-8333-333333333333', title: '권한 실패 중 읽기 가능한 형제' }));
    const preservedCapture = await evalPage("document.querySelector('.dashboard-detail-captured time')?.dateTime");
    await fs.chmod(workAFile, 0o000);
    try {
      const partial = await publicProject();
      if (partial.coverage !== 'partial' || !Array.isArray(partial.issues) || !partial.issues.some(item => object(item).code === 'permission_denied')) throw Error('실제 OS 권한 오류의 부분 수집이 관측되지 않았습니다.');
      await fs.writeFile(path.join(evidence, 'permission-partial.json'), JSON.stringify(partial, null, 2));
      await refreshBoard('선택 원장 권한 오류');
      await wait(`document.querySelector('.dashboard-detail [role="alert"]')?.textContent.includes('다시 시도') && document.querySelector('.dashboard-detail-captured time')?.dateTime===${JSON.stringify(preservedCapture)} && document.querySelector('.dashboard-detail-captured')?.textContent.includes('갱신 전 수집 내용') && document.querySelector('.dashboard-document:nth-of-type(3)')?.open===true && document.querySelector('.dashboard-document:nth-of-type(3) table')?.textContent.includes('작업 상세 읽기') && !document.querySelector(${JSON.stringify(workA)})`, '부분 수집에서 빠진 작업도 이전 상세·시각·계획 펼침·오류·재시도 보존');
      await screenshot('kanban-permission-stale');
    } finally { await fs.chmod(workAFile, 0o600); }
    await click('.dashboard-detail [role="alert"] button');
    await wait(`document.querySelector('.dashboard-detail-captured time')?.dateTime!==${JSON.stringify(preservedCapture)} && !document.querySelector('.dashboard-detail [role="alert"]') && document.querySelector('.dashboard-document:nth-of-type(3)')?.open===true`, '실제 권한 복원 뒤 상세 재시도 성공·시각 갱신·펼침 보존');
    await fs.rm(sibling, { recursive: true });
    await refreshBoard('권한 복원 후 완전 수집');
    await wait("!document.querySelector('.dashboard-detail-captured [role=\"status\"]')", '복원된 상세 갱신 완료');
    await command('Emulation.setDeviceMetricsOverride', { width: 640, height: 860, deviceScaleFactor: 1, mobile: false });
    const narrowBounds = async () => object(await evalPage(`(() => {
      const detail=document.querySelector('.dashboard-detail');
      const heading=detail?.querySelector('h2');
      const container=document.querySelector('.dashboard');
      if(!detail||!heading||!container)throw Error('좁은 상세 촬영 대상 없음');
      return {detail:detail.getBoundingClientRect().toJSON(),heading:heading.getBoundingClientRect().toJSON(),container:container.getBoundingClientRect().toJSON(),scrollTop:container.scrollTop,viewport:{width:innerWidth,height:innerHeight}};
    })()`));
    const narrowBefore = await narrowBounds();
    for (let attempt=0;attempt<20;attempt++) {
      const bounds=await narrowBounds();
      const heading=object(bounds.heading), container=object(bounds.container);
      if(typeof heading.top!=='number'||typeof heading.bottom!=='number'||typeof container.top!=='number'||typeof container.bottom!=='number'||typeof container.right!=='number')throw Error('좁은 상세 위치 정보 없음');
      if(heading.top>=container.top+8&&heading.top<=container.top+120&&heading.bottom<container.bottom)break;
      const deltaY=Math.max(-600,Math.min(600,heading.top-container.top-24));
      await command('Input.dispatchMouseEvent',{type:'mouseWheel',x:container.right-12,y:container.top+80,deltaX:0,deltaY});
      await pause(100);
    }
    await wait("(()=>{const detail=document.querySelector('.dashboard-detail'),heading=detail?.querySelector('h2'),title=detail?.querySelector('h3'),container=document.querySelector('.dashboard');if(!detail||!heading||!title||!container)return false;const d=detail.getBoundingClientRect(),h=heading.getBoundingClientRect(),t=title.getBoundingClientRect(),c=container.getBoundingClientRect();return h.top>=c.top+8&&h.bottom<c.bottom&&t.bottom<c.bottom&&d.bottom>c.top+200&&d.left>=c.left&&d.right<=innerWidth+1&&document.documentElement.scrollWidth<=innerWidth+1})()", "640px 실제 휠로 상세 제목과 본문을 가시 영역에 배치");
    await fs.writeFile(path.join(evidence,'kanban-detail-narrow-bounds.json'),JSON.stringify({before:narrowBefore,after:await narrowBounds()},null,2));
    await screenshot('kanban-detail-narrow');
    await wait("document.querySelector('.dashboard-detail')?.textContent.includes('현재 적용성은 평가하지 않았습니다.') && document.querySelector('.dashboard-detail')?.getBoundingClientRect().width>0 && document.documentElement.scrollWidth<=window.innerWidth+1", "640px 좁은 화면에서 전체 가로 넘침 없이 근거·적용성 표시");
    await command('Emulation.clearDeviceMetricsOverride');
    await click('[aria-label="작업 상세 닫기"]');
    await wait(`!document.querySelector('.dashboard-detail') && document.activeElement===document.querySelector(${JSON.stringify(workA)})`, "상태 변경으로 카드 열이 바뀐 뒤에도 현재 카드로 초점 복귀");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 36 });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await wait("document.querySelector('.dashboard-detail h3')?.textContent==='RPA A 고유 카드'", "복귀 카드에서 실제 Enter로 상세 다시 열기");
    await click(workA);
    await click(workB);
    await wait("document.querySelector('.dashboard-detail h3')?.textContent==='RPA B 고유 카드' && document.querySelector('.dashboard-criteria')?.textContent.includes('RPA B 고유 카드의 작업 계획')", "다른 카드 선택 뒤 이전 작업 내용 격리");
    await click('.dashboard-document:nth-of-type(1) summary');
    await wait("document.querySelector('.dashboard-detail')?.textContent.includes('공유 UUID이지만 B 프로젝트 본문입니다.') && !document.querySelector('.dashboard-detail')?.textContent.includes('카드에서 같은 작업의 계획을 확인하고 돌아온다.') && document.querySelector('.dashboard-detail dl')?.textContent.includes('work-11111111-1111-4111-8111-111111111111')", "동일 UUID도 프로젝트 key로 상세 본문과 기준을 격리");
    await click('.dashboard-document:nth-of-type(3) summary');
    await wait("document.querySelector('.dashboard-document:nth-of-type(3)')?.textContent.includes('기록된 계획이 없습니다.') && !document.querySelector('.dashboard-detail')?.textContent.includes('작업 상세 읽기')", "계획 미작성 표시와 이전 계획 비노출");
    await click('[aria-label="작업 상세 닫기"]');
    await click(workA);
    await wait("document.querySelector('.dashboard-detail h3')?.textContent==='RPA A 고유 카드' && document.querySelector('.dashboard-detail-captured time')", '완전 수집 실패 전 상세 열기');
    await fs.chmod(workAFile, 0o000);
    try {
      const failed = await publicProject();
      if (failed.coverage !== 'failed') throw Error('모든 원장 읽기 실패가 failed coverage가 아닙니다.');
      await fs.writeFile(path.join(evidence, 'permission-failed.json'), JSON.stringify(failed, null, 2));
      await refreshBoard('프로젝트 전체 수집 실패');
      await wait("document.querySelector('.dashboard-detail [role=\"alert\"] button') && document.querySelector('.dashboard-detail-captured time')", '전체 수집 실패에도 상세·시각·재시도 보존');
      await click('[aria-label="작업 상세 닫기"]');
    } finally { await fs.chmod(workAFile, 0o600); }
    await refreshBoard('실패 중 닫기 뒤 복원');
    await wait("!document.querySelector('.dashboard-detail')", '명시 닫기 뒤 원장 복원으로 과거 상세가 다시 나타나지 않음');
    await click(workA);
    await wait("document.querySelector('.dashboard-detail-captured time')", '삭제 전 상세 응답 도착');
    const restoredBytes = await fs.readFile(workAFile);
    await fs.unlink(workAFile);
    try {
      const empty = await publicProject();
      if (empty.coverage !== 'empty') throw Error('실제 원장 삭제 후 empty coverage가 아닙니다.');
      await refreshBoard('선택 원장 실제 삭제');
      await wait("!document.querySelector('.dashboard-detail')", '완전하게 확인한 원장 삭제는 이전 상세를 제거');
    } finally { await fs.writeFile(workAFile, restoredBytes); }
    await refreshBoard('삭제 뒤 원장 복구');
    await wait("!document.querySelector('.dashboard-detail')", '삭제된 원장 복구만으로 상세가 자동 복원되지 않음');
    await click(workA);
    await wait("document.querySelector('.dashboard-detail-captured time')", '필터 변경 전 상세 응답 도착');
    await evalPage(`(()=>{const select=document.querySelector('[aria-label="대시보드 프로젝트 필터"]');select.value=${JSON.stringify(String(object(scopedCards.map(object).find(value => value.project === 'rpa-b')).key))};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await wait("!document.querySelector('.dashboard-detail')", '프로젝트 필터 변경은 상세를 회수');
    await evalPage("(()=>{const select=document.querySelector('[aria-label=\"대시보드 프로젝트 필터\"]');select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await wait(`!document.querySelector('.dashboard-detail') && document.querySelector(${JSON.stringify(workA)})`, '같은 범위로 복귀해도 과거 상세를 노출하지 않음');
    await noNative("칸반 상세·계획·검증 근거 읽기");
    await noNative("다중 RPA 전체 보드 조회");
    await screenshot("multiple-global-board");
    await click('[data-testid="open-current-workspace"]');
    await wait(`${visible('[data-testid="target-dashboard"]')} && JSON.stringify((${cards}).map(c=>c.title).sort())===${JSON.stringify(JSON.stringify(cardsA))}`, "RPA A 보드 카드 집합은 A만");
    await noNative("RPA A 대상 보드 조회");
    await screenshot("multiple-rpa-board");
    await click('[data-testid="view-page-nav"]');
    await click('[data-testid="global-dashboard-nav"]');
    await wait(visible('[data-testid="view-page"]'), "보드 비교 중 전체 보기 복귀");
    await noNative("RPA 보드에서 전체 보기 복귀");
    await click(workA);
    await wait("document.querySelector('.dashboard-detail h3')?.textContent==='RPA A 고유 카드' && document.querySelector('.dashboard-detail-captured time')", '실제 프로젝트 선택 변경 전 상세 읽기');
    await click('[data-testid="open-www"]');
    await wait(`${visible('[data-testid="target-dashboard"]')} && JSON.stringify((${cards}).map(c=>c.title).sort())===${JSON.stringify(JSON.stringify(cardsWww))}`, "WWW 대상 보드 카드 집합은 WWW만");
    await wait("!document.querySelector('.dashboard-detail')", '실제 프로젝트 선택 변경은 이전 상세 캐시를 회수');
    await noNative("WWW 대상 보드 조회");
    await screenshot("multiple-www-board");
    await click('[data-testid="view-page-nav"]');
    await click('[data-testid="global-dashboard-nav"]');
    await wait(visible('[data-testid="view-page"]'), "WWW 보드에서 전체 보기 복귀");
    await wait("!document.querySelector('.dashboard-detail')", '전체 보기 복귀에도 이전 프로젝트 상세가 나타나지 않음');
    await noNative("WWW 보드에서 전체 보기 복귀");
    await click(`button[title=${JSON.stringify(workspace)}]`);
    await target("RPA", workspace);
    await click('[data-testid="view-page-nav"]');
    await click('[data-testid="global-dashboard-nav"]');
    await wait(visible('[data-testid="view-page"]'), "RPA에서 전체 보기 복귀");
    await click('[data-testid="open-www"]');
    await target("WWW", root);
    await click('[data-testid="view-page-nav"]');
    await click('[data-testid="global-dashboard-nav"]');
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
  try { await stopVerificationApp(child); }
  finally { await Promise.all([stdout.close(), stderr.close()]); }
  await cleanVerificationCaches(evidence);
}

if (failure) throw failure;
}

await run("empty");
await run("multiple");
