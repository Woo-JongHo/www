/**
 * @verifies RESP-CHAT-ACTIVITY-PROJECTION
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NativeActivityView } from "../src/native-activity-view";
import { restoreConversationEvents } from "../src/conversations";
import { normalizeNativeResources, projectNativeActivity } from "../src/native-activity";
import type { AppEvent } from "../src/shared";

describe("v4 명시 null 한도와 종료 뒤 시작 경계", () => {
  const limit    = (seq: number, data: unknown) => event(seq, "account/rateLimits/updated", { rateLimits: data }) ;
  const baseline = { usedPercent: 35, windowDurationMins: 300, resetsAt: 200 }                                    ;
  for (const key of ["primary", "secondary"] as const) {
    test(`${key} 명시 null은 창을 지우며 생략·잘못된 창과 구별한다`, () => {
      const initial = limit(1, { limitId: "pro", [key]: baseline })                                                            ;
      const cleared = [initial, limit(2, { limitId: "pro", [key]: null }), limit(3, { limitId: "pro", limitName: "새 이름" })] ;
      expect(projectNativeActivity(cleared).limits[0]?.[key]).toBeNull();
      const sparse = [initial, limit(2, { limitId: "pro", [key]: { usedPercent: 40 } })];
      expect(projectNativeActivity(sparse).limits[0]?.[key]).toEqual({ ...baseline, usedPercent: 40 });
      const invalid = [...sparse, limit(3, { limitId: "pro", [key]: { resetsAt: 900 } })];
      expect(projectNativeActivity(invalid).limits[0]?.[key]).toEqual({ ...baseline, usedPercent: 40 });
      expect(projectNativeActivity([...cleared, limit(4, { limitId: "pro", [key]: { usedPercent: 50 } })]).limits[0]?.[key]).toEqual({ usedPercent: 50, windowDurationMins: null, resetsAt: null });
    });
    for (const field of ["windowDurationMins", "resetsAt"] as const) {
      test(`${key}.${field} null은 이전 숫자를 부활시키지 않는다`, () => {
        const initial = limit(1, { limitId: "pro", [key]: baseline })                                      ;
        const cleared = [initial, limit(2, { limitId: "pro", [key]: { usedPercent: 40, [field]: null } })] ;
        expect(projectNativeActivity(cleared).limits[0]?.[key]).toEqual({ ...baseline, usedPercent: 40, [field]: null });
        expect(projectNativeActivity([...cleared, limit(3, { limitId: "pro", [key]: { usedPercent: 41 } })]).limits[0]?.[key]?.[field]).toBeNull();
      });
    }
  }
  for (const end of ["completed", "failed", "interrupted", "unknown", "eof"]) {
    for (const type of ["commandExecution", "fileChange", "agentMessage", "mcpToolCall", "contextCompaction"]) {
      test(`${end} 뒤 새 ${type} started는 상세 실행 행을 만들지 않는다`, () => {
        const before = [started(1), item(2, "item/started", { id: "known", type: "commandExecution", command: "printf known" }),
          end === "eof" ? event(3, "transport/closed", {}) : event(3, "turn/completed", { threadId: "t", turn: { id: "a", status: end } })];
        const late   = item                 (4, "item/started", { id: "late", type, command: "printf late", phase: "final_answer", tool: "late-tool", changes: [{ path: "late.ts" }] }) ;
        const result = projectNativeActivity([...before, late], "t"                                                                                                                   ) ;
        expect(result.turns[0]?.entries.some(row => row.id === "item:late")).toBe(false);
        expect(result.turns[0]?.entries.find(row => row.id === "item:known")?.status).toBe("unknown");
        const settled = projectNativeActivity([...before, late,
          item(5, "item/completed", { id: "known", type: "commandExecution", command: "printf known", status: "completed", exitCode: 0 }),
          item(6, "item/completed", { id: "final", type: "agentMessage", phase: "final_answer", text: "후행 최종 결과" })], "t");
        expect(settled.turns[0]?.entries.find(row => row.id === "item:known")?.status).toBe("completed");
        expect(settled.turns[0]?.answer).toBe("후행 최종 결과");
      });
    }
  }
  test("활성 턴의 새 실행 시작은 그대로 관측한다", () => {
    const result = projectNativeActivity([started(1), item(2, "item/started", { id: "active", type: "commandExecution", command: "printf active" })], "t");
    expect(result.turns[0]?.entries.find(row => row.id === "item:active")?.status).toBe("running");
  });
});

function event(seq: number, method: string, params: unknown): AppEvent {
  return { seq, method, params, at: `2026-11-12T00:00:${String(seq % 60).padStart(2, "0")}Z`, kind: "notification" };
}
function tokens(total: number) {
  return { inputTokens: total, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: total };
}
function update(seq: number, turnId: string, total: number, last = 1): AppEvent {
  return event(seq, "thread/tokenUsage/updated", { threadId: "t", turnId, tokenUsage: { total: tokens(total), last: tokens(last) } });
}
function started(seq: number, turnId = "a"): AppEvent {
  return event(seq, "turn/started", { threadId: "t", turn: { id: turnId } });
}
function item(seq: number, method: string, value: unknown, turnId = "a"): AppEvent {
  return event(seq, method, { threadId: "t", turnId, item: value });
}
const configured = event(1, "thread/configured", { threadId: "t", model: "gpt", modelProvider: "openai", isNew: true });

describe("Hook 핸들러의 최신 활동", () => {
  function hook(seq: number, method: string, run: Record<string, unknown>, turnId: string | null = "a", threadId: string | null = "t"): AppEvent {
    return event(seq, method, { threadId, turnId, run: { id: "handler", executionMode: "sync", eventName: "preToolUse", status: method === "hook/started" ? "running" : "completed", ...run } });
  }

  test("후속 시작은 같은 행의 타이머와 결과를 새로 갱신한다", () => {
    for (const [firstTime, nextTime] of [[100, 200], ["2026-11-12T00:00:00Z", "2026-11-12T00:00:01Z"]]) {
      const first   = [hook(1, "hook/started", { startedAt: firstTime }), hook(2, "hook/completed", { startedAt: firstTime, durationMs: 8, statusMessage: "첫 결과" })] ;
      const next    = [...first, hook(3, "hook/started", { startedAt: nextTime, statusMessage: "진행 중" })]                                                            ;
      const running = projectNativeActivity(next, "t").turns[0]?.entries                                                                                                ;
      expect(running).toHaveLength(1);
      expect(running?.[0]).toMatchObject({ id: "hook:t:a:handler", at: next[2]?.at, status: "running", endedAt: null, durationMs: null, description: "진행 중" });
      const delayed = [...next, hook(4, "hook/completed", { startedAt: firstTime, status: "failed", durationMs: 99 }), hook(5, "hook/started", { startedAt: firstTime }), hook(6, "hook/started", { startedAt: nextTime })];
      expect(projectNativeActivity(delayed, "t").turns[0]?.entries).toEqual(running);
      const completed = projectNativeActivity([...delayed, hook(7, "hook/completed", { startedAt: nextTime, status: "failed", durationMs: 12, statusMessage: "후속 결과" })], "t").turns[0]?.entries;
      expect(completed).toHaveLength(1);
      expect(completed?.[0]).toMatchObject({ at: next[2]?.at, status: "failed", endedAt: "2026-11-12T00:00:07Z", durationMs: 12, description: "후속 결과" });
    }
  });

  test("완료를 먼저 수신해도 더 새로운 실행의 시작과 완료를 표시한다", () => {
    const completed = hook(1, "hook/completed", { startedAt: 100, durationMs: 8 })                                           ;
    const replayed  = projectNativeActivity([completed, hook(2, "hook/started", { startedAt: 100 })], "t").turns[0]?.entries ;
    expect(replayed).toEqual(projectNativeActivity([completed], "t").turns[0]?.entries);
    const next = [completed, hook(2, "hook/started", { startedAt: 200 })];
    expect(projectNativeActivity(next, "t").turns[0]?.entries[0]).toMatchObject({ status: "running", at: next[1]?.at, endedAt: null, durationMs: null });
    const latest = projectNativeActivity([...next, hook(3, "hook/completed", { startedAt: 300, durationMs: 10 })], "t").turns[0]?.entries;
    expect(latest).toHaveLength(1);
    expect(latest?.[0]).toMatchObject({ status: "completed", at: "2026-11-12T00:00:03Z", durationMs: 10 });
  });

  test("복원 자료는 실시간 결과를 덮지 않고 다른 턴과 세션의 상태를 보존한다", () => {
    const history = [hook(1, "hook/completed", { startedAt: 100, durationMs: 8 })].map(row => ({ ...row, historical: true }))                                          ;
    const live    = [...history, hook(2, "hook/started", { startedAt: 200 })]                                                                                          ;
    const replay  = { ...hook(3, "hook/completed", { startedAt: 300, status: "failed" }), historical: true }                                                           ;
    const result  = projectNativeActivity([...live, replay, hook(4, "hook/completed", { startedAt: 50 }, "b"), hook(5, "hook/started", { startedAt: 10 }, null)], "t") ;
    expect(result.turns[0]?.entries[0]                                                                                                      ).toMatchObject({ status: "running", historical: false, at: live[1]?.at, endedAt: null }) ;
    expect(result.turns[1]?.entries[0]                                                                                                      ).toMatchObject({ status: "completed", id: "hook:t:b:handler" }                         ) ;
    expect(result.sessionEntries[0]                                                                                                         ).toMatchObject({ status: "running", id: "hook:t::handler" }                            ) ;
    expect(projectNativeActivity([...live, replay, hook(6, "hook/completed", { startedAt: 200, durationMs: 11 })], "t").turns[0]?.entries[0]).toMatchObject({ status: "completed", historical: false, durationMs: 11 }              ) ;
  });

  test("시작 시각이 불명확한 재수신은 완료된 행을 다시 열지 않는다", () => {
    for (const startedAt of [undefined, null, "invalid", NaN, 100]) {
      const before = [hook(1, "hook/started", { startedAt }), hook(2, "hook/completed", { startedAt, durationMs: 8 })] ;
      const replay = [...before, hook(3, "hook/started", { startedAt })]                                               ;
      expect(projectNativeActivity(before, "t").turns[0]?.entries[0]).toMatchObject({ status: "completed", durationMs: 8 });
      expect(projectNativeActivity(replay, "t").turns[0]?.entries).toEqual(projectNativeActivity(before, "t").turns[0]?.entries);
    }
    const current   = [hook(1, "hook/started", { startedAt: 100 }), hook(2, "hook/completed", { startedAt: 100 }), hook(3, "hook/started", { startedAt: 200 })] ;
    const ambiguous = [...current, hook(4, "hook/completed", { durationMs: 99 }), hook(5, "hook/started", {})]                                                  ;
    expect(projectNativeActivity(ambiguous, "t").turns[0]?.entries).toEqual(projectNativeActivity(current, "t").turns[0]?.entries);
    const ended = event(6, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } });
    expect(projectNativeActivity([...ambiguous, ended], "t").turns[0]?.entries[0]).toMatchObject({ status: "unknown", endedAt: ended.at });
  });
});

describe("계획·공개 진행 설명의 종료 경계", () => {
  test("종료·복원된 턴의 늦은 계획과 산문만 차단하고 후행 실행 결과는 보존한다", () => {
    for (const historical of [false, true]) {
      for (const status of ["completed", "failed", "interrupted"] as const) {
        const events = [started(1), event(2, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "종료 전 계획", status: "inProgress" }] }), item(3, "item/completed", { id: "msg", type: "agentMessage", phase: "commentary", text: "종료 전 설명" }), item(4, "item/started", { id: "cmd", type: "commandExecution", command: "printf result" }), event(5, "turn/completed", { threadId: "t", turn: { id: "a", status } }), started(6), event(7, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "늦은 계획", status: "inProgress" }] }), event(8, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "msg", phase: "commentary", delta: "늦은 조각" }), item(9, "item/completed", { id: "late", type: "agentMessage", phase: "commentary", text: "늦은 산문" }), item(10, "item/completed", { id: "cmd", type: "commandExecution", command: "printf result", exitCode: 0 }), item(11, "item/completed", { id: "answer", type: "agentMessage", phase: "final_answer", text: "최종 결과" })].map((row) => ({ ...row, historical })) ;
        const turn   = projectNativeActivity(events, "t").turns[0]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 ;
        expect(turn?.plan                                                                                  ).toEqual([{ step: "종료 전 계획", status: "inProgress" }]) ;
        expect(turn?.entries.filter((entry) => entry.kind === "progress").map((entry) => entry.description)).toEqual(["종료 전 설명"]                                ) ;
        expect(turn?.entries.find((entry) => entry.kind === "command")?.status                             ).toBe   ("completed"                                     ) ;
        expect(turn?.answer                                                                                ).toBe   ("최종 결과"                                     ) ;
        expect(turn?.status                                                                                ).toBe   (status                                          ) ;
        expect(turn?.historical                                                                            ).toBe   (historical                                      ) ;
        expect(turn?.endedSeq                                                                              ).toBe   (5                                               ) ;
      }
    }
  });
  test("다른 새 턴의 계획과 재사용된 메시지 ID는 이전 턴의 늦은 사건과 섞이지 않는다", () => {
    const events = [started(1), event(2, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "A 계획", status: "inProgress" }] }), item(3, "item/completed", { id: "shared", type: "agentMessage", phase: "commentary", text: "A 설명" }), event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), started(5, "b"), event(6, "turn/plan/updated", { threadId: "t", turnId: "b", plan: [{ step: "B 계획", status: "inProgress" }] }), item(7, "item/completed", { id: "shared", type: "agentMessage", phase: "commentary", text: "B 설명" }, "b"), event(8, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "늦은 A 계획", status: "inProgress" }] }), item(9, "item/completed", { id: "shared", type: "agentMessage", phase: "commentary", text: "늦은 A 설명" })] ;
    const turns  = projectNativeActivity(events, "t").turns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       ;
    expect(turns.map((turn) => turn.plan[0]?.step)).toEqual(["A 계획", "B 계획"]);
    expect(turns.map((turn) => turn.entries.find((entry) => entry.kind === "progress")?.description)).toEqual(["A 설명", "B 설명"]);
  });
  test("연결 종료도 계획·공개 산문의 경계이며 새 턴에는 전파하지 않는다", () => {
    const closed = [started(1), event(2, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "A 계획", status: "inProgress" }] }), item(3, "item/completed", { id: "msg", type: "agentMessage", phase: "commentary", text: "A 설명" }), event(4, "transport/closed", {}), event(5, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "늦은 계획", status: "inProgress" }] }), item(6, "item/completed", { id: "msg", type: "agentMessage", phase: "commentary", text: "늦은 설명" })] ;
    const turns  = projectNativeActivity([...closed, started(7, "b"), event(8, "turn/plan/updated", { threadId: "t", turnId: "b", plan: [{ step: "B 계획", status: "inProgress" }] }), item(9, "item/completed", { id: "msg", type: "agentMessage", phase: "commentary", text: "B 설명" }, "b")], "t").turns                                                                                                                                                                                                        ;
    expect(turns.map((turn) => turn.plan[0]?.step)).toEqual(["A 계획", "B 계획"]);
    expect(turns.map((turn) => turn.entries.find((entry) => entry.kind === "progress")?.description)).toEqual(["A 설명", "B 설명"]);
  });
  test("최초 종료 seq는 prefix의 Native 식별과 중복 종료 뒤에도 일치한다", () => {
    const completions = [
      { turn: { id: "a", status: "completed" } },
      { thread: { id: "t" }, turn: { id: "a", status: "completed" } },
      { turn: { threadId: "t", id: "a", status: "completed" } },
      { turnId: "a", turn: { status: "completed" } },
    ];
    for (const completion of completions) {
      const events = [started(1), event(2, "turn/completed", completion), event(3, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } })];
      expect(projectNativeActivity(events, "t").turns[0]?.endedSeq).toBe(2);
      expect(projectNativeActivity(events.map((row) => ({ ...row, historical: true })), "t").turns[0]?.endedSeq).toBe(2);
    }
    const ambiguous = [started(1), event(2, "turn/started", { threadId: "foreign", turn: { id: "a" } }), event(3, "turn/completed", { turn: { id: "a", status: "completed" } })];
    expect(projectNativeActivity(ambiguous, "t").turns[0]?.endedSeq).toBeNull();
    const futureCollision = [started(1), event(2, "turn/completed", { turn: { id: "a", status: "completed" } }), event(3, "turn/started", { threadId: "foreign", turn: { id: "a" } })];
    expect(projectNativeActivity(futureCollision, "t").turns[0]?.endedSeq).toBe(2);
  });
  test("승인 결과가 불확실한 턴도 연결 종료 seq 뒤 공개 진행을 갱신하지 않는다", () => {
    const request   : AppEvent = { ...event(4, "item/commandExecution/requestApproval", { threadId: "t", turnId: "a" }), kind: "request", requestId: 42 }                                                                                                                                                                                                                                                                       ;
    const uncertain : AppEvent = { ...event(5, "approval/uncertain", {}), requestId: 42 }                                                                                                                                                                                                                                                                                                                                       ;
    const events               = [started(1), event(2, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "A 계획", status: "inProgress" }] }), item(3, "item/completed", { id: "msg", type: "agentMessage", phase: "commentary", text: "처음" }), request, uncertain, event(6, "transport/closed", {}), item(7, "item/completed", { id: "msg", type: "agentMessage", phase: "commentary", text: "늦은 설명" })] ;
    const turn                 = projectNativeActivity(events, "t").turns[0]                                                                                                                                                                                                                                                                                                                                                    ;
    expect(turn?.status                                                         ).toBe("unknown") ;
    expect(turn?.endedSeq                                                       ).toBe(6        ) ;
    expect(turn?.entries.find((entry) => entry.kind === "progress")?.description).toBe("처음"   ) ;
  });
  test("확정된 Native 종료 상태와 시각은 교차 상태·동일 상태 재전달로 바뀌지 않는다", () => {
    for (const first of ["completed", "failed", "interrupted"] as const) {
      for (const duplicate of ["completed", "failed", "interrupted"] as const) {
        const events = [started(1), event(2, "turn/completed", { threadId: "t", turn: { id: "a", status: first } }), event(3, "turn/completed", { threadId: "t", turn: { id: "a", status: duplicate } })];
        for (const historical of [false, true]) {
          const turn = projectNativeActivity(events.map((row) => ({ ...row, historical })), "t").turns[0];
          expect(turn?.status  ).toBe(first        ) ;
          expect(turn?.endedAt ).toBe(events[1]?.at) ;
          expect(turn?.endedSeq).toBe(2            ) ;
        }
      }
    }
  });
  test("연결 종료·미확인 Native 완료는 뒤늦은 확정 결과로 정제할 수 있다", () => {
    for (const status of ["completed", "failed", "interrupted"] as const) {
      for (const unknown of [event(2, "transport/closed", {}), event(2, "turn/completed", { threadId: "t", turn: { id: "a", status: "unknown" } })]) {
        const terminal  = event(3, "turn/completed", { threadId: "t", turn: { id: "a", status } })                                               ;
        const duplicate = event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: status === "failed" ? "completed" : "failed" } }) ;
        const turn      = projectNativeActivity([started(1), unknown, terminal, duplicate], "t").turns[0]                                        ;
        expect(turn?.status  ).toBe(status     ) ;
        expect(turn?.endedAt ).toBe(terminal.at) ;
        expect(turn?.endedSeq).toBe(2          ) ;
      }
    }
  });
  test("클라이언트 startFailed를 Native의 확정 종료로 오인하지 않는다", () => {
    const terminal = event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } })                                                                                                                                                                                                                                                           ;
    const events   = [event(1, "turn/userPrompt", { threadId: "t", clientRequestId: "r", text: "요청" }), event(2, "turn/startFailed", { threadId: "t", clientRequestId: "r" }), event(3, "turn/startAccepted", { threadId: "t", turnId: "a", clientRequestId: "r" }), terminal, event(5, "turn/completed", { threadId: "t", turn: { id: "a", status: "failed" } })] ;
    const turn     = projectNativeActivity(events, "t").turns[0]                                                                                                                                                                                                                                                                                                     ;
    expect(turn?.status  ).toBe("completed") ;
    expect(turn?.endedAt ).toBe(terminal.at) ;
    expect(turn?.endedSeq).toBe(2          ) ;
  });
  test("불확실 승인 턴의 연결 종료 뒤 시작·승인·산문은 재활성화하지 않는다", () => {
    const request     : AppEvent = { ...event(4, "item/commandExecution/requestApproval", { threadId: "t", turnId: "a" }), kind: "request", requestId: 42 }                                                                                                                                                                                                                                                                                                                     ;
    const uncertain   : AppEvent = { ...event(5, "approval/uncertain", {}), requestId: 42 }                                                                                                                                                                                                                                                                                                                                                                                     ;
    const closed                 = event(6, "transport/closed", {})                                                                                                                                                                                                                                                                                                                                                                                                             ;
    const responded   : AppEvent = { ...event(8, "approval/responded", { decision: "accept" }), requestId: 42 }                                                                                                                                                                                                                                                                                                                                                                 ;
    const lateRequest : AppEvent = { ...event(9, "item/commandExecution/requestApproval", { threadId: "t", turnId: "a" }), kind: "request", requestId: 43 }                                                                                                                                                                                                                                                                                                                     ;
    const events                 = [started(1), event(2, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "A 계획", status: "inProgress" }] }), item(3, "item/completed", { id: "msg", type: "agentMessage", phase: "commentary", text: "처음" }), request, uncertain, closed, started(7), responded, lateRequest, item(10, "item/completed", { id: "msg", type: "agentMessage", phase: "commentary", text: "늦은 설명" }), event(11, "transport/closed", {})] ;
    const turn                   = projectNativeActivity(events, "t").turns[0]                                                                                                                                                                                                                                                                                                                                                                                                  ;
    expect(turn?.status                                                           ).toBe("unknown" ) ;
    expect(turn?.endedAt                                                          ).toBe(closed.at ) ;
    expect(turn?.endedSeq                                                         ).toBe(closed.seq) ;
    expect(turn?.lastActivityAt                                                   ).toBe(closed.at ) ;
    expect(turn?.entries.find((entry) => entry.kind === "progress")?.description  ).toBe("처음"    ) ;
    expect(turn?.entries.find((entry) => entry.id === "request:number:43")?.status).toBe("unknown" ) ;
  });
  test("완료 사건의 canonical 확정3종 외 값은 unknown이며 뒤늦은 확정으로 정제한다", () => {
    const unknownValues: unknown[] = ["inProgress", "running", "pending", "blocked", "declined", "stopped", "unknown", "other", null, undefined, 42];
    for (const rawStatus of unknownValues) {
      const uncertain = event(2, "turn/completed", { threadId: "t", turn: { id: "a", status: rawStatus } }) ;
      const before    = projectNativeActivity([started(1), uncertain], "t").turns[0]                        ;
      expect(before?.status  ).toBe("unknown"   ) ;
      expect(before?.endedAt ).toBe(uncertain.at) ;
      expect(before?.endedSeq).toBe(2           ) ;
      for (const status of ["completed", "failed", "interrupted"] as const) {
        const terminal  = event(3, "turn/completed", { threadId: "t", turn: { id: "a", status } })                                               ;
        const duplicate = event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: status === "failed" ? "completed" : "failed" } }) ;
        const turn      = projectNativeActivity([started(1), uncertain, terminal, duplicate], "t").turns[0]                                      ;
        expect(turn?.status  ).toBe(status     ) ;
        expect(turn?.endedAt ).toBe(terminal.at) ;
        expect(turn?.endedSeq).toBe(2          ) ;
      }
    }
  });
  test("모든 종료 생성 경로의 각 prefix에서 종료 시각과 비활성 상태가 정합하다", () => {
    const request      : AppEvent = { ...event(2, "item/commandExecution/requestApproval", { threadId: "t", turnId: "a" }), kind: "request", requestId: 42 } ;
    const uncertain    : AppEvent = { ...event(3, "approval/uncertain", {}), requestId: 42 }                                                                 ;
    const lateApproval : AppEvent = { ...event(8, "approval/responded", { decision: "accept" }), requestId: 42 }                                             ;
    const closers: AppEvent[][] = [
      [started(1), event(5, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } })],
      [started(1), event(5, "turn/completed", { threadId: "t", turn: { id: "a", status: "inProgress" } })],
      [started(1), event(5, "transport/closed", {})],
      [started(1), request, event(5, "transport/closed", {})],
      [started(1), request, uncertain, event(5, "transport/closed", {})],
      [event(1, "turn/userPrompt", { threadId: "t", clientRequestId: "r", text: "요청" }), event(5, "transport/closed", {}), event(6, "turn/startAccepted", { threadId: "t", turnId: "a", clientRequestId: "r" })],
      [event(1, "turn/userPrompt", { threadId: "t", clientRequestId: "r", text: "요청" }), event(5, "turn/startFailed", { threadId: "t", clientRequestId: "r" }), event(6, "turn/startAccepted", { threadId: "t", turnId: "a", clientRequestId: "r" })],
    ];
    for (const historical of [false, true]) {
      for (const before of closers) {
        const events = [...before, started(7), lateApproval, item(9, "item/completed", { id: "late", type: "agentMessage", phase: "commentary", text: "늦은 산문" }), started(10, "b")].map((row) => ({ ...row, historical }));
        for (let count = 1; count <= events.length; count++) {
          for (const turn of projectNativeActivity(events.slice(0, count), "t").turns) {
            if (turn.endedSeq !== null) expect(turn.endedAt).not.toBeNull();
            if (turn.endedAt !== null) expect(["running", "pending", "blocked"]).not.toContain(turn.status);
          }
        }
      }
    }
  });
});

describe("Native 원장 입력 정규화", () => {
  const root = "/projects/www";

  test("시작과 완료는 optional invocationId와 무관하게 같은 item/turn/resource/action을 전달한다", () => {
    const start = normalizeNativeResources(item(1, "item/started", {
      id: "cmd", type: "commandExecution", invocationId: "optional", command: "private command",
    }), root);
    const end = normalizeNativeResources(item(2, "item/completed", {
      id: "cmd", type: "commandExecution", exitCode: 0,
    }), root);
    expect(start).toEqual({ threadId: "t", gaps: [], observations: [{
      source: { kind: "item", itemId: "cmd", turnId: "a", nativeInvocationId: "optional" },
      resource: { kind: "tool", identity: "commandExecution", label: "명령 실행" },
      action: "invoke", status: "running",
    }] });
    expect(end).toEqual({ threadId: "t", gaps: [], observations: [{
      source: { kind: "item", itemId: "cmd", turnId: "a" },
      resource: { kind: "tool", identity: "commandExecution", label: "명령 실행" },
      action: "invoke", status: "completed",
    }] });
    const lateOptional = normalizeNativeResources(item(3, "item/completed", {
      id: "cmd", type: "commandExecution", invocationId: "late", exitCode: 0,
    }), root);
    expect(lateOptional.observations[0]?.source  )    .toEqual  ({ kind: "item", itemId: "cmd", turnId: "a", nativeInvocationId: "late" }) ;
    expect(lateOptional.observations[0]?.resource)    .toEqual  (end.observations[0]?.resource                                           ) ;
    expect(JSON.stringify(start)                 ).not.toContain("private command"                                                       ) ;
  });

  test("명시 thread/turn/item 누락을 다른 필드나 현재 대화로 추정하지 않는다", () => {
    for (const params of [
      { turnId: "a", thread: { id: "t" }, item: { id: "cmd", type: "commandExecution" } },
      { threadId: "t", turn: { id: "a" }, item: { id: "cmd", type: "commandExecution" } },
      { threadId: "t", turnId: "a", itemId: "cmd", item: { type: "commandExecution" } },
    ]) {
      const result = normalizeNativeResources(event(1, "item/started", params), root);
      expect(result.observations).toEqual([]                               ) ;
      expect(result.gaps        ).toEqual(["native-missing"]               ) ;
      expect(result.threadId    ).toBe   ("threadId" in params ? "t" : null) ;
    }
  });

  test("승인 RPC·거절·요청·카탈로그는 invoke가 아니며 명령 참조는 문서 읽기가 아니다", () => {
    const request: AppEvent = { ...item(1, "item/started", { id: "req", type: "commandExecution" }), kind: "request", requestId: 1 };
    const ignored = [request,
      item(2, "item/completed", { id: "declined", type: "commandExecution", status: "declined" }),
      item(3, "item/started", { id: "pending", type: "fileChange", status: "pending" }),
      item(4, "item/completed", { id: "user", type: "userMessage", content: [{ type: "skill", name: "www-build" }] }),
      item(5, "item/completed", { id: "catalog", type: "mcpToolCall", server: "codex", tool: "skills/list", status: "completed" }),
      item(6, "item/completed", { id: "hooks", type: "dynamicToolCall", tool: "hooks/list", success: true }),
      event(7, "skills/list", { threadId: "t", skills: [{ name: "www-build" }] }),
      event(8, "hooks/list", { threadId: "t", hooks: [{ name: "Stop" }] }),
      event(9, "item/commandExecution/requestApproval", { threadId: "t", turnId: "a", item: { id: "req", type: "commandExecution" } }),
    ];
    for (const input of ignored) expect(normalizeNativeResources(input, root).observations).toEqual([]);
    const reference = normalizeNativeResources(item(10, "item/completed", {
      id: "ref", type: "commandExecution", command: "cat skills/www/www-build/SKILL.md", exitCode: 0,
      commandActions: [{ type: "command_reference", path: "skills/www/www-build/SKILL.md" }],
    }), root);
    expect(reference.observations).toEqual([{
      source: { kind: "item", itemId: "ref", turnId: "a" },
      resource: { kind: "tool", identity: "commandExecution", label: "명령 실행" }, action: "invoke", status: "completed",
    }]);
  });

  test("실제 read metadata만 document/read로 만들며 Skill 호출로 승격하지 않는다", () => {
    const result = normalizeNativeResources(item(1, "item/completed", {
      id: "read", type: "commandExecution", cwd: root, exitCode: 0,
      commandActions: [
        { type: "read", path: "skills/www/www-build/SKILL.md" },
        { type: "read", path: "agents/www/AGENT.md" },
        { type: "read", path: "/private/secret/SKILL.md" },
        { type: "read", path: "src/main.ts" },
      ],
    }), root);
    expect(result.observations.filter((row) => row.action === "read")).toEqual([
      { source: { kind: "item", itemId: "read", turnId: "a" }, resource: { kind: "document", identity: "skills/www/www-build/SKILL.md", label: "www-build" }, action: "read", status: "completed" },
      { source: { kind: "item", itemId: "read", turnId: "a" }, resource: { kind: "document", identity: "agents/www/AGENT.md", label: "www-dev" }, action: "read", status: "completed" },
    ]);
    expect(result.gaps                                                     )    .toEqual  (["native-missing"]) ;
    expect(result.observations.some((row) => row.resource.kind === "skill"))    .toBe     (false             ) ;
    expect(JSON.stringify(result)                                          ).not.toContain("/private/secret" ) ;
    expect(JSON.stringify(result)                                          ).not.toContain("src/main.ts"     ) ;
  });

  test("서로 다른 비공개 문서는 실제 hash로 구별하고 같은 경로의 중복·재전달·복원 identity는 유지한다", () => {
    const paths   = ["/synthetic/private-alpha/SKILL.md", "/synthetic/private-beta/SKILL.md"]                                                                     ;
    const options = { documentIdentity: (path: string, cwd: string) => `document-sha256:${createHash("sha256").update(resolve(root, cwd, path)).digest("hex")}` } ;
    const fields = {
      id: "private-read", type: "commandExecution", cwd: root,
      command: "SYNTHETIC_PRIVATE_COMMAND", aggregatedOutput: "SYNTHETIC_PRIVATE_OUTPUT", reasoning: "SYNTHETIC_PRIVATE_REASONING",
      commandActions: [...paths, paths[0]].map((path) => ({ type: "read", path })),
    };
    const start      = normalizeNativeResources(item(1, "item/started", fields), root, options                                          ) ;
    const completed  = item                    (2, "item/completed", { ...fields, exitCode: 0 }                                         ) ;
    const end        = normalizeNativeResources(completed, root, options                                                                ) ;
    const redelivery = normalizeNativeResources({ ...completed, seq: 3 }, root, options                                                 ) ;
    const restored   = normalizeNativeResources({ ...completed, seq: 4, historical: true }, root, options                               ) ;
    const other      = normalizeNativeResources(item(5, "item/completed", { ...fields, id: "another-read", exitCode: 0 }), root, options) ;
    const reads      = end.observations.filter ((row) => row.action === "read"                                                          ) ;
    expect(reads).toEqual(paths.map((path) => ({
      source: { kind: "item", itemId: "private-read", turnId: "a" },
      resource: { kind: "document", identity: `document-sha256:${createHash("sha256").update(path).digest("hex")}`, label: "SKILL.md" },
      action: "read", status: "completed",
    })));
    expect(new Set(reads.map((row) => row.resource.identity)).size).toBe   (2                                                                                                         ) ;
    expect(start.observations                                     ).toEqual(end.observations.map((row) => ({ ...row, status: "running" }))                                            ) ;
    expect(redelivery                                             ).toEqual(end                                                                                                       ) ;
    expect(restored                                               ).toEqual(end                                                                                                       ) ;
    expect(other.observations                                     ).toEqual(end.observations.map((row) => ({ ...row, source: { kind: "item", itemId: "another-read", turnId: "a" } }))) ;
    const historicalStart = normalizeNativeResources({ ...item(6, "item/started", fields), historical: true }, root, options);
    expect(historicalStart.observations).toEqual(start.observations.map((row) => ({ ...row, status: "unknown" })));
    const failed = normalizeNativeResources(item(7, "item/completed", { ...fields, exitCode: 1 }), root, options);
    expect(failed.observations).toEqual(end.observations.map((row) => ({ ...row, status: "failed" })));
    const json = JSON.stringify([start, end, redelivery, restored, other, historicalStart, failed]);
    for (const value of [...paths, "SYNTHETIC_PRIVATE_COMMAND", "SYNTHETIC_PRIVATE_OUTPUT", "SYNTHETIC_PRIVATE_REASONING"]) expect(json).not.toContain(value);
    for (const result of [start, end, redelivery, restored, other, historicalStart, failed]) expect(result.gaps).toEqual([]);
  });

  test("상대 read는 실제 cwd로 구별하고 같은 문서의 상대·절대 표기와 빈 cwd는 정규화한다", () => {
    const calls: { path: string; cwd: string }[] = [];
    const options = { documentIdentity: (path: string, cwd: string) => {
      calls.push({ path, cwd });
      return `document-sha256:${createHash("sha256").update(resolve(root, cwd, path)).digest("hex")}`;
    } };
    const normalize = (cwd: string, paths: string[]) => normalizeNativeResources(item(1, "item/completed", {
      id: "cwd-read", type: "commandExecution", cwd, exitCode: 0,
      commandActions: paths.map((path) => ({ type: "read", path })),
    }), root, options);
    const alpha       = normalize("/synthetic/private-alpha", ["SKILL.md", "/synthetic/private-alpha/SKILL.md"]) ;
    const beta        = normalize("/synthetic/private-beta", ["SKILL.md"])                                       ;
    const fallback    = normalize("", ["SKILL.md", `${root}/SKILL.md`])                                          ;
    const relativeCwd = normalize("synthetic/private-alpha", ["SKILL.md"])                                       ;
    const results     = [alpha, beta, fallback, relativeCwd]                                                     ;
    const identities = results.map((result) => {
      const reads = result.observations.filter((row) => row.action === "read");
      expect(reads).toHaveLength(1);
      expect(result.gaps).toEqual([]);
      return reads[0]?.resource.identity;
    });
    expect(identities).toEqual([
      "/synthetic/private-alpha/SKILL.md", "/synthetic/private-beta/SKILL.md", `${root}/SKILL.md`, `${root}/synthetic/private-alpha/SKILL.md`,
    ].map((path) => `document-sha256:${createHash("sha256").update(path).digest("hex")}`));
    expect(identities[0]).not.toBe(identities[1]);
    expect(calls).toEqual([
      { path: "SKILL.md", cwd: "/synthetic/private-alpha" },
      { path: "/synthetic/private-alpha/SKILL.md", cwd: "/synthetic/private-alpha" },
      { path: "SKILL.md", cwd: "/synthetic/private-beta" },
      { path: "SKILL.md", cwd: root },
      { path: `${root}/SKILL.md`, cwd: root },
      { path: "SKILL.md", cwd: "synthetic/private-alpha" },
    ]);
    const json = JSON.stringify(results);
    for (const path of ["/synthetic/private-alpha", "/synthetic/private-beta", root, "synthetic/private-alpha"]) expect(json).not.toContain(path);
  });

  test("문서 identity 경계는 정본·명령 참조·일반 파일에 호출하지 않고 정본 path와 id를 유지한다", () => {
    const calls: string[] = [];
    const result = normalizeNativeResources(item(1, "item/completed", {
      id: "known-read", type: "commandExecution", cwd: root, exitCode: 0,
      command: "cat /synthetic/reference/SKILL.md",
      commandActions: [
        { type: "read", path: `${root}/skills/www/www-build/SKILL.md` },
        { type: "read", path: ".agents/skills/www-build/SKILL.md" },
        { type: "read", path: "agents/www/AGENT.md" },
        { type: "command_reference", path: "/synthetic/reference/SKILL.md" },
        { type: "read", path: "src/main.ts" },
      ],
    }), root, { documentIdentity: (path) => { calls.push(path); return "invalid"; } });
    expect(calls).toEqual([]);
    expect(result.gaps).toEqual([]);
    expect(result.observations.filter((row) => row.action === "read").map((row) => row.resource)).toEqual([
      { kind: "document", identity: "skills/www/www-build/SKILL.md", label: "www-build" },
      { kind: "document", identity: "agents/www/AGENT.md", label: "www-dev" },
    ]);
  });

  test("누락·잘못된 형식·길이·예외 identity는 원문 없이 native-missing으로 드러내고 생략한다", () => {
    const paths = ["/synthetic/missing-alpha/SKILL.md", "/synthetic/missing-beta/SKILL.md"];
    const input = item(1, "item/completed", {
      id: "missing-read", type: "commandExecution", exitCode: 0,
      commandActions: paths.map((path) => ({ type: "read", path })),
    });
    const invalid = ["", "SKILL.md", paths[0] ?? "", `document-sha256:${"a".repeat(63)}`, `document-sha256:${"a".repeat(65)}`,
      `document-sha256:${"A".repeat(64)}`, `document-sha256:${"z".repeat(64)}`, `document-sha256:${"a".repeat(64)}\n`, "x".repeat(4096)];
    const results = [normalizeNativeResources(input, root),
      ...invalid.map((identity) => normalizeNativeResources(input, root, { documentIdentity: () => identity })),
      normalizeNativeResources(input, root, { documentIdentity: () => { throw new Error(paths.join(" ")); } }),
    ];
    for (const result of results) {
      expect(result.gaps                          ).toEqual     (["native-missing"]) ;
      expect(result.observations                  ).toHaveLength(1                 ) ;
      expect(result.observations[0]?.resource.kind).toBe        ("tool"            ) ;
      for (const path of paths) expect(JSON.stringify(result)).not.toContain(path);
    }
  });

  test("실제 tool metadata만 남기며 command·출력·프롬프트·reasoning·payload를 유출하지 않는다", () => {
    const privateBody = "PRIVATE_BODY_DO_NOT_COPY";
    for (const type of ["commandExecution", "mcpToolCall", "dynamicToolCall", "collabAgentToolCall", "fileChange"]) {
      const result = normalizeNativeResources(item(1, "item/completed", {
        id: "exec", type, server: "docs", tool: "lookup", status: "completed",
        command: privateBody, aggregatedOutput: privateBody, prompt: privateBody,
        reasoning: privateBody, arguments: { secret: privateBody }, result: { content: privateBody },
        changes: [{ path: privateBody }], payload: privateBody,
      }), root);
      expect(result.observations           )    .toHaveLength(1                                            ) ;
      expect(result.observations[0]?.source)    .toEqual     ({ kind: "item", itemId: "exec", turnId: "a" }) ;
      expect(result.observations[0]?.status)    .toBe        ("completed"                                  ) ;
      expect(JSON.stringify(result)        ).not.toContain   (privateBody                                  ) ;
      if (type === "mcpToolCall") expect(result.observations[0]?.resource).toEqual({ kind: "tool", identity: '["mcpToolCall","docs","lookup"]', label: "docs/lookup" });
    }
    for (const fields of [{ tool: "lookup" }, { server: "docs" }, { server: "docs", tool: "private body\ntext" }]) {
      const result = normalizeNativeResources(item(2, "item/completed", { id: "bad", type: "mcpToolCall", ...fields }), root);
      expect(result.observations).toEqual([]);
      expect(result.gaps).toEqual(["native-missing"]);
    }
  });

  test("실패·미확인·복원 상태를 보존하며 완료 알림만으로 성공을 만들지 않는다", () => {
    const cases = [
      { type: "commandExecution", exitCode: 2 },
      { type: "commandExecution", status: "failed", exitCode: 0 },
      { type: "fileChange", status: "failed" },
      { type: "dynamicToolCall", tool: "lookup", success: false },
      { type: "mcpToolCall", server: "docs", tool: "lookup", error: { message: "private error" } },
    ];
    for (const fields of cases) {
      const result = normalizeNativeResources(item(1, "item/completed", { id: "fail", ...fields }), root);
      expect(result.observations[0]?.status).toBe("failed");
      expect(JSON.stringify(result)).not.toContain("private error");
    }
    for (const fields of [{ type: "commandExecution" }, { type: "fileChange" }, { type: "mcpToolCall", server: "docs", tool: "lookup" }]) {
      expect(normalizeNativeResources(item(1, "item/completed", { id: "unknown", ...fields }), root).observations[0]?.status).toBe("unknown");
    }
    expect(normalizeNativeResources(item(1, "item/started", { id: "failed-start", type: "fileChange", status: "failed" }), root).observations[0]?.status).toBe("failed");
    expect(normalizeNativeResources({ ...item(1, "item/started", { id: "old", type: "commandExecution" }), historical: true }, root).observations[0]?.status).toBe("unknown");
  });

  test("실제 Hook 핸들러 ID 재사용은 입력을 만들지 않으며 명시 thread에 unstable을 알린다", () => {
    const run = { id: "Stop:0:/private/hooks/stop.sh", executionMode: "sync", eventName: "Stop", status: "completed", entries: [{ text: "private hook body" }] };
    for (const turnId of [null, "a", "b"]) {
      for (const method of ["hook/started", "hook/completed"]) {
        const result = normalizeNativeResources(event(1, method, { threadId: "t", turnId, run }), root);
        expect(result                )    .toEqual  ({ threadId: "t", observations: [], gaps: ["unstable-id"] }) ;
        expect(JSON.stringify(result)).not.toContain("/private/hooks"                                          ) ;
        expect(JSON.stringify(result)).not.toContain("private hook body"                                       ) ;
      }
    }
    expect(normalizeNativeResources(event(2, "hook/completed", { turnId: "a", run }), root)).toEqual({ threadId: null, observations: [], gaps: ["native-missing"] });
  });

  test("유일성을 보증한 fixture namespace만 Hook을 받으며 null→명시 turn source를 보존한다", () => {
    const options = { providerRunNamespace: "fixture-unique-runs" }                                                                                           ;
    const run     = { id: "fixture-call-1", executionMode: "sync", eventName: "Stop", status: "running" }                                                     ;
    const start   = normalizeNativeResources(event(1, "hook/started", { threadId: "t", turnId: null, run }), root, options)                                   ;
    const end     = normalizeNativeResources(event(2, "hook/completed", { threadId: "t", turnId: "a", run: { ...run, status: "completed" } }), root, options) ;
    expect(start).toEqual({ threadId: "t", gaps: [], observations: [{
      source: { kind: "hook", hookRunId: "fixture-call-1", providerRunNamespace: "fixture-unique-runs", turnId: null },
      resource: { kind: "hook", identity: "Stop", label: "Stop" }, action: "invoke", status: "running",
    }] });
    expect(end).toEqual({ threadId: "t", gaps: [], observations: [{
      source: { kind: "hook", hookRunId: "fixture-call-1", providerRunNamespace: "fixture-unique-runs", turnId: "a" },
      resource: { kind: "hook", identity: "Stop", label: "Stop" }, action: "invoke", status: "completed",
    }] });
    expect(normalizeNativeResources(event(3, "hook/started", { run }), root, options)).toEqual({ threadId: null, observations: [], gaps: ["native-missing"] });
    const unknown = normalizeNativeResources(event(4, "hook/completed", { threadId: "t", run: { ...run, status: undefined } }), root, options);
    expect(unknown.observations[0]?.status).toBe("unknown");
  });
});

describe("실시간 Native 활동 투영", () => {
  test("누적 snapshot은 더하지 않고 이전 턴 기준과 차이만 계산한다", () => {
    const result = projectNativeActivity([
      configured, started(2), update(3, "a", 10, 4), update(4, "a", 15, 5),
      event(5, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }),
      started(6, "b"), update(7, "b", 22, 7),
    ]);
    expect(result.usage?.totalTokens                          ).toBe   (22          ) ;
    expect(result.turns.map((turn) => turn.usage?.totalTokens)).toEqual([15, 7]     ) ;
    expect(result.turns[0]?.lastRequestUsage?.totalTokens     ).toBe   (5           ) ;
    expect(result.turns[0]?.usageSeries                       ).toEqual([10, 15]    ) ;
    expect(result.turns[0]?.model?.basis                      ).toBe   ("configured") ;
  });

  test("baseline 없음, 절단, 감소, 잘못된 숫자는 턴 합계가 되지 않는다", () => {
    expect(projectNativeActivity([started(1), update(2, "a", 10)]).turns[0]?.usage).toBeNull();
    expect(projectNativeActivity([event(7, "thread/configured", { threadId: "t", isNew: true }), started(8), update(9, "a", 10)]).turns[0]?.usage).toBeNull();
    const reverse = projectNativeActivity([configured, started(2), update(3, "a", 10), update(4, "a", 8)]);
    expect(reverse.turns[0]?.usage).toBeNull();
    expect(reverse.turns[0]?.usageBasis).toBe("unavailable");
    const invalid = event(4, "thread/tokenUsage/updated", { threadId: "t", turnId: "a", tokenUsage: { total: tokens(-3), last: tokens(1) } });
    expect(projectNativeActivity([configured, started(2), invalid]).usage?.totalTokens).toBe(0);
  });

  test("seq 재생, 중복 item, 늦은 ACK는 턴과 답변을 중복 생성하지 않는다", () => {
    const request = event                (2, "turn/userPrompt", { threadId: "t", clientRequestId: "c", text: "<script>질문</script>" }) ;
    const answer  = item                 (4, "item/completed", { id: "answer", type: "agentMessage", text: "답변" }                   ) ;
    const ack     = event                (6, "turn/startAccepted", { threadId: "t", turnId: "a", clientRequestId: "c" }               ) ;
    const result  = projectNativeActivity([ack, answer, request, configured, started(3), answer, update(5, "a", 12)]                  ) ;
    expect(result.turns                       ).toHaveLength(1                      ) ;
    expect(result.turns[0]?.prompt            ).toBe        ("<script>질문</script>") ;
    expect(result.turns[0]?.entries           ).toHaveLength(1                      ) ;
    expect(result.turns[0]?.answer            ).toBe        ("답변"                 ) ;
    expect(result.turns[0]?.usage?.totalTokens).toBe        (12                     ) ;
  });

  test("후속 턴의 사용량은 늦은 이전 턴 snapshot에 귀속되지 않는다", () => {
    const result = projectNativeActivity([configured, started(2), update(3, "a", 10), event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), started(5, "b"), update(6, "b", 20), update(7, "a", 12, 2)]);
    expect(result.turns[0]?.lastRequestUsage?.totalTokens).toBe(2);
    expect(result.turns[1]?.usage).toBeNull();
    expect(result.usage?.totalTokens).toBe(20);
  });

  test("도구 종료 누락은 unknown이며 실패와 중단은 성공으로 바뀌지 않는다", () => {
    const result = projectNativeActivity([
      configured, started(2), item(3, "item/started", { id: "x", type: "commandExecution", command: "work" }),
      item(4, "item/completed", { id: "bad", type: "commandExecution", command: "bad", exitCode: 1 }),
      item(5, "item/completed", { id: "stop", type: "mcpToolCall", tool: "tool", status: "interrupted" }),
      event(6, "turn/completed", { turn: { id: "a", status: "completed" } }),
    ]);
    expect(result.turns[0]?.entries.map((row) => row.status)).toEqual(["unknown", "failed", "interrupted"]);
    expect(result.turns[0]?.status).toBe("completed");
  });

  test("Skill 이름 언급 대신 구조화 read의 성공과 실패를 구분한다", () => {
    const result = projectNativeActivity([
      configured, started(2),
      item(3, "item/completed", { id: "mention", type: "commandExecution", command: "echo skill SKILL.md", exitCode: 0 }),
      item(4, "item/completed", { id: "read", type: "commandExecution", command: "cat", exitCode: 0, commandActions: [{ type: "read", path: "/skills/demo/SKILL.md" }] }),
      item(5, "item/completed", { id: "bad", type: "commandExecution", exitCode: 1, commandActions: [{ type: "read", path: "/skills/bad/SKILL.md" }] }),
      item(6, "item/completed", { id: "failed-status", type: "commandExecution", status: "failed", exitCode: 0, commandActions: [{ type: "read", path: "/skills/failed/SKILL.md" }] }),
      item(7, "item/completed", { id: "user", type: "userMessage", content: [{ type: "skill", name: "demo", path: "/skills/demo" }] }),
      event(8, "skills/changed", {}),
    ]);
    const skills = result.turns[0]?.entries.filter((row) => row.kind === "skill");
    expect(skills?.map((row) => row.source)).toEqual(["file_read", "file_read", "file_read", "request"]);
    expect(skills?.map((row) => row.status)).toEqual(["completed", "failed", "failed", "pending"]);
  });

  test("선택 저장소의 전용 역할·스킬 읽기를 이름과 근거로 보존한다", () => {
    const root   = "/projects/www"                                                                                                                                                  ;
    const role   = item(3, "item/started", { id: "role", type: "commandExecution", cwd: root, commandActions: [{ type: "read", path: `${root}/agents/www/AGENT.md` }] })            ;
    const skill  = item(4, "item/started", { id: "skill", type: "commandExecution", cwd: root, commandActions: [{ type: "read", path: `${root}/skills/www/www-build/SKILL.md` }] }) ;
    const before = projectNativeActivity([configured, started(2), role, skill], "t", root)                                                                                          ;
    expect(before.turns[0]?.entries.find((row) => row.wwwArtifact?.id === "www-dev")).toMatchObject({ kind: "role", label: "www-dev 읽는 중", source: "file_read", status: "running" });
    const after = projectNativeActivity([configured, started(2), role, skill, item(5, "item/completed", { id: "role", type: "commandExecution", exitCode: 0 }), item(6, "item/completed", { id: "skill", type: "commandExecution", exitCode: 1 })], "t", root);
    expect(after.turns[0]?.entries.find((row) => row.wwwArtifact?.id === "www-dev")).toMatchObject({ label: "www-dev 읽기 확인", status: "completed" });
    expect(after.turns[0]?.entries.find((row) => row.wwwArtifact?.id === "www-build")).toMatchObject({ label: "www-build 읽기 실패", status: "failed" });
  });

  test("전용 문서 cat 참조는 구조화 읽기와 구별하고 완료 때 명령 상태만 갱신한다", () => {
    const root       = "/projects/www"                                                                                                                                                                                                  ;
    const read       = item(3, "item/started", { id: "multi", type: "commandExecution", cwd: root, command: "/bin/zsh -lc 'cat AGENTS.md agents/www/AGENT.md skills/www/www-verify/SKILL.md'", commandActions: [{ type: "unknown" }] }) ;
    const result     = projectNativeActivity([configured, started(2), read, item(4, "item/completed", { id: "multi", type: "commandExecution", exitCode: 0 })], "t", root)                                                              ;
    const references = result.turns[0]?.entries.filter((row) => row.source === "command_reference")                                                                                                                                     ;
    expect(references?.map((row) => row.wwwArtifact?.id)                                                      ).toEqual(["www-dev", "www-verify"]) ;
    expect(references?.every((row) => row.label.endsWith("읽기 명령 관측") && row.status === "completed")     ).toBe   (true                     ) ;
    expect(references?.every((row) => row.description?.includes("개별 문서 읽기·적용은 확인되지 않았습니다."))).toBe   (true                     ) ;
    expect(result.turns[0]?.entries.some((row) => row.source === "file_read")                                 ).toBe   (false                    ) ;
  });

  test("타 저장소 문서와 echo 언급은 WWW 사용으로 올리지 않고 구조화 읽기에는 중복 참조를 만들지 않는다", () => {
    const root = "/projects/www";
    const result = projectNativeActivity([
      configured, started(2),
      item(3, "item/completed", { id: "other", type: "commandExecution", cwd: root, command: "cat /other/agents/www/AGENT.md", commandActions: [{ type: "read", path: "/other/agents/www/AGENT.md" }], exitCode: 0 }),
      item(4, "item/completed", { id: "echo", type: "commandExecution", cwd: root, command: "echo www-build skills/www/www-build/SKILL.md", exitCode: 0 }),
      item(5, "item/completed", { id: "known", type: "commandExecution", cwd: root, command: "cat skills/www/www-build/SKILL.md", commandActions: [{ type: "read", path: "skills/www/www-build/SKILL.md" }], exitCode: 0 }),
    ], "t", root);
    const documents = result.turns[0]?.entries.filter((row) => row.wwwArtifact);
    expect(documents).toHaveLength(1);
    expect(documents?.[0]).toMatchObject({ source: "file_read", wwwArtifact: { id: "www-build" } });
  });

  test("thread 없는 Hook은 세션에만 두고 동기 run ID를 중복 억제한다", () => {
    const run = { id: "h", executionMode: "sync", eventName: "stop", status: "running", entries: [{ text: "비공개 내부 텍스트" }] };
    const result = projectNativeActivity([
      configured, started(2), event(3, "hook/started", { run }),
      event(4, "hook/completed", { run: { ...run, status: "blocked", durationMs: 8 } }),
      event(5, "hook/started", { threadId: "t", turnId: null, run: { ...run, id: "session" } }),
      event(6, "hook/started", { threadId: "t", turnId: "a", run: { ...run, id: "async", executionMode: "async" } }),
    ]);
    expect(result.sessionEntries               )    .toHaveLength(2                   ) ;
    expect(result.sessionEntries[0]?.status    )    .toBe        ("blocked"           ) ;
    expect(result.sessionEntries[0]?.durationMs)    .toBe        (8                   ) ;
    expect(result.turns[0]?.entries            )    .toHaveLength(0                   ) ;
    expect(JSON.stringify(result)              ).not.toContain   ("비공개 내부 텍스트") ;
  });

  test("reasoning 텍스트를 버리고 숫자와 공개 답변만 보존한다", () => {
    const result = projectNativeActivity([
      configured, started(2), item(3, "item/completed", { id: "r", type: "reasoning", text: "숨김", summary: ["숨김"] }),
      event(4, "item/reasoning/textDelta", { threadId: "t", turnId: "a", itemId: "r", delta: "숨김" }),
      item(5, "item/completed", { id: "analysis", type: "agentMessage", phase: "analysis", text: "숨김" }),
      item(6, "item/completed", { id: "final", type: "agentMessage", text: "공개" }),
    ]);
    expect(result.turns[0]?.answer).toBe("공개");
    expect(JSON.stringify(result)).not.toContain("숨김");
  });

  test("thread 격리, 모델 전환과 quota sparse merge를 보존한다", () => {
    const result = projectNativeActivity([
      configured, started(2), event(3, "turn/started", { threadId: "other", turn: { id: "a" } }),
      event(4, "model/rerouted", { threadId: "t", turnId: "a", toModel: "safe" }),
      event(5, "account/rateLimits/read", { rateLimitsByLimitId: { pro: { limitId: "pro", limitName: "Pro", normalModelSlug: "gpt", primary: { usedPercent: 35, windowDurationMins: 300 } } } }),
      event(6, "account/rateLimits/updated", { rateLimits: { limitId: "pro", primary: { usedPercent: 40 }, normalModelSlug: null } }),
    ], "t");
    expect(result.turns                                 ).toHaveLength(1                                                      ) ;
    expect(result.turns[0]?.model                       ).toEqual     ({ name: "safe", provider: "openai", basis: "rerouted" }) ;
    expect(result.limits[0]?.model                      ).toBe        ("gpt"                                                  ) ;
    expect(result.limits[0]?.primary?.usedPercent       ).toBe        (40                                                     ) ;
    expect(result.limits[0]?.primary?.windowDurationMins).toBe        (300                                                    ) ;
  });

  test("2,000건 경계를 넘긴 이력은 보존 범위를 명시하고 baseline을 재사용하지 않는다", () => {
    const filler = Array.from           ({ length: 2_001 }, (_, index) => event(index + 2, "irrelevant", {})) ;
    const result = projectNativeActivity([configured, ...filler, started(2_003), update(2_004, "a", 30)]    ) ;
    expect(result.historyTruncated).toBe(true);
    expect(result.turns[0]?.usage).toBeNull();
    expect(result.turns[0]?.model).toBeNull();
  });

  test("연결 종료는 진행 중 턴과 도구 타이머를 확정 종료한다", () => {
    const result = projectNativeActivity([configured, started(2), item(3, "item/started", { id: "x", type: "commandExecution" }), event(4, "transport/closed", {})]);
    expect(result.turns[0]?.status            ).toBe("unknown"             ) ;
    expect(result.turns[0]?.endedAt           ).toBe("2026-11-12T00:00:04Z") ;
    expect(result.turns[0]?.entries[0]?.status).toBe("unknown"             ) ;
  });

  test("승인 응답은 thread/turn 없는 requestId만으로 원래 턴을 재개한다", () => {
    const request: AppEvent = { ...event(3, "item/commandExecution/requestApproval", { threadId: "t", turnId: "a" }), kind: "request", requestId: 42 } ;
    const waiting           = projectNativeActivity([configured, started(2), request])                                                                 ;
    expect(waiting.turns[0]?.status).toBe("blocked");
    const responding: AppEvent = { ...event(4, "approval/responding", {}), requestId: 42 };
    expect(projectNativeActivity([configured, started(2), request, responding]).turns[0]?.status).toBe("blocked");
    const responded: AppEvent = { ...event(5, "approval/responded", { decision: "decline" }), requestId: 42 }   ;
    const resumed             = projectNativeActivity([configured, started(2), request, responding, responded]) ;
    expect(resumed.turns[0]?.status                 ).toBe("running"  ) ;
    expect(resumed.turns[0]?.entries[0]?.status     ).toBe("completed") ;
    expect(resumed.turns[0]?.entries[0]?.description).toBe("decline"  ) ;
    const uncertain: AppEvent = { ...event(4, "approval/uncertain", {}), requestId: 42 };
    expect(projectNativeActivity([configured, started(2), request, uncertain]).turns[0]?.status).toBe("unknown");
  });

  test("다른 턴의 승인은 개별 종료하며 미결 승인은 턴 실패와 구분한다", () => {
    const request   : AppEvent = { ...event(3, "item/fileChange/requestApproval", { threadId: "t", turnId: "a" }), kind: "request", requestId: "42" } ;
    const other     : AppEvent = { ...event(5, "item/fileChange/requestApproval", { threadId: "t", turnId: "b" }), kind: "request", requestId: 42 }   ;
    const responded : AppEvent = { ...event(6, "approval/responded", { decision: "accept" }), requestId: "42" }                                       ;
    const result               = projectNativeActivity([configured, started(2), request, started(4, "b"), other, responded])                          ;
    expect(result.turns.map((turn) => turn.status)).toEqual(["running", "blocked"]);
    const failed = event(7, "turn/completed", { threadId: "t", turn: { id: "b", status: "failed" } });
    expect(projectNativeActivity([configured, started(2), request, started(4, "b"), other, responded, failed]).turns[1]?.entries[0]?.status).toBe("failed");
    const completed = event(7, "turn/completed", { threadId: "t", turn: { id: "b", status: "completed" } });
    expect(projectNativeActivity([configured, started(2), request, started(4, "b"), other, responded, completed]).turns[1]?.entries[0]?.status).toBe("unknown");
  });

  test("세션 Hook도 선택한 thread와 전역 사건만 표시한다", () => {
    const run = { id: "h", executionMode: "sync", eventName: "sessionStart", status: "completed" };
    const result = projectNativeActivity([
      configured,
      event(2, "hook/completed", { threadId: "t", turnId: null, run }),
      event(3, "hook/completed", { threadId: "other", turnId: null, run }),
      event(4, "hook/completed", { run }),
    ], "t");
    expect(result.sessionEntries).toHaveLength(2);
    expect(result.sessionEntries.some((row) => row.id.includes("other"))).toBe(false);
  });


  test("구조화 SKILL.md 읽기는 시작부터 켜지고 같은 항목으로 완료한다", () => {
    const read    = item(3, "item/started", { id: "read-live", type: "commandExecution", commandActions: [{ type: "read", path: "/demo/SKILL.md" }] }) ;
    const running = projectNativeActivity([configured, started(2), read])                                                                              ;
    const active  = running.turns[0]?.entries.find((row) => row.source === "file_read")                                                                ;
    if (!active) throw new Error("읽는 중인 Skill 항목 없음");
    expect(active?.status).toBe("running");
    expect(active?.label).toBe("SKILL.md 읽는 중");
    const completed = item(4, "item/completed", { id: "read-live", type: "commandExecution", exitCode: 0 }) ;
    const finished  = projectNativeActivity([configured, started(2), read, completed])                      ;
    const observed  = finished.turns[0]?.entries.filter((row) => row.source === "file_read")                ;
    expect(observed             ).toHaveLength(1                   ) ;
    expect(observed?.[0]?.id    ).toBe        (active.id           ) ;
    expect(observed?.[0]?.status).toBe        ("completed"         ) ;
    expect(observed?.[0]?.label ).toBe        ("SKILL.md 읽기 확인") ;
    const lateStart = { ...read, seq: 5 }                                                                                                                     ;
    const replayed  = projectNativeActivity([configured, started(2), read, completed, lateStart]).turns[0]?.entries.find((row) => row.source === "file_read") ;
    expect(replayed?.label).toBe("SKILL.md 읽기 확인");
    expect(replayed?.endedAt).toBe(observed?.[0]?.endedAt);
    const failed = item(4, "item/completed", { id: "read-live", type: "commandExecution", exitCode: 2 });
    expect(projectNativeActivity([configured, started(2), read, failed]).turns[0]?.entries.find((row) => row.source === "file_read")?.label).toBe("SKILL.md 읽기 실패");
    const closed = event(4, "transport/closed", {});
    expect(projectNativeActivity([configured, started(2), read, closed]).turns[0]?.entries.find((row) => row.source === "file_read")?.label).toBe("SKILL.md 읽기 결과 미확인");
  });

  test("누적 감소 snapshot과 last는 실제 수신값으로 갱신하고 후속 기준은 재사용하지 않는다", () => {
    const completed = event                (5, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }) ;
    const result    = projectNativeActivity([configured, started(2), update(3, "a", 10), update(4, "a", 8, 3), completed] ) ;
    expect(result.usage?.totalTokens).toBe(8);
    expect(result.turns[0]?.lastRequestUsage?.totalTokens).toBe(3);
    expect(result.turns[0]?.usage).toBeNull();
    const next = projectNativeActivity([configured, started(2), update(3, "a", 10), update(4, "a", 8, 3), completed, started(6, "b"), update(7, "b", 12)]);
    expect(next.usage?.totalTokens).toBe(12);
    expect(next.turns[1]?.usage).toBeNull();
  });

  test("현재 턴 마지막 활동은 다른 턴의 늦은 사건으로 이동하지 않고 종료 뒤 고정된다", () => {
    const result = projectNativeActivity([
      configured, started(2),
      event(3, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }),
      started(4, "b"),
      event(5, "item/commandExecution/outputDelta", { threadId: "t", turnId: "b", itemId: "cmd", delta: "실행 중" }),
      item(6, "item/completed", { id: "late", type: "commandExecution", exitCode: 0 }),
    ]);
    expect(result.turns[0]?.lastActivityAt).toBe("2026-11-12T00:00:03Z");
    expect(result.turns[1]?.lastActivityAt).toBe("2026-11-12T00:00:05Z");
  });

  test("연결 상태는 명시적 transport 사건으로만 정하고 복원 상태도 반영한다", () => {
    expect(projectNativeActivity([configured, started(2)]).transport                                              ).toBe("disconnected") ;
    expect(projectNativeActivity([event(1, "transport/connected", {})]).transport                                 ).toBe("connected"   ) ;
    expect(projectNativeActivity([event(1, "transport/error", {})]).transport                                     ).toBe("disconnected") ;
    expect(projectNativeActivity([event(1, "transport/connected", {}), event(2, "transport/error", {})]).transport).toBe("connected"   ) ;
    for (const state of ["connected", "closed", "error", "disconnected"] as const) expect(projectNativeActivity([event(1, "transport/status", { state })]).transport).toBe(state);
    expect(projectNativeActivity([{ ...event(1, "transport/status", { state: "closed" }), historical: true }]).transport).toBe("closed");
  });

  test("복구 가능한 JSON 경고는 현재 턴과 명령을 종료하지 않는다", () => {
    const before  = [configured, started(2), item(3, "item/started", { id: "live", type: "commandExecution", command: "printf live" }), event(4, "transport/error", { message: "잘못된 JSON 한 줄" })] ;
    const running = projectNativeActivity(before)                                                                                                                                                      ;
    expect(running.transport                   ).toBe         ("disconnected"                      ) ;
    expect(running.protocolWarning?.message    ).toBe         ("잘못된 JSON 한 줄"                 ) ;
    expect(running.turns[0]                    ).toMatchObject({ status: "running", endedAt: null }) ;
    expect(running.turns[0]?.entries[0]?.status).toBe         ("running"                           ) ;
    const completed = projectNativeActivity([...before, item(5, "item/completed", { id: "live", type: "commandExecution", exitCode: 0 }), event(6, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } })]);
    expect(completed.turns[0]?.status            ).toBe   ("completed"            ) ;
    expect(completed.turns[0]?.entries[0]?.status).toBe   ("completed"            ) ;
    expect(completed.protocolWarning             ).toEqual(running.protocolWarning) ;
  });

  test("복원한 턴과 Hook은 실시간 활동으로 재생하지 않고 미종료 Hook을 미확인으로 둔다", () => {
    const result = projectNativeActivity([
      configured,
      { ...started(2), historical: true },
      { ...event(3, "hook/started", { run: { id: "old", executionMode: "sync", status: "running", eventName: "Stop" } }), historical: true },
    ]);
    expect(result.turns[0]?.historical         ).toBe(true     ) ;
    expect(result.turns[0]?.status             ).toBe("unknown") ;
    expect(result.sessionEntries[0]?.historical).toBe(true     ) ;
    expect(result.sessionEntries[0]?.status    ).toBe("unknown") ;
  });

  test("공개 진행 설명은 완료 전 누적하고 snapshot으로 대체하며 analysis는 노출하지 않는다", () => {
    const before = [configured, started(2), item(3, "item/started", { id: "p", type: "agentMessage", phase: "commentary" }), event(4, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "p", phase: "commentary", delta: "파일 확인 중" })];
    expect(projectNativeActivity(before).turns[0]?.entries[0]?.description).toBe("파일 확인 중");
    const result = projectNativeActivity([...before, item(5, "item/completed", { id: "p", type: "agentMessage", phase: "commentary", text: "파일을 확인했습니다." }), item(6, "item/completed", { id: "secret", type: "agentMessage", phase: "analysis", text: "숨김 원문" })]);
    expect(result.turns[0]?.entries                ).toHaveLength(1                     ) ;
    expect(result.turns[0]?.entries[0]?.kind       ).toBe        ("progress"            ) ;
    expect(result.turns[0]?.entries[0]?.description).toBe        ("파일을 확인했습니다.") ;
    expect(result.turns[0]?.entries[0]?.status     ).toBe        ("completed"           ) ;
    expect(result.turns[0]?.answer).toBeNull();
    expect(JSON.stringify(result)).not.toContain("숨김 원문");
  });

  test("공개 설명은 완료 snapshot을 정산하고 늦은 시작과 delta를 무시한다", () => {
    const delta       = (seq: number, id: string, value: string, turnId = "a") => event(seq, "item/agentMessage/delta", { threadId: "t", turnId, itemId: id, phase: "commentary", delta: value })         ;
    const snapshot    = (seq: number, method: string, id: string, value: Record<string, unknown>, turnId = "a") => item(seq, method, { id, type: "agentMessage", phase: "commentary", ...value }, turnId) ;
    const description = (events: AppEvent[], turn = 0, id = "p") => projectNativeActivity(events, "t").turns[turn]?.entries.find(row => row.id === `item:${id}`)?.description                             ;
    for (const historical of [false, true]) {
      const mark   = (events: AppEvent[]) => events.map(row => ({ ...row, historical }))                          ;
      const before = [started(1), delta(2, "p", "진행"), snapshot(3, "item/started", "p", { text: "늦은 시작" })] ;
      expect(description(mark(before))).toBe("진행");
      for (const completed of ["", "완료"]) {
        const done = [...before, snapshot(4, "item/completed", "p", { text: completed })];
        expect(description(mark(done))                                                                                ).toBe(completed  ) ;
        expect(description(mark([...done, delta(5, "p", "늦음"), snapshot(6, "item/started", "p", { text: "늦음" })]))).toBe(completed  ) ;
        expect(description(mark([...done, snapshot(5, "item/completed", "p", { text: "재정산" })]))                   ).toBe("재정산"   ) ;
        expect(description(mark([...done, delta(5, "q", "다른 항목")]), 0, "q")                                       ).toBe("다른 항목") ;
        expect(description(mark([...done, started(5, "b"), delta(6, "p", "새 턴", "b")]), 1)                          ).toBe("새 턴"    ) ;
      }
      expect(description(mark([...before, snapshot(4, "item/completed", "p", {})]))).toBe("진행");
    }
  });

  for (const boundary of ["completed", "failed", "interrupted", "inProgress", "missing", "EOF"]) for (const final of ["최종 설명", ""]) {
    test(`종료한 턴의 첫 정식 공개 설명 완료를 반영한다 — ${boundary}/${final ? "본문" : "빈 본문"}`, () => {
      const scope = { connectionGeneration: 7, processEpoch: "process", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 1 };
      function scoped(row: AppEvent) { return { ...row, ...scope }; }
      function snapshot(seq: number, id: string, text?: string) {
        return scoped(item(seq, "item/completed", { id, type: "agentMessage", phase: "commentary", text }));
      }
      const ended = boundary === "EOF" ? event(3, "transport/closed", {})
        : event(3, "turn/completed", { threadId: "t", turn: { id: "a", status: boundary === "missing" ? undefined : boundary } });
      const before = [scoped(started(1)), scoped(event(2, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "p", phase: "commentary", delta: "초안" })), scoped(ended)];
      const late = [
        { ...snapshot(4, "p", "다른 연결"), connectionGeneration: 8 },
        snapshot(5, "new", "종료 뒤 처음 본 설명"),
        snapshot(6, "p"),
        snapshot(7, "p", final),
        snapshot(8, "p", "두 번째 완료"),
        scoped(event(9, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "p", phase: "commentary", delta: "늦은 조각" })),
      ];
      const original = projectNativeActivity(before, "t").turns[0];
      const [settled] = projectNativeActivity([...before, ...late], "t").turns;
      expect(settled).toMatchObject({ endedAt: original?.endedAt, status: original?.status });

      expect(settled?.entries).toMatchObject([{ id: "item:p", description: final, status: "completed" }]);
    });
  }

  test("실시간 상태 미확인 종료 뒤 저장 이력은 다시 정지시키지 않는다", () => {
    const before = [
      started(1),
      event(2, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "p", phase: "commentary", delta: "초안" }),
      event(3, "turn/completed", { threadId: "t", turn: { id: "a" } }),
    ];
    const prior = projectNativeActivity(before, "t").turns[0];
    const [settled] = projectNativeActivity([
      ...before,
      { ...event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "unknown" } }), historical: true },
      started(5),
      item(6, "item/completed", { id: "p", type: "agentMessage", phase: "commentary", text: "최종 설명" }),
    ], "t").turns;
    expect(settled).toMatchObject({ endedAt: prior?.endedAt, status: "unknown" });

    expect(settled?.entries).toMatchObject([{ description: "최종 설명", status: "completed" }]);
  });

  test("빈 완료 snapshot은 누적된 공개 설명을 지운다", () => {
    const events = [started(1), event(2, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "p", phase: "commentary", delta: "진행" }), item(3, "item/completed", { id: "p", type: "agentMessage", phase: "commentary", text: "" })];
    expect(projectNativeActivity(events, "t").turns[0]?.entries[0]?.description).toBe("");
  });

  test("패널은 WWW 전용 흐름을 중심에 두고 일반 활동과 토큰은 보조 펼침으로 둔다", () => {
    const events = [configured, event(2, "transport/connected", {}), started(3), item(4, "item/completed", { id: "u", type: "userMessage", content: [{ type: "skill", name: "demo" }] })] ;
    const html   = renderToStaticMarkup(createElement(NativeActivityView, { events, threadId: "t" }))                                                                                     ;
    expect(html).toContain("현재 세션 모니터"     ) ;
    expect(html).toContain("Native 연결됨"        ) ;
    expect(html).toContain("WWW 개발 흐름"        ) ;
    expect(html).toContain("전용 에이전트"        ) ;
    expect(html).toContain("일반 Native 활동"     ) ;
    expect(html).toContain("요청됨"               ) ;
    expect(html).toContain("모델·토큰·계정 관측"  ) ;
    expect(html).toContain("공개 진행 설명 미제공") ;
  });

  test("복원된 진행 턴은 패널에서 실시간 점멸하지 않는다", () => {
    const html = renderToStaticMarkup(createElement(NativeActivityView, { events: [configured, { ...started(2), historical: true }], threadId: "t" }));
    expect(html).toContain("복원된 이력");
    expect(html).not.toContain('na-live-state na-live');
  });

  test("완전 복원 표식은 전역 seq 간격을 절단으로 오인하지 않고 불완전 복원은 알린다", () => {
    const complete = { ...event(20, "conversation/restored", { threadId: "t", complete: true }), historical: true };
    expect(projectNativeActivity([complete, started(21)]).historyTruncated).toBe(false);
    const incomplete = { ...complete, params: { threadId: "t", complete: false } };
    expect(projectNativeActivity([incomplete, started(21)]).historyTruncated).toBe(true);
    expect(projectNativeActivity([started(21)]).historyTruncated).toBe(true);
  });

  test("완전 복원 표식도 실제 2000건 보관 경계에서 제거되면 절단을 숨기지 않는다", () => {
    const complete = { ...event(20, "conversation/restored", { threadId: "t", complete: true }), historical: true } ;
    const after    = Array.from({ length: 2_000 }, (_, index) => event(21 + index, "irrelevant", {}))               ;
    expect(projectNativeActivity([complete, ...after]).historyTruncated).toBe(true);
  });

});


describe("현재 재개·후속 요청의 관측 경계", () => {
  test("미접수 후속 요청도 이전 턴의 늦은 usage로 기준값을 잃는다", () => {
    const events = [configured, started(2), update(3, "a", 100), event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), event(5, "turn/userPrompt", { threadId: "t", clientRequestId: "b", text: "새 요청" }), update(6, "a", 150), event(7, "turn/startAccepted", { threadId: "t", turnId: "b", clientRequestId: "b" }), started(8, "b"), update(9, "b", 200)];
    expect(projectNativeActivity(events, "t").turns.find(turn => turn.turnId === "b")?.usage).toBeNull();
  });
  test("복원의 추가 지시는 최초 질문 제목을 바꾸지 않는다", () => {
    const rows = restoreConversationEvents("t", [{ id: "a", status: "completed", items: [{ id: "u1", type: "userMessage", content: [{ type: "text", text: "최초 질문" }] }, { id: "u2", type: "userMessage", content: [{ type: "text", text: "추가 지시" }] }] }], true).map((row, index) => ({ ...row, seq: index + 1, at: `time-${index}` }));
    expect(projectNativeActivity(rows, "t").turns[0]).toMatchObject({ prompt: "최초 질문", title: "최초 질문" });
  });
  test("종료 턴의 늦은 Hook 시작은 실행 중을 만들지 않는다", () => {
    const rows = [started(1), event(2, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), event(3, "hook/started", { threadId: "t", turnId: "a", run: { id: "late", executionMode: "sync", eventName: "Stop", status: "running" } })];
    expect(projectNativeActivity(rows, "t").turns[0]?.entries.every(row => row.status !== "running")).toBe(true);
  });
  for (const phase of ["commentary", "final_answer"] as const) for (const boundary of ["current", "generation", "process", "session", "workspace", "selection", "EOF", "completed"] as const) test(`복원 ${phase} 재개는 ${boundary} 경계를 지킨다`, () => {
    const saved  = restoreConversationEvents("t", [{ id: "a", status: boundary === "completed" ? "completed" : "inProgress", items: [{ id: "p", type: "agentMessage", phase, text: "기존" }] }], true).map((row, index) => ({ ...row, seq: index + 1, at: `time-${index}`, connectionGeneration: 1, processEpoch: "p", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 1 })) ;
    const live   = { ...started(20), connectionGeneration: boundary === "generation" ? 2 : 1, processEpoch: boundary === "process" ? "other" : "p", sessionId: boundary === "session" ? "other" : "session", workspaceKey: boundary === "workspace" ? "other" : "workspace", selectionEpoch: boundary === "selection" ? 2 : 1 }                                                               ;
    const rows   = [...saved, ...(boundary === "EOF" ? [event(19, "transport/closed", {})] : []), live, { ...event(21, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "p", phase, delta: "추가" }), connectionGeneration: 1, processEpoch: "p", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 1 }]                                                       ;
    const result = projectNativeActivity(rows, "t").turns[0]                                                                                                                                                                                                                                                                                                                                  ;
    expect(result?.status).toBe(boundary === "current" ? "running" : boundary === "completed" ? "completed" : "unknown");
    expect(result?.entries.find(row => row.kind === (phase === "commentary" ? "progress" : "answer"))?.description).toBe(boundary === "current" ? "기존추가" : "기존");
  });
});

 test("완료 시각 있는 저장 답변은 같은 scope 재개에도 늦은 시작과 delta를 막는다", () => {
  for (const completedAtMs of [undefined, 100]) {
    const saved = restoreConversationEvents("t", [{ id: "a", status: "inProgress", items: [{ id: "answer", type: "agentMessage", text: "기존", ...(completedAtMs === undefined ? {} : { completedAtMs }) }] }], true).map((row, index) => ({ ...row, seq: index + 1, at: `time-${index}` })) ;
    const rows  = [...saved, started(20), item(21, "item/started", { id: "answer", type: "agentMessage", text: "늦은 시작" }), event(22, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "answer", delta: "추가" })]                                                        ;
    expect(projectNativeActivity(rows, "t").turns[0]?.answer).toBe(completedAtMs === undefined ? "기존추가" : "기존");
  }
 });
 test("답변 완료의 명시 empty는 지우고 누락 null invalid는 보존한다", () => {
  for (const value of [{}, { text: null }, { text: 1 }, { text: "" }, { text: "수정" }]) {
    const rows = [started(1), event(2, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "answer", delta: "기존" }), item(3, "item/completed", { id: "answer", type: "agentMessage", ...value }), event(4, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "answer", delta: "늦음" })];
    expect(projectNativeActivity(rows, "t").turns[0]?.answer).toBe(typeof value.text === "string" ? value.text : "기존");
  }
 });

for (const accepted of [false, true]) for (const field of ["same", "inputTokens", "outputTokens", "cachedInputTokens", "reasoningOutputTokens", "totalTokens", "cacheWriteInputTokens"] as const) test(`v6 F1 늦은 누적의 다음 턴 기준 오염: ${accepted}/${field}`, () => {
  const begin = (seq: number, id: string): AppEvent[] => accepted ? [event(seq, "turn/userPrompt", { threadId: "t", clientRequestId: id, text: id }), event(seq + 1, "turn/startAccepted", { threadId: "t", turnId: id, clientRequestId: id })] : [started(seq, id)]                                                                                                                                                                                                                                                                                    ;
  const base  = { ...tokens(100), cacheWriteInputTokens: 0 }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            ;
  const late  = field === "same" ? base : { ...base, [field]: base[field] + 50 }                                                                                                                                                                                                                                                                                                                                                                                                                                                                        ;
  const rows  = [configured, ...begin(2, "a"), event(4, "thread/tokenUsage/updated", { threadId: "t", turnId: "a", tokenUsage: { total: base, last: tokens(1) } }), event(5, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), ...begin(6, "b"), update(8, "b", 120), event(9, "thread/tokenUsage/updated", { threadId: "t", turnId: "a", tokenUsage: { total: late, last: tokens(1) } }), event(10, "turn/completed", { threadId: "t", turn: { id: "b", status: "completed" } }), ...begin(11, "c"), update(13, "c", 200)] ;
  expect(projectNativeActivity(rows, "t").turns.find(turn => turn.turnId === "c")?.usage?.totalTokens ?? null).toBe(field === "same" ? 80 : null);
  const recovery = [...rows.map(row => row.seq >= 10 ? { ...row, seq: row.seq + 1 } : row), update(10, "b", 180)];
  expect(projectNativeActivity(recovery, "t").turns.find(turn => turn.turnId === "c")?.usage?.totalTokens ?? null).toBe(field === "same" ? 20 : null);
  const fresh = [event(20, "thread/configured", { threadId: "fresh", isNew: true }), event(21, "turn/started", { threadId: "fresh", turn: { id: "new" } }), event(22, "thread/tokenUsage/updated", { threadId: "fresh", turnId: "new", tokenUsage: { total: tokens(10), last: tokens(1) } })];
  expect(projectNativeActivity([...rows, ...fresh], "fresh").turns.find(turn => turn.threadId === "fresh")?.usage?.totalTokens).toBe(10);
});
for (const phase of ["commentary", "final_answer"]) for (const when of ["before", "paused"]) for (const text of ["실제 완료", ""]) test(`v6 F7 실제 완료 사실은 재개로 해제되지 않는다: ${phase}/${when}/${text}`, () => {
  const saved     = restoreConversationEvents("t", [{ id: "a", status: "inProgress", items: [{ id: "A", type: "agentMessage", phase, text: "기존" }] }], true).map((row, index) => ({ ...row, seq: index + 1, at: `saved-${index}` })) ;
  const completed = item(10, "item/completed", { id: "A", type: "agentMessage", phase, text })                                                                                                                                         ;
  const before    = when === "before" ? [started(9), completed, { ...event(11, "turn/completed", { threadId: "t", turn: { id: "a", status: "unknown" } }), historical: true }] : [completed]                                           ;
  const rows      = [...saved, ...before, started(20), event(21, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase, delta: " 늦은 조각" })]                                                                  ;
  const result    = projectNativeActivity(rows, "t").turns[0]                                                                                                                                                                          ;
  expect(result?.entries.find(row => row.id === "item:A")?.description).toBe(phase === "commentary" && when === "paused" ? "기존" : text);
});
for (const field of ["connectionGeneration", "processEpoch", "sessionId", "workspaceKey", "selectionEpoch"] as const) test(`v6 F2 활동은 재개 뒤 다른 ${field} 변이를 거부한다`, () => {
  const scope   = { connectionGeneration: 7, processEpoch: "p", sessionId: "s", workspaceKey: "w", selectionEpoch: 1 }    ;
  const changed = field === "connectionGeneration" || field === "selectionEpoch" ? { [field]: 99 } : { [field]: "other" } ;
  for (const phase of ["commentary", "final_answer"]) for (const normalFirst of [false, true]) {
    const saved   = restoreConversationEvents("t", [{ id: "a", status: "inProgress", items: [{ id: "A", type: "agentMessage", phase, text: "기존" }] }], true).map((row, index) => ({ ...row, ...scope, seq: index + 1, at: `saved-${index}` }))                                                               ;
    const delta   = (seq: number, text: string) => ({ ...event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase, delta: text }), ...scope })                                                                                                                                   ;
    const rows    = [...saved, { ...started(20), ...scope }, ...(normalFirst ? [delta(21, " 정상")] : [])]                                                                                                                                                                                                     ;
    const before  = projectNativeActivity(rows, "t").turns[0]                                                                                                                                                                                                                                                  ;
    const foreign = [{ ...delta(22, " 타 scope"), ...changed }, { ...item(23, "item/completed", { id: "A", type: "agentMessage", phase, text: "타 scope 완료" }), ...scope, ...changed }, { ...event(24, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), ...scope, ...changed }] ;
    expect(projectNativeActivity([...rows, ...foreign], "t").turns[0]).toEqual(before);
    expect(projectNativeActivity([...rows, ...foreign, delta(25, " 이어서")], "t").turns[0]?.entries.find(row => row.id === "item:A")?.description).toBe("기존" + (normalFirst ? " 정상" : "") + " 이어서");
  }
});

test("v6 EOF 이후 연결 안내와 후행 unknown은 이전 턴을 다시 열지 않는다", () => {
  const saved = restoreConversationEvents("t", [{ id: "a", status: "inProgress", items: [{ id: "A", type: "agentMessage", phase: "commentary", text: "기존" }] }], true).map((row, index) => ({ ...row, seq: index + 1, at: `saved-${index}` }))                                                                                                        ;
  const rows  = [...saved, event(10, "transport/closed", {}), event(11, "transport/connected", {}), { ...event(12, "turn/completed", { threadId: "t", turn: { id: "a", status: "unknown" } }), historical: true }, started(13), event(14, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase: "commentary", delta: " 늦음" })] ;
  expect(projectNativeActivity(rows, "t").turns[0]?.entries.find(row => row.id === "item:A")?.description).toBe("기존");
});

for (const field of ["connectionGeneration", "processEpoch", "sessionId", "workspaceKey", "selectionEpoch"] as const) test(`v6 다른 ${field}의 명령·파일 변이와 완료도 현재 활동을 변경하지 않는다`, () => {
  const scope   = { connectionGeneration: 7, processEpoch: "p", sessionId: "s", workspaceKey: "w", selectionEpoch: 1 }    ;
  const changed = field === "connectionGeneration" || field === "selectionEpoch" ? { [field]: 99 } : { [field]: "other" } ;
  for (const type of ["commandExecution", "fileChange"]) {
    const value   = { id: "A", type, command: "기존 명령", status: "inProgress", changes: [{ path: "kept.ts" }] }                                                                                                                                                                                                                                   ;
    const saved   = restoreConversationEvents("t", [{ id: "a", status: "inProgress", items: [value] }], true).map((row, index) => ({ ...row, ...scope, seq: index + 1, at: `saved-${index}` }))                                                                                                                                                     ;
    const rows    = [...saved, { ...started(20), ...scope }, { ...item(21, "item/started", value), ...scope }]                                                                                                                                                                                                                                      ;
    const before  = projectNativeActivity(rows, "t").turns[0]                                                                                                                                                                                                                                                                                       ;
    const foreign = [{ ...item(22, "item/started", { ...value, command: "다른 scope 명령" }), ...scope, ...changed }, { ...item(23, "item/completed", { ...value, status: "completed", exitCode: 0 }), ...scope, ...changed }, { ...event(24, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), ...scope, ...changed }] ;
    expect(projectNativeActivity([...rows, ...foreign], "t").turns[0]).toEqual(before);
    const settled = [...rows, ...foreign, { ...event(25, "transport/closed", {}), ...scope }, { ...item(26, "item/completed", { ...value, status: "completed", exitCode: 0 }), ...scope }];
    expect(projectNativeActivity(settled, "t").turns[0]?.entries.find(row => row.id === "item:A")?.status).toBe("completed");
  }
});
