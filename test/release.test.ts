/**
 * @verifies RESP-NATIVE-BUILD-INFO
 * @verifies RESP-TOOLING-BUNDLE
 */
import { test, expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, chmodSync, rmSync, writeFileSync, readFileSync, readdirSync, mkdirSync, symlinkSync, cpSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { verify, assertBuiltSource, releaseArtifacts, releaseCheck, assertRelease, buildInfo } from "../scripts/release.ts";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "www-version-test-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-b", "main"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
  writeFileSync(join(root, "seed"), "base"); git("add", "."); git("commit", "-m", "base");
  const base = git("rev-parse", "HEAD");
  writeFileSync(join(root, "package.json"), JSON.stringify({ releaseBase: base })); git("add", "."); git("commit", "-m", "config");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  return { root, git, dispose: () => rmSync(root, { recursive: true, force: true }) };
}
test("동일 커밋 식별과 dirty digest, 태그 검증", () => {
  const f = fixture();
  try {
    const clean = buildInfo(f.root);
    expect(clean.version).toBe("0.1.1"); expect(clean.dirty).toBe(false); expect(buildInfo(f.root)).toEqual(clean);
    assertRelease(clean, "v0.1.1"); expect(() => assertRelease(clean, "v0.1.2")).toThrow("태그");
    writeFileSync(join(f.root, "new.ts"), "export const n = 1;");
    const dirty = buildInfo(f.root); expect(dirty.version).toBe(clean.version); expect(dirty.sourceDigest).not.toBe(clean.sourceDigest); expect(dirty.label).toContain("dirty");
    expect(() => assertRelease(dirty)).toThrow("dirty");
    writeFileSync(join(f.root, "new.ts"), "export const n = 2;"); expect(buildInfo(f.root).sourceDigest).not.toBe(dirty.sourceDigest);
    f.git("add", "."); f.git("commit", "-m", "next"); expect(buildInfo(f.root).version).toBe("0.1.2");
  } finally { f.dispose(); }
});
test("merge의 옆가지 커밋은 버전 거리에 포함하지 않는다", () => {
  const f = fixture();
  try {
    f.git("checkout", "-b", "feature"); writeFileSync(join(f.root, "feature"), "1"); f.git("add", "."); f.git("commit", "-m", "feature");
    f.git("checkout", "main"); f.git("merge", "--no-ff", "feature", "-m", "merge");
    expect(buildInfo(f.root).version).toBe("0.1.2");
    writeFileSync(join(f.root, "package.json"), JSON.stringify({ releaseBase: f.git("rev-parse", "feature") }));
    expect(() => buildInfo(f.root)).toThrow("first-parent");
  } finally { f.dispose(); }
});
test("shallow 이력은 명시적으로 거부한다", () => {
  const f = fixture(); const clone = mkdtempSync(join(tmpdir(), "www-shallow-"));
  try {
    execFileSync("git", ["clone", "--depth", "1", `file://${f.root}`, clone], { stdio: "pipe" });
    expect(() => buildInfo(clone)).toThrow("shallow");
  } finally { f.dispose(); rmSync(clone, { recursive: true, force: true }); }
});
test("실제 Bun 번들의 빌드 상수가 식별 객체를 보존한다", async () => {
  const f = fixture();
  try {
    const info = buildInfo(f.root);
    const result = await Bun.build({ entrypoints: [join(import.meta.dir, "../src/build-info.ts")], target: "browser", format: "cjs", define: { __WWW_BUILD_INFO__: JSON.stringify(info) } });
    expect(result.success).toBe(true);
    const output = result.outputs[0];
    if (!output) throw Error("번들 출력 누락");
    const context = { module: { exports: {} } };
    runInNewContext(await output.text(), context);
    expect(context.module.exports).toEqual({ appBuildInfo: info });
    chmodSync(join(f.root, "seed"), 0o600);
    expect(buildInfo(f.root)).toEqual(info);
  } finally { f.dispose(); }
});

test("릴리즈는 실제 태그 HEAD와 main first-parent를 대조한다", () => {
  const f = fixture();
  try {
    const info = releaseCheck(f.root); // 태그 없는 main CD
    f.git("tag", `v${info.version}`);
    expect(releaseCheck(f.root, `v${info.version}`)).toEqual(info);
    expect(() => releaseCheck(f.root, "v0.1.99")).toThrow("태그");
    f.git("tag", "-f", `v${info.version}`, "HEAD~1");
    expect(() => releaseCheck(f.root, `v${info.version}`)).toThrow("HEAD");
    f.git("checkout", "-b", "side");
    writeFileSync(join(f.root, "side"), "side"); f.git("add", "."); f.git("commit", "-m", "side");
    const side = buildInfo(f.root);
    f.git("tag", `v${side.version}`);
    expect(() => releaseCheck(f.root, `v${side.version}`)).toThrow("first-parent");
    f.git("checkout", "main"); f.git("merge", "--no-ff", "side", "-m", "merge");
    f.git("update-ref", "refs/remotes/origin/main", "HEAD"); f.git("checkout", "side");
    expect(() => releaseCheck(f.root, `v${side.version}`)).toThrow("first-parent");
  } finally { f.dispose(); }
});

