/**
 * @architecture arch.development.records.protocol
 * @implements RESP-DEVELOPMENT-RECORDS-PROTOCOL
 */
import type { CapturedSource, VerificationAttempt } from './evidence.ts';
import type { DocumentationAssessment, DocumentationReview } from './documentation.ts';
import type { RepositoryCheckStatus } from './consistency.ts';
import type { ArtifactReview } from './artifacts.ts';
import type { DecompositionPlan } from './decomposition.ts';

export interface Approval {
  implementation   : boolean  ;
  writePaths       : string[] ;
  mutationSurfaces : string[] ;
  verifierCommands : string[] ;
  commit           : boolean  ;
  publish          : boolean  ;
}

export interface CriterionEvidence {
  attemptId? : string ;
  path       : string ;
  summary    : string ;
}

export interface Criterion {
  id               : string              ;
  description      : string              ;
  required         : boolean             ;
  result           : string              ;
  evidence         : CriterionEvidence[] ;
  requirementRefs? : string[]            ;
}

export interface RecordedReview {
  recordingRejection? : string[] ;
  id                  : string   ;
  verdict?            : unknown  ;
  failure?            : unknown  ;
}

export type WorkAuthorization = Approval & { source: string; requestHash: string };

export interface VerifierAuthorization {
  originalRequestId?  : string            ;
  version             : 1                 ;
  requestId           : string            ;
  requestHash         : string            ;
  originalRequestHash : string            ;
  payloadDigest       : string            ;
  authorizedAt        : string            ;
  command             : string            ;
  args                : string[]          ;
  added               : boolean           ;
  beforeDigest        : string            ;
  afterDigest         : string            ;
  before              : WorkAuthorization ;
  after               : WorkAuthorization ;
}

export interface AddVerifierOptions extends WorkOptions {
  expectedRequestId?          : string   ;
  role?                       : string   ;
  direct?                     : boolean  ;
  requestId                   : string   ;
  request                     : string   ;
  expectedRequestHash         : string   ;
  expectedAuthorizationDigest : string   ;
  command                     : string   ;
  args                        : string[] ;
}

export interface WorkRequestBinding {
  requestId     : string            ;
  authorization : WorkAuthorization ;
  inputs        : string[]          ;
}

export interface WorkContinuation {
  version            : 1 | 2                   ;
  authorizedAt       : string                  ;
  payloadDigest      : string                  ;
  before             : WorkRequestBinding      ;
  after              : WorkRequestBinding      ;
  previousVerifiers? : VerifierAuthorization[] ;
  verificationStart? : number                  ;
}

export interface ContinueWorkOptions extends WorkOptions {
  role?                       : string   ;
  direct?                     : boolean  ;
  requestId                   : string   ;
  request                     : string   ;
  expectedRequestId           : string   ;
  expectedRequestHash         : string   ;
  expectedAuthorizationDigest : string   ;
  approval                    : unknown  ;
  inputs                      : string[] ;
}

export interface WorkWorkflow {
  continuations?          : WorkContinuation[]      ;
  verifierAuthorizations? : VerifierAuthorization[] ;
  decomposition?          : DecompositionPlan       ;
  role                    : string                  ;
  requestId               : string                  ;
  requestHash             : string                  ;
  authorization           : WorkAuthorization       ;
  inputs                  : string[]                ;
  nextAction              : string                  ;
  reportingRequired?      : boolean                 ;
  verifications           : VerificationAttempt[]   ;
  reviews                 : RecordedReview[]        ;
  documentationReviews?   : DocumentationReview[]   ;
  artifactReviews?        : ArtifactReview[]        ;
  legacyRecord?           : WorkRecord              ;
}

interface WorkRecordBase {
  id            : string                             ;
  title         : string                             ;
  kind          : string                             ;
  areas         : string[]                           ;
  owner         : string                             ;
  status        : string                             ;
  blockedReason : string | null                      ;
  relations     : { type: string; target: string }[] ;
  criteria      : Criterion[]                        ;
}

