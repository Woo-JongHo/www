/**
 * @verifies RESP-CHAT-MESSAGES-PROJECTION
 */
import { expect, test } from "bun:test";
import { executionResultCounts, project } from "../src/projection";
import { restoreConversationEvents } from "../src/conversations";
import type { AppEvent, ScopedAppEvent } from "../src/shared";
const event = (seq: number, method: string, params: unknown, extra: Partial<AppEvent> & { approvalToken?: string; connectionGeneration?: number; processEpoch?: string; sessionId?: string; workspaceKey?: string; selectionEpoch?: number } = {}): AppEvent => ({ seq, at: "2026-01-01T00:00:00Z", kind: "notification", method, params, ...extra });

test("결과 요약 집계는 명령과 파일의 실패·미확인을 함께 센다", () => {
  const blocks = project([
    event(1, "turn/started", { threadId: "t", turn: { id: "a" } }),
    event(2, "item/completed", { threadId: "t", turnId: "a", item: { id: "command", type: "commandExecution", command: "false", status: "completed", exitCode: 0 } }),
    event(3, "item/completed", { threadId: "t", turnId: "a", item: { id: "failed-file", type: "fileChange", status: "failed", changes: [] } }),
    event(4, "item/started", { threadId: "t", turnId: "a", item: { id: "unknown-file", type: "fileChange", changes: [] } })
  ]).blocks;
  expect(executionResultCounts(blocks)).toEqual({ commands: 1, files: 2, failed: 1, declined: 0, unresolved: 1 });
});

test("명시적 명령 거절과 턴 중단의 명령 결과 미확인을 구별한다", () => {
  for (const status of ["declined"]) {
    const result = project([event(1, "item/completed", { item: { id: "stop", type: "commandExecution", status, exitCode: -1 } })]);
    expect(result.blocks[0]).toMatchObject({ kind: "command", status });
  }
  const result = project([
    event(1, "turn/started", { threadId: "t", turn: { id: "a" } }),
    event(2, "item/started", { threadId: "t", turnId: "a", item: { id: "unfinished", type: "commandExecution" } }),
    event(3, "turn/completed", { threadId: "t", turn: { id: "a", status: "interrupted" } })
  ]);
  expect(result.blocks[0]).toMatchObject({ kind: "command", status: "unknown", turnInterrupted: true, running: false });
});

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
    event(6, "item/completed", { threadId: "thread-1", turnId: "turn-1", item: { id: "files", type: "fileChange", status: "completed", changes: [{ path: "a.ts" }] } }),
    event(7, "item/started", { threadId: "thread-1", turnId: "turn-1", item: { id: "files", type: "fileChange", status: "completed", changes: [{ path: "a.ts" }] } }),
    event(8, "item/completed", { threadId: "thread-1", turnId: "turn-1", item: { id: "files", type: "fileChange", status: "completed", changes: [{ path: "a.ts" }] } })
  ]);
  expect(result.blocks.filter((block) => block.kind === "command")).toHaveLength (1                                                                                                ) ;
  expect(result.blocks.filter((block) => block.kind === "files")  ).toHaveLength (1                                                                                                ) ;
  expect(result.blocks[0]                                         ).toMatchObject({ kind: "command", command: "printf", output: "완료 출력", status: "completed" }                 ) ;
  expect(result.blocks[1]                                         ).toMatchObject({ kind: "files", changes: [{ path: "a.ts", diff: null, truncated: false }], status: "completed" }) ;
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
    event(2, "item/commandExecution/requestApproval", { command: "rm x" }, { kind: "request", requestId: 0, supported: true, approvalToken: "zero" }),
    event(3, "approval/responding", { decision: "decline" }, { requestId: 0, approvalToken: "zero" }),
    event(4, "turn/interruptRequested", { turnId: "turn-1" }),
    event(5, "turn/interruptAcknowledged", { turnId: "turn-1" })
  ]);
  expect(result.blocks[0]).toMatchObject({ kind: "approval", requestId: 0, state: "responding", open: false });
  expect(result).toMatchObject({ turn: "running", working: true, interrupt: "accepted" });
});

test("중단 RPC 접수 뒤에도 실행 중인 턴은 중단 대기를 유지한다", () => {
  const events = [
    event(1, "turn/started", { turn: { id: "turn-1" } }),
    event(2, "turn/interruptRequested", { turnId: "turn-1" }),
    event(3, "turn/interruptAcknowledged", { turnId: "turn-1" })
  ];
  expect(project(events.slice(0, 2))).toMatchObject({ turn: "running", working: true, interrupt: "requested" });
  expect(project(events)).toMatchObject({ turn: "running", working: true, interrupt: "accepted" });
});

for (const status of ["interrupted", "completed", "failed", "unknown"]) {
  for (const accepted of [false, true]) {
    test(`중단 요청 뒤 ${status} 완료를 접수 응답 ${accepted ? "있음" : "없음"}과 구분한다`, () => {
      const events = [
        event(1, "turn/started", { turn: { id: "turn-1" } }),
        event(2, "turn/interruptRequested", { turnId: "turn-1" })
      ];
      if (accepted) events.push(event(3, "turn/interruptAcknowledged", { turnId: "turn-1" }));
      events.push(event(4, "turn/completed", { turn: { id: "turn-1", status } }));
      expect(project(events)).toMatchObject({
        turn      : status ,
        working   : false  ,
        interrupt : status === "interrupted" ? "acknowledged" : "uncertain"
      });
    });
  }

  test(`${status} 완료 뒤 늦은 중단 ACK는 최종 상태를 바꾸지 않는다`, () => {
    const events = [
      event(1, "turn/started", { turn: { id: "turn-1" } }),
      event(2, "turn/interruptRequested", { turnId: "turn-1" }),
      event(3, "turn/completed", { turn: { id: "turn-1", status } })
    ];
    const expected = { turn: status, working: false, interrupt: status === "interrupted" ? "acknowledged" : "uncertain" };
    expect(project(events)).toMatchObject(expected);
    events.push(event(4, "turn/interruptAcknowledged", { turnId: "turn-1" }));
    expect(project(events)).toMatchObject(expected);
  });
}

test("다른 턴의 중단 응답과 완료는 현재 턴의 중단 대기와 최종 상태를 바꾸지 않는다", () => {
  const events = [
    event(1, "turn/started", { threadId: "thread-1", turn: { id: "current" } }),
    event(2, "turn/interruptRequested", { threadId: "thread-1", turnId: "current" }),
    event(3, "turn/interruptAcknowledged", { threadId: "thread-1", turnId: "old" }),
    event(4, "turn/interruptUncertain", { threadId: "thread-1", turnId: "old" }),
    event(5, "turn/completed", { threadId: "thread-1", turn: { id: "old", status: "interrupted" } })
  ];
  expect(project(events)).toMatchObject({ turnId: "current", turn: "running", working: true, interrupt: "requested" });
  events.push(event(6, "turn/completed", { threadId: "thread-1", turn: { id: "current", status: "completed" } }));
  events.push(event(7, "turn/interruptAcknowledged", { threadId: "thread-1", turnId: "old" }));
  expect(project(events)).toMatchObject({ turnId: "current", turn: "completed", working: false, interrupt: "uncertain" });
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
  expect(result.blocks[0]).toMatchObject({ kind: "command", running: false, status: "completed", output: "앞", exitCode: 0 });
});

test("닫힌 턴이나 연결의 늦은 명령 시작·출력이 새 실행을 만들지 않는다", () => {
  for (const ending of ["completed", "interrupted", "closed"]) {
    const ended = ending === "closed"
      ? event(2, `transport/${ending}`, {})
      : event(2, "turn/completed", { threadId: "t", turn: { id: "a", status: ending } });
    const result = project([
      event(1, "turn/started", { threadId: "t", turn: { id: "a" } }), ended,
      event(3, "item/commandExecution/outputDelta", { threadId: "t", turnId: "a", itemId: "late", delta: "늦은 출력" }),
      event(4, "item/started", { threadId: "t", turnId: "a", item: { id: "late", type: "commandExecution", command: "late" } })
    ]);
    expect(result.blocks.filter((block) => block.kind === "command")).toEqual([]);
  }
});

test("복원된 종료 미확인 명령도 턴 중단의 맥락을 보존한다", () => {
  const result = project([
    event(1, "item/completed", { threadId: "t", turnId: "a", item: { id: "saved", type: "commandExecution", status: "unknown" } }, { historical: true }),
    event(2, "turn/completed", { threadId: "t", turn: { id: "a", status: "interrupted" } }, { historical: true })
  ]);
  expect(result.blocks[0]).toMatchObject({ kind: "command", status: "unknown", turnInterrupted: true, running: false });
});

test("복구 가능한 프로토콜 오류 뒤 새 턴의 명령은 같은 연결에서 계속 스트리밍한다", () => {
  const result = project([
    event(1, "transport/connected", {}),
    event(2, "turn/started", { threadId: "t", turn: { id: "old" } }),
    event(3, "transport/error", { message: "잘못된 JSON 한 줄" }),
    event(4, "turn/started", { threadId: "t", turn: { id: "new" } }),
    event(5, "item/started", { threadId: "t", turnId: "new", item: { id: "live", type: "commandExecution", command: "printf live" } }),
    event(6, "item/commandExecution/outputDelta", { threadId: "t", turnId: "new", itemId: "live", delta: "즉시 읽는 출력" })
  ]);
  expect(result.blocks[0]               ).toMatchObject({ kind: "command", turnId: "new", running: true, status: "running", output: "즉시 읽는 출력" }) ;
  expect(result.transport               ).toBe         ("connected"                                                                                   ) ;
  expect(result.protocolWarning?.message).toBe         ("잘못된 JSON 한 줄"                                                                           ) ;
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
  const request   = event(1, "turn/userPrompt", { threadId: "thread", clientRequestId: "request", text: "요청" }) ;
  const connected = event(2, "transport/connected", {}, { kind: "transport" }                                   ) ;
  const closed    = event(3, "transport/closed", {}, { kind: "transport" }                                      ) ;
  expect([
    project([request]).transport,
    project([request, connected]).transport,
    project([request, connected, closed]).transport
  ]).toEqual(["disconnected", "connected", "closed"]);
});

