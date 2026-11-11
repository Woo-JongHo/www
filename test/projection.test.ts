import { expect, test } from "bun:test";
import { project } from "../src/projection";
import type { AppEvent } from "../src/shared";
const event = (seq: number, method: string, params: unknown, extra: Partial<AppEvent> = {}): AppEvent => ({ seq, at: "2026-01-01T00:00:00Z", kind: "notification", method, params, ...extra });

test("projects streaming answer and completion", () => {
  const result = project([
    event(1, "turn/started", { turn: { id: "turn-1" } }),
    event(2, "item/agentMessage/delta", { itemId: "a", delta: "안녕" }),
    event(3, "item/agentMessage/delta", { itemId: "a", delta: "하세요" }),
    event(4, "item/completed", { item: { id: "a", type: "agentMessage", text: "안녕하세요" } }),
    event(5, "turn/completed", { turn: { id: "turn-1", status: "completed" } })
  ]);
  expect(result).toMatchObject({ working: false, turnId: "turn-1", turn: "completed" });
  expect(result.blocks[0]).toMatchObject({ kind: "answer", text: "안녕하세요", streaming: false });
});

test("marks unknown structured request unsupported without decisions", () => {
  const result = project([event(1, "tool/requestUserInput", { question: "x" }, { kind: "request", requestId: "req", supported: false })]);
  expect(result.blocks[0]).toMatchObject({ kind: "approval", supported: false, requestId: "req" });
});

test("같은 item ID를 서로 다른 turn에서 합치지 않는다", () => {
  const result = project([
    event(1, "turn/started", { turn: { id: "turn-1" } }),
    event(2, "item/agentMessage/delta", { turnId: "turn-1", itemId: "same", delta: "첫째" }),
    event(3, "turn/started", { turn: { id: "turn-2" } }),
    event(4, "item/agentMessage/delta", { turnId: "turn-2", itemId: "same", delta: "둘째" })
  ]);
  expect(result.blocks).toHaveLength(2);
  expect(result.blocks).toMatchObject([
    { kind: "answer", turnId: "turn-1", text: "첫째" },
    { kind: "answer", turnId: "turn-2", text: "둘째" }
  ]);
});

test("exitCode 0과 null 및 긴 출력 절단을 구분한다", () => {
  const long = "x".repeat(40_000);
  const result = project([
    event(1, "turn/started", { turn: { id: "turn-1" } }),
    event(2, "item/started", { turnId: "turn-1", item: { id: "ok", type: "commandExecution", command: "true" } }),
    event(3, "item/commandExecution/outputDelta", { turnId: "turn-1", itemId: "ok", delta: long }),
    event(4, "item/completed", { turnId: "turn-1", item: { id: "ok", type: "commandExecution", exitCode: 0 } }),
    event(5, "item/started", { turnId: "turn-1", item: { id: "unknown", type: "commandExecution", command: "?" } }),
    event(6, "item/completed", { turnId: "turn-1", item: { id: "unknown", type: "commandExecution" } })
  ]);
  expect(result.blocks[0]).toMatchObject({ kind: "command", exitCode: 0, outputTruncated: true, running: false });
  expect(result.blocks[1]).toMatchObject({ kind: "command", exitCode: null, running: false });
});

test("다른 turn의 완료는 현재 실행 상태를 바꾸지 않는다", () => {
  const result = project([
    event(1, "turn/started", { threadId: "thread-1", turn: { id: "current" } }),
    event(2, "turn/completed", { threadId: "thread-1", turn: { id: "old", status: "completed" } })
  ]);
  expect(result).toMatchObject({ threadId: "thread-1", turnId: "current", turn: "running", working: true });
});

