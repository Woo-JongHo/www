/**
 * @verifies RESP-DEVELOPMENT-EVIDENCE-VERIFICATION
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { appendFile, chmod, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { assessRepositoryCheck, captureRepositoryState, checkRepository } from "../scripts/workflow/consistency.ts";
import { captureSource, criteriaDigest, evaluateEvidence, renderAttempt, verify } from "../scripts/workflow/evidence.ts";
import { openWork, readWork, verifyWork } from "../scripts/workflow/work.ts";

const exec = promisify(execFile);
type CriterionFixture = { id: string; description: string; required: boolean; result: string; evidence: { path: string }[]; requirementRefs?: string[] };
const record = (): { criteria: CriterionFixture[] } => ({ criteria: [
  { id: "AC-1", description: "실제 검사 명령이 성공한다", required: true, result: "unverified", evidence: [], requirementRefs: ["CHAT-REQUEST-01"] },
  { id: "AC-2", description: "실패가 성공으로 바뀌지 않는다", required: true, result: "unverified", evidence: [] },
] });

async function fixture() {
  const repo = await mkdtemp(path.join(tmpdir(), "www-evidence-"));
  await mkdir(path.join(repo, "src"));
  await mkdir(path.join(repo, "docs", "work"), { recursive: true });
  await writeFile(path.join(repo, "src", "value.ts"), "export const value = 1;\n");
  await writeFile(path.join(repo, "check.ts"), "import { value } from './src/value.ts';\nif (value !== 1) process.exit(1);\n");
  await writeFile(path.join(repo, ".gitignore"), ".www/\n");
  await exec("git", ["init", "-q"], { cwd: repo });
  await exec("git", ["config", "user.name", "검증 fixture"], { cwd: repo });
  await exec("git", ["config", "user.email", "fixture@example.invalid"], { cwd: repo });
  await exec("git", ["add", "."], { cwd: repo });
  await exec("git", ["commit", "-qm", "검증 기준선"], { cwd: repo });
  return repo;
}

function options(repo: string, overrides: object = {}) {
  return { repo, record: record(), inputs: ["src", "check.ts"], command: process.execPath, args: ["check.ts"], criterionIds: ["AC-1"], ...overrides };
}

for (const drift of ['dependency', 'environment', 'configuration', 'tool'] as const) {
  test(`세션 실제 실행의 확장 환경은 저장한 증거 평가에도 적용된다 — ${drift}`, async t => {
    const { createVerificationSession, verifyInSession } = await import('../scripts/workflow/evidence.ts');
    const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
    await mkdir(path.join(repo, 'node_modules'));
    await writeFile(path.join(repo, 'node_modules/input'), 'before');
    const configuration = path.join(repo, '.www-local-configuration');
    const tool = path.join(repo, '.www-local-tool');
    await writeFile(configuration, 'before');
    await writeFile(tool, '#!/bin/sh\nexit 0\n');
    await chmod(tool, 0o755);
    const variable = 'WWW_REUSE_EVIDENCE_ENVIRONMENT_FIXTURE';
    const previous = process.env[variable];
    process.env[variable] = 'before';
    t.after(() => { if (previous === undefined) delete process.env[variable]; else process.env[variable] = previous; });
    const session = createVerificationSession({ checkId: `durable-${drift}`, scenario: '실제 실행 뒤 적용성', phase: 'focused', maxAgeMs: 60_000, tools: [process.execPath, tool], environmentPaths: [configuration], environmentObserved: true });
    const execution = await verifyInSession(session, options(repo));
    assert.equal(execution.reuse.action, 'executed');
    assert.equal(execution.attempt.result, 'passed');
    // 복제한 시도만 전달해도 세션의 in-memory 후보 없이 같은 관측 범위를 평가한다.
    const attempt = structuredClone(execution.attempt);
    assert.equal((await evaluateEvidence({ repo, record: record(), attempt })).usable, true);
    if (drift === 'dependency') await writeFile(path.join(repo, 'node_modules/input'), 'after');
    if (drift === 'environment') process.env[variable] = 'after';
    if (drift === 'configuration') await writeFile(configuration, 'after');
    if (drift === 'tool') await writeFile(tool, '#!/bin/sh\nexit 1\n');
    const evaluation = await evaluateEvidence({ repo, record: record(), attempt });
    assert.equal(evaluation.usable, false);
    assert.ok(evaluation.reasons.includes('observed_environment_changed'), evaluation.reasons.join(', '));
  });
}

test('세션 확장 환경의 관측 실패·손상은 현재 환경으로 보완해 통과시키지 않는다', async t => {
  const { createVerificationSession, verifyInSession } = await import('../scripts/workflow/evidence.ts');
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const tool = path.join(repo, '.local-tool');
  await writeFile(tool, '#!/bin/sh\nexit 0\n');
  await chmod(tool, 0o755);
  const configuration = { checkId: 'unavailable-observation', scenario: '확장 환경 실패 보존', phase: 'focused' as const, maxAgeMs: 60_000, tools: [tool], environmentPaths: [], environmentObserved: true };
  const valid = (await verifyInSession(createVerificationSession(configuration), options(repo))).attempt;
  assert.equal(valid.result, 'passed');
  await chmod(tool, 0o644);
  assert.ok((await evaluateEvidence({ repo, record: record(), attempt: valid })).reasons.includes('environment_observation_unavailable'));
  const unavailable = (await verifyInSession(createVerificationSession(configuration), options(repo))).attempt;
  assert.equal(unavailable.exitCode, 0);
  assert.equal(unavailable.result, 'failed');
  await chmod(tool, 0o755);
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: unavailable })).usable, false);
  assert.ok(valid.environmentObservation);
  Object.assign(valid.environmentObservation, { version: 2 });
  assert.ok((await evaluateEvidence({ repo, record: record(), attempt: valid })).reasons.includes('invalid_environment_observation'));
});

test("실제 Node 검증 성공과 실패를 구분하고 원문 출력을 보관하지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const success = await verify(options(repo));
  assert.equal(success.result, "passed");
  assert.equal(success.executor, "process");
  assert.deepEqual(await evaluateEvidence({ repo, record: record(), attempt: success }), { usable: true, reasons: [] });
  await writeFile(path.join(repo, "src", "value.ts"), "export const value = 2;\n");
  const failure = await verify(options(repo));
  assert.equal(failure.result, "failed");
  assert.equal(failure.exitCode, 1);
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: failure })).usable, false);
  await writeFile(path.join(repo, "output.ts"), "process.stdout.write('a-private-value-should-never-be-stored'); process.stdout.write('x'.repeat(100000)); process.stderr.write('another-private-value');\n");
  const output = await verify(options(repo, { args: ["output.ts"], inputs: ["output.ts"] }));
  assert.ok(output.output);
  assert.equal(output.output.stdout.contentRetained, false);
  assert.ok(output.output);
  assert.equal(output.output.stderr.contentRetained, false);
  assert.ok(output.output);
  assert.ok(output.output.stdout.bytes > 0);
  assert.ok(output.output);
  assert.equal(output.output.stdout.truncated, true);
  assert.ok(output.output);
  assert.equal(output.output.stdout.retainedBytes, 65_536);
  assert.doesNotMatch(JSON.stringify(output), /a-private-value|another-private-value/);
  assert.match(renderAttempt(output), new RegExp(`id="${output.id}"`));
});

test("같은 HEAD와 dirty 상태에서도 내용 변경을 감지하고 무관한 문서는 허용한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, "src", "value.ts"), "export const value = 1; // 첫 변경\n");
  const attempt = await verify(options(repo)) ;
  const head    = attempt.source.head         ;
  await writeFile(path.join(repo, "docs", "work", "note.md"), "검증 설명만 보완\n");
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt })).usable, true);
  await writeFile(path.join(repo, "src", "value.ts"), "export const value = 1; // 다음 변경\n");
  const current = await captureSource({ repo, inputs: attempt.source.inputs });
  assert.equal(current.head, head);
  assert.notEqual(current.digest, attempt.source.digest);
  assert.ok((await evaluateEvidence({ repo, record: record(), attempt })).reasons.includes("source_changed"));
});

test("새 미추적 파일과 파일 삭제, 누락 입력의 생성을 식별한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const first = await captureSource({ repo, inputs: ["src", "future.ts"] });
  await writeFile(path.join(repo, "src", "new.ts"), "export const added = true;\n");
  const added = await captureSource({ repo, inputs: ["src", "future.ts"] });
  assert.notEqual(added.digest, first.digest);
  await rm(path.join(repo, "src", "new.ts"));
  assert.equal((await captureSource({ repo, inputs: ["src", "future.ts"] })).digest, first.digest);
  await writeFile(path.join(repo, "future.ts"), "export default true;\n");
  const beforeRemoval = await captureSource({ repo, inputs: ["src", "future.ts"] });
  assert.notEqual(beforeRemoval.digest, first.digest);
  await rm(path.join(repo, "src", "value.ts"));
  const removed = await captureSource({ repo, inputs: ["src", "future.ts"] });
  assert.notEqual(removed.digest, beforeRemoval.digest);
});

test("동일한 내용의 새 commit은 증거를 무효화하지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const attempt = await verify(options(repo));
  await exec("git", ["commit", "--allow-empty", "-qm", "내용 유지"], { cwd: repo });
  const next = await captureSource({ repo, inputs: attempt.source.inputs });
  assert.notEqual(next.head, attempt.source.head);
  assert.equal(next.digest, attempt.source.digest);
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt })).usable, true);
});

test("기준 결과·증거와 달리 같은 ID의 설명·필수 여부·요구 참조 변경은 무효화한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const original = record(); const attempt = await verify(options(repo, { record: original }));
  const reporting = structuredClone(original);
  reporting.criteria[0].result = "passed"; reporting.criteria[0].evidence.push({ path: "verification.md#attempt" });
  assert.equal(criteriaDigest(reporting), criteriaDigest(original));
  for (const override of [{ description: "변경된 기준" }, { required: false }, { requirementRefs: ["CHAT-REQUEST-02"] }]) {
    const changed = structuredClone(original); Object.assign(changed.criteria[0], override);
    assert.ok((await evaluateEvidence({ repo, record: changed, attempt })).reasons.includes("criteria_changed"));
  }
});

test("검증 명령 실행 중 대상이 바뀌면 종료 코드가 0이어도 통과하지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, "mutate.ts"), "import { writeFileSync } from 'node:fs'; writeFileSync('src/value.ts', 'export const value = 3;');\n");
  const attempt = await verify(options(repo, { args: ["mutate.ts"], inputs: ["src", "mutate.ts"] }));
  assert.equal(attempt.exitCode, 0);
  assert.equal(attempt.sourceStable, false);
  assert.equal(attempt.result, "failed");
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt })).usable, false);
});

test("검증 중 입력이 심볼릭 링크로 바뀌어도 실패 시도를 잃지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, "replace.ts"), "import { unlinkSync, symlinkSync } from 'node:fs'; unlinkSync('src/value.ts'); symlinkSync('../check.ts', 'src/value.ts');\n");
  const attempt = await verify(options(repo, { args: ["replace.ts"], inputs: ["src", "replace.ts"] }));
  assert.equal(attempt.exitCode, 0);
  assert.equal(attempt.sourceStable, false);
  assert.equal(attempt.result, "failed");
  const state = await evaluateEvidence({ repo, record: record(), attempt });
  assert.equal(state.usable, false);
  assert.ok(state.reasons.includes("source_unavailable"));
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: { ...attempt, command: "bad\0command" } })).reasons[0], "invalid_attempt");
});

test("경로 탈출·심볼릭 링크·빈 입력과 잘못된 기준 범위를 실행 전에 거부한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  for (const inputs of [[], ["../outside"], ["/tmp"], ["src/../check.ts"], ["C:\\outside"], [".www/output"]]) {
    await assert.rejects(captureSource({ repo, inputs }), /검증 대상|상대 경로|제외 경로/);
  }
  await symlink(path.join(repo, "src"), path.join(repo, "linked"));
  await assert.rejects(captureSource({ repo, inputs: ["linked/value.ts"] }), /심볼릭 링크/);
  await symlink(path.join(repo, "check.ts"), path.join(repo, "src", "linked.ts"));
  await assert.rejects(captureSource({ repo, inputs: ["src"] }), /심볼릭 링크/);
  for (const criterionIds of [[], ["AC-unknown"], ["AC-1", "AC-1"]]) {
    await assert.rejects(verify(options(repo, { criterionIds })), /수용 기준 ID/);
  }
});

test("실행 파일 오류와 테스트 주입 결과를 실제 완료 증거로 쓰지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const missing = await verify(options(repo, { command: path.join(repo, "absent-command"), args: [] }));
  assert.equal(missing.result, "failed");
  assert.equal(missing.error, "ENOENT");
  const injected = await verify(options(repo, { run: async () => ({ code: 0, stdout: "arbitrary private output" }) }));
  assert.equal(injected.executor, "injected");
  assert.ok((await evaluateEvidence({ repo, record: record(), attempt: injected })).reasons.includes("untrusted_executor"));
  assert.doesNotMatch(JSON.stringify(injected), /arbitrary private output/);
});

test("명시 범위의 제외 디렉터리와 입력 순서는 내용 식별을 흔들지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const first = await captureSource({ repo, inputs: ["src", "check.ts"] });
  await mkdir(path.join(repo, "src", "node_modules"));
  await writeFile(path.join(repo, "src", "node_modules", "ignored.ts"), "출력물\n");
  const second = await captureSource({ repo, inputs: ["check.ts", "./src", "src"] });
  assert.equal(first.digest, second.digest);
  assert.equal(await readFile(path.join(repo, "src", "node_modules", "ignored.ts"), "utf8"), "출력물\n");
});

test("검증 실행 파일이 바뀌면 입력 소스가 같아도 실행 환경 변경으로 판단한다", { timeout: 30_000 }, async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const windows = process.platform === "win32"                                 ;
  const tool    = path.join(repo, windows ? "local-check.exe" : "local-check") ;
  if (windows) await copyFile(process.execPath, tool);
  else {
    await writeFile(tool, "#!/bin/sh\nexit 0\n");
    await chmod(tool, 0o700);
  }
  const attempt = await verify(options(repo, { command: tool, args: windows ? ["-e", "process.exit(0)"] : [], inputs: ["src"] }));
  assert.equal(attempt.result, "passed");
  const reordered = { ...attempt, environment: { executable: attempt.environment.executable, node: attempt.environment.node, arch: attempt.environment.arch, platform: attempt.environment.platform } };
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: reordered })).usable, true);
  const otherController = { ...attempt, environment: { ...attempt.environment, node: "다른 제어 프로세스 버전" } };
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: otherController })).usable, true);
  if (windows) await appendFile(tool, "실행 후 바이너리 지문 변경");
  else await writeFile(tool, "#!/bin/sh\n# 다른 실행 파일\nexit 0\n");
  const current = await evaluateEvidence({ repo, record: record(), attempt });
  assert.ok(current.reasons.includes("environment_changed"));
  assert.ok(!current.reasons.includes("source_changed"));
});


test("전체 기록 검사는 기능 증거와 분리되고 작업 기록 변경 후에만 stale을 알린다", { timeout: 30_000 }, async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const feature = await verify(options(repo));
  assert.equal((await assessRepositoryCheck({ repo })).status, "not_run");
  const checked = await checkRepository({ repo, command: process.execPath, args: ["check.ts"] });
  assert.equal(checked.result, "passed");
  assert.equal((await assessRepositoryCheck({ repo })).current, true);
  await writeFile(path.join(repo, "docs/work/note.md"), "검증 기록 보완\n");
  const stale = await assessRepositoryCheck({ repo });
  assert.equal(stale.current, false);
  assert.ok(stale.reasons.includes("repository_changed"));
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: feature })).usable, true);
  await checkRepository({ repo, command: process.execPath, args: ["check.ts"] });
  assert.equal((await assessRepositoryCheck({ repo })).current, true);
  await mkdir(path.join(repo, "docs/work/빈-작업"));
  assert.equal((await assessRepositoryCheck({ repo })).current, false);
  await writeFile(path.join(repo, ".gitignore"), ".www/\n*.log\n");
  await checkRepository({ repo, command: process.execPath, args: ["check.ts"] });
  await writeFile(path.join(repo, "docs/work/ignored.log"), "검사기가 읽는 무시 파일 변경\n");
  assert.equal((await assessRepositoryCheck({ repo })).current, false);
});

test("전체 검사 실패·입력 중 변경·Git 무시 원문·발견 링크를 구분한다", { timeout: 30_000 }, async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, "fail.ts"), "process.exit(9);\n");
  const failed = await checkRepository({ repo, command: process.execPath, args: ["fail.ts"] });
  assert.equal(failed.exitCode, 9);
  assert.ok((await assessRepositoryCheck({ repo })).reasons.includes("repository_check_failed"));
  await writeFile(path.join(repo, "mutate.ts"), "import{writeFileSync}from'node:fs';writeFileSync('src/new.ts','changed');\n");
  const changed = await checkRepository({ repo, command: process.execPath, args: ["mutate.ts"] });
  assert.equal(changed.sourceStable, false);
  await mkdir(path.join(repo, ".agents"));
  await symlink(path.join(repo, "src"), path.join(repo, ".agents/discovery"), process.platform === "win32" ? "junction" : "dir");
  await checkRepository({ repo, command: process.execPath, args: ["check.ts"] });
  const before = await captureRepositoryState({ repo });
  await writeFile(path.join(repo, ".www/private.log"), "원문 로그는 검사 소스에 포함하지 않는다");
  assert.equal((await captureRepositoryState({ repo })).digest, before.digest);
  assert.equal((await assessRepositoryCheck({ repo })).current, true);
  await rm(path.join(repo, ".agents/discovery"));
  await symlink(path.join(repo, "docs"), path.join(repo, ".agents/discovery"), process.platform === "win32" ? "junction" : "dir");
  assert.equal((await assessRepositoryCheck({ repo })).current, false);
});

async function artifactFixture(repo: string) {
  const proof = ".www/proof/receipt.json";
  await mkdir(path.join(repo, ".www/proof"), { recursive: true });
  await writeFile(path.join(repo, proof), JSON.stringify({ status: "passed", private: "raw-receipt-content-is-private" }));
  await writeFile(path.join(repo, "artifact-check.ts"), "import { readFileSync } from 'node:fs';\nif (JSON.parse(readFileSync('.www/proof/receipt.json','utf8')).status !== 'passed') process.exit(1);\n");
  return { proof, verifyOptions: options(repo, { inputs: ["src", "artifact-check.ts"], args: ["artifact-check.ts"], artifactPaths: [proof] }) };
}

test("명시한 무시 원문은 소스와 분리해 hash·크기로만 고정하고 내용 변경을 무효화한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const { proof, verifyOptions } = await artifactFixture(repo);
  const noArtifacts = await verify(options(repo));
  assert.equal("artifacts" in noArtifacts, false);
  const attempt = await verify(verifyOptions);
  assert.equal(attempt.result, "passed");
  assert.equal(attempt.sourceStable, true);
  assert.ok(attempt.artifacts);
  assert.equal(attempt.artifactsStable, true);
  assert.ok(attempt.artifacts);
  assert.deepEqual(Object.keys(attempt.artifacts[0]).sort(), ["digest", "path", "size"]);
  assert.ok(attempt.artifacts);
  assert.equal(attempt.artifacts[0].path, proof);
  assert.ok(attempt.artifacts);
  assert.equal(attempt.artifacts[0].size, (await readFile(path.join(repo, proof))).length);
  assert.ok(attempt.artifacts);
  assert.match(attempt.artifacts[0].digest, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(attempt), /raw-receipt-content-is-private/);
  assert.doesNotMatch(renderAttempt(attempt), /raw-receipt-content-is-private/);
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt })).usable, true);
  const initial = await readFile(path.join(repo, proof), "utf8");
  await writeFile(path.join(repo, proof), initial.replace("passed", "failed"));
  const assessment = await evaluateEvidence({ repo, record: record(), attempt });
  assert.equal(assessment.usable, false);
  assert.ok(assessment.reasons.includes("artifacts_changed"));
  assert.ok(!assessment.reasons.includes("source_changed"));
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: noArtifacts })).usable, true);
});

test("원문 삭제·심볼릭 링크 전환과 잘못된 저장 메타데이터를 현재 증거로 쓰지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const { proof, verifyOptions } = await artifactFixture(repo);
  const attempt = await verify(verifyOptions);
  await rm(path.join(repo, proof));
  assert.ok((await evaluateEvidence({ repo, record: record(), attempt })).reasons.includes("artifacts_unavailable"));
  const outside = await mkdtemp(path.join(tmpdir(), "www-artifact-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, "receipt.json"), '{"status":"passed"}');
  await symlink(path.join(outside, "receipt.json"), path.join(repo, proof), process.platform === "win32" ? "file" : undefined);
  assert.ok((await evaluateEvidence({ repo, record: record(), attempt })).reasons.includes("artifacts_unavailable"));
  assert.ok(attempt.artifacts);
  const corrupt = { ...attempt, artifacts: [{ ...attempt.artifacts[0], size: -1 }] };
  assert.ok((await evaluateEvidence({ repo, record: record(), attempt: corrupt })).reasons.includes("artifacts_invalid"));
  assert.ok(attempt.artifacts);
  const escaped = { ...attempt, artifacts: [{ ...attempt.artifacts[0], path: "../receipt.json" }] };
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: escaped })).usable, false);
});

test("실제 검증 중 원문 변경·삭제는 종료 코드 0이어도 실패 시도로 보존한다", async (t) => {
  for (const operation of ["change", "delete"]) {
    const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
    const { verifyOptions } = await artifactFixture(repo);
    await writeFile(path.join(repo, "mutate-artifact.ts"), `import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';\nconst file='.www/proof/receipt.json';\nif (JSON.parse(readFileSync(file,'utf8')).status!=='passed') process.exit(1);\n${operation === "change" ? "writeFileSync(file,'{\"status\":\"failed\"}');" : "unlinkSync(file);"}\n`);
    const attempt = await verify({ ...verifyOptions, inputs: ["src", "mutate-artifact.ts"], args: ["mutate-artifact.ts"] });
    assert.equal(attempt.exitCode, 0);
    assert.equal(attempt.sourceStable, true);
    assert.ok(attempt.artifacts);
    assert.equal(attempt.artifactsStable, false);
    assert.equal(attempt.result, "failed");
    assert.match(renderAttempt(attempt), /명령 결과: 정상 종료, 종료 코드 0/u);
    assert.match(renderAttempt(attempt), /검증 시도 결과: 증거 불충족/u);
    assert.ok(attempt.artifacts);
    assert.equal(attempt.artifacts.length, 1);
    assert.equal((await evaluateEvidence({ repo, record: record(), attempt })).usable, false);
  }
});

test("원문 입력의 경로 탈출·부모 링크·디렉터리·누락은 검증 명령 실행 전에 거부한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const { proof, verifyOptions } = await artifactFixture(repo);
  const outside = await mkdtemp(path.join(tmpdir(), "www-artifact-parent-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, "receipt.json"), '{"status":"passed"}');
  await symlink(outside, path.join(repo, ".www/outside-link"), process.platform === "win32" ? "junction" : "dir");
  const marker  = path.join(repo, ".www/should-not-execute")                                     ;
  const command = ["-e", "require('node:fs').writeFileSync('.www/should-not-execute','실행됨')"] ;
  for (const artifactPaths of [["../receipt.json"], [path.join(outside, "receipt.json")], ["C:\\outside.json"], [".www/../receipt.json"], [".www/outside-link/receipt.json"], [".www/proof"], [".www/missing.json"], null]) {
    await assert.rejects(verify({ ...verifyOptions, args: command, artifactPaths }));
  }
  await assert.rejects(readFile(marker), { code: "ENOENT" });
  const deduplicated = await verify({ ...verifyOptions, artifactPaths: [`./${proof}`, proof] });
  assert.ok(deduplicated.artifacts);
  assert.equal(deduplicated.artifacts.length, 1);
});

test("verifyWork가 선택 원문 의존성을 실제 검증 시도와 작업 레코드에 전달한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const { proof, verifyOptions } = await artifactFixture(repo);
  await writeFile(path.join(repo, "docs/work/INDEX.md"), "# 작업 목차\n");
  const work = await openWork({
    repo, role: "www-dev", direct: true, requestId: "artifact-integration-1", request: "선택한 원문을 읽는 검증 결과를 연결해줘",
    decision : { intent: "verify", area: "Verification", title: "선택 원문 검증 연결", kind: "maintenance", criteria: [{ id: "AC-1", description: "원문 성공 상태를 확인한다", required: true }] } ,
    approval : { verifierCommands: [JSON.stringify([verifyOptions.command, ...verifyOptions.args])] }                                                                                              ,
    inputs   : verifyOptions.inputs                                                                                                                                                                ,
  });
  const attempt = await verifyWork({ repo, workId: work.record.id, command: verifyOptions.command, args: verifyOptions.args, criterionIds: ["AC-1"], artifactPaths: [proof] });
  assert.equal(attempt.result, "passed");
  assert.ok(attempt.artifacts);
  assert.equal(attempt.artifacts[0].path, proof);
  const saved = await readWork({ repo, workId: work.record.id });
  assert.equal(saved.record.schemaVersion, 2);
  const latest = saved.record.workflow.verifications.at(-1);
  assert.ok(latest);
  assert.ok(attempt.artifacts);
  assert.deepEqual(latest.artifacts, attempt.artifacts);
  await writeFile(path.join(repo, proof), '{"status":"failed"}');
  assert.ok((await evaluateEvidence({ repo, record: saved.record, attempt })).reasons.includes("artifacts_changed"));
});

test('같은 동결 입력의 두 작업은 실제 검사를 한 번만 실행하고 각각 허용된 기준에 연결한다', async (t) => {
  const { createVerificationSession } = await import('../scripts/workflow/evidence.ts');
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, 'docs/work/INDEX.md'), '# 작업 목차\n');
  await mkdir(path.join(repo, '.www'), { recursive: true });
  await writeFile(path.join(repo, 'check.ts'), "import { appendFileSync } from 'node:fs';\nimport { value } from './src/value.ts';\nappendFileSync('.www/counter', 'x');\nif(value !== 1) process.exit(1);\n");
  const command = process.execPath;
  const args = ['check.ts'];
  const reuseSession = createVerificationSession({ checkId: 'fixture-common', scenario: '공통 값 검사', phase: 'common', maxAgeMs: 60_000, tools: [command], environmentPaths: [], environmentObserved: true });
  const works = [];
  for (const number of [1, 2]) works.push(await openWork({
    repo, role: 'www-dev', direct: true, request: '검증 재사용 fixture', requestId: `reuse-${number}`, inputs: ['src', 'check.ts'],
    decision: { intent: 'verify', area: 'Workflow', title: `공통 검사 ${number}`, criteria: [{ id: 'AC-1', description: '공통 값이 1이다', required: true }] },
    approval: { implementation: false, writePaths: [], mutationSurfaces: [], verifierCommands: [JSON.stringify([command, ...args])] },
  }));
  const results = [];
  for (const work of works) results.push(await verifyWork({ repo, workId: work.record.id, command, args, criterionIds: ['AC-1'], reuseSession }));
  assert.equal(results[0].reuse?.action, 'executed');
  assert.equal(results[1].reuse?.action, 'reused');
  assert.equal(results[0].id, results[1].id);
  assert.equal(await readFile(path.join(repo, '.www/counter'), 'utf8'), 'x');
  for (const work of works) {
    const current = await readWork({ repo, workId: work.record.id });
    assert.equal(current.record.criteria[0].result, 'passed');
    assert.equal(current.record.workflow?.reviews.length, 0);
    assert.equal(current.record.workflow?.verifications.length, 1);
  }
  const again = await verifyWork({ repo, workId: works[1].record.id, command, args, criterionIds: ['AC-1'], reuseSession });
  assert.equal(again.reuse?.action, 'reused');
  assert.equal(await readFile(path.join(repo, '.www/counter'), 'utf8'), 'x');
  const receipt = JSON.parse(await readFile(path.join(repo, again.reuseReceiptPath ?? ''), 'utf8'));
  assert.equal(receipt.reuse.processExecutions, 0);
  const workPath = works[1].path;
  const current = await readWork({ repo, workId: works[1].record.id });
  assert.ok(current.record.workflow);
  current.record.workflow.authorization.verifierCommands = [];
  await writeFile(workPath, JSON.stringify(current.record));
  await assert.rejects(verifyWork({ repo, workId: works[1].record.id, command, args, criterionIds: ['AC-1'], reuseSession }), /허용하지 않은 검증 명령/);
  assert.equal(await readFile(path.join(repo, '.www/counter'), 'utf8'), 'x');
});

test('재사용은 구현·테스트·설정·기준·범위·환경·도구·의존성·아티팩트 변화와 실패·주입을 거부한다', async (t) => {
  const { createVerificationSession, verifyInSession } = await import('../scripts/workflow/evidence.ts');
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await mkdir(path.join(repo, '.www'), { recursive: true });
  await mkdir(path.join(repo, 'node_modules'), { recursive: true });
  await writeFile(path.join(repo, 'node_modules/dependency.txt'), 'v1');
  await writeFile(path.join(repo, 'config.json'), '{}');
  await writeFile(path.join(repo, '.www/artifact'), '검증 원문');
  await writeFile(path.join(repo, 'check.ts'), "import { appendFileSync } from 'node:fs';\nimport { value } from './src/value.ts';\nappendFileSync('.www/counter', 'x');\nif(value !== 1) process.exit(1);\n");
  const tool = path.join(repo, '.www/tool');
  await copyFile(process.execPath, tool); await chmod(tool, 0o755);
  const configuration = { checkId: 'focused-counter', scenario: '변경 무효화', phase: 'focused' as const, maxAgeMs: 60_000, tools: [tool], environmentPaths: [], environmentObserved: true };
  const session = createVerificationSession(configuration);
  let current = options(repo, { inputs: ['src', 'check.ts', 'config.json'], artifactPaths: ['.www/artifact'] });
  const invoke = () => verifyInSession(session, current);
  const first = await invoke(); assert.equal(first.attempt.result, 'passed');
  const hit = await invoke(); assert.equal(hit.reuse.action, 'reused');
  assert.equal(await readFile(path.join(repo, '.www/counter'), 'utf8'), 'x');
  // 반환 객체를 바꿔도 세션 내부 원본은 바뀌지 않는다.
  hit.attempt.result = 'failed';
  assert.equal((await invoke()).reuse.action, 'reused');
  const mutations: [string, () => Promise<unknown>][] = [
    ['source_changed', () => appendFile(path.join(repo, 'src/value.ts'), '// 구현 변화\n')],
    ['source_changed', () => appendFile(path.join(repo, 'check.ts'), '// 테스트 변화\n')],
    ['source_changed', () => writeFile(path.join(repo, 'config.json'), '{"mode":"changed"}')],
    ['artifacts_changed', () => writeFile(path.join(repo, '.www/artifact'), '새 원문')],
    ['observed_environment_changed', () => writeFile(path.join(repo, 'node_modules/dependency.txt'), 'v2')],
    ['observed_environment_changed', () => chmod(tool, 0o644)],
  ];
  for (const [reason, mutate] of mutations) {
    await mutate();
    const result = await invoke();
    assert.equal(result.reuse.action, 'executed');
    // 실행 불가 도구도 관측 실패로 재실행한다.
    assert.ok(result.reuse.reasons.includes(reason) || result.reuse.reasons.includes('environment_observation_unavailable'), result.reuse.reasons.join(','));
  }
  await chmod(tool, 0o755); await invoke();
  const prior = process.env.WWW_REUSE_TEST_ENV;
  try {
    process.env.WWW_REUSE_TEST_ENV = 'changed';
    assert.ok((await invoke()).reuse.reasons.includes('observed_environment_changed'));
  } finally { if (prior === undefined) delete process.env.WWW_REUSE_TEST_ENV; else process.env.WWW_REUSE_TEST_ENV = prior; }
  await invoke();
  const changed = record(); changed.criteria[0].description = '변경된 기준';
  current = { ...current, record: changed };
  assert.ok((await invoke()).reuse.reasons.includes('criteria_changed'));
  current = { ...current, inputs: [...current.inputs, 'new-scope.ts'] };
  assert.ok((await invoke()).reuse.reasons.includes('source_changed'));
  await writeFile(path.join(repo, 'src/value.ts'), 'export const value = 9;\n');
  const failed = await invoke(); assert.equal(failed.attempt.result, 'failed');
  const failureAgain = await invoke();
  assert.equal(failureAgain.reuse.action, 'executed');
  assert.ok(failureAgain.reuse.reasons.includes('verification_failed'));
  await writeFile(path.join(repo, 'src/value.ts'), 'export const value = 1;\n');
  const injectedSession = createVerificationSession(configuration);
  const injected = await verifyInSession(injectedSession, { ...current, run: () => ({ code: 0 }) });
  assert.equal(injected.attempt.executor, 'injected');
  const actual = await verifyInSession(injectedSession, current);
  assert.equal(actual.reuse.action, 'executed');
  assert.ok(actual.reuse.reasons.includes('untrusted_executor'));
  const unseen = createVerificationSession({ ...configuration, environmentObserved: false });
  await verifyInSession(unseen, current);
  assert.ok((await verifyInSession(unseen, current)).reuse.reasons.includes('environment_unobserved'));
  const expired = createVerificationSession({ ...configuration, maxAgeMs: 1 });
  await verifyInSession(expired, current);
  const later = performance.now() + 3;
  while (performance.now() < later) { /* 단조 시계의 만료 경계만 기다린다. */ }
  assert.ok((await verifyInSession(expired, current)).reuse.reasons.includes('observation_expired'));
  const fresh = createVerificationSession(configuration);
  assert.ok((await verifyInSession(fresh, current)).reuse.reasons.includes('no_session_observation'));
  await assert.rejects(verifyInSession({ id: session.id }, current), /현재 프로세스/);
  const concurrent = createVerificationSession(configuration);
  const before = (await readFile(path.join(repo, '.www/counter'), 'utf8')).length;
  const parallel = await Promise.all([verifyInSession(concurrent, current), verifyInSession(concurrent, current)]);
  assert.deepEqual(parallel.map(item => item.reuse.action), ['executed', 'reused']);
  assert.equal((await readFile(path.join(repo, '.www/counter'), 'utf8')).length, before + 1);
  console.info(JSON.stringify({ experiment: 'identical-frozen-counter', requests: 2, processExecutions: 1, counterDelta: 1, avoidedExecutions: 1, scope: '실제 fixture 명령; 전체검사 시간·모델 토큰 절감 아님' }));
});

