import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { JsonRpcClient, type RpcMessage } from "./rpc";
import { createDevelopmentService } from "./development";
import { createReportService } from "./reports-service";
import { createNativeReportHarness } from "./native-reports";
import { judgeNativeReport } from "./report-judge";
import { NativeCompletionCollector } from "./native-report-input";
import { resolveNativeCodex } from "./native-command";
import { nativeThreadStartParams, nativeTurnStartParams } from "./native-chat";
import type { AppEvent, RpcId, WorkspaceInfo } from "./shared";

const DIST = join(app.getAppPath(), "dist");

const PROBE_PATH  = process.env.WWW_PROBE_PATH                                                                                     ;
const nativeEntry = process.hrtime.bigint()                                                                                        ;
let workspace     = PROBE_PATH && process.env.WWW_PROBE_WORKSPACE ? resolve(process.env.WWW_PROBE_WORKSPACE) : app.getPath("home") ;

let rpc    : JsonRpcClient | null = null  ;
let window : BrowserWindow | null = null  ;
let threadStarted                 = false ;

let reportRepository : string | null                                       = null ;
let nativeReports    : ReturnType<typeof createNativeReportHarness> | null = null ;

let autoReportsEnabled  = !PROBE_PATH || process.env.WWW_PROBE_NATIVE_REPORTS === "1" ;
const reportAbort       = new AbortController()                                       ;
const nativeCompletions = new NativeCompletionCollector()                             ;

let seq                     = 0                        ;
const eventLog : AppEvent[] = []                       ;
const pendingApprovals      = new Map<RpcId, string>() ;
const approvalAttempts      = new Set<RpcId>()         ;

const SUPPORTED = new Set(["item/commandExecution/requestApproval", "item/fileChange/requestApproval"]) ;
const DECISIONS = new Set(["accept", "acceptForSession", "decline", "cancel"])                          ;

function publish(event: Omit<AppEvent, "seq" | "at">): void {
  const entry = { ...event, seq: ++seq, at: new Date().toISOString() };
  eventLog.push(entry);
  if (eventLog.length > 2000) eventLog.shift();
  window?.webContents.send("app:event", entry);
  if (autoReportsEnabled && nativeReports) {
    for (const input of nativeCompletions.observe(eventLog, entry)) {
      const repository = workspace;
      void nativeReports.enqueue({ repository, input }).catch((error: unknown) => publish({ kind: "notification", method: "reports/autoError", params: { threadId: input.threadId, turnId: input.turnId, message: error instanceof Error ? error.message : String(error) } }));
    }
  }
}

function connect(): Promise<JsonRpcClient> {
  if (rpc) return Promise.resolve(rpc);
  return new Promise((resolveClient, reject) => {
    const child  = spawn(resolveNativeCodex(), ["app-server"], { stdio: ["pipe", "pipe", "pipe"] }) ;
    const client = new JsonRpcClient(child)                                                         ;
    let settled  = false                                                                            ;
    client.once("closed", (error: Error) => {
      rpc = null;
      for (const requestId of pendingApprovals.keys()) {
        publish({ kind: "notification", method: "approval/uncertain", params: { message: error.message }, requestId });
      }
      pendingApprovals.clear();
      approvalAttempts.clear();
      publish({ kind: "transport", method: "transport/closed", params: { message: error.message } });
      if (!settled) reject(error);
    });
    client.on("stderr", (text: string) => publish({ kind: "transport", method: "transport/stderr", params: { text } }));
    client.on("protocolError", (message: string) => publish({ kind: "transport", method: "transport/error", params: { message } }));
    client.on("message", (message: RpcMessage) => {
      const method = String(message.method) ;
      const id     = message.id             ;
      if (typeof id === "string" || typeof id === "number") {
        const supported = SUPPORTED.has(method);
        if (supported && (pendingApprovals.has(id) || approvalAttempts.has(id))) {
          const params = message.params && typeof message.params === "object" && !Array.isArray(message.params)
            ? message.params as Record<string, unknown>
            : {};
          publish({ kind: "request", method, params: { ...params, duplicateRequestId: true }, requestId: id, supported: false });
        } else {
          if (supported) pendingApprovals.set(id, method);
          publish({ kind: "request", method, params: message.params, requestId: id, supported });
        }
      } else publish({ kind: "notification", method, params: method === "account/rateLimits/updated" ? rateLimitPayload(message.params) : message.params });
    });
    void client.request("initialize", { clientInfo: { name: "www", title: "WWW", version: app.getVersion() }, capabilities: { experimentalApi: false } })
      .then(() => {
        client.notify("initialized", {});
        rpc = client;
        settled = true;
        publish({ kind: "transport", method: "transport/connected", params: {} });
        resolveClient(client);
        void loadRateLimits(client);
      })
      .catch((error) => { settled = true; reject(error); });
  });
}

