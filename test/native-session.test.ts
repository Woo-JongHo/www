/**
 * @verifies RESP-NATIVE-LIFECYCLE
 */
import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { createActivityLedger } from "../src/activity-ledger";
import { createNativeSession } from "../src/native-session";
import { createSessionRegistry } from "../src/session-registry";
import { createProjectRegistry, type ProjectRegistryIO } from "../src/projects";
import { createNativeReportHarness } from "../src/native-reports";
import { judgeNativeReport } from "../src/report-judge";
import type { ConversationSelection, ResourceSnapshot, ScopedAppEvent, SelectionRef } from "../src/shared";

type Session = ReturnType<typeof createNativeSession>;
async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error("Native fixture 사건 대기 시간 초과");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function setup(hooks: { beforeUpsert?: () => Promise<void>; projectIO?: ProjectRegistryIO; stageProbe?: boolean } = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "www-sessions-")));
  const userData = join(root, "profile");
  const first = join(root, "first");
  const second = join(root, "second");
  await Promise.all([mkdir(userData), mkdir(first), mkdir(second)]);
  const sessions = createSessionRegistry<Session>();
  const events: ScopedAppEvent[] = [];
  const resources: ResourceSnapshot[] = [];
  const children: ChildProcessWithoutNullStreams[] = [];
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
      reports: { enabled: false }, reportHarness: () => reports, ownership: sessions,
      onEvent: event => events.push(event), onResources: snapshot => resources.push(snapshot), onChanged() { changes++; for (const existing of sessions.list()) existing.summary(); },
      chooseDirectory: async () => directory, exportReport: async () => null, openExternal: async () => {},
      spawnNative(cwd) {
        const child = spawn(process.execPath, [join(import.meta.dir, hooks.stageProbe ? "fixtures/activity-app-server.ts" : "fixtures/chat-ui-app-server.ts")], { cwd, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...(hooks.stageProbe ? { WWW_STAGE_PROBE: "1" } : {}) } });
        children.push(child);
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
  return { root, first, second, add, close, sessions, events, resources, children, changes: () => changes, choose(path: string | null) { directory = path; } };
}
const selected = (session: Session): SelectionRef => session.workspaceInfo();
async function start(session: Session): Promise<string> {
  const result = await session.invoke("thread:start", [selected(session)]) as { threadId: string };
  return result.threadId;
}

test("두 실제 Native child는 동시에 실행하며 승인 ID·token·이벤트·중단·원장을 격리한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.second);
    const [threadA, threadB] = await Promise.all([start(a), start(b)]);
    expect(s.events.some(event => event.method === "diagnostics/timing" && (event.params as { phase?: string; status?: string }).phase === "thread/start" && (event.params as { status?: string }).status === "completed")).toBe(true);
    expect(threadA).toBe(threadB); // fixture가 같은 ID를 써도 프로젝트 경계가 다르다.
    const [turnA, turnB] = await Promise.all([
      a.invoke("turn:start", [selected(a), threadA, "A 승인 확인"]),
      b.invoke("turn:start", [selected(b), threadB, "B 승인 확인"])
    ]) as [{ turnId: string }, { turnId: string }];
    expect(typeof turnA.turnId).toBe("string");
    await until(() => a.summary().approvalCount === 1 && b.summary().approvalCount === 1);
    expect(a.summary().busy && b.summary().busy).toBe(true);
    expect(() => a.assertClosable()).toThrow("중단");
    const approvalA = s.events.find(event => event.sessionId === a.id && event.kind === "request")!;
    const approvalB = s.events.find(event => event.sessionId === b.id && event.kind === "request")!;
    expect(approvalA.requestId).toBe(42);
    expect(approvalB.requestId).toBe(42);
    expect(approvalA.approvalToken).not.toBe(approvalB.approvalToken);
    await expect(b.invoke("approval:respond", [selected(b), 42, "accept", approvalA.approvalToken])).rejects.toThrow("다른 대화 탭");
    expect(b.summary().approvalCount).toBe(1);
    await a.invoke("approval:respond", [selected(a), 42, "accept", approvalA.approvalToken]);
    await until(() => !a.summary().busy);
    expect(b.summary().busy).toBe(true);
    await b.invoke("turn:interrupt", [selected(b), threadB, turnB.turnId]);
    await until(() => !b.summary().busy);
    expect(s.events.some(event => event.sessionId === a.id && event.method === "turn/interruptRequested")).toBe(false);
    expect(s.events.some(event => event.sessionId === b.id && event.method === "turn/interruptRequested")).toBe(true);
    expect(s.children).toHaveLength(2);
    expect(s.children[0]!.pid).not.toBe(s.children[1]!.pid);
    for (const session of [a, b]) {
      const own = await session.invoke("events:get", [selected(session)]) as ScopedAppEvent[];
      expect(own.every(event => event.sessionId === session.id)).toBe(true);
      const snapshot = await session.invoke("activity:resources", [selected(session)]) as ResourceSnapshot;
      expect(snapshot.sessionId).toBe(session.id);
      expect(snapshot.scope.workspaceKey).toBe(selected(session).workspaceKey);
    }
    expect((await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).includes('"method":"turn/interrupt"')).toBe(false);
    expect((await readFile(join(s.second, "fixture-calls.jsonl"), "utf8")).includes("A 승인 확인")).toBe(false);
  } finally { await s.close(); }
});

