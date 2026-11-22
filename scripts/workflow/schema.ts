/**
 * @architecture arch.development.records.validation
 * @implements RESP-DEVELOPMENT-RECORDS-VALIDATION
 */
import { createHash } from "node:crypto";
import type { WorkRecord } from "./types.ts";
import { artifactReviewErrors } from "./artifacts.ts";
import { parseDecomposition } from "./decomposition.ts";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { normalize, resolve, sep } from "node:path";

const STATUSES          = new Set<unknown>(["draft", "ready", "in_progress", "verifying", "done", "cancelled"]) ;
const KINDS             = new Set<unknown>(["feature", "bug", "maintenance"])                                   ;
const AREAS             = new Set<unknown>(["ui", "dev", "ops"])                                                ;
const RESULTS           = new Set<unknown>(["unverified", "passed", "failed", "blocked"])                       ;
const RELATIONS         = new Set<unknown>(["fixes", "relates_to"])                                             ;
export const WORK_ID    = /^work-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i     ;
export const WORK_DIR   = /^([0-9]{3,})-(.+)$/u                                                                 ;
const WINDOWS_FORBIDDEN = /[<>:"/\\|?*]/u                                                                       ;

export function add(errors: string[], condition: unknown, message: string) { if (!condition) errors.push(message); }
export function collisionKey(value: string) { return value.normalize("NFC").toLocaleLowerCase("und"); }
export function validSegment(value: string) {
  return value && value !== "." && value !== ".." && !WINDOWS_FORBIDDEN.test(value) && !/[ .]$/u.test(value);
}

export function validateRequirementRefs(record: { criteria?: { id: string; requirementRefs?: string[] }[] }, { root }: { root: string }) {
  const errors: string[] = []                 ;
  const base             = realpathSync(root) ;
  for (const criterion of record.criteria ?? []) {
    for (const ref of criterion.requirementRefs ?? []) {
      try {
        const [file, anchor, extra] = ref.split("#");
        if (!file || !anchor || extra !== undefined || !file.endsWith(".md")) throw new Error("문서와 명시 앵커가 필요합니다.");
        const target = realpathSync(resolve(base, decodeURIComponent(file)));
        if (!target.startsWith(`${base}${sep}`)) throw new Error("참조가 저장소를 벗어납니다.");
        const source = readFileSync(target, "utf8");
        if (!source.includes(`id="${anchor}"`) && !source.includes(`{#${anchor}}`)) throw new Error("명시 앵커가 없습니다.");
      } catch { errors.push(`${criterion.id}의 요구사항 참조가 올바르지 않습니다: ${ref}`); }
    }
  }
  return errors;
}

export interface ValidationOptions {
  baseDir?   : string                    ;
  pathExists?: (file: string) => boolean ;
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function objects(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.map(object) : []; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function validateVerifierHistory(
  errors: string[], workId: unknown, requestId: unknown,
  authorization: Record<string, unknown>, history: unknown,
): Record<string, unknown> {
  if (history !== undefined) {
      add(errors, Array.isArray(history), "verifierAuthorizations는 배열이어야 합니다.");
      const ids = new Set<unknown>();
      const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value) ?? "").digest("hex");
      let previous: unknown;
      for (const item of list(history)) {
        const entry = object(item);
        add(errors, entry.version === 1 && typeof entry.authorizedAt === "string" && Number.isFinite(Date.parse(entry.authorizedAt)), "검증 명령 권한 이력 버전·시각이 올바르지 않습니다.");
        add(errors, typeof entry.requestId === "string" && entry.requestId.trim() && entry.requestId !== requestId && !ids.has(entry.requestId), "검증 명령 권한 requestId가 없거나 중복됩니다.");
        ids.add(entry.requestId);
        for (const field of ["requestHash", "originalRequestHash", "payloadDigest", "beforeDigest", "afterDigest"]) add(errors, typeof entry[field] === "string" && /^[a-f0-9]{64}$/.test(entry[field]), `검증 명령 권한 ${field}가 필요합니다.`);
        add(errors, entry.originalRequestHash === authorization.requestHash, "검증 명령 권한 원래 요청 hash 불일치");
        if (entry.originalRequestId !== undefined) add(errors, typeof entry.originalRequestId === "string" && !!entry.originalRequestId.trim() && entry.originalRequestId === requestId, "검증 명령 권한 원래 요청 ID 불일치");
        const argvValid = typeof entry.command === "string" && entry.command.trim() && !entry.command.includes("\0") && Array.isArray(entry.args) && entry.args.every(arg => typeof arg === "string" && !arg.includes("\0"));
        add(errors, argvValid, "검증 명령 권한 argv가 올바르지 않습니다.");
        const before = object(entry.before), after = object(entry.after);
        add(errors, entry.beforeDigest === digest(before) && entry.afterDigest === digest(after), "검증 명령 권한 snapshot digest 불일치");
        const { verifierCommands: _currentCommands, ...currentScope } = authorization;
        const { verifierCommands: _beforeCommands, ...beforeScope } = before;
        add(errors, JSON.stringify(currentScope) === JSON.stringify(beforeScope) && Array.isArray(before.verifierCommands) && before.verifierCommands.every(command => typeof command === "string" && command.trim()), "검증 명령 권한 snapshot의 전체 권한이 현재 범위와 다릅니다.");
        if (previous !== undefined) add(errors, JSON.stringify(previous) === JSON.stringify(before), "검증 명령 권한 이력 연결 불일치");
        previous = after;
        const signature = JSON.stringify([entry.command, ...list(entry.args)]);
        const commands = list(before.verifierCommands);
        const added = !commands.includes(signature);
        add(errors, typeof entry.added === "boolean" && entry.added === added && JSON.stringify(after) === JSON.stringify({ ...before, verifierCommands: added ? [...commands, signature] : commands }), "검증 명령 권한은 정확 argv append만 허용합니다.");
        add(errors, entry.payloadDigest === digest({ workId, requestHash: entry.requestHash, expectedRequestHash: entry.originalRequestHash, expectedAuthorizationDigest: entry.beforeDigest, command: entry.command, args: entry.args, expectedRequestId: entry.originalRequestId }), "검증 명령 권한 payload digest 불일치");
      }
      if (previous !== undefined) add(errors, JSON.stringify(previous) === JSON.stringify(authorization), "검증 명령 권한 이력과 현재 권한 불일치");
      if (list(history).length) return object(object(list(history)[0]).before);
    }
  return authorization;
}

function validateContinuations(
  errors: string[], workId: unknown, workflow: Record<string, unknown>, authorization: Record<string, unknown>,
) {
  const initialAuthorization = validateVerifierHistory(errors, workId, workflow.requestId, authorization, workflow.verifierAuthorizations);
  if (workflow.continuations === undefined) return;
  add(errors, Array.isArray(workflow.continuations), "후속 요청 이력은 배열이어야 합니다.");
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value) ?? "").digest("hex");
  const ids = new Set<unknown>();
  const register = (id: unknown) => {
    add(errors, typeof id === "string" && id.trim() && !ids.has(id), "후속 요청 이력의 requestId가 없거나 중복됩니다.");
    ids.add(id);
  };
  const validBinding = (binding: Record<string, unknown>) => {
    const auth = object(binding.authorization);
    return typeof binding.requestId === "string" && binding.requestId.trim() &&
      typeof auth.requestHash === "string" && /^[a-f0-9]{64}$/.test(auth.requestHash) &&
      auth.source === "direct_user_request" && ["implementation", "commit", "publish"].every(key => typeof auth[key] === "boolean") &&
      ["writePaths", "mutationSurfaces", "verifierCommands"].every(key => Array.isArray(auth[key]) && list(auth[key]).every(part => typeof part === "string" && part.trim())) &&
      Array.isArray(binding.inputs) && binding.inputs.length && binding.inputs.every(part => typeof part === "string" && part.trim());
  };
  let previous: Record<string, unknown> | undefined;
  let verificationStart = 0;
  for (const entry of objects(workflow.continuations)) {
    const before = object(entry.before), after = object(entry.after);
    const previousAuth = object(before.authorization), nextAuth = object(after.authorization);
    add(errors, (entry.version === 1 || entry.version === 2) && typeof entry.authorizedAt === "string" && Number.isFinite(Date.parse(entry.authorizedAt)), "후속 요청 이력 버전·시각이 올바르지 않습니다.");
    if (entry.version === 2 || entry.verificationStart !== undefined) {
      add(errors, typeof entry.verificationStart === "number" && Number.isSafeInteger(entry.verificationStart) &&
        entry.verificationStart >= verificationStart && entry.verificationStart <= list(workflow.verifications).length, "후속 요청의 검증 시작 위치가 올바르지 않습니다.");
      if (typeof entry.verificationStart === "number") verificationStart = entry.verificationStart;
    }
    add(errors, validBinding(before) && validBinding(after), "후속 요청 이력의 작업 범위가 올바르지 않습니다.");
    add(errors, nextAuth.implementation === true && nextAuth.commit === false && nextAuth.publish === false && list(nextAuth.writePaths).length && list(nextAuth.mutationSurfaces).length, "후속 요청의 권한은 구현 범위여야 합니다.");
    const previousInitial = validateVerifierHistory(errors, workId, before.requestId, previousAuth, entry.previousVerifiers);
    if (!previous) register(before.requestId);
    else add(errors, previous.requestId === before.requestId && digest(previous.authorization) === digest(previousInitial), "후속 요청 이력 연결이 일치하지 않습니다.");
    for (const verifier of objects(entry.previousVerifiers)) register(verifier.requestId);
    register(after.requestId);
    add(errors, entry.payloadDigest === digest({ workId, expectedRequestHash: previousAuth.requestHash,
      expectedAuthorizationDigest: digest(previousAuth), after, ...(entry.version === 2 ? { expectedRequestId: before.requestId } : {}) }), "후속 요청 내용 digest가 일치하지 않습니다.");
    previous = after;
  }
  for (const verifier of objects(workflow.verifierAuthorizations)) register(verifier.requestId);
  if (previous) add(errors, previous.requestId === workflow.requestId &&
    digest(previous.authorization) === digest(initialAuthorization), "후속 요청 이력과 현재 요청이 일치하지 않습니다.");
}

