#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const store = process.env.WWW_CONVERSATION_FIXTURE_STORE;
if (!store) throw new Error("대화 fixture 저장 경로가 필요합니다.");
let thread: Record<string, unknown> | null = existsSync(store) ? JSON.parse(readFileSync(store, "utf8")) : null;
const send = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`);

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  let result: unknown = {};
  if (message.method === "thread/start") {
    thread = {
      id: "thread-persisted", originator: "www", source: "vscode", cwd: message.params.cwd, preview: "", name: null, ephemeral: false,
      updatedAt: 100, status: { type: "idle" }, turns: []
    };
    writeFileSync(store, JSON.stringify(thread));
    result = { thread };
  } else if (message.method === "turn/start" && thread && message.params.threadId === thread.id) {
    const turns = Array.isArray(thread.turns) ? thread.turns : [];
    const id = `turn-${turns.length + 1}`;
    const input = message.params.input[0].text;
    thread.preview ||= input;
    thread.updatedAt = 100 + turns.length + 1;
    turns.push({ id, status: "completed", items: [
      { id: `u-${id}`, type: "userMessage", content: [{ type: "text", text: input }] },
      { id: `a-${id}`, type: "agentMessage", text: `저장된 답변 ${turns.length + 1}` }
    ] });
    thread.turns = turns;
    writeFileSync(store, JSON.stringify(thread));
    result = { turn: { id } };
  } else if (message.method === "thread/list") {
    result = { data: thread && thread.cwd === message.params.cwd ? [thread] : [], nextCursor: null };
  } else if ((message.method === "thread/read" || message.method === "thread/resume") && thread && thread.id === message.params.threadId) {
    result = { thread, model: "fixture-model", modelProvider: "fixture", approvalPolicy: "on-request", sandbox: { type: "workspaceWrite" } };
  } else if (message.method === "thread/turns/list" && thread && thread.id === message.params.threadId) {
    result = { data: Array.isArray(thread.turns) ? [...thread.turns].reverse() : [], nextCursor: null };
  } else if (message.method !== "initialize" && message.method !== "skills/list" && message.method !== "hooks/list" && message.method !== "account/rateLimits/read") {
    send({ id: message.id, error: { code: -32601, message: "지원하지 않는 fixture 요청" } });
    return;
  }
  send({ id: message.id, result });
});
