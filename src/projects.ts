/**
 * main의 single-instance lock 획득 뒤 userData당 하나만 생성한다.
 * userData는 main이 미리 만든 비공유 실제 디렉터리다. 전환 가능 여부는 main 책임이다.
 * @architecture arch.native.projects
 * @implements RESP-NATIVE-PROJECTS
 */
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

const BYTE_BUDGET = 256 * 1024;

type Project = { workspaceKey: string; name: string; path: string; favorite: boolean };
type Entry = Project & { lastOpened: number };
type Body = { schemaVersion: 1; scope: string; projects: Entry[] };

/** 로컬 IO 실패 시험 전용 경계이며 저장 경로나 한도를 바꾸지 않는다. */
export interface ProjectRegistryIO {
  beforeWrite?: () => Promise<void>;
  beforeRename?: () => Promise<void>;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fields(value: Record<string, unknown>, names: string[]): boolean {
  return Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
}

function text(value: unknown, characters: number, bytes: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= characters
    && Buffer.byteLength(value, "utf8") <= bytes && !value.includes("\0")
    && Buffer.from(value, "utf8").toString("utf8") === value;
}

function validPath(value: unknown): value is string {
  return text(value, 8192, 16384) && isAbsolute(value) && resolve(value) === value;
}

function parse(bytes: Buffer, scope: string): Body {
  if (bytes.length > BYTE_BUDGET) throw new Error("프로젝트 인덱스 byte 한도 초과");
  if (!bytes.equals(Buffer.from(bytes.toString("utf8"), "utf8"))) {
    throw new Error("프로젝트 인덱스 UTF-8 오류");
  }
  const value: unknown = JSON.parse(bytes.toString("utf8"));
  if (!record(value) || !fields(value, ["schemaVersion", "scope", "projects", "checksum"])) throw new Error("프로젝트 인덱스 schema 오류");
  if (value.schemaVersion !== 1) throw new Error("지원하지 않는 프로젝트 인덱스 version");
  if (value.scope !== scope) throw new Error("프로젝트 인덱스 scope 불일치");
  if (!Array.isArray(value.projects)) throw new Error("프로젝트 목록 schema 오류");
  const keys = new Set<string>();
  const orders = new Set<number>();
  const projects: Entry[] = [];
  for (const row of value.projects) {
    if (!record(row) || !fields(row, ["workspaceKey", "name", "path", "favorite", "lastOpened"])
      || !validPath(row.path) || !text(row.name, 255, 1024) || row.name !== basename(row.path)
      || typeof row.workspaceKey !== "string" || row.workspaceKey !== hash(row.path)
      || typeof row.favorite !== "boolean" || typeof row.lastOpened !== "number"
      || !Number.isSafeInteger(row.lastOpened) || row.lastOpened < 1
      || keys.has(row.workspaceKey) || orders.has(row.lastOpened)) throw new Error("프로젝트 항목 schema 오류");
    keys.add(row.workspaceKey);
    orders.add(row.lastOpened);
    projects.push({ workspaceKey: row.workspaceKey, name: row.name, path: row.path, favorite: row.favorite, lastOpened: row.lastOpened });
  }
  const body: Body = { schemaVersion: 1, scope, projects };
  if (value.checksum !== hash(JSON.stringify(body))) throw new Error("프로젝트 인덱스 checksum 불일치");
  return body;
}

function missing(error: unknown): boolean {
  return record(error) && error.code === "ENOENT";
}

async function directory(path: string): Promise<void> {
  let current = path;
  for (;;) {
    const info = await fs.lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("프로젝트 인덱스 parent symlink 또는 디렉터리 오류");
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (await fs.realpath(path) !== path) throw new Error("프로젝트 인덱스 root 탈출");
}

async function indexInfo(file: string) {
  try {
    const info = await fs.lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error("프로젝트 인덱스 link 거부");
    if (info.size > BYTE_BUDGET) throw new Error("프로젝트 인덱스 byte 한도 초과");
    return info;
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

async function syncDirectory(handle: fs.FileHandle): Promise<void> {
  try {
    await handle.sync();
  } catch (error) {
    if (!record(error) || !["EINVAL", "ENOTSUP", "EISDIR"].includes(String(error.code))) throw error;
  }
}

function project(row: Entry): Project {
  return { workspaceKey: row.workspaceKey, name: row.name, path: row.path, favorite: row.favorite };
}

export function createProjectRegistry(options: { userData: string; io?: ProjectRegistryIO }) {
  const root = options.userData;
  const io = options.io;
  let queue: Promise<unknown> = Promise.resolve();
  let hasDurableIndex = false;

  function enqueue<T>(run: () => Promise<T>): Promise<T> {
    const result = queue.then(run);
    queue = result.catch(() => undefined);
    return result;
  }

  async function read(): Promise<Body> {
    if (!validPath(root) || dirname(root) === root) throw new Error("프로젝트 userData 실제 전용 절대경로 필요");
    await directory(root);
    if (process.platform !== "win32") await fs.chmod(root, 0o700);
    const file = join(root, "projects-v1.json");
    const info = await indexInfo(file);
    if (!info) {
      if (hasDurableIndex) throw new Error("프로젝트 인덱스 원본 누락");
      return { schemaVersion: 1, scope: root, projects: [] };
    }
    const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (opened.dev !== info.dev || opened.ino !== info.ino || opened.nlink !== 1 || !opened.isFile()) throw new Error("프로젝트 인덱스 파일 교체 감지");
      // readFile 대신 한도+1만 읽어 검사 직후 커진 파일도 메모리 한도에 가둔다.
      const bytes = Buffer.alloc(BYTE_BUDGET + 1);
      let length = 0;
      while (length < bytes.length) {
        const result = await handle.read(bytes, length, bytes.length - length, length);
        if (result.bytesRead === 0) break;
        length += result.bytesRead;
      }
      const body = parse(bytes.subarray(0, length), root);
      if (process.platform !== "win32") await handle.chmod(0o600);
      hasDurableIndex = true;
      return body;
    } finally {
      await handle.close();
    }
  }

  async function write(body: Body): Promise<void> {
    const bytes = Buffer.from(JSON.stringify({ ...body, checksum: hash(JSON.stringify(body)) }), "utf8");
    parse(bytes, root);
    await directory(root);
    const file = join(root, "projects-v1.json");
    await indexInfo(file);
    const temporary = join(root, `.projects-${randomUUID()}.tmp`);
    const rootInfo = await fs.lstat(root);
    const parent = process.platform === "win32" ? null : await fs.open(root, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if (parent) await syncDirectory(parent);
      const handle = await fs.open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try {
        await io?.beforeWrite?.();
        await handle.writeFile(bytes);
        const info = await handle.stat();
        if (!info.isFile() || info.nlink !== 1 || info.size !== bytes.length) throw new Error("프로젝트 임시파일 검증 실패");
        await handle.sync();
      } finally {
        await handle.close();
      }
      // 실제 임시 bytes도 다시 검증하며 임시파일은 복구 후보로 자동 채택하지 않는다.
      await indexInfo(temporary);
      parse(await fs.readFile(temporary), root);
      await io?.beforeRename?.();
      await directory(root);
      const current = await fs.lstat(root);
      const opened = parent ? await parent.stat() : rootInfo;
      if (current.dev !== opened.dev || current.ino !== opened.ino) throw new Error("프로젝트 root 교체 감지");
      await indexInfo(file);
      await fs.rename(temporary, file);
      hasDurableIndex = true;
      // 여기서 실패하면 교체 후 내구성 미확정 오류다. 다음 조회는 실제 디스크를 다시 읽는다.
      try {
        if (parent) await syncDirectory(parent);
      } catch (cause) {
        throw new Error("프로젝트 인덱스 교체 후 directory fsync 실패: 내구성 미확정", { cause });
      }
    } finally {
      await parent?.close();
      await fs.unlink(temporary).catch((error: unknown) => { if (!missing(error)) throw error; });
    }
  }

  return {
    list(): Promise<readonly Project[]> {
      return enqueue(async () => {
        const body = await read();
        return body.projects.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastOpened - a.lastOpened).map(project);
      });
    },
    register(workspacePath: string): Promise<Project> {
      return enqueue(async () => {
        if (!text(workspacePath, 8192, 16384)) throw new Error("유효하지 않은 프로젝트 경로");
        const path = await fs.realpath(workspacePath);
        const name = basename(path);
        if (!validPath(path) || !text(name, 255, 1024) || !(await fs.stat(path)).isDirectory()) throw new Error("접근 가능한 프로젝트 directory 필요");
        await fs.access(path, constants.R_OK | constants.X_OK);
        const body = await read();
        const workspaceKey = hash(path);
        const previous = body.projects.find((row) => row.workspaceKey === workspaceKey);
        const lastOpened = body.projects.reduce((maximum, row) => Math.max(maximum, row.lastOpened), 0) + 1;
        if (!Number.isSafeInteger(lastOpened)) throw new Error("프로젝트 최근 순번 한도 초과");
        const row: Entry = { workspaceKey, name, path, favorite: previous?.favorite ?? false, lastOpened };
        body.projects = body.projects.filter((entry) => entry.workspaceKey !== workspaceKey);
        body.projects.push(row);
        await write(body);
        return project(row);
      });
    },
    setFavorite(workspaceKey: string, favorite: boolean): Promise<void> {
      return enqueue(async () => {
        if (typeof workspaceKey !== "string" || !/^[a-f0-9]{64}$/.test(workspaceKey) || typeof favorite !== "boolean") throw new Error("유효하지 않은 프로젝트 key 또는 favorite");
        const body = await read();
        const row = body.projects.find((entry) => entry.workspaceKey === workspaceKey);
        if (!row) throw new Error("미등록 프로젝트 key");
        row.favorite = favorite;
        await write(body);
      });
    },
  };
}
