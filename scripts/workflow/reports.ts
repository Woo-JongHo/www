/**
 * @architecture arch.development.reporting.storage
 * @implements RESP-DEVELOPMENT-REPORTING-STORAGE
 */
import { createHash, randomUUID } from "node:crypto";
import { constants, promises as fs, type Dirent } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { serializeWorkReport } from "./work-json.ts";
import { assertWorkId, workOutputColumns } from "./preflight.ts";
import { captureSource, criteriaDigest } from "./evidence.ts";
import { renderReportDocument } from "./report-view.ts";
import { reportFileStem, reportRevisionFileStem } from "./report-names.ts";

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

export interface ReportBundle {
  schemaVersion : 2            ;
  workId        : string       ;
  title         : string       ;
  entries       : WorkReport[] ;
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

const REPORT_ID                     = /^report-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ ;
const HASH                          = /^[a-f0-9]{64}$/                                                                   ;
const JSON_LIMIT                    = 1_048_576                                                                          ;
const BUNDLE_JSON_LIMIT             = 16_777_216                                                                         ;
const BUNDLE_HTML_LIMIT             = 33_554_432                                                                         ;
const HTML_LIMIT                    = 2_097_152                                                                          ;
export const WORK_RECORD_JSON_LIMIT = 8_388_608                                                                          ;

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

async function readJson(root: string, file: string, limit = JSON_LIMIT): Promise<{ source: string; value: unknown; bytes: Buffer }> {
  const target = await inside(root, file)                                                ;
  const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)) ;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error(limit === WORK_RECORD_JSON_LIMIT ? "작업 원장 입력은 8 MiB 이하의 일반 JSON 파일이어야 합니다." : limit === BUNDLE_JSON_LIMIT ? "묶음 보고서 입력은 16 MiB 이하의 일반 JSON 파일이어야 합니다." : "보고서 입력은 1 MiB 이하의 일반 JSON 파일이어야 합니다.");
    const bytes = await handle.readFile();
    if (bytes.length > limit) throw new Error("보고서 읽기 중 입력 크기 제한을 초과했습니다.");
    const source = bytes.toString("utf8");
    return { source, value: JSON.parse(source), bytes };
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
          const { source, value } = await readJson(root, candidate, WORK_RECORD_JSON_LIMIT);
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

export function renderWorkReport(input: unknown, state: ReportState = { current: true, stale: false, reasons: [] }, history: WorkReport[] = []): string {
  const report    = validateReport(input         ) ;
  const validated = history.map   (validateReport) ;
  for (const entry of validated) if (Buffer.byteLength(renderReportDocument(entry, { current: true, stale: false, reasons: [] })) > HTML_LIMIT) throw new Error("개별 보고서 HTML이 2 MiB를 초과합니다.");
  const html = renderReportDocument(report, state, validated);
  if (Buffer.byteLength(html) > (history.length ? BUNDLE_HTML_LIMIT : HTML_LIMIT)) throw new Error(history.length ? "묶음 보고서 HTML이 32 MiB를 초과합니다." : "생성된 보고서 HTML이 2 MiB를 초과합니다.");
  return html;
}

interface StoredReport {
  entries : WorkReport[] ;
  bytes   : Buffer       ;
  name    : string       ;
  bundled : boolean      ;
}

const entryMeaning = (entry: WorkReport): string => JSON.stringify(validateReport(entry))                                                              ;
const entryOrder   = (left: WorkReport, right: WorkReport): number => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id) ;
const sameTitle    = (left: string, right: string): boolean => left.normalize("NFC") === right.normalize("NFC")                                        ;

