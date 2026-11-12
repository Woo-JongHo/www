import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureWorkReport, publishWorkReport, readWorkReport } from "./workflow/reports.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await fs.mkdir(path.join(root, ".www/evidence"), { recursive: true });
const directory = await fs.mkdtemp(path.join(root, ".www/evidence/reports-"));

function run(command: string, args: string[], options: {env?: NodeJS.ProcessEnv} = {}): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...options }) ;
    let output  = ""                                                                                 ;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command}: 검증 실행 시간 초과`));
    }, 120_000);
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { output = (output + chunk.toString()).slice(-2_000_000); });
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
    run("bun", ["test", "test/workflow-reports.test.ts", "test/report-service.test.ts", "test/report-lifecycle.test.ts", "test/native-report-input.test.ts", "test/native-reports.test.ts", "test/report-judge.test.ts", "--timeout", "30000"]).then((output) => fs.writeFile(path.join(directory, "focused.log"), output)),
  ]);
  await fs.writeFile(path.join(directory, "build.log"), await run("npm", ["run", "build"]));
  const fixture = path.join(directory, "fixture");
  const workDirectory = path.join(
    fixture,
    "docs/work/Reports/001-실행 검증"
  );
  await fs.mkdir(workDirectory, { recursive: true });
  const workId = `work-${randomUUID()}`;
  await fs.writeFile(path.join(workDirectory, "work.json"), JSON.stringify({ schemaVersion: 1, id: workId, title: "작업을 한 장의 보고서로 읽습니다", status: "verifying", blockedReason: "합성 검증용 기록이며 실제 업무 완료가 아닙니다.", criteria: [{ id: "AC-1", description: "실제 앱이 저장된 보고서를 읽는다", required: true, result: "unverified", evidence: [] }] }));
  const reader = {
    story        : "이 합성 보고서는 작업 결과를 읽는 흐름을 확인하기 위해 만들었습니다. 요구와 결과를 먼저 보고 검사 방법과 남은 한계를 읽을 수 있게 구성했습니다. 실제 업무의 검증 성공을 뜻하지 않습니다." ,
    requirements : [{
      requirement : "작업 설명을 앱에서 읽기"                              ,
      result      : "상단 이야기와 요구별 결과를 보여 줍니다."             ,
      evidence    : "이후 Electron probe가 실제 iframe 본문을 확인합니다." ,
      limitations : "합성 보고서 자료입니다."
    }],
    checks       : [{
      target      : "보고서 화면 연결"                       ,
      method      : "실제 Electron과 합성 Native subprocess" ,
      expected    : "저장된 이야기 본문이 iframe에 표시됨"   ,
      observed    : null                                     ,
      limitations : "이 보고서는 검사 전 작성된 합성 시나리오이며 실행 결과는 probe 영수증에 남깁니다."
    }],
    decisions    : []                                                                                                                                                                                         ,
    references   : []                                                                                                                                                                                         ,
    nextActions  : [{
      action   : "실제 업무 자료로 보고서를 읽습니다."              ,
      owner    : null                                               ,
      doneWhen : "독자가 요구와 결과 및 검사 범위를 구분할 수 있음" ,
      impact   : "실제 사용자 업무의 수용은 이 검사로 판단할 수 없습니다."
    }],
  };
  const written = await publishWorkReport({ repo: fixture, workId, narrative: {
    reader,
    summary     : "보고서 파일이 실제 Electron 화면에 전달되는지 확인하는 합성 시나리오입니다."            ,
    before      : "변경과 판단이 대화 속에 흩어져 있었습니다."                                             ,
    after       : "작업의 전후와 근거를 보고서 한 장에서 읽습니다."                                        ,
    changes     : ["작성 설명과 자동 기록을 나눴습니다.", "앱의 sandbox iframe에서 독립 HTML을 읽습니다."] ,
    decisions   : ["기계가 선택 이유를 발명하지 않도록 저자 서술과 실행 근거를 분리했습니다."]             ,
    limitations : ["실제 모델 검증이 아닌 합성 Native와 Electron 연결 검사입니다."]                        ,
    next        : ["실제 작업의 보고서를 읽고 독립 감사를 연결합니다."]                                    ,
  } });
  await captureWorkReport({ repo: fixture, workId, event: "fixture_verification" });
  await fs.writeFile(path.join(directory, "standalone.html"), written.html);
  const judgeFixture = path.join(directory, "judge-fixture");
  const fixtureDecision = {
    needed : true                                                           ,
    reason : "실제 모델이 아닌 합성 판단 fixture로 자동 연결을 검사합니다." ,
    title  : "Native 답변 뒤 자동 보고서 연결"                              ,
    narrative: {
      reader,
      summary     : "Native 종료 사건 뒤 별도 판단과 보고서 저장이 자동으로 이어졌습니다." ,
      before      : "종료 사건만 표시했습니다."                                            ,
      after       : "LLM 판단 결과에 따라 리포트에 작업 기록을 남깁니다."                  ,
      changes     : ["실제 subprocess 경계를 통과한 합성 판단을 저장했습니다."]            ,
      decisions   : ["원래 Native 대화와 판단 실행을 분리했습니다."]                       ,
      limitations : ["실제 모델의 판단 품질은 이 fixture로 검증하지 않습니다."]            ,
      next        : []
    }
  };
  await fs.writeFile(judgeFixture, `#!/usr/bin/env node\nconst readline=require('node:readline');const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');readline.createInterface({input:process.stdin}).on('line',line=>{const x=JSON.parse(line);if(x.method==='initialize')send({id:x.id,result:{}});if(x.method==='thread/start')send({id:x.id,result:{thread:{id:'judge-thread'}}});if(x.method==='turn/start'){send({id:x.id,result:{turn:{id:'judge-turn'}}});send({method:'item/completed',params:{threadId:'judge-thread',turnId:'judge-turn',item:{id:'judge-answer',type:'agentMessage',phase:'final_answer',text:${JSON.stringify(JSON.stringify(fixtureDecision))}}}});send({method:'turn/completed',params:{threadId:'judge-thread',turn:{id:'judge-turn',status:'completed'}}});}});`, { mode: 0o700 });
  const reportPath = path.join(directory, "electron-probe.json");
  const binary = process.platform === "darwin"
    ? path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron")
    : process.platform === "win32"
      ? path.join(root, "node_modules/electron/dist/electron.exe")
      : path.join(root, "node_modules/electron/dist/electron");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    WWW_CODEX_BIN              : path.join(root, "test/fixtures/fake-app-server.ts") ,
    WWW_PROBE_PATH             : reportPath                                          ,
    WWW_PROBE_WORKSPACE        : fixture                                             ,
    WWW_PROBE_REPORTS          : "1"                                                 ,
    WWW_PROBE_NATIVE_REPORTS   : "1"                                                 ,
    WWW_PROBE_REPORT_JUDGE_BIN : judgeFixture
  };
  for (const key of ["ELECTRON_RUN_AS_NODE", "WWW_NATIVE_PROBE", "WWW_PROBE_DEVELOPMENT_WORK_ID", "WWW_PROBE_EXPECT_DEVELOPMENT_COMPLETE"]) delete env[key];
  await fs.writeFile(path.join(directory, "electron.log"), await run(binary, [root, `--user-data-dir=${path.join(directory, "profile")}`], { env }));
  const value: unknown = JSON.parse(await fs.readFile(reportPath, "utf8"));
  const object = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  if (!object(value)) throw new Error("Electron 결과 객체가 없습니다.");
  const result    = value                                                          ;
  const artifacts = object(result.reportArtifacts) ? result.reportArtifacts : {}   ;
  const mobile    = object(artifacts.mobile) ? artifacts.mobile : {}               ;
  const motion    = object(artifacts.reducedMotion) ? artifacts.reducedMotion : {} ;
  const embedded  = object(artifacts.embedded) ? artifacts.embedded : {}           ;
  if (result.error) throw new Error(String(result.error));
  if (typeof result.reportId !== "string") throw new Error("표시한 보고서 ID가 없습니다.");
  const selected = await readWorkReport({ repo: fixture, reportId: result.reportId });
  if (embedded.title !== selected.report.title || embedded.url !== "about:srcdoc") throw new Error("앱 iframe에 보고서 본문이 표시되지 않았습니다.");
  if (!selected.report.narrative?.reader || embedded.story !== selected.report.narrative.reader.story || typeof embedded.storyHeight !== "number" || embedded.storyHeight <= 0) throw new Error("앱 iframe에서 새 작업 이야기 본문을 확인하지 못했습니다.");
  if (typeof embedded.storyTop !== "number" || embedded.storyTop > 400) throw new Error("작업 이야기가 첫 화면 아래로 밀렸습니다.");
  if (result.nativeAutomaticReport !== true) throw new Error("Native 완료 뒤 자동 판단·작성 연결을 확인하지 못했습니다.");
  for (const key of ["reportsNavigation", "reportsSandboxed", "reportsEmptySearch", "reportsDraftPreserved", "approvalRoundtrip"]) if (result[key] !== true) throw new Error(`Electron 결과 누락: ${key}`);
  if (mobile.width !== 360 || typeof mobile.scrollWidth !== "number" || mobile.scrollWidth > 360) throw new Error("360px 보고서의 가로 넘침을 확인했습니다.");
  if (motion.enabled !== true || motion.animations !== 0 || artifacts.printed !== true) throw new Error("모션 축소·인쇄 결과를 확인하지 못했습니다.");
  console.log(JSON.stringify({ result: "passed", evidence: path.relative(root, directory), reportId: written.report.id, coverage: "실제 Electron+합성 Native·리포트 IPC·sandbox HTML·초안 보존·360px·모션 축소·PDF" }));
} catch (error) {
  await fs.writeFile(path.join(directory, "failure.txt"), String(error));
  console.error(String(error));
  process.exitCode = 1;
}
