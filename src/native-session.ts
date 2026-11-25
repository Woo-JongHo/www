/**
 * Native 연결·선택·실행·승인 상태를 대화 탭마다 소유한다.
 * @architecture arch.native.lifecycle
 * @implements RESP-NATIVE-LIFECYCLE
 */
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { JsonRpcClient, RpcClosedError, type RpcMessage } from "./rpc";
import { createConversationService, type ConversationEvent } from "./conversations";
import { createDevelopmentService } from "./development";
import { createReportService } from "./reports-service";
import type { createNativeReportHarness } from "./native-reports";
import { NativeCompletionCollector } from "./native-report-input";
import { resolveNativeCodex } from "./native-command";
import { nativeThreadStartParams, nativeTurnSteerParams, validateChatImage, WWW_HARNESS_TOOL, WWW_PLAN_TOOL, WWW_STAGE_TOOL } from "./native-chat";
import { parseWwwDevelopmentStage, parseWwwHarnessAttempt, parseWwwPlanLink, requestedWwwPlanWorkIds } from "./www-activity";
import { createNativeLifecycle, createRestoredMessageFilter } from "./native-lifecycle";
import { createNativeTiming } from "./native-timing";
import { parseHooksListResponse, parseSkillsListResponse } from "./activity-sidebar";
import type { ActivityLedger } from "./activity-ledger";
import { createProjectRegistry } from "./projects";
import { readDashboard, readDashboardPlan, readDashboardWork } from "./dashboard";
import { readRpaStandard } from "./rpa-standard";
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
  compactionTimeoutMs?: number;
  registrationError?: string | null;
  workspaceMetadata?(workspace: string): { branch: string | null; changes: number };
}

const COMPACTION_TIMEOUT_MESSAGE = "압축 결과를 확인할 수 없습니다. 같은 대화를 다시 열어 주세요.";

interface CompactTurn {
  id: string | null;
  itemCompleted: boolean;
  timedOut: boolean;
  timeout: ReturnType<typeof setTimeout>;
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
  let metadata: { path: string; branch: string | null; changes: number; hasRpaProfile: boolean } | null = null;

  let rpc    : JsonRpcClient | null = null  ;
  let threadStarted                 = false ;
  let connecting : Promise<JsonRpcClient> | null = null;
  let activeThreadId : string | null = null;
  let activeTurnId   : string | null = null;
  let interruptingTurn: string | null = null;
  let steering = false;
  const steerIds = new Set<string>();
  let turnStarting                  = false;
  let switchingConversation         = false;
  type ThreadTransition = { kind: "open" | "start" | "clear" | "reconnect"; candidate: string | null; previous: string | null; selection: SelectionRef; client: JsonRpcClient | null; messages: RpcMessage[]; bytes: number; error: Error | null };
  let threadTransition: ThreadTransition | null = null;
  let nativeMessageHandler: ((message: RpcMessage) => void) | null = null;
  const endedTurns = new Set<string>();
  let terminalSelection: { client: JsonRpcClient; epoch: number; turns: Set<string> } | null = null;
  let uncertainSelection: { threadId: string; epoch: number } | null = null;
  let developmentBinding: { client: JsonRpcClient; root: string; threadId: string } | null = null;
  let developmentQueue = Promise.resolve();
  const developmentCalls = new Map<string, { signature: string; message: string }>();
  const developmentAttempts = new Map<string, { status: string; eventId: string | null; observed: boolean }>();
  const latestDevelopmentAttempts = new Map<string, string>();
  const declaredDevelopmentWorks = new Set<string>();
  const requestedDevelopmentWorks = new Set<string>();
  let pendingPlanSteer: Promise<void> | null = null;

  let reportRepository : string | null                                       = null ;
  let nativeReports    : ReturnType<typeof createNativeReportHarness> | null = null ;


  const nativeCompletions = new Map<string, NativeCompletionCollector>()                             ;

  let transport: NativeSessionSummary["transport"] = "disconnected";
  const pendingApprovalEvents = new Map<string, ScopedAppEvent[]>();
  let hasConversationHistory = false;
  let compaction: NativeSessionSummary["compaction"] = { state: "idle" };
  let compactTurn: CompactTurn | null = null;

