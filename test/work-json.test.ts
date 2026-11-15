/**
 * @verifies RESP-DEVELOPMENT-RECORDS-SERIALIZATION
 */
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { architectureCanonicalTool, canonicalArchitectureJson } from "../scripts/generate-architecture.ts";
import { promises as fs, readFileSync } from "node:fs";
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
    const reportFile = path.join(path.dirname(work.path), "reports", `${published.report.id}.json`);
    // 유효 JSON의 뒤쪽 공백만으로 저장 보고서의 읽기 상한도 실제로 넘긴다.
    await fs.appendFile(reportFile, " ".repeat(1_048_576));
    await expect(readWorkReport({ repo, reportId: published.report.id })).rejects.toThrow(/보고서 입력은 1 MiB/);
    const oversized = await listWorkReports({ repo });
    expect(oversized.reports                                                            ).toEqual([]      ) ;
    expect(oversized.warnings.some((warning) => warning.includes("보고서 입력은 1 MiB"))).toBe   (true    ) ;
    expect(await fs.readFile(work.path)                                                 ).toEqual(original) ;
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
    const reportFile     = path.join(path.dirname(work.path), "reports", `${first.report.id}.json`) ;
    const originalReport = await fs.readFile(reportFile, "utf8")                                    ;
    const again          = await finishWorkReport({ repo, workId: work.record.id, narrative })      ;
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


// 실도구 왕복은 직렬 실행한다. 19 scope 및 negative pipeline을 포함한 예산은 300초다.
const sourceRoot        = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")             ;
const approvalDirectory = "docs/work/Workflow/012-BoxBox 승인 규칙과 새 JSON 출력/approvals"           ;
const sha               = (value: string | Buffer) => createHash("sha256").update(value).digest("hex") ;

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("객체 경계 오류");
  return Object.fromEntries(Object.entries(value));
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("배열 경계 오류");
  return value.map(object);
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("문자열 경계 오류");
  return value;
}

async function json(file: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await fs.readFile(path.join(sourceRoot, file), "utf8"));
  return object(value);
}

async function registry(file: string): Promise<Record<string, unknown>[]> {
  return (await fs.readFile(path.join(sourceRoot, ".boxbox", file), "utf8")).trim().split("\n").map((line) => {
    const value: unknown = JSON.parse(line);
    return object(value);
  });
}

async function proposal() {
  const md = await fs.readFile(path.join(sourceRoot, ".boxbox/rules/www-ts-v1-approved.md"), "utf8");
  expect(sha(md)).toBe("ae8df6d7b1293705be022f9247211bea5839eb941284fd13d8334a700aa2c61c");
  const sections = md.split(/(?=^## )/m).filter((section) => /^## \d{2}\. /.test(section)).map((section) => {
    const key     = section.match(/정확 key: `([^`]+)`/)?.[1]                   ;
    const scope   = section.match(/파일 scope:\n([\s\S]*?)\nbefore:/)?.[1]      ;
    const before  = section.match(/before:\n```typescript\n([\s\S]*?)```/)?.[1] ;
    const after   = section.match(/after:\n```typescript\n([\s\S]*?)```/)?.[1]  ;
    const heading = section.split("\n")[0].slice(3)                             ;
    if (!key || !scope || !before || !after) throw new Error("승인 section 누락");
    const files = scope.trim().split("\n").map((line) => {
      const file = line.match(/^- `([^`]+)`$/)?.[1];
      if (!file || !/^(scripts|src|test)\/[a-zA-Z0-9/_.-]+\.tsx?$/.test(file) || file.split("/").includes("..")) throw new Error("exact scope 오류");
      return file;
    });
    expect(new Set(files).size).toBe(files.length);
    return { key, files, before, after, heading, docHash: `sha256:${sha(section.trim() + "\n")}` };
  });
  expect(sections.length                                 ).toBe(28) ;
  expect(new Set(sections.map((entry) => entry.key)).size).toBe(28) ;
  expect(sections.flatMap((entry) => entry.files).length ).toBe(86) ;
  return sections;
}

