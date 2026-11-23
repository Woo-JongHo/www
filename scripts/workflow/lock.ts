/**
 * @architecture arch.development.records.lock
 * @implements RESP-DEVELOPMENT-RECORDS-LOCK
 */
import { randomUUID }     from "node:crypto";
import { promises as fs } from "node:fs";
import os                 from "node:os";
import path               from "node:path";

export interface WorkLockOwner {
  schemaVersion : 1       ;
  token         : string  ;
  pid           : number  ;
  hostname      : string  ;
  createdAt?    : unknown ;
  host?         : WorkLockHost ;
  [key: string]: unknown;
}
export type WorkLockValue = WorkLockOwner | { unknown: true };
type WorkLockHost = { state: "idle" | "launching" } | { state: "registered"; pid: number };
type ProcessState = "alive" | "exited" | "unconfirmed";
export interface WorkExecutionHost {
  beforeSpawn(): Promise<void>;
  register(pid: number): Promise<void>;
  finished(): Promise<void>;
}
export type WorkLockState = 'absent' | 'unknown_owner' | 'different_host' | 'owner_alive' | 'owner_exited' | 'owner_unconfirmed' | 'host_alive' | 'host_unconfirmed';
export interface WorkLockInspection {
  status      : WorkLockState        ;
  owner       : WorkLockValue | null ;
  recoverable : boolean              ;
}
function hasCode(error: unknown, code: string): boolean { return error !== null && typeof error === 'object' && 'code' in error && error.code === code; }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validPid(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function validHost(value: unknown): value is WorkLockHost {
  return object(value) && (value.state === "idle" || value.state === "launching" || (value.state === "registered" && validPid(value.pid)));
}

async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory).catch(error => { if (!hasCode(error, "EEXIST")) throw error; });
  if (!(await fs.lstat(directory)).isDirectory()) throw new Error("실행 잠금 경로는 실제 디렉터리여야 합니다.");
}

async function location(repo: string, workId?: string, acquiring = false, scope: unknown = "records") {
  const root      = await fs.realpath(repo) ;
  const directory = path.join(root, ".www") ;
  await fs.mkdir(directory, { recursive: true });
  if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error("작업 잠금 경로는 심볼릭 링크일 수 없습니다.");
  if (scope !== "records" && scope !== "issue-loop") throw new Error("지원하지 않는 작업 잠금 범위입니다.");
  if (scope === "issue-loop") {
    if (workId !== undefined) throw new Error("이슈 루프 잠금에는 작업 ID를 지정할 수 없습니다.");
    return { root, file: path.join(directory, "issue-loop.lock") };
  }
  if (workId !== undefined) {
    if (!/^work-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workId)) throw new Error("유효한 work-id가 필요합니다.");
    const runtime = path.join(directory, "runtime");
    const normalized = workId.toLowerCase();
    const workRuntime = path.join(runtime, normalized);
    const canonical = path.join(workRuntime, "execution.lock");
    await ensureDirectory(runtime);
    const locks: string[] = [];
    for (const entry of await fs.readdir(runtime)) {
      if (entry.toLowerCase() !== normalized) continue;
      const folder = path.join(runtime, entry);
      if (!(await fs.lstat(folder)).isDirectory()) throw new Error("실행 잠금 경로는 실제 디렉터리여야 합니다.");
      const file = path.join(folder, "execution.lock");
      try { await fs.lstat(file); locks.push(file); }
      catch (error) { if (!hasCode(error, "ENOENT")) throw error; }
    }
    if (locks.length > 1) throw new Error("같은 작업의 실행 잠금이 여러 경로에 있어 소유자를 특정할 수 없습니다.");
    if (locks[0] && locks[0] !== canonical) {
      if (acquiring) throw new WorkLockBusyError(workId);
      return { root, file: locks[0] };
    }
    await ensureDirectory(workRuntime);
    return { root, file: canonical };
  }
  return { root, file: path.join(directory, "work-records.lock") };
}

async function owner(file: string): Promise<WorkLockValue | null> {
  let source;
  try {
    if (!(await fs.lstat(file)).isFile()) throw new Error("작업 잠금은 일반 파일이어야 합니다.");
    source = await fs.readFile(file, "utf8");
  } catch (error) { if (hasCode(error, "ENOENT")) return null; throw error; }
  try {
    const value: unknown = JSON.parse(source);
    if (object(value) && value.schemaVersion === 1 && typeof value.token === "string" && /^[a-f0-9-]{36}$/.test(value.token) && validPid(value.pid) && typeof value.hostname === "string") {
      const { host, ...rest } = value;
      if (host === undefined || validHost(host)) return { ...rest, schemaVersion: 1, token: value.token, pid: value.pid, hostname: value.hostname, ...(host === undefined ? {} : { host }) };
    }
  } catch { /* 옛 빈 잠금과 손상된 소유 정보는 임의 회수하지 않는다. */ }
  return { unknown: true };
}

function unknownOwner(value: WorkLockValue): value is { unknown: true } { return Boolean(value.unknown); }
function metadata(): WorkLockOwner { return { schemaVersion: 1, token: randomUUID(), pid: process.pid, hostname: os.hostname(), createdAt: new Date().toISOString() }; }
function processState(pid: number): ProcessState {
  try { process.kill(pid, 0); return "alive"; }
  catch (error) { return hasCode(error, "ESRCH") ? "exited" : "unconfirmed"; }
}
function hostState(host: WorkLockHost | undefined): ProcessState {
  if (host?.state === "idle") return "exited";
  return host?.state === "registered" ? processState(host.pid) : "unconfirmed";
}
function state(value: WorkLockValue | null, execution: boolean): WorkLockState {
  if (!value                          ) return "absent";
  if (unknownOwner(value)             ) return "unknown_owner";
  if (value.hostname !== os.hostname()) return "different_host";
  const parent = processState(value.pid);
  if (parent !== "exited") return parent === "alive" ? "owner_alive" : "owner_unconfirmed";
  if (execution) {
    const host = hostState(value.host);
    if (host !== "exited") return host === "alive" ? "host_alive" : "host_unconfirmed";
  }
  return "owner_exited";
}

