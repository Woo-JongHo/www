import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readRpaStandard } from "../src/rpa-standard";

test("RPA 표준은 승인된 지도와 같은 프로젝트의 최신 종료 기록만 표시한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "www-rpa-standard-"));
  const put = (name: string, value: unknown) => writeFile(join(root, name), JSON.stringify(value));
  try {
    expect(await readRpaStandard(root)).toBeNull();
    await put("rpa-workspace.json", { schemaVersion: 1, standardVersion: "1.0.0", projectId: "pilot", map: "rpa-map.yaml", cases: "rpa/cases.yaml" });
    const unit = { key: "u1.setup", side_effect: "read", rerun_safe: true, abort_on_fail: true };
    const map = { project: "pilot", processes: [{ id: "p1", name: "프로세스", tasks: [{ id: "t1", label: "설정", units: [unit] }] }] };
    await put("rpa-map.yaml", map);
    const initial = await readRpaStandard(root);
    expect(initial?.core.status).toBe("missing");
    expect(initial?.processes[0]?.tasks[0]?.units[0]).toEqual({ id: "p1.t1.u1.setup", effect: "read", rerun: true, abort: true });
    expect(initial?.run.state).toBe("missing");
    expect(initial?.cases).toEqual([]);
    await mkdir(join(root, "rpa"));
    const definition = { id: "pilot:unknown-save", unit: "p1.t1.u1.setup", condition: "저장 확인 누락", expected: "성공으로 표시하지 않음", handling: "반영 여부 확인", rerun: "unknown" as const };
    await put("rpa/cases.yaml", { schemaVersion: 1, cases: [definition] });
    expect((await readRpaStandard(root))?.cases).toEqual([definition]);
    await put("rpa/cases.yaml", { schemaVersion: 1, cases: [{ ...definition, id: "other:unknown-save" }] });
    expect((await readRpaStandard(root))?.cases).toBeNull();

    const older = "20261001T010100123456Z-0123abcd";
    const newer = "20261002T010100123456Z-0123abcd";
    await mkdir(join(root, "logs/runs", older), { recursive: true });
    const result = {
      schema_version: 1, seed_version: "0.2.0", run_id: older, project: "pilot",
      status: "partial", exit_code: 0, process_id: "p1", error: null, started_at: "2026-10-01T01:01:00Z", finished_at: "2026-10-01T01:01:01Z",
      units: [{ unit_id: "p1.t1.u1.setup", task_id: "p1.t1", status: "failed", elapsed_seconds: 0.4, cause: null, error: "ValueError" }],
    };
    await put(`logs/runs/${older}/result.json`, result);
    expect((await readRpaStandard(root))?.run).toMatchObject({ state: "observed", status: "partial", units: [{ status: "failed" }] });
    await put(`logs/runs/${older}/result.json`, { ...result, seed_version: "0.2.1" });
    expect((await readRpaStandard(root))?.run).toMatchObject({ state: "observed", status: "partial" });
    await mkdir(join(root, "logs/runs", newer));
    expect((await readRpaStandard(root))?.run).toEqual({ state: "unfinished", id: newer });
    await put(`logs/runs/${newer}/result.json`, { ...result, run_id: newer, started_at: "2026-10-03T01:00:00Z" });
    expect((await readRpaStandard(root))?.run).toEqual({ state: "invalid" });
    await put(`logs/runs/${newer}/result.json`, { ...result, run_id: newer, project: "other" });
    expect((await readRpaStandard(root))?.run).toEqual({ state: "invalid" });
    await rm(join(root, "rpa-map.yaml"));
    await symlink(join(root, "rpa-workspace.json"), join(root, "rpa-map.yaml"));
    await expect(readRpaStandard(root)).rejects.toThrow("심볼릭 링크");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