test("대화 복원용 transport 상태는 실제 연결 표시는 보존한다", () => {
  const restored = event(1, "transport/status", { state: "connected", connectionGeneration: 4 }, { kind: "transport" });
  expect(project([restored]).transport).toBe("connected");
});

for (const phase of ["requested", "accepted", "uncertain"] as const) {
  test(`중단 ${phase} 후 연결 종료는 성공이나 대기 고착으로 표시하지 않는다`, () => {
    const events = [event(1, "turn/started", { turn: { id: "t" } }), event(2, "turn/interruptRequested", { turnId: "t" })];
    if (phase === "accepted") events.push(event(3, "turn/interruptAcknowledged", { turnId: "t" }));
    if (phase === "uncertain") events.push(event(3, "turn/interruptUncertain", { turnId: "t" }));
    events.push(event(4, "transport/closed", {}), event(5, "turn/interruptAcknowledged", { turnId: "t" }));
    expect(project(events)).toMatchObject({ transport: "closed", turn: "unknown", working: false, interrupt: "uncertain" });
  });
}

for (const status of ["interrupted", "completed", "failed", "unknown"]) {
  test(`중단 전송 결과가 불확실해도 실제 ${status} 종료를 반영한다`, () => {
    const events = [
      event(1, "turn/started", { turn: { id: "t" } }),
      event(2, "turn/interruptRequested", { turnId: "t" }),
      event(3, "turn/interruptUncertain", { turnId: "t" }),
      event(4, "turn/completed", { turn: { id: "t", status } }),
      event(5, "turn/interruptUncertain", { turnId: "t" })
    ];
    expect(project(events)).toMatchObject({ turn: status, working: false, interrupt: status === "interrupted" ? "acknowledged" : "uncertain" });
  });
}

test("접수 뒤 중복 ACK와 늦은 요청은 종료 상태를 바꾸지 않는다", () => {
  const events = [event(1, "turn/started", { turn: { id: "t" } }), event(2, "turn/interruptRequested", { turnId: "t" }), event(3, "turn/interruptAcknowledged", { turnId: "t" })];
  events.push(event(4, "turn/interruptAcknowledged", { turnId: "t" }));
  expect(project(events)).toMatchObject({ interrupt: "accepted", working: true });
  events.push(event(5, "turn/completed", { turn: { id: "t", status: "interrupted" } }), event(6, "turn/interruptRequested", { turnId: "t" }));
  expect(project(events)).toMatchObject({ interrupt: "acknowledged", turn: "interrupted", working: false });
});

const summaryEvent = (seq: number, method: string, params: Record<string, unknown> = {}) =>
  event(seq, method, { threadId: "thread", turnId: "turn", itemId: "summary", ...params });
const summaryStart = event(1, "turn/started", { threadId: "thread", turn: { id: "turn" } });

test("공개 요약의 섹션·중복 seq·완료 snapshot과 commentary의 시간순을 보존한다", () => {
  const events = [
    summaryStart,
    summaryEvent(2, "item/started", { item: { id: "summary", type: "reasoning", summary: [], content: ["PRIVATE"] } }),
    summaryEvent(3, "item/reasoning/summaryPartAdded", { summaryIndex: 0 }),
    summaryEvent(4, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "먼저" }),
    summaryEvent(4, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "중복" }),
    summaryEvent(5, "item/agentMessage/delta", { itemId: "comment", phase: "commentary", delta: "확인했습니다." }),
    summaryEvent(6, "item/reasoning/summaryTextDelta", { summaryIndex: 1, delta: "다음" }),
    summaryEvent(7, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: " 확인" })
  ];
  expect(project(events.slice(0, 3)).blocks).toEqual([]);
  expect(project(events).blocks).toMatchObject([
    { kind: "explanation", source: "reasoningSummary", text: "먼저", streaming: true },
    { kind: "explanation", source: "commentary", text: "확인했습니다." },
    { kind: "explanation", source: "reasoningSummary", text: "다음", streaming: true },
    { kind: "explanation", source: "reasoningSummary", text: " 확인", streaming: true }
  ]);
  events.push(summaryEvent(8, "item/completed", { item: { id: "summary", type: "reasoning", summary: ["최종 첫 문단", "최종 다음 문단"], content: ["PRIVATE"] } }));
  events.push(summaryEvent(9, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "늦음" }));
  const completed = project(events);
  expect(completed.blocks.flatMap(block => block.kind === "explanation" && block.source === "reasoningSummary" ? [block.text] : []).join(""))    .toBe         ("최종 첫 문단\n\n최종 다음 문단"               ) ;
  expect(completed.blocks[1]                                                                                                                )    .toMatchObject({ source: "commentary", text: "확인했습니다." }) ;
  expect(completed.blocks.every(block => block.kind !== "explanation" || block.source !== "reasoningSummary" || !block.streaming)           )    .toBe         (true                                           ) ;
  expect(completed.protocolWarning?.message                                                                                                 )    .toContain    ("위치"                                         ) ;
  expect(JSON.stringify(project(events).blocks)                                                                                             ).not.toContain    ("PRIVATE"                                      ) ;
});

test("완료 snapshot만으로 요약을 표시하고 빈 authoritative snapshot은 기존 본문을 제거한다", () => {
  const events = [summaryEvent(1, "item/completed", { item: { id: "summary", type: "reasoning", summary: ["공개 요약"], content: "PRIVATE" } })];
  expect(project(events).blocks).toMatchObject([{ source: "reasoningSummary", text: "공개 요약", streaming: false }]);
  events.push(summaryEvent(2, "item/completed", { item: { id: "summary", type: "reasoning", summary: [] } }));
  expect(project(events).blocks).toEqual([]);
});

test("잘못된 summary와 index·raw reasoning·analysis에서 본문을 추출하지 않는다", () => {
  const events = [summaryStart] ;
  let seq      = 2              ;
  for (const summary of [undefined, "PRIVATE", ["공개처럼 보임", { text: "PRIVATE" }], [null], new Array(2)]) {
    events.push(summaryEvent(seq++, "item/completed", { item: { id: `bad-${seq}`, type: "reasoning", summary, text: "PRIVATE", content: ["PRIVATE"] } }));
  }
  for (const summaryIndex of [undefined, -1, 0.5, NaN, Infinity, "0", 1e12]) {
    events.push(summaryEvent(seq++, "item/reasoning/summaryTextDelta", { summaryIndex, delta: "PRIVATE" }));
    events.push(summaryEvent(seq++, "item/reasoning/summaryPartAdded", { summaryIndex }));
  }
  events.push(summaryEvent(seq++, "item/reasoning/textDelta", { delta: "PRIVATE" }));
  events.push(summaryEvent(seq++, "item/reasoning/summaryTextDelta", { summaryIndex: 0, phase: "analysis", delta: "PRIVATE" }));
  events.push(summaryEvent(seq++, "item/completed", { item: { id: "analysis", type: "agentMessage", phase: "analysis", text: "PRIVATE" } }));
  expect(project(events).blocks).toEqual([]);
});

test("thread·turn·item별 요약을 격리하고 늦은 이전 턴 델타를 무시한다", () => {
  const events = [summaryStart, summaryEvent(2, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "첫째" }),
    event(3, "turn/started", { threadId: "other", turn: { id: "turn" } }),
    summaryEvent(4, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "이전 턴 늦음" }),
    summaryEvent(5, "item/reasoning/summaryTextDelta", { threadId: "other", summaryIndex: 0, delta: "둘째" }),
    summaryEvent(6, "item/reasoning/summaryTextDelta", { threadId: "other", itemId: "another", summaryIndex: 0, delta: "별도 항목" })];
  expect(project(events).blocks).toMatchObject([
    { threadId : "thread" , text : "첫째"      , streaming : false },
    { threadId : "other"  , text : "둘째"      , streaming : true  },
    { threadId : "other"  , text : "별도 항목" , streaming : true  }
  ]);
});

for (const ending of ["completed", "interrupted", "failed", "EOF"]) {
  test(`${ending} 뒤 요약 스트리밍을 닫고 늦은 delta로 재시작하지 않는다`, () => {
    const events = [summaryStart, summaryEvent(2, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "진행" }),
      ending === "EOF" ? event(3, "transport/closed", {}) : summaryEvent(3, "turn/completed", { turn: { id: "turn", status: ending } }),
      summaryEvent(4, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "늦음" })];
    expect(project(events).blocks).toMatchObject([{ text: "진행", streaming: false }]);
  });
}

test("긴 요약은 섹션 구분자를 포함해 32768로 제한하고 절단 여부를 보존한다", () => {
  const events = [summaryStart, summaryEvent(2, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "가".repeat(32_767) }),
    summaryEvent(3, "item/reasoning/summaryTextDelta", { summaryIndex: 1, delta: "나".repeat(40_000) })];
  expect(project(events).blocks[0]).toMatchObject({ text: "가".repeat(32_767), summaryTruncated: true });
  events.push(summaryEvent(4, "item/completed", { item: { id: "summary", type: "reasoning", summary: ["나".repeat(40_000)] } }));
  expect(project(events).blocks[0]).toMatchObject({ text: "나".repeat(32_768), summaryTruncated: true, streaming: false });
});