function reportEntries(value: unknown): { entries: WorkReport[]; bundled: boolean } {
  const object = objectValue(value);
  if (object.schemaVersion !== 2) return { entries: [validateReport(value)], bundled: false };
  exactFields(object, ["schemaVersion", "workId", "title", "entries"]);
  const rows = arrayValue(object.entries);
  if (!rows.length || rows.length > 2000) throw new Error("묶음 보고서는 1~2000개 기록이어야 합니다.");
  const entries = rows.map(validateReport) ;
  const seen    = new Set<string>()        ;
  for (const entry of entries) {
    if (entry.workId !== object.workId || !sameTitle(entry.title, text(object.title, 4000))) throw new Error("묶음 보고서의 작업·제목이 일치하지 않습니다.");
    if (seen.has(entry.id)) throw new Error("묶음 안에 중복 보고서 UUID가 있습니다.");
    if (Buffer.byteLength(entryMeaning(entry)) > JSON_LIMIT) throw new Error("개별 보고서 입력은 1 MiB 이하여야 합니다.");
    seen.add(entry.id);
  }
  return { entries, bundled: true };
}

async function reportNames(root: string, directory: string): Promise<string[]> {
  await inside(root, directory, true);
  try {
    const names = await fs.readdir(directory);
    if (names.length > 4001) throw new Error("작업별 보고서 수가 탐색 제한을 초과했습니다.");
    return names;
  } catch (error) { if (errorCode(error) === "ENOENT") return []; throw error; }
}

async function storedReport(root: string, work: WorkLocation, name: string): Promise<StoredReport> {
  const legacyName = REPORT_ID.test(name.slice(0, -5)) || /-\d{8}T\d{9}Z-(?:authored|snapshot)-[a-f0-9]{16}\.json$/.test(name);
  const { value, bytes } = await readJson(root, path.join(path.dirname(work.path), "reports", name), legacyName ? JSON_LIMIT : BUNDLE_JSON_LIMIT);
  const parsed = reportEntries(value);
  if (!parsed.bundled && bytes.length > JSON_LIMIT) throw new Error("보고서 입력은 1 MiB 이하의 일반 JSON 파일이어야 합니다.");
  const first = parsed.entries[0];
  if (!first) throw new Error("보고서 기록이 없습니다.");
  const allowed = parsed.bundled ? [reportFileStem(first)] : [first.id, reportRevisionFileStem(first)];
  if (!allowed.some((stem) => `${stem}.json` === name.normalize("NFC")) || parsed.entries.some((entry) => entry.workId !== work.record.id.toLowerCase())) throw new Error("보고서 파일과 작업 식별자가 일치하지 않습니다.");
  return { ...parsed, bytes, name };
}

async function storedReports(root: string, work: WorkLocation, warnings: string[] = []): Promise<WorkReport[]> {
  const directory = path.join(path.dirname(work.path), "reports") ;
  const names     = await reportNames(root, directory)            ;
  const found     = new Map<string, WorkReport>()                 ;
  const conflicts = new Set<string>()                             ;
  for (const name of names.filter((entry) => entry.endsWith(".json"))) {
    try {
      const item = await storedReport(root, work, name);
      for (const entry of item.entries) {
        const prior = found.get(entry.id);
        if (prior && entryMeaning(prior) !== entryMeaning(entry)) { conflicts.add(entry.id); throw new Error("같은 보고서 UUID의 내용이 충돌합니다."); }
        found.set(entry.id, entry);
      }
    } catch (error) { warnings.push(`${path.relative(root, path.join(directory, name))}: ${errorMessage(error)}`); }
  }
  return [...found.values()].filter((entry) => !conflicts.has(entry.id));
}

interface ReportLockOwner {
  token     : string ;
  pid       : number ;
  hostname  : string ;
  createdAt : string ;
}

type ReportLockStatus = "absent" | "unknown_owner" | "different_host" | "owner_alive" | "owner_exited" | "owner_unconfirmed";

async function reportLockOwner(root: string, file: string): Promise<ReportLockOwner | null | "unknown"> {
  const bytes = await reportBytes(root, file, 4096);
  if (!bytes) return null;
  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (object(value) && typeof value.token === "string" && /^[a-f0-9-]{36}$/.test(value.token)
      && typeof value.pid === "number" && Number.isSafeInteger(value.pid) && value.pid > 0
      && typeof value.hostname === "string" && typeof value.createdAt === "string") {
      return { token: value.token, pid: value.pid, hostname: value.hostname, createdAt: value.createdAt };
    }
  } catch { /* 손상된 소유 정보는 자동 회수하지 않는다. */ }
  return "unknown";
}

