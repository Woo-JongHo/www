import { runReportedStage } from "./workflow/report-lifecycle.ts";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertTypeScriptWrites, checkSourcePolicy } from "./source-policy.ts";
import { runProcess, runWorkflow } from "./workflow/run.ts";
import { validateWritePaths } from "./workflow/preflight.ts";
import { namedSkill } from "./workflow/route.ts";
import type { ProcessInvocation, ProcessOptions } from "./workflow/adapters/gjc.ts";

type JsonObject = Record<string, unknown>;
type PolicyResult = Awaited<ReturnType<typeof checkSourcePolicy>>;

export interface CommandResult {
  code            : number | null ;
  stdout          : string        ;
  stderr          : string        ;
  outputTruncated : boolean       ;
}

interface HarnessDependencies {
  runCommand?: (command: string, args: string[], cwd: string) => Promise<CommandResult>;
  runHost?: (invocation: ProcessInvocation, context: ProcessOptions) => Promise<unknown>;
}

interface LocalSettings {
  boxboxNode     : string;
  boxboxLauncher : string;
}

interface BoxboxObservation {
  file       : string ;
  syntax     : string ;
  groups     : number ;
  misaligned : number ;
  refused    : number ;
  digest     : string ;
}

interface FrozenPolicy {
  legacyJavaScript   : Map<string, string>;
  archivedTypeScript : Map<string, string>;
}

const codeFile = /\.(?:ts|tsx|mts|cts)$/i                                                                                      ;
const hash     = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex")                          ;
const object   = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ;

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) throw new Error(`${field}는 문자열 배열이어야 합니다.`);
  return [...value];
}

async function command(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise(resolve => {
    const child             = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }) ;
    const stdout : Buffer[] = []                                                                                                ;
    const stderr : Buffer[] = []                                                                                                ;
    let size                = 0                                                                                                 ;
    let outputTruncated     = false                                                                                             ;
    const collect = (value: Buffer, error: boolean): void => {
      size += value.length;
      if (size > 1_048_576) { outputTruncated = true; child.kill(); return; }
      if (error) stderr.push(value);
      else stdout.push(value);
    };
    child.stdout.on("data", value => collect(value, false));
    child.stderr.on("data", value => collect(value, true));
    child.on("error", error => { stderr.push(Buffer.from(error.message)); });
    child.on("close", code => resolve({ code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), outputTruncated }));
  });
}

async function settings(repo: string, injectedTools: boolean): Promise<LocalSettings> {
  const value: unknown = JSON.parse(await readFile(path.join(repo, ".www", "development.local.json"), "utf8"));
  if (!object(value) || typeof value.boxboxNode !== "string" || typeof value.boxboxLauncher !== "string") {
    throw new Error(".www/development.local.json에 boxboxNode·boxboxLauncher 절대 경로를 설정하세요.");
  }
  for (const file of [value.boxboxNode, value.boxboxLauncher]) {
    if (!path.isAbsolute(file) || !(await lstat(file)).isFile()) throw new Error("BoxBox 설정은 실제 실행 파일·런처의 절대 경로여야 합니다.");
    await access(file);
  }
  if (path.basename(value.boxboxLauncher) !== "boxbox.mjs") throw new Error("BoxBox 설치 런처 boxbox.mjs를 지정하세요.");
  if (!injectedTools) {
    const launcher = await realpath(value.boxboxLauncher) ;
    const relative = path.relative(repo, launcher)        ;
    if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw new Error("저장소 밖에 설치된 BoxBox 런처를 지정하세요.");
    const runtime: unknown = JSON.parse(await readFile(path.resolve(path.dirname(launcher), "..", "runtime.json"), "utf8"));
    if (!object(runtime) || typeof runtime.node !== "string" || !path.isAbsolute(runtime.node)
      || await realpath(runtime.node) !== await realpath(value.boxboxNode)) throw new Error("BoxBox 설치본 runtime.json의 Node와 설정이 다릅니다.");
  }
  return { boxboxNode: value.boxboxNode, boxboxLauncher: value.boxboxLauncher };
}

