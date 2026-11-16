/**
 * @verifies RESP-DEVELOPMENT-ARTIFACTS
 */
import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ARTIFACT_CHECKS, artifactContext, artifactStatus, developmentTools } from "../scripts/workflow/artifacts.ts";
import { openWork, readWork, recordArtifactReview } from "../scripts/workflow/work.ts";
import { runTypedWorkflow } from "../scripts/workflow.ts";
import { runDevelopmentWorkflow } from "../scripts/workflow/run.ts";
import type { WorkLocation } from "../scripts/workflow/types.ts";

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await fs.rm(directory, { recursive: true, force: true }); });
async function put(repo: string, file: string, content: string) {
  await fs.mkdir(path.dirname(path.join(repo, file)), { recursive: true });
  await fs.writeFile(path.join(repo, file), content);
}
async function fixture() {
  const repo = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "www-artifacts-")));
  directories.push(repo);
  await put(repo, "docs/work/INDEX.md", "# 작업 목차\n");
  await put(repo, "src/item.ts", "export const value = 1;\n");
  const work = await openWork({ repo, role: "www-dev", direct: true, requestId: "fixture", request: "즐겨찾기 기능 구현", decision: { intent: "design", area: "Workflow", title: "즐겨찾기", criteria: [{ id: "AC-1", description: "재시작 후 저장을 복원한다" }, { id: "AC-2", description: "누락한 프로젝트를 안내한다" }] }, approval: { implementation: true, writePaths: ["src"], mutationSurfaces: ["edit"], verifierCommands: [], commit: false, publish: false }, inputs: ["src"] });
  return { repo, work };
}
async function submission(repo: string, work: WorkLocation, kind: "spec" | "consistency" = "spec") {
  const context = await artifactContext(repo, work, kind);
  return {
    kind, depth: "brief", digest: context.digest, summary: "실제 명세와 기준을 읽어 검토했다.",
    checks: ARTIFACT_CHECKS[kind].map(id => ({ id, result: "satisfied", reason: "명세에 정한 범위와 기준을 확인했다.", references: [{ path: context.documents[0].path, line: 1 }] })),
    coverage: kind === "consistency" ? context.criteria.map(item => ({ criterionId: item.id, tasks: [] as { path: string; line: number }[] })) : [],
  };
}

test("검토를 준비·기록하고 문서와 기준 변경 후 오래된 결과를 구분한다", async () => {
  const { repo, work } = await fixture();
  expect((await artifactStatus(repo, work)).map(item => item.status)).toEqual(["not_run", "not_run"]);
  const input = await submission(repo, work);
  const saved = await recordArtifactReview({ repo, workId: work.record.id, review: input });
  expect((await artifactStatus(repo, saved))[0].status).toBe("current");
  expect(saved.record.criteria.every(item => item.result === "unverified")).toBe(true);
  await fs.appendFile(path.join(path.dirname(work.path), "spec.md"), "\n## 복원\n재시작 후 유지한다.\n");
  expect((await artifactStatus(repo, saved))[0].status).toBe("stale");
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: input })).rejects.toThrow("바뀌었습니다");
  const newInput = await submission(repo, saved);
  const fresh = await recordArtifactReview({ repo, workId: work.record.id, review: newInput });
  fresh.record.criteria[0].description = "종료 직전 저장 후 복원한다";
  expect((await artifactStatus(repo, fresh))[0].status).toBe("stale");
  expect(fresh.record.schemaVersion === 2 && fresh.record.workflow.artifactReviews?.length).toBe(2);
});

test("모든 기준의 작업 연결과 빈 연결을 보고하고 누락 파일 생성도 검토를 무효화한다", async () => {
  const { repo, work } = await fixture();
  const input = await submission(repo, work, "consistency");
  const saved = await recordArtifactReview({ repo, workId: work.record.id, review: input });
  const status = (await artifactStatus(repo, saved))[1];
  expect(status.status).toBe("current");
  expect(status.findings).toHaveLength(2);
  await put(repo, path.relative(repo, path.join(path.dirname(work.path), "tasks.md")), "# 구현 작업\n- AC-1 저장·복원 구현과 재시작 검사\n- AC-2 누락 폴더 안내와 오류 검사\n");
  expect((await artifactStatus(repo, saved))[1].status).toBe("stale");
  const updated = await submission(repo, saved, "consistency");
  const taskPath = path.relative(repo, path.join(path.dirname(work.path), "tasks.md"));
  updated.coverage[0].tasks.push({ path: taskPath, line: 2 });
  updated.coverage[1].tasks.push({ path: taskPath, line: 3 });
  const linked = await recordArtifactReview({ repo, workId: work.record.id, review: updated });
  expect((await artifactStatus(repo, linked))[1].findings).toEqual([]);
});

test("지적은 검토 상태와 별도로 보존하며 불완전·거짓 위치·중복 기준 제출을 거부한다", async () => {
  const { repo, work } = await fixture();
  const input = await submission(repo, work);
  input.checks[2].result = "finding";
  input.checks[2].reason = "폴더 삭제 후 오류 상태가 정의되지 않았다.";
  const saved = await recordArtifactReview({ repo, workId: work.record.id, review: input });
  expect((await artifactStatus(repo, saved))[0].findings[0]).toContain("폴더 삭제");
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: { ...input, checks: input.checks.slice(1) } })).rejects.toThrow("빠졌거나");
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: { ...input, depth: ["brief"] } })).rejects.toThrow("깊이");
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: { ...input, checks: [{ ...input.checks[0], result: ["satisfied"] }, ...input.checks.slice(1)] } })).rejects.toThrow("판단");
  const bad = structuredClone(input);
  bad.checks[0].references[0].line = 9999;
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: bad })).rejects.toThrow("실제 행");
  bad.checks[0].references[0] = { path: "../../secret", line: 1 };
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: bad })).rejects.toThrow("실제 행");
  const inconsistent = await submission(repo, work, "consistency");
  inconsistent.coverage[1].criterionId = "AC-1";
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: inconsistent })).rejects.toThrow("모든 기준");
  await expect(runTypedWorkflow({ action: "artifact-review", repo, workId: work.record.id, review: input })).rejects.toThrow("직접 요청");
  expect((await readWork({ repo, workId: work.record.id })).record.criteria[0].result).toBe("unverified");
});

