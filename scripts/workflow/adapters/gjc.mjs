import { spawn } from "node:child_process";

export const GJC_CONTEXT_SURFACE = "--append-system-prompt";
const capability = Object.freeze({ context: true, nativeSkillInvoke: false, mutationInterception: false, sandbox: false, advisory: true, model: true, thinking: true });

export function createGjcInvocation({ gjc = "gjc", systemPrompt, request, model, thinking, capabilities = capability } = {}) {
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
export function spawnGjc(invocation, options = {}) {
  if (!invocation || !Array.isArray(invocation.args)) throw new TypeError("GJC invocation이 필요합니다.");
  return spawn(invocation.command, invocation.args, { cwd: options.cwd, env: options.env, stdio: options.stdio ?? "pipe", shell: false, windowsHide: true });
}
export function gjcCapabilities() { return capability; }
export async function waitForChild(child, { captureOutput = false } = {}) {
  return new Promise((resolve) => {
    let spawnError = null;
    const chunks = { stdout: [], stderr: [] };
    const sizes = { stdout: 0, stderr: 0 };
    let outputTruncated = false;
    for (const name of ["stdout", "stderr"]) {
      if (!captureOutput) child[name]?.resume();
      else child[name]?.on("data", (chunk) => {
        const buffer = Buffer.from(chunk);
        const remaining = Math.max(0, 1_048_576 - sizes[name]);
        if (buffer.length > remaining) outputTruncated = true;
        if (remaining > 0) chunks[name].push(buffer.subarray(0, remaining));
        sizes[name] += Math.min(buffer.length, remaining);
      });
    }
    child.once("error", (error) => { spawnError = error; });
    child.once("close", (code, signal) => resolve({
      ok: !spawnError && code === 0 && !signal,
      code,
      signal,
      error: spawnError?.message ?? null,
      outcome: spawnError ? "spawn_error" : signal ? "signal" : code === 0 ? "passed" : "nonzero",
      ...(captureOutput ? { stdout: Buffer.concat(chunks.stdout).toString("utf8"), stderr: Buffer.concat(chunks.stderr).toString("utf8"), outputTruncated } : {}),
    }));
  });
}
