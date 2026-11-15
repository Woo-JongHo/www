/**
 * @verifies RESP-NATIVE-RESOURCES
 */
import { expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createActivityLedger } from "../src/activity-ledger";
import type { ActivityLedger, ActivityLedgerIO } from "../src/activity-ledger";
import type { ResourceScope, ResourceObservationInput, ResourceSnapshot } from "../src/shared";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deferred() {
  let release: () => void = () => { throw new Error("초기화 전 해제"); };
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

function item(id = "item-1", status: ResourceObservationInput["status"] = "running"): ResourceObservationInput {
  return { source: { kind: "item", itemId: id, turnId: "turn-1" }, resource: { kind: "skill", identity: "www-build", label: "구현" }, action: "invoke", status };
}

function hook(turnId: string | null, status: ResourceObservationInput["status"] = "running"): ResourceObservationInput {
  return { source: { kind: "hook", hookRunId: "run-1", turnId, providerRunNamespace: "fixture-provider/session-verified-1" }, resource: { kind: "hook", identity: "pre-tool", label: "도구 전" }, action: "invoke", status };
}

async function fixture(run: (context: { userData: string; workspace: string; store: ActivityLedger; scope: ResourceScope; file: string; io: ActivityLedgerIO; open: () => ActivityLedger }) => Promise<void>) {
  const base = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "www-ledger-")));
  const stores: ActivityLedger[] = [];
  try {
    const userData = join(base, "data");
    const workspace = join(base, "workspace");
    await fs.mkdir(userData);
    await fs.mkdir(workspace);
    const io: ActivityLedgerIO = {};
    const open = () => {
      const result = createActivityLedger({ userData, processEpoch: randomUUID(), io });
      stores.push(result);
      return result;
    };
    const store = open();
    const scope = await store.scope(workspace, "thread-1");
    const file = join(userData, "activity-v1", scope.workspaceKey, `${digest(scope.threadId)}.json`);
    await store.select(scope, 1);
    await run({ userData, workspace, store, scope, file, io, open });
  } finally {
    for (const store of stores) await store.close();
    await fs.rm(base, { recursive: true, force: true });
  }
}

async function rewrite(file: string, update: (record: Record<string, unknown>) => void) {
  const record: Record<string, unknown> = JSON.parse(await fs.readFile(file, "utf8"));
  update(record);
  delete record.checksum;
  record.checksum = digest(JSON.stringify(record));
  await fs.writeFile(file, JSON.stringify(record));
}

function coded(code: string): Error {
  return Object.assign(new Error(code), { code });
}

test("realpath 별칭은 합치고 다른 실제 workspace/worktree와 thread는 분리한다", async () => {
  await fixture(async ({ workspace, store, scope, userData }) => {
    const alias = `${workspace}-alias`;
    const worktree = `${workspace}-worktree`;
    await fs.symlink(workspace, alias, "dir");
    await fs.mkdir(worktree);
    expect(await store.scope(alias, "thread-1")).toEqual(scope);
    const other = await store.scope(worktree, "thread-1");
    expect(other.workspaceKey).not.toBe(scope.workspaceKey);
    expect(scope.workspaceKey).toBe(digest(await fs.realpath(workspace)));
    const thread = await store.scope(workspace, "thread-2");
    await store.select(thread, 2);
    await store.select(other, 3);
    await store.upsert(scope, item());
    expect(store.snapshot(thread).observations).toHaveLength(0);
    expect(store.snapshot(other).observations).toHaveLength(0);
    expect(await store.flush()).toEqual({ clean: true, failedScopes: [] });
    expect((await fs.readdir(join(userData, "activity-v1", scope.workspaceKey))).filter((name) => name.endsWith(".json"))).toHaveLength(2);
  });
});

test("scope 경로 주입과 root·workspace·최종 파일 symlink를 거부하고 외부 bytes를 보전한다", async () => {
  await fixture(async ({ store, scope, userData, file, open }) => {
    await expect(store.select({ ...scope, workspaceKey: "../../outside" }, 1)).rejects.toThrow();
    await store.close();
    const outside = join(userData, "outside");
    await fs.writeFile(outside, "외부 원본");
    await fs.unlink(file);
    await fs.symlink(outside, file);
    const blocked = open();
    const snap = await blocked.select(scope, 2);
    expect(snap.coverage.gaps).toContain("read-failed");
    await blocked.upsert(scope, item());
    expect(await blocked.flush()).toEqual({ clean: false, failedScopes: [scope] });
    expect(await fs.readFile(outside, "utf8")).toBe("외부 원본");
    await blocked.close();
    await fs.unlink(file);
    const directory = join(userData, "activity-v1", scope.workspaceKey);
    await fs.rmdir(directory);
    await fs.mkdir(join(userData, "elsewhere"));
    await fs.symlink(join(userData, "elsewhere"), directory);
    const workspaceBlocked = open();
    expect((await workspaceBlocked.select(scope, 3)).coverage.gaps).toContain("read-failed");
    await workspaceBlocked.close();
    await fs.unlink(directory);
    await fs.rmdir(join(userData, "activity-v1"));
    await fs.symlink(join(userData, "elsewhere"), join(userData, "activity-v1"));
    expect((await open().select(scope, 4)).coverage.gaps).toContain("read-failed");
    expect(await fs.readdir(join(userData, "elsewhere"))).toEqual([]);
  });
});