function reportLockState(owner: Awaited<ReturnType<typeof reportLockOwner>>): ReportLockStatus {
  if (!owner                          ) return "absent";
  if (owner === "unknown"             ) return "unknown_owner";
  if (owner.hostname !== os.hostname()) return "different_host";
  try { process.kill(owner.pid, 0); return "owner_alive"; }
  catch (error) { return errorCode(error) === "ESRCH" ? "owner_exited" : "owner_unconfirmed"; }
}

async function reportLease(root: string, directory: string): Promise<{ close: () => Promise<void> }> {
  const file               = path.join(directory, ".report-write.lock")                                                              ;
  const owner              = { token: randomUUID(), pid: process.pid, hostname: os.hostname(), createdAt: new Date().toISOString() } ;
  const temporaryDirectory = path.join(root, ".www/report-locks")                                                                    ;
  await inside(root, temporaryDirectory, true);
  await fs.mkdir(temporaryDirectory, { recursive: true });
  await inside(root, temporaryDirectory);
  const temporary = path.join(temporaryDirectory, `${owner.token}.json`);
  await fs.writeFile(temporary, JSON.stringify(owner), { flag: "wx", mode: 0o600 });
  try {
    let locked = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      try { await fs.link(temporary, file); locked = true; break; }
      catch (error) { if (errorCode(error) !== "EEXIST") throw error; await new Promise((resolve) => setTimeout(resolve, 20)); }
    }
    if (!locked) throw new Error("보고서 작성·이전 잠금이 사용 중입니다. report-lock-status와 report-lock-recover로 확인하세요.");
  } finally { await fs.unlink(temporary); }
  return { close: async () => {
    const current = await reportLockOwner(root, file);
    if (!current || current === "unknown" || current.token !== owner.token) throw new Error("보고서 잠금 소유자가 바뀌어 임의 해제하지 않습니다.");
    await fs.unlink(file);
  } };
}

export async function inspectReportLocks({ repo = process.cwd() }: { repo?: string } = {}) {
  const { root, works, warnings } = await workLocations(repo);
  if (warnings.length) throw new Error(warnings.join("; "));
  const locks = [];
  for (const work of works) {
    const directory = path.join(path.dirname(work.path), "reports")                           ;
    const owner     = await reportLockOwner(root, path.join(directory, ".report-write.lock")) ;
    const status    = reportLockState(owner)                                                  ;
    if (status !== "absent") locks.push({ directory: path.relative(root, directory).split(path.sep).join("/"), status, owner, recoverable: status === "owner_exited" });
  }
  return { locks };
}

export async function recoverReportLock({ repo = process.cwd(), directory, token }: { repo?: string; directory: string; token: string }) {
  const { root, works, warnings } = await workLocations(repo);
  if (warnings.length) throw new Error(warnings.join("; "));
  const candidate = path.resolve(root, directory);
  if (!works.some((work) => path.join(path.dirname(work.path), "reports") === candidate)) throw new Error("등록된 작업의 보고서 디렉터리만 복구할 수 있습니다.");
  const file = path.join(candidate, ".report-write.lock");
  await inside(root, file);
  const gate   = `${file}.recovery`               ;
  const handle = await fs.open(gate, "wx", 0o600) ;
  try {
    const owner = await reportLockOwner(root, file);
    if (!owner || owner === "unknown" || owner.token !== token) throw new Error("관찰한 보고서 잠금 토큰과 현재 소유자가 일치하지 않습니다.");
    if (reportLockState(owner) !== "owner_exited") throw new Error("같은 호스트에서 종료가 확인된 보고서 잠금만 복구할 수 있습니다.");
    await fs.unlink(file);
    return { recovered: true, directory: path.relative(root, candidate).split(path.sep).join("/") };
  } finally { await handle.close(); await fs.unlink(gate); }
}

