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
