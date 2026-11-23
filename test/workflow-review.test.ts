/**
 * @verifies RESP-DEVELOPMENT-REVIEW
 */
import { loadTimingInputs, replayTiming } from "../scripts/replay-workflow-timing.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { captureSource, criteriaDigest } from "../scripts/workflow/evidence.ts";
import { advanceWork, openWork } from "../scripts/workflow/work.ts";
import { assertReviewPolicy, classifyOpusFailure, loadReviewPolicy, runReview, selectReviewer, validateReview } from "../scripts/workflow/review.ts";

const root          = path.resolve(import.meta.dirname, "..") ;
const sourceDigest  = "a".repeat(64)                          ;
const criterionHash = "b".repeat(64)                          ;
const policyInfo    = await loadReviewPolicy({ root })        ;
const policy        = policyInfo.policy                       ;

function quota(code = "quota_exhausted") {
  return classifyOpusFailure({ code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code } }) });
}

function review(overrides: object = {}) {
  return {
    id            : "review-fixture"      ,
    provider      : "anthropic"           ,
    model         : "opus"                ,
    observedModel : "claude-opus-fixture" ,
    verdict       : "pass"                ,
    readOnly      : true                  ,
    sourceDigest,
    criteriaDigest : criterionHash                                                           ,
    policyHash     : policyInfo.hash                                                         ,
    executor       : "process"                                                               ,
    fallbackReason : null                                                                    ,
    execution      : { exitCode: 0, signal: null, error: null, receiptHash: "c".repeat(64) } ,
    findings       : []                                                                      ,
    ...overrides,
  };
}

function validate(value: unknown, overrides: object = {}) {
  return validateReview({ policy, review: value, sourceDigest, criteriaDigest: criterionHash, policyHash: policyInfo.hash, ...overrides });
}

