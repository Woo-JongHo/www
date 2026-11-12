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
  [key: string]: unknown;
}
export type WorkLockValue = WorkLockOwner | { unknown: true };
export type WorkLockState = 'absent' | 'unknown_owner' | 'different_host' | 'owner_alive' | 'owner_exited' | 'owner_unconfirmed';
export interface WorkLockInspection {
  status      : WorkLockState        ;
  owner       : WorkLockValue | null ;
  recoverable : boolean              ;
}
function hasCode(error: unknown, code: string): boolean { return error !== null && typeof error === 'object' && 'code' in error && error.code === code; }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

async function location(repo: string) {
  const root      = await fs.realpath(repo) ;
  const directory = path.join(root, ".www") ;
  await fs.mkdir(directory, { recursive: true });
  if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error("작업 잠금 경로는 심볼릭 링크일 수 없습니다.");
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
    if (object(value) && value.schemaVersion === 1 && typeof value.token === "string" && /^[a-f0-9-]{36}$/.test(value.token) && typeof value.pid === "number" && Number.isSafeInteger(value.pid) && value.pid > 0 && typeof value.hostname === "string") return { ...value, schemaVersion: 1, token: value.token, pid: value.pid, hostname: value.hostname };
  } catch { /* 옛 빈 잠금과 손상된 소유 정보는 임의 회수하지 않는다. */ }
  return { unknown: true };
}

function unknownOwner(value: WorkLockValue): value is { unknown: true } { return Boolean(value.unknown); }
function metadata(): WorkLockOwner { return { schemaVersion: 1, token: randomUUID(), pid: process.pid, hostname: os.hostname(), createdAt: new Date().toISOString() }; }
function state(value: WorkLockValue | null): WorkLockState {
  if (!value                          ) return "absent";
  if (unknownOwner(value)             ) return "unknown_owner";
  if (value.hostname !== os.hostname()) return "different_host";
  try { process.kill(value.pid, 0); return "owner_alive"; }
  catch (error) { return hasCode(error, "ESRCH") ? "owner_exited" : "owner_unconfirmed"; }
}

export async function inspectWorkLock({ repo = process.cwd() }: { repo?: string } = {}): Promise<WorkLockInspection> {
  const { file } = await location(repo);
  const value  = await owner(file) ;
  const status = state(value)      ;
  return { status, owner: value, recoverable: status === "owner_exited" };
}

export async function recoverWorkLock({ repo = process.cwd(), token }: { repo?: string; token?: unknown } = {}) {
  const { file } = await location(repo);
  const gate = `${file}.recovery`;
  let handle;
  try { handle = await fs.open(gate, "wx", 0o600); }
  catch (error) { if (hasCode(error, "EEXIST")) throw new Error("다른 실행자가 잠금 복구 중입니다. 복구 프로세스 상태를 확인해야 합니다."); throw error; }
  try {
    await handle.writeFile(JSON.stringify(metadata()));
    const value = await owner(file);
    if (!value || unknownOwner(value) || typeof token !== "string" || value.token !== token) throw new Error("관찰한 잠금 토큰과 현재 소유자가 일치하지 않습니다.");
    if (state(value) !== "owner_exited") throw new Error("같은 호스트에서 종료가 확인된 소유자의 잠금만 복구할 수 있습니다.");
    // 복구자끼리는 gate로 직렬화한다. 죽은 소유자는 정상 해제할 수 없고 새 소유자는 이 파일이 없어지기 전 wx 생성할 수 없다.
    await fs.unlink(file);
    return { recovered: true, owner: value };
  } finally { await handle.close(); await fs.unlink(gate); }
}

export async function withWorkLock<T>(repo: string, action: (root: string) => Promise<T>): Promise<T> {
  const { root, file } = await location(repo);
  const value     = metadata()                            ;
  const temporary = `${file}.${value.token}.tmp`          ;
  const handle    = await fs.open(temporary, "wx", 0o600) ;
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`);
    await handle.sync();
  } finally { await handle.close(); }
  try {
    // 완성한 metadata를 같은 파일 시스템의 hard link로 원자적으로 공개한다. 쓰기 도중 죽어도 빈 잠금을 남기지 않는다.
    await fs.link(temporary, file);
  } catch (error) {
    if (hasCode(error, "EEXIST")) throw new Error("다른 실행자가 작업 기록을 갱신 중입니다. 종료된 실행이면 lock-status와 recover-lock으로 확인·복구하세요.");
    throw error;
  } finally { await fs.unlink(temporary); }
  try { return await action(root); }
  finally {
    const current = await owner(file);
    if (!current || unknownOwner(current) || current.token !== value.token) throw new Error("작업 잠금 소유자가 바뀌어 임의 해제하지 않습니다.");
    await fs.unlink(file);
  }
}
