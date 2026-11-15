/**
 * @architecture arch.development.review
 * @implements RESP-DEVELOPMENT-REVIEW
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { providerExecution } from './adapters/windows-command.ts';

export const appServerInvocation = { command: 'codex', args: ['app-server', '--listen', 'stdio://'] };
export interface RpcFrame { direction: 'request' | 'response'; raw: string }
export interface AppServerReceipt {
  frames: RpcFrame[];
  readScope?: { bundleOnly: boolean; commandsObserved: string[] };
  cwd: string;
  threadId: string | null;
  turnId: string | null;
  selectedModelMeaning: 'server-selected';
  finalResponse: unknown;
  shutdown?: { requested: boolean; exitCode: number | null; signal: string | null };
  actualInvocation: { command: string; args: string[]; platform: string; executableDigest: string };
}
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const digest = (v: Uint8Array) => createHash('sha256').update(v).digest('hex');
export function actualAppServerCommand() {
  const execution = providerExecution(appServerInvocation);
  const candidates = path.isAbsolute(execution.command) ? [execution.command] : (process.env.PATH ?? '').split(path.delimiter).map(p => path.join(p, execution.command));
  for (const candidate of candidates) {
    try { const command = realpathSync(candidate); return { command, args: execution.args, platform: process.platform, executableDigest: digest(readFileSync(command)) }; } catch { /* 다음 PATH 항목을 확인한다. */ }
  }
  throw new Error('app-server 실행 파일을 찾을 수 없습니다.');
}
// 실행하지 않고 literal shell 단어만 분리한다. 인용 안의 정규식 |는 연쇄가 아니다.
function shellWords(source: string): string[] | null {
  const words: string[] = [];
  let word = '', quote = '', active = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if ('`$\n\r\0'.includes(character)) return null;
    if (character === "\\" && quote !== "'") {
      const next = source[++index];
      if (!next || !['"', "'", "\\", ' '].includes(next)) return null;
      word += next; active = true; continue;
    }
    if (quote) { if (character === quote) quote = ''; else word += character; active = true; continue; }
    if (character === "'" || character === '"') { quote = character; active = true; continue; }
    if (/[;&|><(){}*?~#]/.test(character)) return null;
    if (/\s/.test(character)) { if (active) words.push(word); word = ''; active = false; }
    else { word += character; active = true; }
  }
  if (quote) return null;
  if (active) words.push(word);
  return words;
}
export function readonlyCommand(command: unknown): boolean {
  if (typeof command !== 'string') return false;
  let words = shellWords(command);
  if (!words) return false;
  if (['/bin/zsh', '/bin/bash', '/bin/sh'].includes(words[0] ?? '')) {
    if (words.length !== 3 || words[1] !== '-lc') return false;
    words = shellWords(words[2]);
    if (!words) return false;
  }
  const [executable, ...args] = words;
  const name = executable?.replace(/^\/(?:usr\/)?bin\//, '');
  if (name === 'sed') return args.length >= 3 && args[0] === '-n' && /^[0-9]+(?:,[0-9]+)?p$/.test(args[1]) && args.slice(2).every(v => v && !v.startsWith('-'));
  const flags: Record<string, RegExp> = {
    cat: /^-(?:n|b|s|E|T|v)+$|^--$/,
    rg: /^-(?:n|l|i|F|w|c)+$|^--(?:files|line-number|fixed-strings|ignore-case|count|)$/,
    pwd: /^-[LP]$/,
    ls: /^-[alhRd1]+$|^--$/,
    head: /^-[0-9]+$|^--$/,
    tail: /^-[0-9]+$|^--$/,
    wc: /^-[clwm]+$|^--$/,
  };
  if (name === 'git') return ['diff', 'status', 'show'].includes(args[0]) && (args[0] === 'status' || (args.includes('--no-ext-diff') && args.includes('--no-textconv'))) && args.slice(1).every(v => !v.startsWith('-') || /^(?:--|--stat|--short|--branch|--name-only|--no-ext-diff|--no-textconv|--oneline|-U[0-9]+)$/.test(v));
  return !!name && !!flags[name] && args.every(v => !v.startsWith('-') || flags[name].test(v));
}

// 저장된 RPC 전체를 다시 대조한다. 모델의 자기보고나 JSONL model 필드는 사용하지 않는다.
export function inspectAppServer(value: unknown, cwd: string) {
  if (!object(value) || !Array.isArray(value.frames) || value.cwd !== cwd || value.selectedModelMeaning !== 'server-selected') throw new Error('RPC receipt 맥락 불일치');
  const pending = new Map<unknown, { method: string; params: Record<string, unknown> }>();
  let threadRequested = false, initialized = false, notified = false, threadId = '', turnId = '', completed = false, turnRequested = false;
  const itemTurns = new Set<string>();
  let selectedModel = '', final: unknown = null;
  const commandsObserved: string[] = [];
  let inlineInput = '';
  const finalMessages: { thread: unknown; turn: unknown; text: string }[] = [];
  for (const frame of value.frames) {
    if (!object(frame) || typeof frame.raw !== 'string') throw new Error('RPC frame 오류');
    const message: unknown = JSON.parse(frame.raw);
    if (!object(message)) throw new Error('RPC protocol 오류');
    const params = object(message.params) ? message.params : {};
    if (frame.direction === 'request') {
      if (message.method === 'initialized' && initialized && !notified) { notified = true; continue; }
      if (typeof message.method !== 'string' || !['initialize', 'thread/start', 'turn/start'].includes(message.method) || pending.has(message.id)) throw new Error('RPC 요청 오류');
      if (message.method === 'initialize' && (initialized || pending.size)) throw new Error('initialize 순서 오류');
      if (message.method === 'thread/start' && (threadRequested || threadId || !notified || params.model !== 'gpt-6.1-terra' || params.modelProvider !== 'openai' || params.cwd !== cwd || params.sandbox !== 'read-only' || params.approvalPolicy !== 'never' || params.ephemeral !== true)) throw new Error('thread 요청 정책 불일치');
      if (message.method === 'thread/start') threadRequested = true;
      if (message.method === 'turn/start' && Object.keys(params).some(key => !['threadId', 'input'].includes(key))) throw new Error('turn 정책 override 금지');
      if (message.method === 'turn/start' && (turnRequested || !threadId || params.threadId !== threadId)) throw new Error('turn 요청 불일치');
      if (message.method === 'turn/start') {
        turnRequested = true;
        if (!Array.isArray(params.input) || params.input.length !== 1 || !object(params.input[0]) || params.input[0].type !== 'text' || typeof params.input[0].text !== 'string') throw new Error('검토 prompt 누락');
        inlineInput = params.input[0].text;
      }
      pending.set(message.id, { method: message.method, params });
      continue;
    }
    if (frame.direction !== 'response' || 'error' in message || ('id' in message && typeof message.method === 'string')) throw new Error('server 요청 또는 RPC 오류');
    if ('id' in message) {
      const request = pending.get(message.id); pending.delete(message.id);
      if (!request || !object(message.result)) throw new Error('RPC 응답 불일치');
      const result = message.result;
      if (request.method === 'initialize') initialized = true;
      if (request.method === 'thread/start') {
        if (result.approvalPolicy !== 'never' || result.model !== 'gpt-6.1-terra' || result.modelProvider !== 'openai' || result.cwd !== cwd || !object(result.sandbox) || result.sandbox.type !== 'readOnly' || result.sandbox.networkAccess !== false || !object(result.thread) || typeof result.thread.id !== 'string') throw new Error('server-selected model/provider/sandbox/cwd 불일치');
        threadId = result.thread.id; selectedModel = result.model;
      }
      if (request.method === 'turn/start') {
        if (!object(result.turn) || typeof result.turn.id !== 'string') throw new Error('turn id 누락');
        turnId = result.turn.id;
      }
      continue;
    }
    if (typeof message.method !== 'string') throw new Error('RPC notification 오류');
    if (/rerout/i.test(message.method) || message.method === 'error' || message.method === 'turn/failed') throw new Error('turn 오류');
    const item = object(params.item) ? params.item : null;
    if (item) {
      if (!turnRequested || params.threadId !== threadId || typeof params.turnId !== 'string') throw new Error('item 소속 불일치');
      itemTurns.add(params.turnId);
      if (item.turnId !== undefined && item.turnId !== params.turnId) throw new Error('도구 자체 turn 불일치');
      if (item.threadId !== undefined && item.threadId !== params.threadId) throw new Error('도구 자체 thread 불일치');
      if (!['commandExecution', 'agentMessage', 'reasoning', 'plan', 'contextCompaction'].includes(String(item.type))) throw new Error('허용되지 않은 도구');
      if (item.type === 'commandExecution' && (!readonlyCommand(item.command) || (message.method === 'item/completed' && (item.exitCode !== 0 || item.status !== 'completed')))) throw new Error('읽기 명령 실패 또는 금지 명령');
      if (message.method === 'item/completed' && item.type === 'commandExecution' && typeof item.command === 'string') commandsObserved.push(item.command);
      if (message.method === 'item/completed' && item.type === 'agentMessage' && item.phase === 'final_answer' && typeof item.text === 'string') finalMessages.push({ thread: params.threadId, turn: params.turnId, text: item.text });
    }
    if (message.method === 'turn/completed') {
      if (!turnRequested || completed || params.threadId !== threadId || !object(params.turn) || params.turn.status !== 'completed' || params.turn.error) throw new Error('turn 완료 불일치');
      // turn/start 응답보다 먼저 오는 완료도 저장된 응답과 마지막에 대조한다.
      completed = true;
      if (typeof params.turn.id !== 'string') throw new Error('완료 turn id 누락');
      if (value.turnId !== params.turn.id) throw new Error('완료 turn id 불일치');
    }
  }
  if (!completed || pending.size || threadId !== value.threadId || !turnId || turnId !== value.turnId || [...itemTurns].some(id => id !== turnId)) throw new Error('RPC 미완료');
  if (JSON.stringify(value.readScope) !== JSON.stringify({ bundleOnly: commandsObserved.length === 0, commandsObserved })) throw new Error('관측 읽기 범위 불일치');
  if (finalMessages.length !== 1) throw new Error('최종 응답 개수 불일치');
  const last = finalMessages.at(-1);
  if (!last || last.thread !== threadId || last.turn !== turnId) throw new Error('최종 응답 없음');
  final = JSON.parse(last.text);
  if (!object(final) || !['pass', 'fail'].includes(String(final.verdict)) || !Array.isArray(final.findings) || final.findings.some(v => typeof v !== 'string') || JSON.stringify(final) !== JSON.stringify(value.finalResponse)) throw new Error('최종 JSON 불일치');
  if (!commandsObserved.length) {
    const binding: unknown = JSON.parse(inlineInput.split('\n').at(-1) ?? 'null');
    if (!object(binding) || !Array.isArray(binding.inputBundle) || !binding.inputBundle.length || binding.inputBundle.some(entry => !object(entry) || typeof entry.path !== 'string' || typeof entry.content !== 'string')) throw new Error('실제 읽기 또는 inline bytes 필요');
  }
  return { verdict: final.verdict as 'pass' | 'fail', findings: final.findings as string[], observedModel: selectedModel };
}

export async function executeAppServer({ cwd, input, timeoutMs = 180_000 }: { cwd: string; input: string; timeoutMs?: number }) {
  const actualInvocation = actualAppServerCommand();
  const receipt: AppServerReceipt = { frames: [], cwd, threadId: null, turnId: null, selectedModelMeaning: 'server-selected', finalResponse: null, actualInvocation };
  const child = spawn(actualInvocation.command, actualInvocation.args, { cwd, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buffer = '', stderr = '', bytes = 0, nextId = 1, error: string | null = null, turnCompleted = false, stopping = false;
  const pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void }>();
  let finish!: () => void, fail!: (e: Error) => void;
  const done = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  // 모든 listener를 initialize 전 설치한다. 빠른 완료·EOF도 놓치지 않는다.
  const stop = (e: Error) => { error ??= e.message; for (const p of pending.values()) p.reject(e); pending.clear(); fail(e); };
  const timer = setTimeout(() => stop(new Error('app-server timeout')), timeoutMs);
  child.stdin.on('error', stop);
  child.on('error', stop);
  child.on('exit', (code, signal) => { if (!stopping && (code !== 0 || signal || !turnCompleted)) stop(new Error('app-server 비정상 종료')); });
  child.stdout.on('end', () => { if (!turnCompleted) stop(new Error('app-server EOF')); });
  child.stderr.on('data', (chunk: Buffer) => { bytes += chunk.length; stderr += chunk.toString(); if (bytes > 2_097_152) stop(new Error('RPC output truncated')); });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    bytes += Buffer.byteLength(chunk); if (bytes > 2_097_152) { stop(new Error('RPC output truncated')); return; }
    buffer += chunk;
    for (;;) {
      const end = buffer.indexOf('\n'); if (end < 0) break;
      const raw = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!raw.trim()) continue;
      receipt.frames.push({ direction: 'response', raw });
      try {
        const message: unknown = JSON.parse(raw); if (!object(message)) throw new Error('RPC protocol 오류');
        if ('id' in message && typeof message.method === 'string') throw new Error('server 요청 거절');
        if ('error' in message) throw new Error('RPC 오류');
        if (typeof message.id === 'number') { const p = pending.get(message.id); if (!p) throw new Error('RPC 응답 id 불일치'); pending.delete(message.id); p.resolve(message.result); }
        if (message.method === 'error') throw new Error('turn 오류');
        if (message.method === 'turn/completed') {
          const params = object(message.params) ? message.params : {};
          if (object(params.turn) && typeof params.turn.id === 'string') receipt.turnId = params.turn.id;
          turnCompleted = true; finish();
        }
      } catch (e) { stop(e instanceof Error ? e : new Error(String(e))); }
    }
  });
  const send = (message: object) => { const raw = JSON.stringify(message); receipt.frames.push({ direction: 'request', raw }); child.stdin.write(`${raw}\n`); };
  const request = (method: string, params: object) => new Promise<unknown>((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject }); send({ id, method, params }); });
  const session = async () => {
    await request('initialize', { clientInfo: { name: 'www-review', version: '1.0.0' } });
    send({ method: 'initialized' });
    const thread = await request('thread/start', { model: 'gpt-6.1-terra', modelProvider: 'openai', cwd, sandbox: 'read-only', approvalPolicy: 'never', ephemeral: true });
    if (!object(thread) || !object(thread.thread) || typeof thread.thread.id !== 'string') throw new Error('thread id 누락');
    receipt.threadId = thread.thread.id;
    // 잘못된 sandbox로 turn을 시작하지 않는다.
    if (thread.approvalPolicy !== 'never' || thread.model !== 'gpt-6.1-terra' || thread.modelProvider !== 'openai' || thread.cwd !== cwd || !object(thread.sandbox) || thread.sandbox.type !== 'readOnly' || thread.sandbox.networkAccess !== false) throw new Error('thread 정책 불일치');
    const turn = await request('turn/start', { threadId: receipt.threadId, input: [{ type: 'text', text: input }] });
    if (!object(turn) || !object(turn.turn) || typeof turn.turn.id !== 'string') throw new Error('turn id 누락');
    if (receipt.turnId && receipt.turnId !== turn.turn.id) throw new Error('turn id 불일치');
    receipt.turnId = turn.turn.id;
    await done;
    let finalText: string | undefined;
    for (const frame of receipt.frames) {
      const m: unknown = JSON.parse(frame.raw);
      if (frame.direction === 'response' && object(m) && m.method === 'item/completed' && object(m.params) && object(m.params.item) && m.params.threadId === receipt.threadId && m.params.turnId === receipt.turnId && m.params.item.type === 'agentMessage' && m.params.item.phase === 'final_answer' && typeof m.params.item.text === 'string') finalText = m.params.item.text;
    }
    if (buffer.trim()) throw new Error('RPC frame 절단');
    receipt.readScope = scopeFromFrames(receipt.frames);
    receipt.finalResponse = JSON.parse(finalText ?? 'null');
    inspectAppServer(receipt, cwd);
  };
  try { await Promise.race([session(), done.then(() => new Promise<never>(() => {}))]); }
  catch (e) { error ??= e instanceof Error ? e.message : String(e); }
  finally {
    clearTimeout(timer); stopping = true; child.stdin.end(); child.kill();
    await new Promise<void>(resolve => { if (child.exitCode !== null || child.signalCode !== null) return resolve(); const kill = setTimeout(() => { child.kill('SIGKILL'); }, 500); child.once('close', () => { clearTimeout(kill); resolve(); }); });
    receipt.readScope = scopeFromFrames(receipt.frames);
    receipt.shutdown = { requested: true, exitCode: child.exitCode, signal: child.signalCode };
  }
  return { code: error ? null : 0, error, stdout: '', stderr, outputTruncated: bytes > 2_097_152, appServer: receipt };
}

function scopeFromFrames(frames: RpcFrame[]) {
  const commandsObserved: string[] = [];
  for (const frame of frames) {
    try {
      const message: unknown = JSON.parse(frame.raw);
      if (frame.direction === 'response' && object(message) && message.method === 'item/completed' && object(message.params) && object(message.params.item) && message.params.item.type === 'commandExecution' && typeof message.params.item.command === 'string') commandsObserved.push(message.params.item.command);
    } catch { /* 실패한 protocol 원문도 보존하며 읽기 범위로 승격하지 않는다. */ }
  }
  return { bundleOnly: commandsObserved.length === 0, commandsObserved };
}
