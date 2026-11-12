#!/usr/bin/env node
// 실제 Native 대신 동결된 subprocess에 합성 활동 알림을 덧붙이는 검증 fixture다.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const child = spawn(process.execPath, [fileURLToPath(new URL("./fake-app-server.ts", import.meta.url)), ...process.argv.slice(2)], { stdio: ["pipe", "pipe", "pipe"] });


const threadRequests = new Set<unknown>();


let turns = 0;


let turnId = "turn-fixture";


const threadId = "thread-fixture";


const send = (message: unknown): void => { process.stdout.write(`${JSON.stringify(message)}\n`); };


const notify = (method: string, params: Record<string, unknown>): void => send({ jsonrpc: "2.0", method, params });

function hook(id: string, eventName: string, scoped: boolean): void {
  const startedAt = Math.floor(Date.now() / 1000);


  const run = { id, eventName, handlerType: "command", scope: scoped ? "turn" : "thread", executionMode: "sync", source: "project", sourcePath: "fixture-hooks.json", startedAt, displayOrder: 1, entries: [] };


  const params = scoped ? { threadId, turnId } : { threadId };
  notify("hook/started", { ...params, run: { ...run, status: "running" } });
  notify("hook/completed", { ...params, run: { ...run, status: "completed", completedAt: startedAt, durationMs: 12 } });
}

function injectActivity(): void {
  notify("turn/plan/updated", { threadId, turnId, plan: [{ step: "자료 확인", status: "completed" }, { step: "구현·검사", status: "inProgress" }, { step: "답변 정리", status: "pending" }] });
  hook(`hook-${turnId}`, "preToolUse", true);
  const command = "cat /fixture/skills/www-design/SKILL.md";


  const item = { id: `skill-${turnId}`, type: "commandExecution", command, commandActions: [{ type: "read", path: "/fixture/skills/www-design/SKILL.md", name: "SKILL.md", command }] };
  notify("item/started", { threadId, turnId, item: { ...item, status: "inProgress" } });
  notify("item/completed", { threadId, turnId, item: { ...item, status: "completed", exitCode: 0 } });
  notify("item/completed", { threadId, turnId, item: { id: `private-${turnId}`, type: "reasoning", summary: ["공개 요약: 작업 흐름과 확인한 결과를 정리했습니다."], content: ["PRIVATE_REASONING_DO_NOT_RENDER"] } });
  const first = { inputTokens: 800, outputTokens: 200, cachedInputTokens: 200, reasoningOutputTokens: 50, totalTokens: 1000 };


  const total = turns === 1 ? first : { inputTokens: 1400, outputTokens: 600, cachedInputTokens: 300, reasoningOutputTokens: 150, totalTokens: 2000 };


  const last = turns === 1 ? first : { inputTokens: 600, outputTokens: 400, cachedInputTokens: 100, reasoningOutputTokens: 100, totalTokens: 1000 };


  const tokenUsage = { total, last, modelContextWindow: 128000 };
  notify("thread/tokenUsage/updated", { threadId, turnId, tokenUsage });
  notify("thread/tokenUsage/updated", { threadId, turnId, tokenUsage });
  if (turns > 1) notify("model/rerouted", { threadId, turnId, fromModel: "fixture-model-a", toModel: "fixture-model-b", reason: "highRiskCyberActivity" });
}

const input = createInterface({ input: process.stdin });
input.on("line", (line) => {
  const message: unknown = JSON.parse(line);
  if (!object(message)) throw new Error("fixture 요청 객체가 필요합니다.");
  if (message.method === "account/rateLimits/read") {
    const resetsAt = Math.floor(Date.now() / 1000) + 3600;


    const rateLimits = { limitId: "codex", limitName: "fixture 계정", primary: { usedPercent: 25, windowDurationMins: 300, resetsAt }, secondary: { usedPercent: 40, windowDurationMins: 10080, resetsAt } };
    send({ jsonrpc: "2.0", id: message.id, result: { rateLimits, rateLimitsByLimitId: { codex: rateLimits } } });
    return;
  }
  if (message.method === "thread/start") threadRequests.add(message.id);
  if (message.method === "turn/start") {
    turns += 1;
    turnId = turns === 1 ? "turn-fixture" : "turn-activity-2";
  }
  child.stdin.write(`${line}\n`);
});
input.on("close", () => child.stdin.end());

createInterface({ input: child.stdout }).on("line", (line) => {
  const message: unknown = JSON.parse(line);
  if (!object(message)) throw new Error("fixture 응답 객체가 필요합니다.");
  if (object(message.params)) {
    if (message.params.turnId === "turn-fixture") message.params.turnId = turnId;
    if (object(message.params.turn) && message.params.turn.id === "turn-fixture") message.params.turn.id = turnId;
  }
  if (object(message.result)) {
    if (object(message.result.turn) && message.result.turn.id === "turn-fixture") message.result.turn.id = turnId;
    if (threadRequests.delete(message.id)) {
      message.result.model = "fixture-model-a";
      message.result.modelProvider = "fixture";
      if (object(message.result.thread)) message.result.thread.model = "fixture-model-a";
      send(message);
      hook("hook-session-start", "sessionStart", false);
      return;
    }
  }
  send(message);
  if (message.method === "item/started" && object(message.params) && object(message.params.item) && message.params.item.id === "command-1") injectActivity();
});
child.stderr.pipe(process.stderr);
child.once("error", (error) => { console.error(error.message); process.exitCode = 1; input.close(); });
child.once("close", (code) => { input.close(); process.exitCode = code ?? 1; });
const stop = (): void => { child.kill("SIGTERM"); input.close(); };
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
process.once("exit", () => { child.kill("SIGTERM"); });
