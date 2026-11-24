/**
 * @architecture arch.development.evidence.verification
 * @implements RESP-DEVELOPMENT-EVIDENCE-VERIFICATION
 */
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { link, lstat, mkdir, readFile, readdir, realpath, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);
const evidencePath = ".www/evidence";
const runName = /^(?:chat-ui|home-(?:empty|multiple))-[-\da-z]+$/i;
const artifactName = /^(?!.*(?:receipt|summary|fail|partial|manifest))[-\w.]+\.(?:png|json|jsonl|log|stdout|stderr|html|txt)$/i;
const caches = ["Cache", "Code Cache", "GPUCache", "DawnGraphiteCache", "DawnWebGPUCache", "ShaderCache"];

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function fileInfo(file: string) {
  try { return await lstat(file); }
  catch (error) { if (!missing(error)) throw error; return null; }
}

export async function cleanVerificationCaches(directory: string): Promise<number> {
  const run = await realpath(directory);
  if (!runName.test(path.basename(run)) || path.basename(path.dirname(run)) !== "evidence"
    || path.basename(path.dirname(path.dirname(run))) !== ".www") {
    throw Error("격리된 채팅·홈 검증 폴더만 정리할 수 있습니다.");
  }
  const profile = path.join(run, "profile");
  if (!(await fileInfo(profile))?.isDirectory()) return 0;
  let removed = 0;
  for (const parent of [profile, path.join(profile, "Default")]) {
    if (!(await fileInfo(parent))?.isDirectory()) continue;
    for (const name of caches) {
      const cache = path.join(parent, name);
      if (!(await fileInfo(cache))?.isDirectory()) continue;
      await rm(cache, { recursive: true });
      removed++;
    }
  }
  return removed;
}

export async function stopVerificationApp(child: ChildProcess): Promise<void> {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  let closed = false;
  const finished = new Promise<void>(resolve => {
    child.once("close", () => { closed = true; resolve(); });
  });
  child.kill("SIGTERM");
  await Promise.race([finished, pause(3000, undefined, { ref: false })]);
  if (closed) return;
  child.kill("SIGKILL");
  await Promise.race([finished, pause(3000, undefined, { ref: false })]);
  if (!closed) throw Error("검증 앱 종료를 확인하지 못했습니다.");
}

interface Fingerprint { sha256: string; bytes: number }
interface Candidate { path: string; bytes: number; newerRun: string }
interface ArchiveReceipt extends Fingerprint { path: string; remote: string }
export interface ArchiveTransport {
  put(local: string, remote: string): Promise<void>;
  fingerprint(remote: string): Promise<Fingerprint>;
  get(remote: string, local: string): Promise<void>;
}

async function fingerprint(stream: AsyncIterable<Buffer>): Promise<Fingerprint> {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) { hash.update(chunk); bytes += chunk.byteLength; }
  return { sha256: hash.digest("hex"), bytes };
}

const localFingerprint = (file: string) => fingerprint(createReadStream(file));
const same = (left: Fingerprint, right: Fingerprint) => left.sha256 === right.sha256 && left.bytes === right.bytes;

async function referencedRuns(root: string): Promise<Set<string>> {
  const refs = new Set<string>();
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      if (!entry.isFile() || !/\.(?:md|json|html)$/i.test(entry.name)) continue;
      const body = await readFile(file, "utf8");
      for (const match of body.matchAll(/\b((?:chat-ui|home-(?:empty|multiple))-[-\da-z]+)/gi)) refs.add(match[1]!.toLowerCase());
    }
  };
  await visit(path.join(root, "docs/work"));
  const evidence = path.join(root, evidencePath);
  for (const entry of await readdir(evidence, { withFileTypes: true })) {
    if (entry.isDirectory() && /^work-[\da-f-]+$/i.test(entry.name)) await visit(path.join(evidence, entry.name));
  }
  return refs;
}

