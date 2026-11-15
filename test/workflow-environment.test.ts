/**
 * @verifies RESP-DEVELOPMENT-EXECUTION
 * @verifies RESP-DEVELOPMENT-PROVIDERS-CODEX
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { checkEnvironment, mergeEnvironment } from "../scripts/workflow/environment.ts";
import { createCodexInvocation, runCodex, spawnCodex, waitForCodex } from "../scripts/workflow/adapters/codex.ts";
import { runDevelopmentWorkflow, runProcess, runWorkflow } from "../scripts/workflow/run.ts";
import { readRuntime, runtimePaths } from "../scripts/workflow/record.ts";
import type { EnvironmentOptions } from "../scripts/workflow/environment.ts";

function repository(t: import("node:test").TestContext) {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "www-environment-")));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const git = (args: string[]) => {
    const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "-q"]);
  writeFileSync(path.join(repo, ".gitignore"), ".www/\n");
  git(["add", ".gitignore"]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture"]);
  const options: EnvironmentOptions = { repo, commands: [process.execPath], outputDirectory: ".www/runtime/new", git: { refs: ["HEAD"], trackedIndex: true, fullHistory: true } };
  return { repo, git, options };
}
function failed(report: ReturnType<typeof checkEnvironment>, code: string) {
  assert.equal(report.ok, false);
  assert.ok(report.checks.some((check) => check.code === code && check.status === "failed"), JSON.stringify(report));
}

function developmentFixture(t: import("node:test").TestContext) {
  const fixture = repository(t);
  mkdirSync(path.join(fixture.repo, ".www"));
  writeFileSync(path.join(fixture.repo, ".www/development.local.json"), "{}\n");
  writeFileSync(path.join(fixture.repo, "source-policy.json"), JSON.stringify({ schemaVersion: 1, typecheckProjects: ["tsconfig.json"], legacyJavaScript: [], excludedVendorPaths: ["skill-library/"] }));
  writeFileSync(path.join(fixture.repo, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["src/**/*.ts"] }));
  mkdirSync(path.join(fixture.repo, "src"));
  writeFileSync(path.join(fixture.repo, "src/item.ts"), "export {};\n");
  fixture.git(["add", "."]);
  return fixture;
}

