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
  expect(result.blocks[0]).toEqual({ kind: "answer", id: "a", text: "안녕하세요", streaming: false });
});

test("marks unknown structured request unsupported without decisions", () => {
  const result = project([event(1, "tool/requestUserInput", { question: "x" }, { kind: "request", requestId: "req", supported: false })]);
  expect(result.blocks[0]).toMatchObject({ kind: "approval", supported: false, requestId: "req" });
});
