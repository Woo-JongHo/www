import { expect, test } from "bun:test";
import { completedNativeReportInput, NativeCompletionCollector } from "../src/native-report-input";
import type { AppEvent } from "../src/shared";

function event(seq: number, method: string, params: unknown): AppEvent {
  return { seq, method, params, kind: "notification", at: "2026-11-12T00:00:00Z" };
}

function events() {
  return [
    event(1, "turn/userPrompt", { threadId: "thread-one", clientRequestId: "request-one", text: "생태계 화면을 만들어줘" }),
    event(2, "turn/started", { threadId: "thread-one", turn: { id: "turn-one" } }),
    event(3, "item/completed", { threadId: "thread-one", turnId: "turn-one", item: { id: "private", type: "reasoning", text: "비공개 내부 분석" } }),
    event(4, "item/completed", { threadId: "thread-one", turnId: "turn-one", item: { id: "answer", type: "agentMessage", text: "화면을 구현하고 검증했습니다.", phase: "final_answer" } }),
    event(5, "turn/completed", { threadId: "thread-one", turn: { id: "turn-one", status: "completed" } }),
    event(6, "turn/startAccepted", { threadId: "thread-one", turnId: "turn-one", clientRequestId: "request-one" }),
  ];
}

test("답변 종료와 늦은 접수 ACK를 모아 한 번만 LLM 입력을 만든다", () => {
  const all       = events()                        ;
  const collector = new NativeCompletionCollector() ;
  expect(collector.observe(all.slice(0, 4), all[3]!)).toEqual([]);
  expect(collector.observe(all.slice(0, 5), all[4]!)).toEqual([]);
  const ready = collector.observe(all, all[5]!);
  expect(ready                          )    .toHaveLength(1                              ) ;
  expect(ready[0]?.prompt               )    .toBe        ("생태계 화면을 만들어줘"       ) ;
  expect(ready[0]?.answer               )    .toBe        ("화면을 구현하고 검증했습니다.") ;
  expect(JSON.stringify(ready)          ).not.toContain   ("비공개 내부 분석"             ) ;
  expect(collector.observe(all, all[4]!))    .toEqual     ([]                             ) ;
});

test("완료가 아닌 사건·공개 답변 없음·다른 턴을 판단 입력으로 보내지 않는다", () => {
  const all = events();
  expect(completedNativeReportInput(all, all[3]!)).toBeNull();
  expect(completedNativeReportInput(all.filter((entry) => entry.seq !== 4), all[4]!)).toBeNull();
  expect(completedNativeReportInput(all, event(8, "turn/completed", { threadId: "other", turn: { id: "turn-one" } }))).toBeNull();
});

test("공개 본문과 메타만 제한하고 잘림을 숨기지 않는다", () => {
  const all = events();
  all[3] = event(4, "item/completed", { threadId: "thread-one", turnId: "turn-one", item: { id: "answer", type: "agentMessage", text: "가".repeat(50_000), phase: "final_answer" } });
  const input = completedNativeReportInput(all, all[4]!);
  expect(input?.answer.length                                      ).toBeLessThanOrEqual(40_000) ;
  expect(input?.truncated                                          ).toBe               (true  ) ;
  expect(new TextEncoder().encode(JSON.stringify(input)).byteLength).toBeLessThan       (96_000) ;
});

test("threadId 없는 옛 완료 사건은 동일 턴의 유일한 스레드만 연결한다", () => {
  const all       = events()                                                                       ;
  const completed = event (9, "turn/completed", { turn: { id: "turn-one", status: "completed" } }) ;
  expect(completedNativeReportInput(all, completed)?.threadId).toBe("thread-one");
  const mixed = [...all, event(10, "item/completed", { threadId: "other", turnId: "turn-one", item: { id: "other-answer", type: "agentMessage", text: "다른 대화" } })];
  expect(completedNativeReportInput(mixed, completed)).toBeNull();
});
