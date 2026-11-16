#!/usr/bin/env bun
// 두 실제 Native 자식 프로세스를 모사하며 합성 사건만 출력한다.
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

type Data = Record<string, unknown>;
const root = process.env.WWW_SESSION_FIXTURE_DIR;
if (!root) throw Error("fixture 디렉터리가 없습니다.");
const object = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
const notify = (method: string, params: unknown) => send({ jsonrpc: "2.0", method, params });
const result = (id: unknown, value: unknown) => send({ jsonrpc: "2.0", id, result: value });
const log = (value: unknown) => appendFileSync(join(root, "calls.jsonl"), JSON.stringify({ pid: process.pid, cwd: process.cwd(), ...object(value) }) + "\n");
let current: { threadId: string; turnId: string; prompt: string } | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let counter = 0;
const threads: string[] = [];
const finish = (status: string) => {
  if (!current) return;
  if (timer) clearInterval(timer);
  const { threadId, turnId } = current;
  notify("turn/completed", { threadId, turn: { id: turnId, status } });
  current = null;
};
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  const msg = object(JSON.parse(line));
  const params = object(msg.params);
  log(msg);
  if (!msg.method) { if (current && msg.id === 42) notify("serverRequest/resolved", { threadId: current.threadId, requestId: 42 }); continue; }
  if (msg.id === undefined) continue;
  if (msg.method === "initialize") result(msg.id, { userAgent: "sessions-fixture" });
  else if (msg.method === "thread/list") result(msg.id, { data: threads.map(id => ({ id, name: id, preview: "fixture", cwd: process.cwd(), updatedAt: 1794470000, source: "vscode", originator: "www", status: { type: "idle" } })), nextCursor: null });
  else if (msg.method === "thread/start") {
    const id = `fixture-thread-${process.pid}-${++counter}`;
    threads.push(id);
    result(msg.id, { thread: { id, cwd: process.cwd(), turns: [] }, model: "fixture", modelProvider: "fixture" });
  }
  else if (msg.method === "thread/read" || msg.method === "thread/resume") result(msg.id, { thread: { id: params.threadId, cwd: process.cwd(), originator: "www", source: "vscode", turns: [] }, model: "fixture", modelProvider: "fixture" });
  else if (msg.method === "thread/turns/list") result(msg.id, { data: [], nextCursor: null });
  else if (msg.method === "turn/start") {
    const threadId = String(params.threadId);
    const prompt = String(object(Array.isArray(params.input) ? params.input[0] : {}).text ?? "");
    const turnId = `fixture-turn-${process.pid}-${++counter}`;
    current = { threadId, turnId, prompt };
    result(msg.id, { turn: { id: turnId } });
    notify("turn/started", { threadId, turn: { id: turnId } });
    notify("item/started", { threadId, turnId, item: { id: "same-command", type: "commandExecution", command: `printf ${prompt}`, cwd: process.cwd(), status: "inProgress" } });
    send({ jsonrpc: "2.0", id: 42, method: "item/commandExecution/requestApproval", params: { threadId, turnId, command: `approve ${prompt}` } });
    let tick = 0;
    timer = setInterval(() => {
      if (!current) return;
      notify("item/commandExecution/outputDelta", { threadId, turnId, itemId: "same-command", delta: `${prompt}-tick-${++tick}\n` });
      if (existsSync(join(root, `finish-${process.pid}`))) finish("completed");
    }, 100);
  } else if (msg.method === "turn/interrupt") { result(msg.id, {}); finish("interrupted"); }
  else if (msg.method === "skills/list" || msg.method === "hooks/list") result(msg.id, { data: [{ cwd: process.cwd(), skills: [], hooks: [], errors: [] }] });
  else result(msg.id, {});
}
log({ method: "fixture/exit" });