export function validateWorkRecord(value: unknown, options: ValidationOptions = {}): string[] {
  const record           = object(value)                             ;
  const errors: string[] = []                                        ;
  const baseDir          = resolve(options.baseDir ?? process.cwd()) ;
  const pathExists       = options.pathExists ?? existsSync          ;
  add(errors, value && typeof value === "object" && !Array.isArray(value), "작업 기록은 JSON 객체여야 합니다.");
  if (errors.length) return errors;
  add(errors, [1, 2].some(version => version === record.schemaVersion), "schemaVersion은 1 또는 2여야 합니다.");
  add(errors, typeof record.id === "string" && WORK_ID.test(record.id), "id는 work-UUID 형식이어야 합니다.");
  add(errors, typeof record.title === "string" && record.title.trim().length > 0, "title은 비어 있지 않아야 합니다.");
  add(errors, KINDS.has(record.kind), "kind가 허용된 값이 아닙니다.");
  add(errors, Array.isArray(record.areas) && record.areas.length > 0 && new Set(record.areas).size === record.areas.length && record.areas.every((area) => AREAS.has(area)), "areas는 중복 없는 ui/dev/ops 배열이어야 합니다.");
  add(errors, AREAS.has(record.owner), "owner는 ui/dev/ops 중 하나여야 합니다.");
  add(errors, Array.isArray(record.areas) && record.areas.includes(record.owner), "owner는 areas에도 포함되어야 합니다.");
  add(errors, STATUSES.has(record.status), "status가 허용된 값이 아닙니다.");
  add(errors, record.blockedReason === null || (typeof record.blockedReason === "string" && record.blockedReason.trim()), "blockedReason은 null 또는 비어 있지 않은 문자열이어야 합니다.");
  add(errors, Array.isArray(record.relations), "relations는 배열이어야 합니다.");
  for (const [index, relation] of objects(record.relations).entries()) {
    add(errors, relation && RELATIONS.has(relation.type), `relations[${index}].type이 허용된 값이 아닙니다.`);
    add(errors, relation && typeof relation.target === "string" && WORK_ID.test(relation.target), `relations[${index}].target은 work-UUID여야 합니다.`);
  }
  add(errors, Array.isArray(record.criteria) && record.criteria.length > 0, "criteria는 하나 이상이어야 합니다.");
  const ids = new Set<unknown>();
  for (const [index, criterion] of objects(record.criteria).entries()) {
    add(errors, criterion && typeof criterion.id === "string" && criterion.id.trim(), `criteria[${index}].id가 비어 있습니다.`);
    if (criterion?.id) { add(errors, !ids.has(criterion.id), `criteria id가 중복됩니다: ${criterion.id}`); ids.add(criterion.id); }
    add(errors, criterion && typeof criterion.description === "string" && criterion.description.trim(), `criteria[${index}].description이 비어 있습니다.`);
    add(errors, criterion && typeof criterion.required === "boolean", `criteria[${index}].required는 boolean이어야 합니다.`);
    add(errors, criterion && RESULTS.has(criterion.result), `criteria[${index}].result가 허용된 값이 아닙니다.`);
    add(errors, criterion && Array.isArray(criterion.evidence), `criteria[${index}].evidence는 배열이어야 합니다.`);
    if (criterion?.requirementRefs !== undefined) add(errors, Array.isArray(criterion.requirementRefs) && criterion.requirementRefs.every((ref) => typeof ref === "string" && ref.trim()), `criteria[${index}].requirementRefs는 문자열 배열이어야 합니다.`);
    for (const [evidenceIndex, evidence] of objects(criterion?.evidence).entries()) {
      const prefix = `criteria[${index}].evidence[${evidenceIndex}]`;
      add(errors, evidence && typeof evidence.path === "string", `${prefix}.path가 필요합니다.`);
      add(errors, evidence && typeof evidence.summary === "string" && evidence.summary.trim(), `${prefix}.summary가 비어 있습니다.`);
      if (typeof evidence?.path !== "string") continue;
      const [filePart, anchor] = evidence.path.split("#");
      const target = resolve(baseDir, normalize(filePart))                       ;
      const within = target === baseDir || target.startsWith(`${baseDir}${sep}`) ;
      add(errors, filePart === "verification.md" && Boolean(anchor), `${prefix}.path는 verification.md#앵커 형식이어야 합니다.`);
      add(errors, within, `${prefix}.path가 작업 디렉터리를 벗어납니다.`);
      add(errors, within && pathExists(target), `${prefix}가 가리키는 verification.md가 없습니다.`);
      if (within && pathExists(target) && anchor) {
        const text = readFileSync(target, "utf8");
        add(errors, text.includes(`id="${anchor}"`) || new RegExp(`^#{1,6}\\s+.*\\{#${anchor}\\}`, "m").test(text), `${prefix}의 앵커를 찾을 수 없습니다.`);
      }
    }
  }
  if (record.schemaVersion === 2) {
    const workflow      = object(record.workflow       ) ;
    const authorization = object(workflow.authorization) ;
    add(errors, Array.isArray(record.criteria) && record.criteria.some((criterion) => criterion?.required === true), "새 역할 작업에는 필수 수용 기준이 하나 이상 필요합니다.");
    add(errors, workflow?.role === "www-dev", "workflow.role은 www-dev여야 합니다.");
    add(errors, typeof workflow?.requestId === "string" && workflow.requestId.trim(), "workflow.requestId가 필요합니다.");
    add(errors, typeof workflow?.requestHash === "string" && /^[a-f0-9]{64}$/.test(workflow.requestHash), "workflow.requestHash가 필요합니다.");
    add(errors, authorization.source === "direct_user_request" && authorization.requestHash === workflow.requestHash, "직접 요청과 연결된 workflow.authorization이 필요합니다.");
    for (const field of ["writePaths", "mutationSurfaces", "verifierCommands"]) add(errors, Array.isArray(authorization[field]) && list(authorization[field]).every((item) => typeof item === "string" && item.trim()), `workflow.authorization.${field} 배열이 필요합니다.`);
    add(errors, Array.isArray(authorization.writePaths) && authorization.writePaths.every((item) => typeof item === "string" && !/[\\\x00]/.test(item) && !item.split("/").includes("..") && !/^(?:[\\/]|[A-Za-z]:)/.test(item)), "workflow.authorization.writePaths는 저장소 내부 상대 경로여야 합니다.");
    for (const field of ["implementation", "commit", "publish"]) add(errors, typeof authorization[field] === "boolean", `workflow.authorization.${field}은 boolean이어야 합니다.`);
    add(errors, Array.isArray(workflow?.inputs) && workflow.inputs.length > 0 && workflow.inputs.every((item) => typeof item === "string" && item.trim() && !/[\\\x00]/.test(item) && !item.split("/").includes("..") && !/^(?:[\\/]|[A-Za-z]:)/.test(item)), "workflow.inputs는 저장소 내부 상대 경로 배열이어야 합니다.");
    add(errors, ["spec", "design", "build", "diagnose", "verify", "review", "complete"].some(action => action === workflow.nextAction), "workflow.nextAction이 허용된 값이 아닙니다.");
    add(errors, Array.isArray(workflow?.verifications), "workflow.verifications 배열이 필요합니다.");
    add(errors, Array.isArray(workflow?.reviews), "workflow.reviews 배열이 필요합니다.");
    validateContinuations(errors, record.id, workflow, authorization);
    if (workflow.decomposition !== undefined) {
      try { parseDecomposition(workflow.decomposition); }
      catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    }
    for (const review of objects(workflow.reviews)) if (review.recordingRejection !== undefined) add(errors, Array.isArray(review.recordingRejection) && review.recordingRejection.length > 0 && review.recordingRejection.every(reason => typeof reason === "string" && reason.trim()), "검토 기록 거부 이유는 비어 있지 않은 문자열 배열이어야 합니다.");
    if (workflow?.documentationReviews !== undefined) {
      add(errors, Array.isArray(workflow.documentationReviews), "workflow.documentationReviews는 배열이어야 합니다.");
      const ids = new Set<unknown>();
      for (const review of objects(workflow.documentationReviews)) {
        add(errors, typeof review?.id === "string" && /^documentation-[a-f0-9-]+$/i.test(review.id) && !ids.has(review.id), "문서 검토 ID가 없거나 중복됩니다.");
        if (review?.id) ids.add(review.id);
        add(errors, review?.version === 1 && typeof review.reviewedAt === "string" && Number.isFinite(Date.parse(review.reviewedAt)), "문서 검토 버전·시각이 올바르지 않습니다.");
        for (const field of ["sourceDigest", "criteriaDigest", "documentsDigest"]) add(errors, /^[a-f0-9]{64}$/.test(String(review?.[field] ?? "")), `문서 검토 ${field}가 필요합니다.`);
        add(errors, Array.isArray(review?.documents) && review.documents.length > 0 && review.documents.every((item) => typeof item?.path === "string" && ["updated", "unchanged", "not_applicable"].includes(item.decision) && typeof item.reason === "string" && item.reason.trim()), "문서 검토 경로·판단·이유가 필요합니다.");
      }
    }
    if (workflow.artifactReviews !== undefined) {
      add(errors, Array.isArray(workflow.artifactReviews), "artifactReviews는 배열이어야 합니다.");
      const reviewIds = new Set<unknown>();
      for (const review of list(workflow.artifactReviews)) {
        errors.push(...artifactReviewErrors(review));
        if (review && typeof review === "object" && "id" in review) {
          add(errors, !reviewIds.has(review.id), "산출물 검토 ID가 중복됩니다.");
          reviewIds.add(review.id);
        }
      }
    }
    const attempts = new Map<string, Record<string, unknown>>();
    for (const attempt of objects(workflow.verifications)) {
      if (attempt.environmentObservation !== undefined) {
        const observation = object(attempt.environmentObservation);
        add(errors, observation.version === 1 && Array.isArray(observation.tools) && observation.tools.length > 0
          && ["tools", "environmentPaths"].every(field => Array.isArray(observation[field]) && list(observation[field]).every(item => typeof item === "string" && item.trim() && !item.includes("\0")))
          && (observation.digest === null || typeof observation.digest === "string" && /^[a-f0-9]{64}$/.test(observation.digest)), "검증 시도의 확장 환경 관측 형식이 올바르지 않습니다.");
      }
      add(errors, typeof attempt?.id === "string" && /^attempt-[a-f0-9-]+$/i.test(attempt.id) && !attempts.has(String(attempt.id)), "검증 시도 ID가 없거나 중복됩니다.");
      add(errors, /^[a-f0-9]{64}$/.test(String(object(attempt.source).digest ?? "")) && /^[a-f0-9]{64}$/.test(String(attempt?.criteriaDigest ?? "")), "검증 시도의 소스·기준 식별값이 필요합니다.");
      add(errors, Array.isArray(attempt?.criterionIds) && attempt.criterionIds.length > 0 && new Set(attempt.criterionIds).size === attempt.criterionIds.length && attempt.criterionIds.every((id) => typeof id === "string" && id.trim()), "검증 시도의 수용 기준 연결이 올바르지 않습니다.");
      if (attempt?.id) attempts.set(String(attempt.id), attempt);
    }
    for (const criterion of objects(record.criteria)) {
      for (const evidence of objects(criterion?.evidence)) add(errors, typeof evidence.attemptId === "string" && attempts.has(evidence.attemptId) && list(attempts.get(evidence.attemptId)?.criterionIds).includes(criterion.id), `${criterion.id} 증거가 실제 기록된 검증 시도에 연결돼야 합니다.`);
      if (record.status === "done" && criterion.required) {
        const latest = [...attempts.values()].filter((attempt) => list(attempt.criterionIds).includes(criterion.id)).at(-1);
        add(errors, latest?.executor === "process" && latest.result === "passed" && latest.exitCode === 0 && latest.sourceStable === true && latest.environmentStable === true, `done 작업의 ${criterion.id}에는 최근 실제 검증 통과가 필요합니다.`);
      }
    }
    if (record.status === "done") add(errors, objects(workflow.reviews).at(-1)?.verdict === "pass", "done 작업에는 독립 검토 기록이 필요합니다. 현재 적용성은 완료 판정 코드에서 확인합니다.");
  }
  if (record.status === "done") {
    add(errors, record.blockedReason === null, "done 작업에는 blockedReason이 없어야 합니다.");
    for (const criterion of objects(record.criteria)) if (criterion?.required) {
      add(errors, criterion.result === "passed", `done 작업의 필수 기준 ${criterion.id ?? "(알 수 없음)"}은 passed여야 합니다.`);
      add(errors, Array.isArray(criterion.evidence) && criterion.evidence.length > 0, `done 작업의 필수 기준 ${criterion.id ?? "(알 수 없음)"}에는 증거가 필요합니다.`);
    }
  }
  return errors;
}


// JSON 입력은 기존 계약 검사에 성공한 뒤에만 실행 타입으로 좁힌다.
export function parseWorkRecord(value: unknown, options: ValidationOptions = {}): WorkRecord {
  const errors = validateWorkRecord(value, options);
  if (errors.length) throw new Error(`작업 기록이 올바르지 않습니다: ${errors.join('; ')}`);
  return value as WorkRecord;
}