test("안정 ID는 고정 tuple이고 시작·완료·중복·역순 및 optional invocation은 같은 관측이다", async () => {
  await fixture(async ({ store, scope }) => {
    const start = await store.upsert(scope, item());
    const expected = digest(JSON.stringify([1, scope.workspaceKey, scope.threadId, "turn-1", "item", "item-1", "skill", "www-build", "invoke"]));
    expect(start.observations[0]?.id).toBe(expected);
    const complete = item("item-1", "completed");
    if (complete.source.kind !== "item") throw new Error("fixture 오류");
    complete.source.nativeInvocationId = "optional-1";
    await store.upsert(scope, complete);
    await store.upsert(scope, complete);
    const late = await store.upsert(scope, item());
    expect(late.observations).toHaveLength(1);
    expect(late.observations[0]?.status).toBe("completed");
    expect(late.observations[0]?.id).toBe(expected);
    expect(await store.flush()).toEqual({ clean: true, failedScopes: [] });
    expect(store.snapshot(scope).durableRevision).toBe(late.revision);
  });
});

test("Hook의 선택 turn은 키에서 제외하고 뒤늦은 귀속·상충 귀속과 terminal 충돌은 지속된다", async () => {
  await fixture(async ({ store, scope, open }) => {
    const first = await store.upsert(scope, hook(null));
    expect(first.observations[0]?.id).toBe(digest(JSON.stringify([1, scope.workspaceKey, scope.threadId, "hook", "fixture-provider/session-verified-1", "run-1", "pre-tool", "invoke"])));
    const attributed = await store.upsert(scope, hook("turn-1", "completed"));
    expect(attributed.observations[0]?.source.turnId).toBe("turn-1");
    await store.upsert(scope, hook("turn-2", "failed"));
    const conflict = await store.upsert(scope, hook("turn-1", "completed"));
    expect(conflict.observations).toHaveLength(1);
    expect(conflict.observations[0]).toMatchObject({ status: "unknown", source: { turnId: null }, conflicts: { turn: true, terminal: true } });
    expect(await store.close()).toEqual({ clean: true });
    const restored = await open().select(scope, 7);
    expect(restored.observations[0]).toEqual(conflict.observations[0]);
  });
});

test("namespace·turn·kind·identity·action 차이를 이름 유사성으로 합치지 않는다", async () => {
  await fixture(async ({ store, scope }) => {
    await store.upsert(scope, hook(null));
    const separate = hook(null);
    if (separate.source.kind !== "hook") throw new Error("fixture 오류");
    separate.source.providerRunNamespace = "verified-other-provider";
    await store.upsert(scope, separate);
    await store.upsert(scope, item());
    await store.upsert(scope, { ...item(), action: "read" });
    await store.upsert(scope, { ...item(), resource: { kind: "document", identity: "www-build", label: "구현" } });
    await store.upsert(scope, { ...item(), source: { kind: "item", turnId: "turn-2", itemId: "item-1" } });
    expect(store.snapshot(scope).observations).toHaveLength(6);
  });
});

test("안정 식별 부족은 새 건수를 만들지 않고 명시 누락으로 남긴다", async () => {
  await fixture(async ({ store, scope }) => {
    const invalid = hook(null);
    if (invalid.source.kind !== "hook") throw new Error("fixture 오류");
    invalid.source.providerRunNamespace = "";
    await store.upsert(scope, invalid);
    await store.upsert(scope, { ...item(), source: { kind: "item", itemId: "", turnId: "turn-1" } });
    store.gap(scope, "native-missing");
    const result = store.snapshot(scope);
    expect(result.observations).toHaveLength(0);
    expect(result.coverage.gaps).toEqual(["unstable-id", "native-missing"]);
    expect(result.coverage.completeness).toBe("partial");
    expect(await store.flush()).toEqual({ clean: true, failedScopes: [] });
  });
});

test("초기 load 중 upsert는 복원과 dirty 시도 뒤까지 비공개로 대기한다", async () => {
  await fixture(async ({ store, scope, io, open }) => {
    await store.upsert(scope, item("saved", "completed"));
    await store.close();
    const entered = deferred();
    const gate = deferred();
    io.beforeRead = async () => { entered.release(); await gate.promise; };
    const next = open();
    const loading = next.select(scope, 9);
    await entered.promise;
    const input = item("new", "running");
    const live = next.upsert(scope, input);
    input.resource.identity = "호출 뒤 변조";
    let admitted = false;
    void live.then(() => { admitted = true; });
    await Promise.resolve();
    expect(admitted).toBe(false);
    expect(next.snapshot(scope).observations).toEqual([]);
    gate.release();
    await loading;
    const combined = await live;
    expect(combined.observations.find((row) => row.source.kind === "item" && row.source.itemId === "new")?.resource.identity).toBe("www-build");
    delete io.beforeRead;
    expect(combined.observations.map((row) => row.source.kind === "item" ? row.source.itemId : "hook").sort()).toEqual(["new", "saved"]);
    expect(combined.selectionEpoch).toBe(9);
    expect(await next.flush()).toEqual({ clean: true, failedScopes: [] });
    expect(next.snapshot(scope).durableRevision).toBe(next.snapshot(scope).revision);
  });
});

