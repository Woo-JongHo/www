/**
 * @verifies RESP-NATIVE-LIFECYCLE
 */
import { describe, expect, test } from "bun:test";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { reduceConversationEvents, liveChatInput } from "../src/chat-state";
import { chatStatus } from "../src/chat-status";
import { project } from "../src/projection";
import { projectNativeActivity } from "../src/native-activity";
import { createProjectRegistry } from "../src/projects";
import type { ConversationSelection, ResourceSnapshot, ScopedAppEvent, SelectionRef } from "../src/shared";
import { runNodeFixture } from "./fixtures/conversations-restart-runner";
import { selected, setup, start, until, type Session } from "./fixtures/native-session-setup";

test("이력 절단 뒤 현재 Native 턴에 추가 지시를 보내며 닫힌 연결이나 다른 선택은 사용할 수 없다", async () => {
  const fixture = await setup();
  try {
    const session = fixture.add("streaming", fixture.first);
    const other = fixture.add("other", fixture.first);
    const threadId = await start(session);
    const selection = selected(session);
    const { turnId } = await session.invoke("turn:start", [selection, threadId, "스트리밍 이력 절단 중단 확인"]) as { turnId: string };
    const turnLifecycle = fixture.events.filter(event => ["turn/started", "turn/startAccepted"].includes(event.method));
    expect(turnLifecycle.map(event => event.method)).toEqual(["turn/started", "turn/startAccepted"]);
    expect(fixture.latestSummaries().find(snapshot => snapshot.id === session.id)).toMatchObject({ activeTurnId: turnId, turnStarting: false });
    await until(() => fixture.events.filter(event => event.method === "fixture/stream").length === 2_050);
    const events = await session.invoke("events:get", [selection]) as ScopedAppEvent[];
    expect(events).toHaveLength(2_000);
    expect(events.some(event => ["transport/connected", "turn/started", "turn/startAccepted"].includes(event.method))).toBe(false);
    const history = project(events);
    const connected = session.summary();
    const status = (snapshot: typeof connected, scope = selection, thread: string | null = threadId, generation = connected.connectionGeneration) =>
      chatStatus({ ...liveChatInput(snapshot, scope, thread, generation, history), sending: false, switching: false });
    expect(status(connected).steer).toBe(true);
    expect(status(connected, selected(other)).steer).toBe(false);
    expect(status(connected, selection, "restored-thread").steer).toBe(false);
    expect(status(connected, selection, threadId, connected.connectionGeneration + 1).steer).toBe(false);
    expect(status({ ...connected, approvalCount: 1 }).steer).toBe(false);
    expect(status({ ...connected, interrupting: true }).steer).toBe(false);
    await expect(session.invoke("turn:steer", [selection, threadId, turnId, "같은 턴", "stream-steer"])).resolves.toEqual({ turnId });
    const interrupt = session.invoke("turn:interrupt", [selection, threadId, turnId]);
    const interrupted = fixture.interruptSnapshots.find(snapshot => snapshot.id === session.id);
    expect(interrupted?.interrupting).toBe(true);
    if (!interrupted) throw new Error("중단 요청 전에 세션 상태를 받지 못했습니다.");
    expect(status(interrupted).steer).toBe(false);
    await interrupt;

    fixture.children[0]?.kill();
    await until(() => session.summary().transport === "closed");
    expect(status(session.summary()).steer).toBe(false);
    await expect(session.invoke("turn:steer", [selection, threadId, turnId, "이전 턴", "stale-steer"])).rejects.toThrow("현재 실행 중인 턴");
  } finally { await fixture.close(); }
});

test("모델 적용과 압축의 요청·성공·실패는 한 Native 대화와 탭에만 귀속된다", async () => {
  const fixture = await setup();
  try {
    const a = fixture.add("a", fixture.first);
    const b = fixture.add("b", fixture.second);
    const threadA = await start(a);
    const threadB = await start(b);
    const selectionA = selected(a);
    const selectionB = selected(b);
    await expect(a.invoke("models:list", [selectionA])).resolves.toEqual([
      { model: "fixture", displayName: "기본 모델", isDefault: true },
      { model: "fixture-other", displayName: "다른 모델", isDefault: false },
    ]);
    await expect(a.invoke("thread:compact", [selectionA, threadA])).rejects.toThrow("압축할 이력");
    await Promise.all([
      a.invoke("turn:start", [selectionA, threadA, "첫 탭 요청", "fixture-other"]),
      b.invoke("turn:start", [selectionB, threadB, "둘째 탭 요청"]),
    ]);
    await until(() => !a.summary().busy && !b.summary().busy);
    const rejected = join(fixture.first, "fixture-compact-reject");
    await writeFile(rejected, "reject");
    await expect(a.invoke("thread:compact", [selectionA, threadA])).rejects.toThrow("합성 압축 요청 거절");
    expect(fixture.latestSummaries().find(snapshot => snapshot.id === a.id)?.compaction).toMatchObject({ state: "failed" });
    expect(fixture.latestSummaries().find(snapshot => snapshot.id === b.id)?.compaction.state).toBe("idle");
    await rm(rejected);
    await a.invoke("thread:compact", [selectionA, threadA]);
    expect(["pending", "running"]).toContain(a.summary().compaction.state);
    expect(b.summary().compaction.state).toBe("idle");
    await expect(a.invoke("turn:start", [selectionA, threadA, "압축 중 요청"])).rejects.toThrow("압축이 끝난 뒤");
    await b.invoke("turn:start", [selectionB, threadB, "다른 탭의 압축 중 요청"]);
    await until(() => !b.summary().busy);
    expect(b.summary().compaction.state).toBe("idle");
    await until(() => a.summary().compaction.state === "completed");
    await a.invoke("turn:start", [selectionA, threadA, "압축 뒤 같은 탭 요청"]);
    await until(() => !a.summary().busy);
    expect(a.summary().compaction.state).toBe("idle");
    await writeFile(join(fixture.first, "fixture-compact-fail"), "fail");
    await a.invoke("thread:compact", [selectionA, threadA]);
    await until(() => a.summary().compaction.state === "failed");
    expect(a.summary().compaction).toEqual({ state: "failed", message: "대화 압축을 완료했다는 확인을 받지 못했습니다." });
    const calls = await Promise.all([fixture.first, fixture.second].map(async (path) =>
      (await readFile(join(path, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line))));
    expect(calls[0]?.find(call => call.method === "turn/start")?.params.model).toBe("fixture-other");
    expect(calls[1]?.find(call => call.method === "turn/start")?.params.model).toBeUndefined();
    expect(calls[1]?.some(call => call.method === "thread/compact/start")).toBe(false);
    await a.invoke("thread:compact", [selectionA, threadA]);
    fixture.children[0]?.kill();
    await until(() => a.summary().compaction.state === "failed" && !a.summary().busy);
    expect(a.summary().compaction).toEqual({ state: "failed", message: "연결이 종료되어 압축 결과를 확인할 수 없습니다." });
    expect(a.summary().busy).toBe(false);
  } finally { await fixture.close(); }
});

for (const missing of ["response", "start", "completion"] as const) {
  test(`압축의 ${missing} 근거가 멈추면 같은 대화를 명시적으로 다시 열어 복구한다`, async () => {
    const fixture = await setup({ compactionTimeoutMs: 200 });
    try {
      const session = fixture.add("compacting", fixture.first);
      const other = fixture.add("other", fixture.second);
      const thread = await start(session);
      await start(other);
      const selection = selected(session);
      await session.invoke("turn:start", [selection, thread, "압축할 대화"]);
      await until(() => !session.summary().busy);
      const marker = join(fixture.first, `fixture-compact-no-${missing}`);
      await writeFile(marker, "missing");
      const compact = session.invoke("thread:compact", [selection, thread]);
      if (missing === "response") await expect(compact).rejects.toThrow("같은 대화를 다시 열어 주세요");
      else await compact;
      await until(() => session.summary().compaction.state === "failed" && !session.summary().busy);
      expect(session.summary()).toMatchObject({ busy: false, compaction: { state: "failed", message: "압축 결과를 확인할 수 없습니다. 같은 대화를 다시 열어 주세요." } });
      expect(other.summary()).toMatchObject({ compaction: { state: "idle" } });
      const otherThread = other.summary().threadId!;
      await other.invoke("turn:start", [selected(other), otherThread, "다른 탭의 정상 요청"]);
      await until(() => !other.summary().busy);
      await rm(marker);
      await session.invoke("conversations:open", [selection, thread]);
      await session.invoke("turn:start", [selected(session), thread, "다시 연 대화에 이어서 작성"]);
      await until(() => !session.summary().busy);
      expect(session.summary().compaction.state).toBe("idle");
      const calls = await readFile(join(fixture.first, "fixture-calls.jsonl"), "utf8");
      expect(calls.split("\n").filter(line => line.includes('"method":"thread/compact/start"'))).toHaveLength(1);
    } finally { await fixture.close(); }
  });
}

test("두 실제 Native child는 동시에 실행하며 승인 ID·token·이벤트·중단·원장을 격리한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.second);
    const [threadA, threadB] = await Promise.all([start(a), start(b)]);
    expect(s.events.some(event => event.method === "diagnostics/timing" && (event.params as { phase?: string; status?: string }).phase === "thread/start" && (event.params as { status?: string }).status === "completed")).toBe(true);
    expect(threadA).toBe(threadB); // fixture가 같은 ID를 써도 프로젝트 경계가 다르다.
    const [turnA, turnB] = await Promise.all([
      a.invoke("turn:start", [selected(a), threadA, "A 승인 확인"]),
      b.invoke("turn:start", [selected(b), threadB, "B 승인 확인"])
    ]) as [{ turnId: string }, { turnId: string }];
    expect(typeof turnA.turnId).toBe("string");
    await until(() => a.summary().approvalCount === 1 && b.summary().approvalCount === 1);
    expect(a.summary().busy && b.summary().busy).toBe(true);
    expect(() => a.assertClosable()).toThrow("중단");
    const approvalA = s.events.find(event => event.sessionId === a.id && event.kind === "request")!;
    const approvalB = s.events.find(event => event.sessionId === b.id && event.kind === "request")!;
    expect(approvalA.requestId).toBe(42);
    expect(approvalB.requestId).toBe(42);
    expect(approvalA.approvalToken).not.toBe(approvalB.approvalToken);
    await expect(b.invoke("approval:respond", [selected(b), 42, "accept", approvalA.approvalToken])).rejects.toThrow("다른 대화 탭");
    expect(b.summary().approvalCount).toBe(1);
    await a.invoke("approval:respond", [selected(a), 42, "accept", approvalA.approvalToken]);
    await until(() => !a.summary().busy);
    expect(b.summary().busy).toBe(true);
    await b.invoke("turn:interrupt", [selected(b), threadB, turnB.turnId]);
    await until(() => !b.summary().busy);
    expect(s.events.some(event => event.sessionId === a.id && event.method === "turn/interruptRequested")).toBe(false);
    expect(s.events.some(event => event.sessionId === b.id && event.method === "turn/interruptRequested")).toBe(true);
    expect(s.children).toHaveLength(2);
    expect(s.children[0]!.pid).not.toBe(s.children[1]!.pid);
    for (const session of [a, b]) {
      const own = await session.invoke("events:get", [selected(session)]) as ScopedAppEvent[];
      expect(own.every(event => event.sessionId === session.id)).toBe(true);
      const snapshot = await session.invoke("activity:resources", [selected(session)]) as ResourceSnapshot;
      expect(snapshot.sessionId).toBe(session.id);
      expect(snapshot.scope.workspaceKey).toBe(selected(session).workspaceKey);
    }
    expect((await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).includes('"method":"turn/interrupt"')).toBe(false);
    expect((await readFile(join(s.second, "fixture-calls.jsonl"), "utf8")).includes("A 승인 확인")).toBe(false);
  } finally { await s.close(); }
});

