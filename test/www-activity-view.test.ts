/**
 * @verifies RESP-CHAT-ACTIVITY-VIEW
 */
import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NativeActivityView, ResourceActivitySidebar } from "../src/native-activity-view";
import { projectNativeActivity } from "../src/native-activity";
import type { AppEvent } from "../src/shared";

function event(seq: number, method: string, params: unknown): AppEvent {
  return { seq, method, params, kind: "notification", at: "2026-11-13T02:12:00Z" };
}

const begin   = event(1, "turn/started", { threadId: "t", turn: { id: "a" } })                                                                                                                                                                                                      ;
const hookRun = { id: "h", eventName: "postToolUse", executionMode: "sync", status: "failed", sourcePath: "/plugin/hooks.json", entries: [{ kind: "error", text: "plugin contents changed; hook approval required" }, { kind: "context", text: "PRIVATE_CONTEXT_DO_NOT_RENDER" }] } ;

test("일반 Hook 실패는 실제 사유를 보존하고 늦은 시작으로 지우지 않는다", () => {
  const failed     = event(2, "hook/completed", { threadId: "t", turnId: "a", run: hookRun })                                      ;
  const late       = event(3, "hook/started", { threadId: "t", turnId: "a", run: { ...hookRun, status: "running", entries: [] } }) ;
  const projection = projectNativeActivity([begin, failed, late], "t", "/repo")                                                    ;
  const hook       = projection.turns[0]?.entries[0]                                                                               ;
  expect(hook?.status               )    .toBe     ("failed"                                         ) ;
  expect(hook?.description          )    .toContain("신뢰 검토 필요"                                 ) ;
  expect(hook?.description          )    .toContain("plugin contents changed; hook approval required") ;
  expect(hook?.description          ).not.toContain("PRIVATE_CONTEXT_DO_NOT_RENDER"                  ) ;
  expect(projection.turns[0]?.status)    .toBe     ("running"                                        ) ;
});

test("WWW 역할·스킬이 먼저 보이고 범용 실패 목록과 모델은 기본 접힘이다", () => {
  const roleRead  = event               (2, "item/completed", { threadId: "t", turnId: "a", item: { id: "role", type: "commandExecution", cwd: "/repo", command: "cat AGENTS.md agents/www/AGENT.md", exitCode: 0 } }                     ) ;
  const skillRead = event               (3, "item/started", { threadId: "t", turnId: "a", item: { id: "skill", type: "commandExecution", cwd: "/repo", commandActions: [{ type: "read", path: "/repo/skills/www/www-build/SKILL.md" }] } }) ;
  const failed    = event               (4, "hook/completed", { threadId: "t", turnId: "a", run: hookRun }                                                                                                                                ) ;
  const html      = renderToStaticMarkup(createElement(NativeActivityView, { events: [begin, roleRead, skillRead, failed], threadId: "t", workspacePath: "/repo" })                                                                       ) ;
  expect(html                         )    .toContain   ("WWW 개발 흐름"                                                                 ) ;
  expect(html.indexOf("전용 에이전트"))    .toBeLessThan(html.indexOf("일반 Native 활동")                                                ) ;
  expect(html                         )    .toContain   ("www-dev"                                                                       ) ;
  expect(html                         )    .toContain   ("읽기 명령 관측"                                                                ) ;
  expect(html                         )    .toContain   ("www-build"                                                                     ) ;
  expect(html                         )    .toContain   ("읽는 중"                                                                       ) ;
  expect(html).toContain("Hook 관측 · 호출 횟수 미제공 · 실패 관측 · 신뢰 검토 필요");
  expect(html).not.toContain("Hook 1건 · 실패 1건");
  expect(html                         )    .toMatch     (/<details class="www-native-details"[^>]*data-testid="native-activity-details">/) ;
  expect(html                         )    .toContain   ("실제 역할·스킬 적용을 확인한 근거가 없으면 완료로 추정하지 않습니다"           ) ;
  expect(html                         ).not.toContain   ("PRIVATE_CONTEXT_DO_NOT_RENDER"                                                 ) ;
});

function resourceSidebar(events: readonly AppEvent[], sending = false, threadId: string | null = "t") {
  return renderToStaticMarkup(createElement(ResourceActivitySidebar, { events, resources: null, threadId, workspacePath: "/repo", sending, hidden: false, onOpenMonitor: () => {} }));
}

const hookScopes = [
  { name: "현재 턴", params: { threadId: "t", turnId: "a" }, heading: "현재 요청" },
  { name: "턴 미연결", params: { threadId: "t" }, heading: "턴 미연결 Hook" },
  { name: "대화 경계 미제공", params: {}, heading: "대화 경계 미제공 Hook" },
];

