#!/usr/bin/env node
import { createInterface } from "node:readline";

const mode = process.argv[2] ?? process.env.WWW_FAKE_MODE ?? "normal";
const lines = createInterface({ input: process.stdin });
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    if (mode === "eof") process.exit(17);
    send({ jsonrpc: "2.0", id: message.id, result: { serverInfo: { name: "fixture" } } });
  } else if (message.method === "thread/start") {
    send({ jsonrpc: "2.0", id: message.id, result: { thread: { id: "thread-fixture" } } });
  } else if (message.method === "turn/start") {
    send({ jsonrpc: "2.0", id: message.id, result: { turn: { id: "turn-fixture" } } });
    send({ jsonrpc: "2.0", method: "turn/started", params: { turn: { id: "turn-fixture" } } });
    send({ jsonrpc: "2.0", method: "item/agentMessage/delta", params: { itemId: "answer-1", delta: "안녕" } });
    send({ jsonrpc: "2.0", method: "item/agentMessage/delta", params: { itemId: "answer-1", delta: "하세요" } });
    send({ jsonrpc: "2.0", method: "item/started", params: { item: { id: "command-1", type: "commandExecution", command: "printf fixture" } } });
    send({ jsonrpc: "2.0", method: "item/commandExecution/outputDelta", params: { itemId: "command-1", delta: "fixture" } });
    send({ jsonrpc: "2.0", method: "item/completed", params: { item: { id: "command-1", type: "commandExecution", command: "printf fixture", aggregatedOutput: "fixture", exitCode: 0 } } });
    send({ jsonrpc: "2.0", method: "item/started", params: { item: { id: "file-1", type: "fileChange", changes: [{ path: "fixture.txt" }] } } });
    send({ jsonrpc: "2.0", method: "item/completed", params: { item: { id: "file-1", type: "fileChange", changes: [{ path: "fixture.txt" }] } } });
    send({ jsonrpc: "2.0", id: 42, method: "item/commandExecution/requestApproval", params: { command: "printf fixture" } });
  } else if (message.method === "turn/interrupt") {
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    send({ jsonrpc: "2.0", method: "turn/completed", params: { turn: { id: "turn-fixture", status: "interrupted" } } });
  } else if (message.id === 42) {
    send({ jsonrpc: "2.0", method: "fixture/approvalResponse", params: { idType: typeof message.id, decision: message.result?.decision } });
  }
});
