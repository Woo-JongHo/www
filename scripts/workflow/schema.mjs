import { existsSync, readFileSync, realpathSync } from "node:fs";
import { normalize, resolve, sep } from "node:path";

const STATUSES = new Set(["draft", "ready", "in_progress", "verifying", "done", "cancelled"]);
const KINDS = new Set(["feature", "bug", "maintenance"]);
const AREAS = new Set(["ui", "dev", "ops"]);
const RESULTS = new Set(["unverified", "passed", "failed", "blocked"]);
const RELATIONS = new Set(["fixes", "relates_to"]);
export const WORK_ID = /^work-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const WORK_DIR = /^([0-9]{3,})-(.+)$/u;
const WINDOWS_FORBIDDEN = /[<>:"/\\|?*]/u;

export function add(errors, condition, message) { if (!condition) errors.push(message); }
export function collisionKey(value) { return value.normalize("NFC").toLocaleLowerCase("und"); }
export function validSegment(value) {
  return value && value !== "." && value !== ".." && !WINDOWS_FORBIDDEN.test(value) && !/[ .]$/u.test(value);
}

export function validateRequirementRefs(record, { root }) {
  const errors = [];
  const base = realpathSync(root);
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

export function validateWorkRecord(record, options = {}) {
  const errors = [];
  const baseDir = resolve(options.baseDir ?? process.cwd());
  const pathExists = options.pathExists ?? existsSync;
  add(errors, record && typeof record === "object" && !Array.isArray(record), "작업 기록은 JSON 객체여야 합니다.");
  if (errors.length) return errors;
  add(errors, [1, 2].includes(record.schemaVersion), "schemaVersion은 1 또는 2여야 합니다.");
  add(errors, typeof record.id === "string" && WORK_ID.test(record.id), "id는 work-UUID 형식이어야 합니다.");
  add(errors, typeof record.title === "string" && record.title.trim().length > 0, "title은 비어 있지 않아야 합니다.");
  add(errors, KINDS.has(record.kind), "kind가 허용된 값이 아닙니다.");
  add(errors, Array.isArray(record.areas) && record.areas.length > 0 && new Set(record.areas).size === record.areas.length && record.areas.every((area) => AREAS.has(area)), "areas는 중복 없는 ui/dev/ops 배열이어야 합니다.");
  add(errors, AREAS.has(record.owner), "owner는 ui/dev/ops 중 하나여야 합니다.");
  add(errors, Array.isArray(record.areas) && record.areas.includes(record.owner), "owner는 areas에도 포함되어야 합니다.");
  add(errors, STATUSES.has(record.status), "status가 허용된 값이 아닙니다.");
  add(errors, record.blockedReason === null || (typeof record.blockedReason === "string" && record.blockedReason.trim()), "blockedReason은 null 또는 비어 있지 않은 문자열이어야 합니다.");
  add(errors, Array.isArray(record.relations), "relations는 배열이어야 합니다.");
  for (const [index, relation] of (Array.isArray(record.relations) ? record.relations : []).entries()) {
    add(errors, relation && RELATIONS.has(relation.type), `relations[${index}].type이 허용된 값이 아닙니다.`);
    add(errors, relation && typeof relation.target === "string" && WORK_ID.test(relation.target), `relations[${index}].target은 work-UUID여야 합니다.`);
  }
  add(errors, Array.isArray(record.criteria) && record.criteria.length > 0, "criteria는 하나 이상이어야 합니다.");
  const ids = new Set();
  for (const [index, criterion] of (Array.isArray(record.criteria) ? record.criteria : []).entries()) {
    add(errors, criterion && typeof criterion.id === "string" && criterion.id.trim(), `criteria[${index}].id가 비어 있습니다.`);
    if (criterion?.id) { add(errors, !ids.has(criterion.id), `criteria id가 중복됩니다: ${criterion.id}`); ids.add(criterion.id); }
    add(errors, criterion && typeof criterion.description === "string" && criterion.description.trim(), `criteria[${index}].description이 비어 있습니다.`);
    add(errors, criterion && typeof criterion.required === "boolean", `criteria[${index}].required는 boolean이어야 합니다.`);
    add(errors, criterion && RESULTS.has(criterion.result), `criteria[${index}].result가 허용된 값이 아닙니다.`);
    add(errors, criterion && Array.isArray(criterion.evidence), `criteria[${index}].evidence는 배열이어야 합니다.`);
    if (criterion?.requirementRefs !== undefined) add(errors, Array.isArray(criterion.requirementRefs) && criterion.requirementRefs.every((ref) => typeof ref === "string" && ref.trim()), `criteria[${index}].requirementRefs는 문자열 배열이어야 합니다.`);
    for (const [evidenceIndex, evidence] of (Array.isArray(criterion?.evidence) ? criterion.evidence : []).entries()) {
      const prefix = `criteria[${index}].evidence[${evidenceIndex}]`;
      add(errors, evidence && typeof evidence.path === "string", `${prefix}.path가 필요합니다.`);
      add(errors, evidence && typeof evidence.summary === "string" && evidence.summary.trim(), `${prefix}.summary가 비어 있습니다.`);
      if (typeof evidence?.path !== "string") continue;
      const [filePart, anchor] = evidence.path.split("#");
      const target = resolve(baseDir, normalize(filePart));
      const within = target === baseDir || target.startsWith(`${baseDir}${sep}`);
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
    const workflow = record.workflow;
    add(errors, Array.isArray(record.criteria) && record.criteria.some((criterion) => criterion?.required === true), "새 역할 작업에는 필수 수용 기준이 하나 이상 필요합니다.");
    add(errors, workflow?.role === "www-dev", "workflow.role은 www-dev여야 합니다.");
    add(errors, typeof workflow?.requestId === "string" && workflow.requestId.trim(), "workflow.requestId가 필요합니다.");
    add(errors, typeof workflow?.requestHash === "string" && /^[a-f0-9]{64}$/.test(workflow.requestHash), "workflow.requestHash가 필요합니다.");
    add(errors, workflow?.authorization?.source === "direct_user_request" && workflow.authorization.requestHash === workflow.requestHash, "직접 요청과 연결된 workflow.authorization이 필요합니다.");
    for (const field of ["writePaths", "mutationSurfaces", "verifierCommands"]) add(errors, Array.isArray(workflow?.authorization?.[field]) && workflow.authorization[field].every((item) => typeof item === "string" && item.trim()), `workflow.authorization.${field} 배열이 필요합니다.`);
    add(errors, Array.isArray(workflow?.authorization?.writePaths) && workflow.authorization.writePaths.every((item) => typeof item === "string" && !/[\\\x00]/.test(item) && !item.split("/").includes("..") && !/^(?:[\\/]|[A-Za-z]:)/.test(item)), "workflow.authorization.writePaths는 저장소 내부 상대 경로여야 합니다.");
    for (const field of ["implementation", "commit", "publish"]) add(errors, typeof workflow?.authorization?.[field] === "boolean", `workflow.authorization.${field}은 boolean이어야 합니다.`);
    add(errors, Array.isArray(workflow?.inputs) && workflow.inputs.length > 0 && workflow.inputs.every((item) => typeof item === "string" && item.trim() && !/[\\\x00]/.test(item) && !item.split("/").includes("..") && !/^(?:[\\/]|[A-Za-z]:)/.test(item)), "workflow.inputs는 저장소 내부 상대 경로 배열이어야 합니다.");
    add(errors, ["spec", "design", "build", "diagnose", "verify", "review", "complete"].includes(workflow?.nextAction), "workflow.nextAction이 허용된 값이 아닙니다.");
    add(errors, Array.isArray(workflow?.verifications), "workflow.verifications 배열이 필요합니다.");
    add(errors, Array.isArray(workflow?.reviews), "workflow.reviews 배열이 필요합니다.");
    const attempts = new Map();
    for (const attempt of Array.isArray(workflow?.verifications) ? workflow.verifications : []) {
      add(errors, typeof attempt?.id === "string" && /^attempt-[a-f0-9-]+$/i.test(attempt.id) && !attempts.has(attempt.id), "검증 시도 ID가 없거나 중복됩니다.");
      add(errors, /^[a-f0-9]{64}$/.test(attempt?.source?.digest ?? "") && /^[a-f0-9]{64}$/.test(attempt?.criteriaDigest ?? ""), "검증 시도의 소스·기준 식별값이 필요합니다.");
      add(errors, Array.isArray(attempt?.criterionIds) && attempt.criterionIds.length > 0 && new Set(attempt.criterionIds).size === attempt.criterionIds.length && attempt.criterionIds.every((id) => typeof id === "string" && id.trim()), "검증 시도의 수용 기준 연결이 올바르지 않습니다.");
      if (attempt?.id) attempts.set(attempt.id, attempt);
    }
    for (const criterion of Array.isArray(record.criteria) ? record.criteria : []) {
      for (const evidence of Array.isArray(criterion?.evidence) ? criterion.evidence : []) add(errors, attempts.has(evidence.attemptId) && attempts.get(evidence.attemptId).criterionIds.includes(criterion.id), `${criterion.id} 증거가 실제 기록된 검증 시도에 연결돼야 합니다.`);
      if (record.status === "done" && criterion.required) {
        const latest = [...attempts.values()].filter((attempt) => attempt.criterionIds?.includes(criterion.id)).at(-1);
        add(errors, latest?.executor === "process" && latest.result === "passed" && latest.exitCode === 0 && latest.sourceStable === true && latest.environmentStable === true, `done 작업의 ${criterion.id}에는 최근 실제 검증 통과가 필요합니다.`);
      }
    }
    if (record.status === "done") add(errors, workflow?.reviews?.at(-1)?.verdict === "pass", "done 작업에는 독립 검토 기록이 필요합니다. 현재 적용성은 완료 판정 코드에서 확인합니다.");
  }
  if (record.status === "done") {
    add(errors, record.blockedReason === null, "done 작업에는 blockedReason이 없어야 합니다.");
    for (const criterion of Array.isArray(record.criteria) ? record.criteria : []) if (criterion?.required) {
      add(errors, criterion.result === "passed", `done 작업의 필수 기준 ${criterion.id ?? "(알 수 없음)"}은 passed여야 합니다.`);
      add(errors, Array.isArray(criterion.evidence) && criterion.evidence.length > 0, `done 작업의 필수 기준 ${criterion.id ?? "(알 수 없음)"}에는 증거가 필요합니다.`);
    }
  }
  return errors;
}

