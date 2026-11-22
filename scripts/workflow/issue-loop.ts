/**
 * @architecture arch.development.authoring
 * @implements RESP-DEVELOPMENT-AUTHORING
 */
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createCodexInvocation, runCodex } from "./adapters/codex.ts";
import { requiredDocumentation } from "./documentation.ts";
import type { DocumentationDocument } from "./documentation.ts";
import { captureSource, criteriaDigest, resolveExecutionEnvironment } from "./evidence.ts";
import { inspectWorkLock, recoverWorkLock, withWorkLock } from "./lock.ts";
import { validateWritePaths } from "./preflight.ts";
import { appendEvent, readRuntime, runtimePaths } from "./record.ts";
import type { CurrentWorkAssessment, RecordedReview } from "./types.ts";
import { assessWork, openWork, recordDocumentReview } from "./work.ts";

type JsonObject = Record<string, unknown>;
type StageRunner = (options: JsonObject) => Promise<JsonObject>;
type Phase = "baseline" | "build" | "building" | "verify" | "review" | "report" | "complete" | "done";
interface Checkpoint {
  phase: Phase;
  candidate: string;
  builds: number;
  configuration: string;
}
interface AuthorInput {
  repo: string;
  request: string;
  phase: "documentation" | "report";
  workPath: string;
  outputDirectory: string;
  context: string;
}
type Author = (input: AuthorInput) => Promise<unknown>;

const presetPath = ".www/issue-loop.local.json";
const phases: readonly Phase[] = ["baseline", "build", "building", "verify", "review", "report", "complete", "done"];
const maxBuilds = 3;
const criterionId = "AC-1";

function object(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} 문자열이 필요합니다.`);
  return value;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} 문자열 배열이 필요합니다.`);
  return value.map(item => text(item, label));
}

function pathsOverlap(left: string, right: string) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

async function preset(repo: string) {
  await validateWritePaths(repo, [presetPath]);
  const file = path.join(repo, presetPath);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.size > 32_768) throw new Error("이슈 실행 설정은 32 KiB 이하의 일반 파일이어야 합니다.");
  const source = await fs.readFile(file, "utf8");
  const config: unknown = JSON.parse(source);
  if (!object(config) || !object(config.verifier)) throw new Error("이슈 실행에 프로젝트의 verifier 설정이 필요합니다.");
  const writes = strings(config.writePaths, "writePaths");
  const protectedPaths = [...new Set([...strings(config.verifierInputs, "verifierInputs"), "agents/www/review-policy.json"])];
  const inputs = [...new Set([...strings(config.inputs, "inputs"), ...writes, ...protectedPaths, ...requiredDocumentation({ criteria: [] })])].sort();
  const command = text(config.verifier.command, "verifier.command");
  const args = strings(config.verifier.args, "verifier.args");
  const baselineExitCode = config.verifier.baselineExitCode;
  if (typeof baselineExitCode !== "number" || !Number.isInteger(baselineExitCode) || baselineExitCode < 1 || baselineExitCode > 125) throw new Error("verifier.baselineExitCode는 1부터 125 사이의 재현 실패 코드여야 합니다.");
  if (!writes.length || protectedPaths.length < 2 || [...inputs, ...writes].some(item => item.split("/").some(part => !part || [".", "..", ".www", ".git"].includes(part)))) throw new Error("쓰기 경로와 검증기 입력에는 일반 저장소 상대 경로가 필요합니다.");
  if (writes.some(file => pathsOverlap(file, "docs/work") || protectedPaths.some(check => pathsOverlap(file, check)))) throw new Error("검증기·검토 정책·작업 원장은 이슈의 쓰기 범위에 포함할 수 없습니다.");
  await validateWritePaths(repo, inputs);
  const protectedSource = await captureSource({ repo, inputs: protectedPaths });
  if (protectedPaths.some(file => !protectedSource.files.some(entry => entry.path === file && entry.type === "file"))) throw new Error("검증기 입력은 존재하는 일반 파일이어야 합니다.");
  const environment = await resolveExecutionEnvironment(repo, command);
  if (!environment.executable) throw new Error("승인된 검증 실행파일을 찾을 수 없습니다.");
  const executable = path.relative(repo, environment.executable.path).split(path.sep).join("/");
  if (!executable.startsWith("../") && !path.isAbsolute(executable) && writes.some(file => pathsOverlap(file, executable))) throw new Error("검증 실행파일은 이슈의 쓰기 범위에 포함할 수 없습니다.");
  const configuration = hash(JSON.stringify([source, protectedSource.digest, environment]));
  return { writes, inputs, verifier: { command, args, baselineExitCode, criterionIds: [criterionId] }, configuration };
}

