import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionTabs, sessionTabDestination } from "../src/session-tabs";
import type { NativeSessionSummary } from "../src/shared";

const workspace = { name: "프로젝트", path: "/repo", branch: null, changes: 0, workspaceKey: "repo", selectionEpoch: 1, processEpoch: "p" };
const tab = (id: string, extra: Partial<NativeSessionSummary> = {}): NativeSessionSummary => ({ id, title: id, workspace, threadId: null, busy: false, approvalCount: 0, failed: false, compaction: { state: "idle" }, ...extra });
const render = (tabs: NativeSessionSummary[], activeId: string, canClose?: (id: string) => { allowed: boolean; reason?: string }) => renderToStaticMarkup(createElement(SessionTabs, { tabs, activeId, creating: false, onSelect: () => {}, onCreate: () => {}, onClose: () => {}, canClose }));

test("탭의 선택과 패널 연결, 실제 상태 및 닫기 제한을 제공한다", () => {
  const html = render([tab("a", { busy: true, approvalCount: 1 }), tab("b", { failed: true })], "b", (id) => id === "b" ? { allowed: false, reason: "초안이 있습니다." } : { allowed: true });
  const first = html.match(/<button[^>]*id="session-tab-a"[^>]*>/)?.[0] ?? "";
  const second = html.match(/<button[^>]*id="session-tab-b"[^>]*>/)?.[0] ?? "";
  for (const attribute of ['aria-controls="session-panel-a"', 'aria-selected="false"', 'tabindex="-1"', 'aria-describedby="session-close-reason-a"']) expect(first).toContain(attribute);
  for (const attribute of ['aria-controls="session-panel-b"', 'aria-selected="true"', 'tabindex="0"', 'aria-describedby="session-close-reason-b"']) expect(second).toContain(attribute);
  expect(html).toContain("실행 중");
  expect(html).toContain("승인 1");
  expect(html).toContain("실패");
  expect(html).toMatch(/aria-label="a 탭 닫기: 승인 요청을 처리한 뒤 닫을 수 있습니다\."[^>]*disabled/);
  expect(html).toMatch(/aria-label="b 탭 닫기: 초안이 있습니다\."[^>]*disabled/);
});

test("마지막 탭은 닫을 수 없고 방향키는 목록 끝에서 순환한다", () => {
  expect(render([tab("a")], "a")).toMatch(/aria-label="a 탭 닫기: 마지막 탭은 닫을 수 없습니다\."[^>]*disabled/);
  expect(sessionTabDestination("ArrowRight", 2, 3)).toBe(0);
  expect(sessionTabDestination("ArrowLeft", 0, 3)).toBe(2);
  expect(sessionTabDestination("Home", 1, 3)).toBe(0);
  expect(sessionTabDestination("End", 1, 3)).toBe(2);
  expect(sessionTabDestination("Enter", 1, 3)).toBeNull();
  expect(sessionTabDestination("ArrowLeft", 0, 0)).toBeNull();
});
