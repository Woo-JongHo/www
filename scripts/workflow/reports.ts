import { createHash, randomUUID } from "node:crypto";
import { constants, promises as fs, type Dirent } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import { assertWorkId } from "./preflight.ts";
import { captureSource, criteriaDigest } from "./evidence.ts";
import { renderReportDocument } from "./report-view.ts";

export interface ReportReader {
  story        : string ;
  requirements : {
    requirement : string        ;
    result      : string        ;
    evidence    : string | null ;
    limitations : string | null ;
  }[];
  checks       : {
    target      : string        ;
    method      : string        ;
    expected    : string | null ;
    observed    : string | null ;
    limitations : string | null ;
  }[];
  decisions    : {
    problem      : string        ;
    basis        : string | null ;
    alternatives : string[]      ;
    choice       : string        ;
    tradeoff     : string | null ;
  }[];
  references   : {
    path    : string ;
    purpose : string ;
  }[];
  nextActions  : {
    action   : string        ;
    owner    : string | null ;
    doneWhen : string | null ;
    impact   : string | null ;
  }[];
}

export interface ReportNarrative {
  summary     : string       ;
  before      : string       ;
  after       : string       ;
  changes     : string[]     ;
  decisions   : string[]     ;
  limitations : string[]     ;
  next        : string[]     ;
  reader?     : ReportReader ;
}

export type ReportOutcome = "completed" | "partial" | "blocked" | "failed" | "in_progress";

export interface ReportSource {
  recordPath     : string        ;
  workRecordHash : string        ;
  sourceDigest   : string | null ;
  criteriaDigest : string | null ;
}

export interface ReportSummary {
  id             : string                  ;
  workId         : string                  ;
  title          : string                  ;
  summary        : string                  ;
  outcome        : ReportOutcome           ;
  kind           : "authored" | "snapshot" ;
  createdAt      : string                  ;
  event          : string                  ;
  workRecordHash : string                  ;
  sourceDigest   : string | null           ;
  criteriaDigest : string | null           ;
  source         : ReportSource            ;
}

export interface WorkReport extends ReportSummary {
  schemaVersion : 1                      ;
  semanticHash  : string                 ;
  narrative     : ReportNarrative | null ;
  work : {
    status        : string        ;
    blockedReason : string | null ;
    criteria : {
      id          : string  ;
      description : string  ;
      required    : boolean ;
      result      : string  ;
      evidence : {
        path    : string ;
        summary : string ;
      }[];
    }[];
    verifications : {
      id      : string          ;
      command : string          ;
      args    : string[] | null ;
      environment : {
        platform : string ;
        arch     : string ;
        node     : string ;
      } | null;
      result       : string        ;
      executor     : string        ;
      exitCode     : number | null ;
      sourceStable : boolean       ;
      completedAt  : string | null ;
    }[];
    reviews : {
      id          : string        ;
      verdict     : string        ;
      model       : string | null ;
      executor    : string        ;
      receiptPath : string        ;
      findings    : string[]      ;
    }[];
    omitted? : {
      criteria      : number ;
      evidence      : number ;
      verifications : number ;
      reviews       : number ;
      arguments     : number ;
      findings?     : number ;
      unresolved    : number ;
    };
  };
}

export interface ReportResult {
  report  : WorkReport ;
  html    : string     ;
  created : boolean    ;
}

export interface ReportReadResult {
  report  : WorkReport ;
  html    : string     ;
  current : boolean    ;
  stale   : boolean    ;
  reasons : string[]   ;
}

