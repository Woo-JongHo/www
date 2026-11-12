import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

interface SourcePin {
  path   : string ;
  sha256 : string ;
}

interface SourcePolicy {
  schemaVersion       : 1           ;
  typecheckProjects   : string[]    ;
  legacyJavaScript    : SourcePin[] ;
  excludedVendorPaths : string[]    ;
  archivedTypeScript  : SourcePin[] ;
}

interface SourcePolicyResult {
  ok               : boolean  ;
  errors           : string[] ;
  legacyJavaScript : string[] ;
  typescriptFiles  : string[] ;
  projects         : string[] ;
}

const javascript = /\.(?:js|jsx|mjs|cjs)$/i ;
const typescript = /\.(?:ts|tsx|mts|cts)$/i ;

function safePath(value: string): boolean {
  return value.length > 0 && !path.posix.isAbsolute(value)
    && !/^[A-Za-z]:/.test(value) && !value.includes('\\') && !value.includes('\0')
    && value.split('/').every(part => part !== '..' && part !== '.' && part !== '');
}

export function assertTypeScriptWrites(writes: string[]): void {
  for (const target of writes) {
    if (!safePath(target)) throw new Error(`안전하지 않은 작성 경로: ${target}`);
    if (javascript.test(target)) throw new Error(`JavaScript 작성 금지: ${target}; TypeScript로 전환하세요.`);
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePolicy(value: unknown): SourcePolicy {
  if (!object(value) || value.schemaVersion !== 1
    || !Array.isArray(value.typecheckProjects) || value.typecheckProjects.length === 0
    || !value.typecheckProjects.every(item => typeof item === 'string' && safePath(item))
    || new Set(value.typecheckProjects).size !== value.typecheckProjects.length
    || !Array.isArray(value.excludedVendorPaths) || value.excludedVendorPaths.length !== 1
    || value.excludedVendorPaths[0] !== 'skill-library/' || !Array.isArray(value.legacyJavaScript)) {
    throw new Error('source-policy.json 스키마가 올바르지 않습니다.');
  }
  const seen                          = new Set<string>() ;
  const legacyJavaScript: SourcePin[] = []                ;
  for (const entry of value.legacyJavaScript) {
    if (!object(entry) || typeof entry.path !== 'string' || !safePath(entry.path)
      || !javascript.test(entry.path) || seen.has(entry.path)
      || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error('legacyJavaScript 경로·SHA256·중복을 확인하세요.');
    }
    seen.add(entry.path);
    legacyJavaScript.push({ path: entry.path, sha256: entry.sha256 });
  }
  const archivedTypeScript : SourcePin[] = []                             ;
  const archived           : unknown     = value.archivedTypeScript ?? [] ;
  if (!Array.isArray(archived)) throw new Error('archivedTypeScript 배열이 필요합니다.');
  for (const entry of archived) {
    if (!object(entry) || (entry.path !== 'spikes/tauri/build.ts' && entry.path !== 'spikes/tauri/src/bridge.ts')
      || archivedTypeScript.some(item => item.path === entry.path)
      || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error('archivedTypeScript는 동결된 Tauri 비교 파일 2개만 허용합니다.');
    }
    archivedTypeScript.push({ path: entry.path, sha256: entry.sha256 });
  }
  return {
    schemaVersion       : 1                       ,
    typecheckProjects   : value.typecheckProjects ,
    legacyJavaScript                              ,
    excludedVendorPaths : ['skill-library/']      ,
    archivedTypeScript                            ,
  };
}

function directiveErrors(source: string, filename: string): string[] {
  const errors: string[] = [];
  // AST의 토큰 범위를 사용하면 템플릿·정규식·JSX 안의 텍스트를 주석으로 오인하지 않는다.
  const sourceFile                                      = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true) ;
  const ranges                                          = new Map<number, ts.CommentRange>()                                  ;
  const literalRanges: { start: number; end: number }[] = []                                                                  ;
  function visit(node: ts.Node): void {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node)
      || ts.isTemplateTail(node) || ts.isRegularExpressionLiteral(node) || ts.isJsxText(node)) {
      literalRanges.push({ start: ts.isJsxText(node) ? node.pos : node.getStart(sourceFile), end: node.end });
    }
    for (const range of ts.getLeadingCommentRanges(source, node.pos) ?? []) ranges.set(range.pos, range);
    for (const range of ts.getTrailingCommentRanges(source, node.end) ?? []) ranges.set(range.pos, range);
    // 구두점도 순회해야 별도 줄의 점·괄호 앞 지시문을 빠뜨리지 않는다.
    for (const child of node.getChildren(sourceFile)) visit(child);
  }
  visit(sourceFile);
  for (const range of ranges.values()) {
    if (literalRanges.some(literal => range.pos >= literal.start && range.pos < literal.end)) continue;
    const comment   = source.slice(range.pos, range.end)                                      ;
    const directive = /^\s*(?:\/|\*)*\s*@(ts-nocheck|ts-ignore|ts-expect-error)([^\r\n]*)/gim ;
    for (const match of comment.matchAll(directive)) {
      if (match[1]?.toLowerCase() !== 'ts-expect-error') errors.push(`${filename}: 타입 검사 우회 주석 금지`);
      else if (!match[2]?.replace(/\*\/$/, '').trim()) {
        errors.push(`${filename}: @ts-expect-error에 negative type-test 설명이 필요합니다.`);
      }
    }
  }
  return errors;
}