async function temporary<T>(action: (directory: string) => Promise<T>) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "www-review-test-"));
  try { return await action(directory); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

function success() {
  return { code: 0, signal: null, error: null, stdout: JSON.stringify({ type: "result", is_error: false, structured_output: { verdict: "pass", findings: [] }, modelUsage: { "claude-opus-fixture": {} } }), stderr: "" };
}

async function recordedReview(directory: string, responses: { code: number; stdout: string; signal?: NodeJS.Signals | null; error?: string | null; stderr?: string }[] = [success()]) {
  const legacy = responses.length > 1 ? responses.slice() : null;
  const result = await runReview({ repo: directory, source: { digest: sourceDigest }, criteriaDigest: criterionHash, policyInfo, allowFallback: !legacy, run: async () => { const response = responses.shift(); assert.ok(response); return response; } });
  if (legacy) {
    // 과거 exec JSONL 영수증의 읽기 호환성만 검사하는 신규 fixture다.
    const selected = selectReviewer({ policy, opusFailure: result.failure });
    const opusFile = path.join(directory, path.dirname(result.receiptPath), "opus.json");
    const opus = JSON.parse(await fs.readFile(opusFile, "utf8"));
    const body = { ...legacy[1], invocation: { command: "codex", args: ["exec", "--model", "gpt-6.1-terra", "--sandbox", "read-only", "--ignore-user-config", "--ephemeral", "--json", "--output-schema", path.join(directory, "response.json"), "-"] }, context: { ...opus.context, provider: "openai", model: "gpt-6.1-terra" } };
    const text = `${JSON.stringify(body)}\n`;
    const receiptPath = path.join(path.dirname(result.receiptPath), "terra-legacy.json");
    await fs.writeFile(path.join(directory, receiptPath), text, { flag: "wx" });
    const messages = legacy[1].stdout.split("\n").map(line => JSON.parse(line));
    const last = messages.filter(m => m.type === "item.completed").at(-1)?.item.text;
    let final: { verdict: "pass" | "fail"; findings: string[] } | null = null;
    try { final = JSON.parse(last); } catch { /* 최종 JSON 부재 fixture */ }
    return { ...result, ...selected, executor: "process", verdict: final?.verdict ?? "not_run", findings: final?.findings ?? [], observedModel: messages.find(m => m.model)?.model ?? null, receiptPath, execution: { exitCode: legacy[1].code, signal: null, error: null, receiptHash: createHash("sha256").update(text).digest("hex") }, observedModelMeaning: undefined, inputPathsHash: undefined };
  }
  // 수용 predicate의 단위 fixture다. 실제 모델 실행 근거로 사용하지 않는다.
  return { ...result, executor: "process" };
}

test("정책 정본을 프로젝트 또는 배포 루트에서 읽고 내용 변경을 식별한다", async () => {
  assert.equal(policy.scope, "www-dev");
  assert.equal(policy.primary.model, "opus");
  assert.equal(policy.fallback.model, "gpt-6.1-terra");
  assert.match(policyInfo.hash, /^[a-f0-9]{64}$/);
  await temporary(async (directory) => {
    await fs.mkdir(path.join(directory, "agents/www"), { recursive: true });
    const file = path.join(directory, "agents/www/review-policy.json");
    await fs.writeFile(file, JSON.stringify(policy));
    const first = await loadReviewPolicy({ root: directory });
    await fs.writeFile(file, JSON.stringify({ ...policy, version: 2 }));
    assert.notEqual((await loadReviewPolicy({ root: directory })).hash, first.hash);
    await fs.unlink(file);
    await fs.symlink(policyInfo.path, file);
    await assert.rejects(loadReviewPolicy({ root: directory }), /심볼릭 링크/);
  });
});

test("정책의 모델·조건·읽기 전용·필수 규칙을 약화할 수 없다", () => {
  for (const changed of [
    { ...policy, primary: { provider: "anthropic", model: "sonnet" } },
    { ...policy, fallback: { ...policy.fallback, when: "any_failure" } },
    { ...policy, readOnly: false },
    { ...policy, required: false },
  ]) assert.throws(() => assertReviewPolicy(changed));
});

test("최초 검토는 Opus이며 명시 사용량 소진에만 Terra를 선택한다", () => {
  assert.deepEqual(selectReviewer({ policy }), { provider: "anthropic", model: "opus", fallbackReason: null });
  const failure = quota();
  assert.ok(failure);
  assert.equal(failure?.verified, true);
  assert.equal(selectReviewer({ policy, opusFailure: failure }).model, "gpt-6.1-terra");
  for (const failure of [
    { kind : "authentication" , verified : true },
    { kind : "network"        , verified : true },
    { kind : "review_failed"  , verified : true },
    { ...quota(), verified: false },
    { ...quota(), code: "rate_limit_error" },
    { ...quota(), receiptHash: "" },
  ]) assert.throws(() => selectReviewer({ policy, opusFailure: failure }), /입증되지/);
});

test("인증 오류·일반 429·모델 출력의 소진 주장은 대체 근거가 아니다", () => {
  const auth = classifyOpusFailure({ code: 1, stdout: JSON.stringify({ type: "result", is_error: true, result: "Failed to authenticate: OAuth session expired" }) });
  assert.equal(auth?.kind, "authentication");
  const rate = classifyOpusFailure({ code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "rate_limit_error", status: 429 } }) });
  assert.equal(rate?.verified, false);
  const modelClaim = classifyOpusFailure({ code: 0, stdout: JSON.stringify({ type: "result", is_error: false, structured_output: { error: { code: "quota_exhausted" } } }) });
  assert.equal(modelClaim, null);
  assert.equal(classifyOpusFailure({ code: 1, stdout: "quota_exhausted" })?.verified, false);
  assert.equal(classifyOpusFailure({ code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "quota_exhausted" } }), outputTruncated: true })?.verified, false);
  const exhausted = classifyOpusFailure({ code: 1, stdout: JSON.stringify({ type: "result", is_error: true, result: "You've hit your Opus limit · resets 3:45pm" }) });
  assert.ok(exhausted?.kind === "quota_exhausted");
  assert.equal(exhausted.code, "claude_usage_window_exhausted");
  assert.equal(classifyOpusFailure({ code: 1, stdout: JSON.stringify({ type: "result", is_error: true, result: "Server is temporarily limiting requests" }) })?.verified, false);
});