test("같은 프로젝트의 서로 다른 대화도 두 child에서 동시에 실행한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    await b.invoke("conversations:open", [selected(b), "history-b"]);
    const [firstTurn, secondTurn] = await Promise.all([
      a.invoke("turn:start", [selected(a), "history-a", "첫 대화 중단 확인"]),
      b.invoke("turn:start", [selected(b), "history-b", "둘째 대화 중단 확인"])
    ]) as [{ turnId: string }, { turnId: string }];
    expect(a.summary().busy && b.summary().busy).toBe(true);
    await a.invoke("turn:interrupt", [selected(a), "history-a", firstTurn.turnId]);
    await until(() => !a.summary().busy);
    expect(b.summary().busy).toBe(true);
    await b.invoke("turn:interrupt", [selected(b), "history-b", secondTurn.turnId]);
    await until(() => !b.summary().busy);
    expect(s.children).toHaveLength(2);
    expect(s.events.filter(event => event.sessionId === a.id && event.method === "turn/userPrompt").every(event => (event.params as { threadId: string }).threadId === "history-a")).toBe(true);
  } finally { await s.close(); }
});

test("같은 프로젝트 대화의 동시 resume은 시작 전에 예약하고 실패·새 대화 뒤에는 다시 열 수 있다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    const opening = a.invoke("conversations:open", [selected(a), "history-a"]);
    await expect(b.invoke("conversations:open", [selected(b), "history-a"])).rejects.toThrow("다른 탭");
    expect(s.children).toHaveLength(1);
    await opening;
    await expect(a.invoke("conversations:open", [selected(a), "invalid\u0000"])).rejects.toThrow();
    await expect(b.invoke("conversations:open", [selected(b), "history-a"])).rejects.toThrow("다른 탭");
    await a.invoke("conversations:new", [selected(a)]);
    const restored = await b.invoke("conversations:open", [selected(b), "history-a"]) as ConversationSelection;
    expect(restored.threadId).toBe("history-a");
    expect(restored.workspace.sessionId).toBe(b.id);
    expect(a.summary().threadId).toBeNull();
  } finally { await s.close(); }
});

test("다른 탭의 실행은 유휴 탭 프로젝트 전환을 막지 않고 자기 실행·승인은 전환을 막는다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    const thread = await start(a);
    const turn = await a.invoke("turn:start", [selected(a), thread, "중단 확인"]) as { turnId: string };
    s.choose(s.second);
    await expect(a.invoke("workspace:choose", [selected(a)])).rejects.toThrow("실행 또는 승인");
    const result = await b.invoke("workspace:choose", [selected(b)]) as ConversationSelection;
    expect(result.workspace.path).toBe(s.second);
    expect(a.workspaceInfo().path).toBe(s.first);
    expect(a.summary().busy).toBe(true);
    await a.invoke("turn:interrupt", [selected(a), thread, turn.turnId]);
    await until(() => !a.summary().busy);
    const closed = a.stop();
    expect(a.stop()).toBe(closed);
    await expect(a.invoke("thread:start", [selected(a)])).rejects.toThrow("닫고 있습니다");
    await closed;
    expect(s.children.every(child => child.exitCode !== null || child.signalCode !== null)).toBe(true);
  } finally { await s.close(); }
});

