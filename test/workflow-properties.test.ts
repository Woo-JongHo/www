/**
 * @verifies RESP-DEVELOPMENT-EXECUTION
 * @verifies RESP-DEVELOPMENT-RECORDS-STATE
 */
import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { copyFile, link, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { assessUnitAcceptance, validateDecomposition, type DecompositionPlan, type DecompositionUnit } from "../scripts/workflow/decomposition.ts";
import { criteriaDigest, verify, type VerificationAttempt } from "../scripts/workflow/evidence.ts";
import { assessWork, completeWork, openWork, readWork, recordDocumentReview, recordReview, verifyWork } from "../scripts/workflow/work.ts";
import { finishWorkReport, runReportedStage } from "../scripts/workflow/report-lifecycle.ts";
import { loadReviewPolicy, runReview } from "../scripts/workflow/review.ts";
import type { CurrentWorkRecord } from "../scripts/workflow/types.ts";

// 재현: WORKFLOW_PROPERTY_SEED=16072026 bun test test/workflow-properties.test.ts
const seedText = process.env.WORKFLOW_PROPERTY_SEED ?? "16072026";
const seed = Number(seedText);
if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("WORKFLOW_PROPERTY_SEED는 uint32 정수여야 합니다.");
const PLAN_TRIALS = 160;
const TRACE_TRIALS = 12;
const TRACE_LENGTH = 12;
function random(initial: number) {
  let state = initial >>> 0;
  return (limit: number) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % limit; };
}
function makeUnit(id: string, owned: string): DecompositionUnit {
  return { taskId: id, goal: `${id} 결과 작성`, inputs: ["src"], writePaths: [owned], excludedPaths: [], dependencies: [], artifacts: [`${owned}/artifact.txt`], criterionIds: ["AC-1"], verification: { command: process.execPath, args: ["checks/verify.ts"] }, resultPath: `${owned}/result.txt` };
}
function context(repo: string) {
  return { repo, inputs: ["src"], writePaths: ["src"], criterionIds: ["AC-1"], verifierCommands: [JSON.stringify([process.execPath, "checks/verify.ts"])] };
}
function ownsSamePart(a: string, b: string) {
  const left = a.split("/");
  const right = b.split("/");
  return left.slice(0, Math.min(left.length, right.length)).every((part, index) => part === right[index]);
}
/** 생성 범위의 독립 oracle: 소유 prefix와 전이 폐쇄를 계산한다. 제품의 DFS를 복제하지 않는다. */
function planOracle(plan: DecompositionPlan): boolean {
  const units = plan.units;
  const ids = units.map(item => item.taskId);
  if (new Set(ids).size !== ids.length) return false;
  for (let left = 0; left < units.length; left++) {
    const item = units[left];
    if (item.dependencies.some(id => !ids.includes(id))) return false;
    if (item.writePaths.some(file => item.excludedPaths.some(excluded => ownsSamePart(file, excluded)))) return false;
    for (let right = left + 1; right < units.length; right++) {
      if (item.writePaths.some(a => units[right].writePaths.some(b => ownsSamePart(a, b)))) return false;
    }
  }
  const reachable = units.map(item => ids.map(id => item.dependencies.includes(id)));
  for (let via = 0; via < units.length; via++) for (let from = 0; from < units.length; from++) for (let to = 0; to < units.length; to++) {
    reachable[from][to] ||= reachable[from][via] && reachable[via][to];
  }
  return !reachable.some((row, index) => row[index]);
}
async function allowed(plan: DecompositionPlan, repo: string): Promise<boolean> {
  try { await validateDecomposition(plan, context(repo)); return true; }
  catch { return false; }
}
async function shrinkPlan(plan: DecompositionPlan, fails: (value: DecompositionPlan) => Promise<boolean>) {
  let result = structuredClone(plan);
  let reduced = true;
  while (reduced && result.units.length > 1) {
    reduced = false;
    for (let index = 0; index < result.units.length; index++) {
      const candidate = { units: result.units.filter((_, position) => position !== index) };
      if (await fails(candidate)) { result = candidate; reduced = true; break; }
    }
  }
  return result;
}

