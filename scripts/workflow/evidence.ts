/**
 * @architecture arch.development.evidence.verification
 * @implements RESP-DEVELOPMENT-EVIDENCE-VERIFICATION
 */
import { createHash, randomUUID }    from "node:crypto";
import { spawn, execFile }           from "node:child_process";
import { constants, promises as fs } from "node:fs";
import path                          from "node:path";
import { promisify }                 from "node:util";


export interface CapturedFile {
  path    : string                           ;
  type    : 'file' | 'directory' | 'missing' ;
  digest? : string                           ;
  mode?   : number                           ;
}
export interface CapturedSource {
  digest : string         ;
  inputs : string[]       ;
  files  : CapturedFile[] ;
  head   : string | null  ;
}
export type SourceSnapshot = CapturedSource;
export type SourceFile = CapturedFile;
export interface ExecutionEnvironment {
  platform   : string                                  ;
  arch       : string                                  ;
  node       : string                                  ;
  executable : { path: string; digest: string } | null ;
}
export interface Artifact {
  path   : string ;
  size   : number ;
  digest : string ;
}
export interface CriterionDefinition {
  id              : string   ;
  description     : string   ;
  required        : boolean  ;
  requirementRefs : string[] ;
}
export interface OutputSummary {
  bytes           : number  ;
  digest          : string  ;
  truncated       : boolean ;
  retainedBytes   : number  ;
  contentRetained : boolean ;
}
export interface CommandInvocation {
  command : string   ;
  args    : string[] ;
}
export interface CommandResult {
  code?            : number | null                                    ;
  signal?          : string | null                                    ;
  error?           : string | null                                    ;
  stdout?          : string                                           ;
  stderr?          : string                                           ;
  outputTruncated? : boolean                                          ;
  output?          : { stdout: OutputSummary; stderr: OutputSummary } ;
}
export type VerificationRunner = (invocation: CommandInvocation, options: { cwd: string; captureOutput?: boolean }) => Promise<CommandResult> | CommandResult;
export interface VerificationEnvironmentObservation {
  version: 1;
  tools: string[];
  environmentPaths: string[];
  digest: string | null;
}
export interface VerificationAttempt {
  id                : string                  ;
  startedAt         : string                  ;
  completedAt       : string                  ;
  source            : CapturedSource          ;
  criteriaDigest    : string                  ;
  criteriaSnapshot  : CriterionDefinition[]   ;
  command           : string                  ;
  requestedCommand  : string                  ;
  args              : string[]                ;
  argumentsRedacted : boolean                 ;
  exitCode          : number | null           ;
  signal            : string | null           ;
  error             : string | null           ;
  result            : 'passed' | 'failed'     ;
  criterionIds      : string[]                ;
  sourceStable      : boolean                 ;
  artifacts?        : Artifact[]              ;
  artifactsStable?  : boolean                 ;
  environment       : ExecutionEnvironment    ;
  environmentStable : boolean                 ;
  environmentObservation?: VerificationEnvironmentObservation;
  executor          : 'injected' | 'process'  ;
  output?           : CommandResult['output'] ;
}
export interface EvidenceEvaluation {
  usable  : boolean  ;
  reasons : string[] ;
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function errorCode(error: unknown): unknown { return object(error) ? error.code : undefined; }

export function validEnvironmentObservation(value: unknown): value is VerificationEnvironmentObservation {
  const strings = (items: unknown): items is string[] => Array.isArray(items) && items.every(item => typeof item === 'string' && item.trim().length > 0 && !item.includes('\0'));
  return object(value) && value.version === 1 && strings(value.tools) && value.tools.length > 0
    && strings(value.environmentPaths) && (value.digest === null || typeof value.digest === 'string' && /^[a-f0-9]{64}$/.test(value.digest));
}

const exec         = promisify(execFile)                               ;
const EXCLUDED     = new Set([".git", ".www", "node_modules", "dist"]) ;
const HASH         = /^[a-f0-9]{64}$/                                  ;
const OUTPUT_LIMIT = 65_536                                            ;

function digest(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
export async function resolveExecutionEnvironment(root: string, command: string): Promise<ExecutionEnvironment> {
  const candidates = path.isAbsolute(command) || command.includes("/")
    ? [path.resolve(root, command)]
    : (process.env.PATH ?? "").split(path.delimiter).map((directory) => path.resolve(root, directory || ".", command));
  let executable: ExecutionEnvironment["executable"] = null;
  for (const candidate of candidates) {
    try {
      await fs.access(candidate, constants.X_OK);
      const resolved = await fs.realpath(candidate);
      if (!(await fs.stat(resolved)).isFile()) continue;
      executable = { path: resolved, digest: digest(await fs.readFile(resolved)) };
      break;
    } catch (error) {
      if (!["ENOENT", "ENOTDIR", "EACCES"].includes(String(errorCode(error)))) throw error;
    }
  }
  return { platform: process.platform, arch: process.arch, node: process.version, executable };
}

function sameEnvironment(left: ExecutionEnvironment | undefined, right: ExecutionEnvironment) {
  return   left?.platform           === right.platform
        && left?.arch               === right.arch
        && left?.executable?.path   === right.executable?.path
        && left?.executable?.digest === right.executable?.digest;
}

function inputPaths(inputs: unknown): string[] {
  if (!Array.isArray(inputs) || !inputs.length) throw new Error("검증 대상 경로가 하나 이상 필요합니다.");
  const paths = inputs.map((value) => {
    if (typeof value !== "string" || !value.trim() || path.isAbsolute(value) || /^[A-Za-z]:/.test(value) || /[\\\x00]/.test(value) || value.split("/").includes("..")) {
      throw new Error("검증 대상은 저장소 내부 상대 경로여야 합니다.");
    }
    const normalized = path.posix.normalize(value);
    if (normalized.split("/").some((part) => EXCLUDED.has(part))) throw new Error("자동 제외 경로는 검증 입력으로 지정할 수 없습니다.");
    return normalized;
  });
  return [...new Set(paths)].sort();
}

async function assertParents(root: string, relative: string) {
  let current = root;
  for (const part of relative.split("/").filter((value) => value && value !== ".")) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("검증 입력의 심볼릭 링크는 허용되지 않습니다.");
    } catch (error) {
      if (errorCode(error) === "ENOENT") return;
      throw error;
    }
  }
}

