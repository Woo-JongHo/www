import { beforeAll, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { loadReviewPolicy } from "../scripts/workflow/review.ts";
import { createDevelopmentService } from "../src/development";

const exec           = promisify(execFile)                         ;
const root           = join(import.meta.dir, "..")                 ;
const distribution   = join(root, "dist")                          ;
const policyRelative = join("agents", "www", "review-policy.json") ;
const workId         = "work-44acdd6e-637b-4ef8-a3d9-f682112da634" ;

beforeAll(async () => {
  await exec("bun", ["run", "build.ts"], { cwd: root });
});

async function repository(schemaVersion = 2) {
  const repo          = await mkdtemp(join(tmpdir(), "www-development-policy-")) ;
  const workDirectory = join(repo, "docs", "work", "Chat", "001-정책 연결 검사") ;
  await mkdir(workDirectory, { recursive: true });
  await mkdir(join(repo, dirname(policyRelative)), { recursive: true });
  await mkdir(join(repo, "src"));
  await copyFile(join(root, policyRelative), join(repo, policyRelative));
  await writeFile(join(repo, "src", "item.mjs"), "export const value = 1;\n");
  await writeFile(join(repo, ".gitignore"), ".www/\n");
  const requestHash = "a".repeat(64);
  const record = {
    schemaVersion,
    id            : workId           ,
    title         : "정책 연결 검사" ,
    kind          : "maintenance"    ,
    areas         : ["dev"]          ,
    owner         : "dev"            ,
    status        : "ready"          ,
    blockedReason : null             ,
    relations     : []               ,
    criteria      : [
      {
        id          : "AC-1"                         ,
        description : "현재 증거가 있어야 완료한다." ,
        required    : true                           ,
        result      : "unverified"                   ,
        evidence    : []
      }
    ],
    ...(schemaVersion === 2 ? {
      workflow: {
        role          : "www-dev"                    ,
        requestId     : "development-policy-fixture" ,
        requestHash                                  ,
        authorization : {
          implementation   : true                  ,
          writePaths       : ["src/item.mjs"]      ,
          mutationSurfaces : ["edit"]              ,
          verifierCommands : []                    ,
          commit           : false                 ,
          publish          : false                 ,
          source           : "direct_user_request" ,
          requestHash
        },
        inputs        : ["src"]  ,
        nextAction    : "verify" ,
        verifications : []       ,
        reviews       : []       ,
      },
    } : {}),
  };
  await writeFile(join(workDirectory, "work.json"), `${JSON.stringify(record, null, 2)}\n`);
  await writeFile(join(workDirectory, "spec.md"), "# 정책 연결 검사\n");
  await exec("git", ["init", "-q"], { cwd: repo });
  await exec("git", ["config", "user.name", "정책 검사"], { cwd: repo });
  await exec("git", ["config", "user.email", "policy@example.invalid"], { cwd: repo });
  await exec("git", ["add", "."], { cwd: repo });
  await exec("git", ["commit", "-qm", "검사 기준선"], { cwd: repo });
  return repo;
}

test("빌드가 배포한 정책은 저장소 정본과 바이트·식별이 같다", async () => {
  const source   = await readFile(join(root, policyRelative)        ) ;
  const deployed = await readFile(join(distribution, policyRelative)) ;
  expect(deployed.equals(source)).toBe(true);
  const info = await loadReviewPolicy({ root: distribution });
  expect(info.hash).toBe(createHash("sha256").update(source).digest("hex"));
  const service = createDevelopmentService({ policyRoot: distribution, workspace: () => root });
  expect(await service.policy()).toEqual({ id: info.policy.id, version: info.policy.version, hash: info.hash, primaryModel: "opus", fallbackModel: "gpt-6.1-terra" });
});

test("개발 상태와 완료는 배포 정책을 사용하는 공유 판정에 연결된다", async () => {
  const repo = await repository();
  try {
    const service = createDevelopmentService({ policyRoot: distribution, workspace: () => repo }) ;
    const status  = await service.status(workId)                                                  ;
    expect(status                  ).toMatchObject({ workId, status: "ready", canComplete: false, nextAction: "verify" }) ;
    expect(status.sourceDigest     ).toMatch      (/^[a-f0-9]{64}$/                                                     ) ;
    expect(status.reasons.join(" ")).toContain    ("검증 시도 없음"                                                     ) ;
    await expect(service.complete(workId)).rejects.toThrow("현재 증거로 완료할 수 없습니다");
    expect((await service.status(workId)).status).toBe("ready");
  } finally { await rm(repo, { recursive: true, force: true }); }
});

test("선택한 저장소 정책이 앱 배포 정책과 다르면 완료 가능하지 않다", async () => {
  const repo = await repository();
  try {
    const policyFile = join      (repo, policyRelative              ) ;
    const policy     = JSON.parse(await readFile(policyFile, "utf8")) ;
    policy.version += 1;
    await writeFile(policyFile, `${JSON.stringify(policy, null, 2)}\n`);
    const service = createDevelopmentService({ policyRoot: distribution, workspace: () => repo }) ;
    const status  = await service.status(workId)                                                  ;
    expect(status.canComplete).toBe(false);
    expect(status.reasons.join(" ")).toContain("정책");
    await expect(service.complete(workId)).rejects.toThrow("현재 증거로 완료할 수 없습니다");
  } finally { await rm(repo, { recursive: true, force: true }); }
});

test("잘못된 배포 정책과 legacy 작업을 개발 완료 경로에서 거부한다", async () => {
  const repo                = await repository(1)                                  ;
  const invalidDistribution = await mkdtemp(join(tmpdir(), "www-invalid-policy-")) ;
  try {
    await mkdir(join(invalidDistribution, dirname(policyRelative)), { recursive: true });
    const policy = JSON.parse(await readFile(join(root, policyRelative), "utf8"));
    policy.primary.model = "sonnet";
    await writeFile(join(invalidDistribution, policyRelative), `${JSON.stringify(policy, null, 2)}\n`);
    const invalidService = createDevelopmentService({ policyRoot: invalidDistribution, workspace: () => repo });
    await expect(invalidService.policy()).rejects.toThrow("Opus");
    const service = createDevelopmentService({ policyRoot: distribution, workspace: () => repo });
    await expect(service.status(workId)).rejects.toThrow("schemaVersion 2");
    await expect(service.complete(workId)).rejects.toThrow("schemaVersion 2");
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(invalidDistribution, { recursive: true, force: true });
  }
});

test("개발 endpoint는 작업 ID만 수용하고 renderer가 만든 완료·정책 주장은 받지 않는다", async () => {
  const service = createDevelopmentService({ policyRoot: distribution, workspace: () => root });
  await expect(service.status({ workId, verdict: "pass", policyRoot: "/tmp" })).rejects.toThrow("UUID");
  await expect(service.complete("../../work.json")).rejects.toThrow("UUID");
});
