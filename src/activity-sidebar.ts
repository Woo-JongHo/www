import type { AppEvent, TransportState } from "./shared";

export type ActivitySidebarKind = "skill" | "hook";

export interface ActivitySidebarRow {
  id                : string                 ;
  kind              : ActivitySidebarKind    ;
  label             : string                 ;
  detail            : string | null          ;
  catalogued        : boolean                ;
  enabled           : boolean                ;
  lastActivityAt    : string | null          ;
  lastActivitySeq   : number | null          ;
  lastActivityLabel : "읽기" | "시작" | null ;
}

export interface ActivitySidebarPulse {
  id    : string ;
  seq   : number ;
  rowId : string ;
}

export interface ActivitySidebarProjection {
  skills           : ActivitySidebarRow[]   ;
  hooks            : ActivitySidebarRow[]   ;
  skillsComplete   : boolean                ;
  hooksComplete    : boolean                ;
  pulses           : ActivitySidebarPulse[] ;
  transport        : TransportState         ;
  historyTruncated : boolean                ;
}

export interface ActivitySkillsListResult {
  complete : boolean           ;
  skills   : SkillCatalogItem[];
}

export interface ActivityHooksListResult {
  complete : boolean          ;
  hooks    : HookCatalogItem[];
}

interface SkillCatalogItem {
  name    : string  ;
  path    : string  ;
  enabled : boolean ;
  scope   : string  ;
}

interface HookCatalogItem {
  key          : string  ;
  eventName    : string  ;
  sourcePath   : string  ;
  displayOrder : number  ;
  handlerType  : string  ;
  enabled      : boolean ;
  source       : string  ;
}

interface RawSkillMetadata extends SkillCatalogItem {
  description : string;
}

interface RawHookMetadata extends HookCatalogItem {
  currentHash : string  ;
  isManaged   : boolean ;
  timeoutSec  : number  ;
  trustStatus : string  ;
  command?    : string  ;
  async?      : boolean ;
  server?     : string  ;
  tool?       : string  ;
}

interface CatalogSnapshot<Item> {
  seq        : number  ;
  generation : number  ;
  complete   : boolean ;
  items      : Item[]  ;
}

interface ActivityObservation {
  threadId : string              ;
  kind     : ActivitySidebarKind ;
  identity : string              ;
  at       : string              ;
  seq      : number              ;
  label    : "읽기" | "시작"     ;
}

interface ActivityDedupeIndex {
  buckets : Set<string>[] ;
  size    : number        ;
}

export interface ActivitySidebarState {
  skillsCatalog       : CatalogSnapshot<SkillCatalogItem> | null      ;
  workspaceHooks      : CatalogSnapshot<HookCatalogItem> | null       ;
  threadHooks         : Map<string, CatalogSnapshot<HookCatalogItem>> ;
  observations        : Map<string, ActivityObservation>              ;
  pulses              : ActivityObservation[]                         ;
  processedThrough    : number                                        ;
  dedupe               : ActivityDedupeIndex                          ;
  connectionGeneration : number | null                                 ;
  transportThrough     : number                                        ;
  transport           : TransportState                                ;
  historyTruncated    : boolean                                       ;
}

export interface ActivitySidebarUpdateOptions {
  /** true이면 이 입력에서 새로 확인한 활동을 UI 반응 후보로 남긴다. */
  emitPulses?      : boolean;
  /** true이면 입력을 복원 snapshot으로 보고 절단 여부를 계산한다. */
  historySnapshot? : boolean;
}

const MAX_EVENTS = 2_000;
const MAX_PULSES = 512;
const MAX_OBSERVATIONS = 512;
const MAX_THREAD_CATALOGS = 32;
const DEDUPE_BUCKETS = 64;

// 해시는 버킷을 고르는 데만 쓴다. 중복 판정은 버킷 안의 실제 문자열을 비교하므로 확률적 누락이 없다.
// 각 업데이트는 바뀐 버킷만 복사해 React 이전 state를 변경하지 않는다.