test("command와 file 사건을 순서와 중복에 관계없이 upsert한다", () => {
  const result = project([
    event(1, "turn/started", { threadId: "thread-1", turn: { id: "turn-1" } }),
    event(2, "item/commandExecution/outputDelta", { threadId: "thread-1", turnId: "turn-1", itemId: "cmd", delta: "먼저" }),
    event(3, "item/started", { threadId: "thread-1", turnId: "turn-1", item: { id: "cmd", type: "commandExecution", command: "printf" } }),
    event(4, "item/completed", { threadId: "thread-1", turnId: "turn-1", item: { id: "cmd", type: "commandExecution", command: "printf", aggregatedOutput: "완료 출력", exitCode: 0 } }),
    event(5, "item/completed", { threadId: "thread-1", turnId: "turn-1", item: { id: "cmd", type: "commandExecution", command: "printf", aggregatedOutput: "완료 출력", exitCode: 0 } }),
    event(6, "item/completed", { threadId: "thread-1", turnId: "turn-1", item: { id: "files", type: "fileChange", changes: [{ path: "a.ts" }] } }),
    event(7, "item/started", { threadId: "thread-1", turnId: "turn-1", item: { id: "files", type: "fileChange", changes: [{ path: "a.ts" }] } }),
    event(8, "item/completed", { threadId: "thread-1", turnId: "turn-1", item: { id: "files", type: "fileChange", changes: [{ path: "a.ts" }] } })
  ]);
  expect(result.blocks.filter((block) => block.kind === "command")).toHaveLength(1);
  expect(result.blocks.filter((block) => block.kind === "files")).toHaveLength(1);
  expect(result.blocks[0]).toMatchObject({ kind: "command", command: "printf", output: "완료 출력", status: "completed" });
  expect(result.blocks[1]).toMatchObject({ kind: "files", changes: [{ path: "a.ts", diff: null, truncated: false }], status: "completed" });
});

test("큰 aggregatedOutput도 같은 코드 단위 제한을 적용한다", () => {
  const result = project([
    event(1, "item/completed", {
      turnId: "turn-1",
      item: { id: "cmd", type: "commandExecution", aggregatedOutput: "가".repeat(40_000), exitCode: 0 }
    })
  ]);
  expect(result.blocks[0]).toMatchObject({ kind: "command", outputTruncated: true });
  expect((result.blocks[0] as { output: string }).output).toHaveLength(32_768);
});

test("공개 commentary만 설명으로 표시하고 private reasoning은 제외한다", () => {
  const result = project([
    event(1, "item/agentMessage/delta", { turnId: "turn-1", itemId: "comment", phase: "commentary", delta: "공개 설명" }),
    event(2, "item/completed", { turnId: "turn-1", item: { id: "private", type: "reasoning", text: "비공개" } }),
    event(3, "item/completed", { turnId: "turn-1", item: { id: "answer", type: "agentMessage", text: "최종 답변" } })
  ]);
  expect(result.blocks).toMatchObject([
    { kind: "explanation", source: "commentary", text: "공개 설명" },
    { kind: "answer", text: "최종 답변" }
  ]);
});

test("EOF와 알 수 없는 completion status를 성공으로 승격하지 않는다", () => {
  const unknownStatus = project([
    event(1, "turn/started", { turn: { id: "turn-1" } }),
    event(2, "turn/completed", { turn: { id: "turn-1", status: "future-status" } })
  ]);
  const closed = project([
    event(1, "turn/started", { turn: { id: "turn-1" } }),
    event(2, "transport/closed", { message: "EOF" }, { kind: "transport" })
  ]);
  expect(unknownStatus).toMatchObject({ turn: "unknown", working: false });
  expect(closed).toMatchObject({ transport: "closed", turn: "unknown", working: false });
});

test("승인 응답 상태와 중단 요청·확인을 독립적으로 투영한다", () => {
  const result = project([
    event(1, "turn/started", { turn: { id: "turn-1" } }),
    event(2, "item/commandExecution/requestApproval", { command: "rm x" }, { kind: "request", requestId: 0, supported: true }),
    event(3, "approval/responding", { decision: "decline" }, { requestId: 0 }),
    event(4, "turn/interruptRequested", { turnId: "turn-1" }),
    event(5, "turn/interruptAcknowledged", { turnId: "turn-1" })
  ]);
  expect(result.blocks[0]).toMatchObject({ kind: "approval", requestId: 0, state: "responding", open: false });
  expect(result.interrupt).toBe("acknowledged");
});

test("중복 승인 ID는 원래 요청을 덮어쓰거나 두 번 응답 가능하게 만들지 않는다", () => {
  const result = project([
    event(1, "turn/started", { turn: { id: "turn-1" } }),
    event(2, "item/commandExecution/requestApproval", { turnId: "turn-1", command: "first" }, { kind: "request", requestId: "same", supported: true }),
    event(3, "item/commandExecution/requestApproval", { turnId: "turn-1", command: "duplicate", duplicateRequestId: true }, { kind: "request", requestId: "same", supported: false }),
    event(4, "approval/responded", { decision: "decline" }, { requestId: "same" })
  ]);
  expect(result.blocks).toMatchObject([
    { kind: "approval", requestId: "same", supported: true, state: "responded", open: false },
    { kind: "approval", requestId: "same", supported: false, open: false }
  ]);
});

