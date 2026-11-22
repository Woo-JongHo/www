/**
 * @architecture arch.chat.activity.artifacts
 * @implements RESP-CHAT-ACTIVITY-ARTIFACTS
 */
export interface WwwArtifact {
  id: string;
  kind: "role" | "skill";
  label: string;
  path: string;
}

/** 도구가 받는 공개 선언이다. 실행 영수증과 업무 수용은 이 계약에 포함하지 않는다. */
export interface WwwDevelopmentStage {
  workId: string;
  phase: "spec" | "design" | "build" | "diagnose" | "verify";
  status: "selected" | "running" | "completed" | "failed" | "interrupted";
  attemptId: string;
}
export type WwwHarnessAttempt = Omit<WwwDevelopmentStage, "status">;

export function parseWwwHarnessAttempt(value: unknown): WwwHarnessAttempt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = Object.fromEntries(Object.entries(value));
  if (Object.keys(input).length !== 3 || "status" in input) return null;
  const stage = parseWwwDevelopmentStage({ ...input, status: "running" });
  if (!stage) return null;
  return { workId: stage.workId, phase: stage.phase, attemptId: stage.attemptId };
}

const workIdPattern = /^work-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

export function requestedWwwPlanWorkIds(prompt: string): string[] {
  const firstLine = prompt.trim().split(/\r?\n/, 1)[0] ?? "";
  const [command, ...ids] = firstLine.trim().split(/[ \t]+/);
  return command === "/plan" && ids.every(id => workIdPattern.test(id)) ? ids : [];
}

export function parseWwwPlanLink(value: unknown): { workId: string; sha256: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { workId, sha256, ...rest } = Object.fromEntries(Object.entries(value));
  if (Object.keys(rest).length || typeof workId !== "string" || !workIdPattern.test(workId)
    || typeof sha256 !== "string" || !sha256Pattern.test(sha256)) return null;
  return { workId, sha256 };
}

export interface WwwPlanSnapshot {
  workId: string;
  path: string | null;
  sha256: string;
  status: "available" | "missing" | "failed" | "changed";
  content: string | null;
  at: string;
}

export function parseWwwPlanSnapshot(value: Record<string, unknown>, at: string): WwwPlanSnapshot | null {
  const { workId, sha256, path, status, content } = value;
  const link = parseWwwPlanLink({ workId, sha256 });
  if (!link || (path !== null && typeof path !== "string")) return null;
  if (path === null ? status !== "failed" : !path.startsWith("docs/work/") || !path.endsWith("/tasks.md")) return null;
  if (status !== "available" && status !== "missing" && status !== "failed" && status !== "changed") return null;
  if (status === "available" ? typeof content !== "string" : content !== null) return null;
  return { ...link, path, status, content: typeof content === "string" ? content : null, at };
}

export function parseWwwDevelopmentStage(value: unknown): WwwDevelopmentStage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = Object.fromEntries(Object.entries(value));
  if (Object.keys(row).length !== 4 || Object.keys(row).some(key => !["workId", "phase", "status", "attemptId"].includes(key))) return null;
  if (typeof row.workId !== "string" || !workIdPattern.test(row.workId)) return null;
  if (row.phase !== "spec" && row.phase !== "design" && row.phase !== "build" && row.phase !== "diagnose" && row.phase !== "verify") return null;
  if (row.status !== "selected" && row.status !== "running" && row.status !== "completed" && row.status !== "failed" && row.status !== "interrupted") return null;
  if (typeof row.attemptId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(row.attemptId)) return null;
  return { workId: row.workId, phase: row.phase, status: row.status, attemptId: row.attemptId };
}

/** 이름만의 언급이나 임의 AGENT.md를 WWW 역할로 분류하지 않는 정본 목록. */
export const WWW_ARTIFACTS: readonly WwwArtifact[] = [
  { id: "www-dev", kind: "role", label: "개발 접수·통합", path: "agents/www/AGENT.md" },
  { id: "www-design-agent", kind: "role", label: "화면·디자인 인계", path: "agents/www-design/AGENT.md" },
  { id: "www-spec", kind: "skill", label: "요구·수용 기준", path: "skills/www/www-spec/SKILL.md" },
  { id: "www-design", kind: "skill", label: "구조·검증 설계", path: "skills/www/www-design/SKILL.md" },
  { id: "www-build", kind: "skill", label: "허용된 구현", path: "skills/www/www-build/SKILL.md" },
  { id: "www-diagnose", kind: "skill", label: "원인 진단", path: "skills/www/www-diagnose/SKILL.md" },
  { id: "www-verify", kind: "skill", label: "동작·근거 검증", path: "skills/www/www-verify/SKILL.md" },
  { id: "www-commit", kind: "skill", label: "커밋·게시 절차", path: "skills/www/www-commit/SKILL.md" },
];

