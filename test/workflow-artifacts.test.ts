/**
 * @verifies RESP-DEVELOPMENT-ARTIFACTS
 */
import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ARTIFACT_CHECKS, artifactContext, artifactStatus, developmentTools } from "../scripts/workflow/artifacts.ts";
import { openWork, readWork, recordArtifactReview } from "../scripts/workflow/work.ts";
import { runTypedWorkflow } from "../scripts/workflow.ts";
import { runDevelopmentWorkflow, runProcess as runHostProcess } from "../scripts/workflow/run.ts";
import type { WorkLocation } from "../scripts/workflow/types.ts";

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await fs.rm(directory, { recursive: true, force: true }); });
async function put(repo: string, file: string, content: string) {
  await fs.mkdir(path.dirname(path.join(repo, file)), { recursive: true });
  await fs.writeFile(path.join(repo, file), content);
}
async function fixture() {
  const repo = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "www-artifacts-")));
  directories.push(repo);
  await put(repo, "docs/work/INDEX.md", "# 작업 목차\n");
  await put(repo, "src/item.ts", "export const value = 1;\n");
  const work = await openWork({ repo, role: "www-dev", direct: true, requestId: "fixture", request: "즐겨찾기 기능 구현", decision: { intent: "design", area: "Workflow", title: "즐겨찾기", criteria: [{ id: "AC-1", description: "재시작 후 저장을 복원한다" }, { id: "AC-2", description: "누락한 프로젝트를 안내한다" }] }, approval: { implementation: true, writePaths: ["src"], mutationSurfaces: ["edit"], verifierCommands: [], commit: false, publish: false }, inputs: ["src"] });
  return { repo, work };
}
async function submission(repo: string, work: WorkLocation, kind: "spec" | "consistency" = "spec") {
  const context = await artifactContext(repo, work, kind);
  return {
    kind, depth: "brief", digest: context.digest, summary: "실제 명세와 기준을 읽어 검토했다.",
    checks: ARTIFACT_CHECKS[kind].map(id => ({ id, result: "satisfied", reason: "명세에 정한 범위와 기준을 확인했다.", references: [{ path: context.documents[0].path, line: 1 }] })),
    coverage: kind === "consistency" ? context.criteria.map(item => ({ criterionId: item.id, tasks: [] as { path: string; line: number }[] })) : [],
  };
}

test("검토를 준비·기록하고 문서와 기준 변경 후 오래된 결과를 구분한다", async () => {
  const { repo, work } = await fixture();
  expect((await artifactStatus(repo, work)).map(item => item.status)).toEqual(["not_run", "not_run"]);
  const input = await submission(repo, work);
  const saved = await recordArtifactReview({ repo, workId: work.record.id, review: input });
  expect((await artifactStatus(repo, saved))[0].status).toBe("current");
  expect(saved.record.criteria.every(item => item.result === "unverified")).toBe(true);
  await fs.appendFile(path.join(path.dirname(work.path), "spec.md"), "\n## 복원\n재시작 후 유지한다.\n");
  expect((await artifactStatus(repo, saved))[0].status).toBe("stale");
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: input })).rejects.toThrow("바뀌었습니다");
  const newInput = await submission(repo, saved);
  const fresh = await recordArtifactReview({ repo, workId: work.record.id, review: newInput });
  fresh.record.criteria[0].description = "종료 직전 저장 후 복원한다";
  expect((await artifactStatus(repo, fresh))[0].status).toBe("stale");
  expect(fresh.record.schemaVersion === 2 && fresh.record.workflow.artifactReviews?.length).toBe(2);
});

test("모든 기준의 작업 연결과 빈 연결을 보고하고 누락 파일 생성도 검토를 무효화한다", async () => {
  const { repo, work } = await fixture();
  const input = await submission(repo, work, "consistency");
  const saved = await recordArtifactReview({ repo, workId: work.record.id, review: input });
  const status = (await artifactStatus(repo, saved))[1];
  expect(status.status).toBe("current");
  expect(status.findings).toHaveLength(2);
  await put(repo, path.relative(repo, path.join(path.dirname(work.path), "tasks.md")), "# 구현 작업\n- AC-1 저장·복원 구현과 재시작 검사\n- AC-2 누락 폴더 안내와 오류 검사\n");
  expect((await artifactStatus(repo, saved))[1].status).toBe("stale");
  const updated = await submission(repo, saved, "consistency");
  const taskPath = path.relative(repo, path.join(path.dirname(work.path), "tasks.md"));
  updated.coverage[0].tasks.push({ path: taskPath, line: 2 });
  updated.coverage[1].tasks.push({ path: taskPath, line: 3 });
  const linked = await recordArtifactReview({ repo, workId: work.record.id, review: updated });
  expect((await artifactStatus(repo, linked))[1].findings).toEqual([]);
});

