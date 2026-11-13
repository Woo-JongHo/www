export interface WwwArtifact {
  id: string;
  kind: "role" | "skill";
  label: string;
  path: string;
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
