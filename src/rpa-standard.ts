/**
 * @architecture arch.native.lifecycle
 * @implements RESP-NATIVE-LIFECYCLE
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, opendir } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseDocument } from "yaml";
import type { RpaStandardCase, RpaStandardRun, RpaStandardSnapshot, RpaStandardUnit } from "./shared";

const coreFiles = {
  "core/logger/session.py": "4e06701d72e7ac4a52c1ef7f668544e6c18860bd5c47885ed86f96ba7971e8a1",
  "core/logger/logger.py": "2083f4d44a06b0b82fc4f90c508fc59db6fa84a085af88a05398bcfe4a1f0d63",
  "core/runtime/profile.py": "6b5ca3f263db53e83a2c1d599afdd1983fea758786d0f25761382809b5eddd1f",
  "core/util/paths.py": "3bc3147dbfb70c6d2b2cd9f06d4856e4eb3d5d34090831b0744677b9530c19e9",
  "core/contracts/run-log.schema.json": "ec4ec6ba2efe79c05b7629bb6964c4c6b61f4946d21dc136ae6aceb927210008",
  "core/mail/transport.py": "39740143687fac835256d2155a67cd8733a00da4986d897cb278836272e20162",
  "core/contracts/runtime-profile.schema.json": "3c5f56655e3446d5c20c3c1d9a4c7ae4c32ffedc7542b4a733cbb82a0806ba61",
};
const coreVersion = "0.2.1";
const sessionHashes = new Map([
  ["0.2.0", coreFiles["core/logger/session.py"]],
  ["0.2.1", "0ba617c5e262e7509f019f89d3701c36115dacb733797579d19f869de4e1c364"],
]);
const runStatuses = ["completed", "partial", "incomplete", "failed"] as const;
const unitStatuses = ["completed", "failed", "skipped"] as const;
const fileLimit = 2 * 1024 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function statPath(root: string, relative: string) {
  if (relative.split("/").some(part => !part || part === "." || part === ".." || /[\\:\0]/.test(part))) throw new Error("프로젝트 경로 오류");
  let file = root;
  let info;
  try {
    for (const part of relative.split("/")) {
      file = join(file, part);
      info = await lstat(file);
      if (info.isSymbolicLink()) throw new Error("심볼릭 링크는 조회할 수 없습니다.");
    }
  } catch (error) {
    if (record(error) && error.code === "ENOENT") return null;
    throw error;
  }
  return { file, info };
}

async function read(root: string, relative: string) {
  const item = await statPath(root, relative);
  if (!item) return null;
  if (!item.info?.isFile() || item.info.size > fileLimit) throw new Error("파일 형식 또는 크기 오류");
  const file = await open(item.file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    if (!(await file.stat()).isFile()) throw new Error("일반 파일이 필요합니다.");
    const data = Buffer.alloc(fileLimit + 1);
    let length = 0;
    while (length < data.length) {
      const { bytesRead } = await file.read(data, length, data.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > fileLimit) throw new Error("파일 크기 오류");
    return data.subarray(0, length);
  } finally {
    await file.close();
  }
}

function json(data: Buffer): unknown { return JSON.parse(data.toString("utf8").replace(/^\uFEFF/, "")); }
function yaml(data: Buffer): unknown {
  const document = parseDocument(data.toString("utf8"), { uniqueKeys: true, strict: true });
  if (document.errors.length) throw new Error("YAML 형식 오류");
  return document.toJS({ maxAliasCount: 0 });
}

function text(value: unknown, limit = 300): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit || /[\u0000-\u001f]/.test(value)) throw new Error("문자열 형식 오류");
  return value;
}

function list(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || !value.length || value.length > limit) throw new Error("목록 형식 오류");
  return value;
}

function parseMap(value: unknown, projectId: string) {
  if (!record(value) || value.project !== projectId) throw new Error("프로젝트 지도 불일치");
  const seen = new Set<string>();
  function id(value: unknown, pattern: RegExp, prefix = "") {
    const label = text(value, 100);
    if (!pattern.test(label) || seen.has(prefix + label)) throw new Error("지도 주소 형식 또는 중복 오류");
    seen.add(prefix + label);
    return prefix + label;
  }
  return list(value.processes, 100).map(process => {
    if (!record(process)) throw new Error("Process 형식 오류");
    const processId = id(process.id, /^p[1-9]\d*$/);
    return { id: processId, name: text(process.name), tasks: list(process.tasks, 200).map(task => {
      if (!record(task)) throw new Error("Task 형식 오류");
      const taskId = id(task.id, /^t[1-9]\d*$/, processId + ".");
      return { id: taskId, name: text(task.label), units: list(task.units, 200).map((unit): RpaStandardUnit => {
        if (!record(unit)) throw new Error("Unit 형식 오류");
        if (seen.size > 4000) throw new Error("지도 주소 한도 초과");
        const { side_effect: effect, rerun_safe: rerun, abort_on_fail: abort } = unit;
        if (effect !== "read" && effect !== "none" && effect !== "write_local" && effect !== "write_external") throw new Error("Unit 부수효과 오류");
        if (rerun !== true && rerun !== false && rerun !== "unknown") throw new Error("Unit 재실행 정책 오류");
        if (abort !== undefined && typeof abort !== "boolean") throw new Error("Unit 중단 정책 오류");
        return { id: id(unit.key, /^u[1-9]\d*\.[a-z][a-z0-9_]*$/, taskId + "."), effect, rerun, abort: abort ?? null };
      }) };
    }) };
  });
}

async function readCases(root: string, path: unknown, project: string, units: Set<string>): Promise<RpaStandardCase[]> {
  if (path === undefined) return [];
  const file = await read(root, text(path));
  if (!file) return [];
  const value = yaml(file);
  if (!record(value) || value.schemaVersion !== 1 || !Array.isArray(value.cases) || value.cases.length > 5000) throw new Error("Case 형식 오류");
  const seen = new Set<string>();
  return value.cases.map(item => {
    if (!record(item)) throw new Error("Case 형식 오류");
    const id = text(item.id, 160);
    const unit = text(item.unit, 100);
    const rerun = item.rerun;
    if (!id.startsWith(project + ":") || !units.has(unit) || seen.has(id)
      || (rerun !== "safe" && rerun !== "unsafe" && rerun !== "unknown")) throw new Error("Case 식별 또는 재실행 정책 오류");
    seen.add(id);
    return { id, unit, rerun, condition: text(item.condition, 2000), expected: text(item.expected, 2000), handling: text(item.handling, 2000) };
  });
}

async function readCore(root: string) {
  const data = await read(root, "core/seed-manifest.json");
  if (!data) return { status: "missing" as const, version: null, matched: 0, total: Object.keys(coreFiles).length, differences: [] };
  const manifest = json(data);
  if (!record(manifest) || !record(manifest.files)) throw new Error("Core manifest 형식 오류");
  const files = manifest.files;
  const version = typeof manifest.version === "string" && /^\d+\.\d+\.\d+$/.test(manifest.version) ? manifest.version : null;
  const sessionHash = version ? sessionHashes.get(version) : undefined;
  const names = Object.entries({ ...coreFiles, "core/logger/session.py": sessionHash });
  const matches = await Promise.all(names.map(async ([name, expected]) => {
    const data = await read(root, name);
    return expected !== undefined && files[name] === expected && data !== null && createHash("sha256").update(data).digest("hex") === expected;
  }));
  const matched = matches.filter(Boolean).length;
  const differences = names.filter((_entry, index) => !matches[index]).map(([name]) => name);
  if (manifest.schema_version !== 1 || manifest.seed !== "gmb-rpa-runtime-core" || !sessionHash) differences.push("manifest의 표준 버전 또는 seed");
  if (Object.keys(files).length !== names.length) differences.push("manifest의 관리 파일 개수");
  return { status: differences.length ? "different" as const : "matched" as const, version, matched, total: names.length, differences };
}

async function readRun(root: string, projectId: string): Promise<RpaStandardRun> {
  const directory = await statPath(root, "logs/runs");
  if (!directory) return { state: "missing" as const };
  let latest = "";
  let count = 0;
  for await (const entry of await opendir(directory.file)) {
    if (++count > 1000) return { state: "limit" };
    if ((entry.isDirectory() || entry.isSymbolicLink()) && /^\d{8}T\d{12}Z-[a-f0-9]{8}$/.test(entry.name) && entry.name > latest) latest = entry.name;
  }
  if (!latest) return { state: "missing" as const };
  const folder = "logs/runs/" + latest;
  const data = await read(root, folder + "/result.json");
  if (!data) return { state: "unfinished" as const, id: latest };
  const result = json(data);
  if (!record(result) || result.schema_version !== 1 || (typeof result.seed_version !== "string" || !sessionHashes.has(result.seed_version)) || result.run_id !== latest
    || (result.project !== projectId && result.project !== basename(root))) throw new Error("실행 결과 식별 오류");
  const status = runStatuses.find(value => value === result.status);
  const startedAt = text(result.started_at, 50);
  const finishedAt = text(result.finished_at, 50);
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (!status || !Number.isFinite(start) || !Number.isFinite(finish) || finish < start
    || typeof result.process_id !== "string" || !/^(p[1-9]\d*)?$/.test(result.process_id)
    || (result.error !== null && typeof result.error !== "string")
    || typeof result.exit_code !== "number" || !Number.isInteger(result.exit_code)
    || !Array.isArray(result.units) || result.units.length > 5000) throw new Error("실행 결과 형식 오류");
  const units = result.units.map(unit => {
    if (!record(unit)) throw new Error("Unit 실행 결과 형식 오류");
    const id = text(unit.unit_id, 100);
    const status = unitStatuses.find(value => value === unit.status);
    const seconds = unit.elapsed_seconds;
    if (!/^p[1-9]\d*\.t[1-9]\d*\.u[1-9]\d*\.[a-z][a-z0-9_]*$/.test(id) || id.split(".").slice(0, 2).join(".") !== unit.task_id
      || !status || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0
      || (unit.cause !== null && typeof unit.cause !== "string") || (unit.error !== null && typeof unit.error !== "string")) throw new Error("Unit 실행 결과 값 오류");
    return { id, status, seconds };
  });
  const logs = await Promise.all(["result.json", "events.jsonl", "developer.log", "errors.log", "steps.txt"].map(async name => ({
    name, present: (await statPath(root, folder + "/" + name))?.info?.isFile() === true,
  })));
  return { state: "observed" as const, id: latest, status, finishedAt, exitCode: result.exit_code, units, logs };
}

export async function readRpaStandard(root: string): Promise<RpaStandardSnapshot> {
  const data = await read(root, "rpa-workspace.json");
  if (!data) return null;
  const profile = json(data);
  if (!record(profile) || profile.schemaVersion !== 1 || profile.standardVersion !== "1.0.0") throw new Error("지원하는 RPA 개발 프로필이 필요합니다.");
  const projectId = text(profile.projectId, 100);
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u.test(projectId)) throw new Error("프로젝트 ID 형식 오류");
  const map = await read(root, text(profile.map));
  if (!map) throw new Error("RPA 지도가 없습니다.");
  const processes = parseMap(yaml(map), projectId);
  const units = new Set(processes.flatMap(process => process.tasks.flatMap(task => task.units.map(unit => unit.id))));
  const [core, run, cases] = await Promise.all([
    readCore(root).catch(() => ({ status: "invalid" as const, version: null, matched: 0, total: Object.keys(coreFiles).length, differences: [] })),
    readRun(root, projectId).catch(() => ({ state: "invalid" as const })),
    readCases(root, profile.cases, projectId, units).catch(() => null),
  ]);
  return { projectId, standardVersion: "1.0.0", coreVersion: core.version ?? coreVersion, processes, core, run, cases };
}
