/**
 * main이 승인한 프로젝트의 작업 기록만 읽는다. 사용자 폴더의 코드를 실행하지 않는다.
 * @architecture arch.native.projects
 * @implements RESP-NATIVE-PROJECTS
 */
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { DashboardIssue, DashboardProject, DashboardProjectSnapshot, DashboardSnapshot, DashboardWork, WorkStatus } from "./shared";

export const DASHBOARD_LIMITS = {
  projects: 100, files: 500, entries: 5000, depth: 5,
  fileBytes: 4 * 1024 * 1024, totalBytes: 32 * 1024 * 1024,
} as const;

const WORK_ID = /^work-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES: readonly string[] = ["draft", "ready", "in_progress", "verifying", "done", "cancelled"];
const AREAS: readonly string[] = ["ui", "dev", "ops"];
const RESULTS: readonly string[] = ["unverified", "passed", "failed", "blocked"];

class ReadFailure extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum && !value.includes("\0");
}

function code(error: unknown): string {
  return object(error) && typeof error.code === "string" ? error.code : "read_failed";
}

function issue(error: unknown, path: string): DashboardIssue {
  if (error instanceof ReadFailure) return { code: error.code, path, message: error.message };
  const denied = ["EACCES", "EPERM"].includes(code(error));
  return { code: denied ? "permission_denied" : "read_failed", path,
    message: denied ? "작업 기록을 읽을 권한이 없습니다." : "작업 기록을 읽지 못했습니다. 다시 수집해 주세요." };
}

function sourcePath(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}

/** 매 읽기 전후에 범위 내 디렉터리와 실제 경로를 다시 확인한다. */
async function directory(root: string, path: string): Promise<void> {
  const suffix = relative(root, path);
  if (suffix === ".." || suffix.startsWith(`..${sep}`) || isAbsolute(suffix)) {
    throw new ReadFailure("unsafe_path", "프로젝트 밖의 작업 기록은 읽지 않습니다.");
  }
  let current = root;
  for (const part of ["", ...suffix.split(sep).filter(Boolean)]) {
    if (part) current = join(current, part);
    const info = await fs.lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new ReadFailure("unsafe_path", "심볼릭 링크 또는 디렉터리가 아닌 경로를 거부했습니다.");
  }
  if (await fs.realpath(path) !== path) throw new ReadFailure("unsafe_path", "실제 경로가 프로젝트 읽기 범위와 다릅니다.");
}

function parseWork(bytes: Buffer, projectKey: string, source: string): DashboardWork {
  const raw = bytes.toString("utf8");
  if (!bytes.equals(Buffer.from(raw, "utf8"))) throw new ReadFailure("invalid_utf8", "UTF-8 작업 기록이 아닙니다.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new ReadFailure("invalid_json", "작업 기록 JSON이 올바르지 않습니다."); }
  if (!object(value) || ![1, 2].includes(Number(value.schemaVersion)) || typeof value.schemaVersion !== "number"
    || !text(value.id, 64) || !WORK_ID.test(value.id) || !text(value.title, 1000)
    || typeof value.status !== "string" || !STATUSES.includes(value.status)
    || !(value.blockedReason === null || text(value.blockedReason, 8000))
    || !Array.isArray(value.areas) || value.areas.length === 0 || value.areas.some((area) => typeof area !== "string" || !AREAS.includes(area))
    || new Set(value.areas).size !== value.areas.length || typeof value.owner !== "string" || !value.areas.includes(value.owner)
    || !Array.isArray(value.criteria) || value.criteria.length === 0
    || value.criteria.some((criterion) => !object(criterion) || !text(criterion.id, 128)
      || typeof criterion.required !== "boolean" || typeof criterion.result !== "string" || !RESULTS.includes(criterion.result))) {
    throw new ReadFailure("invalid_record", "작업 식별자·상태·차단 사유·기준의 형식이 올바르지 않습니다.");
  }
  const ids = value.criteria.map((criterion: Record<string, unknown>) => criterion.id);
  if (new Set(ids).size !== ids.length) throw new ReadFailure("invalid_record", "작업의 수용 기준 ID가 중복됩니다.");
  const required = value.criteria.filter((criterion: Record<string, unknown>) => criterion.required);
  return { id: value.id, projectKey, title: value.title, status: value.status as WorkStatus,
    blockedReason: value.blockedReason as string | null, sourcePath: source, areas: value.areas,
    owner: value.owner, requiredCriteria: required.length,
    passedCriteria: required.filter((criterion: Record<string, unknown>) => criterion.result === "passed").length };
}

async function readWork(root: string, file: string, projectKey: string, budget: { bytes: number }): Promise<DashboardWork> {
  await directory(root, resolve(file, ".."));
  const info = await fs.lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new ReadFailure("unsafe_path", "일반 파일이 아닌 작업 기록과 링크를 거부했습니다.");
  if (info.size > DASHBOARD_LIMITS.fileBytes) throw new ReadFailure("file_size_limit", "작업 기록 하나의 크기 한도(4 MiB)를 넘었습니다.");
  if (info.size > budget.bytes) throw new ReadFailure("total_size_limit", "이번 전체 수집의 읽기 한도(32 MiB)를 넘었습니다.");
  if (await fs.realpath(file) !== file) throw new ReadFailure("unsafe_path", "작업 기록의 실제 경로가 바뀌었습니다.");
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== info.dev || opened.ino !== info.ino) throw new ReadFailure("changed_during_read", "읽기 전에 작업 기록이 교체되었습니다.");
    const capacity = Math.min(DASHBOARD_LIMITS.fileBytes, budget.bytes, info.size) + 1;
    const bytes = Buffer.alloc(capacity);
    let length = 0;
    while (length < capacity) {
      const result = await handle.read(bytes, length, capacity - length, length);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    const remaining = budget.bytes;
    budget.bytes = Math.max(0, remaining - length);
    if (length > DASHBOARD_LIMITS.fileBytes) throw new ReadFailure("file_size_limit", "읽는 중 작업 기록이 크기 한도를 넘었습니다.");
    if (length > remaining) throw new ReadFailure("total_size_limit", "이번 전체 수집의 읽기 한도(32 MiB)를 넘었습니다.");
    await directory(root, resolve(file, ".."));
    const current = await fs.lstat(file);
    const after = await handle.stat();
    if (current.isSymbolicLink() || current.dev !== opened.dev || current.ino !== opened.ino
      || after.nlink !== 1 || after.size !== info.size || length !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs) {
      throw new ReadFailure("changed_during_read", "수집 중 작업 기록이 바뀌어 이번 카드를 제외했습니다.");
    }
    return parseWork(bytes.subarray(0, length), projectKey, sourcePath(root, file));
  } finally {
    await handle.close();
  }
}

