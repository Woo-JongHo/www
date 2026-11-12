import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveNativeCodex } from "../src/native-command.ts";

test("현재 OS의 Codex 실행 계약과 없는 Windows 실행 파일을 구분한다", () => {
  if (process.platform !== "win32") {
    assert.equal(resolveNativeCodex("/a/한글 경로/codex"), "/a/한글 경로/codex");
    return;
  }
  assert.throws(() => resolveNativeCodex("C:\\없는 폴더\\없는 codex.exe"), /네이티브 exe/);
});

test("Windows npm shim은 실행하지 않고 네이티브 exe를 찾아 한글·공백 argv를 보존한다", async (t) => {
  if (process.platform !== "win32") {
    assert.equal(resolveNativeCodex("codex.cmd"), "codex.cmd");
    return;
  }
  const directory = await mkdtemp(path.join(tmpdir(), "www 한글 실행 "));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const shim   = path.join(directory, "codex.cmd"                                                                                                                             ) ;
  const native = path.join(directory, "node_modules", "@openai", "codex", "node_modules", "@openai", "codex-win32-x64", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe") ;
  await writeFile(shim, "@echo 이 shim을 실행하면 안 됩니다\r\nexit /b 99\r\n");
  await mkdir(path.dirname(native), { recursive: true });
  await copyFile(process.execPath, native);
  assert.equal(resolveNativeCodex(shim), native);
  const value  = "한글 공백 & literal"                                                                                                      ;
  const result = spawnSync(resolveNativeCodex(shim), ["-e", "console.log(process.argv.at(-1))", value], { encoding: "utf8", shell: false }) ;
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), value);
});