export async function checkSourcePolicy(repo: string): Promise<SourcePolicyResult> {
  const errors           : string[] = [] ;
  const legacyJavaScript : string[] = [] ;
  const typescriptFiles  : string[] = [] ;
  const projects         : string[] = [] ;
  const result = (): SourcePolicyResult => ({
    ok: errors.length === 0 ,
    errors                  ,
    legacyJavaScript        ,
    typescriptFiles         ,
    projects
  });
  let policy : SourcePolicy ;
  let files  : string[]     ;
  try {
    policy = parsePolicy(JSON.parse(await readFile(path.join(repo, 'source-policy.json'), 'utf8')) as unknown);
    files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean))];
  } catch (error: unknown) {
    errors.push(error instanceof Error ? error.message : String(error));
    return result();
  }
  const root = await realpath(repo);
  const inside = (file: string): boolean => {
    const relative = path.relative(root, file);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  const readConfig = (file: string): string | undefined => {
    try {
      if (!inside(realpathSync(file))) {
        errors.push(`${file}: 저장소 외부 설정 파일은 읽을 수 없습니다.`);
        return undefined;
      }
      return ts.sys.readFile(file);
    } catch { return undefined; }
  };
  const baseline = new Map(policy.legacyJavaScript.map(entry => [entry.path, entry.sha256]));
  for (const file of files.sort()) {
    if (policy.excludedVendorPaths.some(prefix => file.startsWith(prefix))) continue;
    if (!javascript.test(file) && !typescript.test(file)) continue;
    const fullPath = path.resolve(repo, file);
    let stat;
    try { stat = await lstat(fullPath); } catch (error: unknown) {
      if (object(error) && error.code === 'ENOENT') continue;
      errors.push(`${file}: 파일 상태 확인 실패`);
      continue;
    }
    if (!safePath(file) || stat.isSymbolicLink() || !stat.isFile() || !inside(await realpath(fullPath))) {
      errors.push(`${file}: 소스는 안전한 일반 파일이어야 합니다.`);
      continue;
    }
    const bytes = await readFile(fullPath);
    if (javascript.test(file)) {
      legacyJavaScript.push(file);
      if (baseline.get(file) !== createHash('sha256').update(bytes).digest('hex')) {
        errors.push(`${file}: 신규·변경 JavaScript는 TypeScript로 전환해야 합니다.`);
      }
    } else {
      typescriptFiles.push(file);
      const archive = policy.archivedTypeScript.find(entry => entry.path === file);
      if (archive && archive.sha256 !== createHash('sha256').update(bytes).digest('hex')) {
        errors.push(`${file}: 동결 TypeScript 변경 시 예외를 제거하고 타입 검사에 편입해야 합니다.`);
      }
      errors.push(...directiveErrors(bytes.toString('utf8'), file));
    }
  }
  const archived = new Map(policy.archivedTypeScript.map(entry => [entry.path, entry.sha256])) ;
  const covered  = new Set<string>()                                                           ;
  for (const project of policy.typecheckProjects) {
    projects.push(project);
    const configPath = path.resolve       (repo, project         ) ;
    const config     = ts  .readConfigFile(configPath, readConfig) ;
    if (config.error) {
      errors.push(`${project}: ${ts.flattenDiagnosticMessageText(config.error.messageText, '\n')}`);
      continue;
    }
    const parsed = ts.parseJsonConfigFileContent(config.config, { ...ts.sys, readFile: readConfig }, path.dirname(configPath), undefined, configPath);
    for (const error of parsed.errors) errors.push(`${project}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
    const strictFlags: (keyof ts.CompilerOptions)[] = [
      'noImplicitAny', 'noImplicitThis', 'strictNullChecks', 'strictFunctionTypes',
      'strictBindCallApply', 'strictPropertyInitialization', 'alwaysStrict',
      'useUnknownInCatchVariables', 'strictBuiltinIteratorReturn',
    ];
    const disabledStrictFlags = strictFlags.filter(flag => parsed.options[flag] === false);
    if (disabledStrictFlags.length > 0) {
      errors.push(`${project}: strict 하위 옵션을 끌 수 없습니다: ${disabledStrictFlags.join(', ')}`);
      continue;
    }
    if (parsed.options.strict !== true || parsed.options.noEmit !== true || parsed.options.noCheck === true) {
      errors.push(`${project}: strict=true, noEmit=true, noCheck 비활성화가 필요합니다.`);
      continue;
    }
    if (parsed.errors.length === 0) for (const file of parsed.fileNames) covered.add(path.resolve(file));
  }
  for (const file of typescriptFiles) {
    if (!archived.has(file) && !covered.has(path.resolve(repo, file))) errors.push(`${file}: strict/noEmit 타입 검사 프로젝트에 포함되지 않았습니다.`);
  }
  return result();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkSourcePolicy(process.cwd());
  for (const error of result.errors) console.error(error);
  console.log(`소스 정책: ${result.ok ? '통과' : '실패'} (TypeScript ${result.typescriptFiles.length}, 기존 JavaScript ${result.legacyJavaScript.length})`);
  if (!result.ok) process.exitCode = 1;
}
