/**
 * @verifies RESP-NATIVE-LIFECYCLE
 */
import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeLifecycle } from "../src/native-lifecycle";
import { JsonRpcClient } from "../src/rpc";
import { createDevelopmentService } from "../src/development";
import { runInNewContext } from "node:vm";
import type { ConversationEvent } from "../src/conversations";
import type { RpcId } from "../src/shared";

const cwd = "/workspace/project";
const threadId = "thread-persisted";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(handler?: (method: string) => unknown) {
  const calls: { method: string; params: unknown }[] = [];
  const responses: { id: RpcId; value: unknown }[] = [];
  const events: ConversationEvent[] = [];
  const client = {
    async request(method: string, params: unknown): Promise<unknown> {
      calls.push({ method, params });
      if (handler) return handler(method);
      if (method === "thread/turns/list") return { data: [], nextCursor: null };
      if (method === "turn/start") return { turn: { id: "turn-new" } };
      return { thread: { id: threadId, cwd, originator: "www", status: { type: "idle" } }, model: "saved-model", modelProvider: "saved-provider", approvalPolicy: "never", sandbox: { type: "readOnly" } };
    },
    async respond(id: RpcId, value: unknown) { responses.push({ id, value }); }
  };
  const lifecycle = createNativeLifecycle((event) => events.push(event));
  let valid = true;
  const options = {
    connect: async () => client,
    valid: () => valid,
    cwd, threadId, prompt: "새로 요청한 입력",
    restored(value: { model: string | null }) { expect(value.model).toBe("saved-model"); },
    beforeStart() {}
  };
  return { client, lifecycle, events, calls, responses, options, invalidate() { valid = false; } };
}

test("재연결은 Bypass로 재개한 뒤 새 턴을 한 번만 보낸다", async () => {
  const s = setup();
  await s.lifecycle.start(s.options);
  expect(s.calls.map((call) => call.method)).toEqual(["thread/read", "thread/resume", "thread/turns/list", "turn/start"]);
  expect(s.calls[1]?.params).toEqual({ threadId, excludeTurns: true, approvalPolicy: "never", sandbox: "danger-full-access" });
  expect(s.calls[3]?.params).toEqual({ threadId, input: [{ type: "text", text: "새로 요청한 입력", text_elements: [] }], summary: "detailed" });
  await s.lifecycle.start(s.options);
  expect(s.calls.filter((call) => call.method === "thread/resume")).toHaveLength(1);
});

test("thread start/open의 준비 상태는 client·project·thread가 모두 같을 때만 재사용한다", async () => {
  const s = setup();
  s.lifecycle.markReady(s.client, cwd, threadId);
  await s.lifecycle.start(s.options);
  expect(s.calls.map((call) => call.method)).toEqual(["turn/start"]);
  s.lifecycle.reset();
  await s.lifecycle.open(s.client, cwd, threadId, () => true);
  s.calls.length = 0;
  await s.lifecycle.start(s.options);
  expect(s.calls.map((call) => call.method)).toEqual(["turn/start"]);
  const other = setup();
  await s.lifecycle.start({ ...s.options, connect: async () => other.client });
  expect(other.calls[0]?.method).toBe("thread/read");
  await expect(s.lifecycle.start({ ...s.options, cwd: "/other" })).rejects.toThrow("폴더");
  await expect(s.lifecycle.start({ ...s.options, threadId: "wrong" })).rejects.toThrow("다릅니다");
});

test("복구 중 중첩 요청·선택 변경·stale read는 resume와 turn/start를 발생시키지 않는다", async () => {
  const gate = deferred<unknown>();
  const entered = deferred<void>();
  const s = setup(() => { entered.resolve(); return gate.promise; });
  const first = s.lifecycle.start(s.options);
  await entered.promise;
  await expect(s.lifecycle.start(s.options)).rejects.toThrow("준비");
  s.lifecycle.closed(s.client, "closed");
  await expect(s.lifecycle.start(s.options)).rejects.toThrow("준비");
  s.invalidate();
  gate.resolve({ thread: { id: threadId, cwd, originator: "www" } });
  await expect(first).rejects.toThrow("변경");
  expect(s.calls.map((call) => call.method)).toEqual(["thread/read"]);
});

