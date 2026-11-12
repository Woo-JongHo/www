import { createHash, randomUUID }                              from "node:crypto";
import { execFile }                                            from "node:child_process";
import { promises as fs }                                      from "node:fs";
import path                                                    from "node:path";
import { promisify }                                           from "node:util";
import { resolveExecutionEnvironment, runVerificationCommand } from "./evidence.ts";

export type RepositoryEntry =
  | { path: string; type: 'missing' | 'directory' }
  | { path: string; type: 'file'; digest: string; mode: number }
  | { path: string; type: 'symlink'; target: string; resolved?: string | null };
export interface RepositoryState {
  digest : string                             ;
  files  : RepositoryEntry[]                  ;
  scope  : 'git-visible-and-work-directories' ;
}
export interface RepositoryCheckStatus {
  current       : boolean                                              ;
  status        : 'not_run' | 'invalid' | 'stale_or_failed' | 'passed' ;
  reasons       : string[]                                             ;
  id?           : string                                               ;
  completedAt?  : unknown                                              ;
  command?      : string                                               ;
  args?         : unknown                                              ;
  sourceDigest? : string                                               ;
}
function hasCode(error: unknown, code: string): boolean { return error !== null && typeof error === 'object' && 'code' in error && error.code === code; }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

const exec = promisify(execFile)                                                              ;
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex") ;