test("legacy 환경 실패는 eventId를 소비하지 않고 수정 후 같은 실행은 정확히 한 번만 시작한다", async (t) => {
  const { repo } = repository(t);
  const workId = "work-11111111-1111-4111-8111-111111111111";
  const work = path.join(repo, "docs/work/Workflow/001-Fixture");
  const skill = path.join(repo, "skills/www/www-build");
  mkdirSync(work, { recursive: true });
  mkdirSync(skill, { recursive: true });
  writeFileSync(path.join(skill, "SKILL.md"), "# fixture build skill\n");
  writeFileSync(path.join(work, "work.json"), JSON.stringify({
    schemaVersion: 1, id: workId, title: "환경 복구", kind: "bug", areas: ["dev"], owner: "dev",
    status: "ready", blockedReason: null, relations: [],
    criteria: [{ id: "ENV", description: "실행 횟수 보존", required: true, result: "unverified", evidence: [] }],
  }));
  const verifier = { command: process.execPath, args: ["-e", "process.exit(0)"], criteria: { ENV: "passed" } };
  const options = {
    repo, workId, request: "환경을 복구하고 실행한다", direct: true, explicitSkill: "www-build", execute: true,
    eventId: "same-environment-execution", verifier,
    approval: { implementation: true, writePaths: [], mutationSurfaces: [], verifierCommands: [JSON.stringify([verifier.command, ...verifier.args])] },
  };
  const counter = path.join(repo, ".www/host-count");
  const dependencies = { runProcess: (invocation: import("../scripts/workflow/adapters/gjc.ts").ProcessInvocation, context: import("../scripts/workflow/adapters/gjc.ts").ProcessOptions) =>
    runProcess(invocation.command === "gjc"
      ? { command: process.execPath, args: ["-e", `require('node:fs').appendFileSync(${JSON.stringify(counter)},'1')`] }
      : invocation, context) };
  const blocked = await runWorkflow({ ...options, env: { PATH: "" } }, dependencies);
  assert.equal(blocked.executed, false);
  assert.equal(blocked.host?.outcome, "environment_failed");
  assert.throws(() => readFileSync(counter, "utf8"), { code: "ENOENT" });
  const untouched = await readRuntime(runtimePaths(repo, workId));
  assert.equal(untouched.events.length, 0);
  const successful = await runWorkflow(options, dependencies);
  assert.equal(successful.executed, true);
  assert.equal(readFileSync(counter, "utf8"), "1");
  assert.equal(successful.verificationSummary?.result, "passed");
  const duplicate = await runWorkflow(options, dependencies);
  assert.equal(duplicate.executed, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(readFileSync(counter, "utf8"), "1");
  const completed = await readRuntime(runtimePaths(repo, workId));
  assert.equal(completed.events.filter((event) => event.id === options.eventId).length, 1);
});

test("기본 개발환경 CLI와 함수는 정상 fixture를 허용하고 신규 installer JS 17개를 차단한다", async (t) => {
  const { repo } = developmentFixture(t);
  const cli = path.resolve("scripts/check-environment.ts");
  const invoke = () => spawnSync(process.execPath, [cli], { cwd: repo, encoding: "utf8" });
  const healthy = invoke();
  assert.equal(healthy.status, 0, healthy.stdout + healthy.stderr);
  const environment = await import("../scripts/workflow/environment.ts");
  assert.ok("checkDevelopmentEnvironment" in environment && typeof environment.checkDevelopmentEnvironment === "function");
  const previous = process.cwd();
  try {
    process.chdir(repo);
    assert.equal((await environment.checkDevelopmentEnvironment()).ok, true);
    for (let i = 0; i < 17; i++) writeFileSync(path.join(repo, `installer${i}.js`), "console.log('installer');\n");
    const report = await environment.checkDevelopmentEnvironment();
    failed(report, "source_policy");
    assert.equal(report.checks.filter((check: { code: string; status: string }) => check.code === "source_policy" && check.status === "failed").length, 1);
  } finally { process.chdir(previous); }
  const blocked = invoke();
  assert.equal(blocked.status, 1);
  const report: unknown = JSON.parse(blocked.stdout);
  assert.ok(report && typeof report === "object" && "checks" in report && Array.isArray(report.checks));
  const policy = report.checks.find((check) => check.code === "source_policy");
  assert.equal(policy.status, "failed");
  for (let i = 0; i < 17; i++) assert.match(policy.message, new RegExp(`installer${i}\\.js`));
});

test("verify intent는 선언 환경 실패 시 실제 verifier 0회, 정상 환경에서 1회 실행하고 증거를 기록한다", async (t) => {
  const { repo } = developmentFixture(t);
  mkdirSync(path.join(repo, "docs/work"), { recursive: true });
  writeFileSync(path.join(repo, "docs/work/INDEX.md"), "# 작업 목차\n");
  const counter = path.join(repo, ".www/verifier-count");
  const args = ["--input-type=module", "-e", `import {appendFileSync} from 'node:fs';appendFileSync(${JSON.stringify(counter)},'1');`];
  const options = {
    repo, role: "www-dev", direct: true, execute: true, request: "환경을 검사해줘", requestId: "environment-verifier", eventId: "verify-environment",
    decision: { intent: "verify", area: "Workflow", title: "환경 검사", criteria: [{ id: "ENV", description: "실제 verifier 실행", required: true }] },
    approval: { implementation: true, writePaths: ["src/item.ts"], mutationSurfaces: ["repo_write"], verifierCommands: [JSON.stringify([process.execPath, ...args])], commit: false, publish: false },
    inputs: ["src"], verifier: { command: process.execPath, args, criterionIds: ["ENV"] },
  };
  for (const environment of [{ git: { refs: ["missing-ref"], trackedIndex: true, fullHistory: true } }, { toolPaths: [".www/missing.json"] }]) {
    const result = await runDevelopmentWorkflow({ ...options, environment });
    assert.equal(result.executed, false);
    assert.equal(result.host?.outcome, "environment_failed");
    assert.match(result.host?.error ?? "", /검증.*실행하지/);
    assert.equal(result.environment?.ok, false);
    assert.equal(readdirSync(path.join(repo, ".www")).includes("verifier-count"), false);
  }
  // 모델용 빈 PATH override는 verifier에 전달되지 않으므로 진단도 부모 환경을 따른다.
  const result = await runDevelopmentWorkflow({ ...options, env: { PATH: "" }, environment: { git: { refs: ["HEAD"], trackedIndex: true, fullHistory: true }, toolPaths: [".www/development.local.json"] } });
  assert.equal(result.executed, true);
  assert.equal(readFileSync(counter, "utf8"), "1");
  assert.ok(result.verification && "source" in result.verification && result.verification.exitCode === 0);
  await assert.rejects(runDevelopmentWorkflow({ ...options, verifier: { ...options.verifier, args: ["-e", "process.exit(0)"] } }), /허용하지 않은 검증 명령/);
  assert.equal(readFileSync(counter, "utf8"), "1");
});

test("기본 테스트 실행기는 환경 Node API 파일을 실제 Node 프로세스로 분류한다", (t) => {
  const { repo } = repository(t);
  mkdirSync(path.join(repo, "scripts"));
  mkdirSync(path.join(repo, "test"));
  const runner = readFileSync(path.resolve("scripts/test.ts"), "utf8");
  writeFileSync(path.join(repo, "scripts/test.ts"), runner);
  const registrations = runner.split("const nodeTests = new Set([")[1]?.split("].map")[0] ?? "";
  const names = [...registrations.matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
  const witness = "import test from 'node:test';import assert from 'node:assert/strict';test('Node 실제 실행',()=>assert.equal(process.versions.bun,undefined));\n";
  for (const name of new Set([...names, "workflow-environment"])) writeFileSync(path.join(repo, "test", `${name}.test.ts`), witness);
  const result = spawnSync(process.execPath, [path.join(repo, "scripts/test.ts")], { cwd: repo, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /bun:test:/);
  assert.match(result.stdout, /node:test:/);
});

test("상속 PATH를 유지하고 overrides만 병합하며 진단은 파일을 만들지 않는다", (t) => {
  const { repo, options } = repository(t);
  const before = readdirSync(repo);
  const env = mergeEnvironment({ WWW_FIXTURE: "override" });
  assert.equal(env.PATH, process.env.PATH);
  assert.equal(env.WWW_FIXTURE, "override");
  assert.equal(checkEnvironment({ ...options, env: { WWW_FIXTURE: "override" } }).ok, true);
  assert.deepEqual(readdirSync(repo), before);
  failed(checkEnvironment({ ...options, commands: ["missing-www-executable"] }), "executable");
  failed(checkEnvironment({ ...options, commands: ["codex"], env: { PATH: "" } }), "path");
  assert.equal(mergeEnvironment({ PATH: undefined }, { PATH: "inherited" }).PATH, "inherited");
});

test("unknown 설정과 CLI는 알 수 없는 옵션·잘못된 타입을 structured 실패로 반환한다", (t) => {
  const { options } = repository(t);
  for (const override of [{ unknown: true }, { git: { unknown: true } }, { commands: 1 }, { env: { PATH: 2 } }, { outputDirectory: null }, { repo: "relative" }]) failed(checkEnvironment({ ...options, ...override }), "configuration");
  const cli = path.resolve("scripts/check-environment.ts");
  for (const args of [["{"], [JSON.stringify({ ...options, unknown: true })], ["--unknown"], ["{}", "{}"]]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
    assert.equal(result.status, 1);
    const report: unknown = JSON.parse(result.stdout);
    assert.ok(report !== null && typeof report === "object" && "ok" in report && report.ok === false);
  }
  const valid = spawnSync(process.execPath, [cli, JSON.stringify(options)], { encoding: "utf8" });
  assert.equal(valid.status, 0, valid.stderr);
});

test("Git ref·tracked index·얕은 이력의 실패를 독립적으로 진단한다", (t) => {
  const { repo, git, options } = repository(t);
  failed(checkEnvironment({ ...options, git: { refs: ["missing-ref"] } }), "git_ref");
  failed(checkEnvironment({ ...options, git: { refs: ["--help"] } }), "git_ref");
  const head = git(["rev-parse", "HEAD"]);
  writeFileSync(path.join(repo, ".git/shallow"), `${head}\n`);
  failed(checkEnvironment(options), "git_history");
  rmSync(path.join(repo, ".git/shallow"));
  git(["read-tree", "--empty"]);
  failed(checkEnvironment(options), "git_index");
});

test("설치물·출력 Git 제외·경로탈출·파일 부모를 읽기 전용으로 검사한다", (t) => {
  const { repo, git, options } = repository(t);
  const tool = path.join(repo, "installer.ts");
  writeFileSync(tool, "export {};\n");
  failed(checkEnvironment({ ...options, toolPaths: [tool] }), "installation");
  mkdirSync(path.join(repo, ".www"));
  writeFileSync(path.join(repo, ".www/tool.ts"), "export {};\n");
  assert.equal(checkEnvironment({ ...options, toolPaths: [".www/tool.ts"] }).ok, true);
  git(["add", "-f", ".www/tool.ts"]);
  failed(checkEnvironment({ ...options, toolPaths: [".www/tool.ts"] }), "installation");
  git(["rm", "--cached", ".www/tool.ts"]);
  if (process.platform !== "win32" && process.getuid?.() !== 0) {
    const readOnly = path.join(repo, ".www/readonly");
    mkdirSync(readOnly);
    chmodSync(readOnly, 0o555);
    try { failed(checkEnvironment({ ...options, outputDirectory: ".www/readonly/child" }), "output_writable"); }
    finally { chmodSync(readOnly, 0o755); }
  }
  failed(checkEnvironment({ ...options, toolPaths: ["absent.ts"] }), "installation");
  failed(checkEnvironment({ ...options, outputDirectory: "public-output" }), "output_policy");
  failed(checkEnvironment({ ...options, outputDirectory: "../escape" }), "output_policy");
  writeFileSync(path.join(repo, ".www/file"), "file");
  failed(checkEnvironment({ ...options, outputDirectory: ".www/file/child" }), "output_writable");
  failed(checkEnvironment({ ...options, outputDirectory: ".www/file" }), "output_writable");
  symlinkSync(path.join(repo, "absent-directory"), path.join(repo, ".www/broken"), "dir");
  failed(checkEnvironment({ ...options, outputDirectory: ".www/broken/output" }), "output_writable");
  symlinkSync(tmpdir(), path.join(repo, ".www/escape"), "dir");
  failed(checkEnvironment({ ...options, outputDirectory: ".www/escape/output" }), "output_policy");
});

test("실제 기본 실행 경로는 빈 PATH 사전검사 실패 시 호스트를 시작하지 않는다", async (t) => {
  const { repo } = repository(t);
  const result = await runProcess({ command: "codex", mode: "codex-exec", args: [], stdin: "fixture" }, { cwd: repo, env: { PATH: "" }, outputDirectory: path.join(repo, ".www/runtime") });
  assert.equal(result.ok, false);
  assert.equal(result.outcome, "environment_failed");
  assert.equal(result.code, null);
  assert.equal(result.environment?.ok, false);
  assert.equal(readdirSync(repo).includes(".www"), false);
});

async function subprocess(t: import("node:test").TestContext, mode: string, missingOutput = false) {
  const { repo } = repository(t);
  const outputDirectory = path.join(repo, ".www/runtime");
  if (!missingOutput) mkdirSync(outputDirectory, { recursive: true });
  const script = path.join(repo, "fixture.ts");
  writeFileSync(script, `
for await (const chunk of process.stdin) {}
const emit = (value) => process.stdout.write(JSON.stringify(value) + '\\n');
emit({type:'thread.started',thread_id:'fixture-thread'});
emit({type:'turn.started'});
emit({type:'fixture.environment',pathPresent:Boolean(process.env.PATH),override:process.env.WWW_FIXTURE});
const body = '출력\\"\\\\\\n'.repeat(300000);
emit({type:'item.completed',item:{type:'command_execution',aggregated_output:body}});
if (${JSON.stringify(mode)} === 'error') emit({type:'error',message:body});
if (${JSON.stringify(mode)} === 'malformed') {
  const raw = JSON.stringify({type:'item.completed',text:'x'.repeat(1100000)});
  process.stdout.write(raw.slice(0,-2) + String.fromCharCode(92) + 'q"}\\n');
}
if (${JSON.stringify(mode)} === 'many') for(let i=0;i<1100;i++) emit({type:'item.completed',item:{id:i}});
emit({type:'turn.completed',usage:{input_tokens:23,output_tokens:17,cached_input_tokens:4}});
process.stderr.write('stderr 원문');
`);
  const invocation = createCodexInvocation({ repo, systemPrompt: "fixture", request: "fixture" });
  const result = await runCodex({ ...invocation, command: process.execPath, args: [script] }, { cwd: repo, env: { WWW_FIXTURE: "forwarded" }, captureOutput: true, outputDirectory });
  return { result, outputDirectory };
}

test("1MiB 초과 JSONL 원문은 완전 spool하고 bounded 요약 뒤 완료와 실제 usage를 관측한다", async (t) => {
  const { result } = await subprocess(t, "many");
  assert.equal(result.ok, true, result.error ?? "");
  assert.equal(result.turnCompleted, true);
  assert.ok(result.events.some((event) => event.type === "fixture.environment" && event.pathPresent === true && event.override === "forwarded"));
  assert.deepEqual(result.usage, { input_tokens: 23, output_tokens: 17, cached_input_tokens: 4 });
  assert.equal(result.summaryTruncated, true);
  assert.equal(result.rawOutputTruncated, false);
  assert.ok(result.events.length <= 1000);
  assert.ok(result.events.some((event) => event.summaryTruncated === true));
  assert.ok(Buffer.byteLength(result.stdout) <= 1_048_576);
  assert.ok(result.outputFiles);
  const raw = readFileSync(result.outputFiles.stdout.path);
  assert.ok(raw.length > 1_048_576);
  assert.equal(raw.length, result.outputFiles.stdout.bytes);
  const lines: unknown[] = raw.toString("utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(lines.length > 1100);
  const command = lines.find((event) => event !== null && typeof event === "object" && "item" in event);
  assert.ok(command !== null && typeof command === "object" && "item" in command);
  assert.ok(command.item !== null && typeof command.item === "object" && "aggregated_output" in command.item);
  assert.equal(typeof command.item.aggregated_output, "string");
  assert.ok(typeof command.item.aggregated_output === "string" && command.item.aggregated_output.length > 1_048_576);
  assert.match(raw.toString("utf8"), /turn.completed/);
  assert.equal(statSync(result.outputFiles.stdout.path).mode & 0o777, 0o600);
  assert.equal(readFileSync(result.outputFiles.stderr.path, "utf8"), "stderr 원문");
});

test("직접 Codex 호출은 원문 출력 경로가 없으면 사용자 본문을 쓰거나 호스트를 시작하지 않는다", async (t) => {
  const { repo } = repository(t);
  const marker = path.join(repo, "host-started");
  const invocation = createCodexInvocation({ repo, systemPrompt: "private fixture", request: "private fixture" });
  const script = `require('node:fs').writeFileSync(${JSON.stringify(marker)},'started');process.stdout.write(JSON.stringify({type:'item.completed',item:{text:'x'.repeat(1100000)}})+'\\n')`;
  await assert.rejects(runCodex({ ...invocation, command: process.execPath, args: ["-e", script] }, { cwd: repo, captureOutput: true }), /outputDirectory|원문.*출력/);
  assert.throws(() => spawnCodex({ ...invocation, command: process.execPath, args: ["-e", script] }), /outputDirectory|원문.*출력/);
  assert.throws(() => readFileSync(marker), { code: "ENOENT" });
  assert.equal(readdirSync(repo).includes(".www"), false);
});

test("직접 Codex는 읽기 전용 비Git cwd를 변경하지 않고 명시한 출력에 원문과 usage를 보존한다", async (t) => {
  const cwd = realpathSync(mkdtempSync(path.join(tmpdir(), "www-codex-readonly-")));
  const outputDirectory = realpathSync(mkdtempSync(path.join(tmpdir(), "www-codex-output-")));
  t.after(() => { chmodSync(cwd, 0o700); rmSync(cwd, { recursive: true, force: true }); rmSync(outputDirectory, { recursive: true, force: true }); });
  if (process.platform !== "win32") chmodSync(cwd, 0o500);
  const invocation = createCodexInvocation({ repo: cwd, systemPrompt: "fixture", request: "fixture" });
  const script = `for(const event of [{type:'thread.started',thread_id:'direct-fixture'},{type:'item.completed',item:{text:'x'.repeat(1100000)}},{type:'turn.completed',usage:{input_tokens:7,output_tokens:3}}])process.stdout.write(JSON.stringify(event)+'\\n')`;
  const child = spawnCodex({ ...invocation, command: process.execPath, args: ["-e", script] }, { cwd, outputDirectory });
  const result = await waitForCodex(child, { captureOutput: false });
  assert.equal(result.ok, true, result.error ?? "");
  assert.equal(result.stdout, "");
  assert.equal(result.rawOutputTruncated, false);
  assert.equal(result.summaryTruncated, true);
  assert.equal(result.turnCompleted, true);
  assert.deepEqual(result.usage, { input_tokens: 7, output_tokens: 3 });
  assert.ok(result.outputFiles);
  assert.ok(readFileSync(result.outputFiles.stdout.path).length > 1_048_576);
  assert.equal(statSync(result.outputFiles.stdout.path).mode & 0o777, 0o600);
  assert.deepEqual(readdirSync(cwd), []);
});

test("직접 Codex는 Git에 노출되는 출력과 등록되지 않은 waiter를 거부한다", async (t) => {
  const { repo } = repository(t);
  const outputDirectory = path.join(repo, "public-output");
  mkdirSync(outputDirectory);
  const marker = path.join(repo, "started");
  const invocation = createCodexInvocation({ repo, systemPrompt: "fixture", request: "fixture" });
  await assert.rejects(runCodex({ ...invocation, command: process.execPath, args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)},'1')`] }, { outputDirectory }), /Git 제외/);
  assert.throws(() => readFileSync(marker), { code: "ENOENT" });
  assert.deepEqual(readdirSync(outputDirectory), []);
  const child = spawn(process.execPath, ["-e", "setTimeout(()=>process.exit(0),100)"]);
  const exit = new Promise((resolve) => child.once("exit", resolve));
  await assert.rejects(waitForCodex(child, { outputDirectory }), /spawnCodex/);
  assert.equal(child.killed, false);
  await exit;
});

test("큰 오류 사건은 숨기지 않고 원문 경로 생성 실패는 시작 전에 거부한다", async (t) => {
  const error = (await subprocess(t, "error")).result;
  assert.equal(error.ok, false);
  assert.equal(error.outcome, "host_error");
  assert.equal(error.turnCompleted, true);
  const malformed = (await subprocess(t, "malformed")).result;
  assert.equal(malformed.ok, false);
  assert.equal(malformed.outcome, "protocol_error");
  assert.equal(malformed.turnCompleted, true);
  await assert.rejects(subprocess(t, "normal", true), /ENOENT|원문/);
});


test("일반 프로세스 경로도 stdout·stderr 원문을 보존하고 메모리 요약만 제한한다", async (t) => {
  const { repo } = repository(t);
  const outputDirectory = path.join(repo, ".www/runtime");
  mkdirSync(outputDirectory, { recursive: true });
  const result = await runProcess({ command: process.execPath, args: ["-e", "process.stdout.write('x'.repeat(1200000));process.stderr.write('fixture stderr')"] }, { cwd: repo, captureOutput: true, outputDirectory });
  assert.equal(result.ok, true);
  assert.equal(result.summaryTruncated, true);
  assert.equal(result.rawOutputTruncated, false);
  assert.ok(Buffer.byteLength(result.stdout ?? "") <= 1_048_576);
  assert.ok(result.outputFiles);
  assert.equal(readFileSync(result.outputFiles.stdout.path).length, 1200000);
  assert.equal(readFileSync(result.outputFiles.stderr.path, "utf8"), "fixture stderr");
});
