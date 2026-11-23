/** @verifies RESP-DEVELOPMENT-EVIDENCE-VERIFICATION */
import assert from "node:assert/strict";
import test from "node:test";
import { replayTiming } from "../scripts/replay-workflow-timing.ts";

const time = (seconds: number) => new Date(seconds * 1000).toISOString();
const span = (id: string, start: number, end: number) => ({ id, startedAt: time(start), completedAt: time(end) });

test("요청 구간 안의 검증과 검토 시간을 중복 없이 합하고 빈 구간을 남긴다", () => {
  const workflow = {
    verifications: [span("first", 0, 12), span("last", 18, 24)],
    reviews: [span("overlap", 11, 14), span("outside", 20, 30)],
  };
  const result = replayTiming(time(10), time(20), [{ workflow }, { workflow }]);
  assert.equal(result.executionCount, 3);
  assert.equal(result.coveredMs, 6000);
  assert.equal(result.unmeasuredMs, 4000);
});

test("같은 실행 ID의 서로 다른 기록은 합산을 거부한다", () => {
  const workflow = { verifications: [span("same", 0, 2), span("same", 0, 3)], reviews: [] };
  assert.throws(() => replayTiming(time(0), time(4), [{ workflow }]), /시각 충돌/);
});

test("도중에 끊긴 실행은 마지막 관측까지만 설명하고 결과 등록 대기와 겹치는 구간을 한 번만 센다", () => {
  const row = (id: string, seconds: number, event: string, details = {}) => ({ version: 1, traceId: id, at: time(seconds), event, ...details });
  const verify = [
    row("v", 0, "requested", { operation: "verification" }),
    row("v", 1, "phase", { phase: "session_queue" }),
    row("v", 3, "phase", { phase: "preparation" }),
    row("v", 3, "process_start", { role: "verification_process", processId: "child" }),
    row("v", 7, "process_exit", { role: "verification_process", processId: "child" }),
    row("v", 7, "attempt", { attemptId: "a" }),
    row("v", 8, "returned"),
  ];
  const registration = [
    row("r", 5, "requested", { operation: "registration" }),
    row("r", 6, "phase", { phase: "ledger_lock" }),
    row("r", 9, "registration_pending", { attemptId: "a" }),
  ];
  const window = replayTiming(time(2), time(12), [verify, verify, registration]);
  assert.equal(window.coveredMs, 7000);
  assert.equal(window.unmeasuredMs, 3000);
  assert.equal(window.phaseMs.ledger_lock, 3000);
  assert.equal(window.phaseMs.session_queue, 1000);
  assert.equal(window.processStarts, 1);
  assert.equal(window.unfinishedRequests, 1);
});

test("동일 trace의 진행 중 사본은 긴 사본으로 합치고 충돌한 trace만 제외한다", () => {
  function trace(traceId: string, end: number) {
    return [
      { version: 1, traceId, at: time(1), event: "requested", operation: "verification" },
      { version: 1, traceId, at: time(end), event: "returned" },
    ];
  }
  const good = trace("good", 3);
  const result = replayTiming(time(0), time(10), [good.slice(0, 1), good, trace("bad", 7), trace("bad", 5)]);
  assert.equal(result.coveredMs, 2000);
  assert.equal(result.unfinishedRequests, 0);
  assert.equal(result.rejectedInputs.length, 1);
});
