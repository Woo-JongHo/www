import { createHash, randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import { withWorkLock } from "../scripts/workflow/lock.ts";
import { parseReportReader, publishWorkReport } from "../scripts/workflow/reports.ts";
import type { NativeReportDecision, NativeReportInput } from "./report-judge";

export interface NativeReportJob {
  // 턴 식별자
  key      : string ;
  threadId : string ;
  turnId   : string ;
  // 보고서 상태와 저장 결과
  status          :
      "queued"
    | "judging"
    | "skipped"
    | "saved"
    | "failed"
    | "interrupted";
  reason          : string        ;
  reportId        : string | null ;
  workId?         : string        ;
  retryAvailable? : boolean       ;
  updatedAt       : string        ;
}

interface Entry {
  repository : string               ;
  input      : NativeReportInput    ;
  job        : NativeReportJob      ;
  decision?  : NativeReportDecision ;
}

// 원장 식별자 형식
const KEY         = /^[a-f0-9]{64}$/                                                               ;
const UUID        = /^work-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/   ;
const REPORT_UUID = /^report-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/ ;
// 입력과 메모리 보관 한도
const MAX_INPUT_BYTES = 96_000 ;
const MAX_PENDING     = 10     ;
const MAX_MEMORY      = 20     ;
// 저장 가능한 작업 상태
const STATES = new Set(["queued", "judging", "skipped", "saved", "failed", "interrupted"]);
function now() {
  return new Date().toISOString();
}
function keyFor(input: Pick<NativeReportInput, "threadId" | "turnId">) {
  return createHash("sha256")
    .update(input.threadId)
    .update(     "\0"     )
    .update(input.turnId  )
    .digest("hex");
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function code(error: unknown): string | undefined {
  return object(error) && typeof error.code === "string" ? error.code : undefined;
}
type FailureKind = "invalid_response" | "input_error" | "judge_timeout" | "judge_error" | "save_error" | "unknown";
type ExecutionPhase = "state" | "judge" | "decision" | "save";
const FAILURE_TEXT: Record<FailureKind, string> = {
  invalid_response : "보고서 판단 응답의 JSON 또는 서술 형식이 올바르지 않습니다." ,
  input_error      : "보고서 판단 입력의 형식 또는 범위가 올바르지 않습니다."      ,
  judge_timeout    : "보고서 LLM 판단 시간이 초과됐습니다."                        ,
  judge_error      : "보고서 LLM 판단 실행에 실패했습니다."                        ,
  save_error       : "보고서 또는 작업 상태 저장에 실패했습니다."                  ,
  unknown          : "자동 보고서의 이전 실패 기록입니다."                         ,
};

function failureReason(kind: FailureKind, retryAvailable: boolean): string {
  return `${FAILURE_TEXT[kind]} ${retryAvailable
    ? "원문은 현재 앱의 제한된 메모리에만 남아 있어 이 앱이 실행 중일 때만 명시적으로 재시도할 수 있습니다."
    : "원문을 디스크에 저장하지 않았으며 현재 메모리에도 없어 이 작업을 재시도할 수 없습니다."}`;
}

function failureKind(reason: string): FailureKind {
  const kinds: FailureKind[] = ["invalid_response", "input_error", "judge_timeout", "judge_error", "save_error", "unknown"];
  for (const kind of kinds) {
    if (reason.startsWith(FAILURE_TEXT[kind])) return kind;
  }
  return "unknown";
}

function executionFailure(error: unknown, phase: ExecutionPhase): FailureKind | "cancelled" {
  const name = error instanceof Error ? error.name : object(error) ? error.name : undefined;
  if (phase === "save" || phase === "state") return "save_error";
  if (phase === "decision")                  return "invalid_response";
  switch (code(error)) {
    case "REPORT_JUDGE_INVALID_RESPONSE": return "invalid_response";
    case "REPORT_JUDGE_INVALID_INPUT"   : return "input_error";
    case "REPORT_JUDGE_TIMEOUT"         : return "judge_timeout";
    case "REPORT_JUDGE_CANCELLED"       : return "cancelled";
    case "ABORT_ERR"                    : return "cancelled";
    case "ETIMEDOUT"                    : return "judge_timeout";
  }
  if (name === "AbortError")                 return "cancelled";
  return "judge_error";
}

function boundedText(value: unknown, max: number, empty = false): string {
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim())) throw new Error("Native 보고서 입력 문장의 형식 또는 길이가 올바르지 않습니다.");
  return value;
}

