import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 소스 언어가 같아도 각 테스트가 사용하는 실행기는 유지한다.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const groups: Record<"bun:test" | "node:test", string[]> = {
  "bun:test" : [],
  "node:test": []
};
// .mjs 시절 Node로 실행하던 테스트는 같은 실행기를 유지한다.
const nodeTests = new Set([
  "skill-library", "windows-native", "workflow-codex", "workflow-contract", "workflow-development",
  "workflow-evidence", "workflow-harness", "workflow-review", "workflow-windows-command", "workflow-work",
].map(name => path.join("test", `${name}.test.ts`)));
const entries = (await readdir(path.join(root, "test"), { recursive: true })).sort();
for (const entry of entries) {
  if (!/\.test\.tsx?$/.test(entry)) continue;
  const file   = path.join("test", entry)                          ;
  const runner = nodeTests.delete(file) ? "node:test" : "bun:test" ;
  groups[runner].push(`./${file}`);
}
if (nodeTests.size) throw new Error(`Node 테스트 파일이 없습니다: ${[...nodeTests].join(", ")}`);
for (const runner of ["bun:test", "node:test"] as const) {
  const files = groups[runner];
  if (!files.length) continue;
  const command = runner === "bun:test" ? "bun" : process.execPath                  ;
  const args    = runner === "bun:test" ? ["test", ...files] : ["--test", ...files] ;
  console.log(`${runner}: ${files.length}개 파일`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.signal || result.status !== 0) process.exit(result.status ?? 1);
}
