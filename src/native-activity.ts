/**
 * @architecture arch.chat.activity.projection
 * @implements RESP-CHAT-ACTIVITY-PROJECTION
 */
import type { AppEvent, ResourceGap, ResourceObservationInput, TransportState } from "./shared";
import { identifyWwwArtifact, referencedWwwArtifacts, type WwwArtifact } from "./www-activity";

export type ActivityStatus = "pending" | "running" | "completed" | "failed" | "blocked" | "interrupted" | "unknown";
export interface ActivityEntry {
  id          : string                                                                                          ;
  kind        : "role" | "skill" | "hook" | "command" | "tool" | "files" | "answer" | "model" | "compaction" | "request" | "progress" ;
  label       : string                                                                                          ;
  description : string | null                                                                                   ;
  status      : ActivityStatus                                                                                  ;
  at          : string                                                                                          ;
  endedAt     : string | null                                                                                   ;
  durationMs  : number | null                                                                                   ;
  source      : "native" | "request" | "file_read" | "command_reference"                                        ;
  historical?: boolean;
  wwwArtifact?: WwwArtifact;
}
export interface UsageBreakdown {
  inputTokens            : number ;
  outputTokens           : number ;
  cachedInputTokens      : number ;
  reasoningOutputTokens  : number ;
  totalTokens            : number ;
  cacheWriteInputTokens? : number ;
}
export interface ModelObservation {
  name     : string                    ;
  provider : string | null             ;
  basis    : "configured" | "rerouted" ;
}
export interface PlanStep {
  step   : string                                 ;
  status : "pending" | "inProgress" | "completed" ;
}
export interface ActivityTurn {
  id               : string                        ;
  threadId         : string                        ;
  turnId           : string | null                 ;
  title            : string                        ;
  prompt           : string                        ;
  answer           : string | null                 ;
  status           : ActivityStatus                ;
  startedAt        : string                        ;
  endedAt          : string | null                 ;
  /** Native가 식별한 최초 턴 종료·연결 종료의 수신 순서. */
  endedSeq         : number | null                 ;
  model            : ModelObservation | null       ;
  plan             : PlanStep[]                    ;
  entries          : ActivityEntry[]               ;
  usage            : UsageBreakdown | null         ;
  usageBasis       : "total_delta" | "unavailable" ;
  lastRequestUsage : UsageBreakdown | null         ;
  usageSeries      : number[]                      ;
  lastActivityAt: string;
  historical: boolean;
}
export interface LimitWindow {
  usedPercent        : number        ;
  windowDurationMins : number | null ;
  resetsAt           : number | null ;
}
export interface LimitBucket {
  id        : string             ;
  name      : string             ;
  model     : string | null      ;
  primary   : LimitWindow | null ;
  secondary : LimitWindow | null ;
}
export interface NativeActivityProjection {
  threadId         : string | null         ;
  turns            : ActivityTurn[]        ;
  sessionEntries   : ActivityEntry[]       ;
  usage            : UsageBreakdown | null ;
  limits           : LimitBucket[]         ;
  historyTruncated : boolean               ;
  updatedAt        : string | null         ;
  transport: TransportState;
  protocolWarning: { at: string; message: string } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  return {};
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function status(value: unknown): ActivityStatus {
  switch (value) {
    case "pending": return "pending";
    case "running": case "inProgress": return "running";
    case "completed": return "completed";
    case "failed": case "declined": return "failed";
    case "blocked": return "blocked";
    case "interrupted": case "stopped": return "interrupted";
    default: return "unknown";
  }
}
function usage(value: unknown): UsageBreakdown | null {
  const data = record(value);

  const inputTokens           = integer(data.inputTokens          ) ;
  const outputTokens          = integer(data.outputTokens         ) ;
  const cachedInputTokens     = integer(data.cachedInputTokens    ) ;
  const reasoningOutputTokens = integer(data.reasoningOutputTokens) ;
  const totalTokens           = integer(data.totalTokens          ) ;
  if (inputTokens === null || outputTokens === null || cachedInputTokens === null || reasoningOutputTokens === null || totalTokens === null) return null;
  const result: UsageBreakdown = {
    inputTokens           ,
    outputTokens          ,
    cachedInputTokens     ,
    reasoningOutputTokens ,
    totalTokens
  };
  if (data.cacheWriteInputTokens !== undefined) {
    const cacheWrite = integer(data.cacheWriteInputTokens);
    if (cacheWrite === null) return null;
    result.cacheWriteInputTokens = cacheWrite;
  }
  return result;
}
function subtract(current: UsageBreakdown, baseline: UsageBreakdown): UsageBreakdown | null {
  const result: UsageBreakdown = {
    inputTokens           : current.inputTokens - baseline.inputTokens                     ,
    outputTokens          : current.outputTokens - baseline.outputTokens                   ,
    cachedInputTokens     : current.cachedInputTokens - baseline.cachedInputTokens         ,
    reasoningOutputTokens : current.reasoningOutputTokens - baseline.reasoningOutputTokens ,
    totalTokens           : current.totalTokens - baseline.totalTokens                     ,
  };
  if (current.cacheWriteInputTokens !== undefined && baseline.cacheWriteInputTokens !== undefined) {
    result.cacheWriteInputTokens = current.cacheWriteInputTokens - baseline.cacheWriteInputTokens;
  }
  return Object.values(result).every((value) => value >= 0) ? result : null;
}
function window(value: unknown, previous: LimitWindow | null = null): LimitWindow | null {
  if (value === null) return null;
  const data        = record (value           ) ;
  const usedPercent = integer(data.usedPercent) ;
  if (usedPercent === null) return previous;
  return {
    usedPercent,
    windowDurationMins: data.windowDurationMins === null ? null : integer(data.windowDurationMins) ?? previous?.windowDurationMins ?? null,
    resetsAt: data.resetsAt === null ? null : integer(data.resetsAt) ?? previous?.resetsAt ?? null,
  };
}
function mergeLimit(limits: LimitBucket[], value: unknown, key: string): void {
  const data = record(value);
  if (!Object.keys(data).length) return;
  const id       = text(data.limitId) || key               ;
  const previous = limits.find((entry) => entry.id === id) ;
  const bucket: LimitBucket = {
    id ,
    name      : text(data.limitName) || previous?.name || id                               ,
    model     : text(data.normalModelSlug) || previous?.model || null                      ,
    primary   : window(data.primary, previous?.primary)     ,
    secondary : window(data.secondary, previous?.secondary) ,
  };
  if (previous) Object.assign(previous, bucket);
  else limits.push(bucket);
}
function entry(entries: ActivityEntry[], id: string, kind: ActivityEntry["kind"], label: string, at: string): ActivityEntry {
  const previous = entries.find((item) => item.id === id);
  if (previous) return previous;
  const created: ActivityEntry = {
    id                      ,
    kind                    ,
    label                   ,
    description : null      ,
    status      : "running" ,
    at                      ,
    endedAt    : null ,
    durationMs : null ,
    source     : "native"
  };
  entries.push(created);
  return created;
}
function finish(item: ActivityEntry, next: ActivityStatus, at: string, duration: unknown): void {
  if (item.endedAt && (next === "running" || next === "pending")) return;
  item.status = next;
  if (next !== "running" && next !== "pending") item.endedAt = at;
  item.durationMs = integer(duration) ?? item.durationMs;
  if ((item.kind === "skill" || item.kind === "role") && item.source === "file_read") {
    const name = item.wwwArtifact?.id ?? "SKILL.md";
    item.label = next === "completed" ? `${name} 읽기 확인`
      : next === "failed" ? `${name} 읽기 실패`
      : next === "running" ? `${name} 읽는 중`
      : next === "interrupted" ? `${name} 읽기 중단`
      : `${name} 읽기 결과 미확인`;
  }
}

/** Native 실행 결과를 투영과 원장 입력에서 같은 근거로 해석한다. */
function nativeItemOutcome(item: Record<string, unknown>, complete: boolean): ActivityStatus {
  if (!complete) return "running";
  let outcome = status(item.status);
  if (outcome !== "failed" && item.type === "commandExecution" && typeof item.exitCode === "number" && Number.isSafeInteger(item.exitCode)) {
    outcome = item.exitCode === 0 ? "completed" : "failed";
  }
  if (item.success === false || item.error) outcome = "failed";
  return outcome;
}

function nativeDocumentReads(item: Record<string, unknown>, workspacePath?: string): { path: string; artifact: WwwArtifact | null }[] {
  return list(item.commandActions).flatMap((value) => {
    const action = record(value);
    const path = text(action.path);
    if (action.type !== "read") return [];
    const artifact = identifyWwwArtifact(path, workspacePath, text(item.cwd));
    if (!artifact && !/(^|[\\/])SKILL\.md$/.test(path)) return [];
    return [{ path, artifact: artifact ?? null }];
  });
}

function nativeToolLabel(item: Record<string, unknown>): string | null {
  const type = text(item.type);
  return ["mcpToolCall", "dynamicToolCall", "collabAgentToolCall", "webSearch", "imageGeneration", "sleep"].includes(type)
    ? text(item.tool) || type : null;
}

function nativeHookRun(data: Record<string, unknown>): Record<string, unknown> | null {
  const run = record(data.run);
  return text(run.id) && run.executionMode === "sync" ? run : null;
}

export interface NativeResourceNormalization {
  threadId: string | null;
  observations: ResourceObservationInput[];
  gaps: ResourceGap[];
}

export interface NativeResourceOptions {
  /** 실제 Native에는 지정하지 않는다. 호출별 유일성을 입증한 합성 adapter 전용 경계다. */
  providerRunNamespace?: string;
  /** 정본 목록 밖 구조화 read 경로를 원문 없는 SHA-256 metadata로 바꾸는 main 경계다. */
  documentIdentity?: (path: string, cwd: string) => string;
}

function metadataName(value: unknown): string | null {
  const name = text(value);
  return /^[A-Za-z0-9_.:/-]{1,120}$/.test(name) ? name : null;
}

function documentIdentity(path: string, cwd: string, identify?: (path: string, cwd: string) => string): string | null {
  try {
    const identity = identify?.(path, cwd);
    return typeof identity === "string" && identity.length === 80 && /^document-sha256:[a-f0-9]{64}$/.test(identity) ? identity : null;
  } catch {
    return null;
  }
}

function resourceStatus(outcome: ActivityStatus, historical: boolean): ResourceObservationInput["status"] {
  if (outcome === "completed" || outcome === "failed") return outcome;
  if (outcome === "running" && !historical) return "running";
  return "unknown";
}

/** 순수 입력 정규화. workspace 경계·선택·영속 ID·저장은 main과 원장이 소유한다. */
export function normalizeNativeResources(event: AppEvent, workspacePath: string, options: NativeResourceOptions = {}): NativeResourceNormalization {
  const data = record(event.params);
  const threadId = text(data.threadId).trim() ? text(data.threadId) : null;
  const result: NativeResourceNormalization = { threadId, observations: [], gaps: [] };
  if (event.kind === "request") return result;
  const hookEvent = event.method === "hook/started" || event.method === "hook/completed";
  const itemEvent = event.method === "item/started" || event.method === "item/completed";
  if (!hookEvent && !itemEvent) return result;
  if (!threadId) { result.gaps.push("native-missing"); return result; }
  const turnId = text(data.turnId).trim() ? text(data.turnId) : null;
  if (hookEvent) {
    const run = nativeHookRun(data);
    if (!run) { result.gaps.push("native-missing"); return result; }
    // codex-cli 0.167.2의 run.id는 eventName:displayOrder:sourcePath로 재사용된다.
    const namespace = metadataName(options.providerRunNamespace);
    if (!namespace) { result.gaps.push("unstable-id"); return result; }
    if (["pending", "declined", "blocked"].includes(text(run.status))) return result;
    const name = metadataName(run.eventName);
    if (!name) { result.gaps.push("native-missing"); return result; }
    result.observations.push({
      source: { kind: "hook", hookRunId: text(run.id), providerRunNamespace: namespace, turnId },
      resource: { kind: "hook", identity: name, label: name },
      action: "invoke",
      status: resourceStatus(status(run.status), event.historical === true),
    });
    return result;
  }
  const item = record(data.item);
  const type = text(item.type);
  const toolLabel = nativeToolLabel(item);
  if (type !== "commandExecution" && type !== "fileChange" && !toolLabel) return result;
  if (["pending", "declined", "blocked"].includes(text(item.status))) return result;
  if (["skills/list", "hooks/list"].includes(text(item.tool))) return result;
  const itemId = text(item.id).trim() ? text(item.id) : null;
  if (!turnId || !itemId) { result.gaps.push("native-missing"); return result; }
  const source: ResourceObservationInput["source"] = { kind: "item", itemId, turnId };
  const invocationId = text(item.invocationId);
  if (invocationId) source.nativeInvocationId = invocationId;
  let identity = type;
  let label = type === "commandExecution" ? "명령 실행" : type === "fileChange" ? "파일 변경" : type;
  if (["mcpToolCall", "dynamicToolCall", "collabAgentToolCall"].includes(type)) {
    const tool = metadataName(item.tool);
    const server = type === "mcpToolCall" ? metadataName(item.server) : null;
    if (!tool || (type === "mcpToolCall" && !server)) { result.gaps.push("native-missing"); return result; }
    identity = JSON.stringify([type, server, tool]);
    label = server ? `${server}/${tool}` : tool;
  }
  const explicitFailure = status(item.status) === "failed" || item.success === false || Boolean(item.error);
  const outcome = explicitFailure ? "failed" : nativeItemOutcome(item, event.method === "item/completed");
  const observedStatus = resourceStatus(outcome, event.historical === true);
  result.observations.push({ source, resource: { kind: "tool", identity, label }, action: "invoke", status: observedStatus });
  if (type === "commandExecution") {
    for (const { path, artifact } of nativeDocumentReads(item, workspacePath)) {
      const identity = artifact?.path ?? documentIdentity(path, text(item.cwd) || workspacePath, options.documentIdentity);
      if (!identity) {
        if (!result.gaps.includes("native-missing")) result.gaps.push("native-missing");
        continue;
      }
      if (result.observations.some((row) => row.action === "read" && row.resource.identity === identity)) continue;
      result.observations.push({ source, resource: { kind: "document", identity, label: artifact?.id ?? "SKILL.md" }, action: "read", status: observedStatus });
    }
  }
  return result;
}

/** 서버 사건만 투영하며 reasoning 텍스트와 도구 출력 본문은 보관하지 않는다. */
export function projectNativeActivity(events: readonly AppEvent[], selectedThreadId?: string | null, workspacePath?: string): NativeActivityProjection {
  const sorted = [...events].sort((left, right) => left.seq - right.seq).slice(-2_000);

  const restored = sorted.find((event) => event.method === "conversation/restored" && event.historical);

  const historyTruncated = restored ? record(restored.params).complete !== true : events.length > 2_000 || (sorted[0]?.seq ?? 1) > 1;

  const turns          : ActivityTurn[]  = [] ;
  const sessionEntries : ActivityEntry[] = [] ;
  const limits         : LimitBucket[]   = [] ;

  const models             = new Map<string, ModelObservation>()            ;
  const totals             = new Map<string, UsageBreakdown>()              ;
  const baselines          = new Map<ActivityTurn, UsageBreakdown | null>() ;
  const turnTotals         = new Map<ActivityTurn, UsageBreakdown>()        ;
  const unsafeUsageThreads = new Set<string>()                              ;
  const settledTurns = new Set<ActivityTurn>();
  const disconnectedTurns = new Set<ActivityTurn>();
  const observedMessages = new Set<ActivityEntry>();
  const completedMessages = new Set<ActivityEntry>();
  const hookStartedAt = new Map<ActivityEntry, number | null>();
  const suspendedTurns = new Map<ActivityTurn, string>();
  const definitiveCompletions = new Map<ActivityTurn, Set<string>>();
  const restoredScopes = new Map<string, string>();
  const eventScope = (event: AppEvent): string => {
    const fields = record(event);
    return JSON.stringify([fields.connectionGeneration ?? null, fields.processEpoch ?? null, fields.sessionId ?? null, fields.workspaceKey ?? null, fields.selectionEpoch ?? null]);
  };
  const progressScopes = new Map<ActivityEntry, string>();

  const requests       = new Map<string, ActivityTurn>()         ;
  const approvals      = new Map<string, ActivityTurn>()         ;
  const sessionThreads = new Map<ActivityEntry, string | null>() ;
  const seen           = new Set<number>()                       ;

  let activeThread : string | null = selectedThreadId ?? null ;
  let updatedAt    : string | null = null                     ;

  let transport: TransportState = "disconnected";
  let protocolWarning: NativeActivityProjection["protocolWarning"] = null;

  function create(threadId: string, turnId: string | null, at: string, id: string, historical = false): ActivityTurn {
    const previous = turns.filter((turn) => turn.threadId === threadId).at(-1)                                              ;
    const baseline = previous ? (previous.endedAt ? turnTotals.get(previous) ?? null : null) : totals.get(threadId) ?? null ;
    const turn: ActivityTurn = {
      id       ,
      threadId ,
      turnId   ,
      title            : "답변 턴"                    ,
      prompt           : ""                           ,
      answer           : null                         ,
      status           : "running"                    ,
      startedAt        : at                           ,
      endedAt          : null                         ,
      endedSeq         : null                         ,
      model            : models.get(threadId) ?? null ,
      plan             : []                           ,
      entries          : []                           ,
      usage            : null                         ,
      usageBasis       : "unavailable"                ,
      lastRequestUsage : null                         ,
      usageSeries      : []                           ,
      lastActivityAt: at,
      historical,
    };
    baselines.set(turn, historyTruncated || unsafeUsageThreads.has(threadId) ? null : baseline);
    turns.push(turn);
    return turn;
  }
  function locate(threadId: string, turnId: string, at: string, historical = false): ActivityTurn | undefined {
    if (!threadId || !turnId) return undefined;
    const turn = turns.find((candidate) => candidate.threadId === threadId && candidate.turnId === turnId)
      ?? create(threadId, turnId, at, `${threadId}:${turnId}`, historical);
    if (!turn.endedAt) turn.lastActivityAt = at;
    if (!historical && !turn.endedAt) turn.historical = false;
    return turn;
  }

  for (const event of sorted) {
    if (seen.has(event.seq)) continue;
    seen.add(event.seq);
    updatedAt = event.at;
    const data     = record(event.params)                                                           ;
    const item     = record(data.item)                                                              ;
    const turnData = record(data.turn)                                                              ;
    let threadId   = text(data.threadId) || text(turnData.threadId) || text(record(data.thread).id) ;
    const turnId   = text(data.turnId) || text(turnData.id)                                         ;
    if (!threadId && turnId) {
      const matches = turns.filter((turn) => turn.turnId === turnId);
      if (matches.length === 1) threadId = matches[0]?.threadId ?? "";
    }
    if (threadId && turnId) {
      const owner = JSON.stringify([threadId, turnId]);
      if (event.historical && !restoredScopes.has(owner)) restoredScopes.set(owner, eventScope(event));
      const scope = restoredScopes.get(owner);
      if (scope !== undefined && scope !== eventScope(event)) continue;
    }
    if (threadId) activeThread = threadId;
    if (event.method === "account/rateLimits/updated" || event.method === "account/rateLimits/read") {
      mergeLimit(limits, data.rateLimits, "codex");
      for (const [key, value] of Object.entries(record(data.rateLimitsByLimitId))) mergeLimit(limits, value, key);
      continue;
    }
    if (event.method === "thread/configured" && threadId) {
      const name = text(data.model);
      if (name) models.set(threadId, { name, provider: text(data.modelProvider) || null, basis: "configured" });
      if (data.isNew === true && !historyTruncated && !totals.has(threadId)) {
        totals.set(threadId, { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0, cacheWriteInputTokens: 0 });
      }
      continue;
    }
    if (event.method === "transport/connected") {
      transport = "connected";
      continue;
    }
    if (event.method === "transport/status") {
      const state = data.state;
      if (state === "connected" || state === "closed" || state === "error" || state === "disconnected") transport = state;
      continue;
    }
    const requestId  = text(data.clientRequestId)                                                                    ;
    const approvalId = event.requestId === undefined ? null : `request:${typeof event.requestId}:${event.requestId}` ;
    if (event.method.startsWith("approval/") && approvalId                       ) {
      const owner    = approvals.get(approvalId)                           ;
      const approval = owner?.entries.find((row) => row.id === approvalId) ;
      if (owner && approval) {
        if (!owner.endedAt) owner.lastActivityAt = event.at;
        if (event.method === "approval/responding") approval.description = "응답 전송 중";
        if (event.method === "approval/responded") {
          finish(approval, "completed", event.at, null);
          approval.description = text(data.decision) || "응답 전송됨";
          if (owner.status === "blocked" && !owner.endedAt && !owner.entries.some((row) => row.kind === "request" && row.status === "blocked")) owner.status = "running";
        }
        if (event.method === "approval/uncertain") {
          finish(approval, "unknown", event.at, null);
          if (owner.status === "blocked" && !owner.endedAt) owner.status = "unknown";
        }
      }
      continue;
    }
    if (event.method === "turn/userPrompt" && threadId                           ) {
      const requestKey = `${threadId}:${requestId || event.seq}`;
      if (!requests.has(requestKey)) {
        const turn = create(threadId, null, event.at, requestKey, event.historical === true);
        turn.prompt = text(data.text)                       ;
        turn.title  = turn.prompt.slice(0, 72) || "답변 턴" ;
        turn.status = "pending"                             ;
        requests.set(requestKey, turn);
      }
      continue;
    }
    if (event.method === "turn/startAccepted" && threadId && turnId              ) {
      const pending  = requests.get (`${threadId}:${requestId}`                                    ) ;
      const existing = turns   .find((turn) => turn.threadId === threadId && turn.turnId === turnId) ;
      if (pending && existing && existing !== pending) {
        baselines.set(existing, baselines.get(pending) ?? null);
        const observed = turnTotals.get(existing) ;
        const baseline = baselines .get(existing) ;
        existing.usage = observed && baseline ? subtract(observed, baseline) : null;
        existing.usageBasis = existing.usage ? "total_delta" : "unavailable";
        if (existing.usage && !existing.usageSeries.length) existing.usageSeries.push(existing.usage.totalTokens);
        if (!existing.prompt) {
          existing.prompt = pending.prompt;
          existing.title = pending.title;
        }
        requests.set(`${threadId}:${requestId}`, existing);
        turns.splice(turns.indexOf(pending), 1);
      } else if (pending) { pending.turnId = turnId; if (!pending.endedAt) pending.lastActivityAt = event.at; }
      else locate(threadId, turnId, event.at, event.historical === true);
      continue;
    }
    if (event.method === "turn/startFailed"                                      ) {
      const pending = requests.get(`${threadId}:${requestId}`);
      if (pending && pending.turnId === null) {
        pending.status = "failed";
        pending.endedAt = event.at;
        pending.endedSeq ??= event.seq;
      }
      continue;
    }
    if (event.method === "transport/error") {
      protocolWarning = { at: event.at, message: text(data.message).slice(0, 500) || "프로토콜 경고" };
      continue;
    }
    if (event.method === "transport/closed") {
      transport = "closed";
      suspendedTurns.clear();
      for (const turn of turns) {
        disconnectedTurns.add(turn);
        if (!turn.endedAt) {
          turn.endedSeq ??= event.seq;
          turn.lastActivityAt = event.at;
          turn.status = "unknown";
          turn.endedAt = event.at;
        }
        for (const item of turn.entries) if (item.status === "running" || item.status === "pending" || item.status === "blocked") finish(item, "unknown", event.at, null);
      }
      for (const item of sessionEntries) if (item.status === "running") finish(item, "unknown", event.at, null);
      continue;
    }
    if (event.method === "hook/started" || event.method === "hook/completed"     ) {
      const run = nativeHookRun(data);
      if (!run) continue;
      const runId = text(run.id);
      const owner = threadId && turnId ? locate(threadId, turnId, event.at, event.historical === true) : undefined;
      const target = threadId && turnId ? owner?.entries : sessionEntries;
      if (!target) continue;
      const hook = entry(target, `hook:${threadId}:${turnId}:${runId}`, "hook", text(run.eventName) || "Hook", event.at);
      const rawTime = run.startedAt;
      const parsedTime = typeof rawTime === "number" ? rawTime : typeof rawTime === "string" ? Date.parse(rawTime) : NaN;
      const startedAt = Number.isFinite(parsedTime) ? parsedTime : null;
      const previousTime = hookStartedAt.get(hook) ?? null;
      const newerStart = startedAt !== null && previousTime !== null && startedAt > previousTime;
      if (hookStartedAt.has(hook)) {
        if (event.historical && !hook.historical) continue;
        if (previousTime !== null && (startedAt === null || startedAt < previousTime)) continue;
        // handler ID는 호출 ID가 아니다. 시각이 없는 완료 후 시작은 재전송과 구분할 수 없다.
        if (event.method === "hook/started" && !newerStart) continue;
        if (newerStart) {
          hook.at = event.at;
          hook.endedAt = null;
          hook.durationMs = null;
        }
      }
      hookStartedAt.set(hook, startedAt);
      if (target === sessionEntries) sessionThreads.set(hook, threadId || null);
      hook.historical = event.historical === true;
      const messages = list(run.entries).map(record).filter((output) => ["error", "warning", "stop"].includes(text(output.kind))).slice(0, 4).map((output) => text(output.text).slice(0, 800));
      const trustRequired = messages.some((message) => message.includes("hook approval required"));
      const details = [trustRequired ? "플러그인 변경으로 신뢰 검토 필요 · Hook 실행 전 차단" : "", text(run.sourcePath).slice(0, 500), text(run.statusMessage).slice(0, 800), ...messages].filter(Boolean);
      hook.description = details.join("\n") || null;
      const outcome = status(run.status);
      const closedStart = event.method === "hook/started" && (transport === "closed" || owner?.endedSeq != null || !!owner?.endedAt);
      finish(hook, (event.historical || closedStart) && outcome === "running" ? "unknown" : outcome, event.at, run.durationMs);
      continue;
    }
    if (!threadId || !turnId) continue;
    const turn = locate(threadId, turnId, event.at, event.historical === true);
    if (!turn) continue;
    if (event.method === "turn/started" && !event.historical && transport !== "closed" && !disconnectedTurns.has(turn) && suspendedTurns.get(turn) === eventScope(event)) {
      suspendedTurns.delete(turn);
      turn.endedAt = null;
      turn.endedSeq = null;
      turn.historical = false;
      turn.lastActivityAt = event.at;
      for (const activity of turn.entries) if (!definitiveCompletions.get(turn)?.has(activity.id)) completedMessages.delete(activity);
    }
    const definitiveMessageId = event.method === "item/completed" && item.type === "agentMessage"
      && (!event.historical || (typeof item.completedAtMs === "number" && Number.isSafeInteger(item.completedAtMs)))
      ? text(item.id) : "";
    const commentary = item.type === "agentMessage" && item.phase === "commentary";
    const progressEvent = event.method === "turn/plan/updated"
      || (event.method === "item/agentMessage/delta" && data.phase === "commentary")
      || ((event.method === "item/started" || event.method === "item/completed") && commentary);
    const endedProgress = progressEvent && (turn.endedAt !== null || turn.endedSeq !== null);
    if (endedProgress && !suspendedTurns.has(turn)) {
      // 실시간 종료와 복원 이력의 합성 정지를 구분한다.
      if (turn.historical || !definitiveMessageId || !commentary || typeof item.text !== "string") continue;
      const existing = turn.entries.find(row => row.id === `item:${definitiveMessageId}` && row.kind === "progress");
      if (!existing || progressScopes.get(existing) !== eventScope(event) || definitiveCompletions.get(turn)?.has(existing.id)) continue;
    }
    if (definitiveMessageId) {
      const completed = definitiveCompletions.get(turn) ?? new Set<string>();
      completed.add(`item:${definitiveMessageId}`);
      definitiveCompletions.set(turn, completed);
    }
    if (endedProgress && suspendedTurns.has(turn)) continue;
    if (event.method === "turn/started" && !turn.endedAt) turn.status = "running";
    if (event.method === "turn/completed"                                   ) {
      if (settledTurns.has(turn)) continue;
      const outcome = turnData.status === "completed" || turnData.status === "failed" || turnData.status === "interrupted" ? turnData.status : "unknown";
      if (outcome === "unknown" && event.historical && turn.endedSeq !== null) continue;
      if (outcome !== "unknown") { settledTurns.add(turn); suspendedTurns.delete(turn); }
      else if (event.historical) suspendedTurns.set(turn, eventScope(event));
      turn.endedSeq ??= event.seq;
      turn.status = outcome;
      turn.endedAt = event.at;
      for (const item of turn.entries) {
        if (item.status === "running" || item.status === "pending" || item.status === "blocked") {
          const outcome = item.kind === "request" && turn.status === "failed" ? "failed" : "unknown";
          finish(item, outcome, event.at, null);
        }
      }
    }
    if (event.method === "turn/plan/updated"                                ) {
      turn.plan = list(data.plan).flatMap((value): PlanStep[] => {
        const row   = record(value)  ;
        const step  = text(row.step) ;
        const state = row.status     ;
        return step && (state === "pending" || state === "inProgress" || state === "completed") ? [{ step, status: state }] : [];
      });
    }
    if (event.method === "model/rerouted"                                   ) {
      const name = text(data.toModel);
      if (name) {
        turn.model = { name, provider: turn.model?.provider ?? null, basis: "rerouted" };
        finish(entry(turn.entries, `model:${event.seq}`, "model", name, event.at), "completed", event.at, null);
      }
    }
    if (event.method === "thread/tokenUsage/updated"                        ) {
      const tokenUsage = record(data.tokenUsage ) ;
      const total      = usage (tokenUsage.total) ;
      const last       = usage (tokenUsage.last ) ;
      if (!total || !last) continue;
      const previous  = turnTotals.get(turn)                                                                             ;
      const latest    = turns.filter((candidate) => candidate.threadId === threadId).at(-1) ;
      const reference = previous ?? (latest === turn ? totals.get(threadId) : undefined)                                 ;
      turnTotals.set(turn, total);
      turn.lastRequestUsage = last;
      if (reference && !subtract(total, reference)) {
        unsafeUsageThreads.add(threadId);
        if (latest === turn) totals.set(threadId, total);
        for (const affected of turns.slice(turns.indexOf(turn))) {
          if (affected.threadId !== threadId) continue;
          baselines.set(affected, null);
          affected.usage       = null          ;
          affected.usageBasis  = "unavailable" ;
          affected.usageSeries = []            ;
        }
        continue;
      }
      if (latest === turn) totals.set(threadId, total);
      else if (!previous || Object.values(subtract(total, previous) ?? {}).some((value) => value > 0)) {
        // 이전 턴 증가가 섞인 이후 snapshot은 다음 턴의 안전 기준도 될 수 없다.
        unsafeUsageThreads.add(threadId);
        const index = turns.indexOf(turn);
        for (const subsequent of turns.slice(index + 1)) {
          if (subsequent.threadId !== threadId) continue;
          baselines.set(subsequent, null);
          turnTotals.delete(subsequent);
          subsequent.usage       = null          ;
          subsequent.usageBasis  = "unavailable" ;
          subsequent.usageSeries = []            ;
        }
      }
      const baseline = baselines.get(turn);
      turn.usage = baseline ? subtract(total, baseline) : null;
      turn.usageBasis = turn.usage ? "total_delta" : "unavailable";
      if (turn.usage && turn.usageSeries.at(-1) !== turn.usage.totalTokens) turn.usageSeries.push(turn.usage.totalTokens);
    }
    if (event.kind === "request" && approvalId && !approvals.has(approvalId)) {
      const approval = entry(turn.entries, approvalId, "request", "사용자 승인 요청", event.at);
      approval.status  = turn.endedAt ? "unknown" : "blocked" ;
      approval.endedAt = turn.endedAt                         ;
      approval.source  = "request"                            ;
      approvals.set(approvalId, turn);
      if (!turn.endedAt && (turn.status === "running" || turn.status === "pending")) turn.status = "blocked";
    }
    const itemId = text(item.id) || text(data.itemId);
    if (!itemId) continue;
    if (event.method === "item/agentMessage/delta" && definitiveCompletions.get(turn)?.has(`item:${itemId}`)) continue;
    if (event.method === "item/agentMessage/delta" && data.phase === "commentary") {
      const progress = entry(turn.entries, `item:${itemId}`, "progress", "진행 설명", event.at);
      if (!progressScopes.has(progress)) progressScopes.set(progress, eventScope(event));
      if (!completedMessages.has(progress)) {
        progress.description = (progress.description ?? "") + text(data.delta);
        progress.status = "running";
        progress.endedAt = null;
        observedMessages.add(progress);
      }
    }
    if (event.method === "item/agentMessage/delta" && data.phase !== "analysis" && data.phase !== "reasoning" && data.phase !== "commentary") {
      if (turn.endedAt || turn.endedSeq !== null) continue;
      const answer = entry(turn.entries, `item:${itemId}`, "answer", "답변 작성", event.at);
      if (completedMessages.has(answer)) continue;
      answer.description = (answer.description ?? "") + text(data.delta);
      observedMessages.add(answer);
      turn.answer = turn.entries.filter((row) => row.kind === "answer").map((row) => row.description ?? "").join("\n");
    }
    if (event.method !== "item/started" && event.method !== "item/completed") continue;
    const complete = event.method === "item/completed" ;
    if (!complete && (turn.endedAt || turn.endedSeq !== null || transport === "closed")) continue;
    const type     = text(item.type)                   ;
    if (type === "userMessage") {
      for (const value of list(item.content)) {
        const input = record(value);
        if (input.type !== "skill" || !text(input.name)) continue;
        const skill = entry(turn.entries, `skill-request:${itemId}:${text(input.path) || text(input.name)}`, "skill", text(input.name), event.at);
        const inputPath = text(input.path);
        const artifact = identifyWwwArtifact(/[\\/]SKILL\.md$/.test(inputPath) ? inputPath : `${inputPath.replace(/[\\/]$/, "")}/SKILL.md`, workspacePath);
        if (artifact?.kind === "skill") skill.wwwArtifact = artifact;
        skill.description = "명시적 Skill 요청" ;
        skill.source      = "request"           ;
        skill.status      = "pending"           ;
      }
      continue;
    }
    let kind : ActivityEntry["kind"] | null = null ;
    let label                               = ""   ;
    if (type === "commandExecution"                                                                                      ) { kind = "command"; label = text(item.command) || "명령 실행"; }
    if (type === "fileChange"                                                                                            ) { kind = "files"; label = "파일 변경"; }
    const toolLabel = nativeToolLabel(item);
    if (toolLabel !== null) { kind = "tool"; label = toolLabel; }
    if (type === "contextCompaction"                                                                                     ) { kind = "compaction"; label = "컨텍스트 압축"; }
    if (type === "agentMessage" && item.phase === "commentary") { kind = "progress"; label = "진행 설명"; }
    if (type === "agentMessage" && item.phase !== "analysis" && item.phase !== "reasoning" && item.phase !== "commentary") { kind = "answer"; label = "답변 작성"; }
    if (!kind) continue;
    const activity = entry(turn.entries, `item:${itemId}`, kind, label, event.at);
    if (kind === "progress" && !progressScopes.has(activity)) progressScopes.set(activity, eventScope(event));
    if ((kind === "progress" || kind === "answer") && !complete && observedMessages.has(activity)) continue;
    activity.label = label;
    if (kind === "progress" || kind === "answer") {
      if (typeof item.text === "string") {
        activity.description = item.text;
        observedMessages.add(activity);
      }
      if (complete) {
        observedMessages.add(activity);
        completedMessages.add(activity);
      }
    }
    if (kind === "answer"          ) {
      turn.answer = turn.entries.filter((row) => row.kind === "answer").map((row) => row.description ?? "").join("\n");
    }
    if (complete                   ) {
      let outcome = nativeItemOutcome(item, true);
      if (kind === "answer" || kind === "compaction" || kind === "progress") outcome = "completed";
      if (item.success === false || item.error) outcome = "failed";
      finish(activity, outcome, event.at, item.durationMs);
    }
    if (type === "commandExecution") {
      for (const { path, artifact } of nativeDocumentReads(item, workspacePath)) {
        const kind = artifact?.kind === "role" ? "role" : "skill";
        const document = entry(turn.entries, `${kind}-read:${itemId}:${path}`, kind, `${artifact?.id ?? "SKILL.md"} 읽는 중`, event.at);
        document.description = path;
        document.source = "file_read";
        document.historical = event.historical === true;
        if (artifact) document.wwwArtifact = artifact;
      }
      for (const document of turn.entries) {
        if (document.source !== "file_read" || !(document.id.startsWith(`skill-read:${itemId}:`) || document.id.startsWith(`role-read:${itemId}:`))) continue;
        if (complete || !document.endedAt) finish(document, activity.status, event.at, null);
      }
      for (const artifact of referencedWwwArtifacts(text(item.command), workspacePath, text(item.cwd))) {
        if (turn.entries.some((row) => row.source === "file_read" && row.wwwArtifact?.id === artifact.id && (row.id.startsWith(`skill-read:${itemId}:`) || row.id.startsWith(`role-read:${itemId}:`)))) continue;
        const reference = entry(turn.entries, `www-reference:${itemId}:${artifact.id}`, artifact.kind, `${artifact.id} 읽기 명령 관측`, event.at);
        reference.wwwArtifact = artifact;
        reference.source = "command_reference";
        reference.historical = event.historical === true;
        reference.description = `${artifact.path}\n명령의 문서 참조만 관측했습니다. 개별 문서 읽기·적용은 확인되지 않았습니다.`;
      }
      for (const reference of turn.entries) {
        if (reference.source !== "command_reference" || !reference.id.startsWith(`www-reference:${itemId}:`)) continue;
        if (complete || !reference.endedAt) finish(reference, activity.status, event.at, null);
      }
    }
  }
  for (const turn of turns) {
    if (!turn.historical) continue;
    if (!turn.endedAt) {
      turn.status = "unknown";
      turn.endedAt = turn.lastActivityAt;
    }
    for (const activity of turn.entries) {
      if (activity.status === "running" || activity.status === "blocked") finish(activity, "unknown", turn.lastActivityAt, null);
    }
  }
  const threadId               = selectedThreadId ?? activeThread                                                                                 ;
  const selectedSessionEntries = sessionEntries.filter((item) => !threadId || !sessionThreads.get(item) || sessionThreads.get(item) === threadId) ;
  return { threadId, turns: turns.filter((turn) => !threadId || turn.threadId === threadId), sessionEntries: selectedSessionEntries, usage: threadId ? totals.get(threadId) ?? null : null, limits, historyTruncated, updatedAt, transport, protocolWarning };
}