function parseReport(result: CommandResult, file: string, guide: boolean): JsonObject {
  if (result.outputTruncated || ![0, 1, 2].includes(result.code ?? -1)) throw new Error(`BoxBox 실행 실패: ${file}`);
  const report: unknown = JSON.parse(result.stdout);
  if (!object(report) || report.tool !== "boxbox") throw new Error(`BoxBox 결과 출처 오류: ${file}`);
  if (report.error || (guide && (result.code === 2 || report.command !== "guide" || report.file !== file || !Array.isArray(report.columnSets)))) {
    throw new Error(`BoxBox 작성 안내 대상 오류: ${file}`);
  }
  return report;
}

async function boxbox(repo: string, local: LocalSettings, files: string[], before: boolean, run: NonNullable<HarnessDependencies["runCommand"]>) {
  const observations : BoxboxObservation[] = [] ;
  const guides       : JsonObject[]        = [] ;
  for (const file of files) {
    if (before) {
      const result = await run(local.boxboxNode, [local.boxboxLauncher, "guide", "--file", file, "--authoring", "--json"], repo);
      guides.push(parseReport(result, file, true));
      try { await lstat(path.join(repo, file)); }
      catch (error) { if (object(error) && error.code === "ENOENT") continue; throw error; }
    }
    const result = await run(local.boxboxNode, [local.boxboxLauncher, "check", "--source", "--file", file, "--json"], repo) ;
    const report = parseReport(result, file, false)                                                                         ;
    const item   = Array.isArray(report.results) ? report.results[0] : null                                                 ;
    if (!object(item) || item.file !== file || !object(item.summary) || !object(report.syntax)) throw new Error(`BoxBox 검사 대상·구문 결과 누락: ${file}`);
    const summary = item.summary;
    if (![summary.groups, summary.misaligned, summary.refused].every(value => Number.isSafeInteger(value) && Number(value) >= 0)) {
      throw new Error(`BoxBox 검사 집계 오류: ${file}`);
    }
    observations.push({ file, syntax: String(report.syntax.status), groups: Number(summary.groups), misaligned: Number(summary.misaligned), refused: Number(summary.refused), digest: hash(result.stdout) });
  }
  return { observations, guides };
}

async function typecheck(repo: string, policy: PolicyResult, run: NonNullable<HarnessDependencies["runCommand"]>): Promise<CommandResult[]> {
  const results: CommandResult[] = []                                                          ;
  const compiler                 = path.join(repo, "node_modules", "typescript", "bin", "tsc") ;
  await access(compiler);
  for (const project of policy.projects) {
    const result = await run(process.execPath, [compiler, "--noEmit", "--project", project], repo);
    if (result.outputTruncated || ![0, 1, 2].includes(result.code ?? -1)
      || (result.code !== 0 && !/error TS\d+/.test(result.stdout + result.stderr))) throw new Error("타입 검사 도구 실행에 실패했습니다.");
    results.push(result);
  }
  return results;
}

async function fingerprints(repo: string, files: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const file of files) {
    const target = path.join(repo, file);
    if (!(await lstat(target)).isFile()) throw new Error(`검사 대상은 일반 파일이어야 합니다: ${file}`);
    result.set(file, hash(await readFile(target)));
  }
  return result;
}

async function frozenPolicy(repo: string): Promise<FrozenPolicy> {
  const raw: unknown = JSON.parse(await readFile(path.join(repo, "source-policy.json"), "utf8"));
  if (!object(raw)) throw new Error("동결 정책 객체를 확인할 수 없습니다.");
  const entries = (value: unknown): Map<string, string> => {
    if (!Array.isArray(value)) throw new Error("동결 정책 항목은 배열이어야 합니다.");
    const result = new Map<string, string>();
    for (const item of value) {
      if (!object(item) || typeof item.path !== "string" || typeof item.sha256 !== "string") throw new Error("동결 정책의 경로·해시가 필요합니다.");
      result.set(item.path, item.sha256);
    }
    return result;
  };
  return { legacyJavaScript: entries(raw.legacyJavaScript), archivedTypeScript: entries(raw.archivedTypeScript ?? []) };
}

function policyChanges(before: FrozenPolicy, after: FrozenPolicy, writes: string[], deletions: string[]): string[] {
  const errors: string[] = [];
  for (const field of ["legacyJavaScript", "archivedTypeScript"] as const) {
    for (const [file, digest] of after[field]) {
      if (before[field].get(file) !== digest) errors.push(`작성 실행에서 동결 정책의 허용 항목 추가·해시 갱신은 금지됩니다: ${file}`);
    }
    for (const file of before[field].keys()) {
      if (!after[field].has(file) && !deletions.includes(file) && !(field === "archivedTypeScript" && writes.includes(file))) {
        errors.push(`동결 예외 제거에는 해당 파일의 삭제·TypeScript 편입 계획이 필요합니다: ${file}`);
      }
    }
  }
  return errors;
}