test(`분업 계획 속성: seed=${seed}, trials=${PLAN_TRIALS}, 단위 1–6·경로·의존·제외`, async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "www-plan-property-"));
  await mkdir(path.join(repo, "src"));
  const next = random(seed);
  const observed = { valid: 0, invalid: 0, cycle: 0, unknown: 0, shared: 0, excluded: 0 };
  try {
    for (let trial = 0; trial < PLAN_TRIALS; trial++) {
      const count = 1 + next(6);
      const units = Array.from({ length: count }, (_, index) => makeUnit(`task-${index}`, `src/part-${index}`));
      for (let index = 1; index < count; index++) if (next(2)) units[index].dependencies = [units[next(index)].taskId];
      const mutation = trial % 6;
      if (mutation === 1) { units[0].dependencies = [units[0].taskId]; observed.cycle++; }
      if (mutation === 2) { units[next(count)].dependencies = ["undefined-task"]; observed.unknown++; }
      if (mutation === 3 && count > 1) { units[1] = { ...makeUnit(units[1].taskId, `${units[0].writePaths[0]}/nested`), dependencies: units[1].dependencies }; observed.shared++; }
      if (mutation === 4) { units[0].excludedPaths = [`${units[0].writePaths[0]}/excluded`]; observed.excluded++; }
      if (mutation === 5 && count > 1) { units[0].dependencies = [units[count - 1].taskId]; units[count - 1].dependencies = [units[0].taskId]; observed.cycle++; }
      const plan = { units };
      const expected = planOracle(plan);
      const actual = await allowed(plan, repo);
      observed[expected ? "valid" : "invalid"]++;
      if (actual !== expected) {
        const minimized = await shrinkPlan(plan, async candidate => await allowed(candidate, repo) !== planOracle(candidate));
        assert.fail(JSON.stringify({ seed, trial, expected, actual, counterexample: minimized }));
      }
    }
    expect(observed.valid).toBeGreaterThan(0);
    expect(observed.invalid).toBeGreaterThan(0);
    for (const category of ["cycle", "unknown", "shared", "excluded"] as const) expect(observed[category]).toBeGreaterThan(0);
    console.info(JSON.stringify({ property: "decomposition", seed, trials: PLAN_TRIALS, range: "units=1..6; DAG/self/cycle/undefined; directory/child/exclusion", observed }));
  } finally { await rm(repo, { recursive: true, force: true }); }
});

test("경로 별칭 대조: 기존 파일의 hardlink 두 소유자를 거부한다", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "www-plan-alias-"));
  try {
    await mkdir(path.join(repo, "src"));
    await writeFile(path.join(repo, "src/a"), "같은 파일\n");
    await link(path.join(repo, "src/a"), path.join(repo, "src/b"));
    const a = { ...makeUnit("task-a", "src/a"), artifacts: ["src/a"], resultPath: "src/a" };
    const b = { ...makeUnit("task-b", "src/b"), artifacts: ["src/b"], resultPath: "src/b" };
    await expect(validateDecomposition({ units: [a, b] }, context(repo))).rejects.toThrow("소유 충돌");
  } finally { await rm(repo, { recursive: true, force: true }); }
});

