/**
 * @architecture arch.native.lifecycle
 * @implements RESP-NATIVE-LIFECYCLE
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { JsonRpcClient, type RpcMessage } from "./rpc";
import { createConversationService, type ConversationEvent } from "./conversations";
import { createDevelopmentService } from "./development";
import { createReportService } from "./reports-service";
import { createNativeReportHarness } from "./native-reports";
import { judgeNativeReport } from "./report-judge";
import { NativeCompletionCollector } from "./native-report-input";
import { resolveNativeCodex } from "./native-command";
import { nativeThreadStartParams } from "./native-chat";
import { createNativeLifecycle } from "./native-lifecycle";
import { parseHooksListResponse, parseSkillsListResponse } from "./activity-sidebar";
import { createActivityLedger, type ActivityLedger } from "./activity-ledger";
import { createProjectRegistry } from "./projects";
import { normalizeNativeResources } from "./native-activity";
import type { AppEvent, ScopedAppEvent, SelectionRef, WorkspaceSelection, ResourceScope, ResourceSnapshot, RpcId } from "./shared";

const DIST = join(app.getAppPath(), "dist");

const PROBE_PATH  = process.env.WWW_PROBE_PATH                                                                                     ;
// probe profile은 single-instance lock 이전에 확정한다.
if (PROBE_PATH) {
  const profile = process.argv.find((arg) => arg.startsWith("--user-data-dir="))?.slice("--user-data-dir=".length);
  if (!profile) throw new Error("Probe 격리 user-data-dir이 필요합니다.");
  app.setPath("userData", resolve(profile));
}
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.exit(0);
const processEpoch = randomUUID();
let selectionEpoch = 0;
let stopping = false;
let childProcess: ChildProcess | null = null;
let clientToken = 0;
let ledger: ActivityLedger;
let projects: ReturnType<typeof createProjectRegistry>;
let projectRegistrationError: string | null = null;
const resourceScopes = new Map<string, Promise<ResourceScope>>();
const resourceLoads = new Map<string, Promise<ResourceScope>>();
const collections = new Set<Promise<unknown>>();
const resourceCollections = new Map<string, Promise<void>>();
const nativeEntry = process.hrtime.bigint()                                                                                        ;
let workspace     = PROBE_PATH && process.env.WWW_PROBE_WORKSPACE ? resolve(process.env.WWW_PROBE_WORKSPACE) : app.getPath("home") ;

let rpc    : JsonRpcClient | null = null  ;
let window : BrowserWindow | null = null  ;
let threadStarted                 = false ;
let connecting : Promise<JsonRpcClient> | null = null;
let activeThreadId : string | null = null;
let activeTurnId   : string | null = null;
let turnStarting                  = false;
let switchingConversation         = false;
const endedTurns = new Set<string>();

let reportRepository : string | null                                       = null ;
let nativeReports    : ReturnType<typeof createNativeReportHarness> | null = null ;

let autoReportsEnabled  = !PROBE_PATH || process.env.WWW_PROBE_NATIVE_REPORTS === "1" ;
const reportAbort       = new AbortController()                                       ;
const nativeCompletions = new Map<string, NativeCompletionCollector>()                             ;

let seq                       = 0                        ;
let connectionGeneration      = 0                        ;
let activityRequestGeneration = 0                        ;
const eventLog : ScopedAppEvent[] = []                       ;
const lifecycle = createNativeLifecycle(publish);
const latestActivityRequests = new Map<string, number>();

const SUPPORTED = new Set(["item/commandExecution/requestApproval", "item/fileChange/requestApproval"]) ;
const DECISIONS = new Set(["accept", "acceptForSession", "decline", "cancel"])                          ;

function selection(): SelectionRef {
  return { workspaceKey: createHash("sha256").update(workspace).digest("hex"), selectionEpoch, processEpoch };
}
function isCurrent(expected: SelectionRef): boolean {
  const current = selection();
  return !stopping && expected.processEpoch === current.processEpoch && expected.workspaceKey === current.workspaceKey && expected.selectionEpoch === current.selectionEpoch;
}
function assertSelection(value: unknown): asserts value is SelectionRef {
  const expected = optionalRecord(value);
  if (!expected || typeof expected.workspaceKey !== "string" || typeof expected.processEpoch !== "string" || typeof expected.selectionEpoch !== "number"
    || !isCurrent({ workspaceKey: expected.workspaceKey, processEpoch: expected.processEpoch, selectionEpoch: expected.selectionEpoch })) throw new Error("프로젝트 선택이 변경됐습니다. 다시 시도해 주세요.");
}
function wire(event: Omit<AppEvent, "seq" | "at">): ScopedAppEvent {
  return { ...event, ...selection(), connectionGeneration, seq: ++seq, at: new Date().toISOString() };
}
function loadResourceScope(root: string, threadId: string, epoch: number): Promise<ResourceScope> {
  const key = JSON.stringify([root, threadId, epoch]);
  let pending = resourceLoads.get(key);
  if (!pending) {
    const scopeKey = JSON.stringify([root, threadId]);
    let actualScope = resourceScopes.get(scopeKey);
    if (!actualScope) {
      actualScope = ledger.scope(root, threadId);
      resourceScopes.set(scopeKey, actualScope);
      void actualScope.catch(() => resourceScopes.delete(scopeKey));
    }
    pending = actualScope.then(async (scope) => { await ledger.select(scope, epoch); return scope; });
    resourceLoads.set(key, pending);
    void pending.catch(() => { if (resourceLoads.get(key) === pending) resourceLoads.delete(key); });
  }
  return pending;
}
function collectResources(entry: ScopedAppEvent): void {
  if (stopping) return;
  const root = workspace;
  const normalized = normalizeNativeResources(entry, root, {
    documentIdentity: (path, cwd) => "document-sha256:" + createHash("sha256").update(resolve(root, cwd, path)).digest("hex"),
  });
  if (!normalized.threadId) return;
  if (!normalized.observations.length && !normalized.gaps.length && entry.method !== "turn/completed") return;
  const id = normalized.threadId;
  const key = JSON.stringify([root, id]);
  const previous = resourceCollections.get(key) ?? Promise.resolve();
  const scopeReady = loadResourceScope(root, id, entry.selectionEpoch);
  void scopeReady.catch(() => undefined);
  const pending = previous.then(async () => {
    const scope = await scopeReady;
    for (const gap of normalized.gaps) ledger.gap(scope, gap);
    for (const observation of normalized.observations) await ledger.upsert(scope, observation);
    if (entry.method === "turn/completed") await ledger.flush();
  }).catch((error: unknown) => {
    console.warn("리소스 수집 실패 · 채팅은 계속됩니다.", error);
    if (isCurrent(entry)) publish({ kind: "notification", method: "activity/resourcesUnavailable", params: { message: String(error) } });
  });
  resourceCollections.set(key, pending);
  collections.add(pending);
  void pending.finally(() => {
    collections.delete(pending);
    if (resourceCollections.get(key) === pending) resourceCollections.delete(key);
  });
}
async function currentResources(expected: SelectionRef): Promise<ResourceSnapshot | null> {
  assertSelection(expected);
  const id = activeThreadId;
  if (!id) return null;
  const root = workspace;
  const scope = await loadResourceScope(root, id, expected.selectionEpoch);
  await resourceCollections.get(JSON.stringify([root, id]));
  assertSelection(expected);
  if (activeThreadId !== id) throw new Error("대화 선택이 변경됐습니다.");
  return ledger.snapshot(scope);
}
function publish(event: Omit<AppEvent, "seq" | "at">): void {
  if (stopping) return;
  const entry = wire(event);
  collectResources(entry);
  eventLog.push(entry);
  if (eventLog.length > 2000) eventLog.shift();
  window?.webContents.send("app:event", entry);
  if (autoReportsEnabled && nativeReports) {
    const expected = selection();
    const repository = workspace;
    const params = optionalRecord(entry.params);
    const nativeTurn = optionalRecord(params?.turn);
    const turnId = typeof params?.turnId === "string" ? params.turnId : typeof nativeTurn?.id === "string" ? nativeTurn.id : null;
    if (typeof params?.threadId === "string" && turnId && ["turn/started", "turn/startAccepted", "turn/completed"].includes(entry.method)) {
      const key = JSON.stringify([repository, params.threadId, turnId]);
      if (!reportSelections.has(key)) reportSelections.set(key, expected);
    }
    let collector = nativeCompletions.get(repository);
    if (!collector) { collector = new NativeCompletionCollector(); nativeCompletions.set(repository, collector); }
    for (const input of collector.observe(eventLog, entry)) {
      const reportKey = JSON.stringify([repository, input.threadId, input.turnId]);
      if (!reportSelections.has(reportKey)) reportSelections.set(reportKey, expected);
      const reportExpected = reportSelections.get(reportKey);
      void nativeReports.enqueue({ repository, input }).catch((error: unknown) => {
        if (reportExpected && isCurrent(reportExpected)) publish({ kind: "notification", method: "reports/autoError", params: { threadId: input.threadId, turnId: input.turnId, message: String(error) } });
      });
    }
  }
}

function connect(): Promise<JsonRpcClient> {
  if (stopping) return Promise.reject(new Error("앱 종료 중"));
  if (rpc) return Promise.resolve(rpc);
  if (connecting) return connecting;
  const token = ++clientToken;
  const root = workspace;
  const valid = () => !stopping && token === clientToken && workspace === root;
  connectionGeneration += 1;
  const pending: Promise<JsonRpcClient> = new Promise<JsonRpcClient>((resolveClient, reject) => {
    const child  = spawn(resolveNativeCodex(), ["app-server"], { cwd: workspace, stdio: ["pipe", "pipe", "pipe"] }) ;
    childProcess = child;
    const client = new JsonRpcClient(child)                                                         ;
    let settled  = false                                                                            ;
    client.once("closed", (error: Error) => {
      if (!valid()) { if (!settled) reject(error); return; }
      clientToken++;
      rpc = null;
      childProcess = null;
      const interruptedThread = activeTurnId !== null ? activeThreadId : null;
      activeTurnId = null;
      // 준비 중인 IPC의 finally만 잠금을 해제한다. closed에서 내리면 복구가 겹친다.
      lifecycle.closed(client, error.message, interruptedThread);
      if (activeThreadId) {
        const id = activeThreadId;
        void loadResourceScope(workspace, id, selectionEpoch).then((scope) => { if (!stopping && workspace === root) ledger.gap(scope, "disconnect"); }).catch((error: unknown) => console.warn(error));
      }
      publish({ kind: "transport", method: "transport/closed", params: { message: error.message } });
      if (!settled) reject(error);
    });
    client.on("stderr", (text: string) => { if (valid()) publish({ kind: "transport", method: "transport/stderr", params: { text } }); });
    client.on("protocolError", (message: string) => { if (valid()) publish({ kind: "transport", method: "transport/error", params: { message } }); });
    client.on("message", (message: RpcMessage) => {
      if (!valid()) return;
      const method = String(message.method) ;
      const id     = message.id             ;
      const params = optionalRecord(message.params);
      const turn   = params && optionalRecord(params.turn);
      if (method === "turn/started" && params?.threadId === activeThreadId && turn && typeof turn.id === "string") activeTurnId = turn.id;
      if (method === "turn/completed" && params && turn && typeof turn.id === "string") {
        endedTurns.add(`${String(params.threadId)}:${turn.id}`);
        if (params.threadId === activeThreadId && activeTurnId === turn.id) activeTurnId = null;
      }
      if (typeof id === "string" || typeof id === "number") {
        const supported = SUPPORTED.has(method);
        const token = supported ? lifecycle.approval(client, id, params?.threadId) : null;
        publish({ kind: "request", method, params: message.params, requestId: id, ...(token === null ? {} : { approvalToken: token }), supported: token !== null });
      } else publish({ kind: "notification", method, params: method === "account/rateLimits/updated" ? rateLimitPayload(message.params) : message.params });
      if (method === "serverRequest/resolved") lifecycle.resolved(client, message.params);
      if (method === "skills/changed") void loadSkills(client, true);
    });
    void client.request("initialize", { clientInfo: { name: "www", title: "WWW", version: app.getVersion() }, capabilities: { experimentalApi: false } })
      .then(() => {
        if (!valid()) { child.kill(); throw new Error("이전 프로젝트 연결 취소"); }
        client.notify("initialized", {});
        rpc = client;
        settled = true;
        publish({ kind: "transport", method: "transport/connected", params: { connectionGeneration } });
        resolveClient(client);
        void loadRateLimits(client);
      })
      .catch((error: unknown) => {
        settled = true;
        if (valid()) { clientToken++; rpc = null; childProcess = null; child.kill(); }
        reject(error);
      });
  }).finally(() => { if (connecting === pending) connecting = null; });
  connecting = pending;
  return pending;
}

function assertConversationIdle(): void {
  if (switchingConversation) throw new Error("대화를 전환하고 있습니다. 잠시 기다려 주세요.");
  if (turnStarting || activeTurnId !== null || lifecycle.approvalCount > 0) throw new Error("실행 또는 승인 요청이 끝난 뒤 대화를 전환할 수 있습니다.");
}

function replaceConversationEvents(records: readonly ConversationEvent[]): ScopedAppEvent[] {
  eventLog.splice(0);
  for (const value of records) { const entry = wire(value); collectResources(entry); eventLog.push(entry); }
  if (eventLog.length > 2000) eventLog.splice(0, eventLog.length - 2000);
  return [...eventLog];
}

function workspaceInfo(): WorkspaceSelection {
  const git = (args: string[]) => { try { return execFileSync("git", args, { cwd: workspace, encoding: "utf8" }).trim(); } catch { return ""; } };
  return { ...selection(), name: basename(workspace), path: workspace, branch: git(["branch", "--show-current"]) || null, changes: git(["status", "--porcelain"]).split("\n").filter(Boolean).length };
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
  const expected = selection();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([client.request("account/rateLimits/read", {}), new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("한도 응답 대기 시간 초과")), 5000); })]);
    if (isCurrent(expected) && rpc === client) publish({ kind: "notification", method: "account/rateLimits/updated", params: rateLimitPayload(result) });
  } catch {
    if (isCurrent(expected) && rpc === client) publish({ kind: "notification", method: "account/rateLimits/unavailable", params: {} });
  } finally { clearTimeout(timeout); }
}

function beginActivityRequest(scope: string): number {
  const generation = ++activityRequestGeneration;
  latestActivityRequests.set(scope, generation);
  return generation;
}

function currentActivityRequest(scope: string, generation: number): boolean {
  return latestActivityRequests.get(scope) === generation;
}

function finishActivityRequest(scope: string, generation: number): void {
  if (currentActivityRequest(scope, generation)) latestActivityRequests.delete(scope);
}

function optionalRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function loadSkills(client: JsonRpcClient, forceReload = false): Promise<void> {
  const expected = selection();
  const cwd               = workspace                              ;
  const requestScope      = `skills\u0000${cwd}`                   ;
  const requestGeneration = beginActivityRequest(requestScope)     ;
  try {
    const result = parseSkillsListResponse(await client.request("skills/list", { cwds: [cwd], forceReload }), cwd);
    if (isCurrent(expected) && rpc === client && workspace === cwd && currentActivityRequest(requestScope, requestGeneration)) publish({ kind: "notification", method: "activity/skillsListed", params: { cwd, scope: "workspace", requestGeneration, ...result } });
  } catch {
    if (isCurrent(expected) && rpc === client && workspace === cwd && currentActivityRequest(requestScope, requestGeneration)) publish({ kind: "notification", method: "activity/skillsListed", params: { cwd, scope: "workspace", requestGeneration, complete: false, skills: [] } });
  } finally { if (isCurrent(expected)) finishActivityRequest(requestScope, requestGeneration); }
}

async function loadHooks(client: JsonRpcClient, threadId: string | null = null): Promise<void> {
  const expected = selection();
  const cwd               = workspace                                         ;
  const scope             = threadId === null ? "workspace" : "thread"       ;
  const requestScope      = `hooks\u0000${cwd}\u0000${threadId ?? "workspace"}` ;
  const requestGeneration = beginActivityRequest(requestScope)                ;
  try {
    const params = threadId === null ? { cwds: [cwd] } : { threadId };
    const result = parseHooksListResponse(await client.request("hooks/list", params), cwd);
    if (isCurrent(expected) && rpc === client && workspace === cwd && currentActivityRequest(requestScope, requestGeneration)) publish({ kind: "notification", method: "activity/hooksListed", params: { cwd, scope, threadId, requestGeneration, ...result } });
  } catch {
    if (isCurrent(expected) && rpc === client && workspace === cwd && currentActivityRequest(requestScope, requestGeneration)) publish({ kind: "notification", method: "activity/hooksListed", params: { cwd, scope, threadId, requestGeneration, complete: false, hooks: [] } });
  } finally { if (isCurrent(expected)) finishActivityRequest(requestScope, requestGeneration); }
}

async function refreshActivityInventory(): Promise<void> {
  const expected = selection();
  try {
    const client = await connect();
    assertSelection(expected);
    await Promise.all([loadSkills(client), loadHooks(client)]);
  } catch (error: unknown) {
    if (!isCurrent(expected)) return;
    publish({ kind: "transport", method: "transport/error", params: { message: `Native 연결·활동 조회 실패: ${String(error)}` } });
    const cwd              = workspace                         ;
    const skillsScope      = `skills\u0000${cwd}`              ;
    const hooksScope       = `hooks\u0000${cwd}\u0000workspace` ;
    const skillsGeneration = beginActivityRequest(skillsScope) ;
    const hooksGeneration  = beginActivityRequest(hooksScope)  ;
    publish({ kind: "notification", method: "activity/skillsListed", params: { cwd, scope: "workspace", requestGeneration: skillsGeneration, complete: false, skills: [] } });
    publish({ kind: "notification", method: "activity/hooksListed", params: { cwd, scope: "workspace", threadId: null, requestGeneration: hooksGeneration, complete: false, hooks: [] } });
    finishActivityRequest(skillsScope, skillsGeneration);
    finishActivityRequest(hooksScope, hooksGeneration);
  }
}

const reportSelections = new Map<string, SelectionRef>();
const reportHarnesses = new Map<string, ReturnType<typeof createNativeReportHarness>>();
function reportHarness(root: string) {
  let harness = reportHarnesses.get(root);
  if (!harness) {
    harness = createNativeReportHarness({
      judge: (input) => judgeNativeReport(input, { signal: reportAbort.signal, ...(PROBE_PATH && process.env.WWW_PROBE_REPORT_JUDGE_BIN ? { binary: process.env.WWW_PROBE_REPORT_JUDGE_BIN } : {}) }),
      onState: (job) => {
        const expected = reportSelections.get(JSON.stringify([root, job.threadId, job.turnId]));
        if (expected && workspace === root && isCurrent(expected) && activeThreadId === job.threadId) publish({ kind: "notification", method: "reports/autoState", params: job });
      }
    });
    reportHarnesses.set(root, harness);
  }
  return harness;
}
async function switchWorkspace(expected: SelectionRef, path: string) {
  assertSelection(expected);
  assertConversationIdle();
  switchingConversation = true;
  try {
    const actual = realpathSync(path);
    // register는 실제 디렉터리와 등록 저장을 검증한다. 실패하면 기존 선택을 보전한다.
    try { await projects.register(actual); } catch (cause) { throw new Error("프로젝트 등록·저장에 실패했습니다. 기존 선택을 유지합니다.", { cause }); }
    assertSelection(expected);
    await Promise.allSettled([...collections]);
    assertSelection(expected);
    const flushed = await ledger.flush();
    assertSelection(expected);
    if (!flushed.clean) console.warn("프로젝트 전환: 열린 리소스 일부의 저장 미확정 · 원장 상태를 보전합니다.");
    if (realpathSync(actual) !== actual) throw new Error("프로젝트 실제 경로가 변경됐습니다.");
    if (turnStarting || activeTurnId !== null || lifecycle.approvalCount > 0) throw new Error("새 실행 또는 승인 요청이 생겨 프로젝트 전환을 취소했습니다.");
    // 위 검사부터 선택 확정까지 await 없는 커밋.
    clientToken++;
    rpc = null;
    connecting = null;
    const previousChild = childProcess;
    childProcess = null;
    workspace = actual;
    selectionEpoch++;
    activeThreadId = null;
    activeTurnId = null;
    lifecycle.reset();
    threadStarted = false;
    eventLog.splice(0);
    endedTurns.clear();
    latestActivityRequests.clear();
    previousChild?.kill();
    projectRegistrationError = null;
    nativeReports = reportHarness(actual);
    const result = { workspace: workspaceInfo(), threadId: null, events: [...eventLog], resources: null, resourceStorageWarnings: flushed.failedScopes };
    void refreshActivityInventory();
    return result;
  } finally { if (isCurrent(expected) || selectionEpoch === expected.selectionEpoch + 1) switchingConversation = false; }
}
function registerIpc(): void {
  const reports = createReportService({ workspace: () => reportRepository ?? workspace });
  nativeReports = reportHarness(workspace);
  ipcMain.handle("reports:native-status", async () => ({ enabled: autoReportsEnabled, jobs: await reportHarness(reportRepository ?? workspace).list(reportRepository ?? workspace) }));
  ipcMain.handle("reports:native-enabled", (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") throw new Error("자동 보고서 설정은 boolean이어야 합니다.");
    autoReportsEnabled = enabled;
    return enabled;
  });
  ipcMain.handle("reports:native-retry", (_event, key: unknown) => {
    if (typeof key !== "string" || !/^[a-f0-9]{64}$/.test(key)) throw new Error("자동 보고서 작업 ID가 올바르지 않습니다.");
    return reportHarness(reportRepository ?? workspace).retry(reportRepository ?? workspace, key);
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
  ipcMain.handle("link:open", async (_event, value: unknown) => {
    if (typeof value !== "string" || value.length > 8192) throw new Error("외부 링크가 올바르지 않습니다.");
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("웹 링크만 열 수 있습니다.");
    await shell.openExternal(url.href);
  });
  ipcMain.handle("conversations:list", async (_event, expected: unknown, cursor: unknown) => {
    assertSelection(expected);
    const root = workspace;
    const client = await connect();
    assertSelection(expected);
    const result = await createConversationService(client, root).list(cursor);
    assertSelection(expected);
    return result;
  });
  ipcMain.handle("conversations:open", async (_event, expected: unknown, value: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    switchingConversation = true;
    try {
      const client = await connect();
      assertSelection(expected);
      const restored = await lifecycle.open(client, workspace, value, () => isCurrent(expected) && rpc === client);
      assertSelection(expected);
      if (rpc !== client) throw new Error("Native 연결이 종료됐습니다.");
      selectionEpoch++;
      activeThreadId = restored.threadId;
      activeTurnId = null;
      threadStarted = true;
      const events = replaceConversationEvents([
        { kind: "transport", method: "transport/status", params: { state: "connected", connectionGeneration }, historical: true },
        { kind: "notification", method: "thread/configured", params: { threadId: restored.threadId, model: restored.model, modelProvider: restored.provider, approvalPolicy: restored.approvalPolicy, sandbox: restored.sandbox, isNew: false }, historical: true },
        ...restored.events
      ]);
      void loadSkills(client);
      void loadHooks(client, restored.threadId);
      const resources = await currentResources(selection()).catch((error: unknown) => {
        publish({ kind: "notification", method: "activity/resourcesUnavailable", params: { threadId: restored.threadId, message: String(error) } });
        return null;
      });
      return { workspace: workspaceInfo(), threadId: restored.threadId, events, resources };
    } finally { switchingConversation = false; }
  });
  ipcMain.handle("conversations:new", (_event, expected: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    selectionEpoch++;
    activeThreadId = null;
    activeTurnId = null;
    lifecycle.reset();
    threadStarted = false;
    replaceConversationEvents([
      { kind: "notification", method: "conversation/restored", params: { threadId: null, complete: true }, historical: true },
      { kind: "transport", method: "transport/status", params: { state: rpc ? "connected" : "closed", connectionGeneration }, historical: true }
    ]);
    return { workspace: workspaceInfo(), threadId: null, events: [...eventLog], resources: null };
  });
  ipcMain.handle("workspace:get", () => workspaceInfo());
  ipcMain.handle("activity:refresh", (_event, expected: unknown) => { assertSelection(expected); return refreshActivityInventory(); });
  ipcMain.handle("activity:resources", (_event, expected: unknown) => { assertSelection(expected); return currentResources(expected); });
  ipcMain.handle("projects:list", async (_event, expected: unknown) => {
    assertSelection(expected);
    if (projectRegistrationError) {
      const root = workspace;
      try { await projects.register(root); } catch (cause) { throw new Error(`현재 프로젝트 등록·저장 실패: ${projectRegistrationError}`, { cause }); }
      assertSelection(expected);
      projectRegistrationError = null;
    }
    const result = await projects.list(); assertSelection(expected); return result;
  });
  ipcMain.handle("projects:favorite", async (_event, expected: unknown, key: string, favorite: boolean) => {
    assertSelection(expected); await projects.setFavorite(key, favorite); assertSelection(expected);
  });
  ipcMain.handle("projects:switch", async (_event, expected: unknown, key: unknown) => {
    assertSelection(expected); assertConversationIdle();
    const list = await projects.list(); assertSelection(expected);
    const project = list.find((item) => item.workspaceKey === key);
    if (!project) throw new Error("등록된 프로젝트가 없습니다.");
    return switchWorkspace(expected, project.path);
  });
  ipcMain.handle("workspace:choose", async (_event, expected: unknown) => {
    assertSelection(expected); assertConversationIdle();
    const result = await dialog.showOpenDialog(window!, { properties: ["openDirectory", "createDirectory"] });
    assertSelection(expected);
    if (result.canceled || !result.filePaths[0]) return null;
    return switchWorkspace(expected, result.filePaths[0]);
  });
  ipcMain.handle("thread:start", async (_event, expected: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    if (activeThreadId !== null) throw new Error("새 스레드를 시작하기 전에 새 대화를 선택해 주세요.");
    switchingConversation = true;
    try {
      const client   = await connect()                                                                  ;
      assertSelection(expected);
      const result   = record(await client.request("thread/start", nativeThreadStartParams(workspace))) ;
      const threadId = requiredString(record(result.thread).id, "thread ID")                            ;
      assertSelection(expected);
      if (rpc !== client) throw new Error("Native 연결이 종료됐습니다.");
      lifecycle.markReady(client, workspace, threadId);
      threadStarted = true;
      activeThreadId = threadId;
      void currentResources(expected).catch((error: unknown) => {
        console.warn(error);
        if (isCurrent(expected)) publish({ kind: "notification", method: "activity/resourcesUnavailable", params: { threadId, message: String(error) } });
      });
      publish({ kind: "notification", method: "thread/configured", params: { threadId, model: typeof result.model === "string" ? result.model : null, modelProvider: typeof result.modelProvider === "string" ? result.modelProvider : null, isNew: true } });
      void loadHooks(client, threadId);
      return { threadId };
    } finally { switchingConversation = false; }
  });
  ipcMain.handle("turn:start", async (_event, expected: unknown, threadId: unknown, text: unknown) => {
    assertSelection(expected);
    const validThreadId = requiredString(threadId, "thread ID");
    assertSelection(expected);
    assertConversationIdle();
    if (validThreadId !== activeThreadId) throw new Error("현재 선택한 대화에만 요청을 보낼 수 있습니다.");
    if (typeof text !== "string" || !text.trim() || text.length > 100_000) throw new Error("Invalid prompt");
    const prompt          = text.trim () ;
    const clientRequestId = randomUUID() ;
    turnStarting = true;
    endedTurns.clear();
    let startedClient: JsonRpcClient | null = null;
    let promptPublished = false;
    try {
      const root = workspace;
      const result = record(await lifecycle.start({
        connect: async () => { const client = await connect(); startedClient = client; return client; },
        valid: (client) => isCurrent(expected) && rpc === client && workspace === root && activeThreadId === validThreadId,
        cwd: root, threadId: validThreadId, prompt,
        restored: (restored) => {
          const events = replaceConversationEvents([
            { kind: "transport", method: "transport/status", params: { state: "connected", connectionGeneration }, historical: true },
            { kind: "notification", method: "thread/configured", params: { threadId: restored.threadId, model: restored.model, modelProvider: restored.provider, approvalPolicy: restored.approvalPolicy, sandbox: restored.sandbox, isNew: false }, historical: true },
            ...restored.events
          ]);
          // renderer는 이 snapshot을 교체 적용해야 한다. 과거 userPrompt를 append하면 중복된다.
          publish({ kind: "notification", method: "conversation/reconnected", params: { threadId: restored.threadId, events } });
          if (startedClient) { void loadSkills(startedClient); void loadHooks(startedClient, restored.threadId); }
        },
        beforeStart: () => {
          promptPublished = true;
          publish({ kind: "notification", method: "turn/userPrompt", params: { clientRequestId, threadId: validThreadId, text: prompt } });
        }
      }));
      assertSelection(expected);
      if (rpc !== startedClient) throw new Error("Native 연결이 종료됐습니다.");
      const turnId = requiredString(record(result.turn).id, "turn ID"                                                          ) ;
      if (!endedTurns.has(`${validThreadId}:${turnId}`)) activeTurnId = turnId;
      publish({ kind: "notification", method: "turn/startAccepted", params: { clientRequestId, threadId: validThreadId, turnId } });
      return { turnId };
    } catch (error) {
      assertSelection(expected);
      if (promptPublished && rpc === startedClient) publish({ kind: "notification", method: "turn/startFailed", params: { clientRequestId, threadId: validThreadId, message: String(error) } });
      throw error;
    } finally { if (isCurrent(expected)) turnStarting = false; }
  });
  ipcMain.handle("turn:interrupt", async (_event, expected: unknown, threadId: unknown, turnId: unknown) => {
    assertSelection(expected);
    requiredString(threadId, "thread ID"); requiredString(turnId, "turn ID");
    if (threadId !== activeThreadId || turnId !== activeTurnId) throw new Error("현재 실행 중인 턴만 중단할 수 있습니다.");
    publish({ kind: "notification", method: "turn/interruptRequested", params: { threadId, turnId } });
    try {
      const client = await connect();
      assertSelection(expected);
      await client.request("turn/interrupt", { threadId, turnId });
      assertSelection(expected);
      publish({ kind: "notification", method: "turn/interruptAcknowledged", params: { threadId, turnId } });
    } catch (error) {
      assertSelection(expected);
      publish({ kind: "notification", method: "turn/interruptUncertain", params: { threadId, turnId, message: String(error) } });
      throw error;
    }
  });
  ipcMain.handle("approval:respond", async (_event, expected: unknown, requestId: unknown, decision: unknown, approvalToken: unknown) => {
    assertSelection(expected);
    validId(requestId);
    if (typeof decision !== "string" || !DECISIONS.has(decision)) throw new Error("Unsupported approval decision");
    const token = requiredString(approvalToken, "approval token");
    const client = rpc;
    await lifecycle.respond(client, requestId, decision, token, () => isCurrent(expected) && rpc === client);
  });
  ipcMain.handle("events:get", (_event, expected: unknown) => { assertSelection(expected); return [...eventLog]; });
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
}

if (ownsInstance) void app.whenReady().then(async () => {
  mkdirSync(app.getPath("userData"), { recursive: true, mode: 0o700 });
  const userData = realpathSync(app.getPath("userData"));
  app.setPath("userData", userData);
  workspace = realpathSync(workspace);
  projects = createProjectRegistry({ userData });
  ledger = createActivityLedger({ userData, processEpoch, onSnapshot: (snapshot) => {
    if (!stopping && snapshot.processEpoch === processEpoch && snapshot.selectionEpoch === selectionEpoch && snapshot.scope.workspaceKey === selection().workspaceKey && snapshot.scope.threadId === activeThreadId) window?.webContents.send("activity:resources", snapshot);
  } });
  await projects.register(workspace).catch((error: unknown) => { projectRegistrationError = String(error); console.warn("현재 프로젝트 등록 실패", error); });
  if (!stopping) { registerIpc(); createWindow(); }
}).catch((error: unknown) => { console.error("WWW 초기화 실패", error); app.quit(); });
app.on("window-all-closed", () => app.quit());
let quitFinished = false;
app.on("before-quit", (event) => {
  if (!ownsInstance || quitFinished) return;
  event.preventDefault();
  if (stopping) return;
  stopping = true;
  clientToken++;
  rpc = null;
  connecting = null;
  childProcess?.kill();
  reportAbort.abort();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const close = Promise.allSettled([...collections]).then(() => expired ? { clean: false } : ledger?.close() ?? { clean: false });
  void Promise.race([close, new Promise<{ clean: boolean }>((resolveClose) => {
    deadline = setTimeout(() => { expired = true; resolveClose({ clean: false }); }, 2000);
  })]).then((result) => {
    clearTimeout(deadline);
    if (expired || !result.clean) console.warn("리소스 원장 종료 내구성 미확정");
    quitFinished = true;
    if (expired) app.exit(0);
    else app.quit();
  });
});
