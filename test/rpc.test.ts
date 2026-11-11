import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { JsonRpcClient, RpcClosedError } from "../src/rpc";

class FakeChild extends EventEmitter {
  stdin = new PassThrough(); stdout = new PassThrough(); stderr = new PassThrough();
  writes: string[] = [];
  constructor() { super(); this.stdin.setEncoding("utf8"); this.stdin.on("data", (x) => this.writes.push(String(x))); }
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("JsonRpcClient", () => {
  test("routes responses and notifications", async () => {
    const child = new FakeChild(); const rpc = new JsonRpcClient(child as never);
    const messages: unknown[] = []; rpc.on("message", (m) => messages.push(m));
    const pending = rpc.request("thread/start", { cwd: "/tmp" });
    await tick(); expect(JSON.parse(child.writes[0]!)).toMatchObject({ id: 1, method: "thread/start" });
    child.stdout.write('{"jsonrpc":"2.0","method":"turn/started","params":{"turn":{"id":"t"}}}\n{"jsonrpc":"2.0","id":1,"result":{"thread":{"id":"x"}}}\n');
    expect(await pending).toEqual({ thread: { id: "x" } });
    expect(messages).toHaveLength(1);
  });

  test("preserves numeric server request IDs in approval responses", async () => {
    const child = new FakeChild(); const rpc = new JsonRpcClient(child as never);
    child.stdout.write('{"jsonrpc":"2.0","id":42,"method":"item/commandExecution/requestApproval","params":{}}\n');
    await tick(); rpc.respond(42, { decision: "decline" }); await tick();
    expect(JSON.parse(child.writes[0]!)).toEqual({ jsonrpc: "2.0", id: 42, result: { decision: "decline" } });
  });

  test("rejects pending request on EOF as uncertain without retry", async () => {
    const child = new FakeChild(); const rpc = new JsonRpcClient(child as never);
    const pending = rpc.request("turn/start", { threadId: "x" }); await tick(); child.emit("exit", 1, null);
    await expect(pending).rejects.toBeInstanceOf(RpcClosedError);
    expect(child.writes).toHaveLength(1);
    expect(() => rpc.notify("initialized", {})).toThrow(RpcClosedError);
  });
});
