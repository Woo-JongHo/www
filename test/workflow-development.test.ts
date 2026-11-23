/**
 * @verifies RESP-DEVELOPMENT-EXECUTION
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { readRuntime, replayEvents, runtimePaths } from "../scripts/workflow/record.ts";
import { runDevelopmentWorkflow } from "../scripts/workflow/run.ts";
import { completeWork, readWork } from "../scripts/workflow/work.ts";

import type { ProcessInvocation } from "../scripts/workflow/adapters/gjc.ts";
import type { ModelAllocation } from "../scripts/workflow/model-allocation.ts";

const exec         = promisify(execFile)                                                                              ;
const projectRoot  = dirname(dirname(fileURLToPath(import.meta.url)))                                                 ;
const contextFiles = ["AGENTS.md", "agents/www/AGENT.md", "docs/skills/WORKFLOW.md", "skills/www/www-build/SKILL.md"] ;

async function repository(t: import("node:test").TestContext) {
  const repo = await mkdtemp(join(tmpdir(), "www-development-coordinator-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  for (const directory of ["agents/www", "docs/skills", "docs/work", "docs/specs", "skills/www/www-build", "src", "checks"]) await mkdir(join(repo, directory), { recursive: true });
  await Promise.all([...contextFiles, "agents/www/review-policy.json"].map((file) => copyFile(join(projectRoot, file), join(repo, file))));
  await Promise.all([
    writeFile(join(repo, ".gitignore"), ".www/\n"),
    writeFile(join(repo, "docs/work/INDEX.md"), "# 작업 목차\n"),
    writeFile(join(repo, "docs/specs/chat.md"), '# Chat fixture 요구\n\n<a id="CHAT-FIXTURE-01"></a>\n허용된 변경 결과를 검사한다.\n'),
    writeFile(join(repo, "src/item.ts"), "export const value = 1;\n"),
    writeFile(join(repo, "checks/verify.ts"), "import assert from 'node:assert/strict';\nimport { value } from '../src/item.ts';\nassert.equal(value, 2);\n"),
  ]);
  await exec("git", ["init", "-q"], { cwd: repo });
  await exec("git", ["config", "user.name", "개발 연결 Fixture"], { cwd: repo });
  await exec("git", ["config", "user.email", "development-fixture@example.invalid"], { cwd: repo });
  await exec("git", ["add", "."], { cwd: repo });
  await exec("git", ["commit", "-qm", "테스트 기준선"], { cwd: repo });
  return realpath(repo);
}

function request(repo: string, overrides: object = {}) {
  const args = ["checks/verify.ts"];
  return {
    repo,
    role      : "www-dev"                                   ,
    direct    : true                                        ,
    request   : "Chat 표시의 작은 변경을 구현하고 검사해줘" ,
    requestId : "fixture-request-1"                         ,
    eventId   : "fixture-execution-1"                       ,
    decision : {
      intent: "build", area: "Chat", title: "허용된 변경의 실행 연결", kind: "maintenance", areas: ["ui", "dev"], owner: "dev",
      criteria: [{ id: "AC-1", description: "허용된 파일의 결과가 기대값 2다", required: true, requirementRefs: ["docs/specs/chat.md#CHAT-FIXTURE-01"] }],
    },
    approval : {
      implementation   : true                                          ,
      writePaths       : ["src/item.ts"]                               ,
      mutationSurfaces : ["edit"]                                      ,
      verifierCommands : [JSON.stringify([process.execPath, ...args])] ,
      commit           : false                                         ,
      publish          : false                                         ,
    },
    inputs   : ["src", "checks"]                                           ,
    writes   : ["src/item.ts"]                                             ,
    surfaces : ["edit"]                                                    ,
    verifier : { command: process.execPath, args, criterionIds: ["AC-1"] } ,
    execute  : true                                                        ,
    ...overrides,
  };
}

function hostResult(overrides: object = {}) {
  return { ok: true, code: 0, signal: null, error: null, outcome: "passed", stdout: "coordinator fixture only", stderr: "", outputTruncated: false, threadId: "fixture-host-thread", events: [], ...overrides };
}

test("주입 호스트 fixture로 일반 요청을 신규 UUID·자동 선택 스킬·실제 verifier에 연결한다", async (t) => {
  const repo    = await repository(t)         ;
  let calls     = 0                           ;
  let received: ProcessInvocation | undefined ;
  const options = request(repo)               ;
  const result = await runDevelopmentWorkflow(options, { runProcess: async (invocation, processOptions) => {
    calls += 1;
    received = invocation;
    assert.equal(processOptions.cwd, repo);
    assert.equal(invocation.mode, "codex-exec");
    await writeFile(join(repo, "src/item.ts"), "export const value = 2;\n");
    return hostResult();
  } });
  assert.equal(calls, 1);
  assert.equal(result.executed, true);
  assert.ok(result.route && "skill" in result.route);
  assert.equal(result.route.skill, "www-build");
  assert.ok(result.route);
  assert.equal(result.route.reason, "development_role_selection");
  assert.ok(result.workId);
  assert.match(result.workId, /^work-[a-f0-9-]+$/);
  assert.ok(received?.stdin);
  assert.ok(result.workId);
  assert.ok(received.stdin.includes(result.workId));
  assert.ok(received.stdin.includes(options.request));
  assert.ok(received.stdin.includes("www-dev"));
  assert.ok(received.stdin.includes('"writePaths":["src/item.ts"]'));
  assert.ok(!received.args.includes(options.request));
  assert.ok(result.sources);
  assert.deepEqual(result.sources.map((source) => source.path), [...contextFiles, "agents/www/review-policy.json"]);
  assert.ok(result.sources);
  for (const source of result.sources) {
    const content = await readFile(join(repo, source.path));
    assert.equal(source.hash, createHash("sha256").update(content).digest("hex"));
    assert.ok(received.stdin.includes(source.hash));
  }
  assert.ok(result.verification && "result" in result.verification);
  assert.equal(result.verification.executor, "process");
  assert.ok(result.verification && "result" in result.verification);
  assert.equal(result.verification.exitCode, 0);
  assert.ok(result.verification && "result" in result.verification);
  assert.equal(result.verification.result, "passed");
  assert.ok(result.workId);
  const work = await readWork({ repo, workId: result.workId });
  assert.equal(work.record.schemaVersion, 2);
  assert.equal(work.record.criteria[0].result, "passed");
  assert.ok(result.verification && "result" in result.verification);
  assert.equal(work.record.criteria[0].evidence[0].attemptId, result.verification.id);
  assert.equal(work.record.status, "verifying");
  assert.equal(work.record.schemaVersion, 2);
  assert.equal(work.record.workflow.nextAction, "review");
  assert.equal(work.record.schemaVersion, 2);
  assert.equal(work.record.workflow.authorization.commit, false);
  assert.equal(work.record.schemaVersion, 2);
  assert.equal(work.record.workflow.authorization.publish, false);
  assert.ok(result.workId);
  const runtime = await readRuntime(runtimePaths(repo, result.workId));
  assert.equal(runtime.session.status, "completed");
  assert.ok(runtime.events.some((event) => event.type === "host_result" && event.injected === true));
  assert.ok(result.workId);
  await assert.rejects(completeWork({ repo, workId: result.workId }), /독립 검토|현재 증거/);
  assert.ok(result.workId);
  assert.equal((await readWork({ repo, workId: result.workId })).record.status, "verifying");
  assert.equal((await readdir(join(repo, "docs/work/Chat"))).length, 1);
});

test("인용 요청·정보 질문·preview는 호스트 실행이나 작업 생성을 하지 않는다", async (t) => {
  const repo         = await repository(t)                                              ;
  let calls          = 0                                                                ;
  const dependencies = { runProcess: async () => { calls += 1; return hostResult(); } } ;
  await assert.rejects(runDevelopmentWorkflow(request(repo, { direct: false }), dependencies), /직접 요청/);
  const answer = await runDevelopmentWorkflow(request(repo, { decision: { intent: "answer" }, request: "이 구조를 설명해줘" }), dependencies);
  assert.equal(answer.executed, false);
  assert.ok(answer.route);
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
  const repo   = await repository(t)                                                                                                                           ;
  let calls    = 0                                                                                                                                             ;
  const result = await runDevelopmentWorkflow(request(repo, { writes: ["src/outside.ts"] }), { runProcess: async () => { calls += 1; return hostResult(); } }) ;
  assert.equal(result.executed, false);
  assert.ok(result.mutation);
  assert.equal(result.mutation.ok, false);
  assert.ok(result.mutation);
  assert.equal(result.mutation.reason, "outside_approval");
  assert.ok(result.mutation);
  assert.deepEqual(result.mutation.deniedWrites, ["src/outside.ts"]);
  assert.equal(calls, 0);
  assert.equal(await readFile(join(repo, "src/item.ts"), "utf8"), "export const value = 1;\n");
});

test("같은 사건 ID의 재실행은 같은 UUID를 반환하고 호스트를 다시 실행하지 않는다", async (t) => {
  const repo         = await repository(t)                                              ;
  let calls          = 0                                                                ;
  const options      = request(repo, { verifier: undefined })                           ;
  const dependencies = { runProcess: async () => { calls += 1; return hostResult(); } } ;
  const first        = await runDevelopmentWorkflow(options, dependencies)              ;
  const repeated     = await runDevelopmentWorkflow(options, dependencies)              ;
  assert.equal(repeated.executed, false);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.workId, first.workId);
  assert.equal(calls, 1);
  assert.equal((await readdir(join(repo, "docs/work/Chat"))).length, 1);
  assert.ok(first.workId);
  assert.equal((await readWork({ repo, workId: first.workId })).record.status, "in_progress");
});

test("주입 호스트 성공 뒤 실제 verifier 실패는 같은 작업의 실패와 수정 단계를 남긴다", async (t) => {
  const repo   = await repository(t)                                                                   ;
  const result = await runDevelopmentWorkflow(request(repo), { runProcess: async () => hostResult() }) ;
  assert.ok(result.host);
  assert.equal(result.host.ok, true);
  assert.ok(result.verification && "result" in result.verification);
  assert.equal(result.verification.executor, "process");
  assert.ok(result.verification && "result" in result.verification);
  assert.equal(result.verification.result, "failed");
  assert.ok(result.verification && "result" in result.verification);
  assert.notEqual(result.verification.exitCode, 0);
  assert.ok(result.workId);
  const work = await readWork({ repo, workId: result.workId });
  assert.equal(work.record.criteria[0].result, "failed");
  assert.equal(work.record.schemaVersion, 2);
  assert.equal(work.record.workflow.nextAction, "build");
  assert.equal(work.record.status, "verifying");
  assert.equal(work.record.schemaVersion, 2);
  assert.equal(work.record.workflow.verifications.length, 1);
  assert.ok(result.verification && "result" in result.verification);
  assert.ok((await readFile(join(dirname(work.path), "verification.md"), "utf8")).includes(result.verification.id));
  assert.ok(result.workId);
  assert.equal((await readRuntime(runtimePaths(repo, result.workId))).session.status, "completed");
});

test("같은 작업의 실행 잠금이 있으면 두 번째 호스트 실행을 거부한다", async (t) => {
  const repo    = await repository(t)                                                                ;
  let release     : (() => void) | undefined                                                         ;
  let enter       : (() => void) | undefined                                                         ;
  let rejectEnter : ((reason?: unknown) => void) | undefined                                         ;
  let calls     = 0                                                                                  ;
  const started = new Promise<void>((resolve, reject) => { enter = resolve; rejectEnter = reject; }) ;
  const gate    = new Promise<void>((resolve) => { release = resolve; })                             ;
  const options = request(repo, { verifier: undefined })                                             ;
  const first = runDevelopmentWorkflow(options, { runProcess: async () => {
    calls += 1;
    assert.ok(enter);
    enter();
    await gate;
    return hostResult();
  } });
  first.catch(rejectEnter);
  await started;
  try {
    await assert.rejects(runDevelopmentWorkflow({ ...options, eventId: "fixture-execution-2" }, { runProcess: async () => { calls += 1; return hostResult(); } }), /실행 중|잠금/);
    assert.equal(calls, 1);
  } finally { assert.ok(release); release(); }
  const result = await first;
  assert.ok(result.workId);
  await assert.rejects(access(join(repo, ".www/runtime", result.workId, "execution.lock")));
});

test("개발 역할은 읽기 전용·작업 폴더 sandbox만 선택하고 전체 권한 확대를 거부한다", async (t) => {
  for (const sandbox of ["read-only", "workspace-write"]) {
    const repo   = await repository(t)                                                                                                                                                  ;
    let received: ProcessInvocation | undefined                                                                                                                                         ;
    const result = await runDevelopmentWorkflow(request(repo, { sandbox, verifier: undefined }), { runProcess: async (invocation) => { received = invocation; return hostResult(); } }) ;
    assert.equal(result.executed, true);
    assert.ok(received);
    assert.equal(received.args[received.args.indexOf("--sandbox") + 1], sandbox);
  }
  const repo = await repository(t) ;
  let calls  = 0                   ;
  await assert.rejects(runDevelopmentWorkflow(request(repo, { sandbox: "danger-full-access" }), { runProcess: async () => { calls += 1; return hostResult(); } }), /read-only|workspace-write/);
  assert.equal(calls, 0);
});

function allocation(overrides: object = {}): ModelAllocation {
  return {
    taskId: "fixture-task", ownerModel: "gpt-6.1-sol", kind: "small_implementation", risk: "low", model: "gpt-6-luna",
    reason: "반복되는 작은 구현", inputs: ["src"], writePaths: ["src/item.ts"], dependencies: [], attempt: 1, ...overrides,
  };
}

test("단일 Luna 배분은 실제 호출 인자·축소 컨텍스트와 관측 없는 영수증에 연결된다", async (t) => {
  const repo = await repository(t);
  let received: ProcessInvocation | undefined;
  const result = await runDevelopmentWorkflow(request(repo, { allocation: allocation(), verifier: undefined, executor: "process" }), { runProcess: async invocation => {
    received = invocation;
    return hostResult({ usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 30 }, observedModel: "fixture-is-not-observation" });
  } });
  assert.ok(received);
  assert.equal(received.args[received.args.indexOf("--model") + 1], "gpt-6-luna");
  assert.ok(received.stdin?.includes('실행 입력 범위: ["src"]'));
  assert.ok(received.stdin?.includes('"taskId":"fixture-task"'));
  assert.equal(result.executor, "injected");
  assert.equal(result.modelExecution?.requested.model, "gpt-6-luna");
  assert.deepEqual(result.modelExecution?.observed, { model: null, reason: "injected_execution" });
  assert.deepEqual(result.modelExecution?.accounting, { scope: "task", attempts: 1, missingUsageAttempts: 0, usageByField: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 30 }, excludedFields: [], partialAggregation: false });
  assert.equal(typeof result.receiptPath, "string");
  assert.ok(typeof result.receiptPath === "string");
  const receipt: unknown = JSON.parse(await readFile(join(repo, result.receiptPath), "utf8"));
  assert.ok(receipt && typeof receipt === "object" && "modelExecution" in receipt);
  assert.deepEqual(receipt.modelExecution, result.modelExecution);
  assert.ok(result.workId);
  assert.equal((await readWork({ repo, workId: result.workId })).record.status, "in_progress");
});

test("실패·상향·정상 인계 사용량은 같은 task의 시도 전체를 합산하며 누락을 보존한다", async (t) => {
  const repo = await repository(t);
  const first = await runDevelopmentWorkflow(request(repo, { allocation: allocation(), verifier: undefined }), { runProcess: async () => hostResult({ ok: false, code: 1, outcome: "host_error", error: "모델 품질 실패 fixture", usage: { input_tokens: 100, output_tokens: 10 } }) });
  assert.equal(first.modelExecution?.failure?.outcome, "host_error");
  const second = await runDevelopmentWorkflow(request(repo, {
    eventId: "fixture-retry", verifier: undefined,
    allocation: allocation({ attempt: 2, model: "gpt-6.1-terra", previousAttempt: { eventId: "fixture-execution-1", reason: "작은 단위에서도 품질 오류가 재현됨", kind: "retry", failureCause: "quality" } }),
  }), { runProcess: async () => hostResult({ usage: { input_tokens: 40, output_tokens: 20 } }) });
  assert.deepEqual(second.modelExecution?.accounting.usageByField, { input_tokens: 140, output_tokens: 30 });
  const third = await runDevelopmentWorkflow(request(repo, {
    eventId: "fixture-handoff", verifier: undefined,
    allocation: allocation({ attempt: 3, model: "gpt-6.1-sol", kind: "integration", previousAttempt: { eventId: "fixture-retry", reason: "성공한 부분 구현을 통합 책임자에게 인계", kind: "handoff" } }),
  }), { runProcess: async () => hostResult() });
  assert.equal(third.workId, first.workId);
  assert.deepEqual(third.modelExecution?.accounting, { scope: "task", attempts: 3, missingUsageAttempts: 1, usageByField: { input_tokens: 140, output_tokens: 30 }, excludedFields: [], partialAggregation: true });
  assert.equal(third.modelExecution?.usage, null);
  assert.equal(third.modelExecution?.failure, null);
});

test("모델 배분은 권한 확대·미완료 의존·근거 없는 재시도·환경 실패 상향을 실행 전에 거부한다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  const runner = { runProcess: async () => { calls += 1; return hostResult({ ok: false, code: 1, outcome: "nonzero" }); } };
  await assert.rejects(runDevelopmentWorkflow(request(repo, { allocation: allocation({ writePaths: ["src/item.ts", "src/outside.ts"] }) }), runner), /배분 범위/);
  await assert.rejects(runDevelopmentWorkflow(request(repo, { allocation: allocation({ dependencies: ["missing-task"] }) }), runner), /의존 작업/);
  await assert.rejects(runDevelopmentWorkflow(request(repo, { allocation: allocation({ attempt: 2, previousAttempt: { eventId: "missing", reason: "이전 시도가 없음", kind: "retry", failureCause: "quality" } }) }), runner), /이전 작업 시도/);
  assert.equal(calls, 0);
  await runDevelopmentWorkflow(request(repo, { allocation: allocation(), verifier: undefined }), runner);
  await assert.rejects(runDevelopmentWorkflow(request(repo, {
    eventId: "fixture-invalid-escalation", allocation: allocation({ attempt: 2, model: "gpt-6.1-terra", previousAttempt: { eventId: "fixture-execution-1", reason: "도구 경로가 잘못됨", kind: "retry", failureCause: "environment" } }),
  }), runner), /모델 상향/);
  assert.equal(calls, 1);
});

test("배분된 선행 task 성공과 호스트 예외는 의존 실행·실패 영수증으로 이어진다", async (t) => {
  const repo = await repository(t);
  await runDevelopmentWorkflow(request(repo, { allocation: allocation(), verifier: undefined }), { runProcess: async () => hostResult() });
  const result = await runDevelopmentWorkflow(request(repo, { eventId: "dependent-task", allocation: allocation({ taskId: "task-2", dependencies: ["fixture-task"] }), verifier: undefined }), { runProcess: async () => { throw new Error("실행 연결이 중단됨"); } });
  assert.equal(result.host?.ok, false);
  assert.deepEqual(result.modelExecution?.failure, { outcome: "execution_error", error: "실행 연결이 중단됨" });
  assert.equal(typeof result.receiptPath, "string");
  assert.ok(typeof result.receiptPath === "string");
  assert.ok((await readFile(join(repo, result.receiptPath), "utf8")).includes("실행 연결이 중단됨"));
});

test("모델 배분은 독립 리뷰를 대체하지 않고 명시된 미지원 추론 노력을 무시하지 않는다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  const runner = { runProcess: async () => { calls += 1; return hostResult(); } };
  await assert.rejects(runDevelopmentWorkflow(request(repo, { allocation: allocation(), decision: { intent: "review" } }), runner), /독립 검토/);
  await assert.rejects(runDevelopmentWorkflow(request(repo, { allocation: allocation(), thinking: "high" }), runner), /추론 노력/);
  assert.equal(calls, 0);
});

test("환경 사전점검 실패도 모델을 실행하지 않은 영수증을 남긴다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  const result = await runDevelopmentWorkflow(request(repo, {
    allocation: allocation(), verifier: undefined, environment: { git: join(repo, "missing-git") },
  }), { runProcess: async () => { calls += 1; return hostResult(); } });
  assert.equal(calls, 0);
  assert.equal(result.executed, false);
  assert.equal(result.modelExecution?.failure?.outcome, "environment_failed");
  assert.equal(result.modelExecution?.accounting.missingUsageAttempts, 1);
  assert.ok(typeof result.receiptPath === "string");
  assert.ok((await readFile(join(repo, result.receiptPath), "utf8")).includes("environment_failed"));
});

test("배분 사건 중복은 재실행하지 않고 완료 영수증이 없는 시도는 재시도하지 않는다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  const runner = { runProcess: async () => { calls += 1; return hostResult({ ok: false, code: 1, outcome: "host_error" }); } };
  const options = request(repo, { allocation: allocation(), verifier: undefined });
  const first = await runDevelopmentWorkflow(options, runner);
  const duplicate = await runDevelopmentWorkflow(options, runner);
  assert.equal(duplicate.duplicate, true);
  assert.equal(calls, 1);
  assert.ok(typeof first.receiptPath === "string");
  await rm(join(repo, first.receiptPath));
  await assert.rejects(runDevelopmentWorkflow(request(repo, {
    eventId: "missing-receipt-retry", verifier: undefined,
    allocation: allocation({ attempt: 2, previousAttempt: { eventId: "fixture-execution-1", reason: "실패를 이어서 조사", kind: "retry", failureCause: "context" } }),
  }), runner), /완료 영수증/);
  assert.equal(calls, 1);
});

test("주입 실행 라벨 위조를 무시하고 준비 콜백의 컨텍스트를 호스트에 전달한다", async (t) => {
  const repo = await repository(t);
  let received: ProcessInvocation | undefined;
  const runner = {
    executor: "process",
    prepareInvocation: (invocation: ProcessInvocation) => ({ ...invocation, stdin: `${invocation.stdin}\n준비 콜백 관찰` }),
    runProcess: async (invocation: ProcessInvocation) => { received = invocation; return hostResult(); },
  };
  const result = await runDevelopmentWorkflow(request(repo, { verifier: undefined }), runner);
  assert.equal(result.executor, "injected");
  assert.equal(result.modelExecution?.observed.reason, "injected_execution");
  assert.ok(received?.stdin?.includes("준비 콜백 관찰"));
});

test("내부 프로세스 환경 실패는 실행하지 않은 것으로 기록하고 중첩 사용량은 부분 집계로 표시한다", async (t) => {
  const repo = await repository(t);
  const failed = await runDevelopmentWorkflow(request(repo, { verifier: undefined }), { runProcess: async () => hostResult({ ok: false, code: null, outcome: "environment_failed" }) });
  assert.equal(failed.executed, false);
  const result = await runDevelopmentWorkflow(request(repo, { eventId: "nested-usage", verifier: undefined }), { runProcess: async () => hostResult({ usage: { input_tokens: 10, output_tokens_details: { reasoning_tokens: 3 }, provider: "fixture" } }) });
  assert.deepEqual(result.modelExecution?.usage, { input_tokens: 10, output_tokens_details: { reasoning_tokens: 3 }, provider: "fixture" });
  assert.deepEqual(result.modelExecution?.accounting.usageByField, { input_tokens: 10 });
  assert.deepEqual(result.modelExecution?.accounting.excludedFields, ["output_tokens_details", "provider"]);
  assert.equal(result.modelExecution?.accounting.partialAggregation, true);
});

test("후속 시도 뒤 과거 사건을 재호출해도 중복으로 반환하고 영수증 변조는 거부한다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  const runner = { runProcess: async () => { calls += 1; return hostResult({ ok: false, code: 1, outcome: "host_error", usage: { input_tokens: 10 } }); } };
  const original = request(repo, { allocation: allocation(), verifier: undefined });
  const first = await runDevelopmentWorkflow(original, runner);
  await runDevelopmentWorkflow(request(repo, {
    eventId: "second-attempt", verifier: undefined,
    allocation: allocation({ attempt: 2, previousAttempt: { eventId: "fixture-execution-1", reason: "입력 재구성", kind: "retry", failureCause: "context" } }),
  }), runner);
  const duplicate = await runDevelopmentWorkflow(original, runner);
  assert.equal(duplicate.duplicate, true);
  assert.equal(calls, 2);
  assert.ok(typeof first.receiptPath === "string");
  const file = join(repo, first.receiptPath);
  await writeFile(file, (await readFile(file, "utf8")).replace('"input_tokens": 10', '"input_tokens": 999'));
  await assert.rejects(runDevelopmentWorkflow(request(repo, {
    eventId: "third-attempt", verifier: undefined,
    allocation: allocation({ attempt: 3, previousAttempt: { eventId: "second-attempt", reason: "입력 재구성", kind: "retry", failureCause: "context" } }),
  }), runner), /영수증 무결성/);
  assert.equal(calls, 2);
});

test("의존 작업은 마지막 시도 영수증과 host_result 사건을 모두 확인한다", async (t) => {
  const repo = await repository(t);
  const first = await runDevelopmentWorkflow(request(repo, { allocation: allocation(), verifier: undefined }), { runProcess: async () => hostResult() });
  assert.ok(typeof first.receiptPath === "string");
  const file = join(repo, first.receiptPath);
  const original = await readFile(file, "utf8");
  await writeFile(file, original.replace('"ok": true', '"ok": false'));
  let calls = 0;
  const runner = { runProcess: async () => { calls += 1; return hostResult(); } };
  await assert.rejects(runDevelopmentWorkflow(request(repo, { eventId: "dependency-tampered", allocation: allocation({ taskId: "dependent", dependencies: ["fixture-task"] }), verifier: undefined }), runner), /영수증 무결성/);
  assert.equal(calls, 0);
  await writeFile(file, original);
  await runDevelopmentWorkflow(request(repo, {
    eventId: "upstream-next", verifier: undefined,
    allocation: allocation({ attempt: 2, previousAttempt: { eventId: "fixture-execution-1", reason: "추가 수집 인계", kind: "handoff" } }),
  }), { runProcess: async () => hostResult({ ok: false, code: 1, outcome: "host_error" }) });
  await assert.rejects(runDevelopmentWorkflow(request(repo, { eventId: "dependency-latest-failed", allocation: allocation({ taskId: "dependent", dependencies: ["fixture-task"] }), verifier: undefined }), runner), /마지막 호스트 정상 종료/);
  assert.equal(calls, 0);
});

test("같은 영수증이어도 의존 완료 사건의 종류·task·attempt가 다르면 거부한다", async (t) => {
  for (const change of [{ type: "status" }, { taskId: "different-task" }, { attempt: 2 }]) {
    const repo = await repository(t);
    const first = await runDevelopmentWorkflow(request(repo, { allocation: allocation(), verifier: undefined }), { runProcess: async () => hostResult() });
    assert.ok(first.workId);
    const paths = runtimePaths(repo, first.workId);
    const { events } = await readRuntime(paths);
    const completion = events.find(event => event.id === "fixture-execution-1-host");
    assert.ok(completion);
    Object.assign(completion, change);
    await writeFile(paths.events, events.map(event => JSON.stringify(event)).join("\n") + "\n");
    await writeFile(paths.session, JSON.stringify(replayEvents(events)) + "\n");
    let calls = 0;
    await assert.rejects(runDevelopmentWorkflow(request(repo, {
      eventId: "invalid-dependency-event", verifier: undefined,
      allocation: allocation({ taskId: "dependent", dependencies: ["fixture-task"] }),
    }), { runProcess: async () => { calls += 1; return hostResult(); } }), /완료 사건|영수증 연결/);
    assert.equal(calls, 0);
  }
});

test("승인된 추가 경로도 실제 쓰기 계획에 없으면 배분 호스트를 실행하지 않는다", async (t) => {
  const repo = await repository(t);
  const options = request(repo);
  let calls = 0;
  await assert.rejects(runDevelopmentWorkflow(request(repo, {
    approval: { ...options.approval, writePaths: ["src/item.ts", "src/extra.ts"] },
    allocation: allocation({ writePaths: ["src/item.ts", "src/extra.ts"] }),
    verifier: undefined,
  }), { runProcess: async () => { calls += 1; return hostResult(); } }), /배분 범위/);
  assert.equal(calls, 0);
});

test("실패 인계는 원인을 요구하고 성공 인계·실패 재시도와 시도 순서를 유지한다", async (t) => {
  const repo = await repository(t);
  let calls = 0;
  const runner = { runProcess: async () => {
    calls += 1;
    return hostResult({ ok: calls !== 1, code: calls === 1 ? 1 : 0, outcome: calls === 1 ? "host_error" : "passed", usage: { input_tokens: calls } });
  } };
  const first = await runDevelopmentWorkflow(request(repo, { allocation: allocation(), verifier: undefined }), runner);
  await assert.rejects(runDevelopmentWorkflow(request(repo, {
    eventId: "failed-handoff-without-cause", verifier: undefined,
    allocation: allocation({ attempt: 2, previousAttempt: { eventId: "fixture-execution-1", kind: "handoff", reason: "실패를 다른 문맥에 인계" } }),
  }), runner), /실패 원인/);
  assert.equal(calls, 1);
  assert.ok(first.workId);
  assert.ok(!(await readRuntime(runtimePaths(repo, first.workId))).events.some(event => event.id === "failed-handoff-without-cause"));
  await assert.rejects(runDevelopmentWorkflow(request(repo, {
    eventId: "out-of-order-failed-handoff", verifier: undefined,
    allocation: allocation({ attempt: 3, previousAttempt: { eventId: "fixture-execution-1", kind: "handoff", reason: "시도를 건너뛴 인계", failureCause: "context" } }),
  }), runner), /마지막 시도/);
  const handoff = await runDevelopmentWorkflow(request(repo, {
    eventId: "failed-handoff-with-cause", verifier: undefined,
    allocation: allocation({ attempt: 2, previousAttempt: { eventId: "fixture-execution-1", kind: "handoff", reason: "원인을 밝힌 실패 인계", failureCause: "context" } }),
  }), runner);
  assert.equal(handoff.host?.ok, true);
  await assert.rejects(runDevelopmentWorkflow(request(repo, {
    eventId: "retry-after-success", verifier: undefined,
    allocation: allocation({ attempt: 3, previousAttempt: { eventId: "failed-handoff-with-cause", kind: "retry", reason: "성공을 실패 재시도로 표시", failureCause: "quality" } }),
  }), runner), /성공한 시도/);
  const completed = await runDevelopmentWorkflow(request(repo, {
    eventId: "successful-handoff-without-cause", verifier: undefined,
    allocation: allocation({ attempt: 3, previousAttempt: { eventId: "failed-handoff-with-cause", kind: "handoff", reason: "성공한 부분의 통합 인계" } }),
  }), runner);
  assert.equal(calls, 3);
  assert.equal(completed.modelExecution?.allocation?.previousAttempt?.failureCause, undefined);
  assert.equal(completed.modelExecution?.accounting.attempts, 3);
  assert.deepEqual(completed.modelExecution?.accounting.usageByField, { input_tokens: 6 });
});

test("정규화된 주입 결과의 ok와 outcome이 다르면 이전 성공으로 분류하지 않는다", async (t) => {
  const repo = await repository(t);
  const first = await runDevelopmentWorkflow(request(repo, { allocation: allocation(), verifier: undefined }), {
    runProcess: async () => hostResult({ ok: true, code: 1, outcome: "host_error" }),
  });
  assert.equal(first.host?.ok, true);
  assert.equal(first.host?.outcome, "host_error");
  let calls = 0;
  const runner = { runProcess: async () => { calls += 1; return hostResult(); } };
  await assert.rejects(runDevelopmentWorkflow(request(repo, {
    eventId: "contradictory-host-handoff", verifier: undefined,
    allocation: allocation({ attempt: 2, previousAttempt: { eventId: "fixture-execution-1", kind: "handoff", reason: "모순된 종료 필드를 인계" } }),
  }), runner), /실패 원인/);
  const retry = await runDevelopmentWorkflow(request(repo, {
    eventId: "contradictory-host-retry", verifier: undefined,
    allocation: allocation({ attempt: 2, previousAttempt: { eventId: "fixture-execution-1", kind: "retry", reason: "실패 종료 원인을 보완", failureCause: "context" } }),
  }), runner);
  assert.equal(calls, 1);
  assert.equal(retry.host?.ok, true);
});

function decompositionUnit(taskId = "fixture-task", file = "src/item.ts", dependencies: string[] = []) {
  return { taskId, goal: "소유한 산출물 작성과 실제 검사", inputs: ["src"], writePaths: [file], excludedPaths: [], dependencies,
    artifacts: [file], criterionIds: ["AC-1"], verification: { command: process.execPath, args: ["checks/verify.ts"] }, resultPath: file };
}

test("F01/F02 공개 개발 진입은 소유 충돌·미정의 의존·순환을 호스트 실행 전에 거부한다", async t => {
  const repo = await repository(t);
  let calls = 0;
  const runner = { runProcess: async () => { calls += 1; return hostResult(); } };
  const first = decompositionUnit();
  for (const units of [
    [first, decompositionUnit("second")],
    [{ ...first, dependencies: ["missing"] }],
    [{ ...first, dependencies: ["second"] }, decompositionUnit("second", "src/other.ts", [first.taskId])],
  ]) {
    await assert.rejects(runDevelopmentWorkflow(request(repo, { allocation: allocation(), decomposition: { units },
      approval: { ...request(repo).approval, writePaths: ["src/item.ts", "src/other.ts"] } }), runner), /소유 충돌|미정의|순환/);
  }
  assert.equal(calls, 0);
});

test("F03 정상 호스트 종료와 미실행·누락 산출물의 업무 수용을 구별하고 선행 승격을 차단한다", async t => {
  const repo = await repository(t);
  const units = [decompositionUnit(), decompositionUnit("second", "src/other.ts", ["fixture-task"])];
  const options = request(repo, { allocation: allocation(), decomposition: { units }, verifier: undefined,
    approval: { ...request(repo).approval, writePaths: ["src/item.ts", "src/other.ts"] } });
  const first = await runDevelopmentWorkflow(options, { runProcess: async () => hostResult() });
  assert.equal(first.host?.ok, true);
  assert.equal(first.acceptance?.status, "rejected");
  assert.ok(first.acceptance?.reasons.includes("verification_not_run"));
  assert.ok(first.acceptance?.reasons.includes("injected_host"));
  let calls = 0;
  await assert.rejects(runDevelopmentWorkflow({ ...options, eventId: "second-event", writes: ["src/other.ts"],
    allocation: allocation({ taskId: "second", writePaths: ["src/other.ts"] }) }, { runProcess: async () => { calls += 1; return hostResult(); } }), /선행 업무 수용 거부/);
  assert.equal(calls, 0);
  assert.ok(first.workId);
  const runtime = await readRuntime(runtimePaths(repo, first.workId));
  assert.ok(runtime.events.some(event => event.type === "host_result" && event.outcome === "passed"));
  assert.ok(runtime.events.some(event => event.type === "task_acceptance" && event.status === "rejected"));
});

test("C02 실제 fixture 프로세스의 독립 산출물과 현재 검증을 수용하고 통합 후 재검증으로 갱신한다", async t => {
  const repo = await repository(t);
  const units = [decompositionUnit(), decompositionUnit("second", "src/other.ts", ["fixture-task"])];
  const base = request(repo, { decomposition: { units }, allocation: allocation(),
    approval: { ...request(repo).approval, writePaths: ["src/item.ts", "src/other.ts"] } });
  function processHost(file: string, content: string) {
    // Node fixture가 Codex JSONL 사건을 출력한다. 실제 모델 호출로 표시하지 않는다.
    const program = `process.stdin.resume();process.stdin.on('end',()=>{require('fs').writeFileSync(${JSON.stringify(file)},${JSON.stringify(content)});console.log(JSON.stringify({type:'thread.started',thread_id:'decomposition-fixture'}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:0,output_tokens:0}}));});`;
    return { prepareInvocation: (invocation: ProcessInvocation) => ({ ...invocation, command: process.execPath, args: ["-e", program] }) };
  }
  const first = await runDevelopmentWorkflow(base, processHost("src/item.ts", "export const value = 2;\n"));
  assert.equal(first.executor, "process");
  assert.equal(first.host?.ok, true);
  assert.equal(first.acceptance?.status, "accepted", first.acceptance?.reasons.join(","));
  await assert.rejects(runDevelopmentWorkflow({ ...base, decomposition: { units: units.map(item => ({ ...item, goal: "같은 사건 ID에 다른 계획" })) } },
    { runProcess: async () => { throw new Error("다른 계획을 중복 사건으로 실행하면 안 된다"); } }), /같은 event id/);
  assert.ok(first.workId);
  assert.deepEqual((await readWork({ repo, workId: first.workId })).record.workflow?.decomposition, { units });
  const second = await runDevelopmentWorkflow({ ...base, eventId: "second-real-process", writes: ["src/other.ts"],
    allocation: allocation({ taskId: "second", writePaths: ["src/other.ts"] }) }, processHost("src/other.ts", "export const other = 3;\n"));
  assert.equal(second.acceptance?.status, "accepted", second.acceptance?.reasons.join(","));
  assert.ok(second.workId);
  const { assessDecompositionCompletion } = await import("../scripts/workflow/decomposition.ts");
  const { authorizationDigest, continueWork, verifyWork } = await import("../scripts/workflow/work.ts");
  const before = await readWork({ repo, workId: second.workId });
  assert.equal(before.record.schemaVersion, 2);
  assert.ok(before.record.workflow);
  assert.equal((await assessDecompositionCompletion(repo, before.record)).usable, false);
  await verifyWork({ repo, workId: second.workId, command: process.execPath, args: ["checks/verify.ts"], criterionIds: ["AC-1"], artifactPaths: ["src/item.ts", "src/other.ts"] });
  const after = await readWork({ repo, workId: second.workId });
  assert.equal(after.record.schemaVersion, 2);
  assert.ok(after.record.workflow);
  assert.equal((await assessDecompositionCompletion(repo, after.record)).usable, true);
  await verifyWork({ repo, workId: second.workId, command: process.execPath, args: ["checks/verify.ts"], criterionIds: ["AC-1"], artifactPaths: ["src/item.ts"] });
  await verifyWork({ repo, workId: second.workId, command: process.execPath, args: ["checks/verify.ts"], criterionIds: ["AC-1"], artifactPaths: ["src/other.ts"] });
  const independentlyVerified = (await readWork({ repo, workId: second.workId })).record;
  assert.equal(independentlyVerified.schemaVersion, 2);
  if (independentlyVerified.schemaVersion !== 2) throw new Error("현재 작업 기록이 필요합니다.");
  const acceptance = await assessDecompositionCompletion(repo, independentlyVerified);
  assert.equal(acceptance.usable, true, acceptance.reasons.join(","));
  // 기록 완료 순서가 시작 순서와 뒤바뀐 fixture다.
  const inverted = structuredClone(independentlyVerified);
  const early = inverted.workflow.verifications.filter(v => v.artifacts?.some(a => a.path === "src/item.ts")).at(-1);
  assert.ok(early);
  const later = { ...early, id: "attempt-22024943-2a31-4414-84dc-8382820358c6", result: "failed" as const, exitCode: 1, startedAt: new Date(Date.parse(early.startedAt) + 1).toISOString() };
  inverted.workflow.verifications = [...inverted.workflow.verifications.filter(v => v.id !== early.id), later, early];
  assert.match((await assessDecompositionCompletion(repo, inverted)).reasons.join(","), /fixture-task: verification_failed/);
  later.startedAt = early.startedAt;
  assert.match((await assessDecompositionCompletion(repo, inverted)).reasons.join(","), /fixture-task: verification_failed/);
  const workflow = independentlyVerified.workflow;
  await continueWork({ repo, workId: second.workId, role: "www-dev", direct: true, requestId: "follow-up-fixture",
    request: "같은 입력의 후속 요청", expectedRequestId: workflow.requestId, expectedRequestHash: workflow.requestHash,
    expectedAuthorizationDigest: authorizationDigest(workflow.authorization), inputs: workflow.inputs,
    approval: { ...workflow.authorization, commit: false, publish: false } });
  await verifyWork({ repo, workId: second.workId, command: process.execPath, args: ["checks/verify.ts"], criterionIds: ["AC-1"] });
  const continued = (await readWork({ repo, workId: second.workId })).record;
  if (continued.schemaVersion !== 2) throw new Error("현재 작업 기록이 필요합니다.");
  assert.match((await assessDecompositionCompletion(repo, continued)).reasons.join(","), /unit_request_changed/);
});

test("F03 실제 fixture 프로세스가 정상 종료해도 필수 산출물이 없으면 수용하지 않는다", async t => {
  const repo = await repository(t);
  const item = { ...decompositionUnit(), writePaths: ["src/item.ts", "src/missing.ts"], artifacts: ["src/missing.ts"], resultPath: "src/missing.ts" };
  const options = request(repo, { decomposition: { units: [item] }, allocation: allocation({ writePaths: item.writePaths }), writes: item.writePaths,
    approval: { ...request(repo).approval, writePaths: item.writePaths } });
  const program = "process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'missing-artifact-fixture'}));console.log(JSON.stringify({type:'turn.completed'}));});";
  const result = await runDevelopmentWorkflow(options, { prepareInvocation: invocation => ({ ...invocation, command: process.execPath, args: ["-e", program] }) });
  assert.equal(result.executor, "process");
  assert.equal(result.host?.ok, true);
  assert.equal(result.acceptance?.status, "rejected");
  assert.ok(result.acceptance?.reasons.some(reason => reason.startsWith("verification_error:")));
  assert.equal(result.verification, undefined);
  assert.ok(result.workId);
  const runtime = await readRuntime(runtimePaths(repo, result.workId));
  assert.ok(runtime.events.some(event => event.type === "host_result" && event.outcome === "passed"));
  assert.ok(runtime.events.some(event => event.type === "task_acceptance" && event.status === "rejected"));
});