function validatedInput(input: unknown): NativeReportInput {
  if (!object(input)) throw new Error("Native 보고서 입력이 올바르지 않습니다.");
  const threadId = boundedText(input.threadId, 200                ) ;
  const turnId   = boundedText(input.turnId, 200                  ) ;
  const prompt   = boundedText(input.prompt, MAX_INPUT_BYTES, true) ;
  const answer   = boundedText(input.answer, MAX_INPUT_BYTES, true) ;
  if (!Array.isArray(input.commands) || input.commands.length > 100 || !Array.isArray(input.files) || input.files.length > 200 || typeof input.truncated !== "boolean") throw new Error("Native 보고서 관찰 목록이 제한을 초과했습니다.");
  const commands = input.commands.map((value: unknown) => {
    if (!object(value)) throw new Error("Native 명령 관찰이 올바르지 않습니다.");
    const command  = boundedText(value.command, 4096, true) ;
    const status   = boundedText(value.status, 100)         ;
    const exitCode = value.exitCode                         ;
    if (exitCode !== null && (typeof exitCode !== "number" || !Number.isInteger(exitCode))) throw new Error("Native 명령 종료 코드는 정수 또는 null이어야 합니다.");
    return { command, status, exitCode };
  });
  const files = input.files.map((file: unknown) => boundedText(file, 4096));
  const normalized = {
    threadId ,
    turnId   ,
    prompt   ,
    answer   ,
    commands ,
    files    ,
    truncated: input.truncated
  };
  if (Buffer.byteLength(JSON.stringify(normalized)) > MAX_INPUT_BYTES) throw new Error("Native 보고서 입력이 96,000바이트 제한을 초과했습니다.");
  return normalized;
}

function validatedDecision(input: unknown): NativeReportDecision {
  if (!object(input) || typeof input.needed !== "boolean") throw new Error("Native 보고서 판단 형식이 올바르지 않습니다.");
  const reason = boundedText(input.reason, 2000             ) ;
  const title  = boundedText(input.title, 200, !input.needed) ;
  if (!input.needed) {
    if (input.narrative !== null) throw new Error("생략 판단은 서술을 생성하지 않습니다.");
    return { needed: false, reason, title, narrative: null };
  }
  const narrative = input.narrative;
  if (!object(narrative)) throw new Error("필요한 보고서의 작성자 서술이 없습니다.");
  const lines = (value: unknown): string[] => {
    if (!Array.isArray(value) || value.length > 40) throw new Error("Native 보고서 서술 목록이 올바르지 않습니다.");
    return value.map((line: unknown) => boundedText(line, 12_000));
  };
  return {
    needed    : true ,
    reason           ,
    title            ,
    narrative : {
      summary     : boundedText(narrative.summary, 4000)  ,
      before      : boundedText(narrative.before, 12_000) ,
      after       : boundedText(narrative.after, 12_000)  ,
      changes     : lines(narrative.changes)              ,
      decisions   : lines(narrative.decisions)            ,
      limitations : lines(narrative.limitations)          ,
      next        : lines(narrative.next)                 ,
      ...(narrative.reader === undefined ? {} : { reader: parseReportReader(narrative.reader) })
    }
  };
}

async function safePath(root: string, relative: string, missing = false): Promise<string> {
  const target = path.resolve (root, relative) ;
  const suffix = path.relative(root, target  ) ;
  if (suffix === ".." || suffix.startsWith(`..${path.sep}`) || path.isAbsolute(suffix)) throw new Error("Native 보고서 경로가 저장소를 벗어납니다.");
  let current = root;
  for (const segment of suffix.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("Native 보고서 경로의 심볼릭 링크는 허용되지 않습니다."); }
    catch (error: unknown) { if (missing && code(error) === "ENOENT") return target; throw error; }
  }
  return target;
}

