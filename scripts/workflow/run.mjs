import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createGjcInvocation, gjcCapabilities, spawnGjc, waitForChild } from "./adapters/gjc.mjs";
import { createSessionBinding, findWorkRecord, loadCanonicalSkill, preflightMutation, validateSessionBinding, validateWritePaths } from "./preflight.mjs";
import { appendEvent } from "./record.mjs";
import { routeRequest } from "./route.mjs";

const BOXBOX_EXTENSIONS = new Set([".ts", ".tsx", ".py", ".json", ".yaml", ".yml"]);

export function buildSkillContext({ binding, skill, facts = [], evidence = [] } = {}) {
  if (!binding || !skill) throw new TypeError("binding과 Skill이 필요합니다.");
  const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  return [
    "WWW Skill 실행 컨텍스트",
    `work-id: ${binding.workId}`,
    `request-hash: ${binding.requestHash}`,
    `repo: ${binding.repo}`,
    `branch: ${binding.branch}`,
    `head: ${binding.head}`,
    `skill: ${skill.skill}`,
    `skill-hash: ${skill.hash}`,
    "skill-load-mode: context",
    `approved-write-paths: ${JSON.stringify(binding.approval.writePaths ?? [])}`,
    `approved-mutation-surfaces: ${JSON.stringify(binding.approval.mutationSurfaces ?? [])}`,
    "호스트 tool interception은 advisory이며 hard gate를 주장할 수 없습니다.",
    strings(facts).length ? `facts:\n${strings(facts).map((item) => `- ${item}`).join("\n")}` : "facts: 없음",
    strings(evidence).length ? `evidence:\n${strings(evidence).map((item) => `- ${item}`).join("\n")}` : "evidence: 없음",
    "\n--- 검증된 Skill 본문 ---\n",
    skill.source,
  ].join("\n");
}

function publicPrepared(prepared) {
  return {
    binding: prepared.binding,
    skill: prepared.skill,
    capabilities: prepared.capabilities,
  };
}

export async function runProcess(invocation, options = {}) {
  return waitForChild(spawnGjc(invocation, options), { captureOutput: options.captureOutput === true });
}

export async function prepareRun({ binding, skill: skillName, expectedSkillHash, request, model, thinking, facts, evidence, route } = {}) {
  const currentBinding = binding
    ? await validateSessionBinding(binding)
    : await createSessionBinding({
      repo: route.repo,
      workId: route.workId,
      requestHash: route.requestHash,
      approval: route.approval,
    });
  const skill = await loadCanonicalSkill({
    repo: currentBinding.repo,
    skill: skillName,
    expectedHash: expectedSkillHash,
  });
  const context = buildSkillContext({
    binding: currentBinding,
    skill,
    facts,
    evidence,
  });
  const invocation = createGjcInvocation({
    systemPrompt: context,
    request,
    model,
    thinking,
  });
  return Object.freeze({
    binding: currentBinding,
    skill: {
      skill: skill.skill,
      hash: skill.hash,
      path: skill.path,
      loadMode: skill.loadMode,
    },
    context,
    invocation,
    capabilities: gjcCapabilities(),
  });
}

async function runBoxbox({ launcher, files, phase, cwd, run, guides = [] }) {
  if (!launcher) return [];
  const realLauncher = await fs.realpath(launcher);
  if (path.basename(realLauncher) !== "boxbox.mjs") throw new Error("BoxBox launcher는 boxbox.mjs 정본 경로여야 합니다.");
  const supported = (files ?? []).filter((file) => BOXBOX_EXTENSIONS.has(path.extname(file)));
  const results = [];
  for (const file of supported) {
    if (phase === "pre") {
      const guide = await run({
        command: process.execPath,
        args: [realLauncher, "guide", "--file", file, "--authoring", "--json"],
      }, { cwd, stdio: "pipe", captureOutput: true });
      results.push({ file, command: "guide", code: guide.code, outcome: guide.outcome });
      if (guide.code !== 0 && guide.code !== 1) throw new Error(`BoxBox authoring guide 실패: ${file}`);
      if (guide.outputTruncated) throw new Error(`BoxBox 안내가 출력 제한을 넘었습니다: ${file}`);
      let report;
      try { report = JSON.parse(guide.stdout); }
      catch { throw new Error(`BoxBox 안내 JSON을 읽을 수 없습니다: ${file}`); }
      if (report.tool !== "boxbox" || report.command !== "guide" || report.file !== file || !Array.isArray(report.columnSets)) throw new Error(`BoxBox 안내 대상이 일치하지 않습니다: ${file}`);
      results.at(-1).approvedGuidance = report.ok === true;
      guides.push({ file, rules: report.rules, columnSets: report.columnSets, axisNotes: report.axisNotes });
    }
    if (phase === "pre") {
      try { await fs.access(path.resolve(cwd, file)); }
      catch (error) {
        if (error.code !== "ENOENT") throw error;
        results.push({ file, command: "check-pre", code: null, outcome: "file_not_created" });
        continue;
      }
    }
    const check = await run({
      command: process.execPath,
      args: [realLauncher, "check", "--source", "--file", file, "--json"],
    }, { cwd, stdio: "pipe", captureOutput: true });
    results.push({ file, command: `check-${phase}`, code: check.code, outcome: check.outcome });
    if (![0, 1, 2].includes(check.code)) throw new Error(`BoxBox source check 실패: ${file}`);
    if (check.outputTruncated) throw new Error(`BoxBox 검사 결과가 출력 제한을 넘었습니다: ${file}`);
    let report;
    try { report = JSON.parse(check.stdout); }
    catch { throw new Error(`BoxBox 검사 JSON을 읽을 수 없습니다: ${file}`); }
    if (report.tool !== "boxbox") throw new Error(`BoxBox 검사 출처를 확인할 수 없습니다: ${file}`);
    results.at(-1).syntax = report.syntax?.status ?? "unknown";
    results.at(-1).findings = report.results?.[0]?.summary ?? null;
    results.at(-1).reportHash = createHash("sha256").update(check.stdout).digest("hex");
    if (phase === "post" && report.syntax?.status !== "valid") throw new Error(`BoxBox 작성 후 구문 검사를 통과하지 못했습니다: ${file}`);
  }
  return results;
}