test("정확한 scope 없는 요약을 버리고 같은 thread의 다음 turn을 분리한다", () => {
  const events = [summaryStart,
    event(2, "item/reasoning/summaryTextDelta", { itemId: "summary", summaryIndex: 0, delta: "scope 없음" }),
    summaryEvent(3, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "첫 턴" }),
    summaryEvent(4, "turn/startAccepted", { turnId: "next" }),
    summaryEvent(5, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "과거" }),
    summaryEvent(6, "item/reasoning/summaryTextDelta", { turnId: "next", summaryIndex: 0, delta: "다음 턴" })];
  expect(project(events).blocks).toMatchObject([{ text: "첫 턴", streaming: false }, { text: "다음 턴", streaming: true }]);
});

test("EOF 이후 재연결해도 닫힌 요약을 다시 열지 않으며 malformed 완료도 닫는다", () => {
  const events = [summaryStart, summaryEvent(2, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "공개" }),
    event(3, "transport/closed", {}), event(4, "transport/connected", {}),
    summaryEvent(5, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "늦음" })];
  expect(project(events).blocks).toMatchObject([{ text: "공개", streaming: false }]);
  const malformed = [summaryStart, summaryEvent(2, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "공개" }),
    summaryEvent(3, "item/completed", { item: { id: "summary", type: "reasoning", summary: "PRIVATE", content: "PRIVATE" } }),
    summaryEvent(4, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "늦음" })];
  expect(project(malformed).blocks).toMatchObject([{ text: "공개", streaming: false }]);
});


test("공개 본문이 아직 없던 턴도 EOF 재연결 뒤 늦은 요약을 시작하지 않는다", () => {
  const events = [summaryStart,
    summaryEvent(2, "item/started", { item: { id: "summary", type: "reasoning", summary: [] } }),
    event(3, "transport/closed", {}), event(4, "transport/connected", {}),
    summaryEvent(5, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "늦음" }),
    summaryEvent(6, "item/reasoning/delta", { phase: "commentary", delta: "PRIVATE" })];
  expect(project(events).blocks).toEqual([]);
});

test("늦은 시작과 델타가 완료 답변을 덮어쓰거나 다시 열지 않는다", () => {
  const events = [
    event(1, "turn/started", { turn: { id: "turn" } }),
    event(2, "item/agentMessage/delta", { itemId: "answer", delta: "완성된 답변" }),
    event(3, "item/started", { item: { id: "answer", type: "agentMessage", text: "앞부분" } })
  ];
  expect(project(events).blocks[0]).toMatchObject({ text: "완성된 답변", streaming: true });
  events.push(event(4, "item/completed", { item: { id: "answer", type: "agentMessage", text: "최종 답변" } }));
  events.push(event(5, "item/agentMessage/delta", { itemId: "answer", delta: "중복" }));
  events.push(event(6, "item/started", { item: { id: "answer", type: "agentMessage", text: "앞부분" } }));
  expect(project(events).blocks[0]).toMatchObject({ text: "최종 답변", streaming: false });
});

for (const ending of ["completed", "interrupted", "failed", "EOF"]) {
  test(`${ending} 뒤 늦은 공개 메시지를 표시하지 않고 완료 snapshot은 복원한다`, () => {
    const events = [event(1, "turn/started", { turn: { id: "turn" } }),
      event(2, "item/agentMessage/delta", { itemId: "answer", delta: "스트리밍" }),
      ending === "EOF" ? event(3, "transport/closed", {}) : event(3, "turn/completed", { turn: { id: "turn", status: ending } }),
      event(4, "item/agentMessage/delta", { itemId: "answer", delta: "늦음" }),
      event(5, "item/agentMessage/delta", { itemId: "another", delta: "늦은 새 항목" })];
    expect(project(events).blocks).toMatchObject([{ text: "스트리밍", streaming: false }]);
    expect(project(events).blocks).toHaveLength(1);
    events.push(event(6, "item/completed", { item: { id: "answer", type: "agentMessage", text: "최종 전체 본문" } }));
    expect(project(events).blocks[0]).toMatchObject({ text: "최종 전체 본문", streaming: false });
  });
}

test("긴 최종 답변과 공개 설명은 요약·명령의 32768 제한으로 잘리지 않는다", () => {
  const text = "가".repeat(40_000) + "\n마지막 문장";
  const events = [event(1, "turn/started", { turn: { id: "turn" } }),
    event(2, "item/agentMessage/delta", { itemId: "answer", delta: text }),
    event(3, "item/completed", { item: { id: "answer", type: "agentMessage", text } }),
    event(4, "item/completed", { item: { id: "comment", type: "agentMessage", phase: "commentary", text } })];
  expect(project(events).blocks.map((block) => "text" in block ? block.text : null)).toEqual([text, text]);
});

test("명령 경과 시간은 실제 시작·종료 수신 시각만 사용하고 중복 완료로 바뀌지 않는다", () => {
  const events = [
    event(1, "item/started", { item: { id: "cmd", type: "commandExecution", command: "true" } }, { at: "2026-01-01T00:00:01Z" }),
    event(2, "item/completed", { item: { id: "cmd", type: "commandExecution", exitCode: 0 } }, { at: "2026-01-01T00:00:04Z" }),
    event(3, "item/completed", { item: { id: "cmd", type: "commandExecution", exitCode: 0 } }, { at: "2026-01-01T00:00:09Z" })
  ];
  expect(project(events).blocks[0]).toMatchObject({ startedAt: Date.parse("2026-01-01T00:00:01Z"), endedAt: Date.parse("2026-01-01T00:00:04Z") });
  const restored = events.map((entry) => ({ ...entry, historical: true }));
  expect(project(restored).blocks[0]).toMatchObject({ startedAt: null, endedAt: null });
});

for (const ending of ["completed", "EOF"]) {
  test(`${ending} 뒤 종료 누락 명령의 경과 시간을 고정하고 성공으로 추정하지 않는다`, () => {
    const events = [event(1, "turn/started", { turn: { id: "turn" } }),
      event(2, "item/started", { item: { id: "cmd", type: "commandExecution", command: "wait" } }),
      ending === "EOF" ? event(3, "transport/closed", {}, { at: "2026-01-01T00:00:03Z" }) : event(3, "turn/completed", { turn: { id: "turn", status: ending } }, { at: "2026-01-01T00:00:03Z" })];
    expect(project(events).blocks[0]).toMatchObject({ running: false, status: "unknown", endedAt: Date.parse("2026-01-01T00:00:03Z") });
  });
}


test("동일 요약 섹션과 commentary가 교차해도 A/B/C/D 수신순을 지킨다", () => {
  const events = [summaryStart,
    summaryEvent(2, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "A" }),
    summaryEvent(3, "item/agentMessage/delta", { itemId: "comment", phase: "commentary", delta: "B" }),
    summaryEvent(4, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "C" }),
    summaryEvent(5, "item/agentMessage/delta", { itemId: "comment", phase: "commentary", delta: "D" })];
  expect(project(events).blocks.map((block) => "text" in block ? block.text : null)).toEqual(["A", "B", "C", "D"]);
});

test("재사용 승인 ID의 새 token만 최신 카드를 닫고 terminal은 보호한다", () => {
  const request  = (seq: number, approvalToken: string) => event(seq, "item/commandExecution/requestApproval", { threadId: "t" }, { kind: "request", requestId: 7, supported: true, approvalToken }) ;
  const response = (seq: number, approvalToken: string, method = "approval/responded") => event(seq, method, { threadId: "t" }, { requestId: 7, approvalToken })                                     ;
  const events   = [request(1, "old"), response(2, "old"), request(3, "new"), response(4, "old"), response(5, "new", "approval/responding")]                                                         ;
  expect(project(events).blocks).toMatchObject([{ state: "responded", open: false, approvalToken: "old" }, { state: "responding", open: false, approvalToken: "new" }]);
  events.push(response(6, "new"), response(7, "new", "approval/responding"));
  expect(project(events).blocks).toMatchObject([{ state: "responded" }, { state: "responded" }]);
});


const publicTexts = (events: readonly AppEvent[]) => project(events).blocks.flatMap((block) => "text" in block ? [block.text] : []);
const summaryDelta = (seq: number, delta: string, summaryIndex = 0, itemId = "summary") =>
  summaryEvent(seq, "item/reasoning/summaryTextDelta", { summaryIndex, itemId, delta });
const summarySnapshot = (seq: number, summary: unknown, method = "item/completed", id = "summary") =>
  summaryEvent(seq, method, { item: { id, type: "reasoning", summary, content: "PRIVATE" } });

test("연속 동일 섹션만 합치고 0/1/0·별도 항목은 수신순과 고유 replay ID를 보존한다", () => {
  const events = [summaryStart, summaryDelta(2, "A"), summaryDelta(3, "a"), summaryDelta(4, "B", 1),
    summaryDelta(5, "C"), summaryDelta(6, "D", 0, "other"), summaryDelta(7, "E")];
  expect(publicTexts(events)).toEqual(["Aa", "B", "C", "D", "E"]);
  const result = project(events);
  expect(new Set(result.blocks.map((block) => block.id)).size).toBe   (result.blocks.length) ;
  expect(project([...events, events[2]!])                    ).toEqual(result              ) ;
  expect(project(events)                                     ).toEqual(result              ) ;
  expect(project(events.slice(0, 2)).blocks[0]?.id           ).toBe   (result.blocks[0]?.id) ;
});

