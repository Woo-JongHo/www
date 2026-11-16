/**
 * @verifies RESP-DEVELOPMENT-REPORTING-STORAGE
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runTypedWorkflow } from "../scripts/workflow.ts";
import { captureWorkReport, readWorkReport } from "../scripts/workflow/reports.ts";
import { reportFileStem } from "../scripts/workflow/report-names.ts";

test("공식 보고서 관리 진입점은 기본 미리보기와 명시 적용을 구분한다", async (t) => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "www-report-entry-"));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  const directory = path.join(repo, "docs/work/Reports/001-파일명 관리");
  await fs.mkdir(directory, { recursive: true });
  const workId = `work-${randomUUID()}`;
  const source = JSON.stringify({ schemaVersion: 1, id: workId, title: "읽을 수 있는 보고서 이름", status: "ready", criteria: [] });
  await fs.writeFile(path.join(directory, "work.json"), source);
  const saved = await captureWorkReport({ repo, workId });
  const reports = path.join(directory, "reports");
  const stem = reportFileStem(saved.report);
  for (const ext of ["json", "html"]) await fs.unlink(path.join(reports, `${stem}.${ext}`));
  await fs.writeFile(path.join(reports, `${saved.report.id}.json`), JSON.stringify(saved.report));
  await fs.writeFile(path.join(reports, `${saved.report.id}.html`), saved.html);
  const before = (await fs.readdir(reports)).sort();
  const plan = await runTypedWorkflow({ action: "report-maintain", repo });
  assert.equal(plan.result, "planned");
  assert.deepEqual((await fs.readdir(reports)).sort(), before);
  await assert.rejects(runTypedWorkflow({ action: "report-maintain", repo, apply: true }), /직접/);
  assert.deepEqual((await fs.readdir(reports)).sort(), before);
  const result = await runTypedWorkflow({ action: "report-maintain", repo, apply: true, direct: true });
  assert.equal(result.result, "applied");
  assert.equal((await runTypedWorkflow({ action: "report-maintain", repo })).result, "no_changes");
  assert.deepEqual((await runTypedWorkflow({ action: "report-lock-status", repo })).locks, []);
  assert.equal((await readWorkReport({ repo, reportId: saved.report.id })).report.id, saved.report.id);
  assert.equal(await fs.readFile(path.join(directory, "work.json"), "utf8"), source);
});

test("보고서 관리 진입점은 잘못된 경로·적용 옵션을 실행 전에 거부한다", async () => {
  await assert.rejects(runTypedWorkflow({ action: "report-maintain", repo: 42 }), /문자열/);
  await assert.rejects(runTypedWorkflow({ action: "report-maintain", apply: "true" }), /boolean/);
  await assert.rejects(runTypedWorkflow({ action: "report-lock-status", repo: 42 }), /문자열/);
  await assert.rejects(runTypedWorkflow({ action: "report-lock-recover", directory: "docs/work/Reports/001/reports", token: randomUUID() }), /직접 요청/);
});