test("같은 프로젝트의 서로 다른 대화도 두 child에서 동시에 실행한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    await b.invoke("conversations:open", [selected(b), "history-b"]);
    const [firstTurn, secondTurn] = await Promise.all([
      a.invoke("turn:start", [selected(a), "history-a", "첫 대화 중단 확인"]),
      b.invoke("turn:start", [selected(b), "history-b", "둘째 대화 중단 확인"])
    ]) as [{ turnId: string }, { turnId: string }];
    expect(a.summary().busy && b.summary().busy).toBe(true);
    await a.invoke("turn:interrupt", [selected(a), "history-a", firstTurn.turnId]);
    await until(() => !a.summary().busy);
    expect(b.summary().busy).toBe(true);
    await b.invoke("turn:interrupt", [selected(b), "history-b", secondTurn.turnId]);
    await until(() => !b.summary().busy);
    expect(s.children).toHaveLength(2);
    expect(s.events.filter(event => event.sessionId === a.id && event.method === "turn/userPrompt").every(event => (event.params as { threadId: string }).threadId === "history-a")).toBe(true);
  } finally { await s.close(); }
});

test("같은 프로젝트 대화의 동시 resume은 시작 전에 예약하고 실패·새 대화 뒤에는 다시 열 수 있다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    const opening = a.invoke("conversations:open", [selected(a), "history-a"]);
    await expect(b.invoke("conversations:open", [selected(b), "history-a"])).rejects.toThrow("다른 탭");
    expect(s.children).toHaveLength(1);
    await opening;
    await expect(a.invoke("conversations:open", [selected(a), "invalid\u0000"])).rejects.toThrow();
    await expect(b.invoke("conversations:open", [selected(b), "history-a"])).rejects.toThrow("다른 탭");
    await a.invoke("conversations:new", [selected(a)]);
    const restored = await b.invoke("conversations:open", [selected(b), "history-a"]) as ConversationSelection;
    expect(restored.threadId).toBe("history-a");
    expect(restored.workspace.sessionId).toBe(b.id);
    expect(a.summary().threadId).toBeNull();
  } finally { await s.close(); }
});

test("다른 탭의 실행은 유휴 탭 프로젝트 전환을 막지 않고 자기 실행·승인은 전환을 막는다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    const thread = await start(a);
    const turn = await a.invoke("turn:start", [selected(a), thread, "중단 확인"]) as { turnId: string };
    s.choose(s.second);
    await expect(a.invoke("workspace:choose", [selected(a)])).rejects.toThrow("실행 또는 승인");
    const result = await b.invoke("workspace:choose", [selected(b)]) as ConversationSelection;
    expect(result.workspace.path).toBe(s.second);
    expect(a.workspaceInfo().path).toBe(s.first);
    expect(a.summary().busy).toBe(true);
    await a.invoke("turn:interrupt", [selected(a), thread, turn.turnId]);
    await until(() => !a.summary().busy);
    const closed = a.stop();
    expect(a.stop()).toBe(closed);
    await expect(a.invoke("thread:start", [selected(a)])).rejects.toThrow("닫고 있습니다");
    await closed;
    expect(s.children.every(child => child.exitCode !== null || child.signalCode !== null)).toBe(true);
  } finally { await s.close(); }
});

test("실패 표시는 실제 전송 실패를 관측한 탭에만 남고 새 대화에서 초기화한다", () => runNodeFixture("native-session-node.ts", ["failure-isolation", join(import.meta.dir, "fixtures")], 4_750), 5_000);

test("세션 summary와 사건·IPC 경계는 git 메타데이터를 다시 조회하지 않는다", async () => {
  const s = await setup();
  try {
    let reads = 0;
    const a = s.add("tab-a", s.first, path => { reads++; return { branch: path === s.first ? "first-branch" : "second-branch", changes: 7 }; });
    expect(a.summary().workspace.branch).toBeNull();
    expect(reads).toBe(0);
    const selection = a.workspaceInfo();
    expect(reads).toBe(1);
    for (let pass = 0; pass < 20; pass++) a.summary();
    await a.invoke("events:get", [selection]);
    const started = await a.invoke("thread:start", [selection]) as { threadId: string };
    const turn = await a.invoke("turn:start", [selection, started.threadId, "중단 확인"]) as { turnId: string };
    await a.invoke("turn:interrupt", [selection, started.threadId, turn.turnId]);
    await until(() => !a.summary().busy);
    expect(reads).toBe(1);
    expect(a.summary().workspace.branch).toBe("first-branch");
    s.choose(s.second);
    const switched = await a.invoke("workspace:choose", [selection]) as ConversationSelection;
    expect(reads).toBe(2);
    expect(switched.workspace.branch).toBe("second-branch");
    expect(a.summary().workspace.path).toBe(s.second);
    expect(a.summary().workspace.branch).toBe("second-branch");
    expect(reads).toBe(2);
  } finally { await s.close(); }
});

function inject(child: ChildProcessWithoutNullStreams, method: string, params: unknown, id?: number): void {
  // 실제 JsonRpcClient framing으로 늦은 합성 Native 사건을 주입한다.
  child.stdout.emit("data", JSON.stringify({ jsonrpc: "2.0", method, params, ...(id === undefined ? {} : { id }) }) + "\n");
}
function command(threadId: string, itemId: string) {
  return { threadId, turnId: "late-turn", item: { id: itemId, type: "commandExecution", exitCode: 0 } };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
}

