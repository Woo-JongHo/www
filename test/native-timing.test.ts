import { expect, test } from "bun:test";
import { createNativeTiming, type NativeTimingEvent } from "../src/native-timing";
import { createNativeLifecycle } from "../src/native-lifecycle";

function setup() {
  let time = 100;
  let id = 0;
  let valid = true;
  const events: NativeTimingEvent[] = [];
  const timing = createNativeTiming({ now: () => time, id: () => `trace-${++id}`, emit: (event) => events.push(event) });
  return { timing, events, advance(ms: number) { time += ms; }, valid: () => valid, invalidate() { valid = false; } };
}

test("스레드 구성 후 공개한 완료 사건은 RPC 응답 시각을 보존한다", () => {
  const s = setup();
  const trace = s.timing.begin(null, s.valid);
  trace.mark("thread/start", "started");
  s.advance(12);
  const responseElapsedMs = trace.elapsed();
  s.advance(48);
  trace.setThread("thread");
  trace.mark("thread/start", "completed", responseElapsedMs);
  expect(s.events.at(-1)?.elapsedMs).toBe(12);
});

test("새 스레드와 첫 턴은 한 main 시간축에 연결하고 후속 턴은 새 trace다", () => {
  const s = setup();
  const trace = s.timing.begin(null, s.valid);
  trace.mark("connect", "started");
  s.advance(20);
  trace.mark("connect", "completed");
  trace.mark("thread/start", "started");
  s.advance(30);
  trace.setThread("thread");
  trace.mark("thread/start", "completed");
  expect(s.timing.forTurn("thread", s.valid)).toBe(trace);
  trace.arm();
  trace.bindTurn("turn");
  s.advance(40);
  s.timing.observe("item/agentMessage/delta", { threadId: "thread", turnId: "turn", delta: "공개 설명" });
  expect(s.events.at(-1)).toEqual({ traceId: "trace-1", threadId: "thread", phase: "first-native", status: "completed", elapsedMs: 90, source: "native" });
  const next = s.timing.forTurn("thread", s.valid);
  expect(next).not.toBe(trace);
  expect(s.events.at(-1)?.traceId).toBe("trace-2");
  expect(s.events.at(-1)?.elapsedMs).toBe(0);
});

test("응답보다 먼저 온 본문은 확인된 turn의 원래 수신 시각만 수용한다", () => {
  const s = setup();
  const trace = s.timing.begin("thread", s.valid);
  trace.arm();
  s.advance(10);
  s.timing.observe("item/agentMessage/delta", { threadId: "thread", turnId: "old", delta: "늦은 이전 응답" });
  s.advance(20);
  s.timing.observe("item/agentMessage/delta", { threadId: "thread", turnId: "current", delta: "실제 현재 응답" });
  s.advance(50);
  trace.bindTurn("current");
  expect(s.events.at(-1)?.elapsedMs).toBe(30);
  expect(s.events.filter((event) => event.phase === "first-native" && event.status === "completed")).toHaveLength(1);
  s.timing.observe("item/agentMessage/delta", { threadId: "thread", turnId: "current", delta: "다음 조각" });
  expect(s.events.filter((event) => event.phase === "first-native" && event.status === "completed")).toHaveLength(1);
});

test("다른 scope·빈 reasoning·user·transport 사건은 첫 의미있는 수신이 아니다", () => {
  const s = setup();
  const trace = s.timing.begin("thread", s.valid);
  trace.arm();
  trace.bindTurn("turn");
  const scope = { threadId: "thread", turnId: "turn" };
  s.timing.observe("item/agentMessage/delta", { ...scope, threadId: "other", delta: "내용" });
  s.timing.observe("item/agentMessage/delta", { ...scope, turnId: "old", delta: "내용" });
  s.timing.observe("item/reasoning/summaryTextDelta", { ...scope, delta: " " });
  s.timing.observe("item/started", { ...scope, item: { type: "reasoning" } });
  s.timing.observe("item/started", { ...scope, item: { type: "userMessage", text: "질문" } });
  s.timing.observe("turn/started", { ...scope });
  s.timing.observe("transport/connected", scope);
  expect(s.events.filter((event) => event.source === "native")).toHaveLength(0);
  s.timing.observe("item/started", { ...scope, item: { type: "commandExecution", command: "저장하면 안 되는 명령" } });
  expect(s.events.at(-1)?.source).toBe("native");
});

test("실패·취소·재연결 뒤 늦은 사건과 실패 phase 완료를 격리한다", () => {
  const s = setup();
  const old = s.timing.begin("thread", s.valid);
  old.mark("connect", "started");
  old.arm();
  s.timing.cancel("failed");
  const count = s.events.length;
  old.mark("connect", "completed");
  old.bindTurn("old");
  old.observe("item/agentMessage/delta", { threadId: "thread", turnId: "old", delta: "늦음" });
  expect(s.events).toHaveLength(count);
  expect(s.events.filter((event) => event.phase === "connect").map((event) => event.status)).toEqual(["started", "failed"]);
  const current = s.timing.begin("thread", s.valid);
  current.arm();
  current.bindTurn("current");
  s.timing.observe("item/agentMessage/delta", { threadId: "thread", turnId: "old", delta: "늦음" });
  expect(s.events.filter((event) => event.source === "native")).toHaveLength(0);
  s.timing.cancel();
  expect(s.events.at(-1)?.status).toBe("cancelled");
});

test("선택이 무효화되면 예전 trace는 발행하지 않고 원문을 보관하지 않는다", () => {
  const s = setup();
  const trace = s.timing.begin("thread", s.valid);
  trace.arm();
  trace.bindTurn("turn");
  s.timing.observe("item/agentMessage/delta", { threadId: "thread", turnId: "turn", delta: "비밀 프롬프트 출력 추론" });
  expect(JSON.stringify(s.events)).not.toContain("비밀");
  for (const event of s.events) expect(Object.keys(event).sort()).toEqual(["elapsedMs", "phase", "source", "status", "threadId", "traceId"]);
  const count = s.events.length;
  s.invalidate();
  trace.mark("turn/start", "completed");
  s.timing.cancel();
  expect(s.events).toHaveLength(count);
});

test("lifecycle의 RPC 경계는 실제 순서와 실패 상태를 전달한다", async () => {
  const boundaries: string[] = [];
  const client = {
    async request(method: string) {
      if (method === "turn/start") throw new Error("전송 실패");
      if (method === "thread/turns/list") return { data: [], nextCursor: null };
      return { thread: { id: "thread", cwd: "/tmp", originator: "www" } };
    },
    async respond() {}
  };
  const lifecycle = createNativeLifecycle(() => {});
  await expect(lifecycle.start({
    connect: async () => client, valid: () => true, cwd: "/tmp", threadId: "thread", prompt: "경계 검사",
    restored() {}, beforeStart() {}, requestBoundary: (method, status) => boundaries.push(`${method}:${status}`)
  })).rejects.toThrow("전송 실패");
  expect(boundaries).toEqual([
    "thread/read:started", "thread/read:completed", "thread/resume:started", "thread/resume:completed",
    "thread/turns/list:started", "thread/turns/list:completed", "turn/start:started", "turn/start:failed"
  ]);
});