type Event = "verify" | "verify-fail" | "verify-injected" | "verify-no-artifact" | "source" | "criterion" | "scope" | "artifact" | "host" | "executor" | "clear" | "request";
const events: Event[] = ["verify", "verify-fail", "verify-injected", "verify-no-artifact", "source", "criterion", "scope", "artifact", "host", "executor", "clear", "request"];
interface Model {
  source: number;
  criterion: number;
  scope: number;
  artifact: number;
  host: boolean;
  executor: boolean;
  verified?: { source: number; criterion: number; scope: number; artifact: number; passed: boolean; actual: boolean; artifacts: boolean };
}
function modelAccepts(model: Model) {
  const evidence = model.verified;
  return Boolean(model.host && model.executor && evidence?.passed && evidence.actual && evidence.artifacts
    && evidence.source === model.source && evidence.criterion === model.criterion && evidence.scope === model.scope && evidence.artifact === model.artifact);
}
/** 삭제 축소: known mutant가 여전히 오래된 통과를 허용하는 사건 열을 최소화한다. */
function staleCounterexample(trace: Event[]): Event[] {
  function violates(sequence: Event[]) {
    let verified = false;
    let stale = false;
    for (const event of sequence) {
      if (event === "verify") { verified = true; stale = false; }
      if (["source", "criterion", "scope", "artifact"].includes(event) && verified) stale = true;
      if (event === "request" && verified && stale) return true;
    }
    return false;
  }
  let result = [...trace];
  for (let index = 0; index < result.length;) {
    const candidate = result.filter((_, position) => position !== index);
    if (violates(candidate)) result = candidate;
    else index++;
  }
  return result;
}
function record(): CurrentWorkRecord {
  return {
    schemaVersion: 2, id: "work-12345678-1234-4234-8234-123456789abc", title: "수용 속성 fixture", kind: "maintenance", areas: ["dev"], owner: "dev", status: "verifying", blockedReason: null, relations: [],
    criteria: [{ id: "AC-1", description: "값 검사 0", required: true, result: "unverified", evidence: [] }],
    workflow: { role: "www-dev", requestId: "property-request", requestHash: "a".repeat(64), authorization: { implementation: true, writePaths: ["src", "artifacts"], mutationSurfaces: ["files"], verifierCommands: [JSON.stringify([process.execPath, "checks/verify.ts"])], commit: false, publish: false, source: "direct_user_request", requestHash: "a".repeat(64) }, inputs: ["src", "checks"], nextAction: "verify", verifications: [], reviews: [] },
  };
}

async function replay(repo: string, trace: Event[], trial: number) {
  const current = record();
  const item: DecompositionUnit = { ...makeUnit("property-task", "src"), artifacts: ["artifacts/result.txt"], resultPath: "artifacts/result.txt" };
  const model: Model = { source: 0, criterion: 0, scope: 0, artifact: 0, host: true, executor: true };
  let attempt: VerificationAttempt | undefined;
  let accepted = 0;
  let rejected = 0;
  await writeFile(path.join(repo, "src/value.txt"), "소스 0\n");
  await writeFile(path.join(repo, "artifacts/result.txt"), "산출물 0\n");
  for (let index = 0; index < trace.length; index++) {
    const event = trace[index];
    if (event.startsWith("verify")) {
      await writeFile(path.join(repo, "exit-code"), event === "verify-fail" ? "1" : "0");
      attempt = await verify({ repo, record: current, inputs: current.workflow.inputs, command: item.verification.command, args: item.verification.args, criterionIds: ["AC-1"], artifactPaths: event === "verify-no-artifact" ? [] : item.artifacts, ...(event === "verify-injected" ? { run: () => ({ code: 0 }) } : {}) });
      current.workflow.verifications.push(attempt);
      model.verified = { source: model.source, criterion: model.criterion, scope: model.scope, artifact: model.artifact, passed: event !== "verify-fail", actual: event !== "verify-injected", artifacts: event !== "verify-no-artifact" };
    }
    if (event === "source") { model.source++; await writeFile(path.join(repo, "src/value.txt"), `소스 ${model.source}\n`); }
    if (event === "criterion") { model.criterion++; current.criteria[0].description = `값 검사 ${model.criterion}`; }
    if (event === "scope") { model.scope = 1 - model.scope; current.workflow.inputs = model.scope ? ["src"] : ["src", "checks"]; }
    if (event === "artifact") { model.artifact++; await writeFile(path.join(repo, "artifacts/result.txt"), `산출물 ${model.artifact}\n`); }
    if (event === "host") model.host = !model.host;
    if (event === "executor") model.executor = !model.executor;
    if (event === "clear") { attempt = undefined; model.verified = undefined; }
    const actual = await assessUnitAcceptance({ repo, record: current, unit: item, host: { ok: model.host, outcome: model.host ? "passed" : "failed" }, executor: model.executor ? "process" : "injected", attempt });
    const expected = modelAccepts(model);
    assert.equal(actual.status === "accepted", expected, JSON.stringify({ seed, trial, eventIndex: index, trace: trace.slice(0, index + 1), model, actual }));
    if (expected) accepted++;
    else rejected++;
  }
  return { accepted, rejected };
}

