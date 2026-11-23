/**
 * @architecture arch.development.records.state
 * @implements RESP-DEVELOPMENT-RECORDS-STATE
 */
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRequirementRefs, validateWorkRecord, parseWorkRecord } from "./schema.ts";
import { findWorkRecord, resolveInside, validateWritePaths, workOutputColumns } from "./preflight.ts";
import { serializeWorkRecord } from "./work-json.ts";
import { hashRequest, normalizeApproval } from "./route.ts";
import { captureSource, criteriaDigest, evaluateEvidence, renderAttempt, validEnvironmentObservation, verificationCommandFailed, verify, verifyInSession, withVerificationReuse } from "./evidence.ts";
import { loadReviewPolicy, validateReview, durableJson } from "./review.ts";
import { withWorkLock, inspectWorkLock, recoverWorkLock, retryWorkWriter, WorkLockBusyError } from "./lock.ts";
import type { WorkExecutionHost } from "./lock.ts";
import { checkRepository, assessRepositoryCheck } from "./consistency.ts";
import { createDocumentationReview, assessDocumentation } from "./documentation.ts";
import { createArtifactReview } from "./artifacts.ts";
import { assessCompletionReport } from "./completion-report.ts";
import { publishWorkReport, readWorkReport, type ReportNarrative } from "./reports.ts";
import { assessDecompositionCompletion, validateWorkDecomposition } from "./decomposition.ts";
import type { AddVerifierOptions, ContinueWorkOptions, WorkAuthorization, CurrentWorkRecord, CurrentWorkLocation, WorkRecord, WorkLocation, WorkOptions, WorkAssessment, WorkDecision, NewWorkOptions, CriterionAssessment, ReportHookResult } from './types.ts';
import type { VerificationAttempt, VerificationSession } from './evidence.ts';
import type { DocumentationReview } from './documentation.ts';
export type { WorkRecord, WorkLocation, WorkAssessment, WorkOptions, ReportHookResult } from './types.ts';
export type { WorkExecutionHost } from "./lock.ts";
export { inspectWorkLock, recoverWorkLock, retryWorkWriter, checkRepository, assessRepositoryCheck };

const ACTIONS    = new Set(["spec", "design", "build", "diagnose", "verify", "review", "complete"]) ;
const hash       = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")     ;
const encodePath = (value: string) => value.split(path.sep).map(encodeURIComponent).join("/")       ;

function indexEntry(source: string, area: string, block: string) {
  const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")         ;
  const section = new RegExp(`^## ${escaped}\\r?$`, "m").exec(source) ;
  if (!section) return `${source}${source.endsWith("\n") ? "" : "\n"}\n## ${area}\n\n${block}\n`;
  const start     = section.index + section[0].length                   ;
  const following = /^## /m.exec(source.slice(start))                   ;
  const end       = following ? start + following.index : source.length ;
  const before    = source.slice(0, end)                                ;
  return `${before}${before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n"}${block}\n\n${source.slice(end)}`;
}

function segment(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0
    && !/[<>:"/\\|?*\x00-\x1f]/u.test(value) && !/[. ]$/.test(value)
    && ![".", ".."].includes(value);
}

async function atomicWrite(file: string, text: string) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, text, { flag: "wx", mode: 0o600 });
  await fs.rename(temporary, file);
}


interface ExistingWorkSummary {
  path: string;
  record: {
    id: string;
    workflow?: {
      requestId?: string;
      requestHash?: string;
      priorRequests?: { requestId: string; requestHash: string }[];
      verifierIds?: string[];
    };
  };
}
function summarizeRecord(value: unknown): ExistingWorkSummary['record'] {
  const raw      = value && typeof value === 'object' ? value as Record<string, unknown> : {}                      ;
  const workflow = raw.workflow && typeof raw.workflow === 'object' ? raw.workflow as Record<string, unknown> : {} ;
  return { id: typeof raw.id === 'string' ? raw.id : '', workflow: {
    ...(typeof workflow.requestId === 'string' ? { requestId: workflow.requestId } : {}),
    ...(typeof workflow.requestHash === 'string' ? { requestHash: workflow.requestHash } : {}),
    verifierIds: [workflow.verifierAuthorizations, ...(Array.isArray(workflow.continuations) ? workflow.continuations.map(item => item?.previousVerifiers) : [])]
      .flatMap(history => Array.isArray(history) ? history.flatMap(item => typeof item?.requestId === "string" ? [item.requestId] : []) : []),
    priorRequests: Array.isArray(workflow.continuations) ? workflow.continuations.flatMap(item => {
      const before = item?.before;
      return typeof before?.requestId === "string" && typeof before.authorization?.requestHash === "string"
        ? [{ requestId: before.requestId, requestHash: before.authorization.requestHash }] : [];
    }) : [],
  } };
}
async function records(repo: string): Promise<ExistingWorkSummary[]> {
  const workRoot                     = await resolveInside(repo, "docs/work") ;
  const found: ExistingWorkSummary[] = []                                     ;
  async function visit(directory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("작업 기록의 심볼릭 링크를 허용하지 않습니다.");
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.name === "work.json") found.push({ path: candidate, record: summarizeRecord(JSON.parse(await fs.readFile(candidate, "utf8")) as unknown) });
    }
  }
  await visit(workRoot);
  return found;
}

export async function readWork({ repo = process.cwd(), workId }: WorkOptions): Promise<WorkLocation> {
  const work = await findWorkRecord({ repo, workId });
  await resolveInside(repo, work.path);
  const record = parseWorkRecord(work.record, { baseDir: path.dirname(work.path) });
  return { ...work, record };
}

function assertRole(role: unknown, direct: unknown) {
  if (role !== "www-dev" || direct !== true) throw new Error("직접 요청을 받은 www-dev 역할만 작업을 접수할 수 있습니다.");
}

function verificationInputs(inputs: string[], criteria: { requirementRefs?: string[] }[]) {
  const referenced = criteria.flatMap((criterion) => (criterion.requirementRefs ?? [])
    .filter((ref) => typeof ref === "string" && ref.includes("#"))
    .map((ref) => decodeURIComponent(ref.split("#")[0])));
  return [...new Set([...inputs, ...referenced])].sort();
}

function assertNewRequest(options: NewWorkOptions): asserts options is NewWorkOptions & { requestId: string; request: string; decision: WorkDecision & Required<Pick<WorkDecision, "intent" | "area" | "title" | "criteria">>; inputs: string[] } {
  const { requestId, request, decision, approval, inputs } = options;
  if (typeof requestId !== "string" || !requestId.trim()) throw new Error("접수 멱등성을 위한 requestId가 필요합니다.");
  hashRequest(request);
  if (!decision || typeof decision.intent !== "string" || !ACTIONS.has(decision.intent) || decision.intent === "complete") throw new Error("역할이 선택한 유효한 작업 단계가 필요합니다.");
  if (!segment(decision.area) || !segment(decision.title)) throw new Error("작업 영역과 제목은 안전한 경로 조각이어야 합니다.");
  if (!Array.isArray(decision.criteria) || decision.criteria.length === 0) throw new Error("접수 전에 관찰 가능한 수용 기준을 정해야 합니다.");
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error("검증 대상 입력 경로가 필요합니다.");
  if (!approval || typeof approval !== "object") throw new Error("요청에 근거한 권한 범위가 필요합니다.");
}