test("지적은 검토 상태와 별도로 보존하며 불완전·거짓 위치·중복 기준 제출을 거부한다", async () => {
  const { repo, work } = await fixture();
  const input = await submission(repo, work);
  input.checks[2].result = "finding";
  input.checks[2].reason = "폴더 삭제 후 오류 상태가 정의되지 않았다.";
  const saved = await recordArtifactReview({ repo, workId: work.record.id, review: input });
  expect((await artifactStatus(repo, saved))[0].findings[0]).toContain("폴더 삭제");
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: { ...input, checks: input.checks.slice(1) } })).rejects.toThrow("빠졌거나");
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: { ...input, depth: ["brief"] } })).rejects.toThrow("깊이");
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: { ...input, checks: [{ ...input.checks[0], result: ["satisfied"] }, ...input.checks.slice(1)] } })).rejects.toThrow("판단");
  const bad = structuredClone(input);
  bad.checks[0].references[0].line = 9999;
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: bad })).rejects.toThrow("실제 행");
  bad.checks[0].references[0] = { path: "../../secret", line: 1 };
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: bad })).rejects.toThrow("실제 행");
  const inconsistent = await submission(repo, work, "consistency");
  inconsistent.coverage[1].criterionId = "AC-1";
  await expect(recordArtifactReview({ repo, workId: work.record.id, review: inconsistent })).rejects.toThrow("모든 기준");
  await expect(runTypedWorkflow({ action: "artifact-review", repo, workId: work.record.id, review: input })).rejects.toThrow("직접 요청");
  expect((await readWork({ repo, workId: work.record.id })).record.criteria[0].result).toBe("unverified");
});

test("도구 출처는 정상·낡은·외부 발견 경로와 미제공·수용 미확인을 구분한다", async () => {
  const { repo } = await fixture();
  await put(repo, "skills/www/www-spec/SKILL.md", "# 명세 정본\n");
  await fs.mkdir(path.join(repo, ".agents/skills/www-spec"), { recursive: true });
  const discovery = path.join(repo, ".agents/skills/www-spec/SKILL.md");
  await fs.symlink("../../../skills/www/www-spec/SKILL.md", discovery);
  let tool = (await developmentTools(repo, "www-spec")).items[3];
  expect(tool.discovery).toBe("matches");
  expect(tool.hostAcceptance).toBe("unconfirmed");
  await fs.unlink(discovery);
  await fs.writeFile(discovery, "# 낡은 사본\n");
  tool = (await developmentTools(repo, "www-spec")).items[3];
  expect(tool.discovery).toBe("mismatch");
  await fs.unlink(discovery);
  await fs.mkdir(discovery);
  expect((await developmentTools(repo, "www-spec")).items[3].discovery).toBe("invalid");
  await fs.rmdir(discovery);
  await fs.writeFile(discovery, "x".repeat(1_048_577));
  expect((await developmentTools(repo, "www-spec")).items[3].discovery).toBe("invalid");
  await fs.unlink(discovery);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "www-outside-"));
  directories.push(outside);
  await fs.writeFile(path.join(outside, "SKILL.md"), "외부 내용");
  await fs.symlink(path.join(outside, "SKILL.md"), discovery);
  expect((await developmentTools(repo, "www-spec")).items[3].discovery).toBe("outside");
  await expect(developmentTools(repo, "../../secret")).rejects.toThrow("올바르지");
  await fs.unlink(path.join(repo, "skills/www/www-spec/SKILL.md"));
  await fs.symlink(path.join(outside, "SKILL.md"), path.join(repo, "skills/www/www-spec/SKILL.md"));
  await expect(developmentTools(repo, "www-spec")).rejects.toThrow("심볼릭 링크");
});

