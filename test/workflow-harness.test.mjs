import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { createGjcInvocation } from "../scripts/workflow/adapters/gjc.mjs";
import { createSessionBinding, preflightMutation, resolveInside, validateSessionBinding } from "../scripts/workflow/preflight.mjs";
import { appendEvent, readRuntime, runtimePaths, withRuntimeLock } from "../scripts/workflow/record.mjs";
import { classifyIntent, hashRequest, namedSkill, routeRequest } from "../scripts/workflow/route.mjs";
import { runProcess, runWorkflow } from "../scripts/workflow/run.mjs";

const exec = promisify(execFile);
const workId = "work-11111111-1111-4111-8111-111111111111";
const fixtureHost = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "fake-workflow-host.mjs");

async function createRepository() {
  const repo = await mkdtemp(join(tmpdir(), "www-workflow-repo-"));
  const workDirectory = join(repo, "docs", "work", "Workflow", "001-Fixture");
  const skillDirectory = join(repo, "skills", "www", "www-build");
  await mkdir(workDirectory, { recursive: true });
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(join(repo, ".gitignore"), ".www/\nmarker.json\n");
  await writeFile(join(repo, "tracked.txt"), "처음\n");
  await writeFile(join(skillDirectory, "SKILL.md"), "# fixture build skill\n");
  await writeFile(join(workDirectory, "work.json"), `${JSON.stringify({
    schemaVersion: 1,
    id: workId,
    title: "Fixture",
    kind: "feature",
    areas: ["dev"],
    owner: "dev",
    status: "ready",
    blockedReason: null,
    relations: [],
    criteria: [
      { id: "AC-1", description: "첫 기준", required: true, result: "unverified", evidence: [] },
      { id: "AC-2", description: "둘째 기준", required: true, result: "unverified", evidence: [] },
    ],
  }, null, 2)}\n`);
  await exec("git", ["init", "-q"], { cwd: repo });
  await exec("git", ["config", "user.name", "Fixture"], { cwd: repo });
  await exec("git", ["config", "user.email", "fixture@example.invalid"], { cwd: repo });
  await exec("git", ["add", "."], { cwd: repo });
  await exec("git", ["commit", "-qm", "fixture"], { cwd: repo });
  return repo;
}

function verifier(exitCode = 0, criteria = { "AC-1": "passed", "AC-2": "passed" }) {
  return {
    command: process.execPath,
    args: [fixtureHost, "verifier", String(exitCode)],
    criteria,
  };
}

function approvalFor(command) {
  return {
    implementation: true,
    writePaths: ["src/a.ts"],
    mutationSurfaces: ["edit"],
    verifierCommands: [JSON.stringify([command.command, ...command.args])],
  };
}

function fixtureRunner() {
  return async (invocation, options) => {
    if (invocation.command === "gjc") {
      return runProcess({ command: process.execPath, args: [fixtureHost, "host", ...invocation.args] }, options);
    }
    return runProcess(invocation, options);
  };
}

test("직접 선택과 인용된 Skill 이름을 구분하고 정보 질문은 read-only로 남긴다", () => {
  assert.equal(namedSkill("www-build 구현해"), "www-build");
  assert.equal(namedSkill("문서에 'www-build'라고 적혀 있어"), null);
  assert.equal(classifyIntent({ request: "왜 실패하나요?", direct: true }).intent, "answer");
  assert.equal(classifyIntent({ request: "구현해", direct: true }).reason, "ambiguous_request");
  assert.equal(classifyIntent({ request: "인용된 요청", direct: false, explicitSkill: "www-build" }).intent, "answer");
  const denied = classifyIntent({ request: "구현", direct: true, explicitSkill: "www-build", status: "ready", approval: { implementation: true } });
  assert.equal(denied.reason, "implementation_not_approved");
  assert.equal(routeRequest({ request: "질문?", direct: true }).skill, null);
  assert.match(hashRequest("요청"), /^[a-f0-9]{64}$/);
});