test("실제 CLI 종료 형식의 명시적 사용량 소진에서만 대체 검토를 시작한다", () => {
  const terminal = {
    type: "result",
    is_error: true,
    terminal_reason: "api_error",
    api_error_status: 429,
    api_error_type: "rate_limit_error",
    api_error: "usage_limit_reached",
    result: "You've hit your 5-hour limit · resets 10:40am (Asia/Seoul) · out of usage credits",
  };
  const failure = classifyOpusFailure({ code: 1, stdout: JSON.stringify(terminal) });
  assert.ok(failure?.kind === "quota_exhausted");
  assert.equal(failure.code, "usage_limit_reached");
  assert.equal(selectReviewer({ policy, opusFailure: failure }).model, "gpt-6.1-terra");
  for (const change of [
    { api_error: undefined },
    { api_error: "overloaded_error" },
    { api_error_status: 503 },
    { api_error_type: "authentication_error" },
    { terminal_reason: undefined },
    { type: "assistant" },
  ]) {
    const stdout = JSON.stringify({ ...terminal, ...change });
    assert.equal(classifyOpusFailure({ code: 1, stdout })?.verified, false);
  }
  const stdout = JSON.stringify(terminal);
  for (const execution of [
    { code: 0 },
    { code: 1, error: "runner_error" },
    { code: null },
    { code: 1, signal: "SIGTERM" as const },
  ]) {
    assert.equal(classifyOpusFailure({ stdout, ...execution })?.verified, false);
  }
  const conflicting = JSON.stringify({ ...terminal, result: "Failed to authenticate: OAuth session expired" });
  assert.equal(classifyOpusFailure({ code: 1, stdout: conflicting })?.kind, "authentication");
  const legacyMessage = "You've hit your Opus limit";
  for (const fields of [
    { api_error_status: 401, api_error_type: "authentication_error" },
    { api_error_status: 429, api_error_type: "authentication_error" },
  ]) {
    const stdout = JSON.stringify({ ...terminal, result: legacyMessage, ...fields });
    assert.equal(classifyOpusFailure({ code: 1, stdout })?.kind, "authentication");
  }
  const malformed = JSON.stringify({ ...terminal, api_error: undefined, result: legacyMessage, error: { code: "quota_exhausted" } });
  assert.equal(classifyOpusFailure({ code: 1, stdout: malformed })?.verified, false);
  for (const legacy of [
    { error: { code: "quota_exhausted", status: 401 } },
    { errors: [{ code: "quota_exhausted" }, { status: 403 }] },
    { errors: [{ code: "quota_exhausted" }, { type: "authentication_error" }] },
  ]) {
    const stdout = JSON.stringify({ type: "result", is_error: true, ...legacy });
    assert.equal(classifyOpusFailure({ code: 1, stdout })?.kind, "authentication");
  }
  const unavailable = JSON.stringify({ type: "result", is_error: true, result: legacyMessage, error: { code: "quota_exhausted", status: 503 } });
  assert.equal(classifyOpusFailure({ code: 1, stdout: unavailable })?.verified, false);
  for (const error of [{ status: 503 }, { code: "server_error" }, { code: 503 }, { code: "quota_exhausted" }]) {
    const stdout = JSON.stringify({ ...terminal, error });
    assert.equal(classifyOpusFailure({ code: 1, stdout })?.verified, false);
  }
  const mixedAuth = JSON.stringify({ ...terminal, error: { type: "authentication_error" } });
  assert.equal(classifyOpusFailure({ code: 1, stdout: mixedAuth })?.kind, "authentication");
  for (const terminal_reason of ["interrupted", "cancelled", "success", null]) {
    const stdout = JSON.stringify({ type: "result", is_error: true, terminal_reason, result: legacyMessage });
    assert.equal(classifyOpusFailure({ code: 1, stdout })?.verified, false);
  }
});

test("실행 영수증 없는 자기 선언은 필수 검토를 통과할 수 없다", () => {
  assert.equal(validate(review()).usable, false);
  assert.ok(validate(review()).reasons.includes("receipt_unavailable"));
});

test("완료 판정은 같은 소스·기준·정책의 읽기 전용 통과 원문을 대조한다", async () => {
  await temporary(async (directory) => {
  const original = await recordedReview(directory);
  assert.equal(validate(original, { repo: directory }).usable, true);
  for (const [overrides, reason] of [
    [{ sourceDigest: "d".repeat(64) }, "source_changed"],
    [{ criteriaDigest: "e".repeat(64) }, "criteria_changed"],
    [{ policyHash: "f".repeat(64) }, "policy_changed"],
    [{ readOnly: false }, "review_not_read_only"],
    [{ executor: "injected" }, "untrusted_executor"],
    [{ verdict: "fail" }, "review_not_passed"],
    [{ verdict: "not_run" }, "review_not_passed"],
    [{ observedModel: "claude-sonnet-fixture" }, "observed_model_mismatch"],
    [{ execution: { exitCode: 0 } }, "missing_execution_receipt"],
    [{ id: "review-other-work" }, "receipt_context_mismatch"],
  ] satisfies [object, string][]) assert.ok(validate({ ...original, ...overrides }, { repo: directory }).reasons.includes(reason));
  const file    = path.join (directory, original.receiptPath) ;
  const receipt = JSON.parse(await fs.readFile(file, "utf8")) ;
  receipt.stdout = JSON.stringify({ type: "result", is_error: false, structured_output: { verdict: "fail", findings: ["원문은 실패"] } });
  await fs.writeFile(file, JSON.stringify(receipt));
  const changed = validate(original, { repo: directory });
  assert.ok(changed.reasons.includes("receipt_hash_mismatch"));
  assert.ok(changed.reasons.includes("receipt_result_mismatch"));
  const forgedHash = createHash("sha256").update(await fs.readFile(file)).digest("hex");
  assert.ok(validate({ ...original, execution: { ...original.execution, receiptHash: forgedHash } }, { repo: directory }).reasons.includes("receipt_result_mismatch"));
  });
});