async function atomicReportFile(root: string, file: string, source: string, expected: Buffer | null): Promise<void> {
  await inside(root, file, true);
  const current = await reportBytes(root, file, Math.max(BUNDLE_JSON_LIMIT, BUNDLE_HTML_LIMIT));
  if (current === null ? expected !== null : !expected?.equals(current)) throw new Error("보고서 저장 계획 뒤 대상 파일이 바뀌었습니다.");
  const temporaryDirectory = path.join(root, ".www/report-transactions");
  await inside(root, temporaryDirectory, true);
  await fs.mkdir(temporaryDirectory, { recursive: true });
  await inside(root, temporaryDirectory);
  const temporary = path.join(temporaryDirectory, `${randomUUID()}.partial`);
  await fs.writeFile(temporary, source, { flag: "wx", mode: 0o600 });
  try {
    const latest = await reportBytes(root, file, BUNDLE_HTML_LIMIT);
    if (latest === null ? expected !== null : !expected?.equals(latest)) throw new Error("보고서 교체 직전 대상 파일이 바뀌었습니다.");
    await fs.rename(temporary, file);
  } finally { await fs.unlink(temporary).catch((error) => { if (errorCode(error) !== "ENOENT") throw error; }); }
}

function bundleSource(entries: WorkReport[], columns: boolean): string {
  const first = entries[0];
  if (!first) throw new Error("저장할 보고서 기록이 없습니다.");
  const bundle: ReportBundle = { schemaVersion: 2, workId: first.workId, title: first.title.normalize("NFC"), entries: entries.map(validateReport).sort(entryOrder) };
  reportEntries(bundle);
  const json = serializeWorkReport(bundle, columns);
  if (Buffer.byteLength(json) > BUNDLE_JSON_LIMIT) throw new Error("묶음 보고서 JSON이 16 MiB를 초과합니다.");
  return json;
}

