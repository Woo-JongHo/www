/**
 * Node 전용 단일 소유자 원장. main은 userData 단일 인스턴스 lock을 먼저 획득한다.
 * @architecture arch.native.resources
 * @implements RESP-NATIVE-RESOURCES
 */
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import type { ResourceScope, ResourceObservation, ResourceObservationInput, ResourceSnapshot, ResourceCoverage, ResourceGap } from "./shared";

const THREAD_BYTES = 4 * 1024 * 1024;
const GLOBAL_BYTES = 64 * 1024 * 1024;
const HEADER_BYTES = 8 * 1024;
const GLOBAL_RESERVE = 64 * 1024;
const MAX_OBSERVATIONS = 10_000;
const SCHEMA = 1;

/** 이 모듈의 실패·경쟁 시험용 IO 경계. 제품 한도는 변경할 수 없다. */
export interface ActivityLedgerIO {
  beforeRead?: (path: string) => Promise<void>;
  beforeWrite?: (path: string) => Promise<void>;
  beforeRename?: (temporary: string, destination: string) => Promise<void>;
}

export interface ActivityLedgerOptions {
  userData: string;
  processEpoch: string;
  onSnapshot?: (snapshot: ResourceSnapshot) => void;
  io?: ActivityLedgerIO;
}

export interface ActivityLedger {
  scope(workspacePath: string, threadId: string): Promise<ResourceScope>;
  select(scope: ResourceScope, selectionEpoch: number): Promise<ResourceSnapshot>;
  snapshot(scope: ResourceScope): ResourceSnapshot;
  upsert(scope: ResourceScope, input: ResourceObservationInput): Promise<ResourceSnapshot>;
  gap(scope: ResourceScope, reason: ResourceGap): ResourceSnapshot;
  flush(): Promise<{ clean: boolean; failedScopes: ResourceScope[] }>;
  close(): Promise<{ clean: boolean }>;
}

type DiskBody = {
  schemaVersion: number;
  scope: ResourceScope;
  revision: number;
  observations: ResourceObservation[];
  coverage: ResourceCoverage;
  dirty: boolean;
};
type DiskRecord = DiskBody & { checksum: string };
type State = {
  scope: ResourceScope;
  selectionEpoch: number;
  rows: Map<string, ResourceObservation>;
  revision: number;
  durableRevision: number;
  coverage: ResourceCoverage;
  storage: ResourceSnapshot["storage"];
  loading: Promise<void> | null;
  ready: boolean;
  pending: boolean;
  // 현재 최종 파일의 dirty 표시와 최초 checkpoint 미확정 본문은 별개다.
  checkpoint: boolean;
  checkpointBody: DiskBody | null;
  protected: boolean;
  persistedBytes: number;
};

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown, bytes = 2048): value is string {
  return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= bytes && !value.includes("\0");
}

function validScope(value: ResourceScope): boolean {
  return /^[a-f0-9]{64}$/.test(value.workspaceKey) && text(value.threadId);
}

function key(scope: ResourceScope): string {
  if (!validScope(scope)) throw new Error("유효하지 않은 원장 scope");
  return JSON.stringify([scope.workspaceKey, scope.threadId]);
}

function normalize(input: ResourceObservationInput): ResourceObservationInput | null {
  if (!input || !input.resource || !input.source) return null;
  const resource = input.resource;
  if (!["skill", "hook", "document", "tool"].includes(resource.kind) || !text(resource.identity)) return null;
  if (typeof resource.label !== "string" || !["invoke", "read"].includes(input.action)) return null;
  if (!["observed", "running", "completed", "failed", "unknown"].includes(input.status)) return null;
  const source = input.source;
  if (source.kind === "hook") {
    if (!text(source.hookRunId) || !text(source.providerRunNamespace) || !(source.turnId === null || text(source.turnId))) return null;
    return {
      source: { kind: "hook", hookRunId: source.hookRunId, turnId: source.turnId, providerRunNamespace: source.providerRunNamespace },
      resource: { kind: resource.kind, identity: resource.identity, label: Array.from(resource.label).slice(0, 256).join("") },
      action: input.action, status: input.status,
    };
  }
  if (source.kind !== "item" || !text(source.itemId) || !text(source.turnId)) return null;
  if (source.nativeInvocationId !== undefined && !text(source.nativeInvocationId)) return null;
  return {
    source: { kind: "item", itemId: source.itemId, turnId: source.turnId, ...(source.nativeInvocationId === undefined ? {} : { nativeInvocationId: source.nativeInvocationId }) },
    resource: { kind: resource.kind, identity: resource.identity, label: Array.from(resource.label).slice(0, 256).join("") },
    action: input.action, status: input.status,
  };
}