async function captureArtifacts(root: string, artifactPaths: unknown): Promise<Artifact[]> {
  if (!Array.isArray(artifactPaths)) throw new Error("원문 아티팩트 경로는 배열이어야 합니다.");
  const selected = [...new Set(artifactPaths.map((value) => {
    if (typeof value !== "string" || !value.trim() || path.isAbsolute(value) || /^[A-Za-z]:/.test(value) || /[\\\x00]/.test(value) || value.split("/").includes("..")) {
      throw new Error("원문 아티팩트는 저장소 내부 상대 파일 경로여야 합니다.");
    }
    return path.posix.normalize(value);
  }))].sort();
  const artifacts: Artifact[] = [];
  for (const relative of selected) {
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("원문 아티팩트가 저장소를 벗어납니다.");
    await assertParents(root, relative);
    if (!(await fs.lstat(target)).isFile()) throw new Error("원문 아티팩트는 일반 파일이어야 합니다.");
    const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      if (!(await handle.stat()).isFile()) throw new Error("원문 아티팩트는 일반 파일이어야 합니다.");
      const content = await handle.readFile();
      artifacts.push({ path: relative, size: content.length, digest: digest(content) });
    } finally { await handle.close(); }
  }
  return artifacts;
}

function artifactIdentity(artifacts: Artifact[]) {
  return JSON.stringify(artifacts.map(({ path: file, size, digest: hash }) => ({ path: file, size, digest: hash })));
}