async function atomic(root: string, file: string, value: string): Promise<void> {
  await safePath(root, file, true);
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, value, { flag: "wx", mode: 0o600 });
  try { await safePath(root, file, true); await fs.rename(temporary, file); }
  finally { await fs.unlink(temporary).catch((error: unknown) => { if (code(error) !== "ENOENT") throw error; }); }
}

async function metadataDirectory(repository: string, create = false): Promise<string> {
  const directory = await safePath(repository, ".www/native-report-jobs", true);
  if (create) { await fs.mkdir(directory, { recursive: true }); await safePath(repository, directory); }
  return directory;
}

function parseJob(value: unknown): NativeReportJob {
  if (!object(value)) throw new Error("Native 보고서 상태 파일이 올바르지 않습니다.");
  const key    = boundedText(value.key, 64) ;
  const status = value.status               ;
  if (!KEY.test(key) || typeof status !== "string" || !STATES.has(status)) throw new Error("Native 보고서 작업 키 또는 상태가 올바르지 않습니다.");
  const reportId = value.reportId;
  if (reportId !== null && (typeof reportId !== "string" || !REPORT_UUID.test(reportId))) throw new Error("Native 보고서 식별자가 올바르지 않습니다.");
  if (status === "saved" && reportId === null) throw new Error("저장된 Native 보고서 ID가 없습니다.");
  const workId = value.workId;
  if (workId !== undefined && (typeof workId !== "string" || !UUID.test(workId))) throw new Error("Native 작업 UUID가 올바르지 않습니다.");
  const threadId = boundedText(value.threadId, 200) ;
  const turnId   = boundedText(value.turnId  , 200) ;
  if (keyFor({ threadId, turnId }) !== key) throw new Error("Native 작업 키가 thread/turn과 일치하지 않습니다.");
  if (status !== "queued" && status !== "judging" && status !== "skipped" && status !== "saved" && status !== "failed" && status !== "interrupted") throw new Error("Native 작업 상태가 올바르지 않습니다.");
  const updatedAt = boundedText(value.updatedAt, 100);
  if (!Number.isFinite(Date.parse(updatedAt))) throw new Error("Native 작업 상태 시각이 올바르지 않습니다.");
  return { key, threadId, turnId, status, reason: boundedText(value.reason, 2000, true), reportId, updatedAt, ...(workId ? { workId } : {}) };
}

async function readJob(repository: string, key: string): Promise<NativeReportJob | null> {
  if (!KEY.test(key)) throw new Error("Native 작업 키가 올바르지 않습니다.");
  const directory = await metadataDirectory(repository) ;
  const file      = path.join(directory, `${key}.json`) ;
  try {
    await safePath(repository, file);
    const sourceStat = await fs.lstat(file);
    if (!sourceStat.isFile() || sourceStat.size > 16_384) throw new Error("Native 상태 파일은 제한 크기 이하의 일반 파일이어야 합니다.");
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 16_384) throw new Error("Native 상태 파일 크기가 제한을 초과했습니다.");
      const value: unknown = JSON.parse(await handle.readFile("utf8")) ;
      const job            = parseJob  (value                        ) ;
      if (job.key !== key) throw new Error("Native 상태 파일 이름이 작업 키와 다릅니다.");
      return job;
    } finally { await handle.close(); }
  } catch (error: unknown) { if (code(error) === "ENOENT") return null; throw error; }
}

async function saveJob(repository: string, job: NativeReportJob): Promise<void> {
  const directory = await metadataDirectory(repository, true);
  await atomic(repository, path.join(directory, `${job.key}.json`), `${JSON.stringify(job, null, 2)}\n`);
}

function safeTitle(input: string): string {
  const characters = Array.from(
    input
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, 72);
  let title = "";
  for (const character of characters) {
    if (Buffer.byteLength(title + character) > 220) break;
    title += character;
  }
  title = title.replace(/[. ]+$/, "");
  return !title || title === "." || title === ".." ? "Native 작업 보고서" : /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(title) ? `Native ${title}` : title;
}

const markdown   = (value: string) => value.replace(/[\\[\]()<>]/g, (character) => `\\${character}`) ;
const encodePath = (value: string) => value.split(path.sep).map(encodeURIComponent).join("/")        ;

