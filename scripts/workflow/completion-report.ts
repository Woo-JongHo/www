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
    // 완료 저장 자체가 원장 해시를 바꾼다. 이미 완료한 원장은 기존 소스/기준 현재성 계약을 유지한다.
    if (!document.stale && (document.current || record.status === "done")) return { usable: true, reasons: [], reportId: report.id };
  }
  return { usable: false, reasons: ["현재 소스·기준·기록의 저작 작업 보고서 없음"] };
}