for (const invalid of [
  { id: threadId, cwd, originator: "www", status: { type: "active" } },
  { id: "wrong", cwd, originator: "www" },
  { id: threadId, cwd: "/other", originator: "www" }
]) {
  test(`잘못되거나 active인 복원은 mutation을 보내지 않는다: ${JSON.stringify(invalid)}`, async () => {
    const s = setup(() => ({ thread: invalid }));
    await expect(s.lifecycle.start(s.options)).rejects.toThrow();
    expect(s.calls.map((call) => call.method)).toEqual(["thread/read"]);
  });
}

test("복원 실패와 closed 뒤 늦은 turn 결과는 성공으로 수용하거나 자동 재전송하지 않는다", async () => {
  const failed = setup((method) => {
    if (method === "thread/read") return { thread: { id: threadId, cwd, originator: "www" } };
    throw new Error("resume 실패");
  });
  await expect(failed.lifecycle.start(failed.options)).rejects.toThrow("실패");
  expect(failed.calls.map((call) => call.method)).toEqual(["thread/read", "thread/resume"]);
  const gate = deferred<unknown>();
  const entered = deferred<void>();
  const s = setup(() => { entered.resolve(); return gate.promise; });
  s.lifecycle.markReady(s.client, cwd, threadId);
  const result = s.lifecycle.start(s.options);
  await entered.promise;
  s.lifecycle.closed(s.client, "closed");
  s.invalidate();
  gate.resolve({ turn: { id: "stale" } });
  await expect(result).rejects.toThrow("변경");
  await expect(s.lifecycle.start(s.options)).rejects.toThrow("이전 턴");
  expect(s.calls).toHaveLength(1);
});

test("active 턴 중 disconnect는 사용자가 대화를 다시 열기 전 새 턴을 거부한다", async () => {
  const s = setup();
  s.lifecycle.markReady(s.client, cwd, threadId);
  s.lifecycle.closed(s.client, "closed", threadId);
  await expect(s.lifecycle.start(s.options)).rejects.toThrow("이전 턴");
  expect(s.calls).toHaveLength(0);
  await s.lifecycle.open(s.client, cwd, threadId, () => true);
  await s.lifecycle.start(s.options);
  expect(s.calls.at(-1)?.method).toBe("turn/start");
});

test("승인 해소는 client·thread·typed ID가 일치할 때만 해당 카드를 한 번 해소한다", () => {
  const s = setup();
  const number = s.lifecycle.approval(s.client, 7, threadId);
  const string = s.lifecycle.approval(s.client, "7", threadId);
  if (number === null || string === null) throw new Error("승인 token 없음");
  expect(number).not.toBe(string);
  expect(s.lifecycle.approval(s.client, 7, "other")).toBeNull();
  expect(s.lifecycle.resolved(setup().client, { threadId, requestId: 7 })).toBe(false);
  expect(s.lifecycle.resolved(s.client, { threadId: "other", requestId: 7 })).toBe(false);
  expect(s.lifecycle.resolved(s.client, { threadId, requestId: 7 })).toBe(true);
  expect(s.lifecycle.resolved(s.client, { threadId, requestId: 7 })).toBe(false);
  expect(s.lifecycle.approvalCount).toBe(1);
  expect(s.events).toEqual([{ kind: "notification", method: "approval/responded", params: { threadId, resolvedByServer: true }, requestId: 7, approvalToken: number }]);
  expect(s.lifecycle.resolved(s.client, { threadId, requestId: "7" })).toBe(true);
});

