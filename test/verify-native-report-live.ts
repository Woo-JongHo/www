import { promises as fs } from "node:fs";
import path from "node:path";
import { judgeNativeReport, type NativeReportInput } from "../src/report-judge";
import { createNativeReportHarness, type NativeReportJob } from "../src/native-reports";
import { readWorkReport } from "../scripts/workflow/reports.ts";

// 명시 실행하는 실제 모델 검사다. bun test의 자동 탐색 대상이 아니다.
const directory                   = await fs.mkdtemp(path.resolve(".www/evidence/native-report-live-")) ;
const started                     = Date.now()                                                          ;
const observed: NativeReportJob[] = []                                                                  ;
const controller                  = new AbortController()                                               ;
const harness = createNativeReportHarness({
  judge: (input) => judgeNativeReport(input, { signal: controller.signal }),
  onState: (job) => { observed.push(job); },
});
const base = { threadId: "explicit-live-verification", commands: [], files: [], truncated: false };
const cases: { expected: "skipped" | "saved"; input: NativeReportInput }[] = [
  { expected: "skipped", input: { ...base, turnId: "greeting", prompt: "고마워", answer: "도움이 되어 다행입니다." } },
  { expected: "saved", input: { ...base, turnId: "design", prompt: "작업 기록 백업 구조를 설계하고 대안과 선택 근거를 정리해줘.", answer: "설계 검토 결과: 직접 덮어쓰기와 불변 스냅샷을 비교했습니다. 직접 덮어쓰기는 단순하지만 중간 실패 때 기존 기록을 잃을 수 있습니다. 불변 스냅샷은 저장 비용이 늘지만 이전 기록을 보존합니다. 작업 UUID별 JSON 스냅샷과 원자적 rename을 선택했습니다. HTML은 JSON에서 파생하고 검증 근거는 저장 당시 소스 지문에 연결합니다. 큐는 중복 키로 재실행을 억제하고 실패는 명시 재시도합니다. 이 답변은 설계만 했으며 코드 수정·테스트·감사는 실행하지 않았습니다." } },
];

try {
  for (const scenario of cases) {
    const queued   = await harness.enqueue({ repository: directory, input: scenario.input }) ;
    const deadline = Date.now() + 100_000                                                    ;
    let result: NativeReportJob | undefined                                                  ;
    while (Date.now() < deadline) {
      result = observed.slice().reverse().find((job) => job.key === queued.key && !["queued", "judging"].includes(job.status));
      if (result) break;
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
    if (!result || result.status !== scenario.expected) throw new Error(`실제 모델 검사 실패: ${scenario.input.turnId}, ${result?.status ?? "timeout"}`);
    if (result.status === "saved") {
      if (!result.reportId) throw new Error("실제 판단의 보고서 ID가 없습니다.");
      const saved = await readWorkReport({ repo: directory, reportId: result.reportId });
      if (saved.report.kind !== "authored" || saved.report.outcome === "completed" || !saved.report.narrative) throw new Error("실제 판단의 저장 결과가 올바르지 않습니다.");
      if (!saved.report.narrative.reader?.story.trim() || !saved.report.narrative.reader.requirements.length) throw new Error("실제 모델의 작업 이야기와 요구별 결과가 저장되지 않았습니다.");
    }
  }
  const result = { executor: "actual-native-model-with-synthetic-public-inputs", elapsedMs: Date.now() - started, jobs: observed.filter((job) => ["skipped", "saved"].includes(job.status)), limitation: "두 합성 공개 답변에 실제 LLM을 실행한 표본이며 일반 판단 품질이나 실제 구현 수행을 뜻하지 않습니다." };
  await fs.writeFile(path.join(directory, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ result: "passed", evidence: path.relative(process.cwd(), directory), ...result }));
} finally {
  controller.abort();
}