test("Terra 통과는 같은 디렉터리의 Opus 소진 원문과 해시를 대조한다", async () => {
  await temporary(async (directory) => {
    const fallback = await recordedReview(directory, [
      { code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "quota_exhausted" } }) },
      { code: 0, stdout: [
        JSON.stringify({ type: "thread.started", model: "gpt-6.1-terra" }),
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "진행 설명" } }),
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify({ verdict: "pass", findings: [] }) } }),
      ].join("\n") },
    ]);
    assert.equal(validate(fallback, { repo: directory }).usable, true);
    assert.ok(validate({ ...fallback, fallbackReason: null }, { repo: directory }).reasons.includes("reviewer_not_allowed"));
    assert.ok(validate(review({ model: "sonnet" })).reasons.includes("reviewer_not_allowed"));
    assert.ok(validate(review({ fallbackReason: quota() })).reasons.includes("reviewer_not_allowed"));
    const opusPath = path.join (directory, path.dirname(fallback.receiptPath), "opus.json") ;
    const receipt  = JSON.parse(await fs.readFile(opusPath, "utf8")                       ) ;
    receipt.stdout = JSON.stringify({ type: "result", is_error: true, result: "Failed to authenticate: expired" });
    await fs.writeFile(opusPath, JSON.stringify(receipt));
    assert.ok(validate(fallback, { repo: directory }).reasons.includes("quota_receipt_invalid"));
  });
});

test("읽기 전용 호출 경로와 원문 영수증을 기록하고 주입 결과를 완료 증거로 거부한다", async () => {
  await temporary(async (directory) => {
    let captured: { invocation: { command: string; args: string[] }; options: { input: string } } | undefined;
    const result = await runReview({
      repo: directory, source: { digest: sourceDigest }, criteriaDigest: criterionHash, policyInfo, inputPaths: ["src/a.ts"],
      run: async (invocation, options) => { captured = { invocation, options }; return success(); },
    });
    assert.ok(captured);
    assert.equal(captured.invocation.command, "claude");
    assert.equal(captured.invocation.args[captured.invocation.args.indexOf("--model") + 1], "opus");
    assert.equal(captured.invocation.args[captured.invocation.args.indexOf("--tools") + 1], "Read,Glob,Grep");
    assert.ok(captured.invocation.args.includes("--safe-mode"));
    assert.ok(captured.invocation.args.includes("--restricted"));
    assert.ok(captured.invocation.args.includes("--strict-mcp-config"));
    assert.match(captured.options.input, /검토할 데이터/);
    assert.equal(result.verdict, "pass");
    assert.equal(result.observedModel, "claude-opus-fixture");
    assert.equal(result.executor, "injected");
    assert.ok(validate(result).reasons.includes("untrusted_executor"));
    const receipt = JSON.parse(await fs.readFile(path.join(directory, result.receiptPath), "utf8"));
    assert.equal(receipt.stdout, success().stdout);
  });
});

test("인증 실패와 검토 불합격은 Terra를 호출하지 않는다", async () => {
  for (const response of [
    { code : 1 , stdout : JSON.stringify({ type: "result", is_error: true, result: "Failed to authenticate: OAuth session expired" })          },
    { code : 0 , stdout : JSON.stringify({ type: "result", is_error: false, structured_output: { verdict: "fail", findings: ["수정 필요"] } }) },
    { code : 0 , stdout : "JSON이 아닌 최종 응답"                                                                                              },
  ]) await temporary(async (directory) => {
    let count    = 0                                                                                                                                                                 ;
    const result = await runReview({ repo: directory, source: { digest: sourceDigest }, criteriaDigest: criterionHash, policyInfo, run: async () => { count++; return response; } }) ;
    assert.equal(count, 1);
    assert.equal(result.provider, "anthropic");
    assert.notEqual(result.verdict, "pass");
  });
});

