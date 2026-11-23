/**
 * @verifies RESP-NATIVE-PROJECTS
 * @verifies RESP-CHAT-WORKSPACE
 */
import { verify, evaluateEvidence } from "../scripts/workflow/evidence.ts";
import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DASHBOARD_LIMITS, readDashboard, readDashboardPlan, readDashboardWork } from "../src/dashboard";
import { DashboardView, WorkDetailContent } from "../src/dashboard-view";
import type { DashboardProject, DashboardSnapshot, WorkStatus } from "../src/shared";

function record(status: WorkStatus = "in_progress", extra: Record<string, unknown> = {}) {
  return { schemaVersion: 2, id: `work-${randomUUID()}`, title: "실제 기록 <script>확인</script>",
    kind: "feature", areas: ["ui"], owner: "ui", status, blockedReason: null, relations: [],
    criteria: [{ id: "C1", description: "상태를 보존한다", required: true, result: "passed", evidence: [] },
      { id: "C2", description: "실패를 구분한다", required: true, result: "unverified", evidence: [] }], ...extra };
}

async function fixture(run: (project: DashboardProject, base: string, save: (folder: string, data: unknown) => Promise<string>) => Promise<void>) {
  const base = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "www-dashboard-")));
  const path = join(base, "workspace");
  await fs.mkdir(path);
  const project: DashboardProject = { key: "registered", name: "한글 프로젝트", path, kind: "rpa" };
  const save = async (folder: string, data: unknown) => {
    const directory = join(path, "docs", "work", "Home", folder);
    await fs.mkdir(directory, { recursive: true });
    const file = join(directory, "work.json");
    await fs.writeFile(file, JSON.stringify(data));
    return file;
  };
  try { await run(project, base, save); } finally { await fs.rm(base, { recursive: true, force: true }); }
}

test("명시한 작업의 계획 버전만 읽고 변경·부재·읽기 실패를 구분한다", async () => {
  await fixture(async (project, base, save) => {
    const work = record();
    const file = await save("001-plan", work);
    const tasks = join(dirname(file), "tasks.md");
    const content = "# 이번 계획\n- [ ] UI 확인\n";
    const sha = createHash("sha256").update(content).digest("hex");
    const read = () => readDashboardPlan(project, work.id, sha);
    expect(await read()).toMatchObject({ status: "missing", content: null });
    await fs.writeFile(tasks, content);
    expect(await read()).toMatchObject({ workId: work.id, status: "available", content, sha256: sha });
    await fs.writeFile(tasks, content + "다음 버전");
    expect(await read()).toMatchObject({ status: "changed", content: null });
    await fs.writeFile(tasks, Buffer.from([0xff]));
    expect(await read()).toMatchObject({ status: "failed", content: null });
    await fs.rm(tasks);
    const outside = join(base, "외부.md");
    await fs.writeFile(outside, content);
    await fs.symlink(outside, tasks);
    expect(await read()).toMatchObject({ status: "failed", content: null });
    await expect(readDashboardPlan(project, record().id, sha)).rejects.toThrow("계획 작업 UUID");
  });
});

test("원본 업무 상태·UUID·차단 이유와 필수 기준을 읽고 파일을 수정하지 않는다", async () => {
  await fixture(async (project, _base, save) => {
    const statuses: WorkStatus[] = ["draft", "ready", "in_progress", "verifying", "done", "cancelled"];
    const originals = await Promise.all(statuses.map(async (status, index) => {
      const value = record(status, { blockedReason: status === "in_progress" ? "외부 시스템 점검" : null });
      return { value, file: await save(String(index), value) };
    }));
    const result = await readDashboard([project]);
    expect(result.projects[0]?.coverage).toBe("complete");
    expect(result.projects[0]?.issues).toEqual([]);
    expect(Number.isNaN(Date.parse(result.capturedAt))).toBe(false);
    for (const { value, file } of originals) {
      const card = result.projects[0]!.cards.find((item) => item.id === value.id)!;
      expect(card.status).toBe(value.status);
      expect(card.blockedReason).toBe(value.blockedReason);
      expect(card.projectKey).toBe(project.key);
      expect(card.requiredCriteria).toBe(2);
      expect(card.passedCriteria).toBe(1);
      expect(card.sourcePath).toMatch(/^docs\/work\/Home\/\d\/work\.json$/);
      expect(await fs.readFile(file, "utf8")).toBe(JSON.stringify(value));
    }
  });
});

