import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { boxboxMode, runTestSuite, testGroups, testSuite } from "../scripts/test.ts";

const nodeFiles = [
  "skill-library", "windows-native", "workflow-codex", "workflow-contract", "workflow-development", "workflow-environment",
  "review-app-server", "workflow-evidence", "workflow-harness", "workflow-review", "workflow-windows-command", "workflow-work",
].map(name => `${name}.test.ts`);
const entries = [...nodeFiles, "work-json.test.ts", "boxbox/work-json.test.ts", "nested/feature.test.tsx", "fixture.ts"];
const mode = (value: string) => ({ tool: "boxbox", command: "mode", scope: "project", ok: true, mode: value });

async function fixture(invoke: (root: string) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "www-test-suite-"));
  try {
    for (const entry of entries) {
      const file = path.join(root, "test", entry);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "");
    }
    await invoke(root);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test("기본 제품 선택은 외부 BoxBox만 제외하고 기존 Bun·Node 파일을 보존한다", () => {
  const groups = testGroups(entries, testSuite([]));
  expect(groups["bun:test"]).toEqual(["./test/nested/feature.test.tsx", "./test/work-json.test.ts"]);
  expect(groups["node:test"]).toHaveLength(nodeFiles.length);
  expect(groups["node:test"].map(file => file.slice("./test/".length)).sort()).toEqual([...nodeFiles].sort());
  expect([...groups["bun:test"], ...groups["node:test"]].some(file => file.includes("/boxbox/"))).toBe(false);
});

test("명시 BoxBox 선택은 외부 묶음만 포함하고 비테스트 파일을 실행하지 않는다", () => {
  expect(testGroups(entries, testSuite(["--boxbox"]))).toEqual({ "bun:test": ["./test/boxbox/work-json.test.ts"], "node:test": [] });
  expect(testGroups(["boxbox\\work-json.test.ts"], "boxbox")["bun:test"]).toEqual(["./test/boxbox/work-json.test.ts"]);
});

test("오타 인수와 중복 인수는 제품 suite로 조용히 대체하지 않는다", () => {
  for (const args of [["--unknown"], ["--boxbox", "--boxbox"], ["--boxbox", "extra"]]) expect(() => testSuite(args)).toThrow(/인수/);
});

test("필수 Node 파일 누락과 비어 있는 외부 suite를 거부한다", () => {
  expect(() => testGroups(entries.filter(file => file !== "workflow-work.test.ts"), "product")).toThrow(/workflow-work/);
  expect(() => testGroups(["boxbox/helper.ts"], "boxbox")).toThrow(/통합 테스트 파일/);
});

test("BoxBox가 설치·설정되지 않은 제품 실행도 조회 없이 원래 두 실행기를 사용한다", async () => {
  await fixture(async root => {
    const calls: { command: string; args: string[] }[] = [];
    const result = await runTestSuite({ root, readMode: async () => { throw new Error("제품 suite가 BoxBox를 조회하면 실패"); }, run: (command, args) => { calls.push({ command, args }); return { status: 0 }; }, output: () => {} });
    expect(result).toBe(0);
    expect(calls).toHaveLength(2);
    expect(calls[0].command).toBe("bun");
    expect(calls[0].args).toEqual(["test", "./test/nested/feature.test.tsx", "./test/work-json.test.ts"]);
    expect(calls[1].command).toBe(process.execPath);
    expect(calls[1].args[0]).toBe("--test");
    expect(calls[1].args.slice(1)).toHaveLength(nodeFiles.length);
  });
});

test("off는 disabled·비성공 종료이며 외부 검사 프로세스를 한 번도 시작하지 않는다", async () => {
  let launches = 0;
  const output: string[] = [];
  const result = await runTestSuite({ root: "/존재하지-않는-검사-폴더", args: ["--boxbox"], readMode: async () => mode("off"), run: () => { launches++; return { status: 0 }; }, output: message => output.push(message) });
  expect(result).toBe(2);
  expect(launches).toBe(0);
  expect(JSON.parse(output[0])).toMatchObject({ suite: "boxbox", status: "disabled", executedFiles: 0 });
});

test("허용 mode는 명시 외부 묶음만 실행하고 제품 검사를 중복 실행하지 않는다", async () => {
  await fixture(async root => {
    for (const selected of ["check", "align", "refactor"]) {
      const calls: string[][] = [];
      expect(await runTestSuite({ root, args: ["--boxbox"], readMode: async () => mode(selected), run: (_command, args) => { calls.push(args); return { status: 0 }; }, output: () => {} })).toBe(0);
      expect(calls).toEqual([["test", "./test/boxbox/work-json.test.ts"]]);
    }
  });
});

test("잘못된 mode 응답·도구 오류·설정 누락은 외부 검사 실행 전에 거부한다", async () => {
  let launches = 0;
  const run = () => { launches++; return { status: 0 }; };
  for (const value of [null, [], mode("unknown"), { ...mode("check"), tool: "other" }, { ...mode("check"), command: "align" }, { ...mode("check"), scope: "global" }, { ...mode("check"), ok: false }, { ...mode("check"), error: "failure" }]) {
    expect(() => boxboxMode(value)).toThrow();
    await expect(runTestSuite({ args: ["--boxbox"], readMode: async () => value, run })).rejects.toThrow();
  }
  await expect(runTestSuite({ args: ["--boxbox"], readMode: async () => { throw new Error("launcher error"); }, run })).rejects.toThrow("launcher error");
  await fixture(async root => { await expect(runTestSuite({ root, args: ["--boxbox"], run })).rejects.toThrow(); });
  expect(launches).toBe(0);
});

test("실행기 실패와 signal을 성공으로 바꾸거나 다음 그룹을 실행하지 않는다", async () => {
  await fixture(async root => {
    for (const failed of [{ status: 7 }, { status: null, signal: "SIGTERM" }]) {
      let calls = 0;
      expect(await runTestSuite({ root, run: () => { calls++; return failed; }, output: () => {} })).toBe(failed.status ?? 1);
      expect(calls).toBe(1);
    }
    await expect(runTestSuite({ root, run: () => ({ status: null, error: new Error("spawn failure") }), output: () => {} })).rejects.toThrow("spawn failure");
  });
});