export async function inspectWorkLock({ repo = process.cwd(), workId, scope }: { repo?: string; workId?: string; scope?: unknown } = {}): Promise<WorkLockInspection> {
  const { file } = await location(repo, workId, false, scope);
  const value  = await owner(file) ;
  const status = state(value, workId !== undefined);
  return { status, owner: value, recoverable: status === "owner_exited" };
}

export async function recoverWorkLock({ repo = process.cwd(), token, workId, scope }: { repo?: string; token?: unknown; workId?: string; scope?: unknown } = {}) {
  const { file } = await location(repo, workId, false, scope);
  const gate = `${file}.recovery`;
  let handle;
  try { handle = await fs.open(gate, "wx", 0o600); }
  catch (error) { if (hasCode(error, "EEXIST")) throw new Error("다른 실행자가 잠금 복구 중입니다. 복구 프로세스 상태를 확인해야 합니다."); throw error; }
  try {
    await handle.writeFile(JSON.stringify(metadata()));
    const value = await owner(file);
    if (!value || unknownOwner(value) || typeof token !== "string" || value.token !== token) throw new Error("관찰한 잠금 토큰과 현재 소유자가 일치하지 않습니다.");
    if (state(value, workId !== undefined) !== "owner_exited") throw new Error("같은 호스트에서 소유자와 실행 호스트의 종료가 확인된 잠금만 복구할 수 있습니다.");
    // 복구자끼리는 gate로 직렬화한다. 죽은 소유자는 정상 해제할 수 없고 새 소유자는 이 파일이 없어지기 전 wx 생성할 수 없다.
    await fs.unlink(file);
    return { recovered: true, owner: value };
  } finally { await handle.close(); await fs.unlink(gate); }
}

async function publishOwner(file: string, value: WorkLockOwner, replace = false): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, "wx", 0o600);
  try {
    try {
      await handle.writeFile(`${JSON.stringify(value)}\n`);
      await handle.sync();
    } finally { await handle.close(); }
    if (replace) await fs.rename(temporary, file);
    else await fs.link(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

export async function withWorkLock<T>(repo: string, action: (root: string, host: WorkExecutionHost | null) => Promise<T>, { workId, eventId, scope }: { workId?: string; eventId?: string; scope?: "records" | "issue-loop" } = {}): Promise<T> {
  const { root, file } = await location(repo, workId, true, scope);
  const value: WorkLockOwner = { ...metadata(), ...(eventId ? { eventId } : {}), ...(workId ? { host: { state: "idle" } } : {}) };
  const owned = async () => {
    const current = await owner(file);
    if (!current || unknownOwner(current) || current.token !== value.token) throw new Error("작업 잠금 소유자가 바뀌었습니다.");
    return current;
  };
  try {
    // 완성한 metadata를 같은 파일 시스템의 hard link로 원자적으로 공개한다. 쓰기 도중 죽어도 빈 잠금을 남기지 않는다.
    await publishOwner(file, value);
  } catch (error) {
    if (hasCode(error, "EEXIST")) throw new WorkLockBusyError(workId);
    throw error;
  }
  const host: WorkExecutionHost | null = !workId ? null : {
    async beforeSpawn() {
      const current = await owned();
      if (hostState(current.host) !== "exited") throw new Error("이전 실행 호스트의 종료를 확인해야 합니다.");
      await publishOwner(file, { ...current, host: { state: "launching" } }, true);
    },
    async register(pid) {
      const current = await owned();
      if (current.host?.state !== "launching" || !validPid(pid)) throw new Error("준비한 실행에 유효한 호스트 PID가 필요합니다.");
      await publishOwner(file, { ...current, host: { state: "registered", pid } }, true);
    },
    async finished() {
      const current = await owned();
      if (current.host?.state === "registered" && hostState(current.host) !== "exited") throw new Error("실행 호스트의 종료를 확인해야 합니다.");
      await publishOwner(file, { ...current, host: { state: "idle" } }, true);
    },
  };
  try { return await action(root, host); }
  finally {
    const current = await owned();
    if (workId && hostState(current.host) !== "exited") throw new Error("실행 호스트의 종료를 확인할 수 없어 잠금을 유지합니다.");
    await fs.unlink(file);
  }
}

export class WorkLockBusyError extends Error {
  readonly code = "WORK_LOCK_BUSY";
  constructor(workId?: string) {
    super(workId ? "같은 작업이 실행 중입니다. lock-status와 recover-lock으로 소유자를 확인하세요." : "다른 실행자가 작업 기록을 갱신 중입니다. lock-status와 recover-lock으로 확인하세요.");
  }
}
// action 실패는 재시도하지 않는다. 잠금 생성 충돌만 제한 시간 안에서 재시도한다.
export async function retryWorkWriter<T>(write: () => Promise<T>, budgetMs = 500, wait: (sleep: () => Promise<void>) => Promise<void> = sleep => sleep()) {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    try { return await write(); }
    catch (error) {
      if (!(error instanceof WorkLockBusyError) || Date.now() >= deadline) throw error;
      await wait(() => new Promise(resolve => setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now())))));
    }
  }
}
