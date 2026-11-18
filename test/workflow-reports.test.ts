/**
 * @verifies RESP-DEVELOPMENT-REPORTING-DOCUMENT
 * @verifies RESP-DEVELOPMENT-REPORTING-STORAGE
 */
import { reportFileStem, reportRevisionFileStem } from "../scripts/workflow/report-names.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { ReportNarrative, ReportReader } from "../scripts/workflow/reports.ts";
import { captureWorkReport, listWorkReports, publishWorkReport, readWorkReport, renderWorkReport, parseReportReader, maintainWorkReports, inspectReportLocks, recoverReportLock } from "../scripts/workflow/reports.ts";

interface FixtureRecord {
  schemaVersion : number        ;
  id            : string        ;
  title         : string        ;
  status        : string        ;
  blockedReason : string | null ;
  criteria      : {
    id          : string  ;
    description : string  ;
    required    : boolean ;
    result      : string  ;
    evidence    : { path: string; summary: string }[]
  }[];
  workflow      : {
    inputs        : string[];
    verifications : {
      id                 : string   ;
      requestedCommand   : string   ;
      result             : string   ;
      executor           : string   ;
      exitCode           : number   ;
      sourceStable       : boolean  ;
      args?              : string[] ;
      argumentsRedacted? : boolean  ;
      environment?       : { platform: string; arch: string; node: string }
    }[];
    reviews       : unknown[];
  };
}

async function fixture(t: TestContext) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "www-report-"));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  const directory = path.join(repo, "docs/work/Reports/001-작업 읽기");
  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(path.join(repo, "src"));
  await fs.writeFile(path.join(repo, "src/item.ts"), "export const value = 1;\n");
  const record: FixtureRecord = {
    schemaVersion: 2, id: `work-${randomUUID()}`, title: "변경 내용과 확인 근거를 함께 읽어요", status: "verifying", blockedReason: null,
    criteria: [{ id: "AC-1", description: "보고서에서 변경 내용을 읽는다", required: true, result: "passed", evidence: [{ path: "verification.md#attempt-1", summary: "실제 Electron과 fixture 검증" }] }],
    workflow: { inputs: ["src"], verifications: [{ id: "attempt-1", requestedCommand: "node", result: "passed", executor: "process", exitCode: 0, sourceStable: true }], reviews: [] },
  };
  const file = path.join(directory, "work.json")                                ;
  const save = () => fs.writeFile(file, `${JSON.stringify(record, null, 2)}\n`) ;
  await save();
  return { repo, directory, record, file, save, workId: record.id };
}

function narrative(overrides: Partial<ReportNarrative> = {}): ReportNarrative {
  return {
    summary     : "작업 전후와 검증 결과를 한 화면으로 연결했습니다."          ,
    before      : "결과를 텍스트에서만 찾아야 했습니다."                       ,
    after       : "앱의 리포트 목록에서 읽을 수 있습니다."                     ,
    changes     : ["구조화된 보고서를 저장하고 화면에서 읽습니다."]            ,
    decisions   : ["작업 기록을 근거로 사용해 새 원본을 발명하지 않았습니다."] ,
    limitations : ["독립 검토는 아직 실행하지 않았습니다."]                    ,
    next        : ["읽기 전용 감사를 실행합니다."]                             ,
    ...overrides,
  };
}

test("자동 상태 스냅샷은 작성자 서술이나 완료를 발명하지 않는다", async (t) => {
  const f = await fixture(t);
  const { report, html, created } = await captureWorkReport({ ...f, event: "verification-finished" });
  assert.equal(created, true);
  assert.equal(report.kind, "snapshot");
  assert.equal(report.outcome, "partial");
  assert.equal(report.narrative, null);
  assert.match(html, /자동 기록에는 작성자가 서술한 작업 이야기가 없습니다/);
  assert.match(html, /연결된 독립 검토가 없습니다. 미실행/);
  assert.equal(report.work.verifications[0].executor, "process");
  assert.equal(typeof report.sourceDigest, "string");
  assert.equal(typeof report.criteriaDigest, "string");
  assert.match(report.sourceDigest ?? "", /^[a-f0-9]{64}$/);
  assert.match(report.criteriaDigest ?? "", /^[a-f0-9]{64}$/);
});

test("작성 보고서는 독립 HTML과 JSON 이력을 보존하고 주입 문자열을 escape한다", async (t) => {
  const f      = await fixture(t)                                                                                                       ;
  const attack = '<script src="https://attacker.invalid/x.js">alert(1)</script>'                                                        ;
  const result = await publishWorkReport({ ...f, narrative: narrative({ summary: attack, before: '<img src=x onerror="alert(2)">' }) }) ;
  assert.equal(result.report.kind, "authored");
  assert.equal(result.report.outcome, "partial");
  assert.equal(await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(result.report)}.html`), "utf8"), result.html);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(result.report)}.json`), "utf8")).entries[0].id, result.report.id);
  assert.doesNotMatch(result.html, /<script|<img|<iframe|<link/i);
  assert.match(result.html, /&lt;script/);
  assert.match(result.html, /default-src 'none'/);
  assert.match(result.html, /prefers-reduced-motion:reduce/);
  assert.match(result.html, /@media print/);
  assert.match(result.html, /@media\(max-width:790px\)/);
  for (const section of ["요구와 결과", "기록된 변경", "기록에 남은 주요 선택", "무엇을 어떻게 확인했나요", "확인하지 못한 범위", "남은 일과 해소 행동"]) assert.ok(result.html.includes(section));
});