function workspaceInfo(): WorkspaceInfo {
  const git = (args: string[]) => { try { return execFileSync("git", args, { cwd: workspace, encoding: "utf8" }).trim(); } catch { return ""; } };
  return { name: basename(workspace), path: workspace, branch: git(["branch", "--show-current"]) || null, changes: git(["status", "--porcelain"]).split("\n").filter(Boolean).length };
}
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object") throw new Error("Invalid app-server response"); return value as Record<string, unknown>; }
function requiredString(value: unknown, name: string): string { if (typeof value !== "string" || !value) throw new Error(`Invalid ${name}`); return value; }
function validId(value: unknown): asserts value is RpcId { if (typeof value !== "string" && typeof value !== "number") throw new Error("Invalid request ID"); }

function rateLimitPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const data = record(value);
  const pick = (input: unknown, keys: string[]): Record<string, unknown> | null => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    return Object.fromEntries(Object.entries(input).filter(([key]) => keys.includes(key)));
  };
  const snapshot = (input: unknown): Record<string, unknown> | null => {
    const limit = pick(input, ["limitId", "limitName", "normalModelSlug", "primary", "secondary"]);
    if (!limit) return null;
    return { ...limit, primary: pick(limit.primary, ["usedPercent", "windowDurationMins", "resetsAt"]), secondary: pick(limit.secondary, ["usedPercent", "windowDurationMins", "resetsAt"]) };
  };
  const limits = data.rateLimitsByLimitId;
  return { rateLimits: snapshot(data.rateLimits), rateLimitsByLimitId: limits && typeof limits === "object" && !Array.isArray(limits) ? Object.fromEntries(Object.entries(limits).map(([key, limit]) => [key, snapshot(limit)])) : null };
}

async function loadRateLimits(client: JsonRpcClient): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([client.request("account/rateLimits/read", {}), new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("한도 응답 대기 시간 초과")), 5000); })]);
    if (rpc === client) publish({ kind: "notification", method: "account/rateLimits/updated", params: rateLimitPayload(result) });
  } catch {
    if (rpc === client) publish({ kind: "notification", method: "account/rateLimits/unavailable", params: {} });
  } finally { clearTimeout(timeout); }
}