const skillScopes = new Set(["user", "repo", "system", "admin"]);
const hookTrust   = new Set(["managed", "untrusted", "trusted", "modified"]);
const hookSources = new Set([
  "system",
  "user",
  "project",
  "mdm",
  "sessionFlags",
  "plugin",
  "cloudRequirements",
  "cloudManagedConfig",
  "legacyManagedConfigFile",
  "legacyManagedConfigMdm",
  "unknown",
]);

function optionalRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function record(value: unknown): Record<string, unknown> { return optionalRecord(value) ?? {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }

function normalizedPath(value: unknown): string {
  return text(value).replaceAll("\\", "/").replace(/\/{2,}/g, "/").replace(/\/$/, "");
}

function absolutePath(value: unknown): string {
  const path = normalizedPath(value);
  return path.startsWith("/") || /^[A-Za-z]:\//.test(path) ? path : "";
}

function skillName(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments.at(-2) || "감지된 Skill";
}

function orderedEvents(events: readonly AppEvent[]): AppEvent[] {
  const unique = new Map<number, AppEvent>();
  for (const event of events) if (!unique.has(event.seq)) unique.set(event.seq, event);
  return [...unique.values()].sort((left, right) => left.seq - right.seq);
}

export interface ActivitySnapshotBatch {
  snapshot : AppEvent[] ;
  live     : AppEvent[] ;
}

/** snapshot 요청 중 도착한 live 사건을 같은 seq 경계에서 합치기 위한 renderer 전용 큐다. */
export class ActivitySnapshotBoundary {
  private generation = 0;
  private pending: number | null = null;
  private queued: AppEvent[] = [];

  begin(): number {
    const token = ++this.generation;
    this.pending = token;
    return token;
  }

  queue(event: AppEvent): boolean {
    if (this.pending === null) return false;
    this.queued.push(event);
    return true;
  }

  complete(token: number, snapshot: readonly AppEvent[]): ActivitySnapshotBatch | null {
    if (token !== this.pending) return null;
    const batch = { snapshot: [...snapshot], live: orderedEvents(this.queued) };
    this.pending = null;
    this.queued = [];
    return batch;
  }

  fail(token: number): ActivitySnapshotBatch | null {
    return this.complete(token, []);
  }

  cancel(token: number): void {
    if (token !== this.pending) return;
    this.pending = null;
    this.queued = [];
  }
}

function validErrors(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => {
    const error = optionalRecord(item);
    return error !== null && typeof error.message === "string" && typeof error.path === "string";
  });
}

function responseEntry(value: unknown, cwd: string): { entry: Record<string, unknown> | null; valid: boolean } {
  const response = optionalRecord(value);
  if (!response || !Array.isArray(response.data)) return { entry: null, valid: false };
  const matches = response.data.map(optionalRecord).filter((item): item is Record<string, unknown> => item?.cwd === cwd);
  const entry = matches.length === 1 ? matches.at(0) ?? null : null;
  return { entry, valid: entry !== null && response.data.every((item) => optionalRecord(item) !== null) };
}

function validSkill(value: unknown): value is RawSkillMetadata {
  const item = optionalRecord(value);
  return item !== null
    && typeof item.name        === "string"
    && item.name.length         > 0
    && typeof item.path        === "string"
    && item.path.length         > 0
    && typeof item.description === "string"
    && typeof item.enabled     === "boolean"
    && typeof item.scope       === "string"
    && skillScopes.has(item.scope);
}

function validHookHandler(item: Record<string, unknown>): boolean {
  if (item.handlerType === "command") return typeof item.command === "string" && (item.async === undefined || typeof item.async === "boolean");
  if (item.handlerType === "mcpTool") return typeof item.server === "string" && typeof item.tool === "string";
  return item.handlerType === "prompt" || item.handlerType === "agent";
}