test(`업무 수용 사건열 속성: seed=${seed}, traces=${TRACE_TRIALS}, length=${TRACE_LENGTH}, 실제 verifier`, async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "www-acceptance-property-"));
  const next = random(seed ^ 0x9e3779b9);
  const totals = { accepted: 0, rejected: 0 };
  const visited = new Set<Event>();
  try {
    for (const directory of ["src", "checks", "artifacts"]) await mkdir(path.join(repo, directory));
    await writeFile(path.join(repo, "checks/verify.ts"), 'import { readFileSync } from "node:fs";\nprocess.exit(Number(readFileSync("exit-code", "utf8")));\n');
    for (let trial = 0; trial < TRACE_TRIALS; trial++) {
      // 첫 성공/오류를 전부 방문하고 나머지는 순서를 생성한다. 마지막 request는 현재성 판정을 관찰한다.
      const first = events[trial];
      const trace: Event[] = ["verify", first, ...Array.from({ length: TRACE_LENGTH - 3 }, () => events[next(events.length)]), "request"];
      trace.forEach(event => visited.add(event));
      const result = await replay(repo, trace, trial);
      totals.accepted += result.accepted;
      totals.rejected += result.rejected;
    }
    expect(visited.size).toBe(events.length);
    expect(totals.accepted).toBeGreaterThan(0);
    expect(totals.rejected).toBeGreaterThan(0);
    console.info(JSON.stringify({ property: "unit-acceptance", seed, traces: TRACE_TRIALS, length: TRACE_LENGTH, events, totals, scope: "실제 verify/evaluateEvidence + 단위 수용; 전체 독립 리뷰/저작보고서 완료 판정은 별도 결함 검사" }));
  } finally { await rm(repo, { recursive: true, force: true }); }
}, 120000);

test("알려진 오래된 통과 허용 변형을 탐지하고 실제 수용 core에서 축소 반례를 재생한다", async () => {
  const minimized = staleCounterexample(["request", "host", "verify", "request", "source", "request", "artifact"]);
  expect(minimized).toEqual(["verify", "source", "request"]);
  const repo = await mkdtemp(path.join(tmpdir(), "www-acceptance-mutant-"));
  try {
    for (const directory of ["src", "checks", "artifacts"]) await mkdir(path.join(repo, directory));
    await writeFile(path.join(repo, "checks/verify.ts"), 'import { readFileSync } from "node:fs";\nprocess.exit(Number(readFileSync("exit-code", "utf8")));\n');
    const result = await replay(repo, minimized, -1);
    expect(result).toEqual({ accepted: 1, rejected: 2 });
    console.info(JSON.stringify({ property: "known-mutant", seed, counterexample: minimized, mutant: "과거 passed를 source 변경 후에도 허용", implementation: "source_changed로 거부", result }));
  } finally { await rm(repo, { recursive: true, force: true }); }
}, 30000);

type CompletionEvent = "verify" | "verify-fail" | "source" | "criterion" | "review" | "report" | "complete";
interface CompletionModel {
  source: number;
  criterion: number;
  record: number;
  verification?: { source: number; criterion: number; passed: boolean };
  review?: { source: number; criterion: number };
  report?: { source: number; criterion: number; record: number };
}
function completionOracle(model: CompletionModel): boolean {
  return Boolean(model.verification?.passed && model.verification.source === model.source && model.verification.criterion === model.criterion
    && model.review?.source === model.source && model.review.criterion === model.criterion
    && model.report?.source === model.source && model.report.criterion === model.criterion && model.report.record === model.record);
}
/** 잘못된 완료 변형: 과거 통과/검토/보고서가 한 번 있으면 현재성을 무시한다. */
function staleCompletionMutant(model: CompletionModel): boolean { return Boolean(model.verification?.passed && model.review && model.report); }
const completionNarrative = {
  summary: "공통 완료 core의 생성 검사", before: "필수 근거가 불완전함", after: "각 사건 시점의 완료 가능 여부 검사",
  changes: ["격리 원장의 생성 사건 열"], decisions: ["검토는 명시적 predicate fixture로만 사용"],
  limitations: ["검토 영수증의 process 표시는 완료 predicate를 시험하기 위한 fixture다. 실제 모델 감사가 아니다."], next: [],
};

