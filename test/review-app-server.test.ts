/**
 * @verifies RESP-DEVELOPMENT-REVIEW
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { executeAppServer, inspectAppServer, readonlyCommand } from '../scripts/workflow/review-app-server.ts';
import { loadReviewPolicy, runReview, validateReview, REVIEW_INLINE_LIMIT } from '../scripts/workflow/review.ts';
import type { ReviewAuthority } from '../scripts/workflow/review.ts';
import { captureSource, criteriaDigest } from '../scripts/workflow/evidence.ts';
import type { CurrentWorkRecord } from '../scripts/workflow/types.ts';

// 실제 stdin/stdout JSON-RPC subprocess다. 유료 모델이나 외부 네트워크는 호출하지 않는다.
const fixture = String.raw`#!/usr/bin/env node
const readline = require('node:readline');
const send = value => process.stdout.write(JSON.stringify(value)+'\n');
const mode = process.env.WWW_REVIEW_FIXTURE_MODE;
require('node:fs').mkdirSync('.www',{recursive:true}); require('node:fs').appendFileSync('.www/process-starts','started\n');
const thread = {approvalPolicy:'never',model:'gpt-6.1-terra',modelProvider:'openai',cwd:process.cwd(),sandbox:{type:'readOnly',networkAccess:false},thread:{id:'thread-fixture'}};
for (const field of ['model','provider','sandbox','cwd']) if(mode===field) {
 if(field==='model') thread.model='wrong-model';
 if(field==='provider') thread.modelProvider='other';
 if(field==='sandbox') thread.sandbox.networkAccess=true;
 if(field==='cwd') thread.cwd='/wrong';
}
readline.createInterface({input:process.stdin}).on('line', line=>{
 const m = JSON.parse(line);
 if(m.method==='initialize') return send({id:m.id,result:{}});
 if(m.method==='thread/start') return send({id:m.id,result:thread});
 if(m.method!=='turn/start') return;
 require('node:fs').mkdirSync('.www',{recursive:true}); require('node:fs').appendFileSync('.www/rpc-calls','called\n');
 if(mode==='timeout') return;
 if(mode==='EOF') return process.exit(0);
 if(mode==='protocol') return process.stdout.write('invalid JSON\n');
 if(mode==='stderr') {process.stderr.write('x'.repeat(2100000));return;}
 if(mode==='approval') return send({id:77,method:'item/commandExecution/requestApproval',params:{}});
 if(mode.startsWith('work-')) { const fs=require('node:fs'); const w=JSON.parse(fs.readFileSync('work-record.json','utf8')); if(mode==='work-stage') w.workflow.nextAction='build'; if(mode==='work-criteria') w.criteria[0].description+=' drift'; if(mode==='work-request') w.workflow.requestHash='0'.repeat(64); fs.writeFileSync('work-record.json',JSON.stringify(w)); }
 if(mode==='source') require('node:fs').appendFileSync('input.ts','\n// drift');
 const item = (type, extra) => send({method:'item/completed',params:{threadId:'thread-fixture',turnId:'turn-fixture',item:{id:'item-fixture',type,...extra}}});
 if(mode==='read-failure') item('commandExecution',{command:'cat missing.ts',exitCode:1,status:'completed'});
 if(mode==='write-command') item('commandExecution',{command:'sed -i s/a/b/ input.ts',exitCode:0,status:'completed'});
 if(mode==='wrapper') item('commandExecution',{command:"/bin/zsh -lc 'cat input.ts'",exitCode:0,status:'completed'});
 if(mode==='reroute') send({method:'model/rerouted',params:{model:'other'}});
 if(mode==='foreign-tool') item('commandExecution',{command:'cat input.ts',turnId:'turn-other',exitCode:0,status:'completed'});
 if(mode==='tool') item('mcpToolCall',{});
 if(mode==='turn-error') return send({method:'error',params:{message:'failed'}});
 if(mode==='commentary') item('agentMessage',{phase:'commentary',text:'검토를 시작합니다.'});
 if(mode!=='no-final') item('agentMessage',{phase:'final_answer',text: mode==='bad-final'?'plain text':JSON.stringify({verdict:'pass',findings:[]})});
 // 완료가 turn/start response보다 빠른 경쟁을 의도적으로 만든다.
 send({method:'turn/completed',params:{threadId:'thread-fixture',turn:{id:'turn-fixture',status:'completed'}}});
 send({id:m.id,result:{turn:{id:'turn-fixture'}}});
});
`;
const root = path.resolve(import.meta.dirname, '..');
const hash = (v: string) => createHash('sha256').update(v).digest('hex');

async function setup(t: import('node:test').TestContext) {
  const repo = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'review-rpc-')));
  const oldPath = process.env.PATH, oldMode = process.env.WWW_REVIEW_FIXTURE_MODE;
  t.after(async () => { process.env.PATH = oldPath; if (oldMode === undefined) delete process.env.WWW_REVIEW_FIXTURE_MODE; else process.env.WWW_REVIEW_FIXTURE_MODE = oldMode; await fs.rm(repo, { recursive: true, force: true }); });
  await fs.writeFile(path.join(repo, 'codex'), fixture, { mode: 0o700 });
  await fs.writeFile(path.join(repo, 'input.ts'), 'export const input = 1;');
  process.env.PATH = `${repo}${path.delimiter}${oldPath}`;
  process.env.WWW_REVIEW_FIXTURE_MODE = 'commentary';
  return repo;
}
function work(): CurrentWorkRecord {
  return { schemaVersion: 2, id: 'work-fixture', title: '검토 fixture', kind: 'bug', areas: ['dev'], owner: 'dev', status: 'verifying', blockedReason: null, relations: [], criteria: [{ id: 'AC-1', description: '읽기 전용', required: true, result: 'unverified', evidence: [] }], workflow: { role: 'www-dev', requestId: 'request-fixture', requestHash: hash('기존 구현 요청'), authorization: { source: 'direct_user_request', requestHash: hash('기존 구현 요청'), implementation: true, writePaths: [], mutationSurfaces: [], verifierCommands: [], commit: false, publish: false }, inputs: ['input.ts'], nextAction: 'review', verifications: [], reviews: [] } };
}
async function options(repo: string) {
  const record = work(), source = await captureSource({ repo, inputs: record.workflow.inputs });
  const policyInfo = await loadReviewPolicy({ root });
  const request = '이 작업의 독립 검토는 Terra로 실행해줘';
  const authority: ReviewAuthority = { source: "cli_direct_user_request", workId: record.id, workRequestHash: record.workflow.requestHash, request, requestHash: hash(request), model: 'gpt-6.1-terra', stage: 'review', sourceDigest: source.digest, criteriaDigest: criteriaDigest(record), policyHash: policyInfo.hash };
  return { repo, work: record, source, criteriaDigest: criteriaDigest(record), policyInfo, inputPaths: ['input.ts'], authority, directRequest: { direct: true, request } };
}

test('실제 subprocess RPC와 빠른 완료를 대조하고 server-selected Terra를 수용한다', async t => {
  const repo = await setup(t), opts = await options(repo);
  const review = await runReview(opts);
  assert.equal(review.verdict, 'pass');
  assert.equal(review.observedModelMeaning, 'server-selected');
  const check = () => validateReview({ repo, work: opts.work, policy: opts.policyInfo.policy, policyHash: opts.policyInfo.hash, review, sourceDigest: opts.source.digest, criteriaDigest: opts.criteriaDigest });
  assert.deepEqual(check(), { usable: true, reasons: [] });
  assert.ok(review.authority);
  const receiptPath = path.join(repo, review.receiptPath);
  const original = await fs.readFile(receiptPath, 'utf8');
  const receipt = JSON.parse(original);
  assert.deepEqual(receipt.invocation, { command: 'codex', args: ['app-server', '--listen', 'stdio://'] });
  assert.ok(path.isAbsolute(receipt.appServer.actualInvocation.command));
  assert.deepEqual(receipt.appServer.readScope, { bundleOnly: true, commandsObserved: [] });
  assert.deepEqual(receipt.inputBundle, [{ path: 'input.ts', content: 'export const input = 1;' }]);
  assert.equal(receipt.inputSnapshot.files[0].digest, hash(receipt.inputBundle[0].content));
  assert.equal(receipt.appServer.threadId, 'thread-fixture');
  assert.equal(receipt.appServer.turnId, 'turn-fixture');
  assert.deepEqual(receipt.appServer.finalResponse, { verdict: 'pass', findings: [] });
  for (const field of ['model', 'modelProvider', 'sandbox', 'cwd']) {
    const changed = structuredClone(receipt);
    const frame = changed.appServer.frames.find((v: { raw: string }) => JSON.parse(v.raw).result?.model);
    const message = JSON.parse(frame.raw); message.result[field] = field === 'sandbox' ? { type: 'readOnly', networkAccess: true } : 'wrong'; frame.raw = JSON.stringify(message);
    const changedText = JSON.stringify(changed);
    await fs.writeFile(receiptPath, changedText);
    const changedReview = { ...review, execution: { ...review.execution, receiptHash: hash(changedText) } };
    assert.equal(validateReview({ repo, work: opts.work, policy: opts.policyInfo.policy, policyHash: opts.policyInfo.hash, review: changedReview, sourceDigest: opts.source.digest, criteriaDigest: opts.criteriaDigest }).usable, false);
  }
  for (const change of ['prompt', 'context', 'bundle', 'snapshot', 'override', 'duplicate-thread', 'other-turn']) {
    const changed = structuredClone(receipt);
    const turn = changed.appServer.frames.find((frame: { raw: string }) => JSON.parse(frame.raw).method === 'turn/start');
    const message = JSON.parse(turn.raw);
    if (change === 'prompt') message.params.input[0].text = message.params.input[0].text.replace('독립 읽기 전용', '임의');
    if (change === 'context') { const lines = message.params.input[0].text.split('\n'); const binding = JSON.parse(lines.at(-1)); binding.reviewId = 'review-other'; lines[lines.length - 1] = JSON.stringify(binding); message.params.input[0].text = lines.join('\n'); }
    if (change === 'bundle') changed.inputBundle[0].content += ' changed';
    if (change === 'snapshot') changed.inputSnapshot.files[0].digest = '0'.repeat(64);
    if (change === 'override') message.params.sandboxPolicy = { type: 'dangerFullAccess' };
    if (change === 'duplicate-thread') { const frame = changed.appServer.frames.find((frame: { raw: string }) => JSON.parse(frame.raw).method === 'thread/start'); const duplicate = JSON.parse(frame.raw); duplicate.id = 88; changed.appServer.frames.splice(3, 0, { direction: 'request', raw: JSON.stringify(duplicate) }); }
    if (change === 'other-turn') { const frame = changed.appServer.frames.find((frame: { raw: string }) => JSON.parse(frame.raw).params?.item?.phase === 'final_answer'); const event = JSON.parse(frame.raw); event.params.turnId = 'other-turn'; frame.raw = JSON.stringify(event); }
    turn.raw = JSON.stringify(message);
    const text = JSON.stringify(changed);
    await fs.writeFile(receiptPath, text);
    const changedReview = { ...review, execution: { ...review.execution, receiptHash: hash(text) } };
    assert.equal(validateReview({ repo, work: opts.work, policy: opts.policyInfo.policy, policyHash: opts.policyInfo.hash, review: changedReview, sourceDigest: opts.source.digest, criteriaDigest: opts.criteriaDigest }).usable, false, change);
  }
  await fs.writeFile(receiptPath, original);
  for (const mutate of [
    () => { opts.work.id = 'work-other'; },
    () => { opts.work.workflow.requestHash = hash('other'); },
    () => { opts.work.workflow.authorization.requestHash = hash('other'); },
    () => { opts.work.workflow.authorization.source = 'renderer'; },
    () => { opts.work.workflow.nextAction = 'build'; },
  ]) { const old = structuredClone(opts.work); mutate(); assert.equal(check().usable, false); Object.assign(opts.work, old); }
  const authorityPath = path.join(repo, review.authority.path);
  const originalAuthority = await fs.readFile(authorityPath, 'utf8');
  await fs.writeFile(authorityPath, originalAuthority.replace('Terra', 'Opus'));
  assert.equal(check().usable, false);
  await fs.writeFile(authorityPath, originalAuthority);
  await fs.appendFile(path.join(repo, 'input.ts'), '\n// changed');
  assert.equal(validateReview({ repo, work: opts.work, policy: opts.policyInfo.policy, policyHash: opts.policyInfo.hash, review, sourceDigest: (await captureSource({ repo, inputs: ['input.ts'] })).digest, criteriaDigest: opts.criteriaDigest }).usable, false);
});

test('wrong model/provider/sandbox/cwd와 읽기·도구·protocol·EOF·timeout을 불수용한다', async t => {
  const repo = await setup(t);
  for (const mode of ['model', 'provider', 'sandbox', 'cwd', 'read-failure', 'write-command', 'tool', 'turn-error', 'approval', 'protocol', 'EOF', 'timeout', 'stderr', 'no-final', 'bad-final', 'reroute', 'foreign-tool', 'no-read']) {
    process.env.WWW_REVIEW_FIXTURE_MODE = mode;
    const result = await executeAppServer({ cwd: repo, input: 'fixture', timeoutMs: 400 });
    assert.ok(result.error, mode);
    assert.notEqual(result.code, 0, mode);
    assert.throws(() => inspectAppServer(result.appServer, repo), Error, mode);
  }
});

test('별도 직접 요청 원문·hash·work·단계 권한과 실행 중 소스 변경을 검사한다', async t => {
  const repo = await setup(t), opts = await options(repo);
  for (const authority of [
    { ...opts.authority, workId: 'work-other' },
    { ...opts.authority, workRequestHash: hash('other') },
    { ...opts.authority, requestHash: hash('self-declared') },
    { ...opts.authority, request: '임의 요청', requestHash: hash('임의 요청') },
  ]) await assert.rejects(runReview({ ...opts, authority }));
  await assert.rejects(runReview({ ...opts, directRequest: { direct: false, request: opts.authority.request } }));
  await assert.rejects(runReview({ ...opts, directRequest: { direct: true, request: '다른 원문' } }));
  opts.work.workflow.nextAction = 'build';
  await assert.rejects(runReview(opts));
  opts.work.workflow.nextAction = 'review';
  process.env.WWW_REVIEW_FIXTURE_MODE = 'source';
  const review = await runReview(opts);
  assert.equal(review.verdict, 'not_run');
  assert.equal(review.execution.error, 'source_changed');
});

test('실제 quota 원문 뒤에만 새 app-server fallback을 실행한다', async t => {
  const repo = await setup(t), opts = await options(repo);
  await fs.writeFile(path.join(repo, 'claude'), '#!/usr/bin/env node\nconsole.log(JSON.stringify({type:"result",is_error:true,error:{code:"quota_exhausted"}}));process.exitCode=1;\n', { mode: 0o700 });
  const review = await runReview({ ...opts, authority: undefined, directRequest: undefined });
  assert.equal(review.verdict, 'pass');
  assert.equal(review.fallbackReason?.verified, true);
  assert.equal(validateReview({ repo, work: opts.work, policy: opts.policyInfo.policy, policyHash: opts.policyInfo.hash, review, sourceDigest: opts.source.digest, criteriaDigest: opts.criteriaDigest }).usable, true);
  const opusPath = path.join(repo, path.dirname(review.receiptPath), 'opus.json');
  const original = await fs.readFile(opusPath);
  const authentication = '#!/usr/bin/env node\nconsole.log(JSON.stringify({type:"result",is_error:true,result:"quota_exhausted but no structured code"}));process.exitCode=1;\n';
  await fs.writeFile(path.join(repo, 'claude'), authentication);
  const rejected = await runReview({ ...opts, authority: undefined, directRequest: undefined });
  assert.equal(rejected.provider, 'anthropic');
  assert.equal(rejected.verdict, 'not_run');
  assert.deepEqual(await fs.readFile(opusPath), original);
});

test('실제 현재 work의 별도 Terra authority가 record/status/complete core까지 이어진다', async t => {
  const { openWork, verifyWork, recordDocumentReview, assessWork, readWork } = await import('../scripts/workflow/work.ts');
  const { runTypedWorkflow } = await import('../scripts/workflow.ts');
  const { withWorkLock } = await import('../scripts/workflow/lock.ts');
  const { finishWorkReport, completeReportedWork, assessReportedWork } = await import('../scripts/workflow/report-lifecycle.ts');
  const repo = await setup(t);
  await fs.mkdir(path.join(repo, 'docs/work'), { recursive: true });
  await fs.mkdir(path.join(repo, 'agents/www'), { recursive: true });
  await fs.writeFile(path.join(repo, 'docs/work/INDEX.md'), '# 작업 목차\n');
  await fs.copyFile(path.join(root, 'agents/www/review-policy.json'), path.join(repo, 'agents/www/review-policy.json'));
  const opened = await openWork({ repo, role: 'www-dev', direct: true, requestId: 'initial', request: '기존 구현 요청', decision: { intent: 'build', area: 'Workflow', title: '검토 fixture', criteria: [{ id: 'AC-1', description: '읽기 전용' }] }, approval: { implementation: true, writePaths: ['input.ts'], mutationSurfaces: ['edit'], verifierCommands: [JSON.stringify([process.execPath, '-e', 'process.exit(0)'])], commit: false, publish: false }, inputs: ['input.ts'] });
  const workId = opened.record.id;
  await verifyWork({ repo, workId, command: process.execPath, args: ['-e', 'process.exit(0)'], criterionIds: ['AC-1'] });
  await recordDocumentReview({ repo, workId, documents: ['docs/PRODUCT.md', 'docs/ARCHITECTURE.md', 'docs/DEVELOPMENT.md', 'docs/skills/WORKFLOW.md'].map(path => ({ path, decision: 'not_applicable', reason: '격리 fixture에 정본 문서 없음' })) });
  const before = await readWork({ repo, workId }), assessment = await assessWork({ repo, workId });
  assert.ok(!assessment.legacy && before.record.schemaVersion === 2);
  const policyInfo = await loadReviewPolicy({ root: repo });
  const request = '이번 검토는 Terra를 직접 선택한다';
  const authority: ReviewAuthority = { source: "cli_direct_user_request", workId, workRequestHash: before.record.workflow.requestHash, request, requestHash: hash(request), model: 'gpt-6.1-terra', stage: 'review', sourceDigest: assessment.source.digest, criteriaDigest: criteriaDigest(before.record), policyHash: policyInfo.hash };
  const cliOptions = { repo, role: 'www-dev', direct: true, execute: true, eventId: 'review-event', request, decision: { intent: 'review', workId }, reviewAuthority: authority, reviewInputPaths: ['input.ts'] };
  const result = await withWorkLock(repo, async () => {
    const execution = await new Promise<{ code: number; stdout: string }>(resolve => execFile(process.execPath, [path.join(root, 'scripts/workflow.ts'), JSON.stringify(cliOptions)], { cwd: repo, timeout: 120_000 }, (error, stdout) => resolve({ code: error && 'code' in error && typeof error.code === 'number' ? error.code : error ? -1 : 0, stdout })));
    assert.equal(execution.code, 1, execution.stdout);
    return JSON.parse(execution.stdout);
  });
  const recording = result.recording as { recorded: boolean; artifactPath: string };
  assert.equal(recording.recorded, false);
  assert.equal((result.reportHook as { status: string }).status, 'deferred');
  assert.equal(await fs.readFile(path.join(repo, '.www/rpc-calls'), 'utf8'), 'called\n');
  await runTypedWorkflow({ action: 'recover-result', direct: true, repo, workId, artifactPath: recording.artifactPath });
  await runTypedWorkflow({ action: 'recover-result', direct: true, repo, workId, artifactPath: recording.artifactPath });
  assert.equal(await fs.readFile(path.join(repo, '.www/rpc-calls'), 'utf8'), 'called\n');
  const after = await assessWork({ repo, workId });
  assert.ok(!after.legacy);
  assert.equal(after.review.usable, true);
  assert.equal(after.complete, true);
  const authored = await finishWorkReport({ repo, workId, narrative: { summary: '격리 RPC fixture 검토', before: '직접 Terra 선택 불가', after: '원장에 검토 기록 수용', changes: ['읽기 전용 결과를 수용했다.'], decisions: [], limitations: ['유료 모델 실행이 아니다.'], next: [] } });
  const reportAssessment = await assessReportedWork({ repo, workId });
  assert.equal(reportAssessment.complete, true);
  assert.equal(reportAssessment.report?.usable, true);
  const { readWorkReport } = await import('../scripts/workflow/reports.ts');
  assert.equal((await readWorkReport({ repo, reportId: authored.report.id })).current, true);
  const completed = await completeReportedWork({ repo, workId });
  assert.equal(completed.record.status, 'done');
  assert.equal(completed.reportHook.status, 'written');
  if (completed.reportHook.status !== 'written') throw new Error('완료 보고서 저장 실패');
  const finalReport = await readWorkReport({ repo, reportId: completed.reportHook.reportId });
  assert.equal(finalReport.current, true);
  assert.equal(finalReport.stale, false);
  assert.equal(finalReport.report.narrative?.summary, '격리 RPC fixture 검토');
  assert.equal((await assessReportedWork({ repo, workId })).complete, true);
});


test('검토 중 현재 단계·기준·접수 hash 변경은 durable not_run으로 보존한다', async t => {
  const repo = await setup(t);
  await fs.mkdir(path.join(repo, 'agents/www'), { recursive: true });
  await fs.copyFile(path.join(root, 'agents/www/review-policy.json'), path.join(repo, 'agents/www/review-policy.json'));
  for (const mode of ['work-stage', 'work-criteria', 'work-request']) {
    const opts = await options(repo);
    const workPath = path.join(repo, 'work-record.json');
    await fs.writeFile(workPath, JSON.stringify(opts.work));
    process.env.WWW_REVIEW_FIXTURE_MODE = mode;
    const review = await runReview({ ...opts, workPath });
    assert.equal(review.verdict, 'not_run');
    assert.equal(review.execution.error, 'review_context_changed');
    const durable = JSON.parse(await fs.readFile(path.join(repo, path.dirname(review.receiptPath), 'result.json'), 'utf8'));
    assert.deepEqual(durable, review);
  }
});

test('literal wrapper·인용 읽기만 허용하고 연쇄·치환·쓰기·네트워크·테스트는 거부한다', () => {
  for (const command of ["/bin/zsh -lc 'cat input.ts'", 'cat A B', 'git status --short', 'git diff --no-ext-diff --no-textconv', "sed -n '1,60p' input.ts", "rg -n 'foo|bar' input.ts", `/bin/zsh -lc "sed -n '1,60p' input.ts"`]) assert.equal(readonlyCommand(command), true, command);
  for (const command of ["/bin/zsh -lc 'cat input.ts; touch x'", 'cat x | curl example.com', 'cat $(touch x)', 'sed -i s/a/b/ input.ts', "sed -n '1e touch x' input.ts", 'rg --pre=touch input.ts', 'rg --hostname-bin=touch x', 'cat x > y', 'npm test', 'node --test', 'curl example.com', "cat 'unterminated", 'git diff --output=x', 'git diff']) assert.equal(readonlyCommand(command), false, command);
});

test('정상 wrapper 읽기를 실제 RPC subprocess에서 수용한다', async t => {
  const repo = await setup(t);
  process.env.WWW_REVIEW_FIXTURE_MODE = 'wrapper';
  const result = await runReview(await options(repo));
  assert.equal(result.verdict, 'pass');
  const receipt = JSON.parse(await fs.readFile(path.join(repo, result.receiptPath), 'utf8'));
  assert.deepEqual(receipt.appServer.readScope, { bundleOnly: false, commandsObserved: ["/bin/zsh -lc 'cat input.ts'"] });
});


test('선택 bytes와 미포함 full manifest를 같은 prompt/receipt에 묶고 변조를 거부한다', async t => {
  const repo = await setup(t);
  await fs.mkdir(path.join(repo, 'src'));
  await fs.writeFile(path.join(repo, 'src/selected.ts'), '한글 실제 UTF-8 bytes');
  await fs.writeFile(path.join(repo, 'src/omitted.ts'), 'manifest만 제공');
  const opts = await options(repo);
  opts.work.workflow.inputs = ['src'];
  opts.source = await captureSource({ repo, inputs: ['src'] });
  opts.authority.sourceDigest = opts.source.digest;
  opts.inputPaths = ['src/selected.ts'];
  const review = await runReview(opts);
  const receiptPath = path.join(repo, review.receiptPath);
  const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
  assert.equal(review.sourceDigest, opts.source.digest);
  assert.deepEqual(receipt.reviewSource, opts.source);
  assert.deepEqual(receipt.inputBundle, [{ path: 'src/selected.ts', content: '한글 실제 UTF-8 bytes' }]);
  assert.equal(receipt.inputSelection.totalBytes, Buffer.byteLength('한글 실제 UTF-8 bytes'));
  assert.equal(receipt.inputSelection.limit, REVIEW_INLINE_LIMIT);
  assert.ok(receipt.inputSelection.omitted.some((file: { path: string }) => file.path === 'src/omitted.ts'));
  assert.deepEqual(receipt.appServer.readScope, { bundleOnly: true, commandsObserved: [] });
  const validate = (candidate = review) => validateReview({ repo, work: opts.work, policy: opts.policyInfo.policy, policyHash: opts.policyInfo.hash, review: candidate, sourceDigest: opts.source.digest, criteriaDigest: opts.criteriaDigest });
  assert.equal(validate().usable, true);
  for (const change of ['omitted', 'selected', 'bytes', 'same-prompt']) {
    const altered = structuredClone(receipt);
    if (change === 'omitted') altered.inputSelection.omitted = [];
    if (change === 'selected') altered.inputPaths = ['src/omitted.ts'];
    if (change === 'bytes') altered.inputBundle[0].content = '변조';
    if (change === 'same-prompt') altered.inputSelection.totalBytes++;
    // receipt와 선택 hash를 함께 고쳐도 실제 turn prompt와 맞지 않으면 수용하지 않는다.
    altered.inputPathsHash = hash(JSON.stringify({ inputPaths: altered.inputPaths, inputSnapshot: altered.inputSnapshot, inputBundle: altered.inputBundle, inputSelection: altered.inputSelection }));
    const text = JSON.stringify(altered);
    await fs.writeFile(receiptPath, text);
    assert.equal(validate({ ...review, inputPathsHash: altered.inputPathsHash, execution: { ...review.execution, receiptHash: hash(text) } }).usable, false, change);
  }
});

test('빈 선택/cap/비UTF8/범위밖/directory/traversal/symlink/drift를 모델 시작 전에 거부한다', async t => {
  const repo = await setup(t);
  const opts = await options(repo);
  await assert.rejects(runReview({ ...opts, source: { digest: opts.source.digest }, inputPaths: [] }));
  await fs.writeFile(path.join(repo, 'outside.ts'), '범위 밖');
  await fs.symlink('input.ts', path.join(repo, 'link.ts'));
  for (const inputPaths of [[], ['outside.ts'], ['.'], ['../input.ts'], ['input.ts/'], ['link.ts'], ['input.ts', 'input.ts']]) {
    await assert.rejects(runReview({ ...opts, inputPaths }));
  }
  for (const bytes of [Buffer.alloc(REVIEW_INLINE_LIMIT + 1, 97), Buffer.from([0xff])]) {
    await fs.writeFile(path.join(repo, 'input.ts'), bytes);
    const source = await captureSource({ repo, inputs: ['input.ts'] });
    await assert.rejects(runReview({ ...opts, source, authority: { ...opts.authority, sourceDigest: source.digest } }));
  }
  await fs.writeFile(path.join(repo, 'input.ts'), 'changed after capture');
  await assert.rejects(runReview(opts));
  // 선택 snapshot을 새로 만들어도 원래 full manifest bytes와 달라지면 거부한다.
  const stale = { ...opts.source, inputs: undefined };
  await assert.rejects(runReview({ ...opts, source: stale }));
  await assert.rejects(fs.access(path.join(repo, '.www/rpc-calls')));
  await assert.rejects(fs.access(path.join(repo, '.www/process-starts')));
  // 합계 cap도 각 파일 cap과 독립적으로 확인한다.
  await fs.writeFile(path.join(repo, 'input.ts'), 'a'.repeat(300 * 1024));
  await fs.writeFile(path.join(repo, 'second.ts'), 'b'.repeat(300 * 1024));
  const source = await captureSource({ repo, inputs: ['input.ts', 'second.ts'] });
  await assert.rejects(runReview({ ...opts, source, inputPaths: ['input.ts', 'second.ts'], authority: { ...opts.authority, sourceDigest: source.digest } }));
  await assert.rejects(fs.access(path.join(repo, '.www/rpc-calls')));
  await assert.rejects(fs.access(path.join(repo, '.www/process-starts')));
});

test('현재 작업의 기준/검증만 추가 선택하고 다른 작업의 원장을 거부한다', async t => {
  const repo = await setup(t), opts = await options(repo);
  await fs.mkdir(path.join(repo, 'agents/www'), { recursive: true });
  await fs.copyFile(path.join(root, 'agents/www/review-policy.json'), path.join(repo, 'agents/www/review-policy.json'));
  const directory = 'docs/work/Workflow/001-current';
  await fs.mkdir(path.join(repo, directory), { recursive: true });
  const workPath = `${directory}/work.json`;
  await fs.writeFile(path.join(repo, workPath), JSON.stringify(opts.work));
  for (const name of ['verification.md', 'spec.md']) await fs.writeFile(path.join(repo, directory, name), '현재 기준과 실행 한계');
  const inputPaths = ['input.ts', workPath, `${directory}/verification.md`, `${directory}/spec.md`];
  const review = await runReview({ ...opts, workPath, inputPaths });
  assert.equal(review.verdict, 'pass', JSON.stringify(review.execution));
  assert.equal(validateReview({ repo, work: opts.work, policy: opts.policyInfo.policy, policyHash: opts.policyInfo.hash, review, sourceDigest: opts.source.digest, criteriaDigest: opts.criteriaDigest }).usable, true);
  const other = 'docs/work/Workflow/002-other/work.json';
  await fs.mkdir(path.dirname(path.join(repo, other)), { recursive: true });
  await fs.writeFile(path.join(repo, other), JSON.stringify({ ...opts.work, id: 'work-other' }));
  const source = await captureSource({ repo, inputs: ['input.ts', other] });
  await assert.rejects(runReview({ ...opts, source, workPath, inputPaths: [other], authority: { ...opts.authority, sourceDigest: source.digest } }));
});