test("서버 해소와 응답 write 실패 race는 responded 뒤 uncertain을 추가하지 않는다", async () => {
  const s = setup();
  const gate = deferred<void>();
  s.client.respond = async () => gate.promise;
  const token = s.lifecycle.approval(s.client, 7, threadId)!;
  const response = s.lifecycle.respond(s.client, 7, "accept", token, () => true);
  await expect(s.lifecycle.respond(s.client, 7, "accept", token, () => true)).rejects.toThrow("attempted");
  expect(s.lifecycle.resolved(s.client, { threadId, requestId: 7 })).toBe(true);
  gate.reject(new Error("late write failure"));
  await response;
  expect(s.events.map((event) => event.method)).toEqual(["approval/responding", "approval/responded"]);
  expect(s.lifecycle.approvalCount).toBe(0);
});

test("이전 generation 카드·늦은 응답·stale resolved는 새 process의 재사용 ID를 건드리지 않는다", async () => {
  const s = setup();
  const gate = deferred<void>();
  s.client.respond = async () => gate.promise;
  const old = s.lifecycle.approval(s.client, 7, threadId)!;
  const response = s.lifecycle.respond(s.client, 7, "accept", old, () => true);
  s.lifecycle.closed(s.client, "closed");
  const next = setup().client;
  const token = s.lifecycle.approval(next, 7, threadId)!;
  expect(old).not.toBe(token);
  await expect(s.lifecycle.respond(next, 7, "accept", old, () => true)).rejects.toThrow("Unknown");
  expect(s.lifecycle.resolved(s.client, { threadId, requestId: 7 })).toBe(false);
  gate.resolve();
  await response;
  expect(s.lifecycle.approvalCount).toBe(1);
  await s.lifecycle.respond(next, 7, "decline", token, () => true);
  expect(s.lifecycle.approvalCount).toBe(0);
  expect(s.events.filter((event) => event.approvalToken === old).map((event) => event.method)).toEqual(["approval/responding", "approval/uncertain"]);
});

test("respond 직전 선택과 request 객체 재검사 및 실패 후 재시도 방지", async () => {
  const s = setup();
  const token = s.lifecycle.approval(s.client, "id", threadId)!;
  await expect(s.lifecycle.respond(s.client, "id", "accept", token, () => false)).rejects.toThrow("Unknown");
  expect(s.responses).toHaveLength(0);
  s.client.respond = async () => { throw new Error("write failed"); };
  await expect(s.lifecycle.respond(s.client, "id", "accept", token, () => true)).rejects.toThrow("write failed");
  await expect(s.lifecycle.respond(s.client, "id", "accept", token, () => true)).rejects.toThrow("Unknown");
  expect(s.events.at(-1)?.method).toBe("approval/uncertain");
});

test("실제 main은 같은 lifecycle seam을 사용하고 closed에서 준비 잠금을 내리지 않는다", async () => {
  const main = await readFile(join(import.meta.dir, "../src/native-session.ts"), "utf8");
  for (const call of ["createNativeLifecycle(publish)", "lifecycle.open(", "lifecycle.markReady(", "lifecycle.start({", "lifecycle.respond(", "lifecycle.resolved(client, message.params)", "lifecycle.reset()"])
    expect(main).toContain(call);
  const closed = main.slice(main.indexOf('client.once("closed"'), main.indexOf('client.on("stderr"'));
  expect(closed).not.toContain("turnStarting = false");
  const respond = main.slice(main.indexOf('handle("approval:respond"'), main.indexOf('handle("events:get"'));
  expect(respond).not.toContain("connect()");
  expect(main).toContain('if (rpc !== startedClient) throw');
});