async function publish({ repo = process.cwd(), workId, narrative = null, event, kind }: { repo?: string; workId: string; narrative?: ReportNarrative | null; event: string; kind: "authored" | "snapshot" }): Promise<ReportResult> {
  text(event, 100);
  const work           = await locateWork(repo, workId)                                                           ;
  const details        = narrative === null ? null : narrativeValue(narrative)                                    ;
  const identity       = await sourceIdentity(work.root, work.record)                                             ;
  const workRecordHash = digest(work.source)                                                                      ;
  const semanticHash   = digest(JSON.stringify({ kind, event, workRecordHash, ...identity, narrative: details })) ;
  const columns        = await workOutputColumns(work.root)                                                       ;
  const directory      = path.join(path.dirname(work.path), "reports")                                            ;
  await inside(work.root, directory, true);
  await fs.mkdir(directory, { recursive: true });
  await inside(work.root, directory);
  const lease = await reportLease(work.root, directory);
  try {
    const warnings: string[] = []                                             ;
    const entries            = await storedReports(work.root, work, warnings) ;
    if (warnings.length) throw new Error(`기존 보고서 확인 실패: ${warnings.join("; ")}`);
    const existing = entries.find((report) => report.semanticHash === semanticHash);
    if (existing) {
      const plans = (await migrationGroups(work.root, [work])).filter((group) => sameTitle(group.entries[0]?.title ?? "", existing.title));
      await applyReportGroups(work.root, plans);
      return { report: existing, html: renderWorkReport(existing, undefined, entries.filter((entry) => sameTitle(entry.title, existing.title))), created: false };
    }
    const id     = `report-${randomUUID()}`                                                                                   ;
    const source = { recordPath: path.relative(work.root, work.path).split(path.sep).join("/"), workRecordHash, ...identity } ;
    const report: WorkReport = {
      schemaVersion: 1, id, workId: work.record.id.toLowerCase(), title: text(work.record.title, 4000),
      summary: details?.summary ?? `${LABELS[outcomeFor(work.record)]}. 검증·검토 기록의 자동 스냅샷이며 작성자 설명은 아직 없습니다.`,
      outcome: outcomeFor(work.record), kind, event, createdAt: new Date().toISOString(), workRecordHash,
      ...identity, semanticHash, narrative: details, work: facts(work.record), source,
    };
    if (Buffer.byteLength(serializeWorkReport(report, columns)) > JSON_LIMIT) throw new Error("보고서 JSON이 1 MiB를 초과합니다.");
    renderWorkReport(report);
    const history  = [...entries.filter((entry) => sameTitle(entry.title, report.title)), report] ;
    const json     = bundleSource(history, columns)                                               ;
    const html     = renderWorkReport(representative(history), undefined, history)                ;
    const stem     = reportFileStem(report)                                                       ;
    const jsonFile = path.join(directory, `${stem}.json`)                                         ;
    const htmlFile = path.join(directory, `${stem}.html`)                                         ;
    const oldJson  = await reportBytes(work.root, jsonFile, BUNDLE_JSON_LIMIT)                    ;
    if (oldJson) reportEntries(JSON.parse(oldJson.toString("utf8")));
    const oldHtml = await reportBytes(work.root, htmlFile, BUNDLE_HTML_LIMIT);
    if (!oldJson && oldHtml) throw new Error("묶음 JSON 없이 기존 HTML이 있어 임의 덮어쓰지 않습니다.");
    await atomicReportFile(work.root, jsonFile, json, oldJson);
    await atomicReportFile(work.root, htmlFile, html, oldHtml);
    const plans = (await migrationGroups(work.root, [work])).filter((group) => sameTitle(group.entries[0]?.title ?? "", report.title));
    await applyReportGroups(work.root, plans);
    return { report, html, created: true };
  } finally { await lease.close(); }
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

export interface ReportFileChange {
  reportId : string ;
  from     : string ;
  to       : string ;
  sha256   : string ;
}

export interface ReportMaintenanceResult {
  result     : "planned" | "applied" | "no_changes"                                                      ;
  counts     : { reports: number; files: number; groups: number; entries: number; writtenFiles: number } ;
  changes    : ReportFileChange[]                                                                        ;
  entries    : { reportId: string; sha256: string }[]                                                    ;
  backupPath : string | null                                                                             ;
}

interface MigrationSource { path: string; bytes: Buffer; reportId: string }
interface MigrationGroup {
  entries  : WorkReport[]      ;
  jsonFile : string            ;
  htmlFile : string            ;
  json     : string            ;
  html     : string            ;
  oldJson  : Buffer | null     ;
  oldHtml  : Buffer | null     ;
  sources  : MigrationSource[] ;
  dirty    : boolean           ;
}

function representative(entries: WorkReport[]): WorkReport {
  const ordered  = [...entries].sort(entryOrder)                                                 ;
  const selected = ordered.filter((entry) => entry.kind === "authored").at(-1) ?? ordered.at(-1) ;
  if (!selected) throw new Error("보고서 기록이 없습니다.");
  return selected;
}

async function reportBytes(root: string, file: string, limit: number): Promise<Buffer | null> {
  try { await inside(root, file); }
  catch (error) { if (errorCode(error) === "ENOENT") return null; throw error; }
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error("이전할 보고서는 크기 제한 내의 일반 파일이어야 합니다.");
    const bytes = await handle.readFile();
    if (bytes.length > limit) throw new Error("이전할 보고서의 읽기 크기 제한을 초과했습니다.");
    return bytes;
  } finally { await handle.close(); }
}