function injectDuringReconnect(messages: { method: string; params: unknown; id?: number }[], childNumber = 2) {
  return (child: ChildProcessWithoutNullStreams, count: number): void => {
    if (count !== childNumber) return;
    let buffered = "";
    let sent = false;
    child.stdout.on("data", (chunk: Buffer) => {
      buffered += chunk.toString();
      let end = buffered.indexOf("\n");
      while (end >= 0) {
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 1);
        const message: unknown = JSON.parse(line);
        if (!sent && message && typeof message === "object" && "result" in message && JSON.stringify(message.result).includes('"id":"history-a"')) {
          sent = true;
          for (const event of messages) inject(child, event.method, event.params, event.id);
        }
        end = buffered.indexOf("\n");
      }
    });
  };
}

test("자동 재연결 read 응답 전에 받은 live 항목은 marker 뒤 한 번 보존하고 새 prompt를 중복하지 않는다", async () => {
  let injected = false;
  const s = await setup({ onChild(child, count) {
    if (count !== 2) return;
    let buffered = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffered += chunk.toString();
      let end = buffered.indexOf("\n");
      while (end >= 0) {
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 1);
        const message: unknown = JSON.parse(line);
        if (!injected && message && typeof message === "object" && "result" in message
          && JSON.stringify(message.result).includes('"id":"history-a"')) {
          injected = true;
          inject(child, "item/completed", { threadId: "history-a", turnId: "restore-window", item: { id: "restore-live", type: "agentMessage", text: "복원 중 도착한 답변" } });
        }
        end = buffered.indexOf("\n");
      }
    });
  } });
  try {
    const session = s.add("tab-a", s.first);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    s.children[0]!.kill();
    await until(() => s.events.some(event => event.method === "transport/closed"));
    const first = s.events.length;
    await session.invoke("turn:start", [selected(session), "history-a", "재연결 새 prompt"]);
    const own = await session.invoke("events:get", [selected(session)]) as ScopedAppEvent[];
    const marker = own.find(event => event.method === "conversation/reconnected");
    const items = own.filter(event => (event.params as { item?: { id?: string } })?.item?.id === "restore-live");
    expect(injected).toBe(true);
    expect(marker).toBeDefined();
    expect(items).toHaveLength(1);
    expect(items[0]!.seq).toBeGreaterThan(marker!.seq);
    const reduced = reduceConversationEvents({ events: [], reconnect: null }, [], s.events.slice(first), selected(session), "history-a");
    expect(reduced.events.filter(event => (event.params as { item?: { id?: string } })?.item?.id === "restore-live")).toHaveLength(1);
    expect(own.filter(event => event.method === "turn/userPrompt" && (event.params as { text?: string }).text === "재연결 새 prompt")).toHaveLength(1);
  } finally { await s.close(); }
});

for (const state of ["approval", "running"] as const) test(`자동 재연결 중 새 ${state}는 복원 뒤 새 prompt와 turn/start를 막는다`, async () => {
  const live = state === "approval"
    ? { method: "item/commandExecution/requestApproval", params: { threadId: "history-a", turnId: "window", itemId: "pending", command: "live approval" }, id: 91 }
    : { method: "turn/started", params: { threadId: "history-a", turn: { id: "window" } } };
  const s = await setup({ onChild: injectDuringReconnect([live]) });
  try {
    const session = s.add("tab-a", s.first);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    s.children[0]!.kill();
    await until(() => s.events.some(event => event.method === "transport/closed"));
    await expect(session.invoke("turn:start", [selected(session), "history-a", "보내면 안 되는 새 요청"])).rejects.toThrow(state === "approval" ? "승인" : "실행");
    expect(session.summary().busy).toBe(state === "running");
    expect(session.summary().approvalCount).toBe(state === "approval" ? 1 : 0);
    const events = await session.invoke("events:get", [selected(session)]) as ScopedAppEvent[];
    expect(events.some(event => event.method === "turn/userPrompt" && (event.params as { text?: string }).text === "보내면 안 되는 새 요청")).toBe(false);
    const calls = (await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map((line): unknown => JSON.parse(line));
    expect(calls.some(call => call && typeof call === "object" && "method" in call && call.method === "turn/start")).toBe(false);
    if (state === "approval") inject(s.children[1]!, "serverRequest/resolved", { threadId: "history-a", requestId: 91 });
    else inject(s.children[1]!, "turn/completed", { threadId: "history-a", turn: { id: "window", status: "completed" } });
    await until(() => !session.summary().busy && session.summary().approvalCount === 0);
    await session.invoke("turn:start", [selected(session), "history-a", "해소 후 새 요청"]);
    expect((await session.invoke("events:get", [selected(session)]) as ScopedAppEvent[]).filter(event => event.method === "turn/userPrompt" && (event.params as { text?: string }).text === "해소 후 새 요청")).toHaveLength(1);
  } finally { await s.close(); }
});

test("자동 복원 snapshot과 같은 item·delta는 중복하지 않고 새 item·현재 승인·다른 thread를 구별한다", async () => {
  const s = await setup({ onChild: injectDuringReconnect([
    { method: "turn/started", params: { threadId: "history-a", turn: { id: "saved-turn-a" } } },
    { method: "item/reasoning/summaryTextDelta", params: { threadId: "history-a", turnId: "saved-turn-a", itemId: "saved-summary", delta: "공개 요약입니다." } },
    { method: "item/completed", params: { threadId: "history-a", turnId: "saved-turn-a", item: { id: "saved-summary", type: "reasoning", summary: ["공개 요약입니다."], content: ["PRIVATE_REPLAY_MUST_NOT_SURVIVE"] } } },
    { method: "item/completed", params: { threadId: "history-a", turnId: "saved-turn-a", item: { id: "new-item-same-text", type: "agentMessage", text: "공개 요약입니다." } } },
    { method: "item/commandExecution/requestApproval", params: { threadId: "other-thread", command: "other approval" }, id: 92 }
  ]) });
  try {
    const session = s.add("tab-a", s.first);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    s.children[0]!.kill();
    await until(() => s.events.some(event => event.method === "transport/closed"));
    await session.invoke("turn:start", [selected(session), "history-a", "중복 없는 요청"]);
    const events = await session.invoke("events:get", [selected(session)]) as ScopedAppEvent[];
    expect(events.filter(event => (event.params as { item?: { id?: string } })?.item?.id === "saved-summary")).toHaveLength(1);
    expect(events.filter(event => (event.params as { item?: { id?: string } })?.item?.id === "new-item-same-text")).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain("PRIVATE_REPLAY_MUST_NOT_SURVIVE");
    expect(events.some(event => event.method === "item/reasoning/summaryTextDelta" || event.requestId === 92)).toBe(false);
    expect(session.summary().approvalCount).toBe(0);
    inject(s.children[0]!, "item/commandExecution/requestApproval", { threadId: "history-a", command: "old process" }, 93);
    expect(session.summary().approvalCount).toBe(0);
  } finally { await s.close(); }
});

for (const limit of ["count", "bytes"] as const) test(`자동 복원 ${limit} 큐 초과는 명시 open 전 두 번째 전송도 차단한다`, async () => {
  const messages = limit === "count" ? Array.from({ length: 2001 }, (_, index) => ({ method: "item/completed", params: command("history-a", "over-" + index) }))
    : Array.from({ length: 2 }, () => ({ method: "item/commandExecution/outputDelta", params: { threadId: "history-a", turnId: "a", itemId: "large", delta: "x".repeat(2 * 1024 * 1024) } }));
  const s = await setup({ onChild: injectDuringReconnect(messages) });
  try {
    const session = s.add("tab-a", s.first);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    s.children[0]!.kill();
    await until(() => s.events.some(event => event.method === "transport/closed"));
    await expect(session.invoke("turn:start", [selected(session), "history-a", "overflow prompt"])).rejects.toThrow("보관 한도");
    expect(session.summary().busy).toBe(false);
    const events = await session.invoke("events:get", [selected(session)]) as ScopedAppEvent[];
    expect(events.some(event => event.method === "conversation/reconnected" || event.method === "turn/userPrompt" && (event.params as { text?: string }).text === "overflow prompt")).toBe(false);
    await expect(session.invoke("turn:start", [selected(session), "history-a", "두 번째 차단"])).rejects.toThrow("명시적으로");
    expect(session.summary().busy).toBe(false);
    const calls: unknown[] = (await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
    expect(calls.filter(call => call && typeof call === "object" && "method" in call && call.method === "turn/start")).toHaveLength(0);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    const sent = await session.invoke("turn:start", [selected(session), "history-a", "명시 수용 후 요청"]) as { turnId: string };
    expect(sent.turnId).toBeString();
  } finally { await s.close(); }
});

test("thread 해제는 접수한 원장 수집을 drain한 뒤 확정하며 늦은 이전 thread 사건은 새 소유자를 침범하지 않는다", async () => {
  const gate = deferred();
  let hold = false;
  let entered = false;
  const s = await setup({ beforeUpsert: async () => { if (hold) { entered = true; await gate.promise; } } });
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    hold = true;
    inject(s.children[0]!, "item/completed", command("history-a", "admitted-before-leave"));
    await until(() => entered);
    const leaving = a.invoke("conversations:new", [selected(a)]);
    expect(a.summary().busy).toBe(true);
    await expect(a.invoke("activity:resources", [selected(a)])).rejects.toThrow("전환");
    await expect(b.invoke("conversations:open", [selected(b), "history-a"])).rejects.toThrow("다른 탭");
    hold = false;
    gate.resolve();
    await leaving;
    const restored = await b.invoke("conversations:open", [selected(b), "history-a"]) as ConversationSelection;
    expect(restored.resources?.observations.some(row => row.source.kind === "item" && row.source.itemId === "admitted-before-leave")).toBe(true);
    inject(s.children[0]!, "item/completed", command("history-a", "old-owner-must-drop"));
    inject(s.children[0]!, "item/commandExecution/requestApproval", { threadId: "history-a", command: "old approval" }, 77);
    inject(s.children[0]!, "turn/completed", { threadId: "history-a", turn: { id: "old-finished", status: "completed" } });
    inject(s.children[1]!, "item/completed", command("history-a", "new-owner-keeps-epoch"));
    const current = await b.invoke("activity:resources", [selected(b)]) as ResourceSnapshot;
    expect(current.selectionEpoch).toBe(b.summary().workspace.selectionEpoch);
    expect(current.observations.some(row => row.source.kind === "item" && row.source.itemId === "new-owner-keeps-epoch")).toBe(true);
    expect(current.observations.some(row => row.source.kind === "item" && row.source.itemId === "old-owner-must-drop")).toBe(false);
    expect((await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[]).some(event => (event.params as { threadId?: string })?.threadId === "history-a")).toBe(false);
    expect(a.summary().approvalCount).toBe(0);
  } finally { hold = false; gate.resolve(); await s.close(); }
});

test("다른 thread open은 후보 사건만 새 선택에서 replay하고 실패하면 이전 thread gate와 소유를 복원한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    const opening = a.invoke("conversations:open", [selected(a), "history-b"]);
    inject(s.children[0]!, "item/completed", command("history-b", "pending-candidate"));
    inject(s.children[0]!, "item/completed", command("history-a", "retiring-thread"));
    inject(s.children[0]!, "item/commandExecution/requestApproval", { threadId: "history-b", command: "candidate approval" }, 78);
    const restored = await opening as ConversationSelection;
    expect(restored.events.some(event => (event.params as { item?: { id?: string } })?.item?.id === "pending-candidate")).toBe(true);
    expect(restored.events.some(event => (event.params as { item?: { id?: string } })?.item?.id === "retiring-thread")).toBe(false);
    expect(restored.events.some(event => event.requestId === 78 && event.supported)).toBe(true);
    expect(a.summary().approvalCount).toBe(1);
    inject(s.children[0]!, "serverRequest/resolved", { threadId: "history-b", requestId: 78 });
    const released = await b.invoke("conversations:open", [selected(b), "history-a"]) as ConversationSelection;
    expect(released.threadId).toBe("history-a");
    const failed = a.invoke("conversations:open", [selected(a), "invalid\u0000"]);
    await expect(failed).rejects.toThrow("대화 ID");
    inject(s.children[0]!, "item/completed", command("history-b", "after-rollback"));
    const resources = await a.invoke("activity:resources", [selected(a)]) as ResourceSnapshot;
    expect(resources.observations.some(row => row.source.kind === "item" && row.source.itemId === "after-rollback")).toBe(true);
    await expect(b.invoke("conversations:open", [selected(b), "history-b"])).rejects.toThrow("다른 탭");
  } finally { await s.close(); }
});