export async function openWork(options: NewWorkOptions = {}): Promise<WorkLocation> {
  const { repo = process.cwd(), role, direct, approval } = options;
  const existingDecision = options.decision;
  assertRole(role, direct);
  if (existingDecision?.workId) {
    const work = await readWork({ repo, workId: existingDecision.workId });
    if (work.record.schemaVersion === 1 && existingDecision.adoptLegacy === true) return adoptWork({ repo, role, direct, requestId: options.requestId, request: options.request, workId: existingDecision.workId, approval, inputs: options.inputs, intent: existingDecision.intent });
    return { ...work, created: false, legacy: work.record.schemaVersion === 1 };
  }
  assertNewRequest(options);
  const { requestId, request, decision } = options;
  const inputs = verificationInputs(options.inputs, decision.criteria);
  return withWorkLock(repo, async (root) => {
    const all      = await records(root)                                                  ;
    const existing = all.flatMap(location => {
      const workflow = location.record.workflow;
      const requestHash = workflow?.requestId === requestId ? workflow.requestHash
        : workflow?.priorRequests?.find(entry => entry.requestId === requestId)?.requestHash;
      return requestHash ? [{ location, requestHash }] : [];
    });
    if (existing.length > 1) throw new Error("접수 ID가 둘 이상의 작업에 연결돼 있습니다.");
    if (existing.length) {
      if (existing[0].requestHash !== hashRequest(request)) throw new Error("같은 접수 ID의 요청 내용이 달라졌습니다.");
      return { ...await readWork({ repo: root, workId: existing[0].location.record.id }), created: false };
    }
    if (all.some(({ record }) => record.workflow?.verifierIds?.includes(requestId))) throw new Error("검증 요청에 사용한 requestId를 접수에 재사용할 수 없습니다.");
    const columns = await workOutputColumns(root);
    await captureSource({ repo: root, inputs });
    await validateWritePaths(root, normalizeApproval(approval).writePaths);
    const areas    = await fs.readdir(path.join(root, "docs", "work"), { withFileTypes: true })  ;
    const area     = areas.find((entry) =>
      entry.isDirectory()
      && entry.name.normalize("NFC").toLocaleLowerCase("und") === decision.area.normalize("NFC").toLocaleLowerCase("und"))?.name ?? decision.area;
    const areaRoot = path.join(root, "docs", "work", area)                                       ;
    await fs.mkdir(areaRoot, { recursive: true });
    await resolveInside(root, areaRoot);
    const entries   = await fs.readdir(areaRoot)                                                            ;
    const next      = Math.max(0, ...entries.map((name) => Number(name.match(/^(\d{3,})-/)?.[1] ?? 0))) + 1 ;
    const directory = path.join(areaRoot, `${String(next).padStart(3, "0")}-${decision.title}`)             ;
    const record: CurrentWorkRecord = {
      schemaVersion : 2                          ,
      id            : `work-${randomUUID()}`     ,
      title         : decision.title             ,
      kind          : decision.kind ?? "feature" ,
      areas         : decision.areas ?? ["dev"]  ,
      owner         : decision.owner ?? "dev"    ,
      status        : "ready"                    ,
      blockedReason : null                       ,
      relations     : decision.relations ?? []   ,
      criteria : decision.criteria.map(({ id, description, required = true, requirementRefs }) => ({
        id, description, required, result: "unverified", evidence: [],
        ...(requirementRefs ? { requirementRefs } : {}),
      })),
      workflow : {
        role: "www-dev" ,
        requestId       ,
        requestHash   : hashRequest(request)                                                                                 ,
        authorization : { ...normalizeApproval(approval), source: "direct_user_request", requestHash: hashRequest(request) } ,
        inputs        : [...new Set(inputs)].sort()                                                                          ,
        nextAction    : decision.intent                                                                                      ,
        verifications : []                                                                                                   ,
        reviews       : []                                                                                                   ,
      },
    };
    const errors = validateWorkRecord(record, { baseDir: directory });
    if (errors.length) throw new Error(errors.join("; "));
    const source = serializeWorkRecord(record, columns);
    await fs.mkdir(directory);
    const file = path.join(directory, "work.json");
    await atomicWrite(file, source);
    const spec = `# ${record.title}\n\n## 요청과 목적\n\n${decision.summary ?? decision.title}\n\n사용자의 직접 요청으로 접수했다. 요청 식별값은 work.json의 workflow.requestHash에 보존한다.\n\n## 범위\n\n변경 경로·표면·검증 명령과 커밋·게시 권한은 work.json의 workflow.authorization을 따른다. 범위 확대는 기존 권한으로 간주하지 않는다.\n\n## 수용 기준\n\n정의와 필수 여부의 정본은 work.json이다. 관련 기준: ${record.criteria.map((criterion) => `\`${criterion.id}\``).join(", ")}.\n\n## 결정과 열린 질문\n\n작업 접수는 구현 완료가 아니다. 재개 시 같은 UUID와 현재 증거를 확인한다.\n`;
    await atomicWrite(path.join(directory, "spec.md"), spec);
    const index    = path.join(root, "docs", "work", "INDEX.md")                                                                                       ;
    const oldIndex = await fs.readFile(index, "utf8")                                                                                                  ;
    const relative = encodePath(path.relative(path.dirname(index), directory))                                                                         ;
    const block    = `### ${String(next).padStart(3, "0")} — ${record.title}\n\n- [명세](${relative}/spec.md)\n- [작업 레코드](${relative}/work.json)` ;
    await atomicWrite(index, indexEntry(oldIndex, area, block));
    return { path: file, record, rawSource: source, created: true };
  });
}

