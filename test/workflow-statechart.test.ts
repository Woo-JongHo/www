/** @verifies RESP-DEVELOPMENT-RECORDS-STATE */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import definition from "../docs/architecture/statecharts/development-work.json";
import { collectWorkflowStatecharts, parseWorkflowStatechart } from "../scripts/workflow/statechart.ts";

const root = resolve(import.meta.dir, "..");
const structureIds = [definition.structureId];
/** collector 입력용 정적 소스다. 이 파일에 적힌 함수·테스트를 실행하지 않는다. */
function fixture(run: (isolated: string, source: typeof definition) => void) {
  const isolated = mkdtempSync(join(tmpdir(), "www-statechart-"));
  try {
    const source = structuredClone(definition);
    const code = source.transitions.flatMap(item => item.code).concat([{ file: "scripts/workflow/statechart.ts", symbol: "parseWorkflowStatechart" }]);
    const tests = source.transitions.flatMap(item => item.tests).concat(source.counterexamples.map(item => item.test));
    for (const file of [...new Set([...code, ...tests].map(item => item.file))]) {
      mkdirSync(join(isolated, file, ".."), { recursive: true });
      const functions = [...new Set(code.filter(item => item.file === file).map(item => item.symbol))].map(name => `function ${name}() { return true; }`);
      const names = [...new Set(tests.filter(item => item.file === file).map(item => item.symbol))];
      const declarations = names.length ? ['import test from "node:test";', ...names.map(name => `test(${JSON.stringify(name)}, () => { return true; });`)] : [];
      writeFileSync(join(isolated, file), [...functions, ...declarations].join("\n"));
    }
    mkdirSync(join(isolated, "docs/architecture/statecharts"), { recursive: true });
    writeFileSync(join(isolated, "docs/architecture/statecharts/development-work.json"), JSON.stringify(source));
    run(isolated, source);
  } finally { rmSync(isolated, { recursive: true, force: true }); }
}
describe("개발 작업 상태 계약", () => {
  test("상태 정의와 실제 코드 근거를 연결한다", () => {
    const snapshot = collectWorkflowStatecharts(root, structureIds);
    expect(snapshot.models[0]?.structureId).toBe("arch.development.records.state");
    expect(snapshot.modelDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.sources.some(source => source.file === "scripts/workflow/work.ts")).toBe(true);
    expect(snapshot.checks.status).toBe("not_run");
  });
  test("F12 미정의 상태·중복 ID·고아 구조 참조·필수 근거 누락을 거부한다", () => {
    const missingState = structuredClone(definition);
    missingState.transitions[0]!.to = "work.unknown";
    expect(() => parseWorkflowStatechart(missingState, structureIds)).toThrow("미정의 상태");
    const duplicate = structuredClone(definition);
    duplicate.states.push(duplicate.states[0]!);
    expect(() => parseWorkflowStatechart(duplicate, structureIds)).toThrow("중복");
    expect(() => parseWorkflowStatechart(definition, [])).toThrow("없는 구조 ID");
    const missingCode = structuredClone(definition);
    missingCode.transitions[0]!.code = [];
    expect(() => parseWorkflowStatechart(missingCode, structureIds)).toThrow("근거 누락");
    const missingGuard = structuredClone(definition);
    missingGuard.transitions[0]!.guards = ["unknown"];
    expect(() => parseWorkflowStatechart(missingGuard, structureIds)).toThrow("근거 누락");
  });
  test("오래된 증거 완료 변형은 사건 열과 함께 거부한다", () => {
    const mutant = structuredClone(definition);
    const completion = mutant.transitions.find(item => item.to === "work.done");
    expect(completion).toBeDefined();
    if (!completion) throw new Error("정상 대조의 완료 전이가 없습니다.");
    const originalGuards = [...completion.guards];
    for (const guard of ["rule.unit-acceptance", "rule.report-current", "rule.review-current", "rule.source-stable"]) {
      completion.guards = originalGuards.filter(id => id !== guard);
      expect(() => parseWorkflowStatechart(mutant, structureIds)).toThrow("완료 전이의 현재성 조건 누락");
    }
    completion.guards = originalGuards.filter(id => id !== "rule.criteria-current");
    expect(() => parseWorkflowStatechart(mutant, structureIds)).toThrow("검증 통과 → 대상 소스 변경 → 완료 요청");
    const replay = definition.counterexamples.find(item => item.id === "counterexample.stale-completion");
    expect(replay?.events).toEqual(["검증 통과", "대상 소스 변경", "완료 요청"]);
    expect(replay?.test.file).toBe("test/workflow-work.test.ts");
    expect(readFileSync(join(root, replay?.test.file ?? "missing"), "utf8")).toContain(replay?.test.symbol ?? "missing");
  });
  test("호스트 종료의 자기 전이는 업무 완료를 뜻하지 않는다", () => {
    const model = parseWorkflowStatechart(definition, structureIds);
    const host = model.transitions.find(item => item.id === "transition.host-return");
    expect(host?.from).toBe(host?.to);
    expect(host?.to).not.toBe("work.done");
    expect(host?.guards).toContain("rule.host-only");
  });
  test("F13 소스·규칙 변경은 내용 식별을 바꾸며 이전 실행 통과를 만들지 않는다", () => {
    fixture((isolated, source) => {
      const before = collectWorkflowStatecharts(isolated, structureIds);
      writeFileSync(join(isolated, "scripts/workflow/work.ts"), readFileSync(join(isolated, "scripts/workflow/work.ts"), "utf8") + "\n// 내용 변경\n");
      const changed = collectWorkflowStatecharts(isolated, structureIds);
      expect(changed.sourceDigest).not.toBe(before.sourceDigest);
      expect(changed.checks.status).toBe("not_run");
      source.rules[0]!.description += "규칙 변경";
      writeFileSync(join(isolated, "docs/architecture/statecharts/development-work.json"), JSON.stringify(source));
      expect(collectWorkflowStatecharts(isolated, structureIds).modelDigest).not.toBe(before.modelDigest);
    });
  });
  test("코드·테스트 이름의 부분 문자열은 실제 선언으로 수용하지 않는다", () => {
    fixture((isolated, source) => {
      const completion = source.transitions.find(item => item.to === "work.done");
      if (!completion) throw new Error("완료 전이가 없습니다.");
      completion.code[0]!.symbol = "completeWor";
      writeFileSync(join(isolated, "docs/architecture/statecharts/development-work.json"), JSON.stringify(source));
      expect(() => collectWorkflowStatecharts(isolated, structureIds)).toThrow("completeWor");
      completion.code[0]!.symbol = "completeWork";
      const name = completion.tests[0]!.symbol;
      completion.tests[0]!.symbol = name.slice(0, -1);
      writeFileSync(join(isolated, "docs/architecture/statecharts/development-work.json"), JSON.stringify(source));
      expect(() => collectWorkflowStatecharts(isolated, structureIds)).toThrow(completion.tests[0]!.symbol);
    });
  });
  test("주석·문자열·타입·body 없는 선언은 구현 함수 근거가 아니다", () => {
    fixture((isolated) => {
      const file = join(isolated, "scripts/workflow/run.ts");
      for (const text of [
        "// function allocationHistory() {}",
        'const text = "function allocationHistory() {}";',
        "type allocationHistory = () => void;",
        "interface X { allocationHistory(): void; }",
        "declare function allocationHistory(): void;",
        "declare const allocationHistory: () => void;",
        "function other() { function allocationHistory() {} }",
      ]) {
        writeFileSync(file, text);
        expect(() => collectWorkflowStatecharts(isolated, structureIds)).toThrow("allocationHistory");
      }
      for (const text of ["function allocationHistory() { return true; }", "const allocationHistory = () => true;", "const allocationHistory = function () { return true; };"]) {
        writeFileSync(file, text);
        expect(collectWorkflowStatecharts(isolated, structureIds).checks.status).toBe("not_run");
      }
    });
  });
  test("정확한 활성 node·bun test/it 선언만 참조에 연결한다", () => {
    fixture((isolated, source) => {
      const ref = source.counterexamples[1]!.test;
      const file = join(isolated, ref.file);
      const name = JSON.stringify(ref.symbol);
      for (const text of [
        `import test from "node:test"; test(${name}, () => {});`,
        `import { it as check } from "node:test"; check(${name}, { skip: false, only: false }, () => {});`,
        `import { describe, it } from "bun:test"; describe("suite", () => { it(${name}, () => {}); });`,
        `import * as checks from "bun:test"; checks.test(${name}, () => {}, { timeout: 100 });`,
      ]) {
        writeFileSync(file, text);
        expect(collectWorkflowStatecharts(isolated, structureIds).checks.status).toBe("not_run");
      }
      for (const text of [
        `// test(${name}, () => {});`,
        `const text = ${JSON.stringify(`test(${name}, () => {});`)};`,
        `function test() {} test(${name}, () => {});`,
        `import type { test } from "bun:test"; test(${name}, () => {});`,
        `import { test } from "other-runner"; test(${name}, () => {});`,
        `import { test } from "bun:test"; function helper() { test(${name}, () => {}); }`,
        `import { test } from "bun:test"; if (false) test(${name}, () => {});`,
        `import { test } from "bun:test"; test.skip(${name}, () => {});`,
        `import { it } from "bun:test"; it.todo(${name}, () => {});`,
        `import { test } from "bun:test"; test.only(${name}, () => {});`,
        `import test from "node:test"; test(${name}, { skip: true }, () => {});`,
        `import test from "node:test"; test(${name}, { only: true }, () => {});`,
        `import test from "node:test"; test(${name}, { todo: true }, () => {});`,
        `import { describe, test } from "bun:test"; describe.skip("suite", () => { test(${name}, () => {}); });`,
        `import { describe, test } from "bun:test"; describe.only("suite", () => { test(${name}, () => {}); });`,
        `import { describe, test } from "bun:test"; describe("suite", (test) => { test(${name}, () => {}); });`,
        `import { describe, test } from "bun:test"; describe("suite", function test() { test(${name}, () => {}); });`,
        `import { describe, test } from "bun:test"; describe("suite", () => { const test = () => {}; test(${name}, () => {}); });`,
        `import { test } from "bun:test"; test(${name}, callback);`,
      ]) {
        writeFileSync(file, text);
        expect(() => collectWorkflowStatecharts(isolated, structureIds)).toThrow(ref.symbol);
      }
    });
  });
});
