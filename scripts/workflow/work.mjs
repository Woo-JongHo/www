import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRequirementRefs, validateWorkRecord } from "./schema.mjs";
import { findWorkRecord, resolveInside, validateWritePaths } from "./preflight.mjs";
import { hashRequest, normalizeApproval } from "./route.mjs";
import { captureSource, criteriaDigest, evaluateEvidence, renderAttempt, verify } from "./evidence.mjs";
import { loadReviewPolicy, validateReview } from "./review.mjs";

const ACTIONS = new Set(["spec", "design", "build", "diagnose", "verify", "review", "complete"]);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const encodePath = (value) => value.split(path.sep).map(encodeURIComponent).join("/");

function indexEntry(source, area, block) {
  const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = new RegExp(`^## ${escaped}\\r?$`, "m").exec(source);
  if (!section) return `${source}${source.endsWith("\n") ? "" : "\n"}\n## ${area}\n\n${block}\n`;
  const start = section.index + section[0].length;
  const following = /^## /m.exec(source.slice(start));
  const end = following ? start + following.index : source.length;
  const before = source.slice(0, end);
  return `${before}${before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n"}${block}\n\n${source.slice(end)}`;
}

function segment(value) {
  return typeof value === "string" && value.trim() === value && value.length > 0
    && !/[<>:"/\\|?*\x00-\x1f]/u.test(value) && !/[. ]$/.test(value)
    && ![".", ".."].includes(value);
}

async function atomicWrite(file, text) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, text, { flag: "wx", mode: 0o600 });
  await fs.rename(temporary, file);
}

async function withWorkLock(repo, action) {
  const root = await fs.realpath(repo);
  const directory = path.join(root, ".www");
  await fs.mkdir(directory, { recursive: true });
  if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error("작업 잠금 경로는 심볼릭 링크일 수 없습니다.");
  const file = path.join(directory, "work-records.lock");
  let lock;
  try { lock = await fs.open(file, "wx", 0o600); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("다른 실행자가 작업 기록을 갱신 중입니다.");
    throw error;
  }
  try { return await action(root); }
  finally { await lock.close(); await fs.unlink(file); }
}

async function records(repo) {
  const workRoot = await resolveInside(repo, "docs/work");
  const found = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("작업 기록의 심볼릭 링크를 허용하지 않습니다.");
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.name === "work.json") found.push({ path: candidate, record: JSON.parse(await fs.readFile(candidate, "utf8")) });
    }
  }
  await visit(workRoot);
  return found;
}

export async function readWork({ repo = process.cwd(), workId } = {}) {
  const work = await findWorkRecord({ repo, workId });
  await resolveInside(repo, work.path);
  const errors = validateWorkRecord(work.record, { baseDir: path.dirname(work.path) });
  if (errors.length) throw new Error(`작업 기록이 올바르지 않습니다: ${errors.join("; ")}`);
  return work;
}

function assertRole(role, direct) {
  if (role !== "www-dev" || direct !== true) throw new Error("직접 요청을 받은 www-dev 역할만 작업을 접수할 수 있습니다.");
}

function verificationInputs(inputs, criteria) {
  const referenced = criteria.flatMap((criterion) => (criterion.requirementRefs ?? [])
    .filter((ref) => typeof ref === "string" && ref.includes("#"))
    .map((ref) => decodeURIComponent(ref.split("#")[0])));
  return [...new Set([...inputs, ...referenced])].sort();
}

function assertNewRequest({ requestId, request, decision, approval, inputs }) {
  if (typeof requestId !== "string" || !requestId.trim()) throw new Error("접수 멱등성을 위한 requestId가 필요합니다.");
  hashRequest(request);
  if (!decision || !ACTIONS.has(decision.intent) || decision.intent === "complete") throw new Error("역할이 선택한 유효한 작업 단계가 필요합니다.");
  if (!segment(decision.area) || !segment(decision.title)) throw new Error("작업 영역과 제목은 안전한 경로 조각이어야 합니다.");
  if (!Array.isArray(decision.criteria) || decision.criteria.length === 0) throw new Error("접수 전에 관찰 가능한 수용 기준을 정해야 합니다.");
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error("검증 대상 입력 경로가 필요합니다.");
  if (!approval || typeof approval !== "object") throw new Error("요청에 근거한 권한 범위가 필요합니다.");
}