function absolute(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:\//.test(value);
}

function normalize(value: string): string | null {
  const source = value.replace(/\\/g, "/");
  const prefix = /^[A-Za-z]:\//.test(source) ? source.slice(0, 3) : source.startsWith("//") ? "//" : source.startsWith("/") ? "/" : "";
  const segments: string[] = [];
  for (const segment of source.slice(prefix.length).split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!segments.length) return null;
      segments.pop();
    } else segments.push(segment);
  }
  return prefix + segments.join("/");
}

function canonicalRelative(path: string, workspacePath?: string, commandCwd?: string): string | null {
  const source = path.replace(/\\/g, "/");
  if (!workspacePath) return null;
  const root = normalize(workspacePath);
  if (!root || !absolute(root)) return null;
  const rawCwd = commandCwd?.replace(/\\/g, "/") || root;
  const cwd = normalize(absolute(rawCwd) ? rawCwd : `${root}/${rawCwd}`);
  if (!cwd) return null;
  const resolved = normalize(absolute(source) ? source : `${cwd}/${source}`);
  if (!resolved) return null;
  const windows = /^[A-Za-z]:\//.test(root) || root.startsWith("//");
  const comparedRoot = windows ? root.toLowerCase() : root;
  const comparedPath = windows ? resolved.toLowerCase() : resolved;
  return comparedPath.startsWith(`${comparedRoot}/`) ? resolved.slice(root.length + 1) : null;
}

/** 선택 저장소의 정본 경로를 식별한다. 문서 읽기와 실제 역할·스킬 적용은 구별한다. */
export function identifyWwwArtifact(path: string, workspacePath?: string, commandCwd?: string): WwwArtifact | null {
  const relative = canonicalRelative(path, workspacePath, commandCwd);
  if (!relative) return null;
  const windows = /^[A-Za-z]:[\\/]/.test(workspacePath ?? "") || (workspacePath ?? "").startsWith("\\\\");
  const comparable = windows ? relative.toLowerCase() : relative;
  return WWW_ARTIFACTS.find((artifact) => (windows ? artifact.path.toLowerCase() : artifact.path) === comparable ||
    (artifact.kind === "skill" && comparable === (windows ? `.agents/skills/${artifact.id}/skill.md` : `.agents/skills/${artifact.id}/SKILL.md`))) ?? null;
}

/** 셸 구문을 실행하지 않고 확장 없는 리터럴 인자만 허용한다. */
function literalArguments(command: string): string[] | null {
  if (/[|;&<>$`(){}\r\n\\*?\[\]~#!^=]/.test(command)) return null;
  const words: string[] = [];
  let quote = "";
  let value = "";
  let started = false;
  for (const character of command) {
    if (/\s/.test(character) && character !== " " && character !== "\t") return null;
    if (quote) {
      if (character === quote) quote = "";
      else value += character;
    } else if (character === "'" || character === '"') {
      quote = character;
      started = true;
    } else if (character === " " || character === "\t") {
      if (started) words.push(value);
      value = "";
      started = false;
    } else {
      value += character;
      started = true;
    }
  }
  if (quote) return null;
  if (started) words.push(value);
  return words;
}

/** cat 명령의 문서 참조만 식별한다. 개별 파일 읽기 성공·스킬 적용을 보증하지 않는다. */
export function referencedWwwArtifacts(command: string, workspacePath?: string, commandCwd?: string): WwwArtifact[] {
  if (!workspacePath) return [];
  let words = literalArguments(command);
  if (!words) return [];
  if (["/bin/zsh", "/bin/bash", "zsh", "bash"].includes(words[0] ?? "")) {
    if (words.length !== 3 || words[1] !== "-lc") return [];
    words = literalArguments(words[2] ?? "");
    if (!words) return [];
  }
  if (!["cat", "/bin/cat", "/usr/bin/cat"].includes(words[0] ?? "")) return [];
  const paths = words.slice(words[1] === "--" ? 2 : 1);
  if (!paths.length || paths.some((path) => !path || path.startsWith("-"))) return [];
  const found = new Map<string, WwwArtifact>();
  for (const path of paths) {
    const artifact = identifyWwwArtifact(path, workspacePath, commandCwd);
    if (artifact) found.set(artifact.id, artifact);
  }
  return [...found.values()];
}