test("main과 같은 lifecycle seam은 실제 subprocess 재시작 때 resume 선행 후 한 번만 전송한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "www-lifecycle-"));
  const lifecycle = createNativeLifecycle(() => {});
  const start = () => {
    const child = spawn(process.execPath, [join(import.meta.dir, "fixtures/conversations-app-server.ts")], {
      stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, WWW_CONVERSATION_FIXTURE_STORE: join(directory, "history.json") }
    });
    return { child, client: new JsonRpcClient(child) };
  };
  let running = start();
  let current: JsonRpcClient | null = running.client;
  try {
    await running.client.request("initialize", {});
    await running.client.request("thread/start", { cwd });
    lifecycle.markReady(running.client, cwd, threadId);
    running.child.kill();
    lifecycle.closed(running.client, "restart");
    running = start();
    current = running.client;
    await current.request("initialize", {});
    await expect(current.request("turn/start", { threadId, input: [{ type: "text", text: "복원 없이 거부" }] })).rejects.toThrow("resume");
    let restored = false;
    await lifecycle.start({
      connect: async () => running.client, valid: (client) => client === current,
      cwd, threadId, prompt: "재시작 뒤 새 요청",
      restored(value) { restored = true; expect(value.approvalPolicy).toBe("on-request"); },
      beforeStart() { expect(restored).toBe(true); }
    });
    const opened = await lifecycle.open(current, cwd, threadId, () => true);
    expect(opened.events.filter((event) => event.method === "turn/userPrompt")).toHaveLength(1);
    expect(JSON.stringify(opened.events)).toContain("재시작 뒤 새 요청");
  } finally { current = null; running.child.kill(); await rm(directory, { recursive: true, force: true }); }
}, 10_000);

test("pending connect closed 중에도 첫 start가 정리되기 전 중첩 전송을 거부한다", async () => {
  const s = setup();
  const gate = deferred<typeof s.client>();
  const first = s.lifecycle.start({ ...s.options, connect: () => gate.promise });
  s.lifecycle.closed(s.client, "initialize closed");
  await expect(s.lifecycle.start(s.options)).rejects.toThrow("준비");
  s.invalidate();
  gate.resolve(s.client);
  await expect(first).rejects.toThrow("변경");
  expect(s.calls).toHaveLength(0);
});

test("open의 history await 뒤 closed된 응답은 ready와 복원 snapshot으로 수용하지 않는다", async () => {
  const gate = deferred<unknown>();
  const entered = deferred<void>();
  const s = setup((method) => {
    if (method === "thread/turns/list") { entered.resolve(); return gate.promise; }
    return { thread: { id: threadId, cwd, originator: "www" } };
  });
  const opened = s.lifecycle.open(s.client, cwd, threadId, s.options.valid);
  await entered.promise;
  s.lifecycle.closed(s.client, "closed");
  s.invalidate();
  gate.resolve({ data: [], nextCursor: null });
  await expect(opened).rejects.toThrow("변경");
  expect(s.calls.map((call) => call.method)).toEqual(["thread/read", "thread/resume", "thread/turns/list"]);
});

test("승인 responding 발행 중 서버가 해소하면 write 직전 객체 재검사로 전송하지 않는다", async () => {
  const client = setup().client;
  const events: ConversationEvent[] = [];
  const lifecycle = createNativeLifecycle((event) => {
    events.push(event);
    if (event.method === "approval/responding") lifecycle.resolved(client, { threadId, requestId: 7 });
  });
  let writes = 0;
  client.respond = async () => { writes++; };
  const token = lifecycle.approval(client, 7, threadId)!;
  await lifecycle.respond(client, 7, "accept", token, () => true);
  expect(writes).toBe(0);
  expect(events.map((event) => event.method)).toEqual(["approval/responding", "approval/responded"]);
});

test("원본 typed ID와 raw params를 유지하고 승인 상태는 별도 top-level token을 사용한다", async () => {
  const s = setup();
  const token = s.lifecycle.approval(s.client, 7, threadId)!;
  await s.lifecycle.respond(s.client, 7, "accept", token, () => true);
  expect(s.responses).toEqual([{ id: 7, value: { decision: "accept" } }]);
  expect(s.events).toEqual([
    { kind: "notification", method: "approval/responding", requestId: 7, approvalToken: token, params: { threadId, decision: "accept" } },
    { kind: "notification", method: "approval/responded", requestId: 7, approvalToken: token, params: { threadId, decision: "accept" } }
  ]);
});

