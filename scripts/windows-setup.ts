import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") throw new Error("Windows 네이티브 Node에서 실행해야 합니다.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of ["www-spec", "www-design", "www-build", "www-diagnose", "www-verify", "www-commit"]) {
  const link      = join        (root, ".agents", "skills", name) ;
  const target    = join        (  root, "skills", "www", name  ) ;
  const canonical = realpathSync(            target             ) ;
  if (!canonical.startsWith(`${realpathSync(root)}${sep}`)) throw new Error(`정본이 저장소 밖에 있습니다: ${name}`);
  const stat     = lstatSync(link)            ;
  const expected = `../../skills/www/${name}` ;
  if (stat.isSymbolicLink()) {
    if (realpathSync(link) !== canonical) throw new Error(`정본과 다른 발견 링크: ${name}`);
    if (readlinkSync(link).replace(/\\/g, "/") !== expected) throw new Error(`기존 발견 링크를 보존합니다. 상대 링크인지 확인하세요: ${name}`);
    continue;
  }
  if (!stat.isFile()) throw new Error(`사용자 변경을 보존합니다. 발견 항목 확인 필요: ${name}`);
  const original = readFileSync(link, "utf8");
  if (original.trim() !== expected) throw new Error(`사용자 변경을 보존합니다. 발견 항목 확인 필요: ${name}`);
  // core.symlinks=false checkout의 정확한 Git 링크 텍스트만 상대 링크로 전환한다.
  unlinkSync(link);
  try { symlinkSync(expected, link, "dir"); }
  catch (error) {
    writeFileSync(link, original, { flag: "wx" });
    throw new Error(`발견 심볼릭 링크 생성 실패: ${name}. 원래 링크 텍스트를 복구했습니다. 시스템 설정은 바꾸지 않습니다.`, { cause: error });
  }
}
const current = spawnSync("git.exe", ["-C", root, "config", "--local", "--get", "core.symlinks"], { encoding: "utf8", shell: false });
if (current.error) throw current.error;
if (current.status !== 0 && current.status !== 1) throw new Error("저장소 로컬 심볼릭 링크 설정 조회 실패");
if (current.stdout.trim() !== "true") {
  const configuration = spawnSync("git.exe", ["-C", root, "config", "--local", "core.symlinks", "true"], { stdio: "inherit", shell: false });
  if (configuration.error) throw configuration.error;
  if (configuration.status !== 0) throw new Error("저장소 로컬 심볼릭 링크 설정 실패");
}
console.log("Windows 상대 발견 링크와 저장소 로컬 설정 확인 완료");
