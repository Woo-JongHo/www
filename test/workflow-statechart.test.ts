/** @verifies RESP-DEVELOPMENT-RECORDS-STATE */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import definition from "../docs/architecture/statecharts/development-work.json";
import { collectWorkflowStatecharts, parseWorkflowStatechart } from "../scripts/workflow/statechart.ts";

const root = resolve(import.meta.dir, "..");
const structureIds = [definition.structureId];
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
    const isolated = mkdtempSync(join(tmpdir(), "www-statechart-"));
    try {
      const source = structuredClone(definition);
      const refs = source.transitions.flatMap(item => [...item.code, ...item.tests]).concat(source.counterexamples.map(item => item.test), [{ file: "scripts/workflow/statechart.ts", symbol: "parseWorkflowStatechart" }]);
      for (const file of [...new Set(refs.map(item => item.file))]) {
        mkdirSync(join(isolated, file, ".."), { recursive: true });
        writeFileSync(join(isolated, file), refs.filter(item => item.file === file).map(item => item.symbol).join("\n"));
      }
      mkdirSync(join(isolated, "docs/architecture/statecharts"), { recursive: true });
      writeFileSync(join(isolated, "docs/architecture/statecharts/development-work.json"), JSON.stringify(source));
      const before = collectWorkflowStatecharts(isolated, structureIds);
      writeFileSync(join(isolated, "scripts/workflow/work.ts"), readFileSync(join(isolated, "scripts/workflow/work.ts"), "utf8") + "\nchanged source");
      const changed = collectWorkflowStatecharts(isolated, structureIds);
      expect(changed.sourceDigest).not.toBe(before.sourceDigest);
      expect(changed.checks.status).toBe("not_run");
      source.rules[0]!.description += "규칙 변경";
      writeFileSync(join(isolated, "docs/architecture/statecharts/development-work.json"), JSON.stringify(source));
      expect(collectWorkflowStatecharts(isolated, structureIds).modelDigest).not.toBe(before.modelDigest);
    } finally { rmSync(isolated, { recursive: true, force: true }); }
  });
});
