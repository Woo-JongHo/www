/**
 * @verifies RESP-DEVELOPMENT-RECORDS-STATE
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test, { type TestContext } from "node:test";
import { assessWork, completeWork, openWork, readWork, recordDocumentReview, recordReview, verifyWork } from "../scripts/workflow/work.ts";
import { assessReportedWork, completeReportedWork, finishWorkReport, runReportedStage } from "../scripts/workflow/report-lifecycle.ts";
import { createDevelopmentService } from "../src/development.ts";
import { criteriaDigest } from "../scripts/workflow/evidence.ts";
import { loadReviewPolicy, runReview } from "../scripts/workflow/review.ts";

const exec = promisify(execFile);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workCli = path.join(root, "scripts/workflow/work.ts");
const narrative = { summary: "격리 완료 게이트 검사", before: "보고서 미작성", after: "현재 보고서 연결", changes: ["완료 경로 검사"], decisions: ["임시 업무 자료만 사용"], limitations: ["검토는 명시적인 주입 predicate fixture이며 실제 모델 감사가 아니다."], next: [] };

async function fixture(t: TestContext) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "www-completion-fault-"));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  await Promise.all(["docs/work", "src", "agents/www", "extra"].map(directory => fs.mkdir(path.join(repo, directory), { recursive: true })));
  await fs.writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업 목차\n");
  await fs.writeFile(path.join(repo, "src/item.ts"), "export const value = 1;\n");
  await fs.copyFile(path.join(root, "agents/www/review-policy.json"), path.join(repo, "agents/www/review-policy.json"));
  const command = process.execPath;
  const work = await openWork({ repo, role: "www-dev", direct: true, requestId: "completion-fault", request: "격리 완료 판정을 검사한다", inputs: ["src"], approval: { implementation: true, writePaths: ["src"], mutationSurfaces: ["files"], verifierCommands: [0, 7].map(code => JSON.stringify([command, "-e", `process.exit(${code})`])), commit: false, publish: false }, decision: { intent: "build", area: "Workflow", title: "완료 결함 주입", criteria: [{ id: "AC-1", description: "현재 근거로만 완료한다" }] } });
  const workId = work.record.id;
  async function verify(code = 0) {
    return verifyWork({ repo, workId, command, args: ["-e", `process.exit(${code})`], criterionIds: ["AC-1"] });
  }
  async function review() {
    await recordDocumentReview({ repo, workId, documents: ["docs/PRODUCT.md", "docs/ARCHITECTURE.md", "docs/DEVELOPMENT.md", "docs/skills/WORKFLOW.md"].map(file => ({ path: file, decision: "not_applicable", reason: "격리 fixture에는 정본 문서가 없음" })) });
    const current = await assessWork({ repo, workId });
    assert.ok(!current.legacy);
    // 완료 조건 자체를 검사하는 주입 영수증이다. 실제 모델 실행 증거로 게시하지 않는다.
    const injected = await runReview({ repo, source: current.source, criteriaDigest: criteriaDigest(current.record), policyInfo: await loadReviewPolicy({ root: repo }), run: async () => ({ code: 0, signal: null, error: null, stdout: JSON.stringify({ type: "result", is_error: false, structured_output: { verdict: "pass", findings: ["격리 완료 predicate fixture"] }, modelUsage: { "claude-opus-unit-fixture": {} } }), stderr: "실제 모델 감사 미실행" }) });
    assert.equal(injected.executor, "injected");
    await recordReview({ repo, workId, review: { ...injected, executor: "process" } });
  }
  async function reporting() {
    await runReportedStage({ repo, role: "www-dev", execute: true, workId, intent: "verify" }, async () => ({ executed: true, workId }));
  }
  return { repo, workId, file: work.path, verify, review, reporting };
}

test("F09/F11: 저작 보고서가 없으면 raw core와 wrapper·공개 CLI 모두 완료를 거부한다", async t => {
  const context = await fixture(t);
  const { repo, workId } = context;
  await context.verify();
  await context.reporting();
  await context.review();
  const raw = await assessWork({ repo, workId });
  const wrapped = await assessReportedWork({ repo, workId });
  assert.equal(raw.complete, false);
  assert.equal(raw.report?.usable, false);
  assert.deepEqual(raw.reasons, wrapped.reasons);
  const app = createDevelopmentService({ policyRoot: repo, workspace: () => repo });
  const appStatus = await app.status(workId);
  assert.deepEqual(appStatus.reasons, raw.reasons);
  assert.equal(appStatus.canComplete, false);
  await assert.rejects(app.complete(workId), /저작 작업 보고서/);
  await assert.rejects(completeWork({ repo, workId }), /저작 작업 보고서/);
  await assert.rejects(completeReportedWork({ repo, workId }), /저작 작업 보고서/);
  await assert.rejects(exec(process.execPath, [workCli, JSON.stringify({ action: "complete", repo, workId })]), /저작 작업 보고서/);
  assert.notEqual((await readWork({ repo, workId })).record.status, "done");
  assert.equal((await readWork({ repo, workId })).record.workflow?.verifications[0]?.result, "passed");
});

test("먼저 시작한 실패가 늦게 저장되어도 최신 통과로 원장 완료를 저장한다", async t => {
  const { repo, workId, file, verify, review } = await fixture(t);
  const failure = await verify(7);
  const success = await verify();
  assert.ok(Date.parse(failure.startedAt) < Date.parse(success.startedAt));
  const work = await readWork({ repo, workId });
  assert.equal(work.record.schemaVersion, 2);
  if (work.record.schemaVersion !== 2) throw new Error("현재 작업 기록이 필요합니다.");
  work.record.workflow.verifications.reverse();
  await fs.writeFile(file, JSON.stringify(work.record));
  await review();
  await finishWorkReport({ repo, workId, narrative });
  assert.equal((await assessWork({ repo, workId })).complete, true);
  assert.equal((await completeWork({ repo, workId })).record.status, "done");
});

test("C01/F09: 현재 저작 보고서는 허용하고 보고서 작성 뒤 기록 변경은 거부한다", { timeout: 15_000 }, async t => {
  const context = await fixture(t);
  const { repo, workId } = context;
  await context.verify();
  await context.review();
  await finishWorkReport({ repo, workId, narrative });
  assert.equal((await assessWork({ repo, workId })).complete, true);
  const changed = await readWork({ repo, workId });
  changed.record.title = "보고서 이후 변경한 업무 제목";
  await fs.writeFile(context.file, JSON.stringify(changed.record));
  assert.equal((await assessWork({ repo, workId })).report?.usable, false);
  await assert.rejects(completeWork({ repo, workId }), /저작 작업 보고서/);
  await finishWorkReport({ repo, workId, narrative });
  const cli = await exec(process.execPath, [workCli, JSON.stringify({ action: "complete", repo, workId })]);
  const cliResult: unknown = JSON.parse(cli.stdout);
  assert.ok(cliResult && typeof cliResult === "object" && "record" in cliResult && cliResult.record && typeof cliResult.record === "object" && "status" in cliResult.record);
  assert.equal(cliResult.record.status, "done");
  const completed = await completeReportedWork({ repo, workId });
  assert.equal(completed.record.status, "done");
  assert.equal((await assessWork({ repo, workId })).complete, true);
  const edited = await readWork({ repo, workId });
  edited.record.title = "완료 저장 이후 변경한 업무 제목";
  await fs.writeFile(context.file, JSON.stringify(edited.record));
  assert.equal((await assessWork({ repo, workId })).report?.usable, false);
  await assert.rejects(completeReportedWork({ repo, workId }), /저작 작업 보고서/);
});

test("완료 보고서 잠금이 끝나지 않으면 앱 실패를 반환하고 원장을 되돌린다", { timeout: 15_000 }, async t => {
  const context = await fixture(t);
  const { repo, workId } = context;
  await context.verify();
  await context.review();
  await finishWorkReport({ repo, workId, narrative });
  const before = await fs.readFile(context.file, "utf8");
  const lock = path.join(path.dirname(context.file), "reports", ".report-write.lock");
  await fs.writeFile(lock, JSON.stringify({ token: "held", pid: process.pid, hostname: os.hostname(), createdAt: new Date().toISOString() }), { flag: "wx" });
  const app = createDevelopmentService({ policyRoot: repo, workspace: () => repo });
  await assert.rejects(app.complete(workId), /완료 보고서 저장 실패.*잠금/);
  assert.equal(await fs.readFile(context.file, "utf8"), before);
  assert.notEqual((await readWork({ repo, workId })).record.status, "done");
  await fs.unlink(lock);
  assert.equal((await app.complete(workId)).status, "done");
});

for (const changed of ["원장", "소스", "산출물"] as const) test("완료 보고서 대기 중 외부 " + changed + " 변경을 보존하고 성공을 응답하지 않는다", { timeout: 15_000 }, async t => {
  const context = await fixture(t);
  const { repo, workId } = context;
  const artifact = path.join(repo, "extra", "verified.txt");
  if (changed === "산출물") {
    await fs.writeFile(artifact, "검사 시점 산출물");
    await verifyWork({ repo, workId, command: process.execPath, args: ["-e", "process.exit(0)"], criterionIds: ["AC-1"], artifactPaths: ["extra/verified.txt"] });
  } else await context.verify();
  await context.review();
  await finishWorkReport({ repo, workId, narrative });
  const lock = path.join(path.dirname(context.file), "reports", ".report-write.lock");
  await fs.writeFile(lock, JSON.stringify({ token: "held", pid: process.pid, hostname: os.hostname(), createdAt: new Date().toISOString() }), { flag: "wx" });
  const app = createDevelopmentService({ policyRoot: repo, workspace: () => repo });
  const completion = app.complete(workId).then(() => null, error => error);
  let edited = await readWork({ repo, workId });
  for (let attempt = 0; edited.record.status !== "done" && attempt < 100; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10));
    edited = await readWork({ repo, workId });
  }
  assert.equal(edited.record.status, "done");
  // 잠금을 따르지 않는 외부 편집을 주입한다.
  const sourceFile = path.join(repo, "src/item.ts");
  if (changed === "원장") {
    edited.record.title = "보고서 대기 중 외부 변경";
    await fs.writeFile(context.file, JSON.stringify(edited.record));
  } else if (changed === "소스") {
    await fs.writeFile(sourceFile, "export const value = 9;\n");
  } else {
    await fs.writeFile(artifact, "외부에서 변경한 산출물");
  }
  await fs.unlink(lock);
  const error = String(await completion);
  assert.match(error, /완료 보고서 저장 실패/);
  const current = (await readWork({ repo, workId })).record;
  if (changed === "원장") {
    assert.match(error, /작업 기록이 바뀌었습니다/);
    assert.equal(current.title, "보고서 대기 중 외부 변경");
  } else if (changed === "소스") {
    assert.match(error, /검사 소스가 바뀌었습니다/);
    assert.equal(await fs.readFile(sourceFile, "utf8"), "export const value = 9;\n");
    assert.notEqual(current.status, "done");
  } else {
    assert.match(error, /artifacts_changed/);
    assert.equal(await fs.readFile(artifact, "utf8"), "외부에서 변경한 산출물");
    assert.notEqual(current.status, "done");
  }
  assert.equal((await assessWork({ repo, workId })).complete, false);
});

async function rejectBoth(repo: string, workId: string, reason: RegExp) {
  const before = await readWork({ repo, workId });
  const raw = await assessWork({ repo, workId });
  const wrapped = await assessReportedWork({ repo, workId });
  assert.equal(raw.complete, false);
  assert.deepEqual(raw.reasons, wrapped.reasons);
  assert.match(raw.reasons.join("; "), reason);
  await assert.rejects(completeWork({ repo, workId }), reason);
  const after = await readWork({ repo, workId });
  assert.notEqual(after.record.status, "done");
  assert.deepEqual(after.record.workflow?.verifications, before.record.workflow?.verifications);
}

test("F04: 미실행과 실패는 서로 다른 이유로 완료를 거부하고 실패 이력을 보존한다", async t => {
  const context = await fixture(t);
  await rejectBoth(context.repo, context.workId, /검증 시도 없음/);
  const attempt = await context.verify(7);
  assert.equal(attempt.executor, "process");
  assert.equal(attempt.result, "failed");
  await rejectBoth(context.repo, context.workId, /verification_failed/);
});

test("F05/F08: 소스 변경은 옛 검사와 검토를 남기고 현재 완료를 거부한다", async t => {
  const context = await fixture(t);
  await context.verify();
  await context.review();
  await fs.appendFile(path.join(context.repo, "src/item.ts"), "export const changed = true;\n");
  await rejectBoth(context.repo, context.workId, /source_changed/);
  const assessment = await assessWork(context);
  assert.ok(!assessment.legacy);
  assert.equal(assessment.review.usable, false);
  assert.equal(assessment.record.workflow.reviews.length, 1);
});

test("F06: 같은 기준 ID의 설명 또는 필수 여부 변경은 옛 증거를 재사용하지 않는다", async t => {
  for (const change of ["description", "required"]) {
    const context = await fixture(t);
    if (change === "required") {
      const initial = await readWork(context);
      initial.record.criteria.push({ id: "AC-2", description: "선택 기준", required: false, result: "unverified", evidence: [] });
      await fs.writeFile(context.file, JSON.stringify(initial.record));
    }
    await context.verify();
    const changed = await readWork(context);
    const criterion = changed.record.criteria.find(item => item.id === (change === "description" ? "AC-1" : "AC-2"));
    assert.ok(criterion);
    if (change === "description") criterion.description = "변경된 현행 기준";
    else criterion.required = true;
    await fs.writeFile(context.file, JSON.stringify(changed.record));
    if (change === "description") {
      await rejectBoth(context.repo, context.workId, /AC-1: criteria_changed/);
    } else {
      const assessment = await assessWork(context);
      assert.ok("criteria" in assessment);
      assert.equal(assessment.criteria.find(item => item.id === "AC-1")?.usable, true);
      await rejectBoth(context.repo, context.workId, /AC-2: 검증 시도 없음/);
    }
  }
});

test("F07: 파일 내용이 같아도 입력 범위가 달라지면 옛 검사를 수용하지 않는다", async t => {
  const context = await fixture(t);
  await context.verify();
  const changed = await readWork(context);
  assert.ok(changed.record.workflow);
  changed.record.workflow.inputs.push("extra");
  await fs.writeFile(context.file, JSON.stringify(changed.record));
  await rejectBoth(context.repo, context.workId, /scope_changed/);
});

test("F08: 필수 독립 검토가 없으면 실제 검사가 통과해도 완료하지 않는다", async t => {
  const context = await fixture(t);
  await context.verify();
  await rejectBoth(context.repo, context.workId, /독립 검토 없음/);
});

test("F10: 주입 검사를 실제 프로세스 증거로 수용하지 않는다", async t => {
  const context = await fixture(t);
  await context.verify();
  const changed = await readWork(context);
  const attempt = changed.record.workflow?.verifications[0];
  assert.ok(attempt);
  assert.equal(attempt.executor, "process");
  attempt.executor = "injected";
  await fs.writeFile(context.file, JSON.stringify(changed.record));
  await rejectBoth(context.repo, context.workId, /untrusted_executor/);
});