test("저장 중 추가 관측은 이전 rename 완료로 saved가 되지 않으며 알림 사본은 격리된다", async () => {
  await fixture(async ({ store, scope, io }) => {
    const entered = deferred();
    const gate = deferred();
    let blocked = true;
    io.beforeRename = async () => { if (blocked) { blocked = false; entered.release(); await gate.promise; } };
    const first = await store.upsert(scope, item("a"));
    const flushing = store.flush();
    await entered.promise;
    const second = await store.upsert(scope, item("b"));
    expect(second.revision).toBeGreaterThan(first.revision);
    expect(second.durableRevision).toBeLessThan(second.revision);
    second.observations.splice(0);
    expect(store.snapshot(scope).observations).toHaveLength(2);
    gate.release();
    expect(await flushing).toEqual({ clean: true, failedScopes: [] });
    expect(store.snapshot(scope).durableRevision).toBe(store.snapshot(scope).revision);
    delete io.beforeRename;
  });
});

test("전체 store 큐는 서로 다른 scope의 rename을 직렬화한다", async () => {
  await fixture(async ({ store, scope, workspace, io }) => {
    const second = await store.scope(workspace, "thread-2");
    await store.select(second, 2);
    const entered = deferred();
    const gate = deferred();
    let active = 0;
    let maxActive = 0;
    let first = true;
    io.beforeRename = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      if (first) { first = false; entered.release(); await gate.promise; }
      active--;
    };
    await store.upsert(scope, item());
    await store.upsert(second, item());
    const flushing = store.flush();
    await entered.promise;
    gate.release();
    expect(await flushing).toEqual({ clean: true, failedScopes: [] });
    expect(maxActive).toBe(1);
    delete io.beforeRename;
  });
});

test("전체 flush는 선택과 무관하게 실제 실패 thread만 사본으로 반환하고 복구 시 원장과 관측을 보전한다", async () => {
  await fixture(async ({ store, scope, workspace, file, io }) => {
    const second = await store.scope(workspace, "thread-2");
    const third = await store.scope(workspace, "thread-3");
    await store.select(second, 2);
    await store.select(third, 3);
    const scopes = [scope, second, third];
    const files = scopes.map((current) => join(file, "..", `${digest(current.threadId)}.json`));
    for (const current of scopes) await store.upsert(current, item("old", "completed"));
    expect(await store.flush()).toEqual({ clean: true, failedScopes: [] });
    const originalObservations = scopes.map((current) => store.snapshot(current).observations);
    const original = await fs.readFile(file, "utf8");
    const durable = store.snapshot(scope).durableRevision;
    const failing = new Set([file]);
    io.beforeRename = async (_temporary, destination) => {
      if (failing.has(destination)) throw coded("EACCES");
    };
    try {
      for (const current of scopes) await store.upsert(current, item("new", "completed"));
      await store.select(second, 4);
      const failed = await store.flush();
      expect(failed).toEqual({ clean: false, failedScopes: [scope] });
      expect(await fs.readFile(file, "utf8")).toBe(original);
      expect(store.snapshot(scope).durableRevision).toBe(durable);
      expect(store.snapshot(scope).observations).toHaveLength(2);
      for (const current of [second, third]) {
        expect(store.snapshot(current).coverage.gaps).not.toContain("write-failed");
        expect(store.snapshot(current).durableRevision).toBe(store.snapshot(current).revision);
      }
      const failedScope = failed.failedScopes[0]!;
      failedScope.workspaceKey = "f".repeat(64);
      failedScope.threadId = "caller-mutated";
      failed.failedScopes.splice(0, 1, { ...third });
      failed.clean = true;
      await store.select(third, 5);
      expect(await store.flush()).toEqual({ clean: false, failedScopes: [scope] });
      expect(store.snapshot(scope).scope).toEqual(scope);
      expect(await fs.readFile(file, "utf8")).toBe(original);

      const secondFile = files[1]!;
      const secondOriginal = await fs.readFile(secondFile, "utf8");
      const secondDurable = store.snapshot(second).durableRevision;
      failing.add(secondFile);
      await store.upsert(second, item("newest", "completed"));
      expect(await store.flush()).toEqual({ clean: false, failedScopes: [scope, second] });
      expect(scope.workspaceKey).toBe(second.workspaceKey);
      expect(await fs.readFile(file, "utf8")).toBe(original);
      expect(await fs.readFile(secondFile, "utf8")).toBe(secondOriginal);
      expect(store.snapshot(second).durableRevision).toBe(secondDurable);
      failing.delete(file);
      expect(await store.flush()).toEqual({ clean: false, failedScopes: [second] });
      failing.clear();
      expect(await store.flush()).toEqual({ clean: true, failedScopes: [] });
      for (const [index, current] of scopes.entries()) {
        const saved = JSON.parse(await fs.readFile(files[index]!, "utf8"));
        const live = store.snapshot(current);
        expect(saved.scope).toEqual(current);
        expect(saved.observations).toEqual(live.observations);
        expect(live.observations).toHaveLength(index === 1 ? 3 : 2);
        expect(live.observations.slice(0, 1)).toEqual(originalObservations[index]);
        expect(live.durableRevision).toBe(live.revision);
        expect(saved.revision).toBe(live.revision);
      }
    } finally { delete io.beforeRename; }
  });
});

test("실제 새 store 복원은 running을 현재 실행으로 재생하지 않고 dirty 종료를 밝힌다", async () => {
  await fixture(async ({ store, scope, open, file }) => {
    await store.upsert(scope, item());
    expect(await store.flush()).toEqual({ clean: true, failedScopes: [] });
    expect(JSON.parse(await fs.readFile(file, "utf8")).dirty).toBe(true);
    // kill을 모사해 기존 store의 close 전에 새 소유자 생성. 실제 Native/userData는 사용하지 않는다.
    const next = open();
    const restored = await next.select(scope, 8);
    expect(restored.observations[0]?.status).toBe("unknown");
    expect(restored.coverage.gaps).toContain("unclean-exit");
    expect(restored.coverage.completeness).toBe("partial");
    expect(restored.processEpoch).not.toBe(store.snapshot(scope).processEpoch);
  });
});