export async function adoptWork({ repo = process.cwd(), role, direct, requestId, request, workId, approval, inputs, intent }: Omit<NewWorkOptions, "decision"> & { workId: string; intent?: string }): Promise<WorkLocation> {
  assertRole(role, direct);
  if (typeof requestId !== "string" || !requestId.trim() || typeof request !== "string" || !request.trim() || !approval || !Array.isArray(inputs) || !inputs.length || typeof intent !== "string" || !ACTIONS.has(intent) || intent === "complete") throw new Error("기존 작업 연결에는 현재 직접 요청·접수 ID·권한·입력·단계가 필요합니다.");
  const inputPaths = inputs;
  return withWorkLock(repo, async (root) => {
    const work = await readWork({ repo: root, workId });
    if (work.record.schemaVersion === 2) return { ...work, created: false };
    if ((await records(root)).some(item => item.record.id !== workId && requestKnown(item, requestId))) {
      throw new Error("다른 작업에서 같은 requestId를 이미 사용했습니다.");
    }
    inputs = verificationInputs(inputPaths, work.record.criteria);
    const columns = await workOutputColumns(root);
    await captureSource({ repo: root, inputs });
    await validateWritePaths(root, normalizeApproval(approval).writePaths);
    const legacyRecord = structuredClone(work.record);
    const record: CurrentWorkRecord = {
      ...structuredClone(work.record),
      schemaVersion: 2,
      workflow: {
        role: "www-dev" ,
        requestId       ,
        requestHash   : hashRequest(request)                                                                                 ,
        authorization : { ...normalizeApproval(approval), source: "direct_user_request", requestHash: hashRequest(request) } ,
        inputs        : [...new Set(inputs)].sort()                                                                          ,
        nextAction    : intent                                                                                               ,
        verifications : []                                                                                                   ,
        reviews       : []                                                                                                   ,
        legacyRecord    ,
      },
    };
    record.status = "ready";
    record.blockedReason = null;
    for (const criterion of record.criteria) { criterion.result = "unverified"; criterion.evidence = []; }
    const errors = validateWorkRecord(record, { baseDir: path.dirname(work.path) });
    if (errors.length) throw new Error(errors.join("; "));
    const source = serializeWorkRecord(record, columns);
    await atomicWrite(work.path, source);
    return { ...work, record, rawSource: source, created: false, adopted: true };
  });
}

async function mutateWork(repo: string, workId: string, change: (record: CurrentWorkRecord, work: CurrentWorkLocation) => void | Promise<void>, guard?: (mutate: () => Promise<CurrentWorkLocation>) => Promise<CurrentWorkLocation>): Promise<CurrentWorkLocation> {
  return withWorkLock(repo, async () => {
    const mutate = async (): Promise<CurrentWorkLocation> => {
    const work = await readWork({ repo, workId });
    if (work.record.schemaVersion !== 2) throw new Error("현재 증거 판정은 schemaVersion 2 작업에 적용합니다. legacy 기록은 그대로 보존합니다.");
    const before  = hash           (await fs.readFile(work.path)) ;
    const record  = structuredClone(work.record                 ) ;
    const columns = await workOutputColumns(repo)                 ;
    await change(record, { ...work, record });
    if (hash(await fs.readFile(work.path)) !== before) throw new Error("작업 갱신 중 다른 작성자가 내용을 바꿨습니다.");
    const errors = validateWorkRecord(record, { baseDir: path.dirname(work.path) });
    if (errors.length) throw new Error(errors.join("; "));
    if (JSON.stringify(record) === JSON.stringify(work.record)) return { ...work, record };
    const source = serializeWorkRecord(record, columns);
    if (hash(await fs.readFile(work.path)) !== before) throw new Error("작업 갱신 중 다른 작성자가 내용을 바꿨습니다.");
    await atomicWrite(work.path, source);
    return { ...work, record, rawSource: source };
    };
    return guard ? guard(mutate) : mutate();
  });
}

/** 전체 권한의 JSON 표현에 대한 CAS 식별값이다. */
export function authorizationDigest(authorization: WorkAuthorization): string {
  return hash(JSON.stringify(authorization));
}

export async function withWorkExecutionLease<T>(repo: string, workId: string, eventId: string, action: (host: WorkExecutionHost) => Promise<T>): Promise<T> {
  return withWorkLock(repo, (_root, host) => {
    if (!host) throw new Error("작업 실행 잠금이 필요합니다.");
    return action(host);
  }, { workId, eventId });
}

export async function addVerificationCommand(options: AddVerifierOptions) {
  const { repo = process.cwd(), workId, role, direct, requestId, request, expectedRequestId, expectedRequestHash, expectedAuthorizationDigest, command, args } = options;
  assertRole(role, direct);
  if (typeof requestId !== "string" || !requestId.trim()) throw new Error("검증 명령 추가 requestId가 필요합니다.");
  const requestHash = hashRequest(request);
  if (![expectedRequestHash, expectedAuthorizationDigest].every(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))) throw new Error("기대 요청 hash와 권한 digest가 필요합니다.");
  if (typeof command !== "string" || !command.trim() || command.includes("\0") || !Array.isArray(args) || !args.every(arg => typeof arg === "string" && !arg.includes("\0"))) throw new Error("검증 command와 args는 NUL 없는 정확한 문자열 argv여야 합니다.");
  if (expectedRequestId !== undefined && (typeof expectedRequestId !== "string" || !expectedRequestId.trim())) throw new Error("기대 요청 ID가 올바르지 않습니다.");
  return withWorkExecutionLease(repo, workId, requestId, () => mutateWork(repo, workId, async record => {
    const payloadDigest = hash(JSON.stringify({ workId: record.id, requestHash, expectedRequestHash, expectedAuthorizationDigest, command, args, expectedRequestId }));
    if (expectedRequestId === undefined ? record.workflow.continuations?.length : record.workflow.requestId !== expectedRequestId) {
      throw new Error("현재 작업 requestId CAS가 일치하지 않습니다.");
    }
    if (record.workflow.requestHash !== expectedRequestHash) throw new Error("원래 작업 requestHash가 일치하지 않습니다.");
    if (record.workflow.requestId === requestId || record.workflow.continuations?.some(item =>
      item.before.requestId === requestId || item.previousVerifiers?.some(e => e.requestId === requestId))) {
      throw new Error("기존 접수 requestId를 검증 명령 추가에 재사용할 수 없습니다.");
    }
    const existing = record.workflow.verifierAuthorizations?.find(item => item.requestId === requestId);
    if (existing) {
      if (existing.payloadDigest !== payloadDigest) throw new Error("같은 requestId의 검증 명령 추가 내용이 달라졌습니다.");
      return;
    }
    if ((await records(repo)).some(item => item.record.id !== record.id && requestKnown(item, requestId))) {
      throw new Error("다른 작업에서 같은 requestId를 이미 사용했습니다.");
    }
    const before = structuredClone(record.workflow.authorization);
    const beforeDigest = authorizationDigest(before);
    if (beforeDigest !== expectedAuthorizationDigest) throw new Error("authorization digest CAS가 일치하지 않습니다.");
    const signature = JSON.stringify([command, ...args]);
    const added = !before.verifierCommands.includes(signature);
    if (added) record.workflow.authorization.verifierCommands.push(signature);
    const after = structuredClone(record.workflow.authorization);
    (record.workflow.verifierAuthorizations ??= []).push({
      version: 1, requestId, requestHash, ...(expectedRequestId === undefined ? {} : { originalRequestId: expectedRequestId }), originalRequestHash: expectedRequestHash, payloadDigest,
      authorizedAt: new Date().toISOString(), command, args: [...args], added,
      beforeDigest, afterDigest: authorizationDigest(after), before, after,
    });
    record.workflow.nextAction = "verify";
  }));
}

function requestKnown(item: ExistingWorkSummary, requestId: string): boolean {
  const workflow = item.record.workflow;
  return workflow?.requestId === requestId || workflow?.priorRequests?.some(entry => entry.requestId === requestId) === true
    || workflow?.verifierIds?.includes(requestId) === true;
}

