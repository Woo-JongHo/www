import { promises as fs, constants } from "node:fs";
import path                          from "node:path";
import { randomUUID }                from "node:crypto";
import { assertWorkId }              from "./preflight.ts";

export interface RuntimePaths {
  directory : string ;
  lock      : string ;
  session   : string ;
  events    : string ;
}
export interface RuntimeEvent extends Record<string, unknown> {
  id          : string ;
  revision?   : number ;
  recordedAt? : string ;
}
export interface RuntimeState extends Record<string, unknown> {
  revision         : number   ;
  eventIds         : string[] ;
  postFailure?     : boolean  ;
  mutationUnknown? : boolean  ;
  verification?    : unknown  ;
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function eventValue(value: unknown): RuntimeEvent {
  if (!object(value) || typeof value.id !== "string" || !value.id || (value.revision !== undefined && typeof value.revision !== "number")) throw new Error("잘못된 event 기록입니다.");
  return { ...value, id: value.id, ...(typeof value.revision === "number" ? { revision: value.revision } : {}) };
}
function code(error: unknown): unknown { return object(error) ? error.code : undefined; }

const SECRET_KEY   = /(?:prompt|secret|token|password|authorization|cookie|api[-_]?key|args)/i                 ;
const SECRET_VALUE = /(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/g ;

export function runtimePaths(repo: string, workId: unknown): RuntimePaths {
  const id        = assertWorkId(workId                     ) ;
  const directory = path.join   (repo, ".www", "runtime", id) ;
  return { directory, lock: `${directory}.lock`, session: path.join(directory, "session.json"), events: path.join(directory, "events.jsonl") };
}

export function redact(value: unknown, key = ""): unknown {
  if (SECRET_KEY.test(key)     ) return "[REDACTED]";
  if (typeof value === "string") return value.replace(SECRET_VALUE, "[REDACTED]");
  if (Array.isArray(value)     ) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  }
  return value;
}

async function atomicWrite(file: string, value: string): Promise<void> {
  const temp   = `${file}.${process.pid}.${randomUUID()}.tmp` ;
  const handle = await fs.open(temp, "wx", 0o600)             ;
  try {
    await handle.writeFile(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temp, file);
}

async function assertRegularFile(file: string): Promise<void> {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("runtime 파일 심볼릭 링크나 특수 파일은 허용되지 않습니다.");
  } catch (error) {
    if (code(error) !== "ENOENT") throw error;
  }
}

async function safeRuntime(paths: RuntimePaths): Promise<void> {
  const repo = path.resolve(paths.directory, "..", "..", "..");
  for (const target of [path.join(repo, ".www"), path.join(repo, ".www", "runtime")]) {
    try {
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(".www/runtime 심볼릭 링크는 허용되지 않습니다.");
    } catch (error) {
      if (code(error) !== "ENOENT") throw error;
      await fs.mkdir(target, { mode: 0o700 });
    }
  }
}

export async function withRuntimeLock<T>(repo: string, workId: unknown, callback: (paths: RuntimePaths) => Promise<T>): Promise<T> {
  const paths = runtimePaths(repo, workId);
  await safeRuntime(paths);
  let lock;
  try {
    lock = await fs.open(paths.lock, "wx", 0o600);
  } catch (error) {
    if (code(error) === "EEXIST") throw new Error("작업 기록이 다른 실행자에 의해 잠겨 있습니다.");
    throw error;
  }
  try {
    await fs.mkdir(paths.directory, { recursive: true, mode: 0o700 });
    if ((await fs.lstat(paths.directory)).isSymbolicLink()) throw new Error(".www/runtime 심볼릭 링크는 허용되지 않습니다.");
    return await callback(paths);
  } finally {
    await lock.close();
    await fs.unlink(paths.lock);
  }
}

export async function readRuntime(paths: RuntimePaths): Promise<{session: RuntimeState; events: RuntimeEvent[]}> {
  await assertRegularFile(paths.session);
  await assertRegularFile(paths.events);
  let session: unknown = null ;
  let eventLines       = ""   ;
  try {
    session = JSON.parse(await fs.readFile(paths.session, "utf8"));
  } catch (error) {
    if (code(error) !== "ENOENT") throw error;
  }
  try {
    eventLines = await fs.readFile(paths.events, "utf8");
  } catch (error) {
    if (code(error) !== "ENOENT") throw error;
  }
  if (eventLines && !eventLines.endsWith("\n")) throw new Error("partial JSONL event 기록을 거부합니다.");
  const events = eventLines ? eventLines.slice(0, -1).split("\n").map((line) => {
    try { return eventValue(JSON.parse(line) as unknown); }
    catch { throw new Error("partial JSONL event 기록을 거부합니다."); }
  }) : [];
  const replayed = replayEvents(events);
  if (session && JSON.stringify(session) !== JSON.stringify(replayed)) {
    if (!object(session) || typeof session.revision !== "number" || !Number.isInteger(session.revision) || session.revision >= replayed.revision) throw new Error("runtime state 변조가 감지되었습니다.");
  }
  return { session: replayed, events };
}

function eventPayload(event: RuntimeEvent): string {
  return JSON.stringify({ ...event, revision: undefined, recordedAt: undefined });
}

export function replayEvents(events: readonly unknown[], initial: Record<string, unknown> = {}): RuntimeState {
  const state: RuntimeState = { ...initial, revision: 0, eventIds: [] } ;
  const seen                = new Map<string, string>()                 ;
  for (const value of events) {
    const event = eventValue(value);
    if (!event || typeof event !== "object" || typeof event.id !== "string" || !event.id) throw new Error("잘못된 event 기록입니다.");
    const payload = eventPayload(event);
    if (seen.has(event.id)) {
      if (seen.get(event.id) !== payload) throw new Error("같은 event id의 payload가 다릅니다.");
      continue;
    }
    if (event.revision !== state.revision + 1) throw new Error("event revision 순서가 올바르지 않습니다.");
    seen.set(event.id, payload);
    state.eventIds.push(event.id);
    state.revision = event.revision;
    if (event.type === "status") {
      state.status = event.status;
      if (event.status === "running") {
        delete state.verification;
        delete state.postFailure;
      }
    }
    if (event.type === "verification") state.verification = event.summary;
    if (event.type === "post_failure") {
      state.postFailure = true;
      delete state.verification;
    }
    if (event.type === "mutation_unknown") {
      state.mutationUnknown = true;
      delete state.verification;
    }
  }
  return state;
}

function doneAllowed(state: RuntimeState): boolean {
  const verification       = object(state.verification) ? state.verification : undefined                        ;
  const coverage           = object(verification?.criteriaCoverage) ? verification.criteriaCoverage : undefined ;
  const required : unknown = coverage?.requiredIds                                                              ;
  const passed   : unknown = coverage?.passedIds                                                                ;
  return   !state.postFailure
        && !state.mutationUnknown
        &&  verification?.executed          === true
        &&  typeof verification.commandHash === "string"
        &&  /^[a-f0-9]{64}$/.test(verification.commandHash)
        &&  verification.result             === "passed"
        &&  verification.exitCode           === 0
        && !verification.blocked
        &&  Array.isArray(required)
        &&  required.length > 0
        &&  Array.isArray(passed)
        &&  required.every((id) => passed.includes(id));
}

export async function appendEvent({ repo, workId, event, expectedRevision }: { repo?: string; workId?: unknown; event?: unknown; expectedRevision?: number } = {}) {
  if (!object(event) || typeof event.id !== "string" || !event.id) throw new TypeError("안정적인 event.id가 필요합니다.");
  if (typeof repo !== "string") throw new TypeError("저장소 경로가 필요합니다.");
  return withRuntimeLock(repo, workId, async (paths) => {
    const { session, events } = await readRuntime(paths);
    const sanitized = eventValue (redact(event)                 ) ;
    const existing  = events.find((item) => item.id === event.id) ;
    if (existing) {
      if (eventPayload(existing) !== eventPayload(sanitized)) throw new Error("같은 event id의 payload가 다릅니다.");
      return { duplicate: true, session };
    }
    if (expectedRevision !== undefined && expectedRevision !== session.revision) throw new Error("revision 충돌: 상태를 다시 읽어야 합니다.");
    if (event.type === "status" && event.status === "done" && !doneAllowed(session)) throw new Error("실제 verifier와 필수 기준 통과 증거 없이 완료할 수 없습니다.");
    const stored = { ...sanitized, revision: session.revision + 1, recordedAt: new Date().toISOString() }    ;
    const flags  = constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0) ;
    const handle = await fs.open(paths.events, flags, 0o600)                                                 ;
    try {
      await handle.writeFile(`${JSON.stringify(stored)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    const next = replayEvents([...events, stored]);
    await atomicWrite(paths.session, `${JSON.stringify(next, null, 2)}\n`);
    return { duplicate: false, session: next, event: stored };
  });
}