export async function captureSource({ repo, inputs }: { repo?: string; inputs?: unknown } = {}): Promise<CapturedSource> {
  const root = await fs.realpath(repo ?? process.cwd());
  if (!(await fs.stat(root)).isDirectory()) throw new Error("저장소 경로가 디렉터리가 아닙니다.");
  const selected = inputPaths(inputs)              ;
  const captured = new Map<string, CapturedFile>() ;
  async function visit(relative: string) {
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("검증 입력이 저장소를 벗어납니다.");
    let stat;
    try { stat = await fs.lstat(target); }
    catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
      captured.set(relative, { path: relative, type: "missing" });
      return;
    }
    if (stat.isSymbolicLink()) throw new Error("검증 입력의 심볼릭 링크는 허용되지 않습니다.");
    if (stat.isDirectory()) {
      captured.set(relative, { path: relative, type: "directory" });
      for (const name of (await fs.readdir(target)).sort()) {
        if (!EXCLUDED.has(name)) await visit(relative === "." ? name : `${relative}/${name}`);
      }
      return;
    }
    if (!stat.isFile()) throw new Error("검증 입력에 일반 파일이 아닌 항목이 있습니다.");
    captured.set(relative, { path: relative, type: "file", digest: digest(await fs.readFile(target)), mode: stat.mode & 0o777 });
  }
  for (const relative of selected) {
    await assertParents(root, relative);
    await visit(relative);
  }
  const files = [...captured.values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0) ;
  let head    = null                                                                                                       ;
  try { head = (await exec("git", ["-C", root, "rev-parse", "--verify", "HEAD"])).stdout.trim(); }
  catch (error) { if (errorCode(error) !== 128) throw error; }
  return { head, digest: digest(JSON.stringify({ inputs: selected, files })), inputs: selected, files };
}

export function criterionDefinitions(record: unknown): CriterionDefinition[] {
  if (!object(record) || !Array.isArray(record.criteria) || !record.criteria.length) throw new Error("수용 기준 정의가 필요합니다.");
  const seen = new Set<string>();
  return record.criteria.map((criterion) => {
    if (!object(criterion) || typeof criterion.id !== "string" || !criterion.id.trim() || seen.has(criterion.id) || typeof criterion.description !== "string" || !criterion.description.trim() || typeof criterion.required !== "boolean") {
      throw new Error("수용 기준의 ID·설명·필수 여부가 올바르지 않습니다.");
    }
    seen.add(criterion.id);
    const refs = criterion.requirementRefs ?? [];
    if (!Array.isArray(refs) || refs.some((ref) => typeof ref !== "string" || !ref.trim())) throw new Error("요구사항 참조는 비어 있지 않은 문자열 배열이어야 합니다.");
    return { id: criterion.id, description: criterion.description, required: criterion.required, requirementRefs: [...new Set(refs)].sort() };
  }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

export function criteriaDigest(record: unknown) { return digest(JSON.stringify(criterionDefinitions(record))); }

function coverage(record: unknown, criterionIds: unknown): string[] {
  const known = new Set(criterionDefinitions(record).map((criterion) => criterion.id));
  if (!Array.isArray(criterionIds) || !criterionIds.length || new Set(criterionIds).size !== criterionIds.length || criterionIds.some((id) => typeof id !== "string" || !known.has(id))) {
    throw new Error("검증 범위에는 중복 없는 실제 수용 기준 ID가 하나 이상 필요합니다.");
  }
  return [...criterionIds].sort();
}

function outputSummary(value: unknown = "", truncated = false): OutputSummary {
  const bytes  = Buffer.from    (String(value)  ) ;
  const sample = bytes .subarray(0, OUTPUT_LIMIT) ;
  return { bytes: bytes.length, digest: digest(sample), truncated: truncated || bytes.length > OUTPUT_LIMIT, retainedBytes: sample.length, contentRetained: false };
}

function streamSummary(value: { bytes: number; captured: number; hash: ReturnType<typeof createHash> }): OutputSummary { return { bytes: value.bytes, digest: value.hash.digest("hex"), truncated: value.bytes > OUTPUT_LIMIT, retainedBytes: value.captured, contentRetained: false }; }

export async function runVerificationCommand(invocation: CommandInvocation, { cwd }: { cwd: string }): Promise<CommandResult> {
  return new Promise((resolve) => {
    const streams = Object.fromEntries(["stdout", "stderr"].map((name) => [
      name,
      {
        bytes    : 0 ,
        captured : 0 ,
        hash     : createHash("sha256")
      }
    ]));
    let spawnError: string | null = null;
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      shell       : false ,
      windowsHide : true  ,
      stdio       : ["ignore", "pipe", "pipe"]
    });
    for (const name of ["stdout", "stderr"] as const) child[name].on("data", (chunk) => {
      const value  = Buffer.from    (chunk                                                ) ;
      const sample = value .subarray(0, Math.max(0, OUTPUT_LIMIT - streams[name].captured)) ;
      streams[name].bytes += value.length;
      streams[name].captured += sample.length;
      streams[name].hash.update(sample);
    });
    child.once("error", (error) => { spawnError = String(errorCode(error) ?? "spawn_error"); });
    child.once("close", (code, signal) => resolve({
      code, signal, error: spawnError,
      output: { stdout: streamSummary(streams.stdout), stderr: streamSummary(streams.stderr) },
    }));
  });
}