test("보조 모델이 먼저 기록돼도 Opus 관측값을 선택한다", async () => {
  await temporary(async (directory) => {
    const response = success   ()                ;
    const body     = JSON.parse(response.stdout) ;
    body.modelUsage = { "claude-haiku-fixture": {}, "claude-opus-fixture": {} };
    const result = await recordedReview(directory, [{ ...response, stdout: JSON.stringify(body) }]);
    assert.equal(result.observedModel, "claude-opus-fixture");
    assert.equal(validate(result, { repo: directory }).usable, true);
  });
});

test("Terra 마지막 응답이 스키마에 맞지 않으면 앞선 JSON 통과를 재사용하지 않는다", async () => {
  await temporary(async (directory) => {
    const result = await recordedReview(directory, [
      { code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "quota_exhausted" } }) },
      { code: 0, stdout: [
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify({ verdict: "pass", findings: [] }) } }),
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "최종 응답은 미확인" } }),
      ].join("\n") },
    ]);
    assert.equal(result.verdict, "not_run");
    assert.equal(validate(result, { repo: directory }).usable, false);
  });
});

test("명시 소진 뒤에만 Terra 읽기 전용 호출을 수행하고 소진 영수증을 보존한다", async () => {
  await temporary(async (directory) => {
    await fs.writeFile(path.join(directory, "input.ts"), "export {};\n");
    const source = await captureSource({ repo: directory, inputs: ["input.ts"] });
    const calls: { command: string; args: string[] }[] = [];
    const result = await runReview({
      repo: directory, source, criteriaDigest: criterionHash, policyInfo, inputPaths: ["input.ts"],
      run: async (invocation) => {
        calls.push(invocation);
        if (invocation.command === "claude") return { code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "usage_limit_reached" } }) };
        return { code: 0, stdout: JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify({ verdict: "pass", findings: [] }) } }) };
      },
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].command, "codex");
    assert.deepEqual(calls[1].args, ["app-server", "--listen", "stdio://"]);
    assert.ok(result.fallbackReason);
    assert.equal(result.fallbackReason.code, "usage_limit_reached");
    assert.equal(result.verdict, "not_run");
    assert.equal(result.observedModel, null);
    assert.ok((await fs.readdir(path.join(directory, path.dirname(result.receiptPath)))).includes("opus.json"));
    const originalReceipt = await fs.readFile(path.join(directory, path.dirname(result.receiptPath), "opus.json"));
    assert.equal(result.fallbackReason.receiptHash, createHash("sha256").update(originalReceipt).digest("hex"));
  });
});

test("full source의 기본 Opus는 inputPaths 생략·디렉터리·Terra cap 초과에도 한 번 통과한다", async () => {
  await temporary(async (directory) => {
    await fs.mkdir(path.join(directory, "src"));
    await fs.writeFile(path.join(directory, "src/large.ts"), "a".repeat(512 * 1024 + 1));
    const source = await captureSource({ repo: directory, inputs: ["src"] });
    for (const selection of [{}, { inputPaths: ["src"] }, { inputPaths: ["src/large.ts"] }]) {
      let calls = 0;
      const result = await runReview({ repo: directory, source, criteriaDigest: criterionHash, policyInfo, ...selection,
        run: async invocation => { calls++; assert.equal(invocation.command, "claude"); return success(); } });
      assert.equal(calls, 1);
      assert.equal(result.model, "opus");
      assert.equal(result.verdict, "pass");
      assert.equal(result.sourceDigest, source.digest);
    }
  });
});

test("quota fallback은 Opus 원문 저장 뒤 선택을 검증하고 잘못된 선택으로 Terra를 시작하지 않는다", async () => {
  await temporary(async (directory) => {
    await fs.writeFile(path.join(directory, "input.ts"), "export {};\n");
    const source = await captureSource({ repo: directory, inputs: ["input.ts"] });
    const response = { code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "quota_exhausted" } }) };
    let calls = 0;
    await assert.rejects(runReview({ repo: directory, source, criteriaDigest: criterionHash, policyInfo, inputPaths: [],
      run: async invocation => { calls++; assert.equal(invocation.command, "claude"); return response; } }), /비어/);
    assert.equal(calls, 1);
    const reviews = path.join(directory, ".www/evidence/reviews");
    const [id] = await fs.readdir(reviews);
    const receiptDirectory = path.join(reviews, id);
    assert.deepEqual(await fs.readdir(receiptDirectory), ["opus.json"]);
    const receipt = JSON.parse(await fs.readFile(path.join(receiptDirectory, "opus.json"), "utf8"));
    assert.equal(receipt.stdout, response.stdout);
    assert.equal(classifyOpusFailure(receipt)?.verified, true);
    const traces = await loadTimingInputs([path.join(directory, ".www/evidence/workflow-timing")]);
    const timing = replayTiming("2000-01-01T00:00:00Z", "2100-01-01T00:00:00Z", traces);
    assert.equal(timing.outcomes["provider_failure/quota_exhausted"], 1);
    assert.equal(timing.processStarts, 0);
    assert.equal(timing.requests[0]?.terminal, true);
  });
});