async function snapshot(directory: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  async function visit(relative: string) {
    const full = path.join(directory, relative) ;
    const stat = await fs.lstat(full)           ;
    if (stat.isSymbolicLink()) throw new Error(`symlink 거부: ${relative}`);
    if (stat.isDirectory()) for (const name of (await fs.readdir(full)).sort()) await visit(path.join(relative, name));
    else {
      if (!stat.isFile()) throw new Error(`regular file 필요: ${relative}`);
      found.set(relative, sha(await fs.readFile(full)));
    }
  }
  await visit(".boxbox");
  for (const file of ["scripts/architecture-contract.ts", "scripts/workflow.ts"]) found.set(file, sha(await fs.readFile(path.join(directory, file))));
  return found;
}

async function stage(invoke: (repo: string) => Promise<void>) {
  const original = await snapshot(sourceRoot);
  await fixture(async (repo) => {
    await fs.mkdir(path.join(repo, ".git"));
    for (const [file, hash] of original) {
      await fs.mkdir(path.dirname(path.join(repo, file)), { recursive: true });
      await fs.copyFile(path.join(sourceRoot, file), path.join(repo, file));
      expect(sha(await fs.readFile(path.join(repo, file)))).toBe(hash);
    }
    await invoke(repo);
  });
  expect(await snapshot(sourceRoot)).toEqual(original);
}

function cli(repo: string, file: string, args: string[]) {
  const tool = architectureCanonicalTool(sourceRoot);
  expect(sha(readFileSync(tool.cli))).toBe(tool.cliSha256);
  const result = spawnSync(tool.node, [tool.cli, ...args, "--file", file, "--json"], { cwd: repo, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.signal) throw new Error(`공개 CLI 실행 실패: ${result.error ?? result.signal}`);
  const parsed: unknown = JSON.parse(result.stdout);
  return { code: result.status, value: object(parsed), stderr: result.stderr };
}

function facts(value: Record<string, unknown>) {
  return rows(object(value.formatReadiness).approvalFacts);
}

function checked(value: Record<string, unknown>, aligned: boolean) {
  expect(object(value.syntax).status                   ).toBe           ("valid") ;
  expect(object(value.formatReadiness).approvalEligible).toBe           (true   ) ;
  expect(facts(value).length                           ).toBeGreaterThan(0      ) ;
  for (const fact of facts(value)) expect(fact.proofComplete).toBe(true);
  for (const result of rows(value.results)) {
    const summary = object(result.summary);
    expect(summary.refused).toBe(0);
    expect(summary.suggested).toBe(0);
    if (aligned) expect(summary.misaligned).toBe(0);
  }
}

function preservation(before: string, after: string) {
  const scan = (input: string) => {
    const scanner                    = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, input) ;
    const tokens: [number, string][] = []                                                                                  ;
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
      if (kind !== ts.SyntaxKind.WhitespaceTrivia && kind !== ts.SyntaxKind.NewLineTrivia) tokens.push([kind, scanner.getTokenText()]);
    }
    return tokens;
  };
  expect(scan(after)).toEqual(scan(before));
  const printer = ts.createPrinter()                                                                                           ;
  const print   = (input: string) => printer.printFile(ts.createSourceFile("fixture.ts", input, ts.ScriptTarget.Latest, true)) ;
  expect(print(after)).toBe(print(before));
  expect(after.split("\n").map((line) => line.match(/^\s*/)?.[0])).toEqual(before.split("\n").map((line) => line.match(/^\s*/)?.[0]));
}

async function pipeline(repo: string, file: string) {
  const target = path.join(repo, file)             ;
  const before = await fs.readFile(target, "utf8") ;
  checked(cli(repo, file, ["check", "--source"]).value, false);
  let applied: string | undefined;
  for (const args of [["align", "--dry-run"], ["align"], ["align"]]) {
    const prior  = await fs.readFile(target, "utf8") ;
    const result = cli(repo, file, args)             ;
    expect(result.code                          ).toBe(0    ) ;
    expect(result.value.ok                      ).toBe(true ) ;
    expect(result.value.fixedPoint              ).toBe(true ) ;
    expect(result.value.horizontalWhitespaceOnly).toBe(true ) ;
    expect(result.value.formatterExecuted       ).toBe(false) ;
    for (const key of ["atomic", "approvalChecked", "parserChecked"]) expect(object(result.value.safety)[key]).toBe(true);
    const current = await fs.readFile(target, "utf8");
    if (args.includes("--dry-run")) expect(current).toBe(prior);
    else {
      if (applied !== undefined) expect(current).toBe(applied);
      applied = current;
    }
  }
  const after = await fs.readFile(target, "utf8")       ;
  const fixed = cli(repo, file, ["align", "--dry-run"]) ;
  expect(fixed.code                  ).toBe(0    ) ;
  expect(fixed.value.canonicalChanged).toBe(false) ;
  expect(fixed.value.fixedPoint      ).toBe(true ) ;
  checked(cli(repo, file, ["check", "--source"]).value, true);
  preservation(before, after);
  return after;
}