test("실패 표시는 실제 전송 실패를 관측한 탭에만 남고 새 대화에서 초기화한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.second);
    const thread = await start(a);
    await expect(a.invoke("turn:start", [selected(a), thread, "전송 실패 확인"])).rejects.toThrow("합성 전송 실패");
    expect(a.summary().failed).toBe(true);
    expect(b.summary().failed).toBe(false);
    expect(a.summary().busy).toBe(false);
    await a.invoke("conversations:new", [selected(a)]);
    expect(a.summary().failed).toBe(false);
  } finally { await s.close(); }
});

test("세션 summary와 사건·IPC 경계는 git 메타데이터를 다시 조회하지 않는다", async () => {
  const s = await setup();
  try {
    let reads = 0;
    const a = s.add("tab-a", s.first, path => { reads++; return { branch: path === s.first ? "first-branch" : "second-branch", changes: 7 }; });
    expect(a.summary().workspace.branch).toBeNull();
    expect(reads).toBe(0);
    const selection = a.workspaceInfo();
    expect(reads).toBe(1);
    for (let pass = 0; pass < 20; pass++) a.summary();
    await a.invoke("events:get", [selection]);
    const started = await a.invoke("thread:start", [selection]) as { threadId: string };
    const turn = await a.invoke("turn:start", [selection, started.threadId, "중단 확인"]) as { turnId: string };
    await a.invoke("turn:interrupt", [selection, started.threadId, turn.turnId]);
    await until(() => !a.summary().busy);
    expect(reads).toBe(1);
    expect(a.summary().workspace.branch).toBe("first-branch");
    s.choose(s.second);
    const switched = await a.invoke("workspace:choose", [selection]) as ConversationSelection;
    expect(reads).toBe(2);
    expect(switched.workspace.branch).toBe("second-branch");
    expect(a.summary().workspace.path).toBe(s.second);
    expect(a.summary().workspace.branch).toBe("second-branch");
    expect(reads).toBe(2);
  } finally { await s.close(); }
});

function inject(child: ChildProcessWithoutNullStreams, method: string, params: unknown, id?: number): void {
  // 실제 JsonRpcClient framing으로 늦은 합성 Native 사건을 주입한다.
  child.stdout.emit("data", JSON.stringify({ jsonrpc: "2.0", method, params, ...(id === undefined ? {} : { id }) }) + "\n");
}
function command(threadId: string, itemId: string) {
  return { threadId, turnId: "late-turn", item: { id: itemId, type: "commandExecution", exitCode: 0 } };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
}

test("thread 해제는 접수한 원장 수집을 drain한 뒤 확정하며 늦은 이전 thread 사건은 새 소유자를 침범하지 않는다", async () => {
  const gate = deferred();
  let hold = false;
  let entered = false;
  const s = await setup({ beforeUpsert: async () => { if (hold) { entered = true; await gate.promise; } } });
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    hold = true;
    inject(s.children[0]!, "item/completed", command("history-a", "admitted-before-leave"));
    await until(() => entered);
    const leaving = a.invoke("conversations:new", [selected(a)]);
    expect(a.summary().busy).toBe(true);
    await expect(a.invoke("activity:resources", [selected(a)])).rejects.toThrow("전환");
    await expect(b.invoke("conversations:open", [selected(b), "history-a"])).rejects.toThrow("다른 탭");
    hold = false;
    gate.resolve();
    await leaving;
    const restored = await b.invoke("conversations:open", [selected(b), "history-a"]) as ConversationSelection;
    expect(restored.resources?.observations.some(row => row.source.kind === "item" && row.source.itemId === "admitted-before-leave")).toBe(true);
    inject(s.children[0]!, "item/completed", command("history-a", "old-owner-must-drop"));
    inject(s.children[0]!, "item/commandExecution/requestApproval", { threadId: "history-a", command: "old approval" }, 77);
    inject(s.children[0]!, "turn/completed", { threadId: "history-a", turn: { id: "old-finished", status: "completed" } });
    inject(s.children[1]!, "item/completed", command("history-a", "new-owner-keeps-epoch"));
    const current = await b.invoke("activity:resources", [selected(b)]) as ResourceSnapshot;
    expect(current.selectionEpoch).toBe(b.summary().workspace.selectionEpoch);
    expect(current.observations.some(row => row.source.kind === "item" && row.source.itemId === "new-owner-keeps-epoch")).toBe(true);
    expect(current.observations.some(row => row.source.kind === "item" && row.source.itemId === "old-owner-must-drop")).toBe(false);
    expect((await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[]).some(event => (event.params as { threadId?: string })?.threadId === "history-a")).toBe(false);
    expect(a.summary().approvalCount).toBe(0);
  } finally { hold = false; gate.resolve(); await s.close(); }
});

