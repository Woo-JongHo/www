import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createConversationService, type ConversationEvent } from "../../src/conversations";
import { createNativeLifecycle } from "../../src/native-lifecycle";
import { project } from "../../src/projection";
import { JsonRpcClient } from "../../src/rpc.ts";

const [scenario, fixture] = process.argv.slice(2);
assert.ok((scenario === "conversations" || scenario === "native-lifecycle") && fixture);
const cwd = "/workspace/project";
const threadId = "thread-persisted";
const expectedRejection = JSON.stringify({ code: -32000, message: "thread/resume이 먼저 필요합니다." });

function assertThread(value: unknown) {
  assert.ok(value && typeof value === "object" && "thread" in value);
  const { thread } = value;
  assert.ok(thread && typeof thread === "object" && "id" in thread);
  assert.equal(thread.id, threadId);
}

function userBlocks(events: ConversationEvent[]) {
  return project(events.map((event, index) => ({ ...event, seq: index + 100, at: "2026-11-12T00:00:00Z" })))
    .blocks.filter((block) => block.kind === "user");
}

async function probe() {
  const directory = await mkdtemp(join(tmpdir(), "www-conversations-node-"));
  const lifecycle = scenario === "native-lifecycle" ? createNativeLifecycle(() => {}) : null;
  const start = () => {
    const child = spawn(process.execPath, [fixture], {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, WWW_CONVERSATION_FIXTURE_STORE: join(directory, "history.json") },
    });
    const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
    const client = new JsonRpcClient(child);
    if (lifecycle) client.once("closed", (error: Error) => lifecycle.closed(client, error.message));
    return { child, closed, client };
  };
  const terminate = (child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals) => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  };
  const stop = async (running: ReturnType<typeof start>) => {
    terminate(running.child, "SIGTERM");
    await running.closed;
  };
  let active: ReturnType<typeof start> | undefined;
  let phase = "first/spawn";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Node ${scenario} 테스트 시간 초과 (${phase}).`)), 8_000);
  });
  function step<T>(name: string, operation: () => Promise<T>): Promise<T> {
    phase = name;
    return Promise.race([operation(), timeout]);
  }
  try {
    const first = start();
    active = first;
    assert.deepEqual(await step("first/initialize", () => first.client.request("initialize", {})), {});
    assertThread(await step("first/thread-start", () => first.client.request("thread/start", { cwd })));
    if (lifecycle) lifecycle.markReady(first.client, cwd, threadId);
    else {
      assert.deepEqual(await step("first/turn-start", () => first.client.request("turn/start", {
        threadId, input: [{ type: "text", text: "재시작 전 요청" }],
      })), { turn: { id: "turn-1" } });
    }
    await step("first/close", () => stop(first));
    phase = "second/spawn";
    const second = start();
    active = second;
    assert.deepEqual(await step("second/initialize", () => second.client.request("initialize", {})), {});
    await assert.rejects(step("second/turn-before-resume", () => second.client.request("turn/start", {
      threadId, input: [{ type: "text", text: "복원 전 거부" }],
    })), { message: expectedRejection });
    if (lifecycle) {
      let restored = false;
      await step("second/lifecycle-start", () => lifecycle.start({
        connect: async () => second.client, valid: (client) => client === active?.client,
        cwd, threadId, prompt: "재시작 뒤 새 요청",
        restored(value) { restored = true; assert.equal(value.approvalPolicy, "on-request"); },
        beforeStart() { assert.equal(restored, true); },
      }));
      const opened = await step("second/lifecycle-open", () => lifecycle.open(second.client, cwd, threadId, () => true));
      assert.equal(opened.events.filter((event) => event.method === "turn/userPrompt").length, 1);
      assert.match(JSON.stringify(opened.events), /재시작 뒤 새 요청/);
    } else {
      const service = createConversationService(second.client, cwd);
      const listed = await step("second/thread-list", () => service.list());
      assert.equal(listed.threads[0]?.id, threadId);
      const opened = await step("second/thread-open", () => service.open(threadId));
      assert.equal(opened.threadId, threadId);
      assert.ok(userBlocks(opened.events).some((block) => block.text === "재시작 전 요청"));
      assert.deepEqual(await step("second/turn-after-resume", () => second.client.request("turn/start", {
        threadId: opened.threadId, input: [{ type: "text", text: "이어가는 요청" }],
      })), { turn: { id: "turn-2" } });
      const reopened = await step("second/thread-reopen", () => service.open(opened.threadId));
      assert.deepEqual(userBlocks(reopened.events).map((block) => block.text), ["재시작 전 요청", "이어가는 요청"]);
    }
    await step("second/close", () => stop(second));
    active = undefined;
  } finally {
    clearTimeout(timer);
    try {
      if (active) {
        const { child, closed } = active;
        terminate(child, "SIGKILL");
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
        child.unref();
        await Promise.race([closed, delay(1_000)]);
      }
    } finally { await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
  }
}

await probe();
console.log("WWW_CONVERSATIONS_NODE_RESTART", scenario);
