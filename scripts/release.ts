/**
 * @architecture arch.tooling.bundle
 * @implements RESP-TOOLING-BUNDLE
 * 커밋 식별·릴리즈 사전조건과 격리된 배포 산출물을 소유한다.
 */
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface BuildInfo {
  version: string;
  commit: string;
  dirty: boolean;
  sourceDigest: string;
  label: string;
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}
export function buildInfo(cwd: string = root): BuildInfo {
  if (git(cwd, ["rev-parse", "--is-shallow-repository"]) !== "false") throw Error("shallow 저장소에서는 버전을 계산할 수 없습니다.");
  const config: unknown = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  if (!config || typeof config !== "object" || !("releaseBase" in config) || typeof config.releaseBase !== "string" || !/^[a-f0-9]{40}$/.test(config.releaseBase)) throw Error("releaseBase 전체 커밋 SHA가 필요합니다.");
  const commit = git(cwd, ["rev-parse", "HEAD"]);
  const history = git(cwd, ["rev-list", "--first-parent", "HEAD"]).split("\n");
  const distance = history.indexOf(config.releaseBase);
  if (distance < 0) throw Error("기준 커밋이 HEAD의 first-parent 이력에 없습니다.");
  const gitlinks = new Map(execFileSync("git", ["ls-files", "--stage", "-z"], { cwd }).toString().split("\0").flatMap((entry) => {
    const match = /^160000 ([a-f0-9]+) 0\t(.+)$/.exec(entry);
    return match?.[1] && match[2] ? [[match[2], match[1]] as const] : [];
  }));
  const paths = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd }).toString().split("\0").filter(Boolean);
  const hash = createHash("sha256");
  for (const file of [...new Set(paths)].sort()) {
    hash.update(JSON.stringify(file));
    const gitlink = gitlinks.get(file);
    if (gitlink) {
      hash.update(`160000${gitlink}\0`);
      try {
        hash.update(git(join(cwd, file), ["rev-parse", "HEAD"]));
        hash.update(execFileSync("git", ["diff", "HEAD", "--binary"], { cwd: join(cwd, file) }));
        hash.update(git(join(cwd, file), ["status", "--porcelain", "--untracked-files=all"]));
      } catch { hash.update("uninitialized"); }
      continue;
    }
    try {
      const stat = lstatSync(join(cwd, file));
      hash.update(stat.isSymbolicLink() ? "120000" : (stat.mode & 0o111) ? "100755" : "100644");
      hash.update(stat.isSymbolicLink() ? readlinkSync(join(cwd, file)) : readFileSync(join(cwd, file)));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") hash.update("missing");
      else throw error;
    }
    hash.update("\0");
  }
  const version = `0.1.${distance}`;
  const dirty = !!git(cwd, ["status", "--porcelain", "--untracked-files=all"]);
  const sourceDigest = hash.digest("hex");
  return { version, commit, dirty, sourceDigest, label: `${version}${dirty ? "-dirty" : ""} · ${commit.slice(0, 8)} · ${sourceDigest.slice(0, 12)}` };
}
export function assertRelease(info: BuildInfo, tag?: string): void {
  if (info.dirty) throw Error("dirty 소스는 릴리즈할 수 없습니다.");
  if (tag !== undefined && tag !== `v${info.version}`) throw Error(`태그는 v${info.version}이어야 합니다.`);
}
/** 태그 생략은 main CD용이며 정식 태그는 정확한 HEAD와 main first-parent를 요구한다. */
export function releaseCheck(cwd: string = root, tag?: string): BuildInfo {
  const info = buildInfo(cwd);
  assertRelease(info, tag);
  const main = git(cwd, ["rev-parse", "--verify", "refs/remotes/origin/main"]);
  if (!git(cwd, ["rev-list", "--first-parent", main]).split("\n").includes(info.commit)) throw Error("HEAD가 origin/main first-parent 이력에 없습니다.");
  if (tag !== undefined && git(cwd, ["rev-parse", `${tag}^{commit}`]) !== info.commit) throw Error("태그와 HEAD가 다릅니다.");
  return info;
}
export function assertBuiltSource(before: BuildInfo, after: BuildInfo, embedded: unknown): void {
  assertRelease(after);
  if (JSON.stringify(before) !== JSON.stringify(after) || JSON.stringify(embedded) !== JSON.stringify(before)) throw Error("빌드 후 소스 또는 번들의 식별이 변경됐습니다.");
}
export const releaseChecks = ["check:environment", "check:architecture", "check:source", "check:workflow", "typecheck", "test", "build"];
/** 실행별 새 디렉터리에 실제 ZIP bytes의 manifest와 checksum을 기록한다. */
export function releaseArtifacts(parent: string, info: BuildInfo, zip: string): string {
  mkdirSync(parent, { recursive: true });
  const output = mkdtempSync(join(parent, `${info.version}-`));
  const filename = `WWW-${info.version}-darwin-arm64.zip`;
  cpSync(zip, join(output, filename));
  const bytes = readFileSync(join(output, filename));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(join(output, "manifest.json"), JSON.stringify({ schemaVersion: 1, ...info, platform: "darwin", arch: "arm64", signed: false, notarized: false, checks: releaseChecks, files: [{ name: filename, size: bytes.length, sha256 }] }, null, 2) + "\n");
  writeFileSync(join(output, "SHA256SUMS"), `${sha256}  ${filename}\n`);
  return output;
}
function run(command: string, args: string[], cwd = root): void {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}
export function verify(cwd: string = root): void {
  for (const script of releaseChecks) run("npm", ["run", script], cwd);
}
export async function packageRelease(): Promise<string> {
  const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
  const info = releaseCheck(root, tag);
  if (process.platform !== "darwin" || process.arch !== "arm64") throw Error("macOS arm64에서 패키징해야 합니다.");
  verify();
  const after = buildInfo();
  assertRelease(after, tag);
  if (after.sourceDigest !== info.sourceDigest || after.commit !== info.commit) throw Error("검사 중 소스가 변경됐습니다.");
  const embedded: unknown = JSON.parse(readFileSync(join(root, "dist/build-info.json"), "utf8"));
  assertBuiltSource(info, after, embedded);
  const stage = mkdtempSync(join(tmpdir(), "www-release-"));

  try {
    cpSync(join(root, "dist"), join(stage, "dist"), { recursive: true });
    writeFileSync(join(stage, "package.json"), JSON.stringify({ name: "www", version: info.version, main: "dist/main.js" }));
    const { packager } = await import("@electron/packager");
    const electron: unknown = JSON.parse(readFileSync(join(root, "node_modules/electron/package.json"), "utf8"));
    if (!electron || typeof electron !== "object" || !("version" in electron) || typeof electron.version !== "string") throw Error("Electron 버전을 확인할 수 없습니다.");
    const packages = await packager({ dir: stage, name: "WWW", platform: "darwin", arch: "arm64", out: join(stage, "packages"), appVersion: info.version, buildVersion: info.version, electronVersion: electron.version, overwrite: true, prune: false, asar: false });
    const directory = packages[0];
    if (!directory) throw Error("Electron 패키지 생성 실패");
    const packagedInfo: unknown = JSON.parse(readFileSync(join(directory, "WWW.app/Contents/Resources/app/dist/build-info.json"), "utf8"));
    if (JSON.stringify(packagedInfo) !== JSON.stringify(info)) throw Error("패키지 빌드 식별이 다릅니다.");
    const finalSource = buildInfo();
    assertRelease(finalSource, tag);
    if (finalSource.sourceDigest !== info.sourceDigest || finalSource.commit !== info.commit) throw Error("패키징 중 소스가 변경됐습니다.");
    const filename = `WWW-${info.version}-darwin-arm64.zip`;
    const zip = join(stage, filename);
    run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", join(directory, "WWW.app"), zip]);
    assertBuiltSource(info, releaseCheck(root, tag), embedded);
    return releaseArtifacts(join(root, ".www", "releases"), info, zip);
  } finally { rmSync(stage, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === "build-info") console.log(JSON.stringify(buildInfo(), null, 2));
  else if (command === "check") console.log(JSON.stringify(releaseCheck(root, process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : process.argv[3]), null, 2));
  else if (command === "verify") verify();
  else if (command === "package") {
    const output = await packageRelease();
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `path=${output}\n`);
    console.log(output);
  }
  else throw Error("사용법: node scripts/release.ts build-info|check|verify|package");
}
