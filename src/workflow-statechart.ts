/**
 * @architecture arch.blueprint.layout
 * @implements RESP-BLUEPRINT-LAYOUT
 */
import definition from "../docs/architecture/statecharts/development-work.json";

export const developmentStatechart = definition;
export type WorkflowStatechart = typeof definition;
export interface WorkflowEvidence {
  workId: string;
  status: string;
  canComplete: boolean;
  reasons: string[];
  sourceDigest: string | null;
}
export type WorkflowEvidenceState = "missing" | "unverified" | "failed" | "stale" | "current";
export function workflowEvidenceState(evidence: WorkflowEvidence | null): WorkflowEvidenceState {
  if (!evidence) return "missing";
  if (evidence.reasons.some(reason => /source_changed|scope_changed|criteria_changed|stale|오래|달라|바뀌/.test(reason))) return "stale";
  if (evidence.reasons.some(reason => /verification_failed|검증 실패/.test(reason))) return "failed";
  return evidence.canComplete ? "current" : "unverified";
}
export const workflowEvidenceLabels: Record<WorkflowEvidenceState, string> = {
  missing: "실행 근거 없음", unverified: "검증 미실행 또는 수용 미충족", failed: "검증 실패", stale: "오래된 검증", current: "현재 업무 완료 허용",
};
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
/** 번들의 식별 대조이며 선택 저장소의 실시간 소스 검사나 행동 검증 결과가 아니다. */
export function statechartSnapshotState(snapshot: unknown): { state: "missing" | "stale" | "unverified"; modelDigest: string | null; sourceDigest: string | null } {
  if (!object(snapshot) || !object(snapshot.statecharts)) return { state: "missing", modelDigest: null, sourceDigest: null };
  const data = snapshot.statecharts;
  const modelDigest = typeof data.modelDigest === "string" ? data.modelDigest : null;
  const sourceDigest = typeof data.sourceDigest === "string" ? data.sourceDigest : null;
  const matchingModel = Array.isArray(data.models) && data.models.some(model => JSON.stringify(model) === JSON.stringify(definition));
  const sources = data.sources;
  const nodes = snapshot.nodes;
  const matchingSources = Array.isArray(sources) && sources.length > 0 && Array.isArray(nodes) && sources.every(source => object(source) && (String(source.file).startsWith("test/") || nodes.some(node => object(node) && node.file === source.file && node.digest === source.digest)));
  return { state: matchingModel && matchingSources && modelDigest && sourceDigest ? "unverified" : "stale", modelDigest, sourceDigest };
}
export function workflowModelFor(structureId: string): WorkflowStatechart | null {
  return structureId === definition.structureId ? definition : null;
}

export interface WorkflowReportDocument {
  report: { id: string; workId: string; title: string; kind: string; createdAt: string };
  html: string;
  current: boolean;
  stale: boolean;
  reasons: string[];
}
interface WorkflowReportApi {
  workspace(): Promise<{ path: string; workspaceKey: string; selectionEpoch: number; processEpoch: string }>;
  listReports(): Promise<{ repository: string; reports: { id: string; workId: string; kind: string; createdAt: string }[]; warnings: string[] }>;
  readReport(id: string): Promise<WorkflowReportDocument>;
}
/** 같은 작업의 저작 보고서를 우선 읽고, 없으면 실행 snapshot을 출처와 함께 제공한다. */
export async function readWorkflowReport(api: WorkflowReportApi, workId: string): Promise<{ document: WorkflowReportDocument | null; repository: string; warnings: string[] }> {
  const scope = await api.workspace();
  const catalog = await api.listReports();
  if (catalog.repository !== scope.path) throw new Error("보고서에서 선택한 프로젝트가 현재 탭의 프로젝트와 다릅니다. 현재 프로젝트의 실행 근거로 읽을 수 없습니다.");
  const reports = catalog.reports.filter(report => report.workId === workId).sort((a, b) => Number(b.kind === "authored") - Number(a.kind === "authored") || b.createdAt.localeCompare(a.createdAt));
  const selected = reports[0];
  if (!selected) return { document: null, repository: catalog.repository, warnings: catalog.warnings };
  const document = await api.readReport(selected.id);
  if (document.report.workId !== workId || document.report.id !== selected.id) throw new Error("선택한 작업과 보고서 연결이 다릅니다.");
  const [afterScope, afterCatalog] = await Promise.all([api.workspace(), api.listReports()]);
  if (afterScope.path !== scope.path || afterScope.workspaceKey !== scope.workspaceKey || afterScope.selectionEpoch !== scope.selectionEpoch || afterScope.processEpoch !== scope.processEpoch
    || afterCatalog.repository !== catalog.repository || !afterCatalog.reports.some(report => report.id === selected.id && report.workId === workId && report.createdAt === selected.createdAt)) throw new Error("보고서를 읽는 동안 프로젝트 또는 보고서 선택이 바뀌었습니다. 다시 조회하세요.");
  return { document, repository: catalog.repository, warnings: [...new Set([...catalog.warnings, ...afterCatalog.warnings])] };
}
