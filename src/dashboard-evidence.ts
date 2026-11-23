/**
 * @architecture arch.native.projects
 * @implements RESP-NATIVE-PROJECTS
 */
import { createHash } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import { captureSource, criterionEvidence, evaluateEvidence } from "../scripts/workflow/evidence.ts";
import type { Artifact, EvidenceEvaluation, EvidenceObservations, ExecutionEnvironment, VerificationAttempt } from "../scripts/workflow/evidence.ts";
import { currentVerifications, latestVerificationGroup } from "../scripts/workflow/types.ts";
import type { DashboardApplicability } from "./shared";

type ReadBytes = (file: string) => Promise<Buffer>;
type CheckDirectory = (file: string) => Promise<void>;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const unknown = (reason: string): DashboardApplicability => ({ status: "unassessed", reasons: [reason] });

/** 원장의 임의 절대 경로 대신 호스트 PATH의 알려진 실행 파일만 확인한다. 프로젝트 파일을 실행하지 않는다. */
async function hostEnvironment(command: string, root: string): Promise<ExecutionEnvironment> {
  const name = path.basename(command);
  if (!/^(?:node|bun|npm|codex|claude)(?:\.exe)?$/.test(name)) throw Error("unsupported_executable");
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(dir => path.isAbsolute(dir));
  let target: string | undefined;
  for (const dir of dirs.slice(0, 128)) {
    const candidate = path.join(dir, name);
    const canonical = await fs.realpath(candidate).catch(() => null);
    if (!canonical || canonical === root || canonical.startsWith(root + path.sep)) continue;
    if (command === name || command === canonical) { target = canonical; break; }
  }
  if (!target) throw Error("unsupported_executable");
  await fs.access(target, constants.X_OK);
  const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > 256 * 1024 * 1024) throw Error("executable_limit");
    const hash = createHash("sha256");
    let length = 0;
    for await (const bytes of handle.createReadStream({ autoClose: false, end: before.size })) {
      length += bytes.length;
      hash.update(bytes);
    }
    const after = await fs.stat(target);
    if (length !== before.size || before.dev !== after.dev || before.ino !== after.ino || before.ctimeMs !== after.ctimeMs) throw Error("executable_changed");
    return { platform: process.platform, arch: process.arch, node: process.version, executable: { path: target, digest: hash.digest("hex") } };
  } finally { await handle.close(); }
}

function memo<T>(cache: Map<string, Promise<T>>, key: string, read: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = read();
  cache.set(key, pending);
  return pending;
}

/** 한 번의 조회에서 입력 목록, 파일 지문 및 호스트 실행 파일을 공유한다. 캐시에 원문은 보관하지 않는다. */
export function dashboardObservations(root: string, readBytes: ReadBytes, checkDirectory: CheckDirectory): EvidenceObservations {
  const files = new Map<string, Promise<Artifact>>();
  const directories = new Map<string, Promise<string[]>>();
  const sources = new Map<string, Promise<string>>();
  const tools = new Map<string, Promise<ExecutionEnvironment>>();
  let entries = 0;
  let inputCount = 0;
  const artifact = (relative: string) => {
    if (!relative || path.isAbsolute(relative) || /[\\:\0]/.test(relative) || relative.split("/").some(part => part === ".." || part === "")) throw Error("unsafe_path");
    return memo(files, relative, async () => {
      if (files.size > 5000) throw Error("file_limit");
      const bytes = await readBytes(path.join(root, relative));
      return { path: relative, size: bytes.length, digest: sha(bytes) };
    });
  };
  return {
    source(inputs) {
      if (!Array.isArray(inputs) || inputs.length > 500 || inputs.some(p => typeof p !== "string" || p.length > 1024 || p.split("/").length > 32)) throw Error("input_limit");
      const key = JSON.stringify(inputs);
      if (!sources.has(key)) inputCount += inputs.length;
      if (inputCount > 5000) throw Error("input_limit");
      return memo(sources, key, async () => (await captureSource({ repo: root, inputs, reader: {
        fileHash: async file => (await artifact(path.relative(root, file).split(path.sep).join("/"))).digest,
        entries: dir => memo(directories, dir, async () => {
          if (path.relative(root, dir).split(path.sep).length > 32) throw Error("depth_limit");
          await checkDirectory(dir);
          const names = [];
          for await (const item of await fs.opendir(dir)) {
            if (++entries > 5000) throw Error("entry_limit");
            names.push(item.name);
          }
          await checkDirectory(dir);
          return names;
        }),
      } })).digest);
    },
    async artifacts(paths) {
      if (paths.length > 500) throw Error("artifact_limit");
      const results = [];
      for (const file of [...new Set(paths)].sort()) results.push(await artifact(file));
      return results;
    },
    environment(command) {
      if (!tools.has(command) && tools.size >= 4) throw Error("executable_limit");
      return memo(tools, command, () => hostEnvironment(command, root));
    },
    async observedEnvironment() { throw Error("dependency_environment_unassessed"); },
  };
}