function localArtifact(root: string, relative: string): string {
  const [dot, evidence, run, file, extra] = relative.split("/");
  if (dot !== ".www" || evidence !== "evidence" || !run || !runName.test(run) || !file || !artifactName.test(file) || extra !== undefined) {
    throw Error("채팅·홈 검증 산출물의 저장소 상대 경로를 지정하세요.");
  }
  return path.join(root, relative);
}

async function successfulRun(directory: string) {
  const file = path.join(directory, "summary.json");
  const stat = await fileInfo(file);
  if (!stat?.isFile() || await fileInfo(path.join(directory, "failure.txt"))
    || await fileInfo(path.join(directory, "partial-checks.json"))) return null;
  const bytes = await readFile(file, "utf8");
  let payload: unknown;
  try { payload = JSON.parse(bytes); }
  catch (error) { if (error instanceof SyntaxError) return null; throw error; }
  if (!payload || typeof payload !== "object") return null;
  const summary = Object.fromEntries(Object.entries(payload));
  if (!(summary.result === "passed" || summary.ok === true)
    || !Array.isArray(summary.checks) || !summary.checks.length
    || !summary.checks.every((check: unknown) => typeof check === "string")) return null;
  const kind = path.basename(directory).startsWith("chat-ui-") ? "chat" : "home";
  const scope = JSON.stringify([kind, summary.scope, summary.mode, summary.coverage, summary.fixture, summary.limits, summary.limitations, summary.checks]);
  return { name: path.basename(directory), directory, scope, finished: stat.mtimeMs };
}

export async function planArchive(root: string): Promise<Candidate[]> {
  root = await realpath(root);
  const base = path.join(root, evidencePath);
  if (await realpath(base) !== base) throw Error("증거 디렉터리의 심볼릭 링크는 허용되지 않습니다.");
  const referenced = await referencedRuns(root);
  const runs = [];
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || !runName.test(entry.name)) continue;
    const run = await successfulRun(path.join(base, entry.name));
    if (run) runs.push(run);
  }
  runs.sort((a, b) => b.finished - a.finished || a.name.localeCompare(b.name));
  const latest = new Map<string, (typeof runs)[number]>();
  const candidates: Candidate[] = [];
  for (const run of runs) {
    const newer = latest.get(run.scope);
    if (!newer) { latest.set(run.scope, run); continue; }
    if (newer.finished <= run.finished || referenced.has(run.name.toLowerCase())) continue;
    for (const file of await readdir(run.directory, { withFileTypes: true })) {
      if (!file.isFile() || !artifactName.test(file.name)) continue;
      const stat = await lstat(path.join(run.directory, file.name));
      if (stat.isFile() && stat.mtimeMs <= run.finished) {
        candidates.push({ path: `${evidencePath}/${run.name}/${file.name}`, bytes: stat.size, newerRun: newer.name });
      }
    }
  }
  return candidates.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
}

function receiptFile(root: string, relative: string): string {
  return path.join(root, evidencePath, "archive-index", createHash("sha256").update(relative).digest("hex") + ".json");
}

function remotePath(location: string, hash: string): string {
  if (!/^[\w-]+:[\w./ -]+$/.test(location)
    || location.split(/[:/]/).some(part => part === ".." || part === ".")) {
    throw Error("WWW_EVIDENCE_DRIVE에 Google Drive rclone 원격과 전용 폴더를 지정하세요.");
  }
  return `${location.replace(/\/+$/, "")}/sha256/${hash}.blob`;
}

