/**
 * @architecture arch.development.artifacts
 * @implements RESP-DEVELOPMENT-ARTIFACTS
 */
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { criteriaDigest } from "./evidence.ts";
import type { WorkLocation } from "./types.ts";

export const ARTIFACT_CHECKS = {
  spec: ["purpose", "journeys", "boundaries", "outcomes"],
  consistency: ["coverage", "alignment", "terminology"],
} as const;
export type ArtifactKind = keyof typeof ARTIFACT_CHECKS;
export interface ArtifactReference { path: string; line: number }
export interface ArtifactCheck {
  id: string;
  result: "satisfied" | "finding" | "not_applicable";
  reason: string;
  references: ArtifactReference[];
}
export interface ArtifactReview {
  id: string;
  version: 1;
  kind: ArtifactKind;
  depth: "brief" | "full";
  summary: string;
  reviewedAt: string;
  digest: string;
  checks: ArtifactCheck[];
  coverage: { criterionId: string; tasks: ArtifactReference[] }[];
}
export interface ArtifactDocument { path: string; source: string | null }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nonempty(value: unknown): value is string { return typeof value === "string" && Boolean(value.trim()); }
function kind(value: unknown): value is ArtifactKind { return value === "spec" || value === "consistency"; }
function reference(value: unknown): value is ArtifactReference {
  return object(value) && nonempty(value.path) && typeof value.line === "number" && Number.isSafeInteger(value.line) && value.line > 0;
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

// 누락도 관측하되 저장소 밖 링크와 특수 파일은 읽지 않는다.
async function document(repo: string, relative: string): Promise<ArtifactDocument> {
  const root = await fs.realpath(repo);
  if (path.isAbsolute(relative) || /[\\\0]/.test(relative) || relative.split("/").includes("..")) throw new Error("문서 경로는 저장소 내부 상대 경로여야 합니다.");
  let current = root;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error("검토 정본의 심볼릭 링크는 허용하지 않습니다.");
    } catch (error) {
      if (object(error) && error.code === "ENOENT") return { path: relative, source: null };
      throw error;
    }
  }
  const stat = await fs.stat(current);
  if (!stat.isFile() || stat.size > 1_048_576) throw new Error("검토 문서는 1 MiB 이하 일반 파일이어야 합니다.");
  const bytes = await fs.readFile(current);
  const source = bytes.toString("utf8");
  if (!Buffer.from(source, "utf8").equals(bytes)) throw new Error(`검토 문서는 손실 없는 UTF-8이어야 합니다: ${relative}`);
  return { path: relative, source };
}

export async function artifactContext(repo: string, work: WorkLocation, requestedKind: unknown) {
  if (!kind(requestedKind)) throw new Error("검토 kind는 spec 또는 consistency여야 합니다.");
  if (work.record.schemaVersion !== 2) throw new Error("새 검토 기록은 schema2 작업에 연결합니다.");
  const directory = path.relative(await fs.realpath(repo), path.dirname(work.path)).split(path.sep).join("/");
  const names = requestedKind === "spec" ? ["spec.md"] : ["spec.md", "design.md", "tasks.md"];
  const documents = await Promise.all(names.map(name => document(repo, `${directory}/${name}`)));
  if (documents[0].source === null) throw new Error("검토할 spec.md가 없습니다.");
  const criteria = work.record.criteria.map(({ id, description, required, requirementRefs }) => ({ id, description, required, requirementRefs }));
  return {
    kind: requestedKind,
    workId: work.record.id,
    digest: hash(JSON.stringify({ workId: work.record.id, requestHash: work.record.workflow.requestHash, kind: requestedKind, documents, criteria: criteriaDigest(work.record) })),
    documents,
    criteria,
    checks: ARTIFACT_CHECKS[requestedKind],
    instruction: "각 항목을 의미 검토하고 실제 문서의 행 근거를 제출하세요. brief도 항목마다 판단·이유를 남깁니다. 구현 통과나 독립 감사로 해석하지 않습니다.",
  };
}

export function artifactReviewErrors(value: unknown): string[] {
  if (!object(value)) return ["검토는 객체여야 합니다."];
  const errors: string[] = [];
  if (!kind(value.kind) || value.version !== 1 || !nonempty(value.id) || !/^artifact-[a-f0-9-]{36}$/i.test(value.id)) errors.push("검토 식별·kind·version이 올바르지 않습니다.");
  if (!nonempty(value.summary) || (value.depth !== "brief" && value.depth !== "full") || typeof value.reviewedAt !== "string" || !Number.isFinite(Date.parse(value.reviewedAt))) errors.push("검토 깊이·요약·시각이 필요합니다.");
  if (typeof value.digest !== "string" || !/^[a-f0-9]{64}$/.test(value.digest)) errors.push("검토 digest가 필요합니다.");
  if (!Array.isArray(value.checks) || !kind(value.kind)) return [...errors, "검토 항목 배열이 필요합니다."];
  const expected: readonly string[] = ARTIFACT_CHECKS[value.kind];
  if (value.checks.length !== expected.length || new Set(value.checks.map(item => object(item) ? item.id : null)).size !== expected.length) errors.push("검토 항목이 빠졌거나 중복됐습니다.");
  for (const item of value.checks) {
    if (!object(item) || typeof item.id !== "string" || !expected.includes(item.id) || (item.result !== "satisfied" && item.result !== "finding" && item.result !== "not_applicable") || !nonempty(item.reason)
      || !Array.isArray(item.references) || !item.references.every(reference) || (item.result !== "not_applicable" && item.references.length === 0)) errors.push("각 검토 항목에 유효한 판단·이유·문서 위치가 필요합니다.");
  }
  if (!Array.isArray(value.coverage) || !value.coverage.every(item => object(item) && nonempty(item.criterionId) && Array.isArray(item.tasks) && item.tasks.every(reference))) errors.push("기준별 작업 위치 배열이 필요합니다.");
  return errors;
}

