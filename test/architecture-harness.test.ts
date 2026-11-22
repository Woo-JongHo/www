/**
 * @verifies RESP-DEVELOPMENT-AUTHORING
 * @verifies RESP-TOOLING-MAP-VALIDATION
 */
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { architectureCanonicalTool, architectureBoxboxMode, writeArchitecture } from "../scripts/generate-architecture.ts";
import { runTypedWorkflow, type CommandResult } from "../scripts/workflow.ts";

const sourceRoot = path.resolve(import.meta.dir, "..");
const fixtureMode = architectureBoxboxMode(sourceRoot, architectureCanonicalTool(sourceRoot));

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("검사 결과 객체가 필요합니다.");
  return Object.fromEntries(Object.entries(value));
}

async function fixture(active: boolean, mutate: (repo: string) => void, inspect: (harness: Record<string, unknown>, prompt: string, result: Record<string, unknown>) => void, prepare: (repo: string) => void = () => {}, regenerate = false, denyGeneratedWrite = false) {
  const previousMode = process.env.BOXBOX_MODE;
  process.env.BOXBOX_MODE = fixtureMode;
  const repo = mkdtempSync(path.join(tmpdir(), "www-architecture-harness-"));
  const put = (file: string, body: string) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), body);
  };
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: repo });
    put(".gitignore", ".www/\nnode_modules/\n");
    put("docs/work/INDEX.md", "# 작업 목차\n");
    put("package.json", JSON.stringify({ scripts: active ? { "check:architecture": "node scripts/check-architecture.ts" } : {} }));
    put("src/item.ts", "export const item = 1;\n");
    put("tsconfig.json", JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["src/**/*.ts", "scripts/**/*.ts", "build.ts", "test/**/*.ts"] }));
    put("source-policy.json", JSON.stringify({ schemaVersion: 1, typecheckProjects: ["tsconfig.json"], legacyJavaScript: [], archivedTypeScript: [], excludedVendorPaths: ["skill-library/"] }));
    // 타입·BoxBox와 호스트만 시험 대역이다. 계약 생성·현재성 판정은 실제 원본 함수를 실행한다.
    put("node_modules/typescript/bin/tsc", "");
    put(".www/fixture/boxbox.mjs", "");
    put(".www/development.local.json", JSON.stringify({ boxboxNode: process.execPath, boxboxLauncher: path.join(repo, ".www/fixture/boxbox.mjs") }));
    for (const file of ["AGENTS.md", "agents/www/AGENT.md", "docs/skills/WORKFLOW.md", "skills/www/www-build/SKILL.md", "agents/www/review-policy.json"]) {
      put(file, readFileSync(path.join(sourceRoot, file), "utf8"));
    }
    if (active) {
      mkdirSync(path.join(repo, "scripts/workflow"), { recursive: true });
      const declaration = "/**\n * @architecture arch.feature\n * @implements FEATURE-OWNERSHIP\n */\nexport const item = 1;\n";
      for (const file of ["src/item.ts", "build.ts", "scripts/workflow.ts", "scripts/source-policy.ts", "scripts/generate-architecture.ts", "scripts/architecture-contract.ts", "scripts/check-architecture.ts"]) put(file, declaration);
      put("test/feature.test.ts", "/** @verifies FEATURE-OWNERSHIP */\nimport { test, expect } from 'bun:test';\ntest('행동', () => expect(1 + 1).toBe(2));\n");
      put("docs/architecture/structure.json", JSON.stringify({ schemaVersion: 1, rootId: "arch.www", specFiles: ["docs/specs/architecture.md"], nodes: [
        { id: "arch.www", parent: null, title: "전체", description: "전체 책임", allowedDependencies: [] },
        { id: "arch.feature", parent: "arch.www", title: "기능", description: "기능 책임", allowedDependencies: [] },
      ] }));
      put("docs/specs/architecture.md", '```architecture-requirements\n[{"id":"FEATURE-OWNERSHIP","nodeId":"arch.feature","description":"기능 책임","implementationRequired":true,"verificationRequired":true}]\n```\n');
    cpSync(path.join(path.resolve(import.meta.dir, ".."), ".boxbox"), path.join(repo, ".boxbox"), { recursive: true });
    mkdirSync(path.join(repo, ".www"), { recursive: true });
    cpSync(path.join(path.resolve(import.meta.dir, ".."), ".www/development.local.json"), path.join(repo, ".www/development.local.json"));
      writeArchitecture(repo);
    }
    prepare(repo);
    const id   = randomUUID() ;
    let prompt = ""           ;
    const result = await runTypedWorkflow({
      repo, role: "www-dev", direct: true, execute: true, eventId: id, requestId: id, request: "선언한 항목을 구현해줘",
      decision : { intent: "build", area: "Workflow", title: "계약 사후 검사", kind: "maintenance", areas: ["dev"], owner: "dev", criteria: [{ id: "AC-1", description: "계약 위반 차단", required: true }] }                                                                                                                   ,
      approval : { implementation: true, writePaths: ["src/item.ts", "docs/architecture/structure.json", "scripts/check-architecture.ts", "package.json", ...(regenerate && !denyGeneratedWrite ? ["src/architecture.generated.json"] : [])], mutationSurfaces: ["edit"], verifierCommands: [], commit: false, publish: false } ,
      inputs   : ["src"]                                                                                                                                                                                                                                                                                                        , writes: ["src/item.ts", "docs/architecture/structure.json", "scripts/check-architecture.ts", "package.json", ...(regenerate ? ["src/architecture.generated.json"] : [])],
    }, {
      runCommand: async (_command, args): Promise<CommandResult> => {
        if (args.includes("mode")) return { code: 0, stdout: JSON.stringify({ tool: "boxbox", command: "mode", scope: "project", mode: "check", ok: true }), stderr: "", outputTruncated: false };
        const file = args[args.indexOf("--file") + 1];
        const report = args.includes("guide") ? { tool: "boxbox", command: "guide", file, columnSets: [] }
          : { tool: "boxbox", syntax: { status: "valid" }, results: [{ file, summary: { groups: 0, misaligned: 0, refused: 0 } }] };
        return { code: 0, stdout: args.includes("--project") ? "" : JSON.stringify(report), stderr: "", outputTruncated: false };
      },
      runHost: async (invocation) => {
        prompt = invocation.stdin ?? "";
        mutate(repo);
        return { ok: true, code: 0, outcome: "passed", stdout: "시험 호스트", stderr: "", outputTruncated: false, events: [] };
      },
    });
    inspect(record(result.harness), prompt, result);
  } finally {
    if (previousMode === undefined) delete process.env.BOXBOX_MODE; else process.env.BOXBOX_MODE = previousMode;
    rmSync(repo, { recursive: true, force: true });
  }
}