/** 직접 받은 후속 구현 요청을 기존 UUID의 현재 요청으로 연결한다. */
export async function continueWork(options: ContinueWorkOptions) {
  const { repo = process.cwd(), workId, role, direct, requestId, request, expectedRequestId, expectedRequestHash, expectedAuthorizationDigest, approval, inputs } = options;
  assertRole(role, direct);
  if (typeof requestId !== "string" || !requestId.trim() || typeof expectedRequestId !== "string" || !expectedRequestId.trim()) throw new Error("후속 구현 요청 requestId가 필요합니다.");
  const requestHash = hashRequest(request);
  if (![expectedRequestHash, expectedAuthorizationDigest].every(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))) throw new Error("기대 요청 hash와 권한 digest가 필요합니다.");
  if (!Array.isArray(inputs) || !inputs.length || inputs.some(input => typeof input !== "string" || !input.trim())) throw new Error("검증 입력 경로가 필요합니다.");
  const authorization = { ...normalizeApproval(approval), source: "direct_user_request", requestHash };
  if (!authorization.implementation || !authorization.writePaths.length || !authorization.mutationSurfaces.length || authorization.commit || authorization.publish) {
    throw new Error("후속 요청에 명시된 구현 범위가 필요하며 commit·publish 권한은 연결할 수 없습니다.");
  }
  for (const signature of authorization.verifierCommands) {
    const argv: unknown = JSON.parse(signature);
    if (!Array.isArray(argv) || typeof argv[0] !== "string" || !argv[0].trim() || argv.some(part => typeof part !== "string" || part.includes("\0")) || JSON.stringify(argv) !== signature) throw new Error("검증 실행은 정확 argv로 지정해야 합니다.");
  }
  return withWorkExecutionLease(repo, workId, requestId, () => mutateWork(repo, workId, async record => {
    const workflow = record.workflow;
    const after = { requestId, authorization, inputs: verificationInputs(inputs, record.criteria) };
    const payload = { workId: record.id, expectedRequestHash, expectedAuthorizationDigest, after };
    const payloadDigest = hash(JSON.stringify({ ...payload, expectedRequestId }));
    const existing = workflow.continuations?.find(item => item.after.requestId === requestId);
    if (existing) {
      if (existing.before.requestId !== expectedRequestId ||
        existing.payloadDigest !== (existing.version === 1 ? hash(JSON.stringify(payload)) : payloadDigest)) throw new Error("같은 requestId의 후속 구현 요청 내용이 달라졌습니다.");
      return;
    }
    if (record.status === "done" || record.status === "cancelled") throw new Error("완료·취소된 작업에는 후속 구현 요청을 연결할 수 없습니다.");
    if (workflow.requestId === requestId || workflow.continuations?.some(item =>
      item.before.requestId === requestId || item.previousVerifiers?.some(e => e.requestId === requestId))
      || workflow.verifierAuthorizations?.some(item => item.requestId === requestId)) throw new Error("기존 접수 requestId를 재사용할 수 없습니다.");
    if ((await records(repo)).some(item => item.record.id !== record.id && requestKnown(item, requestId))) throw new Error("다른 작업에서 같은 requestId를 이미 사용했습니다.");
    if (workflow.requestHash !== expectedRequestHash) throw new Error("현재 작업 requestHash CAS가 일치하지 않습니다.");
    if (workflow.requestId !== expectedRequestId) throw new Error("현재 작업 requestId CAS가 일치하지 않습니다.");
    if (authorizationDigest(workflow.authorization) !== expectedAuthorizationDigest) throw new Error("authorization digest CAS가 일치하지 않습니다.");
    await validateWritePaths(repo, authorization.writePaths);
    await captureSource({ repo, inputs: after.inputs });
    (workflow.continuations ??= []).push({
      version: 2, authorizedAt: new Date().toISOString(), payloadDigest,
      verificationStart: workflow.verifications.length,
      before: { requestId: workflow.requestId, authorization: workflow.authorization, inputs: workflow.inputs },
      after, ...(workflow.verifierAuthorizations ? { previousVerifiers: workflow.verifierAuthorizations } : {}),
    });
    delete workflow.verifierAuthorizations;
    workflow.requestId = requestId;
    workflow.requestHash = requestHash;
    workflow.authorization = authorization;
    workflow.inputs = after.inputs;
    workflow.nextAction = "build";
    record.status = "in_progress";
    record.blockedReason = null;
    for (const criterion of record.criteria) criterion.result = "unverified";
  }));
}

export async function setDecompositionPlan({ repo = process.cwd(), workId, plan }: WorkOptions & { plan: unknown }) {
  return mutateWork(repo, workId, async record => {
    const validated = await validateWorkDecomposition(repo, record, plan);
    if (JSON.stringify(validated) === JSON.stringify(record.workflow.decomposition)) return;
    record.workflow.decomposition = validated;
  });
}

export async function recordArtifactReview({ repo = process.cwd(), workId, review }: WorkOptions & { review: unknown }) {
  return mutateWork(repo, workId, async (record, work) => {
    const result = await createArtifactReview(repo, work, review);
    (record.workflow.artifactReviews ??= []).push(result);
  });
}

export async function advanceWork({ repo = process.cwd(), workId, intent, writes = [], surfaces = [] }: WorkOptions & { intent: string; writes?: string[]; surfaces?: string[] }) {
  if (!ACTIONS.has(intent)) throw new Error("허용된 다음 단계가 아닙니다.");
  await validateWritePaths(repo, writes);
  return mutateWork(repo, workId, (record) => {
    const authorization = record.workflow.authorization;
    if (intent === "build" && (!authorization.implementation || writes.some((file) => !authorization.writePaths.includes(file)) || surfaces.some((surface) => !authorization.mutationSurfaces.includes(surface)))) throw new Error("구현이 현재 요청의 권한 범위를 벗어납니다.");
    if (intent === "complete") throw new Error("완료는 현재 증거와 필수 검토를 판정하는 completeWork로 수행합니다.");
    record.status              = ["verify", "review"].includes(intent) ? "verifying" : "in_progress" ;
    record.blockedReason       = null                                                                ;
    record.workflow.nextAction = intent                                                              ;
  });
}

export async function setVerificationInputs({ repo = process.cwd(), workId, inputs }: WorkOptions & { inputs: string[] }) {
  if (!Array.isArray(inputs) || !inputs.length) throw new Error("검증 입력 경로가 필요합니다.");
  return mutateWork(repo, workId, async (record) => {
    const selected = verificationInputs(inputs, record.criteria);
    await captureSource({ repo, inputs: selected });
    record.workflow.inputs = selected;
    for (const criterion of record.criteria) criterion.result = "unverified";
    record.status              = "verifying" ;
    record.blockedReason       = null        ;
    record.workflow.nextAction = "verify"    ;
  });
}

