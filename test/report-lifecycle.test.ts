import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test, { type TestContext } from "node:test";
import { assessReportedWork, captureReportHook, completeReportedWork, finishWorkReport, runReportedStage } from "../scripts/workflow/report-lifecycle.ts";
import { listWorkReports, readWorkReport } from "../scripts/workflow/reports.ts";
import { assessWork, recordDocumentReview, recordReview } from "../scripts/workflow/work.ts";
import { loadReviewPolicy, runReview } from "../scripts/workflow/review.ts";
import { criteriaDigest } from "../scripts/workflow/evidence.ts";

const exec       = promisify   (execFile                                           ) ;
const workCli    = path.resolve(import.meta.dir, "../scripts/workflow/work.ts"     ) ;
const policyFile = path.resolve(import.meta.dir, "../agents/www/review-policy.json") ;

async function fixture(t: TestContext) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "www-report-hook-"));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  for (const directory of ["docs/work", "src", "agents/www"]) await fs.mkdir(path.join(repo, directory), { recursive: true });
  await fs.writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업 목차\n");
  await fs.writeFile(path.join(repo, "src/check.ts"), "export const value = 1;\n");
  await fs.copyFile(policyFile, path.join(repo, "agents/www/review-policy.json"));
  const base         = { repo, role: "www-dev", direct: true, requestId: "report-hook-case", request: "작업 보고서 연결 검증", inputs: ["src"], approval: { implementation: true, writePaths: ["src"], mutationSurfaces: ["edit"], verifierCommands: [JSON.stringify([process.execPath, "-e", "process.exit(0)"])], commit: false, publish: false }, decision: { intent: "build", area: "Reports", title: "보고서 훅 시험", criteria: [{ id: "AC-1", description: "실제 프로세스 검사와 보고서를 연결한다" }] } } ;
  const raw: unknown = JSON.parse((await exec(process.execPath, [workCli, JSON.stringify({ action: "open", ...base })])).stdout)                                                                                                                                                                                                                                                                                                                                                                                  ;
  if (!raw || typeof raw !== "object" || !("record" in raw) || !raw.record || typeof raw.record !== "object" || !("id" in raw.record) || typeof raw.record.id !== "string") throw new Error("작업 생성 결과 오류");
  const workId = raw.record.id;
  async function verify() {
    await exec(process.execPath, [workCli, JSON.stringify({ action: "verify", repo, workId, command: process.execPath, args: ["-e", "process.exit(0)"], criterionIds: ["AC-1"] })]);
    return { executed: true, workId, verification: { result: "passed" } };
  }
  return { repo, workId, verify };
}

const narrative = { summary: "실제 검사 결과를 보고서에 연결합니다.", before: "검사 결과가 작업 기록에만 있었습니다.", after: "앱에서 보고서로 읽습니다.", changes: ["보고서 수명주기 연결"], decisions: ["기존 core를 보존했습니다."], limitations: ["실제 모델 감사는 수행하지 않는 테스트입니다."], next: [], reader: {
  story        : "합성 작업에서 실행 결과를 읽기 쉽게 연결했습니다. 실제 업무나 모델 검토의 통과를 뜻하지 않습니다."                                                                                    ,
  requirements : [{ requirement: "보고서 보존", result: "상세 서술을 같은 작업에 저장합니다.", evidence: "실제 임시 저장소의 보고서 JSON을 읽습니다.", limitations: "합성 업무 자료입니다." }]          ,
  checks       : [{ target: "검사와 보고서 연결", method: "임시 저장소와 실제 Node 프로세스", expected: "검사 종료 뒤 보고서 생성", observed: null, limitations: "사용자 기능 수용 검사가 아닙니다." }] ,
  decisions: [], references: [{ path: "verification.md", purpose: "연결된 검사 시도 확인" }], nextActions: [],
} };

test("공식 단계의 실제 검사 후 보고서를 저장하고 반복 훅을 중복 억제한다", async (t) => {
  const { repo, workId, verify } = await fixture(t);
  const result = await runReportedStage({ repo, role: "www-dev", execute: true, workId, decision: { intent: "verify" } }, verify);
  assert.ok(result.reportHook && typeof result.reportHook === "object" && "reportId" in result.reportHook && typeof result.reportHook.reportId === "string");
  const saved = await readWorkReport({ repo, reportId: result.reportHook.reportId });
  assert.equal(saved.report.work.verifications.length, 1);
  assert.equal(saved.report.kind, "snapshot");
  const repeated = await captureReportHook({ repo, workId, event: "verify" });
  assert.equal(repeated.status, "written");
  assert.equal((await listWorkReports({ repo })).reports.length, 1);
  assert.equal((await assessReportedWork({ repo, workId })).report?.usable, false);
  await finishWorkReport({ repo, workId, narrative });
  assert.equal((await assessReportedWork({ repo, workId })).report?.usable, true);
  await fs.appendFile(path.join(repo, "src/check.ts"), "export const changed = true;\n");
  assert.equal((await assessReportedWork({ repo, workId })).report?.usable, false);
});