function validHook(value: unknown): value is RawHookMetadata {
  const item = optionalRecord(value);
  return item !== null
    && typeof item.key          === "string"
    && item.key.length           > 0
    && typeof item.eventName    === "string"
    && item.eventName.length     > 0
    && absolutePath(item.sourcePath).length > 0
    && typeof item.displayOrder === "number"
    && Number.isSafeInteger(item.displayOrder)
    && typeof item.enabled      === "boolean"
    && typeof item.currentHash  === "string"
    && typeof item.isManaged    === "boolean"
    && typeof item.timeoutSec   === "number"
    && Number.isSafeInteger(item.timeoutSec)
    && item.timeoutSec          >= 0
    && typeof item.source       === "string"
    && hookSources.has(item.source)
    && typeof item.trustStatus  === "string"
    && hookTrust.has(item.trustStatus)
    && validHookHandler(item);
}

export function parseSkillsListResponse(value: unknown, cwd: string): ActivitySkillsListResult {
  const found                       = responseEntry(value, cwd)                                ;
  const entry                       = found.entry                                              ;
  const input                       = entry && Array.isArray(entry.skills) ? entry.skills : [] ;
  const skills : SkillCatalogItem[] = []                                                       ;
  const paths                       = new Set<string>()                                        ;
  let malformed                     = (
    !found.valid
    || !entry
    || !validErrors(entry.errors)
    || !Array.isArray(entry.skills)
  ) ;
  for (const value of input) {
    if (!validSkill(value)) { malformed = true; continue; }
    const path = normalizedPath(value.path);
    if (paths.has(path)) { malformed = true; continue; }
    paths.add(path);
    skills.push({ name: value.name, path, enabled: value.enabled, scope: value.scope });
  }
  const complete = !malformed && entry !== null && Array.isArray(entry.errors) && entry.errors.length === 0;
  return { complete, skills };
}

export function parseHooksListResponse(value: unknown, cwd: string): ActivityHooksListResult {
  const found                     = responseEntry(value, cwd)                                                                        ;
  const entry                     = found.entry                                                                                      ;
  const input                     = entry && Array.isArray(entry.hooks) ? entry.hooks : []                                           ;
  const hooks : HookCatalogItem[] = []                                                                                               ;
  const keys                      = new Set<string>()                                                                                ;
  const warningsValid             = Array.isArray(entry?.warnings) && entry.warnings.every((warning) => typeof warning === "string") ;
  let malformed                   = (
    !found.valid
    || !entry
    || !validErrors(entry.errors)
    || !warningsValid
    || !Array.isArray(entry.hooks)
  ) ;
  for (const value of input) {
    if (!validHook(value)) { malformed = true; continue; }
    const key = value.key;
    if (keys.has(key)) { malformed = true; continue; }
    keys.add(key);
    hooks.push({
      key,
      eventName    : value.eventName,
      sourcePath   : normalizedPath(value.sourcePath),
      displayOrder : Number(value.displayOrder),
      handlerType  : value.handlerType,
      enabled      : value.enabled,
      source       : value.source,
    });
  }
  const complete = !malformed
    && entry !== null
    && Array.isArray(entry.errors)
    && Array.isArray(entry.warnings)
    && entry.errors.length === 0
    && entry.warnings.length === 0;
  return { complete, hooks };
}

function skillCatalog(event: AppEvent): CatalogSnapshot<SkillCatalogItem> | null {
  if (event.method !== "activity/skillsListed") return null;
  const params                         = record(event.params)          ;
  const items     : SkillCatalogItem[] = []                            ;
  const seenPaths                      = new Set<string>()             ;
  let malformed                        = !Array.isArray(params.skills) ;
  for (const value of list(params.skills)) {
    const item = record(value)             ;
    const path = normalizedPath(item.path) ;
    const name = text(item.name)           ;
    if (
         !path
      || !name
      || typeof item.enabled !== "boolean"
      || seenPaths.has(path)
    ) { malformed = true; continue; }
    seenPaths.add(path);
    items.push({ name, path, enabled: item.enabled, scope: text(item.scope) });
  }
  const generation = Number.isSafeInteger(params.requestGeneration) ? Number(params.requestGeneration) : event.seq;
  return { seq: event.seq, generation, complete: params.complete === true && !malformed, items };
}