function observationId(scope: ResourceScope, input: ResourceObservationInput): string {
  const source = input.source;
  const tuple = source.kind === "hook"
    ? [SCHEMA, scope.workspaceKey, scope.threadId, "hook", source.providerRunNamespace, source.hookRunId, input.resource.identity, input.action]
    : [SCHEMA, scope.workspaceKey, scope.threadId, source.turnId, "item", source.itemId, input.resource.kind, input.resource.identity, input.action];
  return hash(JSON.stringify(tuple));
}

function terminal(status: ResourceObservation["status"]): boolean {
  return status === "completed" || status === "failed";
}

function merge(previous: ResourceObservation | undefined, next: ResourceObservation): ResourceObservation {
  if (!previous) return next;
  const result: ResourceObservation = structuredClone(next);
  result.conflicts = { ...previous.conflicts, ...next.conflicts };
  if (previous.source.kind === "hook" && result.source.kind === "hook") {
    if (previous.conflicts?.turn || next.conflicts?.turn || (previous.source.turnId !== null && result.source.turnId !== null && previous.source.turnId !== result.source.turnId)) {
      result.source.turnId = null;
      result.conflicts.turn = true;
    } else result.source.turnId ??= previous.source.turnId;
  }
  if (previous.conflicts?.terminal || next.conflicts?.terminal || (terminal(previous.status) && terminal(next.status) && previous.status !== next.status)) {
    result.status = "unknown";
    result.conflicts.terminal = true;
  } else if (terminal(previous.status) || (previous.status === "running" && next.status === "observed")) result.status = previous.status;
  if (Object.keys(result.conflicts).length === 0) delete result.conflicts;
  return result;
}

function body(state: State, dirty: boolean): DiskBody {
  return {
    schemaVersion: SCHEMA, scope: state.scope, revision: state.revision,
    observations: [...state.rows.values()], coverage: state.coverage, dirty,
  };
}

function encode(value: DiskBody): string {
  return JSON.stringify({ ...value, checksum: hash(JSON.stringify(value)) });
}

