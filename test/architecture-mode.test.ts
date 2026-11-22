/** @verifies RESP-TOOLING-MAP-VALIDATION */
import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { architectureCanonicalTool, canonicalArchitectureJson, writeCanonicalArchitecture, type CanonicalTool } from "../scripts/generate-architecture.ts";

function fixture(run: (root: string, tool: CanonicalTool, mode: (report: unknown) => void, calls: () => string[]) => void) {
  const root = mkdtempSync(path.join(tmpdir(), "www-architecture-mode-"));
  const node = execFileSync("node", ["-p", "process.execPath"], { encoding: "utf8" }).trim();
  const nodeVersion = execFileSync(node, ["--version"], { encoding: "utf8" }).trim();
  const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
  try {
    for (const directory of ["src", "plugin/scripts", "runtime/dist", ".boxbox/rules"]) mkdirSync(path.join(root, directory), { recursive: true });
    const cli = path.join(root, "runtime/dist/cli.ts");
    const launcher = path.join(root, "plugin/scripts/boxbox.ts");
    const log = path.join(root, "calls.jsonl");
    const report = path.join(root, "mode.json");
    const source = `import {appendFileSync,readFileSync,writeFileSync} from 'node:fs';
const args=process.argv.slice(2); const command=args[0];
appendFileSync(${JSON.stringify(log)},JSON.stringify(args)+'\\n');
if(command==='mode') {const r=JSON.parse(readFileSync(${JSON.stringify(report)},'utf8')); if(r==='exit') process.exit(1); if(r==='invalid') console.log('{'); else console.log(JSON.stringify(r));}
else {const file=args[args.indexOf('--file')+1]; if(command==='align' && !args.includes('--dry-run')) writeFileSync(file,JSON.stringify(JSON.parse(readFileSync(file,'utf8')),null,'\\t')+'\\n');
console.log(JSON.stringify({syntax:{status:'valid'},formatReadiness:{approvalEligible:true,approvalFacts:[{key:'v1|json|object|mapping|key-colon>value',layer:'project',conventionId:'www-json-fields',proofComplete:true}]},results:[{summary:{misaligned:0,refused:0}}]}));}`;
    writeFileSync(cli, source);
    writeFileSync(launcher, source);
    writeFileSync(path.join(root, "runtime/package.json"), JSON.stringify({ type: "module", version: "fixture" }));
    const runtime = path.join(root, "plugin/runtime.json");
    writeFileSync(runtime, JSON.stringify({ node, cli }));
    const registry = Object.fromEntries(["examples.jsonl", "conventions.jsonl", "decisions.jsonl", "rules/json-scalar-fields.md"].map(file => {
      const relative = `.boxbox/${file}`;
      writeFileSync(path.join(root, relative), "fixture\n");
      return [relative, sha("fixture\n")];
    }));
    const tool = { node, launcher, cli, runtime, version: "fixture", nodeVersion, cliSha256: sha(source), registry };
    const mode = (value: unknown) => writeFileSync(report, JSON.stringify(value));
    mode({ tool: "boxbox", command: "mode", scope: "project", ok: true, mode: "off" });
    run(root, tool, mode, () => readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line)[0]));
  } finally { rmSync(root, { recursive: true, force: true }); }
}

const value = { short: 1, longer: "한글", nested: { first: true, second: [null, 2] } };

test("OFF는 실제 mode subprocess 한 번만 호출하고 align/check 없이 기존 bytes를 보존한다", () => fixture((root, tool, _mode, calls) => {
  const bytes = JSON.stringify(value, null, "\t") + "\n";
  writeFileSync(path.join(root, "src/architecture.generated.json"), bytes);
  expect(canonicalArchitectureJson(root, value, tool)).toBe(bytes);
  expect(calls()).toEqual(["mode"]);
}));

test("OFF는 결정적 새 JSON·값·순서를 유지하고 stale 및 순서 drift를 거부한다", () => fixture((root, tool, _mode, calls) => {
  const first = canonicalArchitectureJson(root, value, tool);
  expect(canonicalArchitectureJson(root, value, tool)).toBe(first);
  expect(JSON.stringify(JSON.parse(first))).toBe(JSON.stringify(value));
  writeCanonicalArchitecture(root, value, false, tool);
  writeCanonicalArchitecture(root, value, true, tool);
  expect(() => writeCanonicalArchitecture(root, { ...value, short: 2 }, true, tool)).toThrow("snapshot");
  expect(() => writeCanonicalArchitecture(root, { longer: value.longer, short: 1, nested: value.nested }, true, tool)).toThrow("snapshot");
  expect(readFileSync(path.join(root, "src/architecture.generated.json"), "utf8")).toBe(first);
  expect(calls().every(command => command === "mode")).toBe(true);
}));

