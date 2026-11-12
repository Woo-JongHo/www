import type { SpawnOptionsWithoutStdio } from "node:child_process";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }

const root     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..") ;
const evidence = path.join   (root, ".www", "evidence"                          ) ;
await fs.mkdir(evidence, { recursive: true });
const directory = await fs.mkdtemp(path.join(evidence, "ecosystem-"));

function run(command: string, args: string[], options: SpawnOptionsWithoutStdio = {}): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...options }) ;
    let output  = ""                                                                                 ;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command}: 검증 실행 시간이 초과되었습니다.`));
    }, 90_000);
    for (const stream of [child.stdout, child.stderr]) stream?.on("data", (chunk) => {
      output = (output + chunk.toString()).slice(-2_000_000);
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal) reject(new Error(`${command}: 종료 ${code}, 시그널 ${signal}\n${output}`));
      else resolve(output);
    });
  });
}

try {
  await Promise.all([
    run("npm", ["run", "typecheck"]).then((output) => fs.writeFile(path.join(directory, "typecheck.log"), output)),
    run("bun", ["test", "test/ecosystem.test.ts"]).then((output) => fs.writeFile(path.join(directory, "model-test.log"), output)),
  ]);
  await fs.writeFile(path.join(directory, "build.log"), await run("npm", ["run", "build"]));
  const reportPath = path.join(directory, "electron-probe.json");
  const binary = process.platform === "darwin"
    ? path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron")
    : process.platform === "win32"
      ? path.join(root, "node_modules/electron/dist/electron.exe")
      : path.join(root, "node_modules/electron/dist/electron");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    WWW_CODEX_BIN       : path.join(root, "test/fixtures/fake-app-server.ts") ,
    WWW_PROBE_PATH      : reportPath                                          ,
    WWW_PROBE_WORKSPACE : root                                                ,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.WWW_NATIVE_PROBE;
  delete env.WWW_PROBE_DEVELOPMENT_WORK_ID;
  delete env.WWW_PROBE_EXPECT_DEVELOPMENT_COMPLETE;
  await fs.writeFile(path.join(directory, "electron.log"), await run(binary, [root, `--user-data-dir=${path.join(directory, "profile")}`], { env }));
  const value: unknown = JSON.parse(await fs.readFile(reportPath, "utf8"));
  if (!object(value)) throw new Error("Electron 검증 보고서 객체가 필요합니다.");
  const report: Record<string, unknown> = value;
  if (report.error) throw new Error(String(report.error));
  for (const field of ["ecosystemNavigation", "ecosystemKeyboardSelection", "ecosystemSourceSearch", "ecosystemDraftAndReadingPositionPreserved", "approvalRoundtrip", "interruptStatus", "manualCommandCollapsePreserved", "historicalScrollPreserved"]) {
    const expected = field === "interruptStatus" ? "interrupted" : true;
    if (report[field] !== expected) throw new Error(`Electron 검증 결과가 일치하지 않습니다: ${field}`);
  }
  console.log(JSON.stringify({ result: "passed", report: path.relative(root, reportPath), screenshot: path.relative(root, path.join(directory, "electron-chat.png")), coverage: "실제 Electron 제어·합성 Native fixture·구조 모델·타입·번들" }));
} catch (error) {
  await fs.writeFile(path.join(directory, "failure.txt"), String(error));
  console.error(String(error));
  process.exitCode = 1;
}