function hookCatalog(event: AppEvent): { scope: "workspace" | "thread"; threadId: string | null; snapshot: CatalogSnapshot<HookCatalogItem> } | null {
  if (event.method !== "activity/hooksListed") return null;
  const params   = record(event.params)      ;
  const threadId = text(params.threadId) || null;
  const scope    = params.scope === "thread" || params.scope === "workspace"
    ? params.scope
    : threadId === null ? "workspace" : "thread";

  const items    : HookCatalogItem[] = []                                                                                           ;
  const seenKeys                     = new Set<string>()                                                                            ;
  let malformed                      = !Array.isArray(params.hooks) || (scope === "thread" ? threadId === null : threadId !== null) ;
  for (const value of list(params.hooks)) {
    const item         = record(value)                   ;
    const key          = text(item.key)                  ;
    const eventName    = text(item.eventName)            ;
    const sourcePath   = normalizedPath(item.sourcePath) ;
    const handlerType  = text(item.handlerType)          ;
    const displayOrder = item.displayOrder               ;
    if (
         !key
      || !eventName
      || !sourcePath
      || !handlerType
      || typeof displayOrder !== "number"
      || !Number.isSafeInteger(displayOrder)
      || typeof item.enabled !== "boolean"
      || seenKeys.has(key)
    ) { malformed = true; continue; }
    seenKeys.add(key);
    items.push({ key, eventName, sourcePath, handlerType, displayOrder: Number(displayOrder), enabled: item.enabled, source: text(item.source) });
  }
  const generation = Number.isSafeInteger(params.requestGeneration) ? Number(params.requestGeneration) : event.seq;
  return { scope, threadId, snapshot: { seq: event.seq, generation, complete: params.complete === true && !malformed, items } };
}

function newer<Item>(current: CatalogSnapshot<Item> | null | undefined, candidate: CatalogSnapshot<Item>): boolean {
  return !current || candidate.generation > current.generation || candidate.generation === current.generation && candidate.seq > current.seq;
}

function observationKey(threadId: string, kind: ActivitySidebarKind, identity: string): string {
  return `${threadId}\u0000${kind}\u0000${identity}`;
}

function hookTuple(eventName: unknown, sourcePath: unknown, displayOrder: unknown, handlerType: unknown): string {
  return [text(eventName), normalizedPath(sourcePath), String(displayOrder), text(handlerType)].join("\u0000");
}

function newDedupeIndex(): ActivityDedupeIndex {
  return { buckets: Array.from({ length: DEDUPE_BUCKETS }, () => new Set<string>()), size: 0 };
}

function dedupeBucket(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash % DEDUPE_BUCKETS;
}

function setRecent<Key, Value>(values: Map<Key, Value>, key: Key, value: Value, maximum: number): void {
  values.delete(key);
  values.set(key, value);
  while (values.size > maximum) {
    const oldest = values.keys().next().value as Key | undefined;
    if (oldest === undefined) break;
    values.delete(oldest);
  }
}

function cloneState(state: ActivitySidebarState): ActivitySidebarState {
  return {
    ...state,
    threadHooks      : new Map(state.threadHooks),
    observations     : new Map(state.observations),
    pulses           : [...state.pulses],
  };
}

export function createActivitySidebarState(): ActivitySidebarState {
  return {
    skillsCatalog        : null,
    workspaceHooks       : null,
    threadHooks          : new Map(),
    observations         : new Map(),
    pulses               : [],
    processedThrough     : 0,
    dedupe               : newDedupeIndex(),
    connectionGeneration : null,
    transportThrough     : 0,
    transport            : "disconnected",
    historyTruncated     : false,
  };
}