interface ReuseRecordGuard { context: string; useId: string }
function verificationContext(record: CurrentWorkRecord) {
  return hash(JSON.stringify({ requestHash: record.workflow.requestHash, authorization: record.workflow.authorization, inputs: record.workflow.inputs, criteria: criteriaDigest(record), verifications: record.workflow.verifications }));
}

export async function verifyWork({ repo = process.cwd(), workId, command, args = [], criterionIds, artifactPaths, reuseSession }: WorkOptions & { command: string; args?: string[]; criterionIds: string[]; artifactPaths?: string[]; reuseSession?: VerificationSession }) {
  const work = await readWork({ repo, workId });
  if (work.record.schemaVersion !== 2) throw new Error("현재 검증 연결에는 schemaVersion 2 작업이 필요합니다.");
  const signature = JSON.stringify([command, ...args]);
  if (!work.record.workflow.authorization.verifierCommands.includes(signature)) throw new Error("이 작업에서 허용하지 않은 검증 명령입니다.");
  const started = performance.now();
  const options = { repo, record: work.record, inputs: work.record.workflow.inputs, command, args, criterionIds, artifactPaths };
  let execution = reuseSession ? await verifyInSession(reuseSession, options) : null;
  if (reuseSession && execution?.reuse.action === "reused" && work.record.workflow.continuations?.length &&
    !currentVerifications(work.record).some(item => item.id === execution?.attempt.id)) {
    execution = await verifyInSession(reuseSession, options, true);
  }
  let attempt = execution?.attempt ?? await verify(options);
  let requestHash = work.record.workflow.requestHash;
  let requestId = work.record.workflow.requestId;
  const reuseGuard = execution?.reuse.action === 'reused' ? { context: verificationContext(work.record), useId: execution.reuse.id } : undefined;
  let artifactPath = await savePending(repo, workId, "verification", attempt, hash(signature), requestHash, reuseSession ? workId : undefined, reuseGuard, requestId);
  let appended;
  try { appended = await appendPending({ repo, workId, artifactPath }); }
  catch (error) {
    if (!reuseSession || !(error instanceof Error) || !error.message.startsWith('reuse_record_changed')) throw error;
    const fresh = await readWork({ repo, workId });
    if (fresh.record.schemaVersion !== 2 || !fresh.record.workflow.authorization.verifierCommands.includes(signature)) throw new Error('command_authorization_changed: 재사용 거부 후 명령 권한이 철회되었습니다.');
    execution = await verifyInSession(reuseSession, { ...options, record: fresh.record, inputs: fresh.record.workflow.inputs }, true);
    execution.reuse.reasons.push('record_changed_before_reuse');
    attempt = execution.attempt;
    requestHash = fresh.record.workflow.requestHash;
    requestId = fresh.record.workflow.requestId;
    artifactPath = await savePending(repo, workId, "verification", attempt, hash(signature), requestHash, workId, undefined, requestId);
    appended = await appendPending({ repo, workId, artifactPath });
  }
  const { work: _work, ...recording } = appended;
  let reuseReceiptPath: string | undefined;
  if (execution) {
    execution.reuse.elapsedMs = performance.now() - started;
    await resolveInside(repo, '.www');
    await fs.mkdir(path.join(repo, '.www/evidence'), { recursive: true, mode: 0o700 });
    await resolveInside(repo, '.www/evidence');
    const directory = path.join(repo, '.www/evidence/verification-reuse');
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await resolveInside(repo, '.www/evidence/verification-reuse');
    reuseReceiptPath = path.join('.www/evidence/verification-reuse', execution.reuse.id + '.json');
    await durableJson(path.join(repo, reuseReceiptPath), JSON.stringify({ workId, workRequestHash: requestHash, attemptHash: hash(JSON.stringify(attempt)), reuse: execution.reuse }) + '\n');
  }
  return { ...attempt, ...recording, reuse: execution?.reuse, reuseReceiptPath };
}

async function appendVerification(repo: string, workId: string, attempt: VerificationAttempt, commandHash: string, expectedRequestHash: string, expectedRequestId: string | undefined, reuseGuard?: ReuseRecordGuard) {
  return mutateWork(repo, workId, async (record, current) => {
    if (record.workflow.requestHash !== expectedRequestHash ||
      (expectedRequestId === undefined ? record.workflow.continuations?.length : record.workflow.requestId !== expectedRequestId)) throw new Error("회수 결과의 요청 식별 불일치");
    if (!record.workflow.authorization.verifierCommands.some(command => hash(command) === commandHash)) throw new Error("command_authorization_changed: 검증 명령 권한이 철회되었습니다.");
    if (reuseGuard && (verificationContext(record) !== reuseGuard.context || !(await evaluateEvidence({ repo, record, attempt })).usable)) throw new Error('reuse_record_changed: 기록 잠금 안에서 재사용 맥락이 달라졌습니다.');
    const existing = record.workflow.verifications.find(item => item.id === attempt.id);
    if (existing) { if (JSON.stringify(existing) !== JSON.stringify(attempt)) throw new Error("동일 attempt ID 내용 충돌"); return; }
    const report = path.join(path.dirname(current.path), "verification.md") ;
    let old      = "# 검증 기록\n"                                          ;
    try { old = await fs.readFile(report, "utf8"); }
    catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
    if (!old.includes(`id="${attempt.id}"`) && !old.includes(`## ${attempt.id}`)) await atomicWrite(report, `${old.trimEnd()}\n\n${renderAttempt(attempt)}\n`);
    record.workflow.verifications.push(attempt);
    const applicable = await evaluateEvidence({ repo, record, attempt });
    for (const criterion of record.criteria) {
      if (!attempt.criterionIds.includes(criterion.id)) continue;
      criterion.result = applicable.usable ? "passed" : isCurrentCommandFailure(attempt, applicable.reasons) ? "failed" : "unverified";
      criterion.evidence.push({ attemptId: attempt.id, path: `verification.md#${attempt.id}`, summary: `종료 코드 ${attempt.exitCode ?? "미확인"}, 기준 ${criterion.result}` });
    }
    record.status              = "verifying"                                                ;
    record.blockedReason       = applicable.usable ? null : applicable.reasons.join("; ")   ;
    record.workflow.nextAction = await requiredEvidenceAction(repo, record, await assessRequiredCriteria(repo, record), "review");
  }, reuseGuard ? mutate => withVerificationReuse(reuseGuard.useId, repo, attempt, mutate) : undefined);
}

function currentVerifications(record: CurrentWorkRecord): VerificationAttempt[] {
  const { verifications, continuations } = record.workflow;
  const current = continuations?.at(-1);
  if (!current) return verifications;
  if (current.verificationStart !== undefined) return verifications.slice(current.verificationStart);
  return verifications.filter(attempt => Date.parse(attempt.startedAt) >= Date.parse(current.authorizedAt));
}

