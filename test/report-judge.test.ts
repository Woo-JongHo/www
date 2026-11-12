import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { judgeNativeReport, ReportJudgeError, type NativeReportInput } from "../src/report-judge";
import { createNativeReportHarness, type NativeReportJob } from "../src/native-reports";
import { parseReportReader, type ReportReader } from "../scripts/workflow/reports.ts";

const input: NativeReportInput = {
  threadId  : "source-thread"                                             ,
  turnId    : "source-turn"                                               ,
  prompt    : "리포트 화면을 구현해줘"                                    ,
  answer    : "변경과 검증 결과를 보고합니다."                            ,
  commands  : [{ command: "npm test", exitCode: 0, status: "completed" }] ,
  files     : ["src/reports-view.tsx"]                                    ,
  truncated : false                                                       ,
};

const report = { needed: true, reason: "구현과 검증 내용을 다시 읽을 가치가 있습니다.", title: "작업을 보고서로 읽습니다", narrative: { summary: "보고서 화면을 구현했습니다.", before: "대화에서 변경 내용을 찾아야 했습니다.", after: "리포트 화면에서 확인합니다.", changes: ["보고서 화면 연결"], decisions: ["기록과 저작 설명을 구분했습니다."], limitations: ["관찰된 명령 종료만 확인했습니다. 업무 수용은 미확인입니다."], next: [] } };

const reader: ReportReader = {
  story        : "대화에서 작업을 찾기 어려워 보고서 화면을 요청했습니다. 공개 답변에는 화면을 연결했다는 기록이 있습니다. npm test 종료 코드 0을 관찰했지만 앱 수용은 미확인입니다. 화면 수용 여부는 별도로 확인해야 합니다." ,
  requirements : [{ requirement: "작업을 보고서로 읽기", result: "Native 답변에 화면 연결이 기록됨", evidence: "src/reports-view.tsx", limitations: "실제 앱 확인은 미수행" }]                                                 ,
  checks       : [{ target: "보고서 관련 테스트", method: "npm test", expected: null, observed: "종료 코드 0", limitations: "업무 수용 확인과 별개" }]                                                                         ,
  decisions    : [{ problem: "확인 범위 설명", basis: "명령 관찰만 제공됨", alternatives: [], choice: "앱 수용을 미확인으로 표시", tradeoff: null }]                                                                           ,
  references   : [{ path: "src/reports-view.tsx", purpose: "보고서 화면 변경 위치 확인" }]                                                                                                                                     ,
  nextActions  : [{ action: "앱에서 보고서 화면 확인", owner: null, doneWhen: "저장된 보고서를 화면에서 읽을 수 있음", impact: null }]                                                                                         ,
};

