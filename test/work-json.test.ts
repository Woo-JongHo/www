/**
 * @verifies RESP-DEVELOPMENT-RECORDS-SERIALIZATION
 */
import { reportFileStem } from "../scripts/workflow/report-names.ts";
import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { serializeWorkRecord } from "../scripts/workflow/work-json.ts";
import { serializeWorkReport } from "../scripts/workflow/work-json.ts";
import { workOutputColumns } from "../scripts/workflow/preflight.ts";
import { openWork, advanceWork, adoptWork } from "../scripts/workflow/work.ts";
import { finishWorkReport, runReportedStage } from "../scripts/workflow/report-lifecycle.ts";
import { publishWorkReport, readWorkReport, listWorkReports } from "../scripts/workflow/reports.ts";
import type { WorkRecord, NewWorkOptions } from "../scripts/workflow/types.ts";

function record(): WorkRecord {
  return { schemaVersion: 1, id: "work-11111111-1111-4111-8111-111111111111", title: "새 기록", kind: "maintenance", areas: ["dev"], owner: "dev", status: "ready", blockedReason: null, relations: [], criteria: [] };
}

function output(payload: unknown): string {
  return serializeWorkRecord(Object.assign(record(), { payload }), true);
}

const policy = {
  version     : 1                                                                           ,
  format      : "boxbox-scalar-columns-v1"                                                  ,
  scope       : "docs/work/**/*.json"                                                       ,
  approvalRef : ".www/architecture-contract/boxbox-side/human-approvals-20261114.json#json" ,
};

async function fixture(invoke: (repo: string) => Promise<void>): Promise<void> {
  const repo = await fs.mkdtemp(path.join(tmpdir(), "www-new-json-"));
  try { await invoke(repo); }
  finally { await fs.rm(repo, { recursive: true, force: true }); }
}

async function enable(repo: string): Promise<string> {
  const file = path.join(repo, "docs/architecture/work-output.json");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(policy));
  return file;
}

test("세 scalar의 최소 열과 두 행 경계를 고정 bytes로 비교한다", () => {
  expect(output({ a: 1, longer: 2, mid: 3 }     )).toContain('    "a"     : 1,\n    "longer": 2,\n    "mid"   : 3') ;
  expect(output({ a: 1, longer: 2 }             )).toContain('    "a": 1,\n    "longer": 2'                       ) ;
  expect(output({ a: 1, bb: 2, ccc: 3, d: null })).toContain('    "d"  : null'                                    ) ;
});

test("중첩·빈 collection·array 부모가 scalar 열을 분리한다", () => {
  const value  = { a: 1, long: 2, child: { x: 1, yy: 2, zzz: 3 }, b: 4, c: 5, empty: {}, arr: [{ a: 1, bbbb: 2 }, { a: 1, bb: 2, ccc: 3 }], tail: [] } ;
  const result = output(value)                                                                                                                         ;
  expect(result).toContain('    "a": 1,\n    "long": 2,'                     ) ;
  expect(result).toContain('      "x"  : 1,\n      "yy" : 2,\n      "zzz": 3') ;
  expect(result).toContain('    "b": 4,\n    "c": 5,\n    "empty": {}'       ) ;
  expect(result).toContain('        "a": 1,\n        "bbbb": 2'              ) ;
});

test("encoded key의 한글·한자·카나·emoji·결합문자·escape 폭을 보존한다", () => {
  expect(output({ 가: 1, 漢: 2, あ: 3, カ: 4, a: 5 })).toContain('    "a" : 5');
  expect(output({ "😀": 1, "é": 2, "x": 3 })).toContain('    "😀" : 1,\n    "é": 2,\n    "x" : 3');
  const payload = { '"': "\\\n\t\u0000", "a:b,{}": "😀‍가", "\ud800": "\udfff" } ;
  const text    = output(payload)                                               ;
  expect(JSON.parse(text).payload).toEqual  (payload              ) ;
  expect(text                    ).toContain('"\\ud800"'          ) ;
  expect(text                    ).toContain('"\\\\\\n\\t\\u0000"') ;
});

