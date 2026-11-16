/**
 * @architecture arch.reports.service
 * @implements RESP-REPORTS-SERVICE
 */
import { listWorkReports, readWorkReport } from "../scripts/workflow/reports.ts";
import type { WorkReportCatalog, WorkReportDocument, WorkReportSummary } from "./shared";

const REPORT_ID = /^report-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createReportService({ workspace }: { workspace(): string }) {
  async function list(): Promise<WorkReportCatalog> {
    const repository = workspace();
    const catalog = await listWorkReports({ repo: repository });
    const groups = new Map<string, WorkReportSummary>();
    for (const report of catalog.reports) {
      const key = JSON.stringify([report.workId, report.title.normalize("NFC")]);
      const current = groups.get(key);
      if (!current || (current.kind === "snapshot" && report.kind === "authored")) groups.set(key, report);
    }
    const reports = [...groups.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
    return { repository, reports, warnings: catalog.warnings };
  }

  async function read(value: unknown): Promise<WorkReportDocument> {
    if (typeof value !== "string" || !REPORT_ID.test(value)) throw new Error("보고서 ID가 올바르지 않습니다.");
    return readWorkReport({ repo: workspace(), reportId: value.toLowerCase() });
  }

  return { list, read };
}