function redactArgument(value: string) {
  return value
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[REDACTED]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{8,})\b/g, "[REDACTED]")
    .replace(/\b(Bearer\s+)\S+/gi, "$1[REDACTED]")
    .replace(/((?:password|secret|token|api[-_]?key)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]");
}

export async function verify({ repo, record, inputs, command, args = [], criterionIds, artifactPaths = [], run }: { repo?: string; record?: unknown; inputs?: unknown; command?: string; args?: string[]; criterionIds?: string[]; artifactPaths?: unknown; run?: VerificationRunner } = {}): Promise<VerificationAttempt> {
  if (typeof command !== "string" || !command.trim() || command.includes("\0") || !Array.isArray(args) || args.some((value) => typeof value !== "string" || value.includes("\0"))) throw new Error("실제 검증 명령과 문자열 인자가 필요합니다.");
  if (run !== undefined && typeof run !== "function") throw new Error("테스트 실행기는 함수여야 합니다.");
  const argv                 = [...args]                                        ;
  const covered              = coverage(record, criterionIds)                   ;
  const root                 = await fs.realpath(repo ?? process.cwd())         ;
  const source               = await captureSource({ repo: root, inputs })      ;
  const artifacts            = await captureArtifacts(root, artifactPaths)      ;
  const criteria             = criteriaDigest(record)                           ;
  const executionEnvironment = await resolveExecutionEnvironment(root, command) ;
  const startedAt            = new Date().toISOString()                         ;
  let result: CommandResult                                                     ;
  const executableCommand    = executionEnvironment.executable?.path ?? command ;
  try { result = await (run ?? runVerificationCommand)({ command: executableCommand, args: argv }, { cwd: root, captureOutput: true }); }
  catch (error) { result = { code: null, signal: null, error: String(errorCode(error) ?? "runner_error") }; }
  let after: CapturedSource | null = null;
  try { after = await captureSource({ repo: root, inputs }); }
  catch { /* 실행 후 입력을 읽을 수 없어도 실패 시도 자체는 보존한다. */ }
  const sourceStable                    = source.digest === after?.digest ;
  let artifactsAfter: Artifact[] | null = null                            ;
  try { artifactsAfter = await captureArtifacts(root, artifacts.map((artifact) => artifact.path)); }
  catch { /* 원문 삭제·링크 전환도 실패 시도로 보존한다. */ }
  const artifactsStable   = artifactsAfter !== null && artifactIdentity(artifacts) === artifactIdentity(artifactsAfter) ;
  const environmentStable = sameEnvironment(executionEnvironment, await resolveExecutionEnvironment(root, command))     ;
  const argumentsForRecord = argv.map((value, index) =>
    index > 0 && /^--?(?:password|secret|token|api[-_]?key)$/i.test(argv[index - 1])
      ? "[REDACTED]"
      : redactArgument(value)
  );
  return {
    id           : `attempt-${randomUUID()}` ,
    startedAt                                ,
    completedAt  : new Date().toISOString()  ,
    source                                   ,
    criteriaDigest    : criteria                                                                                                ,
    criteriaSnapshot  : criterionDefinitions(record)                                                                                     ,
    command           : redactArgument(executableCommand)                                                                       ,
    requestedCommand  : redactArgument(command)                                                                                 ,
    args              : argumentsForRecord                                                                                      ,
    argumentsRedacted : command !== redactArgument(command) || argv.some((value, index) => value !== argumentsForRecord[index]) ,
    exitCode          : Number.isInteger(result?.code) ? result.code ?? null : null                                             ,
    signal            : result?.signal ?? null                                                                                  ,
    error             : result?.error ? String(result.error).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) : null                 ,
    result       :    result?.code === 0
                  && !result.signal
                  && !result.error
                  &&  sourceStable
                  &&  artifactsStable
                  &&  environmentStable
      ? "passed"
      : "failed",
    criterionIds : covered                   ,
    sourceStable                             ,
    ...(artifacts.length ? { artifacts, artifactsStable } : {}),
    environment : executionEnvironment         ,
    environmentStable                          ,
    executor    : run ? "injected" : "process" ,
    output      : run ? {
      stdout : outputSummary(result?.stdout, result?.outputTruncated),
      stderr : outputSummary(result?.stderr, result?.outputTruncated)
    } : result.output,
  };
}