test('읽기 전용 의존성 링크의 실제 내용과 집중·통합 단계 경계를 구분한다', async (t) => {
  const { createVerificationSession, verifyInSession } = await import('../scripts/workflow/evidence.ts');
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const dependencies = await fsDependency();
  t.after(() => rm(dependencies, { recursive: true, force: true }));
  await symlink(dependencies, path.join(repo, 'node_modules'));
  const configuration = { checkId: 'linked-dependencies', scenario: '의존성 링크 관측', phase: 'focused' as const, maxAgeMs: 60_000, tools: [process.execPath], environmentPaths: [], environmentObserved: true };
  const session = createVerificationSession(configuration);
  await verifyInSession(session, options(repo));
  assert.equal((await verifyInSession(session, options(repo))).reuse.action, 'reused');
  await writeFile(path.join(dependencies, 'package.txt'), 'v2');
  assert.ok((await verifyInSession(session, options(repo))).reuse.reasons.includes('observed_environment_changed'));
  const integration = createVerificationSession({ ...configuration, phase: 'integration' });
  assert.ok((await verifyInSession(integration, options(repo))).reuse.reasons.includes('no_session_observation'));
  async function fsDependency() {
    const directory = await mkdtemp(path.join(tmpdir(), 'www-reuse-dependency-'));
    await writeFile(path.join(directory, 'package.txt'), 'v1');
    return directory;
  }
});