function observe(state: ActivitySidebarState, observation: ActivityObservation, emitPulse: boolean): void {
  setRecent(state.observations, observationKey(observation.threadId, observation.kind, observation.identity), observation, MAX_OBSERVATIONS);
  if (emitPulse) state.pulses.push(observation);
}

export function updateActivitySidebarState(current: ActivitySidebarState, events: readonly AppEvent[], options: ActivitySidebarUpdateOptions = {}): ActivitySidebarState {
  const state   = cloneState(current);
  const ordered = orderedEvents(events);
  let dedupeWritable = false;
  let dedupeFresh = false;
  const copiedBuckets = new Set<number>();
  const firstSequence = ordered[0]?.seq;
  if (options.historySnapshot && (ordered.length >= MAX_EVENTS || firstSequence !== undefined && firstSequence > state.processedThrough + 1)) {
    state.historyTruncated = true;
  }
  const resetDedupe = () => {
    state.dedupe = newDedupeIndex();
    dedupeWritable = true;
    dedupeFresh = true;
    copiedBuckets.clear();
  };
  const remember = (key: string): boolean => {
    const index = dedupeBucket(key);
    if (state.dedupe.buckets[index]!.has(key)) return false;
    if (!dedupeWritable) {
      state.dedupe = { buckets: [...state.dedupe.buckets], size: state.dedupe.size };
      dedupeWritable = true;
    }
    if (!dedupeFresh && !copiedBuckets.has(index)) {
      state.dedupe.buckets[index] = new Set(state.dedupe.buckets[index]);
      copiedBuckets.add(index);
    }
    state.dedupe.buckets[index]!.add(key);
    state.dedupe.size += 1;
    return true;
  };
  for (const event of ordered) {
    const params = record(event.params);
    if (event.method === "transport/connected" || event.method === "transport/status") {
      const explicitGeneration = Number.isSafeInteger(params.connectionGeneration) && Number(params.connectionGeneration) > 0
        ? Number(params.connectionGeneration)
        : null;
      const generation = explicitGeneration ?? (event.method === "transport/connected" ? event.seq : state.connectionGeneration);
      const previousGeneration = state.connectionGeneration;
      if (generation !== null && (previousGeneration === null || generation > previousGeneration)) {
        state.connectionGeneration = generation;
        if (previousGeneration !== null) resetDedupe();
      }
      const currentGeneration = generation === null || state.connectionGeneration === null || generation >= state.connectionGeneration;
      if (currentGeneration && event.seq > state.transportThrough) {
        state.transportThrough = event.seq;
        if (event.method === "transport/connected") state.transport = "connected";
        else if (params.state === "connected" || params.state === "closed" || params.state === "error" || params.state === "disconnected") state.transport = params.state;
      }
    }
    if ((event.method === "transport/closed" || event.method === "transport/error") && event.seq > state.transportThrough) {
      state.transportThrough = event.seq;
      state.transport = event.method === "transport/closed" ? "closed" : "error";
    }

    const skills = skillCatalog(event);
    if (skills && newer(state.skillsCatalog, skills)) state.skillsCatalog = skills;
    const hooks = hookCatalog(event);
    if (hooks?.scope === "workspace" && newer(state.workspaceHooks, hooks.snapshot)) state.workspaceHooks = hooks.snapshot;
    if (hooks?.scope === "thread" && hooks.threadId && newer(state.threadHooks.get(hooks.threadId), hooks.snapshot)) setRecent(state.threadHooks, hooks.threadId, hooks.snapshot, MAX_THREAD_CATALOGS);

    if (event.seq <= state.processedThrough) continue;
    state.processedThrough = event.seq;

    const threadId = text(params.threadId);
    if (event.method === "hook/completed") {
      const runId = text(record(params.run).id);
      if (threadId && runId) remember(`hook\u0000${threadId}\u0000${runId}`);
      continue;
    }
    if (event.method === "item/started" && threadId) {
      const item   = record(params.item);
      const itemId = text(item.id);
      if (itemId && item.type === "commandExecution") {
        for (const value of list(item.commandActions)) {
          const action = record(value);
          const path   = normalizedPath(action.path);
          if (action.type !== "read" || !/(^|\/)SKILL\.md$/.test(path)) continue;
          const readId = `${threadId}\u0000${text(params.turnId)}\u0000${itemId}\u0000${path}`;
          if (!remember(`read\u0000${readId}`)) continue;
          observe(state, { threadId, kind: "skill", identity: path, at: event.at, seq: event.seq, label: "읽기" }, options.emitPulses === true);
        }
      }
    }
    if (event.method !== "hook/started" || !threadId) continue;
    const run    = record(params.run)          ;
    const runId  = text(run.id)                ;
    const runKey = `${threadId}\u0000${runId}` ;
    if (
         !runId
      || !text(run.eventName)
      || !normalizedPath(run.sourcePath)
      || !text(run.handlerType)
      || typeof run.displayOrder !== "number"
      || !Number.isSafeInteger(run.displayOrder)
      || run.executionMode !== "sync"
      || run.status !== "running"
    ) continue;
    if (!remember(`hook\u0000${runKey}`)) continue;
    const identity = hookTuple(run.eventName, run.sourcePath, run.displayOrder, run.handlerType);
    observe(state, { threadId, kind: "hook", identity, at: event.at, seq: event.seq, label: "시작" }, options.emitPulses === true);
  }
  state.pulses = state.pulses.slice(-MAX_PULSES);
  return state;
}

