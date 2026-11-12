import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { readRuntime, runtimePaths } from "../scripts/workflow/record.mjs";
import { runDevelopmentWorkflow } from "../scripts/workflow/run.mjs";
import { completeWork, readWork } from "../scripts/workflow/work.mjs";

const exec = promisify(execFile);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const contextFiles = ["AGENTS.md", "agents/www/AGENT.md", "docs/skills/WORKFLOW.md", "skills/www/www-build/SKILL.md"];

async function repository(t) {
  const repo = await mkdtemp(join(tmpdir(), "www-development-coordinator-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  for (const directory of ["agents/www", "docs/skills", "docs/work", "docs/specs", "skills/www/www-build", "src", "checks"]) await mkdir(join(repo, directory), { recursive: true });
  await Promise.all([...contextFiles, "agents/www/review-policy.json"].map((file) => copyFile(join(projectRoot, file), join(repo, file))));
  await Promise.all([
    writeFile(join(repo, ".gitignore"), ".www/\n"),
    writeFile(join(repo, "docs/work/INDEX.md"), "# 작업 목차\n"),
    writeFile(join(repo, "docs/specs/chat.md"), '# Chat fixture 요구\n\n<a id="CHAT-FIXTURE-01"></a>\n허용된 변경 결과를 검사한다.\n'),
    writeFile(join(repo, "src/item.mjs"), "export const value = 1;\n"),
    writeFile(join(repo, "checks/verify.mjs"), "import assert from 'node:assert/strict';\nimport { value } from '../src/item.mjs';\nassert.equal(value, 2);\n"),
  ]);
  await exec("git", ["init", "-q"], { cwd: repo });
  await exec("git", ["config", "user.name", "개발 연결 Fixture"], { cwd: repo });
  await exec("git", ["config", "user.email", "development-fixture@example.invalid"], { cwd: repo });
  await exec("git", ["add", "."], { cwd: repo });
  await exec("git", ["commit", "-qm", "테스트 기준선"], { cwd: repo });
  return realpath(repo);
}

function request(repo, overrides = {}) {
  const args = ["checks/verify.mjs"];
  return {
    repo,
    role: "www-dev",
    direct: true,
    request: "Chat 표시의 작은 변경을 구현하고 검사해줘",
    requestId: "fixture-request-1",
    eventId: "fixture-execution-1",
    decision: {
      intent: "build", area: "Chat", title: "허용된 변경의 실행 연결", kind: "maintenance", areas: ["ui", "dev"], owner: "dev",
      criteria: [{ id: "AC-1", description: "허용된 파일의 결과가 기대값 2다", required: true, requirementRefs: ["docs/specs/chat.md#CHAT-FIXTURE-01"] }],
    },
    approval: {
      implementation: true,
      writePaths: ["src/item.mjs"],
      mutationSurfaces: ["edit"],
      verifierCommands: [JSON.stringify([process.execPath, ...args])],
      commit: false,
      publish: false,
    },
    inputs: ["src", "checks"],
    writes: ["src/item.mjs"],
    surfaces: ["edit"],
    verifier: { command: process.execPath, args, criterionIds: ["AC-1"] },
    execute: true,
    ...overrides,
  };
}

function hostResult(overrides = {}) {
  return { ok: true, code: 0, signal: null, error: null, outcome: "passed", stdout: "coordinator fixture only", stderr: "", outputTruncated: false, threadId: "fixture-host-thread", events: [], ...overrides };
}

test("주입 호스트 fixture로 일반 요청을 신규 UUID·자동 선택 스킬·실제 verifier에 연결한다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  let received;
  const options = request(repo);
  const result = await runDevelopmentWorkflow(options, { runProcess: async (invocation, processOptions) => {
    calls += 1;
    received = invocation;
    assert.equal(processOptions.cwd, repo);
    assert.equal(invocation.mode, "codex-exec");
    await writeFile(join(repo, "src/item.mjs"), "export const value = 2;\n");
    return hostResult();
  } });
  assert.equal(calls, 1);
  assert.equal(result.executed, true);
  assert.equal(result.route.skill, "www-build");
  assert.equal(result.route.reason, "development_role_selection");
  assert.match(result.workId, /^work-[a-f0-9-]+$/);
  assert.ok(received.stdin.includes(result.workId));
  assert.ok(received.stdin.includes(options.request));
  assert.ok(received.stdin.includes("www-dev"));
  assert.ok(received.stdin.includes('"writePaths":["src/item.mjs"]'));
  assert.ok(!received.args.includes(options.request));
  assert.deepEqual(result.sources.map((source) => source.path), contextFiles);
  for (const source of result.sources) {
    const content = await readFile(join(repo, source.path));
    assert.equal(source.hash, createHash("sha256").update(content).digest("hex"));
    assert.ok(received.stdin.includes(source.hash));
  }
  assert.equal(result.verification.executor, "process");
  assert.equal(result.verification.exitCode, 0);
  assert.equal(result.verification.result, "passed");
  const work = await readWork({ repo, workId: result.workId });
  assert.equal(work.record.schemaVersion, 2);
  assert.equal(work.record.criteria[0].result, "passed");
  assert.equal(work.record.criteria[0].evidence[0].attemptId, result.verification.id);
  assert.equal(work.record.status, "verifying");
  assert.equal(work.record.workflow.nextAction, "review");
  assert.equal(work.record.workflow.authorization.commit, false);
  assert.equal(work.record.workflow.authorization.publish, false);
  const runtime = await readRuntime(runtimePaths(repo, result.workId));
  assert.equal(runtime.session.status, "completed");
  assert.ok(runtime.events.some((event) => event.type === "host_result" && event.injected === true));
  await assert.rejects(completeWork({ repo, workId: result.workId }), /독립 검토|현재 증거/);
  assert.equal((await readWork({ repo, workId: result.workId })).record.status, "verifying");
  assert.equal((await readdir(join(repo, "docs/work/Chat"))).length, 1);
});

test("인용 요청·정보 질문·preview는 호스트 실행이나 작업 생성을 하지 않는다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  const dependencies = { runProcess: async () => { calls += 1; return hostResult(); } };
  await assert.rejects(runDevelopmentWorkflow(request(repo, { direct: false }), dependencies), /직접 요청/);
  const answer = await runDevelopmentWorkflow(request(repo, { decision: { intent: "answer" }, request: "이 구조를 설명해줘" }), dependencies);
  assert.equal(answer.executed, false);
  assert.equal(answer.route.intent, "answer");
  const preview = await runDevelopmentWorkflow(request(repo, { preview: true }), dependencies);
  assert.equal(preview.preview, true);
  assert.equal(preview.executed, false);
  await assert.rejects(runDevelopmentWorkflow(request(repo, { execute: false }), dependencies), /execute/);
  assert.equal(calls, 0);
  assert.deepEqual(await readdir(join(repo, "docs/work")), ["INDEX.md"]);
  await assert.rejects(access(join(repo, ".www")));
});