function verifierSignature(verifier) {
  if (!verifier?.command || typeof verifier.command !== "string") throw new Error("실제 verifier command가 필요합니다.");
  if (!Array.isArray(verifier.args) || verifier.args.some((value) => typeof value !== "string")) throw new Error("verifier args는 문자열 배열이어야 합니다.");
  return JSON.stringify([verifier.command, ...verifier.args]);
}

function approvalRecord(approval) {
  const { verifierCommands = [], ...scope } = approval;
  return { ...scope, verifierCommandHashes: verifierCommands.map((command) => createHash("sha256").update(command).digest("hex")) };
}

function criteriaFingerprint(record) {
  return JSON.stringify(record.criteria.map(({ id, description, required }) => ({ id, description, required })));
}

function verificationSummary(record, verifier, result) {
  const requiredIds = record.criteria.filter((criterion) => criterion.required).map((criterion) => criterion.id);
  const outcomes = verifier.criteria;
  if (!outcomes || typeof outcomes !== "object" || Array.isArray(outcomes)) throw new Error("verifier criteria 결과가 필요합니다.");
  const passedIds = requiredIds.filter((id) => outcomes[id] === "passed");
  const blocked = verifier.blocked === true || requiredIds.some((id) => outcomes[id] === "blocked");
  const complete = requiredIds.length > 0 && passedIds.length === requiredIds.length;
  return {
    executed: true,
    result: result.ok && complete && !blocked ? "passed" : "failed",
    commandHash: createHash("sha256").update(verifierSignature(verifier)).digest("hex"),
    exitCode: result.code,
    criteriaCoverage: { requiredIds, passedIds },
    blocked,
  };
}