function checkedFiles(policy: PolicyResult): string[] {
  return [...new Set([...policy.typescriptFiles, ...policy.legacyJavaScript, ...policy.projects, "source-policy.json"])].sort();
}

function sameFiles(left: Map<string, string>, right: Map<string, string>): boolean {
  return left.size === right.size && [...left].every(([file, digest]) => right.get(file) === digest);
}

function withGuidance(invocation: ProcessInvocation, guidance: string): ProcessInvocation {
  if (typeof invocation.stdin === "string") return { ...invocation, stdin: `${invocation.stdin}\n\n작성 하네스 관찰 데이터\n${guidance}` };
  const args  = strings     (invocation.args, "호스트 argv") ;
  const index = args.indexOf("--append-system-prompt"      ) ;
  if (index < 0 || typeof args[index + 1] !== "string") throw new Error("호스트의 작성 안내 전달 경로를 확인할 수 없습니다.");
  args[index + 1] += `\n\n작성 하네스 관찰 데이터\n${guidance}`;
  return { ...invocation, args };
}

async function runTypedWorkflowCore(options: JsonObject, dependencies: HarnessDependencies = {}): Promise<JsonObject> {
  const decision     = object(options.decision) ? options.decision : {}  ;
  const writes       = strings(options.writes ?? [], "writes")           ;
  const deletions    = strings(options.deletePaths ?? [], "deletePaths") ;
  const roleDecision = options.role === "www-dev"                        ;
  const control = roleDecision
    && (options.resume === true
      || ["answer", "verify", "review", "complete"].includes(String(decision.intent)));
  const selected = options.explicitSkill ?? namedSkill(options.request)
    ?? (roleDecision && typeof decision.intent === "string" ? `www-${decision.intent}` : null);
  const authoring = options.execute === true && options.preview !== true && !control
    && (selected === "www-build" || writes.length > 0 || deletions.length > 0);
  if (!authoring) {
    const result: unknown = await runWorkflow(options);
    if (!object(result)) throw new Error("개발 실행 결과가 객체가 아닙니다.");
    return result;
  }
  if (options.direct !== true || typeof options.request !== "string" || !options.request.trim()) throw new Error("직접 받은 요청만 저작 하네스로 실행할 수 있습니다.");
  if (!writes.length && !deletions.length) throw new Error("저작 실행에는 writes 또는 deletePaths로 변경 계획을 선언하세요.");
  assertTypeScriptWrites(writes);
  for (const file of deletions) assertTypeScriptWrites([file.replace(/\.(?:js|jsx|mjs|cjs)$/i, ".ts")]);
  const binding       = object(options.binding) ? options.binding : {} ;
  const requestedRepo = options.repo ?? binding.repo ?? process.cwd()  ;
  if (typeof requestedRepo !== "string") throw new Error("저장소 경로가 올바르지 않습니다.");
  const repo = await realpath(requestedRepo);
  if (typeof binding.repo === "string" && await realpath(binding.repo) !== repo) throw new Error("실행 저장소와 binding 저장소가 다릅니다.");
  await validateWritePaths(repo, [...writes, ...deletions]);
  const local     = await settings(repo, Boolean(dependencies.runCommand)) ;
  const run       = dependencies.runCommand ?? command                     ;
  const prePolicy = await checkSourcePolicy(repo)                          ;
  if (!prePolicy.projects.length) throw new Error(prePolicy.errors.join("; "));
  const before       = await fingerprints(repo, checkedFiles(prePolicy)) ;
  const frozenBefore = await frozenPolicy(repo)                          ;
  const targets      = writes.filter(file => codeFile.test(file))        ;
  const preTypes     = await typecheck(repo, prePolicy, run)             ;
  const preBoxbox    = await boxbox(repo, local, targets, true, run)     ;
  const guidance = JSON.stringify({
    policy:
      "새 앱·Node 실행 코드는 TypeScript로 작성하고 우회 주석이나 legacy 해시 갱신으로 검사를 통과시키지 않는다.",
    source    : prePolicy ,
    typecheck : preTypes  ,
    boxbox    : preBoxbox
  });
  if (Buffer.byteLength(guidance) > 1_048_576) throw new Error("작성 안내가 너무 큽니다. 변경 범위를 나누세요.");
  const runHost = dependencies.runHost ?? ((
    invocation : ProcessInvocation,
    context    : ProcessOptions
  ) => runProcess(invocation, context));
  const executionOptions: JsonObject = { ...options, repo, writes: [...new Set([...writes, ...deletions])] };
  delete executionOptions.boxboxLauncher;
  delete executionOptions.boxboxFiles;
  const result: unknown = await runWorkflow(executionOptions, {
    runProcess: (invocation: ProcessInvocation, context: ProcessOptions) => runHost(withGuidance(invocation, guidance), context),
  });
  if (!object(result)) throw new Error("개발 실행 결과가 객체가 아닙니다.");
  const postPolicy = await checkSourcePolicy(repo)                                                                          ;
  const after      = await fingerprints(repo, checkedFiles(postPolicy))                                                     ;
  const changed    = [...new Set([...before.keys(), ...after.keys()])].filter(file => before.get(file) !== after.get(file)) ;
  const errors     = [...postPolicy.errors, ...policyChanges(frozenBefore, await frozenPolicy(repo), writes, deletions)]    ;
  for (const file of changed) {
    if (!writes.includes(file) && !deletions.includes(file)) errors.push(`사전 선언하지 않은 ${codeFile.test(file) ? "TypeScript" : "소스·설정"} 변경: ${file}`);
  }
  for (const file of deletions) {
    try { await lstat(path.join(repo, file)); errors.push(`삭제 계획의 파일이 남아 있습니다: ${file}`); }
    catch (error) { if (!(object(error) && error.code === "ENOENT")) throw error; }
  }
  const postTypes    = await typecheck(repo, postPolicy, run)                                                                                               ;
  const postBoxbox   = await boxbox(repo, local, [...new Set([...targets, ...changed])].filter(file => codeFile.test(file) && after.has(file)), false, run) ;
  const finalPolicy  = await checkSourcePolicy(repo)                                                                                                        ;
  const sourceStable = sameFiles(after, await fingerprints(repo, checkedFiles(finalPolicy)))                                                                ;
  errors.push(...finalPolicy.errors);
  if (!sourceStable) errors.push("사후 검사 중 소스 또는 프로젝트 설정이 바뀌었습니다. 다시 검사하세요.");
  if (postTypes.some(item => item.code !== 0 || item.outputTruncated)) errors.push("작성 후 타입 검사가 통과하지 않았습니다.");
  if (postBoxbox.observations.some(item => item.syntax !== "valid" || item.misaligned > 0 || item.refused > 0)) errors.push("작성 후 BoxBox 미해결 항목이 있습니다.");
  return {
    ...result,
    harness: {
      ok           : errors.length === 0                              ,
      errors       : [...new Set(errors)]                             ,
      executor     : dependencies.runHost ? "injected" : "process"    ,
      toolExecutor : dependencies.runCommand ? "injected" : "process" ,
      sourceStable,
      pre  : {
        source    : prePolicy ,
        typecheck : preTypes  ,
        boxbox    : preBoxbox.observations
      },
      post : {
        source    : finalPolicy ,
        typecheck : postTypes   ,
        boxbox    : postBoxbox.observations
      }
    }
  };
}

export async function runTypedWorkflow(options: JsonObject, dependencies: HarnessDependencies = {}): Promise<JsonObject> {
  return runReportedStage(options, () => runTypedWorkflowCore(options, dependencies));
}

function exitCode(result: JsonObject): number {
  if (object(result.reportHook) && result.reportHook.status === "failed") return 1;
  if (object(result.harness) && result.harness.ok !== true) return 1;
  if ((object(result.mutation) && result.mutation.ok === false)
    || result.confirmation === true) return 2;
  if ((object(result.host) && result.host.ok === false)
    || result.postError
    || (object(result.verification) && result.verification.result === "failed")
    || (object(result.review) && result.review.verdict !== "pass")) return 1;
  if (result.executed
    && object(result.verificationSummary)
    && result.verificationSummary.result !== "passed") return 1;
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options: unknown = JSON.parse(process.argv[2] ?? "null");
    if (!object(options)) throw new Error("JSON 옵션 객체 하나가 필요합니다.");
    const result = await runTypedWorkflow(options);
    console.log(JSON.stringify(result));
    process.exitCode = exitCode(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