test("native JSON 의미·key 순서·줄·indent와 getter/toJSON 한 번 실행을 유지한다", () => {
  let gets      = 0                                                                                                                                                                                                                         ;
  let calls     = 0                                                                                                                                                                                                                         ;
  const payload = { "10": 10, "2": 2, get a() { gets++; return -0; }, omitted: undefined, fn: () => 1, sym: Symbol(), nonfinite: NaN, infinity: Infinity, array: [, undefined, NaN], date: { toJSON() { calls++; return "2026-11-14"; } } } ;
  const value   = Object.assign(record(), { payload })                                                                                                                                                                                      ;
  const result  = serializeWorkRecord(value, true)                                                                                                                                                                                          ;
  expect(gets).toBe(1);
  expect(calls).toBe(1);
  const native = `${JSON.stringify(value, null, 2)}\n`;
  expect(JSON.parse(result)                                      ).toEqual  (JSON.parse(native)                                      ) ;
  expect(Object.keys(JSON.parse(result).payload)                 ).toEqual  (Object.keys(JSON.parse(native).payload)                 ) ;
  expect(result.split("\n").map((line) => line.match(/^ */)?.[0])).toEqual  (native.split("\n").map((line) => line.match(/^ */)?.[0])) ;
  expect(serializeWorkRecord(record(), false)                    ).toBe     (`${JSON.stringify(record(), null, 2)}\n`                ) ;
  expect(output({ a: 1, absent: undefined, bb: 2, ccc: 3 })      ).toContain('    "a"  : 1'                                          ) ;
  expect(() => output({ bigint: 1n })                            ).toThrow  (TypeError                                               ) ;
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  expect(() => output(cycle)).toThrow(TypeError);
});

test("정책 부재·활성·잘못된 값·unknown field·symlink를 구분한다", async () => {
  await fixture(async (repo) => {
    expect(await workOutputColumns(repo)).toBe(false);
    const file = await enable(repo);
    expect(await workOutputColumns(repo)).toBe(true);
    for (const invalid of [{ ...policy, version: 2 }, { ...policy, command: "execute" }, { ...policy, scope: "**/*" }, { ...policy, approvalRef: "generated" }, []]) {
      await fs.writeFile(file, JSON.stringify(invalid));
      await expect(workOutputColumns(repo)).rejects.toThrow();
    }
    await fs.unlink(file);
    await fs.symlink("missing.json", file);
    await expect(workOutputColumns(repo)).rejects.toThrow(/심볼릭/);
    await fs.unlink(file);
    await fs.rmdir(path.dirname(file));
    await fs.symlink(repo, path.dirname(file));
    await expect(workOutputColumns(repo)).rejects.toThrow(/심볼릭/);
  });
});

function options(repo: string): NewWorkOptions {
  return { repo, role: "www-dev", direct: true, requestId: "fresh-output", request: "새 JSON 최초 출력", decision: { intent: "build", area: "Workflow", title: "최초 출력", criteria: [{ id: "AC-1", description: "새 출력 보존" }] }, approval: { implementation: true, writePaths: [], mutationSurfaces: [], verifierCommands: [], commit: false, publish: false }, inputs: ["src"] };
}

const narrative = { summary: "새 보고서", before: "기존 출력", after: "새 출력", changes: [], decisions: [], limitations: [], next: [] };