test("기본 quota fallback은 전체 식별을 보존하고 512KiB 안의 선택 입력으로 실행한다", async () => {
  await temporary(async (directory) => {
    await fs.mkdir(path.join(directory, "src"));
    await fs.writeFile(path.join(directory, "src/large.ts"), "x".repeat(512 * 1024 + 1));
    await fs.writeFile(path.join(directory, "src/small.ts"), "export {};\n");
    await fs.writeFile(path.join(directory, "src/asset.bin"), Buffer.from([0xff]));
    await fs.mkdir(path.join(directory, "docs/work"), { recursive: true });
    await fs.writeFile(path.join(directory, "docs/work/INDEX.md"), "# 작업 목차\n");
    const work = (await openWork({ repo: directory, role: "www-dev", direct: true, requestId: "default-review-fixture",
      request: "대체 입력이 현재 기준을 포함하는지 확인", decision: { intent: "verify", area: "Workflow", title: "기준 전달",
        criteria: [{ id: "AC-1", description: "현재 기준 원문을 검토에 제공한다.", required: true }] }, inputs: ["src"], approval: {} })).record;
    if (work.schemaVersion !== 2) throw new Error("현재 작업 fixture가 필요합니다.");
    const source = await captureSource({ repo: directory, inputs: ["src"] });
    const calls: string[] = [];
    const primaryInputs: { criteriaDigest: string; criteriaSnapshot: unknown }[] = [];
    const inputs: Array<{
      inputSnapshot: { inputs: string[] };
      inputBundle: { path: string; content: string }[];
      inputSelection: { omitted: { path: string }[]; limit: number };
      criteriaSnapshot: { id: string; description: string }[];
    }> = [];
    const result = await runReview({ repo: directory, source, criteriaDigest: criteriaDigest(work), policyInfo, work,
      run: async (invocation, { input }) => {
        calls.push(invocation.command);
        if (invocation.command === "claude") {
          primaryInputs.push(JSON.parse(input.trim().split("\n").at(-1)!));
          return { code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "quota_exhausted" } }) };
        }
        inputs.push(JSON.parse(input.trim().split("\n").at(-1)!));
        return { code: 0, stdout: "" };
      },
    });
    assert.deepEqual(calls, ["claude", "codex"]);
    assert.equal(result.sourceDigest, source.digest);
    const [selection] = inputs;
    assert.ok(selection);
    assert.deepEqual(selection.inputSnapshot.inputs, ["src/small.ts"]);
    assert.deepEqual(selection.inputBundle, [{ path: "src/small.ts", content: "export {};\n" }]);
    assert.ok(selection.inputSelection.omitted.some(file => file.path === "src/large.ts"));
    assert.ok(selection.inputSelection.omitted.some(file => file.path === "src/asset.bin"));
    assert.equal(selection.inputSelection.limit, 512 * 1024);
    assert.equal(selection.criteriaSnapshot[0]?.description, "현재 기준 원문을 검토에 제공한다.");
    assert.equal(primaryInputs.length, 1);
    assert.equal(primaryInputs[0].criteriaDigest, criteriaDigest(work));
    assert.deepEqual(primaryInputs[0].criteriaSnapshot, selection.criteriaSnapshot);
  });
});