export async function openWork({ repo = process.cwd(), role, direct, requestId, request, decision, approval, inputs } = {}) {
  assertRole(role, direct);
  if (decision?.workId) {
    const work = await readWork({ repo, workId: decision.workId });
    if (work.record.schemaVersion === 1 && decision.adoptLegacy === true) return adoptWork({ repo, role, direct, requestId, request, workId: decision.workId, approval, inputs, intent: decision.intent });
    return { ...work, created: false, legacy: work.record.schemaVersion === 1 };
  }
  assertNewRequest({ requestId, request, decision, approval, inputs });
  inputs = verificationInputs(inputs, decision.criteria);
  return withWorkLock(repo, async (root) => {
    const all = await records(root);
    const existing = all.filter(({ record }) => record.workflow?.requestId === requestId);
    if (existing.length > 1) throw new Error("접수 ID가 둘 이상의 작업에 연결돼 있습니다.");
    if (existing.length) {
      if (existing[0].record.workflow.requestHash !== hashRequest(request)) throw new Error("같은 접수 ID의 요청 내용이 달라졌습니다.");
      return { ...await readWork({ repo: root, workId: existing[0].record.id }), created: false };
    }
    await captureSource({ repo: root, inputs });
    await validateWritePaths(root, normalizeApproval(approval).writePaths);
    const areas = await fs.readdir(path.join(root, "docs", "work"), { withFileTypes: true });
    const area = areas.find((entry) => entry.isDirectory() && entry.name.normalize("NFC").toLocaleLowerCase("und") === decision.area.normalize("NFC").toLocaleLowerCase("und"))?.name ?? decision.area;
    const areaRoot = path.join(root, "docs", "work", area);
    await fs.mkdir(areaRoot, { recursive: true });
    await resolveInside(root, areaRoot);
    const entries = await fs.readdir(areaRoot);
    const next = Math.max(0, ...entries.map((name) => Number(name.match(/^(\d{3,})-/)?.[1] ?? 0))) + 1;
    const directory = path.join(areaRoot, `${String(next).padStart(3, "0")}-${decision.title}`);
    const record = {
      schemaVersion: 2,
      id: `work-${randomUUID()}`,
      title: decision.title,
      kind: decision.kind ?? "feature",
      areas: decision.areas ?? ["dev"],
      owner: decision.owner ?? "dev",
      status: "ready",
      blockedReason: null,
      relations: decision.relations ?? [],
      criteria: decision.criteria.map(({ id, description, required = true, requirementRefs }) => ({
        id, description, required, result: "unverified", evidence: [],
        ...(requirementRefs ? { requirementRefs } : {}),
      })),
      workflow: {
        role: "www-dev",
        requestId,
        requestHash: hashRequest(request),
        authorization: { ...normalizeApproval(approval), source: "direct_user_request", requestHash: hashRequest(request) },
        inputs: [...new Set(inputs)].sort(),
        nextAction: decision.intent,
        verifications: [],
        reviews: [],
      },
    };
    const errors = validateWorkRecord(record, { baseDir: directory });
    if (errors.length) throw new Error(errors.join("; "));
    await fs.mkdir(directory);
    const file = path.join(directory, "work.json");
    await atomicWrite(file, `${JSON.stringify(record, null, 2)}\n`);
    const spec = `# ${record.title}\n\n## 요청과 목적\n\n${decision.summary ?? decision.title}\n\n사용자의 직접 요청으로 접수했다. 요청 식별값은 work.json의 workflow.requestHash에 보존한다.\n\n## 범위\n\n변경 경로·표면·검증 명령과 커밋·게시 권한은 work.json의 workflow.authorization을 따른다. 범위 확대는 기존 권한으로 간주하지 않는다.\n\n## 수용 기준\n\n정의와 필수 여부의 정본은 work.json이다. 관련 기준: ${record.criteria.map((criterion) => `\`${criterion.id}\``).join(", ")}.\n\n## 결정과 열린 질문\n\n작업 접수는 구현 완료가 아니다. 재개 시 같은 UUID와 현재 증거를 확인한다.\n`;
    await atomicWrite(path.join(directory, "spec.md"), spec);
    const index = path.join(root, "docs", "work", "INDEX.md");
    const oldIndex = await fs.readFile(index, "utf8");
    const relative = encodePath(path.relative(path.dirname(index), directory));
    const block = `### ${String(next).padStart(3, "0")} — ${record.title}\n\n- [명세](${relative}/spec.md)\n- [작업 레코드](${relative}/work.json)`;
    await atomicWrite(index, indexEntry(oldIndex, area, block));
    return { path: file, record, created: true };
  });
}

