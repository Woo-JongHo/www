import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assertWorkId } from "./preflight.mjs";

const SECRET_KEY = /(?:prompt|secret|token|password|authorization|cookie|api[-_]?key)/i;
const SECRET_VALUE = /(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/g;

export function runtimePaths(repo, workId) {
  assertWorkId(workId);
  const directory = path.join(repo, ".www", "runtime", workId);
  return { directory, lock: `${directory}.lock`, session: path.join(directory, "session.json"), events: path.join(directory, "events.jsonl") };
}

export function redact(value, key = "") {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.replace(SECRET_VALUE, "[REDACTED]");
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  return value;
}

async function atomicWrite(file, value) {
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temp, "w", 0o600);
  try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(temp, file);
}

export async function withRuntimeLock(repo, workId, callback) {
  const paths = runtimePaths(repo, workId);
  await fs.mkdir(path.dirname(paths.directory), { recursive: true });
  let lock;
  try { lock = await fs.open(paths.lock, "wx", 0o600); }
  catch (error) { if (error?.code === "EEXIST") throw new Error("작업 기록이 다른 실행자에 의해 잠겨 있습니다."); throw error; }
  try { await fs.mkdir(paths.directory, { recursive: true }); return await callback(paths); }
  finally { await lock.close(); await fs.unlink(paths.lock); }
}

export async function readRuntime(paths) {
  let session = null;
  let eventLines = "";
  try { session = JSON.parse(await fs.readFile(paths.session, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  try { eventLines = await fs.readFile(paths.events, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const events = eventLines.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  return { session, events };
}

export function replayEvents(events, initial = {}) {
  const state = { ...initial, revision: initial.revision ?? 0, eventIds: [...(initial.eventIds ?? [])] };
  const seen = new Set(state.eventIds);
  for (const event of events) {
    if (!event || typeof event !== "object" || typeof event.id !== "string") throw new Error("잘못된 event 기록입니다.");
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    state.eventIds.push(event.id);
    state.revision = Math.max(state.revision, event.revision ?? state.revision);
    if (event.type === "status" && typeof event.status === "string") state.status = event.status;
    if (event.type === "verification") state.verification = event.summary;
    if (event.type === "post_failure") state.postFailure = true;
    if (event.type === "mutation_unknown") state.mutationUnknown = true;
  }
  return state;
}

export async function appendEvent({ repo, workId, event, expectedRevision } = {}) {
  if (!event || typeof event !== "object" || typeof event.id !== "string" || !event.id) throw new TypeError("안정적인 event.id가 필요합니다.");
  return withRuntimeLock(repo, workId, async (paths) => {
    const { session, events } = await readRuntime(paths);
    const existing = events.find((item) => item.id === event.id);
    if (existing) return { duplicate: true, session: replayEvents(events, session ?? {}) };
    const current = replayEvents(events, session ?? {});
    if (expectedRevision !== undefined && expectedRevision !== current.revision) throw new Error("revision 충돌: 상태를 다시 읽어야 합니다.");
    if (event.type === "status" && event.status === "done" && current.verification?.result !== "passed") {
      throw new Error("검증 통과 증거 없이 완료할 수 없습니다.");
    }
    const stored = redact({ ...event, revision: current.revision + 1, recordedAt: new Date().toISOString() });
    await fs.appendFile(paths.events, `${JSON.stringify(stored)}\n`, { encoding: "utf8", mode: 0o600 });
    const next = replayEvents([...events, stored], session ?? {});
    await atomicWrite(paths.session, `${JSON.stringify(next, null, 2)}\n`);
    return { duplicate: false, session: next, event: stored };
  });
}