/** 완료 판정과 다음 행동이 같은 필수 기준의 최신 실제 검증을 평가한다. */
async function assessRequiredCriteria(repo: string, record: CurrentWorkRecord) {
  const criteria = [];
  for (const criterion of record.criteria.filter((item) => item.required)) {
    const attempt    = currentVerifications(record).filter((item) => item.criterionIds.includes(criterion.id)).at(-1)              ;
    const evaluation = attempt ? await evaluateEvidence({ repo, record, attempt }) : { usable: false, reasons: ["검증 시도 없음"] } ;
    criteria.push({ id: criterion.id, ...evaluation });
  }
  return criteria;
}

function isCurrentCommandFailure(attempt: VerificationAttempt | undefined, reasons: string[]): boolean {
  return reasons.length === 1 && reasons[0] === "verification_failed"
    && attempt?.executor === "process" && attempt.result === "failed"
    && verificationCommandFailed(attempt)
    && attempt.sourceStable === true && attempt.environmentStable === true
    && attempt.artifactsStable !== false && (attempt.artifacts === undefined || attempt.artifactsStable === true);
}

/** 필수 검증을 먼저 판정하고 분업의 현재 수용까지 갖춰야 다음 단계로 안내한다. */
async function requiredEvidenceAction(repo: string, record: CurrentWorkRecord, criteria: CriterionAssessment[], ready: "review" | "complete") {
  const failures = criteria.filter(criterion => {
    const attempt = currentVerifications(record).filter(item => item.criterionIds.includes(criterion.id)).at(-1);
    return isCurrentCommandFailure(attempt, criterion.reasons);
  });
  if (failures.length) {
    record.blockedReason = failures.map(criterion => `${criterion.id}: verification_failed`).join("; ");
    return record.workflow.authorization.implementation ? "build" : "verify";
  }
  if (!criteria.every(criterion => criterion.usable)) return "verify";
  if (record.workflow.decomposition) {
    const decomposition = await assessDecompositionCompletion(repo, record);
    if (!decomposition.usable) {
      record.blockedReason = decomposition.reasons.join("; ");
      return record.workflow.authorization.implementation ? "build" : "verify";
    }
  }
  return ready;
}

async function assessRecord(repo: string, work: WorkLocation, policyRoot?: string): Promise<WorkAssessment> {
  if (work.record.schemaVersion !== 2) return { ...work, legacy: true as const, complete: false, reasons: ["legacy 결과는 현재 소스의 검증으로 자동 승격하지 않습니다."] };
  const { record } = work;
  const reasons  = validateRequirementRefs(record, { root: repo });
  const criteria = await assessRequiredCriteria(repo, record);
  for (const criterion of criteria) {
    if (!criterion.usable) reasons.push(`${criterion.id}: ${criterion.reasons.join(", ")}`);
  }
  const documentation = await assessDocumentation({ repo, record });
  if (!documentation.usable) reasons.push(...documentation.reasons);
  const source     = await captureSource({ repo, inputs: [...new Set([...record.workflow.inputs, ...documentation.paths])].sort() }) ;
  const policyInfo = await loadReviewPolicy({ root: policyRoot ?? repo })                                                            ;
  if (policyRoot && path.resolve(policyRoot) !== path.resolve(repo)) {
    const repositoryPolicy = await loadReviewPolicy({ root: repo });
    if (repositoryPolicy.hash !== policyInfo.hash) reasons.push("배포된 검토 정책과 저장소 정책이 다릅니다.");
  }
  const review = record.workflow.reviews.at(-1);
  const reviewState = review ? validateReview({
    repo                       ,
    policy : policyInfo.policy ,
    work   : record            ,
    review                     ,
    sourceDigest   : source.digest          ,
    criteriaDigest : criteriaDigest(record) ,
    policyHash     : policyInfo.hash        ,
  }) : { usable: false, reasons: ["필수 독립 검토 없음"] };
  if (policyInfo.policy.required && !reviewState.usable) reasons.push(...reviewState.reasons);
  if (record.workflow.decomposition) reasons.push(...(await assessDecompositionCompletion(repo, record)).reasons);
  const report = await assessCompletionReport(repo, record);
  if (report && !report.usable) reasons.push(...report.reasons);
  if (record.blockedReason && reasons.length === 0) reasons.push(record.blockedReason);
  return { ...work, record, source, criteria, documentation, review: reviewState, repositoryConsistency: await assessRepositoryCheck({ repo }), ...(report ? { report } : {}), complete: reasons.length === 0, reasons };
}

export async function assessWork({ repo = process.cwd(), workId, policyRoot }: WorkOptions) {
  return assessRecord(repo, await readWork({ repo, workId }), policyRoot);
}

export async function recordDocumentReview({ repo = process.cwd(), workId, documents }: WorkOptions & { documents: DocumentationReview["documents"] }) {
  return mutateWork(repo, workId, async (record) => {
    const review = await createDocumentationReview({ repo, record, documents });
    (record.workflow.documentationReviews ??= []).push(review);
    record.status              = "verifying" ;
    record.blockedReason       = null        ;
    record.workflow.nextAction = await requiredEvidenceAction(repo, record, await assessRequiredCriteria(repo, record), "review");
  });
}

export async function recordReview({ repo = process.cwd(), workId, review, requestId }: WorkOptions & { review: unknown; requestId?: string }) {
  const requestHash  = review && typeof review === "object" && "workRequestHash" in review && typeof review.workRequestHash === "string" ? review.workRequestHash : undefined ;
  const artifactPath = await savePending(repo, workId, "review", review, undefined, requestHash, undefined, undefined, requestId)                                                                              ;
  const result       = await appendPending({ repo, workId, artifactPath })                                                                                                    ;
  return result.recorded ? { ...result.work, recorded: true as const, artifactPath } : result;
}

async function appendReview(repo: string, workId: string, review: unknown, expectedRequestHash: string, expectedRequestId?: string) {
  return mutateWork(repo, workId, async (record) => {
    if (record.workflow.requestHash !== expectedRequestHash ||
      (expectedRequestId === undefined ? record.workflow.continuations?.length : record.workflow.requestId !== expectedRequestId)) throw new Error("회수 결과의 요청 식별 불일치");
    if (!review || typeof review !== "object" || !("id" in review) || typeof review.id !== "string" || !review.id) throw new Error("식별 가능한 실제 검토 기록이 필요합니다.");
    const existing = record.workflow.reviews.find(item => item.id === review.id);
    if (existing) { const { recordingRejection: _rejection, ...original } = existing; if (JSON.stringify(original) !== JSON.stringify(review)) throw new Error("동일 review ID 내용 충돌"); return; }
    const saved         = review as { id: string; verdict?: unknown; failure?: unknown }                                                                                                      ;
    const policy        = await loadReviewPolicy({ root: repo })                                                                                                                              ;
    const documentation = await assessDocumentation({ repo, record })                                                                                                                         ;
    const source        = await captureSource({ repo, inputs: [...new Set([...record.workflow.inputs, ...documentation.paths])].sort() })                                                     ;
    const applicable    = validateReview({ repo, work: record, policy: policy.policy, policyHash: policy.hash, review, sourceDigest: source.digest, criteriaDigest: criteriaDigest(record) }) ;
    record.workflow.reviews.push(applicable.usable ? saved : { ...saved, recordingRejection: applicable.reasons });
    record.status              = "verifying";
    record.blockedReason       = applicable.usable ? null
      : `독립 검토 ${String(saved.verdict ?? "미확인")}: ${saved.failure && typeof saved.failure === "object" && "kind" in saved.failure ? String(saved.failure.kind) : "수정 또는 검토 재실행 필요"}`;
    record.workflow.nextAction = applicable.usable ? await requiredEvidenceAction(repo, record, await assessRequiredCriteria(repo, record), "complete")
      : saved.verdict === "fail" && record.workflow.authorization.implementation ? "build" : "review";
  });
}