test("문서 전용 권한의 기본 대체 검토에 집중 테스트와 좁은 구현 범위를 먼저 전달한다", async () => {
  await temporary(async directory => {
    const implementation = "scripts/workflow/artifacts.ts";
    const focusedTest = "test/workflow-artifacts.test.ts";
    const note = "docs/large-note.md";
    const receipt = ".boxbox/earlier-receipt.json";
    const files: [string, string][] = [
      [implementation, `export const marker = true;\n${" ".repeat(16 * 1024)}`],
      [focusedTest, `import "../scripts/workflow/artifacts.ts";\n${" ".repeat(16 * 1024)}`],
      [note, "a".repeat(500 * 1024)],
      [receipt, JSON.stringify({ earlier: "b".repeat(500 * 1024) })],
      ["docs/work/INDEX.md", "# 작업 목차\n"],
    ];
    for (const [file, content] of files) {
      await fs.mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await fs.writeFile(path.join(directory, file), content);
    }
    const inputs = [".boxbox", note, "scripts", "scripts/workflow", "test", focusedTest];
    const opened = await openWork({ repo: directory, role: "www-dev", direct: true, requestId: "documentation-only-review",
      request: "기존 구현과 검사를 검토한다", decision: { intent: "verify", area: "Workflow", title: "기존 구현 대조",
        criteria: [{ id: "AC-1", description: "기존 구현과 집중 테스트를 연결한다.", required: true }] },
      inputs, approval: { implementation: true, writePaths: [note], mutationSurfaces: ["edit"] } });
    const { record: work } = opened;
    if (work.schemaVersion !== 2) throw new Error("현재 작업 fixture가 필요합니다.");
    const source = await captureSource({ repo: directory, inputs });
    let fallback: { inputBundle: { path: string }[]; inputSelection: { omitted: { path: string }[] } } | undefined;
    const result = await runReview({ repo: directory, source, criteriaDigest: criteriaDigest(work), policyInfo, work,
      run: async (invocation, { input }) => {
        if (invocation.command === "claude") return { code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "quota_exhausted" } }) };
        fallback = JSON.parse(input.trim().split("\n").at(-1)!);
        return { code: 0, stdout: "" };
      },
    });
    assert.equal(result.sourceDigest, source.digest);
    assert.ok(fallback);
    assert.deepEqual(fallback.inputBundle.map(entry => entry.path).sort(), [implementation, focusedTest]);
    assert.ok(fallback.inputSelection.omitted.some(file => file.path === note));
    assert.ok(fallback.inputSelection.omitted.some(file => file.path === receipt));
  });
});

test("인라인에서 생략한 공식 검증 문서가 검토 중 바뀌면 대체 검토를 거부한다", async () => {
  await temporary(async directory => {
    await fs.mkdir(path.join(directory, "src"));
    await fs.mkdir(path.join(directory, "docs/work"), { recursive: true });
    await fs.writeFile(path.join(directory, "docs/work/INDEX.md"), "# 작업 목차\n");
    await fs.writeFile(path.join(directory, "src/sample.ts"), "export {};\n");
    await fs.mkdir(path.join(directory, "agents/www"), { recursive: true });
    await fs.copyFile(path.join(root, "agents/www/review-policy.json"), path.join(directory, "agents/www/review-policy.json"));
    const opened = await openWork({ repo: directory, role: "www-dev", direct: true, requestId: "review-document-drift",
      request: "공식 검증 문서를 읽기 전용으로 대조한다.", decision: { intent: "review", area: "Workflow", title: "검증 문서 현재성",
        criteria: [{ id: "AC-1", description: "문서 변경은 이전 검토를 만료시킨다.", required: true }] },
      inputs: ["src"], approval: {} });
    const { record: work, path: workPath } = await advanceWork({ repo: directory, workId: opened.record.id, intent: "review" });
    const document = path.join(path.dirname(workPath), "verification.md");
    const relative = path.relative(await fs.realpath(directory), document);
    let captured: { inputBundle: { path: string }[]; workDocuments: { files: { path: string; digest: string }[] } } | undefined;
    let primaryDocuments: unknown;
    await fs.writeFile(document, "v".repeat(512 * 1024 + 1));
    const source = await captureSource({ repo: directory, inputs: ["src"] });
    const outcome = await runReview({ repo: directory, source, criteriaDigest: criteriaDigest(work), policyInfo, work, workPath,
      run: async (invocation, { input }) => {
        const prompt = JSON.parse(input.trim().split("\n").at(-1)!);
        if (invocation.command === "claude") {
          primaryDocuments = prompt.workDocuments;
          return { code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "quota_exhausted" } }) };
        }
        captured = prompt;
        await fs.appendFile(document, "변경");
        return { code: 0, stdout: "" };
      },
    });
    assert.ok(captured);
    assert.ok(!captured.inputBundle.some(file => file.path === relative));
    assert.match(captured.workDocuments.files.find(file => file.path === relative)?.digest ?? "", /^[0-9a-f]{64}$/);
    assert.deepEqual(primaryDocuments, captured.workDocuments);
    assert.equal(outcome.execution.error, "review_evidence_changed");
    const primary = await runReview({ repo: directory, source, criteriaDigest: criteriaDigest(work), policyInfo, work, workPath,
      run: async invocation => {
        assert.equal(invocation.command, "claude");
        await fs.appendFile(document, "Opus 실행 중 변경");
        return { code: 0, stdout: "" };
      } });
    assert.equal(primary.execution.error, "review_evidence_changed");
    const drift = await runReview({ repo: directory, source, criteriaDigest: criteriaDigest(work), policyInfo, work, workPath,
      run: async invocation => {
        assert.equal(invocation.command, "claude");
        await fs.appendFile(path.join(directory, "src/sample.ts"), "export const changed = true;\n");
        return { code: 0, stdout: "" };
      } });
    assert.equal(drift.execution.error, "source_changed");
  });
});