test("여섯 절과 내부 목차는 미기록·완료·인쇄에서 사실을 보존한다", async (t) => {
  const f = await fixture(t);
  const partial = await captureWorkReport(f);
  const sections = ["결론과 상태", "문제와 접근", "변경 결과", "검증과 한계", "남은 일과 완료 조건", "변경 이력과 상세 근거"];
  for (const [index, title] of sections.entries()) {
    assert.match(partial.html, new RegExp(`href="#section-${index + 1}"`));
    assert.match(partial.html, new RegExp(`id="section-${index + 1}"[^>]*><h2><span[^>]*>0${index + 1}</span>${title}`));
  }
  assert.match(partial.html, /남은 일과 완료 조건이 기록되지 않았습니다/);
  assert.match(partial.html, /인쇄에는 접힌 과거 이력과 원시 상세가 포함되지 않습니다/);
  assert.match(partial.html, /@media print/);
  assert.match(partial.html, /\.history-entry:not\(\[open\]\)\{display:none\}/);
  f.record.status = "done";
  await f.save();
  const complete = await captureWorkReport(f);
  assert.match(complete.html, /저장 당시 기록된 남은 일이 없습니다/);
  assert.doesNotMatch(complete.html.split('<section class="chapter" id="section-6">')[0], /남은 일과 완료 조건이 기록되지 않았습니다/);
});

test("차단된 완료 기록은 남은 일이 없다고 표시하지 않는다", async (t) => {
  const f = await fixture(t);
  f.record.status = "done";
  f.record.blockedReason = "검토가 남았습니다";
  await f.save();
  const saved = await captureWorkReport(f);
  assert.match(saved.html, /검토가 남았습니다/);
  assert.match(saved.html, /구체적인 해소 행동이 기록되지 않았습니다/);
  assert.doesNotMatch(saved.html, /저장 당시 기록된 남은 일이 없습니다/);
});

test("같은 사건의 동시 재생은 보고서를 중복 생성하지 않고 다음 상태는 별도 이력이다", async (t) => {
  const f = await fixture(t);
  const [first, duplicate] = await Promise.all([captureWorkReport({ ...f, event: "verify" }), captureWorkReport({ ...f, event: "verify" })]);
  assert.equal(first.report.id, duplicate.report.id);
  assert.equal([first.created, duplicate.created].filter(Boolean).length, 1);
  const original = await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(first.report)}.json`));
  f.record.blockedReason = "Claude 로그인이 필요합니다.";
  await f.save();
  const blocked = await captureWorkReport({ ...f, event: "review" });
  assert.equal(blocked.report.outcome, "blocked");
  assert.notEqual(blocked.report.id, first.report.id);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(first.report)}.json`), "utf8")).entries[0], JSON.parse(original.toString()).entries[0]);
  assert.equal((await listWorkReports(f)).reports.length, 2);
});

test("저장 당시 기록과 현재 코드·기준의 변화를 별도로 표시한다", async (t) => {
  const f = await fixture(t);
  const { report } = await publishWorkReport({ ...f, narrative: narrative() });
  const same = await readWorkReport({ repo: f.repo, reportId: report.id });
  assert.equal(same.current, true);
  assert.equal(same.stale, false);
  await fs.writeFile(path.join(f.repo, "src/item.ts"), "export const value = 2;\n");
  const codeChanged = await readWorkReport({ repo: f.repo, reportId: report.id });
  assert.equal(codeChanged.current, true);
  assert.equal(codeChanged.stale, true);
  assert.ok(codeChanged.reasons.includes("검사 입력 소스 변경됨"));
  f.record.criteria[0].description = "새 수용 기준";
  await f.save();
  const criteriaChanged = await readWorkReport({ repo: f.repo, reportId: report.id });
  assert.equal(criteriaChanged.current, false);
  assert.equal(criteriaChanged.stale, true);
  assert.ok(criteriaChanged.reasons.includes("수용 기준 변경됨"));
  assert.match(criteriaChanged.html, /작업 기록 변경됨/);
  assert.equal(criteriaChanged.report.work.criteria[0].description, "보고서에서 변경 내용을 읽는다");
});

test("손상 보고서는 목록 경고로 격리하고 직접 읽기는 거부한다", async (t) => {
  const f     = await fixture(t)           ;
  const valid = await captureWorkReport(f) ;
  const badId = `report-${randomUUID()}`   ;
  await fs.writeFile(path.join(f.directory, "reports", `${badId}.json`), "{broken");
  const listed = await listWorkReports(f);
  assert.equal(listed.reports.length, 1);
  assert.equal(listed.reports[0].id, valid.report.id);
  assert.equal(listed.warnings.length, 1);
  await assert.rejects(readWorkReport({ repo: f.repo, reportId: badId }));
});

test("보고서 UUID·서술·입력 크기의 잘못된 형식을 거부한다", async (t) => {
  const f = await fixture(t);
  await assert.rejects(readWorkReport({ repo: f.repo, reportId: "../../private" }), /UUID/);
  await assert.rejects(captureWorkReport({ repo: f.repo, workId: "../work.json" }), /work-id/);
  await assert.rejects(publishWorkReport({ ...f, narrative: narrative({ summary: " " }) }), /문장/);
  await assert.rejects(publishWorkReport({ ...f, narrative: narrative({ changes: Array(41).fill("항목") }) }), /40개/);
  const { report } = await captureWorkReport(f);
  await fs.writeFile(path.join(f.directory, "reports", `${report.id}.json`), " ".repeat(1_048_577));
  await assert.rejects(readWorkReport({ repo: f.repo, reportId: report.id }), /1 MiB/);
  assert.equal((await listWorkReports(f)).warnings.length, 1);
});

test("보고서 저장 폴더의 심볼릭 링크를 따라 읽거나 쓰지 않는다", async (t) => {
  const f       = await fixture(t)                                                ;
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "www-report-outside-")) ;
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.symlink(outside, path.join(f.directory, "reports"), "dir");
  await assert.rejects(captureWorkReport(f), /심볼릭 링크/);
  await assert.rejects(readWorkReport({ repo: f.repo, reportId: `report-${randomUUID()}` }), /심볼릭 링크/);
  const listed = await listWorkReports(f);
  assert.equal(listed.reports.length, 0);
  assert.ok(listed.warnings.some((item) => item.includes("심볼릭 링크")));
  assert.deepEqual(await fs.readdir(outside), []);
});

test("보고서 파일의 내부 심볼릭 링크도 목록·직접 읽기에서 거부한다", async (t) => {
  const f        = await fixture(t)           ;
  const good     = await captureWorkReport(f) ;
  const linkedId = `report-${randomUUID()}`   ;
  await fs.symlink(path.join(f.directory, "reports", `${reportFileStem(good.report)}.json`), path.join(f.directory, "reports", `${linkedId}.json`));
  assert.equal((await listWorkReports(f)).reports.length, 1);
  await assert.rejects(readWorkReport({ repo: f.repo, reportId: linkedId }), /심볼릭 링크/);
});