export interface LegacyWorkRecord extends WorkRecordBase {
  schemaVersion : 1         ;
  workflow?     : undefined ;
}

export interface CurrentWorkRecord extends WorkRecordBase {
  schemaVersion : 2            ;
  workflow      : WorkWorkflow ;
}

export type WorkRecord = LegacyWorkRecord | CurrentWorkRecord;

export interface WorkLocation {
  rawSource? : string     ;
  path       : string     ;
  record     : WorkRecord ;
  created?   : boolean    ;
  legacy?    : boolean    ;
  adopted?   : boolean    ;
}

export interface CurrentWorkLocation extends WorkLocation {
  record : CurrentWorkRecord ;
}

export interface CriterionAssessment {
  id      : string   ;
  usable  : boolean  ;
  reasons : string[] ;
}

export interface ReportAssessment {
  usable    : boolean  ;
  reasons   : string[] ;
  reportId? : string   ;
}

export interface LegacyWorkAssessment extends WorkLocation {
  legacy   : true             ;
  complete : boolean          ;
  reasons  : string[]         ;
  report?  : ReportAssessment ;
}

export interface CurrentWorkAssessment extends CurrentWorkLocation {
  legacy?               : false                                  ;
  complete              : boolean                                ;
  reasons               : string[]                               ;
  source                : CapturedSource                         ;
  criteria              : CriterionAssessment[]                  ;
  documentation         : DocumentationAssessment                ;
  review                : { usable: boolean; reasons: string[] } ;
  repositoryConsistency : RepositoryCheckStatus                  ;
  report?               : ReportAssessment                       ;
  nextAction?           : string                                 ;
}

export type WorkAssessment = LegacyWorkAssessment | CurrentWorkAssessment;

export interface WorkOptions {
  repo?       : string ;
  workId      : string ;
  policyRoot? : string ;
}

export interface WorkDecision {
  intent?      : string                                                                                ;
  area?        : string                                                                                ;
  title?       : string                                                                                ;
  kind?        : string                                                                                ;
  areas?       : string[]                                                                              ;
  owner?       : string                                                                                ;
  relations?   : { type: string; target: string }[]                                                    ;
  criteria?    : { id: string; description: string; required?: boolean; requirementRefs?: string[] }[] ;
  summary?     : string                                                                                ;
  workId?      : string                                                                                ;
  adoptLegacy? : boolean                                                                               ;
}

export interface NewWorkOptions {
  repo?      : string       ;
  role?      : string       ;
  direct?    : boolean      ;
  requestId? : string       ;
  request?   : string       ;
  decision?  : WorkDecision ;
  approval?  : unknown      ;
  inputs?    : string[]     ;
}

export type ReportHookResult = {
  status   : "written" ;
  reportId : string    ;
  created  : boolean   ;
} | {
  status  : "failed" ;
  message : string   ;
};

function verificationTime(value: unknown): number {
  return typeof value === "string" ? Date.parse(value) : NaN;
}

export function currentVerifications<T extends { startedAt: unknown }>(
  verifications: readonly T[], continuation?: { verificationStart?: unknown; authorizedAt: unknown },
): T[] {
  const eligible = !continuation
    ? verifications
    : typeof continuation.verificationStart === "number"
      ? verifications.slice(continuation.verificationStart)
      : verifications.filter(attempt => verificationTime(attempt.startedAt) >= verificationTime(continuation.authorizedAt));
  return eligible.filter(attempt => Number.isFinite(verificationTime(attempt.startedAt)))
    .sort((left, right) => verificationTime(left.startedAt) - verificationTime(right.startedAt));
}

/** 시작 시각이 같은 후보는 순서를 입증할 수 없어 모두 검사한다. */
export function latestVerificationGroup<T extends { startedAt: unknown }>(chronological: readonly T[]): T[] {
  const latest = chronological.at(-1);
  return latest ? chronological.filter(attempt => verificationTime(attempt.startedAt) === verificationTime(latest.startedAt)) : [];
}