test("승인된 생성물은 신뢰한 공식 생성기로 갱신한 뒤 사후 검사하며 대상 저장소 생성기는 실행하지 않는다", async () => {
  let root = "";
  let previous = "";
  await fixture(true, (repo) => {
    writeFileSync(path.join(repo, "src/item.ts"), readFileSync(path.join(repo, "src/item.ts"), "utf8").replace("= 1", "= 2"));
  }, (harness) => {
    expect(record(record(harness.pre).architecture).accepted                       )    .toBe(true    ) ;
    expect(record(record(harness.post).architecture).accepted                      )    .toBe(true    ) ;
    expect(record(record(harness.pre).architecture).generatorExecuted              )    .toBe(false   ) ;
    expect(record(record(harness.post).architecture).generatorExecuted             )    .toBe(true    ) ;
    expect(harness.ok                                                              )    .toBe(true    ) ;
    expect(readFileSync(path.join(root, "src/architecture.generated.json"), "utf8")).not.toBe(previous) ;
    expect(existsSync(path.join(root, "untrusted-generator-ran"))                  )    .toBe(false   ) ;
  }, (repo) => {
    root = repo;
    writeFileSync(path.join(repo, "scripts/generate-architecture.ts"), '/**\n * @architecture arch.feature\n * @implements FEATURE-OWNERSHIP\n */\nimport { writeFileSync } from "node:fs";\nwriteFileSync("untrusted-generator-ran", "executed");\nexport const item = 1;\n');
    writeArchitecture(repo);
    previous = readFileSync(path.join(repo, "src/architecture.generated.json"), "utf8");
  }, true);
}, 60_000);

test("check-only 성공은 생성기 실행 없이 기존 snapshot을 수용한다", async () => {
  let root = "";
  let previous = "";
  await fixture(true, () => {}, (harness) => {
    for (const phase of ["pre", "post"]) {
      const gate = record(record(harness[phase]).architecture);
      expect(gate.generatorExecuted).toBe(false);
      expect(gate.accepted).toBe(true);
    }
    expect(readFileSync(path.join(root, "src/architecture.generated.json"), "utf8")).toBe(previous);
  }, (repo) => {
    root = repo;
    previous = readFileSync(path.join(repo, "src/architecture.generated.json"), "utf8");
  });
}, 60_000);

