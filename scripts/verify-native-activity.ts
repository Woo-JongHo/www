#!/usr/bin/env node
// 실제 Electron과 합성 subprocess의 활동 표시 연결을 검사한다. 실제 모델·계정 검증은 아니다.
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const uiOnly = process.argv.slice(2).includes("--ui-only");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await fs.mkdir(path.join(root, ".www/evidence"), { recursive: true });
const directory = await fs.mkdtemp(path.join(root, ".www/evidence/native-activity-"));

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function run(name: string, command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const stdout = await fs.open(path.join(directory, `${name}.stdout.log`), "w") ;
  const stderr = await fs.open(path.join(directory, `${name}.stderr.log`), "w") ;
  try {
    await new Promise<void>((resolve, reject) => {
      const child  = spawn(command, args, { cwd: root, env, stdio: ["ignore", stdout.fd, stderr.fd] }) ;
      let timedOut = false                                                                             ;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, 150_000);
      const forced = setTimeout(() => child.kill("SIGKILL"), 155_000);
      child.once("error", (error) => { clearTimeout(timer); clearTimeout(forced); reject(error); });
      child.once("close", (code, signal) => {
        clearTimeout(timer);
        clearTimeout(forced);
        if (code === 0 && !signal && !timedOut) resolve();
        else reject(new Error(`${name}: 종료 ${code}, signal=${signal}, timeout=${timedOut}`));
      });
    });
  } finally {
    await stdout.close();
    await stderr.close();
  }
}

try {
  if (process.platform === "win32") throw new Error("이 합성 fixture의 직접 실행은 Windows 실기에서 지원·검증하지 않았습니다.");
  if (uiOnly) {
    await run("focused", "bun", ["test", "test/native-activity.test.ts", "test/projection.test.ts", "--timeout", "30000"]);
    await run("build", "npm", ["run", "build"]);
  } else {
    await run("repository", "npm", ["run", "check"]);
  }
  const fixture    = await fs.mkdtemp(path.join(directory, "workspace-")) ;
  const reportPath = path.join(directory, "probe.json")                   ;
  const binary = process.platform === "darwin"
    ? path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron")
    : path.join(root, "node_modules/electron/dist/electron");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    WWW_CODEX_BIN       : path.join(root, "test/fixtures/activity-app-server.ts") ,
    WWW_PROBE_PATH      : reportPath                                              ,
    WWW_PROBE_WORKSPACE : fixture                                                 ,
    WWW_PROBE_ACTIVITY  : "1"
  };
  for (const key of ["ELECTRON_RUN_AS_NODE", "WWW_NATIVE_PROBE", "WWW_PROBE_REPORTS", "WWW_PROBE_NATIVE_REPORTS", "WWW_PROBE_REPORT_JUDGE_BIN", "WWW_PROBE_DEVELOPMENT_WORK_ID", "WWW_PROBE_EXPECT_DEVELOPMENT_COMPLETE"]) delete env[key];
  await run("electron", binary, [root, `--user-data-dir=${path.join(directory, "profile")}`], env);
  const result: unknown = JSON.parse(await fs.readFile(reportPath, "utf8"));
  if (!object(result)) throw new Error("Electron probe 객체가 없습니다.");
  if (result.error) throw new Error(String(result.error));
  if (!object(result.nativeActivity)) throw new Error("활동 시나리오 결과가 없습니다.");
  for (const key of ["turnGrouping", "skillsObserved", "hooksObserved", "usageNotDuplicated", "modelRerouted", "historySelectionPreserved", "privateReasoningHidden"]) {
    if (result.nativeActivity[key] !== true) throw new Error(`활동 시나리오 실패: ${key}`);
  }
  const artifacts = object(result.activityArtifacts) ? result.activityArtifacts : {};
  if (
       typeof artifacts.width    !== "number"
    || artifacts.width           <=  0
    || artifacts.overflow        !== false
    || artifacts.reducedMotion   !== true
    || artifacts.beaconAnimation !== "none"
  ) throw new Error("좁은 활동 패널·모션 축소 관측이 없습니다.");
  const captures = (await fs.readdir(directory)).filter((name) => name.endsWith(".png"));
  if (captures.length === 0) throw new Error("Electron 화면 캡처가 없습니다.");
  for (const capture of captures) {
    if ((await fs.stat(path.join(directory, capture))).size === 0) throw new Error(`화면 캡처가 비었습니다: ${capture}`);
  }
  const summary = {
    result            : "passed"                                                                                                                                               ,
    mode              : uiOnly ? "ui-only" : "full"                                                                                                                            ,
    typecheck         : uiOnly ? "not_run" : "passed"                                                                                                                          ,
    evidence          : path.relative(root, directory)                                                                                                                         ,
    coverage          : `실제 Electron + 합성 Native subprocess. 실제 모델·계정·Windows 실기는 검증하지 않음${uiOnly ? ". 명시 UI 전용 실행으로 전체 타입검사를 제외함" : ""}` ,
    nativeActivity    : result.nativeActivity                                                                                                                                  ,
    activityArtifacts : artifacts                                                                                                                                              ,
    captures
  };
  await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} catch (error) {
  await fs.writeFile(path.join(directory, "failure.txt"), String(error));
  console.error(`${String(error)}\n증거: ${directory}`);
  process.exitCode = 1;
}