test("등록한 읽기 범위만 수집하고 같은 UUID도 프로젝트별로 격리한다", async () => {
  await fixture(async (project, base, save) => {
    const value = record();
    await save("001", value);
    const second: DashboardProject = { key: "www", name: "WWW", path: join(base, "www"), kind: "www" };
    const directory = join(second.path, "docs", "work", "Home", "001");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(join(directory, "work.json"), JSON.stringify(value));
    const ignored = join(base, "not-registered", "docs", "work");
    await fs.mkdir(ignored, { recursive: true });
    await fs.writeFile(join(ignored, "work.json"), JSON.stringify(record()));
    const result = await readDashboard([project, second]);
    expect(result.projects).toHaveLength(2);
    expect(result.projects.map((item) => item.cards[0]!.projectKey)).toEqual([project.key, second.key]);
    expect(result.projects.map((item) => item.cards[0]!.id)).toEqual([value.id, value.id]);
  });
});

test("작업 폴더 없음과 프로젝트 접근 실패·비정규 경로를 구분한다", async () => {
  await fixture(async (project, base) => {
    expect((await readDashboard([project])).projects[0]?.coverage).toBe("empty");
    const missing = { ...project, path: join(base, "missing") };
    expect((await readDashboard([missing])).projects[0]?.coverage).toBe("failed");
    const traversal = { ...project, path: `${project.path}/../workspace` };
    const invalid = (await readDashboard([traversal])).projects[0]!;
    expect(invalid.coverage).toBe("failed");
    expect(invalid.issues[0]?.code).toBe("unsafe_path");
    await fs.writeFile(join(project.path, "docs"), "디렉터리가 아님");
    expect((await readDashboard([project])).projects[0]?.coverage).toBe("failed");
  });
});

test("일부 JSON·UTF-8·스키마 실패는 정상 카드를 보존하며 부분 실패로 반환한다", async () => {
  await fixture(async (project, _base, save) => {
    const good = record();
    await save("good", good);
    const invalidJson = await save("json", record());
    await fs.writeFile(invalidJson, "{");
    const invalidUtf8 = await save("utf8", record());
    await fs.writeFile(invalidUtf8, Buffer.from([0xff, 0xfe]));
    await save("status", record("done", { status: "completed" }));
    await save("id", record("done", { id: "../work.json" }));
    const item = (await readDashboard([project])).projects[0]!;
    expect(item.coverage).toBe("partial");
    expect(item.cards.map((card) => card.id)).toEqual([good.id]);
    expect(item.issues.map((entry) => entry.code).sort()).toEqual(["invalid_json", "invalid_record", "invalid_record", "invalid_utf8"]);
  });
});

