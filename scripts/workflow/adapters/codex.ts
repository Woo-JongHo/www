/**
 * @architecture arch.development.providers.codex
 * @implements RESP-DEVELOPMENT-PROVIDERS-CODEX
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import path from "node:path";
import { createOutputSpool, mergeEnvironment } from "./gjc.ts";
import { providerExecution } from "./windows-command.ts";
export { resolveProviderInvocation } from "./windows-command.ts";

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ActualProviderInvocation } from "./windows-command.ts";
import type { ProcessInvocation, ProcessOptions, ProcessResult } from "./gjc.ts";

export interface CodexOptions {
  repo?         : unknown ;
  systemPrompt? : unknown ;
  request?      : unknown ;
  model?        : unknown ;
  sandbox?      : unknown ;
  thinking?     : unknown ;
}
export interface CodexInvocation extends ProcessInvocation {
  stdin          : string        ;
  requestedModel : string | null ;
  observedModel  : null          ;
  mode           : "codex-exec"  ;
}
export interface CodexResult extends ProcessResult {
  stdout           : string                          ;
  stderr           : string                          ;
  outputTruncated  : boolean                         ;
  threadId         : string | null                   ;
  turnCompleted    : boolean                         ;
  protocolError    : string | null                   ;
  events           : Record<string, unknown>[]       ;
  observedModel    : null                            ;
  actualInvocation : ActualProviderInvocation | null ;
}
const actualInvocations = new WeakMap<ChildProcessWithoutNullStreams, ActualProviderInvocation | null>();
const outputSpools = new WeakMap<ChildProcessWithoutNullStreams, { directory: string; spool: ReturnType<typeof createOutputSpool> }>();

const LIMIT       = 1_048_576                                                       ;
const SANDBOXES   = new Set(["read-only", "workspace-write", "danger-full-access"]) ;
const inputErrors = new WeakMap<ChildProcessWithoutNullStreams, string>()           ;
const deliveredInputs = new WeakSet<ChildProcessWithoutNullStreams>();
const capability = Object.freeze({
  context              : true          ,
  nativeSkillInvoke    : false         ,
  mutationInterception : false         ,
  sandbox              : false         ,
  sandboxPolicy        : "host-policy" ,
  advisory             : true          ,
  model                : true          ,
  thinking             : false
});

export function createCodexInvocation({ repo, systemPrompt, request, model, sandbox = "workspace-write", thinking }: CodexOptions = {}): CodexInvocation {
  if (typeof repo !== "string" || !path.isAbsolute(repo) || repo.includes("\0")) throw new TypeError("Codex 작업 폴더는 절대 경로여야 합니다.");
  if (typeof systemPrompt !== "string" || !systemPrompt.trim()) throw new TypeError("Codex에 전달할 개발 컨텍스트가 필요합니다.");
  if (typeof request !== "string" || !request.trim()) throw new TypeError("Codex에 전달할 실제 요청이 필요합니다.");
  if ((typeof sandbox !== "string" || !SANDBOXES.has(sandbox))) throw new Error("지원하는 Codex sandbox 정책을 지정해야 합니다.");
  if (thinking !== undefined) throw new Error("현재 Codex 어댑터는 추론 노력 전환을 지원하지 않습니다.");
  if (model !== undefined && (typeof model !== "string" || !model.trim() || model.startsWith("-") || /[\s\x00]/.test(model))) throw new Error("명시한 Codex 모델 식별자가 올바르지 않습니다.");
  const args = ["-a", "never", "exec", "--json", "--ephemeral", "--sandbox", sandbox, "-C", repo];
  if (model !== undefined) args.push("--model", model);
  args.push("-");
  return Object.freeze({
    command : "codex" ,
    args              ,
    stdin   : `WWW 개발 실행 컨텍스트

${systemPrompt}

사용자 요청

${request}
`                     ,
    requestedModel : model ?? null ,
    observedModel  : null          ,
    mode           : "codex-exec"  ,
  });
}

export function codexCapabilities() { return capability; }

function outputDirectory(value: unknown, env: NodeJS.ProcessEnv): string {
  if (typeof value !== "string" || !path.isAbsolute(value) || value.includes("\0")) throw new Error("Codex 원문 출력 outputDirectory를 명시해야 합니다.");
  const directory = realpathSync(value);
  let ancestor = directory;
  while (!existsSync(path.join(ancestor, ".git"))) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) return directory;
    ancestor = parent;
  }
  const git = (args: string[]) => spawnSync("git", ["--no-optional-locks", "-C", directory, ...args], { env, encoding: "utf8", maxBuffer: 1_048_576 });
  const tracked = git(["--literal-pathspecs", "ls-files", "--", directory]);
  if (tracked.status !== 0 || tracked.stdout.trim() || git(["check-ignore", "--quiet", "--", directory]).status !== 0) throw new Error("Codex 원문 출력은 Git 제외 경로에 보존해야 합니다.");
  return directory;
}

export function spawnCodex(invocation: ProcessInvocation, options: ProcessOptions = {}) {
  if (!invocation || invocation.mode !== "codex-exec" || typeof invocation.command !== "string" || !invocation.command.trim() || invocation.command.includes("\0") || !Array.isArray(invocation.args) || invocation.args.some((value) => typeof value !== "string" || value.includes("\0")) || typeof invocation.stdin !== "string") {
    throw new TypeError("검증된 Codex 호출이 필요합니다.");
  }
  const env = mergeEnvironment(options.env);
  const directory = outputDirectory(options.outputDirectory, env);
  const execution = providerExecution(invocation, { env, cwd: options.cwd });
  const spool = createOutputSpool(directory);
  if (spool.error) { spool.close(); throw new Error(spool.error); }
  let child: ChildProcessWithoutNullStreams;
  try { child = spawn(execution.command, execution.args, {
    cwd         : options.cwd    ,
    env                          ,
    signal      : options.signal ,
    shell       : false          ,
    windowsHide : true           ,
    stdio       : ["pipe", "pipe", "pipe"]
  }); } catch (error) { spool.close(); throw error; }
  outputSpools.set(child, { directory, spool });
  actualInvocations.set(child, execution.actualInvocation);
  child.stdin.on("error", (error) => { inputErrors.set(child, ("code" in error && typeof error.code === "string" ? error.code : "stdin_error")); });
  child.stdin.once("finish", () => { deliveredInputs.add(child); });
  child.stdin.end(invocation.stdin, "utf8");
  return child;
}

export async function waitForCodex(child: ChildProcessWithoutNullStreams, { captureOutput = false, outputDirectory }: Pick<ProcessOptions, "captureOutput" | "outputDirectory"> = {}): Promise<CodexResult> {
  const output = outputSpools.get(child);
  if (!output) throw new Error("원문 출력 경로가 결합된 spawnCodex 프로세스가 필요합니다.");
  if (outputDirectory !== undefined && realpathSync(outputDirectory) !== output.directory) throw new Error("spawnCodex에 결합된 원문 출력 경로와 다릅니다.");
  return new Promise<CodexResult>((resolve) => {
    const spool = output.spool;
    let usage: Record<string, unknown> | null = null;
    const decoder                                             = new StringDecoder("utf8")  ;
    const chunks      : Record<"stdout" | "stderr", Buffer[]> = { stdout: [], stderr: [] } ;
    const captured                                            = { stdout: 0, stderr: 0 }   ;
    const events      : Record<string, unknown>[]             = []                         ;
    let eventBytes                                            = 0                          ;
    let threadId      : string | null                         = null                       ;
    let turnCompleted                                         = false                      ;
    let hostError                                             = false                      ;
    let spawnError    : Error | null                          = null                       ;
    let protocolError : string | null                         = null                       ;
    let outputTruncated                                       = false                      ;
    let line                                                  = ""                         ;
    let discarding                                            = false                      ;

    function observe(text: string, summaryTruncated = false): void {
      if (!text.trim()) return;
      let event: unknown;
      try { event = JSON.parse(text); }
      catch { protocolError ??= "Codex JSONL 사건이 완성되지 않았거나 올바른 JSON이 아닙니다."; return; }
      if (!event || typeof event !== "object" || Array.isArray(event) || !("type" in event) || typeof event.type !== "string" || !event.type) {
        protocolError ??= "Codex JSONL 사건의 type이 없습니다.";
        return;
      }
      if (event.type === "thread.started" && "thread_id" in event && typeof event.thread_id === "string") threadId = event.thread_id;
      if (event.type === "turn.started") { turnCompleted = false; usage = null; }
      if (event.type === "turn.completed") {
        turnCompleted = true;
        if ("usage" in event && event.usage !== null && typeof event.usage === "object" && !Array.isArray(event.usage)) usage = { ...event.usage };
      }
      if (event.type === "turn.failed" || event.type === "error") hostError = true;
      const bytes = Buffer.byteLength(text);
      if (eventBytes + bytes <= LIMIT && events.length < 1_000) {
        events.push({ ...event, ...(summaryTruncated ? { summaryTruncated: true } : {}) });
        eventBytes += bytes;
      } else outputTruncated = true;
    }

    // JSON 문자열 본문만 축약한다. 나머지 구문과 escape는 검증하므로 큰 오류 사건도 숨기지 않는다.
    let inString = false;
    let escaped = false;
    let unicodeRemaining = 0;
    let token = "";
    let tokenLength = 0;
    let shortened = false;
    let lineShortened = false;
    let shortenedKey = false;
    function parse(text: string, final = false): void {
      for (const character of text) {
        if (character === "\n" && !inString) {
          if (!discarding) observe(line, lineShortened);
          line = "";
          discarding = false;
          lineShortened = false;
          shortenedKey = false;
          continue;
        }
        if (inString) {
          if (!escaped && unicodeRemaining === 0 && character === '"') {
            inString = false;
            if (!discarding) line += shortened ? `${token} [본문 요약 제한]"` : `${token}"`;
            lineShortened ||= shortened;
            shortenedKey = shortened;
            continue;
          }
          const unitStart = !escaped && unicodeRemaining === 0;
          if (unitStart) shortened ||= tokenLength >= 4096;
          if (unicodeRemaining > 0) {
            if (!/[0-9a-fA-F]/.test(character)) protocolError ??= "Codex JSON 문자열 unicode escape가 올바르지 않습니다.";
            unicodeRemaining -= 1;
          } else if (escaped) {
            if (!/^["\\/bfnrtu]$/.test(character)) protocolError ??= "Codex JSON 문자열 escape가 올바르지 않습니다.";
            if (character === "u") unicodeRemaining = 4;
            escaped = false;
          } else if (character === "\\") escaped = true;
          else if (character.charCodeAt(0) < 32) protocolError ??= "Codex JSON 문자열에 제어 문자가 있습니다.";
          if (!shortened) token += character;
          tokenLength += 1;
        } else {
          if (shortenedKey && character.trim()) {
            if (character === ":") protocolError ??= "Codex JSON key가 요약 한도를 넘었습니다.";
            shortenedKey = false;
          }
          if (character === '"') {
            inString = true;
            token = '"';
            tokenLength = 0;
            shortened = false;
          } else if (!discarding) line += character;
        }
        if (line.length > LIMIT) {
          protocolError ??= "Codex JSON 구조가 메모리 요약 한도를 넘었습니다.";
          discarding = true;
          line = "";
        }
        if (shortened || lineShortened) outputTruncated = true;
      }
      if (final) {
        if (inString) protocolError ??= "Codex JSON 문자열이 완성되지 않았습니다.";
        else if (!discarding) observe(line, lineShortened);
        line = "";
      }
    }

    function capture(name: "stdout" | "stderr", value: Buffer): void {
      const buffer = Buffer.from(value);
      spool.write(name, buffer);
      if (captured[name] + buffer.length > LIMIT) outputTruncated = true;
      const sample = buffer.subarray(0, Math.max(0, LIMIT - captured[name]));
      if (captureOutput && sample.length) chunks[name].push(sample);
      captured[name] += sample.length;
    }

    child.stdout.on("data", (chunk: Buffer) => { capture("stdout", chunk); parse(decoder.write(chunk)); });
    child.stderr.on("data", (chunk: Buffer) => { capture("stderr", chunk); });
    child.once("error", (error) => { spawnError = error; });
    child.once("close", (code, signal) => {
      parse(decoder.end(), true);
      spool.close();
      const inputError = inputErrors.get(child);
      const outcome = spool.error ? "spool_error" : spawnError ? "spawn_error"
        : signal ? "signal"
        : code !== 0 ? "nonzero"
        : inputError ? "stdin_error"
        : protocolError ? "protocol_error"
        : hostError ? "host_error"
        : !threadId || !turnCompleted ? "incomplete"
        : "passed";
      const error = spool.error ?? spawnError?.message
        ?? (inputError ? `Codex 입력 전달 실패: ${inputError}`
          : protocolError
            ?? (hostError ? "Codex 실행이 오류 사건을 반환했습니다."
              : outcome === "incomplete" ? "Codex 스레드 시작과 턴 완료 사건을 확인하지 못했습니다."
              : null));
      resolve({
        ...spool.result(),
        summaryTruncated: outputTruncated,
        usage,
        inputDelivered: deliveredInputs.has(child) && !inputError && !spawnError,
        ok               : outcome === "passed"                                                               ,
        code                                                                                                  ,
        signal                                                                                                ,
        error                                                                                                 ,
        outcome                                                                                               ,
        stdout           : captureOutput ? new StringDecoder("utf8").write(Buffer.concat(chunks.stdout)) : "" ,
        stderr           : captureOutput ? new StringDecoder("utf8").write(Buffer.concat(chunks.stderr)) : "" ,
        outputTruncated                                                                                       ,
        threadId                                                                                              ,
        turnCompleted                                                                                         ,
        protocolError                                                                                         ,
        events                                                                                                ,
        observedModel    : null                                                                               ,
        actualInvocation : actualInvocations.get(child) ?? null                                               ,
      });
    });
  });
}

export async function runCodex(invocation: ProcessInvocation, options: ProcessOptions = {}): Promise<CodexResult> {
  return waitForCodex(spawnCodex(invocation, options), { captureOutput: options.captureOutput === true, outputDirectory: options.outputDirectory });
}