test("실패·완료 기록과 legacy의 미확인 소스 범위를 구분한다", async (t) => {
  const f = await fixture(t);
  f.record.criteria[0].result = "failed";
  await f.save();
  assert.equal((await captureWorkReport(f)).report.outcome, "failed");
  f.record.status = "done";
  f.record.criteria[0].result = "passed";
  await f.save();
  assert.equal((await publishWorkReport({ ...f, narrative: narrative() })).report.outcome, "completed");
  f.record.schemaVersion = 1;
  await f.save();
  const legacy = await captureWorkReport(f);
  assert.equal(legacy.report.sourceDigest, null);
  assert.equal(legacy.report.criteriaDigest, null);
  assert.match(legacy.html, /legacy · 미확인/);
});

test("외부에서 조작한 완료 보고서는 renderer에서도 승인하지 않는다", async (t) => {
  const f = await fixture(t);
  const { report } = await captureWorkReport(f);
  assert.throws(() => renderWorkReport({ ...report, outcome: "completed" }), /완료되지 않은/);
});

test("가려진 검사 인자는 보고서로 복사하지 않고 실행 환경은 보존한다", async (t) => {
  const f = await fixture(t);
  f.record.workflow.verifications[0].args              = ["PRIVATE_TOKEN_VALUE"]                                 ;
  f.record.workflow.verifications[0].argumentsRedacted = true                                                    ;
  f.record.workflow.verifications[0].environment       = { platform: "darwin", arch: "arm64", node: "v22.22.3" } ;
  await f.save();
  const hidden = await captureWorkReport(f);
  assert.equal(hidden.report.work.verifications[0].args, null);
  assert.doesNotMatch(hidden.html, /PRIVATE_TOKEN_VALUE/);
  assert.deepEqual(hidden.report.work.verifications[0].environment, { platform: "darwin", arch: "arm64", node: "v22.22.3" });
  assert.match(hidden.html.split('id="report-raw"')[1], /darwin/);
  f.record.workflow.verifications[0].args = ["scripts/check.mjs"];
  f.record.workflow.verifications[0].argumentsRedacted = false;
  await f.save();
  assert.match((await captureWorkReport(f)).html, /scripts\/check.mjs/);
});

test("손상된 내부 근거와 과도하게 확장되는 HTML은 저장하지 않는다", async (t) => {
  const f     = await fixture(t)                                                                           ;
  const valid = await captureWorkReport(f)                                                                 ;
  const badId = `report-${randomUUID()}`                                                                   ;
  const bad   = { ...valid.report, id: badId, work: { ...valid.report.work, criteria: [{ id: "AC-1" }] } } ;
  await fs.writeFile(path.join(f.directory, "reports", `${badId}.json`), JSON.stringify(bad));
  assert.equal((await listWorkReports(f)).reports.length, 1);
  await assert.rejects(readWorkReport({ repo: f.repo, reportId: badId }), /수용 기준/);
  const fresh = await fixture(t);
  await assert.rejects(publishWorkReport({ ...fresh, narrative: narrative({ changes: Array(40).fill("&".repeat(12_000)) }) }), /2 MiB/);
  assert.equal((await listWorkReports(f)).reports.length, 1);
});

function reader(overrides: Partial<ReportReader> = {}): ReportReader {
  return { story: "목록을 읽기 어려워 요구와 확인 결과를 연결했습니다.\n후속 검토는 남아 있습니다.", requirements: [{ requirement: "쉽게 읽는다", result: "읽기 순서를 바꿨습니다", evidence: "화면 관찰 기록", limitations: null }], checks: [{ target: "보고서 읽기", method: "목록에서 보고서를 열어 본문을 확인", expected: null, observed: "본문이 표시됐습니다", limitations: "다른 플랫폼은 확인하지 않았습니다" }], decisions: [], references: [{ path: "verification.md", purpose: "관측 결과를 대조할 때 확인합니다" }], nextActions: [{ action: "독립 검토를 실행합니다", owner: null, doneWhen: null, impact: "업무 수용 판단이 남아 있습니다" }], ...overrides };
}

function bodyBeforeRaw(html: string): string { return html.split('<details id="report-raw">')[0]; }

test("reader 계약은 모든 필드·null·경계 크기를 보존하고 잘못된 입력을 거부한다", () => {
  assert.deepEqual(parseReportReader(reader()), reader());
  assert.equal(parseReportReader(reader({ story: "가".repeat(8000), references: [{ path: "경".repeat(4000), purpose: "목적" }] })).references[0].path.length, 4000);
  for (const invalid of [{ ...reader(), extra: true }, { ...reader(), checks: undefined }, reader({ story: "가".repeat(8001) }), reader({ requirements: Array.from({ length: 21 }, () => reader().requirements[0]) }), { ...reader(), checks: [{ target: "대상", method: "방법", expected: undefined, observed: null, limitations: null }] }, { ...reader(), references: [{ path: "파일", purpose: "목적", other: "값" }] }]) assert.throws(() => parseReportReader(invalid));
});

test("reader는 저장·읽기에 보존되고 story에는 정확한 산문만 담긴다", async (t) => {
  const f            = await fixture(t)                                                                ;
  const value        = reader()                                                                        ;
  const saved        = await publishWorkReport({ ...f, narrative: narrative({ reader: value }) })      ;
  const originalJson = await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(saved.report)}.json`)) ;
  const originalHtml = await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(saved.report)}.html`)) ;
  const read         = await readWorkReport({ repo: f.repo, reportId: saved.report.id })               ;
  assert.deepEqual(read.report.narrative?.reader, value);
  assert.equal(read.html.match(/<div id="report-story" class="story">([\s\S]*?)<\/div>/)?.[1], value.story);
  assert.ok(read.html.indexOf('id="report-story"') < read.html.indexOf('<div class="state-grid"'));
  const body = bodyBeforeRaw(read.html);
  assert.doesNotMatch(body, /중요한 선택과 그 이유|기록에 남은 주요 선택/);
  assert.match(body, /기대 결과가 기록되지 않았습니다/);
  assert.match(body, /작성자의 요구·결과 설명/);
  assert.match(body, /검증 설명은 작성자가 기록한 내용/);
  assert.match(body, /검사별 현행 적용성과 실행 환경은 별도로 재확인하지 않았습니다/);
  assert.deepEqual(await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(saved.report)}.json`)), originalJson);
  assert.deepEqual(await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(saved.report)}.html`)), originalHtml);
  assert.doesNotMatch(body, /일부 원본 항목이/);
});

