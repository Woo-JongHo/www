/**
 * @verifies RESP-CHAT-SESSIONS-RESTORE
 */
import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve, win32 } from "node:path";
import { spawn } from "node:child_process";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createConversationService, restoreConversationEvents } from "../src/conversations";
import { project } from "../src/projection";
import { JsonRpcClient } from "../src/rpc";
import type { AppEvent } from "../src/shared";

const cwd    = "/workspace/project"                                                                                                                             ;
const thread = { id: "thread-1", cwd, originator: "www", source: "vscode", preview: "첫 요청", updatedAt: 50, status: { type: "notLoaded" }, ephemeral: false } ;
const oldTurn = { id: "turn-1", status: "completed", items: [
  { id : "u1" , type : "userMessage"      , content : [{ type: "text", text: "첫 요청" }]                                       },
  { id : "r1" , type : "reasoning"        , summary : ["공개 요약"] , content          : ["PRIVATE_REASONING"]                  },
  { id : "a1" , type : "agentMessage"     , text    : "답변"                                                                    },
  { id : "c1" , type : "commandExecution" , command : "echo ok"     , aggregatedOutput : "ok", exitCode: 0, status: "completed" },
  { id : "f1" , type : "fileChange"       , status  : "inProgress"  , changes          : [{ path: "a.ts", diff: "+a" }]         },
  { id : "x1" , type : "requestApproval"  , command : "PRIVATE_REQUEST"                                                         }
] };

function clientFor(handler: (method: string, params: unknown) => unknown) {
  const calls: { method: string; params: unknown }[] = [];
  return { calls, async request(method: string, params: unknown) { calls.push({ method, params }); return handler(method, params); } };
}

function events(values: ReturnType<typeof restoreConversationEvents>): AppEvent[] {
  return values.map((value, index) => ({ ...value, seq: index + 100, at: "2026-11-12T00:00:00Z" }));
}

test("대화 목록은 현재 프로젝트와 WWW 원장만 조회하고 커서를 전달한다", async () => {
  const client = clientFor(() => ({ data: [thread, { ...thread, id: "other", cwd: "/another" }, { ...thread, id: "temp", ephemeral: true }, { ...thread, id: "unowned", originator: "another_client" }], nextCursor: "next" })) ;
  const result = await createConversationService(client, cwd).list("page")                                                                                                                                                      ;
  expect(client.calls                       ).toEqual([{ method: "thread/list", params: { cwd, sourceKinds: ["appServer", "vscode"], archived: false, limit: 50, sortKey: "updated_at", cursor: "page" } }]) ;
  expect(result.threads.map((row) => row.id)).toEqual(["thread-1"]                                                                                                                                         ) ;
  expect(result.threads[0]?.title           ).toBe   ("첫 요청"                                                                                                                                            ) ;
  expect(result.nextCursor                  ).toBe   ("next"                                                                                                                                               ) ;
  await expect(createConversationService(client, cwd).list(42)).rejects.toThrow("커서");
});

