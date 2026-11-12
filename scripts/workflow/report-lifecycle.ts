import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assessWork, completeWork, readWork, type WorkAssessment, type WorkOptions } from "./work.ts";
import { withWorkLock } from "./lock.ts";
import { captureWorkReport, listWorkReports, parseReportReader, publishWorkReport, readWorkReport, type ReportNarrative } from "./reports.ts";

type JsonObject = Record<string, unknown>;
export type ReportHookResult = {
  status   : "written" ;
  reportId : string    ;
  created  : boolean   ;
} | {
  status  : "failed" ;
  message : string   ;
};

function object(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 문자열이 필요합니다.`);
  return value;
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) throw new Error(`${field} 문자열 배열이 필요합니다.`);
  return value;
}

function narrative(value: unknown): ReportNarrative {
  if (!object(value)) throw new Error("작성자의 보고서 서술 객체가 필요합니다.");
  return {
    summary     : text(value.summary, "summary")            ,
    before      : text(value.before, "before")              ,
    after       : text(value.after, "after")                ,
    changes     : strings(value.changes, "changes")         ,
    decisions   : strings(value.decisions, "decisions")     ,
    limitations : strings(value.limitations, "limitations") ,
    next        : strings(value.next, "next")               ,
    ...(value.reader === undefined ? {} : { reader: parseReportReader(value.reader) }),
  };
}

async function enableReports(options: WorkOptions, failure?: string): Promise<void> {
  await withWorkLock(options.repo ?? process.cwd(), async () => {
    const work = await readWork(options);
    if (work.record.schemaVersion !== 2 || !work.record.workflow) return;
    work.record.workflow.reportingRequired = true;
    if (failure) work.record.blockedReason = failure;
    const temporary = `${work.path}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(work.record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, work.path);
  });
}

