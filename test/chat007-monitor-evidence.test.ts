import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { monitorContract, monitorInputs } from "../scripts/verification/chat007-contract";
import { verifyMonitorBundle } from "../scripts/verification/chat007-inputs";
import { captureSource, evaluateEvidence, verify } from "../scripts/workflow/evidence";

test("실제 Electron 영수증에서 관찰·명령·소스 경계를 독립적으로 판정한다", async () => {
  const dir = (await readdir("docs/work/Chat")).find(name => name.startsWith("007-"));
  const record = JSON.parse(await readFile("docs/work/Chat/" + dir + "/work.json", "utf8"));
  const receipt = record.workflow.verifications.findLast((v: {monitorObservation?: {values: unknown}}) => JSON.stringify(v.monitorObservation?.values) === JSON.stringify(monitorContract.observations));
  expect(receipt?.executor).toBe("process");
  const repo = await mkdtemp(path.join(os.tmpdir(), "www-monitor-projection-"));
  try {
    await mkdir(path.join(repo, "src"));
    await mkdir(path.join(repo, "test"));
    // 원장의 실제 화면 출력과 명령을 사용하고 비교 대상 소스·실행기만 격리 fixture에 연결한다.
    const {resolveExecutionEnvironment} = await import("../scripts/workflow/evidence");
    const environment = await resolveExecutionEnvironment(repo, "bun");
    const proof = { ...receipt, command: environment.executable?.path, environment, source: await captureSource({ repo, inputs: monitorInputs, scope: "chat007-monitor" }) };
    const assess = (attempt = proof) => evaluateEvidence({ repo, record, attempt, criterionId: "AC-11" });
    expect((await assess()).usable).toBe(true);
    await writeFile(path.join(repo, "test/unrelated.test.ts"), "export {};");
    await writeFile(path.join(repo, "src/architecture.generated.json"), "{}");
    expect((await assess()).usable).toBe(true);
    for (const name of ["renderer.tsx", "www-activity.ts", "agent-overview.css"]) {
      const target = path.join(repo, "src", name);
      await writeFile(target, "");
      expect((await assess()).reasons).toContain("source_changed");
      await rm(target);
    }
    for (const file of ["test/fixtures/fake-app-server.ts", "test/package.json"]) {
      const dest = path.join(repo, file);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, "{}");
      expect((await assess()).reasons).toContain("source_changed");
    }
    expect((await assess({ ...proof, monitorObservation: undefined })).usable).toBe(false);
    expect((await assess({ ...proof, output: undefined })).usable).toBe(false);
    expect((await assess({ ...proof, args: ["other.ts"] })).usable).toBe(false);
    expect((await assess({ ...proof, result: "failed" })).usable).toBe(false);
    const unobserved = await verify({ repo, record, inputs: record.workflow.inputs, criterionIds: ["AC-11"], command: "bun", args: ["-e", "console.log(1)"] });
    expect((await assess(unobserved)).reasons).toContain("monitor_observation_mismatch");
    const mixed = await verify({ repo, record, inputs: record.workflow.inputs, criterionIds: ["AC-11", "AC-12"], command: "bun", args: ["-e", "console.log(1)"] });
    expect((await assess(mixed)).usable).toBe(false);
    expect((await evaluateEvidence({ repo, record, attempt: mixed, criterionId: "AC-12" })).usable).toBe(true);
    await mkdir(path.join(repo, "node_modules"));
    expect(() => verifyMonitorBundle(repo, { "test/unrelated.test.ts": { imports: [] } }, {})).toThrow("미등록 번들 입력");
    await writeFile(path.join(repo, "src/renderer.tsx"), "export const read = (p: string) => import(p);");
    expect(() => verifyMonitorBundle(repo, { "src/renderer.tsx": { imports: [] } }, {})).toThrow("동적 모듈");
  } finally { await rm(repo, { recursive: true, force: true }); }
});