async function readProject(project: DashboardProject, budget: { bytes: number }): Promise<DashboardProjectSnapshot> {
  const cards: DashboardWork[] = [];
  const issues: DashboardIssue[] = [];
  const root = project.path;
  const work = join(root, "docs", "work");
  let entries = 0;
  let files = 0;
  let limited = false;
  const add = (error: unknown, path: string) => { if (issues.length < 100) issues.push(issue(error, sourcePath(root, path))); };
  try {
    if (!isAbsolute(root) || resolve(root) !== root || root.includes("\0")) throw new ReadFailure("unsafe_path", "정규화한 프로젝트 절대 경로가 필요합니다.");
    await directory(root, root);
    try { await directory(root, work); } catch (error) {
      if (code(error) === "ENOENT") {
        await directory(root, root);
        return { project, coverage: "empty", cards, issues };
      }
      throw error;
    }
    async function visit(path: string, depth: number): Promise<void> {
      if (limited) return;
      try {
        await directory(root, path);
        const stream = await fs.opendir(path);
        for await (const entry of stream) {
          if (limited) break;
          const file = join(path, entry.name);
          if (++entries > DASHBOARD_LIMITS.entries) {
            limited = true; add(new ReadFailure("entry_limit", "프로젝트의 탐색 항목 한도(5,000개)를 넘었습니다."), path); break;
          }
          if (entry.isSymbolicLink()) { add(new ReadFailure("unsafe_path", "작업 기록 범위의 심볼릭 링크를 제외했습니다."), file); continue; }
          if (entry.name === "work.json") {
            if (++files > DASHBOARD_LIMITS.files) {
              limited = true; add(new ReadFailure("file_count_limit", "프로젝트의 작업 기록 한도(500개)를 넘었습니다."), path); break;
            }
            try { cards.push(await readWork(root, file, project.key, budget)); } catch (error) { add(error, file); }
          } else if (entry.isDirectory()) {
            if (depth >= DASHBOARD_LIMITS.depth) add(new ReadFailure("depth_limit", "작업 기록 탐색 깊이 한도를 넘었습니다."), file);
            else await visit(file, depth + 1);
          }
        }
      } catch (error) { add(error, path); }
    }
    await visit(work, 0);
  } catch (error) { add(error, work); }
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card.id.toLowerCase(), (counts.get(card.id.toLowerCase()) ?? 0) + 1);
  const unique = cards.filter((card) => {
    if (counts.get(card.id.toLowerCase()) === 1) return true;
    add(new ReadFailure("duplicate_work_id", "동일 프로젝트의 작업 UUID가 중복되어 모호한 카드를 제외했습니다."), join(root, card.sourcePath));
    return false;
  }).sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return { project, coverage: issues.length ? (unique.length ? "partial" : "failed") : (unique.length ? "complete" : "empty"), cards: unique, issues };
}

/** IPC에서 받은 경로를 전달하지 않는다. 호출자는 main의 등록 목록과 고정 WWW 범위만 제공한다. */
export async function readDashboard(projects: readonly DashboardProject[]): Promise<DashboardSnapshot> {
  const snapshots: DashboardProjectSnapshot[] = [];
  const budget = { bytes: DASHBOARD_LIMITS.totalBytes as number };
  for (const [index, project] of projects.entries()) {
    if (index >= DASHBOARD_LIMITS.projects) {
      snapshots.push({ project, coverage: "failed", cards: [], issues: [{ code: "project_count_limit", path: "docs/work", message: "전체 프로젝트 수집 한도(100개)를 넘었습니다." }] });
    } else snapshots.push(await readProject(project, budget));
  }
  return { capturedAt: new Date().toISOString(), projects: snapshots };
}
