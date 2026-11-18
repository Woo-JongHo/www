/** @verifies RESP-BLUEPRINT-LAYOUT */
import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { developmentStatechart, statechartSnapshotState, workflowEvidenceState, workflowModelFor, readWorkflowReport, type WorkflowEvidence, type WorkflowReportDocument } from "../src/workflow-statechart";
import { WorkflowStatechartView } from "../src/workflow-statechart-view";

const base: WorkflowEvidence = { workId: "work-example", status: "verifying", canComplete: false, reasons: [], sourceDigest: "source-digest" };
function render(options: { evidence?: WorkflowEvidence; empty?: boolean; stale?: boolean; report?: WorkflowReportDocument } = {}) {
  return renderToStaticMarkup(createElement(WorkflowStatechartView, { model: options.empty ? null : developmentStatechart, snapshotState: options.stale ? "stale" : "unverified", modelDigest: "model-digest", sourceDigest: "source-digest", onClose() {}, onReadEvidence: async () => base, initialEvidence: options.evidence, onReadReport: async () => ({ document: null, repository: "fixture", warnings: [] }), initialReport: options.report }));
}
describe("상태도 근거의 표시 경계", () => {
  test("같은 책임 ID에서만 모델을 제공하고 없는 모델을 안내한다", () => {
    expect(workflowModelFor("arch.development.records.state")).toBe(developmentStatechart);
    expect(workflowModelFor("arch.chat")).toBeNull();
    expect(render({ empty: true })).toContain("이 책임에는 상태 모델이 등록되지 않았습니다");
    expect(render({ empty: true })).toContain("원래 지도로 돌아가기");
  });
  test("정상 정의·전이·근거·반례를 제공하며 실행 미확인을 통과로 표시하지 않는다", () => {
    const html = render();
    expect(html).toContain("검증 미실행");
    expect(html).toContain("실행 근거 없음");
    expect(html).toContain("조건과 규칙");
    expect(html).toContain("scripts/workflow/work.ts");
    expect(html).toContain("반례와 재현 근거");
    expect(html).toContain("실시간 실행 상태나 형식 증명이 아닙니다");
    expect(html).not.toContain("검증 완료");
  });
  test("실행 미확인·실패·오래됨·완료 허용을 나눠 표시한다", () => {
    expect(workflowEvidenceState(null)).toBe("missing");
    expect(workflowEvidenceState(base)).toBe("unverified");
    expect(workflowEvidenceState({ ...base, reasons: ["verification_failed"] })).toBe("failed");
    expect(workflowEvidenceState({ ...base, canComplete: true, reasons: ["source_changed"] })).toBe("stale");
    expect(render({ stale: true, evidence: { ...base, reasons: ["source_changed"] } })).toContain("오래된 검증");
    expect(render({ evidence: { ...base, reasons: ["verification_failed"] } })).toContain("검증 실패");
    const current = render({ evidence: { ...base, canComplete: true } });
    expect(current).toContain("현재 업무 완료 허용");
    expect(current).toContain("검증 시도 ID·방법·실행 환경·스크린샷이 포함되지 않습니다");
    expect(current).not.toContain("검증 완료");
  });
  test("같은 UUID의 저작 보고서를 우선 읽고 안전한 iframe에서 현재성을 분리한다", async () => {
    const document: WorkflowReportDocument = { report: { id: "authored", workId: "work-example", title: "검증 보고서", kind: "authored", createdAt: "2026-11-16" }, html: "<p>attempt-1 · injected · linux fixture</p>", current: false, stale: true, reasons: ["source_changed"] };
    const readIds: string[] = [];
    const api = { workspace: async () => ({ path: "fixture", workspaceKey: "fixture-key", selectionEpoch: 1, processEpoch: "process" }), listReports: async () => ({ repository: "fixture", reports: [
      { id: "other", workId: "work-other", kind: "authored", createdAt: "2026-11-18" },
      { id: "snapshot", workId: "work-example", kind: "snapshot", createdAt: "2026-11-17" },
      { id: "authored", workId: "work-example", kind: "authored", createdAt: "2026-11-16" },
    ], warnings: ["fixture warning"] }), readReport: async (id: string) => { readIds.push(id); return document; } };
    const result = await readWorkflowReport(api, "work-example");
    expect(readIds).toEqual(["authored"]);
    expect(result.warnings).toEqual(["fixture warning"]);
    expect((await readWorkflowReport(api, "missing")).document).toBeNull();
    await expect(readWorkflowReport({ ...api, readReport: async () => ({ ...document, report: { ...document.report, workId: "wrong" } }) }, "work-example")).rejects.toThrow("연결이 다릅니다");
    await expect(readWorkflowReport({ ...api, workspace: async () => ({ path: "other-project", workspaceKey: "other", selectionEpoch: 1, processEpoch: "process" }) }, "work-example")).rejects.toThrow("현재 탭의 프로젝트와 다릅니다");
    let workspaceReads = 0;
    await expect(readWorkflowReport({ ...api, workspace: async () => ({ path: "fixture", workspaceKey: "fixture-key", selectionEpoch: ++workspaceReads, processEpoch: "process" }) }, "work-example")).rejects.toThrow("선택이 바뀌었습니다");
    let catalogReads = 0;
    await expect(readWorkflowReport({ ...api, listReports: async () => ({ ...await api.listReports(), repository: ++catalogReads === 1 ? "fixture" : "other-project" }) }, "work-example")).rejects.toThrow("선택이 바뀌었습니다");
    const html = render({ report: document });
    expect(html).toContain("오래된 보고서");
    expect(html).toContain('sandbox=""');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain("attempt-1 · injected · linux fixture");
  });
  test("생성 검사 자료가 없거나 모델·소스가 달라지면 현행 결과로 승격하지 않는다", () => {
    expect(statechartSnapshotState({}).state).toBe("missing");
    const snapshot = { statecharts: { models: [developmentStatechart], modelDigest: "model", sourceDigest: "source", sources: [{ file: "work.ts", digest: "old" }] }, nodes: [{ file: "work.ts", digest: "new" }] };
    expect(statechartSnapshotState(snapshot).state).toBe("stale");
    snapshot.nodes[0]!.digest = "old";
    expect(statechartSnapshotState(snapshot).state).toBe("unverified");
    snapshot.statecharts.models = [];
    expect(statechartSnapshotState(snapshot).state).toBe("stale");
  });
});
