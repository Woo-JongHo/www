/**
 * @architecture arch.development.records.state
 * @implements RESP-DEVELOPMENT-RECORDS-STATE
 */
import { listWorkReports, readWorkReport } from "./reports.ts";
import type { ReportAssessment, WorkRecord } from "./types.ts";

/** 완료 core와 앱/CLI가 같은 현재 저작 보고서 조건을 소비한다. */
export async function assessCompletionReport(repo: string, record: WorkRecord): Promise<ReportAssessment | undefined> {
  if (!record.workflow?.reportingRequired) return undefined;
  const reports = (await listWorkReports({ repo })).reports.filter(report => report.workId === record.id && report.kind === "authored");
  for (const report of reports) {
    const document = await readWorkReport({ repo, reportId: report.id });
    if (!document.stale && document.current) return { usable: true, reasons: [], reportId: report.id };
  }
  return { usable: false, reasons: ["현재 소스·기준·기록의 저작 작업 보고서 없음"] };
}