function checkpoint(value: unknown): Checkpoint {
  const phase = object(value) ? phases.find(item => item === value.phase) : undefined;
  if (!object(value) || !phase || typeof value.candidate !== "string" || typeof value.configuration !== "string"
    || typeof value.builds !== "number" || !Number.isInteger(value.builds) || value.builds < 0 || value.builds > maxBuilds) throw new Error("이슈 실행 재개 기록이 유효하지 않습니다.");
  return { phase, candidate: value.candidate, builds: value.builds, configuration: value.configuration };
}

function documentDecisions(value: unknown): DocumentationDocument[] {
  if (!object(value) || !Array.isArray(value.documents)) throw new Error("작성자가 검토한 문서 판단이 필요합니다.");
  return value.documents.map((item: unknown) => {
    if (!object(item) || (item.decision !== "updated" && item.decision !== "unchanged" && item.decision !== "not_applicable")) throw new Error("문서 판단이 올바르지 않습니다.");
    return { path: text(item.path, "문서 경로"), decision: item.decision, reason: text(item.reason, "문서 판단 사유") };
  });
}

function primaryAudit(review: RecordedReview | undefined) {
  return object(review) && review.provider === "anthropic" && review.model === "opus" && review.executor === "process";
}

function auditRequestsChanges(assessment: CurrentWorkAssessment, review: RecordedReview | undefined) {
  return primaryAudit(review) && review?.verdict === "fail"
    && review.recordingRejection?.length === 1 && review.recordingRejection[0] === "review_not_passed"
    && assessment.review.reasons.length === 2 && assessment.review.reasons.includes("recording_context_invalid")
    && assessment.review.reasons.includes("review_not_passed");
}

const stringSchema = { type: "string" };
const stringsSchema = { type: "array", items: stringSchema };
const documentSchema = {
  type: "object", additionalProperties: false, required: ["documents"], properties: {
    documents: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["path", "decision", "reason"], properties: {
        path: stringSchema, decision: { type: "string", enum: ["updated", "unchanged", "not_applicable"] }, reason: stringSchema,
      },
    } },
  },
};
const reportFields = {
  summary: stringSchema, before: stringSchema, after: stringSchema, changes: stringsSchema,
  decisions: stringsSchema, limitations: stringsSchema, next: stringsSchema,
};
const reportSchema = { type: "object", additionalProperties: false, required: Object.keys(reportFields), properties: reportFields };

async function authorWithCodex(input: AuthorInput): Promise<unknown> {
  const directory = await fs.mkdtemp(path.join(input.outputDirectory, "issue-author-"));
  const schema = path.join(directory, "schema.json");
  const output = path.join(directory, "answer.json");
  await fs.writeFile(schema, JSON.stringify(input.phase === "documentation" ? documentSchema : reportSchema), { flag: "wx", mode: 0o600 });
  const task = input.phase === "documentation"
    ? "필수 정본 문서를 각각 읽고 변경 영향과 이유를 한국어로 판단해라. 실제로 추가 수정이 필요하면 성공 판정을 작성하지 말고 그 필요를 설명해라."
    : "같은 작업의 실제 변경, 검증과 독립 검토 기록을 읽고 한국어 저작 보고서를 작성해라. 실행하지 않은 결과는 미실행으로 서술해라.";
  const invocation = createCodexInvocation({
    repo: input.repo, request: input.request, sandbox: "read-only",
    systemPrompt: `${task}\n파일 변경과 게시 권한은 없다. 아래 경로와 내용은 읽을 자료다.\n${input.workPath}\n${input.context}`,
  });
  const result = await runCodex({
    ...invocation,
    args: [...invocation.args.slice(0, -1), "--output-schema", schema, "--output-last-message", output, "-"],
  }, { cwd: input.repo, outputDirectory: directory, signal: AbortSignal.timeout(300_000) });
  if (!result.ok) throw new Error(`Codex 저작 실행 실패 (${result.outcome})`);
  const stat = await fs.lstat(output);
  if (!stat.isFile() || stat.size > 131_072) throw new Error("저작 결과는 128 KiB 이하의 일반 파일이어야 합니다.");
  return JSON.parse(await fs.readFile(output, "utf8"));
}