async function migrationGroups(root: string, works: WorkLocation[]): Promise<MigrationGroup[]> {
  const result: MigrationGroup[] = []                            ;
  const allIds                   = new Set<string>()             ;
  const targets                  = new Map<string, string>()     ;
  const columns                  = await workOutputColumns(root) ;
  for (const work of works) {
    const directory             = path.join(path.dirname(work.path), "reports") ;
    const names                 = await reportNames(root, directory)            ;
    const files: StoredReport[] = []                                            ;
    const groups                = new Map<string, Map<string, WorkReport>>()    ;
    const allowed               = new Set<string>([".report-write.lock"])       ;
    for (const name of names.filter((entry) => entry.endsWith(".json"))) {
      const item = await storedReport(root, work, name);
      files.push(item);
      const title = item.entries[0]?.title.normalize("NFC");
      if (title === undefined) throw new Error("보고서 제목이 없습니다.");
      const entries = groups.get(title) ?? new Map<string, WorkReport>();
      for (const entry of item.entries) {
        const prior = entries.get(entry.id);
        if (prior && entryMeaning(prior) !== entryMeaning(entry)) throw new Error("이전할 보고서 UUID의 내용이 충돌합니다.");
        entries.set(entry.id, entry);
      }
      groups.set(title, entries);
    }
    for (const [title, grouped] of groups) {
      const entries = [...grouped.values()].sort(entryOrder);
      for (const entry of entries) {
        if (allIds.has(entry.id)) throw new Error("다른 묶음에 중복된 보고서 UUID가 있습니다.");
        allIds.add(entry.id);
      }
      const first    = representative(entries)                            ;
      const stem     = reportFileStem({ title })                          ;
      const jsonFile = path.join(directory, `${stem}.json`)               ;
      const htmlFile = path.join(directory, `${stem}.html`)               ;
      const key      = jsonFile.normalize("NFD").toLocaleLowerCase("und") ;
      if (targets.has(key) && targets.get(key) !== `${first.workId}:${title}`) throw new Error("서로 다른 보고서의 제목 파일명이 충돌합니다.");
      targets.set(key, `${first.workId}:${title}`);
      const oldJson                    = await reportBytes(root, jsonFile, BUNDLE_JSON_LIMIT)                   ;
      const oldHtml                    = await reportBytes(root, htmlFile, BUNDLE_HTML_LIMIT)                   ;
      const sources: MigrationSource[] = []                                                                     ;
      const members                    = files.filter((file) => sameTitle(file.entries[0]?.title ?? "", title)) ;
      if (!oldJson && oldHtml) throw new Error("묶음 JSON 없이 기존 HTML이 있어 임의 덮어쓰지 않습니다.");
      for (const file of members) {
        const source = path.join(directory, file.name)                    ;
        const bytes  = await reportBytes(root, source, BUNDLE_JSON_LIMIT) ;
        if (!bytes?.equals(file.bytes)) throw new Error("이전 검사 중 보고서 JSON 원본이 바뀌었습니다.");
        sources.push({ path: source, bytes, reportId: file.entries[0]?.id ?? first.id });
        allowed.add(file.name.normalize("NFC"));
        const htmlName  = file.name.slice(0, -5) + ".html"                                                 ;
        const htmlPath  = path.join(directory, htmlName)                                                   ;
        const htmlBytes = await reportBytes(root, htmlPath, file.bundled ? BUNDLE_HTML_LIMIT : HTML_LIMIT) ;
        if (!htmlBytes && !file.bundled && !oldJson) throw new Error("보고서 JSON·HTML 쌍이 없습니다.");
        if (htmlBytes) sources.push({ path: htmlPath, bytes: htmlBytes, reportId: file.entries[0]?.id ?? first.id });
        allowed.add(htmlName.normalize("NFC"));
      }
      for (const entry of entries) {
        for (const candidate of [entry.id, reportRevisionFileStem(entry)]) {
          for (const extension of ["json", "html"]) {
            const name = `${candidate}.${extension}`;
            allowed.add(name.normalize("NFC"));
            const file = path.join(directory, name);
            if (sources.some((source) => source.path === file)) continue;
            const bytes = await reportBytes(root, file, extension === "json" ? JSON_LIMIT : HTML_LIMIT);
            if (bytes) sources.push({ path: file, bytes, reportId: entry.id });
          }
        }
      }
      allowed.add(`${stem}.json`.normalize("NFC"));
      allowed.add(`${stem}.html`.normalize("NFC"));
      const json = bundleSource    (entries, columns         ) ;
      const html = renderWorkReport(first, undefined, entries) ;
      const dirty = sources.some((source) => source.path !== jsonFile && source.path !== htmlFile)
        || !oldJson?.equals(Buffer.from(json)) || !oldHtml?.equals(Buffer.from(html));
      result.push({ entries, jsonFile, htmlFile, json, html, oldJson, oldHtml, sources, dirty });
    }
    for (const name of names) if (!allowed.has(name.normalize("NFC"))) throw new Error(`관리되지 않는 보고서 파일이 있습니다: ${path.relative(root, path.join(directory, name))}`);
  }
  return result;
}