interface WorkRecord extends Record<string, unknown> {
  id            : string                  ;
  title         : string                  ;
  status        : string                  ;
  schemaVersion : number                  ;
  blockedReason : string | null           ;
  criteria      : unknown[]               ;
  workflow?     : Record<string, unknown> ;
}
interface WorkLocation {
  path   : string     ;
  record : WorkRecord ;
  source : string     ;
}
interface ReportState {
  current  : boolean  ;
  stale    : boolean  ;
  reasons  : string[] ;
  checked? : boolean  ;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function objectValue(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new Error("보고서의 객체 형식이 올바르지 않습니다.");
  return value;
}
function arrayValue(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("보고서의 배열 형식이 올바르지 않습니다.");
  return value;
}
function stringArray(value: unknown): string[] {
  return arrayValue(value).map((entry) => {
    if (typeof entry !== "string") throw new Error("문자열 배열이 필요합니다.");
    return entry;
  });
}
function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("문자열 또는 null이 필요합니다.");
  return value;
}
function errorCode(value: unknown): string | undefined {
  return object(value) && typeof value.code === "string" ? value.code : undefined;
}
function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
function workValue(input: unknown): WorkRecord {
  const value = objectValue(input);
  if (typeof value.schemaVersion !== "number") throw new Error("작업 스키마 버전이 필요합니다.");
  return { ...value, id: text(value.id), title: text(value.title, 4000), status: text(value.status), schemaVersion: value.schemaVersion, blockedReason: optionalString(value.blockedReason), criteria: arrayValue(value.criteria), workflow: value.workflow === undefined ? undefined : objectValue(value.workflow) };
}

const REPORT_ID  = /^report-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ ;
const HASH       = /^[a-f0-9]{64}$/                                                                   ;
const JSON_LIMIT = 1_048_576                                                                          ;
const HTML_LIMIT = 2_097_152                                                                          ;

const LABELS: Record<ReportOutcome, string> = {
  completed   : "작업 완료"                  ,
  partial     : "일부 확인 · 후속 작업 있음" ,
  blocked     : "차단 사항 있음"             ,
  failed      : "실패 관찰"                  ,
  in_progress : "진행 기록"                  ,
};
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function text(value: unknown, limit = 12_000): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new Error("보고서에는 제한 길이 안의 비어 있지 않은 문장이 필요합니다.");
  return value;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 40) throw new Error("보고서 항목은 최대 40개의 문장 배열이어야 합니다.");
  return value.map((item) => text(item));
}

function exactFields(value: Record<string, unknown>, fields: string[]): void {
  if (Object.keys(value).some((key) => !fields.includes(key)) || fields.some((key) => !(key in value))) throw new Error("읽기 설명의 필드가 누락됐거나 알 수 없는 필드가 있습니다.");
}

function readerRows<T>(value: unknown, parse: (value: Record<string, unknown>) => T): T[] {
  const rows = arrayValue(value);
  if (rows.length > 20) throw new Error("읽기 설명 배열은 최대 20개입니다.");
  return rows.map((row) => parse(objectValue(row)));
}

function readerNullable(value: unknown): string | null {
  return value === null ? null : text(value, 4000);
}

export function parseReportReader(input: unknown): ReportReader {
  const value = objectValue(input);
  exactFields(value, ["story", "requirements", "checks", "decisions", "references", "nextActions"]);
  return {
    story        : text(value.story, 8000),
    requirements : readerRows(value.requirements, (row) => {
      exactFields(row, ["requirement", "result", "evidence", "limitations"]);
      return { requirement: text(row.requirement, 4000), result: text(row.result, 4000), evidence: readerNullable(row.evidence), limitations: readerNullable(row.limitations) };
    }),
    checks       : readerRows(value.checks, (row) => {
      exactFields(row, ["target", "method", "expected", "observed", "limitations"]);
      return { target: text(row.target, 4000), method: text(row.method, 4000), expected: readerNullable(row.expected), observed: readerNullable(row.observed), limitations: readerNullable(row.limitations) };
    }),
    decisions    : readerRows(value.decisions, (row) => {
      exactFields(row, ["problem", "basis", "alternatives", "choice", "tradeoff"]);
      const alternatives = stringArray(row.alternatives);
      if (alternatives.length > 20) throw new Error("비교 대안은 최대 20개입니다.");
      return { problem: text(row.problem, 4000), basis: readerNullable(row.basis), alternatives: alternatives.map((item) => text(item, 4000)), choice: text(row.choice, 4000), tradeoff: readerNullable(row.tradeoff) };
    }),
    references   : readerRows(value.references, (row) => {
      exactFields(row, ["path", "purpose"]);
      return { path: text(row.path, 4000), purpose: text(row.purpose, 4000) };
    }),
    nextActions  : readerRows(value.nextActions, (row) => {
      exactFields(row, ["action", "owner", "doneWhen", "impact"]);
      return { action: text(row.action, 4000), owner: readerNullable(row.owner), doneWhen: readerNullable(row.doneWhen), impact: readerNullable(row.impact) };
    }),
  };
}