test("프로젝트·docs·작업 폴더·작업 파일의 symlink와 hardlink를 읽지 않는다", async () => {
  await fixture(async (project, base, save) => {
    const validFile = await save("valid", record());
    const external = join(base, "external");
    await fs.mkdir(external);
    await fs.writeFile(join(external, "work.json"), JSON.stringify(record()));
    await fs.symlink(external, join(project.path, "docs", "work", "outside"), "dir");
    const linkedFile = await save("symlink", record());
    await fs.unlink(linkedFile);
    await fs.symlink(join(external, "work.json"), linkedFile);
    const hardLink = await save("hardlink", record());
    await fs.unlink(hardLink);
    await fs.link(join(external, "work.json"), hardLink);
    const item = (await readDashboard([project])).projects[0]!;
    expect(item.coverage).toBe("partial");
    expect(item.cards).toHaveLength(1);
    expect(item.cards[0]!.sourcePath).toContain("/valid/");
    expect(item.issues.filter((entry) => entry.code === "unsafe_path")).toHaveLength(3);
    expect(await fs.readFile(validFile, "utf8")).toContain("실제 기록");
    const alias = join(base, "alias");
    await fs.symlink(project.path, alias, "dir");
    expect((await readDashboard([{ ...project, path: alias }])).projects[0]?.coverage).toBe("failed");
    await fs.rm(join(project.path, "docs"), { recursive: true });
    await fs.symlink(external, join(project.path, "docs"), "dir");
    expect((await readDashboard([project])).projects[0]?.issues[0]?.code).toBe("unsafe_path");
  });
});

test("단일 크기·깊이·파일수 한도를 넘으면 완전 수집이라고 표시하지 않는다", async () => {
  await fixture(async (project, _base, save) => {
    const oversized = await save("oversized", record());
    await fs.writeFile(oversized, Buffer.alloc(DASHBOARD_LIMITS.fileBytes + 1, 0x20));
    const deep = join(project.path, "docs", "work", ...Array.from({ length: DASHBOARD_LIMITS.depth + 1 }, (_, index) => `depth${index}`));
    await fs.mkdir(deep, { recursive: true });
    await fs.writeFile(join(deep, "work.json"), JSON.stringify(record()));
    const item = (await readDashboard([project])).projects[0]!;
    expect(item.coverage).toBe("failed");
    expect(item.issues.map((entry) => entry.code).sort()).toEqual(["depth_limit", "file_size_limit"]);
    await fs.rm(join(project.path, "docs"), { recursive: true });
    await Promise.all(Array.from({ length: DASHBOARD_LIMITS.files + 1 }, (_, index) => save(`file${index}`, record())));
    const limited = (await readDashboard([project])).projects[0]!;
    expect(limited.coverage).toBe("partial");
    expect(limited.cards).toHaveLength(DASHBOARD_LIMITS.files);
    expect(limited.issues.some((entry) => entry.code === "file_count_limit")).toBe(true);
  });
});

test("원장 합계가 32MiB를 넘는 프로젝트에서도 작업 계획을 찾는다", async () => {
  await fixture(async (project, _base, save) => {
    const target = record("in_progress", { history: "x".repeat(5 * 1024 * 1024) });
    const file = await save("target", target);
    const history = "x".repeat(3_750_000);
    for (let index = 0; index < 9; index++) {
      await save(`history-${index}`, record("done", { history }));
    }
    const content = "# 현재 계획\n";
    await fs.writeFile(join(dirname(file), "tasks.md"), content);
    const hash = createHash("sha256").update(content).digest("hex");
    const board = await readDashboard([project]);
    expect(board.projects[0]).toMatchObject({ coverage: "complete", issues: [] });
    expect(board.projects[0]?.cards).toHaveLength(10);
    expect(await readDashboardPlan(project, target.id, hash)).toMatchObject({
      workId: target.id, status: "available", content,
    });
  });
});

test("동일 프로젝트의 중복 UUID는 어느 경로도 임의 채택하지 않는다", async () => {
  await fixture(async (project, _base, save) => {
    const duplicate = record();
    const good = record("verifying");
    await save("original", duplicate);
    await save("duplicate", { ...duplicate, id: duplicate.id.toUpperCase() });
    await save("good", good);
    const item = (await readDashboard([project])).projects[0]!;
    expect(item.coverage).toBe("partial");
    expect(item.cards.map((card) => card.id)).toEqual([good.id]);
    expect(item.issues.filter((entry) => entry.code === "duplicate_work_id")).toHaveLength(2);
  });
});