test("큰 유효 원장의 requestId만으로 호스트 예외 snapshot과 원래 오류를 회수한다", async () => {
  await fixture(async (repo) => {
    await fs.mkdir(path.join(repo, "docs/work"), { recursive: true });
    await fs.mkdir(path.join(repo, "src"));
    await fs.writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업\n");
    const requestId = "합성".repeat(200_000)                          ;
    const work      = await openWork({ ...options(repo), requestId }) ;
    const original  = await fs.readFile(work.path)                    ;
    expect(original.byteLength).toBeGreaterThan(1_048_576);
    expect(original.byteLength).toBeLessThanOrEqual(8_388_608);
    const failure = new Error("합성 호스트 원래 오류");
    await expect(runReportedStage({ repo, role: "www-dev", execute: true, requestId: "다른 접수" }, async () => { throw failure; })).rejects.toBe(failure);
    expect(await fs.readFile(work.path)).toEqual(original);
    expect((await listWorkReports({ repo })).reports).toEqual([]);
    let caught: unknown;
    try { await runReportedStage({ repo, role: "www-dev", execute: true, requestId }, async () => { throw failure; }); }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(Error);
    if (!(caught instanceof Error)) throw new Error("호스트 오류 회수가 필요합니다.");
    expect(caught.cause).toBe(failure);
    expect(caught.message).toContain("합성 호스트 원래 오류; 보고서 훅");
    const listed = await listWorkReports({ repo });
    expect(listed.reports).toHaveLength(1);
    const read = await readWorkReport({ repo, reportId: listed.reports[0].id });
    expect(read.report.workId                                                 ).toBe(work.record.id                      ) ;
    expect(read.report.event                                                  ).toBe("host_exception"                    ) ;
    expect(read.report.kind                                                   ).toBe("snapshot"                          ) ;
    expect(read.report.outcome                                                ).toBe("blocked"                           ) ;
    expect(read.report.work.blockedReason                                     ).toBe("개발 하네스가 오류로 종료됐습니다.") ;
    expect(JSON.parse(await fs.readFile(work.path, "utf8")).workflow.requestId).toBe(requestId                           ) ;
  });
});

test("8 MiB 초과 원장의 requestId는 다른 작업으로 예외를 오회수하지 않는다", async () => {
  await fixture(async (repo) => {
    await fs.mkdir(path.join(repo, "docs/work"), { recursive: true });
    await fs.mkdir(path.join(repo, "src"));
    await fs.writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업\n");
    const requestId     = "합성".repeat(1_400_000)                                          ;
    const oversized     = await openWork({ ...options(repo), requestId })                   ;
    const other         = await openWork({ ...options(repo), requestId: "다른 정상 접수" }) ;
    const original      = await fs.readFile(oversized.path)                                 ;
    const otherOriginal = await fs.readFile(other.path)                                     ;
    expect(original.byteLength).toBeGreaterThan(8_388_608);
    const failure = new Error("초과 원장 호스트 오류");
    await expect(runReportedStage({ repo, role: "www-dev", execute: true, requestId }, async () => { throw failure; })).rejects.toBe(failure);
    expect(await fs.readFile(oversized.path)             )    .toEqual  (original     ) ;
    expect(await fs.readFile(other.path)                 )    .toEqual  (otherOriginal) ;
    expect((await listWorkReports({ repo })).reports     )    .toEqual  ([]           ) ;
    expect(await fs.readdir(path.dirname(oversized.path))).not.toContain("reports"    ) ;
    expect(await fs.readdir(path.dirname(other.path))    ).not.toContain("reports"    ) ;
  });
});

test("1 MiB 초과 유효 원장의 보고서를 발행·조회하고 보고서 읽기 한도는 유지한다", async () => {
  await fixture(async (repo) => {
    await fs.mkdir(path.join(repo, "docs/work"), { recursive: true });
    await fs.mkdir(path.join(repo, "src"));
    await fs.writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업\n");
    // 격리 fixture의 합성 접수 ID로 공식 생성 경로에서 큰 유효 원장을 만든다.
    const work     = await openWork({ ...options(repo), requestId: "합성".repeat(200_000) }) ;
    const original = await fs.readFile(work.path)                                            ;
    expect(original.byteLength).toBeGreaterThan(1_048_576);
    expect(original.byteLength).toBeLessThan(8_388_608);
    const published = await publishWorkReport({ repo, workId: work.record.id, narrative }) ;
    const read      = await readWorkReport({ repo, reportId: published.report.id })        ;
    expect(read.report.workId        ).toBe(work.record.id                                     ) ;
    expect(read.current              ).toBe(true                                               ) ;
    expect(read.report.workRecordHash).toBe(createHash("sha256").update(original).digest("hex")) ;
    const listed = await listWorkReports({ repo });
    expect(listed.warnings                          ).toEqual([]                   ) ;
    expect(listed.reports.map((report) => report.id)).toEqual([published.report.id]) ;
    expect(await fs.readFile(work.path)             ).toEqual(original             ) ;
    const reportFile = path.join(path.dirname(work.path), "reports", `${reportFileStem(published.report)}.json`);
    // 유효 JSON의 뒤쪽 공백만으로 저장 보고서의 읽기 상한도 실제로 넘긴다.
    await fs.appendFile(reportFile, " ".repeat(16_777_216));
    await expect(readWorkReport({ repo, reportId: published.report.id })).rejects.toThrow(/묶음 보고서 입력은 16 MiB/);
    const oversized = await listWorkReports({ repo });
    expect(oversized.reports                                                                  ).toEqual([]      ) ;
    expect(oversized.warnings.some((warning) => warning.includes("묶음 보고서 입력은 16 MiB"))).toBe   (true    ) ;
    expect(await fs.readFile(work.path)                                                       ).toEqual(original) ;
  });
});