for (const snapshot of [[], [""], [" ", "\n\t"]]) {
  test(`빈·공백 snapshot ${JSON.stringify(snapshot)}은 해당 항목의 모든 fragment만 정리한다`, () => {
    const events = [summaryStart, summaryDelta(2, "A"), summaryDelta(3, "B", 0, "other"), summaryDelta(4, "C"), summarySnapshot(5, snapshot)];
    expect(publicTexts(events)).toEqual(["B"]);
  });
}

test("started·completed snapshot은 기존 fragment 위치를 유지하며 늦은 started는 무시한다", () => {
  const events = [summaryStart, summaryDelta(2, "A"), summaryDelta(3, "B", 0, "other"), summaryDelta(4, "C"),
    summarySnapshot(5, ["시작"], "item/started")];
  expect(publicTexts(events)).toEqual(["시", "B", "작"]);
  events.push(summaryDelta(6, "D", 0, "other"), summaryDelta(7, "E"), summarySnapshot(8, ["최종", "문단"]));
  expect(publicTexts(events)).toEqual(["최", "B", "종", "D", "\n\n문단"]);
  const final = project(events);
  events.push(summarySnapshot(9, ["늦은 시작"], "item/started"), summaryDelta(10, "늦음"));
  expect(project(events)).toEqual(final);
  events.push(summarySnapshot(11, ["최종", "문단"]));
  expect(publicTexts(events)).toEqual(["최", "B", "종", "D", "\n\n문단"]);
  expect(new Set(project(events).blocks.map((block) => block.id)).size).toBe(5);
});

test("malformed 완료는 항목의 모든 fragment를 닫고 raw fallback이나 늦은 시작을 허용하지 않는다", () => {
  const events = [summaryStart, summaryDelta(2, "A"), summaryDelta(3, "B", 0, "other"), summaryDelta(4, "C"),
    summarySnapshot(5, "PRIVATE"), summarySnapshot(6, ["늦은 시작"], "item/started"), summaryDelta(7, "늦음")];
  expect(project(events).blocks).toMatchObject([{ text: "A", streaming: false }, { text: "B", streaming: true }, { text: "C", streaming: false }]);
  expect(JSON.stringify(project(events))).not.toContain("PRIVATE");
});

for (const ending of ["turn/completed", "transport/closed"]) {
  test(`${ending} 뒤 요약 started는 무시하고 완료 snapshot만 복원한다`, () => {
    const events = [summaryStart, summaryDelta(2, "A"), event(3, ending, { threadId: "thread", turn: { id: "turn", status: "completed" } }),
      summarySnapshot(4, ["늦은 시작"], "item/started"), summaryDelta(5, "늦음")];
    expect(publicTexts(events)).toEqual(["A"]);
    events.push(summarySnapshot(6, ["복원"]));
    expect(project(events).blocks).toMatchObject([{ text: "복원", streaming: false }]);
  });
}

test("여러 fragment·섹션의 UTF16 총예산과 구분자 비용은 항목별로 유지한다", () => {
  const events = [summaryStart, summaryDelta(2, "😀".repeat(8_000)), summaryDelta(3, "별도", 0, "other"),
    summaryDelta(4, "나".repeat(16_765), 1), summaryDelta(5, "마지막", 0)];
  const result = project(events);
  expect(publicTexts(events)).toEqual(["😀".repeat(8_000), "별도", "나".repeat(16_765), "마"]);
  expect(result.blocks.filter((block) => block.kind === "explanation" && block.summaryTruncated)).toHaveLength(3);
  // 서로 다른 두 섹션의 문단 구분자 2도 같은 32768 예산에 포함한다.
  expect(publicTexts(events).filter((text) => text !== "별도").join("").length + 2).toBe(32_768);
  events.push(summaryDelta(6, "독립", 1, "other"));
  expect(publicTexts(events).at(-1)).toBe("독립");
});

for (const source of ["commentary", "publicPlan"]) {
  const delta    = (seq: number, text: string) => summaryEvent(seq, source === "publicPlan" ? "item/publicPlan/delta" : "item/agentMessage/delta", { itemId: "message", phase: source === "commentary" ? source : undefined, delta: text })             ;
  const snapshot = (seq: number, text: string, method = "item/completed") => summaryEvent(seq, method, { item: { id: "message", type: source === "publicPlan" ? source : "agentMessage", phase: source === "commentary" ? source : undefined, text } }) ;
  test(`${source}도 연속 delta만 합치고 정정 snapshot의 기존 시간 위치를 유지한다`, () => {
    const events = [summaryStart, delta(2, "A"), delta(3, "a"), summaryDelta(4, "B"), delta(5, "C")];
    expect(publicTexts(events)).toEqual(["Aa", "B", "C"]);
    const before = project(events);
    expect(new Set(before.blocks.map((block) => block.id)).size).toBe(3);
    expect(project(events)).toEqual(before);
    events.push(snapshot(6, "완료"), delta(7, "늦음"), snapshot(8, "늦은 시작", "item/started"));
    expect(project(events).blocks).toMatchObject([{ text: "완료", streaming: false, source }, { text: "B" }]);
    expect(project(events).protocolWarning?.message).toContain("위치");
    events.push(snapshot(9, "완료"));
    expect(publicTexts(events)).toEqual(["완료", "B"]);
    events.push(snapshot(10, "   "));
    expect(publicTexts(events)).toEqual(["B"]);
  });
  for (const ending of ["turn/completed", "transport/closed"]) {
    test(`${source}는 ${ending} 뒤 delta를 재개하지 않고 snapshot만 복원한다`, () => {
      const events = [summaryStart, delta(2, "A"), event(3, ending, { threadId: "thread", turn: { id: "turn", status: "completed" } }), delta(4, "늦음"), snapshot(5, "늦은 시작", "item/started")];
      expect(project(events).blocks).toMatchObject([{ text: "A", streaming: false }]);
      events.push(snapshot(6, "복원"));
      expect(project(events).blocks).toMatchObject([{ text: "복원", streaming: false }]);
    });
  }
}

test("공개 메시지의 명시적 phase·type 전환은 이전 fragment를 혼합하지 않는다", () => {
  const events = [summaryStart,
    summaryEvent(2, "item/agentMessage/delta", { itemId: "m", phase: "commentary", delta: "설명" }), summaryDelta(3, "요약"),
    summaryEvent(4, "item/agentMessage/delta", { itemId: "m", phase: "commentary", delta: "설명2" }),
    summaryEvent(5, "item/started", { item: { id: "m", type: "publicPlan", text: "계획" } })];
  expect(publicTexts(events)).toEqual(["요약", "계획"]);
  events.push(summaryEvent(6, "item/agentMessage/delta", { itemId: "m", phase: "final_answer", delta: "답변" }));
  expect(project(events).blocks).toMatchObject([{ source: "reasoningSummary", text: "요약" }, { kind: "answer", text: "답변" }]);
});

const approvalRequest = (seq: number, approvalToken: string | undefined, requestId: string | number = 7, threadId = "t", connectionGeneration = 1, processEpoch = "process") =>
  event(seq, "item/commandExecution/requestApproval", { threadId }, { kind: "request", requestId, supported: true, approvalToken, connectionGeneration, processEpoch });
const approvalNotification = (seq: number, approvalToken: string | undefined, requestId: string | number = 7, threadId = "t", connectionGeneration = 1, processEpoch = "process", method = "approval/responded") =>
  event(seq, method, { threadId }, { requestId, approvalToken, connectionGeneration, processEpoch });

for (const scope of [{ generation: 2, process: "process" }, { generation: 1, process: "new-process" }]) {
  test(`승인 ID 재사용은 연결 ${scope.generation}/${scope.process}와 token을 교차검증한다`, () => {
    const events = [approvalRequest(1, "old"), approvalNotification(2, "old"), approvalRequest(3, "new", 7, "t", scope.generation, scope.process),
      approvalNotification(4, "old"), approvalNotification(5, "new", 7, "t", 99), approvalNotification(6, "new", 7, "t", scope.generation, "stale")];
    expect(project(events).blocks).toMatchObject([{ state: "responded" }, { state: "open", open: true }]);
    events.push(approvalNotification(7, "new", 7, "t", scope.generation, scope.process));
    expect(project(events).blocks).toMatchObject([{ state: "responded" }, { state: "responded", open: false }]);
  });
}

test("같은 승인 ID의 다른 thread·숫자문자·unsupported 카드와 위조 params token을 격리한다", () => {
  const events = [approvalRequest(1, "a"), approvalRequest(2, "b", 7, "other"), approvalRequest(3, "c", "7"),
    event(4, "item/commandExecution/requestApproval", { threadId: "t", duplicateRequestId: true }, { kind: "request", requestId: 7, supported: false, approvalToken: "a" }),
    approvalNotification(5, "a", 7, "other"), approvalNotification(6, "a", "7"),
    event(7, "approval/responded", { threadId: "t", approvalToken: "a" }, { requestId: 7 })];
  expect(project(events).blocks).toMatchObject([{ state: "open", open: true }, { state: "open", open: true }, { state: "open", open: true }, { state: "open", open: false }]);
  events.push(approvalNotification(8, "a"), approvalNotification(9, "c", "7"), approvalNotification(10, "b", 7, "other"));
  expect(project(events).blocks).toMatchObject([{ state: "responded" }, { state: "responded" }, { state: "responded" }, { state: "open", open: false }]);
});

