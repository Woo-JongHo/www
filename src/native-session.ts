/**
 * Native 연결·선택·실행·승인 상태를 대화 탭마다 소유한다.
 * @architecture arch.native.lifecycle
 * @implements RESP-NATIVE-LIFECYCLE
 */
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { basename, resolve } from "node:path";
import { JsonRpcClient, type RpcMessage } from "./rpc";
import { createConversationService, type ConversationEvent } from "./conversations";
import { createDevelopmentService } from "./development";
import { createReportService } from "./reports-service";
import type { createNativeReportHarness } from "./native-reports";
import { NativeCompletionCollector } from "./native-report-input";
import { resolveNativeCodex } from "./native-command";
import { nativeThreadStartParams } from "./native-chat";
import { createNativeLifecycle } from "./native-lifecycle";
import { createNativeTiming } from "./native-timing";
import { parseHooksListResponse, parseSkillsListResponse } from "./activity-sidebar";
import type { ActivityLedger } from "./activity-ledger";
import { createProjectRegistry } from "./projects";
import { readDashboard } from "./dashboard";
import { normalizeNativeResources } from "./native-activity";
import type { AppEvent, ScopedAppEvent, SelectionRef, WorkspaceSelection, ResourceScope, ResourceSnapshot, RpcId, NativeSessionSummary, NativeReportJob, WorkReportDocument } from "./shared";


export interface NativeSessionOptions {
  id: string;
  workspace: string;
  processEpoch: string;
  appVersion: string;
  ledger: ActivityLedger;
  projects: ReturnType<typeof createProjectRegistry>;
  wwwRoot: string;
  dist: string;
  reports: { enabled: boolean };
  reportHarness(root: string): ReturnType<typeof createNativeReportHarness>;
  ownership: {
    reserve(sessionId: string, workspaceKey: string, threadId: string): { commit(): void; rollback(): void };
    release(sessionId: string): void;
  };
  onEvent(event: ScopedAppEvent): void;
  onResources(snapshot: ResourceSnapshot): void;
  onChanged(): void;
  chooseDirectory(title: string, createDirectory: boolean): Promise<string | null>;
  exportReport(document: WorkReportDocument): Promise<string | null>;
  openExternal(url: string): Promise<void>;
  spawnNative?(workspace: string): ChildProcessWithoutNullStreams;
  registrationError?: string | null;
  workspaceMetadata?(workspace: string): { branch: string | null; changes: number };
}

