import { spawn } from "node:child_process";

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
  return spawn(invocation.command, invocation.args, { cwd: options.cwd, env: options.env, stdio: options.stdio ?? "pipe", shell: false, windowsHide: true });
}
export function gjcCapabilities() { return capability; }
export async function waitForChild(child: ChildProcess, { captureOutput = false }: Pick<ProcessOptions, "captureOutput"> = {}): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolve) => {
    let spawnError : Error | null                          = null                       ;
    const chunks   : Record<"stdout" | "stderr", Buffer[]> = { stdout: [], stderr: [] } ;
    const sizes                                            = { stdout: 0, stderr: 0 }   ;
    let outputTruncated                                    = false                      ;
    for (const name of ["stdout", "stderr"] as const) {
      if (!captureOutput) child[name]?.resume();
      else child[name]?.on("data", (chunk: Buffer) => {
        const buffer    = Buffer.from(chunk                     ) ;
        const remaining = Math  .max (0, 1_048_576 - sizes[name]) ;
        if (buffer.length > remaining) outputTruncated = true;
        if (remaining > 0) chunks[name].push(buffer.subarray(0, remaining));
        sizes[name] += Math.min(buffer.length, remaining);
      });
    }
    child.once("error", (error) => { spawnError = error; });
    child.once("close", (code, signal) => resolve({
      ok      : !spawnError && code === 0 && !signal                                               ,
      code                                                                                         ,
      signal                                                                                       ,
      error   : spawnError?.message ?? null                                                        ,
      outcome : spawnError ? "spawn_error" : signal ? "signal" : code === 0 ? "passed" : "nonzero" ,
      ...(captureOutput ? { stdout: Buffer.concat(chunks.stdout).toString("utf8"), stderr: Buffer.concat(chunks.stderr).toString("utf8"), outputTruncated } : {}),
    }));
  });
}