test("commit과 publish 권한을 별도로 검사한다", () => {
  assert.equal(classifyIntent({ request: "게시", direct: true, explicitSkill: "www-commit", status: "ready", approval: { commit: true }, publishRequested: true }).reason, "publish_not_approved");
  assert.equal(classifyIntent({ request: "로컬 커밋", direct: true, explicitSkill: "www-commit", status: "ready", approval: { commit: true } }).intent, "commit");
});

test("명시 승인 밖 mutation과 지원하지 않는 hard gate를 거부한다", () => {
  assert.deepEqual(preflightMutation({ approval: {}, writes: ["src/a.ts"] }), { ok: false, mode: "rejected", reason: "implementation_not_approved" });
  assert.equal(preflightMutation({ approval: { implementation: true, writePaths: ["src/a.ts"], mutationSurfaces: ["edit"] }, writes: ["src/a.ts"], surfaces: ["edit"], host: {} }).mode, "advisory");
  assert.equal(preflightMutation({ approval: { implementation: true, writePaths: ["src/a.ts"], mutationSurfaces: ["edit"] }, writes: ["src/a.ts"], surfaces: ["edit"], host: {}, requireHardGate: true }).reason, "hard_gate_unsupported");
});

test("GJC 호출은 검증된 request를 비대화형 argv로 전달하고 미지원 모델을 거부한다", () => {
  const invocation = createGjcInvocation({ systemPrompt: "context", request: "실제 요청" });
  assert.deepEqual(invocation.args.slice(0, 3), ["-p", "--no-title", "--append-system-prompt"]);
  assert.equal(invocation.args.at(-1), "실제 요청");
  assert.throws(() => createGjcInvocation({ systemPrompt: "context", request: "요청", model: "x", capabilities: { model: false } }), /지원하지 않습니다/);
});