test("AC1 실제 인간 답변·고정 28키86쌍·공개 proof 및 Git JSON prefix를 대조한다", async () => {
  const response = object((await json(".boxbox/approvals/ts-v1-response.json")).typescript);
  expect(response.callId        ).toBe("call_f67526579a0b472bb989ac500b9c51f8"                                             ) ;
  expect(response.questionItemId).toBe('["request_user_input_async","call_f67526579a0b472bb989ac500b9c51f8",0]'            ) ;
  expect(response.answer        ).toBe("제안 v1의 28개 규칙 등록·적용 승인"                                                ) ;
  expect(response.proposalSha256).toBe(sha(await fs.readFile(path.join(sourceRoot, ".boxbox/rules/www-ts-v1-approved.md")))) ;
  const sections    = await proposal()                                                                             ;
  const expected    = sections.flatMap((entry) => entry.files.map((file) => `${entry.key}\t${file}`)).sort()       ;
  const conventions = (await registry("conventions.jsonl")).filter((row) => text(row.id).startsWith("www-ts-v1-")) ;
  expect(conventions.map((row) => `${text(row.key)}\t${text(row.scope)}`).sort()).toEqual(expected);
  expect(new Set(conventions.map((row) => row.id)).size).toBe(86);
  const decisions = (await registry("decisions.jsonl")).filter((row) => text(row.id).startsWith("www-ts-v1-"));
  expect(decisions.map((row) => row.id).sort()).toEqual(conventions.map((row) => row.id).sort());
  const examples = (await registry("examples.jsonl")).filter((row) => text(row.id).startsWith("www-ts-v1-"));
  expect(examples.length).toBe(56);
  for (const convention of conventions) {
    expect(convention.status).toBe("approved");
    expect(convention.versions).toEqual({ lookupKey: 1, conventionSchema: 1, exampleSchema: 1, decisionSchema: 1 });
    const entry = sections.find((entry) => entry.key === convention.key);
    if (!entry) throw new Error("추가 key 거부");
    const decision = decisions.find((row) => row.id === convention.id);
    if (!decision) throw new Error("proof 누락");
    expect(decision.ref     ).toBe   (`.boxbox/rules/www-ts-v1-approved.md#${entry.heading}`) ;
    expect(decision.docHash ).toBe   (entry.docHash                                         ) ;
    expect(decision.kind    ).toBe   ("rule"                                                ) ;
    expect(decision.layer   ).toBe   ("convention"                                          ) ;
    expect(decision.examples).toEqual(convention.examples                                   ) ;
    const linked = examples.filter((row) => Array.isArray(row.rules) && row.rules.includes(convention.id));
    expect(linked.map((row) => row.id).sort()).toEqual(Array.isArray(convention.examples) ? [...convention.examples].sort() : []);
    expect(linked.some((row) => row.before === entry.before && row.after === entry.after && row.verdict === "after-better")).toBe(true);
    for (const example of linked) {
      expect(example.contentHash).toBe   (`sha256:${sha(text(example.before) + "\0" + text(example.after))}`) ;
      expect(example.status     ).toBe   ("approved"                                                        ) ;
      expect(example.patterns   ).toEqual([convention.pattern]                                              ) ;
      expect(example.versions   ).toEqual(convention.versions                                               ) ;
    }
  }
  for (const file of ["conventions.jsonl", "decisions.jsonl", "examples.jsonl", "rules/json-scalar-fields.md"]) {
    const relative = `.boxbox/${file}`                                                                                       ;
    const baseline = spawnSync("git", ["show", `8e38c9b2fba15ea47c5b1dd572e6696d79ac3d09:${relative}`], { cwd: sourceRoot }) ;
    expect(baseline.status).toBe(0);
    const current = await fs.readFile(path.join(sourceRoot, relative));
    expect(current.subarray(0, baseline.stdout.length)).toEqual(baseline.stdout);
    if (file.endsWith(".md")) expect(current).toEqual(baseline.stdout);
  }
  await stage(async (repo) => {
    const actual: string[] = []                                                     ;
    const scopes           = [...new Set(sections.flatMap((entry) => entry.files))] ;
    expect(scopes.length).toBe(19);
    for (const file of scopes) {
      const guide = cli(repo, file, ["guide", "--authoring"]);
      expect(guide.code).toBe(0);
      expect(guide.value.writeAuthorized).toBe(false);
      for (const unavailable of rows(guide.value.unavailable)) {
        expect(conventions.some((row) => row.key === unavailable.key && row.scope === file)).toBe(false);
      }
      for (const rule of rows(guide.value.rules).filter((rule) => text(rule.id).startsWith("www-ts-v1-"))) {
        const convention = conventions.find((row) => row.id === rule.id);
        if (!convention) throw new Error("guide의 추가 v1 rule");
        expect(rule.layer).toBe("project"     ) ;
        expect(rule.scope).toBe(file          ) ;
        expect(rule.key  ).toBe(convention.key) ;
        const linked = examples.filter((row) => Array.isArray(row.rules) && row.rules.includes(rule.id));
        expect([...rows(rule.examples), ...rows(rule.counterexamples)].map((row) => row.id).sort()).toEqual(linked.map((row) => row.id).sort());
        for (const example of [...rows(rule.examples), ...rows(rule.counterexamples)]) {
          const saved = linked.find((row) => row.id === example.id);
          expect(example.before).toBe(saved?.before);
          expect(example.after).toBe(saved?.after);
        }
        actual.push(`${rule.key}\t${file}`);
      }
    }
    expect(actual.sort()).toEqual(expected);
    const jsonExample = (await registry("examples.jsonl")).find((row) => row.id === "www-json-fields-positive");
    if (!jsonExample) throw new Error("기존 JSON 양성 누락");
    for (const file of ["docs/work/Fixture/001-proof/work.json", "src/architecture.generated.json", "docs/architecture/structure.json"]) {
      await fs.mkdir(path.dirname(path.join(repo, file)), { recursive: true });
      await fs.writeFile(path.join(repo, file), text(jsonExample.before));
      const report = cli(repo, file, ["check", "--source"]).value;
      checked(report, false);
      expect(facts(report)).toEqual([expect.objectContaining({ key: "v1|json|object|mapping|key-colon>value", conventionId: "www-json-fields", layer: "project", proofComplete: true })]);
    }
  });
}, 300_000);

