import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeArchitecture } from "./generate-architecture.ts";

type Data = Record<string, unknown>;
function isObject(value: unknown): value is Data { return value !== null && typeof value === "object" && !Array.isArray(value); }
function object(value: unknown): Data { return isObject(value) ? value : {}; }

const root                         = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")        ;
const directory                    = await fs.mkdtemp(path.join(root, ".www/evidence/architecture-"))        ;
const checks : string[]            = []                                                                      ;
const pause                        = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) ;
let child    : ChildProcess | null = null                                                                    ;
let socket   : WebSocket | null    = null                                                                    ;

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
  const port = await freePort()   ;
  const env  = { ...process.env } ;
  for (const key of ["ELECTRON_RUN_AS_NODE", "WWW_PROBE_ACTIVITY", "WWW_PROBE_REPORTS", "WWW_PROBE_NATIVE_REPORTS", "WWW_PROBE_DEVELOPMENT_WORK_ID"]) delete env[key];
  const binary = process.platform === "darwin" ? path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron") : path.join(root, "node_modules/electron/dist", process.platform === "win32" ? "electron.exe" : "electron") ;
  const output = await fs.open(path.join(directory, "electron.log"), "w")                                                                                                                                                                       ;
  try {
    child = spawn(binary, [root, `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(directory, "profile")}`], {
      cwd: root, stdio: ["ignore", output.fd, output.fd],
      env: { ...env, WWW_PROBE_PATH: path.join(directory, "disabled-probe.json"), WWW_NATIVE_PROBE: "1", WWW_PROBE_WORKSPACE: root, WWW_CODEX_BIN: path.join(root, "test/fixtures/sessions-app-server.ts"), WWW_SESSION_FIXTURE_DIR: directory },
    });
    let spawnError: Error | null = null;
    child.once("error", (error) => { spawnError = error; });
    const deadline = Date.now() + 25_000 ;
    let endpoint   = ""                  ;
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
    let nextId    = 0                                                                                                                      ;
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>() ;
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
      const id    = ++nextId                                                                                     ;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP 시간 초과: ${method}`)); }, 12_000) ;
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
      const point = object(await evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(!node) throw Error('클릭 대상 없음'); node.scrollIntoView({block:'center',inline:'center'}); const r=node.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`));
      if (typeof point.x !== 'number' || typeof point.y !== 'number') throw Error('클릭 좌표 누락');
      await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
      await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
      await pause(80);
    };
    const search = async (value: string) => {
      await evaluate(`(() => { const input=document.querySelector('.blueprint-work input'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      await pause(80);
    };
    const key = async (value: string, code = value, modifiers = 0) => {
      const specialKeys = new Map<string, number>([
        ['Enter', 13],
        [' ', 32],
        ['Tab', 9],
        ['Escape', 27],
        ['ArrowDown', 40],
        ['ArrowUp', 38],
        ['ArrowLeft', 37],
        ['ArrowRight', 39],
        ['Backspace', 8],
      ]);
      const windowsVirtualKeyCode = specialKeys.get(value) ?? (value.length === 1 ? value.toUpperCase().charCodeAt(0) : 0);

      const text = modifiers & 7 ? "" : value === "Enter" ? "\r" : value.length === 1 ? value : "";

      await command("Input.dispatchKeyEvent", { type: "keyDown", key: value, code, windowsVirtualKeyCode, modifiers, text });
      await command("Input.dispatchKeyEvent", { type: "keyUp", key: value, code, windowsVirtualKeyCode, modifiers });
      await pause(50);
    };
    const capture = async (name: string) => {
      const result = object(await command("Page.captureScreenshot", { format: "png" }));
      if (typeof result.data !== "string") throw Error("화면 캡처 데이터가 없습니다.");
      await fs.writeFile(path.join(directory, `${name}.png`), Buffer.from(result.data, "base64"));
    };
    await assert("(()=>{const b=document.querySelector('[data-testid=open-current-workspace]');return document.querySelector('[data-testid=view-page]') && b && !b.disabled && b.getBoundingClientRect().width>0})()", "전체 보기와 현재 프로젝트 활성 버튼 준비");
    const homeEntry = await evaluate("(async()=>{const b=document.querySelector('[data-testid=open-current-workspace]');return {label:b.textContent,disabled:b.disabled,rect:b.getBoundingClientRect().toJSON(),workspace:await window.www.workspace()}})()");
    await fs.writeFile(path.join(directory, "home-entry.json"), JSON.stringify(homeEntry, null, 2));
    await click('[data-testid="open-current-workspace"]');
    await assert("document.querySelector('[data-testid=target-dashboard]')", "현재 프로젝트 대시보드 진입");
    await click('[data-testid="ecosystem-nav"]');
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    const rootId       = snapshot.structure.rootId                                                                                        ;
    const rootChildren = snapshot.structure.nodes.filter((entry) => entry.parent === rootId).map((entry) => entry.id).sort()              ;
    const current      = (id: string) => `document.querySelector('.blueprint-work').dataset.currentId===${JSON.stringify(id)}`            ;
    const selected     = (id: string) => `document.querySelector('.blueprint-detail').dataset.selectedId===${JSON.stringify(id)}`         ;
    const nodeSelector = (id: string) => `[data-node-id="${id}"]`                                                                         ;
    const focus        = async (id: string) => { await evaluate(`document.querySelector(${JSON.stringify(nodeSelector(id))}).focus()`); } ;
    await assert(current(rootId), '최초 arch.www 경로');
    await assert("document.querySelector('.blueprint-detail').hidden && document.querySelector('.sidebar').getBoundingClientRect().width===64", '기본 지도는 64px rail과 접힌 상세로 시작');
    await assert("document.querySelector('.blueprint-viewport').clientWidth>=innerWidth*.9 && document.querySelector('.blueprint-viewport').clientHeight>=document.querySelector('.blueprint-work').clientHeight*.6", '중앙 지도가 가로 90%·main 높이 60% 이상 차지');
    await assert("getComputedStyle(document.querySelector('.sidebar>.agents')).display==='none'", '지도에서 프로젝트·대화 목록 기본 접힘');
    const callsBefore = await fs.readFile(path.join(directory, "calls.jsonl"), "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return ""; throw error; });
    if (callsBefore.trim()) throw Error("접힌 지도 진입만으로 합성 Native가 시작됐습니다.");
    const seeded = object(await evaluate("(async()=>window.www.startThread(await window.www.workspace()))()"));
    if (typeof seeded.threadId !== "string") throw Error("목록 관측용 합성 thread 사전 준비 실패");
    await fs.writeFile(path.join(directory, "navigation-fixture.json"), JSON.stringify({ threadId: seeded.threadId, modelCalls: 0, scope: "실제 IPC와 합성 Native의 thread/list. 실제 계정 저장 대화/모델 결과가 아님." }, null, 2));
    await evaluate("document.querySelector('[data-testid=architecture-navigation-toggle]').focus()");
    await key('Enter');
    await assert("document.querySelector('[data-testid=architecture-navigation-toggle]').getAttribute('aria-expanded')==='true' && document.querySelector('.sidebar').getBoundingClientRect().width>64 && getComputedStyle(document.querySelector('.sidebar>.agents')).display!=='none'", '명시적으로 탐색을 열어 기존 목록 접근');
    const listVisible = await evaluate("(()=>{const panel=document.querySelector('.chat-conversations');const search=document.querySelector('[data-testid=conversation-search]');return panel instanceof HTMLElement && !panel.closest('[hidden]') && panel.getBoundingClientRect().height>0 && search instanceof HTMLInputElement && search.getBoundingClientRect().width>0})()");
    await capture("navigation-conversation-panel");
    if (listVisible !== true) throw Error("탐색을 펼친 지도에서 저장 대화 구획·검색이 실제 보이지 않습니다.");
    await assert("(()=>{const row=Array.from(document.querySelectorAll('[data-testid=conversation-item]')).find(node=>node.dataset.threadId===" + JSON.stringify(seeded.threadId) + ");return row instanceof HTMLButtonElement && row.getBoundingClientRect().height>0 && !row.closest('[hidden]')})()", '지도 탐색에 실제 합성 thread/list의 고유 대화 항목 표시');
    await evaluate("document.querySelector('[data-testid=conversation-search]').focus()");
    await command("Input.insertText", { text: seeded.threadId });
    await assert("document.activeElement===document.querySelector('[data-testid=conversation-search]') && document.activeElement.value===" + JSON.stringify(seeded.threadId), '지도 대화 검색 키보드 초점·실제 입력');
    await evaluate("document.querySelector('[data-testid=architecture-navigation-toggle]').focus()");
    await key(' ', 'Space');
    await assert("document.querySelector('.sidebar').getBoundingClientRect().width===64 && document.querySelector('.chat-conversations').getBoundingClientRect().height===0", '탐색 접기 후 지도 폭 복구와 대화 목록 비가시');
    await key('Enter');
    await assert("document.querySelector('[data-testid=conversation-search]').value===" + JSON.stringify(seeded.threadId) + " && document.querySelector('[data-testid=conversation-item]')?.getBoundingClientRect().height>0", '탐색 재열기 뒤 검색·대화 항목 보존');
    await key(' ', 'Space');
    await assert("document.querySelector('.sidebar').getBoundingClientRect().width===64", '다시 접고 원래 지도 검사 계속');

    await assert(`JSON.stringify([...document.querySelectorAll('.blueprint-node')].map(n=>n.dataset.nodeId).sort())===${JSON.stringify(JSON.stringify(rootChildren))}`, '처음은 정본 root의 직계 자식만 표시');
    await assert(`document.querySelector('.blueprint-parent').dataset.nodeId===${JSON.stringify(rootId)} && document.querySelectorAll('.blueprint-hierarchy').length===${rootChildren.length}`, '정본 부모와 각 직계 책임의 계층 연결 표시');
    await assert("[...document.querySelectorAll('.blueprint-hierarchy title')].every(node=>node.textContent.includes('계층') && node.textContent.includes('실행 순서 아님'))", '계층 관계를 실행 추적으로 위장하지 않음');
    await assert(`document.querySelector('.blueprint-summary>code').title===${JSON.stringify(snapshot.digest)}`, '실제 Electron 번들이 현재 snapshot digest 수용');
    const readable = "[...document.querySelectorAll('.blueprint-node text')].every(t=>{const r=t.getBoundingClientRect();const v=document.querySelector('.blueprint-viewport').getBoundingClientRect();return r.left>=v.left && r.right<=v.right && r.width>0 && r.height>=11})"                                                                     ;
    const overview = "document.querySelectorAll('.blueprint-node').length===6 && [...document.querySelectorAll('.blueprint-node rect')].every(n=>{const r=n.getBBox();return r.width===360 && r.height===112})";
    await assert(overview, '1440×900 root 6개가 같은 360×112 규격으로 표시');
    await assert("[...document.querySelectorAll('.blueprint-edge')].every(edge=>{const nodes=[...document.querySelectorAll('.blueprint-node')].map(n=>{const r=n.querySelector('rect').getBBox();const m=n.transform.baseVal.consolidate().matrix;return {x:m.e,y:m.f,w:r.width,h:r.height}});for(let d=0;d<=edge.getTotalLength();d+=2){const p=edge.getPointAtLength(d);if(nodes.some(n=>p.x>n.x && p.x<n.x+n.w && p.y>n.y && p.y<n.y+n.h))return false}const marker=edge.closest('svg').querySelector('marker');return marker && edge.getAttribute('marker-end')==='url(#'+marker.id+')'})", '실제 모든 SVG 간선의 노드 비관통·방향 화살표 유지');
    await assert(readable, 'root 모든 제목·역할 가독 크기와 수평 범위');
    await assert("document.querySelectorAll('.blueprint-edge').length===0", '기본 구성 보기에는 계층만 표시');
    await assert("[...document.querySelectorAll('.blueprint-node,.blueprint-parent')].every(n=>{const r=n.querySelector('rect').getBBox();return r.width===360 && r.height===112})", '부모와 하위 구성의 규격 통일');
    await assert("[...document.querySelectorAll('.blueprint-node-description')].every(n=>n.textContent && n.querySelectorAll('tspan').length<=2)", '노드 역할을 두 줄 이내 요약으로 표시');
    await assert("[...document.querySelectorAll('.blueprint-node rect')].every(n=>getComputedStyle(n).fill!=='rgb(0, 0, 0)' && getComputedStyle(n).stroke!=='none')", '노드의 표면·경계선 스타일이 SVG title 뒤에도 적용');
    await assert("new Set([...document.querySelectorAll('.blueprint-node')].map(n=>n.transform.baseVal.consolidate().matrix.e)).size===3", '1440px 구성 지도에서 세 열로 공간 활용');
    await capture('root');
    await click('[data-testid="architecture-reference-mode"]');
    await assert("document.querySelectorAll('.blueprint-hierarchy').length===0 && document.querySelectorAll('.blueprint-reference').length>0", '코드 의존 보기와 포함 관계를 분리');
    await assert("[...document.querySelectorAll('.blueprint-edge')].every(edge=>{const nodes=[...document.querySelectorAll('.blueprint-node')].map(n=>{const r=n.querySelector('rect').getBBox();const m=n.transform.baseVal.consolidate().matrix;return {x:m.e,y:m.f,w:r.width,h:r.height}});for(let d=0;d<=edge.getTotalLength();d+=2){const p=edge.getPointAtLength(d);if(nodes.some(n=>p.x>n.x && p.x<n.x+n.w && p.y>n.y && p.y<n.y+n.h))return false}const marker=edge.closest('svg').querySelector('marker');return marker && edge.getAttribute('marker-end')==='url(#'+marker.id+')'})", '실제 의존선은 모든 노드 바깥을 통과');
    await assert("[...document.querySelectorAll('.blueprint-reference')].every(n=>{const pair=[...document.querySelectorAll('.blueprint-reference')].find(m=>m.dataset.from===n.dataset.to && m.dataset.to===n.dataset.from);return !pair || pair.querySelector('path').getAttribute('d')!==n.querySelector('path').getAttribute('d')})", '실제 양방향 참조 경로 분리');
    await evaluate("(() => {const select=document.querySelector('[aria-label=\"참조 강조 대상\"]');select.value='arch.chat';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await assert("[...document.querySelectorAll('.blueprint-reference')].every(n=>n.dataset.from==='arch.chat'||n.dataset.to==='arch.chat') && document.querySelectorAll('.blueprint-reference').length>0", '선택 책임의 들어오는/나가는 참조만 표시');
    await assert("document.querySelector('.blueprint-stage-dependencies').textContent.includes('→') && document.querySelectorAll('.blueprint-edge-number').length===document.querySelectorAll('.blueprint-dependency-row').length", '간선 번호와 방향을 사람이 읽는 목록에 연결');
    await assert("document.querySelector('.blueprint-detail').hidden && document.querySelector('.blueprint-selection-summary').dataset.selectedId==='arch.chat'", '참조 강조도 요약만 갱신하고 상세를 열지 않음');
    await capture('references-focused');
    await click('[data-testid="architecture-structure-mode"]');

    await click(nodeSelector('arch.chat'));
    await assert(current('arch.chat'), '실제 첫 클릭: arch.chat 진입');
    await click(nodeSelector('arch.chat.sessions'));
    await assert(current('arch.chat.sessions'), '실제 두 번째 클릭: arch.chat.sessions 진입');
    await assert("document.querySelector('.blueprint-detail').hidden && document.querySelector('.blueprint-selection-summary').dataset.selectedId==='arch.chat.sessions' && document.querySelector('.blueprint-selection-summary').textContent.includes('대화별 초안') && document.querySelector('.blueprint-viewport').clientWidth>=innerWidth*.9", '대화 세션 선택은 중앙 요약과 지도 폭 유지');
    await capture('selection-summary');
    await evaluate("document.querySelector('[data-testid=architecture-detail-toggle]').focus()");
    await key(' ', 'Space');
    await assert("!document.querySelector('.blueprint-detail').hidden && document.querySelector('[data-testid=architecture-detail-toggle]').getAttribute('aria-expanded')==='true'", '사용자가 자세히 보기를 눌러 상세 열기');

    await assert(`JSON.stringify([...document.querySelectorAll('.blueprint-node')].map(n=>n.dataset.nodeId).sort())===${JSON.stringify(JSON.stringify(snapshot.structure.nodes.filter((entry) => entry.parent === 'arch.chat.sessions').map((entry) => entry.id).sort()))}`, '중간 단계는 해당 책임의 직계 자식만 표시');
    await assert("document.querySelector('[aria-label=\"역할과 책임\"]').textContent.includes('대화별 초안') && document.querySelector('[aria-label=\"역할과 책임\"]').textContent.includes('요청')", '대화 세션의 구체적인 역할·책임 설명');
    await assert("document.querySelectorAll('.blueprint-component-list button').length===3 && document.querySelector('.blueprint-component-list').textContent.includes('Native 대화 요청 구성') && document.querySelector('.blueprint-component-list').textContent.includes('Native 대화 목록과 복원') && document.querySelector('.blueprint-component-list').textContent.includes('대화별 초안과 읽기 상태')", '대화 세션의 세 구성과 각 설명 표시');
    await assert("['src/chat-state.ts','src/conversations.ts','src/native-chat.ts'].every(file=>document.querySelector('.blueprint-owned-code').textContent.includes(file))", 'branch 상세에서 하위 담당 코드까지 확인');
    await capture('intermediate');
    await click(nodeSelector('arch.chat.sessions.restore'));
    await assert(selected('arch.chat.sessions.restore'), '실제 세 번째 클릭: 복원 leaf 선택');
    await click('.blueprint-evidence>summary');
    const requirement  = snapshot.structure.requirements.find((entry) => entry.nodeId === 'arch.chat.sessions.restore'       ) ;
    const declaration  = snapshot.structure.declarations.find((entry) => entry.nodeId === 'arch.chat.sessions.restore'       ) ;
    const verification = snapshot.structure.tests       .find((entry) => entry.requirementIds.includes(requirement?.id ?? '')) ;
    if (!requirement || !declaration || !verification) throw Error('복원 leaf의 정본 근거 누락');
    for (const [selector, value, label] of [
      ['.blueprint-requirements', `${requirement.file}:${requirement.line}`, 'leaf 명세 실제 파일·행'],
      ['.blueprint-declarations', `${declaration.file}:${declaration.line}`, 'leaf 구현 실제 파일·행'],
      ['.blueprint-tests', `${verification.file}:${verification.line}`, 'leaf 검증 선언 실제 파일·행'],
    ]) await assert(`document.querySelector(${JSON.stringify(selector)}).textContent.includes(${JSON.stringify(value)})`, label!);
    await assert(`document.querySelector('.blueprint-requirements').textContent.includes(${JSON.stringify(requirement.id)})`, 'leaf의 동일 요구 ID 연결');
    await assert("document.querySelector('.blueprint-detail').textContent.includes('테스트 등록은 현재 테스트 실행 결과나 통과 판정이 아닙니다')", '검증 선언과 실행 통과를 구분');
    await capture('leaf');
    await click('[data-testid="architecture-detail-close"]');
    await assert(`document.querySelector('.blueprint-detail').hidden && document.activeElement.dataset.nodeId===${JSON.stringify(requirement.nodeId)}`, '상세 닫기 후 같은 선택 노드로 키보드 초점 복귀');
    await click('[data-testid="architecture-detail-toggle"]');
    await assert(`!document.querySelector('.blueprint-detail').hidden && ${selected(requirement.nodeId)}`, '상세를 다시 열어도 안정 선택 ID 유지');
    await click('[data-ancestor-id="arch.chat"]');
    await assert(current('arch.chat'), 'ancestor breadcrumb 복귀');
    await click('[data-testid="architecture-root"]');
    await assert(overview, '부모 root 복귀 시 전체 배치 복구');
    await focus('arch.chat');
    await key('ArrowDown');
    await assert("document.activeElement.dataset.nodeId==='arch.development'", '실제 방향키로 다음 책임 초점 이동');
    await focus('arch.chat');
    await key('Enter');
    await assert(current('arch.chat'), '실제 Enter로 branch 진입');
    await focus('arch.chat.sessions');
    await key(' ', 'Space');
    await assert(current('arch.chat.sessions'), '실제 Space로 추가 하위 책임 진입');
    await focus('arch.chat.sessions.restore');
    await key('Enter');
    await assert(selected('arch.chat.sessions.restore'), '실제 Enter로 leaf 선택');
    await key('Tab');
    await assert("!document.activeElement.matches('[data-node-id=\"arch.chat.sessions.restore\"]')", '실제 Tab으로 선택 뒤 탐색');
    await click('[data-testid="architecture-root"]');
    await search(requirement.id);
    await assert("document.querySelectorAll('.ecosystem-results [data-result-id]').length===1", '요구 ID 전역 검색');
    await click(`[data-result-id="${requirement.nodeId}"]`);
    await assert(`${current('arch.chat.sessions')} && ${selected(requirement.nodeId)}`, '검색 선택은 대상 부모 경로와 leaf 선택을 함께 갱신');
    await assert("document.querySelector('.blueprint-detail').hidden && document.querySelector('.blueprint-selection-summary').dataset.selectedId==='arch.chat.sessions.restore'", '검색 결과도 상세 자동 열기 없이 선택 요약 표시');
    await click('[data-testid="architecture-detail-toggle"]');

    await search('CONVERSATIONS.TS');
    await assert(`document.querySelector('[data-result-id="${requirement.nodeId}"]')`, '대소문자 무관 구현 파일 검색');
    await click('.ecosystem-clear');
    await search('존재하지않는구조');
    await assert("document.querySelector('.ecosystem-results').textContent.includes('일치하는 구조가 없습니다')", '검색 빈 결과 안내');
    await click('.ecosystem-clear');
    await assert("!document.querySelector('.ecosystem-results')", '빈 검색은 현재 계층을 유지');
    const target = object(await evaluate("(() => { const button=document.querySelector('.blueprint-connection button'); return button ? {id:button.dataset.targetId} : {}; })()"));
    if (typeof target.id !== 'string') throw Error('실제 외부 참조 이동 대상 누락');
    const targetNode = snapshot.structure.nodes.find((entry) => entry.id === target.id);
    if (!targetNode) throw Error('외부 참조 정본 ID 누락');
    await click('.blueprint-connection button');
    await assert(`${current(targetNode.parent ?? rootId)} && ${selected(targetNode.id)}`, '참조 선택은 대상 부모와 선택 ID를 맞춰 이동');
    await evaluate("document.querySelector('.blueprint-connection details').open=true");
    await assert("document.querySelector('.blueprint-connection pre').textContent.includes('import')", '실제 import 원문 열람');
    await click('[data-testid="architecture-root"]');
    await click('[data-testid="architecture-reference-mode"]');
    await assert("document.querySelectorAll('.blueprint-edge').length>0", '직계 하위 책임 사이 실제 의존 간선 표시');
    await assert("document.querySelector('.blueprint-stage-dependencies').textContent.includes('실행') && document.querySelector('.blueprint-stage-dependencies').textContent.includes('혼합') && document.querySelector('.blueprint-stage-dependencies').textContent.includes('타입')", '방향과 mode별 의존 집계 설명');
    await click('[data-testid="architecture-structure-mode"]');
    await assert("[...document.querySelectorAll('.blueprint-node')].every(n=>{const r=n.querySelector('rect');return [...n.querySelectorAll('text')].every(t=>t.getBBox().x+t.getBBox().width<=Number(r.getAttribute('width'))-8)})", '제목·역할 레이블이 노드 안에 표시');
    const zoomBefore = Number(await evaluate("document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%','')"));
    await click('[aria-label="설계도 확대"]');
    await pause(200);
    await assert(`Number(document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%',''))>${zoomBefore}`, '확대');
    await click('[aria-label="설계도 축소"]');
    await assert(`Number(document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%',''))===${zoomBefore}`, '축소');
    await click('[data-testid="architecture-fit"]');
    await assert("Number(document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%',''))>=100 && Number(document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%',''))<=110", '현재 계층은 글자를 줄이지 않는 크기 맞춤');
    for (let step = 0; step < 10; step++) await click('[aria-label="설계도 확대"]');
    await evaluate("document.querySelector('.blueprint-viewport').scrollTo(0,0)");
    const point = object(await evaluate("(() => {const r=document.querySelector('.blueprint-viewport').getBoundingClientRect();return {x:r.left+8,y:r.top+r.height/2};})()"));
    if (typeof point.x !== 'number' || typeof point.y !== 'number') throw Error('드래그 좌표 누락');
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x - 70, y: point.y - 70, button: 'left', buttons: 1 });
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x - 70, y: point.y - 70, button: 'left', buttons: 0, clickCount: 1 });
    await assert("document.querySelector('.blueprint-viewport').scrollLeft>0 && document.querySelector('.blueprint-viewport').scrollTop>0", '실제 포인터 배경 drag 이동');
    await search(requirement.id);
    await click(`[data-result-id="${requirement.nodeId}"]`);
    await assert("Number(document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%',''))<=110", '수동 확대 후 계층 이동 시 배율 복구');
    await click('[data-testid="architecture-detail-toggle"]');
    for (const width of [860, 760]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height: 560, deviceScaleFactor: 1, mobile: false });
      await pause(150);
      await assert("document.documentElement.scrollWidth<=innerWidth && document.querySelector('.ecosystem-page').scrollHeight>document.querySelector('.ecosystem-page').clientHeight", `${width}px 수평 넘침 없음·내부 세로 스크롤`);
      await assert(readable, `${width}px 모든 제목·역할 가독 크기와 수평 범위`);
      await assert("Number(document.querySelector('[data-testid=architecture-zoom]').textContent.replace('%',''))<=110 && document.querySelector('.blueprint-viewport').scrollWidth<=document.querySelector('.blueprint-viewport').clientWidth", `${width}px resize 배율 복구·지도 수평 잘림 없음`);
      await capture(`narrow-${width}`);
      await evaluate("document.querySelector('.blueprint-evidence').open=true; document.querySelector('.blueprint-tests').scrollIntoView({block:'center'})");
      await assert("document.querySelector('.blueprint-tests').getBoundingClientRect().bottom<=innerHeight && document.querySelector('.blueprint-tests').getBoundingClientRect().top>=0", `${width}px leaf 검증 참조 접근`);
      await capture(`detail-narrow-${width}`);
      await evaluate("document.querySelector('.ecosystem-page').scrollTop=0");
    }
    await click('[data-testid="architecture-root"]');
    await assert("document.querySelector('.blueprint-viewport').scrollHeight>document.querySelector('.blueprint-viewport').clientHeight", '좁은 root는 지도 내부 스크롤 유지');
    await capture('root-narrow');
    await search('없는검색');
    await pause(100);
    await click('[aria-label="설계도 확대"]');
    const manualZoom = await evaluate("document.querySelector('[data-testid=architecture-zoom]').textContent");
    await search('다른없는검색');
    await assert(`document.querySelector('[data-testid=architecture-zoom]').textContent===${JSON.stringify(manualZoom)}`, '일반 검색 렌더는 수동 배율 보존');
    await click('.ecosystem-clear');
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await assert(overview, '수동 확대·좁은 창 이후 desktop resize 전체 배치 복구');
    await assert(readable, 'desktop resize 후 모든 제목·역할 가독성');
    await capture('root-resized');
    const beforeStatechart = await evaluate("JSON.stringify({current:document.querySelector('.blueprint-work').dataset.currentId,selected:document.querySelector('.blueprint-selection-summary').dataset.selectedId,zoom:document.querySelector('[data-testid=architecture-zoom]').textContent})");
    await click('[data-testid="architecture-statechart-open"]');
    await assert("document.querySelector('[data-testid=workflow-statechart-empty]')?.textContent.includes('상태 모델이 등록되지 않았습니다')", '모델 없는 책임의 빈 상태를 실제 화면에서 구분');
    await capture('statechart-no-model');
    await click('[data-testid="workflow-statechart-close"]');
    await assert(`JSON.stringify({current:document.querySelector('.blueprint-work').dataset.currentId,selected:document.querySelector('.blueprint-selection-summary').dataset.selectedId,zoom:document.querySelector('[data-testid=architecture-zoom]').textContent})===${JSON.stringify(beforeStatechart)}`, '상태 모델 없음에서 원래 선택·경로·배율로 복귀');
    await click('[data-testid="architecture-workflow-locate"]');
    await assert("document.querySelector('[data-testid=workflow-statechart-model-status]')?.dataset.status==='unverified' && document.querySelector('[data-testid=workflow-statechart]')?.textContent.includes('실시간 실행 상태나 형식 증명이 아닙니다')", '같은 책임 ID의 상태 정의와 실제 행동 검증 미실행 구분');
    await click('[data-transition-id="transition.complete"]');
    await assert("document.querySelector('[data-testid=workflow-statechart-transition]')?.textContent.includes('rule.criteria-current') && document.querySelector('[data-testid=workflow-statechart-transition]')?.textContent.includes('rule.report-current')", '완료 전이의 현재성 조건·담당 코드·검사 선언 읽기');
    await capture('statechart-completion-guards');
    await click('.workflow-counterexamples details summary');
    await assert("document.querySelector('.workflow-counterexamples details')?.open===true && document.querySelector('.workflow-counterexamples details')?.textContent.includes('거부 규칙')", '반례 사건 순서와 실제 검사 선언 펼치기');
    await evaluate("(()=>{const n=document.querySelector('[aria-label=\"상태도의 작업 UUID\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,'work-4573f7d4-62eb-4e72-9985-62994c1b30a8');n.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click('[data-testid="workflow-evidence-read"]');
    await assert("['stale','unverified','failed'].includes(document.querySelector('[data-testid=workflow-evidence-status]')?.dataset.status)", '실제 선택 프로젝트 작업의 미충족·오래된 근거를 완료 허용과 구별');
    await click('[data-testid="workflow-report-read"]');
    await assert("document.querySelector('[data-testid=workflow-report-frame]')?.getAttribute('sandbox')==='' && document.querySelector('[data-testid=workflow-report-status]')?.dataset.status==='stale'", '같은 UUID의 실제 보고서와 오래된 적용성을 sandbox에서 읽기');
    await capture('statechart-stale-work-evidence');
    await command('Emulation.setDeviceMetricsOverride', { width: 640, height: 900, deviceScaleFactor: 1, mobile: false });
    await assert("document.querySelector('[data-testid=workflow-statechart-close]')?.getBoundingClientRect().width>0 && document.documentElement.scrollWidth<=innerWidth+1", '640px 상태도·근거·복귀 조작의 페이지 넘침 없음');
    await capture('statechart-narrow');
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await key('Escape');
    await assert("!document.querySelector('[data-testid=workflow-statechart]') && document.activeElement===document.querySelector('[data-testid=architecture-statechart-open]')", '실제 Escape로 상태도 닫고 책임 노드 조작에 초점 복귀');
    await search(requirement.id);
    await click(`[data-result-id="${requirement.nodeId}"]`);
    await click('[aria-label="설계도 확대"]');
    await evaluate("document.querySelector('.blueprint-viewport').scrollTop=64");
    const mapState = "JSON.stringify({current:document.querySelector('.blueprint-work').dataset.currentId,selected:document.querySelector('.blueprint-detail').dataset.selectedId,zoom:document.querySelector('[data-testid=architecture-zoom]').textContent,top:document.querySelector('.blueprint-viewport').scrollTop})";
    const savedMapState = await evaluate(mapState);
    await click('[data-testid="chat-nav"]');
    await assert("document.querySelector('.ecosystem-shell').hidden && !document.querySelector('main.work').hidden", '지도 숨김이 채팅 레이아웃을 점유하지 않음');
    await assert("document.querySelector('.sidebar').getBoundingClientRect().width>64 && getComputedStyle(document.querySelector('.sidebar>.agents')).display!=='none'", 'Chat 복귀 시 원래 탐색과 목록 복구');

    await evaluate("(() => { const input=document.querySelector('[data-testid=prompt-input]'); const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(input,'지도 왕복 초안'); input.dispatchEvent(new Event('input',{bubbles:true})); })()");
    await click('[data-testid="ecosystem-nav"]');
    await assert(`${mapState}===${JSON.stringify(savedMapState)}`, '채팅 왕복 후 지도 경로·선택·배율·이동 위치 유지');
    await click('[data-testid="ecosystem-guide-tab"]');
    await assert("document.querySelector('.eco-node').getBoundingClientRect().width>0 && document.querySelector('.blueprint-work').closest('.ecosystem-page').hidden", '개념 처리 관계와 책임 지도는 별도 화면으로 보존');
    await assert("document.querySelector('.ecosystem-badge').textContent.includes('실행 추적 아님')", '개념 처리 관계와 실제 실행 추적 구별');
    const sourceTarget = await evaluate("document.querySelector('.ecosystem-page:not([hidden]) .blueprint-source-link code')?.textContent");
    if (typeof sourceTarget !== 'string' || !snapshot.structure.nodes.some((node) => node.id === sourceTarget)) throw Error('개념 관계에서 이동할 실제 구조 ID 근거가 없습니다.');
    await click('.ecosystem-page:not([hidden]) .blueprint-source-link');
    await assert(`${selected(sourceTarget)} && !document.querySelector('.blueprint-detail').hidden && document.querySelector('[data-testid=architecture-tab]').getAttribute('aria-pressed')==='true'`, '기능·개념 관계의 파일 근거에서 같은 안정 ID와 담당 코드로 이동');
    await key('Escape');
    await assert("document.querySelector('.blueprint-detail').hidden", 'Escape로 선택 상세 닫기');
    await click('[data-testid="chat-nav"]');
    await assert("document.querySelector('[data-testid=prompt-input]').value==='지도 왕복 초안'", '지도 탐색·상세 닫기 후 채팅 초안 유지');
    await click('[data-testid="ecosystem-nav"]');
    await capture('node-map-final');
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