export async function resumeWork({ repo = process.cwd(), workId }: WorkOptions) {
  const assessment = await assessWork({ repo, workId });
  if (assessment.legacy) return assessment;
  const work = await mutateWork(repo, workId, async (record) => {
    for (const criterion of assessment.criteria) if (!criterion.usable) record.criteria.find((item) => item.id === criterion.id)!.result = "unverified";
    if (!assessment.complete && record.status === "done") record.status = "verifying";
    const invalid    = assessment.criteria.filter((item) => !item.usable)                                                                                                     ;
    const notStarted = invalid.length > 0 && invalid.every((item) => item.reasons.includes("검증 시도 없음"))                                                                 ;
    let nextAction   = "review"                                                                                                                                               ;
    if (notStarted && ["spec", "design", "build", "diagnose"].includes(record.workflow.nextAction)) nextAction = record.workflow.nextAction;
    else {
      const ready = assessment.review.usable && assessment.documentation.usable ? "complete" : "review";
      nextAction = await requiredEvidenceAction(repo, record, assessment.criteria, ready);
      if (nextAction === "review" && record.workflow.reviews.at(-1)?.verdict === "fail" && record.workflow.authorization.implementation) nextAction = "build";
    }
    record.workflow.nextAction = nextAction;
    record.blockedReason = assessment.reasons.length ? assessment.reasons.join("; ") : null;
  });
  return { ...assessment, ...work, nextAction: work.record.workflow.nextAction };
}

