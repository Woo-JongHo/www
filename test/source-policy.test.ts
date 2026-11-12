import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertTypeScriptWrites, checkSourcePolicy } from '../scripts/source-policy.ts';

const fixtures: string[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(repo => rm(repo, { recursive: true, force: true })));
});

async function fixture(legacy = ''): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), 'www-source-policy-'));
  fixtures.push(repo);
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  await writeFile(path.join(repo, 'entry.ts'), 'export const value = 1;\n');
  await writeFile(path.join(repo, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['*.ts'] }));
  const legacyJavaScript = legacy ? [{ path: 'old.mjs', sha256: createHash('sha256').update(legacy).digest('hex') }] : [];
  await writeFile(path.join(repo, 'source-policy.json'), JSON.stringify({ schemaVersion: 1, typecheckProjects: ['tsconfig.json'], archivedTypeScript: [], legacyJavaScript, excludedVendorPaths: ['skill-library/'] }));
  if (legacy) await writeFile(path.join(repo, 'old.mjs'), legacy);
  return repo;
}

test('새 JavaScript와 기존 JavaScript 수정은 거부하고 삭제는 허용한다', async () => {
  const repo = await fixture('export const old = 1;');
  expect((await checkSourcePolicy(repo)).ok).toBe(true);
  await writeFile(path.join(repo, 'old.mjs'), 'export const old = 2;');
  expect((await checkSourcePolicy(repo)).ok).toBe(false);
  execFileSync('git', ['add', 'old.mjs'], { cwd: repo });
  await rm(path.join(repo, 'old.mjs'));
  expect((await checkSourcePolicy(repo)).ok).toBe(true);
  await writeFile(path.join(repo, 'new.js'), '');
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('new.js');
});

test('실제 주석만 검사하며 템플릿·정규식·문자열은 보존한다', async () => {
  const repo = await fixture();
  await writeFile(path.join(repo, 'entry.ts'), 'const text = "// @ts-ignore"; const template = `// @ts-nocheck`; const regex = /@ts-ignore/;');
  expect((await checkSourcePolicy(repo)).ok).toBe(true);
  await writeFile(path.join(repo, 'entry.ts'), '// @ts-ignore\nexport const value = 1;');
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('우회 주석');
  await writeFile(path.join(repo, 'entry.ts'), '// @ts-expect-error\nexport const value = 1;');
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('설명');
});

test('컴파일러가 인식하는 블록 주석 지시문 우회를 거부한다', async () => {
  const repo = await fixture();
  for (const comment of ['/* note\n   @ts-ignore */', '/*/@ts-ignore */', '/* note\n   @ts-expect-error */', '/*/@ts-expect-error */', '// @TS-NOCHECK', '//@Ts-NoCheck']) {
    await writeFile(path.join(repo, 'entry.ts'), `${comment}\nexport const value: number = 'x';`);
    expect((await checkSourcePolicy(repo)).ok).toBe(false);
  }
});

test('구두점 토큰 앞의 주석과 지시문 접미사로 우회하지 못한다', async () => {
  const repo = await fixture();
  for (const suffix of ['.missing', '["missing"]', '? "a" : "b"', ', other = 1']) {
    for (const comment of ['// @ts-ignore', '/* @ts-ignore */', '// @ts-ignoreXYZ']) {
      await writeFile(path.join(repo, 'entry.ts'), `const obj = { a: 1 };\nexport const v = obj\n${comment}\n${suffix};`);
      expect((await checkSourcePolicy(repo)).ok).toBe(false);
    }
  }
});

test('프로젝트 밖 TypeScript와 strict/noCheck 우회를 거부한다', async () => {
  const repo = await fixture();
  await mkdir(path.join(repo, 'outside'));
  await writeFile(path.join(repo, 'outside/hidden.ts'), '');
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('outside/hidden.ts');
  await writeFile(path.join(repo, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: false, noEmit: true, noCheck: true } }));
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('strict=true');
});