test("AC2 현재 승인 원본·실제 FIXABLE 쓰기·범위와 구조 거부를 격리 pipeline으로 검사한다", async () => {
  const positive = (await proposal())[0];
  await stage(async (repo) => {
    for (const file of ["scripts/architecture-contract.ts", "scripts/workflow.ts"]) {
      const before = await fs.readFile(path.join(repo, file), "utf8");
      expect(await pipeline(repo, file)).toBe(before);
    }
    const exact = positive.files[0];
    await fs.writeFile(path.join(repo, exact), positive.before);
    const initial = cli(repo, exact, ["check", "--source"]).value;
    expect(object(rows(initial.results)[0].summary).misaligned).toBeGreaterThan(0);
    expect(await pipeline(repo, exact)).toBe(positive.after);
    for (const scenario of [
      { file : "test/__boxbox_v1_outside_scope__.ts" , source : positive.before                                                           , key : positive.key                                       , compressed : false },
      { file : exact                                 , source : "function sample() {\n  let a = 0;\n  a = 1;\n  a = 22;\n  a = 333;\n}\n" , key : "v1|typescript|Block|assignments|equals>semicolon" , compressed : false },
      { file : exact                                 , source : positive.before + "interface Compact { a: number; b: string; }\n"         , key : positive.key                                       , compressed : true  },
    ]) {
      await fs.mkdir(path.dirname(path.join(repo, scenario.file)), { recursive: true });
      await fs.writeFile(path.join(repo, scenario.file), scenario.source);
      const report = cli(repo, scenario.file, ["check", "--source"]).value;
      expect(object(report.syntax).status).toBe("valid");
      expect(facts(report).some((fact) => fact.key === scenario.key && fact.proofComplete === scenario.compressed)).toBe(true);
      if (scenario.compressed) expect(rows(rows(report.results)[0].groups).some((group) => group.state === "SUGGEST" && group.kind === "interface-members-compressed")).toBe(true);
      else {
        const guide = cli(repo, scenario.file, ["guide", "--authoring"]);
        expect(rows(guide.value.rules).some((rule) => rule.key === scenario.key)).toBe(false);
      }
      for (const args of [["align", "--dry-run"], ["align"]]) {
        const refused = cli(repo, scenario.file, args);
        expect(refused.code                                             ).not.toBe(0              ) ;
        expect(refused.value.ok                                         )    .toBe(false          ) ;
        expect(await fs.readFile(path.join(repo, scenario.file), "utf8"))    .toBe(scenario.source) ;
      }
    }
  });
}, 300_000);