test('실행 중 추가 환경이 바뀌면 성공을 core 증거로 기록하지 않는다 — TERRA-01', async (t) => {
  const { createVerificationSession, verifyInSession } = await import('../scripts/workflow/evidence.ts');
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await mkdir(path.join(repo, 'node_modules'));
  await writeFile(path.join(repo, 'node_modules/input'), 'before');
  await writeFile(path.join(repo, 'change-environment.ts'), "import {writeFileSync} from 'node:fs'; writeFileSync('node_modules/input','after');");
  const session = createVerificationSession({ checkId: 'environment-during-run', scenario: '실행 중 환경 변경', phase: 'focused', maxAgeMs: 60_000, tools: [process.execPath], environmentPaths: [], environmentObserved: true });
  const result = await verifyInSession(session, options(repo, { inputs: ['change-environment.ts'], args: ['change-environment.ts'] }));
  assert.equal(result.attempt.exitCode, 0);
  assert.equal(result.attempt.result, 'failed');
  assert.equal(result.attempt.environmentStable, false);
  assert.ok(result.reuse.reasons.includes('observed_environment_unstable'));
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: result.attempt })).usable, false);
});

test('다른 명령 서명의 최근 실패가 같은 검사 세션의 이전 성공을 무효화한다 — TERRA-03', async (t) => {
  const { createVerificationSession, verifyInSession } = await import('../scripts/workflow/evidence.ts');
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const session = createVerificationSession({ checkId: 'cross-signature-failure', scenario: '다른 서명 실패', phase: 'common', maxAgeMs: 60_000, tools: [process.execPath], environmentPaths: [], environmentObserved: true });
  const first = await verifyInSession(session, options(repo));
  assert.equal(first.attempt.result, 'passed');
  const failure = await verifyInSession(session, options(repo, { args: ['-e', 'process.exit(7)'] }));
  assert.equal(failure.attempt.result, 'failed');
  const next = await verifyInSession(session, options(repo));
  assert.equal(next.reuse.action, 'executed');
  assert.notEqual(next.attempt.id, first.attempt.id);
  assert.ok(next.reuse.reasons.includes('prior_session_failure'));
});