async function completionFixture(node: string, trial: number) {
  const repo = await mkdtemp(path.join(tmpdir(), "www-completion-property-"));
  try {
    for (const directory of ["src", "docs/work", "agents/www"]) await mkdir(path.join(repo, directory), { recursive: true });
    await writeFile(path.join(repo, "docs/work/INDEX.md"), "# 속성 검사 격리 작업\n");
    await writeFile(path.join(repo, "src/item.ts"), "export const revision = 0;\n");
    const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
    await copyFile(path.join(root, "agents/www/review-policy.json"), path.join(repo, "agents/www/review-policy.json"));
    const work = await openWork({ repo, role: "www-dev", direct: true, requestId: `completion-property-${seed}-${trial}`, request: "공통 완료 판정의 사건 순서와 현재성을 검사한다", inputs: ["src"], approval: { implementation: true, writePaths: ["src"], mutationSurfaces: ["files"], verifierCommands: [0, 7].map(code => JSON.stringify([node, "-e", `process.exit(${code})`])), commit: false, publish: false }, decision: { intent: "build", area: "Workflow", title: "완료 속성 fixture", criteria: [{ id: "AC-1", description: "현재 기준 0" }] } });
    const workId = work.record.id;
    await runReportedStage({ repo, role: "www-dev", execute: true, workId, intent: "verify" }, async () => ({ executed: true, workId }));
    return { repo, workId, file: work.path };
  } catch (error) {
    await rm(repo, { recursive: true, force: true });
    throw error;
  }
}

async function completionReviewFixture(repo: string, workId: string) {
  await recordDocumentReview({ repo, workId, documents: ["docs/PRODUCT.md", "docs/ARCHITECTURE.md", "docs/DEVELOPMENT.md", "docs/skills/WORKFLOW.md"].map(file => ({ path: file, decision: "not_applicable", reason: "격리 fixture에 해당 정본 문서가 없음" })) });
  const current = await assessWork({ repo, workId });
  assert.ok(!current.legacy);
  const injected = await runReview({ repo, source: current.source, criteriaDigest: criteriaDigest(current.record), policyInfo: await loadReviewPolicy({ root: repo }), run: async () => ({ code: 0, signal: null, error: null, stdout: JSON.stringify({ type: "result", is_error: false, structured_output: { verdict: "pass", findings: ["완료 predicate fixture: 실제 모델 감사 아님"] }, modelUsage: { "claude-opus-unit-fixture": {} } }), stderr: "실제 모델 감사 미실행" }) });
  assert.equal(injected.executor, "injected");
  // 이 대조는 검토 정책 predicate를 시험한다. 실제 provider 프로세스 증거로 보고하지 않는다.
  await recordReview({ repo, workId, review: { ...injected, executor: "process" } });
}

function completionTrace(trial: number, next: (limit: number) => number): CompletionEvent[] {
  const valid: CompletionEvent[] = ["verify", "review", "report"];
  const prefix: CompletionEvent[] = Array.from({ length: next(3) }, () => next(2) ? "source" : "criterion");
  const reordered = [...valid];
  for (let index = reordered.length - 1; index > 0; index--) {
    const other = next(index + 1);
    [reordered[index], reordered[other]] = [reordered[other], reordered[index]];
  }
  const variants: CompletionEvent[][] = [
    valid,
    [...valid, "source"],
    [...valid, "source", ...valid],
    [...valid, "criterion"],
    ["verify-fail", "review", "report"],
    ["verify", "report"],
    ["verify", "review"],
    [...valid, "verify"],
    [...valid, "review"],
    ["report", "verify", "review"],
    [...valid, "criterion", ...valid],
    reordered,
  ];
  return [...prefix, ...variants[trial], "complete"];
}