async function server(t: TestContext, mode: string, response: unknown = report) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "www-judge-fixture-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const binary  = path.join(directory, "codex-judge-fixture")                        ;
  const log     = path.join(directory, "requests.jsonl")                             ;
  const pidFile = path.join(directory, "pid.txt")                                    ;
  const payload = typeof response === "string" ? response : JSON.stringify(response) ;
  await fs.writeFile(binary, `#!${process.execPath}
const { createInterface } = require('node:readline');
const { appendFileSync, writeFileSync } = require('node:fs');
writeFileSync(${JSON.stringify(pidFile)},String(process.pid));
const mode = ${JSON.stringify(mode)};
const output = ${JSON.stringify(payload)};
const log = ${JSON.stringify(log)};
const send = value => process.stdout.write(JSON.stringify(value)+'\\n');
const notify = (method,params) => send({jsonrpc:'2.0',method,params});
createInterface({input:process.stdin}).on('line',line=>{
  const request=JSON.parse(line);
  appendFileSync(log,JSON.stringify(request)+'\\n');
  if(request.method==='initialize'){
    if(mode==='eof'){process.exit(17);return;}
    if(mode==='timeout')return;
    send({jsonrpc:'2.0',id:request.id,result:{serverInfo:{name:'fixture'}}});
  }else if(request.method==='thread/start'){
    send({jsonrpc:'2.0',id:request.id,result:{thread:{id:'judge-thread'}}});
  }else if(request.method==='turn/start'){
    if(mode==='approval'){send({jsonrpc:'2.0',id:700,method:'item/commandExecution/requestApproval',params:{threadId:'judge-thread',turnId:'judge-turn'}});return;}
    if(mode==='tool'){notify('item/started',{threadId:'judge-thread',turnId:'judge-turn',item:{id:'tool',type:'commandExecution',command:'echo prohibited'}});return;}
    if(mode==='protocol'){process.stdout.write('not-json\\n');return;}
    const answer=()=>{
      notify('item/completed',{threadId:'judge-thread',turnId:'judge-turn',item:{id:'note',type:'agentMessage',phase:'commentary',text:'공개 설명이며 결과 JSON이 아닙니다.'}});
      if(mode==='delta-only')notify('item/agentMessage/delta',{threadId:'judge-thread',turnId:'judge-turn',itemId:'answer',delta:output});
      else notify('item/completed',{threadId:'judge-thread',turnId:'judge-turn',item:{id:'answer',type:'agentMessage',phase:mode==='null-phase'?null:'final_answer',text:output}});
      notify('turn/completed',{threadId:'judge-thread',turn:{id:'judge-turn',status:mode==='failed'?'failed':'completed'}});
    };
    if(mode==='race'){
      answer();
      setTimeout(()=>send({jsonrpc:'2.0',id:request.id,result:{turn:{id:'judge-turn'}}}),15);
    }else{
      send({jsonrpc:'2.0',id:request.id,result:{turn:{id:'judge-turn'}}});
      answer();
    }
  }
});
`, { mode: 0o700 });
  return { binary, log, pidFile };
}

test("실제 별도 subprocess에서 읽기 전용 판단과 구조화 최종 서술을 받는다", async (t) => {
  const fixture = await server(t, "normal")                                                   ;
  const result  = await judgeNativeReport(input, { binary: fixture.binary, timeoutMs: 2000 }) ;
  assert.equal(result.needed, true);
  assert.equal(result.narrative?.summary, report.narrative.summary);
  const requests: unknown[] = (await fs.readFile(fixture.log, "utf8")).trim().split("\n").map((line) => JSON.parse(line))                                ;
  const object              = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ;
  const thread              = requests.find((value) => object(value) && value.method === "thread/start")                                                 ;
  assert.ok(object(thread) && object(thread.params));
  assert.equal(thread.params.ephemeral, true);
  assert.equal(thread.params.sandbox, "read-only");
  assert.equal(thread.params.approvalPolicy, "never");
  assert.notEqual(thread.params.cwd, process.cwd());
  assert.ok(typeof thread.params.cwd === "string");
  await assert.rejects(fs.stat(thread.params.cwd), { code: "ENOENT" });
  const turn = requests.find((value) => object(value) && value.method === "turn/start");
  assert.ok(object(turn) && object(turn.params) && object(turn.params.outputSchema));
  assert.equal(turn.params.threadId, "judge-thread");
  assert.equal(turn.params.outputSchema.additionalProperties, false);
  assert.equal("model" in thread.params, false);
  const pid = Number(await fs.readFile(fixture.pidFile, "utf8"));
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
});

test("작은 작업을 불필요로 판단한 결과는 보고서를 발명하지 않는다", async (t) => {
  const fixture = await server(t, "normal", { needed: false, reason: "짧은 확인 응답입니다.", title: "", narrative: null });
  assert.deepEqual(await judgeNativeReport(input, { binary: fixture.binary, timeoutMs: 2000 }), { needed: false, reason: "짧은 확인 응답입니다.", title: "", narrative: null });
});

