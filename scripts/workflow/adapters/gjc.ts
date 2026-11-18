/**
 * @architecture arch.development.providers.gjc
 * @implements RESP-DEVELOPMENT-PROVIDERS-GJC
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, openSync, writeSync } from "node:fs";
import path from "node:path";

import type { ChildProcess, StdioOptions } from "node:child_process";

export interface ProcessInvocation extends Record<string, unknown> {
  command : string   ;
  args    : string[] ;
  mode?   : string   ;
  stdin?  : string   ;
}
export interface ProcessOptions extends Record<string, unknown> {
  cwd?           : string            ;
  env?           : NodeJS.ProcessEnv ;
  signal?        : AbortSignal       ;
  stdio?         : StdioOptions      ;
  captureOutput? : boolean           ;
  outputDirectory?: string;
}
export interface ProcessResult {
  ok               : boolean       ;
  code             : number | null ;
  signal?          : string | null ;
  error?           : string | null ;
  outcome          : string        ;
  stdout?          : string        ;
  stderr?          : string        ;
  outputTruncated? : boolean       ;
  threadId?        : string | null ;
  outputFiles?: Record<"stdout" | "stderr", { path: string; bytes: number }>;
  rawOutputTruncated?: boolean;
  summaryTruncated?: boolean;
  usage?: Record<string, unknown> | null;
  environment?: { ok: boolean };
  /** 입력 stream flush 관찰이며 호스트의 의미적 수용을 뜻하지 않는다. */
  inputDelivered?: boolean;
}
export interface GjcInvocation extends ProcessInvocation {
  requestedModel    : string | null ;
  requestedThinking : string | null ;
  observedModel     : null          ;
  mode              : "prompt"      ;
}
export interface GjcOptions {
  gjc?          : string  ;
  systemPrompt? : unknown ;
  request?      : unknown ;
  model?        : unknown ;
  thinking?     : unknown ;
  capabilities? : {
    model    : boolean;
    thinking : boolean;
  };
}

export const GJC_CONTEXT_SURFACE = "--append-system-prompt";
const capability = Object.freeze({
  context              : true  ,
  nativeSkillInvoke    : false ,
  mutationInterception : false ,
  sandbox              : false ,
  advisory             : true  ,
  model                : true  ,
  thinking             : true
});

export function createGjcInvocation({ gjc = "gjc", systemPrompt, request, model, thinking, capabilities = capability }: GjcOptions = {}): GjcInvocation {
  if (typeof systemPrompt !== "string" || !systemPrompt.trim()) throw new TypeError("검증된 Skill 컨텍스트가 필요합니다.");
  if (typeof request !== "string" || !request.trim()) throw new TypeError("검증된 원문 요청이 필요합니다.");
  if (model !== undefined && (!capabilities.model || typeof model !== "string" || !model.trim())) throw new Error("요청한 model capability를 지원하지 않습니다.");
  if (thinking !== undefined && (!capabilities.thinking || typeof thinking !== "string" || !thinking.trim())) throw new Error("요청한 thinking capability를 지원하지 않습니다.");
  const args = ["-p", "--no-title", GJC_CONTEXT_SURFACE, systemPrompt];
  if (model !== undefined) args.push("--model", model);
  if (thinking !== undefined) args.push("--thinking", thinking);
  args.push("--", request);
  return Object.freeze({ command: gjc, args, requestedModel: model ?? null, requestedThinking: thinking ?? null, observedModel: null, mode: "prompt" });
}
export function spawnGjc(invocation: ProcessInvocation, options: ProcessOptions = {}) {
  if (!invocation || !Array.isArray(invocation.args)) throw new TypeError("GJC invocation이 필요합니다.");
  return spawn(invocation.command, invocation.args, { cwd: options.cwd, env: mergeEnvironment(options.env), stdio: options.stdio ?? "pipe", shell: false, windowsHide: true });
}
export function gjcCapabilities() { return capability; }
export async function waitForChild(child: ChildProcess, { captureOutput = false, outputDirectory }: Pick<ProcessOptions, "captureOutput" | "outputDirectory"> = {}): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolve) => {
    const spool = createOutputSpool(outputDirectory);
    let spawnError : Error | null                          = null                       ;
    const chunks   : Record<"stdout" | "stderr", Buffer[]> = { stdout: [], stderr: [] } ;
    const sizes                                            = { stdout: 0, stderr: 0 }   ;
    let outputTruncated                                    = false                      ;
    for (const name of ["stdout", "stderr"] as const) {
      child[name]?.on("data", (chunk: Buffer) => {
        spool.write(name, chunk);
        if (!captureOutput) return;
        const buffer    = Buffer.from(chunk                     ) ;
        const remaining = Math  .max (0, 1_048_576 - sizes[name]) ;
        if (buffer.length > remaining) outputTruncated = true;
        if (remaining > 0) chunks[name].push(buffer.subarray(0, remaining));
        sizes[name] += Math.min(buffer.length, remaining);
      });
    }
    child.once("error", (error) => { spawnError = error; });
    child.once("close", (code, signal) => {
      spool.close();
      resolve({
        ...spool.result(),
        summaryTruncated: outputTruncated,
        ok      : !spool.error && !spawnError && code === 0 && !signal                                               ,
        code                                                                                         ,
        signal                                                                                       ,
        error   : spool.error ?? spawnError?.message ?? null                                                        ,
        outcome : spool.error ? "spool_error" : spawnError ? "spawn_error" : signal ? "signal" : code === 0 ? "passed" : "nonzero" ,
        ...(captureOutput ? { stdout: Buffer.concat(chunks.stdout).toString("utf8"), stderr: Buffer.concat(chunks.stderr).toString("utf8"), outputTruncated } : {}),
      });
    });
  });
}

