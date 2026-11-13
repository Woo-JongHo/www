import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createConversationService, restoreConversationEvents } from "../src/conversations";
import { project } from "../src/projection";
import { JsonRpcClient } from "../src/rpc";
import type { AppEvent } from "../src/shared";

const cwd = "/workspace/project";
const thread = { id: "thread-1", cwd, originator: "www", source: "vscode", preview: "첫 요청", updatedAt: 50, status: { type: "notLoaded" }, ephemeral: false };
const oldTurn = { id: "turn-1", status: "completed", items: [
  { id: "u1", type: "userMessage", content: [{ type: "text", text: "첫 요청" }] },
  { id: "r1", type: "reasoning", summary: ["공개 요약"], content: ["PRIVATE_REASONING"] },
  { id: "a1", type: "agentMessage", text: "답변" },
  { id: "c1", type: "commandExecution", command: "echo ok", aggregatedOutput: "ok", exitCode: 0, status: "completed" },
  { id: "f1", type: "fileChange", status: "inProgress", changes: [{ path: "a.ts", diff: "+a" }] },
  { id: "x1", type: "requestApproval", command: "PRIVATE_REQUEST" }
] };

function clientFor(handler: (method: string, params: unknown) => unknown) {
  const calls: { method: string; params: unknown }[] = [];
  return { calls, async request(method: string, params: unknown) { calls.push({ method, params }); return handler(method, params); } };
}

function events(values: ReturnType<typeof restoreConversationEvents>): AppEvent[] {
  return values.map((value, index) => ({ ...value, seq: index + 100, at: "2026-11-12T00:00:00Z" }));
}

test("대화 목록은 현재 프로젝트와 WWW 원장만 조회하고 커서를 전달한다", async () => {
  const client = clientFor(() => ({ data: [thread, { ...thread, id: "other", cwd: "/another" }, { ...thread, id: "temp", ephemeral: true }, { ...thread, id: "unowned", originator: "another_client" }], nextCursor: "next" }));
  const result = await createConversationService(client, cwd).list("page");
  expect(client.calls).toEqual([{ method: "thread/list", params: { cwd, sourceKinds: ["appServer", "vscode"], archived: false, limit: 50, sortKey: "updated_at", cursor: "page" } }]);
  expect(result.threads.map((row) => row.id)).toEqual(["thread-1"]);
  expect(result.threads[0]?.title).toBe("첫 요청");
  expect(result.nextCursor).toBe("next");
  await expect(createConversationService(client, cwd).list(42)).rejects.toThrow("커서");
});

test("같은 Native thread를 재개하고 과거 공개 항목만 비실행 상태로 복원한다", async () => {
  const client = clientFor((method) => {
    if (method === "thread/read") return { thread };
    if (method === "thread/resume") return { thread, model: "model", modelProvider: "provider", approvalPolicy: "never", sandbox: { type: "readOnly" } };
    if (method === "thread/turns/list") return { data: [oldTurn], nextCursor: null };
    throw new Error(method);
  });
  const restored = await createConversationService(client, cwd).open("thread-1");
  expect(client.calls.map((call) => call.method)).toEqual(["thread/read", "thread/resume", "thread/turns/list"]);
  expect(client.calls[1]?.params).toEqual({ threadId: "thread-1", excludeTurns: true });
  expect(restored.threadId).toBe("thread-1");
  expect(restored.approvalPolicy).toBe("never");
  expect(restored.sandbox).toBe("readOnly");
  expect(restored.events.every((event) => event.historical)).toBe(true);
  const view = project(events(restored.events));
  expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "user", text: "첫 요청", state: "accepted" }));
  expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "answer", text: "답변", streaming: false }));
  expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "explanation", text: "공개 요약" }));
  expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "files", running: false, status: "unknown" }));
  expect(view.blocks.some((block) => block.kind === "approval")).toBe(false);
  expect(JSON.stringify(restored)).not.toContain("PRIVATE_REASONING");
  expect(JSON.stringify(restored)).not.toContain("PRIVATE_REQUEST");
  expect(view.working).toBe(false);
  expect(view.historyTruncated).toBe(false);
});

test("다른 프로젝트·다른 ID·실행 중 thread와 잘못된 응답은 재개하지 않는다", async () => {
  for (const bad of [{ ...thread, cwd: "/other" }, { ...thread, id: "wrong" }, { ...thread, status: { type: "active" } }, { ...thread, ephemeral: true }, { ...thread, originator: "another_client" }]) {
    const client = clientFor(() => ({ thread: bad }));
    await expect(createConversationService(client, cwd).open("thread-1")).rejects.toThrow();
    expect(client.calls.map((call) => call.method)).toEqual(["thread/read"]);
  }
  const malformed = clientFor(() => ({ data: null }));
  await expect(createConversationService(malformed, cwd).list()).rejects.toThrow("목록");
});