function appendNativeIndex(source: string, block: string): string {
  const section = /^## Native\r?$/m.exec(source);
  if (!section) return `${source.trimEnd()}\n\n## Native\n\n${block}\n`;
  const start     = section.index + section[0].length                   ;
  const following = /^## /m.exec(source.slice(start))                   ;
  const end       = following ? start + following.index : source.length ;
  return `${source.slice(0, end).trimEnd()}\n\n${block}\n\n${source.slice(end)}`;
}

async function registerWork(entry: Entry, decision: NativeReportDecision): Promise<string> {
  return withWorkLock(entry.repository, async (root) => {
    const directory = await safePath(root, "docs/work/Native", true);
    await fs.mkdir(directory, { recursive: true });
    await safePath(root, directory);
    const folders = await fs.readdir(directory, { withFileTypes: true });
    if (folders.length > 2000) throw new Error("Native 작업 폴더 수가 제한을 초과했습니다.");
    let found: { id: string; directory: string } | null = null;
    for (const folder of folders) {
      if (folder.isSymbolicLink()) throw new Error("Native 작업 폴더의 심볼릭 링크는 허용되지 않습니다.");
      if (!folder.isDirectory()) continue;
      const workFile = path.join(directory, folder.name, "work.json");
      try {
        await safePath(root, workFile);
        const stat = await fs.stat(workFile);
        if (!stat.isFile() || stat.size > 1_048_576) throw new Error("Native 작업 기록 파일 크기가 제한을 초과했습니다.");
        const value: unknown = JSON.parse(await fs.readFile(workFile, "utf8"));
        if (object(value) && object(value.native) && value.native.key === entry.job.key) {
          if (value.native.threadId !== entry.input.threadId || value.native.turnId !== entry.input.turnId) throw new Error("Native 작업의 원래 턴이 일치하지 않습니다.");
          if (found || typeof value.id !== "string" || !UUID.test(value.id)) throw new Error("같은 Native 턴의 작업 기록이 중복되거나 손상됐습니다.");
          found = { id: value.id, directory: path.dirname(workFile) };
        }
      } catch (error: unknown) { if (code(error) !== "ENOENT") throw error; }
    }
    const title = safeTitle(decision.title);
    if (!found) {
      const next   = Math.max(0, ...folders.map((folder) => Number(folder.name.match(/^(\d{3,})-/)?.[1] ?? 0))) + 1 ;
      const target = path.join(directory, `${String(next).padStart(3, "0")}-${title}`)                              ;
      await safePath(root, target, true);
      await fs.mkdir(target);
      const id = `work-${randomUUID()}`;
      const record = {
        schemaVersion : 1 ,
        id                ,
        title             ,
        kind          : "maintenance"                                            ,
        areas         : ["dev"]                                                  ,
        owner         : "dev"                                                    ,
        status        : "verifying"                                              ,
        blockedReason : "Native 실행 요약이며 업무 수용·독립 검토는 별도입니다." ,
        relations     : []                                                       ,
        criteria      : [{
          id          : "AC-NATIVE"                          ,
          description : "보고서 생성과 업무 수용을 구분한다" ,
          required    : true                                 ,
          result      : "unverified"                         ,
          evidence    : []
        }],
        native        : {
          key       : entry.job.key        ,
          threadId  : entry.input.threadId ,
          turnId    : entry.input.turnId   ,
          commands  : entry.input.commands ,
          files     : entry.input.files    ,
          truncated : entry.input.truncated
        },
      };
      try { await atomic(root, path.join(target, "work.json"), `${JSON.stringify(record, null, 2)}\n`); }
      catch (error: unknown) { await fs.rmdir(target).catch(() => {}); throw error; }
      found = { id, directory: target };
    }
    const spec = path.join(found.directory, "spec.md");
    await safePath(root, spec, true);
    try { await fs.access(spec); }
    catch (error: unknown) {
      if (code(error) !== "ENOENT") throw error;
      await atomic(root, spec, `# ${markdown(title)}\n\n## 작성 목적\n\n${markdown(decision.reason)}\n\n## 관찰과 한계\n\nNative의 종료된 턴에서 전달받은 공개 답변과 명령·파일 관찰을 LLM이 판단해 작성한 작업 보고서다. 원문 prompt·answer는 이 작업 기록에 저장하지 않았다. 명령 종료 코드나 파일 목록은 업무 수용·소스 검증·독립 검토의 통과 근거가 아니다.\n\n수용 기준 AC-NATIVE는 work.json에 미검증으로 보존한다. 입력 절단 여부: ${entry.input.truncated ? "절단됨" : "미절단"}.\n`);
    }
    const index = await safePath(root, "docs/work/INDEX.md", true) ;
    let source  = "# 작업 목차\n"                                  ;
    try { source = await fs.readFile(index, "utf8"); }
    catch (error: unknown) { if (code(error) !== "ENOENT") throw error; }
    const relative = encodePath(path.relative(path.dirname(index), found.directory));
    if (!source.includes(`(${relative}/work.json)`)) {
      const block = `### ${markdown(title)}\n\n- [명세](${relative}/spec.md)\n- [작업 레코드](${relative}/work.json)`;
      await atomic(root, index, appendNativeIndex(source, block));
    }
    return found.id;
  });
}