test("공식 CLI는 모델 실행 없이 검토 준비·저장·상태와 출처를 제공한다", async () => {
  const { repo, work } = await fixture();
  const cli = path.resolve(import.meta.dir, "../scripts/workflow.ts");
  const call = (options: Record<string, unknown>) => JSON.parse(execFileSync(process.execPath, [cli, JSON.stringify({ repo, ...options })], { encoding: "utf8" }));
  const context = call({ action: "artifact-context", kind: "spec", workId: work.record.id });
  expect(context.documents[0].source).toContain("즐겨찾기");
  const input = await submission(repo, work);
  const result = call({ action: "artifact-review", workId: work.record.id, direct: true, review: input });
  expect(result.reviews[0].status).toBe("current");
  expect(call({ action: "artifact-status", workId: work.record.id }).reviews[0].status).toBe("current");
  expect(call({ action: "tool-inventory", skill: "www-spec" }).items[3].status).toBe("missing");
});

test("개발 호스트에 정본·출처·검토 상태를 실제 전달하고 영수증에 보존한다", async () => {
  const { repo, work } = await fixture();
  const files = ["AGENTS.md", "agents/www/AGENT.md", "docs/skills/WORKFLOW.md", "skills/www/www-design/SKILL.md", "docs/skills/profiles/desktop.md", "agents/www/review-policy.json", "docs/skills/MODEL_POLICY.md"];
  for (const file of files) await put(repo, file, `정본 내용: ${file}\n`);
  await put(repo, ".gitignore", ".www/\n");
  execFileSync("git", ["init", "-q", repo]);
  execFileSync("git", ["-C", repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "fixture"]);
  let prompt = "";
  const result = await runDevelopmentWorkflow({ repo, role: "www-dev", direct: true, execute: true, request: "즐겨찾기 설계", eventId: "context-fixture", decision: { workId: work.record.id, intent: "design" } }, { runProcess: async invocation => {
    prompt = invocation.stdin ?? "";
    return { ok: true, code: 0, outcome: "passed", stdout: "", stderr: "", outputTruncated: false, events: [], inputDelivered: true };
  } });
  expect(result).toMatchObject({ executed: true });
  const policySource = "정본 내용: docs/skills/MODEL_POLICY.md\n";
  const policyDigest = createHash("sha256").update(policySource).digest("hex");
  const inventoryPrefix = "개발 도구 출처와 제공 대상: ";
  const inventory = JSON.parse(prompt.split("\n").find(line => line.startsWith(inventoryPrefix))!.slice(inventoryPrefix.length));
  expect(inventory).toHaveLength(7);
  expect(inventory.find((item: { path: string }) => item.path === "docs/skills/MODEL_POLICY.md")).toMatchObject({
    path: "docs/skills/MODEL_POLICY.md", digest: policyDigest, status: "available", provided: false, hostAcceptance: "unconfirmed",
  });
  expect(prompt).toContain(`--- docs/skills/MODEL_POLICY.md ---\n${policySource}`);
  expect(prompt).toContain("not_run");
  expect(prompt).toContain("정본 내용: docs/skills/profiles/desktop.md");
  expect(Array.isArray(result.tools) && result.tools.every(item => item.provided === true)).toBe(true);
  expect(result.sources).toContainEqual({ path: "docs/skills/MODEL_POLICY.md", hash: policyDigest });
  const receipts = await fs.readdir(path.join(repo, ".www/evidence", work.record.id));
  expect(receipts).toHaveLength(1);
  const receipt = JSON.parse(await fs.readFile(path.join(repo, ".www/evidence", work.record.id, receipts[0]), "utf8"));
  expect(receipt.tools[0].hostAcceptance).toBe("unconfirmed");
  expect(receipt.tools.find((item: { path: string }) => item.path === "docs/skills/MODEL_POLICY.md")).toMatchObject({ digest: policyDigest, provided: true, hostAcceptance: "unconfirmed" });
  expect(receipt.sources).toContainEqual({ path: "docs/skills/MODEL_POLICY.md", hash: policyDigest });
  expect(receipt.artifactReviews[0].status).toBe("not_run");
});

