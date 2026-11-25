import type { ChildProcessWithoutNullStreams } from "node:child_process";

export function watchConversationRestart(test: string, currentChild: () => ChildProcessWithoutNullStreams) {
  let phase = "fixture/start";
  const timer = setTimeout(() => {
    const child = currentChild();
    console.error("[www-native-restart-watchdog]", JSON.stringify({
      test, phase, pid: child.pid ?? null, exitCode: child.exitCode, signalCode: child.signalCode,
      stdinEnded: child.stdin.writableEnded, stdoutEnded: child.stdout.readableEnded, stderrEnded: child.stderr.readableEnded,
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