export function createNativeReportHarness({ judge, onState }: { judge(input: NativeReportInput): Promise<NativeReportDecision>; onState?(job: NativeReportJob): void }) {
  const memory            = new Map<string, Entry>()                    ;
  const pending           = new Set<string>()                           ;
  const preparing         = new Map<string, Promise<NativeReportJob>>() ;
  let tail: Promise<void> = Promise.resolve()                           ;
  function composite(repository: string, key: string) {
    return `${repository}\0${key}`;
  }
  function notify(job: NativeReportJob): void {
    try { onState?.({ ...job }); }
    catch { /* 화면 알림 실패는 저작 결과를 바꾸지 않는다. */ }
  }

  async function state(entry: Entry, changes: Partial<NativeReportJob>): Promise<void> {
    const committed = { ...entry.job, ...changes, updatedAt: now() };
    await saveJob(entry.repository, committed);
    entry.job = committed;
    notify(entry.job);
  }

  function trimMemory(): void {
    for (const key of memory.keys()) {
      if (memory.size <= MAX_MEMORY) break;
      if (!pending.has(key)) memory.delete(key);
    }
  }

  async function execute(entry: Entry): Promise<void> {
    let phase: ExecutionPhase = "state";
    try {
      await state(entry, { status: "judging", reason: "작업 규모와 보고서 필요성을 판단하고 있습니다." });
      let decision = entry.decision;
      if (!decision) {
        phase = "judge";
        const response = await judge(structuredClone(entry.input));
        phase = "decision";
        decision = validatedDecision(response);
      }
      entry.decision = decision;
      phase = "save";
      if (!decision.needed) { await state(entry, { status: "skipped", reason: decision.reason }); return; }
      if (!decision.narrative) throw new Error("작성자 서술이 없습니다.");
      const workId = await registerWork(entry, decision);
      await state(entry, { workId });
      const result = await publishWorkReport({ repo: entry.repository, workId, narrative: decision.narrative, event: "native_completed" });
      await state(entry, { status: "saved", reason: decision.reason, reportId: result.report.id });
    } catch (error: unknown) {
      const failure = executionFailure(error, phase                   ) ;
      const id      = composite       (entry.repository, entry.job.key) ;
      if (failure === "cancelled") memory.delete(id);
      const status = failure === "cancelled" ? "interrupted" : "failed";
      const reason = failure === "cancelled"
        ? "앱 종료 또는 취소 요청으로 보고서 작성이 중단됐습니다. 원문을 유지하지 않아 이 작업을 재시도할 수 없습니다."
        : failureReason(failure, memory.has(id));
      try { await state(entry, { status, reason }); }
      catch {
        entry.job = { ...entry.job, status, reason: failure === "cancelled" ? reason : `${failureReason("save_error", memory.has(id))} 상태 파일도 저장하지 못했습니다.`, updatedAt: now() };
        notify(entry.job);
      }
    }
  }

  function schedule(entry: Entry): void {
    const key = composite(entry.repository, entry.job.key);
    tail = tail.then(() => execute(entry)).finally(() => { pending.delete(key); trimMemory(); });
  }

  async function enqueue({ repository, input }: { repository: string; input: NativeReportInput }): Promise<NativeReportJob> {
    const root     = await fs.realpath(repository) ;
    const bounded  = validatedInput(input)         ;
    const key      = keyFor(bounded)               ;
    const id       = composite(root, key)          ;
    const inFlight = preparing.get(id)             ;
    if (inFlight) return { ...await inFlight };
    const prepare = (async (): Promise<NativeReportJob> => {
      const active = memory.get(id);
      if (active && pending.has(id)) return { ...active.job };
      const stored = await readJob(root, key);
      if (stored) return stored;
      if (pending.size >= MAX_PENDING) throw new Error("Native 보고서 대기 작업이 10개입니다. 완료 후 다시 시도하세요.");
      const job: NativeReportJob = {
        key,
        threadId  : bounded.threadId          ,
        turnId    : bounded.turnId            ,
        status    : "queued"                  ,
        reason    : "보고서 필요성 판단 대기" ,
        reportId  : null                      ,
        updatedAt : now()
      };
      const entry: Entry = { repository: root, input: bounded, job };
      pending.add(id);
      memory.set(id, entry);
      trimMemory();
      try { await saveJob(root, job); }
      catch (error: unknown) { pending.delete(id); memory.delete(id); throw error; }
      notify(job);
      schedule(entry);
      return { ...job };
    })();
    preparing.set(id, prepare);
    try { return { ...await prepare }; }
    finally { preparing.delete(id); }
  }

  async function list(repository: string): Promise<NativeReportJob[]> {
    const root      = await fs.realpath(repository) ;
    const directory = await metadataDirectory(root) ;
    let names: string[]                             ;
    try { names = await fs.readdir(directory); }
    catch (error: unknown) { if (code(error) === "ENOENT") return []; throw error; }
    if (names.length > 2000) throw new Error("Native 작업 상태 목록이 제한을 초과했습니다.");
    const jobs: NativeReportJob[] = [];
    for (const name of names.filter((name) => /^[a-f0-9]{64}\.json$/.test(name))) {
      const stored = await readJob(root, name.slice(0, -5));
      if (!stored) continue;
      const job = { ...(memory.get(composite(root, stored.key))?.job ?? stored) };
      if ((job.status === "queued" || job.status === "judging") && !memory.has(composite(root, job.key))) {
        job.status    = "interrupted"                                                                                                         ;
        job.reason    = "앱 종료로 보고서 작성이 중단됐습니다. 원문을 디스크에 저장하지 않아 자동 복구하거나 이 작업을 재시도할 수 없습니다." ;
        job.updatedAt = now()                                                                                                                 ;
        await saveJob(root, job);
        notify(job);
      }
      if (job.status === "failed" && !memory.has(composite(root, job.key))) {
        const reason = failureReason(failureKind(job.reason), false);
        if (reason !== job.reason) {
          job.reason = reason;
          job.updatedAt = now();
          await saveJob(root, job);
          notify(job);
        }
      }
      job.retryAvailable = job.status === "failed" && memory.has(composite(root, job.key));
      jobs.push(job);
    }
    return jobs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async function retry(repository: string, key: string): Promise<NativeReportJob> {
    if (!KEY.test(key)) throw new Error("Native 작업 키가 올바르지 않습니다.");
    const root   = await fs.realpath(repository) ;
    const stored = await readJob(root, key)      ;
    if (!stored) throw new Error("Native 작업 상태를 찾을 수 없습니다.");
    const id = composite(root, key);
    if (stored.status === "saved" || stored.status === "skipped" || pending.has(id)) return stored;
    const entry = memory.get(id);
    if (!entry) throw new Error("원문이 메모리에 남아 있지 않아 재시도할 수 없습니다. 자동 복구하지 않습니다.");
    if (pending.size >= MAX_PENDING) throw new Error("Native 보고서 대기 작업이 10개입니다.");
    pending.add(id);
    try { await state(entry, { status: "queued", reason: "사용자가 요청한 재시도 대기" }); }
    catch (error: unknown) { pending.delete(id); throw error; }
    schedule(entry);
    return { ...entry.job };
  }

  return { enqueue, list, retry };
}
