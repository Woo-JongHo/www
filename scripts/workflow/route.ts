import { createHash } from "node:crypto";
import type { Approval } from "./types.ts";

export interface RouteInput {
  request?          : unknown                     ;
  status?           : unknown                     ;
  approval?         : unknown                     ;
  direct?           : unknown                     ;
  explicitSkill?    : unknown                     ;
  publishRequested? : boolean                     ;
  role?             : unknown                     ;
  decision?         : { intent?: unknown } | null ;
  workId?           : unknown                     ;
}
export interface IntentClassification {
  intent        : string | null ;
  skill?        : string | null ;
  reason        : string        ;
  confirmation? : boolean       ;
  question?     : string        ;
}
export interface RouteResult extends IntentClassification {
  requestHash : string | null ;
  workId      : unknown       ;
  status      : unknown       ;
  direct      : boolean       ;
  approval    : Approval      ;
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export const INTENTS = Object.freeze(["answer", "spec", "design", "build", "diagnose", "verify", "commit"])      ;
const SKILLS         = new Set(INTENTS.filter((intent) => intent !== "answer").map((intent) => `www-${intent}`)) ;

export function hashRequest(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError("요청은 비어 있지 않은 문자열이어야 합니다.");
  return createHash("sha256").update(value).digest("hex");
}

export function namedSkill(request: unknown): string | null {
  if (typeof request !== "string") return null;
  const match = request.match(/^\s*(?:\/skill:)?(www-(?:spec|design|build|diagnose|verify|commit))(?:\s|$)/i);
  if (!match) return null;
  const skill = match[1].toLowerCase();
  return SKILLS.has(skill) ? skill : null;
}

export function normalizeApproval(approval: unknown = {}): Approval {
  if (!object(approval)) return Object.freeze({ implementation: false, writePaths: [], mutationSurfaces: [], verifierCommands: [], commit: false, publish: false });
  return Object.freeze({
    implementation   : approval.implementation === true   ,
    writePaths       : strings(approval.writePaths)       ,
    mutationSurfaces : strings(approval.mutationSurfaces) ,
    verifierCommands : strings(approval.verifierCommands) ,
    commit           : approval.commit === true           ,
    publish          : approval.publish === true          ,
  });
}

export function classifyIntent({ request, status, approval = {}, direct = true, explicitSkill, publishRequested = false, role, decision }: RouteInput = {}): IntentClassification {
  if (typeof request !== "string" || !request.trim()                       ) return { intent: null, reason: "invalid_request", question: "실행할 요청을 구체적으로 적어야 합니다." };
  if (direct !== true                                                      ) return { intent: "answer", skill: null, reason: "untrusted_request_content" };
  if (role === "www-dev" && decision?.intent === "answer" && !explicitSkill) return { intent: "answer", skill: null, reason: "role_information_request" };
  const selected = role === "www-dev" && decision && typeof decision.intent === "string" && INTENTS.includes(decision.intent) && decision.intent !== "answer" ? `www-${decision.intent}` : null;
  if (role === "www-dev" && decision && !(typeof decision.intent === "string" && INTENTS.includes(decision.intent))) return { intent: null, skill: null, reason: "invalid_role_decision", confirmation: true, question: "개발 역할은 허용된 단계 중 하나를 선택해야 합니다." };
  const skill = explicitSkill ?? namedSkill(request) ?? selected;
  if (skill != null && (typeof skill !== "string" || !SKILLS.has(skill))) return { intent: null, reason: "invalid_explicit_skill", confirmation: true, question: "허용된 www Skill을 명시적으로 선택해야 합니다." };
  if (!skill) {
    if (/[?？]\s*$/.test(request) || /^(?:왜|무엇|어떻게|설명|알려|what|why|how|explain)/i.test(request.trim())) {
      return { intent: "answer", skill: null, reason: "information_request" };
    }
    return { intent: null, skill: null, reason: "ambiguous_request", confirmation: true, question: "실행할 www Skill을 명시적으로 선택해야 합니다." };
  }
  const normalized = normalizeApproval(approval) ;
  const intent     = skill.slice      (4       ) ;
  if (intent === "build") {
    if (!normalized.implementation || !(typeof status === "string" && ["ready", "in_progress", "verifying"].includes(status)) || !normalized.writePaths.length || !normalized.mutationSurfaces.length) {
      return { intent: null, skill, reason: "implementation_not_approved", confirmation: true, question: "www-build에는 작업 상태, 구현 승인, 쓰기 경로와 mutation 표면 승인이 필요합니다." };
    }
  }
  if (intent === "commit" && !normalized.commit) return { intent: null, skill, reason: "commit_not_approved", confirmation: true, question: "www-commit에는 commit 승인이 필요합니다." };
  if (intent === "commit" && publishRequested && !normalized.publish) return { intent: null, skill, reason: "publish_not_approved", confirmation: true, question: "원격 게시에는 publish 승인이 별도로 필요합니다." };
  return { intent, skill, reason: selected && !explicitSkill && !namedSkill(request) ? "development_role_selection" : "explicit_skill" };
}

export function routeRequest(input: RouteInput = {}): RouteResult {
  const approval       = normalizeApproval(input.approval        ) ;
  const classification = classifyIntent   ({ ...input, approval }) ;
  return Object.freeze({ ...classification, requestHash: typeof input.request === "string" && input.request.trim() ? hashRequest(input.request) : null, workId: input.workId ?? null, status: input.status ?? null, direct: input.direct === true, approval });
}