test("다른 thread open은 후보 사건만 새 선택에서 replay하고 실패하면 이전 thread gate와 소유를 복원한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    const opening = a.invoke("conversations:open", [selected(a), "history-b"]);
    inject(s.children[0]!, "item/completed", command("history-b", "pending-candidate"));
    inject(s.children[0]!, "item/completed", command("history-a", "retiring-thread"));
    inject(s.children[0]!, "item/commandExecution/requestApproval", { threadId: "history-b", command: "candidate approval" }, 78);
    const restored = await opening as ConversationSelection;
    expect(restored.events.some(event => (event.params as { item?: { id?: string } })?.item?.id === "pending-candidate")).toBe(true);
    expect(restored.events.some(event => (event.params as { item?: { id?: string } })?.item?.id === "retiring-thread")).toBe(false);
    expect(restored.events.some(event => event.requestId === 78 && event.supported)).toBe(true);
    expect(a.summary().approvalCount).toBe(1);
    inject(s.children[0]!, "serverRequest/resolved", { threadId: "history-b", requestId: 78 });
    const released = await b.invoke("conversations:open", [selected(b), "history-a"]) as ConversationSelection;
    expect(released.threadId).toBe("history-a");
    const failed = a.invoke("conversations:open", [selected(a), "invalid\u0000"]);
    await expect(failed).rejects.toThrow("대화 ID");
    inject(s.children[0]!, "item/completed", command("history-b", "after-rollback"));
    const resources = await a.invoke("activity:resources", [selected(a)]) as ResourceSnapshot;
    expect(resources.observations.some(row => row.source.kind === "item" && row.source.itemId === "after-rollback")).toBe(true);
    await expect(b.invoke("conversations:open", [selected(b), "history-b"])).rejects.toThrow("다른 탭");
  } finally { await s.close(); }
});

for (const limit of ["count", "bytes"] as const) test(`후보 버퍼 ${limit} 한도 초과는 전환을 실패시키고 이전 소유를 유지한다`, async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.first);
    await a.invoke("conversations:open", [selected(a), "history-a"]);
    const opening = a.invoke("conversations:open", [selected(a), "history-b"]);
    if (limit === "count") for (let index = 0; index < 2001; index++) inject(s.children[0]!, "item/completed", command("history-b", "overflow-" + index));
    else for (let index = 0; index < 2; index++) inject(s.children[0]!, "item/agentMessage/delta", { threadId: "history-b", delta: "x".repeat(2 * 1024 * 1024) });
    await expect(opening).rejects.toThrow("보관 한도");
    expect(a.summary().threadId).toBe("history-a");
    expect(a.summary().busy).toBe(false);
    await expect(b.invoke("conversations:open", [selected(b), "history-a"])).rejects.toThrow("다른 탭");
    const own = await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[];
    expect(own.some(event => (event.params as { threadId?: string })?.threadId === "history-b")).toBe(false);
  } finally { await s.close(); }
});

