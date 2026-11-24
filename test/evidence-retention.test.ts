import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cleanVerificationCaches, moveArtifact, planArchive, restoreArtifact, type ArchiveTransport } from "../scripts/evidence-retention";

const roots: string[] = [];
const remote = "drive:WWW/archive";
const old = ".www/evidence/chat-ui-old";
const newer = ".www/evidence/chat-ui-new";
const screenshot = `${old}/screen.png`;

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "www-retention-"));
  roots.push(root);
  await mkdir(path.join(root, "docs/work"), { recursive: true });
  const create = async (name: string, time: number, scope = "full", passed = true) => {
    const run = path.join(root, name);
    await mkdir(run, { recursive: true });
    for (const [file, value] of [["screen.png", "original"], ["summary.json", JSON.stringify({ result: passed ? "passed" : "failed", scope, checks: ["검사 A"] })]] as const) {
      const target = path.join(run, file);
      await writeFile(target, value);
      await utimes(target, time, time);
    }
  };
  const now = Date.now() / 1000;
  await create(old, now - 10);
  return { root, create, now };
}

function memoryTransport(corrupt = false): ArchiveTransport {
  const objects = new Map<string, Buffer>();
  return {
    async put(local, target) { objects.set(target, corrupt ? Buffer.from("corrupted") : await readFile(local)); },
    async fingerprint(target) {
      const bytes = objects.get(target);
      if (!bytes) throw Error("원격 복사본 없음");
      return { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    },
    async get(target, local) {
      const bytes = objects.get(target);
      if (!bytes) throw Error("원격 복사본 없음");
      await writeFile(local, bytes);
    },
  };
}

test("검증 프로필의 캐시만 지우고 상태 파일과 외부 링크를 보존한다", async () => {
  const { root } = await fixture();
  const profile = path.join(root, old, "profile");
  await mkdir(path.join(profile, "Default", "Code Cache"), { recursive: true });
  await symlink(path.join(root, "docs"), path.join(profile, "GPUCache"));
  await writeFile(path.join(profile, "Preferences"), "settings");
  expect(await cleanVerificationCaches(path.dirname(profile))).toBe(1);
  expect(await readFile(path.join(profile, "Preferences"), "utf8")).toBe("settings");
  expect((await lstat(path.join(profile, "GPUCache"))).isSymbolicLink()).toBe(true);
  await expect(lstat(path.join(profile, "Default", "Code Cache"))).rejects.toThrow();
});

test("날짜와 관계없이 후속 동일 범위 성공과 참조 여부로 후보를 고른다", async () => {
  const { root, create, now } = await fixture();
  await create(".www/evidence/chat-ui-scoped", now - 4, "slash-only");
  await create(".www/evidence/chat-ui-failed", now - 3, "full", false);
  expect(await planArchive(root)).toEqual([]);
  await create(newer, now - 2);
  expect(await planArchive(root)).toEqual([{ path: screenshot, bytes: 8, newerRun: "chat-ui-new" }]);
  const receipts = path.join(root, ".www/evidence/work-123");
  await mkdir(receipts);
  await writeFile(path.join(receipts, "receipt.json"), JSON.stringify({ path: screenshot }));
  expect(await planArchive(root)).toEqual([]);
  await rm(path.join(receipts, "receipt.json"));
  await writeFile(path.join(root, "docs/work/verification.md"), `검증 근거 [화면](${screenshot})`);
  expect(await planArchive(root)).toEqual([]);
});

test("원격 데이터가 다르면 원본을 유지하고 성공한 이동은 원래 경로로 복원한다", async () => {
  const { root, create, now } = await fixture();
  await create(newer, now - 2);
  const source = path.join(root, screenshot);
  await expect(moveArtifact(root, screenshot, remote, memoryTransport(true))).rejects.toThrow("원본과 다릅니다");
  expect(await readFile(source, "utf8")).toBe("original");
  const transport = memoryTransport();
  await moveArtifact(root, screenshot, remote, transport);
  await expect(lstat(source)).rejects.toThrow();
  expect(await readFile(path.join(root, old, "summary.json"), "utf8")).toContain("passed");
  await restoreArtifact(root, screenshot, remote, transport);
  expect(await readFile(source, "utf8")).toBe("original");
  await expect(restoreArtifact(root, screenshot, remote, transport)).rejects.toThrow("덮어쓰지 않습니다");
});
