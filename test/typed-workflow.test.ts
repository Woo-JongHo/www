import { afterEach, test } from 'bun:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTypedWorkflow, type CommandResult } from '../scripts/workflow.ts';

const sourceRoot         = fileURLToPath(new URL('../', import.meta.url)) ;
const fixtures: string[] = []                                             ;
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(repo => rm(repo, { recursive: true, force: true })));
});

async function put(repo: string, file: string, body: string): Promise<void> {
  await mkdir(path.dirname(path.join(repo, file)), { recursive: true });
  await writeFile(path.join(repo, file), body);
}

async function fixture(legacy = false): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), 'www-typed-workflow-'));
  fixtures.push(repo);
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  await put(repo, '.gitignore', '.www/\nnode_modules/\n');
  await put(repo, 'docs/work/INDEX.md', '# 작업 목차\n');
  await put(repo, 'src/item.ts', 'export const value = 1;\n');
  await put(repo, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src/**/*.ts'] }));
  const oldSource        = 'export const old = 1;\n'                                                                         ;
  const legacyJavaScript = legacy ? [{ path: 'old.mjs', sha256: createHash('sha256').update(oldSource).digest('hex') }] : [] ;
  await put(repo, 'source-policy.json', JSON.stringify({ schemaVersion: 1, typecheckProjects: ['tsconfig.json'], legacyJavaScript, archivedTypeScript: [], excludedVendorPaths: ['skill-library/'] }));
  if (legacy) await put(repo, 'old.mjs', oldSource);
  // 실제 컴파일러·BoxBox 실행을 대체하는 명시적 test double의 접근 확인용 파일이다.
  await put(repo, 'node_modules/typescript/bin/tsc', '');
  const launcher = path.join(repo, '.www/fixture/boxbox.mjs');
  await put(repo, '.www/fixture/boxbox.mjs', '');
  await put(repo, '.www/development.local.json', JSON.stringify({ boxboxNode: process.execPath, boxboxLauncher: launcher }));
  const contextFiles = ['AGENTS.md', 'agents/www/AGENT.md', 'docs/skills/WORKFLOW.md', 'skills/www/www-build/SKILL.md', 'agents/www/review-policy.json'];
  for (const file of contextFiles) {
    await mkdir(path.dirname(path.join(repo, file)), { recursive: true });
    await copyFile(path.join(sourceRoot, file), path.join(repo, file));
  }
  return repo;
}