test("main은 단일 탭 구형 선택만 보완하고 다중 누락·닫는 source 복제를 거부하며 등록 오류를 승계한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first, undefined, "등록 저장 실패");
    const main = await readFile(join(import.meta.dir, "../src/main.ts"), "utf8");
    const helper = main.slice(main.indexOf("function selectedSession("), main.indexOf("function registerIpc("));
    const create = main.slice(main.indexOf('  ipcMain.handle("sessions:create"'), main.indexOf('  ipcMain.handle("sessions:close"'));
    const closing = new Set<string>();
    let createTab!: (_event: unknown, value?: unknown) => unknown;
    const legacy = { ...selected(a), sessionId: undefined };
    const seam = runInNewContext(new Bun.Transpiler({ loader: "ts" }).transformSync(helper + create + "\nglobalThis.nativeSeam = { select: selectedSession };"), {
      sessions: s.sessions, closing, stopping: false,
      record: (value: unknown) => value,
      sessionId: (value: unknown) => value,
      addSession(workspace: string, error: string) { return s.add("tab-created", workspace, undefined, error); },
      ipcMain: { handle(_channel: string, handler: typeof createTab) { createTab = handler; } }
    }) as { select(value: unknown): { session: Session; selection: SelectionRef } };
    expect(seam.select(legacy).selection.sessionId).toBe(a.id);
    await expect(a.invoke("events:get", [legacy])).rejects.toThrow("프로젝트 선택");
    createTab(null, selected(a));
    const cloned = s.sessions.get("tab-created");
    expect(cloned.cloneContext().registrationError).toBe("등록 저장 실패");
    expect(() => seam.select(legacy)).toThrow("세션 ID");
    closing.add(a.id);
    expect(() => createTab(null, selected(a))).toThrow("닫고 있습니다");
    closing.delete(a.id);
    await a.stop();
    expect(() => createTab(null)).toThrow("닫고 있습니다");
  } finally { await s.close(); }
});

test("main의 동시 닫기는 마지막 탭을 보존하고 닫기 예약 직후 신규 요청을 거부한다", async () => {
  const s = await setup();
  try {
    const a = s.add("tab-a", s.first);
    const b = s.add("tab-b", s.second);
    const main = await readFile(join(import.meta.dir, "../src/main.ts"), "utf8");
    const from = main.indexOf('  ipcMain.handle("sessions:close"');
    const to = main.indexOf('  ipcMain.handle("probe:ready"', from);
    expect(from).toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    let closeTab!: (_event: unknown, id: string) => Promise<void>;
    runInNewContext(new Bun.Transpiler({ loader: "ts" }).transformSync(main.slice(from, to)), {
      sessions: s.sessions, closing: new Set(), publishSessions() {}, sessionId: (id: string) => id,
      ipcMain: { handle(_channel: string, handler: typeof closeTab) { closeTab = handler; } }
    });
    const pending = closeTab(null, a.id);
    await expect(closeTab(null, b.id)).rejects.toThrow("마지막");
    await expect(a.invoke("thread:start", [selected(a)])).rejects.toThrow("닫고 있습니다");
    await pending;
    expect(s.sessions.list().map(session => session.id)).toEqual([b.id]);
  } finally { await s.close(); }
});


