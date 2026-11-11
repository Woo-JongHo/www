import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { JsonRpcClient } from "../src/rpc";

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

test("Electron transport crosses a real stdio boundary with the shared fixture", async () => {
  const child = spawn(process.execPath, [join(import.meta.dir, "fixtures/fake-app-server.mjs")], { stdio: ["pipe", "pipe", "pipe"] });
  const rpc = new JsonRpcClient(child);
  const messages: Record<string, unknown>[] = [];
  rpc.on("message", (message) => messages.push(message));
  await rpc.request("initialize", {});
  rpc.notify("initialized", {});
  expect(await rpc.request("thread/start", {})).toEqual({ thread: { id: "thread-fixture" } });
  expect(await rpc.request("turn/start", {})).toEqual({ turn: { id: "turn-fixture" } });
  await tick();
  rpc.respond(42, { decision: "decline" });
  await rpc.request("turn/interrupt", {});
  await tick();
  expect(messages.map((message) => message.method)).toContain("item/agentMessage/delta");
  expect(messages.map((message) => message.method)).toContain("item/completed");
  expect(messages).toContainEqual(expect.objectContaining({ method: "fixture/approvalResponse", params: { idType: "number", decision: "decline" } }));
  child.kill();
});

test("실제 app-server 인자에서도 환경으로 선택한 지연 중복 승인을 재현한다", async () => {
  const child = spawn(process.execPath, [join(import.meta.dir, "fixtures/fake-app-server.mjs"), "app-server"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, WWW_FAKE_MODE: "duplicate-approval" }
  });
  const rpc = new JsonRpcClient(child);
  const approvals: unknown[] = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const duplicate = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("지연 중복 승인 fixture가 도착하지 않았습니다.")), 2000);
    rpc.on("message", (message) => {
      if (message.id === 42) approvals.push(message.id);
      if (approvals.length === 2) resolve();
    });
  });
  try {
    await rpc.request("initialize", {});
    await rpc.request("turn/start", {});
    await rpc.respond(42, { decision: "decline" });
    await duplicate;
    expect(approvals).toEqual([42, 42]);
  } finally {
    if (timeout) clearTimeout(timeout);
    child.kill();
  }
});
