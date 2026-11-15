/**
 * @verifies RESP-CHAT-MESSAGES-MARKDOWN
 * @verifies RESP-CHAT-MESSAGES-READING
 * @verifies RESP-CHAT-SESSIONS-READING
 * @verifies RESP-CHAT-WORKSPACE
 */
import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatMessage } from "../src/chat-message";
import { reduceConversationEvents, type ConversationEventState, blankReadingState, belongsToConversation, composerFull, conversationKey, currentTurnEvents, draftWithQuote, eventTurnId, externalChatUrl, MAX_PROMPT_CHARS, pasteOverflow } from "../src/chat-state";
import { createActivitySidebarState, updateActivitySidebarSnapshot } from "../src/activity-sidebar";
import { project } from "../src/projection";
import type { AppEvent, ScopedAppEvent } from "../src/shared";

describe("Ovis에서 개작한 Chat 입력과 대화 경계", () => {
  test("인용은 기존 초안을 보존하고 모든 줄을 인용한 뒤 전송 없이 결합한다", () => {
    expect(draftWithQuote("기존 초안", "첫 줄\n둘째 줄")).toBe("기존 초안\n\n> 첫 줄\n> 둘째 줄\n\n") ;
    expect(draftWithQuote("초안\n"   , "답변"          )).toBe("초안\n\n> 답변\n\n"                 ) ;
    expect(draftWithQuote("보존"     , " \n"           )).toBe("보존"                               ) ;
  });

  test("붙여넣기 한도는 선택한 범위를 대체하는 실제 길이로 계산한다", () => {
    expect(pasteOverflow("12345", 1, 4, "abcdef", 7)           ).toBe(1    ) ;
    expect(pasteOverflow("12345", 4, 1, "abcdef", 7)           ).toBe(1    ) ;
    expect(pasteOverflow("12345", 0, 5, "abcdef", 7)           ).toBe(0    ) ;
    expect(composerFull(MAX_PROMPT_CHARS - 1, MAX_PROMPT_CHARS)).toBe(false) ;
    expect(composerFull(MAX_PROMPT_CHARS, MAX_PROMPT_CHARS)    ).toBe(true ) ;
  });

  test("대화 상태 키는 작업 폴더와 Native 스레드를 함께 격리한다", () => {
    expect(conversationKey("/repo-a", "thread")).not.toBe(conversationKey("/repo-b", "thread"));
    expect(conversationKey("/repo-a", null)).not.toBe(conversationKey("/repo-a", "null"));
    const first = blankReadingState();
    first.draft = "저장할 초안";
    expect(blankReadingState().draft).toBe("");
  });

  test("늦은 다른 스레드 사건을 버리고 연결 사건은 같은 세션 상태로 받는다", () => {
    const event: AppEvent = { seq: 1, at: "2026-11-12", kind: "notification", method: "turn/started", params: { threadId: "old" } };
    expect(belongsToConversation(event, "current")                                                  ).toBe(false) ;
    expect(belongsToConversation(event, "old")                                                      ).toBe(true ) ;
    expect(belongsToConversation({ ...event, method: "transport/connected", params: {} }, "current")).toBe(true ) ;
  });

  test("현재 턴의 경과 시간 입력은 바로 앞 요청부터 격리한다", () => {
    const events: AppEvent[] = [
      { seq: 1, at: "2026-11-14T00:00:00Z", kind: "notification", method: "turn/userPrompt", params: { threadId: "thread", text: "첫 요청" } },
      { seq: 2, at: "2026-11-14T00:00:01Z", kind: "notification", method: "turn/started", params: { threadId: "thread", turn: { id: "turn-1" } } },
      { seq: 3, at: "2026-11-14T00:01:00Z", kind: "notification", method: "turn/userPrompt", params: { threadId: "thread", text: "둘째 요청" } },
      { seq: 4, at: "2026-11-14T00:01:01Z", kind: "notification", method: "turn/started", params: { threadId: "thread", turn: { id: "turn-2" } } },
      { seq: 5, at: "2026-11-14T00:01:02Z", kind: "notification", method: "item/started", params: { threadId: "thread", turnId: "turn-2", item: { id: "item" } } }
    ];
    expect(eventTurnId(events[1]!)).toBe("turn-1");
    expect(currentTurnEvents(events, "turn-2").map((event) => event.seq)).toEqual([3, 4, 5]);
  });

  test("외부 링크는 완전한 HTTP(S) 주소만 허용한다", () => {
    expect(externalChatUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(externalChatUrl("javascript:alert(1)")).toBeNull();
    expect(externalChatUrl("data:text/html,test")).toBeNull();
    expect(externalChatUrl("file:///etc/passwd")).toBeNull();
    expect(externalChatUrl("/repo/report.md")).toBeNull();
  });
});

describe("실제 Markdown/GFM 메시지 렌더러", () => {
  test("제목·표·코드와 복사/인용 동작을 렌더링하고 원시 HTML은 실행 표면으로 만들지 않는다", () => {
    const html = renderToStaticMarkup(createElement(ChatMessage, {
      text: "## 저장된 답변\n\n| 항목 | 값 |\n| --- | --- |\n| 검사 | 통과 |\n\n\`\`\`ts\nconst value = 1;\n\`\`\`\n\n<script>alert(1)</script>",
      onQuote: () => undefined
    }));
    expect(html)    .toContain("<h2>저장된 답변</h2>") ;
    expect(html)    .toContain("<table>"             ) ;
    expect(html)    .toContain("const value = 1;"    ) ;
    expect(html)    .toContain("코드 복사"           ) ;
    expect(html)    .toContain("인용하여 질문"       ) ;
    expect(html).not.toContain("<script>"            ) ;
  });

  test("이미지 URL을 자동으로 불러오지 않고 위험 링크를 활성화하지 않는다", () => {
    const html = renderToStaticMarkup(createElement(ChatMessage, { text: "![민감 이미지](https://example.com/track)\n\n[위험](javascript:alert(1))" }));
    expect(html).not.toContain("<img"       ) ;
    expect(html).not.toContain("href="      ) ;
    expect(html)    .toContain("민감 이미지") ;
  });
});


describe("재연결 snapshot과 실제 renderer 대화 경계", () => {
  const selection = { workspaceKey: "repo", selectionEpoch: 2, processEpoch: "process" };
  const event = (seq: number, method: string, params: unknown = { threadId: "thread" }, generation = 2): ScopedAppEvent => ({ ...selection, seq, method, params, at: "2026-11-15", kind: "notification", connectionGeneration: generation });
  const history = () => [
    { ...event(10, "transport/status", { state: "connected", connectionGeneration: 2 }), historical: true },
    { ...event(11, "thread/configured"), historical: true },
    { ...event(12, "item/completed", { threadId: "thread", turnId: "old", item: { id: "answer", type: "agentMessage", text: "복원 답변" } }), historical: true },
  ];
  const marker = (seq = 20, events: unknown = history()) => event(seq, "conversation/reconnected", { threadId: "thread", events });
  const empty = (): ConversationEventState => ({ events: [], reconnect: null });
  const reduce = (current: ConversationEventState, incoming: ScopedAppEvent[], snapshot: ScopedAppEvent[] = []) => reduceConversationEvents(current, snapshot, incoming, selection, "thread");
  const fresh = () => event(21, "turn/userPrompt", { threadId: "thread", text: "새 요청" });

  test("이전 연결의 미결 승인·진행 명령·턴을 원자 교체하고 새 live만 유지한다", () => {
    const old: ConversationEventState = { reconnect: null, events: [
      event(1, "turn/started", { threadId: "thread", turn: { id: "old" } }, 1),
      event(4, "turn/userPrompt", { threadId: "thread", text: "이전 미결 입력" }, 1),
      event(2, "item/started", { threadId: "thread", turnId: "old", item: { id: "cmd", type: "commandExecution", command: "old command" } }, 1),
      { ...event(3, "item/commandExecution/requestApproval", { threadId: "thread", turnId: "old", itemId: "cmd", command: "old command" }, 1), kind: "request", requestId: 42, approvalToken: "old", supported: true },
    ] };
    expect(project(old.events).blocks.some((block) => block.kind === "approval" && block.open)).toBe(true);
    const next = reduce(old, [marker(), fresh()]);
    expect(next.events.map((value) => value.seq)).toEqual([10, 11, 12, 21]);
    expect(next.replaced).toBe(true);
    expect(next.snapshot.every((value) => value.historical)).toBe(true);
    expect(next.live.map((value) => value.seq)).toEqual([21]);
    expect(project(next.events).blocks.some((block) => block.kind === "approval" || block.kind === "command")).toBe(false);
    expect(project(next.events).working).toBe(false);
    expect(project(next.events).blocks.some((block) => block.kind === "user" && block.text === "이전 미결 입력")).toBe(false);
    expect(old.events).toHaveLength(4);
  });

  test("marker보다 먼저 받은 freshlive와 순서가 뒤섞인 외부 큐도 같은 reducer로 보존한다", () => {
    for (const queued of [[marker(), fresh()], [fresh(), marker()]]) {
      const success = reduce(empty(), queued, [event(1, "turn/started", {}, 1)]);
      const failed = reduce({ events: [event(1, "turn/started", {}, 1)], reconnect: null }, queued);
      const waiting = reduce(reduce(empty(), [fresh()]), [marker()], [event(1, "turn/started", {}, 1)]);
      expect(success.events).toEqual(failed.events);
      expect(waiting.events).toEqual(success.events);
      expect(success.events.map((value) => value.seq)).toEqual([10, 11, 12, 21]);
    }
  });

  test("중복·stale marker와 늦은 bootstrap snapshot은 현재 transcript를 되감지 않는다", () => {
    const current = reduce(empty(), [marker(), fresh()]);
    for (const stale of [marker(), marker(19), { ...marker(30), connectionGeneration: 1 }]) {
      const next = reduce(current, [stale], [event(1, "turn/started", {}, 1)]);
      expect(next.events).toEqual(current.events);
      expect(next.replaced).toBe(false);
      expect(next.reconnect).toBe(current.reconnect);
    }
    const many = Array.from({ length: 2_100 }, (_, index) => event(index + 22, "account/updated", {}));
    const capped = reduce(current, many);
    expect(capped.events).toHaveLength(2_000);
    expect(reduce(capped, [marker()]).events).toEqual(capped.events);
    const nextGeneration = { ...fresh(), seq: 41, connectionGeneration: 3 };
    const newer = reduce(current, [nextGeneration]);
    expect(newer.events.at(-1)).toEqual(nextGeneration);
    expect(reduce(newer, [fresh(), marker()]).events).toEqual(newer.events);
  });

  test("재연결 활동 snapshot은 pulse 없이 복원하고 marker 이후 live Hook만 반응한다", () => {
    const run = { id: "handler", eventName: "preToolUse", sourcePath: "/hooks.json", displayOrder: 2, handlerType: "command", executionMode: "sync", status: "running", startedAt: 100 };
    const snapshot = [...history(),
      { ...event(13, "hook/started", { threadId: "thread", turnId: "old", run }), historical: true },
      { ...event(14, "hook/completed", { threadId: "thread", turnId: "old", run }), historical: true },
    ];
    const live = event(22, "hook/started", { threadId: "thread", turnId: "new", run });
    const batch = reduce(empty(), [live, marker(20, snapshot)]);
    const activity = updateActivitySidebarSnapshot(createActivitySidebarState(), batch);
    expect(activity.pulses.map((pulse) => pulse.seq)).toEqual([22]);
    expect(batch.events.map((value) => value.seq)).toEqual([10, 11, 12, 13, 14, 22]);
  });

  test("다른 scope·thread·generation과 손상 snapshot은 교체를 일으키지 않는다", () => {
    const current = reduce(empty(), [fresh()]);
    const invalid = [
      { ...marker(), workspaceKey: "other" }, { ...marker(), selectionEpoch: 1 }, { ...marker(), processEpoch: "old" },
      event(20, "conversation/reconnected", { threadId: "other", events: history() }),
      marker(20, []), marker(20, null), marker(20, [{ seq: 1 }]),
      marker(20, [{ ...history()[0]!, historical: false }]),
      marker(20, [{ ...history()[0]!, connectionGeneration: 1 }]),
      marker(20, [{ ...history()[0]!, workspaceKey: "other" }]),
      marker(20, [{ ...history()[0]!, selectionEpoch: 1 }]),
      marker(20, [{ ...history()[0]!, processEpoch: "old" }]),
      marker(20, [{ ...history()[0]!, seq: 20 }]),
      marker(20, [{ ...history()[0]!, params: { threadId: "other" } }]),
      marker(20, [{ ...history()[0]!, method: "conversation/reconnected" }]),
    ];
    for (const value of invalid) {
      const next = reduce(current, [value]);
      expect(next.events).toEqual(current.events);
      expect(next.replaced).toBe(false);
    }
  });

  test("scope 전환은 이전 marker를 버리고 scoped seq 키는 충돌하지 않는다", () => {
    const current = reduce(empty(), [marker(), fresh()]);
    const nextSelection = { ...selection, selectionEpoch: 3 };
    const next = reduceConversationEvents(current, [], [{ ...fresh(), ...nextSelection, seq: 1 }], nextSelection, "thread");
    expect(next.reconnect).toBeNull();
    expect(next.events.map((value) => value.seq)).toEqual([1]);
    const colliding = reduce(empty(), [event(1, "account/updated", {}, 2)], [event(1, "account/updated", {}, 1)]);
    expect(colliding.events).toHaveLength(2);
  });
});
