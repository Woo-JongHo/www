import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createActivityLedger } from "../../src/activity-ledger";
import { createNativeSession } from "../../src/native-session";
import { createSessionRegistry } from "../../src/session-registry";
import { createProjectRegistry, type ProjectRegistryIO } from "../../src/projects";
import { createNativeReportHarness } from "../../src/native-reports";
import { judgeNativeReport } from "../../src/report-judge";
import type { NativeSessionSummary, ResourceSnapshot, ScopedAppEvent, SelectionRef } from "../../src/shared";

export type Session = ReturnType<typeof createNativeSession>;
export async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error("Native fixture 사건 대기 시간 초과");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
export async function setup(hooks: { beforeUpsert?: () => Promise<void>; projectIO?: ProjectRegistryIO; stageProbe?: boolean; compactionTimeoutMs?: number; onChild?: (child: ChildProcessWithoutNullStreams, count: number) => void } = {}, fixtureDirectory = import.meta.dir) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "www-sessions-")));
  const userData = join(root, "profile");
  const first = join(root, "first");
  const second = join(root, "second");
  await Promise.all([mkdir(userData), mkdir(first), mkdir(second)]);
  const sessions = createSessionRegistry<Session>();
  const events: ScopedAppEvent[] = [];
  const resources: ResourceSnapshot[] = [];
  const children: ChildProcessWithoutNullStreams[] = [];
  let publishedSummaries: NativeSessionSummary[] = [];
  const interruptSnapshots: NativeSessionSummary[] = [];
  const processEpoch = randomUUID();
  const projects = createProjectRegistry({ userData, io: hooks.projectIO });
  await Promise.all([projects.register(first), projects.register(second)]);
  const actualLedger = createActivityLedger({ userData, processEpoch, onSnapshot: snapshot => {
    for (const session of sessions.list()) session.acceptResourceSnapshot(snapshot);
  } });
  const ledger = { ...actualLedger, async upsert(...args: Parameters<typeof actualLedger.upsert>) { await hooks.beforeUpsert?.(); return actualLedger.upsert(...args); } };
  const reports = createNativeReportHarness({ judge: input => judgeNativeReport(input) });
  let directory: string | null = null;
  let changes = 0;
  function add(id: string, workspace: string, workspaceMetadata?: (workspace: string) => { branch: string | null; changes: number }, registrationError?: string) {
    const session = createNativeSession({
      id, workspace, processEpoch, appVersion: "test", ledger, projects, workspaceMetadata, registrationError, wwwRoot: first, dist: root,
      reports: { enabled: false }, reportHarness: () => reports, ownership: sessions, compactionTimeoutMs: hooks.compactionTimeoutMs,
      onEvent: event => {
        events.push(event);
        if (event.method === "turn/interruptRequested") interruptSnapshots.push(...publishedSummaries);
      }, onResources: snapshot => resources.push(snapshot), onChanged() { changes++; publishedSummaries = sessions.list().map(existing => existing.summary()); },
      chooseDirectory: async () => directory, exportReport: async () => null, openExternal: async () => {},
      spawnNative(cwd) {
        const child = spawn(process.execPath, [join(fixtureDirectory, hooks.stageProbe ? "activity-app-server.ts" : "chat-ui-app-server.ts")], { cwd, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...(hooks.stageProbe ? { WWW_STAGE_PROBE: "1" } : {}) } });
        children.push(child);
        hooks.onChild?.(child, children.length);
        return child;
      }
    });
    sessions.add(session);
    return session;
  }
  async function close() {
    await Promise.all(sessions.list().map(session => session.stop()));
    await ledger.close();
    await rm(root, { recursive: true, force: true });
  }
  return { root, first, second, add, close, sessions, events, resources, children, interruptSnapshots, latestSummaries: () => publishedSummaries, changes: () => changes, choose(path: string | null) { directory = path; } };
}
export const selected = (session: Session): SelectionRef => session.workspaceInfo();
export async function start(session: Session): Promise<string> {
  const result = await session.invoke("thread:start", [selected(session)]) as { threadId: string };
  return result.threadId;
}
