export interface ReviewPolicy {
  schemaVersion: 1;
  id: "www-dev-review";
  version: number;
  scope: "www-dev";
  primary: { provider: "anthropic"; model: "opus" };
  fallback: { provider: "openai"; model: "gpt-6.1-terra"; when: "primary_quota_exhausted" };
  readOnly: true;
  required: true;
}

export interface PolicyInfo {
  policy: ReviewPolicy;
  hash: string;
  path: string;
}

export interface ReviewFailure {
  kind: string;
  verified: boolean;
  receiptHash: string;
  provider?: string;
  model?: string;
  source?: string;
  code?: string;
}

export interface Review {
  id: string;
  provider: string;
  model: string;
  observedModel: string | null;
  verdict: "pass" | "fail" | "not_run";
  readOnly: boolean;
  sourceDigest: string;
  criteriaDigest: string;
  policyHash: string;
  executor: "process" | "injected";
  fallbackReason: ReviewFailure | null;
  execution: { exitCode: number | null; signal: string | null; error: string | null; receiptHash: string };
  failure: ReviewFailure | null;
  findings: string[];
  receiptPath: string;
  startedAt: string;
  completedAt: string;
}

export function assertReviewPolicy(policy: unknown): ReviewPolicy;
export function loadReviewPolicy(options: { root: string }): Promise<PolicyInfo>;
export function readReviewPolicy(root: string): Promise<PolicyInfo>;
export function selectReviewer(options: { policy: ReviewPolicy; opusFailure?: ReviewFailure | null }): { provider: string; model: string; fallbackReason: ReviewFailure | null };
export function classifyOpusFailure(result: { code?: number | null; signal?: string | null; stdout?: string; stderr?: string; outputTruncated?: boolean }): ReviewFailure | null;
export function validateReview(options: { repo: string; policy: ReviewPolicy; review: Review; sourceDigest: string; criteriaDigest: string; policyHash: string }): { usable: boolean; reasons: string[] };
export function runReview(options: {
  repo: string;
  source: { digest: string; files?: unknown[] };
  criteriaDigest: string;
  policyInfo: PolicyInfo;
  inputPaths?: string[];
  run?: (invocation: { command: string; args: string[] }, options: { cwd: string; input: string }) => Promise<unknown>;
  receiptDirectory?: string;
}): Promise<Review>;
