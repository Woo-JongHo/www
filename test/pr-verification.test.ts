import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { planPr } from "../scripts/pr-verification";

const archive = "skill-library/upstream/sample/plan/SKILL.md";
const manifest = "skill-library/inventory.json";
const note = "docs/work/Workflow/005-Skills 라이브러리 한국어 대체/verification.md";

function candidate(change: (root: string) => void) {
  const repo = mkdtempSync(path.join(tmpdir(), "www-pr-scope-"));
  function git(...args: string[]): string {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  }
  const file = (name: string) => path.join(repo, name);
  const content = (description: string, text: string) => `---\ndescription: ${description}\nallowed-tools: Read\n---\n${text}\n`;
  try {
    git("init", "-q");
    git("config", "user.name", "시험");
    git("config", "user.email", "test@example.invalid");
    mkdirSync(path.dirname(file(archive)), { recursive: true });
    mkdirSync(path.dirname(file(note)), { recursive: true });
    writeFileSync(file(archive), content("이전 설명", "첫 번역"));
    writeFileSync(file(note), "과거 관측\n");
    const row = { localPath: archive, originalSha256: "fixed", language: "ko", sha256: "previous", bytes: 20 };
    writeFileSync(file(manifest), JSON.stringify({ files: [row] }));
    git("add", ".");
    git("commit", "-qm", "original");
    const base = git("rev-parse", "HEAD");
    writeFileSync(file(archive), content("고친 설명", "교정한 번역"));
    writeFileSync(file(note), "과거 관측\n\n새 관측\n");
    writeFileSync(file(manifest), JSON.stringify({ files: [{ ...row, sha256: "current", bytes: 25 }] }));
    change(repo);
    git("add", "-A");
    git("commit", "-qm", "candidate");
    const head = git("rev-parse", "HEAD");
    const merge = git("commit-tree", "HEAD^{tree}", "-p", base, "-p", head, "-m", "merge");
    return { scope: planPr(repo, base, head, merge), wrongParent: planPr(repo, head, base, merge) };
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

test("기존 번역과 원장 부기의 후보만 지문이 있는 집중 검사로 보낸다", () => {
  const { scope, wrongParent } = candidate(() => {});
  expect(scope.mode).toBe("focused");
  if (scope.mode === "focused") expect(scope.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(wrongParent.mode).toBe("full");
});

test("기준 자료·도구 설정·실행 파일·모드·링크·과거 서술 변경은 전체 검사로 보낸다", () => {
  const changes = [
    (repo: string) => writeFileSync(path.join(repo, "main.ts"), "export const version = 2;"),
    (repo: string) => writeFileSync(path.join(repo, note), "이전 관측을 다시 썼다\n"),
    (repo: string) => {
      const target = path.join(repo, archive);
      writeFileSync(target, "\uFEFF\uFEFF " + readFileSync(target, "utf8").replace("allowed-tools: Read", "allowed-tools: Bash"));
    },
    (repo: string) => chmodSync(path.join(repo, archive), 0o755),
    (repo: string) => symlinkSync(archive, path.join(repo, "alias.md")),
    (repo: string) => {
      const target = path.join(repo, manifest);
      writeFileSync(target, readFileSync(target, "utf8").replace("fixed", "changed"));
    },
    (repo: string) => {
      const target = path.join(repo, archive);
      writeFileSync(target, readFileSync(target, "utf8").replace("allowed-tools: Read", "allowed-tools: Bash"));
    },
  ];
  for (const change of changes) expect(candidate(change).scope.mode).toBe("full");
});