async function backupReportSources(root: string, groups: MigrationGroup[]): Promise<string> {
  const backup = path.join(root, ".www/report-merge-backups", randomUUID());
  await inside(root, backup, true);
  await fs.mkdir(backup, { recursive: true });
  const manifest = []                ;
  const seen     = new Set<string>() ;
  for (const group of groups) {
    for (const source of group.sources) {
      if (seen.has(source.path)) continue;
      seen.add(source.path);
      const current = await reportBytes(root, source.path, BUNDLE_HTML_LIMIT);
      if (!current?.equals(source.bytes)) throw new Error("백업 전에 보고서 원본이 바뀌었습니다.");
      const relative    = path.relative(root, source.path) ;
      const destination = path.join    (backup, relative ) ;
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, source.bytes, { flag: "wx", mode: 0o600 });
      if (!(await fs.readFile(destination)).equals(source.bytes)) throw new Error("보고서 원본 백업 검증에 실패했습니다.");
      manifest.push({ path: relative.split(path.sep).join("/"), sha256: createHash("sha256").update(source.bytes).digest("hex") });
    }
  }
  await fs.writeFile(path.join(backup, "manifest.json"), JSON.stringify({ schemaVersion: 1, files: manifest }, null, 2), { flag: "wx", mode: 0o600 });
  return path.relative(root, backup).split(path.sep).join("/");
}

async function applyReportGroups(root: string, groups: MigrationGroup[]): Promise<string | null> {
  const dirty = groups.filter((group) => group.dirty);
  if (!dirty.length) return null;
  const backup = await backupReportSources(root, dirty);
  for (const group of dirty) {
    await atomicReportFile(root, group.jsonFile, group.json, group.oldJson);
    await atomicReportFile(root, group.htmlFile, group.html, group.oldHtml);
  }
  for (const group of dirty) {
    for (const source of group.sources) {
      if (source.path === group.jsonFile || source.path === group.htmlFile) continue;
      const current = await reportBytes(root, source.path, BUNDLE_HTML_LIMIT);
      if (!current?.equals(source.bytes)) throw new Error("삭제 직전 보고서 원본이 바뀌었습니다.");
      await fs.unlink(source.path);
    }
  }
  return backup;
}

/** 기본값은 읽기 전용 계획. 같은 작업·NFC 제목의 불변 기록을 한 묶음에 누적한다. */
export async function maintainWorkReports({ repo = process.cwd(), apply = false }: { repo?: string; apply?: boolean } = {}): Promise<ReportMaintenanceResult> {
  if (typeof apply !== "boolean") throw new Error("보고서 이전 apply는 boolean이어야 합니다.");
  const { root, works, warnings } = await workLocations(repo);
  if (warnings.length) throw new Error(`보고서 이전 탐색 실패: ${warnings.join("; ")}`);
  const leases: { close: () => Promise<void> }[] = [];
  try {
    if (apply) {
      const directories = [...new Set(works.map((work) => path.join(path.dirname(work.path), "reports")))].sort();
      for (const directory of directories) {
        await inside(root, directory, true);
        try { await fs.lstat(directory); }
        catch (error) { if (errorCode(error) === "ENOENT") continue; throw error; }
        leases.push(await reportLease(root, directory));
      }
    }
    const groups = await migrationGroups(root, works);
    const changes = groups.flatMap((group) => group.sources.filter((source) => source.path !== group.jsonFile && source.path !== group.htmlFile).map((source) => ({
      reportId : source.reportId                                                                                                ,
      from     : path.relative(root, source.path).split(path.sep).join("/")                                                     ,
      to       : path.relative(root, source.path.endsWith(".json") ? group.jsonFile : group.htmlFile).split(path.sep).join("/") ,
      sha256   : createHash("sha256").update(source.bytes).digest("hex")                                                        ,
    })));
    const entries    = groups.flatMap((group) => group.entries.map((entry) => ({ reportId: entry.id, sha256: digest(entryMeaning(entry)) }))) ;
    const dirty      = groups.filter((group) => group.dirty).length                                                                           ;
    const backupPath = apply ? await applyReportGroups(root, groups) : null                                                                   ;
    return { result: dirty ? apply ? "applied" : "planned" : "no_changes", counts: { reports: entries.length, files: changes.length, groups: groups.length, entries: entries.length, writtenFiles: dirty * 2 }, changes, entries, backupPath };
  } finally { for (const lease of leases.reverse()) await lease.close(); }
}