test("identity 없는 legacy는 클릭 불가이며 scoped/token 카드에는 대응하지 않는다", () => {
  const legacy = event(1, "item/commandExecution/requestApproval", { threadId: "t", approvalToken: "위조" }, { kind: "request", requestId: 7, supported: true });
  expect(project([legacy]).blocks                                                                      ).toMatchObject([{ approvalToken: null, state: "open", open: false }]) ;
  expect(project([legacy, event(2, "approval/responding", { threadId: "t" }, { requestId: 7 })]).blocks).toMatchObject([{ state: "open", open: false }]                     ) ;
  expect(project([legacy, event(2, "approval/responded", { threadId: "t" }, { requestId: 7 })]).blocks ).toMatchObject([{ state: "responded", open: false }]                ) ;
  const events = [approvalRequest(1, "token"), event(2, "approval/responded", { threadId: "t" }, { requestId: 7 })];
  expect(project(events).blocks).toMatchObject([{ state: "open", open: true }]);
  const noToken = [approvalRequest(1, undefined), event(2, "approval/responded", { threadId: "t" }, { requestId: 7 })];
  expect(project(noToken).blocks).toMatchObject([{ approvalToken: null, state: "open", open: false }]);
});

test("정확한 token은 선택적 scope가 없어도 대응하고 uncertain 뒤 중복 responding은 퇴행하지 않는다", () => {
  const events = [approvalRequest(1, "token"), event(2, "approval/uncertain", { threadId: "t" }, { requestId: 7, approvalToken: "token" }),
    event(3, "approval/responding", { threadId: "t" }, { requestId: 7, approvalToken: "token" })];
  expect(project(events).blocks).toMatchObject([{ state: "uncertain", open: false }]);
  events.push(event(4, "approval/responded", { threadId: "t" }, { requestId: 7, approvalToken: "token" }), event(5, "approval/uncertain", { threadId: "t" }, { requestId: 7, approvalToken: "token" }));
  expect(project(events).blocks).toMatchObject([{ state: "responded", open: false }]);
});


test("명시적 agentMessage 타입은 publicPlan에서 최종 답변으로 전환한다", () => {
  const events = [summaryStart,
    summaryEvent(2, "item/publicPlan/delta", { itemId: "m", delta: "계획" }),
    summaryEvent(3, "item/completed", { item: { id: "m", type: "agentMessage", text: "답변" } })];
  expect(project(events).blocks).toMatchObject([{ kind: "answer", text: "답변", streaming: false }]);
});

test("token이 있는 알림은 명시 thread만 교차검증하고 현재 대화 fallback에 오연결하지 않는다", () => {
  const events = [approvalRequest(1, "token"), event(2, "turn/started", { threadId: "other", turn: { id: "turn" } }),
    event(3, "approval/responded", {}, { requestId: 7, approvalToken: "token" })];
  expect(project(events).blocks).toMatchObject([{ threadId: "t", state: "responded", open: false }]);
});

test('Steer는 같은 턴 Working을 보존하며 ID가 다른 동일 원문을 각각 표시한다', () => {
  const events = [event(1,'transport/connected',{}),event(2,'turn/started',{threadId:'t',turn:{id:'a'}})]                                                                            ;
  const steer  = (seq:number, method:string, id:string) => event(seq,method,{threadId:'t',turnId:'a',clientUserMessageId:id,text:'  같은 추가 지시  '})                              ;
  const result = project([...events,steer(3,'turn/steerPending','one'),steer(4,'turn/steerAccepted','one'),steer(5,'turn/steerPending','two'),steer(6,'turn/steerUncertain','two')]) ;
  expect(result).toMatchObject({turnId:'a',turn:'running',working:true});
  expect(result.blocks.filter(block=>block.kind==='user')).toMatchObject([{text:'  같은 추가 지시  ',steerStatus:'accepted'},{text:'  같은 추가 지시  ',steerStatus:'uncertain'}]);
});

test('Native 명시 client ID와 범위만 추가 지시 행에 합치고 item ID나 동일본문은 추정하지 않는다', () => {
  const events = [event(1,'turn/started',{threadId:'t',turn:{id:'a'}}),event(2,'turn/steerPending',{threadId:'t',turnId:'a',clientUserMessageId:'one',text:'추가'})]   ;
  const wrong  = project([...events,event(3,'item/completed',{threadId:'other',turnId:'a',item:{id:'one',clientUserMessageId:'one',type:'userMessage',text:'추가'}})]) ;
  expect(wrong.blocks[0]).toMatchObject({steerStatus:'pending'});
  const right = project([...events,event(3,'item/completed',{threadId:'t',turnId:'a',item:{id:'native-id',clientId:'one',type:'userMessage',text:'추가'}})]);
  expect(right.blocks.filter(block=>block.kind==='user')).toMatchObject([{steerStatus:'pending',nativeItemId:'native-id'}]);
  const accepted = project([...events,event(3,'item/completed',{threadId:'t',turnId:'a',item:{id:'native-id',clientId:'one',type:'userMessage',text:'추가'}}),event(4,'turn/steerAccepted',{threadId:'t',turnId:'a',clientUserMessageId:'one',text:'추가'})]);
  expect(accepted.blocks.filter(block=>block.kind==='user')).toMatchObject([{steerStatus:'accepted',nativeItemId:'native-id'}]);
});


test("복원 unknown snapshot은 같은 scope의 실제 live 시작 뒤 델타를 다시 표시한다", () => {
  const restored = restoreConversationEvents("thread", [{ id: "turn", status: "inProgress", items: [{ id: "answer", type: "agentMessage", text: "기존" }] }], true).map((entry, index) => ({ ...entry, seq: index + 1, at: "2026-01-01T00:00:00Z" }));
  expect(project(restored)).toMatchObject({ working: false, turn: "unknown" });
  const live = [event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }), event(21, "item/agentMessage/delta", { threadId: "thread", turnId: "turn", itemId: "answer", delta: "추가" })];
  expect(project([...restored, ...live]).blocks).toMatchObject([{ kind: "answer", text: "기존추가", streaming: true }]);
});

test("정식 완료의 명시 빈 답변·명령 출력·변경 목록은 기존 snapshot을 지운다", () => {
  const item = (seq: number, value: unknown) => event(seq, "item/completed", { threadId: "thread", turnId: "turn", item: value });
  const result = project([event(1, "turn/started", { threadId: "thread", turn: { id: "turn" } }),
    item(2, { id: "answer", type: "agentMessage", text: "기존" }), item(3, { id: "answer", type: "agentMessage", text: "" }),
    item(4, { id: "command", type: "commandExecution", aggregatedOutput: "이전 출력", status: "completed" }), item(5, { id: "command", type: "commandExecution", aggregatedOutput: "", status: "completed" }),
    item(6, { id: "files", type: "fileChange", changes: [{ path: "old.ts", diff: "이전" }], status: "completed" }), item(7, { id: "files", type: "fileChange", changes: [], status: "completed" })]);
  expect(result.blocks).toMatchObject([{ kind: "answer", text: "" }, { kind: "command", output: "", outputTruncated: false }, { kind: "files", changes: [] }]);
});


function suspendedHistory(status = "inProgress", items: unknown[] = [{ id: "answer", type: "agentMessage", text: "기존" }]) {
  return restoreConversationEvents("thread", [{ id: "turn", status, items }], true).map((entry, index) => event(index + 1, entry.method, entry.params, { historical: true, connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 }));
}

for (const boundary of ["no-start", "other-thread", "other-turn", "other-generation", "other-process", "other-session", "other-workspace", "other-selection", "completed", "interrupted", "failed", "EOF", "live-completed", "live-terminal"] as const) {
  test(`복원 합성 종료 해제는 ${boundary} 경계를 넘어가지 않는다`, () => {
    const terminal = ["completed", "interrupted", "failed"].includes(boundary);
    const restored = suspendedHistory(terminal ? boundary : "inProgress");
    const scope = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 };
    const live: AppEvent[] = [];
    if (boundary !== "no-start") live.push(event(20, "turn/started", { threadId: boundary === "other-thread" ? "other" : "thread", turn: { id: boundary === "other-turn" ? "other" : "turn" } }, { ...scope, connectionGeneration: boundary === "other-generation" ? 8 : 7, processEpoch: boundary === "other-process" ? "old" : "current", sessionId: boundary === "other-session" ? "other" : "session", workspaceKey: boundary === "other-workspace" ? "other" : "workspace", selectionEpoch: boundary === "other-selection" ? 4 : 3 }));
    if (boundary === "EOF") live.push(event(21, "transport/closed", {}, scope), event(22, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope));
    if (boundary === "live-terminal") live.push(event(21, "turn/completed", { threadId: "thread", turn: { id: "turn", status: "completed" } }, scope), event(22, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope));
    if (boundary === "live-completed") live.push(event(21, "item/completed", { threadId: "thread", turnId: "turn", item: { id: "answer", type: "agentMessage", text: "정식 완료" } }, scope));
    live.push(event(30, "item/agentMessage/delta", { threadId: "thread", turnId: "turn", itemId: "answer", delta: "되살리면 안 됨" }, scope));
    expect(project([...restored, ...live]).blocks).toMatchObject([{ kind: "answer", text: boundary === "live-completed" ? "정식 완료" : "기존", streaming: false }]);
  });
}

test("현재 live 시작 뒤에만 복원 요약과 미확정 명령의 새 출력이 이어진다", () => {
  const restored = suspendedHistory("inProgress", [{ id: "summary", type: "reasoning", summary: ["기존 요약"] }, { id: "command", type: "commandExecution", command: "example", status: "inProgress", aggregatedOutput: "이전 출력" }]);
  expect(project(restored).blocks).toMatchObject([{ text: "기존 요약", streaming: false }, { kind: "command", status: "unknown", running: false }]);
  const scope  = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 }                                                                                                                                                                                                                                                                ;
  const result = project([...restored, event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope), event(21, "item/reasoning/summaryTextDelta", { threadId: "thread", turnId: "turn", itemId: "summary", summaryIndex: 0, delta: "추가" }, scope), event(22, "item/commandExecution/outputDelta", { threadId: "thread", turnId: "turn", itemId: "command", delta: "추가" }, scope)]) ;
  expect(result.blocks.filter(block => block.kind === "explanation").map(block => block.text).join("")).toBe("기존 요약추가");
  expect(result.blocks.find(block => block.kind === "command")).toMatchObject({ output: "이전 출력추가", running: true, status: "running", startedAt: null, endedAt: null });
});

