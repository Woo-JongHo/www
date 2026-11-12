import assert from "node:assert/strict";
import { promises as fs, readdirSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { createNativeReportHarness, type NativeReportJob } from "../src/native-reports";
import type { NativeReportDecision, NativeReportInput } from "../src/report-judge";
import { ReportJudgeError } from "../src/report-judge";
import { listWorkReports, readWorkReport } from "../scripts/workflow/reports.ts";

type Harness = ReturnType<typeof createNativeReportHarness>;

async function repository(t: TestContext): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "www-native-report-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

function input(turnId = "turn-1"): NativeReportInput {
  return { threadId: "thread-1", turnId, prompt: "PRIVATE_PROMPT_MARKER", answer: "PRIVATE_ANSWER_MARKER", commands: [{ command: "bun test", exitCode: 0, status: "completed" }], files: ["src/item.ts"], truncated: false };
}

function decision(needed = true): NativeReportDecision {
  return {
    needed, reason: needed ? "구현과 검증 경과를 함께 읽는 것이 유용합니다." : "짧은 확인 답변이라 보고서를 생략합니다.", title: needed ? "변경 전후를 보고서로 읽어요" : "", narrative: needed ? {
      summary: "관찰한 작업을 쉬운 설명과 검증 근거로 묶었습니다.", before: "변경 내용을 대화에서 찾아야 했습니다.", after: "리포트 화면에서 읽을 수 있습니다.", changes: ["보고서를 저장했습니다."], decisions: ["원문을 저장하지 않고 작성 결과만 보관합니다."], limitations: ["Native 답변은 독립 검증의 통과를 뜻하지 않습니다."], next: ["필요하면 별도로 검토합니다."],
    } : null,
  };
}

async function waitFor(harness: Harness, repo: string, key: string, status: NativeReportJob["status"]): Promise<NativeReportJob> {
  for (let attempt = 0; attempt < 250; attempt++) {
    const job = (await harness.list(repo)).find((entry) => entry.key === key);
    if (job?.status === status) return job;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Native 보고서 상태 대기 초과: ${status}`);
}

async function allText(directory: string): Promise<string> {
  const entries = await fs.readdir(directory, { withFileTypes: true })                                                                                                                                                          ;
  const parts   = await Promise.all(entries.filter((entry) => !entry.isSymbolicLink()).map((entry) => entry.isDirectory() ? allText(path.join(directory, entry.name)) : fs.readFile(path.join(directory, entry.name), "utf8"))) ;
  return parts.join("\n");
}

test("필요 판단은 실제 보고서를 저장하며 원문·검증 통과를 발명하지 않는다", async (t) => {
  const repo                      = await repository(t) ;
  const states: NativeReportJob[] = []                  ;
  let calls                       = 0                   ;
  const authored                  = decision()          ;
  if (authored.narrative) authored.narrative.reader = { story: "구현 결과를 보고서로 연결했습니다.", requirements: [], checks: [], decisions: [], references: [], nextActions: [] };
  const harness = createNativeReportHarness({ judge: async () => { calls++; return authored; }, onState: (job) => { states.push(job); } }) ;
  const queued  = await harness.enqueue({ repository: repo, input: input() })                                                              ;
  assert.equal(queued.status, "queued");
  const saved = await waitFor(harness, repo, queued.key, "saved");
  assert.equal(calls, 1);
  assert.ok(saved.reportId);
  const report = await readWorkReport({ repo, reportId: saved.reportId ?? "" });
  assert.equal(report.report.kind, "authored");
  assert.deepEqual(report.report.narrative?.reader, authored.narrative?.reader);
  assert.equal(report.report.outcome, "blocked");
  assert.equal(report.report.sourceDigest, null);
  assert.equal(report.report.work.criteria[0].result, "unverified");
  assert.equal(report.report.work.reviews.length, 0);
  assert.ok(states.some((job) => job.status === "judging"));
  const disk = await allText(repo);
  assert.doesNotMatch(disk, /PRIVATE_PROMPT_MARKER|PRIVATE_ANSWER_MARKER/);
  assert.match(disk, /AC-NATIVE/);
  assert.match(disk, /bun test/);
  assert.match(await fs.readFile(path.join(repo, "docs/work/INDEX.md"), "utf8"), /## Native/);
});

test("생략 판단은 메타만 보존하고 docs/work를 만들지 않는다", async (t) => {
  const repo    = await repository(t)                                                                    ;
  let calls     = 0                                                                                      ;
  const harness = createNativeReportHarness({ judge: async () => { calls++; return decision(false); } }) ;
  const queued  = await harness.enqueue({ repository: repo, input: input() })                            ;
  const skipped = await waitFor(harness, repo, queued.key, "skipped")                                    ;
  assert.equal(skipped.reportId, null);
  await assert.rejects(fs.stat(path.join(repo, "docs/work")), /ENOENT/);
  assert.equal((await harness.enqueue({ repository: repo, input: input() })).status, "skipped");
  assert.equal((await harness.retry(repo, queued.key)).status, "skipped");
  assert.equal(calls, 1);
  assert.doesNotMatch(await allText(repo), /PRIVATE_PROMPT_MARKER|PRIVATE_ANSWER_MARKER/);
});

test("동시 중복 enqueue는 한 번만 판단·저작한다", async (t) => {
  const repo    = await repository(t)                                                                                       ;
  let calls     = 0                                                                                                         ;
  const harness = createNativeReportHarness({ judge: async () => { calls++; return decision(); } })                         ;
  const jobs    = await Promise.all(Array.from({ length: 5 }, () => harness.enqueue({ repository: repo, input: input() }))) ;
  assert.equal(new Set(jobs.map((job) => job.key)).size, 1);
  await waitFor(harness, repo, jobs[0].key, "saved");
  assert.equal(calls, 1);
  assert.equal((await listWorkReports({ repo })).reports.length, 1);
});

test("판단 실패는 자동 재실행하지 않고 명시 retry만 다시 판단한다", async (t) => {
  const repo    = await repository(t)                                                                                                                  ;
  let calls     = 0                                                                                                                                    ;
  const harness = createNativeReportHarness({ judge: async (value) => { if (++calls === 1) throw new Error(value.prompt); return decision(false); } }) ;
  const queued  = await harness.enqueue({ repository: repo, input: input() })                                                                          ;
  const failed  = await waitFor(harness, repo, queued.key, "failed")                                                                                   ;
  assert.doesNotMatch(failed.reason, /PRIVATE_PROMPT_MARKER/);
  assert.equal((await harness.enqueue({ repository: repo, input: input() })).status, "failed");
  assert.equal(calls, 1);
  await harness.retry(repo, queued.key);
  await waitFor(harness, repo, queued.key, "skipped");
  assert.equal(calls, 2);
});

test("작업 등록 후 저장 실패를 retry하면 같은 작업 UUID를 재사용한다", async (t) => {
  const repo                   = await repository(t) ;
  const outside                = await repository(t) ;
  let injection: string | null = null                ;
  let injected                 = false               ;
  let calls                    = 0                   ;
  const harness = createNativeReportHarness({
    judge: async () => { calls++; return decision(); },
    onState: (job) => {
      if (!job.workId || injected) return;
      const folder = readdirSync(path.join(repo, "docs/work/Native"))[0];
      injection = path.join(repo, "docs/work/Native", folder, "reports");
      symlinkSync(outside, injection, "dir");
      injected = true;
    },
  });
  const queued = await harness.enqueue({ repository: repo, input: input() }) ;
  const failed = await waitFor(harness, repo, queued.key, "failed")          ;
  assert.ok(failed.workId);
  assert.match(failed.reason, /보고서 또는 작업 상태 저장에 실패/);
  assert.ok(injection);
  await fs.unlink(injection ?? "");
  await harness.retry(repo, queued.key);
  const saved = await waitFor(harness, repo, queued.key, "saved");
  assert.equal(saved.workId, failed.workId);
  assert.equal(calls, 1);
  assert.equal((await fs.readdir(path.join(repo, "docs/work/Native"))).length, 1);
  assert.equal((await listWorkReports({ repo })).reports.length, 1);
  assert.deepEqual(await fs.readdir(outside), []);
});

test("재시작에서 남은 judging은 interrupted이며 원문 없이 자동 복구하지 않는다", async (t) => {
  const repo                                         = await repository(t)                                                    ;
  let release: (value: NativeReportDecision) => void = () => {}                                                               ;
  const gate                                         = new Promise<NativeReportDecision>((resolve) => { release = resolve; }) ;
  const original                                     = createNativeReportHarness({ judge: () => gate })                       ;
  const queued                                       = await original.enqueue({ repository: repo, input: input() })           ;
  await waitFor(original, repo, queued.key, "judging");
  let restartCalls  = 0                                                                                        ;
  const restarted   = createNativeReportHarness({ judge: async () => { restartCalls++; return decision(); } }) ;
  const interrupted = (await restarted.list(repo))[0]                                                          ;
  assert.equal(interrupted.status, "interrupted");
  await assert.rejects(restarted.retry(repo, queued.key), /원문이 메모리에/);
  assert.equal(restartCalls, 0);
  release(decision(false));
  await waitFor(original, repo, queued.key, "skipped");
  const again = createNativeReportHarness({ judge: async () => { restartCalls++; return decision(); } });
  assert.equal((await again.enqueue({ repository: repo, input: input() })).status, "skipped");
  assert.equal(restartCalls, 0);
});

test("큐는 저장소별 원래 경로를 유지하고 전역으로 직렬 실행한다", async (t) => {
  const first  = await repository(t) ;
  const second = await repository(t) ;
  let running  = 0                   ;
  let maximum  = 0                   ;
  const harness = createNativeReportHarness({ judge: async () => {
    running++;
    maximum = Math.max(maximum, running);
    await new Promise((resolve) => setTimeout(resolve, 30));
    running--;
    return decision();
  } });
  const one = await harness.enqueue({ repository: first , input: input()}) ;
  const two = await harness.enqueue({ repository: second, input: input()}) ;
  await waitFor(harness, first, one.key, "saved");
  await waitFor(harness, second, two.key, "saved");
  assert.equal(maximum, 1);
  assert.equal((await listWorkReports({ repo: first })).reports.length, 1);
  assert.equal((await listWorkReports({ repo: second })).reports.length, 1);
});

test("pending 10개·96k 입력·쓰기 경로의 심볼릭 링크를 선행 거부한다", async (t) => {
  const repo                                          = await repository(t)                                                    ;
  let release : (value: NativeReportDecision) => void = () => {}                                                               ;
  const gate                                          = new Promise<NativeReportDecision>((resolve) => { release = resolve; }) ;
  const harness                                       = createNativeReportHarness({ judge: () => gate })                       ;
  const jobs  : NativeReportJob[]                     = []                                                                     ;
  for (let number = 0; number < 10; number++) jobs.push(await harness.enqueue({ repository: repo, input: input(`turn-${number}`) }));
  await assert.rejects(harness.enqueue({ repository: repo, input: input("overflow") }), /10개/);
  const oversized = { ...input("large"), prompt: "한".repeat(40_000) };
  await assert.rejects(harness.enqueue({ repository: repo, input: oversized }), /96,000/);
  release(decision(false));
  await waitFor(harness, repo, jobs[9].key, "skipped");
  const linked  = await repository(t) ;
  const outside = await repository(t) ;
  await fs.symlink(outside, path.join(linked, ".www"), "dir");
  await assert.rejects(harness.enqueue({ repository: linked, input: input() }), /심볼릭 링크/);
  assert.deepEqual(await fs.readdir(outside), []);
  await assert.rejects(harness.retry(repo, "../../private"), /키가 올바르지/);
});

test("원문 메모리는 최근 20개로 제한되고 오래된 실패는 retry하지 않는다", async (t) => {
  const repo           = await repository(t)                                                                        ;
  const harness        = createNativeReportHarness({ judge: async () => { throw new Error("의도한 판단 실패"); } }) ;
  const keys: string[] = []                                                                                         ;
  for (let number = 0; number < 22; number++) {
    const job = await harness.enqueue({ repository: repo, input: input(`turn-${number}`) });
    keys.push(job.key);
    await waitFor(harness, repo, job.key, "failed");
  }
  await assert.rejects(harness.retry(repo, keys[0]), /원문이 메모리에/);
  await harness.retry(repo, keys[21]);
  await waitFor(harness, repo, keys[21], "failed");
  assert.doesNotMatch(await allText(repo), /PRIVATE_PROMPT_MARKER|PRIVATE_ANSWER_MARKER/);
});

test("안전한 작업명과 Native 목차 영역을 유지하고 저장 상태 손상을 거부한다", async (t) => {
  const repo = await repository(t);
  await fs.mkdir(path.join(repo, "docs/work"), { recursive: true });
  await fs.writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업 목차\n\n## Native\n\n기존 항목\n\n## Other\n\n다른 영역\n");
  const harness = createNativeReportHarness({ judge: async () => ({ ...decision(), title: "../새 작업: <변경> / 확인?" }) }) ;
  const queued  = await harness.enqueue({ repository: repo, input: input() })                                                ;
  await waitFor(harness, repo, queued.key, "saved");
  const folder = (await fs.readdir(path.join(repo, "docs/work/Native")))[0];
  assert.doesNotMatch(folder, /[<>:"\\|?*]/);
  const index = await fs.readFile(path.join(repo, "docs/work/INDEX.md"), "utf8");
  assert.ok(index.indexOf("[명세]") < index.indexOf("## Other"));
  assert.match(index, /%EC/);
  const metadata        = path.join (repo, ".www/native-report-jobs", `${queued.key}.json`) ;
  const stored: unknown = JSON.parse(await fs.readFile(metadata, "utf8")                  ) ;
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) throw new Error("fixture 상태 객체가 필요합니다.");
  await fs.writeFile(metadata, JSON.stringify({ ...stored, status: "saved", reportId: null }));
  const restarted = createNativeReportHarness({ judge: async () => decision(false) });
  await assert.rejects(restarted.list(repo), /보고서 ID가 없습니다/);
});

test("판단기의 안정 코드로 응답·입력·시간 초과·실행 오류를 구분한다", async (t) => {
  const cases = [
    { error : new ReportJudgeError("REPORT_JUDGE_INVALID_RESPONSE", "PRIVATE_PROMPT_MARKER malformed response") , label : /JSON 또는 서술 형식/        },
    { error : new ReportJudgeError("REPORT_JUDGE_INVALID_INPUT", "PRIVATE_PROMPT_MARKER invalid input")         , label : /판단 입력의 형식 또는 범위/ },
    { error : new ReportJudgeError("REPORT_JUDGE_TIMEOUT", "PRIVATE_PROMPT_MARKER timeout")                     , label : /LLM 판단 시간이 초과/       },
    { error : new SyntaxError("PRIVATE_PROMPT_MARKER JSON token")                                               , label : /LLM 판단 실행에 실패/       },
    { error : new Error("LLM 보고서 판단 JSON이 올바르지 않습니다.")                                            , label : /LLM 판단 실행에 실패/       },
    { error : new Error("보고서 LLM 판단 시간이 초과되었습니다.")                                               , label : /LLM 판단 실행에 실패/       },
    { error : new Error("PRIVATE_ANSWER_MARKER model transport")                                                , label : /LLM 판단 실행에 실패/       },
  ];
  for (const entry of cases) {
    const repo    = await repository(t)                                                      ;
    const harness = createNativeReportHarness({ judge: async () => { throw entry.error; } }) ;
    const queued  = await harness.enqueue({ repository: repo, input: input() })              ;
    const failed  = await waitFor(harness, repo, queued.key, "failed")                       ;
    assert.match(failed.reason, entry.label);
    assert.match(failed.reason, /이 앱이 실행 중일 때만/);
    assert.doesNotMatch(await allText(repo), /PRIVATE_PROMPT_MARKER|PRIVATE_ANSWER_MARKER|model transport|JSON token/);
  }
});

test("앱 종료 취소는 interrupted로 저장하고 현재·재시작 모두 retry 불가로 안내한다", async (t) => {
  for (const error of [new DOMException("PRIVATE_ANSWER_MARKER", "AbortError"), new ReportJudgeError("REPORT_JUDGE_CANCELLED", "PRIVATE_ANSWER_MARKER cancelled")]) {
    const repo  = await repository(t)   ;
    const abort = new AbortController() ;
    const harness = createNativeReportHarness({ judge: () => new Promise<NativeReportDecision>((_resolve, reject) => {
      abort.signal.addEventListener("abort", () => reject(error), { once: true });
    }) });
    const queued = await harness.enqueue({ repository: repo, input: input() });
    await waitFor(harness, repo, queued.key, "judging");
    abort.abort();
    const interrupted = await waitFor(harness, repo, queued.key, "interrupted");
    assert.match(interrupted.reason, /중단됐습니다/);
    assert.match(interrupted.reason, /재시도할 수 없습니다/);
    await assert.rejects(harness.retry(repo, queued.key), /원문이 메모리에/);
    const restarted = createNativeReportHarness({ judge: async () => decision(false) }) ;
    const after     = (await restarted.list(repo))[0]                                   ;
    assert.equal(after.status, "interrupted");
    assert.match(after.reason, /재시도할 수 없습니다/);
    await assert.rejects(restarted.retry(repo, queued.key), /원문이 메모리에/);
    assert.doesNotMatch(await allText(repo), /PRIVATE_PROMPT_MARKER|PRIVATE_ANSWER_MARKER/);
    await assert.rejects(fs.stat(path.join(repo, "docs/work")), /ENOENT/);
  }
});

test("재시작·메모리 만료로 원문이 없는 실패는 재시도 가능 안내를 남기지 않는다", async (t) => {
  const repo    = await repository(t)                                                                                                                         ;
  const harness = createNativeReportHarness({ judge: async () => { throw new ReportJudgeError("REPORT_JUDGE_INVALID_RESPONSE", "PRIVATE_PROMPT_MARKER"); } }) ;
  const queued  = await harness.enqueue({ repository: repo, input: input() })                                                                                 ;
  const failed  = await waitFor(harness, repo, queued.key, "failed")                                                                                          ;
  assert.match(failed.reason, /이 앱이 실행 중일 때만/);
  assert.equal(failed.retryAvailable, true);
  const restarted = createNativeReportHarness({ judge: async () => decision(false) }) ;
  const after     = (await restarted.list(repo))[0]                                   ;
  assert.equal(after.status, "failed");
  assert.equal(after.retryAvailable, false);
  assert.match(after.reason, /JSON 또는 서술 형식/);
  assert.match(after.reason, /재시도할 수 없습니다/);
  assert.doesNotMatch(after.reason, /재시도할 수 있습니다/);
  await assert.rejects(restarted.retry(repo, queued.key), /원문이 메모리에/);
});