test("새 독자 양식은 실제 subprocess를 거쳐 보존하고 다음 출력 스키마에 필수로 요청한다", async (t) => {
  const fixture = await server(t, "normal", { ...report, narrative: { ...report.narrative, reader } }) ;
  const result  = await judgeNativeReport(input, { binary: fixture.binary, timeoutMs: 2000 })          ;
  assert.deepEqual(result.narrative?.reader, reader);
  const requests = (await fs.readFile(fixture.log, "utf8")).trim().split("\n").map((line): unknown => JSON.parse(line)) ;
  const turn     = requests.find((value) => JSON.stringify(value).includes('"turn/start"'))                             ;
  const source   = JSON.stringify(turn)                                                                                 ;
  assert.match(source, /"required":\["summary","before","after","changes","decisions","limitations","next","reader"\]/);
  assert.match(source, /"required":\["story","requirements","checks","decisions","references","nextActions"\]/);
  assert.match(source, /"story":\{"type":"string","minLength":1,"maxLength":8000\}/);
  assert.match(source, /"maxItems":20/);
});

test("독자 양식의 nullable 필드와 빈 배열은 허용하고 누락·null·잘못된 형식은 거부한다", async (t) => {
  assert.deepEqual(parseReportReader(reader), reader);
  assert.equal(parseReportReader({ ...reader, references: [{ path: "x".repeat(4000), purpose: "확인" }] }).references[0]?.path.length, 4000);
  const empty: ReportReader = { story: "현재 확인된 자료만 기록합니다.", requirements: [], checks: [], decisions: [], references: [], nextActions: [] };
  assert.deepEqual(parseReportReader(empty), empty);
  for (const value of [null, {}, { ...reader, story: "x".repeat(8001) }, { ...reader, checks: [{ target: "대상", method: "방법", expected: null, observed: null }] }, { ...reader, requirements: Array(21).fill(reader.requirements[0]) }, { ...reader, references: [{ path: "x".repeat(4001), purpose: "확인" }] }]) {
    assert.throws(() => parseReportReader(value));
    const fixture = await server(t, "normal", { ...report, narrative: { ...report.narrative, reader: value } });
    await assert.rejects(judgeNativeReport(input, { binary: fixture.binary, timeoutMs: 2000 }), { code: "REPORT_JUDGE_INVALID_RESPONSE" });
  }
});

test("완료 알림이 turn/start 접수보다 먼저 와도 실제 최종 JSON을 보존한다", async (t) => {
  const fixture = await server(t, "race");
  assert.equal((await judgeNativeReport(input, { binary: fixture.binary, timeoutMs: 2000 })).title, report.title);
  const nullable = await server(t, "null-phase");
  assert.equal((await judgeNativeReport(input, { binary: nullable.binary, timeoutMs: 2000 })).title, report.title);
});

test("JSON 오류·모순된 필요 여부·과대 서술을 성공으로 받지 않는다", async (t) => {
  for (const response of ["not-json", { ...report, needed: false }, { ...report, narrative: null }, { ...report, title: "길".repeat(121) }, { ...report, extra: "허용 안 됨" }, { ...report, narrative: { ...report.narrative, changes: Array(31).fill("너무 많은 변경") } }]) {
    const fixture = await server(t, "normal", response);
    await assert.rejects(judgeNativeReport(input, { binary: fixture.binary, timeoutMs: 2000 }), { code: "REPORT_JUDGE_INVALID_RESPONSE" });
  }
});

test("도구·승인 요청·실패 완료·델타만 있는 결과·프로토콜 오류를 거부한다", async (t) => {
  for (const mode of ["tool", "approval", "failed", "delta-only", "protocol"]) {
    const fixture = await server(t, mode);
    if (mode === "protocol" || mode === "delta-only") await assert.rejects(judgeNativeReport(input, { binary: fixture.binary, timeoutMs: 2000 }), { code: "REPORT_JUDGE_INVALID_RESPONSE" });
    else await assert.rejects(judgeNativeReport(input, { binary: fixture.binary, timeoutMs: 2000 }));
    const requests = await fs.readFile(fixture.log, "utf8");
    assert.equal(requests.includes('"decision":"accept"'), false);
  }
});

