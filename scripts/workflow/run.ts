import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createGjcInvocation, gjcCapabilities, spawnGjc, waitForChild } from "./adapters/gjc.ts";
import { createSessionBinding, findWorkRecord, loadCanonicalSkill, preflightMutation, validateSessionBinding, validateWritePaths } from "./preflight.ts";
import { appendEvent } from "./record.ts";
import { routeRequest } from "./route.ts";
import { createCodexInvocation, codexCapabilities, runCodex } from "./adapters/codex.ts";
import { assessWork, advanceWork, completeWork, openWork, readWork, recordReview, resumeWork, verifyWork } from "./work.ts";
import { captureSource, criteriaDigest } from "./evidence.ts";
import { loadReviewPolicy, runReview } from "./review.ts";

import type { Approval, WorkRecord, WorkLocation, WorkDecision } from "./types.ts";
import type { SessionBinding, CanonicalSkill, MutationResult } from "./preflight.ts";
import type { RouteResult } from "./route.ts";
import type { ProcessInvocation, ProcessOptions, ProcessResult } from "./adapters/gjc.ts";
import type { VerificationAttempt } from "./evidence.ts";
import type { ReviewResult } from "./review.ts";
import type { RuntimeState } from "./record.ts";

export type JsonObject = Record<string, unknown>;
export interface WorkflowVerifier {
  command        : string                  ;
  args           : string[]                ;
  criteria?      : Record<string, unknown> ;
  blocked?       : boolean                 ;
  criterionIds?  : string[]                ;
  artifactPaths? : string[]                ;
}
export interface WorkflowOptions extends JsonObject {
  repo?              : string                  ;
  workId?            : string                  ;
  request?           : string                  ;
  role?              : string                  ;
  direct?            : boolean                 ;
  requestId?         : string                  ;
  decision?          : WorkDecision            ;
  approval?          : Partial<Approval>       ;
  inputs?            : string[]                ;
  preview?           : boolean                 ;
  execute?           : boolean                 ;
  eventId?           : string                  ;
  resume?            : boolean                 ;
  verifier?          : WorkflowVerifier        ;
  writes?            : string[]                ;
  surfaces?          : string[]                ;
  requireHardGate?   : boolean                 ;
  env?               : NodeJS.ProcessEnv       ;
  model?             : string                  ;
  sandbox?           : string                  ;
  binding?           : SessionBinding          ;
  thinking?          : string                  ;
  expectedSkillHash? : string                  ;
  facts?             : unknown                 ;
  evidence?          : unknown                 ;
  publishRequested?  : boolean                 ;
  explicitSkill?     : string                  ;
  boxboxFiles?       : string[]                ;
  boxboxLauncher?    : string                  ;
  stdio?             : ProcessOptions["stdio"] ;
}
export interface WorkflowDependencies {
  runProcess?: (invocation: ProcessInvocation, context: ProcessOptions) => Promise<unknown>;
}
export interface BoxboxObservation {
  file              : string        ;
  command           : string        ;
  code              : number | null ;
  outcome           : string        ;
  approvedGuidance? : boolean       ;
  syntax?           : unknown       ;
  findings?         : unknown       ;
  reportHash?       : string        ;
}
interface BoxboxGuide {
  file       : string    ;
  rules      : unknown   ;
  columnSets : unknown[] ;
  axisNotes  : unknown   ;
}
interface PreparedRun {
  binding      : SessionBinding                         ;
  skill        : Omit<CanonicalSkill, "source">         ;
  context      : string                                 ;
  invocation   : ReturnType<typeof createGjcInvocation> ;
  capabilities : ReturnType<typeof gjcCapabilities>     ;
}
interface WorkflowVerificationSummary {
  executed         : boolean                                        ;
  result           : string                                         ;
  commandHash      : string                                         ;
  exitCode         : number | null                                  ;
  criteriaCoverage : { requiredIds: string[]; passedIds: string[] } ;
  blocked          : boolean                                        ;
}
export interface WorkflowResult extends JsonObject {
  executed          : boolean                                          ;
  preview?          : boolean                                          ;
  role?             : string                                           ;
  proposedDecision? : WorkDecision | null                              ;
  route?            : RouteResult | { intent: string; reason: string } ;
  mutation?         : MutationResult                                   ;
  confirmation?     : boolean                                          ;
  work?             : WorkLocation & {
    legacy?     : boolean  ;
    complete?   : boolean  ;
    nextAction? : string   ;
    reasons?    : string[] ;
  };
  workId?              : string                              ;
  resumed?             : boolean                             ;
  review?              : ReviewResult                        ;
  duplicate?           : boolean                             ;
  session?             : RuntimeState                        ;
  binding?             : SessionBinding                      ;
  skill?               : Omit<CanonicalSkill, "source">      ;
  capabilities?        : ReturnType<typeof gjcCapabilities>  ;
  host?                : ProcessResult                       ;
  sources?             : { path: string; hash: string }[]    ;
  verification?        : VerificationAttempt | ProcessResult ;
  verificationSummary? : WorkflowVerificationSummary         ;
  boxboxPre?           : BoxboxObservation[]                 ;
  boxboxPost?          : BoxboxObservation[]                 ;
  postError?           : string                              ;
  dryRun?              : boolean                             ;
}
function object(value: unknown): value is JsonObject { return value !== null && typeof value === "object" && !Array.isArray(value); }
function property(value: unknown, key: string): unknown { return object(value) ? value[key] : undefined; }
function processResult(value: unknown): ProcessResult {
  if (!object(value) || typeof value.ok !== "boolean" || (value.code !== null && typeof value.code !== "number") || typeof value.outcome !== "string") throw new Error("호스트 실행 결과가 올바르지 않습니다.");
  return { ...value, ok: value.ok, code: value.code, outcome: value.outcome,
    signal          : typeof value.signal === "string" ? value.signal : null      ,
    error           : typeof value.error === "string" ? value.error : null        ,
    stdout          : typeof value.stdout === "string" ? value.stdout : undefined ,
    stderr          : typeof value.stderr === "string" ? value.stderr : undefined ,
    outputTruncated : value.outputTruncated === true                              ,
    threadId: typeof value.threadId === "string" ? value.threadId : null };
}

