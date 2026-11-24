#!/usr/bin/env bun
// 실제 Electron IPC·stdio 경계를 검사하는 합성 Native. 모델을 실행하지 않는다.
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

type Data = Record<string, unknown>;
const cwd = process.cwd();
if (process.argv.includes("exec")) {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const argv = process.argv;
  if (!basename(cwd).startsWith("www-side-question-") || !argv.includes("read-only") || !argv.includes("--ignore-user-config")
    || !argv.includes("--ephemeral") || !argv.includes("mcp_servers={}") || !argv.includes("hooks") || !argv.includes("shell_tool")) process.exit(2);
  if (input.question === "사이드 실패 확인") process.exit(3);
  const context = JSON.stringify(input.context);
  if (!context.includes("저장된 작업 요청") || !context.includes("이어갈 작업") || context.includes("PRIVATE_REASONING_DO_NOT_RENDER") || context.includes("saved output")) process.exit(4);
  await new Promise(resolve => setTimeout(resolve, 120));
  console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "저장 대화 맥락에서 읽은 별도 답변" } }));
  console.log(JSON.stringify({ type: "turn.completed" }));
  process.exit(0);
}
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
let performanceTimer: ReturnType<typeof setInterval> | null = null;
let boundaryApproval = 0;
const loadedThreads = new Set<string>();

