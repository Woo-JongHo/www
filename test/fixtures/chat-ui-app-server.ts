#!/usr/bin/env bun
// 실제 Electron IPC·stdio 경계를 검사하는 합성 Native. 모델을 실행하지 않는다.
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Data = Record<string, unknown>;
const cwd = process.env.WWW_PROBE_WORKSPACE ?? process.cwd();
const storePath = join(cwd, "fixture-history.json");
const callsPath = join(cwd, "fixture-calls.jsonl");
const initialItems = [
  { id: "saved-user", type: "userMessage", content: [{ type: "text", text: "저장된 작업 요청" }] },
  { id: "saved-summary", type: "reasoning", summary: ["공개 요약입니다."], content: ["PRIVATE_REASONING_DO_NOT_RENDER"] },
  { id: "saved-command", type: "commandExecution", command: "printf saved", cwd, status: "completed", exitCode: 0, aggregatedOutput: "saved output" },
  { id: "saved-files", type: "fileChange", status: "completed", changes: [{ path: "saved.ts", diff: "--- a/saved.ts\n+++ b/saved.ts\n+const saved = true;" }] },
  { id: "saved-answer", type: "agentMessage", phase: "final_answer", text: "## 저장된 답변\n\n**이어갈 작업**을 확인했습니다.\n\n| 항목 | 상태 |\n| --- | --- |\n| 저장 | 완료 |\n\n\`\`\`ts\nconst saved = true;\n\`\`\`\n\n[공식 문서](https://example.com/docs)\n\n" + Array.from({ length: 35 }, (_, i) => "기록 문단 " + i + "\n\n").join("") }
];
let histories: Record<string, unknown[]> = {
  "history-a": [{ id: "saved-turn-a", status: "completed", items: initialItems }],
  "history-b": [{ id: "saved-turn-b", status: "completed", items: [{ id: "b-user", type: "userMessage", content: [{ type: "text", text: "두 번째 작업" }] }, { id: "b-answer", type: "agentMessage", text: "두 번째 저장 대화" }] }]
};
try { histories = JSON.parse(readFileSync(storePath, "utf8")); } catch { writeFileSync(storePath, JSON.stringify(histories)); }
let turnCounter = 0;
let pending: { threadId: string; turnId: string; prompt: string } | null = null;

const object = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
const result = (id: unknown, value: unknown) => send({ jsonrpc: "2.0", id, result: value });
const notify = (method: string, params: unknown) => send({ jsonrpc: "2.0", method, params });
function finish(status = "completed") {
  if (!pending) return;
  const { threadId, turnId, prompt } = pending;
  const answer = status === "completed" ? "### 후속 요청 완료\n\n같은 대화에서 이어졌습니다." : "중단된 요청입니다.";
  const items = [
    { id: turnId + "-user", type: "userMessage", content: [{ type: "text", text: prompt }] },
    { id: turnId + "-answer", type: "agentMessage", text: answer }
  ];
  notify("item/completed", { threadId, turnId, item: items[1] });
  notify("turn/completed", { threadId, turn: { id: turnId, status } });
  histories[threadId] ??= [];
  histories[threadId].push({ id: turnId, status, items });
  writeFileSync(storePath, JSON.stringify(histories));
  pending = null;
}
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  const message = object(JSON.parse(line));
  const params = object(message.params);
  writeFileSync(callsPath, JSON.stringify({ method: message.method ?? "response", params, id: message.id }) + "\n", { flag: "a" });
  if (!message.method) { if (message.id === 42) finish(); continue; }
  if (message.id === undefined) continue;
  if (message.method === "initialize") result(message.id, { userAgent: "fixture" });
  else if (message.method === "thread/list") result(message.id, { data: Object.keys(histories).map((id) => ({ id, name: id === "history-a" ? "저장 작업 A" : id === "history-b" ? "저장 작업 B" : "새 작업", preview: "복원 가능한 대화", cwd, updatedAt: 1794470000, source: "vscode", originator: "www", status: { type: "idle" } })), nextCursor: null });
  else if (message.method === "thread/read" || message.method === "thread/resume") result(message.id, { thread: { id: params.threadId, cwd, originator: "www", source: "vscode", status: { type: "idle" }, turns: [] }, model: "fixture", modelProvider: "fixture" });
  else if (message.method === "thread/turns/list") {
    histories = JSON.parse(readFileSync(storePath, "utf8"));
    result(message.id, { data: [...(histories[String(params.threadId)] ?? [])].reverse(), nextCursor: null });
  }
  else if (message.method === "thread/start") {
    histories["thread-new"] ??= [];
    writeFileSync(storePath, JSON.stringify(histories));
    result(message.id, { thread: { id: "thread-new", cwd, originator: "www", source: "vscode", status: { type: "idle" } }, model: "fixture", modelProvider: "fixture" });
  } else if (message.method === "turn/start") {
    const input = Array.isArray(params.input) ? object(params.input[0]) : {};
    const prompt = typeof input.text === "string" ? input.text : "";
    if (prompt.includes("전송 실패 확인")) {
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "합성 전송 실패" } });
      continue;
    }
    const threadId = String(params.threadId);
    const turnId = "live-" + Date.now() + "-" + ++turnCounter;
    pending = { threadId, turnId, prompt };
    result(message.id, { turn: { id: turnId } });
    notify("turn/started", { threadId, turn: { id: turnId } });
    if (prompt.includes("실시간 카드 확인")) {
      process.stdout.write("{broken-json\n");
      const id = turnId + "-command";

      const output = Array.from({ length: 11 }, (_, index) => `    실시간 출력 ${index + 1}`).join("\n");
      notify("item/started", { threadId, turnId, item: { id, type: "commandExecution", command: "printf live", cwd, status: "inProgress" } });
      notify("item/commandExecution/outputDelta", { threadId, turnId, itemId: id, delta: output });
      notify("item/agentMessage/delta", { threadId, turnId, itemId: turnId + "-commentary", delta: "출력을 확인하고 있습니다.", phase: "commentary" });
      setTimeout(() => {
        notify("item/completed", { threadId, turnId, item: { id, type: "commandExecution", command: "printf live", cwd, status: "failed", exitCode: 1, aggregatedOutput: output } });
        finish();
      }, 1200);
    }
    else if (["명령 거절 확인", "턴 중단 확인"].includes(prompt)) {
      const item = {
        id: turnId + "-status-command", type: "commandExecution", cwd,
        command: prompt === "명령 거절 확인" ? "printf declined" : "printf unfinished"
      };
      notify("item/started", { threadId, turnId, item: { ...item, status: "inProgress" } });
      setTimeout(() => {
        if (prompt !== "턴 중단 확인") notify("item/completed", { threadId, turnId, item: { ...item, status: "declined" } });
        finish(prompt === "턴 중단 확인" ? "interrupted" : "completed");
      }, 80);
    }
    else if (prompt.includes("승인 확인")) send({ jsonrpc: "2.0", id: 42, method: "item/commandExecution/requestApproval", params: { threadId, turnId, command: "printf approved" } });
    else if (!prompt.includes("중단 확인")) setTimeout(() => finish(), 80);
  } else if (message.method === "turn/interrupt") { result(message.id, {}); finish("interrupted"); }
  else if (message.method === "skills/list" || message.method === "hooks/list") result(message.id, { data: [{ cwd, skills: [], hooks: [], errors: [] }] });
  else result(message.id, {});
}
