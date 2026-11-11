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