test("다른 스레드의 같은 턴 ID가 현재 실행과 중단 상태를 바꾸지 않는다", () => {
  const result = project([
    event(1, "turn/started", { threadId: "current", turn: { id: "same" } }),
    event(2, "turn/completed", { threadId: "other", turn: { id: "same", status: "completed" } }),
    event(3, "turn/interruptAcknowledged", { threadId: "other", turnId: "same" })
  ]);
  expect(result).toMatchObject({ threadId: "current", turnId: "same", working: true, turn: "running", interrupt: "idle" });
});

test("완료 뒤 늦은 출력과 중복 시작은 명령을 다시 실행 중으로 만들지 않는다", () => {
  const result = project([
    event(1, "item/completed", { item: { id: "done", type: "commandExecution", command: "true", exitCode: 0, aggregatedOutput: "앞" } }),
    event(2, "item/commandExecution/outputDelta", { itemId: "done", delta: "뒤" }),
    event(3, "item/started", { item: { id: "done", type: "commandExecution", command: "true" } })
  ]);
  expect(result.blocks).toHaveLength(1);
  expect(result.blocks[0]).toMatchObject({ kind: "command", running: false, status: "completed", output: "앞뒤", exitCode: 0 });
});

test("시작에서 제공된 공개 설명 phase를 델타와 완료에도 보존한다", () => {
  const result = project([
    event(1, "item/started", { item: { id: "comment", type: "agentMessage", phase: "commentary" } }),
    event(2, "item/agentMessage/delta", { itemId: "comment", delta: "진행 설명" }),
    event(3, "item/completed", { item: { id: "comment", type: "agentMessage", text: "진행 설명" } })
  ]);
  expect(result.blocks).toHaveLength(1);
  expect(result.blocks[0]).toMatchObject({ kind: "explanation", source: "commentary", text: "진행 설명", streaming: false });
});

test("접수 응답보다 완료 알림이 먼저 와도 이미 끝난 턴을 재시작하지 않는다", () => {
  const result = project([
    event(1, "turn/userPrompt", { threadId: "thread", clientRequestId: "request", text: "요청" }),
    event(2, "turn/started", { threadId: "thread", turn: { id: "turn" } }),
    event(3, "turn/completed", { threadId: "thread", turn: { id: "turn", status: "completed" } }),
    event(4, "turn/startAccepted", { threadId: "thread", turnId: "turn", clientRequestId: "request" })
  ]);
  expect(result).toMatchObject({ turn: "completed", working: false });
  expect(result.blocks[0]).toMatchObject({ kind: "user", state: "accepted", turnId: "turn" });
});

test("후속 요청의 전송 실패가 이미 실행 중인 턴을 실패로 바꾸지 않는다", () => {
  const result = project([
    event(1, "turn/started", { threadId: "thread", turn: { id: "running" } }),
    event(2, "turn/userPrompt", { threadId: "thread", clientRequestId: "next", text: "추가 요청" }),
    event(3, "turn/startFailed", { threadId: "thread", clientRequestId: "next", message: "이미 실행 중" })
  ]);
  expect(result).toMatchObject({ turnId: "running", turn: "running", working: true });
  expect(result.blocks[0]).toMatchObject({ kind: "user", state: "failed", error: "이미 실행 중" });
});

test("파일 변경 내용을 별도로 보존하며 큰 diff 제한과 중복 시작을 처리한다", () => {
  const result = project([
    event(1, "item/completed", { item: { id: "file", type: "fileChange", status: "completed", changes: [{ path: "a.ts", diff: "가".repeat(40_000) }] } }),
    event(2, "item/started", { item: { id: "file", type: "fileChange" } })
  ]);
  expect(result.blocks).toHaveLength(1);
  expect(result.blocks[0]).toMatchObject({ kind: "files", running: false, status: "completed", changes: [{ path: "a.ts", diff: "가".repeat(32_768), truncated: true }] });
});

test("로컬 요청만으로 연결 성공을 만들지 않고 실제 연결·종료 사건을 따른다", () => {
  const request = event(1, "turn/userPrompt", { threadId: "thread", clientRequestId: "request", text: "요청" });
  const connected = event(2, "transport/connected", {}, { kind: "transport" });
  const closed = event(3, "transport/closed", {}, { kind: "transport" });
  expect([
    project([request]).transport,
    project([request, connected]).transport,
    project([request, connected, closed]).transport
  ]).toEqual(["disconnected", "connected", "closed"]);
});
