/**
 * @verifies RESP-NATIVE-PROJECTS
 * @verifies RESP-CHAT-WORKSPACE
 */
import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DASHBOARD_LIMITS, readDashboard } from "../src/dashboard";
import { DashboardView } from "../src/dashboard-view";
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
