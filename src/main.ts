/**
 * @architecture arch.native.lifecycle
 * @implements RESP-NATIVE-LIFECYCLE
 */
import { appBuildInfo } from "./build-info";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { randomUUID } from "node:crypto";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createNativeSession } from "./native-session";
import { createSessionRegistry } from "./session-registry";
import { createActivityLedger, type ActivityLedger } from "./activity-ledger";
import { createProjectRegistry } from "./projects";
import { createNativeReportHarness } from "./native-reports";
import { judgeNativeReport } from "./report-judge";
import { reportFileStem } from "../scripts/workflow/report-names.ts";

const DIST = join(app.getAppPath(), "dist");
const WWW_ROOT = realpathSync(app.getAppPath());
const PROBE_PATH = process.env.WWW_PROBE_PATH;
if (PROBE_PATH) {
  const profile = process.argv.find(arg => arg.startsWith("--user-data-dir="))?.slice("--user-data-dir=".length);
  if (!profile) throw new Error("Probe 격리 user-data-dir이 필요합니다.");
  app.setPath("userData", resolve(profile));
}
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.exit(0);
const processEpoch = randomUUID();
const nativeEntry = process.hrtime.bigint();
let stopping = false;
let window: BrowserWindow | null = null;
let ledger: ActivityLedger;
let projects: ReturnType<typeof createProjectRegistry>;
const sessions = createSessionRegistry<ReturnType<typeof createNativeSession>>();
const closing = new Set<string>();
const reports = { enabled: !PROBE_PATH || process.env.WWW_PROBE_NATIVE_REPORTS === "1" };
const reportAbort = new AbortController();
const reportHarnesses = new Map<string, ReturnType<typeof createNativeReportHarness>>();
let lastSessions = "";
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object") throw new Error("Invalid app-server response"); return value as Record<string, unknown>; }
function reportHarness(root: string) {
  let harness = reportHarnesses.get(root);
  if (!harness) {
    harness = createNativeReportHarness({
      judge: input => judgeNativeReport(input, { signal: reportAbort.signal, ...(PROBE_PATH && process.env.WWW_PROBE_REPORT_JUDGE_BIN ? { binary: process.env.WWW_PROBE_REPORT_JUDGE_BIN } : {}) }),
      onState: job => { for (const session of sessions.list()) session.reportState(root, job); }
    });
    reportHarnesses.set(root, harness);
  }
  return harness;
}
function publishSessions(): void {
  if (stopping) return;
  const snapshot = sessions.list().map(session => session.summary());
  const fingerprint = JSON.stringify(snapshot);
  if (fingerprint === lastSessions) return;
  lastSessions = fingerprint;
  window?.webContents.send("sessions:changed", snapshot);
}
function addSession(workspace: string, registrationError: string | null = null) {
  const session = createNativeSession({
    id: randomUUID(), workspace, processEpoch, appVersion: appBuildInfo.version, ledger, projects, wwwRoot: WWW_ROOT, dist: DIST, reports, reportHarness, ownership: sessions,
    registrationError,
    onEvent: event => window?.webContents.send("app:event", event),
    onResources: snapshot => window?.webContents.send("activity:resources", snapshot),
    onChanged: publishSessions,
    async chooseDirectory(title, createDirectory) {
      const result = await dialog.showOpenDialog(window!, { title, properties: createDirectory ? ["openDirectory", "createDirectory"] : ["openDirectory"] });
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
    async exportReport(document) {
      const result = await dialog.showSaveDialog(window!, { title: "작업 보고서 저장", defaultPath: `${reportFileStem(document.report)}.html`, filters: [{ name: "HTML 보고서", extensions: ["html"] }] });
      if (result.canceled || !result.filePath) return null;
      writeFileSync(result.filePath, document.html, { encoding: "utf8", mode: 0o600 });
      return result.filePath;
    },
    openExternal: url => shell.openExternal(url)
  });
  sessions.add(session);
  publishSessions();
  return session;
}
function sessionId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value) throw new Error("대화 탭 ID가 올바르지 않습니다.");
  return value;
}
function selectedSession(value: unknown) {
  const expected = record(value);
  const id = sessionId(expected.sessionId);
  // 구형 단일 탭 요청만 명확한 기본 세션으로 보완한다.
  if (id === undefined && sessions.list().length !== 1) throw new Error("여러 대화 탭에서는 세션 ID가 필요합니다.");
  const session = sessions.get(id);
  const selection = { ...expected, sessionId: session.id };
  session.assertSelection(selection);
  return { session, selection };
}
function registerIpc(): void {
  const scopedChannels = ["dashboard:get", "rpa:standard", "projects:www", "conversations:list", "conversations:open", "conversations:new", "activity:refresh", "activity:resources", "projects:list", "projects:favorite", "projects:switch", "workspace:choose", "thread:start", "turn:start", "turn:steer", "turn:interrupt", "approval:respond", "events:get"];
  for (const channel of scopedChannels) ipcMain.handle(channel, (_event, ...args: unknown[]) => {
    const { session, selection } = selectedSession(args[0]);
    return session.invoke(channel, [selection, ...args.slice(1)]);
  });
  const unscopedChannels: Record<string, number> = { "workspace:get": 0, "reports:native-status": 0, "reports:native-enabled": 1, "reports:native-retry": 1, "reports:list": 0, "reports:read": 1, "reports:choose": 0, "reports:export": 1, "development:policy": 0, "development:status": 1, "development:complete": 1, "link:open": 1 };
  for (const [channel, count] of Object.entries(unscopedChannels)) ipcMain.handle(channel, (_event, ...args: unknown[]) => sessions.get(sessionId(args[count])).invoke(channel, args.slice(0, count)));
  ipcMain.handle("sessions:list", () => sessions.list().map(session => session.summary()));
  ipcMain.handle("sessions:create", (_event, expected: unknown) => {
    if (stopping) throw new Error("앱 종료 중");
    const source = expected === undefined ? sessions.get() : selectedSession(expected).session;
    if (closing.has(source.id)) throw new Error("대화 탭을 닫고 있습니다.");
    const context = source.cloneContext();
    return addSession(context.workspace, context.registrationError).summary();
  });
  ipcMain.handle("sessions:close", async (_event, value: unknown) => {
    const id = sessionId(value);
    if (id === undefined) throw new Error("닫을 대화 탭 ID가 필요합니다.");
    const session = sessions.get(id);
    session.assertClosable();
    if (closing.has(id)) throw new Error("대화 탭을 닫고 있습니다.");
    if (sessions.list().filter(item => !closing.has(item.id)).length <= 1) throw new Error("마지막 대화 탭은 닫을 수 없습니다.");
    closing.add(id);
    try { await session.stop(); sessions.remove(id); }
    finally { closing.delete(id); publishSessions(); }
  });
  ipcMain.handle("probe:ready", () => ({
    enabled: !!PROBE_PATH && process.env.WWW_NATIVE_PROBE !== "1",
    ...(PROBE_PATH && process.env.WWW_PROBE_ACTIVITY === "1" ? { checkActivity: true } : {}),
    ...(PROBE_PATH && process.env.WWW_PROBE_REPORTS === "1" ? { checkReports: true } : {}),
    ...(PROBE_PATH && process.env.WWW_PROBE_NATIVE_REPORTS === "1" ? { checkNativeReports: true } : {}),
    ...(PROBE_PATH ? { readinessMs: Number(process.hrtime.bigint() - nativeEntry) / 1e6, developmentPolicyAvailable: true } : {}),
    ...(PROBE_PATH && process.env.WWW_PROBE_DEVELOPMENT_WORK_ID ? { developmentWorkId: process.env.WWW_PROBE_DEVELOPMENT_WORK_ID } : {}),
    ...(PROBE_PATH && process.env.WWW_PROBE_EXPECT_DEVELOPMENT_COMPLETE === "1" ? { expectDevelopmentComplete: true } : {}),
    ...(PROBE_PATH && process.env.WWW_PROBE_INTERRUPT_PENDING === "1" ? { checkInterruptPending: true } : {})
  }));
  ipcMain.handle("probe:finish", async (_event, result: unknown) => {
    if (!PROBE_PATH) throw new Error("Probe mode is disabled");
    mkdirSync(join(PROBE_PATH, ".."), { recursive: true });
    if (!window) throw new Error("Probe window is unavailable");
    if (typeof record(result).error === 'string') {
      writeFileSync(PROBE_PATH, JSON.stringify({ shell: 'electron', ...record(result) }, null, 2) + '\n');
      setImmediate(() => app.quit());
      return;
    }
    let reportArtifacts: Record<string, unknown> | null = null;
    if (process.env.WWW_PROBE_REPORTS === "1" && record(result).reportId) {
      const meaningReportId = process.env.WWW_PROBE_REPORT_MEANING_ID;
      if (meaningReportId) {
        if (!/^report-[a-f0-9-]+$/.test(meaningReportId)) throw new Error("Invalid meaning probe report ID");
        const selected = await sessions.get().readReport(meaningReportId);
        const mode = selected.report.kind === "authored" ? "작성 보고서" : "자동 기록";
        await window.webContents.executeJavaScript(`(() => { const mode=[...document.querySelectorAll('.reports-modes button')].find(x=>x.textContent===${JSON.stringify(mode)}); if(!mode)throw Error('보고서 mode 없음'); mode.click(); })()`);
        const selectionDeadline = Date.now() + 10_000;
        let selectedFrame = false;
        while (!selectedFrame && Date.now() < selectionDeadline) {
          selectedFrame = await window.webContents.executeJavaScript(`(() => { const title=${JSON.stringify(selected.report.title)}; const button=[...document.querySelectorAll('.report-entry')].find(x=>x.querySelector('strong')?.textContent===title); button?.click(); const frame=document.querySelector('.report-frame'); return !!frame&&frame.title===title+' 작업 보고서'; })()`);
          if (!selectedFrame) await new Promise(resolve => setTimeout(resolve, 40));
        }
        if (!selectedFrame) throw new Error("Meaning probe did not select the requested report through ReportsView");
      }
      const saved = await sessions.get().readReport(meaningReportId ?? record(result).reportId);
      // Verification-only DOM observation, reused in the real sandbox frame and independent document.
      const meaningExpression = `(() => {
        const visible=e=>{if(!e||!e.getClientRects().length)return false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(e))return false;}return true;};
        const text=e=>{if(!visible(e))return '';const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);const parts=[];while(w.nextNode()){const p=w.currentNode.parentElement;if(visible(p)&&!p.closest('#report-raw,.history-entry'))parts.push(w.currentNode.textContent);}return parts.join(' ').replace(/\\s+/g,' ').trim();};
        const regions={};for(const [key,selector] of Object.entries({conclusion:'#section-1',approach:'#section-2',results:'#section-3',verification:'#report-verification',next:'#report-next'})){const e=document.querySelector(selector);regions[key]={text:text(e),visible:visible(e),height:e?.getBoundingClientRect().height??0};}
        const background=e=>{for(let p=e;p;p=p.parentElement){const c=getComputedStyle(p).backgroundColor;if(c!=='transparent'&&c!=='rgba(0, 0, 0, 0)')return c;}return getComputedStyle(document.body).backgroundColor;};
        const states=[];for(const label of ['당시 통과로 기록','당시 실패로 기록','당시 차단으로 기록','미검증으로 기록']){const e=[...document.querySelectorAll('article.document *')].find(e=>visible(e)&&e.textContent.trim()===label&&![...e.children].some(c=>c.textContent.trim()===label));if(e){const c=getComputedStyle(e),opacityChain=[];for(let p=e;p;p=p.parentElement)opacityChain.push(Number(getComputedStyle(p).opacity));states.push({label,color:c.color,background:background(e),fontSize:c.fontSize,text:text(e),height:e.getBoundingClientRect().height,opacityChain,fullyOpaque:opacityChain.every(value=>value===1)});}}
        const css=getComputedStyle(document.documentElement);return {title:document.querySelector('h1')?.textContent,regions,states,tokens:{green:css.getPropertyValue('--green').trim(),red:css.getPropertyValue('--red').trim(),amber:css.getPropertyValue('--amber').trim()},rawClosed:document.querySelector('#report-raw')?.open===false};
      })()`;
      let embedded : Record<string, unknown> | null = null                                        ;
      const deadline                                = Date.now() + 10_000                         ;
      const walk = (value: unknown): Record<string, unknown>[] => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const node = record(value);
        return [node, ...(Array.isArray(node.children) ? node.children : []).flatMap(walk), ...walk(node.contentDocument)];
      };
      window.webContents.debugger.attach("1.3");
      try {
        let childSession: string | undefined;
        while (!embedded && Date.now() < deadline) {
          if (!childSession) {
            const targets = record(await window.webContents.debugger.sendCommand("Target.getTargets"))                                                                                                                                                   ;
            const target  = (Array.isArray(targets.targetInfos) ? targets.targetInfos : []).find((value: unknown) => value && typeof value === "object" && "type" in value && value.type === "iframe" && "url" in value && value.url === "about:srcdoc") ;
            if (target) {
              const attached = record(await window.webContents.debugger.sendCommand("Target.attachToTarget", { targetId: record(target).targetId, flatten: true }));
              if (typeof attached.sessionId === "string") {
                childSession = attached.sessionId;
                await window.webContents.debugger.sendCommand("DOM.enable", {}, childSession);
              }
            }
          }
          if (!childSession) { await new Promise((resolve) => setTimeout(resolve, 40)); continue; }
          const tree          = record(await window.webContents.debugger.sendCommand("DOM.getDocument", { depth: -1, pierce: true }, childSession))                                                                                                                  ;
          const frameDocument = walk(tree.root).find((node) => node.documentURL === "about:srcdoc")                                                                                                                                                                  ;
          const heading       = frameDocument ? walk(frameDocument).find((node) => node.nodeName === "H1") : undefined                                                                                                                                               ;
          const title         = heading ? walk(heading).map((node) => typeof node.nodeValue === "string" ? node.nodeValue : "").join("") : ""                                                                                                                        ;
          const storyNode     = frameDocument ? walk(frameDocument).find((node) => Array.isArray(node.attributes) && node.attributes.some((value: unknown, index: number, values: unknown[]) => value === "id" && values[index + 1] === "report-story")) : undefined ;
          const story         = storyNode ? walk(storyNode).map((node) => typeof node.nodeValue === "string" ? node.nodeValue : "").join("") : ""                                                                                                                    ;
          if (heading && title === saved.report.title) {
            const box   = record(await window.webContents.debugger.sendCommand("DOM.getBoxModel", { backendNodeId: heading.backendNodeId }, childSession)) ;
            const model = record(box.model)                                                                                                                ;
            if (typeof model.height === "number" && model.height > 0 && storyNode && story) {
              const storyBox   = record(await window.webContents.debugger.sendCommand("DOM.getBoxModel", { backendNodeId: storyNode.backendNodeId }, childSession)) ;
              const storyModel = record(storyBox.model)                                                                                                             ;
              const storyTop   = Array.isArray(storyModel.border) && typeof storyModel.border[1] === "number" ? storyModel.border[1] : null                         ;
              if (typeof storyModel.height === "number" && storyModel.height > 0) embedded = { title, height: model.height, story, storyHeight: storyModel.height, storyTop, url: "about:srcdoc" };
            }
          }
          if (!embedded) await new Promise((resolve) => setTimeout(resolve, 40));
        }
        if (embedded && meaningReportId && childSession) {
          if (saved.report.kind === "authored") {
            // Separate observer samples; remove temporary nodes before reading the actual report.
            const sampleExpression = `(() => { const faded=document.createElement('div'),sample=document.createElement('p'); faded.style.opacity='0.1'; faded.innerHTML='<span>당시 통과로 기록</span>'; sample.textContent='literal-s s   sample   keeps'; document.querySelector('article.document').prepend(faded); document.querySelector('#section-1').prepend(sample); try { return ${meaningExpression}; } finally { faded.remove(); sample.remove(); } })()`;
            const sampled = record(await window.webContents.debugger.sendCommand("Runtime.evaluate", { expression: sampleExpression, returnByValue: true }, childSession));
            if (sampled.exceptionDetails) throw new Error(`Meaning observer sample failed: ${JSON.stringify(sampled.exceptionDetails)}`);
            embedded.observerSamples = record(sampled.result).value;
          }
          const observed = record(await window.webContents.debugger.sendCommand("Runtime.evaluate", { expression: meaningExpression, returnByValue: true }, childSession));
          if (observed.exceptionDetails) throw new Error(`Meaning iframe observation failed: ${JSON.stringify(observed.exceptionDetails)}`);
          embedded.meaning = record(observed.result).value;
          const parentBefore = await window.webContents.executeJavaScript("location.href");
          const anchors: unknown[] = [];
          for (let index = 1; index <= 6; index++) {
            const clickExpression = `(() => { const link=document.querySelector('.toc a[href="about:srcdoc#section-${index}"]'); if(!link)throw Error('iframe anchor missing'); const before=scrollY; link.click(); return {before}; })()`;
            const clicked = record(await window.webContents.debugger.sendCommand("Runtime.evaluate", { expression: clickExpression, returnByValue: true }, childSession));
            if (clicked.exceptionDetails) throw new Error(`iframe anchor click failed: ${JSON.stringify(clicked.exceptionDetails)}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            const expression = `(() => { const target=document.querySelector('#section-${index}'); if(!target)throw Error('iframe section missing'); const top=target.getBoundingClientRect().top; return {index:${index},hash:location.hash,top,viewport:innerHeight,after:scrollY,visible:top>=-1&&top<innerHeight}; })()`;
            const navigation = record(await window.webContents.debugger.sendCommand("Runtime.evaluate", { expression, returnByValue: true }, childSession));
            if (navigation.exceptionDetails) throw new Error(`iframe anchor navigation failed: ${JSON.stringify(navigation.exceptionDetails)}`);
            anchors.push({ ...record(record(navigation.result).value), before: record(record(clicked.result).value).before });
          }
          embedded.anchorNavigation = { anchors, parentUnchanged: parentBefore === await window.webContents.executeJavaScript("location.href") };
        }
      } finally { window.webContents.debugger.detach(); }
      if (!embedded) {
        writeFileSync(join(PROBE_PATH, "..", "embedded-frames.json"), JSON.stringify(window.webContents.mainFrame.frames.map((frame) => ({ url: frame.url, processId: frame.processId, routingId: frame.routingId })), null, 2));
        throw new Error("Probe did not observe the report title inside the sandboxed iframe");
      }
      const reportWindow = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
      try {
        await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(saved.html)}`);
        const standaloneMeaning = meaningReportId ? await reportWindow.webContents.executeJavaScript(meaningExpression) : null;
        writeFileSync(join(PROBE_PATH, "..", "report-desktop.png"), (await reportWindow.webContents.capturePage()).toPNG());
        writeFileSync(join(PROBE_PATH, "..", "report-print.pdf"), await reportWindow.webContents.printToPDF({ printBackground: true, pageSize: "A4" }));
        reportWindow.setContentSize(360, 860);
        await reportWindow.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
        const mobile = await reportWindow.webContents.executeJavaScript("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h2')].map(x=>x.textContent)})");
        writeFileSync(join(PROBE_PATH, "..", "report-mobile.png"), (await reportWindow.webContents.capturePage()).toPNG());
        reportWindow.webContents.debugger.attach("1.3");
        await reportWindow.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        const reducedMotion = await reportWindow.webContents.executeJavaScript("({enabled:matchMedia('(prefers-reduced-motion: reduce)').matches,animations:document.getAnimations().length})");
        reportWindow.webContents.debugger.detach();
        reportArtifacts = { embedded, mobile, reducedMotion, printed: true, ...(meaningReportId ? { meaning: { reportId: meaningReportId, kind: saved.report.kind, standalone: standaloneMeaning } } : {}) };
      } finally { reportWindow.destroy(); }
    }
    const screenshot = await window.webContents.capturePage();
    writeFileSync(join(PROBE_PATH, "..", "electron-chat.png"), screenshot.toPNG());
    let activityArtifacts: unknown = null;
    if (process.env.WWW_PROBE_ACTIVITY === "1") {
      window.setContentSize(1040, 800);
      await window.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      writeFileSync(join(PROBE_PATH, "..", "activity-narrow.png"), (await window.webContents.capturePage()).toPNG());
      window.webContents.debugger.attach("1.3");
      try {
        await window.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        activityArtifacts = await window.webContents.executeJavaScript("(() => { const panel=document.querySelector('[data-testid=activity-panel]:not([hidden])'); const row=panel?.querySelector('.na-row'); if(!panel||!row) throw Error('활동 패널 행 없음'); const wasReacting=row.classList.contains('is-reacting'); row.classList.add('has-activity','is-reacting'); const animation=getComputedStyle(row).animationName; if(!wasReacting) row.classList.remove('is-reacting'); return {width:panel.getBoundingClientRect().width,overflow:panel.scrollWidth>panel.clientWidth,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,rowAnimation:animation}; })()");
      } finally { window.webContents.debugger.detach(); }
      const observed = record(activityArtifacts);
      if (observed.overflow !== false || observed.reducedMotion !== true || observed.rowAnimation !== "none") throw new Error("활동 패널 좁은 화면·모션 축소 검사 실패");
    }
    writeFileSync(PROBE_PATH, `${JSON.stringify({ shell: "electron", ...record(result), reportArtifacts, activityArtifacts }, null, 2)}\n`);
    setImmediate(() => app.quit());
  });
}

function createWindow(): void {
  window = new BrowserWindow({ show: !(PROBE_PATH && process.env.WWW_NATIVE_PROBE === "1"), width: 1440, height: 900, minWidth: 1040, minHeight: 680, backgroundColor: "#0b0b0c", webPreferences: { preload: join(DIST, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (PROBE_PATH && process.env.WWW_PROBE_REPORTS === "1") window.webContents.on("console-message", (_event, ...details) => console.log("report-probe-console", ...details));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  void window.loadFile(join(DIST, "index.html"));
  window.setTitle(`WWW ${appBuildInfo.label}`);
  window.on("page-title-updated", (event) => event.preventDefault());
}

if (ownsInstance) void app.whenReady().then(async () => {
  mkdirSync(app.getPath("userData"), { recursive: true, mode: 0o700 });
  const userData = realpathSync(app.getPath("userData"));
  app.setPath("userData", userData);
  const workspace = realpathSync(PROBE_PATH && process.env.WWW_PROBE_WORKSPACE ? resolve(process.env.WWW_PROBE_WORKSPACE) : app.getPath("home"));
  projects = createProjectRegistry({ userData });
  ledger = createActivityLedger({ userData, processEpoch, onSnapshot: snapshot => { for (const session of sessions.list()) session.acceptResourceSnapshot(snapshot); } });
  let registrationError: string | null = null;
  if (PROBE_PATH && process.env.WWW_PROBE_WORKSPACE) await projects.register(workspace).catch((error: unknown) => { registrationError = String(error); console.warn("현재 프로젝트 등록 실패", error); });
  if (!stopping) { addSession(workspace, registrationError); registerIpc(); createWindow(); }
}).catch((error: unknown) => { console.error("WWW 초기화 실패", error); app.quit(); });
app.on("window-all-closed", () => app.quit());
let quitFinished = false;
app.on("before-quit", event => {
  if (!ownsInstance || quitFinished) return;
  event.preventDefault();
  if (stopping) return;
  stopping = true;
  reportAbort.abort();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const close = Promise.allSettled(sessions.list().map(session => session.stop())).then(() => expired ? { clean: false } : ledger?.close() ?? { clean: false });
  void Promise.race([close, new Promise<{ clean: boolean }>(resolveClose => {
    deadline = setTimeout(() => { expired = true; resolveClose({ clean: false }); }, 2000);
  })]).then(result => {
    clearTimeout(deadline);
    if (expired || !result.clean) console.warn("리소스 원장 종료 내구성 미확정");
    quitFinished = true;
    if (expired) app.exit(0);
    else app.quit();
  });
});