  function finishCompaction(result: NativeSessionSummary["compaction"]): void {
    if (compactTurn) clearTimeout(compactTurn.timeout);
    compactTurn = null;
    compaction = result;
  }

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
    if (entry.kind === "transport" || entry.method.startsWith("approval/") || ["thread/configured", "turn/started", "turn/completed", "turn/startAccepted", "turn/startFailed", "turn/userPrompt", "turn/interruptRequested"].includes(entry.method) || entry.kind === "request") options.onChanged();
  }
  function summary(): NativeSessionSummary {
    return {
      id: options.id,
      title,
      workspace: workspaceSnapshot(),
      threadId: activeThreadId,
      busy: turnStarting || steering || activeTurnId !== null || switchingConversation || compactTurn !== null,
      approvalCount: lifecycle.approvalCount,
      failed,
      compaction,
      connectionGeneration,
      transport,
      activeTurnId,
      turnStarting,
      interrupting: interruptingTurn !== null,
      ...(pendingApprovalEvents.size ? { pendingApprovalEvents: [...pendingApprovalEvents.values()].flat() } : {}),
    };
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
  function rememberRestoredTerminals(client: JsonRpcClient, threadId: string, events: readonly ConversationEvent[]): void {
    terminalSelection = { client, epoch: selectionEpoch, turns: new Set(events.flatMap(event => {
      const params = optionalRecord(event.params);
      const turn = optionalRecord(params?.turn);
      return event.method === "turn/completed" && params?.threadId === threadId && typeof turn?.id === "string" && ["completed", "interrupted", "failed"].includes(String(turn.status)) ? [turn.id] : [];
    })) };
  }
  function beginThreadTransition(kind: ThreadTransition["kind"], candidate: string | null = null): ThreadTransition {
    threadTransition = { kind, candidate, previous: (kind === "open" || kind === "clear") && activeThreadId !== candidate ? activeThreadId : null, selection: selection(), client: rpc, messages: [], bytes: 0, error: null };
    return threadTransition;
  }
  function drainPreviousThread(transition: ThreadTransition): void {
    const previous = transition.previous;
    if (previous === null) return;
    transition.previous = null;
    if (!isCurrent(transition.selection) || activeThreadId !== previous || rpc === null || rpc !== transition.client) return;
    const messages = transition.messages.filter(message => eventThread(message.params) === previous);
    transition.messages = transition.messages.filter(message => eventThread(message.params) !== previous);
    const held = threadTransition;
    threadTransition = null;
    try {
      for (const message of messages) nativeMessageHandler?.(message);
      // 한도 초과 뒤 실제 종료 여부를 알 수 없으므로 기존 ready를 재사용하지 않는다.
      if (transition.error && isCurrent(transition.selection) && activeThreadId === previous && rpc === transition.client && rpc !== null) {
        const uncertainTurn = activeTurnId;
        activeTurnId = null;
        interruptingTurn = null;
        uncertainSelection = { threadId: previous, epoch: selectionEpoch };
        lifecycle.closed(rpc, transition.error.message, previous);
        if (uncertainTurn !== null) publish({ kind: "notification", method: "turn/completed", params: { threadId: previous, turn: { id: uncertainTurn, status: "unknown" }, message: transition.error.message } });
      }
    } finally { threadTransition = held; }
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
    const token = entry.approvalToken;
    if (token) {
      if (entry.kind === "request" && entry.supported === true) pendingApprovalEvents.set(token, [entry]);
      if (entry.method === "approval/responding") pendingApprovalEvents.get(token)?.push(entry);
      if (entry.method === "approval/responded" || entry.method === "approval/uncertain") pendingApprovalEvents.delete(token);
    }
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

  function developmentAvailable(): boolean {
    try { return realpathSync(workspace) === realpathSync(options.wwwRoot); } catch { return false; }
  }
  function publishPlanAmbiguity(turnId: string, reason?: "steer_uncertain"): void {
    publish({ kind: "notification", method: "www/planAmbiguous", params: { threadId: activeThreadId, turnId, source: "work_document", reason } });
  }
  function observeDevelopmentCall(client: JsonRpcClient, requestId: RpcId, raw: unknown): void {
    const expected = selection();
    const params = optionalRecord(raw);
    const stage = params?.tool === WWW_STAGE_TOOL.name ? parseWwwDevelopmentStage(params.arguments) : null;
    const plan = params?.tool === WWW_PLAN_TOOL.name ? parseWwwPlanLink(params.arguments) : null;
    const observation = params?.tool === WWW_HARNESS_TOOL.name ? parseWwwHarnessAttempt(params.arguments) : null;
    const binding = developmentBinding;
    const turnId = activeTurnId;
    const valid = () => isCurrent(expected) && rpc === client && developmentBinding === binding && binding?.client === client
      && binding.root === workspace && binding.threadId === activeThreadId && params?.threadId === activeThreadId
      && !!turnId && params?.turnId === turnId && activeTurnId === turnId && !endedTurns.has(`${activeThreadId}:${turnId}`);
    developmentQueue = developmentQueue.then(async () => {
      let success = false;
      let message = "관측 요청을 수용하지 않았습니다. 현재 연결·작업 UUID·공개 입력 형식을 확인하세요.";
      try {
        if (plan && pendingPlanSteer) await pendingPlanSteer;
        if (!turnId || (!stage && !plan && !observation) || !valid() || !params || (params.namespace !== undefined && params.namespace !== null)
          || typeof params.callId !== "string" || !params.callId || params.callId.length > 200) throw new Error("invalid_development_observation");
        const callKey = JSON.stringify([expected.selectionEpoch, connectionGeneration, params.callId]);
        const signature = JSON.stringify([turnId, params.tool, stage ?? plan ?? observation]);
        const priorCall = developmentCalls.get(callKey);
        if (priorCall) {
          if (priorCall.signature !== signature) throw new Error("reused_development_call");
          message = priorCall.message;
        } else if (plan) {
          const conflictingDeclaration = requestedDevelopmentWorks.size > 0
            && ![...declaredDevelopmentWorks].every(id => requestedDevelopmentWorks.has(id));
          if (requestedDevelopmentWorks.size > 1 || conflictingDeclaration) {
            publishPlanAmbiguity(turnId);
            message = "현재 턴의 작업 UUID를 하나로 정할 수 없어 계획을 연결하지 않았습니다.";
            throw new Error("ambiguous_plan_work");
          }
          if (!requestedDevelopmentWorks.has(plan.workId)) {
            message = "현재 턴에서 사용자가 /plan으로 지정한 작업 UUID가 필요합니다.";
            throw new Error("unlinked_plan_work");
          }
          const result = await readDashboardPlan({ key: expected.workspaceKey, name: "WWW", path: workspace, kind: "www" }, plan.workId, plan.sha256)
            .catch(() => ({ ...plan, path: null, status: "failed" as const, content: null }));
          if (!valid()) throw new Error("stale_plan_link");
          publish({ kind: "notification", method: "www/planLinked", params: { threadId: activeThreadId, turnId, source: "work_document", ...result } });
          message = result.status === "available" ? "현재 턴에 확인한 계획 문서 버전을 연결했습니다."
            : result.status === "changed" ? "계획 문서의 버전이 달라졌습니다. 다시 확인하세요."
            : result.status === "missing" ? "현재 작업의 계획 문서가 없습니다." : "현재 작업의 계획 문서를 읽지 못했습니다.";
        } else if (observation) {
          const workKey = JSON.stringify([activeThreadId, turnId, observation.workId]);
          const attemptKey = JSON.stringify([workKey, observation.phase, observation.attemptId]);
          const attempt = developmentAttempts.get(attemptKey);
          if (!attempt?.eventId || latestDevelopmentAttempts.get(workKey) !== attemptKey) throw new Error("unlinked_harness_attempt");
          if (!attempt.observed) {
            const receipt = await development.harnessReceipt(observation.workId, observation.phase, attempt.eventId);
            if (!valid() || !receipt || latestDevelopmentAttempts.get(workKey) !== attemptKey) throw new Error("unconfirmed_harness_execution");
            attempt.observed = true;
            publish({ kind: "notification", method: "www/harnessObserved", params: { threadId: activeThreadId, turnId, source: "workflow_receipt", ...observation, outcome: receipt.outcome, completedAt: receipt.completedAt } });
          }
          message = "같은 턴의 공식 실행 영수증을 확인했습니다. 업무 수용은 별도 판정입니다.";
        } else if (stage) {
          // main이 승인한 현재 저장소만 안전하게 읽는다. 불완전한 목록에서는 UUID 유일성을 추측하지 않는다.
          const snapshot = await readDashboard([{ key: expected.workspaceKey, name: "WWW", path: workspace, kind: "www" }]);
          const project = snapshot.projects[0];
          if (!valid() || project?.coverage !== "complete" || project.cards.filter(card => card.id === stage.workId).length !== 1) throw new Error("unlinked_development_work");
          const workKey = JSON.stringify([activeThreadId, turnId, stage.workId]);
          const attemptKey = JSON.stringify([workKey, stage.phase, stage.attemptId]);
          const prior = developmentAttempts.get(attemptKey);
          if (prior && latestDevelopmentAttempts.get(workKey) !== attemptKey) throw new Error("superseded_development_attempt");
          if (prior && !["selected", "running"].includes(prior.status) && prior.status !== stage.status) throw new Error("settled_development_attempt");
          if (prior?.status === "running" && stage.status === "selected") throw new Error("reversed_development_attempt");
          const eventId = prior?.eventId ?? (["selected", "running"].includes(stage.status) ? `www-chat-${randomUUID()}` : null);
          developmentAttempts.set(attemptKey, { status: stage.status, eventId, observed: prior?.observed ?? false });
          latestDevelopmentAttempts.set(workKey, attemptKey);
          declaredDevelopmentWorks.add(stage.workId);
          if (prior?.status !== stage.status) publish({ kind: "notification", method: "www/developmentStage", params: { threadId: activeThreadId, turnId, source: "role_declaration", ...stage } });
          message = "공개 역할 선언을 관측했습니다. 하네스 실행·검증·업무 수용은 이 선언으로 확인하지 않습니다."
            + (eventId ? ` 현재 시도 실행 ID: ${eventId}` : "");
        }
        if (!priorCall) developmentCalls.set(callKey, { signature, message });
        success = true;
      } catch { /* 거부한 입력은 관측 사건으로 게시하지 않는다. */ }
      await client.respond(requestId, { success, contentItems: [{ type: "inputText", text: message }] });
    }).catch((error: unknown) => { console.warn("단계 관측 응답 전송 실패", String(error)); });
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
    transport = "disconnected";
    const root = workspace;
    const valid = () => !stopping && token === clientToken && workspace === root;
    connectionGeneration += 1;
    transport = "disconnected";
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
        transport = "closed";
        developmentBinding = null;
        childProcess = null;
        const interruptedThread = activeTurnId !== null ? activeThreadId : null;
        activeTurnId = null;
        interruptingTurn = null;
        if (compactTurn) {
          const message = compactTurn.timedOut ? COMPACTION_TIMEOUT_MESSAGE : "연결이 종료되어 압축 결과를 확인할 수 없습니다.";
          finishCompaction({ state: "failed", message });
        }
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
        // 이 사건은 검증한 도구 요청만 main이 생산한다. Native의 동명 알림을 신뢰하지 않는다.
        if (message.method === "www/developmentStage" || message.method === "www/planLinked" || message.method === "www/planAmbiguous" || message.method === "www/harnessObserved") return;
        if (message.method === "item/tool/call" && (typeof message.id === "string" || typeof message.id === "number")) {
          observeDevelopmentCall(client, message.id, message.params);
          return;
        }
        const threadId = eventThread(message.params);
        if (threadId !== null) {
          if (threadTransition) {
            if (!threadTransition.error && (threadTransition.candidate === threadId || threadTransition.previous === threadId || threadTransition.kind === "start")) {
              if (threadTransition.client !== null && threadTransition.client !== client) {
                threadTransition.error = new Error("대화 전환 중 Native 연결이 변경됐습니다. 다시 열어 주세요.");
                return;
              }
              threadTransition.client ??= client;
              const bytes = Buffer.byteLength(JSON.stringify(message), "utf8");
              if (threadTransition.messages.length >= 2000 || threadTransition.bytes + bytes > 4 * 1024 * 1024) {
                threadTransition.error = new Error("대화 전환 중 Native 사건이 보관 한도를 넘었습니다. 다시 열어 주세요.");
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
        const completesActiveTurn = method === "turn/completed" && params?.threadId === activeThreadId
          && typeof turn?.id === "string" && turn.id === activeTurnId
          && ["completed", "interrupted", "failed"].includes(String(turn.status));
        if (method === "turn/started" && params?.threadId === activeThreadId && turn && typeof turn.id === "string") {
          if (uncertainSelection?.threadId === activeThreadId && uncertainSelection.epoch === selectionEpoch) return;
          if (terminalSelection?.client === client && terminalSelection.epoch === selectionEpoch && terminalSelection.turns.has(turn.id)) return;
          activeTurnId = turn.id;
          if (compactTurn && compactTurn.id === null) {
            compactTurn.id = turn.id;
            compaction = { state: "running" };
            if (!compactTurn.timedOut) compactTurn.timeout.refresh();
          }
        }
        const item = optionalRecord(params?.item);
        if (method === "item/completed" && item?.type === "contextCompaction" && params?.threadId === activeThreadId
          && typeof params.turnId === "string" && compactTurn && compactTurn.id === params.turnId) {
          compactTurn.itemCompleted = true;
          if (!compactTurn.timedOut) compactTurn.timeout.refresh();
        }
        if (method === "turn/completed" && params && turn && typeof turn.id === "string") {
          endedTurns.add(`${String(params.threadId)}:${turn.id}`);
          if (params.threadId === activeThreadId && ["completed", "interrupted", "failed"].includes(String(turn.status))) {
            if (terminalSelection?.client !== client || terminalSelection.epoch !== selectionEpoch) terminalSelection = { client, epoch: selectionEpoch, turns: new Set() };
            terminalSelection.turns.add(turn.id);
          }
          if (params.threadId === activeThreadId && activeTurnId === turn.id) activeTurnId = null;
          if (params.threadId === activeThreadId && interruptingTurn === turn.id) interruptingTurn = null;
          if (params.threadId === activeThreadId && compactTurn?.id === turn.id) {
            finishCompaction(turn.status === "completed" && compactTurn.itemCompleted
              ? { state: "completed" }
              : { state: "failed", message: "대화 압축을 완료했다는 확인을 받지 못했습니다." });
          }
        }
        if (typeof id === "string" || typeof id === "number") {
          const supported = SUPPORTED.has(method);
          const token = supported ? lifecycle.approval(client, id, params?.threadId) : null;
          publish({ kind: "request", method, params: message.params, requestId: id, ...(token === null ? {} : { approvalToken: token }), supported: token !== null });
        } else publish({
          kind: "notification",
          method,
          params: method === "account/rateLimits/updated" ? rateLimitPayload(message.params) : message.params,
          ...(completesActiveTurn ? { completedActiveTurn: true as const } : {}),
        });
        if (method === "serverRequest/resolved") lifecycle.resolved(client, message.params);
        if (method === "skills/changed") void loadSkills(client, true);
      };
      nativeMessageHandler = receiveMessage;
      client.on("message", receiveMessage);
      trace?.mark("initialize", "started");
      void client.request("initialize", { clientInfo: { name: "www", title: "WWW", version: options.appVersion }, capabilities: { experimentalApi: developmentAvailable() } })
        .then(() => {
          if (!valid()) { void terminateChild(child); throw new Error("이전 프로젝트 연결 취소"); }
          client.notify("initialized", {});
          trace?.mark("initialize", "completed");
          rpc = client;
          transport = "connected";
          settled = true;
          publish({ kind: "transport", method: "transport/connected", params: { connectionGeneration } });
          resolveClient(client);
          void loadRateLimits(client);
        })
        .catch((error: unknown) => {
          trace?.mark("initialize", "failed");
          settled = true;
          if (valid()) {
            clientToken++;
            rpc = null;
            transport = "error";
            childProcess = null;
            void terminateChild(child);
            options.onChanged();
          }
          reject(error);
        });
    }).finally(() => { if (connecting === pending) connecting = null; });
    connecting = pending;
    return pending;
  }

  function assertConversationIdle(): void {
    if (switchingConversation) throw new Error("대화를 전환하고 있습니다. 잠시 기다려 주세요.");
    if (compactTurn) throw new Error("대화 압축이 끝난 뒤 다시 시도해 주세요.");
    if (turnStarting || steering || activeTurnId !== null || lifecycle.approvalCount > 0) throw new Error("실행 또는 승인 요청이 끝난 뒤 대화를 전환할 수 있습니다.");
  }

  function replaceConversationEvents(records: readonly ConversationEvent[]): ScopedAppEvent[] {
    eventLog.splice(0);
    for (const value of records) { const entry = wire(value); collectResources(entry); eventLog.push(entry); }
    if (eventLog.length > 2000) eventLog.splice(0, eventLog.length - 2000);
    return [...eventLog];
  }

  function workspaceSnapshot(): WorkspaceSelection {
    const current = metadata?.path === workspace ? metadata : null;
    return { ...selection(), name: basename(workspace), path: workspace, branch: current?.branch ?? null, changes: current?.changes ?? 0, hasRpaProfile: current?.hasRpaProfile ?? false };
  }
  function workspaceInfo(): WorkspaceSelection {
    const hasRpaProfile = workspace !== options.wwwRoot && existsSync(join(workspace, "rpa-workspace.json"));
    if (options.workspaceMetadata) metadata = { path: workspace, ...options.workspaceMetadata(workspace), hasRpaProfile };
    else {
      const git = (args: string[]) => { try { return execFileSync("git", args, { cwd: workspace, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
      metadata = { path: workspace, branch: git(["branch", "--show-current"]) || null, changes: git(["status", "--porcelain"]).split("\n").filter(Boolean).length, hasRpaProfile };
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
      const { primary, secondary, ...metadata } = limit;
      const window = (input: unknown): Record<string, unknown> | null | undefined => input === null ? null : pick(input, ["usedPercent", "windowDurationMins", "resetsAt"]) ?? undefined;
      const primaryWindow = window(primary);
      const secondaryWindow = window(secondary);
      return { ...metadata, ...(primaryWindow === undefined ? {} : { primary: primaryWindow }), ...(secondaryWindow === undefined ? {} : { secondary: secondaryWindow }) };
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
    const transition = beginThreadTransition("clear");
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
      drainPreviousThread(transition);
      assertThreadTransition();
      if (turnStarting || activeTurnId !== null || lifecycle.approvalCount > 0) throw new Error("새 실행 또는 승인 요청이 생겨 프로젝트 전환을 취소했습니다.");
      // 위 검사부터 선택 확정까지 await 없는 커밋.
      nativeTiming.cancel();
      clientToken++;
      rpc = null;
      transport = "disconnected";
      connecting = null;
      const previousChild = childProcess;
      childProcess = null;
      options.ownership.release(options.id);
      title = "새 대화";
      failed = false;
      workspace = actual;
      selectionEpoch++;
      pendingApprovalEvents.clear();
      activeThreadId = null;
      activeTurnId = null;
      hasConversationHistory = false;
      compaction = { state: "idle" };
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
    } finally { drainPreviousThread(transition); threadTransition = null; if (isCurrent(expected) || selectionEpoch === expected.selectionEpoch + 1) switchingConversation = false; }
  }

  handle("rpa:standard", async (_event, expected: unknown) => {
    assertSelection(expected);
    const root = workspace;
    const registered = await projects.list();
    assertSelection(expected);
    if (root === options.wwwRoot || !registered.some(project => project.path === root)) return null;
    const result = await readRpaStandard(root);
    assertSelection(expected);
    return result;
  });
  handle("dashboard:get", async (_event, expected: unknown, detail: unknown) => {
    assertSelection(expected);
    if (detail !== undefined && (detail === null || typeof detail !== "object" || Array.isArray(detail)
      || Object.keys(detail).sort().join(",") !== "projectKey,workId"
      || typeof (detail as Record<string, unknown>).projectKey !== "string"
      || typeof (detail as Record<string, unknown>).workId !== "string")) throw new Error("작업 식별자가 올바르지 않습니다.");
    const registered = await projects.list();
    assertSelection(expected);
    const approvedProjects = [
      { key: "www", name: "WWW", path: options.wwwRoot, kind: "www" as const },
      ...registered.filter(project => project.path !== options.wwwRoot).map(project => ({ key: project.workspaceKey, name: project.name, path: project.path, kind: "rpa" as const })),
    ];
    const result = detail === undefined ? await readDashboard(approvedProjects)
      : await readDashboardWork(approvedProjects, (detail as { projectKey: string }).projectKey, (detail as { workId: string }).workId);
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
    const transition = beginThreadTransition("open", requiredString(value, "thread ID"));
    try {
      await drainResources();
      assertSelection(expected);
      const client = await connect();
      assertSelection(expected);
      const root = workspace;
      if (transition.client !== null && transition.client !== client) throw new Error("대화 전환 중 Native 연결이 변경됐습니다. 다시 열어 주세요.");
      transition.client = client;
      const restored = await lifecycle.open(client, root, value, () => isCurrent(expected) && rpc === client && workspace === root);
      assertSelection(expected);
      if (rpc !== client) throw new Error("Native 연결이 종료됐습니다.");
      drainPreviousThread(transition);
      assertSelection(expected);
      if (rpc !== client) throw new Error("Native 연결이 종료됐습니다.");
      assertThreadTransition();
      if (turnStarting || steering || activeTurnId !== null || lifecycle.approvalCount > 0 || interruptingTurn !== null) throw new Error("새 실행 또는 승인 요청이 생겨 대화 전환을 취소했습니다.");
      nativeTiming.cancel();
      selectionEpoch++;
      pendingApprovalEvents.clear();
      reservation.commit();
      const restoredPrompt = optionalRecord(restored.events.find(event => event.method === "turn/userPrompt")?.params);
      title = typeof restoredPrompt?.text === "string" ? restoredPrompt.text.slice(0, 40) : "저장 대화";
      activeThreadId = restored.threadId;
      hasConversationHistory = restored.events.some(event => event.method === "turn/completed");
      compaction = { state: "idle" };
      developmentBinding = null;
      activeTurnId = null;
      threadStarted = true;
      const acceptedSelection = selection();
      const messages = threadTransition?.messages ?? [];
      threadTransition = null;
      const covered = createRestoredMessageFilter(restored.events);
      uncertainSelection = null;
      rememberRestoredTerminals(client, restored.threadId, restored.events);
      replaceConversationEvents([
        { kind: "transport", method: "transport/status", params: { state: "connected", connectionGeneration }, historical: true },
        { kind: "notification", method: "thread/configured", params: { threadId: restored.threadId, model: restored.model, modelProvider: restored.provider, approvalPolicy: restored.approvalPolicy, sandbox: restored.sandbox, isNew: false, developmentStage: "resume_unavailable" }, historical: true },
        ...restored.events
      ]);
      for (const message of messages) if (!covered(message)) nativeMessageHandler?.(message);
      restored.accept(() => isCurrent(acceptedSelection) && rpc === client && workspace === root && activeThreadId === restored.threadId);
      void loadSkills(client);
      void loadHooks(client, restored.threadId);
      const resources = await currentResources(selection()).catch((error: unknown) => {
        publish({ kind: "notification", method: "activity/resourcesUnavailable", params: { threadId: restored.threadId, message: String(error) } });
        return null;
      });
      return { workspace: workspaceInfo(), threadId: restored.threadId, events: [...eventLog], resources };
    } finally { drainPreviousThread(transition); threadTransition = null; reservation.rollback(); switchingConversation = false; }
  });
  handle("conversations:new", async (_event, expected: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    switchingConversation = true;
    const transition = beginThreadTransition("clear");
    try {
      await drainResources();
      assertSelection(expected);
      drainPreviousThread(transition);
      assertThreadTransition();
      if (turnStarting || activeTurnId !== null || lifecycle.approvalCount > 0) throw new Error("새 실행 또는 승인 요청이 생겨 대화 해제를 취소했습니다.");
      options.ownership.release(options.id);
      title = "새 대화";
      failed = false;
      nativeTiming.cancel();
      selectionEpoch++;
      pendingApprovalEvents.clear();
      activeThreadId = null;
      activeTurnId = null;
      hasConversationHistory = false;
      compaction = { state: "idle" };
      lifecycle.reset();
      threadStarted = false;
      threadTransition = null;
      replaceConversationEvents([
        { kind: "notification", method: "conversation/restored", params: { threadId: null, complete: true }, historical: true },
        { kind: "transport", method: "transport/status", params: { state: rpc ? "connected" : "closed", connectionGeneration }, historical: true }
      ]);
      return { workspace: workspaceInfo(), threadId: null, events: [...eventLog], resources: null };
    } finally { drainPreviousThread(transition); threadTransition = null; switchingConversation = false; }
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
    const selected = realpathSync(path);
    if (selected === workspace) return null;
    return switchWorkspace(expected, selected);
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
      const stageAvailable = developmentAvailable();
      const result   = record(await client.request("thread/start", nativeThreadStartParams(workspace, stageAvailable))) ;
      const responseElapsedMs = trace.elapsed();
      const threadId = requiredString(record(result.thread).id, "thread ID")                            ;
      assertSelection(expected);
      if (rpc !== client) throw new Error("Native 연결이 종료됐습니다.");
      assertThreadTransition();
      trace.setThread(threadId);
      const reservation = options.ownership.reserve(options.id, selection().workspaceKey, threadId);
      reservation.commit();
      lifecycle.markReady(client, workspace, threadId);
      threadStarted = true;
      activeThreadId = threadId;
      developmentBinding = stageAvailable ? { client, root: workspace, threadId } : null;
      developmentCalls.clear();
      developmentAttempts.clear();
      latestDevelopmentAttempts.clear();
      declaredDevelopmentWorks.clear();
      requestedDevelopmentWorks.clear();
      finishThreadTransition();
      void currentResources(expected).catch((error: unknown) => {
        console.warn(error);
        if (isCurrent(expected)) publish({ kind: "notification", method: "activity/resourcesUnavailable", params: { threadId, message: String(error) } });
      });
      publish({ kind: "notification", method: "thread/configured", params: { threadId, model: typeof result.model === "string" ? result.model : null, modelProvider: typeof result.modelProvider === "string" ? result.modelProvider : null, approvalPolicy: typeof result.approvalPolicy === "string" ? result.approvalPolicy : null, sandbox: result.sandbox && typeof result.sandbox === "object" && "type" in result.sandbox && typeof result.sandbox.type === "string" ? result.sandbox.type : null, isNew: true, developmentStage: stageAvailable ? "available" : "other_workspace" } });
      trace.mark("thread/start", "completed", responseElapsedMs);
      void loadHooks(client, threadId);
      return { threadId };
    } catch (error) { trace.cancel("failed"); throw error; }
    finally { threadTransition = null; switchingConversation = false; }
  });
  handle("models:list", async (_event, expected: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    const client = await connect();
    const models = new Map<string, { model: string; displayName: string; isDefault: boolean }>();
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      assertSelection(expected);
      const page = record(await client.request("model/list", { cursor, limit: 100, includeHidden: false }));
      assertSelection(expected);
      if (rpc !== client || !Array.isArray(page.data)) throw new Error("현재 연결의 모델 목록을 확인할 수 없습니다.");
      for (const raw of page.data) {
        const item = optionalRecord(raw);
        if (typeof item?.model !== "string" || !item.model || typeof item.displayName !== "string" || item.hidden === true) continue;
        models.set(item.model, { model: item.model, displayName: item.displayName, isDefault: item.isDefault === true });
      }
      cursor = typeof page.nextCursor === "string" && page.nextCursor ? page.nextCursor : null;
      if (cursor) {
        if (seen.has(cursor) || seen.size >= 20) throw new Error("모델 목록의 페이지를 모두 확인할 수 없습니다.");
        seen.add(cursor);
      }
    } while (cursor);
    return [...models.values()];
  });

  handle("thread:compact", async (_event, expected: unknown, threadId: unknown) => {
    assertSelection(expected);
    assertConversationIdle();
    const thread = requiredString(threadId, "thread ID");
    if (thread !== activeThreadId || !hasConversationHistory) throw new Error("압축할 이력이 있는 대화를 먼저 열어 주세요.");
    const client = rpc;
    const child = childProcess;
    if (!client || !child || !lifecycle.isReady(client, workspace, thread)) throw new Error("Native 연결을 확인할 수 없습니다. 대화를 다시 열어 주세요.");
    const pending: CompactTurn = { id: null, itemCompleted: false, timedOut: false, timeout: setTimeout(() => {
      if (compactTurn !== pending || rpc !== client || childProcess !== child) return;
      pending.timedOut = true;
      // 종료가 확인될 때까지 같은 대화의 새 요청을 막는다.
      void terminateChild(child);
    }, options.compactionTimeoutMs ?? 120_000) };
    compactTurn = pending;
    compaction = { state: "pending" };
    options.onChanged();
    try {
      await client.request("thread/compact/start", { threadId: thread });
      assertSelection(expected);
      if (rpc !== client) throw new Error("연결이 종료되어 압축 결과를 확인할 수 없습니다.");
      if (compactTurn === pending && !pending.timedOut) pending.timeout.refresh();
    } catch (error) {
      if (pending.timedOut) throw new Error(COMPACTION_TIMEOUT_MESSAGE);
      if (compactTurn === pending) {
        finishCompaction({ state: "failed", message: error instanceof Error ? error.message : String(error) });
        options.onChanged();
      }
      throw error;
    }
  });

  handle("turn:start", async (_event, expected: unknown, threadId: unknown, text: unknown, model: unknown, image: unknown) => {
    assertSelection(expected);
    const validThreadId = requiredString(threadId, "thread ID");
    assertSelection(expected);
    assertConversationIdle();
    if (validThreadId !== activeThreadId) throw new Error("현재 선택한 대화에만 요청을 보낼 수 있습니다.");
    const chatImage = validateChatImage(image);
    if (typeof text !== "string" || (!text.trim() && !chatImage) || text.length > 100_000) throw new Error("Invalid prompt");
    if (model !== undefined && (typeof model !== "string" || !model.trim() || model.length > 200)) throw new Error("유효한 모델을 선택해 주세요.");
    const prompt          = text.trim () ;
    const clientRequestId = randomUUID() ;
    const trace = nativeTiming.forTurn(validThreadId, () => isCurrent(expected));
    turnStarting = true;
    compaction = { state: "idle" };
    endedTurns.clear();
    developmentCalls.clear();
    developmentAttempts.clear();
    latestDevelopmentAttempts.clear();
    declaredDevelopmentWorks.clear();
    requestedDevelopmentWorks.clear();
    for (const workId of requestedWwwPlanWorkIds(prompt)) requestedDevelopmentWorks.add(workId);
    let startedClient: JsonRpcClient | null = null;
    let reconnectTransition: ThreadTransition | null = null;
    let promptPublished = false;
    try {
      const root = workspace;
      const result = record(await lifecycle.start({
        connect: async () => {
          beginThreadTransition("reconnect", validThreadId);
          reconnectTransition = threadTransition;
          const client = await connect(trace);
          startedClient = client;
          return client;
        },
        valid: (client) => isCurrent(expected) && rpc === client && workspace === root && activeThreadId === validThreadId,
        cwd: root, threadId: validThreadId, prompt, ...(typeof model === "string" ? { model } : {}), ...(chatImage ? { image: chatImage } : {}),
        requestBoundary: (method, status) => {
          if (method === "thread/read" || method === "thread/resume" || method === "thread/turns/list" || method === "turn/start") trace.mark(method, status);
        },
        restored: (restored) => {
          assertThreadTransition();
          const messages = threadTransition?.messages ?? [];
          threadTransition = null;
          const covered = createRestoredMessageFilter(restored.events);
          if (startedClient) rememberRestoredTerminals(startedClient, restored.threadId, restored.events);
          developmentBinding = null;
          const events = replaceConversationEvents([
            { kind: "transport", method: "transport/status", params: { state: "connected", connectionGeneration }, historical: true },
            { kind: "notification", method: "thread/configured", params: { threadId: restored.threadId, model: restored.model, modelProvider: restored.provider, approvalPolicy: restored.approvalPolicy, sandbox: restored.sandbox, isNew: false, developmentStage: "resume_unavailable" }, historical: true },
            ...restored.events
          ]);
          // renderer는 이 snapshot을 교체 적용해야 한다. 과거 userPrompt를 append하면 중복된다.
          publish({ kind: "notification", method: "conversation/reconnected", params: { threadId: restored.threadId, events } });
          for (const message of messages) if (!covered(message)) nativeMessageHandler?.(message);
          if (startedClient) { void loadSkills(startedClient); void loadHooks(startedClient, restored.threadId); }
        },
        beforeStart: () => {
          if (threadTransition === reconnectTransition) finishThreadTransition();
          assertSelection(expected);
          if (activeTurnId !== null || lifecycle.approvalCount > 0 || interruptingTurn !== null) throw new Error("복원 중 도착한 실행 또는 승인 요청이 끝난 뒤 새 요청을 보내 주세요.");
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
      hasConversationHistory = true;
      publish({ kind: "notification", method: "turn/startAccepted", params: { clientRequestId, threadId: validThreadId, turnId } });
      return { turnId };
    } catch (error) {
      trace.cancel("failed");
      assertSelection(expected);
      if (promptPublished && rpc === startedClient) publish({ kind: "notification", method: "turn/startFailed", params: { clientRequestId, threadId: validThreadId, message: String(error) } });
      throw error;
    } finally {
      if (threadTransition === reconnectTransition) threadTransition = null;
      if (isCurrent(expected)) turnStarting = false;
    }
  });
  handle("turn:steer", async (_event, expected: unknown, threadId: unknown, turnId: unknown, text: unknown, messageId: unknown, image: unknown) => {
    assertSelection(expected);
    const thread = requiredString(threadId, "thread ID");
    const turn = requiredString(turnId, "turn ID");
    const id = requiredString(messageId, "client user message ID");
    const chatImage = validateChatImage(image);
    if (id.length > 200 || typeof text !== "string" || (!text.trim() && !chatImage) || text.length > 100_000) throw new Error("Invalid steer input");
    if (steerIds.has(id)) throw new Error("이미 전송한 추가 지시 ID입니다.");
    if (steering) throw new Error("이전 추가 지시의 접수를 확인하고 있습니다.");
    if (switchingConversation || turnStarting || compactTurn || lifecycle.approvalCount > 0 || interruptingTurn !== null) throw new Error("시작·승인·중단·압축 처리가 끝난 뒤 추가 지시를 보낼 수 있습니다.");
    const client = rpc;
    if (!client || thread !== activeThreadId || turn !== activeTurnId) throw new Error("현재 실행 중인 턴을 확인할 수 없습니다.");
    const params = { threadId: thread, turnId: turn, clientUserMessageId: id, text };
    const planWorkIds = requestedWwwPlanWorkIds(text);
    let releasePlanSteer = () => {};
    const planDecision = planWorkIds.length ? new Promise<void>(resolve => { releasePlanSteer = resolve; }) : null;
    steerIds.add(id);
    steering = true;
    let sent = false;
    try {
      publish({ kind: "notification", method: "turn/steerPending", params });
      assertSelection(expected);
      if (rpc !== client || activeThreadId !== thread || activeTurnId !== turn || lifecycle.approvalCount > 0 || interruptingTurn !== null) throw new Error("추가 지시 전송 전에 실행 상태가 변경됐습니다.");
      if (planDecision) pendingPlanSteer = planDecision;
      sent = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let value: unknown;
      try {
        value = await Promise.race([
          client.request("turn/steer", nativeTurnSteerParams(thread, turn, text, id, chatImage)),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new RpcClosedError("추가 지시 응답 시간 초과", true)), 30_000); })
        ]);
      } finally { if (timer) clearTimeout(timer); }
      if (!isCurrent(expected) || rpc !== client) throw new RpcClosedError("추가 지시 접수 여부를 확인할 수 없습니다.", true);
      if (optionalRecord(value)?.turnId !== turn) throw new RpcClosedError("추가 지시 응답의 턴이 일치하지 않습니다.", true);
      if (activeThreadId === thread && activeTurnId === turn && planWorkIds.length) {
        for (const workId of planWorkIds) requestedDevelopmentWorks.add(workId);
        if (requestedDevelopmentWorks.size > 1 || [...declaredDevelopmentWorks].some(workId => !requestedDevelopmentWorks.has(workId))) {
          publishPlanAmbiguity(turn);
        }
      }
      publish({ kind: "notification", method: "turn/steerAccepted", params });
      return { turnId: turn };
    } catch (error) {
      if (isCurrent(expected) && activeThreadId === thread) {
        const uncertain = sent && error instanceof RpcClosedError && error.uncertain;
        if (uncertain && rpc === client && activeTurnId === turn && planWorkIds.some(workId => !requestedDevelopmentWorks.has(workId))) {
          publishPlanAmbiguity(turn, "steer_uncertain");
        }
        publish({ kind: "notification", method: uncertain ? "turn/steerUncertain" : "turn/steerFailed", params: { ...params, message: String(error) } });
      }
      throw error;
    } finally {
      if (planDecision) {
        if (pendingPlanSteer === planDecision) pendingPlanSteer = null;
        releasePlanSteer();
      }
      steering = false;
    }
  });
  handle("turn:interrupt", async (_event, expected: unknown, threadId: unknown, turnId: unknown) => {
    assertSelection(expected);
    requiredString(threadId, "thread ID"); requiredString(turnId, "turn ID");
    if (threadId !== activeThreadId || turnId !== activeTurnId) throw new Error("현재 실행 중인 턴만 중단할 수 있습니다.");
    if (interruptingTurn !== null) throw new Error("중단 결과를 기다리고 있습니다.");
    interruptingTurn = turnId as string;
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
      if (turnStarting || steering || activeTurnId !== null || switchingConversation || compactTurn || lifecycle.approvalCount > 0) throw new Error("실행 또는 승인 요청이 남아 있습니다. 중단하고 승인 요청을 처리한 뒤 탭을 닫아 주세요.");
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
      if (compactTurn) clearTimeout(compactTurn.timeout);
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