test("변경 권한이 거부되면 stale 생성물을 쓰지 않고 호스트도 실행하지 않는다", async () => {
  let root = "", previous = "", calls = 0;
  await fixture(true, () => { calls++; }, (harness, prompt, result) => {
    expect(result.executed                                                         ).toBe(false             ) ;
    expect(record(result.mutation).reason                                          ).toBe("outside_approval") ;
    expect(calls                                                                   ).toBe(0                 ) ;
    expect(prompt                                                                  ).toBe(""                ) ;
    expect(record(record(harness.post).architecture).generatorExecuted             ).toBe(false             ) ;
    expect(record(record(harness.post).architecture).accepted                      ).toBe(false             ) ;
    expect(readFileSync(path.join(root, "src/architecture.generated.json"), "utf8")).toBe(previous          ) ;
  }, repo => {
    root = repo;
    previous = readFileSync(path.join(repo, "src/architecture.generated.json"), "utf8");
    writeFileSync(path.join(repo, "src/item.ts"), readFileSync(path.join(repo, "src/item.ts"), "utf8").replace("= 1", "= 2"));
  }, true, true);
}, 60_000);

test("재생성 요청 후 child 실패는 생성기 실행 여부를 미확인으로 남긴다", async () => {
  await fixture(true, (repo) => {
    writeFileSync(path.join(repo, "src/item.ts"), "export const missing = 2;\n");
  }, (harness) => {
    const post = record(record(harness.post).architecture);
    expect(post.generatorExecuted).toBeNull();
    expect(post.ok      )    .toBe   (false) ;
    expect(post.accepted)    .toBe   (false) ;
    expect(post.errors  ).not.toEqual([]   ) ;
  }, () => {}, true);
}, 60_000);

for (const scenario of ["contract", "stale", "manifest", "all-signals"]) {
  test(`실제 typed 사후 경로가 ${scenario} 위반을 거부한다`, async () => {
    await fixture(true, (repo) => {
      if (scenario === "contract") writeFileSync(path.join(repo, "src/item.ts"), "export const missing = 2;\n");
      if (scenario === "stale") writeFileSync(path.join(repo, "src/item.ts"), readFileSync(path.join(repo, "src/item.ts"), "utf8").replace("= 1", "= 2"));
      if (["manifest", "all-signals"].includes(scenario)) rmSync(path.join(repo, "docs/architecture/structure.json"));
      if (scenario === "all-signals") {
        rmSync(path.join(repo, "scripts/check-architecture.ts"));
        writeFileSync(path.join(repo, "package.json"), '{"scripts":{}}');
      }
    }, (harness, prompt) => {
      expect(harness.ok).toBe(false);
      const pre  = record(record(harness.pre).architecture ) ;
      const post = record(record(harness.post).architecture) ;
      expect(pre.accepted               ).toBe     (true                                                                                 ) ;
      expect(post.enabled               ).toBe     (true                                                                                 ) ;
      expect(post.generatorExecuted     ).toBe     (false                                                                                ) ;
      expect(post.accepted              ).toBe     (false                                                                                ) ;
      expect(JSON.stringify(post.errors)).toMatch  (scenario === "contract" ? /구조 선언/ : scenario === "stale" ? /snapshot/ : /ENOENT/ ) ;
      expect(prompt                     ).toContain('"architecture":{"enabled":true'                                                     ) ;
      if (scenario === "all-signals") expect(post.signals).toEqual([]);
    });
  }, 60_000);
}

test("계약이 없는 최소 fixture는 명시 비적용이며 시험 대역 성공으로 표시한다", async () => {
  await fixture(false, () => {}, (harness) => {
    expect(harness.ok).toBe(true);
    expect(harness.executor).toBe("injected");
    const gate = record(record(harness.post).architecture);
    expect(gate.applicable       ).toBe(false) ;
    expect(gate.generatorExecuted).toBe(false) ;
    expect(gate.accepted         ).toBe(false) ;
  });
}, 60_000);