const reasonText: Record<string, string> = {
  verification_failed: "검증 실패 또는 실행 중 입력 변경", criteria_changed: "수용 기준 변경", source_changed: "소스 변경",
  scope_changed: "검증 범위 변경", environment_changed: "실행 환경 변경", artifacts_changed: "검증 원문 변경",
  environment_unavailable: "실행 파일 확인 범위 밖", source_unavailable: "소스 읽기 한도 또는 접근 제한",
  artifacts_unavailable: "검증 원문 누락 또는 읽기 제한", environment_observation_unavailable: "별도 환경 관찰 필요",
  invalid_attempt: "검증 시도 형식 오류", untrusted_executor: "실제 프로세스 증거 없음", invalid_coverage: "기준 범위 오류",
};

export async function dashboardApplicability(root: string, value: Record<string, unknown>, observations?: EvidenceObservations): Promise<Map<string, DashboardApplicability>> {
  const criteria = value.criteria as { id: string; required: boolean }[];
  const result = new Map<string, DashboardApplicability>();
  const workflow = value.workflow as { verifications?: VerificationAttempt[]; continuations?: { authorizedAt: string; verificationStart?: number }[] } | undefined;
  const attempts = workflow?.verifications;
  let reason = "";
  if (!observations) reason = "외부 프로젝트의 검증 입력은 조회하지 않습니다.";
  else if (value.schemaVersion !== 2) reason = "이전 형식의 원장입니다.";
  else if (!Array.isArray(attempts) || attempts.length > 1000 || criteria.length > 500 || !attempts.every(a => a && Array.isArray(a.criterionIds))) reason = "검증 이력이 없거나 조회 한도를 넘었습니다.";
  if (reason || !observations || !attempts) return new Map(criteria.map(c => [c.id, unknown(reason)]));
  const evaluated = new Map<VerificationAttempt, EvidenceEvaluation>();
  try {
    const chronological = currentVerifications(attempts, workflow.continuations?.at(-1));
    for (const c of criteria) {
      if (!c.required) { result.set(c.id, unknown("선택 기준입니다.")); continue; }
      const latest = latestVerificationGroup(chronological.filter(a => a.criterionIds.includes(c.id)));
      if (!latest.length) { result.set(c.id, { status: "missing", reasons: ["검증 시도 없음"] }); continue; }
      const reasons = new Set<string>();
      for (const attempt of latest) {
        const evaluation = evaluated.get(attempt) ?? await evaluateEvidence({ repo: root, record: value, attempt, observations });
        evaluated.set(attempt, evaluation);
        for (const reason of criterionEvidence(value, attempt, c.id, evaluation).reasons) reasons.add(reason);
      }
      const status = !reasons.size ? "current" : [...reasons].every(r => r.endsWith("_unavailable")) ? "unassessed" : "stale";
      result.set(c.id, { status, reasons: [...reasons].map(r => reasonText[r] ?? r) });
    }
  } catch { for (const c of criteria) if (!result.has(c.id)) result.set(c.id, unknown("검증 기록을 해석할 수 없습니다.")); }
  return result;
}
