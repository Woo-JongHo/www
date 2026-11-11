import { spawn } from "node:child_process";

export const GJC_CONTEXT_SURFACE = "--append-system-prompt";

export function createGjcInvocation({ gjc = "gjc", systemPrompt, model, thinking } = {}) {
  if (typeof systemPrompt !== "string" || !systemPrompt.trim()) throw new TypeError("검증된 Skill 컨텍스트가 필요합니다.");
  const args = [GJC_CONTEXT_SURFACE, systemPrompt];
  if (model !== undefined) {
    if (typeof model !== "string" || !model.trim()) throw new TypeError("model은 비어 있지 않은 문자열이어야 합니다.");
    args.push("--model", model);
  }
  if (thinking !== undefined) {
    if (typeof thinking !== "string" || !thinking.trim()) throw new TypeError("thinking은 비어 있지 않은 문자열이어야 합니다.");
    args.push("--thinking", thinking);
  }
  return Object.freeze({ command: gjc, args, requestedModel: model ?? null, requestedThinking: thinking ?? null, observedModel: null, mode: "context" });
}

export function spawnGjc(invocation, options = {}) {
  if (!invocation || !Array.isArray(invocation.args)) throw new TypeError("GJC invocation이 필요합니다.");
  return spawn(invocation.command, invocation.args, { cwd: options.cwd, env: options.env, stdio: options.stdio ?? "inherit", shell: false, windowsHide: true });
}

export function gjcCapabilities() {
  return Object.freeze({ context: true, nativeSkillInvoke: false, mutationInterception: false, sandbox: false, advisory: true });
}