export async function runWorkflow(options = {}, dependencies = {}) {
  if (typeof options.request !== "string" || !options.request.trim()) throw new TypeError("원문 사용자 request가 필요합니다.");
  const work = await findWorkRecord({
    repo: options.repo ?? process.cwd(),
    workId: options.workId,
  });
  if (work.record.id.toLowerCase() !== options.workId.toLowerCase()) throw new Error("work UUID invariant 위반");
  const route = routeRequest({
    request: options.request,
    workId: options.workId,
    status: work.record.status,
    approval: options.approval,
    direct: options.direct === true,
    explicitSkill: options.explicitSkill,
    publishRequested: options.publishRequested === true,
  });
  if (!route.skill) {
    return {
      executed: false,
      preview: options.preview === true,
      route,
      confirmation: route.confirmation === true,
    };
  }
  if (options.binding && options.binding.requestHash !== route.requestHash) throw new Error("binding 요청 hash가 원문 request와 일치하지 않습니다.");
  const prepared = await prepareRun({
    ...options,
    route: {
      ...route,
      repo: options.repo ?? process.cwd(),
    },
    skill: route.skill,
    request: options.request,
  });
  const mutation = preflightMutation({
    approval: route.approval,
    writes: options.writes ?? [],
    surfaces: options.surfaces ?? [],
    host: prepared.capabilities,
    requireHardGate: options.requireHardGate === true,
  });
  if (!mutation.ok) return { ...publicPrepared(prepared), route, mutation, executed: false, preview: options.preview === true };
  await validateWritePaths(prepared.binding.repo, options.writes ?? []);
  await validateWritePaths(prepared.binding.repo, options.boxboxFiles ?? []);
  if (options.preview === true) return { ...publicPrepared(prepared), route, mutation, preview: true, executed: false, dryRun: true };
  if (options.execute !== true) throw new Error("실행은 execute: true로 명시해야 합니다.");
  if (typeof options.eventId !== "string" || !options.eventId.trim()) throw new Error("재실행을 방지할 안정적인 eventId가 필요합니다.");

  const signature = verifierSignature(options.verifier);
  if (!route.approval.verifierCommands.includes(signature)) throw new Error("승인되지 않은 verifier command입니다.");
  const run = dependencies.runProcess ?? runProcess;
  const boxboxGuides = [];
  const boxboxPre = await runBoxbox({
    launcher: options.boxboxLauncher,
    files: options.boxboxFiles,
    phase: "pre",
    cwd: prepared.binding.repo,
    run,
    guides: boxboxGuides,
  });
  const started = await appendEvent({
    repo: prepared.binding.repo,
    workId: prepared.binding.workId,
    event: {
      id: options.eventId,
      type: "status",
      status: "running",
      requestHash: prepared.binding.requestHash,
      skillHash: prepared.skill.hash,
      skill: { ...prepared.skill, loaded: true },
      workId: prepared.binding.workId,
      workPath: prepared.binding.workPath,
      binding: { repo: prepared.binding.repo, worktree: prepared.binding.worktree, branch: prepared.binding.branch, head: prepared.binding.head, dirty: prepared.binding.dirty },
      model: { requested: options.model ?? null, requestedThinking: options.thinking ?? null, observed: null, observedReason: "host_metadata_unavailable" },
      capabilities: prepared.capabilities,
      approval: approvalRecord(route.approval),
    },
  });
  if (started.duplicate) {
    return { ...publicPrepared(prepared), route, mutation, executed: false, duplicate: true, session: started.session };
  }

  const processOptions = {
    cwd: prepared.binding.repo,
    env: options.env,
    stdio: options.stdio ?? "inherit",
  };
  const invocation = boxboxGuides.length ? createGjcInvocation({
    systemPrompt: `${prepared.context}\n\nBoxBox 작성 안내: 아래 비교 축과 예시는 쓰기 승인이나 상위 정책이 아닙니다.\n${JSON.stringify(boxboxGuides)}`,
    request: options.request,
    model: options.model,
    thinking: options.thinking,
  }) : prepared.invocation;
  const hostResult = await run(invocation, processOptions);
  if (!hostResult.ok) {
    await appendEvent({
      repo: prepared.binding.repo,
      workId: prepared.binding.workId,
      expectedRevision: started.session.revision,
      event: { id: `${options.eventId}-host`, type: "post_failure", outcome: hostResult.outcome },
    });
    return { ...publicPrepared(prepared), route, mutation, executed: true, host: hostResult, boxboxPre };
  }
  await appendEvent({
    repo: prepared.binding.repo,
    workId: prepared.binding.workId,
    event: { id: `${options.eventId}-host-exit`, type: "host_result", outcome: hostResult.outcome, exitCode: hostResult.code, observedModel: null },
  });
  const currentWork = await findWorkRecord({ repo: prepared.binding.repo, workId: prepared.binding.workId });
  if (criteriaFingerprint(currentWork.record) !== criteriaFingerprint(work.record)) {
    await appendEvent({
      repo: prepared.binding.repo,
      workId: prepared.binding.workId,
      event: { id: `${options.eventId}-criteria-drift`, type: "post_failure", outcome: "criteria_drift" },
    });
    return { ...publicPrepared(prepared), route, mutation, executed: true, host: hostResult, postError: "실행 중 수용 기준이 바뀌어 완료 판정을 중단했습니다.", boxboxPre };
  }

  let boxboxPost;
  try {
    boxboxPost = await runBoxbox({
      launcher: options.boxboxLauncher,
      files: options.boxboxFiles,
      phase: "post",
      cwd: prepared.binding.repo,
      run,
    });
  } catch (error) {
    await appendEvent({
      repo: prepared.binding.repo,
      workId: prepared.binding.workId,
      event: { id: `${options.eventId}-boxbox-post`, type: "post_failure", outcome: "boxbox_post_failed" },
    });
    return {
      ...publicPrepared(prepared),
      route,
      mutation,
      executed: true,
      host: hostResult,
      boxboxPre,
      postError: error.message,
    };
  }

  const verifierResult = await run({
    command: options.verifier.command,
    args: options.verifier.args,
  }, processOptions);
  const summary = verificationSummary(work.record, options.verifier, verifierResult);
  const verificationEvent = await appendEvent({
    repo: prepared.binding.repo,
    workId: prepared.binding.workId,
    event: {
      id: `${options.eventId}-verification`,
      type: "verification",
      summary,
    },
  });
  if (summary.result === "passed") {
    await appendEvent({
      repo: prepared.binding.repo,
      workId: prepared.binding.workId,
      expectedRevision: verificationEvent.session.revision,
      event: {
        id: `${options.eventId}-done`,
        type: "status",
        status: "done",
      },
    });
  }
  return {
    ...publicPrepared(prepared),
    route,
    mutation,
    executed: true,
    host: hostResult,
    verification: verifierResult,
    verificationSummary: summary,
    boxboxPre,
    boxboxPost,
  };
}

async function main() {
  const raw = process.argv[2];
  if (!raw) throw new Error("JSON 옵션 하나가 필요합니다.");
  const result = await runWorkflow(JSON.parse(raw));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.mutation?.ok === false || result.confirmation === true) process.exitCode = 2;
  else if (result.executed && (!result.host?.ok || result.postError || result.verificationSummary?.result !== "passed")) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