export async function captureReportHook(options: WorkOptions & { event: string }): Promise<ReportHookResult> {
  try {
    const result = await captureWorkReport(options);
    return { status: "written", reportId: result.report.id, created: result.created };
  } catch (error) {
    return { status: "failed", message: `작업 기록은 저장됐지만 보고서 생성에 실패했습니다: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function finishWorkReport(options: WorkOptions & { narrative: unknown }) {
  const content = narrative(options.narrative);
  await enableReports(options);
  return withWorkLock(options.repo ?? process.cwd(), () => publishWorkReport({ ...options, narrative: content, event: "finish" }));
}

export async function assessReportedWork(options: WorkOptions): Promise<WorkAssessment> {
  const assessment = await assessWork(options);
  if (!assessment.record.workflow?.reportingRequired) return assessment;
  const repo    = options.repo ?? process.cwd()                                                                                                ;
  const reports = (await listWorkReports({ repo })).reports.filter((report) => report.workId === options.workId && report.kind === "authored") ;
  let reportId: string | undefined                                                                                                             ;
  for (const report of reports) {
    const document = await readWorkReport({ repo, reportId: report.id });
    if (!document.stale && (document.current || assessment.record.status === "done")) { reportId = report.id; break; }
  }
  const reasons = reportId ? [] : ["현재 소스·기준·기록의 저작 작업 보고서 없음"];
  return { ...assessment, report: { usable: !!reportId, reasons, reportId }, complete: assessment.complete && !!reportId, reasons: [...assessment.reasons, ...reasons] };
}

export async function completeReportedWork(options: WorkOptions) {
  await enableReports(options);
  const assessment = await assessReportedWork(options);
  if (!assessment.complete) throw new Error(`현재 증거로 완료할 수 없습니다: ${assessment.reasons.join("; ")}`);
  const listed = await listWorkReports({ repo: options.repo })     ;
  const id     = assessment.report?.reportId                       ;
  const prior  = listed.reports.find((report) => report.id === id) ;
  if (!prior) throw new Error("완료할 작업의 저작 보고서를 찾지 못했습니다.");
  const document = await readWorkReport({ repo: options.repo, reportId: prior.id }) ;
  const saved    = await completeWork(options)                                      ;
  let reportHook: ReportHookResult                                                  ;
  try {
    if (!document.report.narrative) throw new Error("저작 서술이 없습니다.");
    const result = await publishWorkReport({ ...options, narrative: document.report.narrative, event: "complete" });
    reportHook = { status: "written", reportId: result.report.id, created: result.created };
  } catch (error) { reportHook = { status: "failed", message: `업무 완료 기록은 저장됐지만 보고서 갱신에 실패했습니다: ${error instanceof Error ? error.message : String(error)}` }; }
  return { ...saved, reportHook };
}

function workId(options: JsonObject, result?: JsonObject): string | undefined {
  const decision = object(options.decision) ? options.decision : {}                                   ;
  const binding  = object(options.binding) ? options.binding : {}                                     ;
  const work     = result && object(result.work) ? result.work : {}                                   ;
  const record   = object(work.record) ? work.record : {}                                             ;
  const value    = result?.workId ?? record.id ?? options.workId ?? decision.workId ?? binding.workId ;
  return typeof value === "string" ? value : undefined;
}

async function requestWorkId(repo: string, requestId: unknown): Promise<string | undefined> {
  if (typeof requestId !== "string")                                    return undefined;
  const root      = await fs.realpath(repo)         ;
  const directory = path.join(root, "docs", "work") ;
  if (!(await fs.lstat(directory)).isDirectory())                       return undefined;
  if (!(await fs.realpath(directory)).startsWith(`${root}${path.sep}`)) return undefined;
  const matches: string[] = [];
  for (const area of await fs.readdir(directory, { withFileTypes: true })) {
    if (!area.isDirectory() || area.isSymbolicLink()) continue;
    const areaPath = path.join(directory, area.name);
    for (const entry of await fs.readdir(areaPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const file = path.join(areaPath, entry.name, "work.json");
      try {
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1_048_576) continue;
        const value: unknown = JSON.parse(await fs.readFile(file, "utf8"));
        if (object(value) && typeof value.id === "string" && object(value.workflow) && value.workflow.requestId === requestId) matches.push(value.id);
      } catch { /* 실패한 레코드를 다른 작업의 근거로 사용하지 않는다. */ }
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

export async function runReportedStage(options: JsonObject, invoke: () => Promise<JsonObject>): Promise<JsonObject> {
  const binding  = object(options.binding) ? options.binding : {}                                                                    ;
  const repo     = typeof options.repo === "string" ? options.repo : typeof binding.repo === "string" ? binding.repo : process.cwd() ;
  const decision = object(options.decision) ? options.decision : {}                                                                  ;
  const intent   = decision.intent ?? options.intent                                                                                 ;
  const id       = workId(options)                                                                                                   ;
  if (options.action === "report"                                                ) return { ...await finishWorkReport({ repo, workId: text(id, "workId"), narrative: options.narrative }) };
  if (options.action === "report-snapshot"                                       ) return { reportHook: await captureReportHook({ repo, workId: text(id, "workId"), event: text(options.event, "event") }) };
  if (options.action === "report-status"                                         ) return { ...await assessReportedWork({ repo, workId: text(id, "workId") }) };
  if (options.action === "report-complete"                                       ) return { ...await completeReportedWork({ repo, workId: text(id, "workId") }) };
  if (options.preview === true || options.execute !== true || intent === "answer") return invoke();
  if (options.role === "www-dev" && intent === "complete" && id                  ) return { executed: true, work: await completeReportedWork({ repo, workId: id }) };
  try {
    const result    = await invoke()          ;
    const currentId = workId(options, result) ;
    if (!currentId || result.executed !== true || options.role !== "www-dev") return result;
    const host   = object(result.host) ? result.host : {} ;
    const failed = host.ok === false                      ;
    await enableReports({ repo, workId: currentId }, failed ? `개발 호스트 실행 실패: ${String(host.outcome ?? "결과 미확인").slice(0, 160)}` : undefined);
    const reportHook = await captureReportHook({ repo, workId: currentId, event: failed ? "host_failed" : typeof intent === "string" ? intent : "host_finished" });
    return { ...result, reportHook };
  } catch (error) {
    const failedId = id ?? await requestWorkId(repo, options.requestId).catch(() => undefined);
    if (failedId) {
      await enableReports({ repo, workId: failedId }, "개발 하네스가 오류로 종료됐습니다.").catch(() => undefined);
      const reportHook = await captureReportHook({ repo, workId: failedId, event: "host_exception" });
      throw new Error(`${error instanceof Error ? error.message : String(error)}; 보고서 훅 ${JSON.stringify(reportHook)}`, { cause: error });
    }
    throw error;
  }
}
