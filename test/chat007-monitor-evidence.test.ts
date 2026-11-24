import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { monitorContract, monitorInputs, monitorSourceInputs } from "../scripts/verification/chat007-contract";
import { verifyMonitorBundle, verifyMonitorScriptRequests } from "../scripts/verification/chat007-inputs";
import { captureSource, evaluateEvidence, verify } from "../scripts/workflow/evidence";

test("실제 Electron 영수증에서 관찰·명령·소스 경계를 독립적으로 판정한다", async () => {
  const dir = (await readdir("docs/work/Chat")).find(name => name.startsWith("007-"));
  const record = JSON.parse(await readFile("docs/work/Chat/" + dir + "/work.json", "utf8"));
  const receipt = record.workflow.verifications.findLast((v: {monitorObservation?: {version: number}}) => v.monitorObservation?.version === 2);
  const legacy = record.workflow.verifications.findLast((v: {monitorObservation?: {version: number}}) => v.monitorObservation?.version === 1);
  expect(receipt?.executor).toBe("process");
  const repo = await mkdtemp(path.join(os.tmpdir(), "www-monitor-projection-"));
  try {
    await mkdir(path.join(repo, "src"));
    await mkdir(path.join(repo, "test"));
    // 원장의 실제 화면 출력과 명령을 사용하고 비교 대상 소스·실행기만 격리 fixture에 연결한다.
    const {resolveExecutionEnvironment} = await import("../scripts/workflow/evidence");
    const environment = await resolveExecutionEnvironment(repo, "bun");
    const proof = { ...receipt, command: environment.executable?.path, environment, source: await captureSource({ repo, inputs: monitorSourceInputs(receipt.monitorObservation.scripts), scope: "chat007-monitor" }) };
    const assess = (attempt = proof) => evaluateEvidence({ repo, record, attempt, criterionId: "AC-11" });
    expect((await assess()).usable).toBe(true);
    await mkdir(path.join(repo, "scripts"));
    const older = { ...legacy, command: environment.executable?.path, environment, source: await captureSource({ repo, inputs: monitorInputs, scope: "chat007-monitor" }) };
    expect((await assess(older)).usable).toBe(true);
    for (const name of ["pr-verification.ts", "verify-chat.ts"]) {
      await writeFile(path.join(repo, "scripts", name), "export {};");
      expect((await assess()).usable).toBe(true);
      expect((await assess(older)).reasons).toContain("source_changed");
    }
    for (const request of ['export const optional = import("file:///tmp/optional.ts").catch(() => null);', 'export const optional = import("./missing.ts").catch(() => null);', 'export const read = (p: string) => import(p);', 'import "./shadow";']) {
      await writeFile(path.join(repo, "scripts/verify-native-activity.ts"), request);
      expect(() => verifyMonitorScriptRequests(repo, ["scripts/verify-native-activity.ts"])).toThrow();
    }
    await writeFile(path.join(repo, "scripts/verify-native-activity.ts"), "// 실제 실행 입력 변경");
    expect((await assess()).reasons).toContain("source_changed");
    await rm(path.join(repo, "scripts/verify-native-activity.ts"));
    const altered = structuredClone(proof);
    altered.monitorObservation.scripts.node = altered.monitorObservation.scripts.node.filter((file: string) => !file.endsWith("verify-native-activity.ts"));
    expect((await assess(altered)).reasons).toContain("monitor_observation_mismatch");
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

test("새로 import한 스크립트를 Bun 실행기와 자식 Node fixture에서 직접 관찰한다", async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), "www-monitor-loader-"));
  try {
    await mkdir(path.join(repo, "scripts/verification"), { recursive: true });
    await mkdir(path.join(repo, "test/fixtures"), { recursive: true });
    await mkdir(path.join(repo, "node_modules"));
    const loader = path.join(repo, "scripts/verification/chat007-loader.ts");
    await copyFile("scripts/verification/chat007-loader.ts", loader);
    await writeFile(path.join(repo, "scripts/new-helper.ts"), "export const result = 7;");
    await writeFile(path.join(repo, "scripts/runner.ts"), 'import { result } from "./new-helper.ts"; console.log(result);');
    await writeFile(path.join(repo, "test/fixtures/activity-app-server.ts"), 'import {execFileSync} from "node:child_process"; execFileSync(process.execPath, ["test/fixtures/fake-app-server.ts"]);');
    await writeFile(path.join(repo, "test/fixtures/fake-app-server.ts"), 'import {result} from "../../scripts/new-helper.ts"; console.log(result);');
    const trace = path.join(repo, "trace.jsonl");
    const env = { ...process.env, WWW_CHAT007_SCRIPT_TRACE: trace, WWW_CHAT007_SCRIPT_ROOT: repo, WWW_CHAT007_SCRIPT_PHASE: "build" };
    execFileSync("bun", ["run", "--preload", loader, "./scripts/runner.ts"], { cwd: repo, env });
    execFileSync("node", ["test/fixtures/activity-app-server.ts"], { cwd: repo, env: { ...env, NODE_OPTIONS: "--import=" + pathToFileURL(loader).href } });
    const rows = (await readFile(trace, "utf8")).trim().split("\n").map(row => JSON.parse(row));
    expect(rows).toContainEqual(["build", "scripts/new-helper.ts"]);
    expect(rows).toContainEqual(["fixture", "scripts/new-helper.ts"]);
  } finally { await rm(repo, { recursive: true, force: true }); }
});
