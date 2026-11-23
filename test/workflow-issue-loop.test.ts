/**
 * @verifies RESP-DEVELOPMENT-AUTHORING
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { promisify } from "node:util";
import { runTypedWorkflow } from "../scripts/workflow.ts";
import { criteriaDigest } from "../scripts/workflow/evidence.ts";
import { runIssueLoop } from "../scripts/workflow/issue-loop.ts";
import { loadReviewPolicy, runReview } from "../scripts/workflow/review.ts";
import { assessWork, readWork, recordReview, verifyWork } from "../scripts/workflow/work.ts";

const source = "src/value.ts";

const verifier = { command: process.execPath, args: ["checks/value.ts"], baselineExitCode: 7 };

const documents = [
  "docs/PRODUCT.md",
  "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT.md",
  "docs/skills/WORKFLOW.md",
];

const exec = promisify(execFile);

async function repository(t: TestContext, initialValue = 0) {
  const directory = await mkdtemp(join(tmpdir(), "www-issue-loop-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repo = await realpath(directory);
  for (const folder of [".www", "src", "checks", "agents/www", "docs/work", "docs/skills"]) {
    await mkdir(join(repo, folder), { recursive: true });
  }
  await exec("git", ["init", "-q"], { cwd: repo });
  const [checker] = verifier.args;
  const preset = { inputs: [source, checker], writePaths: [source], verifierInputs: [checker], verifier };
  await Promise.all(documents.map(file => writeFile(join(repo, file), "# 독립 문서 검토 입력\n")));
  await writeFile(join(repo, ".gitignore"), ".www/\n");
  await writeFile(join(repo, ".www/issue-loop.local.json"), JSON.stringify(preset));
  await writeFile(join(repo, "docs/work/INDEX.md"), "# 작업 목차\n");
  const policy = new URL("../agents/www/review-policy.json", import.meta.url);
  await copyFile(policy, join(repo, "agents/www/review-policy.json"));
  await writeFile(join(repo, source), `export const value = ${initialValue};\n`);
  await writeFile(join(repo, checker), "import { value } from '../src/value.ts';\nif (value !== 2) process.exit(7);\n");
  return repo;
}

function requestFor(repo: string) {
  return { repo, direct: true, execute: true, request: "표시 결과를 2로 수정한다" };
}

function stageHarness(repo: string, build: (attempt: number) => Promise<void>) {
  const calls: string[] = [];

  let builds = 0;
  async function runStage(options: Record<string, unknown>) {
    const decision = options.decision;
    assert.ok(decision && typeof decision === "object" && "intent" in decision && "workId" in decision);
    const { intent, workId } = decision;
    assert.ok(typeof intent === "string" && typeof workId === "string");
    calls.push(intent);
    if (intent === "verify") {
      const check = options.verifier;
      assert.ok(check && typeof check === "object" && "command" in check && "args" in check);
      assert.equal(check.command, verifier.command);
      assert.deepEqual(check.args, verifier.args);
      const attempt = await verifyWork({ repo, workId, ...verifier, criterionIds: ["AC-1"] });
      return { executed: true, verification: attempt };
    }
    if (intent === "build") {
      assert.deepEqual(options.writes, [source]);
      await build(++builds);
      return { executed: true, host: { ok: true }, harness: { ok: true } };
    }
    assert.equal(intent, "review");
    return { executed: true, review: { verdict: "blocked", failure: { kind: "runner_error" } } };
  }
  return { calls, runStage };
}

async function authorBeforeAudit() {
  assert.fail("현재 후보의 독립 감사 전에 저작을 요청했다.");
}

test("한 번 입력한 이슈가 실제 실패를 수정으로 돌리며 재개할 때 통과한 검사를 재실행하지 않는다", { timeout: 30_000 }, async t => {
  const repo = await repository(t);
  const { calls, runStage } = stageHarness(repo, async attempt => {
    await writeFile(join(repo, source), `export const value = ${attempt};\n`);
  });

  const options = requestFor(repo);

  const first = await runIssueLoop(options, runStage, authorBeforeAudit);
  assert.equal(first.loop.status, "blocked");
  assert.equal(first.loop.phase, "review", JSON.stringify(first.loop));
  assert.deepEqual(calls, ["verify", "build", "verify", "build", "verify", "review"]);
  assert.ok(typeof first.workId === "string");
  const work = await readWork({ repo, workId: first.workId });
  assert.ok(work.record.schemaVersion === 2);
  assert.notEqual(work.record.status, "done");
  assert.deepEqual(work.record.workflow.verifications.map(attempt => attempt.result), ["failed", "failed", "passed"]);
  assert.equal(work.record.workflow.documentationReviews?.length ?? 0, 0);

  calls.length = 0;
  const resumed = await runIssueLoop(options, runStage, authorBeforeAudit);
  assert.equal(resumed.workId, first.workId);
  assert.equal(resumed.loop.status, "blocked");
  assert.deepEqual(calls, ["review"]);
  const saved = await readWork({ repo, workId: first.workId });
  assert.ok(saved.record.schemaVersion === 2);
  assert.equal(saved.record.workflow.verifications.length, 3);
});

test("기준선이 이미 통과하면 소스 수정 없이 이슈 재현을 차단한다", async t => {
  const repo = await repository(t, 2);
  const { calls, runStage } = stageHarness(repo, async () => {
    assert.fail("재현 없이 구현을 시작했다.");
  });
  const result = await runIssueLoop(requestFor(repo), runStage, authorBeforeAudit);
  assert.equal(result.loop.status, "blocked");
  assert.equal(result.loop.phase, "baseline", JSON.stringify(result.loop));
  assert.deepEqual(calls, ["verify"]);
});

test("검사 입력이 구현 중 바뀌면 후보를 검증하거나 승인하지 않는다", async t => {
  const repo = await repository(t);
  const { calls, runStage } = stageHarness(repo, async () => {
    await writeFile(join(repo, source), "export const value = 2;\n");
    await writeFile(join(repo, verifier.args[0]), "process.exit(0);\n");
  });
  const result = await runIssueLoop(requestFor(repo), runStage, authorBeforeAudit);
  assert.equal(result.loop.status, "blocked");
  assert.deepEqual(calls, ["verify", "build"]);
});

test("중단된 구현은 같은 작업에서 새 구현이나 검증을 자동 실행하지 않는다", async t => {
  const repo = await repository(t);
  const { calls, runStage } = stageHarness(repo, async () => { throw new Error("호스트 중단"); });
  const interrupted = await runIssueLoop(requestFor(repo), runStage, authorBeforeAudit);
  assert.deepEqual(interrupted.loop, { status: "blocked", phase: "building", reason: "호스트 중단" });
  assert.deepEqual(calls, ["verify", "build"]);

  calls.length = 0;
  const resumed = await runIssueLoop(requestFor(repo), runStage, authorBeforeAudit);
  assert.equal(resumed.workId, interrupted.workId);
  assert.equal(resumed.loop.status, "blocked");
  assert.ok("reason" in resumed.loop && typeof resumed.loop.reason === "string");
  assert.match(resumed.loop.reason, /중단된 저작/);
  assert.deepEqual(calls, []);
});

test("격리 모드의 두 이슈가 한 저장소에서 동시에 쓰고 검증하며 각 후보와 작업을 유지한다", { timeout: 30_000 }, async t => {
  const repo = await repository(t);
  await writeFile(join(repo, ".www/development.local.json"), "{}\n");
  await exec("git", ["add", ".gitignore", "src", "checks", "agents", "docs"], { cwd: repo });
  await exec("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "격리 기준 소스"], { cwd: repo });
  await writeFile(join(repo, source), "export const value = 99;\n");

  const workspaces = new Set<string>();
  let allowWrites = () => {};
  const bothBuilding = new Promise<void>(resolve => { allowWrites = resolve; });
  async function runStage(options: Record<string, unknown>) {
    const decision = options.decision;
    assert.ok(decision && typeof decision === "object" && "intent" in decision);
    if (decision.intent === "verify") return runTypedWorkflow(options);
    if (decision.intent === "build") {
      assert.equal(typeof options.repo, "string");
      assert.equal(typeof options.request, "string");
      const workspace = String(options.repo);
      workspaces.add(workspace);
      if (workspaces.size === 2) allowWrites();
      await bothBuilding;
      await writeFile(join(workspace, source), `// ${String(options.request)}\nexport const value = 2;\n`);
      return { executed: true, host: { ok: true }, harness: { ok: true } };
    }
    assert.equal(decision.intent, "review");
    return { executed: true, review: { verdict: "blocked" } };
  }

  const requests = ["첫 이슈 표시값 수정", "둘째 이슈 표시값 수정"];
  const options = requests.map(request => ({ ...requestFor(repo), request, isolated: true }));
  const results = await Promise.all(options.map(input => runIssueLoop(input, runStage, authorBeforeAudit)));
  assert.notEqual(results[0]?.workId, results[1]?.workId);
  for (const [index, result] of results.entries()) {
    assert.equal(result.loop.phase, "review");
    assert.ok(result.workspace && workspaces.has(result.workspace));
    assert.match(await readFile(join(result.workspace, source), "utf8"), new RegExp(requests[index] ?? ""));
    const { record } = await readWork({ repo: result.workspace, workId: result.workId });
    assert.equal(record.schemaVersion, 2);
    assert.deepEqual(record.workflow?.verifications.map(attempt => attempt.exitCode), [7, 0]);
  }
  assert.equal(await readFile(join(repo, source), "utf8"), "export const value = 99;\n");
  const repeated = await runIssueLoop(options[0] ?? {}, runStage, authorBeforeAudit);
  assert.deepEqual(repeated, results[0]);
});

async function reviewWithFixture(repo: string, workId: string, options: Record<string, unknown>, verdict: "pass" | "fail") {
  const findings = verdict === "pass" ? [] : ["src/value.ts의 변경 의도를 주석에 남기세요."];

  const reviewOutput = JSON.stringify({
    type: "result", is_error: false,
    structured_output: { verdict, findings },
    modelUsage: { "claude-opus-fixture": {} },
  });

  if (process.platform === "win32") {
    const assessment = await assessWork({ repo, workId });
    assert.ok(!assessment.legacy);
    const { record } = assessment;
    const policyInfo = await loadReviewPolicy({ root: repo });
    const review = await runReview({
      repo, work: record, source: assessment.source, criteriaDigest: criteriaDigest(record), policyInfo,
      run: async invocation => {
        const { stdout } = await exec(process.execPath, ["-e", `console.log(${JSON.stringify(reviewOutput)})`]);
        const actualInvocation = {
          platform: "win32" as const,
          executableDigest: "a".repeat(64),
          command: join(repo, "claude.exe"), args: invocation.args,
        };
        return { code: 0, stdout, executionPlatform: "win32", actualInvocation };
      },
    });
    // Windows 실행 메타데이터는 이 테스트에서 receipt 수용 경계를 검증하는 고정 fixture다.
    const processReview = { ...review, executor: "process" as const };
    return { executed: true, review: processReview, recording: await recordReview({ repo, workId, review: processReview }) };
  }

  const directory = join(repo, ".www", "bin");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "claude"), `#!/usr/bin/env node\nconsole.log(${JSON.stringify(reviewOutput)});\n`, { mode: 0o700 });
  const previous = process.env.PATH;
  process.env.PATH = [directory, previous].filter(Boolean).join(delimiter);
  try { return await runTypedWorkflow(options); }
  finally {
    if (previous === undefined) delete process.env.PATH;
    else process.env.PATH = previous;
  }
}

test("재개 시 감사 실패를 수정에 전달하고 같은 통과 후보의 문서 판단과 보고서를 한 번에 받는다", { timeout: 30_000 }, async t => {
  const calls: string[] = [];

  let builds = 0;

  const repo = await repository(t);
  async function runStage(options: Record<string, unknown>) {
    if (typeof options.action === "string") {
      calls.push(options.action);
      return runTypedWorkflow(options);
    }
    const decision = options.decision;
    assert.ok(decision && typeof decision === "object" && "intent" in decision && "workId" in decision);
    const { intent, workId } = decision;
    assert.ok(typeof intent === "string" && typeof workId === "string");
    calls.push(intent);
    if (intent === "review") {
      assert.equal(options.allowReviewFallback, false);
      const review = await reviewWithFixture(repo, workId, options, builds === 1 ? "fail" : "pass");
      if (builds === 1) throw new Error("검토 기록 이후 실행 중단");
      return review;
    }
    if (intent === "verify") return runTypedWorkflow(options);
    assert.equal(intent, "build");
    builds += 1;
    if (builds === 2) {
      assert.ok(typeof options.evidence === "string");
      assert.match(options.evidence, /변경 의도를 주석에 남기세요/);
    }
    const content = builds === 1 ? "export const value = 2;\n" : "// 요청된 표시 값\nexport const value = 2;\n";
    await writeFile(join(repo, source), content);
    return { executed: true, host: { ok: true }, harness: { ok: true } };
  }
  let authorCalls = 0;
  const author = async ({ workPath, context }: { workPath: string; context: string }) => {
    authorCalls += 1;
    const latest = JSON.parse(await readFile(workPath, "utf8")).workflow.reviews.at(-1);
    assert.equal(latest.verdict, "pass");
    assert.equal(JSON.parse(context).auditId, latest.id);
    const narrative = {
      summary: "값을 2로 수정했다.",
      before: "값이 0이었다.", after: "값이 2다.",

      changes: [source],
      decisions: ["지정된 검사기를 그대로 사용했다."],

      limitations: ["독립 검토 CLI는 fixture를 사용했다."],
      next: [],
    };
    const paths = authorCalls === 1 ? [...documents, "docs/audit-outside.md"] : documents;
    return { narrative, documents: paths.map(path => ({ path, decision: "unchanged", reason: "fixture의 숫자 표시만 수정했다." })) };
  };
  const options = requestFor(repo);

  const interrupted = await runIssueLoop(options, runStage, author);
  assert.deepEqual(interrupted.loop, { status: "blocked", phase: "review", reason: "검토 기록 이후 실행 중단" });
  assert.deepEqual(calls, ["verify", "build", "verify", "review"]);
  assert.equal(authorCalls, 0);
  const failedAudit = await assessWork({ repo, workId: interrupted.workId });
  assert.ok(!failedAudit.legacy);
  assert.equal(failedAudit.record.workflow.reviews.at(-1)?.verdict, "fail");

  calls.length = 0;
  const outside = await runIssueLoop(options, runStage, author);
  assert.deepEqual(calls, ["build", "verify", "review"]);
  assert.equal(outside.loop.phase, "report");
  assert.equal(outside.loop.status, "blocked");
  assert.ok("reason" in outside.loop && typeof outside.loop.reason === "string");
  assert.match(outside.loop.reason, /감사에 묶이지 않은 문서/);
  const unfinished = await assessWork({ repo, workId: outside.workId });
  assert.ok(!unfinished.legacy);
  assert.equal(unfinished.documentation.usable, false);
  assert.equal(unfinished.report?.usable, false);
  assert.equal(unfinished.review.usable, true);

  calls.length = 0;
  const result = await runIssueLoop(options, runStage, author);
  assert.equal(result.workId, interrupted.workId);
  assert.deepEqual(result.loop, { status: "done", phase: "complete" });
  assert.deepEqual(calls, ["report", "report-complete"]);
  assert.equal(authorCalls, 2);
  const assessment = await assessWork({ repo, workId: result.workId });
  assert.ok(!assessment.legacy);
  assert.equal(assessment.record.status, "done");
  assert.equal(assessment.complete, true);
  assert.equal(assessment.review.usable, true);
  assert.equal(assessment.report?.usable, true);
});