test("보고서 실패는 이미 저장된 검사를 지우거나 다시 실행하지 않는다", async (t) => {
  const { repo, workId, verify } = await fixture(t);
  const directory = path.join(repo, "docs/work/Reports/001-보고서 훅 시험/reports");
  await fs.writeFile(directory, "폴더를 막는 명시적 실패 fixture");
  const result = await runReportedStage({ repo, role: "www-dev", execute: true, workId, intent: "verify" }, verify);
  assert.ok(result.reportHook && typeof result.reportHook === "object" && "status" in result.reportHook);
  assert.equal(result.reportHook.status, "failed");
  const work: unknown = JSON.parse(await fs.readFile(path.join(repo, "docs/work/Reports/001-보고서 훅 시험/work.json"), "utf8"));
  assert.ok(work && typeof work === "object" && "workflow" in work && work.workflow && typeof work.workflow === "object" && "verifications" in work.workflow && Array.isArray(work.workflow.verifications));
  assert.equal(work.workflow.verifications.length, 1);
});

test("실패한 호스트는 완료로 꾸미지 않고 preview는 보고서를 쓰지 않는다", async (t) => {
  const { repo, workId } = await fixture(t);
  await runReportedStage({ repo, role: "www-dev", execute: true, preview: true, workId }, async () => ({ executed: false }));
  assert.equal((await listWorkReports({ repo })).reports.length, 0);
  await runReportedStage({ repo, role: "www-dev", execute: true, workId }, async () => ({ executed: true, workId, host: { ok: false, outcome: "fixture_nonzero" } }));
  const reports = await listWorkReports({ repo });
  assert.equal(reports.reports[0]?.outcome, "blocked");
  assert.equal(reports.reports[0]?.kind, "snapshot");
});

test("완료 조건은 저작을 요구하고 기존 서술에 실제 완료 상태를 새 이력으로 붙인다", async (t) => {
  const { repo, workId, verify } = await fixture(t);
  await runReportedStage({ repo, role: "www-dev", execute: true, workId, intent: "verify" }, verify);
  await recordDocumentReview({ repo, workId, documents: ["docs/PRODUCT.md", "docs/ARCHITECTURE.md", "docs/DEVELOPMENT.md", "docs/skills/WORKFLOW.md"].map((file) => ({ path: file, decision: "not_applicable", reason: "임시 fixture에 현행 정본이 없음" })) });
  const current = await assessWork({ repo, workId });
  assert.ok(!current.legacy);
  assert.ok(current.source);
  // 실제 Opus를 호출하지 않는 완료 predicate 단위 fixture다. 실제 감사 증거로 사용하지 않는다.
  const review = await runReview({ repo, source: current.source, criteriaDigest: criteriaDigest(current.record), policyInfo: await loadReviewPolicy({ root: repo }), run: async () => ({ code: 0, signal: null, error: null, stdout: JSON.stringify({ type: "result", is_error: false, structured_output: { verdict: "pass", findings: ["명시적인 단위 fixture"] }, modelUsage: { "claude-opus-unit-fixture": {} } }), stderr: "실제 모델 실행 아님" }) });
  await recordReview({ repo, workId, review: { ...review, executor: "process" } });
  await assert.rejects(completeReportedWork({ repo, workId }), /저작 작업 보고서/);
  const authored  = await finishWorkReport({ repo, workId, narrative }) ;
  const completed = await completeReportedWork({ repo, workId })        ;
  assert.equal(completed.record.status, "done");
  assert.equal(completed.reportHook.status, "written");
  if (completed.reportHook.status !== "written") throw new Error("완료 보고서가 없습니다.");
  const final = await readWorkReport({ repo, reportId: completed.reportHook.reportId });
  assert.notEqual(final.report.id, authored.report.id);
  assert.equal(final.report.kind, "authored");
  assert.equal(final.report.outcome, "completed");
  assert.equal(final.report.narrative?.summary, narrative.summary);
  assert.deepEqual(final.report.narrative?.reader, narrative.reader);
  assert.equal((await assessReportedWork({ repo, workId })).complete, true);
});

test("새 Node 프로세스의 공식 CLI가 검사 훅과 저작 보고서를 실제 수용한다", async (t) => {
  const { repo, workId } = await fixture(t);
  const cli = path.resolve(import.meta.dir, "../scripts/workflow.ts");
  await exec(process.execPath, [cli, JSON.stringify({ repo, role: "www-dev", direct: true, execute: true, eventId: "report-cli-verification", request: "등록된 작업을 검사한다", decision: { intent: "verify", workId }, verifier: { command: process.execPath, args: ["-e", "process.exit(0)"], criterionIds: ["AC-1"] } })]);
  assert.equal((await listWorkReports({ repo })).reports[0]?.kind, "snapshot");
  await exec(process.execPath, [cli, JSON.stringify({ action: "report", repo, workId, narrative })]);
  const catalog = await listWorkReports({ repo });
  assert.equal(catalog.reports.filter((report) => report.kind === "authored").length, 1);
  const authored = catalog.reports.find((report) => report.kind === "authored");
  assert.ok(authored);
  assert.deepEqual((await readWorkReport({ repo, reportId: authored.id })).report.narrative?.reader, narrative.reader);
  assert.equal((await assessReportedWork({ repo, workId })).report?.usable, true);
});

test("새로 접수한 호스트가 예외를 던져도 접수 ID로 종료 기록을 회수한다", async (t) => {
  const { repo } = await fixture(t);
  await assert.rejects(runReportedStage({ repo, role: "www-dev", direct: true, execute: true, requestId: "report-hook-case" }, async () => { throw new Error("의도된 호스트 예외"); }), /의도된 호스트 예외.*보고서 훅/);
  const reports = await listWorkReports({ repo });
  assert.equal(reports.reports[0]?.outcome, "blocked");
  assert.equal(reports.reports[0]?.event, "host_exception");
});