export async function evaluateEvidence({ repo, record, attempt }: { repo?: string; record?: unknown; attempt?: VerificationAttempt } = {}): Promise<EvidenceEvaluation> {
  const reasons: string[] = [];
  if (!attempt || typeof attempt.id !== "string" || !/^attempt-[a-f0-9-]+$/i.test(attempt.id) || !HASH.test(attempt.source?.digest ?? "") || !HASH.test(attempt.criteriaDigest ?? "") || typeof attempt.command !== "string" || !attempt.command.trim() || attempt.command.includes("\0")) return { usable: false, reasons: ["invalid_attempt"] };
  if (attempt.executor !== "process") reasons.push("untrusted_executor");
  if (attempt.result !== "passed" || attempt.exitCode !== 0 || attempt.signal || attempt.error || attempt.sourceStable !== true || attempt.environmentStable !== true) reasons.push("verification_failed");
  try { coverage(record, attempt.criterionIds); }
  catch { reasons.push("invalid_coverage"); }
  if (attempt.criteriaDigest !== criteriaDigest(record)) reasons.push("criteria_changed");
  try {
    if (object(record) && object(record.workflow) && record.workflow.inputs && JSON.stringify(inputPaths(record.workflow.inputs)) !== JSON.stringify(inputPaths(attempt.source.inputs))) reasons.push("scope_changed");
  } catch { reasons.push("invalid_attempt"); }
  const root = await fs.realpath(repo ?? process.cwd());
  if (!sameEnvironment(attempt.environment, await resolveExecutionEnvironment(root, attempt.environment?.executable?.path ?? attempt.command))) reasons.push("environment_changed");
  if (attempt.environmentObservation !== undefined) {
    const observation = attempt.environmentObservation;
    if (!validEnvironmentObservation(observation)) reasons.push('invalid_environment_observation');
    else if (observation.digest === null) reasons.push('environment_observation_unavailable');
    else {
      try {
        if (await observeVerificationEnvironment(root, observation) !== observation.digest) reasons.push('observed_environment_changed');
      } catch { reasons.push('environment_observation_unavailable'); }
    }
  }
  try {
    const source = await captureSource({ repo, inputs: attempt.source.inputs });
    if (source.digest !== attempt.source.digest) reasons.push("source_changed");
  } catch { reasons.push("source_unavailable"); }
  if (attempt.artifacts !== undefined) {
    if (!Array.isArray(attempt.artifacts) || !attempt.artifacts.length || attempt.artifacts.some((artifact) => !artifact || typeof artifact.path !== "string" || !Number.isSafeInteger(artifact.size) || artifact.size < 0 || !HASH.test(artifact.digest ?? ""))) reasons.push("artifacts_invalid");
    else {
      if (attempt.artifactsStable !== true) reasons.push("verification_failed");
      try {
        const current = await captureArtifacts(root, attempt.artifacts.map((artifact) => artifact.path));
        if (artifactIdentity(current) !== artifactIdentity(attempt.artifacts)) reasons.push("artifacts_changed");
      } catch { reasons.push("artifacts_unavailable"); }
    }
  }
  return { usable: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function inline(value: unknown) { return String(value).replace(/`/g, "\\`").replace(/[\r\n]/g, " "); }

export function verificationCommandFailed(attempt: VerificationAttempt): boolean {
  return Boolean(attempt.signal || attempt.error || (typeof attempt.exitCode === "number" && attempt.exitCode !== 0));
}

export function renderAttempt(attempt: VerificationAttempt) {
  if (!attempt || !/^attempt-[a-f0-9-]+$/i.test(attempt.id ?? "")) throw new Error("검증 시도의 올바른 ID가 필요합니다.");
  const commandResult = verificationCommandFailed(attempt) ? "실패" : attempt.exitCode === 0 ? "정상 종료" : "미확인";
  return [
    `<a id="${attempt.id}"></a>`,
    `## 검증 시도 — ${attempt.completedAt}`,
    "",
    `- 시도 ID: \`${attempt.id}\``,
    `- 실행 시각: ${attempt.startedAt} ~ ${attempt.completedAt}`,
    `- 명령과 인자: \`${inline(JSON.stringify([attempt.command, ...attempt.args]))}\``,
    `- 명령 결과: ${commandResult}, 종료 코드 ${attempt.exitCode ?? "미확인"}, 신호 ${attempt.signal ?? "없음"}`,
    `- 검증 시도 결과: ${attempt.result === "passed" ? "통과" : "증거 불충족"}`,
    `- 실행기: ${attempt.executor === "process" ? "실제 자식 프로세스" : "테스트 주입 실행기 — 완료 증거로 사용하지 않음"}`,
    `- 관련 기준: ${attempt.criterionIds.map((id) => `\`${inline(id)}\``).join(", ")}`,
    `- 소스 HEAD: \`${attempt.source.head ?? "없음"}\``,
    `- 검증 입력: ${attempt.source.inputs.map((value) => `\`${inline(value)}\``).join(", ")}`,
    `- 소스 식별: \`${attempt.source.digest}\``,
    `- 기준 정의 식별: \`${attempt.criteriaDigest}\``,
    `- 검증 중 소스 유지: ${attempt.sourceStable ? "확인" : "변경 감지"}`,
    `- 검증 중 실행 환경 유지: ${attempt.environmentStable ? "확인" : "확인 실패"}`,
    ...(attempt.artifacts?.length ? [
      `- 검증 의존 원문: ${attempt.artifacts.map((artifact) => `\`${inline(artifact.path)}\` (${artifact.size}바이트, sha256 ${artifact.digest})`).join(", ")}`,
      `- 검증 중 원문 유지: ${attempt.artifactsStable ? "확인" : "변경 또는 읽기 실패 감지"}`,
    ] : []),
    `- 출력: stdout ${attempt.output?.stdout?.bytes ?? 0}바이트, stderr ${attempt.output?.stderr?.bytes ?? 0}바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.`,
    "- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.",
    "",
  ].join("\n");
}

/** 같은 프로세스에서 직접 관측한 검증만 보유한다. 디스크의 과거 PASS는 가져오지 않는다. */
export interface VerificationSession { readonly id: string }
export interface VerificationSessionOptions {
  checkId: string;
  scenario: string;
  phase: 'focused' | 'common' | 'integration';
  maxAgeMs: number;
  tools: string[];
  environmentPaths: string[];
  environmentObserved: boolean;
}
export interface VerificationReuseDecision {
  id: string;
  sessionId: string;
  checkId: string;
  scenario: string;
  phase: VerificationSessionOptions['phase'];
  action: 'reused' | 'executed';
  reasons: string[];
  sourceAttemptId: string | null;
  attemptId: string;
  environmentDigest: string | null;
  checkedAt: string;
  elapsedMs: number;
  processExecutions: 0 | 1;
}
interface SessionCandidate {
  signature: string;
  attempt: VerificationAttempt;
  observation: string | null;
  capturedAt: number;
}
interface SessionState {
  options: VerificationSessionOptions;
  candidates: SessionCandidate[];
  tail: Promise<void>;
  lastFailureAttemptId: string | null;
}
const verificationSessions = new WeakMap<VerificationSession, SessionState>();
const verificationReuseTickets = new Map<string, { session: VerificationSession; candidate: SessionCandidate; root: string; options: VerificationSessionOptions }>();

export function createVerificationSession(options: VerificationSessionOptions): VerificationSession {
  if (!options.checkId?.trim() || !options.scenario?.trim() || !['focused', 'common', 'integration'].includes(options.phase)
    || !Number.isFinite(options.maxAgeMs) || options.maxAgeMs <= 0 || options.maxAgeMs > 3_600_000
    || !Array.isArray(options.tools) || !options.tools.length || options.tools.some(tool => typeof tool !== 'string' || !tool.trim())
    || !Array.isArray(options.environmentPaths) || options.environmentPaths.some(file => typeof file !== 'string' || !file.trim())
    || typeof options.environmentObserved !== 'boolean') throw new Error('재사용에는 검사·시나리오·단계·관측 범위와 1시간 이하 유효기간이 필요합니다.');
  const session = Object.freeze({ id: `verification-session-${randomUUID()}` });
  verificationSessions.set(session, { options: structuredClone(options), candidates: [], tail: Promise.resolve(), lastFailureAttemptId: null });
  return session;
}

// 환경변수 값은 저장하지 않는다. 의존 트리와 명시한 외부 설정·도구는 읽기만 한다.
async function observeVerificationEnvironment(root: string, options: Pick<VerificationSessionOptions, 'tools' | 'environmentPaths'>): Promise<string> {
  const os = await import('node:os');
  const entries: unknown[] = [];
  async function visit(file: string, ancestors: Set<string>): Promise<void> {
    let stat;
    try { stat = await fs.lstat(file); }
    catch (error) { if (errorCode(error) !== 'ENOENT') throw error; entries.push([file, 'missing']); return; }
    const resolved = await fs.realpath(file);
    if (stat.isSymbolicLink()) {
      entries.push([file, 'symlink', resolved]);
      if (ancestors.has(resolved)) throw new Error('environment_symlink_cycle');
      await visit(resolved, ancestors);
    } else if (stat.isDirectory()) {
      if (ancestors.has(resolved)) throw new Error('environment_directory_cycle');
      entries.push([file, 'directory', stat.mode & 0o777]);
      const next = new Set([...ancestors, resolved]);
      for (const name of (await fs.readdir(file)).sort()) await visit(path.join(file, name), next);
    } else if (stat.isFile()) entries.push([file, 'file', stat.mode & 0o777, digest(await fs.readFile(file))]);
    else throw new Error('environment_special_file');
  }
  for (const file of [...new Set(['node_modules', ...options.environmentPaths])].sort()) await visit(path.resolve(root, file), new Set());
  const tools = [];
  for (const tool of [...new Set([process.execPath, ...options.tools])].sort()) {
    const observed = await resolveExecutionEnvironment(root, tool);
    if (!observed.executable) throw new Error('environment_tool_unavailable');
    tools.push([tool, observed]);
  }
  return digest(JSON.stringify({ root, host: os.hostname(), release: os.release(), node: process.version,
    env: Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b)), tools, entries }));
}

/** 기존 core 판정을 추가 조건으로만 좁힌다. 주입 실행은 후보가 되어도 재사용할 수 없다. */
export async function verifyInSession(session: VerificationSession, options: Parameters<typeof verify>[0], forceRun = false) {
  const state = verificationSessions.get(session);
  if (!state || !options) throw new Error('현재 프로세스에서 생성한 검증 세션이 필요합니다.');
  const previous = state.tail;
  let release = () => {};
  state.tail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    const started = performance.now();
    const root = await fs.realpath(options.repo ?? process.cwd());
    const paths: unknown = options.artifactPaths ?? [];
    if (!Array.isArray(paths) || paths.some(file => typeof file !== 'string')) throw new Error('아티팩트 경로 배열이 필요합니다.');
    const signature = digest(JSON.stringify([root, options.command, options.args ?? [], [...(options.criterionIds ?? [])].sort(), [...new Set(paths)].sort()]));
    const candidate = [...state.candidates].reverse().find(item => item.signature === signature);
    const reasons: string[] = [];
    if (forceRun) reasons.push('forced_after_record_change');
    let observation: string | null = null;
    const observedOptions = { ...state.options, tools: [...state.options.tools, ...(options.command ? [options.command] : [])] };
    if (!state.options.environmentObserved) reasons.push('environment_unobserved');
    else {
      try { observation = await observeVerificationEnvironment(root, observedOptions); }
      catch { reasons.push('environment_observation_unavailable'); }
    }
    if (!candidate) {
      reasons.push('no_session_observation');
      if (state.lastFailureAttemptId) reasons.push('prior_session_failure');
    }
    else {
      if (performance.now() - candidate.capturedAt > state.options.maxAgeMs) reasons.push('observation_expired');
      if (!candidate.observation || candidate.observation !== observation) reasons.push('observed_environment_changed');
      if (candidate.attempt.argumentsRedacted) reasons.push('arguments_redacted');
      if (options.run) reasons.push('injected_request');
      if (object(options.record) && object(options.record.workflow) && Array.isArray(options.record.workflow.verifications)) {
        const recorded = options.record.workflow.verifications.filter(item => object(item) && Array.isArray(item.criterionIds) && item.criterionIds.some(id => options.criterionIds?.includes(String(id))));
        const latest = recorded.at(-1);
        if (object(latest) && latest.id !== candidate.attempt.id) reasons.push('newer_recorded_verification');
      }
      const requestedSource = await captureSource({ repo: root, inputs: options.inputs });
      if (JSON.stringify(requestedSource.inputs) !== JSON.stringify(candidate.attempt.source.inputs)) reasons.push('requested_scope_changed');
      if (requestedSource.digest !== candidate.attempt.source.digest) reasons.push('source_changed');
      const evaluation = await evaluateEvidence({ repo: root, record: options.record, attempt: candidate.attempt });
      reasons.push(...evaluation.reasons);
    }
    let attempt: VerificationAttempt;
    const reused = candidate !== undefined && reasons.length === 0;
    if (reused) attempt = structuredClone(candidate.attempt);
    else {
      attempt = await verify(options);
      let after: string | null = null;
      if (observation) {
        try { after = await observeVerificationEnvironment(root, observedOptions); }
        catch { reasons.push('environment_observation_unavailable_after'); }
        if (after !== observation) {
          reasons.push('observed_environment_unstable');
          attempt.environmentStable = false;
          attempt.result = 'failed';
        }
      }
      if (state.options.environmentObserved) {
        // 실행 전 관측만 증거에 결속한다. 나중의 환경을 과거 실행의 관측으로 대체하지 않는다.
        attempt.environmentObservation = { version: 1, tools: [...observedOptions.tools], environmentPaths: [...observedOptions.environmentPaths], digest: observation };
        if (observation === null) {
          attempt.environmentStable = false;
          attempt.result = 'failed';
        }
      }
      // 실패·불안정한 최근 결과도 보유하여 과거 성공으로 되돌아가지 않는다.
      if (attempt.result !== 'passed' || attempt.executor !== 'process') {
        state.candidates = [];
        state.lastFailureAttemptId = attempt.id;
      } else state.candidates = state.candidates.filter(item => item.signature !== signature);
      state.candidates.push({ signature, attempt: structuredClone(attempt), observation: after === observation ? observation : null, capturedAt: performance.now() });
    }
    const reuse: VerificationReuseDecision = {
      id: `verification-use-${randomUUID()}`, sessionId: session.id, checkId: state.options.checkId,
      scenario: state.options.scenario, phase: state.options.phase, action: reused ? 'reused' : 'executed',
      reasons: reused ? ['current_core_and_observations_match'] : [...new Set(reasons)],
      sourceAttemptId: candidate?.attempt.id ?? null, attemptId: attempt.id, environmentDigest: observation,
      checkedAt: new Date().toISOString(), elapsedMs: performance.now() - started, processExecutions: reused || options.run ? 0 : 1,
    };
    if (reused && candidate) {
      for (const [id, ticket] of verificationReuseTickets) {
        if (performance.now() - ticket.candidate.capturedAt > ticket.options.maxAgeMs) verificationReuseTickets.delete(id);
      }
      verificationReuseTickets.set(reuse.id, { session, candidate, root, options: observedOptions });
    }
    return { attempt, reuse };
  } finally { release(); }
}

/** 원장 잠금을 얻은 호출자가 환경·만료·세션을 다시 확인하고 실제 저장까지 세션을 동결한다. */
export async function withVerificationReuse<T>(id: string, repo: string, attempt: VerificationAttempt, record: () => Promise<T>): Promise<T> {
  const ticket = verificationReuseTickets.get(id);
  if (!ticket) throw new Error('reuse_record_changed: process_session_observation_missing');
  const state = verificationSessions.get(ticket.session);
  if (!state) throw new Error('reuse_record_changed: process_session_missing');
  const previous = state.tail;
  let release = () => {};
  state.tail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    const current = () => state.candidates.includes(ticket.candidate) && performance.now() - ticket.candidate.capturedAt <= ticket.options.maxAgeMs;
    if (!current() || ticket.root !== await fs.realpath(repo) || digest(JSON.stringify(attempt)) !== digest(JSON.stringify(ticket.candidate.attempt))) throw new Error('reuse_record_changed: session_candidate_changed_or_expired');
    let environment: string;
    try { environment = await observeVerificationEnvironment(ticket.root, ticket.options); }
    catch { throw new Error('reuse_record_changed: environment_observation_unavailable_at_record'); }
    if (!current() || environment !== ticket.candidate.observation) throw new Error('reuse_record_changed: environment_or_session_changed_at_record');
    return await record();
  } finally { release(); }
}
