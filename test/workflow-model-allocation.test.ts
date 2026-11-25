/** @verifies RESP-DEVELOPMENT-EXECUTION */
import { describe, expect, test } from "bun:test";
import { validateModelAllocation } from "../scripts/workflow/model-allocation.ts";

const context = { inputs: ["src"], writes: ["src/a.ts"], authorizationWritePaths: ["src/a.ts"] };
function allocation() {
  return { taskId: "task-1", ownerModel: "gpt-6.1-sol", kind: "small_implementation", risk: "low", model: "gpt-6-luna", reason: "작은 변경", inputs: ["src"], writePaths: ["src/a.ts"], dependencies: [], attempt: 1 };
}
describe("모델 배분 검증", () => {
  test("배분을 복사하고 실행 입력을 포함한다", () => {
    const input = allocation();

    const result = validateModelAllocation(input, context);
    input.inputs.push("other");
    expect(result.inputs).toEqual(["src"]);
    expect(validateModelAllocation({ ...allocation(), inputs: ["src/a.ts"] }, context).inputs).toEqual(["src/a.ts"]);
  });
  test("위험과 작업 종류에 맞는 최소 모델을 강제한다", () => {
    expect(() => validateModelAllocation({ ...allocation(), risk: "high" }, context)).toThrow();
    expect(validateModelAllocation({ ...allocation(), risk: "medium", model: "gpt-6.1-terra" }, context).model).toBe("gpt-6.1-terra");
    expect(validateModelAllocation({ ...allocation(), risk: "high", model: "gpt-6.1-sol" }, context).model).toBe("gpt-6.1-sol");
    expect(() => validateModelAllocation({ ...allocation(), kind: "state", model: "gpt-6.1-terra" }, context)).toThrow();
    expect(() => validateModelAllocation({ ...allocation(), kind: "review" }, context)).toThrow();
    expect(() => validateModelAllocation(allocation(), { ...context, model: "gpt-6.1-sol" })).toThrow();
  });
  test("안전하지 않은 경로와 승인 밖 쓰기를 거부한다", () => {
    expect(() => validateModelAllocation({ ...allocation(), inputs: ["../src"] }, context)).toThrow();
    expect(() => validateModelAllocation({ ...allocation(), writePaths: ["src/a.ts", "src/b.ts"] }, context)).toThrow();
    expect(() => validateModelAllocation({ ...allocation(), inputs: ["other/a.ts"] }, context)).toThrow();
    expect(() => validateModelAllocation({ ...allocation(), commit: true }, context)).toThrow();
  });
  test("배분 쓰기는 승인 범위 안에서도 실제 실행 쓰기와 같은 집합이어야 한다", () => {
    const approved = ["src/a.ts", "src/b.ts"];
    expect(() => validateModelAllocation({ ...allocation(), writePaths: approved }, { ...context, authorizationWritePaths: approved })).toThrow();
    expect(() => validateModelAllocation({ ...allocation(), writePaths: [] }, context)).toThrow();
    expect(() => validateModelAllocation(allocation(), { ...context, writes: [] })).toThrow();
    expect(validateModelAllocation({ ...allocation(), writePaths: approved }, { ...context, writes: ["src/b.ts", "src/a.ts"], authorizationWritePaths: approved }).writePaths).toEqual(approved);
    expect(validateModelAllocation({ ...allocation(), writePaths: [] }, { ...context, writes: [] }).writePaths).toEqual([]);
  });
  test("재시도는 실제 실패 구분과 이전 이벤트를 요구한다", () => {
    expect(() => validateModelAllocation({ ...allocation(), attempt: 2 }, context)).toThrow();
    expect(() => validateModelAllocation({ ...allocation(), attempt: 2, previousAttempt: { eventId: "e1", reason: "실패", kind: "retry" } }, context)).toThrow();
    expect(validateModelAllocation({ ...allocation(), attempt: 2, previousAttempt: { eventId: "e1", reason: "정상 인계", kind: "handoff" } }, context).previousAttempt?.kind).toBe("handoff");
    expect(() => validateModelAllocation({ ...allocation(), attempt: 2, previousAttempt: { eventId: "e1", reason: "환경 오류", kind: "retry", failureCause: "unknown" } }, context)).toThrow();
    expect(validateModelAllocation({ ...allocation(), attempt: 2, previousAttempt: { eventId: "e1", reason: "환경 오류", kind: "retry", failureCause: "environment" } }, context).model).toBe("gpt-6-luna");
  });
});