async function saveReceipt(root: string, receipt: ArchiveReceipt): Promise<void> {
  const file = receiptFile(root, receipt.path);
  await mkdir(path.dirname(file), { recursive: true });
  if (await realpath(path.dirname(file)) !== path.dirname(file)) throw Error("아카이브 영수증 경로가 이동되었습니다.");
  const bytes = JSON.stringify(receipt) + "\n";
  const temp = file + `.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
    await link(temp, file);
  }
  catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"
      && (await fileInfo(file))?.isFile() && await readFile(file, "utf8") === bytes)) throw error;
  } finally { await rm(temp, { force: true }); }
}

export async function moveArtifact(root: string, relative: string, location: string, transport: ArchiveTransport): Promise<ArchiveReceipt> {
  root = await realpath(root);
  const source = localArtifact(root, relative);
  const allowed = async () => {
    if (!(await planArchive(root)).some(item => item.path === relative)
      || await realpath(source) !== source) throw Error("동일 범위의 후속 통과 또는 참조 보호 기준을 충족하지 않습니다.");
  };
  await allowed();
  const original = await localFingerprint(source);
  const remote = remotePath(location, original.sha256);
  await transport.put(source, remote);
  if (!same(original, await transport.fingerprint(remote))) throw Error("Drive 복사본이 로컬 원본과 다릅니다.");
  const receipt = { path: relative, remote, ...original };
  await saveReceipt(root, receipt);
  await allowed();
  if (!same(original, await localFingerprint(source))) throw Error("이동 중 원본이 변경되었습니다.");
  await unlink(source);
  return receipt;
}

export async function restoreArtifact(root: string, relative: string, location: string, transport: ArchiveTransport): Promise<void> {
  root = await realpath(root);
  const target = localArtifact(root, relative);
  const file = receiptFile(root, relative);
  if (await realpath(file) !== file) throw Error("아카이브 영수증 경로가 이동되었습니다.");
  const receipt: Partial<ArchiveReceipt> | null = JSON.parse(await readFile(file, "utf8"));
  if (!receipt || receipt.path !== relative || typeof receipt.sha256 !== "string" || !/^[\da-f]{64}$/.test(receipt.sha256)
    || typeof receipt.bytes !== "number" || !Number.isSafeInteger(receipt.bytes) || receipt.bytes < 0
    || receipt.remote !== remotePath(location, receipt.sha256)) throw Error("아카이브 영수증과 Drive 경로가 일치하지 않습니다.");
  if (await realpath(path.dirname(target)) !== path.dirname(target)) throw Error("원래 증거 경로의 심볼릭 링크는 허용되지 않습니다.");
  if (await fileInfo(target)) throw Error("이미 존재하는 검증 원본은 덮어쓰지 않습니다.");
  const temp = target + `.restore-${randomUUID()}`;
  try {
    await transport.get(receipt.remote, temp);
    if (!same({ sha256: receipt.sha256, bytes: receipt.bytes }, await localFingerprint(temp))) {
      throw Error("복원한 파일의 해시가 영수증과 일치하지 않습니다.");
    }
    await link(temp, target);
  } finally { await rm(temp, { force: true }); }
}

const rclone: ArchiveTransport = {
  async put(local, remote) { await exec("rclone", ["copyto", "--immutable", "--checksum", local, remote]); },
  async get(remote, local) { await exec("rclone", ["copyto", remote, local]); },
  async fingerprint(remote) {
    const child = spawn("rclone", ["cat", remote], { stdio: ["ignore", "pipe", "inherit"] });
    const exit = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    const [hash, code] = await Promise.all([fingerprint(child.stdout), exit]);
    if (code !== 0) throw Error("Drive 복사본을 끝까지 읽지 못했습니다.");
    return hash;
  },
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command = "plan", relative, extra] = process.argv.slice(2);
  try {
    const root = process.cwd();
    if (command === "plan" && !relative) {
      const files = await planArchive(root);
      console.log(JSON.stringify({ files, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }, null, 2));
    } else if ((command === "move" || command === "restore") && relative && !extra) {
      const location = process.env.WWW_EVIDENCE_DRIVE ?? "";
      const result = command === "move"
        ? await moveArtifact(root, relative, location, rclone)
        : await restoreArtifact(root, relative, location, rclone);
      console.log(JSON.stringify(result ?? { restored: relative }));
    } else throw Error("사용법: evidence-retention.ts plan | move <증거 상대 경로> | restore <증거 상대 경로>");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