function narrativeValue(input: unknown): ReportNarrative {
  const value = objectValue(input);
  return {
    summary     : text(value.summary, 4000)  ,
    before      : text(value.before)         ,
    after       : text(value.after)          ,
    changes     : strings(value.changes)     ,
    decisions   : strings(value.decisions)   ,
    limitations : strings(value.limitations) ,
    next        : strings(value.next)        ,
    ...(value.reader === undefined ? {} : { reader: parseReportReader(value.reader) }),
  };
}

async function inside(root: string, file: string, missing = false): Promise<string> {
  const target   = path.resolve (root, file  ) ;
  const relative = path.relative(root, target) ;
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("보고서 경로가 저장소를 벗어납니다.");
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("보고서 경로의 심볼릭 링크는 허용되지 않습니다."); }
    catch (error) { if (missing && errorCode(error) === "ENOENT") return target; throw error; }
  }
  return target;
}

async function readJson(root: string, file: string): Promise<{ source: string; value: unknown }> {
  const target = await inside(root, file)                                                ;
  const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)) ;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > JSON_LIMIT) throw new Error("보고서 입력은 1 MiB 이하의 일반 JSON 파일이어야 합니다.");
    const source = await handle.readFile("utf8");
    return { source, value: JSON.parse(source) };
  } finally { await handle.close(); }
}

async function workLocations(repo?: string): Promise<{ root: string; works: WorkLocation[]; warnings: string[] }> {
  const root                      = await fs.realpath(repo ?? process.cwd()) ;
  const start                     = await inside(root, "docs/work", true)    ;
  const works    : WorkLocation[] = []                                       ;
  const warnings : string[]       = []                                       ;
  let count                       = 0                                        ;
  async function visit(directory: string, depth: number): Promise<void> {
    if (depth > 8) throw new Error("작업 기록 탐색 깊이가 제한을 초과했습니다.");
    let entries: Dirent[];
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (errorCode(error) === "ENOENT") return; throw error; }
    for (const entry of entries) {
      if (++count > 10_000) throw new Error("작업 기록 탐색 항목이 제한을 초과했습니다.");
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) { warnings.push(`${path.relative(root, candidate)}: 심볼릭 링크를 읽지 않았습니다.`); continue; }
      if (entry.isDirectory() && entry.name !== "reports") await visit(candidate, depth + 1);
      if (entry.isFile() && entry.name === "work.json") {
        try {
          const { source, value } = await readJson(root, candidate);
          const record = workValue(value);
          assertWorkId(record.id);
          works.push({ path: candidate, record, source });
        } catch (error) { warnings.push(`${path.relative(root, candidate)}: ${errorMessage(error)}`); }
      }
    }
  }
  await visit(start, 0);
  return { root, works, warnings };
}

async function locateWork(repo: string | undefined, workId: string): Promise<WorkLocation & { root: string }> {
  const id      = assertWorkId(workId)                                               ;
  const found   = await workLocations(repo)                                          ;
  const matches = found.works.filter(({ record }) => record.id.toLowerCase() === id) ;
  if (matches.length !== 1) throw new Error("보고서 대상 작업 UUID가 없거나 중복돼 있습니다.");
  return { root: found.root, ...matches[0] };
}

function outcomeFor(record: WorkRecord): ReportOutcome {
  if (record.status === "done"                                                                              ) return "completed"
  if (record.blockedReason                                                                                  ) return "blocked"
  if (record.criteria.some((item) => objectValue(item).result === "failed")                                 ) return "failed"
  if (record.criteria.some((item) => objectValue(item).result === "passed") || record.status === "cancelled") return "partial"
  return "in_progress";
}

type CriterionFact    = WorkReport["work"]["criteria"][number]      ;
type VerificationFact = WorkReport["work"]["verifications"][number] ;
type ReviewFact       = WorkReport["work"]["reviews"][number]       ;

function criterionFact(input: unknown): CriterionFact {
  const item     = objectValue(input              ) ;
  const evidence = arrayValue (item.evidence ?? []) ;
  return {
    id: text(item.id), description: text(item.description), required: item.required === true, result: text(item.result),
    evidence: evidence.slice(-10).map((input) => {
      const entry = objectValue(input);
      return { path: String(entry.path ?? ""), summary: String(entry.summary ?? "") };
    }),
  };
}

