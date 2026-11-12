import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { captureSource, criteriaDigest, evaluateEvidence, renderAttempt, verify } from "../scripts/workflow/evidence.mjs";

const exec = promisify(execFile);
const record = () => ({ criteria: [
  { id: "AC-1", description: "실제 검사 명령이 성공한다", required: true, result: "unverified", evidence: [], requirementRefs: ["CHAT-REQUEST-01"] },
  { id: "AC-2", description: "실패가 성공으로 바뀌지 않는다", required: true, result: "unverified", evidence: [] },
] });

async function fixture() {
  const repo = await mkdtemp(path.join(tmpdir(), "www-evidence-"));
  await mkdir(path.join(repo, "src"));
  await mkdir(path.join(repo, "docs", "work"), { recursive: true });
  await writeFile(path.join(repo, "src", "value.mjs"), "export const value = 1;\n");
  await writeFile(path.join(repo, "check.mjs"), "import { value } from './src/value.mjs';\nif (value !== 1) process.exit(1);\n");
  await writeFile(path.join(repo, ".gitignore"), ".www/\n");
  await exec("git", ["init", "-q"], { cwd: repo });
  await exec("git", ["config", "user.name", "검증 fixture"], { cwd: repo });
  await exec("git", ["config", "user.email", "fixture@example.invalid"], { cwd: repo });
  await exec("git", ["add", "."], { cwd: repo });
  await exec("git", ["commit", "-qm", "검증 기준선"], { cwd: repo });
  return repo;
}

function options(repo, overrides = {}) {
  return { repo, record: record(), inputs: ["src", "check.mjs"], command: process.execPath, args: ["check.mjs"], criterionIds: ["AC-1"], ...overrides };
}

test("실제 Node 검증 성공과 실패를 구분하고 원문 출력을 보관하지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const success = await verify(options(repo));
  assert.equal(success.result, "passed");
  assert.equal(success.executor, "process");
  assert.deepEqual(await evaluateEvidence({ repo, record: record(), attempt: success }), { usable: true, reasons: [] });
  await writeFile(path.join(repo, "src", "value.mjs"), "export const value = 2;\n");
  const failure = await verify(options(repo));
  assert.equal(failure.result, "failed");
  assert.equal(failure.exitCode, 1);
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: failure })).usable, false);
  await writeFile(path.join(repo, "output.mjs"), "process.stdout.write('a-private-value-should-never-be-stored'); process.stdout.write('x'.repeat(100000)); process.stderr.write('another-private-value');\n");
  const output = await verify(options(repo, { args: ["output.mjs"], inputs: ["output.mjs"] }));
  assert.equal(output.output.stdout.contentRetained, false);
  assert.equal(output.output.stderr.contentRetained, false);
  assert.ok(output.output.stdout.bytes > 0);
  assert.equal(output.output.stdout.truncated, true);
  assert.equal(output.output.stdout.retainedBytes, 65_536);
  assert.doesNotMatch(JSON.stringify(output), /a-private-value|another-private-value/);
  assert.match(renderAttempt(output), new RegExp(`id="${output.id}"`));
});

test("같은 HEAD와 dirty 상태에서도 내용 변경을 감지하고 무관한 문서는 허용한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, "src", "value.mjs"), "export const value = 1; // 첫 변경\n");
  const attempt = await verify(options(repo));
  const head = attempt.source.head;
  await writeFile(path.join(repo, "docs", "work", "note.md"), "검증 설명만 보완\n");
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt })).usable, true);
  await writeFile(path.join(repo, "src", "value.mjs"), "export const value = 1; // 다음 변경\n");
  const current = await captureSource({ repo, inputs: attempt.source.inputs });
  assert.equal(current.head, head);
  assert.notEqual(current.digest, attempt.source.digest);
  assert.ok((await evaluateEvidence({ repo, record: record(), attempt })).reasons.includes("source_changed"));
});