test('원장 잠금 대기 중 새 실패가 기록되면 이전 성공을 붙이지 않고 실제 재실행한다 — TERRA-02', async (t) => {
  const { createVerificationSession } = await import('../scripts/workflow/evidence.ts');
  const { withWorkLock } = await import('../scripts/workflow/lock.ts');
  const { readdir } = await import('node:fs/promises');
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, 'docs/work/INDEX.md'), '# 작업 목차\n');
  await mkdir(path.join(repo, '.www'), { recursive: true });
  await writeFile(path.join(repo, 'check.ts'), "import {appendFileSync} from 'node:fs'; appendFileSync('.www/counter','x');");
  const command = process.execPath, args = ['check.ts'];
  const works = [];
  for (const number of [1, 2]) works.push(await openWork({ repo, role: 'www-dev', direct: true, request: '재사용 경합 fixture', requestId: `race-${number}`, inputs: ['src', 'check.ts'],
    decision: { intent: 'verify', area: 'Workflow', title: `경합 ${number}`, criteria: [{ id: 'AC-1', description: '실제 명령 검사', required: true }] },
    approval: { implementation: false, writePaths: [], mutationSurfaces: [], verifierCommands: [JSON.stringify([command, ...args]), JSON.stringify([command, '-e', 'process.exit(7)'])] } }));
  const session = createVerificationSession({ checkId: 'record-race', scenario: '기록 직전 실패', phase: 'common', maxAgeMs: 60_000, tools: [command], environmentPaths: [], environmentObserved: true });
  const warm = await verifyWork({ repo, workId: works[0].record.id, command, args, criterionIds: ['AC-1'], reuseSession: session });
  const target = works[1];
  assert.ok(target.record.workflow);
  const failure = await verify({ repo, record: target.record, inputs: target.record.workflow.inputs, command, args: ['-e', 'process.exit(7)'], criterionIds: ['AC-1'] });
  const directory = path.join(repo, '.www/pending-results');
  const existing = new Set(await readdir(directory));
  let pending: ReturnType<typeof verifyWork> | undefined;
  await withWorkLock(repo, async () => {
    pending = verifyWork({ repo, workId: target.record.id, command, args, criterionIds: ['AC-1'], reuseSession: session });
    const deadline = Date.now() + 2_000;
    while (!(await readdir(directory)).some(file => !existing.has(file))) {
      if (Date.now() > deadline) throw new Error('재사용 pending 대기 초과');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    const latest = await readWork({ repo, workId: target.record.id });
    assert.ok(latest.record.workflow);
    latest.record.workflow.verifications.push(failure);
    latest.record.criteria[0].result = 'failed';
    await writeFile(latest.path, JSON.stringify(latest.record));
  });
  assert.ok(pending);
  const result = await pending;
  assert.equal(result.recorded, true);
  assert.equal(result.reuse?.action, 'executed');
  assert.ok(result.reuse?.reasons.includes('record_changed_before_reuse'));
  assert.notEqual(result.id, warm.id);
  const final = await readWork({ repo, workId: target.record.id });
  assert.deepEqual(final.record.workflow?.verifications.map(item => item.id), [failure.id, result.id]);
  assert.equal(await readFile(path.join(repo, '.www/counter'), 'utf8'), 'xx');
});