function verificationFact(input: unknown, mode: "record" | "report"): VerificationFact {
  const item        = objectValue(input)                                                                  ;
  const sourceArgs  = mode === "record" ? item.argumentsRedacted === false ? item.args : null : item.args ;
  const args        = sourceArgs == null ? null : stringArray(sourceArgs).slice(0, 50)                    ;
  const environment = item.environment == null ? null : objectValue(item.environment)                     ;
  const exitCode    = item.exitCode ?? null                                                               ;
  if (exitCode !== null && (typeof exitCode !== "number" || !Number.isInteger(exitCode))) throw new Error("보고서 검증 종료 코드는 정수여야 합니다.");
  return {
    id: text(item.id), command: text(item.requestedCommand ?? item.command ?? "미제공"), args,
    environment: environment === null ? null : { platform: text(environment.platform ?? "미확인"), arch: text(environment.arch ?? "미확인"), node: text(environment.node ?? "미확인") },
    result: text(item.result), executor: text(item.executor ?? "unknown"), exitCode, sourceStable: item.sourceStable === true, completedAt: optionalString(item.completedAt),
  };
}

function reviewFact(input: unknown, mode: "record" | "report"): ReviewFact {
  const item = objectValue(input);
  return { id: text(item.id), verdict: text(item.verdict), model: optionalString(mode === "record" ? item.observedModel : item.model), executor: text(item.executor ?? "unknown"), receiptPath: typeof item.receiptPath === "string" ? item.receiptPath : "", findings: stringArray(item.findings ?? []).slice(0, 30) };
}

function facts(record: WorkRecord): WorkReport["work"] {
  const criteria      = record.criteria                                                                                                                                    ;
  const verifications = arrayValue(record.workflow?.verifications ?? [])                                                                                                   ;
  const reviews       = arrayValue(record.workflow?.reviews ?? [])                                                                                                         ;
  const omittedFacts  = [...criteria.slice(100), ...verifications.slice(0, Math.max(0, verifications.length - 20)), ...reviews.slice(0, Math.max(0, reviews.length - 10))] ;
  const omitted = {
    criteria      : Math.max(0, criteria.length - 100)     ,
    evidence      :
      criteria.reduce((count: number, value) => count + arrayValue(objectValue(value).evidence ?? []).length, 0)
      - criteria.slice(0, 100).reduce((count: number, value) => count + Math.min(10, arrayValue(objectValue(value).evidence ?? []).length), 0),
    verifications : Math.max(0, verifications.length - 20) ,
    reviews       : Math.max(0, reviews.length - 10)       ,
    arguments     : verifications.reduce((count: number, value, index) => {
      const item = objectValue(value);
      return count + (item.argumentsRedacted === false && Array.isArray(item.args) ? Math.max(0, item.args.length - (index < verifications.length - 20 ? 0 : 50)) : 0);
    }, 0),
    findings      : reviews.reduce(
      (count: number, value, index) => count + Math.max(0, arrayValue(objectValue(value).findings ?? []).length - (index < reviews.length - 10 ? 0 : 30)),
      0,
    ),
    unresolved    : omittedFacts.filter((value) => {
      const item = objectValue(value);
      return !["passed", "pass"].includes(String(item.result ?? item.verdict));
    }).length,
  };
  return {
    status        : record.status                                                                                               ,
    blockedReason : record.blockedReason?.slice(0, 12_000) ?? null                                                              ,
    criteria      : record.criteria.slice(0, 100).map(criterionFact)                                                            ,
    verifications : arrayValue(record.workflow?.verifications ?? []).slice(-20).map((item) => verificationFact(item, "record")) ,
    reviews       : arrayValue(record.workflow?.reviews ?? []).slice(-10).map((item) => reviewFact(item, "record"))             ,
    ...(Object.values(omitted).some((count) => count > 0) ? { omitted } : {}),
  };
}

