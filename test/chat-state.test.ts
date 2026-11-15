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
import { blankReadingState, belongsToConversation, composerFull, conversationKey, currentTurnEvents, draftWithQuote, eventTurnId, externalChatUrl, MAX_PROMPT_CHARS, pasteOverflow } from "../src/chat-state";
import type { AppEvent } from "../src/shared";

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