test("EOF·제한 시간·취소를 별도 실패로 종료한다", async (t) => {
  await assert.rejects(judgeNativeReport(input, { binary: "/www-report-judge-does-not-exist", timeoutMs: 2000 }), /app-server error/);
  const eof = await server(t, "eof");
  await assert.rejects(judgeNativeReport(input, { binary: eof.binary, timeoutMs: 2000 }), /closed/);
  const timeout = await server(t, "timeout");
  await assert.rejects(judgeNativeReport(input, { binary: timeout.binary, timeoutMs: 50 }), { code: "REPORT_JUDGE_TIMEOUT" });
  const abort   = new AbortController()                                                                       ;
  const pending = judgeNativeReport(input, { binary: timeout.binary, timeoutMs: 2000, signal: abort.signal }) ;
  setTimeout(() => abort.abort(), 30);
  await assert.rejects(pending, { code: "REPORT_JUDGE_CANCELLED" });
  await assert.rejects(judgeNativeReport(input, { binary: timeout.binary, signal: abort.signal }), { code: "REPORT_JUDGE_CANCELLED" });
});

test("과대한 입력은 모델 subprocess를 시작하기 전에 거부한다", async () => {
  await assert.rejects(judgeNativeReport({ ...input, answer: "가".repeat(96_000) }, { binary: "/실행하면안되는경로" }), { code: "REPORT_JUDGE_INVALID_INPUT" });
  await assert.rejects(judgeNativeReport({ ...input, files: Array(201).fill("src/file.ts") }), (error: unknown) => error instanceof ReportJudgeError && error.code === "REPORT_JUDGE_INVALID_INPUT");
  await assert.rejects(judgeNativeReport(input, { timeoutMs: 1 }), { code: "REPORT_JUDGE_INVALID_INPUT" });
});

test("실제 판단기의 모순·빈 응답·과대 응답은 하네스의 고정 응답 오류가 된다", async (t) => {
  for (const response of [{ ...report, needed: false }, "", "x".repeat(96_001)]) {
    const fixture    = await server(t, "normal", response)                            ;
    const repository = await fs.mkdtemp(path.join(os.tmpdir(), "www-judge-harness-")) ;
    t.after(() => fs.rm(repository, { recursive: true, force: true }));
    let failure : ((job: NativeReportJob) => void) | undefined                                                                                                         ;
    let timer   : ReturnType<typeof setTimeout> | undefined                                                                                                            ;
    const failed = new Promise<NativeReportJob>((resolve, reject) => { failure = resolve; timer = setTimeout(() => reject(new Error("실패 상태 대기 초과")), 3000); }) ;
    const harness = createNativeReportHarness({
      judge: (value) => judgeNativeReport(value, { binary: fixture.binary, timeoutMs: 2000 }),
      onState: (job) => { if (job.status === "failed") failure?.(job); },
    });
    try {
      await harness.enqueue({ repository, input });
      const job = await failed;
      assert.equal(job.status, "failed");
      assert.match(job.reason, /^보고서 판단 응답의 JSON 또는 서술 형식이 올바르지 않습니다\./);
      assert.doesNotMatch(job.reason, /불필요 판단|최종 메시지|최종 응답/);
    } finally { clearTimeout(timer); }
  }
});

test("입력 오류는 하네스에서 LLM 응답 오류로 분류하지 않는다", async (t) => {
  const repository = await fs.mkdtemp(path.join(os.tmpdir(), "www-judge-input-harness-"));
  t.after(() => fs.rm(repository, { recursive: true, force: true }));
  let failure : ((job: NativeReportJob) => void) | undefined                                                                                                         ;
  let timer   : ReturnType<typeof setTimeout> | undefined                                                                                                            ;
  const failed = new Promise<NativeReportJob>((resolve, reject) => { failure = resolve; timer = setTimeout(() => reject(new Error("실패 상태 대기 초과")), 3000); }) ;
  const harness = createNativeReportHarness({
    judge: (value) => judgeNativeReport(value, { timeoutMs: 1 }),
    onState: (job) => { if (job.status === "failed") failure?.(job); },
  });
  try {
    await harness.enqueue({ repository, input });
    const job = await failed;
    assert.equal(job.status, "failed");
    assert.match(job.reason, /^보고서 판단 입력의 형식 또는 범위가 올바르지 않습니다\./);
  } finally { clearTimeout(timer); }
});