export async function adoptWork({ repo = process.cwd(), role, direct, requestId, request, workId, approval, inputs, intent } = {}) {
  assertRole(role, direct);
  if (typeof requestId !== "string" || !requestId.trim() || typeof request !== "string" || !request.trim() || !approval || !Array.isArray(inputs) || !inputs.length || !ACTIONS.has(intent) || intent === "complete") throw new Error("기존 작업 연결에는 현재 직접 요청·접수 ID·권한·입력·단계가 필요합니다.");
  return withWorkLock(repo, async (root) => {
    const work = await readWork({ repo: root, workId });
    if (work.record.schemaVersion === 2) return { ...work, created: false };
    inputs = verificationInputs(inputs, work.record.criteria);
    await captureSource({ repo: root, inputs });
    await validateWritePaths(root, normalizeApproval(approval).writePaths);
    const record = structuredClone(work.record);
    const legacyRecord = structuredClone(record);
    record.schemaVersion = 2;
    record.status = "ready";
    record.blockedReason = null;
    for (const criterion of record.criteria) { criterion.result = "unverified"; criterion.evidence = []; }
    record.workflow = {
      role: "www-dev", requestId, requestHash: hashRequest(request),
      authorization: { ...normalizeApproval(approval), source: "direct_user_request", requestHash: hashRequest(request) },
      inputs: [...new Set(inputs)].sort(), nextAction: intent, verifications: [], reviews: [], legacyRecord,
    };
    const errors = validateWorkRecord(record, { baseDir: path.dirname(work.path) });
    if (errors.length) throw new Error(errors.join("; "));
    await atomicWrite(work.path, `${JSON.stringify(record, null, 2)}\n`);
    return { ...work, record, created: false, adopted: true };
  });
}

async function mutateWork(repo, workId, change) {
  return withWorkLock(repo, async () => {
    const work = await readWork({ repo, workId });
    if (work.record.schemaVersion !== 2) throw new Error("현재 증거 판정은 schemaVersion 2 작업에 적용합니다. legacy 기록은 그대로 보존합니다.");
    const before = hash(await fs.readFile(work.path));
    const record = structuredClone(work.record);
    await change(record, work);
    if (hash(await fs.readFile(work.path)) !== before) throw new Error("작업 갱신 중 다른 작성자가 내용을 바꿨습니다.");
    const errors = validateWorkRecord(record, { baseDir: path.dirname(work.path) });
    if (errors.length) throw new Error(errors.join("; "));
    await atomicWrite(work.path, `${JSON.stringify(record, null, 2)}\n`);
    return { ...work, record };
  });
}

export async function advanceWork({ repo = process.cwd(), workId, intent, writes = [], surfaces = [] } = {}) {
  if (!ACTIONS.has(intent)) throw new Error("허용된 다음 단계가 아닙니다.");
  await validateWritePaths(repo, writes);
  return mutateWork(repo, workId, (record) => {
    const authorization = record.workflow.authorization;
    if (intent === "build" && (!authorization.implementation || writes.some((file) => !authorization.writePaths.includes(file)) || surfaces.some((surface) => !authorization.mutationSurfaces.includes(surface)))) throw new Error("구현이 현재 요청의 권한 범위를 벗어납니다.");
    if (intent === "complete") throw new Error("완료는 현재 증거와 필수 검토를 판정하는 completeWork로 수행합니다.");
    record.status = ["verify", "review"].includes(intent) ? "verifying" : "in_progress";
    record.blockedReason = null;
    record.workflow.nextAction = intent;
  });
}