test("새 미추적 파일과 파일 삭제, 누락 입력의 생성을 식별한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const first = await captureSource({ repo, inputs: ["src", "future.mjs"] });
  await writeFile(path.join(repo, "src", "new.mjs"), "export const added = true;\n");
  const added = await captureSource({ repo, inputs: ["src", "future.mjs"] });
  assert.notEqual(added.digest, first.digest);
  await rm(path.join(repo, "src", "new.mjs"));
  assert.equal((await captureSource({ repo, inputs: ["src", "future.mjs"] })).digest, first.digest);
  await writeFile(path.join(repo, "future.mjs"), "export default true;\n");
  const beforeRemoval = await captureSource({ repo, inputs: ["src", "future.mjs"] });
  assert.notEqual(beforeRemoval.digest, first.digest);
  await rm(path.join(repo, "src", "value.mjs"));
  const removed = await captureSource({ repo, inputs: ["src", "future.mjs"] });
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
  for (const [field, value] of [["description", "변경된 기준"], ["required", false], ["requirementRefs", ["CHAT-REQUEST-02"]]]) {
    const changed = structuredClone(original); changed.criteria[0][field] = value;
    assert.ok((await evaluateEvidence({ repo, record: changed, attempt })).reasons.includes("criteria_changed"));
  }
});

test("검증 명령 실행 중 대상이 바뀌면 종료 코드가 0이어도 통과하지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, "mutate.mjs"), "import { writeFileSync } from 'node:fs'; writeFileSync('src/value.mjs', 'export const value = 3;');\n");
  const attempt = await verify(options(repo, { args: ["mutate.mjs"], inputs: ["src", "mutate.mjs"] }));
  assert.equal(attempt.exitCode, 0);
  assert.equal(attempt.sourceStable, false);
  assert.equal(attempt.result, "failed");
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt })).usable, false);
});

test("검증 중 입력이 심볼릭 링크로 바뀌어도 실패 시도를 잃지 않는다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, "replace.mjs"), "import { unlinkSync, symlinkSync } from 'node:fs'; unlinkSync('src/value.mjs'); symlinkSync('../check.mjs', 'src/value.mjs');\n");
  const attempt = await verify(options(repo, { args: ["replace.mjs"], inputs: ["src", "replace.mjs"] }));
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
  for (const inputs of [[], ["../outside"], ["/tmp"], ["src/../check.mjs"], ["C:\\outside"], [".www/output"]]) {
    await assert.rejects(captureSource({ repo, inputs }), /검증 대상|상대 경로|제외 경로/);
  }
  await symlink(path.join(repo, "src"), path.join(repo, "linked"));
  await assert.rejects(captureSource({ repo, inputs: ["linked/value.mjs"] }), /심볼릭 링크/);
  await symlink(path.join(repo, "check.mjs"), path.join(repo, "src", "linked.mjs"));
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
  const first = await captureSource({ repo, inputs: ["src", "check.mjs"] });
  await mkdir(path.join(repo, "src", "node_modules"));
  await writeFile(path.join(repo, "src", "node_modules", "ignored.mjs"), "출력물\n");
  const second = await captureSource({ repo, inputs: ["check.mjs", "./src", "src"] });
  assert.equal(first.digest, second.digest);
  assert.equal(await readFile(path.join(repo, "src", "node_modules", "ignored.mjs"), "utf8"), "출력물\n");
});

test("검증 실행 파일이 바뀌면 입력 소스가 같아도 실행 환경 변경으로 판단한다", async (t) => {
  const repo = await fixture(); t.after(() => rm(repo, { recursive: true, force: true }));
  const tool = path.join(repo, "local-check");
  await writeFile(tool, "#!/bin/sh\nexit 0\n");
  await chmod(tool, 0o700);
  const attempt = await verify(options(repo, { command: tool, args: [], inputs: ["src"] }));
  assert.equal(attempt.result, "passed");
  const reordered = { ...attempt, environment: Object.fromEntries(Object.entries(attempt.environment).reverse()) };
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: reordered })).usable, true);
  const otherController = { ...attempt, environment: { ...attempt.environment, node: "다른 제어 프로세스 버전" } };
  assert.equal((await evaluateEvidence({ repo, record: record(), attempt: otherController })).usable, true);
  await writeFile(tool, "#!/bin/sh\n# 다른 실행 파일\nexit 0\n");
  const current = await evaluateEvidence({ repo, record: record(), attempt });
  assert.ok(current.reasons.includes("environment_changed"));
  assert.ok(!current.reasons.includes("source_changed"));
});