export async function captureRepositoryState({ repo = process.cwd() }: { repo?: string } = {}): Promise<RepositoryState> {
  const root = await fs.realpath(repo);
  const { stdout } = await exec("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], { maxBuffer: 8_388_608 });
  const files: RepositoryEntry[] = [];
  for (const relative of [...new Set(stdout.split("\0").filter(Boolean))].sort()) {
    const target = path.resolve(root, relative);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error("전체 검사 경로가 저장소 밖입니다.");
    let stat;
    try { stat = await fs.lstat(target); }
    catch (error) { if (!hasCode(error, "ENOENT")) throw error; files.push({ path: relative, type: "missing" }); continue; }
    if (stat.isSymbolicLink()) {
      let resolved: string | null = null;
      try { resolved = await fs.realpath(target); } catch (error) { if (!hasCode(error, "ENOENT")) throw error; }
      if (resolved && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("전체 검사에 저장소 밖 심볼릭 링크를 허용하지 않습니다.");
      files.push({ path: relative, type: "symlink", target: await fs.readlink(target), resolved: resolved ? path.relative(root, resolved) : null });
    } else if (stat.isFile()) {
      const resolved = await fs.realpath(target);
      if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("전체 검사 파일의 부모 경로가 저장소 밖입니다.");
      files.push({ path: relative, type: "file", digest: hash(await fs.readFile(target)), mode: stat.mode & 0o777 });
    } else throw new Error("전체 검사에 일반 파일이 아닌 Git 항목이 있습니다.");
  }
  // Git이 무시한 작업 파일과 빈 작업 디렉터리도 계약 검사 실패를 만들 수 있다.
  const visible = new Set(files.map((file) => file.path));
  async function directories(directory: string, relative: string): Promise<void> {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (hasCode(error, "ENOENT")) return; throw error; }
    files.push({ path: relative, type: "directory" });
    for (const entry of entries) {
      const name   = `${relative}/${entry.name}`      ;
      const target = path.join(directory, entry.name) ;
      if (entry.isDirectory()) await directories(target, name);
      else if (!visible.has(name)) {
        if (entry.isSymbolicLink()) files.push({ path: name, type: "symlink", target: await fs.readlink(target) });
        else if (entry.isFile()) files.push({ path: name, type: "file", digest: hash(await fs.readFile(target)), mode: (await fs.stat(target)).mode & 0o777 });
        else throw new Error("작업 기록에 일반 파일이 아닌 항목이 있습니다.");
      }
    }
  }
  await directories(path.join(root, "docs/work"), "docs/work");
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { digest: hash(JSON.stringify(files)), files, scope: "git-visible-and-work-directories" };
}

async function receiptLocation(repo: string, create = true) {
  const root      = await fs.realpath(repo) ;
  const directory = path.join(root, ".www") ;
  if (create) await fs.mkdir(directory, { recursive: true });
  try { if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error("전체 검사 기록 경로는 심볼릭 링크일 수 없습니다."); } catch (error) { if (!hasCode(error, "ENOENT")) throw error; }
  const file = path.join(directory, "repository-check.json");
  try { if ((await fs.lstat(file)).isSymbolicLink()) throw new Error("전체 검사 기록은 심볼릭 링크일 수 없습니다."); }
  catch (error) { if (!hasCode(error, "ENOENT")) throw error; }
  return { root, file };
}

export async function checkRepository({ repo = process.cwd(), command = process.execPath, args = ["scripts/check-workflow.ts"] }: { repo?: string; command?: string; args?: string[] } = {}) {
  if (typeof command !== "string" || !command.trim() || command.includes("\0") || !Array.isArray(args) || args.some((value) => typeof value !== "string" || value.includes("\0"))) throw new Error("전체 검사에는 실제 명령과 문자열 인자가 필요합니다.");
  const { root, file } = await receiptLocation(repo);
  const source      = await captureRepositoryState({ repo: root })                                                            ;
  const environment = await resolveExecutionEnvironment(root, command)                                                        ;
  const startedAt   = new Date().toISOString()                                                                                ;
  const result      = await runVerificationCommand({ command: environment.executable?.path ?? command, args }, { cwd: root }) ;
  let after         = null                                                                                                    ;
  try { after = await captureRepositoryState({ repo: root }); } catch { /* 실행 후 읽기 실패도 보존한다. */ }
  const environmentAfter = await resolveExecutionEnvironment(root, environment.executable?.path ?? command)                                          ;
  const stable           = source.digest === after?.digest && JSON.stringify(environment.executable) === JSON.stringify(environmentAfter.executable) ;
  const receipt = {
    id       : `repository-${randomUUID()}` ,
    kind     : "repository-consistency"     ,
    executor : "process"                    ,
    source                                           ,
    command: environment.executable?.path ?? command ,
    args                                             ,
    environment                                      ,
    startedAt                                        ,
    completedAt  : new Date().toISOString()                                                             ,
    exitCode     : result.code                                                                          ,
    signal       : result.signal                                                                        ,
    error        : result.error                                                                         ,
    sourceStable : stable                                                                               ,
    result       : result.code === 0 && !result.signal && !result.error && stable ? "passed" : "failed" ,
    output       : result.output
  };
  const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
  await fs.writeFile(path.join(root, ".www", `${receipt.id}.json`), serialized, { flag: "wx", mode: 0o600 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, serialized, { flag: "wx", mode: 0o600 });
  await fs.rename(temporary, file);
  return receipt;
}

export async function assessRepositoryCheck({ repo = process.cwd() }: { repo?: string } = {}): Promise<RepositoryCheckStatus> {
  const { root, file } = await receiptLocation(repo, false);
  let receipt: unknown;
  try { receipt = JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (hasCode(error, "ENOENT")) return { current: false, status: "not_run", reasons: ["repository_check_missing"] }; return { current: false, status: "invalid", reasons: ["repository_check_invalid"] }; }
  const reasons = [];
  if (!object(receipt) || receipt.kind !== "repository-consistency" || receipt.executor !== "process" || typeof receipt.id !== "string" || !/^repository-[a-f0-9-]{36}$/.test(receipt.id) || !object(receipt.source) || typeof receipt.source.digest !== "string" || !/^[a-f0-9]{64}$/.test(receipt.source.digest) || typeof receipt.command !== "string") return { current: false, status: "invalid", reasons: ["repository_check_invalid"] };
  if (receipt.result !== "passed" || receipt.exitCode !== 0 || receipt.signal || receipt.error || !receipt.sourceStable) reasons.push("repository_check_failed");
  try { if ((await captureRepositoryState({ repo: root })).digest !== receipt.source.digest) reasons.push("repository_changed"); }
  catch { reasons.push("repository_unavailable"); }
  const environment = await resolveExecutionEnvironment(root, receipt.command);
  if (!object(receipt.environment) || environment.platform !== receipt.environment.platform || environment.arch !== receipt.environment.arch || JSON.stringify(environment.executable) !== JSON.stringify(receipt.environment.executable)) reasons.push("repository_environment_changed");
  return { current: reasons.length === 0, status: reasons.length ? "stale_or_failed" : "passed", reasons, id: receipt.id, completedAt: receipt.completedAt, command: receipt.command, args: receipt.args, sourceDigest: receipt.source.digest };
}