/** 생성 책임은 호출자에게 있다. 기존 파일을 덮어쓰지 않고 양 스트림을 완전 보존한다. */
export function createOutputSpool(directory?: string) {
  const files: Record<"stdout" | "stderr", { path: string; bytes: number }> = {
    stdout: { path: "", bytes: 0 },
    stderr: { path: "", bytes: 0 },
  };
  const descriptors: Partial<Record<"stdout" | "stderr", number>> = {};
  let error: string | null = null;
  if (directory !== undefined) {
    try {
      if (!path.isAbsolute(directory)) throw new Error("원문 출력 폴더는 절대경로여야 합니다.");
      const id = randomUUID();
      for (const name of ["stdout", "stderr"] as const) {
        files[name].path = path.join(directory, `${id}.${name}.log`);
        descriptors[name] = openSync(files[name].path, "wx", 0o600);
      }
    } catch (cause) { error = `원문 파일 생성 실패: ${String(cause)}`; }
  }
  return {
    get error() { return error; },
    write(name: "stdout" | "stderr", chunk: Buffer): void {
      if (directory === undefined || error) return;
      try {
        const descriptor = descriptors[name];
        if (descriptor === undefined) throw new Error("원문 파일이 열리지 않았습니다.");
        let offset = 0;
        while (offset < chunk.length) {
          const written = writeSync(descriptor, chunk, offset, chunk.length - offset);
          if (written === 0) throw new Error("원문 쓰기가 진행되지 않습니다.");
          offset += written;
          files[name].bytes += written;
        }
      } catch (cause) { error = `원문 보존 실패: ${String(cause)}`; }
    },
    close(): void {
      for (const descriptor of Object.values(descriptors)) {
        try { closeSync(descriptor); } catch (cause) { error ??= `원문 파일 닫기 실패: ${String(cause)}`; }
      }
    },
    result(): Pick<ProcessResult, "outputFiles" | "rawOutputTruncated"> {
      return directory === undefined ? {} : { outputFiles: files, rawOutputTruncated: error !== null };
    },
  };
}

export function mergeEnvironment(overrides: NodeJS.ProcessEnv = {}, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const merged = { ...inherited };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (process.platform === "win32") {
      for (const existing of Object.keys(merged)) if (existing.toLowerCase() === key.toLowerCase()) delete merged[existing];
    }
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}