for (const scope of hookScopes) {
  test(`${scope.name} Hook은 동명 핸들러의 실패와 완료를 각각 표시하고 원문은 숨긴다`, () => {
    const first = { ...hookRun, id: "handler-a", sourcePath: "/plugin/a.json", displayOrder: 1, command: "PRIVATE_COMMAND", env: { SECRET: "PRIVATE_ENV" }, statusMessage: "PRIVATE_STATUS" };
    const second = { ...first, id: "handler-b", sourcePath: "/plugin/b.json", displayOrder: 2, status: "completed" };
    const html = resourceSidebar([
      begin,
      event(2, "hook/completed", { ...scope.params, run: first }),
      event(3, "hook/completed", { ...scope.params, run: second }),
    ]);
    expect(html).toContain(scope.heading);
    const rows = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? [];
    expect(rows.length).toBe(2);
    expect(rows.find((row) => row.includes("/plugin/a.json"))).toContain("실패 관측");
    expect(rows.find((row) => row.includes("/plugin/b.json"))).toContain("완료 관측");
    expect(html).toContain("표시 순서 1");
    expect(html).toContain("표시 순서 2");
    expect(html).toContain("호출 횟수 미제공");
    expect(html).not.toMatch(/Hook [12]건|호출 [12]회/);
    for (const raw of ["PRIVATE_CONTEXT_DO_NOT_RENDER", "PRIVATE_COMMAND", "PRIVATE_ENV", "PRIVATE_STATUS", "plugin contents changed; hook approval required"]) expect(html).not.toContain(raw);
  });

  test(`${scope.name} Hook의 ID 미제공 합침과 완료 뒤 시작의 불확실성을 명시한다`, () => {
    const { id, ...anonymous } = hookRun;
    const html = resourceSidebar([
      begin,
      event(2, "hook/completed", { ...scope.params, run: anonymous }),
      event(3, "hook/completed", { ...scope.params, run: { ...anonymous, status: "completed" } }),
      event(4, "hook/started", { ...scope.params, run: { ...anonymous, status: "running" } }),
    ]);
    expect(html).toContain("핸들러 식별 미제공 · 마지막 관측 · 동명 핸들러 합침 가능");
    expect(html).toContain("진행 관측");
    expect(html).not.toContain("완료 관측");
    expect(html).toContain("늦은 시작인지 새 호출인지 구별할 수 없습니다");
    expect(html.match(/<li\b/g)?.length).toBe(1);
  });

  test(`${scope.name}의 반복 핸들러는 호출 수 대신 마지막 과거 상태를 표시한다`, () => {
    const html = resourceSidebar([
      { ...begin, historical: true },
      { ...event(2, "hook/completed", { ...scope.params, run: hookRun }), historical: true },
      { ...event(3, "hook/started", { ...scope.params, run: { ...hookRun, status: "running" } }), historical: true },
    ]);
    expect(html).toContain("반복 핸들러 식별자 · 마지막 관측");
    expect(html).toContain("과거 진행 · 현재 결과 미확인");
    expect(html).toContain("복원 이력");
    expect(html).not.toContain("실패 관측");
    expect(html.match(/<li\b/g)?.length).toBe(1);
  });
}

test("리소스 사이드바 Hook은 다른 턴·대화와 섞이지 않고 명시 범위를 유지한다", () => {
  const html = resourceSidebar([
    event(1, "turn/started", { threadId: "t", turn: { id: "old" } }),
    event(2, "hook/completed", { threadId: "t", turnId: "old", run: { ...hookRun, eventName: "OLD_TURN_HOOK" } }),
    event(3, "turn/started", { threadId: "other", turn: { id: "a" } }),
    event(4, "hook/completed", { threadId: "other", turnId: "a", run: { ...hookRun, eventName: "OTHER_THREAD_HOOK" } }),
    event(5, "hook/completed", { threadId: "other", run: { ...hookRun, eventName: "OTHER_SESSION_HOOK" } }),
    event(6, "turn/started", { threadId: "t", turn: { id: "a" } }),
    event(7, "hook/completed", { threadId: "t", turnId: "a", run: { ...hookRun, eventName: "CURRENT_HOOK" } }),
    event(8, "hook/completed", { threadId: "t", run: { ...hookRun, eventName: "SESSION_HOOK" } }),
    event(9, "hook/completed", { turnId: "unowned", run: { ...hookRun, eventName: "UNSCOPED_HOOK" } }),
  ]);
  for (const excluded of ["OLD_TURN_HOOK", "OTHER_THREAD_HOOK", "OTHER_SESSION_HOOK"]) expect(html).not.toContain(excluded);
  for (const included of ["CURRENT_HOOK", "SESSION_HOOK", "UNSCOPED_HOOK"]) expect(html).toContain(included);
  expect(html).toContain("현재 요청의 성공 여부에 귀속하지 않습니다");
  expect(html).toContain("현재 대화·턴이나 누적 원장에 귀속하지 않습니다");
});

test("전송 중에는 과거 요청의 계획·호출을 현재 요청으로 표시하지 않는다", () => {
  const events = [
    begin,
    event(2, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "OLD_PLAN", status: "completed" }] }),
    event(3, "hook/completed", { threadId: "t", turnId: "a", run: { ...hookRun, eventName: "OLD_CALL" } }),
  ];
  const before = resourceSidebar(events);
  expect(before).toContain("OLD_PLAN");
  expect(before).toContain("OLD_CALL");
  const sending = resourceSidebar(events, true);
  expect(sending).toContain("새 요청을 보내고 있습니다");
  expect(sending).not.toContain("OLD_PLAN");
  expect(sending).not.toContain("OLD_CALL");
});

test("대화 미선택 시에도 경계 미제공 Hook만 별도 표시한다", () => {
  const html = resourceSidebar([
    begin,
    event(2, "hook/completed", { threadId: "t", turnId: "a", run: { ...hookRun, eventName: "SCOPED_CALL" } }),
    event(3, "hook/completed", { run: { ...hookRun, eventName: "UNSCOPED_CALL" } }),
  ], false, null);
  expect(html).not.toContain("SCOPED_CALL</strong>");
  expect(html).toContain("UNSCOPED_CALL");
  expect(html).toContain("대화 경계 미제공 Hook");
});