export async function setVerificationInputs({ repo = process.cwd(), workId, inputs } = {}) {
  if (!Array.isArray(inputs) || !inputs.length) throw new Error("검증 입력 경로가 필요합니다.");
  return mutateWork(repo, workId, async (record) => {
    const selected = verificationInputs(inputs, record.criteria);
    await captureSource({ repo, inputs: selected });
    record.workflow.inputs = selected;
    for (const criterion of record.criteria) criterion.result = "unverified";
    record.status = "verifying";
    record.blockedReason = null;
    record.workflow.nextAction = "verify";
  });
}

export async function verifyWork({ repo = process.cwd(), workId, command, args = [], criterionIds } = {}) {
  const work = await readWork({ repo, workId });
  if (work.record.schemaVersion !== 2) throw new Error("현재 검증 연결에는 schemaVersion 2 작업이 필요합니다.");
  const signature = JSON.stringify([command, ...args]);
  if (!work.record.workflow.authorization.verifierCommands.includes(signature)) throw new Error("이 작업에서 허용하지 않은 검증 명령입니다.");
  const attempt = await verify({ repo, record: work.record, inputs: work.record.workflow.inputs, command, args, criterionIds });
  await mutateWork(repo, workId, async (record, current) => {
    const report = path.join(path.dirname(current.path), "verification.md");
    let old = "# 검증 기록\n";
    try { old = await fs.readFile(report, "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await atomicWrite(report, `${old.trimEnd()}\n\n${renderAttempt(attempt)}\n`);
    record.workflow.verifications.push(attempt);
    const applicable = await evaluateEvidence({ repo, record, attempt });
    for (const criterion of record.criteria) {
      if (!attempt.criterionIds.includes(criterion.id)) continue;
      criterion.result = applicable.usable ? "passed" : attempt.result === "failed" ? "failed" : "unverified";
      criterion.evidence.push({ attemptId: attempt.id, path: `verification.md#${attempt.id}`, summary: `실제 검증 ${attempt.result}; 현재 적용 ${applicable.usable ? "가능" : "불가"}` });
    }
    record.status = "verifying";
    record.blockedReason = applicable.usable ? null : applicable.reasons.join("; ");
    record.workflow.nextAction = applicable.usable ? "review" : attempt.result === "failed" && record.workflow.authorization.implementation ? "build" : "verify";
  });
  return attempt;
}

async function assessRecord(repo, work, policyRoot) {
  if (work.record.schemaVersion !== 2) return { ...work, legacy: true, complete: false, reasons: ["legacy 결과는 현재 소스의 검증으로 자동 승격하지 않습니다."] };
  const { record } = work;
  const reasons = validateRequirementRefs(record, { root: repo });
  const criteria = [];
  for (const criterion of record.criteria.filter((item) => item.required)) {
    const attempt = record.workflow.verifications.filter((item) => item.criterionIds.includes(criterion.id)).at(-1);
    const evaluation = attempt ? await evaluateEvidence({ repo, record, attempt }) : { usable: false, reasons: ["검증 시도 없음"] };
    criteria.push({ id: criterion.id, ...evaluation });
    if (!evaluation.usable) reasons.push(`${criterion.id}: ${evaluation.reasons.join(", ")}`);
  }
  const source = await captureSource({ repo, inputs: record.workflow.inputs });
  const policyInfo = await loadReviewPolicy({ root: policyRoot ?? repo });
  if (policyRoot && path.resolve(policyRoot) !== path.resolve(repo)) {
    const repositoryPolicy = await loadReviewPolicy({ root: repo });
    if (repositoryPolicy.hash !== policyInfo.hash) reasons.push("배포된 검토 정책과 저장소 정책이 다릅니다.");
  }
  const review = record.workflow.reviews.at(-1);
  const reviewState = review ? validateReview({ repo, policy: policyInfo.policy, review, sourceDigest: source.digest, criteriaDigest: criteriaDigest(record), policyHash: policyInfo.hash }) : { usable: false, reasons: ["필수 독립 검토 없음"] };
  if (policyInfo.policy.required && !reviewState.usable) reasons.push(...reviewState.reasons);
  if (record.blockedReason && reasons.length === 0) reasons.push(record.blockedReason);
  return { ...work, source, criteria, review: reviewState, complete: reasons.length === 0, reasons };
}

export async function assessWork({ repo = process.cwd(), workId, policyRoot } = {}) {
  return assessRecord(repo, await readWork({ repo, workId }), policyRoot);
}

export async function recordReview({ repo = process.cwd(), workId, review } = {}) {
  return mutateWork(repo, workId, (record) => {
    if (!review || typeof review.id !== "string" || !review.id) throw new Error("식별 가능한 실제 검토 기록이 필요합니다.");
    if (record.workflow.reviews.some((item) => item.id === review.id)) throw new Error("중복된 검토 ID입니다.");
    record.workflow.reviews.push(review);
    record.status = "verifying";
    record.workflow.nextAction = review.verdict === "pass" ? "complete" : review.verdict === "fail" && record.workflow.authorization.implementation ? "build" : "review";
    record.blockedReason = review.verdict === "pass" ? null : `독립 검토 ${review.verdict ?? "미확인"}: ${review.failure?.kind ?? "수정 또는 검토 재실행 필요"}`;
  });
}

export async function resumeWork({ repo = process.cwd(), workId } = {}) {
  const assessment = await assessWork({ repo, workId });
  if (assessment.legacy) return assessment;
  const work = await mutateWork(repo, workId, (record) => {
    for (const criterion of assessment.criteria) if (!criterion.usable) record.criteria.find((item) => item.id === criterion.id).result = "unverified";
    if (!assessment.complete && record.status === "done") record.status = "verifying";
    const invalid = assessment.criteria.filter((item) => !item.usable);
    const changed = invalid.some((item) => item.reasons.some((reason) => ["source_changed", "scope_changed", "criteria_changed", "environment_changed"].includes(reason)));
    const failed = invalid.some((item) => item.reasons.includes("verification_failed"));
    const notStarted = invalid.length > 0 && invalid.every((item) => item.reasons.includes("검증 시도 없음"));
    let nextAction = "review";
    if (changed) nextAction = "verify";
    else if (failed && record.workflow.authorization.implementation) nextAction = "build";
    else if (notStarted && ["spec", "design", "build", "diagnose"].includes(record.workflow.nextAction)) nextAction = record.workflow.nextAction;
    else if (invalid.length) nextAction = "verify";
    else if (assessment.review.usable) nextAction = "complete";
    else if (record.workflow.reviews.at(-1)?.verdict === "fail" && record.workflow.authorization.implementation) nextAction = "build";
    record.workflow.nextAction = nextAction;
    record.blockedReason = assessment.reasons.length ? assessment.reasons.join("; ") : null;
  });
  return { ...assessment, ...work, nextAction: work.record.workflow.nextAction };
}

export async function completeWork({ repo = process.cwd(), workId, policyRoot } = {}) {
  return mutateWork(repo, workId, async (record, work) => {
    const assessment = await assessRecord(repo, { ...work, record }, policyRoot);
    if (!assessment.complete) throw new Error(`현재 증거로 완료할 수 없습니다: ${assessment.reasons.join("; ")}`);
    const source = await captureSource({ repo, inputs: record.workflow.inputs });
    if (source.digest !== assessment.source.digest) throw new Error("완료 판정 중 소스가 바뀌었습니다.");
    record.status = "done";
    record.blockedReason = null;
    record.workflow.nextAction = "complete";
  });
}

async function main() {
  const options = JSON.parse(process.argv[2] ?? "{}");
  const actions = { open: openWork, adopt: adoptWork, read: readWork, advance: advanceWork, inputs: setVerificationInputs, verify: verifyWork, status: assessWork, resume: resumeWork, complete: completeWork };
  if (!actions[options.action]) throw new Error("action은 open/adopt/read/advance/inputs/verify/status/resume/complete 중 하나여야 합니다.");
  const result = await actions[options.action](options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
