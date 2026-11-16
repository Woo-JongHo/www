/**
 * @verifies RESP-REPORTS-SERVICE
 * @verifies RESP-REPORTS-VIEW
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { captureWorkReport, listWorkReports, publishWorkReport } from "../scripts/workflow/reports.ts";
import { createReportService } from "../src/reports-service";

async function repository(t: TestContext, withWork = true) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "www-report-service-"));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  const workId = `work-${randomUUID()}`;
  if (withWork) {
    const directory = path.join(repo, "docs/work/Reports/001-보고서 서비스");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "work.json"), JSON.stringify({
      schemaVersion : 1                                                                                                                      ,
      id            : workId                                                                                                                 ,
      title         : "작업을 보고서로 읽어요"                                                                                               ,
      status        : "verifying"                                                                                                            ,
      blockedReason : "독립 검토 대기"                                                                                                       ,
      criteria      : [{ id: "AC-1", description: "선택한 프로젝트의 보고서를 읽는다", required: true, result: "unverified", evidence: [] }] ,
    }));
  }
  return { repo, workId };
}

async function authoredReport(repo: string, workId: string) {
  return publishWorkReport({
    repo   ,
    workId ,
    narrative: {
      summary     : "앱에 작업 보고서를 연결했습니다."                                      ,
      before      : "변경 내용을 텍스트에서 찾아야 했습니다."                               ,
      after       : "리포트에서 작업 전후와 근거를 읽습니다."                               ,
      changes     : ['<script src="https://attacker.invalid/attack.js">실행 금지</script>'] ,
      decisions   : ["작업 기록을 원본으로 사용합니다."]                                    ,
      limitations : ["독립 검토는 대기 중입니다."]                                          ,
      next        : ["검토를 진행합니다."]                                                  ,
    },
  });
}

test("보고서 서비스는 실제 저장된 authored 보고서와 안전한 HTML을 전달한다", async (t) => {
  const { repo, workId } = await repository(t);
  const written = await authoredReport(repo, workId)             ;
  const service = createReportService({ workspace: () => repo }) ;
  const catalog = await service.list()                           ;
  assert.equal(catalog.repository, repo);
  assert.equal(catalog.reports.length, 1);
  assert.equal(catalog.reports[0].id, written.report.id);
  assert.equal(catalog.reports[0].kind, "authored");
  const document = await service.read(written.report.id.toUpperCase());
  assert.equal(document.report.id, written.report.id);
  assert.equal(document.current, true);
  assert.equal(document.stale, false);
  assert.equal(document.report.outcome, "blocked");
  assert.match(document.html, /&lt;script/);
  assert.doesNotMatch(document.html, /<script|<iframe|<a\b/i);
  assert.deepEqual(catalog.warnings, []);
});

test("프로젝트 변경 뒤 이전 프로젝트의 보고서 UUID를 읽지 않는다", async (t) => {
  const first          = await repository(t)                                        ;
  const second         = await repository(t)                                        ;
  const written        = await authoredReport(first.repo, first.workId)             ;
  let currentWorkspace = first.repo                                                 ;
  const service        = createReportService({ workspace: () => currentWorkspace }) ;
  assert.equal((await service.read(written.report.id)).report.workId, first.workId);
  currentWorkspace = second.repo;
  const catalog = await service.list();
  assert.equal(catalog.repository, second.repo);
  assert.deepEqual(catalog.reports, []);
  await assert.rejects(service.read(written.report.id), /보고서 UUID가 없거나/);
});

test("같은 작업·제목은 한 항목으로 읽고 모든 기록을 독립 HTML에 보존한다", async (t) => {
  const { repo, workId } = await repository(t);
  const first = await authoredReport(repo, workId);
  assert.ok(first.report.narrative);
  const second = await publishWorkReport({ repo, workId, event: "updated", narrative: { ...first.report.narrative, summary: "추가 변경과 검증을 같은 보고서에 모았습니다." } });
  await captureWorkReport({ repo, workId, event: "after-authoring" });
  const entries = (await listWorkReports({ repo })).reports;
  const authored = entries.filter((entry) => entry.kind === "authored");
  const service = createReportService({ workspace: () => repo });
  const catalog = await service.list();
  assert.equal(entries.length, 3);
  assert.equal(catalog.reports.length, 1);
  assert.equal(catalog.reports[0].id, authored[0].id);
  assert.equal(catalog.reports[0].kind, "authored");
  const document = await service.read(catalog.reports[0].id);
  assert.match(document.html, /같은 제목에 쌓인 기록/);
  assert.match(document.html, /현재 펼친 기록 외 2개의 기록/);
  assert.match(document.html, /추가 변경과 검증을 같은 보고서에 모았습니다/);
  assert.match(document.html, /앱에 작업 보고서를 연결했습니다/);
  assert.doesNotMatch(document.html, /<script|<iframe|<a\b/i);
  const ids = [...document.html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal((await service.read(first.report.id)).report.summary, first.report.summary);
  assert.equal((await service.read(second.report.id)).report.summary, second.report.summary);
  const directory = path.join(repo, "docs/work/Reports/002-별도 작업");
  const otherWorkId = `work-${randomUUID()}`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "work.json"), JSON.stringify({ schemaVersion: 1, id: otherWorkId, title: first.report.title, status: "ready", criteria: [] }));
  await authoredReport(repo, otherWorkId);
  assert.equal((await service.list()).reports.length, 2);
});

test("renderer의 임의 경로·객체·배열·빈 ID는 UUID 검사에서 거부한다", async (t) => {
  const { repo } = await repository(t, false);
  const service = createReportService({ workspace: () => repo });
  for (const value of ["../../private", "/tmp/report.html", "file:///tmp/report.html", "", null, 42, { reportId: `report-${randomUUID()}` }, [`report-${randomUUID()}`]]) {
    await assert.rejects(service.read(value), /보고서 ID가 올바르지/);
  }
});

test("작업 기록이 없는 홈·빈 프로젝트는 오류 대신 빈 목록을 제공한다", async (t) => {
  const { repo } = await repository(t, false);
  const service = createReportService({ workspace: () => repo }) ;
  const catalog = await service.list()                           ;
  assert.equal(catalog.repository, repo);
  assert.deepEqual(catalog.reports, []);
  assert.deepEqual(catalog.warnings, []);
  await assert.rejects(service.read(`report-${randomUUID()}`), /보고서 UUID가 없거나/);
});
