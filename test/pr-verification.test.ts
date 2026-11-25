import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isSessionDraft, planPr, prKind } from "../scripts/pr-verification";

const archive = "skill-library/upstream/sample/plan/SKILL.md";
const manifest = "skill-library/inventory.json";
const note = "docs/work/Workflow/005-Skills 라이브러리 한국어 대체/verification.md";

function candidate(change: (root: string) => void, translation = true, inspectCombined = false) {
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
    for (const name of ["src/chat-composer.tsx", "src/architecture.generated.json", "scripts/verify-chat.ts", "package-lock.json", "test/input.test.ts", ".github/workflows/ci.yml"]) {
      mkdirSync(path.dirname(file(name)), { recursive: true });
      writeFileSync(file(name), "original\n");
    }
    git("add", ".");
    git("commit", "-qm", "original");
    const base = git("rev-parse", "HEAD");
    if (translation) {
      writeFileSync(file(archive), content("고친 설명", "교정한 번역"));
      writeFileSync(file(note), "과거 관측\n\n새 관측\n");
      writeFileSync(file(manifest), JSON.stringify({ files: [{ ...row, sha256: "current", bytes: 25 }] }));
    }
    change(repo);
    git("add", "-A");
    git("commit", "-qm", "candidate");
    const head = git("rev-parse", "HEAD");
    const merge = git("commit-tree", "HEAD^{tree}", "-p", base, "-p", head, "-m", "merge");
    let combined: ReturnType<typeof planPr> | null = null;
    if (inspectCombined) {
      const other = git("commit-tree", "HEAD^{tree}", "-p", base, "-m", "독립 작업");
      const integrated = git("commit-tree", "HEAD^{tree}", "-p", head, "-p", other, "-m", "두 작업 결합");
      const preview = git("commit-tree", "HEAD^{tree}", "-p", base, "-p", integrated, "-m", "결합 PR 후보");
      combined = planPr(repo, base, integrated, preview, "individual");
    }
    return {
      scope: planPr(repo, base, head, merge, "individual"), draft: planPr(repo, base, head, merge, "session-draft"),
      wrongParent: planPr(repo, head, base, merge, "session-draft"), full: planPr(repo, base, head, merge, "full"),
      combined,
    };
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

test("기존 번역과 원장 부기의 후보만 지문이 있는 집중 검사로 보낸다", () => {
  const { scope, draft, wrongParent, full, combined } = candidate(() => {}, true, true);
  expect(draft.mode).toBe("focused");
  expect(full.mode).toBe("full");
  expect(combined).toEqual({ mode: "full", reason: "merged_branch_history" });
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
    (repo: string) => {
      chmodSync(path.join(repo, archive), 0o755);
      execFileSync("git", ["add", "--chmod=+x", "--", archive], { cwd: repo });
    },
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
  for (const change of changes) expect(candidate(change).draft.mode).toBe("full");
}, 20_000);

const repository = "owner/www";
const draft = { action: "opened", pull_request: { draft: true,
  base: { ref: "main", repo: { full_name: repository } },
  head: { ref: "codex/session-24/issue-25-enter", repo: { full_name: repository } },
} };

const registration = { id: "24", html_url: "https://github.com/owner/www/issues/7#issuecomment-24", author_association: "OWNER", body: "선정 이슈 25, 26\n<!-- www-session-v1: 25,26 -->" };

test("같은 저장소의 세션 이슈 초안 이벤트만 허용한다", () => {
  const pr = draft.pull_request;
  for (const action of ["opened", "synchronize", "reopened", "converted_to_draft"]) {
    expect(isSessionDraft({ ...draft, action }, repository, registration)).toBe(true);
  }
  for (const event of [null, {}, { ...draft, action: "ready_for_review" }, { ...draft, action: "edited" },
    { ...draft, pull_request: { ...pr, draft: false } },
    { ...draft, pull_request: { ...pr, base: { ...pr.base, ref: "release" } } },
    { ...draft, pull_request: { ...pr, head: { ...pr.head, ref: "codex/session-24/integrate" } } },
    { ...draft, pull_request: { ...pr, head: { ...pr.head, ref: "codex/issue25-enter" } } },
    { ...draft, pull_request: { ...pr, head: { ...pr.head, repo: { full_name: "elsewhere/www" } } } },
  ]) expect(isSessionDraft(event, repository, registration)).toBe(false);
  for (const invalid of [null, {}, { ...registration, id: "9" }, { ...registration, html_url: "https://github.com/owner/www/pull/7#issuecomment-24" }, { ...registration, author_association: "NONE" },
    { ...registration, body: "<!-- www-session-v1: 26 -->" }, { ...registration, body: "<!-- www-session-v1: 25,25 -->" },
    { ...registration, body: "<!-- www-session-v1: 1,2,3,4,5,25 -->" }, { ...registration, body: registration.body.repeat(2) },
  ]) expect(isSessionDraft(draft, repository, invalid)).toBe(false);
});

test("일반 번역과 ready·결합 브랜치·후보 dispatch를 파일 내용과 독립적으로 구분한다", () => {
  const ordinary = { ...draft, pull_request: { ...draft.pull_request, draft: false } };
  expect(prKind(ordinary, repository, null)).toBe("individual");
  expect(prKind(draft, repository, registration)).toBe("session-draft");
  expect(prKind(draft, repository, null)).toBe("individual");
  expect(prKind({ ...ordinary, action: "ready_for_review" }, repository, null)).toBe("full");
  for (const ref of ["codex/integrate-followup-verification", "codex/batch-25", "integration/cohort"]) {
    const head = { ...ordinary.pull_request.head, ref };
    expect(prKind({ ...ordinary, pull_request: { ...ordinary.pull_request, head } }, repository, null)).toBe("full");
  }
  for (const event of [null, { inputs: { candidate_sha: "a".repeat(40) } }, { merge_group: {} }]) {
    expect(prKind(event, repository, null)).toBe("full");
  }
});

test("앱 경로와 생성 지도만 매핑하고 테스트·설치·하네스·CI·미분류는 전체로 승격한다", () => {
  const update = (root: string, file: string) => writeFileSync(path.join(root, file), "changed\n");
  const app = (root: string) => {
    update(root, "src/chat-composer.tsx");
    update(root, "src/architecture.generated.json");
  };
  const { scope, draft, wrongParent } = candidate(app, false);
  expect(scope.mode).toBe("full");
  expect(wrongParent.mode).toBe("full");
  expect(draft.mode).toBe("session-app");
  if (draft.mode === "session-app") expect(draft.tests).toEqual(["test/chat-state.test.ts", "test/chat-status.test.ts", "test/input.test.ts"]);
  for (const file of ["test/input.test.ts", "scripts/verify-chat.ts", ".github/workflows/ci.yml", "package-lock.json", "src/new.ts"]) {
    expect(candidate(root => { app(root); update(root, file); }, false).draft.mode).toBe("full");
  }
  expect(candidate(root => update(root, "src/architecture.generated.json"), false).draft.mode).toBe("full");
}, 20_000);

test("ready·일반 PR·merge_group의 전체 경로와 초안 영수증 경계를 workflow에 연결한다", () => {
  const source = readFileSync(path.join(import.meta.dir, "../.github/workflows/ci.yml"), "utf8");
  expect(source).toContain("converted_to_draft, ready_for_review]");
  expect(source).toContain("  merge_group:");
  expect(source).toContain("github.event.pull_request.base.ref == 'main' && github.event.action != 'ready_for_review'");
  expect(source).toContain("needs.pr_scope.result != 'success' || needs.pr_scope.outputs.mode != 'focused'");
  expect(source).toContain("needs.pr_scope.outputs.mode == 'session-app' && '세션 초안 앱 검사' || 'validate'");
  expect(source).toContain("if: env.WWW_APP_DRAFT != 'true'\n        id: validate");
  expect(source).toContain('git show "$WWW_BASE_SHA:scripts/pr-verification.ts" > "$policy"');
});
