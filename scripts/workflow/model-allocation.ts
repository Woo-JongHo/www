/**
 * @architecture arch.development.execution
 * @implements RESP-DEVELOPMENT-EXECUTION
 */
type Model = "gpt-6-luna" | "gpt-6.1-terra" | "gpt-6.1-sol";

type Kind = "collection" | "small_implementation" | "feature_implementation" | "routine_verification" | "design" | "state" | "permissions" | "concurrency" | "integration";

type Risk = "low" | "medium" | "high";

type FailureCause = "scope" | "context" | "environment" | "capability" | "quality";
export interface ModelAllocation {
  taskId: string;

  ownerModel: "gpt-6.1-sol";

  kind: Kind;

  risk: Risk;

  model: Model;

  reason: string;

  inputs: string[];

  writePaths: string[];

  dependencies: string[];

  attempt: number;

  previousAttempt?: { eventId: string; reason: string; kind: "retry"; failureCause: FailureCause } | { eventId: string; reason: string; kind: "handoff"; failureCause?: FailureCause };
}
interface AllocationContext { model?: unknown; inputs: string[]; writes: string[]; authorizationWritePaths: string[] }
const ranks: Record<Model, number> = { "gpt-6-luna": 0, "gpt-6.1-terra": 1, "gpt-6.1-sol": 2 };

const minimum: Record<Kind, number> = { collection: 0, small_implementation: 0, feature_implementation: 1, routine_verification: 1, design: 2, state: 2, permissions: 2, concurrency: 2, integration: 2 };
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function keys(value: Record<string, unknown>, allowed: string[]): boolean { return Object.keys(value).every(key => allowed.includes(key)); }
function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(nonempty); }
function safePath(value: string): boolean { return !/^(?:\/|[A-Za-z]:)/.test(value) && !/[\\\x00]/.test(value) && value.split("/").every(part => part !== ".." && part !== "." && part !== ""); }
function paths(value: unknown): value is string[] { return strings(value) && value.every(safePath); }
function covered(file: string, scopes: string[]): boolean { return scopes.some(scope => file === scope || file.startsWith(`${scope}/`)); }

export function validateModelAllocation(value: unknown, context: AllocationContext): ModelAllocation {
  if (!object(value) || !keys(value, ["taskId", "ownerModel", "kind", "risk", "model", "reason", "inputs", "writePaths", "dependencies", "attempt", "previousAttempt"])) throw new Error("모델 배분 필드가 올바르지 않습니다.");
  if (!nonempty(value.taskId) || value.ownerModel !== "gpt-6.1-sol" || !nonempty(value.reason)) throw new Error("작업 ID, Sol 소유자와 배분 이유가 필요합니다.");
  const { kind, risk, model } = value;
  if (typeof kind !== "string" || !Object.hasOwn(minimum, kind) || typeof model !== "string" || !Object.hasOwn(ranks, model) || (risk !== "low" && risk !== "medium" && risk !== "high")) throw new Error("모델 배분 종류, 위험 또는 모델이 올바르지 않습니다.");
  // Object.hasOwn으로 검증한 키를 순회해 assertion 없이 타입을 좁힌다.
  const kindEntry = Object.entries(minimum).find(([key]) => key === kind);

  const modelEntry = Object.entries(ranks).find(([key]) => key === model);
  if (!kindEntry || !modelEntry || modelEntry[1] < Math.max(kindEntry[1], risk === "high" ? 2 : risk === "medium" ? 1 : 0)) throw new Error("작업 종류 또는 위험에 비해 모델이 낮습니다.");
  if (context.model !== undefined && context.model !== model) throw new Error("요청 모델과 배분 모델이 다릅니다.");
  if (!paths(value.inputs) || !paths(value.writePaths) || !strings(value.dependencies) || !paths(context.inputs) || !paths(context.writes) || !paths(context.authorizationWritePaths)) throw new Error("배분 경로 또는 의존성이 올바르지 않습니다.");
  const writePaths = value.writePaths;
  if (!value.inputs.every(file => covered(file, context.inputs)) || !context.writes.every(file => writePaths.includes(file)) || !writePaths.every(file => context.writes.includes(file) && context.authorizationWritePaths.includes(file))) throw new Error("배분 범위가 실행 또는 승인 경로와 일치하지 않습니다.");
  if (typeof value.attempt !== "number" || !Number.isSafeInteger(value.attempt) || value.attempt < 1) throw new Error("시도 번호가 올바르지 않습니다.");
  let previousAttempt: ModelAllocation["previousAttempt"];
  if (value.previousAttempt !== undefined) {
    const previous = value.previousAttempt;
    if (!object(previous) || !keys(previous, ["eventId", "reason", "kind", "failureCause"]) || !nonempty(previous.eventId) || !nonempty(previous.reason) || (previous.kind !== "retry" && previous.kind !== "handoff") || (previous.failureCause !== undefined && previous.failureCause !== "scope" && previous.failureCause !== "context" && previous.failureCause !== "environment" && previous.failureCause !== "capability" && previous.failureCause !== "quality") || (previous.kind === "retry" && previous.failureCause === undefined)) throw new Error("이전 시도 근거가 올바르지 않습니다.");
    if (previous.kind === "retry" && previous.failureCause !== undefined) {
      previousAttempt = { eventId: previous.eventId, reason: previous.reason, kind: "retry", failureCause: previous.failureCause };
    } else if (previous.kind === "handoff") {
      previousAttempt = { eventId: previous.eventId, reason: previous.reason, kind: "handoff", ...(previous.failureCause ? { failureCause: previous.failureCause } : {}) };
    }
  }
  if ((value.attempt > 1) !== (previousAttempt !== undefined)) throw new Error("재시도에는 이전 시도 근거가 필요합니다.");
  // 허용 값은 위에서 확인되었으며 열거형 값을 다시 찾아 정확한 타입을 얻는다.
  const validKinds: Kind[] = ["collection", "small_implementation", "feature_implementation", "routine_verification", "design", "state", "permissions", "concurrency", "integration"];

  const validModels: Model[] = ["gpt-6-luna", "gpt-6.1-terra", "gpt-6.1-sol"];

  const selectedKind = validKinds.find(item => item === kind);

  const selectedModel = validModels.find(item => item === model);
  if (!selectedKind || !selectedModel) throw new Error("모델 배분 값이 올바르지 않습니다.");
  return { taskId: value.taskId, ownerModel: "gpt-6.1-sol", kind: selectedKind, risk, model: selectedModel, reason: value.reason, inputs: [...value.inputs], writePaths: [...value.writePaths], dependencies: [...value.dependencies], attempt: value.attempt, ...(previousAttempt ? { previousAttempt } : {}) };
}
