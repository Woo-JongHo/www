import { packager } from "@electron/packager";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") throw new Error("Windows 산출물은 Windows 네이티브 환경에서 제작합니다.");
const root  = resolve  (                dirname(fileURLToPath(import.meta.url)), ".."                ) ;
const build = spawnSync("bun.exe", ["run", "build.ts"], { cwd: root, stdio: "inherit", shell: false }) ;
if (build.error) throw build.error;
if (build.status !== 0) throw new Error(`빌드 실패: ${build.status ?? build.signal}`);
const outputs = await packager({
  dir       : root                                      ,
  name      : "WWW-Electron"                            ,
  platform  : "win32"                                   ,
  arch      : "x64"                                     ,
  out       : resolve(root, ".www", "packages")         ,
  overwrite : true                                      ,
  prune     : true                                      ,
  ignore    : /^\/(spikes|test|docs|\.git|\.www)(\/|$)/ ,
});
for (const output of outputs) console.log(`Windows 패키지: ${output}`);