test("아직 없는 출력의 대소문자 별칭은 실제 파일시스템 의미에 따라 소유 충돌로 거부한다", async () => {
  const { mkdtemp, mkdir, writeFile, stat, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { validateDecomposition } = await import("../scripts/workflow/decomposition.ts");
  const repo = await mkdtemp(join(tmpdir(), "www-plan-case-"));
  try {
    await mkdir(join(repo, "src"));
    await writeFile(join(repo, "src/Existing.ts"), "기존 이름의 lookup 대조");
    let insensitive = false;
    try { const [a, b] = await Promise.all([stat(join(repo, "src/Existing.ts")), stat(join(repo, "src/existing.ts"))]); insensitive = a.dev === b.dev && a.ino === b.ino; }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
    const command = process.execPath;
    const units = ["Future.ts", "future.ts"].map((file, index) => ({ taskId: `unit-${index}`, goal: "독립 출력", inputs: ["src"], writePaths: [`src/${file}`], excludedPaths: [], dependencies: [], artifacts: [`src/${file}`], criterionIds: ["AC-1"], verification: { command, args: [] }, resultPath: `src/${file}` }));
    const checked = validateDecomposition({ units }, { repo, inputs: ["src"], writePaths: ["src"], criterionIds: ["AC-1"], verifierCommands: [JSON.stringify([command])] });
    if (insensitive) await expect(checked).rejects.toThrow("소유 충돌");
    else expect((await checked).units).toHaveLength(2);
    await mkdir(join(repo, "src/자료"));
    const emptyUnits = units.map((item, index) => ({ ...item, writePaths: [`src/자료/${index === 0 ? "Future.ts" : "future.ts"}`], artifacts: [`src/자료/${index === 0 ? "Future.ts" : "future.ts"}`], resultPath: `src/자료/${index === 0 ? "Future.ts" : "future.ts"}` }));
    const emptyChecked = validateDecomposition({ units: emptyUnits }, { repo, inputs: ["src"], writePaths: ["src"], criterionIds: ["AC-1"], verifierCommands: [JSON.stringify([command])] });
    if (insensitive) await expect(emptyChecked).rejects.toThrow("소유 충돌");
    else expect((await emptyChecked).units).toHaveLength(2);
    const unicodeUnits = units.map((item, index) => ({ ...item, writePaths: [`src/${index === 0 ? "é.ts" : "e\u0301.ts"}`], artifacts: [`src/${index === 0 ? "é.ts" : "e\u0301.ts"}`], resultPath: `src/${index === 0 ? "é.ts" : "e\u0301.ts"}` }));
    await expect(validateDecomposition({ units: unicodeUnits }, { repo, inputs: ["src"], writePaths: ["src"], criterionIds: ["AC-1"], verifierCommands: [JSON.stringify([command])] })).rejects.toThrow("소유 충돌");
  } finally { await rm(repo, { recursive: true, force: true }); }
});

function ownershipPlan(files: string[]) {
  const command = process.execPath;
  return {
    units: files.map((file, index) => ({ taskId: `owner-${index}`, goal: "실제 파일 소유 구분", inputs: ["src"], writePaths: [file], excludedPaths: [], dependencies: [], artifacts: [file], criterionIds: ["AC-1"], verification: { command, args: [] }, resultPath: file }))
  };
}
async function checkOwnership(repo: string, files: string[]) {
  const { validateDecomposition } = await import("../scripts/workflow/decomposition.ts");
  return validateDecomposition(ownershipPlan(files), { repo, inputs: ["src"], writePaths: ["src"], criterionIds: ["AC-1"], verifierCommands: [JSON.stringify([process.execPath])] });
}
async function ownershipFixture() {
  const { mkdtemp, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const repo = await mkdtemp(join(process.env.WWW_DECOMPOSITION_FIXTURE_ROOT ?? tmpdir(), "www-ownership-"));
  await mkdir(join(repo, "src"));
  return repo;
}

test("디렉터리 내부 파일과 외부 파일·다른 디렉터리의 하드링크 소유 충돌을 거부한다", async () => {
  const { mkdir, writeFile, link, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const repo = await ownershipFixture();
  try {
    await mkdir(join(repo, "src/owned/nested"), { recursive: true });
    await mkdir(join(repo, "src/other"));
    await writeFile(join(repo, "src/owned/nested/file"), "같은 실제 파일");
    await link(join(repo, "src/owned/nested/file"), join(repo, "src/outside"));
    await link(join(repo, "src/owned/nested/file"), join(repo, "src/other/alias"));
    await expect(checkOwnership(repo, ["src/owned", "src/outside"])).rejects.toThrow("소유 충돌");
    await expect(checkOwnership(repo, ["src/owned", "src/other"])).rejects.toThrow("소유 충돌");
    await expect(checkOwnership(repo, ["src/outside", "src/owned"])).rejects.toThrow("소유 충돌");
    await writeFile(join(repo, "src/independent"), "독립 파일");
    expect((await checkOwnership(repo, ["src/owned", "src/independent"])).units).toHaveLength(2);
    expect((await checkOwnership(repo, ["src/owned", "src/new/sub/file"])).units).toHaveLength(2);
  } finally { await rm(repo, { recursive: true, force: true }); }
});

test("기존 디렉터리와 아직 없는 상하위 경로는 서로 다른 단위가 소유할 수 없다", async () => {
  const { mkdir, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const repo = await ownershipFixture();
  try {
    await mkdir(join(repo, "src/owned"));
    await expect(checkOwnership(repo, ["src/owned", "src/owned/new"])).rejects.toThrow("소유 충돌");
    await expect(checkOwnership(repo, ["src/owned/new", "src/owned"])).rejects.toThrow("소유 충돌");
    await expect(checkOwnership(repo, ["src/future", "src/future/nested"])).rejects.toThrow("소유 충돌");
    expect((await checkOwnership(repo, ["src/owned", "src/owned-neighbor"])).units).toHaveLength(2);
  } finally { await rm(repo, { recursive: true, force: true }); }
});

test("실제 a/A 별개 하드링크 항목을 대소문자 lookup 별칭으로 오판하지 않는다", async () => {
  const { mkdir, writeFile, link, lstat, readdir, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const repo = await ownershipFixture();
  try {
    await mkdir(join(repo, "src/case"));
    await writeFile(join(repo, "src/case/a"), "하드링크 원본");
    let separateEntries = true;
    try { await link(join(repo, "src/case/a"), join(repo, "src/case/A")); }
    catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
      separateEntries = false;
    }
    const names = await readdir(join(repo, "src/case"));
    expect(names.includes("a") && names.includes("A")).toBe(separateEntries);
    const [a, upper] = await Promise.all([lstat(join(repo, "src/case/a")), lstat(join(repo, "src/case/A"))]);
    expect(`${a.dev}:${a.ino}`).toBe(`${upper.dev}:${upper.ino}`);
    const checked = checkOwnership(repo, ["src/case/foo", "src/case/FOO"]);
    if (separateEntries) expect((await checked).units).toHaveLength(2);
    else await expect(checked).rejects.toThrow("소유 충돌");
    console.info(JSON.stringify({ ownershipCase: separateEntries ? "separate-hardlink-entries" : "lookup-alias", names, inode: `${a.dev}:${a.ino}`, fixtureRoot: process.env.WWW_DECOMPOSITION_FIXTURE_ROOT ?? "OS 임시 디렉터리" }));
  } finally { await rm(repo, { recursive: true, force: true }); }
});

test("디렉터리 내부 심볼릭 링크와 읽을 수 없는 하위 디렉터리를 생략하지 않는다", async () => {
  const { mkdir, chmod, symlink, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const repo = await ownershipFixture();
  try {
    await mkdir(join(repo, "src/owned"));
    await symlink(repo, join(repo, "src/owned/alias"));
    await expect(checkOwnership(repo, ["src/owned"])).rejects.toThrow("심볼릭 링크");
    await rm(join(repo, "src/owned/alias"));
    const locked = join(repo, "src/owned/locked");
    await mkdir(locked);
    if (process.platform === "win32") {
      const { execFileSync } = await import("node:child_process");
      const identity = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8" });
      const sid = /,\s*"(S-\d+(?:-\d+)+)"\s*$/i.exec(identity)?.[1];
      if (!sid) throw new Error("Windows 테스트 계정 SID를 확인할 수 없습니다.");
      try {
        execFileSync("icacls.exe", [locked, "/deny", `*${sid}:(RD)`]);
        await expect(checkOwnership(repo, ["src/owned"])).rejects.toThrow(/EACCES|EPERM/);
      } finally { execFileSync("icacls.exe", [locked, "/remove:d", `*${sid}`]); }
    } else {
      try {
        await chmod(locked, 0);
        await expect(checkOwnership(repo, ["src/owned"])).rejects.toThrow(/EACCES|EPERM/);
      } finally { await chmod(locked, 0o700); }
    }
    expect((await checkOwnership(repo, ["src/owned"])).units).toHaveLength(1);
  } finally { await rm(repo, { recursive: true, force: true }); }
});

test("소유 디렉터리 조사 한도를 넘으면 부분 검사로 통과시키지 않는다", async () => {
  const { mkdir, writeFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const repo = await ownershipFixture();
  try {
    await mkdir(join(repo, "src/owned"));
    for (let index = 0; index < 10_001; index++) await writeFile(join(repo, `src/owned/entry-${index}`), "");
    await expect(checkOwnership(repo, ["src/owned"])).rejects.toThrow("조사 한도");
  } finally { await rm(repo, { recursive: true, force: true }); }
}, 60_000);