describe("프로젝트 폴더 추가의 실제 runtime·registry 경계", () => {
  test("선택한 미등록 폴더를 저장하고 새 선택을 반환한다", async () => {
    let renames = 0;
    const s = await setup({ projectIO: { beforeRename: async () => { renames++; } } });
    try {
      const session = s.add("tab-project", s.first);
      const before = session.workspaceInfo();
      const folder = join(s.root, "새 RPA 프로젝트");
      await mkdir(folder);
      const previousWrites = renames;
      s.choose(folder);
      const result = await session.invoke("workspace:choose", [before]) as ConversationSelection;
      expect(result.workspace.path).toBe(folder);
      expect(result.workspace.name).toBe("새 RPA 프로젝트");
      expect(result.workspace.sessionId).toBe(session.id);
      expect(result.workspace.selectionEpoch).toBe(before.selectionEpoch + 1);
      expect(result.workspace.workspaceKey).not.toBe(before.workspaceKey);
      expect(result.threadId).toBeNull();
      expect(result.events).toEqual([]);
      expect(renames).toBe(previousWrites + 1);
      expect(session.summary().workspace).toEqual(result.workspace);
      expect(session.summary().busy).toBe(false);
      const restored = await createProjectRegistry({ userData: join(s.root, "profile") }).list();
      expect(restored[0]?.path).toBe(folder);
      expect(restored.map(project => project.path).sort()).toEqual([s.first, s.second, folder].sort());
      expect(restored[0]?.workspaceKey).toBe(result.workspace.workspaceKey);
    } finally { await s.close(); }
  });

  test("폴더 선택 취소 null은 기존 대화·선택·등록 원장을 보존한다", async () => {
    let renames = 0;
    const s = await setup({ projectIO: { beforeRename: async () => { renames++; } } });
    try {
      const session = s.add("tab-project", s.first);
      const thread = await start(session);
      const before = session.workspaceInfo();
      await session.invoke("activity:resources", [before]);
      const previousWrites = renames;
      const bytes = await readFile(join(s.root, "profile", "projects-v1.json"));
      s.choose(null);
      expect(await session.invoke("workspace:choose", [before])).toBeNull();
      expect(session.workspaceInfo()).toEqual(before);
      expect(session.summary().threadId).toBe(thread);
      expect(session.summary().busy).toBe(false);
      expect(renames).toBe(previousWrites);
      expect(await readFile(join(s.root, "profile", "projects-v1.json"))).toEqual(bytes);
      expect(s.children[0]?.exitCode).toBeNull();
      expect(s.children[0]?.signalCode).toBeNull();
      const restored = await createProjectRegistry({ userData: join(s.root, "profile") }).list();
      expect(restored.map(project => project.path).sort()).toEqual([s.first, s.second].sort());
    } finally { await s.close(); }
  });

  test("실제 등록 저장 실패는 원인과 함께 거부하고 이전 선택을 보존한 뒤 재시도를 허용한다", async () => {
    let fail = false;
    let renames = 0;
    const s = await setup({ projectIO: { beforeRename: async () => {
      renames++;
      if (fail) throw new Error("합성 프로젝트 원장 rename 실패");
    } } });
    try {
      const session = s.add("tab-project", s.first);
      const thread = await start(session);
      const before = session.workspaceInfo();
      await session.invoke("activity:resources", [before]);
      const folder = join(s.root, "저장 실패 후 재시도");
      await mkdir(folder);
      const bytes = await readFile(join(s.root, "profile", "projects-v1.json"));
      const previousWrites = renames;
      s.choose(folder);
      fail = true;
      let failure: unknown;
      try { await session.invoke("workspace:choose", [before]); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(Error);
      if (!(failure instanceof Error)) throw new Error("등록 실패 오류가 반환되지 않았습니다.");
      expect(failure.message).toBe("프로젝트 등록·저장에 실패했습니다. 기존 선택을 유지합니다.");
      const cause = failure.cause;
      expect(cause).toBeInstanceOf(Error);
      if (!(cause instanceof Error)) throw new Error("등록 실패의 원인이 보존되지 않았습니다.");
      expect(cause.message).toBe("합성 프로젝트 원장 rename 실패");
      expect(renames).toBe(previousWrites + 1);
      expect(session.workspaceInfo()).toEqual(before);
      expect(session.summary().threadId).toBe(thread);
      expect(session.summary().busy).toBe(false);
      expect(await readFile(join(s.root, "profile", "projects-v1.json"))).toEqual(bytes);
      expect(s.children[0]?.exitCode).toBeNull();
      const restored = await createProjectRegistry({ userData: join(s.root, "profile") }).list();
      expect(restored.map(project => project.path).sort()).toEqual([s.first, s.second].sort());
      fail = false;
      const retry = await session.invoke("workspace:choose", [before]) as ConversationSelection;
      expect(retry.workspace.path).toBe(folder);
      expect(retry.workspace.selectionEpoch).toBe(before.selectionEpoch + 1);
      expect(retry.threadId).toBeNull();
      expect(renames).toBe(previousWrites + 2);
    } finally { fail = false; await s.close(); }
  });
});

test("Steer는 같은 턴에 원문과 ID를 한 번만 보내고 불일치·종료 경합을 구분한다", async () => {
  const s = await setup();
  try {
    const session = s.add("steer", s.first);
    const thread = await start(session);
    const turn = await session.invoke("turn:start", [selected(session), thread, "Steer 중단 확인"]) as { turnId: string };
    const selection = selected(session);
    const text = "  추가 지시\n";
    expect(await session.invoke("turn:steer", [selection, thread, turn.turnId, text, "steer-1"])).toEqual({ turnId: turn.turnId });
    await expect(session.invoke("turn:steer", [selection, thread, turn.turnId, text, "steer-1"])).rejects.toThrow();
    await expect(session.invoke("turn:steer", [selection, thread, "wrong", text, "steer-2"])).rejects.toThrow();
    await expect(session.invoke("turn:steer", [selection, thread, turn.turnId, "mismatch", "steer-3"])).rejects.toThrow();
    await expect(session.invoke("turn:steer", [selection, thread, turn.turnId, "종료 경합", "steer-4"])).rejects.toThrow();
    await until(() => !session.summary().busy);
    const events = s.events.filter(event => event.method.startsWith("turn/steer"));
    expect(events.some(event => event.method === "turn/steerAccepted" && (event.params as { text?: string }).text === text)).toBe(true);
    expect(events.some(event => event.method === "turn/steerUncertain" && (event.params as { clientUserMessageId?: string }).clientUserMessageId === "steer-3")).toBe(true);
    const calls = (await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
    const requests = calls.filter(call => call.method === "turn/steer");
    expect(requests).toHaveLength(3);
    expect(requests[0].params).toEqual({ threadId: thread, expectedTurnId: turn.turnId, clientUserMessageId: "steer-1", input: [{ type: "text", text, text_elements: [] }] });
    expect(calls.filter(call => call.method === "turn/start")).toHaveLength(1);
  } finally { await s.close(); }
});

test("Steer 대기·승인·중단·연결 종료와 다른 세션은 자동 재전송 없이 차단한다", async () => {
  const s = await setup();
  try {
    const a = s.add("steer-a", s.first);
    const b = s.add("steer-b", s.second);
    const [thread, other] = await Promise.all([start(a), start(b)]);
    const turn = await a.invoke("turn:start", [selected(a), thread, "Steer 중단 확인"]) as { turnId: string };
    const selection = selected(a);
    await expect(a.invoke("turn:steer", [selected(b), thread, turn.turnId, "다른 탭", "bad-tab"])).rejects.toThrow();
    await expect(a.invoke("turn:steer", [{ ...selection, selectionEpoch: selection.selectionEpoch + 1 }, thread, turn.turnId, "이전 선택", "bad-selection"])).rejects.toThrow();
    const waiting = a.invoke("turn:steer", [selection, thread, turn.turnId, "대기 추가 지시", "pending-id"]);
    await until(() => s.events.some(event => event.method === "turn/steerPending"));
    await expect(a.invoke("turn:steer", [selection, thread, turn.turnId, "중복", "pending-id"])).rejects.toThrow();
    await expect(a.invoke("turn:steer", [selection, thread, turn.turnId, "연속", "next-id"])).rejects.toThrow();
    await writeFile(join(s.first, "fixture-steer-release"), "");
    await expect(waiting).resolves.toEqual({ turnId: turn.turnId });
    await expect(a.invoke("turn:steer", [selection, thread, turn.turnId, "연결 종료 추가 지시", "closed-id"])).rejects.toThrow();
    expect(s.events.some(event => event.method === "turn/steerUncertain" && (event.params as { clientUserMessageId?: string }).clientUserMessageId === "closed-id")).toBe(true);
    const bTurn = await b.invoke("turn:start", [selected(b), other, "승인 확인"]) as { turnId: string };
    await until(() => b.summary().approvalCount === 1);
    await expect(b.invoke("turn:steer", [selected(b), other, bTurn.turnId, "승인 중", "approval-id"])).rejects.toThrow();
    await b.invoke("turn:interrupt", [selected(b), other, bTurn.turnId]);
    const calls = (await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
    expect(calls.filter(call => call.method === "turn/steer")).toHaveLength(2);
  } finally { await s.close(); }
});

test("승인 해소 후에도 중단된 턴의 종료 확인 전에는 Steer를 보내지 않는다", async () => {
  const s = await setup();
  try {
    const session = s.add("interrupt", s.first);
    const thread = await start(session);
    const turn = await session.invoke("turn:start", [selected(session), thread, "경계 승인 해소 대기"]) as { turnId: string };
    await until(() => session.summary().approvalCount === 1);
    await session.invoke("turn:interrupt", [selected(session), thread, turn.turnId]);
    await until(() => session.summary().approvalCount === 0);
    await expect(session.invoke("turn:steer", [selected(session), thread, turn.turnId, "중단 경합", "interrupt-id"])).rejects.toThrow("중단");
    await writeFile(join(s.first, "fixture-resolved-release"), "");
    await until(() => !session.summary().busy);
    const calls = await readFile(join(s.first, "fixture-calls.jsonl"), "utf8");
    expect(calls).not.toContain('"method":"turn/steer"');
  } finally { await s.close(); }
});

const STAGE_WORK_ID = "work-36d312bc-a767-4e3e-a581-01898b35f75f";
async function writeStageWork(root: string, folder = "one", id = STAGE_WORK_ID): Promise<void> {
  const path = join(root, "docs/work/Chat", folder);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "work.json"), JSON.stringify({ schemaVersion: 2, id, title: "단계 관측", status: "in_progress", blockedReason: null, areas: ["ui"], owner: "ui", criteria: [{ id: "STAGE", description: "관측", required: true, result: "unverified" }] }));
}

test("실제 stdio 단계 도구의 역할 선언만 수용하며 문서·UUID·턴·중복·종료 경계를 지킨다", async () => {
  const s = await setup({ stageProbe: true });
  try {
    await writeStageWork(s.first);
    const a = s.add("stage-a", s.first);
    const id = await start(a);
    await a.invoke("turn:start", [selected(a), id, "단계 관측 정상"]);
    await until(() => s.events.filter(event => event.method === "fixture/stageResponse").length === 10);
    await until(() => !a.summary().busy);
    const declarations = s.events.filter(event => event.method === "www/developmentStage");
    expect(declarations.map(event => (event.params as { status: string }).status)).toEqual(["selected", "running", "completed"]);
    expect(declarations.every(event => event.sessionId === a.id && (event.params as { source: string; workId: string }).source === "role_declaration" && (event.params as { workId: string }).workId === STAGE_WORK_ID)).toBe(true);
    expect(s.events.filter(event => event.method === "fixture/stageResponse").map(event => (event.params as { success: boolean }).success)).toEqual([true, true, true, true, false, false, false, false, false, false]);
    expect(s.events.some(event => event.kind === "request" && event.method === "item/tool/call")).toBe(false);
    expect(JSON.stringify(declarations)).not.toContain("PRIVATE_REASONING");
    expect((s.events.find(event => event.method === "thread/configured")?.params as { developmentStage: string }).developmentStage).toBe("available");
  } finally { await s.close(); }
});

test("다른 프로젝트·중복 UUID·복원 대화는 단계 생산자로 연결하지 않는다", async () => {
  const s = await setup({ stageProbe: true });
  try {
    await Promise.all([writeStageWork(s.first), writeStageWork(s.first, "duplicate"), writeStageWork(s.second)]);
    const a = s.add("duplicate", s.first);
    const b = s.add("other", s.second);
    const [ta, tb] = await Promise.all([start(a), start(b)]);
    await Promise.all([a.invoke("turn:start", [selected(a), ta, "단계 관측 정상"]), b.invoke("turn:start", [selected(b), tb, "단계 관측 정상"])]);
    await until(() => s.events.filter(event => event.method === "fixture/stageResponse").length === 20);
    await until(() => !a.summary().busy && !b.summary().busy);
    expect(s.events.filter(event => event.method === "www/developmentStage")).toHaveLength(0);
    expect((s.events.find(event => event.sessionId === b.id && event.method === "thread/configured")?.params as { developmentStage: string }).developmentStage).toBe("other_workspace");
    await rm(join(s.first, "docs/work/Chat/duplicate"), { recursive: true });
    await a.invoke("conversations:open", [selected(a), ta]);
    const reopened = await a.invoke("events:get", [selected(a)]) as ScopedAppEvent[];
    expect((reopened.find(event => event.method === "thread/configured")?.params as { developmentStage: string }).developmentStage).toBe("resume_unavailable");
    await a.invoke("turn:start", [selected(a), ta, "단계 관측 정상"]);
    await until(() => s.events.filter(event => event.method === "fixture/stageResponse").length === 30);
    expect(s.events.filter(event => event.method === "www/developmentStage")).toHaveLength(0);
  } finally { await s.close(); }
});

test("턴 종료 뒤 늦은 단계 요청은 실제 stdio에서도 현재 역할 선언으로 채택하지 않는다", async () => {
  const s = await setup({ stageProbe: true });
  try {
    await writeStageWork(s.first);
    const a = s.add("late-stage", s.first);
    const threadId = await start(a);
    await a.invoke("turn:start", [selected(a), threadId, "단계 관측 종료지연"]);
    await until(() => s.events.some(event => event.method === "fixture/stageResponse"));
    expect(s.events.some(event => event.method === "www/developmentStage")).toBe(false);
    expect((s.events.find(event => event.method === "fixture/stageResponse")?.params as { success: boolean }).success).toBe(false);
    expect(a.summary().busy).toBe(false);
  } finally { await s.close(); }
});