/** snapshot에 실제 포함된 사건만 복원하고 큐에만 있는 live 활동은 순번과 관계없이 새 반응으로 적용한다. */
export function updateActivitySidebarSnapshot(current: ActivitySidebarState, batch: ActivitySnapshotBatch): ActivitySidebarState {
  const snapshotSequences = new Set(batch.snapshot.map((event) => event.seq));
  const ordered           = orderedEvents([...batch.snapshot, ...batch.live]);
  const firstSequence     = ordered[0]?.seq;
  let state = current;
  if (batch.snapshot.length >= MAX_EVENTS || firstSequence !== undefined && firstSequence > current.processedThrough + 1) {
    state = { ...state, historyTruncated: true };
  }
  for (const event of ordered) {
    const emitPulses = !snapshotSequences.has(event.seq) && event.historical !== true;
    state = updateActivitySidebarState(state, [event], { emitPulses });
  }
  return state;
}

function makeSkillRow(item: SkillCatalogItem): ActivitySidebarRow {
  return { id: `skill:${item.path}`, kind: "skill", label: item.name, detail: item.scope || null, catalogued: true, enabled: item.enabled, lastActivityAt: null, lastActivitySeq: null, lastActivityLabel: null };
}

function makeHookRow(item: HookCatalogItem): ActivitySidebarRow {
  return { id: `hook:${item.key}`, kind: "hook", label: item.eventName, detail: item.key, catalogued: true, enabled: item.enabled, lastActivityAt: null, lastActivitySeq: null, lastActivityLabel: null };
}

function applyObservation(row: ActivitySidebarRow, observation: ActivityObservation): void {
  row.lastActivityAt    = observation.at    ;
  row.lastActivitySeq   = observation.seq   ;
  row.lastActivityLabel = observation.label ;
}

function observedHookId(tuple: string): string { return `hook-observed:${encodeURIComponent(tuple)}`; }