for (const limit of ["count", "bytes"] as const) test(`후보 버퍼 ${limit} 한도 초과는 전환을 실패시키고 이전 소유를 유지한다`, async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    const opening = a.invoke("conversations:open", [selected(a), "history-b"]);
    if (limit === "count") for (let index = 0; index < 2001; index++) inject(s.children[0]!, "item/completed", command("history-b", "overflow-" + index));
    else for (let index = 0; index < 2; index++) inject(s.children[0]!, "item/agentMessage/delta", { threadId: "history-b", delta: "x".repeat(2 * 1024 * 1024) });
    await expect(opening).rejects.toThrow("보관 한도");
    expect(a.summary().threadId).toBe("history-a");
    expect(a.summary().busy).toBe(false);
    await expect(b.invoke("conversations:open", [selected(b), "history-a"])).rejects.toThrow("다른 탭");
    const own = await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[];
    expect(own.some(event => (event.params as { threadId?: string })?.threadId === "history-b")).toBe(false);
  } finally { await s.close(); }
});

test("main은 단일 탭 구형 선택만 보완하고 다중 누락·닫는 source 복제를 거부하며 등록 오류를 승계한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first, undefined, "등록 저장 실패");
    const main = await readFile(join(import.meta.dir, "../src/main.ts"), "utf8");
    const helper = main.slice(main.indexOf("function selectedSession("), main.indexOf("function registerIpc("));
    const create = main.slice(main.indexOf('  ipcMain.handle("sessions:create"'), main.indexOf('  ipcMain.handle("sessions:close"'));
    const closing = new Set<string>();
    let createTab!: (_event: unknown, value?: unknown) => unknown;
    const legacy = { ...selected(a), sessionId: undefined };
    const seam = runInNewContext(new Bun.Transpiler({ loader: "ts" }).transformSync(helper + create + "\nglobalThis.nativeSeam = { select: selectedSession };"), {
      sessions: s.sessions, closing, stopping: false,
      record: (value: unknown) => value,
      sessionId: (value: unknown) => value,
      addSession(workspace: string, error: string) { return s.add("tab-created", workspace, undefined, error); },
      ipcMain: { handle(_channel: string, handler: typeof createTab) { createTab = handler; } }
    }) as { select(value: unknown): { session: Session; selection: SelectionRef } };
    expect(seam.select(legacy).selection.sessionId).toBe(a.id);
    await expect(a.invoke("events:get", [legacy])).rejects.toThrow("프로젝트 선택");
    createTab(null, selected(a));
    const cloned = s.sessions.get("tab-created");
    expect(cloned.cloneContext().registrationError).toBe("등록 저장 실패");
    expect(() => seam.select(legacy)).toThrow("세션 ID");
    closing.add(a.id);
    expect(() => createTab(null, selected(a))).toThrow("닫고 있습니다");
    closing.delete(a.id);
    await a.stop();
    expect(() => createTab(null)).toThrow("닫고 있습니다");
  } finally { await s.close(); }
});

test("main의 동시 닫기는 마지막 탭을 보존하고 닫기 예약 직후 신규 요청을 거부한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.second);
    const main = await readFile(join(import.meta.dir, "../src/main.ts"), "utf8");
    const from = main.indexOf('  ipcMain.handle("sessions:close"');
    const to = main.indexOf('  ipcMain.handle("probe:ready"', from);
    expect(from).toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    let closeTab!: (_event: unknown, id: string) => Promise<void>;
    runInNewContext(new Bun.Transpiler({ loader: "ts" }).transformSync(main.slice(from, to)), {
      sessions: s.sessions, closing: new Set(), publishSessions() {}, sessionId: (id: string) => id,
      ipcMain: { handle(_channel: string, handler: typeof closeTab) { closeTab = handler; } }
    });
    const pending = closeTab(null, a.id);
    await expect(closeTab(null, b.id)).rejects.toThrow("마지막");
    await expect(a.invoke("thread:start", [selected(a)])).rejects.toThrow("닫고 있습니다");
    await pending;
    expect(s.sessions.list().map(session => session.id)).toEqual([b.id]);
  } finally { await s.close(); }
});