test("전체 읽기 예산과 탐색 항목 한도는 숨은 무제한 읽기로 우회하지 않는다", async () => {
  await fixture(async (project, _base, save) => {
    const value = record();
    const size = Buffer.byteLength(JSON.stringify({ ...value, padding: "" }));
    const padding = "x".repeat(DASHBOARD_LIMITS.fileBytes - size);
    const count = DASHBOARD_LIMITS.totalBytes / DASHBOARD_LIMITS.fileBytes;
    await Promise.all(Array.from({ length: count + 1 }, (_, index) => save(`budget${index}`, { ...record(), padding })));
    const limited = (await readDashboard([project])).projects[0]!;
    expect(limited.coverage).toBe("partial");
    expect(limited.cards).toHaveLength(count);
    expect(limited.issues.some((entry) => entry.code === "total_size_limit")).toBe(true);
    await fs.rm(join(project.path, "docs"), { recursive: true });
    const work = join(project.path, "docs", "work");
    await fs.mkdir(work, { recursive: true });
    await Promise.all(Array.from({ length: DASHBOARD_LIMITS.entries + 1 }, (_, index) => fs.writeFile(join(work, `ignored${index}.ts`), "throw new Error('실행되면 안 됨')")));
    const entries = (await readDashboard([project])).projects[0]!;
    expect(entries.coverage).toBe("failed");
    expect(entries.cards).toEqual([]);
    expect(entries.issues.some((entry) => entry.code === "entry_limit")).toBe(true);
  });
});

test("데이터 없는 미수집·기록 없음·수집 실패를 서로 다르게 렌더링한다", async () => {
  const render = (snapshot: DashboardSnapshot | null) => renderToStaticMarkup(createElement(DashboardView, { snapshot, loading: false, error: null, onRefresh() {} }));
  expect(render(null)).toContain("아직 수집하지 않았습니다");
  await fixture(async (project, base) => {
    const empty = render(await readDashboard([project]));
    expect(empty).toContain("작업 기록 없음");
    expect(empty).not.toContain("전체 수량은 미확인");
    const failed = render(await readDashboard([{ ...project, path: join(base, "missing") }]));
    expect(failed).toContain("수집 실패");
    expect(failed).toContain("전체 미확인");
    expect(failed).not.toContain('aria-label="0개"');
  });
});