function options(repo: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = randomUUID();
  return {
    repo, role: 'www-dev', direct: true, execute: true,
    eventId: id, requestId: id, request: 'TypeScript 항목 변경을 구현해줘',
    decision : { intent: 'build', area: 'Workflow', title: '타입 항목 변경', kind: 'feature', areas: ['dev'], owner: 'dev', criteria: [{ id: 'AC-1', description: '선언한 TypeScript 변경을 검사한다', required: true }] } ,
    approval : { implementation: true, writePaths: ['src/item.ts', 'src/other.ts', 'old.mjs'], mutationSurfaces: ['edit'], verifierCommands: [], commit: false, publish: false }                                           ,
    inputs   : ['src']                                                                                                                                                                                                     ,
    writes   : ['src/item.ts']                                                                                                                                                                                             ,
    ...overrides,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(isRecord(value));
  return Object.fromEntries(Object.entries(value));
}

function fakeTools(change: () => Promise<void> = async () => {}) {
  let hosted   = false                                                                                        ;
  let calls    = 0                                                                                            ;
  let prompt   = ''                                                                                           ;
  const faults = { invalidJSON: false, preType: false, preBoxbox: false, postType: false, postRefuse: false } ;
  async function runCommand(_command: string, args: string[], _cwd: string): Promise<CommandResult> {
    const base = { code: 0, stdout: '', stderr: '', outputTruncated: false };
    if (args.includes('--project')) {
      const failed = hosted ? faults.postType : faults.preType;
      return { ...base, code: failed ? 2 : 0, stdout: failed ? 'error TS2322: fixture의 의도한 타입 오류' : '' };
    }
    if (faults.invalidJSON) return { ...base, stdout: '{broken' };
    const file = args[args.indexOf('--file') + 1];
    if (args.includes('guide')) return { ...base, stdout: JSON.stringify({ tool: 'boxbox', command: 'guide', file, columnSets: [], ok: false }) };
    const summary = { groups: 1, misaligned: !hosted && faults.preBoxbox ? 1 : 0, refused: hosted && faults.postRefuse ? 1 : 0 };
    return { ...base, stdout: JSON.stringify({ tool: 'boxbox', syntax: { status: 'valid' }, results: [{ file, summary }] }) };
  }
  async function runHost(invocation: Record<string, unknown>) {
    calls += 1;
    assert.equal(typeof invocation.stdin, 'string');
    prompt = String(invocation.stdin);
    hosted = true;
    await change();
    return { ok: true, code: 0, outcome: 'passed', stdout: 'fixture', stderr: '', outputTruncated: false, threadId: 'fixture', events: [] };
  }
  return { faults, runCommand, runHost, calls: () => calls, prompt: () => prompt };
}

test('JavaScript 쓰기 계획은 확장자별로 호스트 실행 전에 거부한다', async () => {
  const repo  = await fixture() ;
  const tools = fakeTools()     ;
  for (const file of ['src/item.mjs', 'src/item.jsx']) {
    await assert.rejects(runTypedWorkflow(options(repo, { writes: [file] }), tools), /JavaScript 작성 금지/);
  }
  assert.equal(tools.calls(), 0);
});

test('로컬 설정 누락과 잘못된 BoxBox JSON은 호스트 전에 실패한다', async () => {
  const repo  = await fixture() ;
  const tools = fakeTools()     ;
  tools.faults.invalidJSON = true;
  await assert.rejects(runTypedWorkflow(options(repo), tools), SyntaxError);
  await rm(path.join(repo, '.www/development.local.json'));
  await assert.rejects(runTypedWorkflow(options(repo), tools), /ENOENT/);
  assert.equal(tools.calls(), 0);
});

test('사전 소스·타입·BoxBox 오류를 호스트에 전달하고 수정 후 통과한다', async () => {
  const repo = await fixture();
  await put(repo, 'src/item.ts', '// @ts-ignore\nexport const value = 1;\n');
  const tools = fakeTools(() => put(repo, 'src/item.ts', 'export const value = 2;\n'));
  tools.faults.preType = true;
  tools.faults.preBoxbox = true;
  const result = await runTypedWorkflow(options(repo), tools);
  assert.equal(tools.calls(), 1);
  assert.match(tools.prompt(), /작성 하네스 관찰 데이터/);
  assert.match(tools.prompt(), /TS2322/);
  assert.match(tools.prompt(), /타입 검사 우회 주석 금지/);
  assert.match(tools.prompt(), /"misaligned":1/);
  assert.equal(record(result.harness).ok, true);
  assert.equal(record(result.harness).executor, 'injected');
});

test('사후 타입 오류나 BoxBox REFUSE는 호스트 성공과 별개로 실패한다', async () => {
  for (const fault of ['postType', 'postRefuse'] as const) {
    const repo  = await fixture() ;
    const tools = fakeTools()     ;
    tools.faults[fault] = true;
    const result = await runTypedWorkflow(options(repo), tools);
    assert.equal(record(result.host).ok, true);
    assert.equal(record(result.harness).ok, false);
    assert.match(JSON.stringify(record(result.harness).errors), fault === 'postType' ? /타입 검사/ : /BoxBox/);
  }
});

test('호스트가 선언하지 않은 TypeScript 파일을 쓰면 사후 실패한다', async () => {
  const repo   = await fixture()                                                         ;
  const tools  = fakeTools(() => put(repo, 'src/other.ts', 'export const other = 2;\n')) ;
  const result = await runTypedWorkflow(options(repo), tools)                            ;
  assert.equal(record(result.harness).ok, false);
  assert.match(JSON.stringify(record(result.harness).errors), /사전 선언하지 않은 TypeScript 변경: src\/other.ts/);
});

test('legacy JavaScript 삭제와 TypeScript 이관을 허용하며 미삭제는 실패한다', async () => {
  for (const remove of [true, false]) {
    const repo = await fixture(true);
    const tools = fakeTools(async () => {
      await put(repo, 'src/item.ts', 'export const old = 1;\n');
      if (remove) {
        await rm(path.join(repo, 'old.mjs'));
        const policy = JSON.parse(await readFile(path.join(repo, 'source-policy.json'), 'utf8'));
        policy.legacyJavaScript = [];
        await put(repo, 'source-policy.json', JSON.stringify(policy));
      }
    });
    const request = options(repo, { deletePaths: ['old.mjs'], writes: ['src/item.ts', 'source-policy.json'] });
    request.approval = { ...record(request.approval), writePaths: ['src/item.ts', 'old.mjs', 'source-policy.json'] };
    const result = await runTypedWorkflow(request, tools);
    assert.equal(tools.calls(), 1);
    assert.equal(record(result.harness).ok, remove);
    if (!remove) assert.match(JSON.stringify(record(result.harness).errors), /삭제 계획의 파일이 남아 있습니다: old.mjs/);
  }
});

test('실제 Node CLI는 JavaScript 쓰기를 exit 1로 거부한다', async () => {
  const repo = await fixture();
  assert.throws(() => execFileSync('node', [path.join(sourceRoot, 'scripts/workflow.ts'), JSON.stringify(options(repo, { writes: ['src/new.mjs'] }))], { encoding: 'utf8', stdio: 'pipe' }), error => {
    const failure = record(error);
    assert.equal(failure.status, 1);
    assert.match(String(failure.stderr), /JavaScript 작성 금지/);
    return true;
  });
});

test('preview와 정보 답변은 설정 없이 호스트를 실행하지 않는다', async () => {
  const repo = await fixture();
  await rm(path.join(repo, '.www/development.local.json'));
  const tools   = fakeTools()                                                                      ;
  const preview = await runTypedWorkflow(options(repo, { preview: true }), tools)                  ;
  const answer  = await runTypedWorkflow(options(repo, { decision: { intent: 'answer' } }), tools) ;
  assert.equal(preview.executed, false);
  assert.equal(preview.preview, true);
  assert.equal(answer.executed, false);
  assert.equal(record(answer.route).intent, 'answer');
  assert.equal(tools.calls(), 0);
});

test('사후 검사 도중 코드가 다시 바뀌면 이전 타입 통과를 현재 결과로 쓰지 않는다', async () => {
  const repo  = await fixture()                           ;
  let hosted  = false                                     ;
  const tools = fakeTools(async () => { hosted = true; }) ;
  const result = await runTypedWorkflow(options(repo), {
    runHost: tools.runHost,
    runCommand: async (command, args, cwd) => {
      const result = await tools.runCommand(command, args, cwd);
      if (hosted && args.includes('check')) await put(repo, 'src/item.ts', 'export const value: number = "late change";\n');
      return result;
    },
  });
  assert.equal(record(result.harness).ok, false);
  assert.match(JSON.stringify(record(result.harness).errors), /사후 검사 중/);
});

test('명시 스킬이나 요청 접두사가 선택한 build도 변경 계획을 요구한다', async () => {
  const repo = await fixture();
  for (const selection of [{ explicitSkill: 'www-build' }, { request: '/skill:www-build 수정' }]) {
    const request = options(repo, { ...selection, writes: [] });
    request.decision = { ...record(request.decision), intent: 'design' };
    request.approval = { ...record(request.approval), implementation: false };
    await assert.rejects(runTypedWorkflow(request, fakeTools()), /변경 계획/);
  }
  await assert.rejects(runTypedWorkflow(options(repo, { role: 'legacy', decision: {}, explicitSkill: 'www-build', writes: [] }), fakeTools()), /변경 계획/);
});

test('같은 작업 재개는 build 다음 단계여도 새 작성 계획이나 BoxBox 설정을 요구하지 않는다', async () => {
  const repo    = await fixture()                              ;
  const tools   = fakeTools()                                  ;
  const started = await runTypedWorkflow(options(repo), tools) ;
  await rm(path.join(repo, '.www/development.local.json'));
  const resumed = await runTypedWorkflow(options(repo, { writes: [], resume: true, decision: { intent: 'build', workId: started.workId } }), tools);
  assert.equal(resumed.resumed, true);
  assert.equal(tools.calls(), 1);
});

test('JavaScript를 만든 뒤 정책 해시를 고쳐도 사후 통과하지 못한다', async () => {
  for (const target of ['old.mjs', 'src/new.mjs']) {
    const repo = await fixture(true);
    const tools = fakeTools(async () => {
      const body = 'export const changed = 2;\n';
      await put(repo, target, body);
      const policy = JSON.parse(await readFile(path.join(repo, 'source-policy.json'), 'utf8'));
      policy.legacyJavaScript = policy.legacyJavaScript.filter((entry: { path: string }) => entry.path !== target);
      policy.legacyJavaScript.push({ path: target, sha256: createHash('sha256').update(body).digest('hex') });
      await put(repo, 'source-policy.json', JSON.stringify(policy));
    });
    const result = await runTypedWorkflow(options(repo), tools);
    assert.equal(tools.calls(), 1);
    assert.equal(record(result.harness).ok, false);
  }
});

test('선언된 정책 파일 변경도 legacy 허용 항목을 추가할 수 없다', async () => {
  const repo = await fixture(true);
  const tools = fakeTools(async () => {
    const policy = JSON.parse(await readFile(path.join(repo, 'source-policy.json'), 'utf8'));
    policy.legacyJavaScript.push({ path: 'future.mjs', sha256: 'a'.repeat(64) });
    await put(repo, 'source-policy.json', JSON.stringify(policy));
  });
  const request = options(repo, { writes: ['src/item.ts', 'source-policy.json'] });
  request.approval = { ...record(request.approval), writePaths: ['src/item.ts', 'source-policy.json'] };
  const result = await runTypedWorkflow(request, tools);
  assert.equal(tools.calls(), 1, JSON.stringify(result));
  assert.equal(record(result.harness).ok, false);
  assert.match(JSON.stringify(record(result.harness).errors), /동결 정책/);
});

test('선언하지 않은 타입 검사 설정 변경도 사후에 거부한다', async () => {
  const repo = await fixture();
  const tools = fakeTools(async () => {
    const config = JSON.parse(await readFile(path.join(repo, 'tsconfig.json'), 'utf8'));
    config.compilerOptions.target = 'ES2022';
    await put(repo, 'tsconfig.json', JSON.stringify(config));
  });
  const result = await runTypedWorkflow(options(repo), tools);
  assert.equal(record(result.harness).ok, false);
});
