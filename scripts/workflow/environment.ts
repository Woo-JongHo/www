/**
 * @architecture arch.development.execution
 * @implements RESP-DEVELOPMENT-EXECUTION
 */
import { spawnSync } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { mergeEnvironment } from "./adapters/gjc.ts";
export { mergeEnvironment } from "./adapters/gjc.ts";
import { resolveProviderInvocation } from "./adapters/codex.ts";
import { checkSourcePolicy } from "../source-policy.ts";

export interface EnvironmentCheck {
  code: string;
  status: "passed" | "failed";
  message: string;
  path?: string;
}
export interface EnvironmentReport {
  ok: boolean;
  checks: EnvironmentCheck[];
}
export interface EnvironmentOptions {
  repo: string;
  commands?: string[];
  toolPaths?: string[];
  outputDirectory: string;
  git?: { refs?: string[]; trackedIndex?: boolean; fullHistory?: boolean };
  env?: NodeJS.ProcessEnv;
}


function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string" && Boolean(item.trim()) && !item.includes("\0")); }
function inside(root: string, file: string): boolean { const relative = path.relative(root, file); return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)); }
function existing(file: string): boolean {
  try { lstatSync(file); return true; }
  catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return false;
    throw error;
  }
}
function projected(file: string): string {
  if (existing(file)) return realpathSync.native(file);
  const parent = path.dirname(file);
  if (parent === file) throw new Error("기존 부모 경로를 찾지 못했습니다.");
  return path.join(projected(parent), path.basename(file));
}
function validOptions(input: unknown): input is EnvironmentOptions {
  if (!object(input) || Object.keys(input).some((key) => !["repo", "commands", "toolPaths", "outputDirectory", "git", "env"].includes(key))) return false;
  if (typeof input.repo !== "string" || !path.isAbsolute(input.repo) || input.repo.includes("\0")) return false;
  if (typeof input.outputDirectory !== "string" || !input.outputDirectory.trim() || input.outputDirectory.includes("\0")) return false;
  if (input.commands !== undefined && !strings(input.commands)) return false;
  if (input.toolPaths !== undefined && !strings(input.toolPaths)) return false;
  if (input.env !== undefined && (!object(input.env) || Object.entries(input.env).some(([key, value]) => !key || /[=\0]/.test(key) || (value !== undefined && (typeof value !== "string" || value.includes("\0")))))) return false;
  if (input.git !== undefined) {
    if (!object(input.git) || Object.keys(input.git).some((key) => !["refs", "trackedIndex", "fullHistory"].includes(key))) return false;
    if (input.git.refs !== undefined && !strings(input.git.refs)) return false;
    for (const key of ["trackedIndex", "fullHistory"]) if (input.git[key] !== undefined && typeof input.git[key] !== "boolean") return false;
  }
  return true;
}

