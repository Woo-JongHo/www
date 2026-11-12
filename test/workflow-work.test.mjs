import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { evaluateEvidence } from "../scripts/workflow/evidence.mjs";
import { loadReviewPolicy, runReview } from "../scripts/workflow/review.mjs";
import { adoptWork, advanceWork, assessWork, completeWork, openWork, readWork, recordReview, resumeWork, setVerificationInputs, verifyWork } from "../scripts/workflow/work.mjs";

const exec = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const workCommand = join(root, "scripts", "workflow", "work.mjs");
const reviewPolicy = join(root, "agents", "www", "review-policy.json");

async function repository(t) {
  const repo = await mkdtemp(join(tmpdir(), "www-work-record-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  await Promise.all(["docs/work", "docs/specs", "agents/www", "src", "checks"].map((directory) => mkdir(join(repo, directory), { recursive: true })));
  await Promise.all([
    writeFile(join(repo, ".gitignore"), ".www/\n"),
    writeFile(join(repo, "docs", "work", "INDEX.md"), "# 작업 목차\n"),
    writeFile(join(repo, "docs", "specs", "chat.md"), "# Chat 요구\n\n<a id=\"CHAT-STOP-01\"></a>\n중단 대기를 구분한다.\n"),
    writeFile(join(repo, "agents", "www", "review-policy.json"), await readFile(reviewPolicy)),
    writeFile(join(repo, "src", "item.mjs"), "export const value = 1;\n"),
    writeFile(join(repo, "checks", "pass.mjs"), "import assert from 'node:assert/strict';\nimport { value } from '../src/item.mjs';\nassert.equal(value, 1);\n"),
    writeFile(join(repo, "checks", "fail.mjs"), "process.stderr.write('의도한 회귀 검증 실패\\n');\nprocess.exit(7);\n"),
  ]);
  await exec("git", ["init", "-q"], { cwd: repo });
  await exec("git", ["config", "user.name", "작업 회귀 Fixture"], { cwd: repo });
  await exec("git", ["config", "user.email", "work-fixture@example.invalid"], { cwd: repo });
  await exec("git", ["add", "."], { cwd: repo });
  await exec("git", ["commit", "-qm", "초기 테스트 상태"], { cwd: repo });
  return repo;
}

function request(repo, overrides = {}) {
  const pass = ["checks/pass.mjs"];
  const fail = ["checks/fail.mjs"];
  return {
    repo,
    role: "www-dev",
    direct: true,
    requestId: "request-chat-interrupt-1",
    request: "Chat의 중단 처리 상태를 수정하고 검증해줘",
    decision: {
      intent: "build", area: "Chat", title: "중단 대기의 정확한 표시", kind: "bug", areas: ["ui", "dev"], owner: "dev",
      criteria: [{ id: "AC-1", description: "중단 처리 중 대기를 유지한다", required: true, requirementRefs: ["docs/specs/chat.md#CHAT-STOP-01"] }],
    },
    approval: {
      implementation: true,
      writePaths: ["src/item.mjs"],
      mutationSurfaces: ["edit"],
      verifierCommands: [JSON.stringify([process.execPath, ...pass]), JSON.stringify([process.execPath, ...fail])],
      commit: false,
      publish: false,
    },
    inputs: ["src", "checks"],
    ...overrides,
  };
}

async function verifyPass(repo, workId) {
  return verifyWork({ repo, workId, command: process.execPath, args: ["checks/pass.mjs"], criterionIds: ["AC-1"] });
}

async function legacyWork(repo) {
  const directory = join(repo, "docs", "work", "Chat", "007-이전 중단 검증");
  await mkdir(directory, { recursive: true });
  const record = {
    schemaVersion: 1,
    id: "work-22222222-2222-4222-8222-222222222222",
    title: "이전 중단 검증", kind: "bug", areas: ["ui", "dev"], owner: "dev",
    status: "done", blockedReason: null, relations: [],
    criteria: [{ id: "AC-1", description: "당시 중단 처리 검증", required: true, result: "passed", evidence: [{ path: "verification.md#legacy-attempt", summary: "이전 소스에 대한 당시 통과" }] }],
    preservedContext: { decision: "당시 선택의 이유", unknownFields: ["이전 기록", { value: 3 }] },
  };
  const file = join(directory, "work.json");
  const source = `${JSON.stringify(record, null, 2)}\n`;
  const spec = "# 이전 중단 작업 명세\n\n당시 기준선과 판단을 보존한다.\n";
  const verification = '# 이전 검증 기록\n\n<a id="legacy-attempt"></a>\n당시 소스에서 수행한 검증이 통과했다. 현재 소스의 통과를 뜻하지 않는다.\n';
  await Promise.all([writeFile(file, source), writeFile(join(directory, "spec.md"), spec), writeFile(join(directory, "verification.md"), verification)]);
  return { directory, file, record, source, spec, verification };
}

test("역할의 일반 요청을 신규 UUID·최소 기록·목차로 접수한다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  assert.equal(work.created, true);
  assert.equal(work.record.schemaVersion, 2);
  assert.match(work.record.id, /^work-[a-f0-9-]{36}$/);
  assert.equal(work.record.status, "ready");
  assert.equal(work.record.workflow.nextAction, "build");
  assert.equal(work.record.workflow.authorization.implementation, true);
  assert.equal(work.record.workflow.authorization.commit, false);
  assert.equal(work.record.workflow.authorization.publish, false);
  assert.deepEqual(work.record.criteria[0].requirementRefs, ["docs/specs/chat.md#CHAT-STOP-01"]);
  const spec = await readFile(join(dirname(work.path), "spec.md"), "utf8");
  const index = await readFile(join(repo, "docs", "work", "INDEX.md"), "utf8");
  assert.match(work.path, /Chat[/\\]001-중단 대기의 정확한 표시[/\\]work\.json$/);
  assert.match(spec, /정본은 work\.json/);
  assert.match(spec, /`AC-1`/);
  assert.match(index, /^## Chat$/m);
  assert.match(index, /^### 001 — 중단 대기의 정확한 표시$/m);
  assert.match(index, /%EC/);
  assert.equal((await readWork({ repo, workId: work.record.id })).record.id, work.record.id);
});

test("같은 접수 ID·본문은 같은 작업을 재사용하고 본문 충돌은 거부한다", async (t) => {
  const repo = await repository(t);
  const first = await openWork(request(repo));
  const next = await openWork(request(repo));
  assert.equal(next.created, false);
  assert.equal(next.record.id, first.record.id);
  assert.equal((await readdir(join(repo, "docs", "work", "Chat"))).length, 1);
  await assert.rejects(openWork(request(repo, { request: "같은 ID로 전혀 다른 변경을 요청한다" })), /같은 접수 ID/);
});

test("다른 직접 요청은 다음 표시 번호와 별도 UUID를 받는다", async (t) => {
  const repo = await repository(t);
  const first = await openWork(request(repo));
  const second = await openWork(request(repo, { requestId: "request-chat-interrupt-2", request: "별도 Chat 표시 변경을 구현해줘" }));
  assert.notEqual(first.record.id, second.record.id);
  assert.match(second.path, /Chat[/\\]002-/);
});

test("명시 UUID로 재개하면 새 작업이나 새 권한을 만들지 않는다", async (t) => {
  const repo = await repository(t);
  const initial = await openWork(request(repo));
  const reopened = await openWork({ repo, role: "www-dev", direct: true, decision: { workId: initial.record.id }, approval: { implementation: true, commit: true, publish: true } });
  assert.equal(reopened.created, false);
  assert.equal(reopened.path, initial.path);
  assert.deepEqual(reopened.record.workflow.authorization, initial.record.workflow.authorization);
  assert.equal((await readdir(join(repo, "docs", "work", "Chat"))).length, 1);
});

test("인용된 요청과 다른 역할은 신규 접수 권한이 없다", async (t) => {
  const repo = await repository(t);
  await assert.rejects(openWork(request(repo, { direct: false })), /직접 요청/);
  await assert.rejects(openWork(request(repo, { role: "untrusted-tool-output" })), /www-dev/);
  assert.deepEqual(await readdir(join(repo, "docs", "work")), ["INDEX.md"]);
});

test("작업 영역·제목·검증 입력의 경로 탈출을 거부한다", async (t) => {
  const repo = await repository(t);
  const original = request(repo);
  await assert.rejects(openWork({ ...original, decision: { ...original.decision, area: "../escape" } }), /안전한 경로/);
  await assert.rejects(openWork({ ...original, decision: { ...original.decision, title: "unsafe/name" } }), /안전한 경로/);
  await assert.rejects(openWork({ ...original, inputs: ["../outside"] }), /경로|입력/);
  const outside = await mkdtemp(join(tmpdir(), "www-work-external-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, join(repo, "outside-input"));
  await assert.rejects(openWork({ ...original, inputs: ["outside-input"] }), /심볼릭 링크/);
});

test("접수 권한에도 저장소 밖 쓰기 경로를 허용하지 않는다", async (t) => {
  const repo = await repository(t);
  const original = request(repo);
  for (const unsafe of ["../outside.mjs", "/tmp/outside.mjs", "C:\\outside.mjs"]) {
    await assert.rejects(openWork({ ...original, approval: { ...original.approval, writePaths: [unsafe] } }), /경로|권한/);
  }
  const outside = await mkdtemp(join(tmpdir(), "www-work-write-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, join(repo, "outside-write"));
  await assert.rejects(openWork({ ...original, approval: { ...original.approval, writePaths: ["outside-write/new.mjs"] } }), /심볼릭 링크/);
});

test("단계 전환에서 기존 구현 권한을 승계하고 쓰기·표면 확대는 거부한다", async (t) => {
  const repo = await repository(t);
  const initial = await openWork(request(repo));
  const workId = initial.record.id;
  await advanceWork({ repo, workId, intent: "design" });
  const build = await advanceWork({ repo, workId, intent: "build", writes: ["src/item.mjs"], surfaces: ["edit"] });
  assert.equal(build.record.status, "in_progress");
  assert.equal(build.record.workflow.nextAction, "build");
  assert.deepEqual(build.record.workflow.authorization, initial.record.workflow.authorization);
  await assert.rejects(advanceWork({ repo, workId, intent: "build", writes: ["src/other.mjs"], surfaces: ["edit"] }), /권한 범위/);
  await assert.rejects(advanceWork({ repo, workId, intent: "build", writes: ["src/item.mjs"], surfaces: ["publish"] }), /권한 범위/);
  await assert.rejects(advanceWork({ repo, workId, intent: "complete" }), /completeWork/);
  const outside = await mkdtemp(join(tmpdir(), "www-work-late-symlink-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, "external.mjs"), "export const external = true;\n");
  await rm(join(repo, "src", "item.mjs"));
  await symlink(join(outside, "external.mjs"), join(repo, "src", "item.mjs"));
  await assert.rejects(advanceWork({ repo, workId, intent: "build", writes: ["src/item.mjs"], surfaces: ["edit"] }), /심볼릭 링크/);
});

test("진단 요청에 구현 권한이 없으면 build로 확대하지 않는다", async (t) => {
  const repo = await repository(t);
  const original = request(repo);
  const work = await openWork({ ...original, decision: { ...original.decision, intent: "diagnose" }, approval: { ...original.approval, implementation: false } });
  await assert.rejects(advanceWork({ repo, workId: work.record.id, intent: "build", writes: ["src/item.mjs"], surfaces: ["edit"] }), /권한 범위/);
});

test("허용하지 않은 실제 검증 명령은 실행 전에 거부한다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  const marker = join(repo, "must-not-exist.txt");
  await assert.rejects(verifyWork({ repo, workId: work.record.id, command: process.execPath, args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)},'executed')`], criterionIds: ["AC-1"] }), /허용하지 않은 검증 명령/);
  await assert.rejects(readFile(marker), { code: "ENOENT" });
  assert.equal((await readWork({ repo, workId: work.record.id })).record.workflow.verifications.length, 0);
});

test("실제 Node 통과와 실패를 보존하고 실패 후 구현으로 인계한다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  const workId = work.record.id;
  const passed = await verifyPass(repo, workId);
  assert.equal(passed.executor, "process");
  assert.equal(passed.exitCode, 0);
  assert.equal(passed.result, "passed");
  const failed = await verifyWork({ repo, workId, command: process.execPath, args: ["checks/fail.mjs"], criterionIds: ["AC-1"] });
  assert.equal(failed.executor, "process");
  assert.equal(failed.exitCode, 7);
  assert.equal(failed.result, "failed");
  const stored = await readWork({ repo, workId });
  assert.deepEqual(stored.record.workflow.verifications.map((attempt) => attempt.id), [passed.id, failed.id]);
  assert.equal(stored.record.criteria[0].result, "failed");
  assert.equal(stored.record.workflow.nextAction, "build");
  assert.equal(stored.record.criteria[0].evidence.length, 2);
  const report = await readFile(join(dirname(stored.path), "verification.md"), "utf8");
  assert.ok(report.includes(`id="${passed.id}"`));
  assert.ok(report.includes(`id="${failed.id}"`));
  assert.equal((await assessWork({ repo, workId })).criteria[0].usable, false);
});

test("검증만 허용된 작업의 실패는 build 대신 verify로 인계한다", async (t) => {
  const repo = await repository(t);
  const original = request(repo);
  const work = await openWork({ ...original, decision: { ...original.decision, intent: "verify" }, approval: { ...original.approval, implementation: false } });
  await verifyWork({ repo, workId: work.record.id, command: process.execPath, args: ["checks/fail.mjs"], criterionIds: ["AC-1"] });
  assert.equal((await readWork({ repo, workId: work.record.id })).record.workflow.nextAction, "verify");
});

test("같은 HEAD에서 관련 소스가 달라지면 과거 PASS를 보존하고 재검증으로 재개한다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  const workId = work.record.id;
  const attempt = await verifyPass(repo, workId);
  const head = (await exec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout;
  await writeFile(join(repo, "src", "item.mjs"), "export const value = 2;\n");
  assert.equal((await exec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout, head);
  const assessment = await assessWork({ repo, workId });
  assert.equal(assessment.criteria[0].usable, false);
  assert.ok(assessment.criteria[0].reasons.includes("source_changed"));
  const resumed = await resumeWork({ repo, workId });
  assert.equal(resumed.nextAction, "verify");
  assert.equal(resumed.record.criteria[0].result, "unverified");
  assert.equal(resumed.record.workflow.verifications[0].id, attempt.id);
  assert.equal(resumed.record.workflow.verifications[0].result, "passed");
  assert.equal(resumed.record.criteria[0].evidence.length, 1);
});

test("AC ID가 같아도 설명이 바뀌면 이전 기준의 PASS를 재사용하지 않는다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  await verifyPass(repo, work.record.id);
  const edited = (await readWork({ repo, workId: work.record.id })).record;
  edited.criteria[0].description = "중단뿐 아니라 복구 완료까지 확인한다";
  await writeFile(work.path, `${JSON.stringify(edited, null, 2)}\n`);
  const assessment = await assessWork({ repo, workId: work.record.id });
  assert.ok(assessment.criteria[0].reasons.includes("criteria_changed"));
  assert.equal((await resumeWork({ repo, workId: work.record.id })).nextAction, "verify");
});

test("선언한 입력 안의 미추적 파일은 증거를 무효화하고 무관한 보고 문구는 유지한다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  const workId = work.record.id;
  await verifyPass(repo, workId);
  await writeFile(join(dirname(work.path), "notes.md"), "검사 입력에 영향이 없는 보고 문구\n");
  assert.equal((await assessWork({ repo, workId })).criteria[0].usable, true);
  await writeFile(join(repo, "src", "new-untracked.mjs"), "export const extra = true;\n");
  const changed = await assessWork({ repo, workId });
  assert.equal(changed.criteria[0].usable, false);
  assert.ok(changed.criteria[0].reasons.includes("source_changed"));
});

test("검토 없는 완료와 근거 없는 통과 검토를 거부한다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  const workId = work.record.id;
  await verifyPass(repo, workId);
  await assert.rejects(completeWork({ repo, workId }), /독립 검토/);
  await recordReview({ repo, workId, review: { id: "explicitly-fabricated-unit-fixture", verdict: "pass" } });
  const assessment = await assessWork({ repo, workId });
  assert.equal(assessment.review.usable, false);
  await assert.rejects(completeWork({ repo, workId }), /완료할 수 없습니다/);
  assert.notEqual((await readWork({ repo, workId })).record.status, "done");
});

test("명시적 모의 CLI 검토 영수증으로 완료 상태 전환과 변경 후 재개를 검사한다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  const workId = work.record.id;
  const attempt = await verifyPass(repo, workId);
  const assessment = await assessWork({ repo, workId });
  const policyInfo = await loadReviewPolicy({ root: repo });
  // 실제 모델을 호출하지 않는 명시적 단위 fixture다. 공유 core로 모의 CLI 원문·호출·대상 영수증을 만든다.
  const fixtureReview = await runReview({
    repo, source: assessment.source, criteriaDigest: attempt.criteriaDigest, policyInfo, inputPaths: ["src/item.mjs"],
    run: async () => ({
      code: 0, signal: null, error: null,
      stdout: JSON.stringify({ type: "result", is_error: false, structured_output: { verdict: "pass", findings: ["단위 fixture이며 실제 Opus 검토는 수행하지 않았다."] }, modelUsage: { "claude-opus-unit-fixture": {} } }),
      stderr: "모의 CLI 응답: 실제 모델 실행 아님",
    }),
  });
  assert.equal(fixtureReview.executor, "injected");
  const receipt = JSON.parse(await readFile(join(repo, fixtureReview.receiptPath), "utf8"));
  assert.equal(receipt.context.reviewId, fixtureReview.id);
  assert.equal(receipt.context.sourceDigest, assessment.source.digest);
  assert.equal(receipt.invocation.command, "claude");
  assert.match(receipt.stdout, /단위 fixture/);
  // 완료 상태 전환 predicate만 검사하기 위해 fixture의 신뢰 경계를 명시적으로 대체한다.
  // 이 임시 저장소 밖의 완료 증거나 실제 모델 검토 결과로 사용하지 않는다.
  await recordReview({ repo, workId, review: { ...fixtureReview, executor: "process" } });
  const completed = await completeWork({ repo, workId });
  assert.equal(completed.record.status, "done");
  assert.equal(completed.record.workflow.nextAction, "complete");
  await writeFile(join(repo, "src", "item.mjs"), "export const value = 2;\n");
  const resumed = await resumeWork({ repo, workId });
  assert.equal(resumed.record.status, "verifying");
  assert.equal(resumed.nextAction, "verify");
  assert.equal(resumed.record.criteria[0].result, "unverified");
  assert.equal(resumed.record.workflow.verifications[0].result, "passed");
  assert.equal(resumed.record.workflow.reviews[0].id, fixtureReview.id);
});

test("새 Node 프로세스의 status·resume·complete도 같은 작업과 적용성을 사용한다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  const workId = work.record.id;
  await verifyPass(repo, workId);
  const status = JSON.parse((await exec(process.execPath, [workCommand, JSON.stringify({ action: "status", repo, workId })])).stdout);
  assert.equal(status.record.id, workId);
  assert.equal(status.criteria[0].usable, true);
  assert.equal(status.complete, false);
  const resumed = JSON.parse((await exec(process.execPath, [workCommand, JSON.stringify({ action: "resume", repo, workId })])).stdout);
  assert.equal(resumed.nextAction, "review");
  await assert.rejects(exec(process.execPath, [workCommand, JSON.stringify({ action: "complete", repo, workId })]), (error) => error.code === 1 && /독립 검토/.test(error.stderr));
});

test("legacy UUID는 현재 권한 없이 읽을 수 있지만 새 실행 기록으로 자동 승격하지 않는다", async (t) => {
  const repo = await repository(t);
  const legacy = await legacyWork(repo);
  const opened = await openWork({ repo, role: "www-dev", direct: true, decision: { workId: legacy.record.id } });
  assert.equal(opened.legacy, true);
  assert.equal(opened.created, false);
  assert.equal(opened.record.schemaVersion, 1);
  assert.equal(await readFile(legacy.file, "utf8"), legacy.source);
  const resumed = await resumeWork({ repo, workId: legacy.record.id });
  assert.equal(resumed.legacy, true);
  assert.equal(resumed.complete, false);
  assert.equal(await readFile(legacy.file, "utf8"), legacy.source);
  await assert.rejects(advanceWork({ repo, workId: legacy.record.id, intent: "build" }), /schemaVersion 2/);
});

test("legacy 명시 채택에는 현재 역할·직접 요청·접수 ID·권한·입력·단계가 필요하다", async (t) => {
  const repo = await repository(t);
  const legacy = await legacyWork(repo);
  const initial = request(repo);
  const current = { repo, workId: legacy.record.id, role: "www-dev", direct: true, requestId: "adopt-current-request", request: "이전 중단 작업을 현재 소스에서 재검증해줘", approval: initial.approval, inputs: initial.inputs, intent: "verify" };
  for (const missing of ["role", "direct", "requestId", "request", "approval", "inputs", "intent"]) {
    const incomplete = Object.fromEntries(Object.entries(current).filter(([key]) => key !== missing));
    await assert.rejects(adoptWork(incomplete), /직접|필요|권한|단계/, `현재 채택의 필수 입력 누락: ${missing}`);
    assert.equal(await readFile(legacy.file, "utf8"), legacy.source);
  }
});

test("legacy 채택은 같은 UUID와 과거 전체 레코드·명세·검증 파일을 보존하고 현재 결과만 초기화한다", async (t) => {
  const repo = await repository(t);
  const legacy = await legacyWork(repo);
  const initial = request(repo);
  const options = { repo, workId: legacy.record.id, role: "www-dev", direct: true, requestId: "adopt-legacy-once", request: "이전 중단 작업을 현재 범위에서 고치고 검증해줘", approval: initial.approval, inputs: initial.inputs, intent: "build" };
  const adopted = await openWork({ ...options, decision: { workId: legacy.record.id, adoptLegacy: true, intent: "build" } });
  assert.equal(adopted.adopted, true);
  assert.equal(adopted.created, false);
  assert.equal(adopted.record.id, legacy.record.id);
  assert.equal(await realpath(adopted.path), await realpath(legacy.file));
  assert.equal(adopted.record.schemaVersion, 2);
  assert.equal(adopted.record.status, "ready");
  assert.equal(adopted.record.workflow.nextAction, "build");
  assert.deepEqual(adopted.record.workflow.legacyRecord, legacy.record);
  assert.equal(adopted.record.criteria[0].result, "unverified");
  assert.deepEqual(adopted.record.criteria[0].evidence, []);
  assert.deepEqual(adopted.record.workflow.verifications, []);
  assert.deepEqual(adopted.record.workflow.reviews, []);
  assert.equal(await readFile(join(legacy.directory, "spec.md"), "utf8"), legacy.spec);
  assert.equal(await readFile(join(legacy.directory, "verification.md"), "utf8"), legacy.verification);
  const once = await readFile(legacy.file, "utf8");
  const repeated = await adoptWork(options);
  assert.equal(repeated.record.id, legacy.record.id);
  assert.equal(await readFile(legacy.file, "utf8"), once);
  assert.equal((await readdir(join(repo, "docs", "work", "Chat"))).length, 1);
  await advanceWork({ repo, workId: legacy.record.id, intent: "build", writes: ["src/item.mjs"], surfaces: ["edit"] });
  await verifyPass(repo, legacy.record.id);
  const current = await readWork({ repo, workId: legacy.record.id });
  assert.deepEqual(current.record.workflow.legacyRecord, legacy.record);
  assert.equal(await readFile(join(legacy.directory, "spec.md"), "utf8"), legacy.spec);
  assert.ok((await readFile(join(legacy.directory, "verification.md"), "utf8")).startsWith(legacy.verification.trimEnd()));
});

test("검증 입력 범위를 넓히면 old PASS는 scope_changed이며 새 실제 검사 뒤 회복한다", async (t) => {
  const repo = await repository(t);
  await mkdir(join(repo, "config"));
  await writeFile(join(repo, "config", "runtime.mjs"), "export const enabled = true;\n");
  const work = await openWork(request(repo));
  const workId = work.record.id;
  const old = await verifyPass(repo, workId);
  const expanded = await setVerificationInputs({ repo, workId, inputs: ["src", "checks", "config"] });
  assert.equal(expanded.record.workflow.nextAction, "verify");
  assert.equal(expanded.record.criteria[0].result, "unverified");
  assert.ok(expanded.record.workflow.inputs.includes("docs/specs/chat.md"));
  const oldState = await evaluateEvidence({ repo, record: expanded.record, attempt: old });
  assert.equal(oldState.usable, false);
  assert.ok(oldState.reasons.includes("scope_changed"));
  assert.equal((await resumeWork({ repo, workId })).nextAction, "verify");
  const fresh = await verifyPass(repo, workId);
  const assessment = await assessWork({ repo, workId });
  assert.equal(assessment.criteria[0].usable, true);
  assert.deepEqual(assessment.record.workflow.verifications.map((attempt) => attempt.id), [old.id, fresh.id]);
  assert.equal(assessment.record.workflow.verifications[0].result, "passed");
});

test("참조한 현행 기능 문서는 검증 입력에 자동 포함되고 변경을 감지한다", async (t) => {
  const repo = await repository(t);
  const work = await openWork(request(repo));
  assert.ok(work.record.workflow.inputs.includes("docs/specs/chat.md"));
  const attempt = await verifyPass(repo, work.record.id);
  assert.ok(attempt.source.inputs.includes("docs/specs/chat.md"));
  await writeFile(join(repo, "docs", "specs", "chat.md"), '# Chat 요구\n\n<a id="CHAT-STOP-01"></a>\n기존 요구에 실제 중단 완료 확인을 추가한다.\n');
  const assessment = await assessWork({ repo, workId: work.record.id });
  assert.equal(assessment.criteria[0].usable, false);
  assert.ok(assessment.criteria[0].reasons.includes("source_changed"));
});

test("존재하지 않는 명시 요구 앵커는 명령이 통과해도 작업 완료를 막는다", async (t) => {
  const repo = await repository(t);
  const original = request(repo);
  const criteria = [{ ...original.decision.criteria[0], requirementRefs: ["docs/specs/chat.md#CHAT-DOES-NOT-EXIST"] }];
  const work = await openWork({ ...original, decision: { ...original.decision, criteria } });
  const attempt = await verifyPass(repo, work.record.id);
  assert.equal(attempt.result, "passed");
  const assessment = await assessWork({ repo, workId: work.record.id });
  assert.equal(assessment.criteria[0].usable, true);
  assert.equal(assessment.complete, false);
  assert.ok(assessment.reasons.some((reason) => /요구사항 참조/.test(reason)));
  await assert.rejects(completeWork({ repo, workId: work.record.id }), /요구사항 참조/);
});

test("영역 이름의 대소문자와 Unicode NFC 차이는 별도 영역을 생성하지 않는다", async (t) => {
  const repo = await repository(t);
  const original = request(repo);
  const first = await openWork(original);
  const lower = await openWork({ ...original, requestId: "area-lower", request: "소문자 영역으로 다음 작업", decision: { ...original.decision, area: "chat" } });
  assert.equal(dirname(dirname(first.path)), dirname(dirname(lower.path)));
  assert.match(lower.path, /002-/);
  const composed = await openWork({ ...original, requestId: "area-nfc", request: "정규화 영역 첫 작업", decision: { ...original.decision, area: "가" } });
  const decomposed = await openWork({ ...original, requestId: "area-nfd", request: "분해형 영역 다음 작업", decision: { ...original.decision, area: "가".normalize("NFD") } });
  assert.equal(dirname(dirname(composed.path)).normalize("NFC"), dirname(dirname(decomposed.path)).normalize("NFC"));
  assert.match(decomposed.path, /002-/);
  const directories = (await readdir(join(repo, "docs", "work"), { withFileTypes: true })).filter((entry) => entry.isDirectory());
  assert.equal(directories.length, 2);
});

test("기존 목차 내용을 보존하고 새 Chat·Workflow 항목을 각각의 영역에 등록한다", async (t) => {
  const repo = await repository(t);
  await legacyWork(repo);
  const indexFile = join(repo, "docs", "work", "INDEX.md");
  const introduction = "# 작업 목차\n\n기존 도입 설명을 그대로 유지한다.\n\n";
  const chatExisting = "## Chat\n\n기존 Chat 설명을 그대로 유지한다.\n\n### 007 — 이전 중단 검증\n\n과거 기록의 설명을 유지한다.\n\n";
  const workflowExisting = "## Workflow\n\n기존 Workflow 설명을 그대로 유지한다.\n";
  await writeFile(indexFile, introduction + chatExisting + workflowExisting);
  const original = request(repo);
  const chat = await openWork({ ...original, decision: { ...original.decision, title: "새 Chat 변경" } });
  const workflowRequest = { ...original, requestId: "request-workflow-index", request: "새 Workflow 변경을 접수한다", decision: { ...original.decision, area: "Workflow", title: "새 Workflow 변경" } };
  const workflow = await openWork(workflowRequest);
  assert.match(chat.path, /Chat[/\\]008-/);
  assert.match(workflow.path, /Workflow[/\\]001-/);
  const index = await readFile(indexFile, "utf8");
  assert.ok(index.startsWith(introduction + chatExisting));
  const chatStart = index.indexOf("## Chat\n");
  const workflowStart = index.indexOf("## Workflow\n");
  assert.ok(chatStart >= 0 && workflowStart > chatStart);
  const chatSection = index.slice(chatStart, workflowStart);
  const workflowSection = index.slice(workflowStart);
  assert.match(chatSection, /### 008 — 새 Chat 변경/);
  assert.match(chatSection, /Chat\/008-/);
  assert.doesNotMatch(chatSection, /새 Workflow 변경/);
  assert.ok(workflowSection.startsWith(workflowExisting));
  assert.match(workflowSection, /### 001 — 새 Workflow 변경/);
  assert.match(workflowSection, /Workflow\/001-/);
  assert.doesNotMatch(workflowSection, /새 Chat 변경/);
  assert.equal(index.match(/^## Chat$/gm)?.length, 1);
  assert.equal(index.match(/^## Workflow$/gm)?.length, 1);
  await openWork(workflowRequest);
  assert.equal(await readFile(indexFile, "utf8"), index);
});

test("기준 ID를 제거해도 당시 기준 스냅샷과 검증 시도를 보존하며 현재 기준을 다시 검사한다", async (t) => {
  const repo = await repository(t);
  const original = request(repo);
  const criteria = [...original.decision.criteria, { id: "AC-2", description: "당시 함께 검사한 별도 기준", required: true }];
  const work = await openWork({ ...original, decision: { ...original.decision, criteria } });
  const old = await verifyWork({ repo, workId: work.record.id, command: process.execPath, args: ["checks/pass.mjs"], criterionIds: ["AC-1", "AC-2"] });
  assert.deepEqual(old.criteriaSnapshot.map((criterion) => criterion.id), ["AC-1", "AC-2"]);
  const record = (await readWork({ repo, workId: work.record.id })).record;
  record.criteria = record.criteria.filter((criterion) => criterion.id !== "AC-2");
  await writeFile(work.path, `${JSON.stringify(record, null, 2)}\n`);
  const preserved = await readWork({ repo, workId: work.record.id });
  assert.deepEqual(preserved.record.workflow.verifications[0].criteriaSnapshot, old.criteriaSnapshot);
  assert.deepEqual(preserved.record.workflow.verifications[0].criterionIds, ["AC-1", "AC-2"]);
  assert.equal((await assessWork({ repo, workId: work.record.id })).criteria[0].usable, false);
  const fresh = await verifyPass(repo, work.record.id);
  const assessment = await assessWork({ repo, workId: work.record.id });
  assert.equal(assessment.criteria[0].usable, true);
  assert.deepEqual(assessment.record.workflow.verifications.map((attempt) => attempt.id), [old.id, fresh.id]);
  assert.deepEqual(assessment.record.workflow.verifications[0].criteriaSnapshot, old.criteriaSnapshot);
});