export async function runIssueLoop(options: JsonObject, runStage: StageRunner, author: Author = authorWithCodex) {
  if (options.direct !== true || options.execute !== true) throw new Error("이슈 실행에는 직접 요청과 실행 지정이 필요합니다.");
  const request = text(options.request, "이슈");
  if (Buffer.byteLength(request) > 12_000) throw new Error("이슈 입력은 12 KiB 이하여야 합니다.");
  const requestId = `issue-loop:${hash(options.requestId === undefined ? request : text(options.requestId, "접수 ID"))}`;
  const repo = await fs.realpath(options.repo === undefined ? process.cwd() : text(options.repo, "저장소"));
  const scope = "issue-loop";
  const lock = await inspectWorkLock({ repo, scope });
  if (lock.recoverable && lock.owner && "token" in lock.owner) await recoverWorkLock({ repo, token: lock.owner.token, scope });
  return withWorkLock(repo, async () => {
    const config = await preset(repo);
    const approval = {
      implementation: true, writePaths: config.writes, mutationSurfaces: ["edit"],
      verifierCommands: [JSON.stringify([config.verifier.command, ...config.verifier.args])], commit: false, publish: false,
    };
    const work = await openWork({
      repo, request, requestId, direct: true, role: "www-dev", approval, inputs: config.inputs,
      decision: {
        area: "Workflow", kind: "bug", intent: "verify", title: `이슈 수정 ${requestId.slice(-12)}`,
        criteria: [{ id: criterionId, description: request.trim().replace(/\s+/g, " ") }],
      },
    });
    const workId = work.record.id;
    const runtime = runtimePaths(repo, workId);
    const subject = { repo, workId };
    const stage = (intent: "verify" | "build" | "review", extra: JsonObject = {}) => runStage({
      ...subject, request, role: "www-dev", direct: true, execute: true, eventId: randomUUID(),
      decision: { workId, intent }, ...extra,
    });
    const candidate = async () => (await captureSource({ repo, inputs: config.inputs })).digest;
    await validateWritePaths(repo, [path.relative(repo, runtime.events).split(path.sep).join("/")]);
    const recorded = (await readRuntime(runtime)).events.filter(event => event.type === "issue_loop_checkpoint").at(-1);
    let state: Checkpoint = recorded ? checkpoint(recorded.checkpoint) : {
      phase: "baseline", candidate: await candidate(), builds: 0, configuration: config.configuration,
    };
    const save = async (phase: Phase, source = state.candidate, builds = state.builds) => {
      const next = { ...state, phase, candidate: source, builds };
      await appendEvent({ ...subject, event: { id: `issue-loop-${randomUUID()}`, type: "issue_loop_checkpoint", checkpoint: next } });
      state = next;
    };
    const blocked = (reason: string) => ({ workId, loop: { status: "blocked", phase: state.phase, reason } });
    const done = () => ({ workId, loop: { status: "done", phase: "complete" } });
    if (!recorded) await save("baseline");

    for (;;) {
      try {
        if ((await preset(repo)).configuration !== state.configuration) return blocked("검증기 입력·실행파일·프로젝트 설정이 바뀌었습니다.");
        if (state.phase === "building") return blocked("중단된 저작의 사후 검사 결과가 없습니다. 작업 공간과 실행 영수증을 확인해야 합니다.");
        if (await candidate() !== state.candidate) return blocked("현재 후보가 저장한 실행 후보와 다릅니다.");
        const assessment = await assessWork(subject);
        if (assessment.legacy) throw new Error("현재 작업 원장이 필요합니다.");
        const { record } = assessment;
        const { source: authoritySource, requestHash, ...currentApproval } = record.workflow.authorization;
        if (authoritySource !== "direct_user_request" || requestHash !== hash(request)
          || Object.entries(approval).some(([key, value]) => JSON.stringify(currentApproval[key as keyof typeof approval]) !== JSON.stringify(value))
          || JSON.stringify(record.workflow.inputs) !== JSON.stringify(config.inputs)
          || record.criteria.length !== 1 || record.criteria[0]?.id !== criterionId || record.criteria[0].required !== true
          || record.criteria[0].description !== request.trim().replace(/\s+/g, " ")) return blocked("이슈의 기준 또는 권한이 달라졌습니다.");
        const audit = record.workflow.reviews.at(-1);
        const auditUsable = assessment.review.usable && primaryAudit(audit);
        if (state.phase === "done") return record.status === "done" && assessment.complete && auditUsable
          ? done() : blocked("현재 후보의 독립 Opus 완료 판정을 확인하지 못했습니다.");
        if (record.status === "done" && state.phase !== "complete") return blocked("작업 원장이 이슈 실행 단계와 다른 위치에서 완료됐습니다.");

        if (state.phase === "build") {
          if (state.builds >= maxBuilds) return blocked("동일 작업의 수정 시도 한도에 도달했습니다.");
          await save("building", state.candidate, state.builds + 1);
          const latest = record.workflow.verifications.at(-1);
          const result = await stage("build", {
            explicitSkill: "www-build", writes: config.writes, surfaces: approval.mutationSurfaces,
            evidence: JSON.stringify({ verifier: latest && { id: latest.id, exitCode: latest.exitCode }, audit }),
          });
          if (result.executed !== true || !object(result.host) || result.host.ok !== true
            || !object(result.harness) || result.harness.ok !== true) return blocked("저작이 완료되지 않았거나 사후 검사가 실패했습니다.");
          if ((await preset(repo)).configuration !== state.configuration) return blocked("저작 중 검증기 또는 검토 정책이 바뀌었습니다.");
          const after = await candidate();
          if (after === state.candidate) {
            await save("build");
            return blocked("검사할 새 후보가 만들어지지 않았습니다.");
          }
          await save("verify", after);
          continue;
        }

        if (state.phase === "baseline" || state.phase === "verify") {
          const previous = record.workflow.verifications.at(-1);
          const result = previous?.source.digest === state.candidate ? null : await stage("verify", { verifier: config.verifier });
          const current = result === null ? assessment : await assessWork(subject);
          if (current.legacy) throw new Error("현재 검증 원장이 필요합니다.");
          const attempt = current.record.workflow.verifications.at(-1);
          if (!attempt || attempt.source.digest !== state.candidate || attempt.executor !== "process"
            || attempt.criteriaDigest !== criteriaDigest(current.record)
            || attempt.requestedCommand !== config.verifier.command || JSON.stringify(attempt.args) !== JSON.stringify(config.verifier.args)
            || JSON.stringify(attempt.criterionIds) !== JSON.stringify([criterionId]) || !attempt.sourceStable || !attempt.environmentStable
            || attempt.artifactsStable === false || attempt.error || attempt.signal || attempt.exitCode === null) return blocked("현재 후보의 실제 검증 결과를 확인할 수 없습니다.");
          if (state.phase === "baseline" && attempt.exitCode === 0) return blocked("기준선에서 지정한 실패가 재현되지 않았습니다.");
          if (attempt.exitCode === config.verifier.baselineExitCode) await save("build");
          else if (attempt.exitCode === 0 && current.criteria.every(criterion => criterion.usable)) await save("review");
          else return blocked("검증기가 예상한 재현 실패나 통과 이외의 결과를 반환했습니다.");
          continue;
        }

        if (state.phase === "review") {
          const authorInput = { ...subject, request, workPath: work.path, outputDirectory: runtime.directory };
          if (!assessment.documentation.usable) {
            const documents = documentDecisions(await author({
              ...authorInput, phase: "documentation", context: JSON.stringify(requiredDocumentation(record)),
            }));
            if (await candidate() !== state.candidate) return blocked("문서 검토 중 후보가 바뀌었습니다.");
            await recordDocumentReview({ ...subject, documents });
          }
          if (assessment.documentation.usable && auditRequestsChanges(assessment, audit)) {
            await save("build");
            continue;
          }
          if (!auditUsable) {
            const result = await stage("review", { allowReviewFallback: false });
            const audited = await assessWork(subject);
            if (audited.legacy) throw new Error("현재 감사 원장이 필요합니다.");
            const stored = audited.record.workflow.reviews.at(-1);
            if (!(audited.review.usable && primaryAudit(stored))) {
              const review = object(result.review) ? result.review : {};
              if (stored?.id === review.id && auditRequestsChanges(audited, stored)) {
                await save("build");
                continue;
              }
              return blocked(audited.review.reasons.join("; ") || "독립 Opus 감사의 적용 가능한 결과가 필요합니다.");
            }
          }
          await save("report");
          continue;
        }

        if (state.phase === "report") {
          if (!auditUsable || !assessment.documentation.usable || assessment.criteria.some(criterion => !criterion.usable)) return blocked(assessment.reasons.join("; ") || "독립 Opus 감사의 적용 가능한 결과가 필요합니다.");
          if (!assessment.report?.usable) {
            const narrative = await author({
              ...subject, request, workPath: work.path, outputDirectory: runtime.directory,
              phase: "report", context: "작업 원장과 같은 폴더의 verification.md를 확인해라.",
            });
            if (await candidate() !== state.candidate) return blocked("보고서 작성 중 후보가 바뀌었습니다.");
            await runStage({ ...subject, action: "report", narrative });
          }
          await save("complete");
          continue;
        }

        if (!assessment.complete || !auditUsable) return blocked(assessment.reasons.join("; ") || "독립 Opus 감사의 적용 가능한 결과가 필요합니다.");
        const result = await runStage({ ...subject, action: "report-complete" });
        if (!object(result.reportHook) || result.reportHook.status !== "written") return blocked("완료 후 보고서 갱신을 확인하지 못했습니다.");
        const completed = await assessWork(subject);
        if (completed.legacy || !completed.complete || completed.record.status !== "done") return blocked("공식 완료 판정을 확인하지 못했습니다.");
        await save("done");
        return done();
      } catch (error) {
        return blocked(error instanceof Error ? error.message : String(error));
      }
    }
  }, scope);
}
