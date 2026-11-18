import { reportFileStem } from "./workflow/report-names.ts";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openWork, readWork, advanceWork, verifyWork } from "./workflow/work.ts";
import { serializeWorkRecord, serializeWorkReport } from "./workflow/work-json.ts";
import { captureWorkReport, publishWorkReport, readWorkReport, listWorkReports } from "./workflow/reports.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = process.argv.slice(2);
if (options.length && (options.length !== 1 || options[0] !== "--meaning")) throw new Error("지원하는 옵션은 --meaning뿐입니다.");
if (options[0] === "--meaning") {
  await verifyReportMeaning();
} else {
await fs.mkdir(path.join(root, ".www/evidence"), { recursive: true });
const directory = await fs.mkdtemp(path.join(root, ".www/evidence/reports-"));

function run(command: string, args: string[], options: {env?: NodeJS.ProcessEnv; timeout?: number} = {}): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...options }) ;
    let output  = ""                                                                                 ;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command}: 검증 실행 시간 초과`));
    }, options.timeout ?? 120_000);
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
  await fs.writeFile(path.join(directory, "typecheck.log"), await run("npm", ["run", "typecheck"]));
  await fs.writeFile(path.join(directory, "semantic.log"), await run("bun", ["test", "test/work-json.test.ts", "--timeout", "300000"], { timeout: 900_000 }));
  await fs.writeFile(path.join(directory, "focused.log"), await run("bun", ["test", "test/workflow-reports.test.ts", "test/report-service.test.ts", "test/report-lifecycle.test.ts", "test/native-report-input.test.ts", "test/native-reports.test.ts", "test/report-judge.test.ts", "--timeout", "30000"]));
  await fs.writeFile(path.join(directory, "build.log"), await run("npm", ["run", "build"]));
  const fixture = path.join(directory, "fixture");
  const workDirectory = path.join(
    fixture,
    "docs/work/Reports/001-실행 검증"
  );
  await fs.mkdir(workDirectory, { recursive: true });
  const legacyId = `work-${randomUUID()}`;
  await fs.writeFile(path.join(workDirectory, "work.json"), JSON.stringify({ schemaVersion: 1, kind: "maintenance", areas: ["dev"], owner: "dev", relations: [], id: legacyId, title: "작업을 한 장의 보고서로 읽습니다", status: "verifying", blockedReason: "합성 검증용 기록이며 실제 업무 완료가 아닙니다.", criteria: [{ id: "AC-1", description: "실제 앱이 저장된 보고서를 읽는다", required: true, result: "unverified", evidence: [] }] }));
  const legacyPath       = path.join(workDirectory, "work.json")                                                                        ;
  const legacyWorkBefore = await fs.readFile(legacyPath)                                                                                ;
  const legacyStatBefore = await fs.stat(legacyPath)                                                                                    ;
  const legacy           = await captureWorkReport({ repo: fixture, workId: legacyId, event: "before_opt_in" })                         ;
  const legacyFiles      = ["json", "html"].map((extension) => path.join(workDirectory, "reports", `${reportFileStem(legacy.report)}.${extension}`)) ;
  const legacyBytes      = await Promise.all(legacyFiles.map((file) => fs.readFile(file)))                                              ;
  await fs.mkdir(path.join(fixture, "docs/architecture"), { recursive: true });
  await fs.writeFile(path.join(fixture, "docs/architecture/work-output.json"), JSON.stringify({ version: 1, format: "boxbox-scalar-columns-v1", scope: "docs/work/**/*.json", approvalRef: ".www/architecture-contract/boxbox-side/human-approvals-20261114.json#json" }));
  await fs.mkdir(path.join(fixture, "src"));
  await fs.writeFile(path.join(fixture, "docs/work/INDEX.md"), "# 합성 작업\n");
  const created = await openWork({ repo: fixture, role: "www-dev", direct: true, requestId: "electron-new-output", request: "활성 정책의 최초 출력 확인", decision: { intent: "build", area: "Reports", title: "새 JSON 출력", criteria: [{ id: "AC-1", description: "실제 앱 저장 원문을 읽는다" }] }, approval: { implementation: true, writePaths: [], mutationSurfaces: [], verifierCommands: [], commit: false, publish: false }, inputs: ["src"] }) ;
  const workId  = created.record.id                                                                                                                                                                                                                                                                                                                                                                                                                       ;
  if (await fs.readFile(created.path, "utf8") !== serializeWorkRecord(created.record, true)) throw new Error("활성 정책 신규 work bytes 불일치");
  await advanceWork({ repo: fixture, workId, intent: "build" });
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
  const finalWork = await fs.readFile(created.path, "utf8");
  if (written.report.workRecordHash !== createHash("sha256").update(finalWork).digest("hex")) throw new Error("보고서 raw work hash 불일치");
  const savedReport  = path.join(path.dirname(created.path), "reports", `${reportFileStem(written.report)}.json`) ;
  const savedBundle  = await fs.readFile(savedReport, "utf8")                                                     ;
  const reportBundle = JSON.parse(savedBundle)                                                                    ;
  if (reportBundle.schemaVersion !== 2 || !reportBundle.entries.some((entry: { id: string }) => entry.id === written.report.id) || savedBundle !== serializeWorkReport(reportBundle, true)) throw new Error("신규 report 묶음 최초 출력 불일치");
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
  await readWork({ repo: fixture, workId: legacyId });
  await listWorkReports({ repo: fixture });
  const noOpBefore     = await fs.readFile(created.path) ;
  const noOpStatBefore = await fs.stat(created.path)     ;
  await advanceWork({ repo: fixture, workId, intent: "build" });
  const noOpAfter     = await fs.readFile(created.path)                                                                                              ;
  const noOpStatAfter = await fs.stat(created.path)                                                                                                  ;
  const noOpUnchanged = noOpBefore.equals(noOpAfter) && noOpStatBefore.ino === noOpStatAfter.ino && noOpStatBefore.mtimeMs === noOpStatAfter.mtimeMs ;
  if (!noOpUnchanged) throw new Error("no-op 원장 bytes/inode/mtime 변경");
  const legacyWorkAfter     = await fs.readFile(legacyPath)                                                                                                                    ;
  const legacyStatAfter     = await fs.stat(legacyPath)                                                                                                                        ;
  const legacyWorkUnchanged = legacyWorkBefore.equals(legacyWorkAfter) && legacyStatBefore.ino === legacyStatAfter.ino && legacyStatBefore.mtimeMs === legacyStatAfter.mtimeMs ;
  if (!legacyWorkUnchanged) throw new Error("기존 원장 bytes/inode/mtime 변경");
  const runtimeConfiguration = path.join(fixture, ".www/development.local.json");
  const runtimeBoxboxConfiguration = await fs.lstat(runtimeConfiguration).then(() => "present", (error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return "absent";
  });
  if (runtimeBoxboxConfiguration !== "absent") throw new Error("fixture 개발 설정이 존재합니다.");
  const manifest: unknown = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  if (typeof manifest !== "object" || manifest === null || !("dependencies" in manifest) || typeof manifest.dependencies !== "object" || manifest.dependencies === null) throw new Error("runtime dependencies 경계 오류");
  if (Object.keys(manifest.dependencies).some((name) => /boxbox/i.test(name))) throw new Error("runtime BoxBox 의존성 검출");
  const bundle = (await Promise.all(["main.js", "preload.js", "renderer.js"].map((file) => fs.readFile(path.join(root, "dist", file), "utf8")))).join("\n");
  if (/boxboxLauncher|boxboxNode|\/[^\n"']*node_modules\/boxbox\/dist\/cli/.test(bundle)) throw new Error("배포 bundle의 개발 CLI 경로 검출");
  const runtimePath = path.join(directory, "runtime-bin");
  await fs.mkdir(runtimePath);
  // Node fixture의 shebang과 git에 필요한 도구만 노출한다. 머신 설치본은 변경하지 않는다.
  await fs.symlink(process.execPath, path.join(runtimePath, "node"));
  await fs.symlink("/usr/bin/git", path.join(runtimePath, "git"));
  const runtimeExecutables = await fs.readdir(runtimePath);
  if (runtimeExecutables.some((name) => /boxbox/i.test(name))) throw new Error("child PATH에 BoxBox가 있습니다.");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH                       : runtimePath                                         ,
    WWW_CODEX_BIN              : path.join(root, "test/fixtures/fake-app-server.ts") ,
    WWW_PROBE_PATH             : reportPath                                          ,
    WWW_PROBE_WORKSPACE        : fixture                                             ,
    WWW_PROBE_REPORTS          : "1"                                                 ,
    WWW_PROBE_NATIVE_REPORTS   : "1"                                                 ,
    WWW_PROBE_REPORT_JUDGE_BIN : judgeFixture
  };
  for (const key of Object.keys(env).filter((key) => /BOXBOX/i.test(key))) delete env[key];
  for (const key of ["ELECTRON_RUN_AS_NODE", "WWW_NATIVE_PROBE", "WWW_PROBE_DEVELOPMENT_WORK_ID", "WWW_PROBE_EXPECT_DEVELOPMENT_COMPLETE"]) delete env[key];
  await fs.writeFile(path.join(directory, "runtime-prechecks.json"), JSON.stringify({ runtimeBoxboxConfiguration, runtimeExecutables, runtimePath, legacyWorkUnchanged, noOpUnchanged, runtimeDependencies: Object.keys(manifest.dependencies), bundleSha256: createHash("sha256").update(bundle).digest("hex"), boundary: "fixture 개발 설정 부재·runtime 의존성·main/preload/renderer bundle·child PATH만 검사. 머신 전역 CLI 제거를 주장하지 않음" }, null, 2));
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
  const legacyFinal = await fs.stat(legacyPath);
  if (!(await fs.readFile(legacyPath)).equals(legacyWorkBefore) || legacyFinal.ino !== legacyStatBefore.ino || legacyFinal.mtimeMs !== legacyStatBefore.mtimeMs) throw new Error("Electron 뒤 기존 원장 변경");
  const currentLegacy       = await Promise.all(legacyFiles.map((file) => fs.readFile(file)))         ;
  const oldReportsUnchanged = currentLegacy.every((bytes, index) => bytes.equals(legacyBytes[index])) ;
  if (!oldReportsUnchanged) throw new Error("기존 보고서 bytes 변경");
  const nativeReports = (await listWorkReports({ repo: fixture })).reports.filter((report) => report.workId !== workId && report.workId !== legacyId);
  if (!nativeReports.length) throw new Error("Electron 신규 Native 기록 누락");
  for (const summary of nativeReports) {
    const document = await readWorkReport({ repo: fixture, reportId: summary.id })                    ;
    const raw      = await fs.readFile(path.join(fixture, document.report.source.recordPath), "utf8") ;
    if (!/"id" +:/.test(raw) || document.report.workRecordHash !== createHash("sha256").update(raw).digest("hex")) throw new Error("Electron Native 최초 출력/hash 불일치");
  }
  await fs.writeFile(path.join(directory, "new-output.json"), JSON.stringify({ activePolicy: true, newWork: workId, rawHash: written.report.workRecordHash, nativeReports: nativeReports.length, oldReportsUnchanged, legacyWorkUnchanged, noOpUnchanged, runtimeBoxboxConfiguration }, null, 2));
  const meaning = await verifyReportMeaning(false);
  if (meaning.result !== "passed") throw new Error(`보고서 양면 의미 검사 실패: ${meaning.evidence}`);
  console.log(JSON.stringify({ result: "passed", evidence: path.relative(root, directory), reportId: written.report.id, meaningEvidence: meaning.evidence, coverage: "실제 Electron+합성 Native·리포트 IPC·sandbox HTML·초안 보존·360px·모션 축소·PDF·새/legacy 양면 의미색과 본문" }));
} catch (error) {
  await fs.writeFile(path.join(directory, "failure.txt"), String(error));
  console.error(String(error));
  process.exitCode = 1;
}

}

/** 실제 ReportsView와 독립 HTML을 같은 visible observer 결과로 비교한다. */
async function verifyReportMeaning(emit = true) {
await fs.mkdir(path.join(root, '.www/evidence'), { recursive: true });
const directory = await fs.mkdtemp(path.join(root, '.www/evidence/report-meaning-'));
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const productFiles = ['scripts/workflow/report-view.ts', 'scripts/workflow/reports.ts', 'src/reports-view.tsx', 'src/reports-service.ts', 'src/main.ts', 'scripts/verify-reports.ts'];
async function fingerprints() { return Object.fromEntries(await Promise.all(productFiles.map(async file => [file, sha(await fs.readFile(path.join(root, file)))]))); }
function run(command: string, argv: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('의미 probe 시간 초과')); }, 120_000);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-2_000_000); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => { clearTimeout(timer); if (code || signal) reject(new Error(`Electron 종료 ${code}/${signal}\n${output}`)); else resolve(output); });
  });
}
function rgb(value: string): number[] {
  if (value.startsWith('#')) { const h = value.slice(1); if (!/^[a-f0-9]{6}$/i.test(h)) throw new Error(`색상 형식: ${value}`); return [0, 2, 4].map(index => parseInt(h.slice(index, index + 2), 16)); }
  const parts = value.match(/[\d.]+/g)?.map(Number);
  if (!parts || parts.length < 3 || parts.length > 3 && parts[3] !== 1) throw new Error(`불투명 computed 색상 필요: ${value}`);
  return parts.slice(0, 3);
}
function luminance(value: string) { const [r = 0, g = 0, b = 0] = rgb(value).map(x => { const s = x / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; }
function inspect(value: unknown, expected: Record<string, string[]>, label: string, failures: string[], includeBlocked = false) {
  if (!object(value) || !object(value.regions) || !object(value.tokens) || !Array.isArray(value.states)) { failures.push(`${label}: 실제 의미 관측 없음`); return; }
  const semanticTokens = value.tokens;
  for (const [region, markers] of Object.entries(expected)) {
    const found = value.regions[region];
    for (const marker of markers) if (!object(found) || found.visible !== true || typeof found.text !== 'string' || !found.text.includes(marker)) failures.push(`${label}.${region}: visible marker 누락 ${marker}`);
  }
  const conclusion = value.regions.conclusion;
  if (object(conclusion) && typeof conclusion.text === 'string' && conclusion.text.includes('의미검증-합성 인증 실패') && conclusion.text.includes('원인은 기록에서 확인되지 않았습니다')) failures.push(`${label}: 알고 있는 미실행 원인과 원인 미확인 안내 모순`);
  if (value.rawClosed !== true) failures.push(`${label}: 원시 상세가 닫힌 기본 reader 관측이 아님`);
  const stateExpectations: [string, string[]][] = [['당시 통과로 기록', ['green']], ['당시 실패로 기록', ['red', 'amber']], ['미검증으로 기록', ['amber']]];
  if (includeBlocked) stateExpectations.push(['당시 차단으로 기록', ['amber']]);
  for (const [text, tokens] of stateExpectations) {
    const state = value.states.find(item => object(item) && item.label === text);
    if (!object(state) || typeof state.color !== 'string' || typeof state.background !== 'string') { failures.push(`${label}: 상태 라벨 없음 ${text}`); continue; }
    if (state.fullyOpaque !== true) { state.contrast = null; state.contrastStatus = 'unverified_partial_opacity'; failures.push(`${label}: ${text}의 라벨/조상 opacity가 1이 아니므로 대비 미검증`); continue; }
    const actual = rgb(state.color).join(',');
    if (!tokens.some(token => { const color = semanticTokens[token]; return typeof color === 'string' && rgb(color).join(',') === actual; })) failures.push(`${label}: ${text}의 computed 색이 선언된 ${tokens.join('/')} 의미 토큰과 다름`);
    const a = luminance(state.color), b = luminance(state.background), contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    state.contrast = contrast;
    if (contrast < 4.5) failures.push(`${label}: ${text} 본문 대비 ${contrast.toFixed(3)} < 4.5`);
  }
  const positive = value.states.find(item => object(item) && item.label === '당시 통과로 기록');
  const negative = value.states.find(item => object(item) && item.label === '당시 실패로 기록');
  if (object(positive) && object(negative) && typeof positive.color === 'string' && typeof negative.color === 'string' && rgb(positive.color).join(',') === rgb(negative.color).join(',')) failures.push(`${label}: 성공/실패의 관측 의미색이 동일함`);
}

const before = await fingerprints();
const failures: string[] = [];
try {
  const fixture = path.join(directory, 'fixture');
  await fs.mkdir(path.join(fixture, 'src'), { recursive: true });
  await fs.mkdir(path.join(fixture, 'docs/work'), { recursive: true });
  await fs.writeFile(path.join(fixture, 'src/value.ts'), 'export const value = 1;\n');
  await fs.writeFile(path.join(fixture, 'docs/work/INDEX.md'), '# 공개 합성 fixture\n');
  const pass = ['-e', 'process.exit(0)'], fail = ['-e', 'process.exit(7)'];
  const fresh = await openWork({ repo: fixture, role: 'www-dev', direct: true, requestId: 'report-meaning-public-fixture', request: '보고서 의미 관측용 공개 합성 자료', inputs: ['src'], decision: { intent: 'verify', area: 'Reports', title: '의미검증 신규 보고서', criteria: [{ id: 'AC-PASS', description: 'NEW-PASS-요구', required: true }, { id: 'AC-FAIL', description: 'NEW-FAIL-요구', required: true }, { id: 'AC-PENDING', description: 'NEW-UNVERIFIED-요구', required: true }] }, approval: { implementation: false, writePaths: [], mutationSurfaces: [], verifierCommands: [JSON.stringify([process.execPath, ...pass]), JSON.stringify([process.execPath, ...fail])] } });
  await verifyWork({ repo: fixture, workId: fresh.record.id, command: process.execPath, args: pass, criterionIds: ['AC-PASS'] });
  await verifyWork({ repo: fixture, workId: fresh.record.id, command: process.execPath, args: fail, criterionIds: ['AC-FAIL'] });
  const authored = await publishWorkReport({ repo: fixture, workId: fresh.record.id, narrative: { summary: 'NEW-SUMMARY-합성 관측', before: 'NEW-BEFORE-시작점', after: 'NEW-AFTER-결과', changes: ['NEW-CHANGE-변경'], decisions: ['NEW-DECISION-BASIS-기존 서술의 선택 근거'], limitations: ['NEW-LIMIT-합성 범위'], next: ['NEW-NEXT-해소 행동'], reader: { story: 'NEW-STORY-공개 사용자 이야기', requirements: [{ requirement: 'NEW-REQ-행동', result: 'NEW-RESULT-결과', evidence: 'NEW-EVIDENCE-연결 근거', limitations: 'NEW-REQ-LIMIT-한계' }], checks: [{ target: 'NEW-CHECK-검증 대상', method: 'NEW-METHOD-실제 합성 명령', expected: 'NEW-EXPECTED-기대', observed: null, limitations: 'NEW-CHECK-LIMIT-미관측' }], decisions: [], references: [], nextActions: [] } } });
  const legacyWork = path.join(fixture, 'docs/work/Reports/099-legacy');
  await fs.mkdir(legacyWork, { recursive: true });
  const legacyId = `work-${randomUUID()}`;
  await fs.writeFile(path.join(legacyWork, 'work.json'), JSON.stringify({ schemaVersion: 1, id: legacyId, title: '의미검증 legacy 자동 기록', kind: 'maintenance', areas: ['dev'], owner: 'dev', status: 'verifying', blockedReason: '독립 검토 not_run: 의미검증-합성 인증 실패', relations: [], criteria: [{ id: 'OLD-PASS', description: 'LEGACY-PASS-요구', required: true, result: 'passed', evidence: [] }, { id: 'OLD-FAIL', description: 'LEGACY-FAIL-요구', required: true, result: 'failed', evidence: [] }, { id: 'OLD-BLOCKED', description: 'LEGACY-BLOCKED-요구', required: true, result: 'blocked', evidence: [] }, { id: 'OLD-UNVERIFIED', description: 'LEGACY-UNVERIFIED-요구', required: true, result: 'unverified', evidence: [] }] }));
  const legacy = await captureWorkReport({ repo: fixture, workId: legacyId, event: 'meaning_legacy_fixture' });
  const cases: { name: string; report: typeof authored.report; expected: Record<string, string[]> }[] = [
    { name: 'new', report: authored.report, expected: { conclusion: ['NEW-SUMMARY', 'NEW-STORY'], approach: ['NEW-BEFORE', 'NEW-AFTER', 'NEW-DECISION-BASIS'], results: ['NEW-REQ-행동', 'NEW-RESULT', 'NEW-EVIDENCE', 'NEW-REQ-LIMIT', 'NEW-UNVERIFIED'], verification: ['NEW-CHECK', 'NEW-METHOD', 'NEW-EXPECTED', '관측 결과가 기록되지 않았습니다', 'NEW-LIMIT'], next: ['NEW-NEXT'] } },
    { name: 'legacy', report: legacy.report, expected: { conclusion: ['의미검증-합성 인증 실패', '자동 기록에는 작성자가 서술한 작업 이야기가 없습니다'], results: ['LEGACY-PASS', 'LEGACY-FAIL', 'LEGACY-BLOCKED', 'LEGACY-UNVERIFIED'], verification: ['연결된 검사 시도가 없습니다. 미검증입니다', '연결된 독립 검토가 없습니다. 미실행입니다'] } }
  ];
  const binary = process.platform === 'darwin' ? path.join(root, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron') : process.platform === 'win32' ? path.join(root, 'node_modules/electron/dist/electron.exe') : path.join(root, 'node_modules/electron/dist/electron');
  for (const item of cases) {
    const folder = path.join(directory, item.name); await fs.mkdir(folder);
    const reportPath = path.join(folder, 'probe.json');
    const env: NodeJS.ProcessEnv = { ...process.env, WWW_CODEX_BIN: path.join(root, 'test/fixtures/fake-app-server.ts'), WWW_PROBE_PATH: reportPath, WWW_PROBE_WORKSPACE: fixture, WWW_PROBE_REPORTS: '1' };
    for (const key of ['ELECTRON_RUN_AS_NODE', 'WWW_NATIVE_PROBE', 'WWW_PROBE_NATIVE_REPORTS', 'WWW_PROBE_REPORT_JUDGE_BIN', 'WWW_PROBE_DEVELOPMENT_WORK_ID', 'WWW_PROBE_EXPECT_DEVELOPMENT_COMPLETE', 'WWW_PROBE_REPORT_MEANING_ID']) delete env[key];
    env.WWW_PROBE_REPORT_MEANING_ID = item.report.id;
    try {
      await fs.writeFile(path.join(folder, 'electron.log'), await run(binary, [root, `--user-data-dir=${path.join(folder, 'profile')}`], env));
      const value: unknown = JSON.parse(await fs.readFile(reportPath, 'utf8'));
      if (!object(value) || value.error || !object(value.reportArtifacts) || !object(value.reportArtifacts.embedded)) throw new Error(`실제 probe 결과 오류 ${JSON.stringify(value)}`);
      const artifacts = value.reportArtifacts, embedded = artifacts.embedded;
      if (!object(embedded) || embedded.title !== item.report.title || typeof embedded.storyHeight !== 'number' || embedded.storyHeight <= 0) throw new Error('기존 iframe 제목/story 가시성 조건 실패');
      for (const key of ['reportsNavigation', 'reportsSandboxed', 'reportsEmptySearch', 'reportsDraftPreserved', 'approvalRoundtrip']) if (value[key] !== true) throw new Error(`기존 probe 호환 필드 실패: ${key}`);
      if (!object(artifacts.mobile) || artifacts.mobile.width !== 360 || typeof artifacts.mobile.scrollWidth !== 'number' || artifacts.mobile.scrollWidth > 360 || !object(artifacts.reducedMotion) || artifacts.reducedMotion.enabled !== true || artifacts.reducedMotion.animations !== 0 || artifacts.printed !== true) throw new Error('기존 mobile/motion/PDF 조건 실패');
      {
        if (!object(artifacts.meaning) || artifacts.meaning.reportId !== item.report.id || artifacts.meaning.kind !== item.report.kind) throw new Error('선택한 공개 report 객체 불일치');
        if (item.name === 'new') {
          const sample = embedded.observerSamples;
          const normalized = object(sample) && object(sample.regions) && object(sample.regions.conclusion) ? sample.regions.conclusion.text : null;
          if (typeof normalized !== 'string' || !normalized.includes('literal-s s sample keeps')) throw new Error('CDP literal s/연속 공백 정규화 표본 실패');
          const sampleFailures: string[] = [];
          inspect(sample, {}, 'observer-opacity-sample', sampleFailures);
          if (!sampleFailures.some(message => message.includes('opacity'))) throw new Error('opacity 0.1 표본의 대비 미검증 판정을 확인하지 못함');
          const state = object(sample) && Array.isArray(sample.states) ? sample.states.find(value => object(value) && value.label === '당시 통과로 기록') : null;
          if (!object(state) || state.fullyOpaque !== false || !Array.isArray(state.opacityChain) || !state.opacityChain.includes(.1) || state.contrast !== null) throw new Error('실제 조상 opacity 0.1 관측 누락');
          await fs.writeFile(path.join(folder, 'observer-samples.json'), JSON.stringify({ normalized, expectedNormalization: 'literal-s s sample keeps', expectedOpacityRejection: true, sampleFailures, sample }, null, 2)+'\n');
        }
        inspect(embedded.meaning, item.expected, `${item.name}.iframe`, failures, item.name === 'legacy');
        inspect(artifacts.meaning.standalone, item.expected, `${item.name}.standalone`, failures, item.name === 'legacy');
        await fs.writeFile(path.join(folder, 'meaning-observed.json'), JSON.stringify({ expected: item.expected, iframe: embedded.meaning, standalone: artifacts.meaning.standalone }, null, 2)+'\n');
      }
    } catch (error) { failures.push(`${item.name}: ${String(error)}`); await fs.writeFile(path.join(folder, 'failure.txt'), String(error)); }
  }
} catch (error) { failures.push(String(error)); }
const after = await fingerprints();
if (JSON.stringify(before) !== JSON.stringify(after)) failures.push('검사 중 제품/probe 입력 지문 변경');
const summary = { result: failures.length ? 'failed' : 'passed', mode: 'new-and-legacy-visible-meaning', failures, productSourceBefore: before, productSourceAfter: after, sourceStable: JSON.stringify(before) === JSON.stringify(after), evidence: path.relative(root, directory), scope: '실제 React ReportsView sandbox OOPIF 및 독립 HTML. 명시 예상 marker·CSS 가시성·computed 의미색·본문 대비4.5. 합성 fixture/Native이며 실제 모델 호출 없음. 현재성 시점 문구는 의미 동일성 비교에서 제외.' };
await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2)+'\n');
if (emit) console.log(JSON.stringify(summary));
if (failures.length) process.exitCode = 1;
return summary;

}
