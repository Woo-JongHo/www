/**
 * @architecture arch.development.evidence.verification
 * @implements RESP-DEVELOPMENT-EVIDENCE-VERIFICATION
 */
import type { ChildProcess } from "node:child_process";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { closeSync, lstatSync, mkdirSync, openSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";

export type TimingPhase = "preparation" | "session_queue" | "injected_runner" | "result_registration" | "ledger_lock";
type Operation = "verification" | "review" | "registration";
type TimingEvent =
  | { event: "requested"; operation: Operation }
  | { event: "bound"; workId: string; requestHash: string }
  | { event: "phase"; phase: TimingPhase }
  | { event: "process_start" | "process_exit"; processId: string; role: "verification_process" | "review_process" }
  | { event: "attempt" | "reused" | "registered" | "registration_pending"; attemptId: string }
  | { event: "provider_failure" | "dispatch_reason"; reason: string }
  | { event: "returned" | "threw" };

interface Trace {
  id          : string;
  fd          : number | undefined;
  phase       : TimingPhase;
  open?       : () => void;
}

const context = new AsyncLocalStorage<Trace>();

export function timingEvent(event: TimingEvent) {
  const trace = context.getStore();
  if (!trace) return;
  if (event.event === "bound" || event.event === "attempt") trace.open?.();
  if (trace.fd === undefined) return;
  try {
    const row = { version: 1, ...event, traceId: trace.id, at: new Date().toISOString() };
    writeFileSync(trace.fd, JSON.stringify(row) + "\n");
  } catch {
    disableTrace(trace);
  }
}

export function observeTimedChild(child: ChildProcess, phase: "verification_process" | "review_process") {
  const trace = context.getStore();
  if (!trace) return;
  const processId = randomUUID();
  child.once("spawn", () => {
    timingEvent({ event: "process_start", processId, role: phase });
  });
  child.once("exit", () => {
    timingEvent({ event: "process_exit", processId, role: phase });
  });
}

function disableTrace(trace: Trace) {
  const fd = trace.fd;
  trace.fd = undefined;
  if (fd !== undefined) {
    try { closeSync(fd); } catch { /* 계측 장치 실패가 검증 결과를 바꾸지 않게 한다. */ }
  }
  process.emitWarning("검증 시간 기록이 중단되었습니다.", { code: "WWW_TIMING_UNAVAILABLE" });
}

export async function timedPhase<T>(phase: TimingPhase, action: () => T | Promise<T>): Promise<T> {
  const trace = context.getStore();
  if (!trace) return action();
  const previous = trace.phase;
  trace.phase = phase;
  timingEvent({ event: "phase", phase });
  try { return await action(); }
  finally {
    trace.phase = previous;
    timingEvent({ event: "phase", phase: previous });
  }
}

// 같은 요청의 실행·등록은 같은 파일을 사용한다. 별도 프로세스의 회수는 attemptId로 연결한다.
export async function withWorkflowTiming<T>(repo: string, operation: Operation, action: () => Promise<T>): Promise<T> {
  if (context.getStore()) return action();
  const requestedAt = new Date().toISOString();
  const trace: Trace = { id: randomUUID(), fd: undefined, phase: "preparation" };
  // 허용된 요청이 실제 작업·시도에 결속된 뒤에만 디렉터리를 만든다.
  trace.open = () => {
    trace.open = undefined;
    try {
      let directory = realpathSync(repo);
      for (const component of [".www", "evidence", "workflow-timing"]) {
        directory = path.join(directory, component);
        try { mkdirSync(directory, { mode: 0o700 }); }
        catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error; }
        if (!lstatSync(directory).isDirectory()) throw new Error("계측 디렉터리 오류");
      }
      trace.fd = openSync(path.join(directory, trace.id + ".ndjson"), "wx", 0o600);
      const header = { version: 1, event: "requested", operation, traceId: trace.id, at: requestedAt };
      writeFileSync(trace.fd, JSON.stringify(header) + "\n");
      if (trace.phase !== "preparation") timingEvent({ event: "phase", phase: trace.phase });
    } catch { disableTrace(trace); }
  };
  return context.run(trace, async () => {
    try {
      const result = await action();
      timingEvent({ event: "returned" });
      return result;
    } catch (error) {
      timingEvent({ event: "threw" });
      throw error;
    } finally {
      if (trace.fd !== undefined) {
        try { closeSync(trace.fd); } catch { disableTrace(trace); }
        trace.fd = undefined;
      }
    }
  });
}