test('심볼릭 링크는 읽지 않고 vendor 소스는 제외한다', async () => {
  const repo = await fixture();
  await symlink('entry.ts', path.join(repo, 'link.ts'));
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('일반 파일');
  await rm(path.join(repo, 'link.ts'));
  await mkdir(path.join(repo, 'skill-library'));
  await writeFile(path.join(repo, 'skill-library/upstream.js'), '');
  expect((await checkSourcePolicy(repo)).ok).toBe(true);
});

test('작성 목표는 안전한 상대경로 TypeScript 또는 문서만 허용한다', () => {
  assertTypeScriptWrites(['src/entry.ts', 'docs/spec.md', 'config.json']);
  for (const target of ['entry.js', 'entry.jsx', 'vendor/a.mjs', 'x.cjs', '../a.ts', '/a.ts', 'a\\b.ts', 'a\0.ts', 'C:/a.ts']) {
    expect(() => assertTypeScriptWrites([target])).toThrow();
  }
});


test('설명에 등장한 지시문은 허용하고 주석 시작 지시문은 거부한다', async () => {
  const repo = await fixture();
  await writeFile(path.join(repo, 'entry.ts'), '// do not use @ts-ignore\n/** example: @ts-ignore */\nexport const value = 1;');
  expect((await checkSourcePolicy(repo)).ok).toBe(true);
  await writeFile(path.join(repo, 'entry.ts'), '/** @ts-nocheck */\nexport const value = 1;');
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('우회 주석');
  await writeFile(path.join(repo, 'entry.jsx'), '');
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('entry.jsx');
});

test('외부 설정 심볼릭 링크를 읽지 않고 거부한다', async () => {
  const repo     = await fixture() ;
  const external = await fixture() ;
  await rm(path.join(repo, 'tsconfig.json'));
  await symlink(path.join(external, 'tsconfig.json'), path.join(repo, 'tsconfig.json'));
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('외부 설정');
});


test('동결 TypeScript는 정확한 경로·SHA만 예외이며 새 스파이크는 제외하지 않는다', async () => {
  const repo = await fixture();
  await mkdir(path.join(repo, 'spikes/tauri/src'), { recursive: true });
  const archivedPath = 'spikes/tauri/src/bridge.ts';
  await writeFile(path.join(repo, archivedPath), 'export {};');
  const policy: Record<string, unknown> = JSON.parse(await readFile(path.join(repo, 'source-policy.json'), 'utf8'));
  policy.archivedTypeScript = [{ path: archivedPath, sha256: createHash('sha256').update('export {};').digest('hex') }];
  await writeFile(path.join(repo, 'source-policy.json'), JSON.stringify(policy));
  expect((await checkSourcePolicy(repo)).ok).toBe(true);
  await writeFile(path.join(repo, archivedPath), 'export const changed = 1;');
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('동결 TypeScript 변경');
  await writeFile(path.join(repo, 'spikes/tauri/new.ts'), '');
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('spikes/tauri/new.ts');
  policy.archivedTypeScript = [{ path: 'spikes/tauri/new.ts', sha256: createHash('sha256').update('').digest('hex') }];
  await writeFile(path.join(repo, 'source-policy.json'), JSON.stringify(policy));
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('비교 파일 2개만');
});


test('strict=true라도 하위 strict 검사를 끄면 거부한다', async () => {
  const repo = await fixture();
  await writeFile(path.join(repo, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, noImplicitAny: false } }));
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('strict 하위 옵션을 끌 수 없습니다: noImplicitAny');
});


test('JSX 텍스트는 허용하고 JSX 표현식의 실제 지시문은 거부한다', async () => {
  const repo = await fixture();
  await writeFile(path.join(repo, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, jsx: 'react-jsx' }, include: ['*.ts', '*.tsx'] }));
  await writeFile(path.join(repo, 'view.tsx'), 'export const view = <pre>// @ts-ignore</pre>;\n');
  expect((await checkSourcePolicy(repo)).ok).toBe(true);
  await writeFile(path.join(repo, 'view.tsx'), 'export const view = <pre>{\n// @ts-ignore\nvalue\n}</pre>;\n');
  expect((await checkSourcePolicy(repo)).errors.join()).toContain('우회 주석');
});