describe("프로젝트 폴더 추가의 실제 runtime·registry 경계", () => {
  test("선택한 미등록 폴더를 저장하고 새 선택을 반환한다", async () => {
    let renames = 0;
    const s = await setup({ projectIO: { beforeRename: async () => { renames++; } } });
    try {
      const session = s.add("tab-project", s.first);
      const before = session.workspaceInfo();
      const folder = join(s.root, "새 RPA 프로젝트");
      await mkdir(folder);
      const previousWrites = renames;
      s.choose(folder);
      const result = await session.invoke("workspace:choose", [before]) as ConversationSelection;
      expect(result.workspace.path).toBe(folder);
      expect(result.workspace.name).toBe("새 RPA 프로젝트");
      expect(result.workspace.sessionId).toBe(session.id);
      expect(result.workspace.selectionEpoch).toBe(before.selectionEpoch + 1);
      expect(result.workspace.workspaceKey).not.toBe(before.workspaceKey);
      expect(result.threadId).toBeNull();
      expect(result.events).toEqual([]);
      expect(renames).toBe(previousWrites + 1);
      expect(session.summary().workspace).toEqual(result.workspace);
      expect(session.summary().busy).toBe(false);
      const restored = await createProjectRegistry({ userData: join(s.root, "profile") }).list();
      expect(restored[0]?.path).toBe(folder);
      expect(restored.map(project => project.path).sort()).toEqual([s.first, s.second, folder].sort());
      expect(restored[0]?.workspaceKey).toBe(result.workspace.workspaceKey);
    } finally { await s.close(); }
  });

  test("폴더 선택 취소 null은 기존 대화·선택·등록 원장을 보존한다", async () => {
    let renames = 0;
    const s = await setup({ projectIO: { beforeRename: async () => { renames++; } } });
    try {
      const session = s.add("tab-project", s.first);
      const thread = await start(session);
      const before = session.workspaceInfo();
      await session.invoke("activity:resources", [before]);
      const previousWrites = renames;
      const bytes = await readFile(join(s.root, "profile", "projects-v1.json"));
      s.choose(null);
      expect(await session.invoke("workspace:choose", [before])).toBeNull();
      expect(session.workspaceInfo()).toEqual(before);
      expect(session.summary().threadId).toBe(thread);
      expect(session.summary().busy).toBe(false);
      expect(renames).toBe(previousWrites);
      expect(await readFile(join(s.root, "profile", "projects-v1.json"))).toEqual(bytes);
      expect(s.children[0]?.exitCode).toBeNull();
      expect(s.children[0]?.signalCode).toBeNull();
      const restored = await createProjectRegistry({ userData: join(s.root, "profile") }).list();
      expect(restored.map(project => project.path).sort()).toEqual([s.first, s.second].sort());
    } finally { await s.close(); }
  });

  test("실제 등록 저장 실패는 원인과 함께 거부하고 이전 선택을 보존한 뒤 재시도를 허용한다", async () => {
    let fail = false;
    let renames = 0;
    const s = await setup({ projectIO: { beforeRename: async () => {
      renames++;
      if (fail) throw new Error("합성 프로젝트 원장 rename 실패");
    } } });
    try {
      const session = s.add("tab-project", s.first);
      const thread = await start(session);
      const before = session.workspaceInfo();
      await session.invoke("activity:resources", [before]);
      const folder = join(s.root, "저장 실패 후 재시도");
      await mkdir(folder);
      const bytes = await readFile(join(s.root, "profile", "projects-v1.json"));
      const previousWrites = renames;
      s.choose(folder);
      fail = true;
      let failure: unknown;
      try { await session.invoke("workspace:choose", [before]); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(Error);
      if (!(failure instanceof Error)) throw new Error("등록 실패 오류가 반환되지 않았습니다.");
      expect(failure.message).toBe("프로젝트 등록·저장에 실패했습니다. 기존 선택을 유지합니다.");
      const cause = failure.cause;
      expect(cause).toBeInstanceOf(Error);
      if (!(cause instanceof Error)) throw new Error("등록 실패의 원인이 보존되지 않았습니다.");
      expect(cause.message).toBe("합성 프로젝트 원장 rename 실패");
      expect(renames).toBe(previousWrites + 1);
      expect(session.workspaceInfo()).toEqual(before);
      expect(session.summary().threadId).toBe(thread);
      expect(session.summary().busy).toBe(false);
      expect(await readFile(join(s.root, "profile", "projects-v1.json"))).toEqual(bytes);
      expect(s.children[0]?.exitCode).toBeNull();
      const restored = await createProjectRegistry({ userData: join(s.root, "profile") }).list();
      expect(restored.map(project => project.path).sort()).toEqual([s.first, s.second].sort());
      fail = false;
      const retry = await session.invoke("workspace:choose", [before]) as ConversationSelection;
      expect(retry.workspace.path).toBe(folder);
      expect(retry.workspace.selectionEpoch).toBe(before.selectionEpoch + 1);
      expect(retry.threadId).toBeNull();
      expect(renames).toBe(previousWrites + 2);
    } finally { fail = false; await s.close(); }
  });
});

test("Steer는 같은 턴에 원문과 ID를 한 번만 보내고 불일치·종료 경합을 구분한다", () => runNodeFixture("native-session-node.ts", ["steer", join(import.meta.dir, "fixtures")], 4_750), 5_000);

test("Steer 대기·승인·중단·연결 종료와 다른 세션은 자동 재전송 없이 차단한다", async () => {
  const s = await setup();
  try {
    const a = s.add("steer-a", s.first);
    const b = s.add("steer-b", s.second);
    const [thread, other] = await Promise.all([start(a), start(b)]);
    const turn = await a.invoke("turn:start", [selected(a), thread, "Steer 중단 확인"]) as { turnId: string };
    const selection = selected(a);
    await expect(a.invoke("turn:steer", [selected(b), thread, turn.turnId, "다른 탭", "bad-tab"])).rejects.toThrow();
    await expect(a.invoke("turn:steer", [{ ...selection, selectionEpoch: selection.selectionEpoch + 1 }, thread, turn.turnId, "이전 선택", "bad-selection"])).rejects.toThrow();
    const waiting = a.invoke("turn:steer", [selection, thread, turn.turnId, "대기 추가 지시", "pending-id"]);
    await until(() => s.events.some(event => event.method === "turn/steerPending"));
    await expect(a.invoke("turn:steer", [selection, thread, turn.turnId, "중복", "pending-id"])).rejects.toThrow();
    await expect(a.invoke("turn:steer", [selection, thread, turn.turnId, "연속", "next-id"])).rejects.toThrow();
    await writeFile(join(s.first, "fixture-steer-release"), "");
    await expect(waiting).resolves.toEqual({ turnId: turn.turnId });
    await expect(a.invoke("turn:steer", [selection, thread, turn.turnId, "연결 종료 추가 지시", "closed-id"])).rejects.toThrow();
    expect(s.events.some(event => event.method === "turn/steerUncertain" && (event.params as { clientUserMessageId?: string }).clientUserMessageId === "closed-id")).toBe(true);
    const bTurn = await b.invoke("turn:start", [selected(b), other, "승인 확인"]) as { turnId: string };
    await until(() => b.summary().approvalCount === 1);
    await expect(b.invoke("turn:steer", [selected(b), other, bTurn.turnId, "승인 중", "approval-id"])).rejects.toThrow();
    await b.invoke("turn:interrupt", [selected(b), other, bTurn.turnId]);
    const calls = (await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
    expect(calls.filter(call => call.method === "turn/steer")).toHaveLength(2);
  } finally { await s.close(); }
});

test("승인 해소 후에도 중단된 턴의 종료 확인 전에는 Steer를 보내지 않는다", async () => {
  const s = await setup();
  try {
    const session = s.add("interrupt", s.first);
    const thread = await start(session);
    const turn = await session.invoke("turn:start", [selected(session), thread, "경계 승인 해소 대기"]) as { turnId: string };
    await until(() => session.summary().approvalCount === 1);
    await session.invoke("turn:interrupt", [selected(session), thread, turn.turnId]);
    await until(() => session.summary().approvalCount === 0);
    await expect(session.invoke("turn:steer", [selected(session), thread, turn.turnId, "중단 경합", "interrupt-id"])).rejects.toThrow("중단");
    await writeFile(join(s.first, "fixture-resolved-release"), "");
    await until(() => !session.summary().busy);
    const calls = await readFile(join(s.first, "fixture-calls.jsonl"), "utf8");
    expect(calls).not.toContain('"method":"turn/steer"');
  } finally { await s.close(); }
});

const STAGE_WORK_ID = "work-36d312bc-a767-4e3e-a581-01898b35f75f";
async function writeStageWork(root: string, folder = "one", id = STAGE_WORK_ID): Promise<void> {
  const path = join(root, "docs/work/Chat", folder);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "work.json"), JSON.stringify({ schemaVersion: 2, id, title: "단계 관측", status: "in_progress", blockedReason: null, areas: ["ui"], owner: "ui", criteria: [{ id: "STAGE", description: "관측", required: true, result: "unverified" }] }));
}

