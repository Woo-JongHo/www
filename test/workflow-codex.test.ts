import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { codexCapabilities, createCodexInvocation, runCodex, spawnCodex, waitForCodex } from "../scripts/workflow/adapters/codex.ts";

const script = `
import { createHash } from 'node:crypto';
const mode = process.argv[2];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const emit = (event) => process.stdout.write(JSON.stringify(event) + '\\n');
if (mode === 'malformed') { process.stdout.write('{"type":'); process.exit(0); }
if (mode === 'signal-partial') { process.stdout.write('{"type":'); process.kill(process.pid, 'SIGTERM'); }
if (mode === 'signal') { process.kill(process.pid, 'SIGTERM'); }
if (mode === 'missing-start') { emit({type:'turn.completed'}); process.exit(0); }
emit({type:'thread.started',thread_id:'fixture-thread'});
emit({type:'turn.started'});
if (mode === 'empty-end') process.exit(0);
if (mode === 'oversized') { emit({type:'item.completed',item:{type:'agent_message',text:'x'.repeat(1100000)}}); }
if (mode === 'large-stderr') process.stderr.write('진행'.repeat(300000));
if (mode === 'events') {
  for (let index = 0; index < 1300; index++) emit({type:'item.completed',item:{type:'command_execution',id:String(index),command:'fixture',status:'completed',exit_code:0}});
}
if (mode === 'failed') emit({type:'turn.failed',error:{message:'fixture failure'}});
if (mode === 'error') emit({type:'error',message:'fixture error'});
emit({type:'item.completed',item:{type:'agent_message',text:'역할을 읽었다는 모델 문구는 로딩 증거가 아님'}});
emit({type:'fixture.stdin',digest:createHash('sha256').update(input).digest('hex')});
if (mode === 'unicode') {
  const line = Buffer.from(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'한글 상태'}})+'\\n');
  const split = line.indexOf(Buffer.from('한'))+1;
  process.stdout.write(line.subarray(0,split));
  await new Promise((resolve)=>setTimeout(resolve,5));
  process.stdout.write(line.subarray(split));
}
const completed = JSON.stringify({type:'turn.completed'});
process.stdout.write(completed + (mode === 'no-newline' ? '' : '\\n'));
process.exitCode = mode === 'nonzero' ? 3 : 0;
`;