test("AC2 과거 v3 질문과 현재 직접 승인 80쌍의 공개 proof를 분리한다", async () => {
  const question = await json(`${approvalDirectory}/stable-delta-v3-question.json`);
  expect(question.state).toBe("asked-awaiting-user-answer");
  expect(question.answer).toBe(null);
  const md = await fs.readFile(path.join(sourceRoot, approvalDirectory, "stable-delta-v3.md"));
  expect(sha(md)).toBe("9ba598dac06cadab0e77c50f04b07350ebba8cc7e3fdbe84c77af458d9a0bac3");
  expect(question.proposalSha256).toBe(sha(md));
  const fixed = await json(`${approvalDirectory}/stable-delta-v3.json`);
  expect(fixed.status            ).toBe("review-only-not-user-approved-not-applied") ;
  expect(rows(fixed.files).length).toBe(15                                         ) ;
  expect(rows(fixed.pairs).length).toBe(76                                         ) ;
  const pair = (row: Record<string, unknown>) => `${text(row.key)}\t${text(row.file)}`;
  const mdPairs = md.toString("utf8").split(/(?=^## D\d+\.)/m).slice(1).flatMap((section) => {
    const key   = section.match(/^`(v1\|[^`]+)`/m)?.[1]    ;
    const scope = section.match(/^정확 파일: (.+)$/m)?.[1] ;
    if (!key || !scope) throw new Error("v3 key/scope 누락");
    return [...scope.matchAll(/`([^`]+)`/g)].map((match) => `${key}\t${match[1]}`);
  });
  expect(mdPairs.sort()).toEqual(rows(fixed.pairs).map(pair).sort());
  expect(rows(fixed.files).flatMap((entry) => rows(entry.allOfficialApprovalFacts).filter((fact) => fact.proofComplete !== true).map((fact) => `${text(fact.key)}\t${text(entry.file)}`)).sort()).toEqual(rows(fixed.pairs).map(pair).sort());
  const response = await json(".boxbox/approvals/ts-v3-extra4-response.json");
  expect(object(response.source).userLiteral             ).toBe("1"                   ) ;
  expect(object(response.source).choiceLabel             ).toBe("1. 두 제안 모두 승인") ;
  expect(object(response.source).questionItemId          ).toBe(null                  ) ;
  expect(object(response.scope).pairs                    ).toBe(80                    ) ;
  expect(object(response.scope).newKeyOrFileAutoExpansion).toBe(false                 ) ;
  const extraPath = approvalDirectory.replace(/approvals$/, "decisions/extra-4-v1") ;
  const extra     = await json(`${extraPath}.json`)                                 ;
  expect(sha(await fs.readFile(path.join(sourceRoot, `${extraPath}.md`)))).toBe("9936c15573044027ad305a5d056b4bb03347a1bcdac4b96ce66d4004bf9f7dce");
  expect(rows(extra.entries).length).toBe(4);
  const expected = [...mdPairs, ...rows(extra.entries).map((entry) => `${text(entry.key)}\t${text(entry.exactFileScope)}`)].sort();
  expect(new Set(expected).size).toBe(80);
  expect(rows(response.proposals).map((entry) => entry.id)).toEqual(["stable-delta-v3", "extra-4-v1"]);
  for (const entry of rows(response.proposals)) {
    expect(entry.mdPath    ).toBe(entry.id === "stable-delta-v3" ? `${approvalDirectory}/stable-delta-v3.md` : `${extraPath}.md`    ) ;
    expect(entry.jsonPath  ).toBe(entry.id === "stable-delta-v3" ? `${approvalDirectory}/stable-delta-v3.json` : `${extraPath}.json`) ;
    expect(entry.mdSha256  ).toBe(sha(await fs.readFile(path.join(sourceRoot, text(entry.mdPath))))                                 ) ;
    expect(entry.jsonSha256).toBe(sha(await fs.readFile(path.join(sourceRoot, text(entry.jsonPath))))                               ) ;
    expect(entry.exactPairs).toBe(entry.id === "stable-delta-v3" ? 76 : 4                                                           ) ;
  }
  const selected    = (entry: Record<string, unknown>) => /^(www-ts-v3-|www-ts-extra4-v1-)/.test(text(entry.id)) ;
  const conventions = (await registry("conventions.jsonl")).filter(selected)                                     ;
  const decisions   = (await registry("decisions.jsonl")).filter(selected)                                       ;
  const examples    = await registry("examples.jsonl")                                                           ;
  expect(conventions.map((entry) => `${text(entry.key)}\t${text(entry.scope)}`).sort()).toEqual(expected                                   ) ;
  expect(decisions.map((entry) => entry.id).sort()                                    ).toEqual(conventions.map((entry) => entry.id).sort()) ;
  expect(new Set(conventions.map((entry) => entry.id)).size                           ).toBe   (80                                         ) ;
  const originalCounter = examples.find((entry) => entry.id === "www-ts-v1-26e1121b0fdd-literal-counter");
  if (!originalCounter) throw new Error("기존 v1 반례 누락");
  for (const convention of conventions) {
    expect(convention.status).toBe("approved");
    const decision = decisions.find((entry) => entry.id === convention.id);
    if (!decision) throw new Error("현재 승인 decision 누락");
    const [document, heading] = text(decision.ref).split("#");
    const section = (await fs.readFile(path.join(sourceRoot, document), "utf8")).split(/(?=^## )/m).find((entry) => entry.startsWith(`## ${heading}\n`));
    if (!section) throw new Error("현재 승인 문서 section 누락");
    expect(decision.docHash).toBe(`sha256:${sha(section.trim() + "\n")}`);
    expect(decision.examples).toEqual(convention.examples);
    const linked = examples.filter((entry) => Array.isArray(entry.rules) && entry.rules.includes(convention.id));
    expect(linked.map((entry) => entry.id).sort()                  ).toEqual(Array.isArray(convention.examples) ? [...convention.examples].sort() : []) ;
    expect(linked.some((entry) => entry.verdict === "after-better")).toBe   (true                                                                     ) ;
    expect(linked.some((entry) => entry.verdict === "bad")         ).toBe   (true                                                                     ) ;
    for (const example of linked) {
      expect(example.status).toBe("approved");
      expect(example.contentHash).toBe(`sha256:${sha(text(example.before) + "\0" + text(example.after))}`);
      if (typeof example.note === "string" && example.note.includes("기존 v1")) {
        expect(example.before ).toBe     (originalCounter.before                 ) ;
        expect(example.after  ).toBe     (originalCounter.after                  ) ;
        expect(example.verdict).toBe     (originalCounter.verdict                ) ;
        expect(example.note   ).toContain(".boxbox/approvals/ts-v1-response.json") ;
      }
    }
  }
  const delta: unknown[] = [];
  for (const entry of rows(fixed.files)) {
    const file     = text(entry.file)                                                                                                        ;
    const report   = cli(sourceRoot, file, ["check", "--source"]).value                                                                      ;
    const pending  = facts(report).filter((fact) => fact.proofComplete !== true).map((fact) => text(fact.key)).sort()                        ;
    const prior    = rows(entry.allOfficialApprovalFacts).filter((fact) => fact.proofComplete !== true).map((fact) => text(fact.key)).sort() ;
    const guide    = cli(sourceRoot, file, ["guide", "--authoring"]).value                                                                   ;
    const approved = conventions.filter((rule) => rule.scope === file)                                                                       ;
    expect(rows(guide.rules).filter(selected).map((rule) => `${text(rule.key)}\t${text(rule.scope)}`).sort()).toEqual(approved.map((rule) => `${text(rule.key)}\t${text(rule.scope)}`).sort());
    for (const rule of approved) {
      expect(rows(guide.rules).some((entry) => entry.id === rule.id && entry.key === rule.key && entry.scope === file)).toBe(true);
      expect(rows(guide.unavailable).some((entry) => entry.key === rule.key)).toBe(false);
    }
    for (const fact of facts(report)) expect(fact.proofComplete).toBe(true);
    delta.push({ file, proposalSourceSha256: entry.sourceSha256, currentSourceSha256: sha(await fs.readFile(path.join(sourceRoot, file))), fixedPendingKeys: prior, currentPendingKeys: pending, addedOutsideQuestion: pending.filter((key) => !prior.includes(key)), absentFromCurrentSource: prior.filter((key) => !pending.includes(key)) });
  }
  console.log("v3-pending-addendum " + JSON.stringify(delta));
}, 300_000);

test("AC4 fresh WorkRecord·실제 WorkReport를 공개 pinned CLI golden bytes와 대조한다", async () => {
  const tool = architectureCanonicalTool(sourceRoot);
  const payloads = [
    { a    : 1              , longer   : 2      , mid      : 3                                                                                                                                                                        },
    { a    : 1              , longer   : 2                                                                                                                                                                                            },
    { a    : 1              , long     : 2      , child    : { x: 1, yy: 2, zzz: 3 } , b       : 4         , c  : 5       , empty : {}       , arr       : [{ a: 1, bb: 2, ccc: 3 }] , tail     : []                                  },
    { 가   : 1              , 漢       : 2      , あ       : 3                       , カ      : 4         , a  : 5                                                                                                                   },
    { "😀"  : 1              , "é"     : 2      , x        : 3                                                                                                                                                                        },
    { '"'  : "\\\n\t\u0000" , "a:b,{}" : "😀‍가" , "\ud800" : "\udfff"                                                                                                                                                                 },
    { "10" : 10             , "2"      : 2      , a        : -0                      , omitted : undefined , fn : () => 1 , sym   : Symbol() , nonfinite : NaN                       , infinity : Infinity, array: [, undefined, NaN] },
  ];
  function compare(value: unknown, actual: string) {
    const native   = JSON.stringify(value, null, 2) + "\n"              ;
    const expected = canonicalArchitectureJson(sourceRoot, value, tool) ;
    expect(actual                                                  ).toBe   (expected                                                ) ;
    expect(Buffer.byteLength(actual)                               ).toBe   (Buffer.byteLength(expected)                             ) ;
    expect(sha(actual)                                             ).toBe   (sha(expected)                                           ) ;
    expect(JSON.stringify(JSON.parse(actual))                      ).toBe   (JSON.stringify(JSON.parse(native))                      ) ;
    expect(actual.split("\n").map((line) => line.match(/^ */)?.[0])).toEqual(native.split("\n").map((line) => line.match(/^ */)?.[0])) ;
    const literals = (input: string) => input.match(/"(?:[^"\\]|\\.)*"/g);
    expect(literals(actual)).toEqual(literals(native));
  }
  for (const payload of payloads) {
    const value = Object.assign(record(), { payload });
    compare(value, serializeWorkRecord(value, true));
  }
  await fixture(async (repo) => {
    await enable(repo);
    const directory = path.join(repo, "docs/work/Workflow/001-golden");
    await fs.mkdir(directory, { recursive: true });
    const work = record();
    await fs.writeFile(path.join(directory, "work.json"), JSON.stringify(work));
    const written  = await publishWorkReport({ repo, workId: work.id, narrative }) ;
    const expected = canonicalArchitectureJson(sourceRoot, written.report, tool)   ;
    const actual   = serializeWorkReport(written.report, true)                     ;
    compare(written.report, actual);
    expect(actual                                                                                 ).toBe(expected                   ) ;
    expect(await fs.readFile(path.join(directory, "reports", `${written.report.id}.json`), "utf8")).toBe(expected                   ) ;
    expect(Buffer.byteLength(actual)                                                              ).toBe(Buffer.byteLength(expected)) ;
    expect(sha(actual)                                                                            ).toBe(sha(expected)              ) ;
  });
}, 300_000);