test("완료된 reader의 빈 후속 행동도 원래 남은 일을 지우지 않는다", async (t) => {
  const f = await fixture(t);
  f.record.status = "done";
  await f.save();
  const saved = await publishWorkReport({ ...f, narrative: narrative({ next: ["Windows 재검증"], reader: reader({ nextActions: [] }) }) });
  const next = saved.html.split('<section class="chapter" id="section-5">')[1].split('<section class="chapter" id="section-6">')[0];
  assert.match(next, /Windows 재검증/);
  assert.doesNotMatch(next, /저장 당시 기록된 남은 일이 없습니다/);
});

test("reader 후속 행동과 기존 서술의 서로 다른 남은 일을 함께 표시한다", async (t) => {
  const f = await fixture(t);
  const saved = await publishWorkReport({ ...f, narrative: narrative({ next: ["Windows 재검증"], reader: reader() }) });
  const next = saved.html.split('<section class="chapter" id="section-5">')[1].split('<section class="chapter" id="section-6">')[0];
  assert.match(next, /Windows 재검증/);
  assert.match(next, /독립 검토를 실행합니다/);
});

test("reader의 서술과 실패한 수용 기준 판정을 함께 보여 준다", async (t) => {
  const f = await fixture(t);
  f.record.criteria[0].result = "failed";
  await f.save();
  const saved = await publishWorkReport({ ...f, narrative: narrative({ reader: reader() }) });
  const results = saved.html.split('<section class="chapter" id="section-3">')[1].split('<section class="chapter" id="section-4">')[0];
  assert.match(results, /읽기 순서를 바꿨습니다/);
  assert.match(results, /보고서에서 변경 내용을 읽는다/);
  assert.match(results, /당시 실패로 기록/);
});

test("저장 완료·검토 미실행·과거 PASS와 현행 적용성을 각각 표시한다", async (t) => {
  const f = await fixture(t);
  f.record.status                          = "done"                                                                                                                                                   ;
  f.record.blockedReason                   = "독립 검토 not_run: unknown"                                                                                                                             ;
  f.record.criteria[0].evidence[0].summary = "현재 적용 가능"                                                                                                                                         ;
  f.record.workflow.reviews                = [{ id: "review-1", verdict: "not_run", executor: "process", observedModel: null, findings: ["과거 로그인 실패"], receiptPath: "reviews/review-1.json" }] ;
  await f.save();
  const saved = await publishWorkReport({ ...f, narrative: narrative() })         ;
  const read  = await readWorkReport({ repo: f.repo, reportId: saved.report.id }) ;
  const body  = bodyBeforeRaw(read.html)                                          ;
  assert.match(body, /완료로 기록/);
  assert.match(body, /필수 독립 검토가 미실행/);
  assert.match(body, /이 시도의 원인은 기록에서 확인되지 않았습니다/);
  assert.doesNotMatch(body, /not_run|unknown|현재 적용 가능|과거 로그인 실패|현행 검사 통과/);
  assert.match(read.html.slice(body.length), /현재 적용 가능/);
  assert.match(body, /보고서 자료 현재성 · 검사 유효성과 별개/);
  await fs.writeFile(path.join(f.repo, "src/item.ts"), "changed");
  assert.match(bodyBeforeRaw((await readWorkReport({ repo: f.repo, reportId: saved.report.id })).html), /보고서 대상 소스·기준이 바뀌었거나 비교할 수 없어 재확인/);
});