const BOXBOX_EXTENSIONS = new Set([".ts", ".tsx", ".py", ".json", ".yaml", ".yml"]);

export function buildSkillContext({ binding, skill, facts = [], evidence = [] }: { binding?: SessionBinding; skill?: CanonicalSkill; facts?: unknown; evidence?: unknown } = {}): string {
  if (!binding || !skill) throw new TypeError("binding과 Skill이 필요합니다.");
  const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  return [
    "WWW Skill 실행 컨텍스트",
    `work-id: ${binding.workId}`,
    `request-hash: ${binding.requestHash}`,
    `repo: ${binding.repo}`,
    `branch: ${binding.branch}`,
    `head: ${binding.head}`,
    `skill: ${skill.skill}`,
    `skill-hash: ${skill.hash}`,
    "skill-load-mode: context",
    `approved-write-paths: ${JSON.stringify(binding.approval.writePaths ?? [])}`,
    `approved-mutation-surfaces: ${JSON.stringify(binding.approval.mutationSurfaces ?? [])}`,
    "호스트 tool interception은 advisory이며 hard gate를 주장할 수 없습니다.",
    strings(facts).length ? `facts:\n${strings(facts).map((item) => `- ${item}`).join("\n")}` : "facts: 없음",
    strings(evidence).length ? `evidence:\n${strings(evidence).map((item) => `- ${item}`).join("\n")}` : "evidence: 없음",
    "\n--- 검증된 Skill 본문 ---\n",
    skill.source,
  ].join("\n");
}

function publicPrepared(prepared: PreparedRun) {
  return {
    binding      : prepared.binding      ,
    skill        : prepared.skill        ,
    capabilities : prepared.capabilities ,
  };
}

export async function runProcess(invocation: ProcessInvocation, options: ProcessOptions = {}): Promise<ProcessResult> {
  if (invocation.mode === "codex-exec") return runCodex(invocation, options);
  return waitForChild(spawnGjc(invocation, options), { captureOutput: options.captureOutput === true });
}