for (const fails of [false, true]) {
  test(`같은 process의 완료 ID 재사용은 허용하고 옛 token과 늦은 future는 새 승인을 해소하지 않는다: ${fails}`, async () => {
    const s = setup();
    const gate = deferred<void>();
    s.client.respond = () => gate.promise;
    const old = s.lifecycle.approval(s.client, 7, threadId)!;
    expect(s.lifecycle.approval(s.client, 7, threadId)).toBeNull();
    const response = s.lifecycle.respond(s.client, 7, "accept", old, () => true);
    expect(s.lifecycle.resolved(s.client, { threadId, requestId: 7 })).toBe(true);
    const token = s.lifecycle.approval(s.client, 7, threadId)!;
    expect(typeof token).toBe("string");
    expect(token).not.toBe(old);
    await expect(s.lifecycle.respond(s.client, 7, "accept", old, () => true)).rejects.toThrow("Unknown");
    await expect(s.lifecycle.respond(s.client, "7", "accept", token, () => true)).rejects.toThrow("Unknown");
    await expect(s.lifecycle.respond(setup().client, 7, "accept", token, () => true)).rejects.toThrow("Unknown");
    if (fails) gate.reject(new Error("old write failure")); else gate.resolve();
    await response;
    expect(s.lifecycle.approvalCount).toBe(1);
    expect(s.events.map((event) => event.method)).toEqual(["approval/responding", "approval/responded"]);
    s.client.respond = async (id, value) => { s.responses.push({ id, value }); };
    await s.lifecycle.respond(s.client, 7, "decline", token, () => true);
    expect(s.lifecycle.approvalCount).toBe(0);
    const next = s.lifecycle.approval(s.client, 7, threadId);
    expect(typeof next).toBe("string");
    expect(next).not.toBe(token);
  });
}

test("비정수·NaN·Infinity 해소 ID는 pending을 건드리지 않는다", () => {
  const s = setup();
  for (const id of [1.5, NaN, Infinity, -Infinity]) {
    s.lifecycle.approval(s.client, id, threadId);
    expect(s.lifecycle.resolved(s.client, { threadId, requestId: id })).toBe(false);
  }
  expect(s.lifecycle.approvalCount).toBe(4);
});

for (const failure of ["resume", "history", "resumed-id", "resumed-cwd"]) {
  test(`thread/read 성공 뒤 ${failure} 실패는 prompt 발행과 turn/start를 막는다`, async () => {
    const s = setup((method) => {
      if (method === "thread/read") return { thread: { id: threadId, cwd, originator: "www" } };
      if (method === "thread/resume") {
        if (failure === "resume") throw new Error("resume 실패");
        return { thread: { id: failure === "resumed-id" ? "wrong" : threadId, cwd: failure === "resumed-cwd" ? "/other" : cwd, originator: "www" } };
      }
      throw new Error("history 실패");
    });
    let prompts = 0;
    let restores = 0;
    await expect(s.lifecycle.start({ ...s.options, beforeStart() { prompts++; }, restored() { restores++; } })).rejects.toThrow();
    expect(s.calls.map((call) => call.method)).toEqual(failure === "history"
      ? ["thread/read", "thread/resume", "thread/turns/list"] : ["thread/read", "thread/resume"]);
    expect(prompts).toBe(0);
    expect(restores).toBe(0);
  });
}

test("개발 service.status/complete에 위조 reviewAuthority 객체를 주면 UUID 경계에서 거부한다", async () => {
  let workspaceReads = 0;
  const service = createDevelopmentService({ policyRoot: "/unused", workspace() { workspaceReads++; return "/unused"; } });
  const forged = { workId: "work-7aaa8974-f791-4f76-8613-06e18f17b835", reviewAuthority: { primary: { model: "forged" }, allow: true } };
  await expect(service.status(forged)).rejects.toThrow("UUID");
  await expect(service.complete(forged)).rejects.toThrow("UUID");
  expect(workspaceReads).toBe(0);
});