export async function readWorkReport({ repo = process.cwd(), reportId }: { repo?: string; reportId: string }): Promise<ReportReadResult> {
  if (typeof reportId !== "string" || !REPORT_ID.test(reportId)) throw new Error("유효한 보고서 UUID가 필요합니다.");
  const { root, works } = await workLocations(repo);
  const matches: { report: WorkReport; work: WorkLocation; history: WorkReport[] }[] = [];
  let firstFailure: { name: string; error: unknown } | undefined;
  for (const work of works) {
    const directory                                  = path.join(path.dirname(work.path), "reports") ;
    const names                                      = await reportNames(root, directory)            ;
    const found                                      = new Map<string, WorkReport>()                 ;
    const conflictingIds                             = new Set<string>()                             ;
    const errors: { name: string; error: unknown }[] = []                                            ;
    for (const name of names.filter((entry) => entry.endsWith(".json"))) {
      try {
        const item = await storedReport(root, work, name);
        for (const entry of item.entries) {
          const prior = found.get(entry.id);
          if (prior && entryMeaning(prior) !== entryMeaning(entry)) {
            conflictingIds.add(entry.id);
            throw new Error("같은 보고서 UUID의 내용이 충돌합니다.");
          }
          found.set(entry.id, entry);
        }
      } catch (error) { errors.push({ name, error }); }
    }
    firstFailure ??= errors[0];
    if (conflictingIds.has(reportId)) throw new Error("같은 보고서 UUID의 내용이 충돌합니다.");
    const report  = found.get(reportId)                                ;
    const shortId = reportId.slice(7).replaceAll("-", "").slice(0, 16) ;
    for (const failure of errors) {
      if (failure.name === `${reportId}.json` || failure.name.endsWith(`-${shortId}.json`)
        || (report && failure.name.normalize("NFC") === `${reportFileStem(report)}.json`)) throw failure.error;
    }
    if (report) matches.push({ report, work, history: [...found.values()].filter((entry) => sameTitle(entry.title, report.title)).sort(entryOrder) });
  }
  if (!matches.length && firstFailure) throw firstFailure.error;
  if (matches.length !== 1) throw new Error("보고서 UUID가 없거나 중복돼 있습니다.");
  const { report, work, history } = matches[0];
  const current = digest(work.source) === report.workRecordHash ;
  const reasons = current ? [] : ["작업 기록 변경됨"]           ;
  let stale     = false                                         ;
  try {
    const identity = await sourceIdentity(root, work.record);
    if (identity.sourceDigest !== report.sourceDigest) { stale = true; reasons.push("검사 입력 소스 변경됨"); }
    if (identity.criteriaDigest !== report.criteriaDigest) { stale = true; reasons.push("수용 기준 변경됨"); }
  } catch (error) { stale = true; reasons.push(`현재 소스 식별 미확인: ${errorMessage(error)}`); }
  const state = { current, stale, reasons, checked: true };
  return { report, html: renderWorkReport(report, state, history), ...state };
}