test("권한 밖 선언 쓰기는 주입 호스트 fixture를 시작하기 전에 거부한다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  const result = await runDevelopmentWorkflow(request(repo, { writes: ["src/outside.mjs"] }), { runProcess: async () => { calls += 1; return hostResult(); } });
  assert.equal(result.executed, false);
  assert.equal(result.mutation.ok, false);
  assert.equal(result.mutation.reason, "outside_approval");
  assert.deepEqual(result.mutation.deniedWrites, ["src/outside.mjs"]);
  assert.equal(calls, 0);
  assert.equal(await readFile(join(repo, "src/item.mjs"), "utf8"), "export const value = 1;\n");
});

test("같은 사건 ID의 재실행은 같은 UUID를 반환하고 호스트를 다시 실행하지 않는다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  const options = request(repo, { verifier: undefined });
  const dependencies = { runProcess: async () => { calls += 1; return hostResult(); } };
  const first = await runDevelopmentWorkflow(options, dependencies);
  const repeated = await runDevelopmentWorkflow(options, dependencies);
  assert.equal(repeated.executed, false);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.workId, first.workId);
  assert.equal(calls, 1);
  assert.equal((await readdir(join(repo, "docs/work/Chat"))).length, 1);
  assert.equal((await readWork({ repo, workId: first.workId })).record.status, "in_progress");
});

test("주입 호스트 성공 뒤 실제 verifier 실패는 같은 작업의 실패와 수정 단계를 남긴다", async (t) => {
  const repo = await repository(t);
  const result = await runDevelopmentWorkflow(request(repo), { runProcess: async () => hostResult() });
  assert.equal(result.host.ok, true);
  assert.equal(result.verification.executor, "process");
  assert.equal(result.verification.result, "failed");
  assert.notEqual(result.verification.exitCode, 0);
  const work = await readWork({ repo, workId: result.workId });
  assert.equal(work.record.criteria[0].result, "failed");
  assert.equal(work.record.workflow.nextAction, "build");
  assert.equal(work.record.status, "verifying");
  assert.equal(work.record.workflow.verifications.length, 1);
  assert.ok((await readFile(join(dirname(work.path), "verification.md"), "utf8")).includes(result.verification.id));
  assert.equal((await readRuntime(runtimePaths(repo, result.workId))).session.status, "completed");
});

test("같은 작업의 실행 잠금이 있으면 두 번째 호스트 실행을 거부한다", async (t) => {
  const repo = await repository(t);
  let release;
  let enter;
  let rejectEnter;
  let calls = 0;
  const started = new Promise((resolve, reject) => { enter = resolve; rejectEnter = reject; });
  const gate = new Promise((resolve) => { release = resolve; });
  const options = request(repo, { verifier: undefined });
  const first = runDevelopmentWorkflow(options, { runProcess: async () => {
    calls += 1;
    enter();
    await gate;
    return hostResult();
  } });
  first.catch(rejectEnter);
  await started;
  try {
    await assert.rejects(runDevelopmentWorkflow({ ...options, eventId: "fixture-execution-2" }, { runProcess: async () => { calls += 1; return hostResult(); } }), /실행 중|잠금/);
    assert.equal(calls, 1);
  } finally { release(); }
  const result = await first;
  await assert.rejects(access(join(repo, ".www/runtime", result.workId, "execution.lock")));
});

test("개발 역할은 읽기 전용·작업 폴더 sandbox만 선택하고 전체 권한 확대를 거부한다", async (t) => {
  for (const sandbox of ["read-only", "workspace-write"]) {
    const repo = await repository(t);
    let received;
    const result = await runDevelopmentWorkflow(request(repo, { sandbox, verifier: undefined }), { runProcess: async (invocation) => { received = invocation; return hostResult(); } });
    assert.equal(result.executed, true);
    assert.equal(received.args[received.args.indexOf("--sandbox") + 1], sandbox);
  }
  const repo = await repository(t);
  let calls = 0;
  await assert.rejects(runDevelopmentWorkflow(request(repo, { sandbox: "danger-full-access" }), { runProcess: async () => { calls += 1; return hostResult(); } }), /read-only|workspace-write/);
  assert.equal(calls, 0);
});