async function developmentContext(repo: string, work: WorkLocation, skill: string) {
  if (work.record.schemaVersion !== 2) throw new Error("현재 개발 작업 계약이 필요합니다.");
  const sources = ["AGENTS.md", "agents/www/AGENT.md", "docs/skills/WORKFLOW.md", `skills/www/${skill}/SKILL.md`];
  const documents = await Promise.all(sources.map(async (relative) => {
    const absolute = await fs.realpath(path.join(repo, relative));
    if (!absolute.startsWith(`${repo}${path.sep}`)) throw new Error("역할 컨텍스트가 저장소를 벗어납니다.");
    const source = await fs.readFile(absolute, "utf8");
    return { path: relative, hash: createHash("sha256").update(source).digest("hex"), source };
  }));
  return {
    sources: documents.map(({ path: file, hash }) => ({ path: file, hash })),
    text: [
      "www-dev 역할이 직접 요청을 받아 선택한 실행 단계다. 기존 요청의 권한을 유지하며 아래 작업 UUID를 재사용한다.",
      "진행 중인 작업을 중복 접수하지 않는다. 현재 범위의 구현·검사·실패 수정은 이어가되 commit·push는 명시 요청이 없으면 수행하지 않는다.",
      `작업 정본: ${work.path}`,
      `작업 UUID: ${work.record.id}`,
      `허용 범위: ${JSON.stringify(work.record.workflow.authorization)}`,
      `현재 기준: ${JSON.stringify(work.record.criteria.map(({ id, description, required, requirementRefs }) => ({ id, description, required, requirementRefs })))}`,
      "단계의 결과는 실행 사실과 한계를 보고한다. 부모 실행부가 검증과 검토를 연결하므로 스스로 작업을 done으로 바꾸거나 기준을 약화하지 않는다.",
      ...documents.map((document) => `\n--- ${document.path} (${document.hash}) ---\n${document.source}`),
    ].join("\n"),
  };
}

