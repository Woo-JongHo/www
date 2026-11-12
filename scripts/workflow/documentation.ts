import { randomUUID }                    from "node:crypto";
import path                              from "node:path";
import { captureSource, criteriaDigest } from "./evidence.ts";

import type { WorkRecord } from './types.ts';

export type DocumentDecision = 'updated' | 'unchanged' | 'not_applicable';
export interface DocumentationDocument {
  path     : string           ;
  decision : DocumentDecision ;
  reason   : string           ;
}
export interface DocumentationReview {
  id              : string                  ;
  version         : 1                       ;
  reviewedAt      : string                  ;
  sourceDigest    : string                  ;
  criteriaDigest  : string                  ;
  documentsDigest : string                  ;
  documents       : DocumentationDocument[] ;
}
export interface DocumentationAssessment {
  usable  : boolean  ;
  reasons : string[] ;
  paths   : string[] ;
  id?     : string   ;
}
export type DocumentationRecord = Pick<WorkRecord, 'criteria'> & {
  workflow: { inputs: string[]; documentationReviews?: DocumentationReview[] };
};
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function decision(value: unknown): value is DocumentDecision { return value === 'updated' || value === 'unchanged' || value === 'not_applicable'; }

const BASE_DOCUMENTS = ["docs/PRODUCT.md", "docs/ARCHITECTURE.md", "docs/DEVELOPMENT.md", "docs/skills/WORKFLOW.md"];

function documentPath(value: unknown): string {
  if (typeof value !== "string" || value !== value.trim() || !value.endsWith(".md")
    || path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value) || /[\\\x00]/.test(value)
    || value.split("/").some((part) => ["", ".", ".."].includes(part)) || value.startsWith("docs/work/")) {
    throw new Error("문서 검토 대상은 docs/work/ 밖의 저장소 상대 Markdown 파일이어야 합니다.");
  }
  return value;
}

export function requiredDocumentation(record: Pick<WorkRecord, 'criteria'>): string[] {
  return [...new Set([...BASE_DOCUMENTS, ...record.criteria.flatMap((criterion) =>
    (criterion.requirementRefs ?? []).flatMap((ref) => {
      // 참조의 유효성은 validateRequirementRefs가 보고한다. 과거 작업 근거는 현행 정본이 아니다.
      if (typeof ref !== "string" || !ref.includes("#")) return [];
      try { return [documentPath(decodeURIComponent(ref.split("#")[0]))]; }
      catch { return []; }
    }))])].sort();
}

function validateDocuments(record: Pick<WorkRecord, 'criteria'>, documents: unknown): DocumentationDocument[] {
  if (!Array.isArray(documents) || !documents.length) throw new Error("문서 검토 목록이 필요합니다.");
  const seen                              = new Set<string>() ;
  const selected: DocumentationDocument[] = []                ;
  for (const item of documents) {
    if (!object(item)) throw new Error('문서 검토에는 객체 항목이 필요합니다.');
    const file = documentPath(item.path);
    if (seen.has(file) || !decision(item.decision) || typeof item.reason !== "string" || !item.reason.trim()) {
      throw new Error("문서 검토에는 중복 없는 경로·판단·비어 있지 않은 이유가 필요합니다.");
    }
    seen.add(file);
    selected.push({ path: file, decision: item.decision, reason: item.reason });
  }
  const missing = requiredDocumentation(record).filter((file) => !seen.has(file));
  if (missing.length) throw new Error(`필수 문서 검토 누락: ${missing.join(", ")}`);
  return selected.sort((a, b) => a.path.localeCompare(b.path));
}

async function captureDocuments(repo: string, documents: DocumentationDocument[]) {
  const source = await captureSource({ repo, inputs: documents.map((item) => item.path) });
  for (const item of documents) {
    const file = source.files.find((entry) => entry.path === item.path);
    if (file?.type !== "file" && !(file?.type === "missing" && item.decision === "not_applicable")) {
      throw new Error(`문서 검토 대상은 일반 파일이어야 하며 없는 문서는 not_applicable로 기록합니다: ${item.path}`);
    }
  }
  return source;
}

export async function createDocumentationReview({ repo, record, documents }: { repo: string; record: DocumentationRecord; documents: unknown }): Promise<DocumentationReview> {
  const selected = validateDocuments(record, documents)                          ;
  const source   = await captureSource({ repo, inputs: record.workflow.inputs }) ;
  const snapshot = await captureDocuments(repo, selected)                        ;
  return {
    id: `documentation-${randomUUID()}`, version: 1, reviewedAt: new Date().toISOString(),
    sourceDigest: source.digest, criteriaDigest: criteriaDigest(record), documentsDigest: snapshot.digest,
    documents: selected,
  };
}

export async function assessDocumentation({ repo, record }: { repo: string; record: DocumentationRecord }): Promise<DocumentationAssessment> {
  const review   = record.workflow.documentationReviews?.at(-1) ;
  const required = requiredDocumentation(record)                ;
  if (!review) return { usable: false, reasons: ["문서 영향 검토 없음"], paths: required };
  let documents;
  try {
    documents = validateDocuments(record, review.documents);
    const current = await captureDocuments(repo, documents)                       ;
    const source  = await captureSource({ repo, inputs: record.workflow.inputs }) ;
    const reasons = []                                                            ;
    if (review.version !== 1) reasons.push("문서 검토 버전 불일치");
    if (review.sourceDigest !== source.digest) reasons.push("문서 검토 후 소스 변경");
    if (review.criteriaDigest !== criteriaDigest(record)) reasons.push("문서 검토 후 기준 변경");
    if (review.documentsDigest !== current.digest) reasons.push("문서 검토 후 문서 변경");
    return { usable: reasons.length === 0, reasons, paths: documents.map((item) => item.path), id: review.id };
  } catch (error) {
    return { usable: false, reasons: [`문서 검토 무효: ${error instanceof Error ? error.message : String(error)}`], paths: required };
  }
}