test("검토 입력과 영수증 경로가 프로젝트 밖이나 심볼릭 링크로 탈출하지 않는다", async () => {
  await temporary(async (directory) => {
    let executions = 0                                                                                                                                                      ;
    const options  = { repo: directory, source: { digest: sourceDigest }, criteriaDigest: criterionHash, policyInfo, run: async () => { executions++; return success(); } } ;
    await assert.rejects(runReview({ ...options, inputPaths: ["../outside"] }), /내부 상대/);
    await assert.rejects(runReview({ ...options, receiptDirectory: directory }), /별도 디렉터리/);
    await assert.rejects(runReview({ ...options, receiptDirectory: path.dirname(directory) }), /내부 별도/);
    await fs.symlink(os.tmpdir(), path.join(directory, ".www"));
    await assert.rejects(runReview(options), /심볼릭 링크/);
    assert.equal(executions, 0);
  });
});


test("요청한 모델만 있고 실제 관측 모델이 없거나 다르면 완료 검토를 수용하지 않는다", async () => {
  for (const observed of [null, "claude-sonnet-fixture"]) await temporary(async (directory) => {
    const response = success   ()                ;
    const body     = JSON.parse(response.stdout) ;
    body.modelUsage = observed ? { [observed]: {} } : {};
    const result     = await recordedReview(directory, [{ ...response, stdout: JSON.stringify(body) }]) ;
    const assessment = validate(result, { repo: directory })                                            ;
    assert.equal(assessment.usable, false);
    assert.ok(assessment.reasons.includes(observed ? "observed_model_mismatch" : "observed_model_missing"));
  });
});


test("대체 실행을 끄면 검증된 Opus 소진도 Terra 호출 없이 원문과 실패를 보존한다", async () => {
  await temporary(async (directory) => {
    const calls: { command: string; args: string[] }[] = []                                                                                                          ;
    const response                                     = { code: 1, stdout: JSON.stringify({ type: "result", is_error: true, error: { code: "quota_exhausted" } }) } ;
    const result = await runReview({
      repo: directory, source: { digest: sourceDigest }, criteriaDigest: criterionHash, policyInfo, allowFallback: false,
      run: async (invocation) => { calls.push(invocation); return response; },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "claude");
    assert.equal(calls[0].args[calls[0].args.indexOf("--model") + 1], "opus");
    assert.equal(result.provider, "anthropic");
    assert.equal(result.model, "opus");
    assert.equal(result.verdict, "not_run");
    assert.equal(result.executor, "injected");
    assert.equal(result.observedModel, null);
    assert.equal(result.fallbackReason, null);
    assert.equal(result.failure?.verified, true);
    assert.equal(result.failure?.code, "quota_exhausted");
    assert.equal(result.execution.exitCode, 1);
    assert.equal(path.basename(result.receiptPath), "opus.json");
    const originalReceipt = await fs.readFile(path.join(directory, result.receiptPath));
    assert.equal(JSON.parse(originalReceipt.toString("utf8")).stdout, response.stdout);
    assert.deepEqual(result.failure, classifyOpusFailure(JSON.parse(originalReceipt.toString("utf8"))));
    assert.equal(result.execution.receiptHash, createHash("sha256").update(originalReceipt).digest("hex"));
    assert.deepEqual(await fs.readdir(path.dirname(path.join(directory, result.receiptPath))), ["opus.json", "result.json"]);
  });
});

test("대체 실행 허용 여부가 boolean이 아니면 검토자를 호출하기 전에 거부한다", async () => {
  await temporary(async (directory) => {
    let executions = 0;
    for (const allowFallback of [null, "false", 0, {}]) {
      await assert.rejects(runReview({
        repo: directory, source: { digest: sourceDigest }, criteriaDigest: criterionHash, policyInfo,
        // 런타임 경계가 잘못된 외부 옵션을 거부하는지 확인하는 타입 negative test다.
        // @ts-expect-error boolean 이외의 값은 공개 API에서 허용하지 않는다.
        allowFallback,
        run: async () => { executions++; return success(); },
      }), /검토 대체 실행 허용 여부는 boolean이어야 합니다/);
    }
    assert.equal(executions, 0);
    await assert.rejects(fs.access(path.join(directory, ".www")), /ENOENT/);
  });
});
