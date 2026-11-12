import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { providerExecution, providerExecutionMatches, resolveProviderInvocation } from "../scripts/workflow/adapters/windows-command.ts";
import { loadReviewPolicy, runReview, validateReview } from "../scripts/workflow/review.ts";

const invocation = { command: "codex", args: ["exec", "--sandbox", "read-only", "한글 공백 & literal"] }                                                  ;
const prefix     = "C:\\사용자 공백\\npm"                                                                                                                 ;
const codex      = path.win32.join(prefix, "node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe") ;
const claude     = path.win32.join(prefix, "node_modules/@anthropic-ai/claude-code/bin/claude.exe")                                                       ;

function options(files: string[]) {
  return { platform: "win32", cwd: "C:\\작업 공간", env: { Path: `"${prefix}";C:\\다른 폴더` }, isFile: (file: string) => files.includes(file) };
}

test("Windows npm shim을 실행하지 않고 실제 provider exe와 argv를 선택한다", () => {
  const files = [path.win32.join(prefix, "codex.cmd"), codex, path.win32.join(prefix, "claude.cmd"), claude];
  assert.deepEqual(resolveProviderInvocation(invocation, options(files)), { command: codex, args: invocation.args });
  assert.deepEqual(resolveProviderInvocation({ command: "claude", args: ["--safe-mode", "--tools", "Read,Glob,Grep"] }, options(files)), { command: claude, args: ["--safe-mode", "--tools", "Read,Glob,Grep"] });
  assert.deepEqual(invocation.args, ["exec", "--sandbox", "read-only", "한글 공백 & literal"]);
});

test("standalone exe를 우선하며 명시 경로는 다른 PATH provider로 대체하지 않는다", () => {
  const standalone = path.win32.join(prefix, "codex.exe")                      ;
  const files      = [standalone, path.win32.join(prefix, "codex.cmd"), codex] ;
  assert.equal(resolveProviderInvocation(invocation, options(files)).command, standalone);
  assert.throws(() => resolveProviderInvocation({ command: "C:\\없는 위치\\codex.cmd", args: [] }, options(files)), /native exe/);
  assert.equal(resolveProviderInvocation({ command: codex, args: [] }, options(files)).command, codex);
});

test("실제 exe 없는 shim과 다른 provider 이름은 조용히 shell로 우회하지 않는다", () => {
  const files = [path.win32.join(prefix, "codex.cmd")];
  assert.throws(() => resolveProviderInvocation(invocation, options(files)), /shell/);
  const other = { command: "missing-command", args: ["literal"] };
  assert.deepEqual(resolveProviderInvocation(other, options(files)), other);
});

test("Claude optional dependency native 배치를 지원한다", () => {
  const optional = path.win32.join(prefix, "node_modules/@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-win32-x64/claude.exe");
  assert.equal(resolveProviderInvocation({ command: "claude.cmd", args: [] }, options([path.win32.join(prefix, "claude.cmd"), optional])).command, optional);
});

test("논리 readonly argv와 실제 exe 메타데이터 불일치를 거부한다", () => {
  const actual = { platform: "win32" as const, command: codex, args: invocation.args, executableDigest: "a".repeat(64) };
  assert.equal(providerExecutionMatches(invocation, actual, "win32"), true);
  for (const bad of [{ ...actual, command: "cmd.exe" }, { ...actual, command: "C:\\tool\\claude.exe" }, { ...actual, args: [...invocation.args, "--dangerous"] }, { ...actual, executableDigest: "unknown" }]) assert.equal(providerExecutionMatches(invocation, bad), false);
  assert.equal(providerExecutionMatches(invocation, null), true);
  assert.equal(providerExecutionMatches(invocation, null, "darwin"), true);
  assert.equal(providerExecutionMatches(invocation, null, "win32"), false);
  assert.equal(providerExecutionMatches(invocation, actual, "darwin"), false);
  assert.equal(providerExecutionMatches(invocation, actual, "unknown"), false);
  assert.equal(providerExecutionMatches(invocation, null, null), false);
});

