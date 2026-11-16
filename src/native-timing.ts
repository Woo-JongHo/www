/**
 * @architecture arch.native.lifecycle
 * @implements RESP-NATIVE-LIFECYCLE
 */

import type { NativeTimingEvent, NativeTimingPhase, NativeTimingStatus } from "./shared";
export type { NativeTimingEvent, NativeTimingPhase, NativeTimingStatus } from "./shared";
export interface NativeTimingTrace {
  readonly threadId: string | null;
  readonly armed: boolean;
  readonly current: boolean;
  mark(phase: NativeTimingPhase, status: NativeTimingStatus, elapsedMs?: number): void;
  setThread(id: string): void;
  arm(): void;
  bindTurn(id: string): void;
  observe(method: string, value: unknown): void;
  cancel(status?: "failed" | "cancelled"): void;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** 내용은 검사할 때만 읽고, 후보에도 식별자와 단조 시간만 보관한다. */
function meaningful(method: string, params: Record<string, unknown>): boolean {
  if (["item/agentMessage/delta", "item/reasoning/summaryTextDelta"].includes(method)) return typeof params.delta === "string" && params.delta.trim().length > 0;
  if (["item/commandExecution/requestApproval", "item/fileChange/requestApproval", "hook/started"].includes(method)) return true;
  const item = object(params.item);
  if (!item || !["item/started", "item/completed"].includes(method)) return false;
  if (["commandExecution", "fileChange", "mcpToolCall", "webSearch"].includes(String(item.type))) return true;
  if (item.type === "agentMessage") return typeof item.text === "string" && item.text.trim().length > 0;
  return item.type === "reasoning" && Array.isArray(item.summary) && item.summary.some((part) => typeof part === "string" ? part.trim().length > 0 : typeof object(part)?.text === "string" && String(object(part)?.text).trim().length > 0);
}

export function createNativeTiming(options: { now(): number; id(): string; emit(event: NativeTimingEvent): void }) {
  let active: NativeTimingTrace | null = null;
  function begin(threadId: string | null, valid: () => boolean): NativeTimingTrace {
    active?.cancel();
    const traceId = options.id();
    const started = options.now();
    let thread = threadId;
    let turn: string | null = null;
    let armed = false;
    let ended = false;
    let first = false;
    const candidates = new Map<string, number>();
    const pending = new Set<NativeTimingPhase>();
    const current = () => !ended && valid();
    const mark = (phase: NativeTimingPhase, status: NativeTimingStatus, elapsedMs = options.now() - started) => {
      if (!current()) return;
      if (status === "started") pending.add(phase); else pending.delete(phase);
      options.emit({ traceId, threadId: thread, phase, status, elapsedMs, source: phase === "first-native" && status === "completed" ? "native" : "www" });
    };
    const firstNative = (elapsed: number) => {
      if (first) return;
      first = true;
      candidates.clear();
      mark("first-native", "completed", elapsed);
    };
    const trace = {
      get threadId() { return thread; },
      get armed() { return armed; },
      get current() { return current(); },
      mark,
      setThread(id: string) { if (current()) thread = id; },
      arm() { if (current()) { armed = true; mark("first-native", "started"); } },
      bindTurn(id: string) {
        if (!current() || !armed) return;
        turn = id;
        const elapsed = candidates.get(id);
        candidates.clear();
        if (elapsed !== undefined) firstNative(elapsed);
      },
      observe(method: string, value: unknown) {
        if (!current() || !armed || first) return;
        const params = object(value);
        if (!params || params.threadId !== thread || typeof params.turnId !== "string" || !meaningful(method, params)) return;
        if (turn === params.turnId) firstNative(options.now() - started);
        // 먼저 온 알림은 turn/start 응답의 ID를 확인할 때까지 격리한다.
        else if (turn === null && !candidates.has(params.turnId) && candidates.size < 8) candidates.set(params.turnId, options.now() - started);
      },
      cancel(status: "failed" | "cancelled" = "cancelled") {
        if (ended) return;
        for (const phase of [...pending]) mark(phase, status);
        ended = true;
        candidates.clear();
      }
    };
    active = trace;
    mark("request", "started");
    return trace;
  }
  return {
    begin,
    forTurn(threadId: string, valid: () => boolean) {
      return active?.current && active.threadId === threadId && !active.armed ? active : begin(threadId, valid);
    },
    observe(method: string, params: unknown) { active?.observe(method, params); },
    cancel(status: "failed" | "cancelled" = "cancelled") { active?.cancel(status); active = null; }
  };
}