async function deliveryFixture() {
  const current = await fixture();
  for (const file of ["AGENTS.md", "agents/www/AGENT.md", "docs/skills/WORKFLOW.md", "skills/www/www-design/SKILL.md", "docs/skills/profiles/desktop.md", "agents/www/review-policy.json", "docs/skills/MODEL_POLICY.md"]) await put(current.repo, file, `제공 정본: ${file}\n`);
  await put(current.repo, ".gitignore", ".www/\n");
  execFileSync("git", ["init", "-q", current.repo]);
  execFileSync("git", ["-C", current.repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "fixture"]);
  return { ...current, options: { repo: current.repo, role: "www-dev", direct: true, execute: true, request: "제공 사실 확인", eventId: "delivery", decision: { workId: current.work.record.id, intent: "design" } } };
}
function deliveryObject(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
async function deliveryReceipt(repo: string, receiptPath: unknown) {
  if (typeof receiptPath !== "string") throw new Error("실제 영수증 경로가 필요합니다.");
  const value: unknown = JSON.parse(await fs.readFile(path.join(repo, receiptPath), "utf8"));
  if (!deliveryObject(value) || !Array.isArray(value.tools) || !deliveryObject(value.host)) throw new Error("제공 영수증 구조가 유효하지 않습니다.");
  const tools = value.tools.map((item: unknown) => {
    if (!deliveryObject(item) || typeof item.provided !== "boolean") throw new Error("제공 영수증 도구가 유효하지 않습니다.");
    return { provided: item.provided };
  });
  return { tools, host: { inputDelivered: value.host.inputDelivered } };
}

test("환경 실패와 preview는 호스트에 제공하지 않은 문서를 제공으로 기록하지 않는다", async () => {
  const { repo, options } = await deliveryFixture();
  let calls = 0;
  const dependencies = { runProcess: async () => { calls++; return { ok: true, code: 0, outcome: "passed" }; } };
  const preview = await runDevelopmentWorkflow({ ...options, preview: true }, dependencies);
  expect(preview.executed).toBe(false);
  expect(preview.tools).toBeUndefined();
  expect(preview.receiptPath).toBeUndefined();
  expect(calls).toBe(0);
  const result = await runDevelopmentWorkflow({ ...options, environment: { toolPaths: [path.join(repo, "missing-tool")] } }, dependencies);
  expect(result.host?.outcome).toBe("environment_failed");
  expect(calls).toBe(0);
  expect(result.tools?.every(item => item.provided === false)).toBe(true);
  const receipt = await deliveryReceipt(repo, result.receiptPath);
  expect(receipt.tools.every((item: { provided: boolean }) => item.provided === false)).toBe(true);
});

test("주입 실행의 재환경 실패·spawn/stdin 오류·throw·미확인 결과는 실제 제공으로 승격하지 않는다", async () => {
  for (const outcome of ["environment_failed", "spawn_error", "stdin_error", "spool_error", "unknown", "throw"]) {
    const { repo, options } = await deliveryFixture();
    let calls = 0;
    const result = await runDevelopmentWorkflow(options, { runProcess: async invocation => {
      calls++;
      expect(invocation.stdin).toContain("제공 정본");
      if (outcome === "throw") throw new Error("실행 전 예외");
      return { ok: false, code: null, outcome, ...(outcome === "spool_error" ? { inputDelivered: true } : {}) };
    } });
    expect(calls).toBe(1);
    expect(result.executor).toBe("injected");
    expect(result.tools?.every(item => item.provided === false)).toBe(true);
    expect((await deliveryReceipt(repo, result.receiptPath)).tools.every((item: { provided: boolean }) => item.provided === false)).toBe(true);
  }
});

test("전달된 문서와 비정상 호스트 종료·의미적 수용은 별도로 보존한다", async () => {
  const { repo, options } = await deliveryFixture();
  const result = await runDevelopmentWorkflow(options, { runProcess: async invocation => {
    expect(invocation.stdin).toContain("제공 정본");
    return { ok: false, code: 3, outcome: "nonzero", inputDelivered: true };
  } });
  expect(result.host?.ok).toBe(false);
  expect(result.executor).toBe("injected");
  expect(result.tools?.every(item => item.provided === true && item.hostAcceptance === "unconfirmed")).toBe(true);
  expect((await deliveryReceipt(repo, result.receiptPath)).tools.every((item: { provided: boolean }) => item.provided === true)).toBe(true);
});

test("주입 호스트의 종료 결과만으로 정본 전달을 추정하지 않는다", async () => {
  for (const outcome of ["passed", "nonzero", "signal", "protocol_error", "host_error", "incomplete"]) {
    for (const inputDelivered of [undefined, false, true]) {
      const { repo, options } = await deliveryFixture();
      const result = await runDevelopmentWorkflow(options, { runProcess: async invocation => {
        if (inputDelivered === true) expect(invocation.stdin).toContain("제공 정본");
        return { ok: outcome === "passed", code: outcome === "passed" ? 0 : 3, outcome, ...(inputDelivered === undefined ? {} : { inputDelivered }) };
      } });
      expect(result.executor).toBe("injected");
      expect(result.tools?.every(item => item.provided === (inputDelivered === true) && item.hostAcceptance === "unconfirmed")).toBe(true);
      expect((await deliveryReceipt(repo, result.receiptPath)).tools.every(item => item.provided === (inputDelivered === true))).toBe(true);
    }
  }
});

test("실제 Node stdin 전달은 비정상 종료에도 보존하고 조기 입력 종료는 제공으로 기록하지 않는다", async () => {
  for (const earlyClose of [false, true]) {
    const { repo, options } = await deliveryFixture();
    // pipe보다 큰 본문으로 early close가 작은 버퍼의 우연한 flush로 가려지지 않게 한다.
    if (earlyClose) await put(repo, "AGENTS.md", "전달 대상\n" + "한".repeat(200_000));
    const program = earlyClose
      ? "process.stdin.destroy();process.exitCode=3;"
      : "let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'delivery-fixture'}));console.log(JSON.stringify({type:'turn.completed'}));process.exitCode=input.includes('제공 정본')?3:4;});";
    const result = await runDevelopmentWorkflow(options, { prepareInvocation: invocation => ({ ...invocation, command: "node", args: ["-e", program] }) });
    expect(result.executor).toBe("process");
    expect(result.host?.outcome).toBe("nonzero");
    expect(result.host?.code).toBe(3);
    expect(result.host?.inputDelivered).toBe(!earlyClose);
    expect(result.tools).toHaveLength(7);
    expect(result.tools?.every(item => item.provided === !earlyClose && item.hostAcceptance === "unconfirmed")).toBe(true);
    const receipt = await deliveryReceipt(repo, result.receiptPath);
    expect(receipt.host.inputDelivered).toBe(!earlyClose);
    expect(receipt.tools.every((item: { provided: boolean }) => item.provided === !earlyClose)).toBe(true);
  }
});

test("prepareInvocation이 본문을 제거했거나 명시 전달 실패이면 성공 코드로 제공을 꾸미지 않는다", async () => {
  for (const removeInput of [false, true]) {
    const { repo, options } = await deliveryFixture();
    const result = await runDevelopmentWorkflow(options, {
      prepareInvocation: invocation => removeInput ? { ...invocation, stdin: "제거됨" } : invocation,
      runProcess: async () => ({ ok: true, code: 0, outcome: "passed", ...(removeInput ? {} : { inputDelivered: false }) })
    });
    expect(result.tools).toHaveLength(7);
    expect(result.tools?.every(item => item.provided === false)).toBe(true);
    expect((await deliveryReceipt(repo, result.receiptPath)).tools.every((item: { provided: boolean }) => item.provided === false)).toBe(true);
  }
});


test("실제 runProcess 내부 환경 재검사 실패를 제공으로 기록하지 않는다", async () => {
  const { repo, options } = await deliveryFixture();
  let callbacks = 0;
  const result = await runDevelopmentWorkflow(options, { runProcess: async (invocation, context) => {
    callbacks++;
    return runHostProcess(invocation, { ...context, cwd: path.join(repo, "missing-repository") });
  } });
  expect(callbacks).toBe(1);
  expect(result.host?.outcome).toBe("environment_failed");
  expect(result.host?.environment?.ok).toBe(false);
  expect(result.tools).toHaveLength(7);
  expect(result.tools?.every(item => item.provided === false)).toBe(true);
  expect((await deliveryReceipt(repo, result.receiptPath)).tools.every(item => item.provided === false)).toBe(true);
});

test("실제 stdio의 출력 보존 실패는 입력 EOF 전달·조기 중단과 독립적으로 제공에 반영한다", async () => {
  for (const appendGuidance of [false, true]) for (const earlyClose of [false, true]) {
    const { repo, options } = await deliveryFixture();
    if (earlyClose) await put(repo, "AGENTS.md", "전달 대상\n" + "한".repeat(200_000));
    const child = earlyClose
      ? "process.stdout.write('SPOOL-FAULT\\n');process.stdin.destroy();process.exitCode=3;"
      : "process.stdin.resume();process.stdin.on('end',()=>{console.log('SPOOL-FAULT');});";
    // 실제 디스크 용량을 바꾸지 않는다. 이 격리 Node의 spool write 한 곳에만 오류를 주입한다.
    const script = `
      import fs from 'node:fs';
      import {syncBuiltinESMExports} from 'node:module';
      const original=fs.writeSync;
      let faults=0;
      fs.writeSync=function(fd,data,...args){
        if(Buffer.isBuffer(data)&&data.includes(Buffer.from('SPOOL-FAULT'))){faults++;throw Object.assign(new Error('fixture ENOSPC'),{code:'ENOSPC'});}
        return original(fd,data,...args);
      };
      syncBuiltinESMExports();
      try {
        const {runDevelopmentWorkflow}=await import(${JSON.stringify(path.resolve(import.meta.dir, "../scripts/workflow/run.ts"))});
        const result=await runDevelopmentWorkflow(${JSON.stringify(options)},{prepareInvocation:invocation=>({...invocation,stdin:invocation.stdin+${JSON.stringify(appendGuidance ? '\n\n작성 하네스 관찰 데이터\n'+JSON.stringify({fixture:true}) : '')},command:process.execPath,args:['-e',${JSON.stringify(child)}]})});
        console.log(JSON.stringify({result,faults,runtime:process.version}));
      } finally {fs.writeSync=original;syncBuiltinESMExports();}
    `;
    const raw: unknown = JSON.parse(execFileSync("node", ["--input-type=module", "-e", script], { encoding: "utf8", maxBuffer: 4_000_000 }));
    if (!deliveryObject(raw) || !deliveryObject(raw.result)) throw new Error("실제 주입 결과가 필요합니다.");
    const result = raw.result;
    if (!deliveryObject(result.host) || !Array.isArray(result.tools)) throw new Error("실제 제공 영수증 구조가 필요합니다.");
    console.info(JSON.stringify({spoolFixture:{runtime:raw.runtime,faults:raw.faults,outcome:result.host.outcome,inputDelivered:result.host.inputDelivered,earlyClose,appendGuidance}}));
    expect(typeof raw.faults === "number" && raw.faults > 0).toBe(true);
    expect(result.executor).toBe("process");
    expect(result.host.outcome).toBe("spool_error");
    expect(result.host.inputDelivered).toBe(!earlyClose);
    expect(result.tools).toHaveLength(7);
    expect(result.tools.every((item: unknown) => deliveryObject(item) && item.provided === !earlyClose && item.hostAcceptance === "unconfirmed")).toBe(true);
    const receipt = await deliveryReceipt(repo, result.receiptPath);
    expect(receipt.host.inputDelivered).toBe(!earlyClose);
    expect(receipt.tools.every(item => item.provided === !earlyClose)).toBe(true);
  }
});


test("원문 전체의 동일·append 전달만 제공이고 절단·변경·선두삽입·metadata 단독은 미제공이다", async () => {
  for(const mode of ["same","append","truncate","change-middle","prepend","metadata-only"]) {
    const {repo,options}=await deliveryFixture();
    const suffix="\n\n작성 하네스 관찰 데이터\n"+JSON.stringify({fixture:true});
    const result=await runDevelopmentWorkflow(options,{prepareInvocation:invocation=>{
      const original=invocation.stdin;if(typeof original!=="string")throw new Error("원문 stdin 필요");
      const stdin=mode==="append"?original+suffix:mode==="truncate"?original.slice(0,-32)+suffix:mode==="change-middle"?original.replace("제공 정본","변경 정본")+suffix:mode==="prepend"?"선두삽입"+original:mode==="metadata-only"?suffix:original;
      return {...invocation,stdin,command:"node",args:["-e","process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'append-fixture'}));console.log(JSON.stringify({type:'turn.completed'}));});"]};
    }});
    expect(result.executor).toBe("process");expect(result.host?.outcome).toBe("passed");expect(result.host?.inputDelivered).toBe(true);
    const expected=mode==="same"||mode==="append";
    console.info(JSON.stringify({appendOnlyCase:mode,expected,provided:result.tools?.[0]?.provided,inputDelivered:result.host?.inputDelivered}));
    expect(result.tools).toHaveLength(7);expect(result.tools?.every(item=>item.provided===expected&&item.hostAcceptance==="unconfirmed")).toBe(true);
    const receipt=await deliveryReceipt(repo,result.receiptPath);expect(receipt.host.inputDelivered).toBe(true);expect(receipt.tools.every(item=>item.provided===expected)).toBe(true);
  }
});