test("8 MiB 초과 유효 원장은 경고로 제외하고 발행을 거부하며 원본을 보존한다", async () => {
  await fixture(async (repo) => {
    await fs.mkdir(path.join(repo, "docs/work"), { recursive: true });
    await fs.mkdir(path.join(repo, "src"));
    await fs.writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업\n");
    const work     = await openWork({ ...options(repo), requestId: "합성".repeat(1_400_000) }) ;
    const original = await fs.readFile(work.path)                                              ;
    expect(original.byteLength).toBeGreaterThan(8_388_608);
    const listed = await listWorkReports({ repo });
    expect(listed.reports    ).toEqual     ([]                      ) ;
    expect(listed.warnings   ).toHaveLength(1                       ) ;
    expect(listed.warnings[0]).toContain   ("작업 원장 입력은 8 MiB") ;
    await expect(publishWorkReport({ repo, workId: work.record.id, narrative })).rejects.toThrow(/작업 UUID/);
    expect(await fs.readFile(work.path)).toEqual(original);
    expect(await fs.readdir(path.dirname(work.path))).not.toContain("reports");
  });
});

test("open·mutate·보고서 활성화의 no-op bytes와 raw hash·불변 보고서·dedupe를 보존한다", async () => {
  await fixture(async (repo) => {
    await fs.mkdir(path.join(repo, "docs/work"), { recursive: true });
    await fs.mkdir(path.join(repo, "src"));
    await fs.writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업\n");
    const work = await openWork(options(repo))        ;
    const old  = await fs.readFile(work.path, "utf8") ;
    expect(old).toBe(`${JSON.stringify(work.record, null, 2)}\n`);
    await enable(repo);
    const oldStat = await fs.stat(work.path);
    await openWork(options(repo));
    expect(await fs.readFile(work.path, "utf8")).toBe(old);
    const noOpStat = await fs.stat(work.path);
    expect([noOpStat.ino, noOpStat.mtimeMs]).toEqual([oldStat.ino, oldStat.mtimeMs]);
    const changed = await advanceWork({ repo, workId: work.record.id, intent: "build" }) ;
    const raw     = await fs.readFile(work.path, "utf8")                                 ;
    expect(changed.rawSource).toBe(raw);
    expect(raw).toContain('"id"           :');
    await advanceWork({ repo, workId: work.record.id, intent: "build" });
    expect(await fs.readFile(work.path, "utf8")).toBe(raw);
    const first   = await finishWorkReport({ repo, workId: work.record.id, narrative }) ;
    const enabled = await fs.readFile(work.path, "utf8")                                ;
    expect(first.report.workRecordHash).toBe(createHash("sha256").update(enabled).digest("hex"));
    const reportFile     = path.join(path.dirname(work.path), "reports", `${reportFileStem(first.report)}.json`) ;
    const originalReport = await fs.readFile(reportFile, "utf8")                                                 ;
    const again          = await finishWorkReport({ repo, workId: work.record.id, narrative })                   ;
    expect(again.created                                                      ).toBe(false         ) ;
    expect(await fs.readFile(work.path, "utf8")                               ).toBe(enabled       ) ;
    expect(await fs.readFile(reportFile, "utf8")                              ).toBe(originalReport) ;
    expect((await readWorkReport({ repo, reportId: first.report.id })).current).toBe(true          ) ;
    await advanceWork({ repo, workId: work.record.id, intent: "verify" });
    expect((await readWorkReport({ repo, reportId: first.report.id })).current).toBe(false);
    expect(await fs.readFile(reportFile, "utf8")).toBe(originalReport);
    const file = await enable(repo);
    await fs.writeFile(file, '{"version":99}');
    const before = await fs.readFile(work.path);
    await expect(advanceWork({ repo, workId: work.record.id, intent: "build" })).rejects.toThrow(/정책/);
    expect(await fs.readFile(work.path)).toEqual(before);
  });
});