for (const missing of [undefined, null, 42] as const) test(`완료 필드 ${String(missing)}는 기존 공개 내용을 지우지 않는다`, () => {
  const item   = (seq: number, value: unknown) => event(seq, "item/completed", { threadId: "thread", turnId: "turn", item: value })                                                                                                                                                                                                                                                                             ;
  const absent = missing === undefined ? {} : { text: missing, aggregatedOutput: missing, changes: missing }                                                                                                                                                                                                                                                                                                    ;
  const result = project([item(1, { id: "a", type: "agentMessage", text: "본문" }), item(2, { id: "a", type: "agentMessage", ...absent }), item(3, { id: "c", type: "commandExecution", aggregatedOutput: "출력" }), item(4, { id: "c", type: "commandExecution", ...absent }), item(5, { id: "f", type: "fileChange", changes: [{ path: "keep.ts" }] }), item(6, { id: "f", type: "fileChange", ...absent })]) ;
  expect(result.blocks).toMatchObject([{ text: "본문" }, { output: "출력" }, { changes: [{ path: "keep.ts" }] }]);
});

test("명시 빈 명령 완료는 과거 출력 절단 표시도 해제하고 malformed 목록은 보존한다", () => {
  const result = project([event(1, "item/completed", { item: { id: "c", type: "commandExecution", aggregatedOutput: "x".repeat(40_000) } }), event(2, "item/completed", { item: { id: "c", type: "commandExecution", aggregatedOutput: "" } }), event(3, "item/completed", { item: { id: "f", type: "fileChange", changes: [{ path: "keep.ts" }] } }), event(4, "item/completed", { item: { id: "f", type: "fileChange", changes: [null, {}] } })]);
  expect(result.blocks).toMatchObject([{ kind: "command", output: "", outputTruncated: false }, { kind: "files", changes: [{ path: "keep.ts" }] }]);
});


test("unknown 저장 턴의 완료 시각이 있는 공개 항목은 현재 시작 뒤에도 늦은 delta로 다시 열리지 않는다", () => {
  const restored = suspendedHistory("inProgress", [
    { id: "done", type: "agentMessage", phase: "commentary", text: "완료 설명", completedAtMs: 100 },
    { id: "summary", type: "reasoning", summary: ["완료 요약"], completedAtMs: 200 },
    { id: "open", type: "agentMessage", text: "진행", completedAtMs: null }
  ]);
  const scope = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 };
  const result = project([...restored, event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope),
    event(21, "item/agentMessage/delta", { threadId: "thread", turnId: "turn", itemId: "done", phase: "commentary", delta: "늦은 조각" }, scope),
    event(22, "item/reasoning/summaryTextDelta", { threadId: "thread", turnId: "turn", itemId: "summary", summaryIndex: 0, delta: "늦은 요약" }, scope),
    event(23, "item/agentMessage/delta", { threadId: "thread", turnId: "turn", itemId: "open", delta: "계속" }, scope)]);
  expect(result.blocks.filter(block => block.kind === "explanation").map(block => block.text).join("|")).toBe("완료 설명|완료 요약");
  expect(result.blocks.find(block => block.kind === "answer")).toMatchObject({ text: "진행계속", streaming: true });
});


for (const completion of [undefined, null, "100", 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) test(`legacy/invalid 완료시각 ${String(completion)}은 알려진 완료로 발명하지 않는다`, () => {
  const restored = suspendedHistory("inProgress", [{ id: "answer", type: "agentMessage", text: "진행", completedAtMs: completion }]);
  expect(project(restored)).toMatchObject({ working: false, turn: "unknown" });
  const scope = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 };
  expect(project([...restored, event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope), event(21, "item/agentMessage/delta", { threadId: "thread", turnId: "turn", itemId: "answer", delta: "계속" }, scope)]).blocks).toMatchObject([{ text: "진행계속", streaming: true }]);
});

for (const status of ["completed", "failed", "declined"] as const) test(`완료시각 없는 저장 명령의 ${status} 상태도 live 출력으로 재개하지 않는다`, () => {
  const restored = suspendedHistory("inProgress", [{ id: "command", type: "commandExecution", command: "example", status, aggregatedOutput: "정식 출력" }]) ;
  const scope    = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 }                 ;
  expect(project([...restored, event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope), event(21, "item/commandExecution/outputDelta", { threadId: "thread", turnId: "turn", itemId: "command", delta: "늦은 출력" }, scope)]).blocks).toMatchObject([{ kind: "command", output: "정식 출력", status, running: false }]);
});

for (const timestamp of [0, -1, 100]) test(`유효 완료시각 ${timestamp}의 답변은 current live 시작에도 닫힘을 유지한다`, () => {
  const restored = suspendedHistory("inProgress", [{ id: "answer", type: "agentMessage", text: "정식 답변", completedAtMs: timestamp }])    ;
  const scope    = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 } ;
  expect(project([...restored, event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope), event(21, "item/agentMessage/delta", { threadId: "thread", turnId: "turn", itemId: "answer", delta: "늦은 답변" }, scope)]).blocks).toMatchObject([{ kind: "answer", text: "정식 답변", streaming: false }]);
});


test("빈 완료 요약의 시각 권위와 뒤따른 historical 완료는 합성 재개 목록에서 제외한다", () => {
  const restored = suspendedHistory("inProgress", [
    { id: "summary", type: "reasoning", summary: ["이전 조각"] },
    { id: "summary", type: "reasoning", summary: [], content: ["PRIVATE"], completedAtMs: 100 }
  ]);
  expect(restored.filter(event => event.method === "item/completed")).toHaveLength(2);
  expect(JSON.stringify(restored)).not.toContain("PRIVATE");
  const scope  = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 }                                                                                                                                         ;
  const result = project([...restored, event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope), event(21, "item/reasoning/summaryTextDelta", { threadId: "thread", turnId: "turn", itemId: "summary", summaryIndex: 0, delta: "되살리면 안 됨" }, scope)]) ;
  expect(result.blocks).toEqual([]);
});


test("unknown 저장 턴의 declined 파일은 같은 live 시작 뒤 late started로 상태나 diff를 바꾸지 않는다", () => {
  const restored = suspendedHistory("inProgress", [{ id: "files", type: "fileChange", status: "declined", changes: [{ path: "keep.ts", diff: "거절된 원문" }], completedAtMs: null }])                                                                                                                ;
  const scope    = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 }                                                                                                                                                           ;
  const result   = project([...restored, event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope), event(21, "item/started", { threadId: "thread", turnId: "turn", item: { id: "files", type: "fileChange", changes: [{ path: "late.ts", diff: "늦은 덮어쓰기" }] } }, scope)]) ;
  expect(result.blocks).toMatchObject([{ kind: "files", status: "declined", running: false, changes: [{ path: "keep.ts", diff: "거절된 원문" }] }]);
});