test("history page는 오래된 턴부터 복원하며 반복 커서나 요약 항목을 전체 이력으로 꾸미지 않는다", async () => {
  let pages = 0;
  const client = clientFor((method) => {
    if (method !== "thread/turns/list") return { thread };
    pages++;
    return { data: [{ ...oldTurn, id: pages === 1 ? "new" : "old" }], nextCursor: pages === 1 ? "older" : null };
  });
  const result = await createConversationService(client, cwd).open("thread-1");
  expect(result.events.filter((event) => event.method === "turn/started").map((event) => event.params)).toEqual([
    { threadId: "thread-1", turn: { id: "old" } }, { threadId: "thread-1", turn: { id: "new" } }
  ]);
  const repeated = clientFor((method) => method === "thread/turns/list" ? { data: [], nextCursor: "same" } : { thread });
  await expect(createConversationService(repeated, cwd).open("thread-1")).rejects.toThrow("반복");
  const summary = clientFor((method) => method === "thread/turns/list" ? { data: [{ ...oldTurn, itemsView: "summary" }], nextCursor: null } : { thread });
  await expect(createConversationService(summary, cwd).open("thread-1")).rejects.toThrow("전체 대화");
});

test("긴 출력과 불완전한 이력은 절단을 표시하고 저장된 inProgress나 승인 요청을 실행으로 재생하지 않는다", () => {
  const longTurn = { id: "old", status: "inProgress", items: [
    { id: "cmd", type: "commandExecution", command: "long", aggregatedOutput: "x".repeat(40_000), status: "inProgress" },
    { id: "files", type: "fileChange", status: "completed", changes: [{ path: "large.ts", diff: "y".repeat(40_000) }] }
  ] };
  const view = project(events(restoreConversationEvents("thread-1", [longTurn], false)));
  expect(view.historyTruncated).toBe(true);
  expect(view.working).toBe(false);
  expect(view.turn).toBe("unknown");
  expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "command", running: false, status: "unknown", outputTruncated: true }));
  const changed = view.blocks.find((block) => block.kind === "files");
  if (changed?.kind !== "files") throw new Error("복원된 파일 변경이 없습니다.");
  expect(changed.changes[0]?.truncated).toBe(true);
  expect(changed.changes[0]?.diff?.length).toBe(32_768);
  const historicalRequest: AppEvent = { seq: 1, at: "", historical: true, kind: "request", method: "item/commandExecution/requestApproval", requestId: 7, supported: true, params: {} };
  expect(project([historicalRequest]).blocks).toEqual([]);
});

for (const status of ["completed", "failed", "interrupted", "declined", "inProgress"]) {
  test(`저장 명령의 ${status} 상태를 복원하고 파일 변경의 기존 상태 경계를 유지한다`, () => {
    const restored = restoreConversationEvents("thread-1", [{
      id: "saved-turn", status: "completed", items: [
        { id: "command", type: "commandExecution", command: "example", status },
        { id: "files", type: "fileChange", status, changes: [{ path: "a.ts" }] }
      ]
    }], true);
    const view = project(events(restored));
    const commandStatus = status === "inProgress" || status === "interrupted" ? "unknown" : status;
    expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "command", running: false, status: commandStatus, startedAt: null, endedAt: null }));
    const fileStatus = status === "completed" || status === "failed" ? status : "unknown";
    expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "files", running: false, status: fileStatus }));
  });
}

test("실제 stdio subprocess를 재시작한 뒤 같은 Native thread ID와 누적 대화를 다시 연다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "www-conversations-"));
  const store = join(directory, "history.json");
  const start = () => {
    const child = spawn(process.execPath, [join(import.meta.dir, "fixtures/conversations-app-server.ts")], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, WWW_CONVERSATION_FIXTURE_STORE: store } });
    return { child, client: new JsonRpcClient(child) };
  };
  let running = start();
  try {
    await running.client.request("initialize", {});
    await running.client.request("thread/start", { cwd });
    await running.client.request("turn/start", { threadId: "thread-persisted", input: [{ type: "text", text: "재시작 전 요청" }] });
    running.child.kill();
    running = start();
    await running.client.request("initialize", {});
    const service = createConversationService(running.client, cwd);
    const listed = await service.list();
    expect(listed.threads[0]?.id).toBe("thread-persisted");
    const opened = await service.open("thread-persisted");
    expect(project(events(opened.events)).blocks).toContainEqual(expect.objectContaining({ kind: "user", text: "재시작 전 요청" }));
    await running.client.request("turn/start", { threadId: opened.threadId, input: [{ type: "text", text: "이어가는 요청" }] });
    const reopened = await service.open(opened.threadId);
    expect(project(events(reopened.events)).blocks.filter((block) => block.kind === "user")).toHaveLength(2);
  } finally {
    running.child.kill();
    await rm(directory, { recursive: true, force: true });
  }
}, 10_000);