test("실제 stdio 단계 도구의 역할 선언만 수용하며 문서·UUID·턴·중복·종료 경계를 지킨다", async () => {
  const s = await setup({ stageProbe: true });
  try {
    await writeStageWork(s.first);
    const a = s.add("stage-a", s.first);
    const id = await start(a);
    await a.invoke("turn:start", [selected(a), id, "단계 관측 정상"]);
    await until(() => s.events.filter(event => event.method === "fixture/stageResponse").length === 10);
    await until(() => !a.summary().busy);
    const declarations = s.events.filter(event => event.method === "www/developmentStage");
    expect(declarations.map(event => (event.params as { status: string }).status)).toEqual(["selected", "running", "completed"]);
    expect(declarations.every(event => event.sessionId === a.id && (event.params as { source: string; workId: string }).source === "role_declaration" && (event.params as { workId: string }).workId === STAGE_WORK_ID)).toBe(true);
    expect(s.events.filter(event => event.method === "fixture/stageResponse").map(event => (event.params as { success: boolean }).success)).toEqual([true, true, true, true, false, false, false, false, false, false]);
    expect(s.events.some(event => event.kind === "request" && event.method === "item/tool/call")).toBe(false);
    expect(JSON.stringify(declarations)).not.toContain("PRIVATE_REASONING");
    expect((s.events.find(event => event.method === "thread/configured")?.params as { developmentStage: string }).developmentStage).toBe("available");
  } finally { await s.close(); }
});

test("다른 프로젝트·중복 UUID·복원 대화는 단계 생산자로 연결하지 않는다", async () => {
  const s = await setup({ stageProbe: true });
  try {
    await Promise.all([writeStageWork(s.first), writeStageWork(s.first, "duplicate"), writeStageWork(s.second)]);
    const a = s.add("duplicate", s.first);
    const b = s.add("other", s.second);
    const [ta, tb] = await Promise.all([start(a), start(b)]);
    await Promise.all([a.invoke("turn:start", [selected(a), ta, "단계 관측 정상"]), b.invoke("turn:start", [selected(b), tb, "단계 관측 정상"])]);
    await until(() => s.events.filter(event => event.method === "fixture/stageResponse").length === 20);
    await until(() => !a.summary().busy && !b.summary().busy);
    expect(s.events.filter(event => event.method === "www/developmentStage")).toHaveLength(0);
    expect((s.events.find(event => event.sessionId === b.id && event.method === "thread/configured")?.params as { developmentStage: string }).developmentStage).toBe("other_workspace");
    await rm(join(s.first, "docs/work/Chat/duplicate"), { recursive: true });
    await a.invoke("conversations:open", [selected(a), ta]);
    const reopened = await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[];
    expect((reopened.find(event => event.method === "thread/configured")?.params as { developmentStage: string }).developmentStage).toBe("resume_unavailable");
    await a.invoke("turn:start", [selected(a), ta, "단계 관측 정상"]);
    await until(() => s.events.filter(event => event.method === "fixture/stageResponse").length === 30);
    expect(s.events.filter(event => event.method === "www/developmentStage")).toHaveLength(0);
  } finally { await s.close(); }
});

test("턴 종료 뒤 늦은 단계 요청은 실제 stdio에서도 현재 역할 선언으로 채택하지 않는다", async () => {
  const s = await setup({ stageProbe: true });
  try {
    await writeStageWork(s.first);
    const a = s.add("late-stage", s.first);
    const threadId = await start(a);
    await a.invoke("turn:start", [selected(a), threadId, "단계 관측 종료지연"]);
    await until(() => s.events.some(event => event.method === "fixture/stageResponse"));
    expect(s.events.some(event => event.method === "www/developmentStage")).toBe(false);
    expect((s.events.find(event => event.method === "fixture/stageResponse")?.params as { success: boolean }).success).toBe(false);
    expect(a.summary().busy).toBe(false);
  } finally { await s.close(); }
});


test("명시적 열기는 snapshot terminal의 늦은 시작을 되살리지 않고 후속 선택과 전송을 허용한다", async () => {
  const s = await setup({ onChild: injectDuringReconnect([
    { method: "turn/started", params: { threadId: "history-a", turn: { id: "saved-turn-a" } } },
    { method: "item/completed", params: { threadId: "history-a", turnId: "saved-turn-a", item: { id: "saved-summary", type: "reasoning", summary: ["공개 요약입니다."] } } }
  ], 1) });
  try {
    const session = s.add("tab-a", s.first);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    expect(session.summary().busy).toBe(false);
    const events = await session.invoke("events:get", [selected(session)]) as ScopedAppEvent[];
    expect(events.filter(event => (event.params as { item?: { id?: string } })?.item?.id === "saved-summary")).toHaveLength(1);
    expect(events.some(event => !event.historical && event.method === "turn/started")).toBe(false);
    await session.invoke("conversations:new", [selected(session)]);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    const result = await session.invoke("turn:start", [selected(session), "history-a", "명시적 복원 뒤 새 요청"]) as { turnId: string };
    expect(typeof result.turnId).toBe("string");
  } finally { await s.close(); }
});


for (const state of ["approval", "running", "changed"] as const) test(`명시적 열기 필터는 현재 ${state}와 새 항목을 보존하고 다른 thread를 거부한다`, async () => {
  const live = state === "approval"
    ? { method: "item/commandExecution/requestApproval", params: { threadId: "history-a", turnId: "fresh-turn", command: "현재 승인" }, id: 91 }
    : state === "running"
      ? { method: "turn/started", params: { threadId: "history-a", turn: { id: "fresh-turn" } } }
      : { method: "item/completed", params: { threadId: "history-a", turnId: "saved-turn-a", item: { id: "saved-summary", type: "reasoning", summary: ["변경된 정식 완료"] } } };
  const s = await setup({ onChild: injectDuringReconnect([live,
    { method: "item/completed", params: { threadId: "history-a", turnId: "saved-turn-a", item: { id: "fresh-item", type: "agentMessage", text: "새 완료" } } },
    { method: "item/commandExecution/requestApproval", params: { threadId: "other-thread", command: "다른 thread 승인" }, id: 92 }
  ], 1) });
  try {
    const session = s.add("tab-a", s.first);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    const events = await session.invoke("events:get", [selected(session)]) as ScopedAppEvent[];
    expect(events.filter(event => (event.params as { item?: { id?: string } })?.item?.id === "fresh-item")).toHaveLength(1);
    expect(events.some(event => event.requestId === 92)).toBe(false);
    expect(session.summary().approvalCount).toBe(state === "approval" ? 1 : 0);
    expect(session.summary().busy).toBe(state === "running");
    if (state === "changed") {
      const summaries = events.filter(event => (event.params as { item?: { id?: string } })?.item?.id === "saved-summary");
      expect(summaries).toHaveLength(2);
      expect(summaries.at(-1)?.params).toMatchObject({ item: { summary: ["변경된 정식 완료"] } });
    } else {
      await expect(session.invoke("turn:start", [selected(session), "history-a", "차단할 요청"])).rejects.toThrow();
      await expect(session.invoke("conversations:new", [selected(session)])).rejects.toThrow();
      if (state === "approval") {
        expect(events.find(event => event.requestId === 91)?.approvalToken).toBeString();
        inject(s.children[0]!, "serverRequest/resolved", { threadId: "history-a", requestId: 91 });
      } else inject(s.children[0]!, "turn/completed", { threadId: "history-a", turn: { id: "fresh-turn", status: "completed" } });
      await until(() => !session.summary().busy && session.summary().approvalCount === 0);
      await session.invoke("conversations:new", [selected(session)]);
    }
  } finally { await s.close(); }
});


