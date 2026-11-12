import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface ProviderInvocation {
  command : string  ;
  args    : string[];
}

export interface ActualProviderInvocation extends ProviderInvocation {
  platform         : "win32" ;
  executableDigest : string  ;
}

export interface ProviderResolutionOptions {
  platform? : string                             ;
  env?      : Record<string, string | undefined> ;
  cwd?      : string                             ;
  isFile?   : (file: string) => boolean          ;
}
export interface ProviderExecutionOptions extends Record<string, unknown> {
  env? : Record<string, string | undefined>;
  cwd? : string;
}


const providers = new Set(["codex", "claude"]);
function regularFile(file: string): boolean { try { return statSync(file).isFile(); } catch { return false; } }

// .cmd 내용을 해석하거나 shell로 실행하지 않고 실제 설치된 native exe만 선택한다.
export function resolveProviderInvocation(invocation: ProviderInvocation, { platform = process.platform, env = process.env, cwd = process.cwd(), isFile = regularFile }: ProviderResolutionOptions = {}): ProviderInvocation {
  if (platform !== "win32") return { command: invocation.command, args: [...invocation.args] };
  const command  = invocation.command                                                        ;
  const provider = path.win32.basename(command).replace(/\.(?:cmd|exe)$/i, "").toLowerCase() ;
  if (!providers.has(provider)) return { command, args: [...invocation.args] };
  const explicit   = path.win32.isAbsolute(command) || /[\\/]/.test(command)                           ;
  const searchPath = env[Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH"] ?? "" ;
  const bases = explicit ? [path.win32.resolve(cwd, command)] : searchPath.split(";")
    .filter((directory) => directory.trim()).map((directory) => path.win32.join(path.win32.resolve(cwd, directory.trim().replace(/^"|"$/g, "")), command));
  for (const base of bases) {
    const candidates = /\.(?:cmd|exe)$/i.test(base) ? [base] : [`${base}.exe`, `${base}.cmd`];
    for (const candidate of candidates) {
      if (/\.exe$/i.test(candidate) && isFile(candidate)) return { command: candidate, args: [...invocation.args] };
      if (!/\.cmd$/i.test(candidate) || !isFile(candidate)) continue;
      const module = path.win32.join(path.win32.dirname(candidate), "node_modules");
      const native = provider === "codex" ? [
        path.win32.join(module, "@openai", "codex", "node_modules", "@openai", "codex-win32-x64", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe"),
        path.win32.join(module, "@openai", "codex", "vendor", "x86_64-pc-windows-msvc", "codex", "codex.exe"),
      ] : [
        path.win32.join(module, "@anthropic-ai", "claude-code", "bin", "claude.exe"),
        path.win32.join(module, "@anthropic-ai", "claude-code", "node_modules", "@anthropic-ai", "claude-code-win32-x64", "claude.exe"),
      ];
      const executable = native.find(isFile);
      if (executable) return { command: executable, args: [...invocation.args] };
    }
  }
  throw new Error(`Windows ${provider} native exe를 찾지 못했습니다. npm shim을 shell로 실행하지 않습니다.`);
}

export function providerExecution(invocation: ProviderInvocation, options?: ProviderExecutionOptions) {
  if (options && (Object.hasOwn(options, "platform") || Object.hasOwn(options, "isFile"))) throw new Error("실제 provider 실행의 플랫폼과 파일 검사는 주입할 수 없습니다. 순수 resolver 검사를 사용하세요.");
  const resolved = resolveProviderInvocation(invocation, { platform: process.platform, env: options?.env, cwd: options?.cwd });
  const actualInvocation: ActualProviderInvocation | null = process.platform === "win32" && providers.has(path.win32.basename(invocation.command).replace(/\.(?:cmd|exe)$/i, "").toLowerCase())
    ? { platform: "win32", command: resolved.command, args: resolved.args, executableDigest: createHash("sha256").update(readFileSync(resolved.command)).digest("hex") }
    : null;
  return { ...resolved, actualInvocation, executionPlatform: process.platform };
}

export function providerExecutionMatches(logical: ProviderInvocation, actual: unknown, executionPlatform?: unknown): boolean {
  if (executionPlatform !== undefined && (typeof executionPlatform !== "string" || !["aix", "android", "darwin", "freebsd", "haiku", "linux", "netbsd", "openbsd", "sunos", "win32", "cygwin"].includes(executionPlatform))) return false;
  if (actual == null) return executionPlatform !== "win32"; // OS 필드가 없던 이전 POSIX 영수증 형식은 보존한다.
  if (typeof actual !== "object" || !("platform" in actual) || !("command" in actual) || !("executableDigest" in actual) || !("args" in actual)) return false;
  return (executionPlatform === undefined || executionPlatform === "win32") && actual.platform === "win32" && typeof actual.command === "string" && path.win32.isAbsolute(actual.command)
    && path.win32.basename(actual.command).toLowerCase() === `${logical.command}.exe`
    && typeof actual.executableDigest === "string" && /^[a-f0-9]{64}$/.test(actual.executableDigest)
    && JSON.stringify(actual.args) === JSON.stringify(logical.args);
}