export async function runDevelopmentWorkflow(options: WorkflowOptions = {}, dependencies: WorkflowDependencies = {}): Promise<WorkflowResult> {
  const repo = await fs.realpath(options.repo ?? process.cwd());
  if (options.direct !== true || options.role !== "www-dev") throw new Error("직접 요청을 받은 www-dev 역할이 필요합니다.");
  if (typeof options.request !== "string" || !options.request.trim()) throw new Error("직접 받은 요청이 필요합니다.");
  if (options.decision?.intent === "answer") return { executed: false, route: { intent: "answer", reason: "role_information_request" } };
  if (options.preview === true) return { executed: false, preview: true, role: "www-dev", proposedDecision: options.decision ?? null };
  if (options.execute !== true) throw new Error("역할 실행에는 execute: true가 필요합니다.");
  if (typeof options.eventId !== "string" || !options.eventId.trim()) throw new Error("역할 실행을 구분할 안정적인 eventId가 필요합니다.");
  const work = await openWork({ ...options, repo });
  if (work.record.schemaVersion !== 2) throw new Error("legacy 작업은 기존 호출을 지원합니다. 현재 권한·입력·접수 ID를 연결하고 decision.adoptLegacy를 명시하면 같은 UUID로 현재 증거 계약을 적용합니다.");
  if (options.resume === true) return { executed: true, resumed: true, work: await resumeWork({ repo, workId: work.record.id }) };
  const intent = options.decision?.intent;
  if (intent === "complete") return { executed: true, work: await completeWork({ repo, workId: work.record.id }) };
  if (intent === "review") {
    const current    = await readWork({ repo, workId: work.record.id })   ;
    const assessment = await assessWork({ repo, workId: work.record.id }) ;
    if (!("source" in assessment)) throw new Error("현재 작업의 검토 소스가 필요합니다.");
    const { source } = assessment;
    const policyInfo = await loadReviewPolicy({ root: repo });
    const review = await runReview({
      repo                                            ,
      source                                          ,
      criteriaDigest : criteriaDigest(current.record) ,
      policyInfo                                      ,
      inputPaths     : [
        ...source.inputs,
        path.relative(repo, current.path),
        path.relative(repo, path.join(path.dirname(current.path), "verification.md")),
      ],
    });
    return { executed: true, review, work: await recordReview({ repo, workId: work.record.id, review }) };
  }
  if (intent === "verify") {
    const verifier = requireVerifier(options.verifier)                                                                          ;
    const attempt  = await verifyWork({ repo, workId: work.record.id, ...verifier, criterionIds: verifier.criterionIds ?? [] }) ;
    return { executed: true, workId: work.record.id, verification: attempt };
  }
  const route = routeRequest({ ...options, workId: work.record.id, status: work.record.status, approval: work.record.workflow.authorization });
  if (!route.skill) return { executed: false, workId: work.record.id, route };
  const writes   = options.writes ?? []   ;
  const surfaces = options.surfaces ?? [] ;
  const mutation = preflightMutation({
    approval        : work.record.workflow.authorization ,
    writes                                               ,
    surfaces                                             ,
    host            : codexCapabilities()                ,
    requireHardGate : options.requireHardGate === true   ,
  });
  if (!mutation.ok) return { executed: false, workId: work.record.id, route, mutation };
  await validateWritePaths(repo, writes);
  const context = await developmentContext(repo, work, route.skill);
  if (options.sandbox !== undefined && !["read-only", "workspace-write"].includes(options.sandbox)) throw new Error("WWW 개발 역할은 read-only 또는 workspace-write 호스트 정책을 사용합니다.");
  const invocation = createCodexInvocation({
    repo,
    systemPrompt : context.text                         ,
    request      : options.request                      ,
    model        : options.model                        ,
    sandbox      : options.sandbox ?? "workspace-write" ,
  });
  const runtimeDirectory = path.join(repo, ".www", "runtime", work.record.id);
  await validateWritePaths(repo, [path.relative(repo, runtimeDirectory).split(path.sep).join("/")]);
  await fs.mkdir(runtimeDirectory, { recursive: true });
  const leaseFile = path.join(runtimeDirectory, "execution.lock");
  let lease;
  try { lease = await fs.open(leaseFile, "wx", 0o600); }
  catch (error) {
    if (object(error) && error.code === "EEXIST") throw new Error("같은 작업이 실행 중입니다. 불명확한 이전 실행을 자동 재시도하지 않습니다.");
    throw error;
  }
  try {
    await lease.writeFile(JSON.stringify({ eventId: options.eventId, pid: process.pid, startedAt: new Date().toISOString() }));
    const started = await appendEvent({ repo, workId: work.record.id, event: { id: options.eventId, type: "status", status: "running", role: "www-dev", skill: route.skill, sources: context.sources, requestedModel: invocation.requestedModel } });
    if (started.duplicate) return { executed: false, duplicate: true, workId: work.record.id };
    await advanceWork({ repo, workId: work.record.id, intent: route.intent ?? "answer", writes, surfaces });
    const host = processResult(await (dependencies.runProcess ?? runProcess)(invocation, { cwd: repo, env: options.env, captureOutput: true }));
    await appendEvent({ repo, workId: work.record.id, event: { id: `${options.eventId}-host`, type: host.ok ? "host_result" : "post_failure", outcome: host.outcome, exitCode: host.code, threadId: host.threadId ?? null, injected: Boolean(dependencies.runProcess) } });
    await appendEvent({ repo, workId: work.record.id, event: { id: `${options.eventId}-stage`, type: "status", status: host.ok ? "completed" : "failed" } });
    const receiptDirectory = path.join(repo, ".www", "evidence", work.record.id);
    await validateWritePaths(repo, [path.relative(repo, receiptDirectory).split(path.sep).join("/")]);
    await fs.mkdir(receiptDirectory, { recursive: true });
    const receiptId = createHash("sha256").update(options.eventId).digest("hex");
    await fs.writeFile(path.join(receiptDirectory, `${receiptId}.json`), `${JSON.stringify({ eventId: options.eventId, workId: work.record.id, sources: context.sources, host }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    if (!host.ok || !options.verifier) return { executed: true, workId: work.record.id, route, mutation, host, sources: context.sources };
    const verification = await verifyWork({ repo, workId: work.record.id, ...options.verifier, criterionIds: options.verifier.criterionIds ?? [] });
    return { executed: true, workId: work.record.id, route, mutation, host, sources: context.sources, verification };
  } finally {
    await lease.close();
    await fs.unlink(leaseFile);
  }
}

export async function prepareRun({ binding, skill: skillName, expectedSkillHash, request, model, thinking, facts, evidence, route }: { binding?: SessionBinding; skill?: unknown; expectedSkillHash?: string; request?: unknown; model?: unknown; thinking?: unknown; facts?: unknown; evidence?: unknown; route?: RouteResult & { repo: string } } = {}): Promise<PreparedRun> {
  if (!binding && !route) throw new Error("binding 또는 route가 필요합니다.");
  const currentBinding = binding
    ? await validateSessionBinding(binding)
    : await createSessionBinding({
      repo        : route?.repo        ,
      workId      : route?.workId      ,
      requestHash : route?.requestHash ,
      approval    : route?.approval    ,
    });
  const skill = await loadCanonicalSkill({
    repo         : currentBinding.repo ,
    skill        : skillName           ,
    expectedHash : expectedSkillHash   ,
  });
  const context = buildSkillContext({
    binding: currentBinding ,
    skill                   ,
    facts                   ,
    evidence                ,
  });
  const invocation = createGjcInvocation({
    systemPrompt: context ,
    request               ,
    model                 ,
    thinking              ,
  });
  return Object.freeze({
    binding      : currentBinding    ,
    skill        : {
      skill    : skill.skill    ,
      hash     : skill.hash     ,
      path     : skill.path     ,
      loadMode : skill.loadMode ,
    },
    context                          ,
    invocation                       ,
    capabilities : gjcCapabilities() ,
  });
}

async function runBoxbox({ launcher, files, phase, cwd, run, guides = [] }: { launcher?: string; files?: string[]; phase: "pre" | "post"; cwd: string; run: typeof runProcess; guides?: BoxboxGuide[] }): Promise<BoxboxObservation[]> {
  if (!launcher) return [];
  const realLauncher = await fs.realpath(launcher);
  if (path.basename(realLauncher) !== "boxbox.ts") throw new Error("BoxBox launcher는 boxbox.mjs 정본 경로여야 합니다.");
  const supported                    = (files ?? []).filter((file) => BOXBOX_EXTENSIONS.has(path.extname(file))) ;
  const results: BoxboxObservation[] = []                                                                        ;
  for (const file of supported) {
    if (phase === "pre") {
      const guide = await run({
        command: process.execPath,
        args: [realLauncher, "guide", "--file", file, "--authoring", "--json"],
      }, { cwd, stdio: "pipe", captureOutput: true });
      results.push({ file, command: "guide", code: guide.code, outcome: guide.outcome });
      if (guide.code !== 0 && guide.code !== 1) throw new Error(`BoxBox authoring guide 실패: ${file}`);
      if (guide.outputTruncated) throw new Error(`BoxBox 안내가 출력 제한을 넘었습니다: ${file}`);
      let report: unknown;
      try { report = JSON.parse(guide.stdout ?? ""); }
      catch { throw new Error(`BoxBox 안내 JSON을 읽을 수 없습니다: ${file}`); }
      if (!object(report) || report.tool !== "boxbox" || report.command !== "guide" || report.file !== file || !Array.isArray(report.columnSets)) throw new Error(`BoxBox 안내 대상이 일치하지 않습니다: ${file}`);
      results[results.length - 1].approvedGuidance = report.ok === true;
      guides.push({ file, rules: report.rules, columnSets: report.columnSets, axisNotes: report.axisNotes });
    }
    if (phase === "pre") {
      try { await fs.access(path.resolve(cwd, file)); }
      catch (error) {
        if (!object(error) || error.code !== "ENOENT") throw error;
        results.push({ file, command: "check-pre", code: null, outcome: "file_not_created" });
        continue;
      }
    }
    const check = await run({
      command: process.execPath,
      args: [realLauncher, "check", "--source", "--file", file, "--json"],
    }, { cwd, stdio: "pipe", captureOutput: true });
    results.push({ file, command: `check-${phase}`, code: check.code, outcome: check.outcome });
    if (![0, 1, 2].includes(check.code ?? -1)) throw new Error(`BoxBox source check 실패: ${file}`);
    if (check.outputTruncated) throw new Error(`BoxBox 검사 결과가 출력 제한을 넘었습니다: ${file}`);
    let report: unknown;
    try { report = JSON.parse(check.stdout ?? ""); }
    catch { throw new Error(`BoxBox 검사 JSON을 읽을 수 없습니다: ${file}`); }
    if (!object(report) || report.tool !== "boxbox") throw new Error(`BoxBox 검사 출처를 확인할 수 없습니다: ${file}`);
    results[results.length - 1].syntax     = property(report.syntax, "status") ?? "unknown"                                        ;
    results[results.length - 1].findings   = Array.isArray(report.results) ? property(report.results[0], "summary") ?? null : null ;
    results[results.length - 1].reportHash = createHash("sha256").update(check.stdout ?? "").digest("hex")                         ;
    if (phase === "post" && property(report.syntax, "status") !== "valid") throw new Error(`BoxBox 작성 후 구문 검사를 통과하지 못했습니다: ${file}`);
  }
  return results;
}

function verifierSignature(verifier: WorkflowVerifier | undefined): string {
  if (!verifier?.command || typeof verifier.command !== "string") throw new Error("실제 verifier command가 필요합니다.");
  if (!Array.isArray(verifier.args) || verifier.args.some((value) => typeof value !== "string")) throw new Error("verifier args는 문자열 배열이어야 합니다.");
  return JSON.stringify([verifier.command, ...verifier.args]);
}

function requireVerifier(verifier: WorkflowVerifier | undefined): WorkflowVerifier { verifierSignature(verifier); if (!verifier) throw new Error("verifier가 필요합니다."); return verifier; }

function approvalRecord(approval: Approval) {
  const { verifierCommands = [], ...scope } = approval;
  return { ...scope, verifierCommandHashes: verifierCommands.map((command) => createHash("sha256").update(command).digest("hex")) };
}

function criteriaFingerprint(record: unknown): string {
  const criteria = property(record, "criteria");
  if (!Array.isArray(criteria)) throw new Error("작업 수용 기준 배열이 필요합니다.");
  return JSON.stringify(criteria.map((criterion: unknown) => ({ id: property(criterion, "id"), description: property(criterion, "description"), required: property(criterion, "required") })));
}

function verificationSummary(record: unknown, verifier: WorkflowVerifier, result: ProcessResult): WorkflowVerificationSummary {
  const criteria = property(record, "criteria");
  if (!Array.isArray(criteria)) throw new Error("작업 수용 기준 배열이 필요합니다.");
  const requiredIds = criteria.filter((criterion: unknown) => property(criterion, "required")).map((criterion: unknown) => {
    const id = property(criterion, "id");
    if (typeof id !== "string") throw new Error("수용 기준 ID는 문자열이어야 합니다.");
    return id;
  });
  const outcomes = verifier.criteria;
  if (!outcomes || typeof outcomes !== "object" || Array.isArray(outcomes)) throw new Error("verifier criteria 결과가 필요합니다.");
  const passedIds = requiredIds.filter((id) => outcomes[id] === "passed")                             ;
  const blocked   = verifier.blocked === true || requiredIds.some((id) => outcomes[id] === "blocked") ;
  const complete  = requiredIds.length > 0 && passedIds.length === requiredIds.length                 ;
  return {
    executed         : true                                                                   ,
    result           : result.ok && complete && !blocked ? "passed" : "failed"                ,
    commandHash      : createHash("sha256").update(verifierSignature(verifier)).digest("hex") ,
    exitCode         : result.code                                                            ,
    criteriaCoverage : { requiredIds, passedIds }                                             ,
    blocked,
  };
}

export async function runWorkflow(options: WorkflowOptions = {}, dependencies: WorkflowDependencies = {}): Promise<WorkflowResult> {
  if (options.role === "www-dev") return runDevelopmentWorkflow(options, dependencies);
  if (typeof options.request !== "string" || !options.request.trim()) throw new TypeError("원문 사용자 request가 필요합니다.");
  const work = await findWorkRecord({
    repo: options.repo ?? process.cwd(),
    workId: options.workId,
  });
  if (work.record.id.toLowerCase() !== options.workId?.toLowerCase()) throw new Error("work UUID invariant 위반");
  const route = routeRequest({
    request          : options.request                   ,
    workId           : options.workId                    ,
    status           : work.record.status                ,
    approval         : options.approval                  ,
    direct           : options.direct === true           ,
    explicitSkill    : options.explicitSkill             ,
    publishRequested : options.publishRequested === true ,
  });
  if (!route.skill) {
    return {
      executed     : false                       ,
      preview      : options.preview === true    ,
      route                                      ,
      confirmation : route.confirmation === true ,
    };
  }
  if (options.binding && options.binding.requestHash !== route.requestHash) throw new Error("binding 요청 hash가 원문 request와 일치하지 않습니다.");
  const prepared = await prepareRun({
    ...options,
    route   : {
      ...route,
      repo: options.repo ?? process.cwd(),
    },
    skill   : route.skill     ,
    request : options.request ,
  });
  const mutation = preflightMutation({
    approval        : route?.approval                  ,
    writes          : options.writes ?? []             ,
    surfaces        : options.surfaces ?? []           ,
    host            : prepared.capabilities            ,
    requireHardGate : options.requireHardGate === true ,
  });
  if (!mutation.ok) return { ...publicPrepared(prepared), route, mutation, executed: false, preview: options.preview === true };
  await validateWritePaths(prepared.binding.repo, options.writes ?? []);
  await validateWritePaths(prepared.binding.repo, options.boxboxFiles ?? []);
  if (options.preview === true) return { ...publicPrepared(prepared), route, mutation, preview: true, executed: false, dryRun: true };
  if (options.execute !== true) throw new Error("실행은 execute: true로 명시해야 합니다.");
  if (typeof options.eventId !== "string" || !options.eventId.trim()) throw new Error("재실행을 방지할 안정적인 eventId가 필요합니다.");

  const verifier  = requireVerifier  (options.verifier) ;
  const signature = verifierSignature(verifier        ) ;
  if (!route.approval.verifierCommands.includes(signature)) throw new Error("승인되지 않은 verifier command입니다.");
  const run: typeof runProcess = async (invocation, context) =>
    processResult(await (dependencies.runProcess ?? runProcess)(invocation, context ?? {}));
  const boxboxGuides: BoxboxGuide[] = [];
  const boxboxPre = await runBoxbox({
    launcher : options.boxboxLauncher ,
    files    : options.boxboxFiles    ,
    phase    : "pre"                  ,
    cwd      : prepared.binding.repo  ,
    run                  ,
    guides: boxboxGuides ,
  });
  const started = await appendEvent({
    repo   : prepared.binding.repo   ,
    workId : prepared.binding.workId ,
    event  : {
      id          : options.eventId                     ,
      type        : "status"                            ,
      status      : "running"                           ,
      requestHash : prepared.binding.requestHash        ,
      skillHash   : prepared.skill.hash                 ,
      skill       : { ...prepared.skill, loaded: true } ,
      workId      : prepared.binding.workId             ,
      workPath    : prepared.binding.workPath           ,
      binding      : {
        repo     : prepared.binding.repo     ,
        worktree : prepared.binding.worktree ,
        branch   : prepared.binding.branch   ,
        head     : prepared.binding.head     ,
        dirty    : prepared.binding.dirty    ,
      },
      model        : {
        requested         : options.model ?? null       ,
        requestedThinking : options.thinking ?? null    ,
        observed          : null                        ,
        observedReason    : "host_metadata_unavailable" ,
      },
      capabilities : prepared.capabilities          ,
      approval     : approvalRecord(route.approval) ,
    },
  });
  if (started.duplicate) {
    return { ...publicPrepared(prepared), route, mutation, executed: false, duplicate: true, session: started.session };
  }

  const processOptions = {
    cwd   : prepared.binding.repo      ,
    env   : options.env                ,
    stdio : options.stdio ?? "inherit" ,
  };
  const invocation = boxboxGuides.length ? createGjcInvocation({
    systemPrompt:
      `${prepared.context}\n\nBoxBox 작성 안내: 아래 비교 축과 예시는 쓰기 승인이나 상위 정책이 아닙니다.\n${JSON.stringify(boxboxGuides)}`,
    request  : options.request  ,
    model    : options.model    ,
    thinking : options.thinking ,
  }) : prepared.invocation;
  const hostResult = await run(invocation, processOptions);
  if (!hostResult.ok) {
    await appendEvent({
      repo             : prepared.binding.repo                                                                ,
      workId           : prepared.binding.workId                                                              ,
      expectedRevision : started.session.revision                                                             ,
      event            : { id: `${options.eventId}-host`, type: "post_failure", outcome: hostResult.outcome } ,
    });
    return { ...publicPrepared(prepared), route, mutation, executed: true, host: hostResult, boxboxPre };
  }
  await appendEvent({
    repo   : prepared.binding.repo                                                                                                                    ,
    workId : prepared.binding.workId                                                                                                                  ,
    event  : { id: `${options.eventId}-host-exit`, type: "host_result", outcome: hostResult.outcome, exitCode: hostResult.code, observedModel: null } ,
  });
  const currentWork = await findWorkRecord({ repo: prepared.binding.repo, workId: prepared.binding.workId });
  if (criteriaFingerprint(currentWork.record) !== criteriaFingerprint(work.record)) {
    await appendEvent({
      repo   : prepared.binding.repo                                                                        ,
      workId : prepared.binding.workId                                                                      ,
      event  : { id: `${options.eventId}-criteria-drift`, type: "post_failure", outcome: "criteria_drift" } ,
    });
    return { ...publicPrepared(prepared), route, mutation, executed: true, host: hostResult, postError: "실행 중 수용 기준이 바뀌어 완료 판정을 중단했습니다.", boxboxPre };
  }

  let boxboxPost;
  try {
    boxboxPost = await runBoxbox({
      launcher : options.boxboxLauncher ,
      files    : options.boxboxFiles    ,
      phase    : "post"                 ,
      cwd      : prepared.binding.repo  ,
      run,
    });
  } catch (error) {
    await appendEvent({
      repo   : prepared.binding.repo                                                                         ,
      workId : prepared.binding.workId                                                                       ,
      event  : { id: `${options.eventId}-boxbox-post`, type: "post_failure", outcome: "boxbox_post_failed" } ,
    });
    return {
      ...publicPrepared(prepared),
      route                                                              ,
      mutation                                                           ,
      executed  : true                                                   ,
      host      : hostResult                                             ,
      boxboxPre                                                          ,
      postError : error instanceof Error ? error.message : String(error) ,
    };
  }

  const verifierResult = await run({
    command: verifier.command,
    args: verifier.args,
  }, processOptions);
  const summary = verificationSummary(work.record, verifier, verifierResult);
  const verificationEvent = await appendEvent({
    repo   : prepared.binding.repo   ,
    workId : prepared.binding.workId ,
    event  : {
      id   : `${options.eventId}-verification` ,
      type : "verification"                    ,
      summary                                  ,
    },
  });
  if (summary.result === "passed") {
    await appendEvent({
      repo             : prepared.binding.repo              ,
      workId           : prepared.binding.workId            ,
      expectedRevision : verificationEvent.session.revision ,
      event: {
        id     : `${options.eventId}-done` ,
        type   : "status"                  ,
        status : "done"                    ,
      },
    });
  }
  return {
    ...publicPrepared(prepared),
    route      ,
    mutation   ,
    executed            : true           ,
    host                : hostResult     ,
    verification        : verifierResult ,
    verificationSummary : summary        ,
    boxboxPre  ,
    boxboxPost ,
  };
}

async function main() {
  const raw = process.argv[2];
  if (!raw) throw new Error("JSON 옵션 하나가 필요합니다.");
  const options: unknown = JSON.parse(raw);
  if (!object(options)) throw new Error("JSON 옵션 객체가 필요합니다.");
  const result = await runWorkflow(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.mutation?.ok === false || result.confirmation === true) process.exitCode = 2;
  else if (options.role === "www-dev") {
    if (result.host?.ok === false || property(result.verification, "result") === "failed" || (result.review && result.review.verdict !== "pass")) process.exitCode = 1;
  } else if (result.executed && (!result.host?.ok || result.postError || result.verificationSummary?.result !== "passed")) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
