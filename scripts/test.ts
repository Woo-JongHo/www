import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Suite = "product" | "boxbox";
type Runner = "bun:test" | "node:test";
interface CommandResult { status: number | null; signal?: string | null; error?: Error }
interface SuiteOptions {
  root?: string;
  args?: string[];
  readMode?: (repo: string) => Promise<unknown>;
  run?: (command: string, args: string[], cwd: string) => CommandResult;
  output?: (message: string) => void;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// .mjs 시절 Node로 실행하던 테스트는 같은 실행기를 유지한다.
const nodeTests = new Set([
  "skill-library", "windows-native", "workflow-codex", "workflow-contract", "workflow-development", "workflow-environment",
  "review-app-server", "workflow-evidence", "workflow-harness", "workflow-review", "workflow-windows-command", "workflow-work",
].map(name => path.posix.join("test", `${name}.test.ts`)));

export function testSuite(args: string[]): Suite {
  if (args.length === 0) return "product";
  if (args.length === 1 && args[0] === "--boxbox") return "boxbox";
  throw new Error("테스트 인수는 생략하거나 --boxbox만 지정하세요.");
}

export function testGroups(entries: string[], suite: Suite): Record<Runner, string[]> {
  const groups: Record<Runner, string[]> = { "bun:test": [], "node:test": [] };
  const missing = new Set(nodeTests);
  for (const entry of [...entries].sort()) {
    const relative = entry.replaceAll("\\", "/");
    if (!/\.test\.tsx?$/.test(relative)) continue;
    const external = relative.startsWith("boxbox/");
    if (external !== (suite === "boxbox")) continue;
    const file = path.posix.join("test", relative);
    const runner: Runner = missing.delete(file) ? "node:test" : "bun:test";
    groups[runner].push(`./${file}`);
  }
  if (suite === "product" && missing.size) throw new Error(`Node 테스트 파일이 없습니다: ${[...missing].join(", ")}`);
  if (suite === "boxbox" && !groups["bun:test"].length) throw new Error("BoxBox 통합 테스트 파일이 없습니다.");
  return groups;
}

export function boxboxMode(value: unknown): "off" | "check" | "align" | "refactor" {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("BoxBox mode 응답이 객체가 아닙니다.");
  if (!("tool" in value) || value.tool !== "boxbox" || !("command" in value) || value.command !== "mode"
    || !("ok" in value) || value.ok !== true || !("scope" in value) || value.scope !== "project"
    || ("error" in value && value.error) || !("mode" in value)) throw new Error("BoxBox mode 응답의 출처·상태가 올바르지 않습니다.");
  if (value.mode !== "off" && value.mode !== "check" && value.mode !== "align" && value.mode !== "refactor") throw new Error("지원하지 않는 BoxBox mode입니다.");
  return value.mode;
}

async function readBoxboxMode(repo: string): Promise<unknown> {
  const settings: unknown = JSON.parse(await readFile(path.join(repo, ".www/development.local.json"), "utf8"));
  if (typeof settings !== "object" || settings === null || !("boxboxNode" in settings) || typeof settings.boxboxNode !== "string"
    || !("boxboxLauncher" in settings) || typeof settings.boxboxLauncher !== "string"
    || !path.isAbsolute(settings.boxboxNode) || !path.isAbsolute(settings.boxboxLauncher)) throw new Error("BoxBox 실행 파일의 절대 경로 설정이 필요합니다.");
  const result = spawnSync(settings.boxboxNode, [settings.boxboxLauncher, "mode", "--json"], { cwd: repo, encoding: "utf8", timeout: 30_000, maxBuffer: 1_048_576, shell: false });
  if (result.error || result.signal || result.status !== 0) throw new Error(`BoxBox mode 조회 실패: ${result.error?.message ?? result.signal ?? result.status}`);
  return JSON.parse(result.stdout);
}

export async function runTestSuite(options: SuiteOptions = {}): Promise<number> {
  const repo = options.root ?? root;
  const suite = testSuite(options.args ?? []);
  const output = options.output ?? console.log;
  if (suite === "boxbox" && boxboxMode(await (options.readMode ?? readBoxboxMode)(repo)) === "off") {
    output(JSON.stringify({ suite, status: "disabled", executedFiles: 0, reason: "BoxBox project mode가 off입니다. 외부 도구 검사를 실행하지 않았습니다." }));
    return 2;
  }
  const groups = testGroups(await readdir(path.join(repo, "test"), { recursive: true }), suite);
  const run = options.run ?? ((command, args, cwd) => spawnSync(command, args, { cwd, stdio: "inherit", shell: false }));
  for (const runner of ["bun:test", "node:test"] as const) {
    const files = groups[runner];
    if (!files.length) continue;
    const command = runner === "bun:test" ? "bun" : process.execPath;
    const args = runner === "bun:test" ? ["test", ...files] : ["--test", ...files];
    output(`${suite} ${runner}: ${files.length}개 파일`);
    const result = run(command, args, repo);
    if (result.error) throw result.error;
    if (result.signal || result.status !== 0) return result.status || 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runTestSuite({ args: process.argv.slice(2) }).then(code => { process.exitCode = code; }).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