function reportFacts(input: unknown): WorkReport["work"] {
  const work          = objectValue(input             ) ;
  const criteria      = arrayValue (work.criteria     ) ;
  const verifications = arrayValue (work.verifications) ;
  const reviews       = arrayValue (work.reviews      ) ;
  if (criteria.length > 100 || verifications.length > 20 || reviews.length > 10) throw new Error("보고서 근거 스냅샷의 크기가 올바르지 않습니다.");
  for (const input of criteria) {
    const item = objectValue(input);
    if (typeof item.required !== "boolean" || arrayValue(item.evidence).length > 10) throw new Error("보고서 수용 기준의 형식이 올바르지 않습니다.");
    for (const input of arrayValue(item.evidence)) {
      const entry = objectValue(input);
      if (typeof entry.path !== "string" || typeof entry.summary !== "string") throw new Error("보고서 수용 기준 근거의 형식이 올바르지 않습니다.");
    }
  }
  for (const input of verifications) {
    const item = objectValue(input);
    if (typeof item.sourceStable !== "boolean" || (item.args != null && arrayValue(item.args).length > 50)) throw new Error("보고서 검증 시도의 형식이 올바르지 않습니다.");
  }
  for (const input of reviews) if (arrayValue(objectValue(input).findings).length > 30) throw new Error("보고서 독립 검토의 형식이 올바르지 않습니다.");
  let omitted: NonNullable<WorkReport["work"]["omitted"]> | undefined;
  if (work.omitted !== undefined) {
    const value = objectValue(work.omitted);
    const count = (key: string): number => {
      const item = value[key];
      if (typeof item !== "number" || !Number.isSafeInteger(item) || item < 0) throw new Error("보고서 생략 개수는 0 이상의 정수여야 합니다.");
      return item;
    };
    exactFields(value, ["criteria", "evidence", "verifications", "reviews", "arguments", "unresolved", ...(value.findings === undefined ? [] : ["findings"]) ]);
    omitted = { criteria: count("criteria"), evidence: count("evidence"), verifications: count("verifications"), reviews: count("reviews"), arguments: count("arguments"), ...(value.findings === undefined ? {} : { findings: count("findings") }), unresolved: count("unresolved") };
  }
  return { status: text(work.status), blockedReason: optionalString(work.blockedReason), criteria: criteria.map(criterionFact), verifications: verifications.map((item) => verificationFact(item, "report")), reviews: reviews.map((item) => reviewFact(item, "report")), ...(omitted ? { omitted } : {}) };
}

async function sourceIdentity(root: string, record: WorkRecord): Promise<{ sourceDigest: string | null; criteriaDigest: string | null }> {
  if (record.schemaVersion !== 2 || !Array.isArray(record.workflow?.inputs) || !record.workflow.inputs.length) return { sourceDigest: null, criteriaDigest: null };
  const source = await captureSource({ repo: root, inputs: stringArray(record.workflow.inputs) });
  return { sourceDigest: source.digest, criteriaDigest: criteriaDigest(record) };
}

function outcomeValue(value: unknown): ReportOutcome {
  if (value === "completed" || value === "partial" || value === "blocked" || value === "failed" || value === "in_progress") return value;
  throw new Error("보고서 상태가 올바르지 않습니다.");
}

function hashValue(value: unknown): string {
  const result = text(value, 64);
  if (!HASH.test(result)) throw new Error("보고서 내용 식별값이 올바르지 않습니다.");
  return result;
}

function optionalHash(value: unknown): string | null {
  return value === null ? null : hashValue(value);
}

function validateReport(input: unknown): WorkReport {
  const value  = objectValue(input) ;
  const id     = text(value.id)     ;
  const workId = text(value.workId) ;
  const kind   = value.kind         ;
  if (value.schemaVersion !== 1 || !REPORT_ID.test(id) || assertWorkId(workId) !== workId || (kind !== "authored" && kind !== "snapshot")) throw new Error("보고서 식별자 또는 형식이 올바르지 않습니다.");
  const outcome   = outcomeValue(value.outcome  ) ;
  const createdAt = text        (value.createdAt) ;
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("보고서 작성 시각이 올바르지 않습니다.");
  if (kind === "snapshot" && value.narrative !== null) throw new Error("자동 스냅샷에 작성자 서술을 넣을 수 없습니다.");
  const source         = objectValue (value.source        ) ;
  const workRecordHash = hashValue   (value.workRecordHash) ;
  const sourceDigest   = optionalHash(value.sourceDigest  ) ;
  const criteriaDigest = optionalHash(value.criteriaDigest) ;
  if (source.workRecordHash !== workRecordHash || source.sourceDigest !== sourceDigest || source.criteriaDigest !== criteriaDigest) throw new Error("보고서의 소스·기준 식별값이 올바르지 않습니다.");
  const work = reportFacts(value.work);
  if (outcome === "completed" && work.status !== "done") throw new Error("완료되지 않은 작업을 완료 보고서로 표시할 수 없습니다.");
  return {
    schemaVersion: 1, id, workId, title: text(value.title, 4000), summary: text(value.summary, 4000), kind, outcome, createdAt, event: text(value.event, 100),
    workRecordHash, sourceDigest, criteriaDigest, semanticHash: hashValue(value.semanticHash),
    narrative: kind === "authored" ? narrativeValue(value.narrative) : null, work,
    source: { recordPath: text(source.recordPath), workRecordHash, sourceDigest, criteriaDigest },
  };
}