test("경로 traversal과 dirty 내용 drift를 거부한다", async () => {
  const repo = await createRepository();
  try {
    await assert.rejects(resolveInside(repo, "../outside"), /traversal/);
    const binding = await createSessionBinding({ repo, workId, requestHash: hashRequest("요청") });
    await writeFile(join(repo, "tracked.txt"), "같은 파일의 다른 내용\n");
    await assert.rejects(validateSessionBinding(binding), /dirty/);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("event 기록은 payload 멱등성, revision, redaction과 완료 gate를 지킨다", async () => {
  const repo = await mkdtemp(join(tmpdir(), "www-harness-record-"));
  try {
    const first = await appendEvent({ repo, workId, expectedRevision: 0, event: { id: "event-1", type: "status", status: "running", token: "secret" } });
    assert.equal(first.session.revision, 1);
    assert.equal(first.event.token, "[REDACTED]");
    assert.equal((await appendEvent({ repo, workId, event: { id: "event-1", type: "status", status: "running", token: "different" } })).duplicate, true);
    await assert.rejects(appendEvent({ repo, workId, event: { id: "event-1", type: "status", status: "failed" } }), /payload/);
    await assert.rejects(appendEvent({ repo, workId, expectedRevision: 0, event: { id: "event-2", type: "status" } }), /revision 충돌/);
    await appendEvent({ repo, workId, event: { id: "claim", type: "verification", summary: { result: "passed" } } });
    await assert.rejects(appendEvent({ repo, workId, event: { id: "done-claim", type: "status", status: "done" } }), /실제 verifier/);
    const log = await readFile(runtimePaths(repo, workId).events, "utf8");
    assert.doesNotMatch(log, /secret|different/);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("로그 append 뒤 stale sidecar를 replay하고 같은 revision 변조와 partial log는 거부한다", async () => {
  const repo = await mkdtemp(join(tmpdir(), "www-harness-replay-"));
  try {
    const first = await appendEvent({ repo, workId, event: { id: "one", type: "status", status: "running" } });
    await appendEvent({ repo, workId, event: { id: "two", type: "status", status: "failed" } });
    const paths = runtimePaths(repo, workId);
    await writeFile(paths.session, `${JSON.stringify(first.session, null, 2)}\n`);
    assert.equal((await readRuntime(paths)).session.revision, 2);
    const replayed = (await readRuntime(paths)).session;
    await writeFile(paths.session, `${JSON.stringify({ ...replayed, status: "tampered" }, null, 2)}\n`);
    await assert.rejects(readRuntime(paths), /변조/);
    await writeFile(paths.session, `${JSON.stringify(replayed, null, 2)}\n`);
    await writeFile(paths.events, "{partial");
    await assert.rejects(readRuntime(paths), /partial JSONL/);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("최신 verification 실패는 과거 통과를 무효화한다", async () => {
  const repo = await mkdtemp(join(tmpdir(), "www-harness-latest-"));
  const passed = {
    executed: true,
    result: "passed",
    commandHash: "a".repeat(64),
    exitCode: 0,
    criteriaCoverage: { requiredIds: ["AC-1"], passedIds: ["AC-1"] },
    blocked: false,
  };
  try {
    await appendEvent({ repo, workId, event: { id: "verification-pass", type: "verification", summary: passed } });
    await appendEvent({ repo, workId, event: { id: "done-pass", type: "status", status: "done" } });
    await appendEvent({ repo, workId, event: { id: "verification-fail", type: "verification", summary: { ...passed, result: "failed", exitCode: 1 } } });
    await assert.rejects(appendEvent({ repo, workId, event: { id: "done-again", type: "status", status: "done" } }), /실제 verifier/);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("lock 경합과 runtime symlink를 fail closed 처리한다", async () => {
  const repo = await mkdtemp(join(tmpdir(), "www-harness-lock-"));
  const external = await mkdtemp(join(tmpdir(), "www-harness-outside-"));
  try {
    let release;
    let started;
    const entered = new Promise((resolve) => { started = resolve; });
    const first = withRuntimeLock(repo, workId, async () => {
      started();
      await new Promise((resolve) => { release = resolve; });
    });
    await entered;
    await assert.rejects(withRuntimeLock(repo, workId, async () => {}), /잠겨/);
    release();
    await first;
    await rm(join(repo, ".www", "runtime"), { recursive: true, force: true });
    await symlink(external, join(repo, ".www", "runtime"));
    await assert.rejects(appendEvent({ repo, workId, event: { id: "escape", type: "status" } }), /심볼릭 링크/);
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});

test("승인 누락은 fixture host를 시작하지 않는다", async () => {
  const repo = await createRepository();
  const marker = join(repo, "marker.json");
  try {
    const result = await runWorkflow({
      repo,
      workId,
      request: "인용문에 www-build가 있어도 실행하지 않음",
      direct: true,
      explicitSkill: "www-build",
      approval: {},
      writes: ["src/a.ts"],
      surfaces: ["edit"],
      execute: true,
      eventId: "missing-approval",
      env: { ...process.env, WORKFLOW_MARKER: marker },
    }, { runProcess: fixtureRunner() });
    assert.equal(result.executed, false);
    await assert.rejects(access(marker));
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("실제 fixture subprocess에 request/context를 전달하고 동일 UUID에 검증·완료를 기록한다", async () => {
  const repo = await createRepository();
  const marker = join(repo, "marker.json");
  const check = verifier();
  try {
    const result = await runWorkflow({
      repo,
      workId,
      request: "승인된 수직 흐름 실행",
      direct: true,
      explicitSkill: "www-build",
      approval: approvalFor(check),
      writes: ["src/a.ts"],
      surfaces: ["edit"],
      verifier: check,
      execute: true,
      eventId: "fixture-success",
      env: { ...process.env, WORKFLOW_MARKER: marker },
    }, { runProcess: fixtureRunner() });
    assert.equal(result.executed, true);
    assert.equal(result.verificationSummary.result, "passed");
    const markerRecord = JSON.parse(await readFile(marker, "utf8"));
    assert.equal(markerRecord.args.at(-1), "승인된 수직 흐름 실행");
    assert.ok(markerRecord.args.includes("-p"));
    assert.match(markerRecord.args[markerRecord.args.indexOf("--append-system-prompt") + 1], new RegExp(workId));
    const runtime = await readRuntime(runtimePaths(repo, workId));
    assert.equal(runtime.session.status, "done");
    assert.equal(runtime.events[0].workPath.endsWith("work.json"), true);
    assert.equal(runtime.events[0].skill.loadMode, "context");
    assert.equal(runtime.events[0].skill.loaded, true);
    const canonicalRepo = await realpath(repo);
    assert.equal(runtime.events[0].skill.path, join(canonicalRepo, "skills", "www", "www-build", "SKILL.md"));
    assert.equal(runtime.events[0].model.observed, null);
    assert.equal(runtime.events[0].workId, workId);
    assert.equal(runtime.events[0].binding.repo, canonicalRepo);
    assert.equal(runtime.events[0].approval.verifierCommands, undefined);
    assert.equal(runtime.events[0].approval.verifierCommandHashes.length, 1);
    const work = JSON.parse(await readFile(join(repo, "docs", "work", "Workflow", "001-Fixture", "work.json"), "utf8"));
    assert.equal(work.status, "ready");
    assert.equal(work.criteria[0].result, "unverified");
    const duplicate = await runWorkflow({
      repo,
      workId,
      request: "승인된 수직 흐름 실행",
      direct: true,
      explicitSkill: "www-build",
      approval: approvalFor(check),
      writes: ["src/a.ts"],
      surfaces: ["edit"],
      verifier: check,
      execute: true,
      eventId: "fixture-success",
      env: { ...process.env, WORKFLOW_MARKER: marker },
    }, { runProcess: fixtureRunner() });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.executed, false);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("host nonzero와 verifier 실패·필수 기준 누락은 완료되지 않는다", async () => {
  const scenarios = [
    { name: "host-fail", hostExit: "17", verifier: verifier(), expected: undefined },
    { name: "verifier-fail", hostExit: "0", verifier: verifier(9), expected: "failed" },
    { name: "criteria-missing", hostExit: "0", verifier: verifier(0, { "AC-1": "passed", "AC-2": "unverified" }), expected: "failed" },
  ];
  for (const scenario of scenarios) {
    const repo = await createRepository();
    const marker = join(repo, "marker.json");
    try {
      const result = await runWorkflow({
        repo,
        workId,
        request: `승인된 ${scenario.name}`,
        direct: true,
        explicitSkill: "www-build",
        approval: approvalFor(scenario.verifier),
        writes: ["src/a.ts"],
        surfaces: ["edit"],
        verifier: scenario.verifier,
        execute: true,
        eventId: scenario.name,
        env: { ...process.env, WORKFLOW_MARKER: marker, WORKFLOW_HOST_EXIT: scenario.hostExit },
      }, { runProcess: fixtureRunner() });
      assert.equal(result.verificationSummary?.result, scenario.expected);
      const runtime = await readRuntime(runtimePaths(repo, workId));
      assert.notEqual(runtime.session.status, "done");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }
});

test("승인 배열에 있어도 경로 탈출과 쓰기 symlink는 host 실행 전에 거부한다", async () => {
  const repo = await createRepository();
  const external = await mkdtemp(join(tmpdir(), "www-write-outside-"));
  const check = verifier();
  try {
    assert.equal(preflightMutation({ approval: { implementation: true, writePaths: ["../escape"] }, writes: ["../escape"] }).reason, "unsafe_write_path");
    await symlink(external, join(repo, "outside"));
    const marker = join(repo, "marker.json");
    await assert.rejects(runWorkflow({
      repo, workId, request: "승인된 경로 검사", direct: true, explicitSkill: "www-build",
      approval: { ...approvalFor(check), writePaths: ["outside/new.ts"] },
      writes: ["outside/new.ts"], surfaces: ["edit"], verifier: check, execute: true,
      eventId: "path-escape", env: { ...process.env, WORKFLOW_MARKER: marker },
    }, { runProcess: fixtureRunner() }), /심볼릭 링크/);
    await assert.rejects(access(marker));
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});

test("이벤트 파일 symlink는 외부 파일을 변경하지 않는다", async () => {
  const repo = await mkdtemp(join(tmpdir(), "www-runtime-symlink-"));
  const external = await mkdtemp(join(tmpdir(), "www-runtime-outside-"));
  try {
    const paths = runtimePaths(repo, workId);
    await mkdir(paths.directory, { recursive: true });
    const outside = join(external, "original.txt");
    await writeFile(outside, "보존할 원본");
    await symlink(outside, paths.events);
    await assert.rejects(appendEvent({ repo, workId, event: { id: "escape", type: "status", status: "running" } }), /심볼릭 링크/);
    assert.equal(await readFile(outside, "utf8"), "보존할 원본");
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});

test("과거 검사 통과 뒤 post 실패나 불명확 mutation이 있으면 완료하지 않는다", async () => {
  for (const type of ["post_failure", "mutation_unknown"]) {
    const repo = await mkdtemp(join(tmpdir(), "www-stale-verification-"));
    try {
      await appendEvent({ repo, workId, event: { id: "verified", type: "verification", summary: {
        executed: true, result: "passed", commandHash: "a".repeat(64), exitCode: 0,
        criteriaCoverage: { requiredIds: ["AC-1"], passedIds: ["AC-1"] }, blocked: false,
      } } });
      await appendEvent({ repo, workId, event: { id: "later-failure", type } });
      await assert.rejects(appendEvent({ repo, workId, event: { id: "done", type: "status", status: "done" } }), /실제 verifier/);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }
});

test("BoxBox 작성 안내와 승인 경로를 실제 fixture host 컨텍스트에 전달한다", async () => {
  const repo = await createRepository();
  const check = verifier();
  const marker = join(repo, "marker.json");
  try {
    const directory = join(repo, ".www", "mock-boxbox");
    await mkdir(directory, { recursive: true });
    const launcher = join(directory, "boxbox.mjs");
    await writeFile(launcher, `const args = process.argv.slice(2); const file = args[args.indexOf("--file") + 1]; console.log(JSON.stringify(args[0] === "guide" ? {tool:"boxbox",command:"guide",ok:false,file,columnSets:[{kind:"object-properties",columns:["property-colon","property-value"]}]} : {tool:"boxbox",syntax:{status:"valid"},results:[{summary:{refused:1}}]}));process.exit(args[0] === "guide" ? 1 : 2);\n`);
    const result = await runWorkflow({
      repo, workId, request: "BoxBox 안내로 구현", direct: true, explicitSkill: "www-build",
      approval: approvalFor(check), writes: ["src/a.ts"], surfaces: ["edit"],
      verifier: check, execute: true, eventId: "boxbox-context", boxboxLauncher: launcher,
      boxboxFiles: ["src/a.ts"], env: { ...process.env, WORKFLOW_MARKER: marker },
    }, { runProcess: fixtureRunner() });
    assert.equal(result.verificationSummary.result, "passed");
    const { args } = JSON.parse(await readFile(marker, "utf8"));
    const context = args[args.indexOf("--append-system-prompt") + 1];
    assert.match(context, /approved-write-paths: \["src\/a.ts"\]/);
    assert.match(context, /object-properties/);
    assert.equal(args.at(-2), "--");
    assert.equal(result.boxboxPre[1].outcome, "file_not_created");
    assert.equal(result.boxboxPre[0].approvedGuidance, false);
    assert.equal(result.boxboxPost[0].findings.refused, 1);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("호스트 실행 중 수용 기준이 바뀌면 이전 기준의 검사로 완료하지 않는다", async () => {
  const repo = await createRepository();
  const check = verifier();
  const runner = fixtureRunner();
  try {
    const result = await runWorkflow({
      repo, workId, request: "기준 변경 감지", direct: true, explicitSkill: "www-build",
      approval: approvalFor(check), writes: ["src/a.ts"], surfaces: ["edit"],
      verifier: check, execute: true, eventId: "criteria-drift", stdio: "pipe",
    }, { runProcess: async (invocation, options) => {
      const result = await runner(invocation, options);
      if (invocation.command === "gjc") {
        const file = join(repo, "docs", "work", "Workflow", "001-Fixture", "work.json");
        const work = JSON.parse(await readFile(file, "utf8"));
        work.criteria[0].description = "사용자가 새로 확인해야 할 기준";
        await writeFile(file, `${JSON.stringify(work, null, 2)}\n`);
      }
      return result;
    } });
    assert.match(result.postError, /수용 기준/);
    assert.equal(result.verification, undefined);
    assert.equal((await readRuntime(runtimePaths(repo, workId))).session.postFailure, true);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
