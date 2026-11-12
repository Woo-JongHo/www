import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { ReportNarrative, ReportReader } from "../scripts/workflow/reports.ts";
import { captureWorkReport, listWorkReports, publishWorkReport, readWorkReport, renderWorkReport, parseReportReader } from "../scripts/workflow/reports.ts";

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
  assert.equal(await fs.readFile(path.join(f.directory, "reports", `${result.report.id}.html`), "utf8"), result.html);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.directory, "reports", `${result.report.id}.json`), "utf8")).id, result.report.id);
  assert.doesNotMatch(result.html, /<script|<img|<iframe|<link|<a\b/i);
  assert.match(result.html, /&lt;script/);
  assert.match(result.html, /default-src 'none'/);
  assert.match(result.html, /prefers-reduced-motion:reduce/);
  assert.match(result.html, /@media print/);
  assert.match(result.html, /@media\(max-width:700px\)/);
  for (const section of ["요구와 결과", "기록된 변경", "기록에 남은 주요 선택", "무엇을 어떻게 확인했나요", "확인하지 못한 범위", "남은 일과 해소 행동"]) assert.ok(result.html.includes(section));
});

test("같은 사건의 동시 재생은 보고서를 중복 생성하지 않고 다음 상태는 별도 이력이다", async (t) => {
  const f = await fixture(t);
  const [first, duplicate] = await Promise.all([captureWorkReport({ ...f, event: "verify" }), captureWorkReport({ ...f, event: "verify" })]);
  assert.equal(first.report.id, duplicate.report.id);
  assert.equal([first.created, duplicate.created].filter(Boolean).length, 1);
  const original = await fs.readFile(path.join(f.directory, "reports", `${first.report.id}.json`));
  f.record.blockedReason = "Claude 로그인이 필요합니다.";
  await f.save();
  const blocked = await captureWorkReport({ ...f, event: "review" });
  assert.equal(blocked.report.outcome, "blocked");
  assert.notEqual(blocked.report.id, first.report.id);
  assert.deepEqual(await fs.readFile(path.join(f.directory, "reports", `${first.report.id}.json`)), original);
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
  await fs.symlink(path.join(f.directory, "reports", `${good.report.id}.json`), path.join(f.directory, "reports", `${linkedId}.json`));
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
  await assert.rejects(publishWorkReport({ ...f, narrative: narrative({ changes: Array(40).fill("&".repeat(12_000)) }) }), /2 MiB/);
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
  const originalJson = await fs.readFile(path.join(f.directory, "reports", `${saved.report.id}.json`)) ;
  const originalHtml = await fs.readFile(path.join(f.directory, "reports", `${saved.report.id}.html`)) ;
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
  assert.deepEqual(await fs.readFile(path.join(f.directory, "reports", `${saved.report.id}.json`)), originalJson);
  assert.deepEqual(await fs.readFile(path.join(f.directory, "reports", `${saved.report.id}.html`)), originalHtml);
  assert.doesNotMatch(body, /일부 원본 항목이/);
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
  assert.match(saved.html, /#report-raw\{display:none!important\}/);
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
  assert.doesNotMatch(saved.html, /<script|href=|함께 검토한 대안/);
  assert.match(saved.html, /&lt;script&gt;/);
  assert.match(saved.html, /관측 결과가 기록되지 않았습니다/);
});
