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
  expect(html                         )    .toContain   ("Hook 관측 · 호출 횟수 미제공 · 실패 관측 · 신뢰 검토 필요"                     ) ;
  expect(html                         ).not.toContain   ("Hook 1건 · 실패 1건"                                                           ) ;
  expect(html                         )    .toMatch     (/<details class="www-native-details"[^>]*data-testid="native-activity-details">/) ;
  expect(html                         )    .toContain   ("실제 역할·스킬 적용을 확인한 근거가 없으면 완료로 추정하지 않습니다"           ) ;
  expect(html                         ).not.toContain   ("PRIVATE_CONTEXT_DO_NOT_RENDER"                                                 ) ;
});

function resourceSidebar(events: readonly AppEvent[], sending = false, threadId: string | null = "t") {
  return renderToStaticMarkup(createElement(ResourceActivitySidebar, { events, resources: null, threadId, workspacePath: "/repo", sending, hidden: false, onOpenMonitor: () => {} }));
}

test("기본 Agent 개요는 고정 Skills 다섯 개와 계획을 보이고 Hook은 상세에서만 보존한다", () => {
  const events = [
    begin,
    event(2, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "현재 계획", status: "inProgress" }] }),
    event(3, "hook/completed", { threadId: "t", turnId: "a", run: hookRun }),
  ];
  const sidebar = resourceSidebar(events);
  expect(sidebar.match(/data-skill-id=/g)?.length).toBe(5);
  for (const name of ["www-spec", "www-design", "www-build", "www-diagnose", "www-verify"]) expect(sidebar).toContain(name);
  expect(sidebar)    .toContain('data-testid="agent-tree"'    ) ;
  expect(sidebar)    .toContain('data-testid="agent-plan"'    ) ;
  expect(sidebar)    .toContain('data-testid="agent-progress"') ;
  expect(sidebar)    .toContain("현재 계획"                   ) ;
  expect(sidebar).not.toContain("postToolUse"                 ) ;
  expect(sidebar).not.toContain("/plugin/hooks.json"          ) ;
  const detail = renderToStaticMarkup(createElement(NativeActivityView, { events, threadId: "t", workspacePath: "/repo" }));
  expect(Array.from(detail.matchAll(/data-artifact-id="([^"]+)"/g), ([, id]) => id)).toEqual([
    "www-dev", "www-design-agent",
    "www-spec", "www-design", "www-build", "www-diagnose", "www-verify", "www-commit",
  ]);
  expect(detail)    .toContain("postToolUse"                  ) ;
  expect(detail)    .toContain("실패 관측"                    ) ;
  expect(detail).not.toContain("PRIVATE_CONTEXT_DO_NOT_RENDER") ;
});

test("전송 중에는 과거 요청의 계획을 새 요청으로 표시하지 않는다", () => {
  const events = [
    begin,
    event(2, "turn/plan/updated", { threadId: "t", turnId: "a", plan: [{ step: "OLD_PLAN", status: "completed" }] }),
    event(3, "hook/completed", { threadId: "t", turnId: "a", run: { ...hookRun, eventName: "OLD_CALL" } }),
  ];
  expect(resourceSidebar(events)).toContain("OLD_PLAN");
  const sending = resourceSidebar(events, true);
  expect(sending)    .toContain("새 요청을 보내고 있습니다") ;
  expect(sending).not.toContain("OLD_PLAN"                 ) ;
  expect(sending).not.toContain("OLD_CALL"                 ) ;
});

test("대화 경계가 있거나 없는 Hook 모두 기본 Agent 개요에 표시하지 않는다", () => {
  const events = [
    begin,
    event(2, "hook/completed", { threadId: "t", turnId: "a", run: { ...hookRun, eventName: "SCOPED_CALL" } }),
    event(3, "hook/completed", { run: { ...hookRun, eventName: "UNSCOPED_CALL" } }),
  ];
  for (const threadId of ["t", null]) {
    const sidebar = resourceSidebar(events, false, threadId);
    expect(sidebar).not.toContain("SCOPED_CALL");
    expect(sidebar).not.toContain("UNSCOPED_CALL");
  }
});
