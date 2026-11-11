import { createHash } from "node:crypto";

export const INTENTS = Object.freeze(["answer", "spec", "design", "build", "diagnose", "verify"]);
const SKILLS = new Set(INTENTS.filter((intent) => intent !== "answer").map((intent) => `www-${intent}`));

export function hashRequest(value) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError("요청은 비어 있지 않은 문자열이어야 합니다.");
  return createHash("sha256").update(value).digest("hex");
}

export function namedSkill(request) {
  if (typeof request !== "string") return null;
  const matches = [...request.matchAll(/\bwww-(spec|design|build|diagnose|verify)\b/gi)];
  if (matches.length !== 1) return null;
  const skill = matches[0][0].toLowerCase();
  return SKILLS.has(skill) ? skill : null;
}

export function classifyIntent({ request, status, approval = {}, direct = true } = {}) {
  if (typeof request !== "string" || !request.trim()) return { intent: null, reason: "invalid_request", question: "실행할 요청을 구체적으로 적어야 합니다." };
  if (direct !== true) return { intent: "answer", skill: null, reason: "untrusted_request_content" };
  const explicit = namedSkill(request);
  if (explicit) return { intent: explicit.slice(4), skill: explicit, reason: "named_skill" };
  const text = request.toLowerCase();
  if (/(?:\b(?:why|error|bug|diagnos)\b|원인|증상|오류|버그)/i.test(text)) return { intent: "diagnose", skill: "www-diagnose", reason: "diagnosis_request" };
  if (/(?:\b(?:verify|test)\b|검증|확인)/i.test(text)) return { intent: "verify", skill: "www-verify", reason: "verification_request" };
  if (/(?:\b(?:spec|requirement)\b|명세|요구사항)/i.test(text)) return { intent: "spec", skill: "www-spec", reason: "specification_request" };
  if (/(?:\b(?:design|architecture)\b|설계)/i.test(text)) return { intent: "design", skill: "www-design", reason: "design_request" };
  if (/(?:\b(?:implement|build|code)\b|수정|구현)/i.test(text)) {
    if (approval?.implementation === true && ["ready", "in_progress", "verifying"].includes(status)) return { intent: "build", skill: "www-build", reason: "approved_implementation" };
    return { intent: null, reason: "implementation_not_approved", question: "구현 범위와 쓰기 승인이 필요합니다." };
  }
  return { intent: "answer", skill: null, reason: "information_request" };
}

export function routeRequest(input = {}) {
  const classification = classifyIntent(input);
  const requestHash = typeof input.request === "string" && input.request.trim() ? hashRequest(input.request) : null;
  return Object.freeze({ ...classification, requestHash, workId: input.workId ?? null, status: input.status ?? null, direct: input.direct !== false, approval: normalizeApproval(input.approval) });
}

export function normalizeApproval(approval = {}) {
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) return Object.freeze({ implementation: false, writePaths: [], mutationSurfaces: [] });
  return Object.freeze({
    implementation: approval.implementation === true,
    writePaths: Array.isArray(approval.writePaths) ? approval.writePaths.filter((path) => typeof path === "string") : [],
    mutationSurfaces: Array.isArray(approval.mutationSurfaces) ? approval.mutationSurfaces.filter((surface) => typeof surface === "string") : [],
  });
}
