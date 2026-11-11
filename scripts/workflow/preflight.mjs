import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const WORK_ID = /^work-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertWorkId(workId) {
  if (typeof workId !== "string" || !WORK_ID.test(workId)) throw new Error("유효한 work-id가 필요합니다.");
  return workId.toLowerCase();
}

async function git(root, args) {
  const { stdout } = await exec("git", ["-C", root, ...args], { encoding: "utf8" });
  return stdout.trim();
}

export async function createSessionBinding({ repo, workId, requestHash, approval = {} } = {}) {
  assertWorkId(workId);
  if (typeof requestHash !== "string" || !/^[a-f0-9]{64}$/i.test(requestHash)) throw new Error("요청 hash가 필요합니다.");
  const realRepo = await fs.realpath(repo ?? process.cwd());
  const topLevel = await git(realRepo, ["rev-parse", "--show-toplevel"]);
  if (await fs.realpath(topLevel) !== realRepo) throw new Error("저장소 루트에서만 실행할 수 있습니다.");
  const [branch, head, porcelain, worktree] = await Promise.all([
    git(realRepo, ["branch", "--show-current"]), git(realRepo, ["rev-parse", "HEAD"]), git(realRepo, ["status", "--porcelain=v1"]), git(realRepo, ["rev-parse", "--show-toplevel"]),
  ]);
  if (!branch) throw new Error("detached HEAD에서는 실행할 수 없습니다.");
  return Object.freeze({ schemaVersion: 1, workId: assertWorkId(workId), repo: realRepo, worktree: await fs.realpath(worktree), branch, head, dirty: createHash("sha256").update(porcelain).digest("hex"), dirtyCount: porcelain ? porcelain.split("\n").length : 0, requestHash: requestHash.toLowerCase(), approval, createdAt: new Date().toISOString(), nonce: randomUUID() });
}

export async function validateSessionBinding(binding) {
  if (!binding || typeof binding !== "object") throw new TypeError("session binding이 필요합니다.");
  const current = await createSessionBinding({ repo: binding.repo, workId: binding.workId, requestHash: binding.requestHash, approval: binding.approval });
  for (const key of ["repo", "worktree", "branch", "head", "dirty", "requestHash"]) if (binding[key] !== current[key]) throw new Error(`session binding drift: ${key}`);
  return current;
}

export async function resolveInside(root, candidate) {
  const realRoot = await fs.realpath(root);
  const absolute = path.resolve(realRoot, candidate);
  if (absolute !== realRoot && !absolute.startsWith(`${realRoot}${path.sep}`)) throw new Error("경로 traversal은 허용되지 않습니다.");
  const realCandidate = await fs.realpath(absolute);
  if (realCandidate !== realRoot && !realCandidate.startsWith(`${realRoot}${path.sep}`)) throw new Error("저장소 외부 심볼릭 링크는 허용되지 않습니다.");
  return realCandidate;
}

export async function loadCanonicalSkill({ repo, skill, expectedHash } = {}) {
  if (typeof skill !== "string" || !/^www-(spec|design|build|diagnose|verify)$/.test(skill)) throw new Error("허용되지 않은 Skill입니다.");
  const canonicalRoot = await resolveInside(repo, "skills/www");
  const file = await resolveInside(canonicalRoot, `${skill}/SKILL.md`);
  if (path.dirname(path.dirname(file)) !== canonicalRoot) throw new Error("Skill 정본 경로가 아닙니다.");
  const source = await fs.readFile(file, "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  if (expectedHash && expectedHash !== hash) throw new Error("Skill 내용 drift가 감지되었습니다.");
  return Object.freeze({ skill, path: file, hash, source, loadMode: "context" });
}

export function preflightMutation({ approval, writes = [], surfaces = [], host = {} } = {}) {
  if (!approval?.implementation) return { ok: false, mode: "rejected", reason: "implementation_not_approved" };
  const allowedPaths = new Set(approval.writePaths ?? []);
  const allowedSurfaces = new Set(approval.mutationSurfaces ?? []);
  const deniedWrites = writes.filter((item) => !allowedPaths.has(item));
  const deniedSurfaces = surfaces.filter((item) => !allowedSurfaces.has(item));
  if (deniedWrites.length || deniedSurfaces.length) return { ok: false, mode: "rejected", reason: "outside_approval", deniedWrites, deniedSurfaces };
  if (host.mutationInterception !== true) return { ok: true, mode: "advisory", reason: "host_cannot_hard_gate" };
  return { ok: true, mode: "enforced", reason: "approved" };
}