const object = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
const result = (id: unknown, value: unknown) => send({ jsonrpc: "2.0", id, result: value });
const notify = (method: string, params: unknown) => send({ jsonrpc: "2.0", method, params });
function releaseAfter(file: string, action: () => void) {
  const deadline = Date.now() + 30_000;
  const timer = setInterval(() => {
    if (existsSync(join(cwd, file))) { clearInterval(timer); action(); }
    else if (Date.now() > deadline) { clearInterval(timer); process.stderr.write("경계 fixture release 제한 시간: " + file + "\n"); process.exit(1); }
  }, 20);
}
function boundaryRequest() {
  if (!pending) return;
  send({ jsonrpc: "2.0", id: boundaryApproval < 2 ? 42 : "42", method: "item/commandExecution/requestApproval", params: { ...pending, command: "printf boundary-approval-" + (boundaryApproval + 1) } });
}
function finish(status = "completed", answerText?: string) {
  if (!pending) return;
  if (performanceTimer) { clearInterval(performanceTimer); performanceTimer = null; }
  const { threadId, turnId, prompt } = pending;
  const answer = answerText ?? (status === "completed" ? "### 후속 요청 완료\n\n같은 대화에서 이어졌습니다." : "중단된 요청입니다.");
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
  writeFileSync(callsPath, JSON.stringify({ method: message.method ?? "response", params, id: message.id, result: message.result, pid: process.pid }) + "\n", { flag: "a" });
  if (!message.method) {
    if (pending?.prompt === "경계 승인 ID 재사용" && message.id === (boundaryApproval < 2 ? 42 : "42")) {
      notify("serverRequest/resolved", { threadId: pending.threadId, requestId: message.id });
      boundaryApproval++;
      if (boundaryApproval < 4) boundaryRequest(); else finish();
    } else if (pending?.prompt === "경계 해소 ID 후속 승인" && message.id === "boundary-resolved") finish();
    else if (message.id === 42) finish();
    continue;
  }
  if (message.id === undefined) continue;
  if (message.method === "initialize") result(message.id, { userAgent: "fixture" });
  else if (message.method === "model/list") result(message.id, {
    data: [
      { model: "fixture", displayName: "기본 모델", isDefault: true },
      ...(existsSync(join(cwd, "fixture-hide-other-model")) ? [] : [{ model: "fixture-other", displayName: "다른 모델", isDefault: false }])
    ],
    nextCursor: null
  });
  else if (message.method === "thread/compact/start") {
    if (existsSync(join(cwd, "fixture-compact-reject"))) {
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "합성 압축 요청 거절" } });
      continue;
    }
    const threadId = String(params.threadId);
    const turnId = "fixture-compact-" + randomUUID();
    const item = { type: "contextCompaction", id: turnId + "-item" };
    if (existsSync(join(cwd, "fixture-compact-no-response"))) continue;
    result(message.id, {});
    if (existsSync(join(cwd, "fixture-compact-no-start"))) continue;
    notify("turn/started", { threadId, turn: { id: turnId, status: "inProgress", items: [] } });
    notify("item/started", { threadId, turnId, item });
    if (existsSync(join(cwd, "fixture-compact-no-completion"))) continue;
    setTimeout(() => {
      const failed = existsSync(join(cwd, "fixture-compact-fail"));
      if (!failed) notify("item/completed", { threadId, turnId, item });
      notify("turn/completed", { threadId, turn: { id: turnId, status: failed ? "failed" : "completed", items: [] } });
    }, 450);
  }
  else if (message.method === "thread/list") result(message.id, { data: Object.keys(histories).map((id) => ({ id, name: id === "history-a" ? "저장 작업 A" : id === "history-b" ? "저장 작업 B" : "새 작업", preview: "복원 가능한 대화", cwd, updatedAt: 1794470000, source: "vscode", originator: "www", status: { type: "idle" } })), nextCursor: null });
  else if (message.method === "thread/read" || message.method === "thread/resume") {
    if (message.method === "thread/resume") loadedThreads.add(String(params.threadId));
    result(message.id, { thread: { id: params.threadId, cwd, originator: "www", source: "vscode", status: { type: "idle" }, turns: [] }, model: "fixture", modelProvider: "fixture" });
  }
  else if (message.method === "thread/turns/list") {
    histories = JSON.parse(readFileSync(storePath, "utf8"));
    result(message.id, { data: [...(histories[String(params.threadId)] ?? [])].reverse(), nextCursor: null });
  }
  else if (message.method === "thread/start") {
    loadedThreads.add("thread-new");
    histories["thread-new"] ??= [];
    writeFileSync(storePath, JSON.stringify(histories));
    setTimeout(() => result(message.id, { thread: { id: "thread-new", cwd, originator: "www", source: "vscode", status: { type: "idle" } }, model: "fixture", modelProvider: "fixture" }), 80);
  } else if (message.method === "turn/start") {
    const input = Array.isArray(params.input) ? object(params.input[0]) : {};
    const prompt = typeof input.text === "string" ? input.text : "";
    const threadId = String(params.threadId);
    if (!loadedThreads.has(threadId)) {
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "이 Native 프로세스에서 thread/resume 없이 turn/start를 받았습니다." } });
      continue;
    }
    if (prompt === "경계 재연결 후 전송 실패 확인") {
      notify("fixture/reconnectFailureReady", { threadId });
      releaseAfter("fixture-reconnect-failure-release", () => send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "합성 재연결 전송 실패" } }));
      continue;
    }
    if (prompt.includes("전송 실패 확인")) {
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "합성 전송 실패" } });
      continue;
    }
    const turnId = "live-" + Date.now() + "-" + ++turnCounter;
    pending = { threadId, turnId, prompt };
    if (prompt === "사이드바 두 번째 요청 확인") await new Promise((resolve) => setTimeout(resolve, 450));
    const startedBeforeResponse = prompt === "스트리밍 이력 절단 중단 확인";
    if (startedBeforeResponse) notify("turn/started", { threadId, turn: { id: turnId } });
    result(message.id, { turn: { id: turnId } });
    if (!startedBeforeResponse) notify("turn/started", { threadId, turn: { id: turnId } });
    if (prompt === "성능 스트리밍 중단 확인") {
      const id = "turn-performance";
      let count = 0;
      notify("item/started", { threadId, turnId, item: { id, type: "commandExecution", command: "fixture performance stream", cwd, status: "inProgress" } });
      performanceTimer = setInterval(() => {
        count++;
        notify("item/commandExecution/outputDelta", { threadId, turnId, itemId: id, delta: `출력 ${count}\n` });
        if (count === 120) {
          notify("item/completed", { threadId, turnId, item: { id, type: "commandExecution", command: "fixture performance stream", cwd, status: "completed", exitCode: 0, aggregatedOutput: Array.from({ length: count }, (_, index) => `출력 ${index + 1}\n`).join("") } });
          finish();
        }
      }, 20);
    }
    else if (prompt === "경계 사이드 질문 승인 대기") {
      send({ jsonrpc: "2.0", id: 42, method: "item/commandExecution/requestApproval", params: { threadId, turnId, command: "printf side-question-approval" } });
    }
    else if (prompt === "경계 승인 ID 재사용") {
      boundaryApproval = 0;
      boundaryRequest();
    }
    else if (prompt === "경계 승인 해소 대기" || prompt === "경계 해소 ID 후속 승인") {
      send({ jsonrpc: "2.0", id: "boundary-resolved", method: "item/commandExecution/requestApproval", params: { threadId, turnId, command: prompt === "경계 승인 해소 대기" ? "printf boundary-resolved-first" : "printf boundary-resolved-next" } });
    }
    else if (prompt === "경계 공개 설명 교차 순서") {
      const scope = { threadId, turnId };
      notify("item/reasoning/summaryTextDelta", { ...scope, itemId: "boundary-summary", summaryIndex: 0, delta: "경계 요약 A" });
      notify("item/agentMessage/delta", { ...scope, itemId: "boundary-commentary", phase: "commentary", delta: "경계 설명 B" });
      notify("item/reasoning/summaryTextDelta", { ...scope, itemId: "boundary-summary", summaryIndex: 0, delta: "경계 요약 C" });
      releaseAfter("fixture-summary-release", () => {
        notify("item/completed", { ...scope, item: { id: "boundary-summary", type: "reasoning", summary: ["경계 최종 요약"] } });
        finish();
      });
    }
    else if (prompt === "경계 유휴 종료 준비") {
      const run = { id: "boundary-handler", eventName: "preToolUse", executionMode: "sync", sourcePath: "/fixture/boundary-hooks.json", displayOrder: 0, handlerType: "command", status: "running", entries: [] };
      notify("hook/started", { threadId, turnId, run });
      const child = { id: turnId + "-spawn", type: "collabAgentToolCall", tool: "spawnAgent", senderThreadId: threadId, receiverThreadIds: ["sidebar-child"], agentsStates: { "sidebar-child": { status: "running", message: "하위 작업 진행" } } };
      notify("item/started", { threadId, turnId, item: child });
      setTimeout(() => notify("item/completed", { threadId, turnId, item: child }), 150);
      setTimeout(() => notify("item/completed", { threadId, turnId, item: { ...child, agentsStates: { "sidebar-child": { status: "completed", message: "하위 작업 완료" } } } }), 900);
      notify("hook/completed", { threadId, turnId, run: { ...run, status: "completed" } });
      finish("completed", "경계 유휴 종료 이전 답변");
      setTimeout(() => process.exit(0), 160);
    }
    else if (prompt === "경계 재연결 실패 준비") {
      finish("completed", "경계 재연결 실패 이전 답변");
      setTimeout(() => process.exit(0), 160);
    }
    else if (prompt === "경계 유휴 종료 후 이어가기") {
      notify("item/agentMessage/delta", { threadId, turnId, itemId: turnId + "-fresh-commentary", phase: "commentary", delta: "경계 재연결 새 공개 설명" });
      setTimeout(() => finish("completed", "경계 재연결 후속 답변"), 80);
    }
    else if (prompt === "경계 실행 중 종료") {
      notify("item/started", { threadId, turnId, item: { id: turnId + "-no-replay", type: "commandExecution", command: "printf boundary-no-replay", cwd, status: "inProgress" } });
      setTimeout(() => process.exit(0), 160);
    }
    else if (prompt === "경계 실행 종료 후 수동 후속") setTimeout(() => finish("completed", "경계 수동 복구 후속 답변"), 80);
    else if (prompt === "사이드바 첫 요청 확인") {
      notify("turn/plan/updated", { threadId, turnId, plan: [{ step: "첫 요청 전용 단계", status: "inProgress" }] });
      const run = { id: "sidebar-handler-a", eventName: "preToolUse", executionMode: "sync", sourcePath: "/fixture/handler-a.json", displayOrder: 0, handlerType: "command", status: "running", entries: [] };
      notify("hook/started", { threadId, turnId, run });
      const child = { id: turnId + "-spawn", type: "collabAgentToolCall", tool: "spawnAgent", senderThreadId: threadId, receiverThreadIds: ["sidebar-child"], agentsStates: { "sidebar-child": { status: "running", message: "하위 작업 진행" } } };
      notify("item/started", { threadId, turnId, item: child });
      setTimeout(() => notify("item/completed", { threadId, turnId, item: child }), 150);
      setTimeout(() => notify("item/completed", { threadId, turnId, item: { ...child, agentsStates: { "sidebar-child": { status: "completed", message: "하위 작업 완료" } } } }), 900);
      const item = { id: turnId + "-private-documents", type: "commandExecution", command: "fixture structured document reads", cwd, commandActions: [{ type: "read", path: join(cwd, ".private-one/SKILL.md") }, { type: "read", path: join(cwd, ".private-two/SKILL.md") }], status: "inProgress" };
      notify("item/started", { threadId, turnId, item });
      setTimeout(() => {
        notify("hook/completed", { threadId, turnId, run: { ...run, status: "failed" } });
        notify("hook/completed", { threadId, turnId, run: { ...run, id: "sidebar-handler-b", sourcePath: "/fixture/handler-b.json", displayOrder: 1, status: "completed" } });
        notify("item/completed", { threadId, turnId, item: { ...item, status: "completed", exitCode: 0 } });
        notify("turn/plan/updated", { threadId, turnId, plan: [{ step: "첫 요청 전용 단계", status: "completed" }] });
        setTimeout(() => finish(), 600);
      }, 500);
    }
    else if (prompt === "사이드바 두 번째 요청 확인") {
      setTimeout(() => {
        notify("turn/plan/updated", { threadId, turnId, plan: [{ step: "두 번째 요청 전용 단계", status: "inProgress" }] });
        setTimeout(() => finish(), 500);
      }, 500);
    }
    else if (prompt === "원장 저장 실패 확인") {
      notify("item/completed", { threadId, turnId, item: { id: turnId + "-unsaved", type: "commandExecution", command: "fixture unsaved metadata", cwd, status: "completed", exitCode: 0 } });
      setTimeout(() => finish(), 80);
    }
    else if (prompt.includes("실시간 카드 확인")) {
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
    else if (prompt === "스트리밍 승인 보존") {
      send({ jsonrpc: "2.0", id: 42, method: "item/commandExecution/requestApproval", params: { threadId, turnId, command: "printf retained-approval" } });
      for (let index = 0; index < 2_050; index++) notify("fixture/stream", { threadId, turnId, index });
    }
    else if (prompt.includes("승인 확인")) send({ jsonrpc: "2.0", id: 42, method: "item/commandExecution/requestApproval", params: { threadId, turnId, command: "printf approved" } });
    else if (prompt === "스트리밍 이력 절단 중단 확인") {
      setTimeout(() => {
        for (let index = 0; index < 2_050; index++) notify("fixture/stream", { threadId, turnId, index });
        notify("item/agentMessage/delta", { threadId, turnId, itemId: turnId + "-streamed", delta: "이력 절단 뒤에도 들어온 응답" });
      }, 60);
    }
    else if (prompt.includes("무활동 확인")) setTimeout(() => finish(), 16_000);
    else if (prompt.includes("결과 미확인 확인")) setTimeout(() => finish("mystery"), 80);
    else if (!prompt.includes("중단 확인")) setTimeout(() => finish(), 80);
  } else if (message.method === "turn/steer") {
    const input = Array.isArray(params.input) ? object(params.input[0]) : {};
    if (!pending || params.threadId !== pending.threadId || params.expectedTurnId !== pending.turnId) {
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32602, message: "활성 턴 불일치" } });
    } else if (input.text === "대기 추가 지시") {
      const current = pending.turnId;
      releaseAfter("fixture-steer-release", () => result(message.id, { turnId: current }));
    } else if (input.text === "연결 종료 추가 지시") process.exit(0);
    else if (input.text === "mismatch") result(message.id, { turnId: "other-turn" });
    else if (input.text === "종료 경합") {
      finish();
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32602, message: "턴 종료" } });
    } else result(message.id, { turnId: pending.turnId });
  } else if (message.method === "turn/interrupt") {
    result(message.id, {});
    if (pending?.prompt === "경계 승인 해소 대기") {
      notify("serverRequest/resolved", { threadId: pending.threadId, requestId: "boundary-resolved" });
      releaseAfter("fixture-resolved-release", () => finish("interrupted"));
    } else finish("interrupted");
  }
  else if (message.method === "skills/list" || message.method === "hooks/list") result(message.id, { data: [{ cwd, skills: [], hooks: message.method === "hooks/list" ? [
    { key: "boundary-hook", eventName: "preToolUse", sourcePath: "/fixture/boundary-hooks.json", displayOrder: 0, handlerType: "command", enabled: true, source: "project", currentHash: "boundary", isManaged: false, timeoutSec: 5, trustStatus: "trusted", command: "fixture", async: false }
  ] : [], errors: [] }] });
  else result(message.id, {});
}
