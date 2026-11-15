/**
 * @verifies RESP-CHAT-MESSAGES-PROJECTION
 */
import { expect, test } from "bun:test";
import { executionResultCounts, project } from "../src/projection";
import type { AppEvent } from "../src/shared";
const event = (seq: number, method: string, params: unknown, extra: Partial<AppEvent> & { approvalToken?: string; connectionGeneration?: number; processEpoch?: string } = {}): AppEvent => ({ seq, at: "2026-01-01T00:00:00Z", kind: "notification", method, params, ...extra });

test("결과 요약 집계는 명령과 파일의 실패·미확인을 함께 센다", () => {
  const blocks = project([
    event(1, "turn/started", { threadId: "t", turn: { id: "a" } }),
    event(2, "item/completed", { threadId: "t", turnId: "a", item: { id: "command", type: "commandExecution", command: "false", status: "completed", exitCode: 0 } }),
    event(3, "item/completed", { threadId: "t", turnId: "a", item: { id: "failed-file", type: "fileChange", status: "failed", changes: [] } }),
    event(4, "item/started", { threadId: "t", turnId: "a", item: { id: "unknown-file", type: "fileChange", changes: [] } })
  ]).blocks;
  expect(executionResultCounts(blocks)).toEqual({ commands: 1, files: 2, failed: 1, unresolved: 1 });
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
    event(6, "item/completed", { threadId: "thread-1", turnId: "turn-1", item: { id: "files", type: "fileChange", changes: [{ path: "a.ts" }] } }),
    event(7, "item/started", { threadId: "thread-1", turnId: "turn-1", item: { id: "files", type: "fileChange", changes: [{ path: "a.ts" }] } }),
    event(8, "item/completed", { threadId: "thread-1", turnId: "turn-1", item: { id: "files", type: "fileChange", changes: [{ path: "a.ts" }] } })
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
  expect(project(events).blocks).toMatchObject([
    { text: "확인했습니다." },
    { text: "최종 첫 문단\n\n최종 다음 문단", streaming: false }
  ]);
  expect(JSON.stringify(project(events).blocks)).not.toContain("PRIVATE");
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
  const request = (seq: number, approvalToken: string) => event(seq, "item/commandExecution/requestApproval", { threadId: "t" }, { kind: "request", requestId: 7, supported: true, approvalToken });
  const response = (seq: number, approvalToken: string, method = "approval/responded") => event(seq, method, { threadId: "t" }, { requestId: 7, approvalToken });
  const events = [request(1, "old"), response(2, "old"), request(3, "new"), response(4, "old"), response(5, "new", "approval/responding")];
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
  expect(new Set(result.blocks.map((block) => block.id)).size).toBe(result.blocks.length);
  expect(project([...events, events[2]!])).toEqual(result);
  expect(project(events)).toEqual(result);
  expect(project(events.slice(0, 2)).blocks[0]?.id).toBe(result.blocks[0]?.id);
});

for (const snapshot of [[], [""], [" ", "\n\t"]]) {
  test(`빈·공백 snapshot ${JSON.stringify(snapshot)}은 해당 항목의 모든 fragment만 정리한다`, () => {
    const events = [summaryStart, summaryDelta(2, "A"), summaryDelta(3, "B", 0, "other"), summaryDelta(4, "C"), summarySnapshot(5, snapshot)];
    expect(publicTexts(events)).toEqual(["B"]);
  });
}

test("started·completed snapshot은 모든 fragment를 수신 위치에서 대체하며 늦은 started는 무시한다", () => {
  const events = [summaryStart, summaryDelta(2, "A"), summaryDelta(3, "B", 0, "other"), summaryDelta(4, "C"),
    summarySnapshot(5, ["시작"], "item/started")];
  expect(publicTexts(events)).toEqual(["B", "시작"]);
  events.push(summaryDelta(6, "D", 0, "other"), summaryDelta(7, "E"), summarySnapshot(8, ["최종", "문단"]));
  expect(publicTexts(events)).toEqual(["B", "D", "최종\n\n문단"]);
  const final = project(events);
  events.push(summarySnapshot(9, ["늦은 시작"], "item/started"), summaryDelta(10, "늦음"));
  expect(project(events)).toEqual(final);
  events.push(summarySnapshot(11, ["최종", "문단"]));
  expect(publicTexts(events)).toEqual(["B", "D", "최종\n\n문단"]);
  expect(new Set(project(events).blocks.map((block) => block.id)).size).toBe(3);
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
  const delta = (seq: number, text: string) => summaryEvent(seq, source === "publicPlan" ? "item/publicPlan/delta" : "item/agentMessage/delta", { itemId: "message", phase: source === "commentary" ? source : undefined, delta: text });
  const snapshot = (seq: number, text: string, method = "item/completed") => summaryEvent(seq, method, { item: { id: "message", type: source === "publicPlan" ? source : "agentMessage", phase: source === "commentary" ? source : undefined, text } });
  test(`${source}도 연속 delta만 합치고 snapshot은 모든 fragment를 수신 위치에서 대체한다`, () => {
    const events = [summaryStart, delta(2, "A"), delta(3, "a"), summaryDelta(4, "B"), delta(5, "C")];
    expect(publicTexts(events)).toEqual(["Aa", "B", "C"]);
    const before = project(events);
    expect(new Set(before.blocks.map((block) => block.id)).size).toBe(3);
    expect(project(events)).toEqual(before);
    events.push(snapshot(6, "완료"), delta(7, "늦음"), snapshot(8, "늦은 시작", "item/started"));
    expect(project(events).blocks).toMatchObject([{ text: "B" }, { text: "완료", streaming: false, source }]);
    events.push(snapshot(9, "완료"));
    expect(publicTexts(events)).toEqual(["B", "완료"]);
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
  expect(project([legacy]).blocks).toMatchObject([{ approvalToken: null, state: "open", open: false }]);
  expect(project([legacy, event(2, "approval/responding", { threadId: "t" }, { requestId: 7 })]).blocks).toMatchObject([{ state: "open", open: false }]);
  expect(project([legacy, event(2, "approval/responded", { threadId: "t" }, { requestId: 7 })]).blocks).toMatchObject([{ state: "responded", open: false }]);
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
