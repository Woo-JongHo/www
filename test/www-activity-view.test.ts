import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NativeActivityView } from "../src/native-activity-view";
import { projectNativeActivity } from "../src/native-activity";
import type { AppEvent } from "../src/shared";

function event(seq: number, method: string, params: unknown): AppEvent {
  return { seq, method, params, kind: "notification", at: "2026-11-13T02:12:00Z" };
}

const begin = event(1, "turn/started", { threadId: "t", turn: { id: "a" } });
const hookRun = { id: "h", eventName: "postToolUse", executionMode: "sync", status: "failed", sourcePath: "/plugin/hooks.json", entries: [{ kind: "error", text: "plugin contents changed; hook approval required" }, { kind: "context", text: "PRIVATE_CONTEXT_DO_NOT_RENDER" }] };

test("일반 Hook 실패는 실제 사유를 보존하고 늦은 시작으로 지우지 않는다", () => {
  const failed = event(2, "hook/completed", { threadId: "t", turnId: "a", run: hookRun });
  const late = event(3, "hook/started", { threadId: "t", turnId: "a", run: { ...hookRun, status: "running", entries: [] } });
  const projection = projectNativeActivity([begin, failed, late], "t", "/repo");
  const hook = projection.turns[0]?.entries[0];
  expect(hook?.status).toBe("failed");
  expect(hook?.description).toContain("신뢰 검토 필요");
  expect(hook?.description).toContain("plugin contents changed; hook approval required");
  expect(hook?.description).not.toContain("PRIVATE_CONTEXT_DO_NOT_RENDER");
  expect(projection.turns[0]?.status).toBe("running");
});

test("WWW 역할·스킬이 먼저 보이고 범용 실패 목록과 모델은 기본 접힘이다", () => {
  const roleRead = event(2, "item/completed", { threadId: "t", turnId: "a", item: { id: "role", type: "commandExecution", cwd: "/repo", command: "cat AGENTS.md agents/www/AGENT.md", exitCode: 0 } });
  const skillRead = event(3, "item/started", { threadId: "t", turnId: "a", item: { id: "skill", type: "commandExecution", cwd: "/repo", commandActions: [{ type: "read", path: "/repo/skills/www/www-build/SKILL.md" }] } });
  const failed = event(4, "hook/completed", { threadId: "t", turnId: "a", run: hookRun });
  const html = renderToStaticMarkup(createElement(NativeActivityView, { events: [begin, roleRead, skillRead, failed], threadId: "t", workspacePath: "/repo" }));
  expect(html).toContain("WWW 개발 흐름");
  expect(html.indexOf("전용 에이전트")).toBeLessThan(html.indexOf("일반 Native 활동"));
  expect(html).toContain("www-dev");
  expect(html).toContain("읽기 명령 관측");
  expect(html).toContain("www-build");
  expect(html).toContain("읽는 중");
  expect(html).toContain("Hook 1건 · 실패 1건");
  expect(html).toMatch(/<details class="www-native-details"[^>]*data-testid="native-activity-details">/);
  expect(html).toContain("실제 역할·스킬 적용을 확인한 근거가 없으면 완료로 추정하지 않습니다");
  expect(html).not.toContain("PRIVATE_CONTEXT_DO_NOT_RENDER");
});