test("정상 종료는 수집을 먼저 멈추고 실제 clean 파일과 후속 복원을 확인한다", async () => {
  await fixture(async ({ store, scope, open, file }) => {
    await store.upsert(scope, item("finished", "completed"));
    const closing = store.close();
    await expect(store.upsert(scope, item("late"))).rejects.toThrow("수집 종료");
    expect(await closing).toEqual({ clean: true });
    expect(JSON.parse(await fs.readFile(file, "utf8")).dirty).toBe(false);
    const restored = await open().select(scope, 1);
    expect(restored.observations).toHaveLength(1);
    expect(restored.coverage.gaps).not.toContain("unclean-exit");
  });
});

test("2초 종료 timeout과 늦은 완료는 clean 성공이나 clean 파일로 승격되지 않는다", async () => {
  await fixture(async ({ store, scope, io, file }) => {
    await store.upsert(scope, item());
    await store.flush();
    const entered = deferred();
    const gate = deferred();
    io.beforeRename = async () => { entered.release(); await gate.promise; };
    await store.upsert(scope, item("second"));
    const started = Date.now();
    const closing = store.close();
    await entered.promise;
    expect(await closing).toEqual({ clean: false });
    expect(Date.now() - started).toBeLessThan(2600);
    expect(JSON.parse(await fs.readFile(file, "utf8")).dirty).toBe(true);
    delete io.beforeRename;
    gate.release();
    await store.flush();
    expect(JSON.parse(await fs.readFile(file, "utf8")).dirty).toBe(true);
    expect(store.snapshot(scope).coverage.gaps).toContain("unclean-exit");
  });
}, 6000);

for (const code of ["EACCES", "ENOSPC", "EPERM"]) {
  test(`${code}와 rename 실패는 이전 파일·live 메모리·마지막 durableRevision을 보전한다`, async () => {
    await fixture(async ({ store, scope, io, file }) => {
      await store.upsert(scope, item("old", "completed"));
      await store.flush();
      const bytes = await fs.readFile(file, "utf8");
      const durable = store.snapshot(scope).durableRevision;
      io.beforeRename = async () => { throw coded(code); };
      await store.upsert(scope, item("new"));
      expect(await store.flush()).toEqual({ clean: false, failedScopes: [scope] });
      expect(await fs.readFile(file, "utf8")).toBe(bytes);
      const failed = store.snapshot(scope);
      expect(failed.observations).toHaveLength(2);
      expect(failed.storage).toBe("volatile");
      expect(failed.coverage.gaps).toContain("write-failed");
      expect(failed.durableRevision).toBe(durable);
      delete io.beforeRename;
      expect(await store.flush()).toEqual({ clean: true, failedScopes: [] });
      expect(store.snapshot(scope).durableRevision).toBe(store.snapshot(scope).revision);
    });
  });
}

test("쓰기·읽기 권한 실패에도 live는 유지하고 읽을 수 없는 기존 파일을 덮지 않는다", async () => {
  await fixture(async ({ store, scope, io, file, open }) => {
    await store.upsert(scope, item("old"));
    await store.close();
    const bytes = await fs.readFile(file, "utf8");
    io.beforeRead = async () => { throw coded("EACCES"); };
    const next = open();
    expect((await next.select(scope, 2)).storage).toBe("unavailable");
    await next.upsert(scope, item("live"));
    expect(await next.flush()).toEqual({ clean: false, failedScopes: [scope] });
    expect(next.snapshot(scope).observations).toHaveLength(1);
    expect(await fs.readFile(file, "utf8")).toBe(bytes);
    delete io.beforeRead;
    expect(next.snapshot(scope).durableRevision).toBe(0);
  });
});

test("임시 쓰기 전 ENOSPC는 이전 파일을 유지하고 관측은 volatile로 남긴다", async () => {
  await fixture(async ({ store, scope, io, file }) => {
    const before = await fs.readFile(file, "utf8");
    io.beforeWrite = async () => { throw coded("ENOSPC"); };
    await store.upsert(scope, item());
    expect(await store.flush()).toEqual({ clean: false, failedScopes: [scope] });
    expect(store.snapshot(scope)).toMatchObject({ storage: "volatile", durableRevision: 0 });
    expect(store.snapshot(scope).observations).toHaveLength(1);
    expect(await fs.readFile(file, "utf8")).toBe(before);
    delete io.beforeWrite;
  });
});