export async function createArtifactReview(repo: string, work: WorkLocation, input: unknown): Promise<ArtifactReview> {
  if (!object(input)) throw new Error("검토 입력 객체가 필요합니다.");
  const context = await artifactContext(repo, work, input.kind);
  if (input.digest !== context.digest) throw new Error("검토 준비 후 문서·기준이 바뀌었습니다. context를 다시 확인하세요.");
  const candidate: unknown = { id: `artifact-${randomUUID()}`, version: 1, reviewedAt: new Date().toISOString(), kind: input.kind, depth: input.depth, summary: input.summary, digest: input.digest, checks: input.checks, coverage: input.coverage ?? [] };
  const errors = artifactReviewErrors(candidate);
  if (errors.length) throw new Error(errors.join("; "));
  // 입력은 위의 완전한 형식 검사 이후에만 계약 타입으로 좁힌다.
  const review = candidate as ArtifactReview;
  function validateReference(ref: ArtifactReference) {
    const doc = context.documents.find(item => item.path === ref.path);
    if (!doc || doc.source === null || ref.line > doc.source.split(/\r?\n/).length || !doc.source.split(/\r?\n/)[ref.line - 1].trim()) throw new Error("검토 근거는 대상 문서의 비어 있지 않은 실제 행이어야 합니다.");
  }
  for (const check of review.checks) check.references.forEach(validateReference);
  const ids = context.criteria.map(item => item.id);
  if (review.kind === "spec" && review.coverage.length) throw new Error("작업 coverage는 consistency 검토에만 제출합니다.");
  if (review.kind === "consistency") {
    if (review.coverage.length !== ids.length || new Set(review.coverage.map(item => item.criterionId)).size !== ids.length || review.coverage.some(item => !ids.includes(item.criterionId))) throw new Error("모든 기준의 작업 연결 또는 빈 배열을 명시하세요.");
    for (const item of review.coverage) for (const ref of item.tasks) {
      validateReference(ref);
      if (!ref.path.endsWith("/tasks.md")) throw new Error("작업 연결은 tasks.md의 실제 행이어야 합니다.");
    }
  }
  if ((await artifactContext(repo, work, review.kind)).digest !== context.digest) throw new Error("검토 기록 중 대상 문서가 바뀌었습니다.");
  return review;
}

export async function artifactStatus(repo: string, work: WorkLocation) {
  const reviews = work.record.schemaVersion === 2 ? work.record.workflow.artifactReviews ?? [] : [];
  return Promise.all((["spec", "consistency"] as const).map(async reviewKind => {
    const latest = reviews.filter(item => item.kind === reviewKind).at(-1);
    if (!latest) return { kind: reviewKind, status: "not_run" as const, findings: [] as string[] };
    const context = await artifactContext(repo, work, reviewKind).catch(() => null);
    const findings = latest.checks.filter(item => item.result === "finding").map(item => `${item.id}: ${item.reason}`);
    if (reviewKind === "consistency") for (const item of latest.coverage) {
      if (item.tasks.length === 0) findings.push(`${item.criterionId}: 연결된 구현 작업 없음`);
    }
    return { kind: reviewKind, status: latest.digest === context?.digest ? "current" as const : "stale" as const, reviewId: latest.id, depth: latest.depth, findings, summary: latest.summary };
  }));
}

const SKILLS = ["spec", "design", "build", "diagnose", "verify", "commit", "report"];
export async function developmentTools(repo: string, selectedSkill: unknown = "www-build") {
  if (typeof selectedSkill !== "string" || !SKILLS.some(item => selectedSkill === `www-${item}`)) throw new Error("조회할 WWW 스킬이 올바르지 않습니다.");
  const canonical = ["AGENTS.md", "agents/www/AGENT.md", "docs/skills/WORKFLOW.md", `skills/www/${selectedSkill}/SKILL.md`, "docs/skills/profiles/desktop.md", "agents/www/review-policy.json", "docs/skills/MODEL_POLICY.md"];
  const root = await fs.realpath(repo);
  const documents = await Promise.all(canonical.map(file => document(root, file)));
  const items = await Promise.all(documents.map(async doc => {
    const discoveryPath = doc.path.startsWith("skills/www/") ? `.agents/skills/${selectedSkill}/SKILL.md` : null;
    let discovery: "not_applicable" | "missing" | "matches" | "mismatch" | "outside" | "invalid" = discoveryPath ? "missing" : "not_applicable";
    if (discoveryPath) {
      try {
        const resolved = await fs.realpath(path.join(root, discoveryPath));
        if (!resolved.startsWith(`${root}${path.sep}`)) discovery = "outside";
        else {
          const found = await document(root, path.relative(root, resolved).split(path.sep).join("/"));
          discovery = doc.source !== null && found.source === doc.source ? "matches" : "mismatch";
        }
      } catch (error) { discovery = object(error) && error.code === "ENOENT" ? "missing" : "invalid"; }
    }
    return { path: doc.path, digest: doc.source === null ? null : hash(doc.source), status: doc.source === null ? "missing" : "available", discoveryPath, discovery, selection: "www-dev의 고정 정본", hostAcceptance: "unconfirmed" as const };
  }));
  return { selectedSkill, items, documents };
}