export function renderWorkReport(input: unknown, state: ReportState = { current: true, stale: false, reasons: [] }): string {
  const html = renderReportDocument(validateReport(input), state);
  if (Buffer.byteLength(html) > HTML_LIMIT) throw new Error("생성된 보고서 HTML이 2 MiB를 초과합니다.");
  return html;
}

async function storedReports(root: string, work: WorkLocation, warnings: string[] = []): Promise<WorkReport[]> {
  const directory = path.join(path.dirname(work.path), "reports");
  await inside(root, directory, true);
  let names: string[];
  try { names = await fs.readdir(directory); }
  catch (error) { if (errorCode(error) === "ENOENT") return []; throw error; }
  if (names.length > 2000) throw new Error("작업별 보고서 수가 탐색 제한을 초과했습니다.");
  const reports: WorkReport[] = [];
  for (const name of names.filter((entry) => entry.endsWith(".json"))) {
    const file = path.join(directory, name);
    try {
      const { value } = await readJson(root, file);
      const report = validateReport(value);
      if (name !== `${report.id}.json` || report.workId !== work.record.id.toLowerCase()) throw new Error("보고서 파일과 작업 식별자가 일치하지 않습니다.");
      reports.push(report);
    } catch (error) { warnings.push(`${path.relative(root, file)}: ${errorMessage(error)}`); }
  }
  return reports;
}

async function publishFile(file: string, source: string): Promise<void> {
  const temporary = `${file}.partial-${randomUUID()}`;
  await fs.writeFile(temporary, source, { flag: "wx", mode: 0o600 });
  try { await fs.link(temporary, file); }
  finally { await fs.unlink(temporary); }
}

async function publish({ repo = process.cwd(), workId, narrative = null, event, kind }: { repo?: string; workId: string; narrative?: ReportNarrative | null; event: string; kind: "authored" | "snapshot" }): Promise<ReportResult> {
  text(event, 100);
  const work           = await locateWork(repo, workId)                                                           ;
  const details        = narrative === null ? null : narrativeValue(narrative)                                    ;
  const identity       = await sourceIdentity(work.root, work.record)                                             ;
  const workRecordHash = digest(work.source)                                                                      ;
  const semanticHash   = digest(JSON.stringify({ kind, event, workRecordHash, ...identity, narrative: details })) ;
  const directory      = path.join(path.dirname(work.path), "reports")                                            ;
  await inside(work.root, directory, true);
  await fs.mkdir(directory, { recursive: true });
  await inside(work.root, directory);
  const leasePath = path.join(directory, `.pending-${semanticHash}`);
  let lease: FileHandle | undefined;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { lease = await fs.open(leasePath, "wx", 0o600); break; }
    catch (error) { if (errorCode(error) !== "EEXIST") throw error; await new Promise((resolve) => setTimeout(resolve, 20)); }
  }
  if (!lease) throw new Error("동일 보고서 작성 잠금이 사용 중입니다. 자동 회수하지 않습니다.");
  try {
    const existing = (await storedReports(work.root, work)).find((report) => report.semanticHash === semanticHash);
    if (existing) return { report: existing, html: renderWorkReport(existing), created: false };
    const id     = `report-${randomUUID()}`                                                                                   ;
    const source = { recordPath: path.relative(work.root, work.path).split(path.sep).join("/"), workRecordHash, ...identity } ;
    const report: WorkReport = {
      schemaVersion: 1, id, workId: work.record.id.toLowerCase(), title: text(work.record.title, 4000),
      summary: details?.summary ?? `${LABELS[outcomeFor(work.record)]}. 검증·검토 기록의 자동 스냅샷이며 작성자 설명은 아직 없습니다.`,
      outcome: outcomeFor(work.record), kind, event, createdAt: new Date().toISOString(), workRecordHash,
      ...identity, semanticHash, narrative: details, work: facts(work.record), source,
    };
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(json) > JSON_LIMIT) throw new Error("보고서 JSON이 1 MiB를 초과합니다.");
    const html     = renderWorkReport(report                 ) ;
    const htmlFile = path.join       (directory, `${id}.html`) ;
    const jsonFile = path.join       (directory, `${id}.json`) ;
    await inside(work.root, htmlFile, true);
    await inside(work.root, jsonFile, true);
    await publishFile(htmlFile, html);
    try { await publishFile(jsonFile, json); }
    catch (error) { await fs.unlink(htmlFile); throw error; }
    return { report, html, created: true };
  } finally { await lease.close(); await fs.unlink(leasePath); }
}