test("도구 출처는 정상·낡은·외부 발견 경로와 미제공·수용 미확인을 구분한다", async () => {
  const { repo } = await fixture();
  await put(repo, "skills/www/www-spec/SKILL.md", "# 명세 정본\n");
  await fs.mkdir(path.join(repo, ".agents/skills/www-spec"), { recursive: true });
  const discovery = path.join(repo, ".agents/skills/www-spec/SKILL.md");
  await fs.symlink("../../../skills/www/www-spec/SKILL.md", discovery);
  let tool = (await developmentTools(repo, "www-spec")).items[3];
  expect(tool.discovery).toBe("matches");
  expect(tool.hostAcceptance).toBe("unconfirmed");
  await fs.unlink(discovery);
  await fs.writeFile(discovery, "# 낡은 사본\n");
  tool = (await developmentTools(repo, "www-spec")).items[3];
  expect(tool.discovery).toBe("mismatch");
  await fs.unlink(discovery);
  await fs.mkdir(discovery);
  expect((await developmentTools(repo, "www-spec")).items[3].discovery).toBe("invalid");
  await fs.rmdir(discovery);
  await fs.writeFile(discovery, "x".repeat(1_048_577));
  expect((await developmentTools(repo, "www-spec")).items[3].discovery).toBe("invalid");
  await fs.unlink(discovery);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "www-outside-"));
  directories.push(outside);
  await fs.writeFile(path.join(outside, "SKILL.md"), "외부 내용");
  await fs.symlink(path.join(outside, "SKILL.md"), discovery);
  expect((await developmentTools(repo, "www-spec")).items[3].discovery).toBe("outside");
  await expect(developmentTools(repo, "../../secret")).rejects.toThrow("올바르지");
  await fs.unlink(path.join(repo, "skills/www/www-spec/SKILL.md"));
  await fs.symlink(path.join(outside, "SKILL.md"), path.join(repo, "skills/www/www-spec/SKILL.md"));
  await expect(developmentTools(repo, "www-spec")).rejects.toThrow("심볼릭 링크");
});

test("공식 CLI는 모델 실행 없이 검토 준비·저장·상태와 출처를 제공한다", async () => {
  const { repo, work } = await fixture();
  const cli = path.resolve(import.meta.dir, "../scripts/workflow.ts");
  const call = (options: Record<string, unknown>) => JSON.parse(execFileSync(process.execPath, [cli, JSON.stringify({ repo, ...options })], { encoding: "utf8" }));
  const context = call({ action: "artifact-context", kind: "spec", workId: work.record.id });
  expect(context.documents[0].source).toContain("즐겨찾기");
  const input = await submission(repo, work);
  const result = call({ action: "artifact-review", workId: work.record.id, direct: true, review: input });
  expect(result.reviews[0].status).toBe("current");
  expect(call({ action: "artifact-status", workId: work.record.id }).reviews[0].status).toBe("current");
  expect(call({ action: "tool-inventory", skill: "www-spec" }).items[3].status).toBe("missing");
});

test("개발 호스트에 정본·출처·검토 상태를 실제 전달하고 영수증에 보존한다", async () => {
  const { repo, work } = await fixture();
  const files = ["AGENTS.md", "agents/www/AGENT.md", "docs/skills/WORKFLOW.md", "skills/www/www-design/SKILL.md", "docs/skills/profiles/desktop.md", "agents/www/review-policy.json"];
  for (const file of files) await put(repo, file, `정본 내용: ${file}\n`);
  await put(repo, ".gitignore", ".www/\n");
  execFileSync("git", ["init", "-q", repo]);
  execFileSync("git", ["-C", repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "fixture"]);
  let prompt = "";
  const result = await runDevelopmentWorkflow({ repo, role: "www-dev", direct: true, execute: true, request: "즐겨찾기 설계", eventId: "context-fixture", decision: { workId: work.record.id, intent: "design" } }, { runProcess: async invocation => {
    prompt = invocation.stdin ?? "";
    return { ok: true, code: 0, outcome: "passed", stdout: "", stderr: "", outputTruncated: false, events: [] };
  } });
  expect(result).toMatchObject({ executed: true });
  expect(prompt).toContain("hostAcceptance");
  expect(prompt).toContain("not_run");
  expect(prompt).toContain("정본 내용: docs/skills/profiles/desktop.md");
  expect(Array.isArray(result.tools) && result.tools.every(item => item.provided === true)).toBe(true);
  const receipts = await fs.readdir(path.join(repo, ".www/evidence", work.record.id));
  expect(receipts).toHaveLength(1);
  const receipt = JSON.parse(await fs.readFile(path.join(repo, ".www/evidence", work.record.id, receipts[0]), "utf8"));
  expect(receipt.tools[0].hostAcceptance).toBe("unconfirmed");
  expect(receipt.artifactReviews[0].status).toBe("not_run");
});