for (const modeName of ["check", "align", "refactor"]) test(`${modeName}는 기존 staged canonical 왕복을 유지한다`, () => fixture((root, tool, mode, calls) => {
  mode({ tool: "boxbox", command: "mode", scope: "project", ok: true, mode: modeName });
  expect(canonicalArchitectureJson(root, value, tool)).toBe(JSON.stringify(value, null, "\t") + "\n");
  expect(calls()).toEqual(["mode", "align", "align", "align", "check"]);
}));

for (const report of ["exit", "invalid", {}, { tool: "boxbox", command: "mode", scope: "project", ok: true, mode: "off", error: "fixture failure" }, { tool: "other", command: "mode", scope: "project", ok: true, mode: "off" }, { tool: "boxbox", command: "mode", scope: "global", ok: true, mode: "off" }, { tool: "boxbox", command: "mode", scope: "project", ok: false, mode: "off" }, { tool: "boxbox", command: "mode", scope: "project", mode: "off" }, { tool: "boxbox", command: "mode", scope: "project", ok: true, mode: "unknown" }]) {
  test(`mode 오류는 OFF로 간주하지 않는다: ${JSON.stringify(report)}`, () => fixture((root, tool, mode, calls) => {
    mode(report);
    expect(() => canonicalArchitectureJson(root, value, tool)).toThrow();
    expect(calls()).toEqual(["mode"]);
  }));
}

test("OFF에서도 설정 누락·CLI/runtime/package/registry 출처 drift는 실패한다", () => fixture((root, tool) => {
  expect(() => architectureCanonicalTool(root)).toThrow();
  for (const invalid of [{ ...tool, cliSha256: "0".repeat(64) }, { ...tool, nodeVersion: "v0.0.0" }, { ...tool, version: "other" }, { ...tool, launcher: path.join(root, "missing") }, { ...tool, registry: { ...tool.registry, ".boxbox/examples.jsonl": "0".repeat(64) } }]) expect(() => canonicalArchitectureJson(root, value, invalid)).toThrow();
  writeFileSync(tool.runtime, JSON.stringify({ node: process.execPath, cli: "other" }));
  expect(() => canonicalArchitectureJson(root, value, tool)).toThrow("runtime");
}));


for (const invalid of [[0xff], [0xfe], [0xc0, 0xaf], [0xe2, 0x82]]) test(`OFF는 손실 디코딩된 snapshot bytes를 거부한다: ${invalid}`, () => fixture((root, tool, _mode, calls) => {
  const file = path.join(root, "src/architecture.generated.json");
  const bytes = Buffer.concat([Buffer.from('{"text":"'), Buffer.from(invalid), Buffer.from('"}\n')]);
  const expected = { text: Buffer.from(invalid).toString("utf8") };
  writeFileSync(file, bytes);
  expect(() => canonicalArchitectureJson(root, expected, tool)).toThrow("UTF-8");
  expect(() => writeCanonicalArchitecture(root, expected, true, tool)).toThrow("UTF-8");
  expect(() => writeCanonicalArchitecture(root, expected, false, tool)).toThrow("UTF-8");
  expect(readFileSync(file).equals(bytes)).toBe(true);
  expect(calls()).toEqual(["mode", "mode", "mode"]);
}));

test("OFF는 정상 U+FFFD의 bytes를 그대로 보존한다", () => fixture((root, tool) => {
  const expected = { text: "\uFFFD" };
  const bytes = Buffer.from(JSON.stringify(expected, null, "\t") + "\n");
  const file = path.join(root, "src/architecture.generated.json");
  writeFileSync(file, bytes);
  expect(canonicalArchitectureJson(root, expected, tool)).toBe(bytes.toString("utf8"));
  writeCanonicalArchitecture(root, expected, true, tool);
  writeCanonicalArchitecture(root, expected, false, tool);
  expect(readFileSync(file).equals(bytes)).toBe(true);
}));

for (const source of ["\uFEFF" + JSON.stringify(value), '{"broken":']) test(`OFF는 유효 UTF-8의 JSON 오류를 check에서 거부하고 write에서 재생성한다: ${source}`, () => fixture((root, tool) => {
  const file = path.join(root, "src/architecture.generated.json");
  writeFileSync(file, source);
  expect(canonicalArchitectureJson(root, value, tool)).toBe(JSON.stringify(value, null, 2) + "\n");
  expect(() => writeCanonicalArchitecture(root, value, true, tool)).toThrow("snapshot");
  expect(readFileSync(file, "utf8")).toBe(source);
  writeCanonicalArchitecture(root, value, false, tool);
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(value);
}));
