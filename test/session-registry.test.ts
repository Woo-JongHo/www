/**
 * @verifies RESP-NATIVE-LIFECYCLE
 */
import { expect, test } from "bun:test";
import { createSessionRegistry } from "../src/session-registry";

function setup() {
  const registry = createSessionRegistry<{ id: string }>();
  registry.add({ id: "a" });
  registry.add({ id: "b" });
  return registry;
}

test("보류 중인 대화는 다른 세션에서 즉시 열 수 없다", () => {
  const registry = setup();
  const reservation = registry.reserve("a", "workspace", "thread");
  expect(() => registry.reserve("b", "workspace", "thread")).toThrow("다른 탭");
  expect(() => registry.reserve("a", "workspace", "other")).toThrow();
  reservation.rollback();
  registry.reserve("b", "workspace", "thread").commit();
});

test("실패한 전환은 이전 소유를 유지하고 성공한 전환은 교체한다", () => {
  const registry = setup();
  registry.reserve("a", "workspace", "old").commit();
  const failed = registry.reserve("a", "workspace", "new");
  expect(() => registry.reserve("b", "workspace", "old")).toThrow();
  failed.rollback();
  expect(() => registry.reserve("b", "workspace", "old")).toThrow();
  registry.reserve("a", "workspace", "new").commit();
  registry.reserve("b", "workspace", "old").commit();
  expect(() => registry.reserve("b", "workspace", "new")).toThrow();
});

test("같은 대화 재예약과 서로 다른 workspace는 독립적이다", () => {
  const registry = setup();
  registry.reserve("a", "one", "thread").commit();
  registry.reserve("a", "one", "thread").commit();
  registry.reserve("b", "two", "thread").commit();
  expect(() => registry.reserve("b", "one", "thread")).toThrow();
});

test("삭제와 해제는 소유와 보류를 정리하고 오래된 commit을 거부한다", () => {
  const registry = setup();
  registry.reserve("a", "workspace", "old").commit();
  const pending = registry.reserve("a", "workspace", "new");
  registry.remove("a");
  expect(() => pending.commit()).toThrow();
  pending.rollback();
  registry.reserve("b", "workspace", "old").commit();
  registry.release("b");
  registry.add({ id: "c" });
  registry.reserve("c", "workspace", "old").commit();
  registry.reserve("b", "workspace", "new").commit();
});

test("등록과 기본 세션 조회는 유효한 세션만 허용한다", () => {
  const registry = setup();
  expect(registry.get().id).toBe("a");
  expect(registry.list().map((session) => session.id)).toEqual(["a", "b"]);
  expect(() => registry.add({ id: "a" })).toThrow();
  expect(() => registry.get("missing")).toThrow();
  expect(() => registry.remove("missing")).toThrow();
  registry.remove("a");
  expect(registry.get().id).toBe("b");
  registry.remove("b");
  expect(() => registry.get()).toThrow();
});
