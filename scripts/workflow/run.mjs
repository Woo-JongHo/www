import { createGjcInvocation, gjcCapabilities, spawnGjc } from "./adapters/gjc.mjs";
import { loadCanonicalSkill, validateSessionBinding } from "./preflight.mjs";

export function buildSkillContext({ binding, skill, facts = [], evidence = [] } = {}) {
  if (!binding || !skill) throw new TypeError("binding과 Skill이 필요합니다.");
  const safeFacts = Array.isArray(facts) ? facts.filter((item) => typeof item === "string") : [];
  const safeEvidence = Array.isArray(evidence) ? evidence.filter((item) => typeof item === "string") : [];
  return [
    "WWW Skill 실행 컨텍스트", `work-id: ${binding.workId}`, `request-hash: ${binding.requestHash}`,
    `repo: ${binding.repo}`, `branch: ${binding.branch}`, `head: ${binding.head}`,
    `skill: ${skill.skill}`, `skill-hash: ${skill.hash}`, "skill-load-mode: context",
    "사용자 승인 범위 밖의 mutation은 금지됩니다.",
    safeFacts.length ? `facts:\n${safeFacts.map((item) => `- ${item}`).join("\n")}` : "facts: 없음",
    safeEvidence.length ? `evidence:\n${safeEvidence.map((item) => `- ${item}`).join("\n")}` : "evidence: 없음",
    "\n--- 검증된 Skill 본문 ---\n", skill.source,
  ].join("\n");
}

export async function prepareRun({ binding, skill: skillName, expectedSkillHash, model, thinking, facts, evidence } = {}) {
  const currentBinding = await validateSessionBinding(binding);
  const skill = await loadCanonicalSkill({ repo: currentBinding.repo, skill: skillName, expectedHash: expectedSkillHash });
  const context = buildSkillContext({ binding: currentBinding, skill, facts, evidence });
  const invocation = createGjcInvocation({ systemPrompt: context, model, thinking });
  return Object.freeze({ binding: currentBinding, skill: { skill: skill.skill, hash: skill.hash, path: skill.path, loadMode: skill.loadMode }, invocation, capabilities: gjcCapabilities() });
}

export async function runWorkflow(options = {}) {
  const prepared = await prepareRun(options);
  if (options.preview === true) return { ...prepared, preview: true, executed: false };
  if (options.execute !== true) throw new Error("실행은 execute: true로 명시해야 합니다.");
  const child = spawnGjc(prepared.invocation, { cwd: prepared.binding.repo, env: options.env, stdio: options.stdio });
  return { ...prepared, preview: false, executed: true, child };
}

async function main() {
  const raw = process.argv[2];
  if (!raw) throw new Error("JSON 옵션 하나가 필요합니다.");
  const result = await runWorkflow(JSON.parse(raw));
  const { child, ...serializable } = result;
  process.stdout.write(`${JSON.stringify(serializable)}\n`);
  if (child) child.once("exit", (code) => { process.exitCode = code ?? 1; });
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
