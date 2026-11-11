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
    event(5, "turn/completed", { turn: { id: "turn-1" } })
  ]);
  expect(result).toMatchObject({ working: false, turnId: "turn-1" });
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