test("현재 OS 실제 실행은 argv를 보존하고 Windows에서는 exe 바이트 지문을 남긴다", async (t) => {
  if (process.platform !== "win32") {
    assert.deepEqual(providerExecution({ command: process.execPath, args: ["-e", "process.exit(0)"] }), { command: process.execPath, args: ["-e", "process.exit(0)"], actualInvocation: null, executionPlatform: process.platform });
    return;
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), "www provider 한글 "));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, "codex.exe");
  await copyFile(process.execPath, executable);
  const value     = "한글 공백 & literal"                                                                               ;
  const execution = providerExecution({ command: executable, args: ["-e", "console.log(process.argv.at(-1))", value] }) ;
  assert.ok(execution.actualInvocation);
  assert.match(execution.actualInvocation.executableDigest, /^[a-f0-9]{64}$/);
  const result = spawnSync(execution.command, execution.args, { shell: false, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), value);
});

test("검토 영수증은 readonly 논리 호출을 유지해도 실제 exe에 추가한 쓰기 인자를 거부한다", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "www-review-execution-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const policyInfo = await loadReviewPolicy({ root: path.resolve(import.meta.dirname, "..") });
  const sourceDigest = "a".repeat(64), criteriaDigest = "b".repeat(64);
  const result = await runReview({ repo: directory, source: { digest: sourceDigest }, criteriaDigest, policyInfo,
    run: async (logical) => ({ code: 0, signal: null, error: null, stdout: JSON.stringify({ type: "result", is_error: false, structured_output: { verdict: "pass", findings: [] }, modelUsage: { "claude-opus-fixture": {} } }), stderr: "", executionPlatform: "win32", actualInvocation: { platform: "win32", command: claude, args: [...logical.args], executableDigest: "c".repeat(64) } }),
  });
  // 실제 모델 검토가 아닌 영수증 수용 predicate의 단위 fixture다.
  const review   = { ...result, executor: "process" as const }                                                                                             ;
  const validate = () => validateReview({ repo: directory, policy: policyInfo.policy, review, sourceDigest, criteriaDigest, policyHash: policyInfo.hash }) ;
  assert.equal(validate().usable, true);
  const file = path.join (directory, review.receiptPath) ;
  const body = JSON.parse(await readFile(file, "utf8") ) ;
  assert.equal(body.executionPlatform, "win32");
  const original = body.actualInvocation;
  delete body.actualInvocation;
  let altered = `${JSON.stringify(body)}\n`;
  await writeFile(file, altered);
  review.execution.receiptHash = createHash("sha256").update(altered).digest("hex");
  assert.ok(validate().reasons.includes("receipt_execution_mismatch"));
  body.actualInvocation = original;
  body.actualInvocation.args.push("--permission-mode", "bypassPermissions");
  altered = `${JSON.stringify(body)}\n`;
  await writeFile(file, altered);
  review.execution.receiptHash = createHash("sha256").update(altered).digest("hex");
  assert.ok(validate().reasons.includes("receipt_execution_mismatch"));
});

test("실제 실행 플랫폼과 파일 검사는 주입하지 못하며 순수 resolver에서만 가정할 수 있다", () => {
  assert.throws(() => providerExecution(invocation, options([])), /주입할 수 없습니다/);
  assert.throws(() => providerExecution(invocation, { platform: process.platform }), /주입할 수 없습니다/);
  assert.throws(() => providerExecution(invocation, { isFile: () => true }), /주입할 수 없습니다/);
});

test("실제 실행 파일을 못 찾은 시도도 주입 없이 현재 OS를 영수증에 보존한다", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "www-provider-missing-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const policyInfo = await loadReviewPolicy({ root: path.resolve(import.meta.dirname, "..") }) ;
  const original   = process.env.PATH                                                          ;
  try {
    process.env.PATH = "";
    const result = await runReview({ repo: directory, source: { digest: "a".repeat(64) }, criteriaDigest: "b".repeat(64), policyInfo });
    assert.equal(result.verdict, "not_run");
    const body = JSON.parse(await readFile(path.join(directory, result.receiptPath), "utf8"));
    assert.equal(body.executionPlatform, process.platform);
  } finally {
    if (original === undefined) delete process.env.PATH;
    else process.env.PATH = original;
  }
});