const gaps: ResourceGap[] = ["native-missing", "unstable-id", "disconnect", "unclean-exit", "retention-limit", "corrupt", "unsupported-version", "read-failed", "write-failed"];

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 외부 JSON은 좁힌 뒤 허용 필드만 재구성한다. 추가 필드도 거부하여 원문 저장을 차단한다. */
function decode(raw: string, scope: ResourceScope): DiskRecord {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("corrupt"); }
  if (!object(value)) throw new Error("corrupt");
  if (value.schemaVersion !== SCHEMA) throw new Error("unsupported-version");
  if (Object.keys(value).sort().join() !== "checksum,coverage,dirty,observations,revision,schemaVersion,scope") throw new Error("corrupt");
  if (!object(value.scope) || Object.keys(value.scope).sort().join() !== "threadId,workspaceKey" || value.scope.workspaceKey !== scope.workspaceKey || value.scope.threadId !== scope.threadId) throw new Error("corrupt");
  if (!Number.isSafeInteger(value.revision) || typeof value.revision !== "number" || value.revision < 0 || typeof value.dirty !== "boolean") throw new Error("corrupt");
  if (!Array.isArray(value.observations) || value.observations.length > MAX_OBSERVATIONS || !object(value.coverage)) throw new Error("corrupt");
  const coverage = value.coverage;
  if (Object.keys(coverage).sort().join() !== "completeness,gaps,startedAt" || !(coverage.startedAt === null || (typeof coverage.startedAt === "string" && coverage.startedAt.length <= 64 && Number.isFinite(Date.parse(coverage.startedAt))))) throw new Error("corrupt");
  if (!["partial", "complete-for-covered-range"].includes(String(coverage.completeness)) || !Array.isArray(coverage.gaps) || coverage.gaps.length > gaps.length || !coverage.gaps.every((gap) => gaps.includes(gap))) throw new Error("corrupt");
  const observations: ResourceObservation[] = [];
  const ids = new Set<string>();
  for (const row of value.observations) {
    if (!object(row) || !object(row.source) || !object(row.resource)) throw new Error("corrupt");
    const source = row.source;
    const resource = row.resource;
    if (!["hook", "item"].includes(String(source.kind)) || !["skill", "hook", "document", "tool"].includes(String(resource.kind))) throw new Error("corrupt");
    // JSON 구조를 아래 좁히기로 검증하며 assertion으로 외부 타입을 신뢰하지 않는다.
    const candidate = parseObservation(row);
    if (!candidate || candidate.id !== observationId(scope, candidate) || ids.has(candidate.id)) throw new Error("corrupt");
    ids.add(candidate.id);
    observations.push(candidate);
  }
  const parsedCoverage: ResourceCoverage = {
    startedAt: typeof coverage.startedAt === "string" ? coverage.startedAt : null,
    completeness: coverage.completeness === "complete-for-covered-range" ? "complete-for-covered-range" : "partial",
    gaps: gaps.filter((gap) => coverage.gaps instanceof Array && coverage.gaps.includes(gap)),
  };
  const parsed: DiskBody = { schemaVersion: SCHEMA, scope, revision: value.revision, observations, coverage: parsedCoverage, dirty: value.dirty };
  // 원본의 키 순서도 포함한 직렬화 계약을 유지한다.
  const { checksum, ...original } = value;
  if (typeof checksum !== "string" || checksum !== hash(JSON.stringify(original))) throw new Error("corrupt");
  if (Buffer.byteLength(JSON.stringify(observations)) > THREAD_BYTES - HEADER_BYTES) throw new Error("corrupt");
  return { ...parsed, checksum };
}

function parseObservation(row: Record<string, unknown>): ResourceObservation | null {
  if (!object(row.source) || !object(row.resource) || typeof row.id !== "string") return null;
  if (Object.keys(row).some((name) => !["id", "source", "resource", "action", "status", "conflicts"].includes(name))) return null;
  const source = row.source;
  const resource = row.resource;
  if (Object.keys(resource).sort().join() !== "identity,kind,label" || !text(resource.identity) || typeof resource.label !== "string" || Array.from(resource.label).length > 256) return null;
  if (resource.kind !== "skill" && resource.kind !== "hook" && resource.kind !== "document" && resource.kind !== "tool") return null;
  if (row.action !== "invoke" && row.action !== "read") return null;
  if (row.status !== "observed" && row.status !== "running" && row.status !== "completed" && row.status !== "failed" && row.status !== "unknown") return null;
  let parsedSource: ResourceObservation["source"];
  if (source.kind === "hook") {
    if (Object.keys(source).sort().join() !== "hookRunId,kind,providerRunNamespace,turnId" || !text(source.hookRunId) || !text(source.providerRunNamespace) || !(source.turnId === null || text(source.turnId))) return null;
    parsedSource = { kind: "hook", hookRunId: source.hookRunId, providerRunNamespace: source.providerRunNamespace, turnId: source.turnId };
  } else {
    if (source.kind !== "item" || !text(source.itemId) || !text(source.turnId) || (source.nativeInvocationId !== undefined && !text(source.nativeInvocationId))) return null;
    if (Object.keys(source).some((name) => !["kind", "itemId", "turnId", "nativeInvocationId"].includes(name))) return null;
    parsedSource = { kind: "item", itemId: source.itemId, turnId: source.turnId, ...(source.nativeInvocationId === undefined ? {} : { nativeInvocationId: source.nativeInvocationId }) };
  }
  const result: ResourceObservation = { id: row.id, source: parsedSource, resource: { kind: resource.kind, identity: resource.identity, label: resource.label }, action: row.action, status: row.status };
  if (row.conflicts !== undefined) {
    if (!object(row.conflicts) || Object.entries(row.conflicts).some(([name, flag]) => !["turn", "terminal"].includes(name) || flag !== true)) return null;
    result.conflicts = { ...(row.conflicts.turn === true ? { turn: true } : {}), ...(row.conflicts.terminal === true ? { terminal: true } : {}) };
    if (result.conflicts.terminal && result.status !== "unknown") return null;
    if (result.conflicts.turn && (result.source.kind !== "hook" || result.source.turnId !== null)) return null;
  }
  return result;
}