test("기존 Native thread를 Bypass로 재개하고 모델과 과거 공개 항목을 보존한다", async () => {
  const client = clientFor((method) => {
    if (method === "thread/read"      ) return { thread };
    if (method === "thread/resume"    ) return { thread, model: "model", modelProvider: "provider", approvalPolicy: "never", sandbox: { type: "readOnly" } };
    if (method === "thread/turns/list") return { data: [oldTurn], nextCursor: null };
    throw new Error(method);
  });
  const restored = await createConversationService(client, cwd).open("thread-1");
  expect(client.calls.map((call) => call.method)           ).toEqual(["thread/read", "thread/resume", "thread/turns/list"]                                                        ) ;
  expect(client.calls[1]?.params                           ).toEqual({ threadId: "thread-1", excludeTurns: true, approvalPolicy: "never", sandbox: "danger-full-access" }         ) ;
  expect(restored.model                                    ).toBe   ("model"                                                                                                      ) ;
  expect(restored.provider                                 ).toBe   ("provider"                                                                                                   ) ;
  expect(restored.threadId                                 ).toBe   ("thread-1"                                                                                                   ) ;
  expect(restored.approvalPolicy                           ).toBe   ("never"                                                                                                      ) ;
  expect(restored.sandbox                                  ).toBe   ("readOnly"                                                                                                   ) ;
  expect(restored.events.every((event) => event.historical)).toBe   (true                                                                                                         ) ;
  const view = project(events(restored.events));
  expect(view.blocks                                           )    .toContainEqual(expect.objectContaining({ kind: "user", text: "첫 요청", state: "accepted" })) ;
  expect(view.blocks                                           )    .toContainEqual(expect.objectContaining({ kind: "answer", text: "답변", streaming: false })  ) ;
  expect(view.blocks                                           )    .toContainEqual(expect.objectContaining({ kind: "explanation", text: "공개 요약" })          ) ;
  expect(view.blocks                                           )    .toContainEqual(expect.objectContaining({ kind: "files", running: false, status: "unknown" })) ;
  expect(view.blocks.some((block) => block.kind === "approval"))    .toBe          (false                                                                        ) ;
  expect(JSON.stringify(restored)                              ).not.toContain     ("PRIVATE_REASONING"                                                          ) ;
  expect(JSON.stringify(restored)                              ).not.toContain     ("PRIVATE_REQUEST"                                                            ) ;
  expect(view.working                                          )    .toBe          (false                                                                        ) ;
  expect(view.historyTruncated                                 )    .toBe          (false                                                                        ) ;
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
  expect(view.historyTruncated).toBe          (true                                                                                                  ) ;
  expect(view.working         ).toBe          (false                                                                                                 ) ;
  expect(view.turn            ).toBe          ("unknown"                                                                                             ) ;
  expect(view.blocks          ).toContainEqual(expect.objectContaining({ kind: "command", running: false, status: "unknown", outputTruncated: true })) ;
  const changed = view.blocks.find((block) => block.kind === "files");
  if (changed?.kind !== "files") throw new Error("복원된 파일 변경이 없습니다.");
  expect(changed.changes[0]?.truncated).toBe(true);
  expect(changed.changes[0]?.diff?.length).toBe(32_768);
  const historicalRequest: AppEvent = { seq: 1, at: "", historical: true, kind: "request", method: "item/commandExecution/requestApproval", requestId: 7, supported: true, params: {} };
  expect(project([historicalRequest]).blocks).toEqual([]);
});

for (const status of ["completed", "failed", "interrupted", "declined", "inProgress"]) {
  test(`저장 명령의 ${status} 상태를 복원하고 파일 변경의 실제 종료 상태 경계를 보존한다`, () => {
    const restored = restoreConversationEvents("thread-1", [{
      id: "saved-turn", status: "completed", items: [
        { id: "command", type: "commandExecution", command: "example", status },
        { id: "files", type: "fileChange", status, changes: [{ path: "a.ts" }] }
      ]
    }], true);
    const view          = project(events(restored))                                                ;
    const commandStatus = status === "inProgress" || status === "interrupted" ? "unknown" : status ;
    expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "command", running: false, status: commandStatus, startedAt: null, endedAt: null }));
    const fileStatus = status === "completed" || status === "failed" || status === "declined" ? status : "unknown";
    expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "files", running: false, status: fileStatus }));
  });
}