/** 파일 생성·설치·Git 설정 변경 없이 실행 전제를 검사한다. */
export function checkEnvironment(input: unknown): EnvironmentReport {
  const checks: EnvironmentCheck[] = [];
  const add = (code: string, ok: boolean, message: string, file?: string): void => { checks.push({ code, status: ok ? "passed" : "failed", message, ...(file ? { path: file } : {}) }); };
  if (!validOptions(input)) return { ok: false, checks: [{ code: "configuration", status: "failed", message: "알 수 없는 옵션 또는 잘못된 환경 설정입니다." }] };
  const env = mergeEnvironment(input.env);
  const searchPath = env[Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH"] ?? "";
  if ((input.commands ?? []).some((command) => !path.isAbsolute(command) && !/[\\/]/.test(command))) add("path", Boolean(searchPath.trim()), "명령 검색에는 비어 있지 않은 PATH가 필요합니다.");
  try {
    const repo = realpathSync.native(input.repo);
    const git = (args: string[]) => spawnSync("git", ["--no-optional-locks", "-C", repo, ...args], { env, encoding: "utf8", maxBuffer: 1_048_576 });
    const root = git(["rev-parse", "--show-toplevel"]);
    if (root.status !== 0 || realpathSync.native(root.stdout.trim()) !== repo) throw new Error("Git 저장소 루트가 아니거나 Git을 실행할 수 없습니다.");
    add("repository", true, "Git 저장소 루트를 확인했습니다.", repo);
    const ignored = (file: string): boolean => {
      if (!inside(repo, file) || file === repo) return false;
      const relative = path.relative(repo, file);
      const tracked = git(["ls-files", "--", relative]);
      return tracked.status === 0 && !tracked.stdout.trim() && git(["check-ignore", "--quiet", "--", relative]).status === 0;
    };
    const installation = (file: string): void => {
      const absolute = path.resolve(repo, file);
      const target = projected(absolute);
      const safe = (!inside(repo, absolute) || ignored(absolute)) && (!inside(repo, target) || ignored(target));
      add("installation", safe && statSync(absolute).isFile(), safe ? "도구 설치 위치를 확인했습니다." : "저장소 내부 도구는 Git 제외 설치 위치여야 합니다.", absolute);
    };
    for (const command of input.commands ?? []) {
      try {
        const resolved = resolveProviderInvocation({ command, args: [] }, { env, cwd: repo }).command;
        const search = env[Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH"] ?? "";
        const explicit = path.isAbsolute(resolved) || /[\\/]/.test(resolved);
        const bases = explicit ? [path.resolve(repo, resolved)] : search.split(path.delimiter).filter(Boolean).map((directory) => path.resolve(repo, directory, resolved));
        const extensions = process.platform === "win32" && !path.extname(resolved) ? (env.PATHEXT ?? ".EXE;.COM;.BAT;.CMD").split(";") : [""];
        const executable = bases.flatMap((base) => extensions.map((extension) => base + extension)).find((file) => {
          try { accessSync(file, process.platform === "win32" ? constants.F_OK : constants.X_OK); return statSync(file).isFile(); } catch { return false; }
        });
        add("executable", Boolean(executable), executable ? "실행파일을 확인했습니다." : `실행파일 또는 PATH를 확인하세요: ${command}`, executable);
        if (executable) installation(executable);
      } catch (error) { add("executable", false, String(error)); }
    }
    for (const file of input.toolPaths ?? []) {
      try { installation(file); } catch (error) { add("installation", false, String(error), file); }
    }
    for (const ref of input.git?.refs ?? []) add("git_ref", !ref.startsWith("-") && git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).status === 0, `Git 기준 ref: ${ref}`);
    if (input.git?.fullHistory) {
      const shallow = git(["rev-parse", "--is-shallow-repository"]);
      add("git_history", shallow.status === 0 && shallow.stdout.trim() === "false", "전체 Git 이력이 필요합니다.");
    }
    if (input.git?.trackedIndex) {
      const index = git(["ls-files", "--stage"]);
      add("git_index", index.status === 0 && Boolean(index.stdout.trim()), "추적된 Git index가 필요합니다.");
    }
    try {
      const output = path.resolve(repo, input.outputDirectory);
      const actual = projected(output);
      const safe = output !== repo && inside(repo, output) && inside(repo, actual) && ignored(output) && ignored(actual);
      add("output_policy", safe, "출력은 저장소 내부의 Git 제외 경로에 보존해야 하며 심볼릭 링크로 벗어날 수 없습니다.", output);
      let parent = output;
      while (!existing(parent)) parent = path.dirname(parent);
      if (!statSync(parent).isDirectory()) throw new Error("출력 경로 또는 기존 부모가 파일입니다.");
      accessSync(parent, constants.W_OK | constants.X_OK);
      add("output_writable", true, "가장 가까운 기존 출력 부모에 쓰기 권한이 있습니다.", parent);
    } catch (error) { add("output_writable", false, String(error)); }
  } catch (error) { add("repository", false, String(error)); }
  return { ok: checks.every((check) => check.status === "passed"), checks };
}

/** 기본 개발 검사에는 소스 정책 정본의 비동기 검사를 함께 적용한다. */
export async function checkDevelopmentEnvironment(): Promise<EnvironmentReport> {
  const repo = process.cwd();
  const report = checkEnvironment({
    repo,
    commands: ["node", "npm", "git", "bun", "codex"],
    toolPaths: [".www/development.local.json"],
    git: { refs: ["HEAD"], trackedIndex: true, fullHistory: true },
    outputDirectory: ".www/evidence",
  });
  if (report.checks.some((check) => check.code === "repository" && check.status === "failed")) return report;
  const source = await checkSourcePolicy(repo);
  report.checks.push({ code: "source_policy", status: source.ok ? "passed" : "failed", message: source.ok ? "소스 정책을 확인했습니다." : source.errors.join("\n") });
  return { ...report, ok: report.checks.every((check) => check.status === "passed") };
}
