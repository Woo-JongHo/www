import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const inventory = "skill-library/inventory.json";
const verification = "docs/work/Workflow/005-Skills 라이브러리 한국어 대체/verification.md";
const checks = [["scripts/check-skill-library.ts"], ["--test", "test/skill-library.test.ts"], ["scripts/check-workflow.ts"]];
const sha = /^[a-f0-9]{40}$/;
const decoder = new TextDecoder("utf-8", { fatal: true });

function git(repo: string, ...args: string[]): Buffer {
  return execFileSync("git", args, { cwd: repo, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function ref(repo: string, expression: string) {
  return git(repo, "rev-parse", "--verify", expression).toString().trim();
}

function changedFiles(repo: string, from: string, to: string) {
  const raw = decoder.decode(git(repo, "diff", "--no-ext-diff", "--raw", "-z", "--no-renames", "--abbrev=40", from, to, "--"));
  const fields = raw.split("\0");
  const files = new Map<string, { before: string; after: string }>();
  for (let index = 0; index < fields.length - 1; index += 2) {
    const entry = /^:100644 100644 ([a-f0-9]{40}) ([a-f0-9]{40}) M$/.exec(fields[index]);
    if (!entry) return null;
    files.set(fields[index + 1], { before: entry[1], after: entry[2] });
  }
  return files;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textBlob(repo: string, id: string) {
  const text = decoder.decode(git(repo, "cat-file", "blob", id));
  if (text.includes("\0")) throw new Error("binary_input");
  return text;
}

// 보관 문서의 단일 평문 설명만 달라질 수 있다. 도구·훅·트리거·다중행 YAML은 그대로 대조한다.
function header(markdown: string) {
  markdown = markdown.replaceAll("\r\n", "\n");
  if (!markdown.startsWith("---\n")) {
    if (/^---[ \t\r]*(?:\n|$)/.test(markdown)) throw new Error("unknown_frontmatter");
    return null;
  }
  const end = markdown.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("unknown_frontmatter");
  return markdown.slice(0, end).replace(/^description: [\p{L}\p{N}][\p{L}\p{N} .,·()\/_-]*$/gmu, "description: <text>");
}

function matchesInventory(before: unknown, after: unknown, translations: Set<string>) {
  if (!object(before) || !object(after) || !Array.isArray(before.files) || !Array.isArray(after.files)) return false;
  const current = after.files;
  if (before.files.length !== current.length) return false;
  const revised = new Set<string>();
  const rows = before.files.map((old: unknown, index: number) => {
    const row: unknown = current[index];
    if (!object(old) || !object(row) || typeof old.localPath !== "string" || !translations.has(old.localPath)) return old;
    if (old.language !== "ko") return old;
    revised.add(old.localPath);
    return { ...old, sha256: row.sha256, bytes: row.bytes };
  });
  return revised.size === translations.size && JSON.stringify({ ...before, files: rows }) === JSON.stringify(after);
}

type Scope = { mode: "full"; reason: string } | {
  mode: "focused"; base: string; head: string; candidate: string; tree: string; fingerprint: string; files: string[];
};

export function planPr(repo: string, base: string, head: string, candidate: string): Scope {
  const full = (reason: string): Scope => ({ mode: "full", reason });
  if (![base, head, candidate].every(value => sha.test(value))) return full("unknown_revision");
  try {
    const parents = git(repo, "show", "-s", "--format=%P", candidate).toString().trim();
    if (parents !== base + " " + head) return full("candidate_parents");
    const ancestor = git(repo, "merge-base", base, head).toString().trim();
    const files = changedFiles(repo, base, candidate);
    const branch = changedFiles(repo, ancestor, head);
    if (!files?.size || !branch || JSON.stringify([...branch]) !== JSON.stringify([...files])) return full("mixed_or_structural_change");
    const manifest = files.get(inventory);
    if (!manifest) return full("outside_translation_scope");
    const translations = new Set<string>();
    for (const [file, blob] of files) {
      if (file === inventory) continue;
      if (file === verification) {
        if (!textBlob(repo, blob.after).startsWith(textBlob(repo, blob.before))) return full("verification_history_changed");
        continue;
      }
      if (!/^skill-library\/upstream\/[\w./-]+\.md$/.test(file)) return full("outside_translation_scope");
      if (header(textBlob(repo, blob.before)) !== header(textBlob(repo, blob.after))) return full("skill_metadata_changed");
      translations.add(file);
    }
    if (!translations.size || !matchesInventory(JSON.parse(textBlob(repo, manifest.before)), JSON.parse(textBlob(repo, manifest.after)), translations)) return full("inventory_contract_changed");
    const tree = ref(repo, candidate + "^{tree}");
    const rule = createHash("sha256").update(readFileSync(import.meta.filename)).digest("hex");
    const fingerprint = createHash("sha256").update(JSON.stringify({ rule, checks, tree, base, head, candidate, node: process.version, platform: process.platform, arch: process.arch })).digest("hex");
    return { mode: "focused", base, head, candidate, tree, fingerprint, files: [...files.keys()] };
  } catch {
    return full("unreadable_or_unknown_input");
  }
}

function assertCheckout(repo: string, candidate: string) {
  if (ref(repo, "HEAD") !== candidate || git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all").length) {
    throw new Error("검사한 체크아웃과 PR 후보가 일치해야 합니다.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [action, base, head, candidate] = process.argv.slice(2);
  if (action !== "plan" && action !== "verify") throw new Error("plan 또는 verify와 base/head/후보 SHA가 필요합니다.");
  const repo = process.cwd();
  const scope = planPr(repo, base, head, candidate);
  console.log(JSON.stringify(scope));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mode=${scope.mode}\n`);
  if (action === "verify" && scope.mode === "focused") {
    assertCheckout(repo, scope.candidate);
    for (const args of checks) {
      const result = spawnSync(process.execPath, args, { cwd: repo, stdio: "inherit" });
      if (result.error || result.status !== 0) throw new Error("PR 집중 검사 실패: " + args.join(" "));
    }
    assertCheckout(repo, scope.candidate);
    const receipt = `WWW_PR_FOCUSED_TREE ${scope.candidate} ${scope.tree} ${scope.base} ${scope.head} ${scope.fingerprint}`;
    console.log(receipt);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, receipt + "\n");
  }
}
