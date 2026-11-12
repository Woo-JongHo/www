import { createHash }     from "node:crypto";
import { promises as fs } from "node:fs";
import path               from "node:path";
import { execFile }       from "node:child_process";
import { promisify }      from "node:util";

import type { Approval } from "./types.ts";

export interface BindingOptions {
  repo?        : string            ;
  workId?      : unknown           ;
  requestHash? : unknown           ;
  approval?    : Partial<Approval> ;
}
export interface SessionBinding {
  schemaVersion : 1                 ;
  workId        : string            ;
  repo          : string            ;
  worktree      : string            ;
  branch        : string            ;
  head          : string            ;
  dirty         : string            ;
  dirtyCount    : number            ;
  requestHash   : string            ;
  approval      : Partial<Approval> ;
  workPath      : string            ;
  workStatus    : unknown           ;
  createdAt     : string            ;
}
export interface FoundWorkRecord {
  path   : string                                   ;
  record : Record<string, unknown> & { id: string } ;
}
export interface CanonicalSkill {
  skill    : string    ;
  path     : string    ;
  hash     : string    ;
  source   : string    ;
  loadMode : "context" ;
}
export interface MutationInput {
  approval?        : Partial<Approval> | null           ;
  writes?          : unknown                            ;
  surfaces?        : unknown                            ;
  host?            : { mutationInterception?: boolean } ;
  requireHardGate? : boolean                            ;
}
export interface MutationResult {
  ok              : boolean  ;
  mode            : string   ;
  reason          : string   ;
  deniedWrites?   : string[] ;
  deniedSurfaces? : string[] ;
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }

const exec    = promisify(execFile)                                                               ;
const WORK_ID = /^work-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i ;
const SKILL   = /^www-(spec|design|build|diagnose|verify|commit)$/                                ;

export function assertWorkId(workId: unknown): string {
  if (typeof workId !== "string" || !WORK_ID.test(workId)) throw new Error("유효한 work-id가 필요합니다.");
  return workId.toLowerCase();
}
async function git(root: string, args: string[]): Promise<string> { const { stdout } = await exec("git", ["-C", root, ...args], { encoding: "utf8" }); return stdout; }
async function dirtyFingerprint(root: string) {
  const [diff, untracked] = await Promise.all([git(root, ["diff", "--no-ext-diff", "--binary", "HEAD"]), git(root, ["ls-files", "--others", "--exclude-standard", "-z"])]);
  const files = untracked.split("\0").filter(Boolean).sort();
  const contents = await Promise.all(files.map(async (file) => {
    const target = path.join(root, file)  ;
    const stat   = await fs.lstat(target) ;
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error("기준선의 특수 파일은 지원하지 않습니다.");
    const content = stat.isSymbolicLink() ? await fs.readlink(target) : await fs.readFile(target);
    return `${file}\0${createHash("sha256").update(content).digest("hex")}`;
  }));
  return { hash: createHash("sha256").update(diff).update("\0").update(contents.join("\0")).digest("hex"), count: files.length + (diff ? 1 : 0) };
}

export async function findWorkRecord({ repo = process.cwd(), workId }: { repo?: string; workId?: unknown } = {}): Promise<FoundWorkRecord> {
  const id   = assertWorkId(workId)                   ;
  const root = await resolveInside(repo, "docs/work") ;
  async function visit(directory: string): Promise<FoundWorkRecord | null> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { const found = await visit(candidate); if (found) return found; }
      if (entry.isFile() && entry.name === "work.json") {
        const source = await fs.readFile(candidate, "utf8");
        let record: unknown;
        try { record = JSON.parse(source); } catch { throw new Error("work.json JSON이 올바르지 않습니다."); }
        if (object(record) && typeof record.id === "string" && record.id.toLowerCase() === id) return Object.freeze({ path: candidate, record: { ...record, id: record.id } });
      }
    }
    return null;
  }
  const found = await visit(root); if (!found) throw new Error("work-id에 해당하는 work.json을 찾을 수 없습니다."); return found;
}

export async function createSessionBinding({ repo, workId, requestHash, approval = {} }: BindingOptions = {}): Promise<SessionBinding> {
  const id = assertWorkId(workId);
  if (typeof requestHash !== "string" || !/^[a-f0-9]{64}$/i.test(requestHash)) throw new Error("요청 hash가 필요합니다.");
  const realRepo = await fs.realpath(repo ?? process.cwd())                       ;
  const topLevel = (await git(realRepo, ["rev-parse", "--show-toplevel"])).trim() ;
  if (await fs.realpath(topLevel) !== realRepo) throw new Error("저장소 루트에서만 실행할 수 있습니다.");
  const [branch, head, dirty, work] = await Promise.all([git(realRepo, ["branch", "--show-current"]), git(realRepo, ["rev-parse", "HEAD"]), dirtyFingerprint(realRepo), findWorkRecord({ repo: realRepo, workId: id })]);
  if (!branch.trim()) throw new Error("detached HEAD에서는 실행할 수 없습니다.");
  return Object.freeze({
    schemaVersion : 1                         ,
    workId        : id                        ,
    repo          : realRepo                  ,
    worktree      : realRepo                  ,
    branch        : branch.trim()             ,
    head          : head.trim()               ,
    dirty         : dirty.hash                ,
    dirtyCount    : dirty.count               ,
    requestHash   : requestHash.toLowerCase() ,
    approval,
    workPath   : work.path          ,
    workStatus : work.record.status ,
    createdAt  : new Date().toISOString()
  });
}