test(`공통 완료 판정 생성 속성: seed=${seed}, 12개 사건 열, 실제 Node 검증과 명시적 검토 predicate fixture`, async () => {
  const node = (await promisify(execFile)("node", ["-p", "process.execPath"], { encoding: "utf8" })).stdout.trim();
  const next = random(seed ^ 0x85ebca6b);
  const totals = { accepted: 0, rejected: 0, mutantDetected: 0 };
  let mutantCounterexample: CompletionEvent[] | undefined;
  for (let trial = 0; trial < 12; trial++) {
    const trace = completionTrace(trial, next);
    const context = await completionFixture(node, trial);
    const model: CompletionModel = { source: 0, criterion: 0, record: 0 };
    try {
      for (let index = 0; index < trace.length; index++) {
        const event = trace[index];
        if (event === "source") {
          model.source++;
          await writeFile(path.join(context.repo, "src/item.ts"), `export const revision = ${model.source};\n`);
        }
        if (event === "criterion") {
          model.criterion++; model.record++;
          const current = await readWork(context);
          current.record.criteria[0].description = `현재 기준 ${model.criterion}`;
          await writeFile(context.file, JSON.stringify(current.record));
        }
        if (event === "verify" || event === "verify-fail") {
          const attempt = await verifyWork({ ...context, command: node, args: ["-e", `process.exit(${event === "verify-fail" ? 7 : 0})`], criterionIds: ["AC-1"] });
          assert.equal(attempt.executor, "process");
          model.record++;
          model.verification = { source: model.source, criterion: model.criterion, passed: event === "verify" };
        }
        if (event === "review") {
          await completionReviewFixture(context.repo, context.workId);
          model.record++;
          model.review = { source: model.source, criterion: model.criterion };
        }
        if (event === "report") {
          await finishWorkReport({ ...context, narrative: completionNarrative });
          model.report = { source: model.source, criterion: model.criterion, record: model.record };
        }
        if (event === "complete") {
          const expected = completionOracle(model);
          const current = await assessWork(context);
          const diagnostic = JSON.stringify({ seed, trial, trace, model, expected, actual: current.complete, reasons: current.reasons });
          assert.equal(current.complete, expected, diagnostic);
          const history = structuredClone(current.record.workflow?.verifications);
          if (expected) {
            const completed = await completeWork(context);
            assert.equal(completed.record.status, "done", diagnostic);
            totals.accepted++;
          } else {
            await expect(completeWork(context)).rejects.toThrow("현재 증거로 완료할 수 없습니다");
            assert.notEqual((await readWork(context)).record.status, "done", diagnostic);
            totals.rejected++;
          }
          assert.deepEqual((await readWork(context)).record.workflow?.verifications, history, "완료 판정이 과거 검증 이력을 지우면 안 된다");
          if (staleCompletionMutant(model) !== expected) {
            totals.mutantDetected++;
            mutantCounterexample ??= trace;
          }
        }
      }
    } finally { await rm(context.repo, { recursive: true, force: true }); }
  }
  expect(totals.accepted).toBeGreaterThan(0);
  expect(totals.rejected).toBeGreaterThan(0);
  expect(totals.mutantDetected).toBeGreaterThan(0);
  assert.ok(mutantCounterexample);
  console.info(JSON.stringify({ property: "shared-completion", seed, scenarios: 12, totals, counterexample: mutantCounterexample, verifier: "실제 Node 프로세스", review: "주입 predicate fixture, 실제 모델 감사 아님", scope: "assessWork/completeWork의 필수 검증·문서검토·독립검토·현재 저작보고서 판정; 유한한 생성 검사" }));
}, 300000);