for (const fault of ["contract", "stale"]) {
  test(`사전 ${fault} 오류가 작성 context에 전달되고 실제 수정 후 수용된다`, async () => {
    let original = "";
    await fixture(true, (repo) => {
      writeFileSync(path.join(repo, "src/item.ts"), original);
    }, (harness, prompt) => {
      const pre  = record(record(harness.pre).architecture ) ;
      const post = record(record(harness.post).architecture) ;
      expect(pre.ok                ).toBe     (false                                           ) ;
      expect(prompt                ).toContain(fault === "contract" ? "구조 선언" : "snapshot" ) ;
      expect(post.generatorExecuted).toBe     (false                                           ) ;
      expect(post.accepted         ).toBe     (true                                            ) ;
      expect(harness.ok            ).toBe     (true                                            ) ;
      expect(harness.toolExecutor  ).toBe     ("injected"                                      ) ;
    }, (repo) => {
      original = readFileSync(path.join(repo, "src/item.ts"), "utf8");
      writeFileSync(path.join(repo, "src/item.ts"), fault === "contract" ? "export const item = 2;\n" : original.replace("= 1", "= 2"));
    });
  }, 60_000);
}

for (const signal of ["checker", "package"]) {
  test(`${signal} 신호 하나만 남아도 계약 누락은 비적용으로 바뀌지 않는다`, async () => {
    await fixture(true, () => {}, (harness, prompt) => {
      const pre  = record(record(harness.pre).architecture ) ;
      const post = record(record(harness.post).architecture) ;
      expect(pre.enabled    ).toBe     (true    ) ;
      expect(pre.ok         ).toBe     (false   ) ;
      expect(post.applicable).toBe     (true    ) ;
      expect(post.ok        ).toBe     (false   ) ;
      expect(harness.ok     ).toBe     (false   ) ;
      expect(prompt         ).toContain("ENOENT") ;
    }, (repo) => {
      rmSync(path.join(repo, "docs/architecture/structure.json"));
      if (signal === "checker") writeFileSync(path.join(repo, "package.json"), '{"scripts":{}}');
      else rmSync(path.join(repo, "scripts/check-architecture.ts"));
    });
  }, 60_000);
}

for (const runtime of ["node", "bun"]) {
  test(`${runtime}: 같은 process가 보유한 generator보다 현재 설치 코드로 사후 검사한다`, () => {
    const installation = mkdtempSync(path.join(tmpdir(), "www-fresh-architecture-"));
    try {
      for (const directory of ["scripts", "src"]) cpSync(path.join(sourceRoot, directory), path.join(installation, directory), { recursive: true });
      symlinkSync(path.join(sourceRoot, "node_modules"), path.join(installation, "node_modules"), "dir");
      const workflow  = pathToFileURL(path.join(installation, "scripts/workflow.ts")).href              ;
      const generator = pathToFileURL(path.join(installation, "scripts/generate-architecture.ts")).href ;
      const script = `
        import assert from 'node:assert/strict';
        import { execFileSync } from 'node:child_process';
        import { randomUUID } from 'node:crypto';
        import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
        import { tmpdir } from 'node:os';
        import path from 'node:path';
        const sourceRoot = ${JSON.stringify(sourceRoot)};
        const fixtureMode = ${JSON.stringify(fixtureMode)};
        const { runTypedWorkflow } = await import(${JSON.stringify(workflow)});
        const { writeArchitecture } = await import(${JSON.stringify(generator)});
        ${record.toString()}
        ${fixture.toString().replaceAll('import.meta.dir', 'sourceRoot + "/test"')}
        await fixture(true, (repo) => {
          const file = ${JSON.stringify(path.join(installation, "scripts/generate-architecture.ts"))};
          const before = readFileSync(file, 'utf8');
          const after = before.replace('scope: "src와', 'scope: "phase6 src와');
          assert.notEqual(before, after);
          writeFileSync(file, after);
          execFileSync(process.execPath, ['--input-type=module', '--eval',
            'const {writeArchitecture} = await import(process.argv[1]); writeArchitecture(process.argv[2]);',
            ${JSON.stringify(generator)}, repo]);
          assert.throws(() => writeArchitecture(repo, true), /snapshot/);
        }, (harness) => {
          assert.equal(record(record(harness.pre).architecture).accepted, true);
          assert.equal(record(record(harness.post).architecture).accepted, true);
          assert.equal(harness.ok, true);
          console.log('cached=stale fresh=accepted');
        });
      `;
      const output = execFileSync(runtime, ["--input-type=module", "--eval", script], { encoding: "utf8", timeout: 120_000, maxBuffer: 1_048_576 });
      expect(output).toContain("cached=stale fresh=accepted");
    } finally { rmSync(installation, { recursive: true, force: true }); }
  }, 120_000);
}