export async function validateSessionBinding(binding: SessionBinding): Promise<SessionBinding> {
  if (!binding || typeof binding !== "object") throw new TypeError("session binding이 필요합니다.");
  const current = await createSessionBinding(binding);
  for (const key of ["repo", "worktree", "branch", "head", "dirty", "requestHash", "workId", "workPath", "workStatus"] as const) if (binding[key] !== current[key]) throw new Error(`session binding drift: ${key}`);
  return binding;
}

export async function resolveInside(root: string, candidate: string): Promise<string> {
  const realRoot = await fs.realpath(root)           ;
  const absolute = path.resolve(realRoot, candidate) ;
  if (absolute !== realRoot && !absolute.startsWith(`${realRoot}${path.sep}`)) throw new Error("경로 traversal은 허용되지 않습니다.");
  const realCandidate = await fs.realpath(absolute);
  if (realCandidate !== realRoot && !realCandidate.startsWith(`${realRoot}${path.sep}`)) throw new Error("저장소 외부 심볼릭 링크는 허용되지 않습니다.");
  return realCandidate;
}
export async function resolveRuntimeDirectory(repo: string, workId: unknown): Promise<string> { return resolveInside(repo, path.join(".www", "runtime", assertWorkId(workId))); }

function safeWritePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !path.isAbsolute(value)
    && !/[\\\x00]/.test(value) && !/^[A-Za-z]:/.test(value)
    && !value.split("/").includes("..");
}

export async function validateWritePaths(repo: string, writes: unknown): Promise<void> {
  if (!Array.isArray(writes)) throw new Error("쓰기 경로는 배열이어야 합니다.");
  const root = await fs.realpath(repo);
  for (const value of writes) {
    if (!safeWritePath(value)) throw new Error("쓰기 경로 traversal은 허용되지 않습니다.");
    let current = root;
    for (const part of value.split("/").filter((item) => item && item !== ".")) {
      current = path.join(current, part);
      try {
        if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("쓰기 경로 심볼릭 링크는 허용되지 않습니다.");
      } catch (error) {
        if (object(error) && error.code === "ENOENT") break;
        throw error;
      }
    }
  }
}

export async function loadCanonicalSkill({ repo = process.cwd(), skill, expectedHash }: { repo?: string; skill?: unknown; expectedHash?: string } = {}): Promise<CanonicalSkill> {
  if (typeof skill !== "string" || !SKILL.test(skill)) throw new Error("허용되지 않은 Skill입니다.");
  const canonicalRoot = await resolveInside(repo         , "skills/www"       ) ;
  const file          = await resolveInside(canonicalRoot, `${skill}/SKILL.md`) ;
  if (path.dirname(path.dirname(file)) !== canonicalRoot) throw new Error("Skill 정본 경로가 아닙니다.");
  const source = await fs.readFile(file, "utf8")                   ;
  const hash   = createHash("sha256").update(source).digest("hex") ;
  if (expectedHash && expectedHash !== hash) throw new Error("Skill 내용 drift가 감지되었습니다.");
  return Object.freeze({ skill, path: file, hash, source, loadMode: "context" });
}
export function preflightMutation({ approval, writes = [], surfaces = [], host = {}, requireHardGate = false }: MutationInput = {}): MutationResult {
  if (
       !Array.isArray(writes)
    || !Array.isArray(surfaces)
    || !writes.every(safeWritePath)
    || !surfaces.every((value): value is string => typeof value === "string")
  ) return { ok: false, mode: "rejected", reason: "unsafe_write_path" };
  if (!writes.length && !surfaces.length)                    return { ok: true, mode: "read_only", reason: "no_mutation_requested" };
  if (!approval?.implementation)                             return { ok: false, mode: "rejected", reason: "implementation_not_approved" };
  const deniedWrites   = writes  .filter((item) => !(approval.writePaths ?? []).includes(item)      ) ;
  const deniedSurfaces = surfaces.filter((item) => !(approval.mutationSurfaces ?? []).includes(item)) ;
  if (deniedWrites.length || deniedSurfaces.length)          return { ok: false, mode: "rejected", reason: "outside_approval", deniedWrites, deniedSurfaces };
  if (requireHardGate && host.mutationInterception !== true) return { ok: false, mode: "rejected", reason: "hard_gate_unsupported" };
  return host.mutationInterception === true ? { ok: true, mode: "enforced", reason: "approved" } : { ok: true, mode: "advisory", reason: "host_cannot_hard_gate" };
}
