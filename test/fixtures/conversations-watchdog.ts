import type { ChildProcessWithoutNullStreams } from "node:child_process";

function observeLines(observe: (line: string) => void) {
  let partial = "";
  return (chunk: string) => {
    const lines = (partial + chunk).split("\n");
    partial = (lines.pop() ?? "").slice(-16_384);
    for (const line of lines) if (line.trim()) observe(line.trimEnd());
  };
}

export function watchConversationWire(child: ChildProcessWithoutNullStreams) {
  let turnReceivedId: number | null = null;
  let errorWrite: { id: number; ok: boolean } | null = null;
  let lastFrame: { id: number | null; error: boolean } | null = null;
  let frames = 0, errorFrames = 0, parseFailures = 0;
  let request: "not-started" | "pending" | "fulfilled" | "rejected" = "not-started";
  child.stderr.on("data", observeLines((line) => {
    const event = /^\[www-conversation-fixture\] (turn-received|error-write-ok|error-write-failed) (\d+)$/.exec(line);
    if (!event) return;
    const id = Number(event[2]);
    if (event[1] === "turn-received") turnReceivedId = id;
    else errorWrite = { id, ok: event[1] === "error-write-ok" };
  }));
  child.stdout.on("data", observeLines((line) => {
    try {
      const frame: unknown = JSON.parse(line);
      if (!frame || typeof frame !== "object") return;
      const error = "error" in frame;
      lastFrame = { id: "id" in frame && typeof frame.id === "number" ? frame.id : null, error };
      frames++;
      if (error) errorFrames++;
    } catch { parseFailures++; }
  }));
  return {
    trackRequest<T>(pending: Promise<T>): Promise<T> {
      request = "pending";
      void pending.then(() => { request = "fulfilled"; }, () => { request = "rejected"; });
      return pending;
    },
    snapshot() { return { turnReceivedId, errorWrite, lastFrame, frames, errorFrames, parseFailures, request }; },
  };
}

export function watchConversationRestart(
  test: string,
  current: () => { child: ChildProcessWithoutNullStreams; wire: ReturnType<typeof watchConversationWire> },
) {
  let phase = "fixture/start";
  const timer = setTimeout(() => {
    const { child, wire } = current();
    console.error("[www-native-restart-watchdog]", JSON.stringify({
      test, phase, pid: child.pid ?? null, exitCode: child.exitCode, signalCode: child.signalCode,
      stdinEnded: child.stdin.writableEnded, stdoutEnded: child.stdout.readableEnded, stderrEnded: child.stderr.readableEnded,
      wire: wire.snapshot(),
    }));
  }, 8_000);
  return {
    step<T>(name: string, operation: () => T): T {
      phase = name;
      return operation();
    },
    dispose() { clearTimeout(timer); },
  };
}