function errorCode(error: unknown): string | undefined {
  return object(error) && typeof error.code === "string" ? error.code : undefined;
}

export function createActivityLedger(options: ActivityLedgerOptions): ActivityLedger {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.processEpoch)) throw new Error("processEpoch UUID 필요");
  const trustedRoot = resolve(options.userData);
  const root = join(trustedRoot, "activity-v1");
  const states = new Map<string, State>();
  const admissions = new Set<Promise<ResourceSnapshot>>();
  let queue = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let diskUsage = 0;
  let stopping = false;
  let expired = false;
  let closing: Promise<{ clean: boolean }> | null = null;

  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  function get(scope: ResourceScope): State {
    const state = states.get(key(scope));
    if (!state) throw new Error("select로 scope를 먼저 등록해야 함");
    return state;
  }

  function snapshot(state: State): ResourceSnapshot {
    return structuredClone({ scope: state.scope, processEpoch: options.processEpoch, selectionEpoch: state.selectionEpoch, revision: state.revision, durableRevision: state.durableRevision, observations: [...state.rows.values()], coverage: state.coverage, storage: state.storage });
  }

  function notify(state: State): void {
    // UI 구독자 예외가 저장 큐나 관측 수집을 중단시키지 않는다.
    try { options.onSnapshot?.(snapshot(state)); } catch { /* 구독자의 오류 처리는 caller 책임 */ }
  }

  function addGap(state: State, reason: ResourceGap): void {
    if (!state.coverage.gaps.includes(reason)) {
      state.coverage.gaps.push(reason);
      state.revision++;
      state.pending = true;
    }
    state.coverage.completeness = "partial";
  }

  async function directory(path: string): Promise<void> {
    try { await fs.mkdir(path, { mode: 0o700 }); } catch (error) { if (errorCode(error) !== "EEXIST") throw error; }
    const stat = await fs.lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(path) !== path) throw new Error("저장 경로 symlink 거부");
    if (process.platform !== "win32") await fs.chmod(path, 0o700);
  }

  async function pathFor(scope: ResourceScope): Promise<string> {
    key(scope);
    // trusted userData 자체는 caller가 제공하되 저장 하위 경로의 별칭은 허용하지 않는다.
    if (await fs.realpath(trustedRoot) !== trustedRoot) throw new Error("userData는 실제 경로여야 함");
    await directory(root);
    const dir = join(root, scope.workspaceKey);
    await directory(dir);
    const path = join(dir, `${hash(scope.threadId)}.json`);
    try {
      const stat = await fs.lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("원장 파일 링크 거부");
    } catch (error) { if (errorCode(error) !== "ENOENT") throw error; }
    return path;
  }

  async function usage(path = root): Promise<number> {
    let total = 0;
    for (const name of await fs.readdir(path)) {
      const child = join(path, name);
      const stat = await fs.lstat(child);
      if (stat.isSymbolicLink()) throw new Error("저장 영역 symlink 거부");
      if (stat.isDirectory()) total += await usage(child);
      else if (stat.isFile()) total += stat.size;
      else throw new Error("저장 영역 특수 파일 거부");
    }
    return total;
  }

  async function atomic(state: State, value: DiskBody, permit: () => boolean = () => true): Promise<void> {
    if (state.protected) throw new Error("보전된 원장을 덮지 않음");
    const path = await pathFor(state.scope);
    const data = encode(value);
    if (Buffer.byteLength(data) > THREAD_BYTES) throw new Error("retention-limit");
    decode(data, state.scope);
    let oldBytes = 0;
    try { oldBytes = (await fs.lstat(path)).size; } catch (error) { if (errorCode(error) !== "ENOENT") throw error; }
    const used = await usage();
    diskUsage = used;
    // 기존 최종판과 임시판이 함께 존재하는 최대 시점도 전역 한도에 포함한다.
    const fileBytes = Buffer.byteLength(data);
    // 신규 scope는 종료 여유를 소비하지 않는다. 기존 파일의 경고·종료 메타데이터는
    // 예약 공간을 쓸 수 있지만 임시판까지 합한 실제 전체 상한은 넘지 않는다.
    if (used + fileBytes > GLOBAL_BYTES || (oldBytes === 0 && used + fileBytes > GLOBAL_BYTES - GLOBAL_RESERVE)) throw new Error("retention-limit");
    await options.io?.beforeWrite?.(path);
    if (!permit()) throw new Error("shutdown-timeout");
    const temporary = `${path}.${randomUUID()}.tmp`;
    let handle: fs.FileHandle | undefined;
    let renamed = false;
    try {
      handle = await fs.open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      await handle.writeFile(data, "utf8");
      const written = await fs.readFile(temporary, "utf8");
      if (written !== data) throw new Error("임시 원장 검증 실패");
      decode(written, state.scope);
      await handle.sync();
      await handle.close();
      handle = undefined;
      await options.io?.beforeRename?.(temporary, path);
      await pathFor(state.scope);
      if (!permit()) throw new Error("shutdown-timeout");
      await fs.rename(temporary, path);
      renamed = true;
      state.durableRevision = value.revision;
      state.checkpoint = value.dirty;
      if (value === state.checkpointBody) state.checkpointBody = null;
      state.persistedBytes = Buffer.byteLength(data);
      diskUsage = used + state.persistedBytes - oldBytes;
      if (process.platform !== "win32") {
        const dir = await fs.open(join(root, state.scope.workspaceKey), "r");
        try { await dir.sync(); } finally { await dir.close(); }
      }
      if (!permit()) throw new Error("shutdown-timeout");
    } finally {
      await handle?.close();
      if (!renamed) await fs.unlink(temporary).catch(() => undefined);
    }
  }

  async function persist(state: State, dirty = true, permit?: () => boolean): Promise<boolean> {
    if (!state.ready || state.protected) return false;
    const value = structuredClone(body(state, dirty));
    state.storage = "saving";
    notify(state);
    try {
      if (state.checkpointBody) {
        await atomic(state, state.checkpointBody, permit);
        state.checkpoint = true;
      }
      await atomic(state, value, permit);
      state.durableRevision = value.revision;
      state.checkpoint = dirty;
      state.pending = state.revision !== value.revision;
      state.storage = state.coverage.gaps.includes("retention-limit") ? "full" : state.pending ? "saving" : "saved";
      notify(state);
      return true;
    } catch (error) {
      const full = error instanceof Error && error.message === "retention-limit";
      addGap(state, full ? "retention-limit" : "write-failed");
      state.storage = full ? "full" : "volatile";
      notify(state);
      return false;
    }
  }

  function schedule(): void {
    if (timer || stopping) return;
    timer = setTimeout(() => {
      timer = null;
      void serial(async () => {
        for (const state of states.values()) if (state.pending && state.ready) await persist(state);
      });
    }, 100);
  }

  async function load(state: State): Promise<void> {
    let disk: DiskRecord | null = null;
    let path: string | null = null;
    try {
      path = await pathFor(state.scope);
      await options.io?.beforeRead?.(path);
      diskUsage = await usage();
      const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      let raw: string;
      try {
        state.persistedBytes = (await handle.stat()).size;
        if (state.persistedBytes > THREAD_BYTES) throw new Error("corrupt");
        raw = await handle.readFile("utf8");
      } finally { await handle.close(); }
      disk = decode(raw, state.scope);
    } catch (error) {
      if (errorCode(error) === "ENOENT" && path) {
        try {
          const prefix = `${hash(state.scope.threadId)}.json.`;
          const preserved = (await fs.readdir(join(root, state.scope.workspaceKey))).filter((name) => name.startsWith(prefix) && name.endsWith(".quarantine"));
          if (preserved.length > 0) {
            addGap(state, preserved.some((name) => name.endsWith(".unsupported-version.quarantine")) ? "unsupported-version" : "corrupt");
            state.protected = true;
            state.storage = "corrupt";
          }
        } catch {
          addGap(state, "read-failed");
          state.protected = true;
          state.storage = "unavailable";
        }
      } else if (errorCode(error) !== "ENOENT") {
        const reason: ResourceGap = error instanceof Error && error.message === "unsupported-version" ? "unsupported-version" : error instanceof Error && error.message === "corrupt" ? "corrupt" : "read-failed";
        addGap(state, reason);
        state.storage = reason === "read-failed" ? "unavailable" : "corrupt";
        // 같은 최종 파일을 그대로 격리한다. 보전 bytes는 전역 용량에 계속 포함된다.
        state.protected = true;
        if (path && reason !== "read-failed") {
          try { await fs.rename(path, `${path}.${randomUUID()}.${reason}.quarantine`); } catch { /* 원본을 제자리에 보전하고 계속 쓰기 금지 */ }
        }
      }
    }
    if (disk) {
      const restored = new Map<string, ResourceObservation>();
      for (const row of disk.observations) {
        restored.set(row.id, { ...row, status: row.status === "running" ? "unknown" : row.status });
      }
      state.rows = restored;
      state.revision += disk.revision;
      state.durableRevision = disk.revision;
      const liveGaps = state.coverage.gaps;
      const startedAt = disk.coverage.startedAt ?? state.coverage.startedAt;
      state.coverage = { ...disk.coverage, startedAt, gaps: [...new Set([...disk.coverage.gaps, ...liveGaps])] };
      if (disk.dirty) addGap(state, "unclean-exit");
      if (disk.observations.some((row) => row.status === "running")) state.revision++;
      if (state.coverage.gaps.length > 0) state.coverage.completeness = "partial";
      if (disk.observations.some((row) => row.status === "running")) state.pending = true;
    }
    state.ready = true;
    // 초기 복원과 dirty 확정 시도를 마친 뒤에만 대기 중 관측을 수용한다.
    if (!state.protected) {
      const checkpointBody: DiskBody = disk ? { schemaVersion: SCHEMA, scope: disk.scope, revision: disk.revision, observations: disk.observations, coverage: disk.coverage, dirty: true } : body(state, true);
      state.checkpointBody = checkpointBody;
      try {
        await atomic(state, checkpointBody);
        state.checkpoint = true;
        state.storage = state.coverage.gaps.includes("retention-limit") ? "full" : state.pending ? "saving" : "saved";
      }
      catch { addGap(state, "write-failed"); state.storage = "volatile"; }
    }
    notify(state);
    if (state.pending) schedule();
  }

  async function flush(): Promise<{ clean: boolean; failedScopes: ResourceScope[] }> {
    if (timer) { clearTimeout(timer); timer = null; }
    return serial(async () => {
      const failedScopes: ResourceScope[] = [];
      for (const state of states.values()) {
        if (!state.ready || state.protected) { failedScopes.push({ ...state.scope }); continue; }
        while (state.pending || !state.checkpoint) {
          if (!await persist(state)) { failedScopes.push({ ...state.scope }); break; }
        }
      }
      return { clean: failedScopes.length === 0, failedScopes };
    });
  }

  return {
    async scope(workspacePath, threadId) {
      const actual = await fs.realpath(workspacePath);
      if (!(await fs.stat(actual)).isDirectory()) throw new Error("workspace 디렉터리 필요");
      const result = { workspaceKey: hash(actual), threadId };
      key(result);
      return result;
    },
    async select(scope, selectionEpoch) {
      if (stopping) throw new Error("원장 종료 중");
      if (!Number.isSafeInteger(selectionEpoch) || selectionEpoch < 0) throw new Error("선택 세대 오류");
      const id = key(scope);
      let state = states.get(id);
      if (!state) {
        state = {
          scope: { ...scope }, selectionEpoch, rows: new Map(), revision: 0, durableRevision: 0,
          coverage: { startedAt: null, completeness: "partial", gaps: [] }, storage: "saving",
          loading: null, ready: false, pending: false, checkpoint: false, checkpointBody: null, protected: false, persistedBytes: 0,
        };
        states.set(id, state);
        const selected = state;
        state.loading = serial(() => load(selected));
      } else state.selectionEpoch = selectionEpoch;
      await state.loading;
      return snapshot(state);
    },
    snapshot(scope) { return snapshot(get(scope)); },
    async upsert(scope, input) {
      if (stopping) throw new Error("원장 수집 종료됨");
      const state = get(scope);
      const normalized = normalize(input);
      const admission = (async () => {
        await state.loading;
        if (!normalized) {
          addGap(state, "unstable-id");
          schedule();
          notify(state);
          return snapshot(state);
        }
        const id = observationId(state.scope, normalized);
        const previous = state.rows.get(id);
        const next = merge(previous, { ...normalized, id });
        if (JSON.stringify(previous) === JSON.stringify(next)) return snapshot(state);
        const rows = new Map(state.rows);
        rows.set(id, next);
        const rowBytes = Buffer.byteLength(JSON.stringify([...rows.values()]));
        const stagedBytes = [...states.values()].reduce((total, current) => total + Math.max(0, Buffer.byteLength(encode(body(current, true))) - current.persistedBytes), 0);
        const growth = Math.max(0, rowBytes - Buffer.byteLength(JSON.stringify([...state.rows.values()])));
        if (rows.size > MAX_OBSERVATIONS || rowBytes > THREAD_BYTES - HEADER_BYTES || diskUsage + stagedBytes + growth > GLOBAL_BYTES - GLOBAL_RESERVE) {
          addGap(state, "retention-limit");
          state.storage = "full";
        } else {
          state.rows = rows;
          state.coverage.startedAt ??= new Date().toISOString();
          state.revision++;
          state.pending = true;
          if (state.storage !== "corrupt" && state.storage !== "unavailable" && state.storage !== "full") state.storage = state.checkpoint ? "saving" : "volatile";
        }
        notify(state);
        schedule();
        return snapshot(state);
      })();
      admissions.add(admission);
      void admission.then(() => admissions.delete(admission), () => admissions.delete(admission));
      return admission;
    },
    gap(scope, reason) {
      if (stopping) throw new Error("원장 수집 종료됨");
      if (!gaps.includes(reason)) throw new Error("알 수 없는 누락 사유");
      const state = get(scope);
      addGap(state, reason);
      schedule();
      notify(state);
      return snapshot(state);
    },
    flush,
    close() {
      if (closing) return closing;
      stopping = true;
      const deadline = Date.now() + 2000;
      closing = new Promise((resolveClose) => {
        const timeout = setTimeout(() => {
          expired = true;
          for (const state of states.values()) { addGap(state, "unclean-exit"); state.storage = "volatile"; notify(state); }
          resolveClose({ clean: false });
        }, 2000);
        void (async () => {
          await Promise.allSettled([...admissions]);
          let clean = (await flush()).clean;
          if (clean && !expired) {
            clean = await serial(async () => {
              for (const state of states.values()) {
                if (expired || Date.now() >= deadline || !await persist(state, false, () => !expired && Date.now() < deadline)) return false;
              }
              return !expired && Date.now() < deadline;
            });
          }
          if (expired || !clean) {
            // OS rename가 deadline을 넘어 돌아온 경우에도 clean 성공으로 반환하지 않는다.
            // 가능한 동안 dirty로 되돌리며 강제 종료·전원 장애 내구성은 보장하지 않는다.
            await serial(async () => { for (const state of states.values()) if (state.ready && !state.protected) await persist(state, true); });
          }
          clearTimeout(timeout);
          resolveClose({ clean: clean && !expired });
        })().catch(() => { clearTimeout(timeout); resolveClose({ clean: false }); });
      });
      return closing;
    },
  };
}
