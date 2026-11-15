/**
 * @verifies RESP-NATIVE-PROJECTS
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createProjectRegistry } from "../src/projects";
import type { ProjectRegistryIO } from "../src/projects";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function signed(body: object): Buffer<ArrayBuffer> {
  return Buffer.from(JSON.stringify({ ...body, checksum: hash(JSON.stringify(body)) }), "utf8");
}

function coded(code: string): Error {
  return Object.assign(new Error(code), { code });
}

async function fixture(run: (context: {
  base: string;
  userData: string;
  workspace: string;
  file: string;
  io: ProjectRegistryIO;
  store: ReturnType<typeof createProjectRegistry>;
  open: () => ReturnType<typeof createProjectRegistry>;
}) => Promise<void>) {
  const base = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "www-projects-")));
  try {
    const userData = join(base, "data");
    const workspace = join(base, "프로젝트-한글");
    await fs.mkdir(userData, { mode: 0o700 });
    await fs.mkdir(workspace);
    const io: ProjectRegistryIO = {};
    const open = () => createProjectRegistry({ userData, io });
    await run({ base, userData, workspace, file: join(userData, "projects-v1.json"), io, store: open(), open });
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
}

test("첫 등록과 즐겨찾기를 실제 디스크에서 새 factory로 복원한다", async () => {
  await fixture(async ({ store, workspace, open, file, userData }) => {
    expect(await store.list()).toEqual([]);
    const row = await store.register(workspace);
    expect(row).toEqual({ workspaceKey: hash(await fs.realpath(workspace)), name: basename(workspace), path: workspace, favorite: false });
    expect(Object.keys(row).sort()).toEqual(["favorite", "name", "path", "workspaceKey"]);
    await store.setFavorite(row.workspaceKey, true);
    expect(await open().list()).toEqual([{ ...row, favorite: true }]);
    if (process.platform !== "win32") {
      expect((await fs.stat(userData)).mode & 0o777).toBe(0o700);
      expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    }
  });
});

test("symlink 별칭은 합치며 실제 경로와 worktree는 구분하고 재등록 최근순과 favorite를 보존한다", async () => {
  await fixture(async ({ store, workspace, base }) => {
    const alias = join(base, "alias");
    const other = join(base, "worktree");
    await fs.symlink(workspace, alias, "junction");
    await fs.mkdir(other);
    const first = await store.register(workspace);
    const second = await store.register(other);
    expect(second.workspaceKey).not.toBe(first.workspaceKey);
    expect((await store.list()).map((row) => row.workspaceKey)).toEqual([second.workspaceKey, first.workspaceKey]);
    await store.setFavorite(first.workspaceKey, true);
    expect((await store.list()).map((row) => row.workspaceKey)).toEqual([first.workspaceKey, second.workspaceKey]);
    expect(await store.register(alias)).toEqual({ ...first, favorite: true });
    await store.setFavorite(first.workspaceKey, false);
    expect((await store.list()).map((row) => row.workspaceKey)).toEqual([first.workspaceKey, second.workspaceKey]);
    await store.register(other);
    expect((await store.list()).map((row) => row.workspaceKey)).toEqual([second.workspaceKey, first.workspaceKey]);
  });
});

test("병렬 register와 favorite가 하나의 큐에서 기존 항목을 잃지 않는다", async () => {
  await fixture(async ({ store, workspace, base, io, open }) => {
    const first = await store.register(workspace);
    const other = join(base, "other");
    await fs.mkdir(other);
    let release: () => void = () => { throw new Error("준비 전 해제"); };
    const held = new Promise<void>((resolve) => { release = resolve; });
    let entered: () => void = () => { throw new Error("준비 전 진입"); };
    const waiting = new Promise<void>((resolve) => { entered = resolve; });
    io.beforeRename = async () => { entered(); await held; };
    const registering = store.register(other);
    await waiting;
    const favoriting = store.setFavorite(first.workspaceKey, true);
    release();
    const second = await registering;
    await favoriting;
    delete io.beforeRename;
    expect(await open().list()).toEqual([{ ...first, favorite: true }, second]);
    const third = join(base, "third");
    const fourth = join(base, "fourth");
    await fs.mkdir(third);
    await fs.mkdir(fourth);
    const results = await Promise.all([store.register(third), store.register(fourth)]);
    expect((await store.list()).map((row) => row.workspaceKey)).toEqual([first.workspaceKey, results[1].workspaceKey, results[0].workspaceKey, second.workspaceKey]);
  });
});

test("미등록 key와 key·boolean·경로 형식 오류를 거부하고 원래 bytes를 유지한다", async () => {
  await fixture(async ({ store, workspace, file, base }) => {
    const first = await store.register(workspace);
    const before = await fs.readFile(file);
    for (const key of ["0".repeat(64), "../projects-v1.json", workspace, first.workspaceKey.toUpperCase(), "a".repeat(63), 123, null]) {
      await expect(Reflect.apply(store.setFavorite, store, [key, true])).rejects.toThrow();
    }
    for (const favorite of ["true", 1, null, {}, undefined]) {
      await expect(Reflect.apply(store.setFavorite, store, [first.workspaceKey, favorite])).rejects.toThrow();
    }
    const ordinary = join(base, "file");
    await fs.writeFile(ordinary, "ordinary");
    for (const path of [ordinary, join(base, "missing"), "", "a\0b", "x".repeat(8193), 12, null, {}]) {
      await expect(Reflect.apply(store.register, store, [path])).rejects.toThrow();
    }
    expect(await fs.readFile(file)).toEqual(before);
    expect(await store.list()).toEqual([first]);
  });
});

test("등록·조회 반환값을 바꿔도 내부 상태와 새 factory 복원이 오염되지 않는다", async () => {
  await fixture(async ({ store, workspace, open }) => {
    const row = await store.register(workspace);
    const expected = { ...row };
    row.name = "변조";
    row.favorite = true;
    const listed = await store.list();
    listed[0].path = "/변조";
    listed[0].workspaceKey = "0".repeat(64);
    expect(await store.list()).toEqual([expected]);
    expect(await open().list()).toEqual([expected]);
  });
});

test("rename·ENOSPC·permission 실패 주입은 이전 디스크와 조회 상태를 보전하며 큐가 회복된다", async () => {
  await fixture(async ({ store, workspace, file, io, open, base }) => {
    const row = await store.register(workspace);
    const before = await fs.readFile(file);
    const other = join(base, "other");
    await fs.mkdir(other);
    for (const code of ["EIO", "ENOSPC", "EACCES"]) {
      if (code === "EIO") io.beforeRename = async () => { throw coded(code); };
      else io.beforeWrite = async () => { throw coded(code); };
      await expect(store.setFavorite(row.workspaceKey, true)).rejects.toThrow(code);
      await expect(store.register(other)).rejects.toThrow(code);
      expect(await fs.readFile(file)).toEqual(before);
      expect(await store.list()).toEqual([row]);
      expect(await open().list()).toEqual([row]);
      delete io.beforeRename;
      delete io.beforeWrite;
    }
    expect((await fs.readdir(join(file, ".."))).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    await store.setFavorite(row.workspaceKey, true);
    expect(await open().list()).toEqual([{ ...row, favorite: true }]);
  });
});

test("실제 rename 대상이 디렉터리로 바뀌면 실패하고 이전 원본을 보전한다", async () => {
  await fixture(async ({ store, workspace, file, io }) => {
    const row = await store.register(workspace);
    const before = await fs.readFile(file);
    const backup = `${file}.backup`;
    io.beforeRename = async () => { await fs.rename(file, backup); await fs.mkdir(file); };
    await expect(store.setFavorite(row.workspaceKey, true)).rejects.toThrow();
    expect(await fs.readFile(backup)).toEqual(before);
    delete io.beforeRename;
    await fs.rmdir(file);
    await fs.rename(backup, file);
    expect(await store.list()).toEqual([row]);
  });
});

test("손상·checksum·scope·schema·unsupported version·oversized 원문을 덮어쓰지 않는다", async () => {
  await fixture(async ({ store, workspace, file, userData, open }) => {
    const row = await store.register(workspace);
    const entry = { ...row, lastOpened: 1 };
    const body = { schemaVersion: 1, scope: userData, projects: [entry] };
    const cases = [
      Buffer.from("{broken"),
      Buffer.from([0xff, 0xfe]),
      Buffer.from(JSON.stringify({ ...body, checksum: "0".repeat(64) })),
      signed({ ...body, scope: `${userData}-other` }),
      signed({ ...body, schemaVersion: 2 }),
      signed({ ...body, projects: {} }),
      signed({ ...body, extra: "허용하지 않는 필드" }),
      signed({ ...body, projects: [{ ...entry, favorite: "yes" }] }),
      signed({ ...body, projects: [{ ...entry, workspaceKey: "0".repeat(64) }] }),
      signed({ ...body, projects: [{ ...entry, name: "wrong" }] }),
      signed({ ...body, projects: [{ ...entry, path: "../escape" }] }),
      signed({ ...body, projects: [{ ...entry, lastOpened: 1.5 }] }),
      signed({ ...body, projects: [{ ...entry, secret: "unaccepted" }] }),
      signed({ ...body, projects: [entry, entry] }),
      Buffer.alloc(256 * 1024 + 1, 0x20),
    ];
    for (const bytes of cases) {
      await fs.writeFile(file, bytes);
      await expect(store.list()).rejects.toThrow();
      await expect(open().list()).rejects.toThrow();
      await expect(store.register(workspace)).rejects.toThrow();
      await expect(store.setFavorite(row.workspaceKey, true)).rejects.toThrow();
      expect(await fs.readFile(file)).toEqual(bytes);
    }
  });
});

test("index symlink·hardlink와 userData·조상 symlink를 거부하고 외부 원문을 보전한다", async () => {
  await fixture(async ({ store, workspace, file, userData, base }) => {
    const row = await store.register(workspace);
    const before = await fs.readFile(file);
    const outside = join(base, "outside.json");
    await fs.rename(file, outside);
    await fs.symlink(outside, file, "file");
    await expect(store.list()).rejects.toThrow();
    await expect(store.setFavorite(row.workspaceKey, true)).rejects.toThrow();
    await expect(store.register(workspace)).rejects.toThrow();
    expect(await fs.readFile(outside)).toEqual(before);
    await fs.unlink(file);
    await fs.link(outside, file);
    await expect(store.list()).rejects.toThrow();
    await expect(store.register(workspace)).rejects.toThrow();
    await expect(store.setFavorite(row.workspaceKey, true)).rejects.toThrow();
    expect(await fs.readFile(outside)).toEqual(before);
    await fs.unlink(file);
    await fs.rename(outside, file);
    const alias = join(base, "alias-data");
    await fs.symlink(userData, alias, "junction");
    await expect(createProjectRegistry({ userData: alias }).list()).rejects.toThrow();
    const parentAlias = join(base, "alias-parent");
    await fs.symlink(base, parentAlias, "junction");
    await expect(createProjectRegistry({ userData: join(parentAlias, "data") }).register(workspace)).rejects.toThrow();
    await expect(createProjectRegistry({ userData: `${userData}/../data` }).list()).rejects.toThrow();
    expect(await fs.readFile(file)).toEqual(before);
  });
});

test("실제 256KiB byte budget 초과는 최근·즐겨찾기를 삭제하지 않고 명시 실패한다", async () => {
  await fixture(async ({ store, workspace, file, userData, base, open }) => {
    const row = await store.register(workspace);
    const entries = [{ ...row, favorite: true, lastOpened: 1 }];
    const body = { schemaVersion: 1, scope: userData, projects: entries };
    let before = signed(body);
    // 과거 등록 후 현재는 없어진 경로도 자동 만료하지 않는 유효한 실제 저장 형식이다.
    for (let index = 2; ; index += 1) {
      const path = join(base, `previous-${index}`, "x".repeat(80), "old-project");
      entries.push({ workspaceKey: hash(path), name: basename(path), path, favorite: index % 2 === 0, lastOpened: index });
      const candidate = signed(body);
      if (candidate.length > 256 * 1024) { entries.pop(); break; }
      before = candidate;
    }
    await fs.writeFile(file, before);
    const expected = await store.list();
    const longParent = join(base, "a".repeat(120), "b".repeat(120), "c".repeat(120), "d".repeat(120));
    await fs.mkdir(longParent, { recursive: true });
    const other = join(longParent, "n".repeat(80));
    await fs.mkdir(other);
    expect(Buffer.byteLength(other)).toBeLessThan(900);
    const candidate = { workspaceKey: hash(other), name: basename(other), path: other, favorite: false, lastOpened: entries.length + 1 };
    expect(signed({ ...body, projects: [...entries, candidate] }).length).toBeGreaterThan(256 * 1024);
    expect(before.length).toBeLessThanOrEqual(256 * 1024);
    await expect(store.register(other)).rejects.toThrow("byte 한도");
    expect(await fs.readFile(file)).toEqual(before);
    expect(await store.list()).toEqual(expected);
    expect(await open().list()).toEqual(expected);
    expect(expected.some((entry) => entry.workspaceKey === row.workspaceKey && entry.favorite)).toBe(true);
  });
});

test("남은 임시파일은 시각이 새로워도 원본 대신 채택하지 않는다", async () => {
  await fixture(async ({ store, workspace, userData, file, open }) => {
    const row = await store.register(workspace);
    const bytes = await fs.readFile(file);
    await fs.writeFile(join(userData, ".projects-orphan.tmp"), "newer but invalid");
    expect(await open().list()).toEqual([row]);
    expect(await fs.readFile(file)).toEqual(bytes);
  });
});

test("이미 확인한 원본이 사라지면 빈 목록으로 초기화하거나 다시 쓰지 않는다", async () => {
  await fixture(async ({ store, workspace, file }) => {
    const row = await store.register(workspace);
    const backup = `${file}.backup`;
    await fs.rename(file, backup);
    await expect(store.list()).rejects.toThrow("원본 누락");
    await expect(store.register(workspace)).rejects.toThrow("원본 누락");
    await expect(store.setFavorite(row.workspaceKey, true)).rejects.toThrow("원본 누락");
    await expect(fs.stat(file)).rejects.toThrow();
    await fs.rename(backup, file);
    expect(await store.list()).toEqual([row]);
  });
});