test("같은 대화 복원의 큐 초과는 interrupted 준비를 확정하지 않고 명시 재열기 전 전송을 막는다", async () => {
  const messages = Array.from({ length: 2001 }, (_, index) => ({ method: "item/completed", params: command("history-a", "same-over-" + index) }));
  const s = await setup({ onChild: injectDuringReconnect(messages) });
  try {
    const session = s.add("tab-a", s.first);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    inject(s.children[0]!, "turn/started", { threadId: "history-a", turn: { id: "active-before-disconnect" } });
    await until(() => session.summary().busy);
    s.children[0]!.kill();
    await until(() => s.events.some(event => event.method === "transport/closed"));
    await expect(session.invoke("conversations:open", [selected(session), "history-a"])).rejects.toThrow("보관 한도");
    await expect(session.invoke("turn:start", [selected(session), "history-a", "실패 뒤 보내면 안 되는 요청"])).rejects.toThrow("다시 열어");
    const calls = (await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map((line): unknown => JSON.parse(line));
    expect(calls.some(call => call && typeof call === "object" && "method" in call && call.method === "turn/start")).toBe(false);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    const result = await session.invoke("turn:start", [selected(session), "history-a", "수용된 복원 뒤 요청"]) as { turnId: string };
    expect(typeof result.turnId).toBe("string");
    const accepted = (await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map((line): unknown => JSON.parse(line));
    expect(accepted.filter(call => call && typeof call === "object" && "method" in call && call.method === "thread/read")).toHaveLength(3);
  } finally { await s.close(); }
});


test("idle인 동일 client의 기존 ready도 명시 복원 큐 초과 뒤에는 재사용하지 않는다", async () => {
  const s = await setup();
  try {
    const session = s.add("tab-a", s.first);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    const messages = Array.from({ length: 2001 }, (_, index) => ({ method: "item/completed", params: command("history-a", "idle-over-" + index) }));
    injectDuringReconnect(messages, 1)(s.children[0]!, 1);
    await expect(session.invoke("conversations:open", [selected(session), "history-a"])).rejects.toThrow("보관 한도");
    await expect(session.invoke("turn:start", [selected(session), "history-a", "실패 복원 뒤 요청"])).rejects.toThrow("다시 열어");
    expect(session.summary().busy).toBe(false);
    await session.invoke("conversations:open", [selected(session), "history-a"]);
    const result = await session.invoke("turn:start", [selected(session), "history-a", "새로 수용된 요청"]) as { turnId: string };
    expect(typeof result.turnId).toBe("string");
  } finally { await s.close(); }
});


for (const outcome of ["read-failure", "resume-failure", "success"] as const) {
  for (const activity of ["running", "approval"] as const) test(`A→B ${outcome} 중 A ${activity}는 이전 선택에 보존하고 B commit과 새 전송을 막는다`, async () => {
    let responses = 0;
    let injected = false;
    const s = await setup({ onChild(child) {
      let buffered = "";
      child.stdout.on("data", (chunk: Buffer) => {
        buffered += chunk.toString();
        let end = buffered.indexOf("\n");
        while (end >= 0) {
          const line = buffered.slice(0, end);
          buffered = buffered.slice(end + 1);
          const reply: unknown = JSON.parse(line);
          if (reply && typeof reply === "object" && "result" in reply && "id" in reply && JSON.stringify(reply.result).includes('"id":"history-b"')) {
            responses++;
            if (!injected && responses === (outcome === "resume-failure" ? 2 : 1)) {
              injected = true;
              inject(child, "item/commandExecution/requestApproval", { threadId: "history-b", turnId: "candidate-turn", command: "취소할 B 승인" }, 194);
              if (activity === "running") inject(child, "turn/started", { threadId: "history-a", turn: { id: "arrived-on-a" } });
              else inject(child, "item/commandExecution/requestApproval", { threadId: "history-a", turnId: "arrived-on-a", command: "A 승인 보존" }, 191);
              if (outcome !== "success") child.stdout.emit("data", JSON.stringify({ jsonrpc: "2.0", id: reply.id, error: { code: -32603, message: "합성 B 복원 실패" } }) + "\n");
            }
          }
          end = buffered.indexOf("\n");
        }
      });
    } });
    try {
      const a = s.add("tab-a", s.first);
      const b = s.add("tab-b", s.first);
      await a.invoke("conversations:open", [selected(a), "history-a"]);
      const expected = selected(a);
      await expect(a.invoke("conversations:open", [expected, "history-b"])).rejects.toThrow();
      expect(injected).toBe(true);
      expect(a.summary()).toMatchObject({ threadId: "history-a", busy: activity === "running", approvalCount: activity === "approval" ? 1 : 0 });
      expect(selected(a)).toEqual(expected);
      const events = await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[];
      const current = events.filter(event => !event.historical && event.method === (activity === "running" ? "turn/started" : "item/commandExecution/requestApproval") && (event.params as { threadId?: string }).threadId === "history-a");
      expect(current).toHaveLength(1);
      expect(events.some(event => event.requestId === 194)).toBe(false);
      if (activity === "approval") expect(current[0]?.approvalToken).toBeString();
      await expect(a.invoke("turn:start", [selected(a), "history-a", "중복 전송 금지"])).rejects.toThrow();
      await expect(b.invoke("conversations:open", [selected(b), "history-a"])).rejects.toThrow("다른 탭");
      expect((await b.invoke("conversations:open", [selected(b), "history-b"]) as ConversationSelection).threadId).toBe("history-b");
      const calls: unknown[] = (await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
      expect(calls.some(call => call && typeof call === "object" && "method" in call && call.method === "turn/start")).toBe(false);
      if (activity === "approval") await a.invoke("approval:respond", [selected(a), 191, "decline", current[0]?.approvalToken]);
      else inject(s.children[0]!, "turn/completed", { threadId: "history-a", turn: { id: "arrived-on-a", status: "completed" } });
      expect(a.summary()).toMatchObject({ busy: false, approvalCount: 0 });
      await b.invoke("conversations:new", [selected(b)]);
      expect((await a.invoke("conversations:open", [selected(a), "history-b"]) as ConversationSelection).threadId).toBe("history-b");
    } finally { await s.close(); }
  });
}

for (const limit of ["count", "bytes"] as const) test(`A/B 합산 ${limit} 초과는 A 재열기 전 새 전송을 차단한다`, async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    const opening = a.invoke("conversations:open", [selected(a), "history-b"]);
    inject(s.children[0]!, "item/commandExecution/requestApproval", { threadId: "history-a", command: "한도 초과 전 승인" }, 195);
    if (limit === "count") for (let index = 0; index < 1001; index++) {
      inject(s.children[0]!, "item/completed", command("history-a", "a-" + index));
      inject(s.children[0]!, "item/completed", command("history-b", "b-" + index));
    } else {
      inject(s.children[0]!, "item/agentMessage/delta", { threadId: "history-a", turnId: "window", itemId: "a", delta: "x".repeat(2 * 1024 * 1024) });
      inject(s.children[0]!, "item/agentMessage/delta", { threadId: "history-b", turnId: "window", itemId: "b", delta: "x".repeat(2 * 1024 * 1024) });
    }
    await expect(opening).rejects.toThrow("보관 한도");
    expect(a.summary().threadId).toBe("history-a");
    await expect(a.invoke("turn:start", [selected(a), "history-a", "유실 가능성 뒤 전송 금지"])).rejects.toThrow("다시 열어");
    const events = await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[];
    expect(events.some(event => (event.params as { threadId?: string })?.threadId === "history-b")).toBe(false);
    expect(events.filter(event => event.requestId === 195 && event.kind === "request")).toHaveLength(1);
    expect(events.filter(event => event.requestId === 195 && event.method === "approval/uncertain")).toHaveLength(1);
    expect(events.some(event => event.method === "transport/closed")).toBe(false);
    expect(a.summary().approvalCount).toBe(0);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    expect(typeof (await a.invoke("turn:start", [selected(a), "history-a", "성공 재열기 뒤 요청"]) as { turnId: string }).turnId).toBe("string");
  } finally { await s.close(); }
}, 30_000);


test("B 복원 중 종료된 이전 client의 A 큐와 늦은 승인은 새 연결·선택에 배출하지 않는다", async () => {
  let closed = false;
  const s = await setup({ onChild(child, count) {
    if (count !== 1) return;
    let buffered = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffered += chunk.toString();
      let end = buffered.indexOf("\n");
      while (end >= 0) {
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 1);
        const reply: unknown = JSON.parse(line);
        if (!closed && reply && typeof reply === "object" && "result" in reply && JSON.stringify(reply.result).includes('"id":"history-b"')) {
          closed = true;
          inject(child, "item/commandExecution/requestApproval", { threadId: "history-a", command: "종료 전 큐" }, 192);
          // 실제 child/RPC에 process exit 경계를 주입한다. 물리 Native 종료 실측은 아니다.
          child.emit("exit", null, "SIGTERM");
        }
        end = buffered.indexOf("\n");
      }
    });
  } });
  try {
    const a = s.add("tab-a", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    await expect(a.invoke("conversations:open", [selected(a), "history-b"])).rejects.toThrow();
    expect(closed).toBe(true);
    expect(a.summary().approvalCount).toBe(0);
    expect((await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[]).some(event => event.requestId === 192)).toBe(false);
    await a.invoke("conversations:open", [selected(a), "history-b"]);
    const current = selected(a);
    inject(s.children[0]!, "turn/started", { threadId: "history-b", turn: { id: "old-client-turn" } });
    inject(s.children[0]!, "item/commandExecution/requestApproval", { threadId: "history-b", command: "이전 client의 늦은 승인" }, 193);
    expect(a.summary()).toMatchObject({ threadId: "history-b", busy: false, approvalCount: 0 });
    expect(selected(a)).toEqual(current);
    expect((await a.invoke("events:get", [current]) as ScopedAppEvent[]).some(event => event.requestId === 192 || event.requestId === 193)).toBe(false);
  } finally { await s.close(); }
});

