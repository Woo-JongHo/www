import { describe, expect, test } from "bun:test";
import { projectNativeActivity } from "../src/native-activity";
import type { AppEvent } from "../src/shared";

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
      item(6, "item/completed", { id: "user", type: "userMessage", content: [{ type: "skill", name: "demo", path: "/skills/demo" }] }),
      event(7, "skills/changed", {}),
    ]);
    const skills = result.turns[0]?.entries.filter((row) => row.kind === "skill");
    expect(skills?.map((row) => row.source)).toEqual(["file_read", "file_read", "request"]);
    expect(skills?.map((row) => row.status)).toEqual(["completed", "failed", "pending"]);
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

});