for (const mode of ['environment', 'session-failure', 'session-failure-pending', 'expired-pending', 'process-pending'] as const) {
  test(`기록 시 확장 관측·세션을 재확인한다 — TERRA-04 ${mode}`, async (t) => {
    const { createVerificationSession, verifyInSession } = await import('../scripts/workflow/evidence.ts');
    const { withWorkLock } = await import('../scripts/workflow/lock.ts');
    const { appendPending } = await import('../scripts/workflow/work.ts');
    const { readdir } = await import('node:fs/promises');
    const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
    await writeFile(path.join(repo, 'docs/work/INDEX.md'), '# 작업 목차\n');
    await mkdir(path.join(repo, 'node_modules'));
    await writeFile(path.join(repo, 'node_modules/input'), 'before');
    const command = process.execPath, args = ['check.ts'];
    const works = [];
    for (const number of [1, 2]) works.push(await openWork({ repo, role: 'www-dev', direct: true, request: '기록 관측 fixture', requestId: `${mode}-${number}`, inputs: ['src', 'check.ts'],
      decision: { intent: 'verify', area: 'Workflow', title: `관측 ${number}`, criteria: [{ id: 'AC-1', description: '실제 명령 검사', required: true }] },
      approval: { implementation: false, writePaths: [], mutationSurfaces: [], verifierCommands: [JSON.stringify([command, ...args])] } }));
    const session = createVerificationSession({ checkId: `record-observation-${mode}`, scenario: '기록 시 관측', phase: 'common', maxAgeMs: mode === 'expired-pending' ? 1_000 : 60_000, tools: [command], environmentPaths: [], environmentObserved: true });
    const warm = await verifyWork({ repo, workId: works[0].record.id, command, args, criterionIds: ['AC-1'], reuseSession: session });
    const target = works[1];
    const directory = path.join(repo, '.www/pending-results');
    const existing = new Set(await readdir(directory));
    let pending: ReturnType<typeof verifyWork> | undefined;
    await withWorkLock(repo, async () => {
      pending = verifyWork({ repo, workId: target.record.id, command, args, criterionIds: ['AC-1'], reuseSession: session });
      const deadline = Date.now() + 2_000;
      while (!(await readdir(directory)).some(file => !existing.has(file))) {
        if (Date.now() > deadline) throw new Error('기록 관측 pending 대기 초과');
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      if (mode === 'environment') await writeFile(path.join(repo, 'node_modules/input'), 'changed-during-lock');
      if (mode.startsWith('session-failure')) await verifyInSession(session, options(repo, { record: target.record, args: ['-e', 'process.exit(7)'] }));
      // 재시도 예산보다 느린 정상 보류 경로를 시간 추정 없이 실제 잠금으로 강제한다.
      if (mode === 'session-failure-pending') await pending;
      if (mode === 'expired-pending' || mode === 'process-pending') await new Promise(resolve => setTimeout(resolve, 1_100));
    });
    assert.ok(pending);
    let result = await pending;
    if (mode === 'session-failure-pending') assert.equal(result.recorded, false);
    let recoveredFromPending = false;
    if (mode.startsWith('session-failure') && !result.recorded) {
      assert.equal(result.reason, 'WORK_LOCK_BUSY');
      assert.equal(result.reuse?.action, 'reused');
      assert.equal(result.id, warm.id);
      assert.equal((await readWork({ repo, workId: target.record.id })).record.workflow?.verifications.length, 0);
      await assert.rejects(appendPending({ repo, workId: target.record.id, artifactPath: result.artifactPath }), /reuse_record_changed/);
      result = await verifyWork({ repo, workId: target.record.id, command, args, criterionIds: ['AC-1'], reuseSession: session });
      assert.ok(result.reuse?.reasons.includes('prior_session_failure'));
      recoveredFromPending = true;
    }
    if (mode === 'expired-pending' || mode === 'process-pending') {
      assert.equal(result.recorded, false);
      assert.equal((await readWork({ repo, workId: target.record.id })).record.workflow?.verifications.length, 0);
      if (mode === 'expired-pending') await assert.rejects(appendPending({ repo, workId: target.record.id, artifactPath: result.artifactPath }), /reuse_record_changed/);
      else {
        const module = new URL('../scripts/workflow/work.ts', import.meta.url).href;
        const script = `const {appendPending}=await import(${JSON.stringify(module)});try{await appendPending(${JSON.stringify({ repo, workId: target.record.id, artifactPath: result.artifactPath })});process.exitCode=1;}catch(e){if(!String(e).includes('process_session_observation_missing'))throw e;console.log('new-process-reuse-rejected');}`;
        assert.match((await exec(command, ['--input-type=module', '-e', script])).stdout, /new-process-reuse-rejected/);
      }
    } else {
      assert.equal(result.recorded, true);
      assert.equal(result.reuse?.action, 'executed');
      if (!recoveredFromPending) assert.ok(result.reuse?.reasons.includes('record_changed_before_reuse'));
      assert.equal(result.executor, 'process');
      assert.equal(result.result, 'passed');
      assert.equal(result.reuse?.processExecutions, 1);
      assert.notEqual(result.id, warm.id);
      assert.deepEqual((await readWork({ repo, workId: target.record.id })).record.workflow?.verifications.map(attempt => attempt.id), [result.id]);
    }
  });
}
