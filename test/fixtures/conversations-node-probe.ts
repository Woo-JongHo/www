import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { JsonRpcClient } from "../../src/rpc.ts";

const fixture = fileURLToPath(new URL("./conversations-app-server.ts", import.meta.url));
const threadId = "thread-persisted";
const expectedRejection = JSON.stringify({ code: -32000, message: "thread/resume이 먼저 필요합니다." });

function assertThread(value: unknown) {
  assert.ok(value && typeof value === "object" && "thread" in value);
  const { thread } = value;
  assert.ok(thread && typeof thread === "object" && "id" in thread);
  assert.equal(thread.id, threadId);
}

async function probe() {
  const directory = await mkdtemp(join(tmpdir(), "www-conversations-node-"));
  const start = () => {
    const child = spawn(process.execPath, [fixture], {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, WWW_CONVERSATION_FIXTURE_STORE: join(directory, "history.json") },
    });
    const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
    return { child, closed, client: new JsonRpcClient(child) };
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
    timer = setTimeout(() => reject(new Error(`Node 대화 비교가 시간 초과됐다 (${phase}).`)), 10_000);
  });
  function step<T>(name: string, operation: () => Promise<T>): Promise<T> {
    phase = name;
    return Promise.race([operation(), timeout]);
  }
  try {
    const first = start();
    active = first;
    assert.deepEqual(await step("first/initialize", () => first.client.request("initialize", {})), {});
    assertThread(await step("first/thread-start", () => first.client.request("thread/start", { cwd: "/workspace/project" })));
    assert.deepEqual(await step("first/turn-start", () => first.client.request("turn/start", {
      threadId, input: [{ type: "text", text: "재시작 전 요청" }],
    })), { turn: { id: "turn-1" } });
    await step("first/close", () => stop(first));
    phase = "second/spawn";
    const second = start();
    active = second;
    assert.deepEqual(await step("second/initialize", () => second.client.request("initialize", {})), {});
    await assert.rejects(step("second/turn-before-resume", () => second.client.request("turn/start", {
      threadId, input: [{ type: "text", text: "복원 전 거부" }],
    })), { message: expectedRejection });
    assertThread(await step("second/thread-resume", () => second.client.request("thread/resume", { threadId })));
    assert.deepEqual(await step("second/turn-after-resume", () => second.client.request("turn/start", {
      threadId, input: [{ type: "text", text: "이어가는 요청" }],
    })), { turn: { id: "turn-2" } });
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
console.log("WWW_CONVERSATIONS_NODE_PROBE", JSON.stringify({ initialized: 2, rejectedBeforeResume: true, restored: true, turns: 2 }));