function registerIpc(): void {
  const reports = createReportService({ workspace: () => reportRepository ?? workspace });
  const native = createNativeReportHarness({
    judge: (input) => judgeNativeReport(input, {
      signal: reportAbort.signal,
      ...(PROBE_PATH && process.env.WWW_PROBE_REPORT_JUDGE_BIN ? { binary: process.env.WWW_PROBE_REPORT_JUDGE_BIN } : {})
    }),
    onState: (job) => publish({ kind: "notification", method: "reports/autoState", params: job })
  });
  nativeReports = native;
  ipcMain.handle("reports:native-status", async () => ({ enabled: autoReportsEnabled, jobs: await native.list(reportRepository ?? workspace) }));
  ipcMain.handle("reports:native-enabled", (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") throw new Error("자동 보고서 설정은 boolean이어야 합니다.");
    autoReportsEnabled = enabled;
    return enabled;
  });
  ipcMain.handle("reports:native-retry", (_event, key: unknown) => {
    if (typeof key !== "string" || !/^[a-f0-9]{64}$/.test(key)) throw new Error("자동 보고서 작업 ID가 올바르지 않습니다.");
    return native.retry(reportRepository ?? workspace, key);
  });
  ipcMain.handle("reports:list", () => reports.list());
  ipcMain.handle("reports:read", (_event, reportId: unknown) => reports.read(reportId));
  ipcMain.handle("reports:choose", async () => {
    const result = await dialog.showOpenDialog(window!, { title: "보고서를 읽을 프로젝트 선택", properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths[0]) return false;
    reportRepository = resolve(result.filePaths[0]);
    return true;
  });
  ipcMain.handle("reports:export", async (_event, reportId: unknown) => {
    const document = await reports.read(reportId);
    const result = await dialog.showSaveDialog(window!, {
      title       : "작업 보고서 저장"           ,
      defaultPath : `${document.report.id}.html` ,
      filters     : [{ name: "HTML 보고서", extensions: ["html"] }]
    });
    if (result.canceled || !result.filePath) return null;
    writeFileSync(result.filePath, document.html, { encoding: "utf8", mode: 0o600 });
    return result.filePath;
  });
  const development = createDevelopmentService({ policyRoot: DIST, workspace: () => workspace });
  ipcMain.handle("development:policy", () => development.policy());
  ipcMain.handle("development:status", (_event, workId: unknown) => development.status(workId));
  ipcMain.handle("development:complete", (_event, workId: unknown) => development.complete(workId));
  ipcMain.handle("workspace:get", () => workspaceInfo());
  ipcMain.handle("workspace:choose", async () => {
    if (threadStarted) throw new Error("작업 폴더는 첫 스레드 전에만 변경할 수 있습니다.");
    const result = await dialog.showOpenDialog(window!, { properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;
    workspace = resolve(result.filePaths[0]);
    return workspaceInfo();
  });
  ipcMain.handle("thread:start", async () => {
    const client   = await connect()                                                                  ;
    const result   = record(await client.request("thread/start", nativeThreadStartParams(workspace))) ;
    const threadId = requiredString(record(result.thread).id, "thread ID")                            ;
    threadStarted = true;
    publish({ kind: "notification", method: "thread/configured", params: { threadId, model: typeof result.model === "string" ? result.model : null, modelProvider: typeof result.modelProvider === "string" ? result.modelProvider : null, isNew: true } });
    return { threadId };
  });
  ipcMain.handle("turn:start", async (_event, threadId: unknown, text: unknown) => {
    const validThreadId = requiredString(threadId, "thread ID");
    if (typeof text !== "string" || !text.trim() || text.length > 100_000) throw new Error("Invalid prompt");
    const prompt          = text.trim () ;
    const clientRequestId = randomUUID() ;
    publish({ kind: "notification", method: "turn/userPrompt", params: { clientRequestId, threadId: validThreadId, text: prompt } });
    try {
      const result = record        (await (await connect()).request("turn/start", nativeTurnStartParams(validThreadId, prompt))) ;
      const turnId = requiredString(record(result.turn).id, "turn ID"                                                          ) ;
      publish({ kind: "notification", method: "turn/startAccepted", params: { clientRequestId, threadId: validThreadId, turnId } });
      return { turnId };
    } catch (error) {
      publish({ kind: "notification", method: "turn/startFailed", params: { clientRequestId, threadId: validThreadId, message: String(error) } });
      throw error;
    }
  });
  ipcMain.handle("turn:interrupt", async (_event, threadId: unknown, turnId: unknown) => {
    requiredString(threadId, "thread ID"); requiredString(turnId, "turn ID");
    publish({ kind: "notification", method: "turn/interruptRequested", params: { threadId, turnId } });
    try {
      await (await connect()).request("turn/interrupt", { threadId, turnId });
      publish({ kind: "notification", method: "turn/interruptAcknowledged", params: { threadId, turnId } });
    } catch (error) {
      publish({ kind: "notification", method: "turn/interruptUncertain", params: { threadId, turnId, message: String(error) } });
      throw error;
    }
  });
  ipcMain.handle("approval:respond", async (_event, requestId: unknown, decision: unknown) => {
    validId(requestId);
    if (typeof decision !== "string" || !DECISIONS.has(decision)) throw new Error("Unsupported approval decision");
    if (!pendingApprovals.has(requestId)) throw new Error("Unknown or unsupported approval request");
    if (approvalAttempts.has(requestId)) throw new Error("Approval response has already been attempted");
    approvalAttempts.add(requestId);
    publish({ kind: "notification", method: "approval/responding", params: { decision }, requestId });
    try {
      await (await connect()).respond(requestId, { decision });
      pendingApprovals.delete(requestId);
      publish({ kind: "notification", method: "approval/responded", params: { decision }, requestId });
    } catch (error) {
      pendingApprovals.delete(requestId);
      publish({ kind: "notification", method: "approval/uncertain", params: { decision, message: String(error) }, requestId });
      throw error;
    }
  });
  ipcMain.handle("events:get", () => [...eventLog]);
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
    let reportArtifacts: Record<string, unknown> | null = null;
    if (process.env.WWW_PROBE_REPORTS === "1" && record(result).reportId) {
      const saved                                   = await reports.read(record(result).reportId) ;
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
      } finally { window.webContents.debugger.detach(); }
      if (!embedded) {
        writeFileSync(join(PROBE_PATH, "..", "embedded-frames.json"), JSON.stringify(window.webContents.mainFrame.frames.map((frame) => ({ url: frame.url, processId: frame.processId, routingId: frame.routingId })), null, 2));
        throw new Error("Probe did not observe the report title inside the sandboxed iframe");
      }
      const reportWindow = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
      try {
        await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(saved.html)}`);
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
        reportArtifacts = { embedded, mobile, reducedMotion, printed: true };
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
        activityArtifacts = await window.webContents.executeJavaScript("(() => { const panel=document.querySelector('.native-activity-panel'); const indicator=panel?.querySelector('.na-live-state'); if(!panel||!indicator) throw Error('활동 패널 없음'); const wasLive=indicator.classList.contains('na-live'); indicator.classList.add('na-live'); const animation=getComputedStyle(indicator.querySelector('i')).animationName; if(!wasLive) indicator.classList.remove('na-live'); return {width:panel.getBoundingClientRect().width,overflow:panel.scrollWidth>panel.clientWidth,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,beaconAnimation:animation}; })()");
      } finally { window.webContents.debugger.detach(); }
      const observed = record(activityArtifacts);
      if (observed.overflow !== false || observed.reducedMotion !== true || observed.beaconAnimation !== "none") throw new Error("활동 패널 좁은 화면·모션 축소 검사 실패");
    }
    writeFileSync(PROBE_PATH, `${JSON.stringify({ shell: "electron", ...record(result), reportArtifacts, activityArtifacts }, null, 2)}\n`);
    setImmediate(() => app.quit());
  });
}

function createWindow(): void {
  window = new BrowserWindow({ show: !(PROBE_PATH && process.env.WWW_NATIVE_PROBE === "1"), width: 1440, height: 900, minWidth: 1040, minHeight: 680, backgroundColor: "#0b0b0c", webPreferences: { preload: join(DIST, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (PROBE_PATH && process.env.WWW_PROBE_REPORTS === "1") window.webContents.on("console-message", (_event, ...details) => console.log("report-probe-console", ...details));
  void window.loadFile(join(DIST, "index.html"));
}

void app.whenReady().then(() => { registerIpc(); createWindow(); });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => reportAbort.abort());