export async function completeWork({ repo = process.cwd(), workId, policyRoot }: WorkOptions): Promise<CurrentWorkLocation & { reportHook?: ReportHookResult }> {
  const completion: { narrative?: ReportNarrative; previous?: string; source?: { digest: string; inputs: string[] }; reportHook?: ReportHookResult } = {};
  const saved = await mutateWork(repo, workId, async (record, work) => {
    const assessment = await assessRecord(repo, { ...work, record }, policyRoot);
    if (assessment.legacy || !assessment.complete) throw new Error(`현재 증거로 완료할 수 없습니다: ${assessment.reasons.join("; ")}`);
    if (assessment.report?.reportId) {
      const document = await readWorkReport({ repo, reportId: assessment.report.reportId });
      if (!document.current || document.stale || !document.report.narrative) throw new Error("현재 작업의 저작 서술이 없습니다.");
      if (work.rawSource === undefined) throw new Error("완료 전 작업 기록 원문이 없습니다.");
      completion.previous = work.rawSource;
      completion.narrative = document.report.narrative;
    }
    const source = await captureSource({ repo, inputs: assessment.source.inputs });
    if (source.digest !== assessment.source.digest) throw new Error("완료 판정 중 소스가 바뀌었습니다.");
    completion.source = source;
    record.status              = "done"     ;
    record.blockedReason       = null       ;
    record.workflow.nextAction = "complete" ;
  }, async mutate => {
    const completed = await mutate();
    if (!completion.narrative) return completed;
    try {
      if (completed.rawSource === undefined || completion.source === undefined) throw new Error("완료된 작업의 원문 또는 소스 식별이 없습니다.");
      const completionSource = { workRecordHash: hash(completed.rawSource), sourceDigest: completion.source.digest, inputs: completion.source.inputs };
      const published = await publishWorkReport({ repo, workId, narrative: completion.narrative, event: "complete", completionSource });
      completion.reportHook = { status: "written", reportId: published.report.id, created: published.created };
      return completed;
    } catch (error) {
      // 작업 잠금 아래에서 이 호출이 저장한 상태만 되돌린다.
      if (completion.previous !== undefined && completed.rawSource !== undefined
        && await fs.readFile(completed.path, "utf8") === completed.rawSource) await atomicWrite(completed.path, completion.previous);
      throw new Error(`완료 보고서 저장 실패: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  });
  return completion.reportHook ? { ...saved, reportHook: completion.reportHook } : saved;
}

async function main() {
  const raw: unknown = JSON.parse(process.argv[2] ?? "{}");
  if (!raw || typeof raw !== "object" || !("action" in raw) || typeof raw.action !== "string") throw new Error("지원하지 않는 작업 action입니다.");
  const options    = raw        ;
  const actionName = raw.action ;
  const actions = {
    "add-verifier": addVerificationCommand,
    "continue-work": continueWork,
    "lock-status"       : inspectWorkLock       ,
    "recover-lock"      : recoverWorkLock       ,
    "check-repository"  : checkRepository       ,
    "repository-status" : assessRepositoryCheck ,
    open                : openWork              ,
    adopt               : adoptWork             ,
    read                : readWork              ,
    advance             : advanceWork           ,
    inputs              : setVerificationInputs ,
    "document-review"   : recordDocumentReview  ,
    "recover-result"    : appendPending         ,
    verify              : verifyWork            ,
    status              : assessWork            ,
    resume              : resumeWork            ,
    complete            : completeWork          ,
  };
  if (!(actionName in actions)) throw new Error("지원하지 않는 작업 action입니다.");
  const action = actionName as keyof typeof actions;
  // action별 기존 런타임 검증에 전달하는 CLI 경계다.
  const invoke = actions[action] as (value: Record<string, unknown>) => Promise<unknown> ;
  const result = await invoke(options as Record<string, unknown>)                        ;
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result && typeof result === "object" && "recorded" in result && result.recorded === false) process.exitCode = 1;
}

if (import.meta.url && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });

async function savePending(repo: string, workId: string, kind: "verification" | "review", payload: unknown, commandHash?: string, requestHash?: string, verificationNamespace?: string, reuseGuard?: ReuseRecordGuard, requestId?: string) {
  const root = await fs.realpath(repo);
  await resolveInside(root, ".www");
  const directory = path.join(root, ".www", "pending-results");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await resolveInside(root, ".www/pending-results");
  if (!payload || typeof payload !== "object" || !("id" in payload) || typeof payload.id !== "string" || !/^[a-zA-Z0-9-]+$/.test(payload.id)) throw new Error("결과 ID 오류");
  if (!requestHash || !requestId) {
    const current = await readWork({ repo, workId });
    if (current.record.schemaVersion !== 2) throw new Error("현재 작업이 필요합니다.");
    requestHash ??= current.record.workflow.requestHash;
    requestId ??= current.record.workflow.requestId;
  }
  const text   = `${JSON.stringify({ version: 1, kind, workId, workRequestHash: requestHash, workRequestId: requestId, ...(commandHash ? { commandHash } : {}), ...(reuseGuard ? { reuseGuard } : {}), payload })}\n` ;
  const target = path.join(directory, `${kind === "review" ? "review" : "attempt"}-${hash(verificationNamespace ? verificationNamespace + ":" + payload.id + ":" + JSON.stringify(reuseGuard ?? null) : payload.id)}.json`)                                        ;
  try { await durableJson(target, text); }
  catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST") || await fs.readFile(target, "utf8") !== text) throw error;
  }
  return path.relative(root, target);
}
export async function appendPending({ repo = process.cwd(), workId, artifactPath }: WorkOptions & { artifactPath: string }) {
  if (typeof artifactPath !== "string" || !/^\.www[\/]pending-results[\/](?:attempt|review)-[a-zA-Z0-9-]+\.json$/.test(artifactPath)) throw new Error("회수할 결과 artifact 경로 오류");
  const target         = await resolveInside(repo, artifactPath)       ;
  const value: unknown = JSON.parse(await fs.readFile(target, "utf8")) ;
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("workId" in value) || value.workId !== workId || !("payload" in value) || !("kind" in value)) throw new Error("회수 결과의 작업 불일치");
  const current = await readWork({ repo, workId });
  if (current.record.schemaVersion !== 2 || !("workRequestHash" in value) || typeof value.workRequestHash !== "string" || current.record.workflow.requestHash !== value.workRequestHash) throw new Error("회수 결과의 요청 hash 불일치");
  const payload = value.payload;
  const expectedRequestHash = value.workRequestHash;
  const expectedRequestId = "workRequestId" in value && typeof value.workRequestId === "string" ? value.workRequestId : undefined;
  if (expectedRequestId !== undefined ? expectedRequestId !== current.record.workflow.requestId : !!current.record.workflow.continuations?.length) {
    throw new Error("회수 결과의 요청 ID 불일치");
  }
  try {
    const work = await retryWorkWriter(async () => {
      if (value.kind === "review") return appendReview(repo, workId, payload, expectedRequestHash, expectedRequestId);
      if (value.kind !== "verification" || !payload || typeof payload !== "object" || !("executor" in payload) || payload.executor !== "process") throw new Error("실제 검증 결과가 필요합니다.");
      assertPendingAttempt(payload);
      if (!("commandHash" in value) || typeof value.commandHash !== "string" || !/^[a-f0-9]{64}$/.test(value.commandHash)) throw new Error("회수할 검증 명령 식별 누락");
      let reuseGuard: ReuseRecordGuard | undefined;
      if ('reuseGuard' in value) {
        const guard = value.reuseGuard;
        if (!guard || typeof guard !== 'object' || !('context' in guard) || typeof guard.context !== 'string' || !/^[a-f0-9]{64}$/.test(guard.context) || !('useId' in guard) || typeof guard.useId !== 'string' || !/^verification-use-[a-f0-9-]+$/.test(guard.useId)) throw new Error('재사용 기록 맥락 형식 오류');
        reuseGuard = { context: guard.context, useId: guard.useId };
      }
      return appendVerification(repo, workId, payload, value.commandHash, expectedRequestHash, expectedRequestId, reuseGuard);
    });
    return { recorded: true as const, artifactPath, work };
  } catch (error) {
    if (error instanceof WorkLockBusyError) return { recorded: false as const, artifactPath, reason: error.code };
    throw error;
  }
}

// durable 파일도 unknown 입력이다. 렌더링·원장 쓰기 전에 중첩 형식을 확인한다.
function assertPendingAttempt(value: unknown): asserts value is VerificationAttempt {
  const object       = (item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item) ;
  const strings      = (item: unknown): item is string[] => Array.isArray(item) && item.every(entry => typeof entry === "string")     ;
  const hashValue    = (item: unknown) => typeof item === "string" && /^[a-f0-9]{64}$/.test(item)                                     ;
  const nullableText = (item: unknown) => item === null || typeof item === "string"                                                   ;
  if (!object(value) || typeof value.id !== "string" || !/^attempt-[a-f0-9-]+$/i.test(value.id)) throw new Error("회수 검증 시도 형식 오류");
  for (const field of ["startedAt", "completedAt", "command", "requestedCommand"]) if (typeof value[field] !== "string") throw new Error("회수 검증 문자열 필드 오류");
  for (const field of ["argumentsRedacted", "sourceStable", "environmentStable"]) if (typeof value[field] !== "boolean") throw new Error("회수 검증 boolean 필드 오류");
  if (!strings(value.args) || !strings(value.criterionIds) || !value.criterionIds.length || !hashValue(value.criteriaDigest) || !["passed", "failed"].includes(String(value.result)) || value.executor !== "process" || !(value.exitCode === null || (Number.isInteger(value.exitCode))) || !nullableText(value.signal) || !nullableText(value.error)) throw new Error("회수 검증 실행 필드 오류");
  const source = value.source, environment = value.environment;
  if (!object(source) || !hashValue(source.digest) || !strings(source.inputs) || !nullableText(source.head) || !Array.isArray(source.files) || source.files.some(file => !object(file) || typeof file.path !== "string" || !["file", "directory", "missing"].includes(String(file.type)) || (file.type === "file" && (!hashValue(file.digest) || !Number.isInteger(file.mode))))) throw new Error("회수 검증 소스 형식 오류");
  if (!Array.isArray(value.criteriaSnapshot) || value.criteriaSnapshot.some(item => !object(item) || typeof item.id !== "string" || typeof item.description !== "string" || typeof item.required !== "boolean" || !strings(item.requirementRefs))) throw new Error("회수 검증 기준 형식 오류");
  if (!object(environment) || ["platform", "arch", "node"].some(field => typeof environment[field] !== "string") || !(environment.executable === null || (object(environment.executable) && typeof environment.executable.path === "string" && hashValue(environment.executable.digest)))) throw new Error("회수 검증 환경 형식 오류");
  if (value.environmentObservation !== undefined && !validEnvironmentObservation(value.environmentObservation)) throw new Error("회수 검증 확장 환경 관측 형식 오류");
  if (value.artifactsStable !== undefined && typeof value.artifactsStable !== "boolean") throw new Error("회수 검증 artifact 현재성 오류");
  if (value.artifacts !== undefined && (!Array.isArray(value.artifacts) || value.artifacts.some(item => !object(item) || typeof item.path !== "string" || !Number.isInteger(item.size) || !hashValue(item.digest)))) throw new Error("회수 검증 artifact 형식 오류");
  if (value.output !== undefined) {
    if (!object(value.output)) throw new Error("회수 검증 출력 형식 오류");
    for (const stream of [value.output.stdout, value.output.stderr]) if (!object(stream) || !hashValue(stream.digest) || !Number.isInteger(stream.bytes) || !Number.isInteger(stream.retainedBytes) || typeof stream.truncated !== "boolean" || typeof stream.contentRetained !== "boolean") throw new Error("회수 검증 출력 요약 오류");
  }
}