test("legacy 서술은 재배치만 하며 검토 전문·원시 메타는 상세에 둔다", async (t) => {
  const f = await fixture(t);
  f.record.criteria[0].result = "unknown";
  f.record.workflow.reviews = [{ id: "review-secret-id", verdict: "fail", executor: "process", observedModel: "opus", findings: ["/private/very-long-path UUID detail"], receiptPath: "reviews/private.json" }];
  await f.save();
  const saved = await publishWorkReport({ ...f, narrative: narrative() });
  assert.equal(saved.report.narrative?.reader, undefined);
  const body = bodyBeforeRaw(saved.html);
  assert.match(body, /판정 미확인/);
  assert.match(body, /당시 수정 필요/);
  assert.match(body, /수정이 필요한 것으로 기록/);
  assert.doesNotMatch(body, /very-long-path|review-secret-id|requestedCommand|work-[a-f0-9-]{36}/);
  assert.match(saved.html.slice(body.length), /very-long-path/);
  assert.match(body, /결과를 텍스트에서만 찾아야 했습니다/);
  assert.match(body, /앱의 리포트 목록에서 읽을 수 있습니다/);
  assert.match(saved.html, /#report-raw,\.history-entry details\[id\$="-raw"\]\{display:none!important\}/);
});

test("실제 잘린 항목만 전체·표시·제외 개수와 숨겨진 미해결 상태를 알린다", async (t) => {
  const f = await fixture(t);
  f.record.workflow.verifications = Array.from({ length: 21 }, (_, i) => ({ ...f.record.workflow.verifications[0], id: `attempt-${i}`, result: i === 0 ? "failed" : "passed" }));
  f.record.workflow.reviews = [{ id: "review-1", verdict: "fail", executor: "process", observedModel: "opus", findings: Array(31).fill("수정 필요"), receiptPath: "review.json" }];
  await f.save();
  const saved = await captureWorkReport(f);
  assert.equal(saved.report.work.omitted?.verifications, 1);
  assert.equal(saved.report.work.omitted?.findings, 1);
  const body = bodyBeforeRaw(saved.html);
  assert.match(body, /검사 이력 전체 21개 중 20개 표시 \(1개 제외\)/);
  assert.match(body, /검토 지적 전체 31개 중 30개 표시 \(1개 제외\)/);
  assert.match(body, /실패·차단·미확인 항목이 1건/);
});

test("reader 악성 문자열을 실행하지 않고 실제 선택은 기록이 있을 때만 보여 준다", async (t) => {
  const f      = await fixture(t)                                                                                                                                                                                                                                                                                 ;
  const attack = '<script>alert("x")</script>'                                                                                                                                                                                                                                                                    ;
  const value  = reader({ story: attack, decisions: [{ problem: "선택 문제", basis: null, alternatives: [], choice: attack, tradeoff: null }], references: [{ path: 'javascript:alert(1)', purpose: attack }], checks: [{ target: attack, method: attack, expected: null, observed: null, limitations: null }] }) ;
  const saved  = await publishWorkReport({ ...f, narrative: narrative({ reader: value }) })                                                                                                                                                                                                                       ;
  assert.match(saved.html, /중요한 선택과 그 이유/);
  assert.doesNotMatch(saved.html, /<script|href="javascript:|함께 검토한 대안/);
  assert.match(saved.html, /&lt;script&gt;/);
  assert.match(saved.html, /관측 결과가 기록되지 않았습니다/);
});

async function makeLegacy(f: Awaited<ReturnType<typeof fixture>>, report: import("../scripts/workflow/reports.ts").WorkReport) {
  const directory = path.join(f.directory, "reports");
  await fs.writeFile(path.join(directory, `${report.id}.json`), JSON.stringify(report));
  await fs.writeFile(path.join(directory, `${report.id}.html`), renderWorkReport(report));
  await fs.unlink(path.join(directory, `${reportFileStem(report)}.json`));
  await fs.unlink(path.join(directory, `${reportFileStem(report)}.html`));
}

test("보고서 이름은 같은 제목에 안정적이며 안전 문자와 분해형 바이트 길이를 제한한다", () => {
  const base = { title: "한글 / 경로: 제목\n\u202e" };
  const stem = reportFileStem(base);
  assert.match(stem, /^report-한글 - 경로- 제목/);
  assert.match(stem, /-[a-f0-9]{16}$/);
  assert.doesNotMatch(stem, /[/:\n\u202e]/u);
  assert.equal(reportFileStem({ title: base.title.normalize("NFD") }), stem);
  const long = reportFileStem({ title: "각".repeat(4000) });
  assert.ok(Buffer.byteLength(`${long}.json`.normalize("NFD")) <= 220);
  assert.match(reportFileStem({ title: "... " }), /제목 없음/);
  assert.notEqual(reportFileStem({ title: "한글 - 경로- 제목--" }), stem);
  assert.throws(() => reportFileStem({ title: " " }), /제목/);
});

test("legacy 보고서의 읽기를 유지하고 병합은 의미와 원본 백업을 보존한다", async (t) => {
  const f = await fixture(t);
  const first = await publishWorkReport({ ...f, narrative: narrative() });
  await makeLegacy(f, first.report);
  const oldJson = await fs.readFile(path.join(f.directory, "reports", `${first.report.id}.json`));
  const oldHtml = await fs.readFile(path.join(f.directory, "reports", `${first.report.id}.html`));
  const record = await fs.readFile(f.file);
  assert.equal((await readWorkReport({ repo: f.repo, reportId: first.report.id })).report.id, first.report.id);
  const plan = await maintainWorkReports(f);
  assert.equal(plan.result, "planned");
  assert.equal(plan.counts.reports, 1);
  assert.equal(plan.counts.files, 2);
  assert.equal(plan.counts.groups, 1);
  assert.equal((await fs.readdir(path.join(f.directory, "reports"))).length, 2);
  const moved = await maintainWorkReports({ ...f, apply: true });
  assert.equal(moved.result, "applied");
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(first.report)}.json`), "utf8")).entries[0], JSON.parse(oldJson.toString()));
  assert.ok((await fs.readFile(path.join(f.directory, "reports", `${reportFileStem(first.report)}.html`), "utf8")).includes(first.report.summary));
  assert.ok(moved.backupPath);
  assert.deepEqual(await fs.readFile(path.join(f.repo, moved.backupPath, path.relative(f.repo, path.join(f.directory, "reports", `${first.report.id}.html`)))), oldHtml);
  assert.deepEqual(await fs.readFile(f.file), record);
  assert.equal((await maintainWorkReports({ ...f, apply: true })).result, "no_changes");
  assert.equal((await listWorkReports(f)).reports.length, 1);
  assert.equal((await readWorkReport({ repo: f.repo, reportId: first.report.id })).report.id, first.report.id);
});

test("중단된 legacy·묶음의 같은 의미 복제와 서로 다른 쌍을 재실행으로 회수한다", async (t) => {
  const f = await fixture(t);
  const { report } = await captureWorkReport(f);
  await makeLegacy(f, report);
  const directory = path.join(f.directory, "reports");
  await fs.writeFile(path.join(directory, `${reportFileStem(report)}.json`), JSON.stringify({ schemaVersion: 2, workId: report.workId, title: report.title, entries: [report] }));
  assert.equal((await listWorkReports(f)).reports.length, 1);
  assert.equal((await readWorkReport({ repo: f.repo, reportId: report.id })).report.id, report.id);
  await fs.unlink(path.join(directory, `${report.id}.json`));
  const result = await maintainWorkReports({ ...f, apply: true });
  assert.equal(result.counts.files, 1);
  assert.deepEqual((await fs.readdir(directory)).sort(), [`${reportFileStem(report)}.html`, `${reportFileStem(report)}.json`].sort());
});

test("보고서 내용 충돌은 읽기·목록·이전에서 정본으로 숨기지 않는다", async (t) => {
  const f = await fixture(t);
  const { report } = await captureWorkReport(f);
  const directory = path.join(f.directory, "reports");
  await fs.writeFile(path.join(directory, `${report.id}.json`), JSON.stringify({ ...report, summary: "충돌하는 서술" }));
  await assert.rejects(readWorkReport({ repo: f.repo, reportId: report.id }), /충돌/);
  const listed = await listWorkReports(f);
  assert.equal(listed.reports.length, 0);
  assert.ok(listed.warnings.some((warning) => warning.includes("충돌")));
  await assert.rejects(maintainWorkReports({ ...f, apply: true }), /충돌/);
  assert.equal((await fs.readdir(directory)).length, 3);
});

test("전체 사전검사 실패는 정상 legacy를 옮기지 않고 HTML 링크·고아·누락을 거부한다", async (t) => {
  const f = await fixture(t);
  const { report } = await captureWorkReport(f);
  await makeLegacy(f, report);
  const directory = path.join(f.directory, "reports");
  const orphan = path.join(directory, "고아.html");
  await fs.writeFile(orphan, "고아");
  await assert.rejects(maintainWorkReports({ ...f, apply: true }), /관리되지 않는/);
  assert.ok((await fs.readdir(directory)).includes(`${report.id}.json`));
  await fs.unlink(orphan);
  const canonicalOrphan = path.join(directory, `${reportFileStem(report)}.html`);
  await fs.writeFile(canonicalOrphan, "정본 없는 기존 내용");
  await assert.rejects(maintainWorkReports(f), /JSON 없이 기존 HTML/);
  await assert.rejects(maintainWorkReports({ ...f, apply: true }), /JSON 없이 기존 HTML/);
  assert.equal(await fs.readFile(canonicalOrphan, "utf8"), "정본 없는 기존 내용");
  assert.ok((await fs.readdir(directory)).includes(`${report.id}.json`));
  await fs.unlink(canonicalOrphan);
  const html = path.join(directory, `${report.id}.html`);
  const original = await fs.readFile(html);
  await fs.unlink(html);
  await assert.rejects(maintainWorkReports({ ...f, apply: true }), /쌍/);
  await fs.symlink(f.file, html);
  await assert.rejects(maintainWorkReports({ ...f, apply: true }), /심볼릭 링크/);
  await fs.unlink(html);
  await fs.writeFile(html, "x".repeat(2_097_153));
  await assert.rejects(maintainWorkReports({ ...f, apply: true }), /크기 제한/);
  await fs.writeFile(html, original);
  await fs.writeFile(path.join(directory, "report-broken.json"), "{broken");
  await assert.rejects(maintainWorkReports({ ...f, apply: true }));
  assert.ok((await fs.readdir(directory)).includes(`${report.id}.json`));
});

test("이전과 동시에 생성해도 보고서 쌍과 UUID 목록을 보존한다", async (t) => {
  const f = await fixture(t);
  const first = await captureWorkReport(f);
  await makeLegacy(f, first.report);
  const [migration, created] = await Promise.all([
    maintainWorkReports({ ...f, apply: true }),
    captureWorkReport({ ...f, event: "concurrent-new" }),
  ]);
  assert.equal(migration.result, "applied");
  assert.equal(created.created, true);
  const final = await maintainWorkReports({ ...f, apply: true });
  assert.equal(final.result, "no_changes");
  assert.equal(final.counts.reports, 2);
  assert.equal((await listWorkReports(f)).reports.length, 2);
});

test("짧은 UUID 접두어가 같은 다른 보고서는 원래 UUID 읽기를 방해하지 않는다", async (t) => {
  const f = await fixture(t);
  const original = await captureWorkReport(f);
  const sibling = { ...original.report, id: `${original.report.id.slice(0, -12)}000000000001`, title: "다른 제목" };
  const directory = path.join(f.directory, "reports");
  await fs.writeFile(path.join(directory, `${reportRevisionFileStem(sibling)}.json`), JSON.stringify(sibling));
  await fs.writeFile(path.join(directory, `${reportRevisionFileStem(sibling)}.html`), renderWorkReport(sibling));
  assert.equal((await readWorkReport({ repo: f.repo, reportId: original.report.id })).report.title, original.report.title);
  assert.equal((await readWorkReport({ repo: f.repo, reportId: sibling.id })).report.title, sibling.title);
});

test("종료된 소유자의 관찰 토큰만 명시 회수하고 중단 이전을 재개한다", async (t) => {
  const f = await fixture(t);
  const first = await captureWorkReport(f);
  await makeLegacy(f, first.report);
  const child = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
  assert.equal(child.status, 0);
  assert.throws(() => process.kill(child.pid, 0), (error) => typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH");
  const directory = path.relative(f.repo, path.join(f.directory, "reports"));
  const file = path.join(f.repo, directory, ".report-write.lock");
  const token = randomUUID();
  await fs.writeFile(file, JSON.stringify({ token, pid: child.pid, hostname: os.hostname(), createdAt: new Date().toISOString() }));
  const inspection = await inspectReportLocks(f);
  assert.equal(inspection.locks[0].status, "owner_exited");
  assert.equal(inspection.locks[0].recoverable, true);
  await assert.rejects(recoverReportLock({ ...f, directory, token: randomUUID() }), /토큰/);
  assert.equal((await recoverReportLock({ ...f, directory, token })).recovered, true);
  assert.equal((await inspectReportLocks(f)).locks.length, 0);
  assert.equal((await maintainWorkReports({ ...f, apply: true })).result, "applied");
});

test("살아 있는·다른 호스트·알 수 없는 보고서 잠금과 잘못된 복구 경로는 보존한다", async (t) => {
  const f = await fixture(t);
  await captureWorkReport(f);
  const directory = path.relative(f.repo, path.join(f.directory, "reports"));
  const file = path.join(f.repo, directory, ".report-write.lock");
  const token = randomUUID();
  for (const [source, expected] of [
    [JSON.stringify({ token, pid: process.pid, hostname: os.hostname(), createdAt: new Date().toISOString() }), "owner_alive"],
    [JSON.stringify({ token, pid: process.pid, hostname: "another-host", createdAt: new Date().toISOString() }), "different_host"],
    ["", "unknown_owner"],
  ]) {
    await fs.writeFile(file, source);
    assert.equal((await inspectReportLocks(f)).locks[0].status, expected);
    await assert.rejects(recoverReportLock({ ...f, directory, token }));
    assert.equal(await fs.readFile(file, "utf8"), source);
  }
  await assert.rejects(recoverReportLock({ ...f, directory: "../../outside", token }), /등록된/);
});

test("같은 작업의 같은 제목 UUID 기록은 한 묶음에 합치고 모든 의미를 보존한다", async (t) => {
  const f = await fixture(t);
  const first = await captureWorkReport(f);
  await makeLegacy(f, first.report);
  const sibling = { ...first.report, id: `${first.report.id.slice(0, -12)}000000000001`, event: "다른 사건" };
  const directory = path.join(f.directory, "reports");
  await fs.writeFile(path.join(directory, `${sibling.id}.json`), JSON.stringify(sibling));
  await fs.writeFile(path.join(directory, `${sibling.id}.html`), renderWorkReport(sibling));
  const plan = await maintainWorkReports(f);
  assert.equal(plan.counts.groups, 1);
  assert.equal(plan.counts.entries, 2);
  assert.equal(plan.counts.files, 4);
  await maintainWorkReports({ ...f, apply: true });
  assert.equal((await fs.readdir(directory)).length, 2);
  const envelope = JSON.parse(await fs.readFile(path.join(directory, `${reportFileStem(first.report)}.json`), "utf8"));
  assert.deepEqual(envelope.entries.map((entry: { id: string }) => entry.id).sort(), [first.report.id, sibling.id].sort());
  assert.equal((await readWorkReport({ repo: f.repo, reportId: sibling.id })).report.event, sibling.event);
  assert.equal((await maintainWorkReports(f)).result, "no_changes");
});

test("같은 작업의 다른 제목 묶음에 충돌한 UUID는 단건 읽기도 거부한다", async (t) => {
  const f = await fixture(t);
  const first = await captureWorkReport(f);
  f.record.title = "다른 제목의 기록";
  await f.save();
  const second = await captureWorkReport(f);
  const file = path.join(f.directory, "reports", `${reportFileStem(second.report)}.json`);
  const bundle = JSON.parse(await fs.readFile(file, "utf8"));
  bundle.entries[0].id = first.report.id;
  await fs.writeFile(file, JSON.stringify(bundle));
  assert.ok((await listWorkReports(f)).warnings.some((warning) => warning.includes("충돌")));
  await assert.rejects(readWorkReport({ repo: f.repo, reportId: first.report.id }), /충돌/);
});

test("같은 제목의 동시 append는 단일 쌍에 모든 UUID와 semantic 재실행을 보존한다", async (t) => {
  const f = await fixture(t);
  const [first, second] = await Promise.all([
    captureWorkReport({ ...f, event: "첫 번째" }),
    captureWorkReport({ ...f, event: "두 번째" }),
  ]);
  const directory = path.join(f.directory, "reports");
  assert.equal((await fs.readdir(directory)).length, 2);
  const bundle = JSON.parse(await fs.readFile(path.join(directory, `${reportFileStem(first.report)}.json`), "utf8"));
  assert.equal(bundle.schemaVersion, 2);
  assert.deepEqual(bundle.entries.map((entry: { id: string }) => entry.id).sort(), [first.report.id, second.report.id].sort());
  const duplicate = await captureWorkReport({ ...f, event: "첫 번째" });
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.report.id, first.report.id);
  const read = await readWorkReport({ repo: f.repo, reportId: first.report.id });
  assert.equal(read.report.id, first.report.id);
  assert.match(read.html, /같은 제목에 쌓인 기록/);
  assert.match(read.html, new RegExp(second.report.id));
  assert.equal((await listWorkReports(f)).reports.length, 2);
});

test("작업 UUID가 다르면 같은 제목도 별개 묶음으로 유지한다", async (t) => {
  const f = await fixture(t);
  const first = await captureWorkReport(f);
  const secondDirectory = path.join(f.repo, "docs/work/Reports/002-다른 작업");
  const secondId = `work-${randomUUID()}`;
  await fs.mkdir(secondDirectory, { recursive: true });
  await fs.writeFile(path.join(secondDirectory, "work.json"), JSON.stringify({ ...f.record, id: secondId }));
  const second = await captureWorkReport({ repo: f.repo, workId: secondId });
  assert.equal(reportFileStem(first.report), reportFileStem(second.report));
  assert.equal((await maintainWorkReports(f)).counts.groups, 2);
  assert.equal((await readWorkReport({ repo: f.repo, reportId: second.report.id })).report.workId, secondId);
  assert.equal((await fs.readdir(path.join(f.directory, "reports"))).length, 2);
  assert.equal((await fs.readdir(path.join(secondDirectory, "reports"))).length, 2);
});

test("묶음 JSON commit 뒤 누락·오래된 HTML은 재실행으로 복원하며 과거 의미를 지우지 않는다", async (t) => {
  const f = await fixture(t);
  const first = await captureWorkReport({ ...f, event: "first" });
  const next = await captureWorkReport({ ...f, event: "next" });
  const directory = path.join(f.directory, "reports");
  const jsonFile = path.join(directory, `${reportFileStem(first.report)}.json`);
  const htmlFile = path.join(directory, `${reportFileStem(first.report)}.html`);
  const original = await fs.readFile(jsonFile);
  await fs.unlink(htmlFile);
  assert.equal((await maintainWorkReports(f)).result, "planned");
  const duplicate = await captureWorkReport({ ...f, event: "next" });
  assert.equal(duplicate.report.id, next.report.id);
  assert.equal(duplicate.created, false);
  assert.deepEqual(await fs.readFile(jsonFile), original);
  assert.match(await fs.readFile(htmlFile, "utf8"), new RegExp(first.report.id));
  await fs.writeFile(htmlFile, "이전 HTML");
  assert.equal((await maintainWorkReports({ ...f, apply: true })).result, "applied");
  assert.notEqual(await fs.readFile(htmlFile, "utf8"), "이전 HTML");
  assert.equal((await maintainWorkReports(f)).result, "no_changes");
});

test("과거 시각·UUID 파일도 같은 제목 묶음으로 이전하고 모든 UUID를 읽는다", async (t) => {
  const f = await fixture(t);
  const first = await captureWorkReport(f);
  await makeLegacy(f, first.report);
  const directory = path.join(f.directory, "reports");
  for (const extension of ["json", "html"]) await fs.rename(path.join(directory, `${first.report.id}.${extension}`), path.join(directory, `${reportRevisionFileStem(first.report)}.${extension}`));
  assert.equal((await readWorkReport({ repo: f.repo, reportId: first.report.id })).report.id, first.report.id);
  const next = await captureWorkReport({ ...f, event: "next" });
  assert.equal((await fs.readdir(directory)).length, 2);
  assert.equal((await readWorkReport({ repo: f.repo, reportId: first.report.id })).report.id, first.report.id);
  assert.equal((await readWorkReport({ repo: f.repo, reportId: next.report.id })).report.id, next.report.id);
});

test("묶음의 잘못된 작업·제목·중복 UUID와 개수·파일 상한은 원본 변경 없이 거부한다", async (t) => {
  const f = await fixture(t);
  const first = await captureWorkReport(f);
  const file = path.join(f.directory, "reports", `${reportFileStem(first.report)}.json`);
  const valid = JSON.parse(await fs.readFile(file, "utf8"));
  for (const bad of [
    { ...valid, workId: `work-${randomUUID()}` },
    { ...valid, title: "다른 제목" },
    { ...valid, entries: [first.report, first.report] },
    { ...valid, entries: Array(2001).fill(first.report) },
  ]) {
    const bytes = JSON.stringify(bad);
    await fs.writeFile(file, bytes);
    await assert.rejects(maintainWorkReports({ ...f, apply: true }));
    assert.equal(await fs.readFile(file, "utf8"), bytes);
  }
  await fs.writeFile(file, JSON.stringify(valid) + " ".repeat(16_777_216));
  await assert.rejects(readWorkReport({ repo: f.repo, reportId: first.report.id }), /16 MiB/);
  await assert.rejects(maintainWorkReports({ ...f, apply: true }), /16 MiB/);
});

test("실제 subprocess의 JSON commit 직후 종료는 명시 잠금 회수와 같은 사건 재실행으로 복원한다", async (t) => {
  const f = await fixture(t);
  const first = await captureWorkReport({ ...f, event: "before-crash" });
  const moduleUrl = new URL("../scripts/workflow/reports.ts", import.meta.url).href;
  const script = `import { promises as fs } from "node:fs";
    import { captureWorkReport } from ${JSON.stringify(moduleUrl)};
    const rename = fs.rename;
    fs.rename = async (source, target) => { await rename(source, target); if (target.endsWith(".json") && target.includes("/reports/")) process.kill(process.pid, "SIGKILL"); };
    await captureWorkReport({ repo: process.argv[1], workId: process.argv[2], event: "crash-event" });`;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script, f.repo, f.workId], { encoding: "utf8" });
  assert.equal(child.signal, "SIGKILL", child.stderr);
  const locked = await inspectReportLocks(f);
  assert.equal(locked.locks[0].status, "owner_exited");
  const owner = locked.locks[0].owner;
  assert.ok(owner && owner !== "unknown");
  await recoverReportLock({ ...f, directory: locked.locks[0].directory, token: owner.token });
  const before = await listWorkReports(f);
  assert.equal(before.reports.length, 2);
  const committed = before.reports.find((entry) => entry.event === "crash-event");
  assert.ok(committed);
  const retried = await captureWorkReport({ ...f, event: "crash-event" });
  assert.equal(retried.created, false);
  assert.equal(retried.report.id, committed.id);
  assert.equal((await listWorkReports(f)).reports.length, 2);
  assert.equal((await readWorkReport({ repo: f.repo, reportId: first.report.id })).report.id, first.report.id);
  assert.equal((await maintainWorkReports(f)).result, "no_changes");
});

test("별도 subprocess 둘의 동시 append도 동일 제목 쌍에 두 UUID를 모두 남긴다", async (t) => {
  const f = await fixture(t);
  const moduleUrl = new URL("../scripts/workflow/reports.ts", import.meta.url).href;
  const script = `import { captureWorkReport } from ${JSON.stringify(moduleUrl)};
    await captureWorkReport({ repo: process.argv[1], workId: process.argv[2], event: process.argv[3] });`;
  const run = (event: string) => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script, f.repo, f.workId, event], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (value) => { stderr += String(value); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `child exit ${code}`)));
  });
  await Promise.all([run("process-one"), run("process-two")]);
  const listed = await listWorkReports(f);
  assert.equal(listed.reports.length, 2);
  assert.deepEqual(listed.reports.map((entry) => entry.event).sort(), ["process-one", "process-two"]);
  assert.equal((await fs.readdir(path.join(f.directory, "reports"))).length, 2);
});

test("새 기록으로 묶음 16 MiB 한도를 넘으면 기존 JSON·HTML과 모든 이력을 그대로 보존한다", async (t) => {
  const f = await fixture(t);
  const large = narrative({ changes: Array(40).fill("x".repeat(12_000)) });
  const first = await publishWorkReport({ ...f, narrative: large });
  const entries = Array.from({ length: 34 }, (_, index) => ({ ...first.report, id: `report-${randomUUID()}`, event: `stored-${index}`, semanticHash: index.toString(16).padStart(64, "0") }));
  const bundle = JSON.stringify({ schemaVersion: 2, workId: first.report.workId, title: first.report.title, entries });
  assert.ok(Buffer.byteLength(bundle) < 16_777_216);
  const directory = path.join(f.directory, "reports");
  const file = path.join(directory, `${reportFileStem(first.report)}.json`);
  const htmlFile = path.join(directory, `${reportFileStem(first.report)}.html`);
  await fs.writeFile(file, bundle);
  const html = await fs.readFile(htmlFile);
  await assert.rejects(publishWorkReport({ ...f, narrative: large, event: "overflow" }), /16 MiB/);
  assert.equal(await fs.readFile(file, "utf8"), bundle);
  assert.deepEqual(await fs.readFile(htmlFile), html);
  assert.equal((await listWorkReports(f)).reports.length, entries.length);
});