export async function publishWorkReport({ repo, workId, narrative, event = "finish" }: { repo?: string; workId: string; narrative: ReportNarrative; event?: string }): Promise<ReportResult> {
  return publish({ repo, workId, narrative: narrativeValue(narrative), event, kind: "authored" });
}

export async function captureWorkReport({ repo, workId, event = "state-change" }: { repo?: string; workId: string; event?: string }): Promise<ReportResult> {
  return publish({ repo, workId, event, kind: "snapshot" });
}

export async function listWorkReports({ repo = process.cwd() }: { repo?: string } = {}): Promise<{ reports: ReportSummary[]; warnings: string[] }> {
  const { root, works, warnings } = await workLocations(repo);
  const reports: WorkReport[] = [];
  for (const work of works) {
    try { reports.push(...await storedReports(root, work, warnings)); }
    catch (error) { warnings.push(`${path.relative(root, work.path)}: ${errorMessage(error)}`); }
  }
  return {
    reports: reports.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id)).map(({ id, workId, title, summary, outcome, kind, createdAt, event, workRecordHash, sourceDigest, criteriaDigest: criteriaHash, source }) => ({ id, workId, title, summary, outcome, kind, createdAt, event, workRecordHash, sourceDigest, criteriaDigest: criteriaHash, source })),
    warnings,
  };
}

export async function readWorkReport({ repo = process.cwd(), reportId }: { repo?: string; reportId: string }): Promise<ReportReadResult> {
  if (typeof reportId !== "string" || !REPORT_ID.test(reportId)) throw new Error("유효한 보고서 UUID가 필요합니다.");
  const { root, works } = await workLocations(repo);
  const matches: { report: WorkReport; work: WorkLocation }[] = [];
  for (const work of works) {
    const candidate = path.join(path.dirname(work.path), "reports", `${reportId}.json`);
    let item: { source: string; value: unknown };
    try { item = await readJson(root, candidate); }
    catch (error) { if (errorCode(error) === "ENOENT") continue; throw error; }
    const report = validateReport(item.value);
    if (report.id !== reportId || report.workId !== work.record.id.toLowerCase()) throw new Error("보고서 파일의 작업 식별자가 일치하지 않습니다.");
    matches.push({ report, work });
  }
  if (matches.length !== 1) throw new Error("보고서 UUID가 없거나 중복돼 있습니다.");
  const { report, work } = matches[0];
  const current = digest(work.source) === report.workRecordHash ;
  const reasons = current ? [] : ["작업 기록 변경됨"]           ;
  let stale     = false                                         ;
  try {
    const identity = await sourceIdentity(root, work.record);
    if (identity.sourceDigest !== report.sourceDigest) { stale = true; reasons.push("검사 입력 소스 변경됨"); }
    if (identity.criteriaDigest !== report.criteriaDigest) { stale = true; reasons.push("수용 기준 변경됨"); }
  } catch (error) { stale = true; reasons.push(`현재 소스 식별 미확인: ${errorMessage(error)}`); }
  const state = { current, stale, reasons, checked: true };
  return { report, html: renderWorkReport(report, state), ...state };
}