test("복원 뒤 live terminal 늦은 started는 busy를 다시 만들지 않고 새 턴은 허용한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const opened = await a.invoke("conversations:open", [selected(a), "history-a"]) as ConversationSelection;
    const terminal = opened.events.find(e => e.method === "turn/completed")?.params as { turn: { id: string } };
    inject(s.children[0]!, "turn/started", { threadId: "history-a", turn: { id: terminal.turn.id } });
    expect(a.summary().busy).toBe(false);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    inject(s.children[0]!, "turn/started", { threadId: "history-a", turn: { id: "new-live-turn" } });
    expect(a.summary().busy).toBe(true);
    await expect(a.invoke("conversations:open", [selected(a), "history-b"])).rejects.toThrow("실행 또는 승인");
    inject(s.children[0]!, "turn/completed", { threadId: "history-a", turn: { id: "new-live-turn", status: "completed" } });
    expect(a.summary().busy).toBe(false);
  } finally { await s.close(); }
});

for (const limit of ["count", "bytes"] as const) test(`A started 뒤 ${limit} overflow와 유실 완료도 명시 재열기로 복구한다`, async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    const opening = a.invoke("conversations:open", [selected(a), "history-b"]);
    inject(s.children[0]!, "turn/started", { threadId: "history-a", turn: { id: "lost-end" } });
    // 텍스트 조각으로 보관 한도를 재현해 도구 관측의 원장 부하는 분리한다.
    const chunks = limit === "count" ? { count: 2000, delta: "x" } : { count: 2, delta: "x".repeat(2 * 1024 * 1024) };
    for (let i = 0; i < chunks.count; i++) {
      inject(s.children[0]!, "item/agentMessage/delta", { threadId: "history-a", turnId: "lost-end", itemId: "x", delta: chunks.delta });
    }
    inject(s.children[0]!, "turn/completed", { threadId: "history-a", turn: { id: "lost-end", status: "completed" } });
    await expect(opening).rejects.toThrow("보관 한도");
    const replayed = s.events.filter(event => event.method === "item/agentMessage/delta"
      && (event.params as { turnId?: string })?.turnId === "lost-end");
    expect(replayed).toHaveLength(chunks.count - 1);
    expect(a.summary()).toMatchObject({ threadId: "history-a", busy: false, approvalCount: 0 });
    await expect(a.invoke("turn:start", [selected(a), "history-a", "차단 요청"])).rejects.toThrow("다시 열어");
    const events = await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[];
    expect(events.some(e => e.method === "transport/closed")).toBe(false);
    expect(events.some(e => e.method === "turn/completed" && (e.params as { turn?: { status?: string } }).turn?.status === "unknown")).toBe(true);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    expect((await a.invoke("turn:start", [selected(a), "history-a", "복구 요청"]) as { turnId: string }).turnId).toBeString();
  } finally { await s.close(); }
});

test("자동 재연결 snapshot 이후에도 이전 terminal started가 새 턴 완료를 되살리지 않는다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    s.children[0]!.kill();
    await until(() => s.events.some(e => e.method === "transport/closed"));
    const result = await a.invoke("turn:start", [selected(a), "history-a", "경계 유휴 종료 후 이어가기"]) as { turnId: string };
    await until(() => s.events.some(e => e.method === "turn/completed" && (e.params as { turn?: { id?: string } }).turn?.id === result.turnId));
    expect(s.children).toHaveLength(2);
    inject(s.children[1]!, "turn/started", { threadId: "history-a", turn: { id: "saved-turn-a" } });
    expect(a.summary().busy).toBe(false);
    expect((await a.invoke("conversations:open", [selected(a), "history-b"]) as ConversationSelection).threadId).toBe("history-b");
  } finally { await s.close(); }
});

for (const transition of ["clear", "project", "project-failure"] as const) {
  for (const activity of ["running", "approval", "other-thread"] as const) test(`${transition} await 중 기존 thread ${activity} 사건을 보전한다`, async () => {
    const gate = deferred();
    let hold = false;
    let entered = false;
    const s = await setup({
      beforeUpsert: async () => { if (hold && transition !== "project-failure") { entered = true; await gate.promise; } },
      projectIO: { beforeRename: async () => { if (hold && transition === "project-failure") { entered = true; await gate.promise; throw new Error("등록 실패"); } } }
    });
    try {
      const session = s.add("tab-a", s.first);
      await session.invoke("conversations:open", [selected(session), "history-a"]);
      const before = selected(session);
      hold = true;
      if (transition !== "project-failure") {
        inject(s.children[0]!, "item/completed", command("history-a", "hold-drain"));
        await until(() => entered);
      }
      s.choose(s.second);
      const leaving = session.invoke(transition === "clear" ? "conversations:new" : "workspace:choose", [before]);
      const failure = leaving.then(() => null, (error: unknown) => error);
      await until(() => entered);
      if (activity === "running") inject(s.children[0]!, "turn/started", { threadId: "history-a", turn: { id: "new-active" } });
      else inject(s.children[0]!, "item/commandExecution/requestApproval", { threadId: activity === "other-thread" ? "unrelated" : "history-a", command: "전환 중 승인" }, 298);
      hold = false;
      gate.resolve();
      const error = await failure;
      if (activity === "other-thread" && transition !== "project-failure") {
        expect(error).toBeNull();
        expect(session.summary()).toMatchObject({ threadId: null, busy: false, approvalCount: 0 });
      } else {
        expect(error).toBeInstanceOf(Error);
        expect(selected(session)).toEqual(before);
        expect(session.summary()).toMatchObject({ threadId: "history-a", busy: activity === "running", approvalCount: activity === "approval" ? 1 : 0 });
        if (activity !== "other-thread") {
          const events = await session.invoke("events:get", [before]) as ScopedAppEvent[];
          expect(events.filter(event => !event.historical && (event.method === "turn/started" && (event.params as { turn?: { id?: string } }).turn?.id === "new-active" || event.requestId === 298))).toHaveLength(1);
          await expect(session.invoke("turn:start", [before, "history-a", "중복 금지"])).rejects.toThrow();
        }
      }
    } finally { hold = false; gate.resolve(); await s.close(); }
  });
}

for (const shape of ["rateLimits", "rateLimitsByLimitId"] as const) test(`main→활동 ${shape}는 창 생략·명시 null·잘못된 갱신을 구별한다`, async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    await start(a);
    const primary = { usedPercent: 25, windowDurationMins: 300, resetsAt: 100 };
    const secondary = { usedPercent: 45, windowDurationMins: 10080, resetsAt: 200 };
    const send = (update: Record<string, unknown>) => {
      const bucket = { limitId: "quota-test", ...update };
      inject(s.children[0]!, "account/rateLimits/updated", shape === "rateLimits" ? { rateLimits: bucket } : { rateLimitsByLimitId: { "quota-test": bucket } });
      return projectNativeActivity(s.events).limits.find(limit => limit.id === "quota-test");
    };
    expect(send({ primary, secondary })).toMatchObject({ primary, secondary });
    expect(send({ primary: { usedPercent: 30 } })).toMatchObject({ primary: { ...primary, usedPercent: 30 }, secondary });
    expect(send({ secondary: { usedPercent: 50 } })).toMatchObject({ primary: { ...primary, usedPercent: 30 }, secondary: { ...secondary, usedPercent: 50 } });
    expect(send({ limitName: "이름만 갱신", privateValue: "노출하지 않음" })).toMatchObject({ name: "이름만 갱신", primary: { ...primary, usedPercent: 30 }, secondary: { ...secondary, usedPercent: 50 } });
    const metadata = { limitId: "quota-test", limitName: "이름만 갱신" };
    expect(s.events.at(-1)?.params).toEqual(shape === "rateLimits" ? { rateLimits: metadata, rateLimitsByLimitId: null } : { rateLimits: null, rateLimitsByLimitId: { "quota-test": metadata } });
    for (const key of ["primary", "secondary"] as const) {
      const before = projectNativeActivity(s.events).limits.find(limit => limit.id === "quota-test")!;
      for (const invalid of [42, "잘못된 창", [], { resetsAt: 999 }, { usedPercent: "잘못된 숫자" }]) {
        expect(send({ [key]: invalid })?.[key]).toEqual(before[key]);
      }
      const other = key === "primary" ? "secondary" : "primary";
      for (const field of ["windowDurationMins", "resetsAt"] as const) {
        expect(send({ [key]: { usedPercent: 55, [field]: null } })?.[key]?.[field]).toBeNull();
        expect(send({ [key]: { usedPercent: 60 } })?.[key]?.[field]).toBeNull();
      }
      const otherBefore = projectNativeActivity(s.events).limits.find(limit => limit.id === "quota-test")![other];
      expect(send({ [key]: null })).toMatchObject({ [key]: null, [other]: otherBefore });
      expect(send({ limitName: "생략은 삭제가 아님" })?.[key]).toBeNull();
      expect(send({ [key]: { usedPercent: 65 } })?.[key]).toEqual({ usedPercent: 65, windowDurationMins: null, resetsAt: null });
    }
  } finally { await s.close(); }
});