async function fixture(t: import("node:test").TestContext, mode: string, options: object = {}) {
  const repo = await mkdtemp(path.join(tmpdir(), "www-codex-adapter-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const file = path.join(repo, "fixture.ts");
  await writeFile(file, script);
  const invocation      = createCodexInvocation({ repo, systemPrompt: "역할·스킬 컨텍스트", request: "요청 $(no-shell) `literal`" }) ;
  const childInvocation = { ...invocation, command: process.execPath, args: [file, mode] }                                           ;
  return { repo, invocation, result: await runCodex(childInvocation, { cwd: repo, captureOutput: true, ...options }) };
}

test("Codex argv에는 실행 설정만 두고 컨텍스트와 요청은 stdin에 전달한다", () => {
  const request    = '요청 "quoted" $(touch forbidden)'                                                         ;
  const context    = "정본 역할과 선택한 스킬"                                                                  ;
  const invocation = createCodexInvocation({ repo: "/tmp/project with space", systemPrompt: context, request }) ;
  assert.equal(invocation.command, "codex");
  assert.deepEqual(invocation.args, ["-a", "never", "exec", "--json", "--ephemeral", "--sandbox", "workspace-write", "-C", "/tmp/project with space", "-"]);
  assert.ok(invocation.stdin.includes(context));
  assert.ok(invocation.stdin.includes(request));
  assert.ok(!invocation.args.includes(request));
  assert.ok(!invocation.args.includes(context));
  assert.equal(invocation.requestedModel, null);
  assert.equal(invocation.observedModel, null);
  const model = createCodexInvocation({ repo: "/tmp/project", systemPrompt: context, request, model: "specified-model", sandbox: "read-only" });
  assert.deepEqual(model.args.slice(-3), ["--model", "specified-model", "-"]);
  assert.equal(model.requestedModel, "specified-model");
  assert.equal(codexCapabilities().nativeSkillInvoke, false);
  assert.equal(codexCapabilities().mutationInterception, false);
  assert.equal(codexCapabilities().advisory, true);
  assert.equal(codexCapabilities().sandbox, false);
  assert.ok(!invocation.args.some((value) => /bypass|ignore-rules|ignore-user-config/.test(value)));
});

test("상대 폴더·빈 요청·잘못된 sandbox와 모델 설정을 거부한다", () => {
  const base = { repo: "/tmp/project", systemPrompt: "context", request: "request" };
  for (const override of [{ repo: "relative" }, { systemPrompt: "" }, { request: " " }, { sandbox: "invalid" }, { model: null }, { model: "--switch" }, { model: "model with space" }, { thinking: "high" }]) {
    assert.throws(() => createCodexInvocation({ ...base, ...override }));
  }
  assert.throws(() => spawnCodex({ command: "codex", args: [] }), /검증된 Codex/);
});

test("실제 fixture 자식 프로세스가 stdin EOF를 받고 JSONL 완료를 반환한다", async (t) => {
  const { invocation, result } = await fixture(t, "success");
  assert.equal(result.ok, true);
  assert.equal(result.outcome, "passed");
  assert.equal(result.threadId, "fixture-thread");
  assert.equal(result.turnCompleted, true);
  const stdinEvent = result.events.find((event) => event.type === "fixture.stdin");
  assert.ok(stdinEvent);
  assert.equal(stdinEvent.digest, createHash("sha256").update(invocation.stdin).digest("hex"));
  assert.equal(result.observedModel, null);
  assert.ok(!("roleLoaded" in result));
  assert.match(result.stdout, /turn.completed/);
});

test("코드 0이어도 오류 사건이나 완료 없는 EOF는 성공으로 처리하지 않는다", async (t) => {
  for (const [mode, expected] of [["failed", "host_error"], ["error", "host_error"], ["empty-end", "incomplete"], ["missing-start", "incomplete"], ["malformed", "protocol_error"]]) {
    const { result } = await fixture(t, mode);
    assert.equal(result.code, 0);
    assert.equal(result.ok, false);
    assert.equal(result.outcome, expected);
  }
});

test("정상 JSON의 마지막 개행이 없어도 완료 사건은 읽고 UTF-8 분할을 보존한다", async (t) => {
  assert.equal((await fixture(t, "no-newline")).result.ok, true);
  const { result } = await fixture(t, "unicode");
  assert.equal(result.ok, true);
  assert.ok(result.events.some((event) => event.item !== null && typeof event.item === "object" && "text" in event.item && event.item.text === "한글 상태"));
});

test("큰 stderr를 양쪽 capture 설정에서 drain하고 출력·사건 보관량을 제한한다", async (t) => {
  const captured = (await fixture(t, "large-stderr")).result;
  assert.equal(captured.ok, true);
  assert.equal(captured.outputTruncated, true);
  assert.ok(Buffer.byteLength(captured.stderr) <= 1_048_576);
  const discarded = (await fixture(t, "large-stderr", { captureOutput: false })).result;
  assert.equal(discarded.ok, true);
  assert.equal(discarded.stdout, "");
  assert.equal(discarded.stderr, "");
  const events = (await fixture(t, "events")).result;
  assert.equal(events.ok, true);
  assert.ok(events.events.length <= 1000);
  assert.equal(events.outputTruncated, true);
});

test("1 MiB를 넘는 단일 JSONL 사건을 제한하고 이후 완료만으로 통과하지 않는다", async (t) => {
  const { result } = await fixture(t, "oversized");
  assert.equal(result.ok, false);
  assert.equal(result.outcome, "protocol_error");
  assert.equal(result.outputTruncated, true);
  assert.equal(result.turnCompleted, true);
  assert.ok(Buffer.byteLength(result.stdout) <= 1_048_576);
});

test("완료 사건 뒤 실제 비정상 종료와 신호를 구분한다", async (t) => {
  const nonzero = (await fixture(t, "nonzero")).result;
  assert.equal(nonzero.ok, false);
  assert.equal(nonzero.code, 3);
  assert.equal(nonzero.outcome, "nonzero");
  const signal = (await fixture(t, "signal")).result;
  assert.equal(signal.ok, false);
  assert.equal(signal.outcome, process.platform === "win32" ? "nonzero" : "signal");
  if (process.platform === "win32") { assert.equal(signal.signal, null); assert.notEqual(signal.code, 0); }
  else assert.equal(signal.signal, "SIGTERM");
  const partialSignal = (await fixture(t, "signal-partial")).result;
  assert.equal(partialSignal.ok, false);
  assert.equal(partialSignal.outcome, process.platform === "win32" ? "nonzero" : "signal");
});

test("없는 실행 파일은 stdin 오류를 유실하지 않고 spawn 실패로 반환한다", async (t) => {
  const repo = await mkdtemp(path.join(tmpdir(), "www-codex-missing-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const invocation = createCodexInvocation({ repo, systemPrompt: "context", request: "request" }) ;
  const child      = spawnCodex({ ...invocation, command: path.join(repo, "missing-command") })   ;
  const result     = await waitForCodex(child, { captureOutput: true })                           ;
  assert.equal(result.ok, false);
  assert.equal(result.outcome, "spawn_error");
  assert.ok(result.error);
  assert.match(result.error, /missing-command/);
  assert.ok(result.code !== null && result.code < 0);
});
