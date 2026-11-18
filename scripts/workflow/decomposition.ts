/**
 * @architecture arch.development.execution
 * @implements RESP-DEVELOPMENT-EXECUTION
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { validateWritePaths } from "./preflight.ts";
import { evaluateEvidence, type VerificationAttempt } from "./evidence.ts";
import type { CurrentWorkRecord } from "./types.ts";
import { readRuntime, runtimePaths } from "./record.ts";

export interface DecompositionUnit {
  taskId: string;
  goal: string;
  inputs: string[];
  writePaths: string[];
  excludedPaths: string[];
  dependencies: string[];
  artifacts: string[];
  criterionIds: string[];
  verification: { command: string; args: string[] };
  resultPath: string;
}
export interface DecompositionPlan { units: DecompositionUnit[] }
interface PlanContext { repo: string; inputs: string[]; writePaths: string[]; criterionIds: string[]; verifierCommands: string[] }
export interface UnitAcceptance { status: "accepted" | "rejected"; reasons: string[]; attemptId?: string }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && !value.includes("\0"); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(text) && new Set(value).size === value.length; }
function paths(value: unknown): value is string[] { return strings(value) && value.every(file => !/^(?:\/|[A-Za-z]:)/.test(file) && !/[\\\x00]/.test(file) && file.split("/").every(part => part && part !== "." && part !== "..")); }
function overlap(a: string, b: string): boolean { return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); }
function covered(file: string, scopes: string[]): boolean { return scopes.some(scope => file === scope || file.startsWith(`${scope}/`)); }
function unit(value: unknown): DecompositionUnit {
  if (!object(value) || Object.keys(value).some(key => !["taskId", "goal", "inputs", "writePaths", "excludedPaths", "dependencies", "artifacts", "criterionIds", "verification", "resultPath"].includes(key))
    || !text(value.taskId) || !text(value.goal) || !paths(value.inputs) || !value.inputs.length || !paths(value.writePaths) || !paths(value.excludedPaths) || !strings(value.dependencies)
    || !paths(value.artifacts) || !value.artifacts.length || !strings(value.criterionIds) || !value.criterionIds.length || !text(value.resultPath) || !paths([value.resultPath])
    || !object(value.verification) || Object.keys(value.verification).some(key => !["command", "args"].includes(key)) || !text(value.verification.command) || !Array.isArray(value.verification.args) || !value.verification.args.every(item => typeof item === "string" && !item.includes("\0"))) {
    throw new Error("분업 단위에는 목표·입력·소유/제외·의존·산출물·기준·검증·결과 경로가 필요합니다.");
  }
  return { taskId: value.taskId, goal: value.goal, inputs: [...value.inputs], writePaths: [...value.writePaths], excludedPaths: [...value.excludedPaths], dependencies: [...value.dependencies], artifacts: [...value.artifacts], criterionIds: [...value.criterionIds], verification: { command: value.verification.command, args: [...value.verification.args] }, resultPath: value.resultPath };
}
async function identity(repo: string, file: string): Promise<{ canonical: string; inode?: string }> {
  const absolute = path.resolve(repo, file);
  let cursor = absolute;
  const suffix: string[] = [];
  while (true) {
    try {
      const stat = await fs.stat(cursor);
      // 신규 출력의 NFC/NFD 표기 차이는 별도 소유로 허용하지 않는다.
      const canonical = path.join(await fs.realpath(cursor), ...suffix).normalize("NFC");
      const insensitive = await caseInsensitiveDirectory(stat.isDirectory() ? cursor : path.dirname(cursor));
      return { canonical: insensitive ? canonical.toLocaleLowerCase("en-US") : canonical, ...(cursor === absolute && stat.isFile() ? { inode: `${stat.dev}:${stat.ino}` } : {}) };
    } catch (error) {
      if (!object(error) || error.code !== "ENOENT") throw error;
      suffix.unshift(path.basename(cursor));
      cursor = path.dirname(cursor);
    }
  }
}
/** 기존 이름의 대소문자 별칭을 읽기만 하여 출력 디렉터리의 lookup 의미를 확인한다. */
async function caseInsensitiveDirectory(directory: string): Promise<boolean> {
  const entries = await fs.readdir(directory);
  const sample = entries.find(name => /[A-Za-z]/.test(name));
  const original = sample ? path.join(directory, sample) : directory;
  const alternate = path.join(path.dirname(original), path.basename(original).replace(/[A-Za-z]/, letter => letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase()));
  if (original === alternate) {
    const parent = path.dirname(directory);
    return parent === directory ? false : caseInsensitiveDirectory(parent);
  }
  try {
    const [first, second] = await Promise.all([fs.lstat(original), fs.lstat(alternate)]);
    return first.dev === second.dev && first.ino === second.ino;
  } catch (error) {
    if (object(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

/** 계획 전체를 검사한 뒤 실행할 한 단위와 연결한다. 제외 목록은 소유 충돌의 우회가 아니다. */
export function parseDecomposition(value: unknown): DecompositionPlan {
  if (!object(value) || Object.keys(value).some(key => key !== "units") || !Array.isArray(value.units) || !value.units.length) throw new Error("분업 계획에는 하나 이상의 단위가 필요합니다.");
  const units = value.units.map(unit);
  const ids = new Set(units.map(item => item.taskId));
  if (ids.size !== units.length) throw new Error("분업 단위 ID가 중복됩니다.");
  return { units };
}
export async function validateDecomposition(value: unknown, context: PlanContext): Promise<DecompositionPlan> {
  const { units } = parseDecomposition(value);
  const ids = new Set(units.map(item => item.taskId));
  for (const item of units) {
    if (!item.inputs.every(file => covered(file, context.inputs)) || !item.writePaths.every(file => covered(file, context.writePaths)) || !item.criterionIds.every(id => context.criterionIds.includes(id))
      || !context.verifierCommands.includes(JSON.stringify([item.verification.command, ...item.verification.args]))) throw new Error(`분업 단위가 입력·권한·기준·검증 범위를 벗어납니다: ${item.taskId}`);
    if (!item.artifacts.every(file => covered(file, item.writePaths)) || !covered(item.resultPath, item.writePaths)) throw new Error(`분업 산출물과 결과는 해당 단위 소유여야 합니다: ${item.taskId}`);
    if (item.writePaths.some(file => item.excludedPaths.some(excluded => overlap(file, excluded)))) throw new Error(`소유와 제외 경로가 겹칩니다: ${item.taskId}`);
    if (item.dependencies.some(id => !ids.has(id))) throw new Error(`미정의 분업 의존: ${item.taskId}`);
    await validateWritePaths(context.repo, [...item.inputs, ...item.writePaths, ...item.excludedPaths, ...item.artifacts, item.resultPath]);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error(`분업 의존 순환: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of units.find(item => item.taskId === id)?.dependencies ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
  const owned: { taskId: string; file: string; canonical: string; inode?: string }[] = [];
  for (const item of units) for (const file of item.writePaths) {
    const current = { taskId: item.taskId, file, ...await identity(context.repo, file) };
    const conflict = owned.find(previous => previous.taskId !== item.taskId && (overlap(previous.canonical, current.canonical) || (current.inode !== undefined && current.inode === previous.inode)));
    if (conflict) throw new Error(`분업 소유 충돌: ${conflict.taskId}:${conflict.file} ↔ ${item.taskId}:${file}`);
    owned.push(current);
  }
  return { units };
}
/** 작업 원장의 입력·권한·기준을 분업 검증의 맥락으로 연결한다. */
export function validateWorkDecomposition(repo: string, record: CurrentWorkRecord, plan: unknown): Promise<DecompositionPlan> {
  return validateDecomposition(plan, { repo, inputs: record.workflow.inputs, writePaths: record.workflow.authorization.writePaths,
    criterionIds: record.criteria.map(item => item.id), verifierCommands: record.workflow.authorization.verifierCommands });
}
export function decompositionDigest(plan: DecompositionPlan): string { return createHash("sha256").update(JSON.stringify(plan)).digest("hex"); }

/** 호스트 종료와 업무 수용을 분리하고 기존 실제 검증/현재성 판정을 그대로 사용한다. */
export async function assessUnitAcceptance({ repo, record, unit: item, host, executor, attempt }: { repo: string; record: CurrentWorkRecord; unit: DecompositionUnit; host: { ok?: unknown; outcome?: unknown }; executor: "process" | "injected"; attempt?: VerificationAttempt }): Promise<UnitAcceptance> {
  const reasons: string[] = [];
  if (host.ok !== true || host.outcome !== "passed") reasons.push("host_failed");
  if (executor !== "process") reasons.push("injected_host");
  if (!attempt) reasons.push("verification_not_run");
  else {
    if (attempt.requestedCommand !== item.verification.command || JSON.stringify(attempt.args) !== JSON.stringify(item.verification.args)) reasons.push("verification_command_changed");
    if (!item.criterionIds.every(id => attempt.criterionIds.includes(id))) reasons.push("criterion_coverage_missing");
    if (![...new Set([...item.artifacts, item.resultPath])].every(file => attempt.artifacts?.some(artifact => artifact.path === file))) reasons.push("required_artifact_missing");
    const evaluation = await evaluateEvidence({ repo, record, attempt });
    reasons.push(...evaluation.reasons);
  }
  return { status: reasons.length ? "rejected" : "accepted", reasons: [...new Set(reasons)], ...(attempt ? { attemptId: attempt.id } : {}) };
}

/** 원장의 계획을 마지막 실제 호스트 영수증과 연결해 완료 시점에도 다시 검사한다. */
export async function assessDecompositionCompletion(repo: string, record: CurrentWorkRecord, requiredTaskIds?: string[]): Promise<{ usable: boolean; reasons: string[] }> {
  if (!record.workflow.decomposition) return { usable: true, reasons: [] };
  const reasons: string[] = [];
  try {
    const plan = await validateWorkDecomposition(repo, record, record.workflow.decomposition);
    const { events } = await readRuntime(runtimePaths(repo, record.id));
    for (const item of plan.units) {
      if (requiredTaskIds && !requiredTaskIds.includes(item.taskId)) continue;
      const start = events.filter(event => event.type === "status" && event.status === "running" && object(event.allocation) && event.allocation.taskId === item.taskId).at(-1);
      const completion = start && events.find(event => event.id === `${start.id}-host`);
      if (!start || start.planDigest !== decompositionDigest(plan) || !completion || !["host_result", "post_failure"].includes(String(completion.type))) {
        reasons.push(`${item.taskId}: unit_acceptance_missing`);
        continue;
      }
      const relative = `.www/evidence/${record.id}/${createHash("sha256").update(start.id).digest("hex")}.json`;
      await validateWritePaths(repo, [relative]);
      const bytes = await fs.readFile(path.join(repo, relative));
      if (completion.receiptPath !== relative || completion.receiptHash !== createHash("sha256").update(bytes).digest("hex")) throw new Error(`${item.taskId}: unit_receipt_changed`);
      const receipt: unknown = JSON.parse(bytes.toString("utf8"));
      if (!object(receipt) || receipt.eventId !== start.id || receipt.workId !== record.id || !object(receipt.host) || !object(receipt.modelExecution)
        || JSON.stringify(receipt.modelExecution.allocation) !== JSON.stringify(start.allocation) || completion.taskId !== item.taskId
        || completion.outcome !== receipt.host.outcome || (receipt.host.ok ? "host_result" : "post_failure") !== completion.type) throw new Error(`${item.taskId}: unit_receipt_invalid`);
      const evaluation = await assessUnitAcceptance({ repo, record, unit: item, host: receipt.host,
        executor: receipt.modelExecution.executor === "process" ? "process" : "injected", attempt: record.workflow.verifications.filter(attempt =>
          typeof completion.recordedAt === "string" && Date.parse(attempt.startedAt) >= Date.parse(completion.recordedAt)
          && attempt.requestedCommand === item.verification.command && JSON.stringify(attempt.args) === JSON.stringify(item.verification.args)
          && item.criterionIds.every(id => attempt.criterionIds.includes(id))).at(-1) });
      reasons.push(...evaluation.reasons.map(reason => `${item.taskId}: ${reason}`));
    }
  } catch (error) { reasons.push(error instanceof Error ? error.message : String(error)); }
  return { usable: reasons.length === 0, reasons };
}