for (const failure of ["json", "checksum", "scope", "version", "privacy"]) {
  test(`${failure} 손상은 원본 bytes를 격리 보전하고 신규 live로 조용히 초기화하지 않는다`, async () => {
    await fixture(async ({ store, scope, file, open }) => {
      await store.close();
      if (failure === "json") await fs.writeFile(file, "{broken");
      else if (failure === "checksum") {
        const record = JSON.parse(await fs.readFile(file, "utf8"));
        record.checksum = "00";
        await fs.writeFile(file, JSON.stringify(record));
      } else await rewrite(file, (record) => {
        if (failure === "scope") record.scope = { ...scope, threadId: "other" };
        if (failure === "version") record.schemaVersion = 900;
        if (failure === "privacy") record.rawParams = "PRIVATE";
      });
      const bytes = await fs.readFile(file, "utf8");
      const next = open();
      const result = await next.select(scope, 2);
      expect(result.coverage.gaps).toContain(failure === "version" ? "unsupported-version" : "corrupt");
      await next.upsert(scope, item("live"));
      expect(await next.flush()).toEqual({ clean: false, failedScopes: [scope] });
      expect(next.snapshot(scope).observations).toHaveLength(1);
      const dir = join(file, "..");
      const quarantines = (await fs.readdir(dir)).filter((name) => name.endsWith(".quarantine"));
      expect(quarantines).toHaveLength(1);
      expect(await fs.readFile(join(dir, quarantines[0]!), "utf8")).toBe(bytes);
      await next.close();
      const again = await open().select(scope, 3);
      expect(again.storage).toBe("corrupt");
      expect(again.coverage.gaps).toContain(failure === "version" ? "unsupported-version" : "corrupt");
    });
  });
}

test("시각이 새 임시 파일도 복원판으로 채택하지 않는다", async () => {
  await fixture(async ({ store, scope, file, open }) => {
    await store.upsert(scope, item("actual", "completed"));
    await store.close();
    await fs.writeFile(`${file}.newer.tmp`, "newer invalid data");
    const result = await open().select(scope, 2);
    expect(result.observations[0]?.source).toMatchObject({ itemId: "actual" });
    expect(await fs.readFile(`${file}.newer.tmp`, "utf8")).toBe("newer invalid data");
  });
});

async function seed(file: string, scope: ResourceScope, count: number, identity: string) {
  await rewrite(file, (record) => {
    record.revision = 50;
    record.dirty = false;
    record.observations = Array.from({ length: count }, (_, index) => {
      const input = item(`seed-${index}`, "observed");
      input.resource.identity = identity;
      const id = digest(JSON.stringify([1, scope.workspaceKey, scope.threadId, "turn-1", "item", `seed-${index}`, "skill", identity, "invoke"]));
      return { ...input, id };
    });
  });
}

test("실제 10,000건 한도에서 새 ID를 멈추고 기존 ID 완료는 유지·저장한다", async () => {
  await fixture(async ({ store, scope, file, open, io }) => {
    await store.close();
    await seed(file, scope, 10_000, "s");
    const next = open();
    const entered = deferred();
    const gate = deferred();
    io.beforeRead = async () => { entered.release(); await gate.promise; };
    const loading = next.select(scope, 2);
    await entered.promise;
    const overflowing = next.upsert(scope, item("overflow"));
    const existing = item("seed-0", "completed");
    existing.resource.identity = "s";
    const updating = next.upsert(scope, existing);
    expect(next.snapshot(scope).observations).toEqual([]);
    gate.release();
    const loaded = await loading;
    delete io.beforeRead;
    const full = await overflowing;
    const updated = await updating;
    expect(loaded.observations).toHaveLength(10_000);
    expect(full.storage).toBe("full");
    expect(full.observations.map((row) => row.id).sort()).toEqual(loaded.observations.map((row) => row.id).sort());
    expect(updated.observations.map((row) => row.id).sort()).toEqual(loaded.observations.map((row) => row.id).sort());
    expect(updated.observations.find((row) => row.source.kind === "item" && row.source.itemId === "seed-0")?.status).toBe("completed");
    expect(await next.flush()).toEqual({ clean: true, failedScopes: [] });
    const saved = JSON.parse(await fs.readFile(file, "utf8"));
    expect(saved.observations).toEqual(updated.observations);
    expect(next.snapshot(scope).durableRevision).toBe(saved.revision);
  });
}, 15000);

