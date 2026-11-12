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
    event(2, "item/commandExecution/requestApproval", { command: "rm x" }, { kind: "request", requestId: 0, supported: true }),
    event(3, "approval/responding", { decision: "decline" }, { requestId: 0 }),
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
  const request   = event(1, "turn/userPrompt", { threadId: "thread", clientRequestId: "request", text: "요청" }) ;
  const connected = event(2, "transport/connected", {}, { kind: "transport" }                                   ) ;
  const closed    = event(3, "transport/closed", {}, { kind: "transport" }                                      ) ;
  expect([
    project([request]).transport,
    project([request, connected]).transport,
    project([request, connected, closed]).transport
  ]).toEqual(["disconnected", "connected", "closed"]);
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
    { kind: "explanation", source: "reasoningSummary", text: "먼저 확인\n\n다음", streaming: true },
    { kind: "explanation", source: "commentary", text: "확인했습니다." }
  ]);
  events.push(summaryEvent(8, "item/completed", { item: { id: "summary", type: "reasoning", summary: ["최종 첫 문단", "최종 다음 문단"], content: ["PRIVATE"] } }));
  events.push(summaryEvent(9, "item/reasoning/summaryTextDelta", { summaryIndex: 0, delta: "늦음" }));
  expect(project(events).blocks[0]).toMatchObject({ text: "최종 첫 문단\n\n최종 다음 문단", streaming: false });
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