test("실제 stdio subprocess를 재시작한 뒤 같은 Native thread ID와 누적 대화를 다시 연다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "www-conversations-")) ;
  const store     = join(directory, "history.json")                     ;
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
    await expect(running.client.request("turn/start", { threadId: "thread-persisted", input: [{ type: "text", text: "복원 전 거부" }] })).rejects.toThrow("thread/resume");
    const service = createConversationService(running.client, cwd) ;
    const listed  = await service.list()                           ;
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


test("저장 공개 항목의 유효 완료 시각은 보존하고 비공개 필드와 invalid 시각은 제외한다", () => {
  const values = [
    { id: "answer", type: "agentMessage", text: "답변", completedAtMs: 0 },
    { id: "plan", type: "plan", text: "계획", completedAtMs: 10 },
    { id: "summary", type: "reasoning", summary: ["공개 요약"], content: ["PRIVATE"], completedAtMs: 20 },
    { id: "command", type: "commandExecution", status: "completed", completedAtMs: 30 },
    { id: "files", type: "fileChange", status: "completed", changes: [], completedAtMs: 40 }
  ];
  const restored = restoreConversationEvents("thread", [{ id: "turn", status: "inProgress", items: values }], true)                                   ;
  const items    = restored.filter(event => event.method === "item/completed").map(event => (event.params as { item: Record<string, unknown> }).item) ;
  expect(items.map(item => item.completedAtMs)).toEqual([0, 10, 20, 30, 40]);
  expect(JSON.stringify(restored)).not.toContain("PRIVATE");
  for (const value of [undefined, null, "100", 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const result = restoreConversationEvents("thread", [{ id: "turn", status: "inProgress", items: [{ id: "a", type: "agentMessage", text: "기존", completedAtMs: value }] }], true) ;
    const item   = (result.find(event => event.method === "item/completed")?.params as { item: Record<string, unknown> }).item                                                       ;
    expect("completedAtMs" in item).toBe(false);
  }
});

test("저장 Subagent 공개 식별·상태는 복원하고 내부 prompt와 임의 필드는 제외한다", () => {
  const restored = restoreConversationEvents("parent", [{ id: "a", status: "completed", items: [
    { id: "spawn", type: "collabAgentToolCall", senderThreadId: "parent", receiverThreadIds: ["child"], tool: "spawnAgent", status: "completed", agentsStates: { child: { status: "completed", message: "공개 결과", secret: "PRIVATE_STATE" } }, prompt: "PRIVATE_PROMPT", arguments: "PRIVATE_ARGS" },
    { id: "activity", type: "subAgentActivity", agentThreadId: "child", agentPath: "/root/child", kind: "completed", model: "observed-model", reasoningEffort: "high", privateReasoning: "PRIVATE_REASONING" },
    { id: "invalid", type: "subAgentActivity", agentThreadId: "child", agentPath: "/root/child" }
  ] }], true);
  const items = restored.filter(e => e.method === "item/completed").map(e => (e.params as { item: unknown }).item);
  expect(items                            )    .toHaveLength (2                                                                                                                                                                                                                    ) ;
  expect(items[0]                         )    .toEqual      ({ id: "spawn", type: "collabAgentToolCall", senderThreadId: "parent", receiverThreadIds: ["child"], tool: "spawnAgent", status: "completed", agentsStates: { child: { status: "completed", message: "공개 결과" } } }) ;
  expect(items[1]                         )    .toMatchObject({ id: "activity", type: "subAgentActivity", agentThreadId: "child", agentPath: "/root/child", kind: "completed", model: "observed-model", reasoningEffort: "high" }                                                  ) ;
  expect(restored.every(e => e.historical))    .toBe         (true                                                                                                                                                                                                                 ) ;
  expect(JSON.stringify(restored)         ).not.toContain    ("PRIVATE_"                                                                                                                                                                                                           ) ;
});

test("저장 Subagent의 누락·미지원 상태는 성공으로 추정하지 않고 공개 필드의 크기를 제한한다", () => {
  const base = { id: "collab", type: "collabAgentToolCall", senderThreadId: "parent", receiverThreadIds: ["child"], tool: "spawnAgent", status: "completed", agentsStates: { child: { status: "notFound" } } };
  const restored = restoreConversationEvents("parent", [{ id: "a", status: "completed", items: [
    { ...base, id: "missing-status", status: undefined },
    { ...base, id: "invalid-tool", tool: "invented-success" },
    { ...base, id: "invalid-identity", senderThreadId: "x".repeat(513) },
    { ...base, id: "unknown-child", agentsStates: { child: { status: "invented-success", message: "추정 금지" } } },
    { ...base, id: "bounded", receiverThreadIds: Array.from({ length: 140 }, (_, i) => `child-${i}`), agentsStates: { "child-0": { status: "errored", message: "x".repeat(5000) } } }
  ] }], true);
  const items = restored.filter(e => e.method === "item/completed").map(e => (e.params as { item: Record<string, unknown> }).item);
  expect(items                                                                              ).toHaveLength (2                                        ) ;
  expect(items[0]                                                                           ).toMatchObject({ id: "unknown-child", agentsStates: {} }) ;
  expect((items[1]?.receiverThreadIds as string[])                                          ).toHaveLength (128                                      ) ;
  expect((items[1]?.agentsStates as Record<string, { message: string }>)["child-0"]?.message).toHaveLength (4096                                     ) ;
});

for (const output of [undefined, null, "", "새 출력"]) test(`저장 명령 output ${String(output)}의 존재 의미를 보존한다`, () => {
  const value = restoreConversationEvents("t", [{ id: "a", status: "completed", items: [
    { id: "c", type: "commandExecution", aggregatedOutput: "기존 출력", status: "completed" },
    { id: "c", type: "commandExecution", aggregatedOutput: output, status: "completed" }
  ] }], true);
  expect(project(events(value)).blocks).toMatchObject([{ kind: "command", output: typeof output === "string" ? output : "기존 출력" }]);
});
for (const changes of [undefined, null, {}, [{ path: "valid" }, { path: 42 }]]) test(`저장 파일의 잘못된 changes ${JSON.stringify(changes)}는 기존 변경을 지우지 않는다`, () => {
  const value = restoreConversationEvents("t", [{ id: "a", status: "completed", items: [
    { id: "f", type: "fileChange", changes: [{ path: "kept.ts", diff: "kept" }], status: "completed" },
    { id: "f", type: "fileChange", changes, status: "completed" }
  ] }], true);
  expect(project(events(value)).blocks).toMatchObject([{ kind: "files", changes: [{ path: "kept.ts" }] }]);
});

test("작업 폴더 경계는 실제 플랫폼 Node path 절대·정규화 의미를 따른다", async () => {
  const nativeCwd = resolve(tmpdir(), "www-conversation-path");
  const client = clientFor(() => ({ data: [
    { ...thread, cwd: nativeCwd },
    { ...thread, id: "relative", cwd: "www-conversation-path" },
    { ...thread, id: "prefix", cwd: nativeCwd + "-other" }
  ], nextCursor: null }));
  expect((await createConversationService(client, nativeCwd).list()).threads.map(value => value.id)).toEqual([thread.id]);
  // 실제 소유 함수에 win32 의존성만 주입한다. Windows OS 실행 증거는 아니다.
  const source = await readFile(join(import.meta.dir, "../src/conversations.ts"), "utf8") ;
  const fn     = source.match(/function sameWorkspace[\s\S]*?\n}/)?.[0]                   ;
  if (!fn) throw new Error("sameWorkspace 함수를 찾지 못했습니다.");
  const compiled = ts.transpile(fn + "; result = sameWorkspace(value, cwd);", { target: ts.ScriptTarget.ES2022 });
  const cases: [unknown, string, boolean][] = [
    ["C:\\project", "C:\\project", true], ["C:\\project\\sub\\..", "C:\\project", true],
    ["D:\\project", "C:\\project", false], ["C:project", "C:\\project", false],
    ["C:\\project-other", "C:\\project", false],
    ["\\\\server\\share\\project", "\\\\server\\share\\project", true],
    ["\\\\server\\other\\project", "\\\\server\\share\\project", false]
  ];
  for (const [value, cwd, expected] of cases) {
    const context = { isAbsolute: win32.isAbsolute, resolve: win32.resolve, value, cwd, result: false };
    runInNewContext(compiled, context);
    expect(context.result).toBe(expected);
  }
  expect(isAbsolute(nativeCwd)).toBe(true);
});

test("복원의 명시 빈 changes는 이전 목록을 지운다", () => {
  const value = restoreConversationEvents("t", [{ id: "a", status: "completed", items: [
    { id: "f", type: "fileChange", changes: [{ path: "kept.ts" }], status: "completed" },
    { id: "f", type: "fileChange", changes: [], status: "completed" }
  ] }], true);
  expect(project(events(value)).blocks).toMatchObject([{ kind: "files", changes: [] }]);
});

test("저장 reasoning 혼합 배열은 기존 요약을 보존하고 유효 완료 배열만 대체한다", () => {
  const prior = restoreConversationEvents("thread", [{ id: "turn", status: "inProgress", items: [
    { id: "reason", type: "reasoning", summary: ["기존 공개 요약"] }
  ] }], true);
  for (const summary of [["잘못된 새 요약", 42], null, "잘못된 문자열"]) {
    const restored = restoreConversationEvents("thread", [{ id: "turn", status: "completed", items: [
      { id: "reason", type: "reasoning", summary, completedAtMs: 200, content: ["PRIVATE"] }
    ] }], true);
    const item = (restored.find(event => event.method === "item/completed")?.params as { item: Record<string, unknown> }).item;
    expect(item).toEqual({ id: "reason", type: "reasoning", completedAtMs: 200 });
    const view = project(events([...prior, ...restored]));
    expect(view.blocks).toContainEqual(expect.objectContaining({ kind: "explanation", text: "기존 공개 요약", streaming: false }));
    expect(JSON.stringify(restored)).not.toContain("PRIVATE");
  }
  for (const summary of [["정식 새 요약"], []]) {
    const restored = restoreConversationEvents("thread", [{ id: "turn", status: "completed", items: [
      { id: "reason", type: "reasoning", summary }
    ] }], true);
    const view = project(events([...prior, ...restored]));
    expect(view.blocks.filter(block => block.kind === "explanation").map(block => block.text)).toEqual(summary);
  }
});