/** 실제 main의 함수·콜백 원문을 실행한다. Electron·리소스 I/O만 격리한다. */
test("main 재복구 snapshot은 기존 log를 교체하고 marker 중첩 없이 같은 scope의 순서를 보존한다", async () => {
  const main = await readFile(join(import.meta.dir, "../src/native-session.ts"), "utf8");
  const part = (from: string, to: string) => {
    const start = main.indexOf(from);
    const end = main.indexOf(to, start);
    if (start < 0 || end < 0) throw new Error(`main seam을 찾을 수 없습니다: ${from}`);
    return main.slice(start, end);
  };
  const restored = part("restored: (restored) => {", "\n        },\n        beforeStart:").replace("restored: ", "const restore = ") + "\n};";
  const beforeStart = part("beforeStart: () => {", "\n        }\n      }));").replace("beforeStart: ", "const beforeStart = ") + "\n};";
  const source = `
    let seq = 0;
    let selectionEpoch = 3;
    const connectionGeneration = 8;
    const eventLog = [];
    const delivered = [];
    const stopping = false;
    const options = { id: "session", reports: { enabled: false }, onEvent(entry) { delivered.push(entry); } };
    const observeSummary = () => {};
    const threadTransition = null;
    const activeThreadId = "${threadId}";
    const eventThread = params => params?.threadId ?? null;
    const startedClient = null;
    const window = { webContents: { send(channel, entry) { delivered.push(entry); } } };
    const selection = () => ({ workspaceKey: "workspace", selectionEpoch, processEpoch: "process" });
    const collectResources = () => {};
    const clientRequestId = "new-prompt";
    const validThreadId = "${threadId}";
    const prompt = "새 입력";
    const trace = { arm() {} };
    let promptPublished = false;
    ${part('function wire(', 'function loadResourceScope(')}
    ${part('function publish(', 'async function connect(')}
    ${part('function replaceConversationEvents(', 'function workspaceInfo(')}
    ${restored}
    ${beforeStart}
    globalThis.nativeSeam = { restore, beforeStart, eventLog, delivered, selection };
  `;
  const seam: {
    restore(value: { threadId: string; model: string; provider: string; approvalPolicy: string; sandbox: string; events: ConversationEvent[] }): void;
    beforeStart(): void;
    eventLog: import("../src/shared").ScopedAppEvent[];
    delivered: import("../src/shared").ScopedAppEvent[];
    selection(): import("../src/shared").SelectionRef;
  } = runInNewContext(new Bun.Transpiler({ loader: "ts" }).transformSync(source));
  const history: ConversationEvent[] = [{ kind: "notification", method: "turn/userPrompt", params: { threadId, text: "저장 입력" }, historical: true }];
  const value = { threadId, model: "saved", provider: "provider", approvalPolicy: "never", sandbox: "readOnly", events: history };
  for (let pass = 0; pass < 3; pass++) {
    seam.restore(value);
    const marker = seam.delivered.at(-1)!;
    expect(seam.delivered.filter((event) => event.method === "conversation/reconnected")).toHaveLength(pass + 1);
    const params = marker.params as { threadId: string; events: import("../src/shared").ScopedAppEvent[] };
    expect(params.threadId).toBe(threadId);
    expect(params.events.map((event) => event.method)).toEqual(["transport/status", "thread/configured", "turn/userPrompt"]);
    expect(params.events.every((event) => event.historical === true && event.seq < marker.seq)).toBe(true);
    for (const event of [...params.events, marker]) {
      expect(event).toMatchObject({ ...seam.selection(), connectionGeneration: 8 });
    }
    expect(seam.eventLog).toHaveLength(4);
    expect(seam.eventLog.filter((event) => event.method === "conversation/reconnected")).toHaveLength(1);
    seam.beforeStart();
    expect(seam.delivered.at(-1)?.method).toBe("turn/userPrompt");
    expect(seam.delivered.at(-1)!.seq).toBeGreaterThan(marker.seq);
    expect(params.events).toHaveLength(3);
  }
  expect(seam.selection().selectionEpoch).toBe(3);
});