test("실제 4MiB 상한과 8KiB 헤더 예약은 기존 관측을 버리지 않는다", async () => {
  await fixture(async ({ store, scope, file, open }) => {
    await store.close();
    // 실제 제한 관측의 JSON 크기로 4MiB-8KiB 바로 아래까지 채운다.
    const identity = "x".repeat(2048);
    const sample = { ...item("seed-9999", "observed"), id: "0".repeat(64) };
    sample.resource.identity = identity;
    const count = Math.floor((4 * 1024 * 1024 - 8192 - 4096) / (Buffer.byteLength(JSON.stringify(sample)) + 1));
    await seed(file, scope, count, identity);
    const next = open();
    await next.select(scope, 2);
    let previous = next.snapshot(scope).observations.length;
    for (let index = 0; index < 12; index++) {
      const input = item(`extra-${index}`);
      input.resource.identity = identity;
      const result = await next.upsert(scope, input);
      expect(result.observations.length).toBeGreaterThanOrEqual(previous);
      previous = result.observations.length;
    }
    const result = next.snapshot(scope);
    expect(result.storage).toBe("full");
    expect(result.coverage.gaps).toContain("retention-limit");
    expect(result.observations.length).toBeGreaterThanOrEqual(count);
    expect(await next.flush()).toEqual({ clean: true, failedScopes: [] });
    expect((await fs.stat(file)).size).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
}, 15000);

test("전체 64MiB 한도는 다른 scope의 파일·격리·임시 bytes도 포함한다", async () => {
  await fixture(async ({ store, scope, userData, file, open }) => {
    await store.close();
    const otherDir = join(userData, "activity-v1", "a".repeat(64));
    await fs.mkdir(otherDir);
    const preserved = join(otherDir, "preserved.quarantine");
    const handle = await fs.open(preserved, "w");
    await handle.truncate(64 * 1024 * 1024 - (await fs.stat(file)).size - 65536 - 64);
    await handle.close();
    const next = open();
    await next.select(scope, 2);
    const full = await next.upsert(scope, item());
    expect(full.observations).toHaveLength(0);
    expect(full.storage).toBe("full");
    expect(full.coverage.gaps).toContain("retention-limit");
    expect((await fs.stat(preserved)).size).toBeGreaterThan(63 * 1024 * 1024);
    await fs.rm(preserved);
  });
});

test("privacy whitelist·label 256문자·identity UTF-8 2KiB와 파일 권한을 지킨다", async () => {
  await fixture(async ({ store, scope, file }) => {
    const input = { ...item(), rawParams: "PRIVATE_PARAMS", body: "PRIVATE_BODY", command: "PRIVATE_COMMAND", output: "PRIVATE_OUTPUT", diff: "PRIVATE_DIFF", reasoning: "PRIVATE_REASONING", catalog: ["PRIVATE_CATALOG"] };
    input.resource.label = "😀".repeat(300);
    input.resource.identity = "한".repeat(682) + "aa";
    const first = await store.upsert(scope, input);
    expect(Array.from(first.observations[0]!.resource.label)).toHaveLength(256);
    expect(Buffer.byteLength(first.observations[0]!.resource.identity)).toBe(2048);
    await store.upsert(scope, { ...item("too-long"), resource: { ...input.resource, identity: `${input.resource.identity}x` } });
    expect(store.snapshot(scope).observations).toHaveLength(1);
    expect(store.snapshot(scope).coverage.gaps).toContain("unstable-id");
    expect(await store.flush()).toEqual({ clean: true, failedScopes: [] });
    const raw = await fs.readFile(file, "utf8");
    expect(raw).not.toContain("PRIVATE_");
    expect(raw).not.toContain("processEpoch");
    expect(raw).not.toContain("selectionEpoch");
    expect(raw).not.toContain("durableRevision");
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["checksum", "coverage", "dirty", "observations", "revision", "schemaVersion", "scope"]);
    if (process.platform !== "win32") {
      expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
      expect((await fs.stat(join(file, ".."))).mode & 0o777).toBe(0o700);
    }
  });
});

test("snapshot callback은 메모리 반영·durable 완료를 분리하고 같은 revision 저장 상태를 전달한다", async () => {
  await fixture(async ({ userData, workspace, store }) => {
    await store.close();
    const snapshots: ResourceSnapshot[] = [];
    const next = createActivityLedger({ userData, processEpoch: randomUUID(), onSnapshot: (snapshot) => { snapshots.push(snapshot); } });
    try {
      const scope = await next.scope(workspace, "callback-thread");
      await next.select(scope, 3);
      await next.upsert(scope, item());
      const live = snapshots.at(-1)!;
      expect(live.revision).toBeGreaterThan(live.durableRevision);
      await next.flush();
      expect(snapshots.at(-1)).toMatchObject({ revision: live.revision, durableRevision: live.revision, storage: "saved" });
    } finally { await next.close(); }
  });
});

test("최초 dirty checkpoint 실패 후에도 live 파일보다 빈 dirty checkpoint를 먼저 재시도한다", async () => {
  await fixture(async ({ store, workspace, io, open }) => {
    await store.close();
    const checkpoints: { dirty: boolean; count: number }[] = [];
    let fail = true;
    io.beforeRename = async (temporary) => {
      const value = JSON.parse(await fs.readFile(temporary, "utf8"));
      checkpoints.push({ dirty: value.dirty, count: value.observations.length });
      if (fail) throw coded("EACCES");
    };
    const next = open();
    const scope = await next.scope(workspace, "new-checkpoint-thread");
    const selected = await next.select(scope, 2);
    expect(selected.storage).toBe("volatile");
    await next.upsert(scope, item());
    expect(next.snapshot(scope).observations).toHaveLength(1);
    fail = false;
    expect(await next.flush()).toEqual({ clean: true, failedScopes: [] });
    expect(checkpoints.slice(0, 3)).toEqual([{ dirty: true, count: 0 }, { dirty: true, count: 0 }, { dirty: true, count: 1 }]);
    delete io.beforeRename;
  });
});

test("clean 교체 직전 timeout도 늦은 clean rename을 허용하지 않는다", async () => {
  await fixture(async ({ store, scope, io, file }) => {
    await store.upsert(scope, item("finished", "completed"));
    await store.flush();
    const entered = deferred();
    const gate = deferred();
    io.beforeRename = async (temporary) => {
      const value = JSON.parse(await fs.readFile(temporary, "utf8"));
      if (value.dirty === false) { entered.release(); await gate.promise; }
    };
    const closing = store.close();
    await entered.promise;
    expect(await closing).toEqual({ clean: false });
    expect(JSON.parse(await fs.readFile(file, "utf8")).dirty).toBe(true);
    gate.release();
    delete io.beforeRename;
    await store.flush();
    expect(JSON.parse(await fs.readFile(file, "utf8")).dirty).toBe(true);
    expect(await store.close()).toEqual({ clean: false });
  });
}, 6000);


test("dirty checkpoint rename 시도가 끝나기 전에는 관측을 공개하지 않는다", async () => {
  await fixture(async ({ store, scope, io, open }) => {
    await store.close();
    const entered = deferred();
    const gate = deferred();
    io.beforeRename = async () => { entered.release(); await gate.promise; };
    const next = open();
    const selecting = next.select(scope, 2);
    await entered.promise;
    const pending = next.upsert(scope, item("waiting", "completed"));
    let admitted = false;
    void pending.then(() => { admitted = true; });
    await Promise.resolve();
    expect(admitted).toBe(false);
    expect(next.snapshot(scope).observations).toEqual([]);
    delete io.beforeRename;
    gate.release();
    await selecting;
    expect((await pending).observations).toHaveLength(1);
  });
});

test("기존 clean 원장의 첫 dirty 실패 뒤 live를 보전하고 재시도 dirty와 마지막 durable을 구분한다", async () => {
  await fixture(async ({ store, scope, file, io, open }) => {
    await store.upsert(scope, item("old", "completed"));
    await store.close();
    const original = JSON.parse(await fs.readFile(file, "utf8"));
    let phase = "initial";
    const attempts: { dirty: boolean; ids: string[]; revision: number }[] = [];
    io.beforeRename = async (temporary) => {
      const record = JSON.parse(await fs.readFile(temporary, "utf8"));
      attempts.push({ dirty: record.dirty, ids: record.observations.map((row: { id: string }) => row.id), revision: record.revision });
      if (phase === "initial" || (phase === "checkpoint-only" && record.observations.length > 1)) throw coded("EACCES");
    };
    const next = open();
    const selected = await next.select(scope, 2);
    expect(selected).toMatchObject({ storage: "volatile", durableRevision: original.revision });
    const live = await next.upsert(scope, item("live", "completed"));
    expect(live.observations).toHaveLength(2);
    expect(live.storage).toBe("volatile");
    expect(live.coverage.gaps).toContain("write-failed");
    expect(JSON.parse(await fs.readFile(file, "utf8"))).toEqual(original);
    phase = "checkpoint-only";
    expect(await next.flush()).toEqual({ clean: false, failedScopes: [scope] });
    const checkpoint = JSON.parse(await fs.readFile(file, "utf8"));
    expect(checkpoint.dirty).toBe(true);
    expect(checkpoint.observations).toEqual(original.observations);
    expect(next.snapshot(scope).durableRevision).toBe(checkpoint.revision);
    expect(next.snapshot(scope).observations).toEqual(live.observations);
    expect(attempts.slice(0, 3).map((attempt) => [attempt.dirty, attempt.ids.length])).toEqual([[true, 1], [true, 1], [true, 2]]);
    phase = "success";
    expect(await next.flush()).toEqual({ clean: true, failedScopes: [] });
    const saved = JSON.parse(await fs.readFile(file, "utf8"));
    expect(saved.dirty).toBe(true);
    expect(saved.observations).toEqual(live.observations);
    expect(next.snapshot(scope).durableRevision).toBe(saved.revision);
    delete io.beforeRename;
  });
});

test("여러 scope의 부분 clean과 복구 쓰기 실패가 이미 확정한 최신 ID·본문·durable을 되돌리지 않는다", async () => {
  await fixture(async ({ store, scope, workspace, file, io }) => {
    const second = await store.scope(workspace, "thread-2");
    await store.select(second, 2);
    await store.upsert(scope, item("a-old", "completed"));
    await store.flush();
    await store.upsert(scope, item("a-new", "completed"));
    await store.upsert(second, item("b-new", "completed"));
    await store.flush();
    const secondFile = join(file, "..", `${digest(second.threadId)}.json`);
    const beforeA = JSON.parse(await fs.readFile(file, "utf8"));
    const beforeB = JSON.parse(await fs.readFile(secondFile, "utf8"));
    let recovering = false;
    const recoveryA: string[][] = [];
    io.beforeRename = async (temporary, destination) => {
      const record = JSON.parse(await fs.readFile(temporary, "utf8"));
      if (!record.dirty && destination === secondFile) { recovering = true; throw coded("EIO"); }
      if (recovering && record.dirty) {
        if (destination === file) {
          recoveryA.push(record.observations.map((row: { id: string }) => row.id));
          // 오래된 초기 checkpoint만 성공시키는 과거 결함의 실패 조합이다.
          if (record.observations.length === 0) return;
        }
        throw coded("ENOSPC");
      }
    };
    expect(await store.close()).toEqual({ clean: false });
    const afterA = JSON.parse(await fs.readFile(file, "utf8"));
    const afterB = JSON.parse(await fs.readFile(secondFile, "utf8"));
    expect(afterA).toEqual({ ...beforeA, dirty: false, checksum: expect.any(String) });
    expect(afterB).toEqual(beforeB);
    expect(recoveryA).toEqual([beforeA.observations.map((row: { id: string }) => row.id)]);
    expect(store.snapshot(scope).observations).toEqual(afterA.observations);
    expect(store.snapshot(second).observations).toEqual(afterB.observations);
    expect(store.snapshot(scope).durableRevision).toBe(afterA.revision);
    expect(store.snapshot(second).durableRevision).toBe(afterB.revision);
    expect(store.snapshot(scope).storage).toBe("volatile");
    delete io.beforeRename;
  });
});

test("close는 지연 load 중 이미 접수한 관측을 순서대로 drain하고 새 접수를 거부한다", async () => {
  await fixture(async ({ store, scope, file, io, open }) => {
    await store.upsert(scope, item("saved", "completed"));
    await store.close();
    const entered = deferred();
    const gate = deferred();
    io.beforeRead = async () => { entered.release(); await gate.promise; };
    const next = open();
    const selecting = next.select(scope, 2);
    await entered.promise;
    const first = next.upsert(scope, item("pending", "running"));
    const second = next.upsert(scope, item("pending", "completed"));
    const third = next.upsert(scope, item("third", "completed"));
    const closing = next.close();
    await expect(next.upsert(scope, item("late"))).rejects.toThrow("수집 종료");
    expect(next.snapshot(scope).observations).toEqual([]);
    delete io.beforeRead;
    gate.release();
    await selecting;
    expect((await first).observations.find((row) => row.source.kind === "item" && row.source.itemId === "pending")?.status).toBe("running");
    expect((await second).observations.find((row) => row.source.kind === "item" && row.source.itemId === "pending")?.status).toBe("completed");
    const accepted = await third;
    expect(await closing).toEqual({ clean: true });
    const saved = JSON.parse(await fs.readFile(file, "utf8"));
    expect(saved.dirty).toBe(false);
    expect(saved.observations).toEqual(accepted.observations);
    expect(saved.observations).toHaveLength(3);
    expect(next.snapshot(scope).durableRevision).toBe(saved.revision);
  });
});

test("load와 pending admission이 멈춰도 close는 2초에 실패하고 늦은 완료를 clean으로 승격하지 않는다", async () => {
  await fixture(async ({ store, scope, file, io, open }) => {
    await store.close();
    const entered = deferred();
    const gate = deferred();
    io.beforeRead = async () => { entered.release(); await gate.promise; };
    const next = open();
    const selecting = next.select(scope, 2);
    await entered.promise;
    const pending = next.upsert(scope, item("pending", "completed"));
    const started = Date.now();
    const closing = next.close();
    expect(await closing).toEqual({ clean: false });
    expect(Date.now() - started).toBeLessThan(2600);
    expect(next.snapshot(scope).observations).toEqual([]);
    await expect(next.upsert(scope, item("late"))).rejects.toThrow("수집 종료");
    delete io.beforeRead;
    gate.release();
    await selecting;
    expect((await pending).observations).toHaveLength(1);
    await next.flush();
    const saved = JSON.parse(await fs.readFile(file, "utf8"));
    expect(saved.dirty).toBe(true);
    expect(saved.coverage.gaps).toContain("unclean-exit");
    expect(saved.observations).toEqual(next.snapshot(scope).observations);
    expect(next.snapshot(scope).durableRevision).toBe(saved.revision);
    expect(await next.close()).toEqual({ clean: false });
  });
}, 6000);


test("지연 복원의 실제 4MiB 경계에서 신규·증가 갱신을 거부하고 같은 크기 기존 ID 갱신은 유지한다", async () => {
  await fixture(async ({ store, scope, file, io, open }) => {
    await store.close();
    const identity = "x".repeat(2048);
    const sample = { ...item("seed-9999", "observed"), id: "0".repeat(64) };
    sample.resource.identity = identity;
    const budget = 4 * 1024 * 1024 - 8192;
    const count = Math.floor((budget - 4096) / (Buffer.byteLength(JSON.stringify(sample)) + 1));
    await seed(file, scope, count, identity);
    await rewrite(file, (record) => {
      if (!Array.isArray(record.observations)) throw new Error("fixture 관측 배열 필요");
      const rows = record.observations;
      for (const row of rows) {
        const remaining = budget - Buffer.byteLength(JSON.stringify(rows));
        if (remaining <= 0) break;
        row.source.nativeInvocationId = "z";
        const overhead = Buffer.byteLength(JSON.stringify(rows)) - (budget - remaining) - 1;
        if (remaining > overhead) row.source.nativeInvocationId = "z".repeat(Math.min(2048, remaining - overhead));
        else {
          delete row.source.nativeInvocationId;
          row.resource.label += "x".repeat(remaining);
        }
      }
      expect(Buffer.byteLength(JSON.stringify(rows))).toBe(budget);
    });
    const original = JSON.parse(await fs.readFile(file, "utf8"));
    const entered = deferred();
    const gate = deferred();
    io.beforeRead = async () => { entered.release(); await gate.promise; };
    const next = open();
    const selecting = next.select(scope, 2);
    await entered.promise;
    const adding = next.upsert(scope, item("overflow"));
    const growing: ResourceObservationInput = { ...original.observations[0], status: "completed" };
    const changing: ResourceObservationInput = { ...original.observations[0], status: "running" };
    const rejectedUpdate = next.upsert(scope, growing);
    const acceptedUpdate = next.upsert(scope, changing);
    expect(next.snapshot(scope).observations).toEqual([]);
    delete io.beforeRead;
    gate.release();
    await selecting;
    const full = await adding;
    const rejected = await rejectedUpdate;
    const accepted = await acceptedUpdate;
    expect(full.storage).toBe("full");
    expect(full.observations).toEqual(original.observations);
    expect(rejected.observations).toEqual(original.observations);
    expect(accepted.observations.map((row) => row.id)).toEqual(original.observations.map((row: { id: string }) => row.id));
    expect(accepted.observations[0]?.status).toBe("running");
    expect(Buffer.byteLength(JSON.stringify(accepted.observations))).toBeLessThanOrEqual(budget);
    expect(await next.flush()).toEqual({ clean: true, failedScopes: [] });
    const saved = JSON.parse(await fs.readFile(file, "utf8"));
    expect(saved.observations).toEqual(accepted.observations);
    expect(next.snapshot(scope).durableRevision).toBe(saved.revision);
    expect((await fs.stat(file)).size).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
}, 15000);