export function projectActivitySidebarState(state: ActivitySidebarState, selectedThreadId: string | null): ActivitySidebarProjection {
  const emptySkills : CatalogSnapshot<SkillCatalogItem> = { seq: 0, generation: 0, complete: false, items: [] };
  const emptyHooks  : CatalogSnapshot<HookCatalogItem>  = { seq: 0, generation: 0, complete: false, items: [] };

  const skillsSnapshot = state.skillsCatalog ?? emptySkills                                ;
  const threadSnapshot = selectedThreadId ? state.threadHooks.get(selectedThreadId) : null ;
  const hooksSnapshot  = threadSnapshot ?? state.workspaceHooks ?? emptyHooks              ;

  const skills          = new Array<ActivitySidebarRow>()         ;
  const hooks           = new Array<ActivitySidebarRow>()         ;
  const skillsByPath    = new Map<string, ActivitySidebarRow>()   ;
  const hookRowsByTuple = new Map<string, ActivitySidebarRow[]>() ;
  for (const item of skillsSnapshot.items) {
    const row = makeSkillRow(item);
    skills.push(row);
    skillsByPath.set(item.path, row);
  }
  for (const item of hooksSnapshot.items) {
    const row   = makeHookRow(item)                                                             ;
    const tuple = hookTuple(item.eventName, item.sourcePath, item.displayOrder, item.handlerType) ;
    hooks.push(row);
    hookRowsByTuple.set(tuple, [...(hookRowsByTuple.get(tuple) ?? []), row]);
  }
  const observedSkills = new Map<string, ActivitySidebarRow>()                                                                                             ;
  const observedHooks  = new Map<string, ActivitySidebarRow>()                                                                                             ;
  const observations   = [...state.observations.values()].filter((item) => item.threadId === selectedThreadId).sort((left, right) => left.seq - right.seq) ;
  for (const observation of observations) {
    if (observation.kind === "skill") {
      let row = skillsByPath.get(observation.identity) ?? observedSkills.get(observation.identity);
      if (!row) {
        row = { id: `skill:${observation.identity}`, kind: "skill", label: skillName(observation.identity), detail: "감지됨", catalogued: false, enabled: true, lastActivityAt: null, lastActivitySeq: null, lastActivityLabel: null };
        observedSkills.set(observation.identity, row);
        skills.push(row);
      }
      applyObservation(row, observation);
      continue;
    }
    const matches = hookRowsByTuple.get(observation.identity) ?? [];
    let row = matches.length === 1 ? matches.at(0) : observedHooks.get(observation.identity);
    if (!row) {
      const [eventName] = observation.identity.split("\u0000");
      row = { id: observedHookId(observation.identity), kind: "hook", label: eventName || "감지된 Hook", detail: "감지됨", catalogued: false, enabled: true, lastActivityAt: null, lastActivitySeq: null, lastActivityLabel: null };
      observedHooks.set(observation.identity, row);
      hooks.push(row);
    }
    applyObservation(row, observation);
  }
  const pulses = state.pulses.filter((pulse) => pulse.threadId === selectedThreadId).map((pulse) => {
    const id = `${pulse.threadId}\u0000${pulse.kind}\u0000${pulse.identity}\u0000${pulse.seq}`;
    if (pulse.kind === "skill") return { id, seq: pulse.seq, rowId: skillsByPath.get(pulse.identity)?.id ?? `skill:${pulse.identity}` };
    const matches = hookRowsByTuple.get(pulse.identity) ?? [];
    const match = matches.length === 1 ? matches.at(0) : null;
    return { id, seq: pulse.seq, rowId: match?.id ?? observedHookId(pulse.identity) };
  });
  return {
    skills,
    hooks,
    skillsComplete   : skillsSnapshot.complete,
    hooksComplete    : hooksSnapshot.complete,
    pulses,
    transport        : state.transport,
    historyTruncated : state.historyTruncated,
  };
}

export function projectActivitySidebar(events: readonly AppEvent[], selectedThreadId: string | null): ActivitySidebarProjection {
  const state = updateActivitySidebarState(createActivitySidebarState(), events, { emitPulses: true, historySnapshot: true });
  return projectActivitySidebarState(state, selectedThreadId);
}