export function createNativeSession(options: NativeSessionOptions) {
  const { ledger, projects, processEpoch } = options;
  let title = "새 대화";
  let failed = false;
  type Handler = (_event: unknown, ...args: unknown[]) => unknown;
  const handlers = new Map<string, Handler>();
  const handle = (channel: string, handler: Handler) => { handlers.set(channel, handler); };
  let selectionEpoch = 0;
  let stopping = false;
  let stopPromise: Promise<void> | null = null;
  let childProcess: ChildProcessWithoutNullStreams | null = null;
  const nativeChildren = new Set<ChildProcessWithoutNullStreams>();
  const childStops = new Map<ChildProcessWithoutNullStreams, Promise<void>>();
  let clientToken = 0;
  let projectRegistrationError = options.registrationError ?? null;
  const resourceScopes = new Map<string, Promise<ResourceScope>>();
  const resourceLoads = new Map<string, Promise<ResourceScope>>();
  const collections = new Set<Promise<unknown>>();
  const resourceCollections = new Map<string, Promise<void>>();
  let workspace = options.workspace;
  let metadata: { path: string; branch: string | null; changes: number } | null = null;

  let rpc    : JsonRpcClient | null = null  ;
  let threadStarted                 = false ;
  let connecting : Promise<JsonRpcClient> | null = null;
  let activeThreadId : string | null = null;
  let activeTurnId   : string | null = null;
  let turnStarting                  = false;
  let switchingConversation         = false;
  type ThreadTransition = { kind: "open" | "start" | "clear"; candidate: string | null; messages: RpcMessage[]; bytes: number; error: Error | null };
  let threadTransition: ThreadTransition | null = null;
  let nativeMessageHandler: ((message: RpcMessage) => void) | null = null;
  const endedTurns = new Set<string>();

  let reportRepository : string | null                                       = null ;
  let nativeReports    : ReturnType<typeof createNativeReportHarness> | null = null ;


  const nativeCompletions = new Map<string, NativeCompletionCollector>()                             ;

  let seq                       = 0                        ;
  let connectionGeneration      = 0                        ;
  let activityRequestGeneration = 0                        ;
  const eventLog : ScopedAppEvent[] = []                       ;
  const lifecycle = createNativeLifecycle(publish);
  const nativeTiming = createNativeTiming({ now: () => performance.now(), id: randomUUID, emit: (params) => publish({ kind: "notification", method: "diagnostics/timing", params }) });
  type TimingTrace = ReturnType<typeof nativeTiming.begin>;
  const latestActivityRequests = new Map<string, number>();

  const SUPPORTED = new Set(["item/commandExecution/requestApproval", "item/fileChange/requestApproval"]) ;
  const DECISIONS = new Set(["accept", "acceptForSession", "decline", "cancel"])                          ;


  function terminateChild(child: ChildProcessWithoutNullStreams): Promise<void> {
    const pending = childStops.get(child);
    if (pending) return pending;
    if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
    const closed = new Promise<void>(resolveClose => {
      const timer = setTimeout(() => { child.kill("SIGKILL"); }, 500);
      child.once("close", () => { clearTimeout(timer); resolveClose(); });
      child.kill();
    });
    childStops.set(child, closed);
    void closed.finally(() => childStops.delete(child));
    return closed;
  }
  function observeSummary(entry: ScopedAppEvent): void {
    const params = optionalRecord(entry.params);
    const turn = optionalRecord(params?.turn);
    if (["transport/closed", "transport/error", "turn/startFailed"].includes(entry.method) || (entry.method === "turn/completed" && turn?.status === "failed")) failed = true;
    if (["transport/connected", "turn/startAccepted"].includes(entry.method)) failed = false;
    if (entry.method === "turn/userPrompt" && title === "새 대화" && typeof params?.text === "string") title = params.text.slice(0, 40);
    if (entry.kind === "transport" || entry.method.startsWith("approval/") || ["thread/configured", "turn/started", "turn/completed", "turn/startAccepted", "turn/startFailed", "turn/userPrompt"].includes(entry.method) || entry.kind === "request") options.onChanged();
  }
  function summary(): NativeSessionSummary {
    return { id: options.id, title, workspace: workspaceSnapshot(), threadId: activeThreadId, busy: turnStarting || activeTurnId !== null || switchingConversation, approvalCount: lifecycle.approvalCount, failed };
  }
  function selection(): SelectionRef {
    return { sessionId: options.id, workspaceKey: createHash("sha256").update(workspace).digest("hex"), selectionEpoch, processEpoch };
  }
  function isCurrent(expected: SelectionRef): boolean {
    const current = selection();
    return !stopping && expected.sessionId === options.id && expected.processEpoch === current.processEpoch && expected.workspaceKey === current.workspaceKey && expected.selectionEpoch === current.selectionEpoch;
  }
  function assertSelection(value: unknown): asserts value is SelectionRef {
    const expected = optionalRecord(value);
    if (!expected || typeof expected.workspaceKey !== "string" || typeof expected.processEpoch !== "string" || typeof expected.selectionEpoch !== "number"
      || expected.sessionId !== options.id
      || !isCurrent({ sessionId: options.id, workspaceKey: expected.workspaceKey, processEpoch: expected.processEpoch, selectionEpoch: expected.selectionEpoch })) throw new Error("프로젝트 선택이 변경됐습니다. 다시 시도해 주세요.");
  }
  function eventThread(value: unknown): string | null {
    const params = optionalRecord(value);
    const thread = optionalRecord(params?.thread);
    const turn = optionalRecord(params?.turn);
    return typeof params?.threadId === "string" ? params.threadId : typeof thread?.id === "string" ? thread.id : typeof turn?.threadId === "string" ? turn.threadId : null;
  }
  function beginThreadTransition(kind: ThreadTransition["kind"], candidate: string | null = null): void {
    threadTransition = { kind, candidate, messages: [], bytes: 0, error: null };
  }
  function assertThreadTransition(): void {
    if (threadTransition?.error) throw threadTransition.error;
  }
  function finishThreadTransition(): void {
    assertThreadTransition();
    const messages = threadTransition?.messages ?? [];
    threadTransition = null;
    for (const message of messages) nativeMessageHandler?.(message);
  }
  async function drainResources(): Promise<void> {
    // 전환 gate 설치 뒤에는 새 scope load/collection을 받지 않는다.
    await Promise.allSettled([...resourceLoads.values(), ...collections]);
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
    if (stopping || threadTransition || !isCurrent(entry)) return;
    const root = workspace;
    const normalized = normalizeNativeResources(entry, root, {
      documentIdentity: (path, cwd) => "document-sha256:" + createHash("sha256").update(resolve(root, cwd, path)).digest("hex"),
    });
    if (!normalized.threadId || normalized.threadId !== activeThreadId) return;
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
    if (threadTransition) throw new Error("대화를 전환하고 있습니다. 리소스 조회를 다시 시도해 주세요.");
    const id = activeThreadId;
    if (!id) return null;
    const root = workspace;
    const scope = await loadResourceScope(root, id, expected.selectionEpoch);
    await resourceCollections.get(JSON.stringify([root, id]));
    assertSelection(expected);
    if (activeThreadId !== id) throw new Error("대화 선택이 변경됐습니다.");
    return { ...ledger.snapshot(scope), sessionId: options.id };
  }
  function publish(event: Omit<AppEvent, "seq" | "at">): void {
    const threadId = eventThread(event.params);
    if (stopping || (event.method !== "diagnostics/timing" && threadId !== null && (threadTransition !== null || threadId !== activeThreadId))) return;
    const entry = wire(event.approvalToken ? { ...event, approvalToken: `${options.id}:${event.approvalToken}` } : event);
    observeSummary(entry);
    collectResources(entry);
    eventLog.push(entry);
    if (eventLog.length > 2000) eventLog.shift();
    options.onEvent(entry);
    if (options.reports.enabled && nativeReports) {
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

  async function connect(trace?: TimingTrace): Promise<JsonRpcClient> {
    trace?.mark("connect", "started");
    try {
      const client = await connectNative(trace);
      trace?.mark("connect", "completed");
      return client;
    } catch (error) {
      trace?.mark("connect", "failed");
      throw error;
    }
  }
  function connectNative(trace?: TimingTrace): Promise<JsonRpcClient> {
    if (stopping) return Promise.reject(new Error("앱 종료 중"));
    if (rpc) return Promise.resolve(rpc);
    if (connecting) return connecting;
    const token = ++clientToken;
    const root = workspace;
    const valid = () => !stopping && token === clientToken && workspace === root;
    connectionGeneration += 1;
    const pending: Promise<JsonRpcClient> = new Promise<JsonRpcClient>((resolveClient, reject) => {
      const child = options.spawnNative ? options.spawnNative(workspace) : spawn(resolveNativeCodex(), ["app-server"], { cwd: workspace, stdio: ["pipe", "pipe", "pipe"] });
      nativeChildren.add(child);
      child.once("close", () => nativeChildren.delete(child));
      childProcess = child;
      const client = new JsonRpcClient(child)                                                         ;
      let settled  = false                                                                            ;
      client.once("closed", (error: Error) => {
        if (!valid()) { if (!settled) reject(error); return; }
        nativeTiming.cancel("failed");
        clientToken++;
        rpc = null;
        childProcess = null;
        const interruptedThread = activeTurnId !== null ? activeThreadId : null;
        activeTurnId = null;
        // 준비 중인 IPC의 finally만 잠금을 해제한다. closed에서 내리면 복구가 겹친다.
        lifecycle.closed(client, error.message, interruptedThread);
        if (activeThreadId && !threadTransition) {
          const id = activeThreadId;
          const expected = selection();
          const pending = loadResourceScope(workspace, id, selectionEpoch).then(scope => { if (isCurrent(expected) && activeThreadId === id) ledger.gap(scope, "disconnect"); }).catch((error: unknown) => console.warn(error));
          collections.add(pending);
          void pending.finally(() => collections.delete(pending));
        }
        publish({ kind: "transport", method: "transport/closed", params: { message: error.message } });
        if (!settled) reject(error);
      });
      client.on("stderr", (text: string) => { if (valid()) publish({ kind: "transport", method: "transport/stderr", params: { text } }); });
      client.on("protocolError", (message: string) => { if (valid()) publish({ kind: "transport", method: "transport/error", params: { message } }); });
      const receiveMessage = (message: RpcMessage) => {
        if (!valid()) return;
        const threadId = eventThread(message.params);
        if (threadId !== null) {
          if (threadTransition) {
            if (!threadTransition.error && (threadTransition.candidate === threadId || threadTransition.kind === "start")) {
              const bytes = Buffer.byteLength(JSON.stringify(message), "utf8");
              if (threadTransition.messages.length >= 2000 || threadTransition.bytes + bytes > 4 * 1024 * 1024) {
                threadTransition.error = new Error("대화 전환 중 Native 사건이 보관 한도를 넘었습니다. 다시 열어 주세요.");
                threadTransition.messages.splice(0);
                threadTransition.bytes = 0;
              } else { threadTransition.messages.push(message); threadTransition.bytes += bytes; }
            }
            return;
          }
          if (threadId !== activeThreadId) return;
        }
        const method = String(message.method) ;
        nativeTiming.observe(method, message.params);
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
      };
      nativeMessageHandler = receiveMessage;
      client.on("message", receiveMessage);
      trace?.mark("initialize", "started");
      void client.request("initialize", { clientInfo: { name: "www", title: "WWW", version: options.appVersion }, capabilities: { experimentalApi: false } })
        .then(() => {
          if (!valid()) { void terminateChild(child); throw new Error("이전 프로젝트 연결 취소"); }
          client.notify("initialized", {});
          trace?.mark("initialize", "completed");
          rpc = client;
          settled = true;
          publish({ kind: "transport", method: "transport/connected", params: { connectionGeneration } });
          resolveClient(client);
          void loadRateLimits(client);
        })
        .catch((error: unknown) => {
          trace?.mark("initialize", "failed");
          settled = true;
          if (valid()) { clientToken++; rpc = null; childProcess = null; void terminateChild(child); }
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

  function workspaceSnapshot(): WorkspaceSelection {
    const current = metadata?.path === workspace ? metadata : null;
    return { ...selection(), name: basename(workspace), path: workspace, branch: current?.branch ?? null, changes: current?.changes ?? 0 };
  }
  function workspaceInfo(): WorkspaceSelection {
    if (options.workspaceMetadata) metadata = { path: workspace, ...options.workspaceMetadata(workspace) };
    else {
      const git = (args: string[]) => { try { return execFileSync("git", args, { cwd: workspace, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
      metadata = { path: workspace, branch: git(["branch", "--show-current"]) || null, changes: git(["status", "--porcelain"]).split("\n").filter(Boolean).length };
    }
    return workspaceSnapshot();
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
  async function switchWorkspace(expected: SelectionRef, path: string) {
    assertSelection(expected);
    assertConversationIdle();
    switchingConversation = true;
    beginThreadTransition("clear");
    try {
      const actual = realpathSync(path);
      // register는 실제 디렉터리와 등록 저장을 검증한다. 실패하면 기존 선택을 보전한다.
      try { await projects.register(actual); } catch (cause) { throw new Error("프로젝트 등록·저장에 실패했습니다. 기존 선택을 유지합니다.", { cause }); }
      assertSelection(expected);
      await drainResources();
      assertSelection(expected);
      const flushed = await ledger.flush();
      assertSelection(expected);
      if (!flushed.clean) console.warn("프로젝트 전환: 열린 리소스 일부의 저장 미확정 · 원장 상태를 보전합니다.");
      if (realpathSync(actual) !== actual) throw new Error("프로젝트 실제 경로가 변경됐습니다.");
      if (turnStarting || activeTurnId !== null || lifecycle.approvalCount > 0) throw new Error("새 실행 또는 승인 요청이 생겨 프로젝트 전환을 취소했습니다.");
      // 위 검사부터 선택 확정까지 await 없는 커밋.
      nativeTiming.cancel();
      clientToken++;
      rpc = null;
      connecting = null;
      const previousChild = childProcess;
      childProcess = null;
      options.ownership.release(options.id);
      title = "새 대화";
      failed = false;
      workspace = actual;
      selectionEpoch++;
      activeThreadId = null;
      activeTurnId = null;
      lifecycle.reset();
      threadStarted = false;
      eventLog.splice(0);
      endedTurns.clear();
      latestActivityRequests.clear();
      if (previousChild) void terminateChild(previousChild);
      projectRegistrationError = null;
      nativeReports = options.reportHarness(actual);
      const result = { workspace: workspaceInfo(), threadId: null, events: [...eventLog], resources: null, resourceStorageWarnings: flushed.failedScopes };
      return result;
    } finally { threadTransition = null; if (isCurrent(expected) || selectionEpoch === expected.selectionEpoch + 1) switchingConversation = false; }
  }

  handle("dashboard:get", async (_event, expected: unknown) => {
    assertSelection(expected);
    const registered = await projects.list();
    assertSelection(expected);
    const result = await readDashboard([
      { key: "www", name: "WWW", path: options.wwwRoot, kind: "www" },
      ...registered.filter(project => project.path !== options.wwwRoot).map(project => ({ key: project.workspaceKey, name: project.name, path: project.path, kind: "rpa" as const })),
    ]);
    assertSelection(expected);
    return result;
  });
  handle("projects:www", async (_event, expected: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    return switchWorkspace(expected, options.wwwRoot);
  });
  const reports = createReportService({ workspace: () => reportRepository ?? workspace });
  nativeReports = options.reportHarness(workspace);
  handle("reports:native-status", async () => ({ enabled: options.reports.enabled, jobs: await options.reportHarness(reportRepository ?? workspace).list(reportRepository ?? workspace) }));
  handle("reports:native-enabled", (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") throw new Error("자동 보고서 설정은 boolean이어야 합니다.");
    options.reports.enabled = enabled;
    return enabled;
  });
  handle("reports:native-retry", (_event, key: unknown) => {
    if (typeof key !== "string" || !/^[a-f0-9]{64}$/.test(key)) throw new Error("자동 보고서 작업 ID가 올바르지 않습니다.");
    return options.reportHarness(reportRepository ?? workspace).retry(reportRepository ?? workspace, key);
  });
  handle("reports:list", () => reports.list());
  handle("reports:read", (_event, reportId: unknown) => reports.read(reportId));
  handle("reports:choose", async () => {
    const path = await options.chooseDirectory("보고서를 읽을 프로젝트 선택", false);
    if (!path) return false;
    reportRepository = resolve(path);
    return true;
  });
  handle("reports:export", async (_event, reportId: unknown) => {
    const document = await reports.read(reportId);
    return options.exportReport(document);
  });
  const development = createDevelopmentService({ policyRoot: options.dist, workspace: () => workspace });
  handle("development:policy", () => development.policy());
  handle("development:status", (_event, workId: unknown) => development.status(workId));
  handle("development:complete", (_event, workId: unknown) => development.complete(workId));
  handle("link:open", async (_event, value: unknown) => {
    if (typeof value !== "string" || value.length > 8192) throw new Error("외부 링크가 올바르지 않습니다.");
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("웹 링크만 열 수 있습니다.");
    await options.openExternal(url.href);
  });
  handle("conversations:list", async (_event, expected: unknown, cursor: unknown) => {
    assertSelection(expected);
    const root = workspace;
    const client = await connect();
    assertSelection(expected);
    const result = await createConversationService(client, root).list(cursor);
    assertSelection(expected);
    return result;
  });
  handle("conversations:open", async (_event, expected: unknown, value: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    const reservation = options.ownership.reserve(options.id, selection().workspaceKey, requiredString(value, "thread ID"));
    switchingConversation = true;
    beginThreadTransition("open", requiredString(value, "thread ID"));
    try {
      await drainResources();
      assertSelection(expected);
      const client = await connect();
      assertSelection(expected);
      const restored = await lifecycle.open(client, workspace, value, () => isCurrent(expected) && rpc === client);
      assertSelection(expected);
      if (rpc !== client) throw new Error("Native 연결이 종료됐습니다.");
      assertThreadTransition();
      nativeTiming.cancel();
      selectionEpoch++;
      reservation.commit();
      const restoredPrompt = optionalRecord(restored.events.find(event => event.method === "turn/userPrompt")?.params);
      title = typeof restoredPrompt?.text === "string" ? restoredPrompt.text.slice(0, 40) : "저장 대화";
      activeThreadId = restored.threadId;
      activeTurnId = null;
      threadStarted = true;
      const messages = threadTransition?.messages ?? [];
      threadTransition = null;
      replaceConversationEvents([
        { kind: "transport", method: "transport/status", params: { state: "connected", connectionGeneration }, historical: true },
        { kind: "notification", method: "thread/configured", params: { threadId: restored.threadId, model: restored.model, modelProvider: restored.provider, approvalPolicy: restored.approvalPolicy, sandbox: restored.sandbox, isNew: false }, historical: true },
        ...restored.events
      ]);
      for (const message of messages) nativeMessageHandler?.(message);
      void loadSkills(client);
      void loadHooks(client, restored.threadId);
      const resources = await currentResources(selection()).catch((error: unknown) => {
        publish({ kind: "notification", method: "activity/resourcesUnavailable", params: { threadId: restored.threadId, message: String(error) } });
        return null;
      });
      return { workspace: workspaceInfo(), threadId: restored.threadId, events: [...eventLog], resources };
    } finally { threadTransition = null; reservation.rollback(); switchingConversation = false; }
  });
  handle("conversations:new", async (_event, expected: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    switchingConversation = true;
    beginThreadTransition("clear");
    try {
      await drainResources();
      assertSelection(expected);
      options.ownership.release(options.id);
      title = "새 대화";
      failed = false;
      nativeTiming.cancel();
      selectionEpoch++;
      activeThreadId = null;
      activeTurnId = null;
      lifecycle.reset();
      threadStarted = false;
      threadTransition = null;
      replaceConversationEvents([
        { kind: "notification", method: "conversation/restored", params: { threadId: null, complete: true }, historical: true },
        { kind: "transport", method: "transport/status", params: { state: rpc ? "connected" : "closed", connectionGeneration }, historical: true }
      ]);
      return { workspace: workspaceInfo(), threadId: null, events: [...eventLog], resources: null };
    } finally { threadTransition = null; switchingConversation = false; }
  });
  handle("workspace:get", () => workspaceInfo());
  handle("activity:refresh", (_event, expected: unknown) => { assertSelection(expected); return refreshActivityInventory(); });
  handle("activity:resources", (_event, expected: unknown) => { assertSelection(expected); return currentResources(expected); });
  handle("projects:list", async (_event, expected: unknown) => {
    assertSelection(expected);
    if (projectRegistrationError) {
      const root = workspace;
      try { await projects.register(root); } catch (cause) { throw new Error(`현재 프로젝트 등록·저장 실패: ${projectRegistrationError}`, { cause }); }
      assertSelection(expected);
      projectRegistrationError = null;
    }
    const result = await projects.list(); assertSelection(expected); return result;
  });
  handle("projects:favorite", async (_event, expected: unknown, key: unknown, favorite: unknown) => {
    assertSelection(expected);
    if (typeof key !== "string" || typeof favorite !== "boolean") throw new Error("프로젝트 즐겨찾기 값이 올바르지 않습니다.");
    await projects.setFavorite(key, favorite); assertSelection(expected);
  });
  handle("projects:switch", async (_event, expected: unknown, key: unknown) => {
    assertSelection(expected); assertConversationIdle();
    const list = await projects.list(); assertSelection(expected);
    const project = list.find((item) => item.workspaceKey === key);
    if (!project) throw new Error("등록된 프로젝트가 없습니다.");
    return switchWorkspace(expected, project.path);
  });
  handle("workspace:choose", async (_event, expected: unknown) => {
    assertSelection(expected); assertConversationIdle();
    const path = await options.chooseDirectory("프로젝트 폴더 선택", true);
    assertSelection(expected);
    if (!path) return null;
    return switchWorkspace(expected, path);
  });
  handle("thread:start", async (_event, expected: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    if (activeThreadId !== null) throw new Error("새 스레드를 시작하기 전에 새 대화를 선택해 주세요.");
    const trace = nativeTiming.begin(null, () => isCurrent(expected));
    switchingConversation = true;
    beginThreadTransition("start");
    try {
      const client   = await connect(trace)                                                             ;
      assertSelection(expected);
      trace.mark("thread/start", "started");
      const result   = record(await client.request("thread/start", nativeThreadStartParams(workspace))) ;
      const threadId = requiredString(record(result.thread).id, "thread ID")                            ;
      assertSelection(expected);
      if (rpc !== client) throw new Error("Native 연결이 종료됐습니다.");
      assertThreadTransition();
      trace.setThread(threadId);
      trace.mark("thread/start", "completed");
      const reservation = options.ownership.reserve(options.id, selection().workspaceKey, threadId);
      reservation.commit();
      lifecycle.markReady(client, workspace, threadId);
      threadStarted = true;
      activeThreadId = threadId;
      finishThreadTransition();
      void currentResources(expected).catch((error: unknown) => {
        console.warn(error);
        if (isCurrent(expected)) publish({ kind: "notification", method: "activity/resourcesUnavailable", params: { threadId, message: String(error) } });
      });
      publish({ kind: "notification", method: "thread/configured", params: { threadId, model: typeof result.model === "string" ? result.model : null, modelProvider: typeof result.modelProvider === "string" ? result.modelProvider : null, approvalPolicy: typeof result.approvalPolicy === "string" ? result.approvalPolicy : null, sandbox: result.sandbox && typeof result.sandbox === "object" && "type" in result.sandbox && typeof result.sandbox.type === "string" ? result.sandbox.type : null, isNew: true } });
      void loadHooks(client, threadId);
      return { threadId };
    } catch (error) { trace.cancel("failed"); throw error; }
    finally { threadTransition = null; switchingConversation = false; }
  });
  handle("turn:start", async (_event, expected: unknown, threadId: unknown, text: unknown) => {
    assertSelection(expected);
    const validThreadId = requiredString(threadId, "thread ID");
    assertSelection(expected);
    assertConversationIdle();
    if (validThreadId !== activeThreadId) throw new Error("현재 선택한 대화에만 요청을 보낼 수 있습니다.");
    if (typeof text !== "string" || !text.trim() || text.length > 100_000) throw new Error("Invalid prompt");
    const prompt          = text.trim () ;
    const clientRequestId = randomUUID() ;
    const trace = nativeTiming.forTurn(validThreadId, () => isCurrent(expected));
    turnStarting = true;
    endedTurns.clear();
    let startedClient: JsonRpcClient | null = null;
    let promptPublished = false;
    try {
      const root = workspace;
      const result = record(await lifecycle.start({
        connect: async () => { const client = await connect(trace); startedClient = client; return client; },
        valid: (client) => isCurrent(expected) && rpc === client && workspace === root && activeThreadId === validThreadId,
        cwd: root, threadId: validThreadId, prompt,
        requestBoundary: (method, status) => {
          if (method === "thread/read" || method === "thread/resume" || method === "thread/turns/list" || method === "turn/start") trace.mark(method, status);
        },
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
          trace.arm();
          promptPublished = true;
          publish({ kind: "notification", method: "turn/userPrompt", params: { clientRequestId, threadId: validThreadId, text: prompt } });
        }
      }));
      assertSelection(expected);
      if (rpc !== startedClient) throw new Error("Native 연결이 종료됐습니다.");
      const turnId = requiredString(record(result.turn).id, "turn ID"                                                          ) ;
      trace.bindTurn(turnId);
      trace.mark("request", "completed");
      if (!endedTurns.has(`${validThreadId}:${turnId}`)) activeTurnId = turnId;
      publish({ kind: "notification", method: "turn/startAccepted", params: { clientRequestId, threadId: validThreadId, turnId } });
      return { turnId };
    } catch (error) {
      trace.cancel("failed");
      assertSelection(expected);
      if (promptPublished && rpc === startedClient) publish({ kind: "notification", method: "turn/startFailed", params: { clientRequestId, threadId: validThreadId, message: String(error) } });
      throw error;
    } finally { if (isCurrent(expected)) turnStarting = false; }
  });
  handle("turn:interrupt", async (_event, expected: unknown, threadId: unknown, turnId: unknown) => {
    assertSelection(expected);
    requiredString(threadId, "thread ID"); requiredString(turnId, "turn ID");
    if (threadId !== activeThreadId || turnId !== activeTurnId) throw new Error("현재 실행 중인 턴만 중단할 수 있습니다.");
    nativeTiming.cancel();
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
  handle("approval:respond", async (_event, expected: unknown, requestId: unknown, decision: unknown, approvalToken: unknown) => {
    assertSelection(expected);
    validId(requestId);
    if (typeof decision !== "string" || !DECISIONS.has(decision)) throw new Error("Unsupported approval decision");
    const scopedToken = requiredString(approvalToken, "approval token");
    const prefix = `${options.id}:`;
    if (!scopedToken.startsWith(prefix)) throw new Error("다른 대화 탭의 승인 요청입니다.");
    const token = scopedToken.slice(prefix.length);
    const client = rpc;
    await lifecycle.respond(client, requestId, decision, token, () => isCurrent(expected) && rpc === client);
  });
  handle("events:get", (_event, expected: unknown) => { assertSelection(expected); return [...eventLog]; });

  return {
    id: options.id,
    summary,
    workspaceInfo,
    cloneContext() {
      if (stopping) throw new Error("대화 탭을 닫고 있습니다.");
      return { workspace, registrationError: projectRegistrationError };
    },
    assertSelection(value: unknown): void { assertSelection(value); },
    readReport: reports.read,
    assertClosable() {
      if (stopping) throw new Error("대화 탭을 닫고 있습니다.");
      if (turnStarting || activeTurnId !== null || switchingConversation || lifecycle.approvalCount > 0) throw new Error("실행 또는 승인 요청이 남아 있습니다. 중단하고 승인 요청을 처리한 뒤 탭을 닫아 주세요.");
    },
    async invoke(channel: string, args: unknown[]): Promise<unknown> {
      if (stopping) throw new Error("대화 탭을 닫고 있습니다.");
      const handler = handlers.get(channel);
      if (!handler) throw new Error("지원하지 않는 세션 요청입니다.");
      try {
        const pending = handler(undefined, ...args);
        options.onChanged();
        return await pending;
      } finally { options.onChanged(); }
    },
    acceptResourceSnapshot(snapshot: ResourceSnapshot): void {
      if (!stopping && snapshot.processEpoch === processEpoch && snapshot.selectionEpoch === selectionEpoch && snapshot.scope.workspaceKey === selection().workspaceKey && snapshot.scope.threadId === activeThreadId) options.onResources({ ...snapshot, sessionId: options.id });
    },
    reportState(root: string, job: NativeReportJob): void {
      const expected = reportSelections.get(JSON.stringify([root, job.threadId, job.turnId]));
      if (expected && workspace === root && isCurrent(expected) && activeThreadId === job.threadId) publish({ kind: "notification", method: "reports/autoState", params: job });
    },
    stop(): Promise<void> {
      if (stopPromise) return stopPromise;
      stopping = true;
      nativeTiming.cancel();
      clientToken++;
      rpc = null;
      connecting = null;
      childProcess = null;
      stopPromise = Promise.allSettled([...nativeChildren].map(terminateChild).concat([...childStops.values()])).then(() => Promise.allSettled([...collections])).then(() => undefined);
      return stopPromise;
    }
  };
}