test("빌드 뒤 dirty 변경과 새 커밋, 다른 번들 식별을 거부한다", () => {
  const f = fixture();
  try {
    const info = buildInfo(f.root);
    assertBuiltSource(info, buildInfo(f.root), info);
    expect(() => assertBuiltSource(info, info, { ...info, version: "0.1.9" })).toThrow("식별");
    writeFileSync(join(f.root, "seed"), "changed");
    expect(() => assertBuiltSource(info, buildInfo(f.root), info)).toThrow("dirty");
    f.git("add", "."); f.git("commit", "-m", "changed");
    expect(() => assertBuiltSource(info, buildInfo(f.root), info)).toThrow("식별");
  } finally { f.dispose(); }
});

test("실제 ZIP의 manifest·SHA256SUMS와 실행별 출력 격리", () => {
  const f = fixture(); const stage = mkdtempSync(join(tmpdir(), "www-zip-test-"));
  try {
    writeFileSync(join(stage, "payload"), "실제 배포 바이트");
    if (process.platform === "win32") {
      execFileSync("tar.exe", ["-caf", "artifact.zip", "payload"], { cwd: stage });
    } else {
      execFileSync("zip", ["-q", "artifact.zip", "payload"], { cwd: stage });
    }
    const zip = join(stage, "artifact.zip"); const bytes = readFileSync(zip);
    const sha = createHash("sha256").update(bytes).digest("hex");
    const info = buildInfo(f.root); const parent = join(stage, "output");
    const first = releaseArtifacts(parent, info, zip);
    writeFileSync(join(first, "old.zip"), "previous");
    const second = releaseArtifacts(parent, info, zip);
    expect(second).not.toBe(first);
    const filename = `WWW-${info.version}-darwin-arm64.zip`;
    expect(readdirSync(second).sort()).toEqual(["SHA256SUMS", filename, "manifest.json"].sort());
    expect(readFileSync(join(second, filename)).equals(bytes)).toBe(true);
    const manifest = JSON.parse(readFileSync(join(second, "manifest.json"), "utf8"));
    expect(manifest.files).toEqual([{ name: filename, size: bytes.length, sha256: sha }]);
    expect(manifest.commit).toBe(info.commit);
    expect(manifest.checks).toEqual(["check:environment", "check:architecture", "check:source", "check:workflow", "typecheck", "test", "build"]);
    expect(readFileSync(join(second, "SHA256SUMS"), "utf8")).toBe(`${sha}  ${filename}\n`);
  } finally { f.dispose(); rmSync(stage, { recursive: true, force: true }); }
});

test("gitlink 디렉터리·symlink·git 파일은 digest에서 읽을 수 있다", () => {
  const f = fixture();
  try {
    const sha = f.git("rev-parse", "HEAD");
    mkdirSync(join(f.root, "module"));
    f.git("update-index", "--add", "--cacheinfo", `160000,${sha},module`);
    mkdirSync(join(f.root, ".agents"));
    symlinkSync("../seed", join(f.root, ".agents/link"));
    writeFileSync(join(f.root, ".agents/git-file"), "gitdir: ../.git");
    expect(buildInfo(f.root).sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    const before = buildInfo(f.root).sourceDigest;
    rmSync(join(f.root, ".agents/link")); symlinkSync("../package.json", join(f.root, ".agents/link"));
    expect(buildInfo(f.root).sourceDigest).not.toBe(before);
  } finally { f.dispose(); }
});

test("setup-ci는 기존 설정을 실패로 보존한다", () => {
  const stage = mkdtempSync(join(tmpdir(), "www-ci-test-"));
  try {
    mkdirSync(join(stage, "scripts")); mkdirSync(join(stage, ".www"));
    cpSync(join(import.meta.dir, "../scripts/setup-ci.ts"), join(stage, "scripts/setup-ci.ts"));
    writeFileSync(join(stage, ".www/development.local.json"), "preserve-me");
    expect(() => execFileSync(process.execPath, [join(stage, "scripts/setup-ci.ts")], { stdio: "pipe" })).toThrow();
    expect(readFileSync(join(stage, ".www/development.local.json"), "utf8")).toBe("preserve-me");
    expect(existsSync(join(stage, "plugin/runtime.json"))).toBe(false);
  } finally { rmSync(stage, { recursive: true, force: true }); }
});


test("구조 현재성 검사 실패는 build 실행 전에 전파된다", () => {
  const f = fixture();
  try {
    const config = JSON.parse(readFileSync(join(f.root, "package.json"), "utf8"));
    config.scripts = {
      "check:environment": "node -e \"process.exit(0)\"",
      "check:architecture": "node -e \"process.exit(17)\"",
      build: "node -e \"require('node:fs').writeFileSync('built', 'unexpected')\"",
    };
    writeFileSync(join(f.root, "package.json"), JSON.stringify(config));
    expect(() => verify(f.root)).toThrow();
    expect(existsSync(join(f.root, "built"))).toBe(false);
  } finally { f.dispose(); }
});