test("상태별 열은 실제 원본만 표시하고 악성 텍스트는 이스케이프한다", async () => {
  await fixture(async (project, _base, save) => {
    const waiting = record("in_progress", { blockedReason: "서비스 점검 중" });
    const done = record("done");
    await save("waiting", waiting);
    await save("done", done);
    const html = renderToStaticMarkup(createElement(DashboardView, {
      snapshot: await readDashboard([project]), loading: false, error: null, onRefresh() {},
      responseWorkKeys: [`${project.key}:${done.id}`],
    }));
    const column = (label: string) => html.split(`aria-label="${label} 작업"`)[1]?.split("</section>")[0] ?? "";
    expect(column("완료")).toContain("실제 기록");
    expect(column("진행 중")).toContain("서비스 점검 중");
    expect(column("응답 필요")).not.toContain("실제 기록");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});


test("상세는 원본 기준과 네 문서를 읽기 전용으로 반환한다", async () => {
  await fixture(async (project, _base, save) => {
    const value = record("verifying", { workflow: { nextAction: "검증 확인" } });
    const file = await save("detail", value);
    const folder = join(file, "..");
    const original = "# 명세\n<script>alert('원문')</script>";
    await fs.writeFile(join(folder, "spec.md"), original);
    await fs.writeFile(join(folder, "tasks.md"), Buffer.from([0xff]));
    const detail = await readDashboardWork([project], project.key, value.id);
    expect(detail.workId).toBe(value.id);
    expect(detail.title).toBe(value.title);
    expect(detail.nextAction).toBe("검증 확인");
    expect(detail.criteria[0]).toEqual({ id: "C1", description: "상태를 보존한다", required: true, result: "passed", evidenceCount: 0, applicability: { status: "unassessed", reasons: ["외부 프로젝트의 검증 입력은 조회하지 않습니다."] } });
    expect(detail.documents.map(item => item.status)).toEqual(["available", "missing", "failed", "missing"]);
    expect(detail.documents[0]?.content).toBe(original);
    expect(await fs.readFile(file, "utf8")).toBe(JSON.stringify(value));
    expect(await fs.readFile(join(folder, "spec.md"), "utf8")).toBe(original);
  });
});

test("상세는 미등록 프로젝트와 없는 UUID 및 중복 UUID를 거부한다", async () => {
  await fixture(async (project, _base, save) => {
    const value = record();
    await save("one", value);
    await expect(readDashboardWork([project], "other", value.id)).rejects.toThrow();
    await expect(readDashboardWork([project], project.key, `work-${randomUUID()}`)).rejects.toThrow();
    await save("two", value);
    await expect(readDashboardWork([project], project.key, value.id)).rejects.toThrow();
  });
});

test("목록 수집 뒤 변경된 담당·영역·경로와 기준은 같은 상세 원장을 따른다", async () => {
  await fixture(async (project, _base, save) => {
    const value = record();
    const oldFile = await save("before", value);
    const listed = (await readDashboard([project])).projects[0]!.cards[0]!;
    await fs.rename(join(oldFile, ".."), join(oldFile, "..", "..", "after"));
    const currentFile = join(oldFile, "..", "..", "after", "work.json");
    const updated = { ...value, title: "상세에서 읽은 제목", status: "done", owner: "dev", areas: ["dev", "ops"],
      criteria: [{ id: "NEW", description: "새 원장 기준", required: true, result: "passed", evidence: [] }] };
    await fs.writeFile(currentFile, JSON.stringify(updated));
    const detail = await readDashboardWork([project], listed.projectKey, listed.id);
    expect(listed.owner).toBe("ui");
    expect(listed.sourcePath).toContain("/before/");
    expect(detail.owner).toBe("dev");
    expect(detail.areas).toEqual(["dev", "ops"]);
    expect(detail.sourcePath).toContain("/after/");
    expect(detail.title).toBe(updated.title);
    expect(detail.status).toBe("done");
    expect(detail.criteria.map(item => [item.id, item.result])).toEqual([["NEW", "passed"]]);
    expect(await fs.readFile(currentFile, "utf8")).toBe(JSON.stringify(updated));
  });
});

test("다음 단계는 비계약 최상위 필드보다 workflow 정본을 따른다", async () => {
  await fixture(async (project, _base, save) => {
    const value = record("verifying", { nextAction: "complete", workflow: { nextAction: "build" } });
    await save("stages", value);
    expect((await readDashboardWork([project], project.key, value.id)).nextAction).toBe("build");
  });
});

test("상세 문서의 링크와 크기 초과는 해당 문서만 실패로 보존한다", async () => {
  await fixture(async (project, base, save) => {
    const value = record();
    const file = await save("detail", value);
    const folder = join(file, "..");
    const outside = join(base, "outside.md");
    await fs.writeFile(outside, "외부");
    await fs.symlink(outside, join(folder, "spec.md"));
    await fs.link(outside, join(folder, "design.md"));
    await fs.writeFile(join(folder, "tasks.md"), Buffer.alloc(256 * 1024 + 1, 65));
    await fs.writeFile(join(folder, "verification.md"), "검증 기록");
    const detail = await readDashboardWork([project], project.key, value.id);
    expect(detail.documents.map(item => item.status)).toEqual(["failed", "failed", "failed", "available"]);
    expect(detail.documents[3]?.content).toBe("검증 기록");
  });
});

test("빈 기준 설명은 상세와 목록 모두에서 거부한다", async () => {
  await fixture(async (project, _base, save) => {
    const value = record("draft", { criteria: [{ id: "C1", description: " ", required: true, result: "passed", evidence: [] }] });
    await save("bad", value);
    expect((await readDashboard([project])).projects[0]?.issues[0]?.code).toBe("invalid_record");
    await expect(readDashboardWork([project], project.key, value.id)).rejects.toThrow();
  });
});


test("상세 Markdown은 HTML·링크·이미지를 실행하지 않고 누락과 빈 문서를 구분한다", async () => {
  await fixture(async (project, _base, save) => {
    const value = record();
    const file = await save("detail", value);
    await fs.writeFile(join(file, "..", "spec.md"), "<script>alert(1)</script>\n\n[링크](https://example.com) ![이미지](https://example.com/x.png)\n\n**강조**");
    await fs.writeFile(join(file, "..", "design.md"), " ");
    const detail = await readDashboardWork([project], project.key, value.id);
    const html = renderToStaticMarkup(createElement(WorkDetailContent, { detail }));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<img");
    expect(html).toContain("링크");
    expect(html).toContain("<strong>강조</strong>");
    expect(html).toContain("문서가 비어 있습니다.");
    expect(html).toContain("기록된 계획이 없습니다.");
    expect(html).toContain("현재 미평가");
    expect(html).toContain("외부 프로젝트의 검증 입력은 조회하지 않습니다.");
  });
});

test("같은 실제 시도의 기준 정의 변경을 목록·상세와 공식 판정에서 동일하게 처리한다", async () => {
  await fixture(async (external, _base, save) => {
    const project: DashboardProject = { ...external, kind: "www", key: "www" };
    const value = record();
    const inputs = ["feature.txt"];
    await fs.writeFile(join(project.path, inputs[0]!), "현재 동작");
    const raw = join(project.path, "receipt.txt");
    await fs.writeFile(raw, "프로세스 시험 원문");
    const args = ["-e", "require('node:assert/strict').equal(require('node:fs').readFileSync('feature.txt','utf8'),'현재 동작')"];
    const attempt = await verify({ repo: project.path, record: value, inputs, command: "node", args, criterionIds: ["C1", "C2"], artifactPaths: ["receipt.txt"] });
    const criteria = value.criteria.map(c => c.id === "C2" ? { ...c, description: "변경된 동작" } : c);
    const changed = { ...value, criteria, workflow: { inputs, verifications: [attempt] } };
    await save("actual", changed);
    const list = await readDashboard([project]);
    const detail = await readDashboardWork([project], project.key, value.id);
    expect(list.projects[0]?.cards[0]).toMatchObject({ currentCriteria: 1, unassessedCriteria: 0 });
    for (const c of detail.criteria) {
      const official = await evaluateEvidence({ repo: project.path, record: changed, attempt, criterionId: c.id });
      expect(c.applicability?.status === "current").toBe(official.usable);
    }
    expect(detail.criteria[1]?.applicability).toEqual({ status: "stale", reasons: ["수용 기준 변경"] });
    await fs.writeFile(raw, Buffer.alloc(DASHBOARD_LIMITS.fileBytes + 1));
    expect((await readDashboardWork([project], project.key, value.id)).criteria[0]?.applicability?.status).toBe("unassessed");
    await fs.rm(raw);
    expect((await readDashboardWork([project], project.key, value.id)).criteria[0]?.applicability).toEqual({ status: "stale", reasons: ["검증 원문 누락"] });
    await fs.writeFile(raw, "프로세스 시험 원문");
    await fs.writeFile(join(project.path, inputs[0]!), "다른 동작");
    expect((await readDashboard([project])).projects[0]?.cards[0]?.currentCriteria).toBe(0);
    expect((await readDashboard([external])).projects[0]?.cards[0]?.unassessedCriteria).toBe(2);
  });
});