test("adopt는 실제 새 revision만 출력하고 활성 정책의 새 작업을 생성한다", async () => {
  await fixture(async (repo) => {
    await enable(repo);
    const directory = path.join(repo, "docs/work/Workflow/001-기존");
    await fs.mkdir(directory, { recursive: true });
    await fs.mkdir(path.join(repo, "src"));
    await fs.writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업\n");
    const legacy = record();
    legacy.criteria = [{ id: "AC-1", description: "기존 기준", required: true, result: "unverified", evidence: [] }];
    await fs.writeFile(path.join(directory, "work.json"), JSON.stringify(legacy));
    const request = options(repo)                                                       ;
    const adopted = await adoptWork({ ...request, workId: legacy.id, intent: "build" }) ;
    expect(adopted.rawSource).toBe(await fs.readFile(adopted.path, "utf8"));
    const fresh = await openWork(request);
    expect(fresh.rawSource).toBe(serializeWorkRecord(fresh.record, true));
    expect(fresh.rawSource).toBe(await fs.readFile(fresh.path, "utf8"));
  });
});

test("padding 뒤 1 MiB 초과 보고서는 publish하지 않고 기존 JSON·HTML을 보존한다", async () => {
  await fixture(async (repo) => {
    const directory = path.join(repo, "docs/work/Workflow/001-크기");
    await fs.mkdir(directory, { recursive: true });
    const work = record();
    await fs.writeFile(path.join(directory, "work.json"), JSON.stringify(work));
    const first     = await publishWorkReport({ repo, workId: work.id, narrative })                                                                                                      ;
    const reports   = path.join(directory, "reports")                                                                                                                                    ;
    const names     = await fs.readdir(reports)                                                                                                                                          ;
    const originals = await Promise.all(names.map((name) => fs.readFile(path.join(reports, name), "utf8")))                                                                              ;
    const large     = { ...narrative, changes: Array.from({ length: 40 }, () => "x".repeat(12000)), decisions: Array.from({ length: 40 }, () => "x".repeat(12000)), limitations: ["x"] } ;
    const probe     = { ...first.report, narrative: large }                                                                                                                              ;
    const overhead  = Buffer.byteLength(serializeWorkReport(probe, false))                                                                                                               ;
    const remaining = 1_048_575 - overhead                                                                                                                                               ;
    expect(remaining).toBeGreaterThan(0);
    large.limitations = Array.from({ length: Math.ceil(remaining / 11000) }, (_, index) => "x".repeat(Math.min(11000, remaining - index * 11000)));
    // 배열 행의 따옴표·indent·쉼표 overhead까지 native 최종 크기를 맞춘다.
    const excess = Buffer.byteLength(serializeWorkReport(probe, false)) - 1_048_575;
    large.limitations[0] = large.limitations[0].slice(excess);
    expect(Buffer.byteLength(serializeWorkReport(probe, false))).toBe(1_048_575);
    expect(Buffer.byteLength(serializeWorkReport(probe, true))).toBeGreaterThan(1_048_576);
    await enable(repo);
    await expect(publishWorkReport({ repo, workId: work.id, narrative: large })).rejects.toThrow(/JSON이 1 MiB/);
    expect(await fs.readdir(reports)).toEqual(names);
    expect(await Promise.all(names.map((name) => fs.readFile(path.join(reports, name), "utf8")))).toEqual(originals);
  });
});
