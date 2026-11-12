import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import path from "node:path";

const LIMIT = 1_048_576;
const SANDBOXES = new Set(["read-only", "workspace-write", "danger-full-access"]);
const inputErrors = new WeakMap();
const capability = Object.freeze({ context: true, nativeSkillInvoke: false, mutationInterception: false, sandbox: false, sandboxPolicy: "host-policy", advisory: true, model: true, thinking: false });

export function createCodexInvocation({ repo, systemPrompt, request, model, sandbox = "workspace-write", thinking } = {}) {
  if (typeof repo !== "string" || !path.isAbsolute(repo) || repo.includes("\0")) throw new TypeError("Codex 작업 폴더는 절대 경로여야 합니다.");
  if (typeof systemPrompt !== "string" || !systemPrompt.trim()) throw new TypeError("Codex에 전달할 개발 컨텍스트가 필요합니다.");
  if (typeof request !== "string" || !request.trim()) throw new TypeError("Codex에 전달할 실제 요청이 필요합니다.");
  if (!SANDBOXES.has(sandbox)) throw new Error("지원하는 Codex sandbox 정책을 지정해야 합니다.");
  if (thinking !== undefined) throw new Error("현재 Codex 어댑터는 추론 노력 전환을 지원하지 않습니다.");
  if (model !== undefined && (typeof model !== "string" || !model.trim() || model.startsWith("-") || /[\s\x00]/.test(model))) throw new Error("명시한 Codex 모델 식별자가 올바르지 않습니다.");
  const args = ["-a", "never", "exec", "--json", "--ephemeral", "--sandbox", sandbox, "-C", repo];
  if (model !== undefined) args.push("--model", model);
  args.push("-");
  return Object.freeze({
    command: "codex",
    args,
    stdin: `WWW 개발 실행 컨텍스트\n\n${systemPrompt}\n\n사용자 요청\n\n${request}\n`,
    requestedModel: model ?? null,
    observedModel: null,
    mode: "codex-exec",
  });
}

export function codexCapabilities() { return capability; }

export function spawnCodex(invocation, options = {}) {
  if (!invocation || invocation.mode !== "codex-exec" || typeof invocation.command !== "string" || !invocation.command.trim() || invocation.command.includes("\0") || !Array.isArray(invocation.args) || invocation.args.some((value) => typeof value !== "string" || value.includes("\0")) || typeof invocation.stdin !== "string") {
    throw new TypeError("검증된 Codex 호출이 필요합니다.");
  }
  const child = spawn(invocation.command, invocation.args, { cwd: options.cwd, env: options.env, signal: options.signal, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.on("error", (error) => { inputErrors.set(child, error.code ?? "stdin_error"); });
  child.stdin.end(invocation.stdin, "utf8");
  return child;
}

export async function waitForCodex(child, { captureOutput = false } = {}) {
  return new Promise((resolve) => {
    const decoder = new StringDecoder("utf8");
    const chunks = { stdout: [], stderr: [] };
    const captured = { stdout: 0, stderr: 0 };
    const events = [];
    let eventBytes = 0;
    let threadId = null;
    let turnCompleted = false;
    let hostError = false;
    let spawnError = null;
    let protocolError = null;
    let outputTruncated = false;
    let line = "";
    let discarding = false;

    function observe(text) {
      if (!text.trim()) return;
      let event;
      try { event = JSON.parse(text); }
      catch { protocolError ??= "Codex JSONL 사건이 완성되지 않았거나 올바른 JSON이 아닙니다."; return; }
      if (!event || Array.isArray(event) || typeof event.type !== "string" || !event.type) {
        protocolError ??= "Codex JSONL 사건의 type이 없습니다.";
        return;
      }
      if (event.type === "thread.started" && typeof event.thread_id === "string") threadId = event.thread_id;
      if (event.type === "turn.started") turnCompleted = false;
      if (event.type === "turn.completed") turnCompleted = true;
      if (event.type === "turn.failed" || event.type === "error") hostError = true;
      const bytes = Buffer.byteLength(text);
      if (eventBytes + bytes <= LIMIT && events.length < 1_000) {
        events.push(event);
        eventBytes += bytes;
      } else outputTruncated = true;
    }

    function parse(text, final = false) {
      const parts = text.split("\n");
      for (let index = 0; index < parts.length; index += 1) {
        if (!discarding) {
          line += parts[index];
          if (Buffer.byteLength(line) > LIMIT) {
            protocolError ??= "Codex JSONL 사건 하나가 1 MiB 제한을 넘었습니다.";
            outputTruncated = true;
            line = "";
            discarding = true;
          }
        }
        if (index < parts.length - 1) {
          if (!discarding) observe(line);
          line = "";
          discarding = false;
        }
      }
      if (final && !discarding) { observe(line); line = ""; }
    }

    function capture(name, value) {
      const buffer = Buffer.from(value);
      if (captured[name] + buffer.length > LIMIT) outputTruncated = true;
      const sample = buffer.subarray(0, Math.max(0, LIMIT - captured[name]));
      if (captureOutput && sample.length) chunks[name].push(sample);
      captured[name] += sample.length;
    }

    child.stdout.on("data", (chunk) => { capture("stdout", chunk); parse(decoder.write(chunk)); });
    child.stderr.on("data", (chunk) => { capture("stderr", chunk); });
    child.once("error", (error) => { spawnError = error; });
    child.once("close", (code, signal) => {
      parse(decoder.end(), true);
      const inputError = inputErrors.get(child);
      const outcome = spawnError ? "spawn_error" : signal ? "signal" : code !== 0 ? "nonzero" : inputError ? "stdin_error" : protocolError ? "protocol_error" : hostError ? "host_error" : !threadId || !turnCompleted ? "incomplete" : "passed";
      const error = spawnError?.message ?? (inputError ? `Codex 입력 전달 실패: ${inputError}` : protocolError ?? (hostError ? "Codex 실행이 오류 사건을 반환했습니다." : outcome === "incomplete" ? "Codex 스레드 시작과 턴 완료 사건을 확인하지 못했습니다." : null));
      resolve({
        ok: outcome === "passed",
        code,
        signal,
        error,
        outcome,
        stdout: captureOutput ? new StringDecoder("utf8").write(Buffer.concat(chunks.stdout)) : "",
        stderr: captureOutput ? new StringDecoder("utf8").write(Buffer.concat(chunks.stderr)) : "",
        outputTruncated,
        threadId,
        turnCompleted,
        protocolError,
        events,
        observedModel: null,
      });
    });
  });
}

export async function runCodex(invocation, options = {}) {
  return waitForCodex(spawnCodex(invocation, options), { captureOutput: options.captureOutput === true });
}