test("완료된 파일의 늦은 started는 diff를 바꾸지 않고 정식 새 완료만 갱신한다", () => {
  const before = [event(1, "turn/started", { threadId: "t", turn: { id: "a" } }), event(2, "item/completed", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", status: "completed", changes: [{ path: "keep.ts", diff: "확정 원문" }] } })] ;
  const late   = event(3, "item/started", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", changes: [{ path: "late.ts", diff: "늦음" }] } })                                                                                               ;
  expect(project([...before, late]).blocks).toMatchObject([{ kind: "files", status: "completed", running: false, changes: [{ path: "keep.ts", diff: "확정 원문" }] }]);
  expect(project([...before, late, event(4, "item/completed", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", status: "failed", changes: [{ path: "final.ts", diff: "정식 변경" }] } })]).blocks).toMatchObject([{ status: "failed", running: false, changes: [{ path: "final.ts", diff: "정식 변경" }] }]);
});


for (const ending of ["completed", "failed", "declined"] as const) test(`실제 파일 완료 ${ending}는 late started를 무시하고 새 authoritative 완료는 수용한다`, () => {
  const done = [event(1, "turn/started", { threadId: "t", turn: { id: "a" } }), event(2, "item/completed", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", status: ending, changes: [{ path: "keep.ts" }] } })] ;
  const late = event(3, "item/started", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", changes: [{ path: "late.ts" }] } })                                                                                     ;
  expect(project([...done, late]).blocks).toMatchObject([{ status: ending, running: false, changes: [{ path: "keep.ts" }] }]);
  expect(project([...done, late, event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), event(5, "item/completed", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", status: "completed", changes: [{ path: "new.ts" }] } })]).blocks).toMatchObject([{ status: "completed", running: false, changes: [{ path: "new.ts" }] }]);
});

for (const boundary of ["completed", "interrupted", "failed", "EOF", "other-turn"] as const) test(`파일의 새 started도 ${boundary} 경계를 넘어 실행을 만들지 않는다`, () => {
  const ended = boundary === "EOF" ? event(2, "transport/closed", {})
    : boundary === "other-turn" ? event(2, "turn/started", { threadId: "t", turn: { id: "b" } })
    : event(2, "turn/completed", { threadId: "t", turn: { id: "a", status: boundary } });
  const result = project([event(1, "turn/started", { threadId: "t", turn: { id: "a" } }), ended, event(3, "item/started", { threadId: "t", turnId: "a", item: { id: "new", type: "fileChange", changes: [{ path: "late.ts" }] } })]);
  expect(result.blocks.filter(block => block.kind === "files")).toEqual([]);
});

for (const boundary of ["current", "no-start", "other-generation", "other-process", "other-selection"] as const) test(`미완료 저장 파일은 ${boundary} 근거에서만 정상 재개한다`, () => {
  const restored = suspendedHistory("inProgress", [{ id: "files", type: "fileChange", status: "inProgress", changes: [{ path: "old.ts" }], completedAtMs: null }]);
  const scope = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 };
  const live: AppEvent[] = boundary === "no-start" ? [] : [event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, { ...scope, connectionGeneration: boundary === "other-generation" ? 8 : 7, processEpoch: boundary === "other-process" ? "old" : "current", selectionEpoch: boundary === "other-selection" ? 4 : 3 })];
  live.push(event(21, "item/started", { threadId: "thread", turnId: "turn", item: { id: "files", type: "fileChange", changes: [{ path: "new.ts" }] } }, scope));
  expect(project([...restored, ...live])).toMatchObject({ turn: boundary === "current" ? "running" : "unknown", working: boundary === "current" });
  expect(project([...restored, ...live]).blocks).toMatchObject([{ status: boundary === "current" ? "running" : "unknown", running: boundary === "current", changes: [{ path: boundary === "current" ? "new.ts" : "old.ts" }] }]);
});

for (const invalid of [undefined, null, "", "invalid", "interrupted", "inProgress", 12] as const) test(`파일 완료의 비확정 status ${String(invalid)}를 성공으로 만들지 않는다`, () => {
  expect(project([event(1, "item/completed", { item: { id: "f", type: "fileChange", status: invalid, changes: [] } })]).blocks).toMatchObject([{ kind: "files", status: "unknown", running: false }]);
});


for (const status of ["completed", "interrupted", "failed"] as const) test(`개별 완료 없는 file은 ${status} turn 종료에서 미확인으로 닫고 changes를 보존한다`, () => {
  const started = [event(1, "turn/started", { threadId: "t", turn: { id: "a" } }),
    event(2, "item/started", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", changes: [{ path: "kept.ts", diff: "original" }] } })];
  const otherThread = event(3, "turn/completed", { threadId: "other", turn: { id: "a", status } });
  const otherTurn = event(4, "turn/completed", { threadId: "t", turn: { id: "other", status } });
  expect(project([...started, otherThread, otherTurn]).blocks).toMatchObject([{ kind: "files", running: true, status: "running", changes: [{ path: "kept.ts", diff: "original" }] }]);
  const closed = [...started, otherThread, otherTurn, event(5, "turn/completed", { threadId: "t", turn: { id: "a", status } })];
  expect(project(closed).blocks                                                                                                                                                              ).toMatchObject([{ kind: "files", running: false, status: "unknown", changes: [{ path: "kept.ts", diff: "original" }] }]) ;
  expect(executionResultCounts(project(closed).blocks)                                                                                                                                       ).toMatchObject({ unresolved: 1, failed: 0 }                                                                            ) ;
  expect(project([...closed, event(6, "item/started", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", changes: [{ path: "late.ts" }] } })]).blocks                        ).toMatchObject([{ running: false, status: "unknown", changes: [{ path: "kept.ts", diff: "original" }] }]               ) ;
  expect(project([...closed, event(7, "item/completed", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", status: "completed", changes: [{ path: "final.ts" }] } })]).blocks).toMatchObject([{ running: false, status: "completed", changes: [{ path: "final.ts" }] }]                              ) ;
});

for (const status of ["completed", "interrupted", "failed"] as const) test(`복원 ${status} 뒤 같은 scope 늦은 시작은 종료를 유지한다`, () => {
  const scope = { sessionId: "session", workspaceKey: "workspace", processEpoch: "process", connectionGeneration: 1 };
  const history = restoreConversationEvents("t", [{ id: "a", status, items: [] }], true).map((value, i): ScopedAppEvent => ({ ...event(i + 1, value.method, value.params, { historical: true }), ...scope, selectionEpoch: 1 }));
  const late: ScopedAppEvent = { ...event(20, "turn/started", { threadId: "t", turn: { id: "a" } }), ...scope, selectionEpoch: 1 };
  const nextSelection: ScopedAppEvent = { ...late, selectionEpoch: 2 };
  expect(project([...history, late])).toMatchObject({ turn: status, working: false });
  expect(project([...history, nextSelection])).toMatchObject({ turn: "running", working: true });
  expect(project([...history, { ...late, params: { threadId: "t", turn: { id: "b" } } }])).toMatchObject({ turn: "running", working: true });
});

for (const type of ["agentMessage", "publicPlan"] as const) {
  for (const invalid of [undefined, null, 42, {}]) test(`${type} 완료의 ${JSON.stringify(invalid)} 본문은 기존 조각을 보존한다`, () => {
    const result = project([
      event(1, "turn/started", { threadId: "t", turn: { id: "a" } }),
      event(2, `item/${type}/delta`, { threadId: "t", turnId: "a", itemId: "x", phase: "commentary", delta: "기존 설명" }),
      event(3, "item/completed", { threadId: "t", turnId: "a", item: { id: "x", type, text: invalid, content: invalid } })
    ]);
    expect(result.blocks).toMatchObject([{ kind: "explanation", text: "기존 설명", streaming: false }]);
  });
}

for (const snapshot of ["AB", "수정한 최종 설명", ""]) test(`설명 완료 ${snapshot}는 명령 전후의 위치를 보존한다`, () => {
  const prefix = [
    event(1, "turn/started", { threadId: "t", turn: { id: "a" } }),
    event(2, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "x", phase: "commentary", delta: "A" }),
    event(3, "item/started", { threadId: "t", turnId: "a", item: { id: "c", type: "commandExecution", command: "pwd" } }),
    event(4, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "x", phase: "commentary", delta: "B" })
  ];
  const done   = event  (5, "item/completed", { threadId: "t", turnId: "a", item: { id: "x", type: "agentMessage", text: snapshot } }) ;
  const result = project([...prefix, done, { ...done, seq: 6 }]                                                                      ) ;
  expect(result.blocks.filter(b => b.kind === "explanation").map(b => b.text).join("")).toBe   (snapshot                                                          ) ;
  expect(result.blocks.map(b => b.kind)                                               ).toEqual(snapshot ? ["explanation", "command", "explanation"] : ["command"]) ;
  expect(result.blocks.filter(b => b.kind === "explanation").every(b => !b.streaming) ).toBe   (true                                                              ) ;
  if (snapshot && snapshot !== "AB") expect(result.protocolWarning?.message).toContain("위치");
});

test("거절 결과는 실패와 미확인에 섞지 않고 중복 없이 집계한다", () => {
  const completion = event(1, "item/completed", { item: { id: "f", type: "fileChange", status: "declined", changes: [] } }) ;
  const blocks     = project([completion, { ...completion, seq: 2 }]).blocks                                                ;
  expect(executionResultCounts(blocks)).toEqual({ commands: 0, files: 1, failed: 0, declined: 1, unresolved: 0 });
});

for (const snapshot of ["AB", "수정한 최종 요약", ""]) test(`공개 요약 완료 ${snapshot}는 명령 앞 조각 위치를 유지한다`, () => {
  const prefix = [event(1, "turn/started", { threadId: "t", turn: { id: "a" } }),
    event(2, "item/reasoning/summaryTextDelta", { threadId: "t", turnId: "a", itemId: "r", summaryIndex: 0, delta: "A" }),
    event(3, "item/started", { threadId: "t", turnId: "a", item: { id: "c", type: "commandExecution", command: "pwd" } }),
    event(4, "item/reasoning/summaryTextDelta", { threadId: "t", turnId: "a", itemId: "r", summaryIndex: 0, delta: "B" })];
  const done   = event  (5, "item/completed", { threadId: "t", turnId: "a", item: { id: "r", type: "reasoning", summary: snapshot ? [snapshot] : [], content: ["PRIVATE"] } }) ;
  const result = project([...prefix, done, { ...done, seq: 6 }]                                                                                                              ) ;
  expect(result.blocks.filter(b => b.kind === "explanation").map(b => b.text).join(""))    .toBe     (snapshot                                                          ) ;
  expect(result.blocks.map(b => b.kind)                                               )    .toEqual  (snapshot ? ["explanation", "command", "explanation"] : ["command"]) ;
  expect(JSON.stringify(result.blocks)                                                ).not.toContain("PRIVATE"                                                         ) ;
  if (snapshot && snapshot !== "AB") expect(result.protocolWarning?.message).toContain("위치");
});

test("EOF 뒤 unknown 턴의 늦은 시작은 실행 상태도 되살리지 않는다", () => {
  const restored = suspendedHistory("inProgress", [])                                                                                       ;
  const scope    = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 } ;
  expect(project([...restored, event(20, "transport/closed", {}, scope), event(21, "turn/started", { threadId: "thread", turn: { id: "turn" } }, scope)])).toMatchObject({ turn: "unknown", working: false });
});

for (const method of ["item/started", "item/completed"] as const) {
  for (const changes of [undefined, null, {}, "invalid", [null], [{ path: "new.ts" }, { path: 42 }], [{ path: "new.ts" }, { path: "" }], [{ path: "new.ts", diff: 42 }]]) {
    test(`live 파일 ${method}의 malformed 전체 배열 ${JSON.stringify(changes)}는 기존 목록을 보존한다`, () => {
      const result = project([
        event(1, "turn/started", { threadId: "t", turn: { id: "a" } }),
        event(2, "item/started", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", changes: [{ path: "keep.ts", diff: "보존" }] } }),
        event(3, method, { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", status: "completed", changes } })
      ]);
      expect(result.blocks).toMatchObject([{ kind: "files", changes: [{ path: "keep.ts", diff: "보존" }], running: method === "item/started" }]);
    });
  }
  for (const changes of [[], [{ path: "new.ts" }], [{ path: "new.ts", diff: null }, { path: "second.ts", diff: "+valid" }]]) {
    test(`live 파일 ${method}의 유효 배열 ${JSON.stringify(changes)}는 전체 목록을 교체한다`, () => {
      const result = project([
        event(1, "turn/started", { threadId: "t", turn: { id: "a" } }),
        event(2, "item/started", { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", changes: [{ path: "keep.ts", diff: "보존" }] } }),
        event(3, method, { threadId: "t", turnId: "a", item: { id: "f", type: "fileChange", status: "completed", changes } })
      ]);
      expect(result.blocks).toMatchObject([{ kind: "files", changes, running: method === "item/started" }]);
    });
  }
}

const resumedScope = { connectionGeneration: 7, processEpoch: "current", sessionId: "session", workspaceKey: "workspace", selectionEpoch: 3 };
const scopeMutations = [
  { connectionGeneration: 8 }, { processEpoch: "other" }, { sessionId: "other" },
  { workspaceKey: "other" }, { selectionEpoch: 4 },
];
const restoredScopeItems = [
  { id: "answer", type: "agentMessage", text: "답변" },
  { id: "commentary", type: "agentMessage", phase: "commentary", text: "설명" },
  { id: "plan", type: "publicPlan", text: "계획" },
  { id: "summary", type: "reasoning", summary: ["요약"] },
  { id: "command", type: "commandExecution", command: "example", status: "inProgress", aggregatedOutput: "출력" },
  { id: "files", type: "fileChange", status: "inProgress", changes: [{ path: "keep.ts" }] },
];
function restoredScopeHistory() {
  const history = suspendedHistory("inProgress", restoredScopeItems);
  return [...history.slice(0, -1), event(15, "item/completed", { threadId: "thread", turnId: "turn", item: { id: "plan", type: "publicPlan", text: "계획" } }, { ...resumedScope, historical: true }), history.at(-1)!];
}
const resumedChanges = [
  ["item/agentMessage/delta", { itemId: "answer", delta: "추가" }],
  ["item/agentMessage/delta", { itemId: "commentary", phase: "commentary", delta: "추가" }],
  ["item/publicPlan/delta", { itemId: "plan", delta: "추가" }],
  ["item/reasoning/summaryTextDelta", { itemId: "summary", summaryIndex: 0, delta: "추가" }],
  ["item/commandExecution/outputDelta", { itemId: "command", delta: "추가" }],
  ["item/started", { item: { id: "files", type: "fileChange", changes: [{ path: "live.ts" }] } }],
] as const;
const resumedStarts = restoredScopeItems.map(item => ["item/started", { item: { ...item, text: "시작", summary: ["시작"], changes: [{ path: "start.ts" }] } }] as const);
const resumedItemCompletions = restoredScopeItems.map(item => ["item/completed", { item: { ...item, status: "completed", text: "정산", summary: ["정산"], aggregatedOutput: "정산", changes: [{ path: "final.ts" }] } }] as const);
const resumedCompletions = [
  ...resumedItemCompletions,
  ["turn/completed", { turn: { id: "turn", status: "completed" } }],
] as const;

// 혼합 scope 배열의 투영 경계 검사다. main wire를 우회하는 실제 GUI 유입 증거는 아니다.
for (const mutation of scopeMutations) for (const afterValid of [false, true]) {
  test(`복원 재개 후 ${JSON.stringify(mutation)} 사건은 ${afterValid ? "정상 사건 뒤에도" : "즉시"} 변이하지 않는다`, () => {
    const prefix = [...restoredScopeHistory(),
      event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, resumedScope)];
    if (afterValid) for (const [index, [method, params]] of resumedChanges.entries()) prefix.push(event(30 + index, method, { threadId: "thread", turnId: "turn", ...params }, resumedScope));
    const expected = project(prefix);
    for (const [index, [method, params]] of [...resumedChanges, ...resumedStarts, ...resumedCompletions, ...resumedItemCompletions.map(([method, params]) => [method, { ...params, item: { ...params.item, id: `new-${params.item.id}` } }] as const)].entries()) {
      const wrong = event(50 + index, method, { threadId: "thread", turnId: "turn", ...params }, { ...resumedScope, ...mutation });
      expect(project([...prefix, wrong])).toEqual(expected);
    }
    const wrongStart = event(90, "turn/started", { threadId: "thread", turn: { id: "turn" } }, { ...resumedScope, ...mutation });
    expect(project([...prefix, wrongStart])).toEqual(expected);
    const valid = resumedChanges.map(([method, params], index) => event(100 + index, method, { threadId: "thread", turnId: "turn", ...params }, resumedScope));
    const result = project([...prefix, ...valid]);
    expect(result.blocks.find(block => block.kind === "answer")).toMatchObject({ text: afterValid ? "답변추가추가" : "답변추가", streaming: true });
    for (const [source, initial] of [["commentary", "설명"], ["publicPlan", "계획"], ["reasoningSummary", "요약"]]) {
      const fragments = result.blocks.filter(block => block.kind === "explanation" && block.source === source);
      expect(fragments.map(block => "text" in block ? block.text : "").join("")).toBe(initial + (afterValid ? "추가추가" : "추가"));
      expect(fragments.at(-1)).toMatchObject({ streaming: true });
    }
    expect(result.blocks.find(block => block.kind === "command")).toMatchObject({ output: afterValid ? "출력추가추가" : "출력추가", running: true });
    expect(result.blocks.find(block => block.kind === "files")).toMatchObject({ changes: [{ path: "live.ts" }], running: true });
  });
}

for (const ending of ["EOF", "completed", "interrupted", "failed"] as const) for (const empty of [false, true]) {
  test(`복원 재개 ${ending} 뒤 같은 scope의 ${empty ? "빈" : "정식"} 완료와 새 항목을 정산한다`, () => {
    const prefix = [...restoredScopeHistory(),
      event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, resumedScope),
      ...resumedChanges.map(([method, params], index) => event(30 + index, method, { threadId: "thread", turnId: "turn", ...params }, resumedScope)),
      ending === "EOF" ? event(40, "transport/closed", {}, resumedScope) : event(40, "turn/completed", { threadId: "thread", turn: { id: "turn", status: ending } }, resumedScope)];
    const before = project(prefix);
    for (const mutation of scopeMutations) for (const [index, [method, params]] of resumedCompletions.entries()) {
      expect(project([...prefix, event(50 + index, method, { threadId: "thread", turnId: "turn", ...params }, { ...resumedScope, ...mutation })])).toEqual(before);
    }
    const completed = restoredScopeItems.map(item => ({ ...item, status: "completed", text: empty ? "" : "정산", summary: empty ? [] : ["정산"], aggregatedOutput: empty ? "" : "정산", changes: empty ? [] : [{ path: "final.ts" }] }));
    const events = completed.map((item, index) => event(70 + index, "item/completed", { threadId: "thread", turnId: "turn", item }, resumedScope));
    events.push(event(80, "item/completed", { threadId: "thread", turnId: "turn", item: { id: "new", type: "agentMessage", text: "새 완료" } }, resumedScope));
    const settled = project([...prefix, ...events]);
    expect(settled.blocks.filter(block => block.kind === "answer")                              ).toMatchObject([{ text: empty ? "" : "정산", streaming: false }, { text: "새 완료", streaming: false }]) ;
    expect(settled.blocks.filter(block => block.kind === "explanation").map(block => block.text)).toEqual      (empty ? [] : ["정산", "정산", "정산"]                                                   ) ;
    expect(settled.blocks.find(block => block.kind === "command")                               ).toMatchObject({ output: empty ? "" : "정산", status: "completed", running: false }                    ) ;
    expect(settled.blocks.find(block => block.kind === "files")                                 ).toMatchObject({ changes: empty ? [] : [{ path: "final.ts" }], status: "completed", running: false }   ) ;
    const late = [...resumedChanges, ...resumedStarts].map(([method, params], index) => event(90 + index, method, { threadId: "thread", turnId: "turn", ...params }, resumedScope));
    expect(project([...prefix, ...events, event(85, "turn/started", { threadId: "thread", turn: { id: "turn" } }, resumedScope), ...late])).toEqual(settled);
  });
}

test("복원 unknown의 반복 재개에서도 scope 소유권과 정상 누적을 유지한다", () => {
  const prefix = [...suspendedHistory(), event(20, "turn/started", { threadId: "thread", turn: { id: "turn" } }, resumedScope),
    event(21, "item/agentMessage/delta", { threadId: "thread", turnId: "turn", itemId: "answer", delta: "첫째" }, resumedScope),
    event(22, "turn/completed", { threadId: "thread", turn: { id: "turn", status: "unknown" } }, { ...resumedScope, historical: true }),
    event(23, "turn/started", { threadId: "thread", turn: { id: "turn" } }, resumedScope),
    event(24, "item/agentMessage/delta", { threadId: "thread", turnId: "turn", itemId: "answer", delta: "둘째" }, resumedScope)];
  expect(project(prefix).blocks).toMatchObject([{ text: "기존첫째둘째", streaming: true }]);
  for (const mutation of scopeMutations) expect(project([...prefix, event(25, "turn/completed", { threadId: "thread", turn: { id: "turn", status: "completed" } }, { ...resumedScope, ...mutation })])).toEqual(project(prefix));
});