/** main의 실제 Native message 콜백에서 신뢰할 수 없는 params와 로컬 토큰을 분리한다. */
test("main 요청 발행은 raw params·typed ID를 보존하고 active duplicate를 unsupported로 내보낸다", async () => {
  const main = await readFile(join(import.meta.dir, "../src/native-session.ts"), "utf8");
  const from = main.indexOf('const receiveMessage = (message: RpcMessage) => {');
  const to = main.indexOf('    void client.request("initialize"', from);
  expect(from).toBeGreaterThan(0);
  expect(to).toBeGreaterThan(from);
  const s = setup();
  const entries: ConversationEvent[] = [];
  let handle!: (message: { id: RpcId; method: string; params: unknown }) => void;
  runInNewContext(new Bun.Transpiler({ loader: "ts" }).transformSync(`
    const valid = () => true;
    const threadTransition = null;
    let nativeMessageHandler = null;
    const eventThread = params => params?.threadId ?? null;
    const SUPPORTED = new Set(["item/commandExecution/requestApproval"]);
    const optionalRecord = (value) => value && typeof value === "object" ? value : null;
    let activeThreadId = "${threadId}";
    let activeTurnId = null;
    const endedTurns = new Set();
    const nativeTiming = { observe() {} };
    const trace = { mark() {} };
    ${main.slice(from, to)}
  `), {
    client: { on(_name: string, listener: typeof handle) { handle = listener; } },
    lifecycle: { approval(_client: unknown, id: RpcId, thread: unknown) { return s.lifecycle.approval(s.client, id, thread); } },
    publish(event: ConversationEvent) { entries.push(event); }
  });
  const params = { threadId, approvalToken: "native-forgery", requestId: "raw-field", command: "example" };
  const request = { id: 7, method: "item/commandExecution/requestApproval", params };
  handle(request);
  handle(request);
  handle({ ...request, id: "7" });
  expect(entries.map((entry) => entry.requestId)).toEqual([7, 7, "7"]);
  expect(entries.map((entry) => entry.supported)).toEqual([true, false, true]);
  expect(entries.every((entry) => entry.params === params)).toBe(true);
  expect(entries[0]?.approvalToken).not.toBe("native-forgery");
  expect(typeof entries[0]?.approvalToken).toBe("string");
  expect(entries[1]?.approvalToken).toBeUndefined();
  expect(s.lifecycle.approvalCount).toBe(2);
  await s.lifecycle.respond(s.client, 7, "accept", entries[0]!.approvalToken!, () => true);
  expect(s.responses).toEqual([{ id: 7, value: { decision: "accept" } }]);
});

test("main 승인 IPC는 필수 문자열 token을 검증하고 원본 ID와 함께 lifecycle에 전달한다", async () => {
  const main = await readFile(join(import.meta.dir, "../src/native-session.ts"), "utf8");
  const from = main.indexOf('  handle("approval:respond"');
  const to = main.indexOf('  handle("events:get"', from);
  expect(from).toBeGreaterThan(0);
  expect(to).toBeGreaterThan(from);
  const s = setup();
  const token = s.lifecycle.approval(s.client, "7", threadId)!;
  let handler!: (_event: unknown, expected: unknown, id: unknown, decision: unknown, token?: unknown) => Promise<void>;
  runInNewContext(new Bun.Transpiler({ loader: "ts" }).transformSync(`
    const assertSelection = () => {};
    const isCurrent = () => true;
    const options = { id: "session" };
    const DECISIONS = new Set(["accept", "decline"]);
    ${main.slice(main.indexOf('function requiredString('), main.indexOf('\n', main.indexOf('function validId(')))}
    ${main.slice(from, to)}
  `), {
    rpc: s.client, lifecycle: s.lifecycle,
    handle(_channel: string, value: typeof handler) { handler = value; }
  });
  for (const invalid of [undefined, null, 7, {}, ""]) {
    await expect(handler(null, {}, "7", "accept", invalid)).rejects.toThrow("approval token");
  }
  expect(s.responses).toHaveLength(0);
  await expect(handler(null, {}, 7, "accept", `session:${token}`)).rejects.toThrow("Unknown");
  await handler(null, {}, "7", "accept", `session:${token}`);
  expect(s.responses).toEqual([{ id: "7", value: { decision: "accept" } }]);
});
