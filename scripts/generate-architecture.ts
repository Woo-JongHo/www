/**
 * @architecture arch.tooling.map-generation
 * @implements RESP-TOOLING-MAP-GENERATION
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { architecturePath, checkArchitectureContract, managedArchitectureSources } from "./architecture-contract.ts";

export const layers = [
  { id : "presentation" , title : "화면과 상호작용"   , description : "React 화면 · 입력 · 읽기 상태"       , color : "#91baff" },
  { id : "model"        , title : "상태와 투영"       , description : "사건 해석 · 순수 모델 · 탐색"        , color : "#83c9bc" },
  { id : "contract"     , title : "브리지와 계약"     , description : "preload · IPC 허용 목록 · 공용 타입" , color : "#dac391" },
  { id : "host"         , title : "Electron과 Native" , description : "프로세스 · JSON-RPC · 저장 서비스"   , color : "#baa6e0" },
  { id : "workflow"     , title : "개발과 기록"       , description : "권한 · 실행 · 증거 · 검토 · 보고서"  , color : "#a6b4c4" },
  { id : "tooling"      , title : "빌드와 소스 정책"  , description : "번들 · 분석 생성 · 작성 하네스"      , color : "#c8ab99" },
];

const roles: Record<string, string> = {
  "architecture-contract": "구조 ID·요구 선언과 허용 의존 계약 검사", "check-architecture": "구조 계약과 생성 snapshot 현재성 검사",
  "renderer": "화면 전환과 대화 상태 통합", "main": "앱·Native 수명주기와 IPC 처리", "preload": "제한된 WwwApi 노출", "shared": "프로세스 간 공용 타입 계약",
  "projection": "공개 사건을 읽을 수 있는 블록으로 투영", "rpc": "JSONL 요청·응답과 EOF 처리", "conversations": "Native 대화 목록·이력 복원", "development": "개발 상태와 완료 서비스",
  "ecosystem-view": "코드 설계도와 생태계 안내 탐색", "architecture": "계층·모듈 탐색과 결정적 배치", "architecture-tree": "책임 계층·검색·의존 집계", "ecosystem": "수동 생태계 안내와 후속 방향",
  "native-reports": "자동 보고서 큐와 수명주기", "report-judge": "별도 읽기 전용 Native 보고서 판단", "reports-service": "작업 보고서의 안전한 목록·읽기",
};

function layerFor(file: string): string {
  if (file === "scripts/workflow.ts" || file === "scripts/source-policy.ts" || file === "build.ts" || file === "scripts/generate-architecture.ts" || file === "scripts/architecture-contract.ts" || file === "scripts/check-architecture.ts") return "tooling";
  if (file.startsWith("scripts/workflow/")) return "workflow";
  const name = path.basename(file, path.extname(file));
  if (["shared", "preload"].includes(name)                                                                                                               ) return "contract";
  if (file.endsWith(".tsx") || name === "input"                                                                                                          ) return "presentation";
  if (["projection", "chat-state", "activity-sidebar", "architecture", "architecture-tree", "ecosystem", "native-activity", "native-chat"].includes(name)) return "model";
  return "host";
}

/** import 분석만 필요한 parser fixture용. 제품 생성은 generateArchitecture를 사용한다. */
export function extractArchitectureImports(root: string, inputFiles: string[]) {
  const files                       = [...new Set(inputFiles)].sort()                                                                                                                ;
  const options: ts.CompilerOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowImportingTsExtensions: true, resolveJsonModule: true } ;
  const texts                       = new Map(files.map((file) => [file, readFileSync(architecturePath(root, file), "utf8")]))                                                       ;
  const nodes = files.map((file) => {
    const text = texts.get     (file                    )! ;
    const name = path .basename(file, path.extname(file))  ;
    return { id: file, file, title: name, layer: layerFor(file), role: roles[name] ?? (file.startsWith("scripts/workflow/") ? `개발 절차 모듈 · ${name}` : `앱 모듈 · ${name}`), line: 1, lines: text.split("\n").length, digest: createHash("sha256").update(text).digest("hex") };
  });
  const edges       : { id: string; from: string; to: string; mode: string; syntax: string; specifier: string; line: number; endLine: number; statement: string }[] = [] ;
  const excluded    : { file: string; line: number; specifier: string; reason: string }[]                                                                           = [] ;
  const diagnostics : string[]                                                                                                                                      = [] ;
  for (const file of files) {
    const source = ts.createSourceFile(file, texts.get(file)!, ts.ScriptTarget.Latest, true);
    function record(node: ts.Node, specifier: string, mode: string, syntax: string) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (!specifier.startsWith(".")) { excluded.push({ file, line, specifier, reason: "external" }); return; }
      if (path.resolve(root, path.dirname(file), specifier) === path.join(root, "src/architecture.generated.json")) {
        excluded.push({ file, line, specifier, reason: "generated-data" });
        return;
      }
      const resolved = ts.resolveModuleName(specifier, path.join(root, file), options, ts.sys).resolvedModule;
      if (!resolved) { diagnostics.push(`${file}:${line}: 해석하지 못한 로컬 참조 ${specifier}`); return; }
      const target = path.relative(root, resolved.resolvedFileName).split(path.sep).join("/");
      if (!texts.has(target)) { excluded.push({ file, line, specifier, reason: target.endsWith(".json") ? "generated-data" : "outside-scope" }); return; }
      edges.push({ id: `${file}:${node.getStart(source)}`, from: file, to: target, mode, syntax, specifier, line, endLine: source.getLineAndCharacterOfPosition(node.end).line + 1, statement: node.getText(source) });
    }
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause    = node.importClause                                                                     ;
        const bindings  = clause?.namedBindings                                                                 ;
        const named     = bindings && ts.isNamedImports(bindings) ? bindings.elements : []                      ;
        const types     = named.filter((entry) => entry.isTypeOnly).length                                      ;
        const onlyTypes = !!clause?.isTypeOnly || (!clause?.name && named.length > 0 && types === named.length) ;
        record(node, node.moduleSpecifier.text, onlyTypes ? "type" : types ? "mixed" : "runtime", "import");
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const named = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : [] ;
        const types = named.filter((entry) => entry.isTypeOnly).length                                            ;
        record(node, node.moduleSpecifier.text, node.isTypeOnly || (named.length > 0 && types === named.length) ? "type" : types ? "mixed" : "runtime", "export");
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
        record(node, node.moduleReference.expression.text, node.isTypeOnly ? "type" : "runtime", "import-equals");
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        record(node, node.argument.literal.text, "type", "import-type");
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) record(node, argument.text, "runtime", node.expression.kind === ts.SyntaxKind.ImportKeyword ? "dynamic-import" : "require");
        else diagnostics.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: 계산된 모듈 참조는 분석 대상 밖입니다`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const digest = createHash("sha256").update(JSON.stringify({ nodes, edges, excluded, diagnostics, layers })).digest("hex");
  return { schemaVersion: 1, digest, scope: "명시 입력 파일의 TypeScript 모듈 참조", layers, nodes, edges, excluded, diagnostics };
}

/** 제품 생성은 관리 범위 전체와 계약을 항상 검증한다. */
export function generateArchitecture(root: string, legacyInputFiles?: string[]) {
  if (legacyInputFiles) throw new Error("부분 import 분석은 extractArchitectureImports를 사용하세요. 제품 계약은 생략할 수 없습니다.");
  const imports = extractArchitectureImports(root, managedArchitectureSources(root));
  if (imports.diagnostics.length) throw new Error(imports.diagnostics.join("\n"));
  const structure = checkArchitectureContract(root, imports.edges)                                                                                    ;
  const nodes     = imports.nodes.map((node) => ({ ...node, structureId: structure.declarations.find((entry) => entry.file === node.file)!.nodeId })) ;
  const digest    = createHash("sha256").update(JSON.stringify({ imports: imports.digest, structure: structure.digest })).digest("hex")               ;
  return { ...imports, schemaVersion: 2, scope: "src와 scripts/workflow의 TypeScript (선언 파일 제외), build.ts, workflow.ts, source-policy.ts, generate-architecture.ts, architecture-contract.ts, check-architecture.ts", digest, nodes, structure };
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("BoxBox 설정/응답 객체가 필요합니다.");
  return Object.fromEntries(Object.entries(value));
}

/** 머신별 개발 설치 계약. 승인 근거는 기존 네 파일만 복사한다. */
export function architectureCanonicalTool(root: string): CanonicalTool {
  const local  = jsonObject(JSON.parse(readFileSync(path.join(root, ".www/development.local.json"), "utf8"))) ;
  const config = jsonObject(local.architectureCanonical)                                                      ;
  const text = (value: unknown): string => {
    if (typeof value !== "string" || !value) throw Error("BoxBox 개발 설치 설정이 누락됐습니다.");
    return value;
  };
  const registry = jsonObject(config.registry)                                                                                               ;
  const files    = [".boxbox/examples.jsonl", ".boxbox/conventions.jsonl", ".boxbox/decisions.jsonl", ".boxbox/rules/json-scalar-fields.md"] ;
  if (Object.keys(registry).length !== files.length) throw Error("BoxBox 승인 근거는 기존 네 파일이어야 합니다.");
  const proof = Object.fromEntries(files.map((file) => {
    const sha = text(registry[file]);
    if (!/^[a-f0-9]{64}$/.test(sha)) throw Error(`BoxBox 승인 근거 SHA가 필요합니다: ${file}`);
    return [file, sha];
  }));
  const launcher = text(local.boxboxLauncher) ;
  const runtime  = text(config.runtime      ) ;
  if (!path.isAbsolute(launcher) || realpathSync(runtime) !== realpathSync(path.resolve(path.dirname(launcher), "../runtime.json"))) throw Error("BoxBox launcher/runtime.json 경로가 다릅니다.");
  for (const value of [local.boxboxNode, config.cli, runtime]) if (!path.isAbsolute(text(value))) throw Error("BoxBox 설치 경로는 머신 로컬 절대경로여야 합니다.");
  return { node: text(local.boxboxNode), cli: text(config.cli), runtime, cliSha256: text(config.cliSha256), version: text(config.version), nodeVersion: text(config.nodeVersion), registry: proof };
}

export interface CanonicalTool {
  node        : string                           ;
  cli         : string                           ;
  cliSha256   : string                           ;
  runtime     : string                           ;
  version     : string                           ;
  nodeVersion : string                           ;
  registry    : Readonly<Record<string, string>> ;
}

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** JSON 의미 객체를 공개 CLI의 승인·parser·preservation·fixed-point 경로에 통과시킨다. */
export function canonicalArchitectureJson(root: string, value: unknown, tool: CanonicalTool): string {
  if (!existsSync(tool.node) || !existsSync(tool.cli)) throw new Error("개발용 고정 BoxBox 설치가 필요합니다. JSON.stringify fallback은 허용하지 않습니다.");
  if (digest(readFileSync(tool.cli)) !== tool.cliSha256) throw new Error("BoxBox CLI 버전/해시가 다릅니다.");
  const runtime: unknown = JSON.parse(readFileSync(tool.runtime, "utf8"));
  if (typeof runtime !== "object" || runtime === null || !("node" in runtime) || runtime.node !== tool.node || !("cli" in runtime) || runtime.cli !== tool.cli) throw new Error("설치 runtime.json과 개발 도구 경로가 다릅니다.");
  const version = spawnSync(tool.node, ["--version"], { encoding: "utf8", timeout: 5_000 });
  if (version.status !== 0 || version.stdout.trim() !== tool.nodeVersion) throw new Error("BoxBox Node 버전이 개발 설치 계약과 다릅니다.");
  const manifest = jsonObject(JSON.parse(readFileSync(path.join(path.dirname(tool.cli), "../package.json"), "utf8")));
  if (manifest.version !== tool.version) throw new Error("BoxBox package 버전이 다릅니다.");
  const logical = "src/architecture.generated.json"                         ;
  const stage   = mkdtempSync(path.join(tmpdir(), "www-boxbox-canonical-")) ;
  const run = (args: string[]) => {
    const result = spawnSync(tool.node, [tool.cli, ...args, "--file", logical, "--json"], { cwd: stage, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error(`BoxBox ${args.join(" ")}: ${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
    return jsonObject(JSON.parse(result.stdout));
  };
  try {
    mkdirSync(path.join(stage, ".git"));
    for (const [relative, expected] of Object.entries(tool.registry)) {
      if (!relative.startsWith(".boxbox/") || relative.split("/").includes("..")) throw new Error("승인 근거 경로가 잘못됐습니다.");
      const original = path.join   (root, relative) ;
      const bytes    = readFileSync(original      ) ;
      if (!lstatSync(original).isFile() || lstatSync(original).isSymbolicLink() || digest(bytes) !== expected) throw new Error(`승인 근거가 바뀌었습니다: ${relative}`);
      const target = path.join(stage, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes, { flag: "wx" });
    }
    mkdirSync(path.join(stage, "src"));
    const target = path.join(stage, logical)             ;
    const input  = JSON.stringify(value, null, 2) + "\n" ;
    writeFileSync(target, input, { flag: "wx" });
    run(["align", "--dry-run"]);
    run(["align"]);
    const output = readFileSync(target, "utf8");
    run(["align"]);
    if (readFileSync(target, "utf8") !== output) throw new Error("BoxBox 출력이 fixed point가 아닙니다.");
    const checked = run(["check", "--source"]);
    if (jsonObject(checked.syntax).status !== "valid") throw new Error("BoxBox JSON syntax 검증 실패");
    const readiness = jsonObject(checked.formatReadiness);
    if (readiness.approvalEligible !== true || !Array.isArray(readiness.approvalFacts) || !readiness.approvalFacts.length || readiness.approvalFacts.some((value: unknown) => {
      const fact = jsonObject(value);
      return fact.key !== "v1|json|object|mapping|key-colon>value" || fact.layer !== "project" || fact.conventionId !== "www-json-fields" || fact.proofComplete !== true;
    })) throw new Error("WWW 프로젝트 승인 근거를 확인하지 못했습니다.");
    if (!Array.isArray(checked.results) || checked.results.length !== 1 || checked.results.some((value: unknown) => {
      const summary = jsonObject(jsonObject(value).summary);
      return summary.misaligned !== 0 || summary.refused !== 0;
    })) throw new Error("BoxBox source check의 misaligned/refused가 0이 아닙니다.");
    if (JSON.stringify(JSON.parse(output)) !== JSON.stringify(JSON.parse(input))) throw new Error("JSON 값 또는 속성 순서가 바뀌었습니다.");
    return output;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/** write와 check가 같은 canonical 함수를 사용한다. 실패 시 최종 파일을 쓰지 않는다. */
export function writeCanonicalArchitecture(root: string, value: unknown, check: boolean, tool: CanonicalTool): void {
  const file = path.join(root, "src/architecture.generated.json");
  if (realpathSync(path.dirname(file)) !== path.join(realpathSync(root), "src") || (existsSync(file) && (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()))) throw new Error("snapshot 경로는 실제 src의 정규 파일이어야 합니다.");
  const before  = existsSync(file) ? readFileSync(file) : undefined ;
  const output  = canonicalArchitectureJson(root, value, tool)      ;
  const current = existsSync(file) ? readFileSync(file) : undefined ;
  if (before === undefined ? current !== undefined : current === undefined || !before.equals(current)) throw new Error("생성 중 snapshot이 바뀌었습니다.");
  if (check) {
    if (current?.toString("utf8") !== output) throw new Error("코드 설계도 snapshot이 현재 소스와 다릅니다.");
    return;
  }
  const temporary = `${file}.canonical-${randomUUID()}`;
  try {
    writeFileSync(temporary, output, { flag: "wx", mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function writeArchitecture(root: string, check = false) {
  const snapshot = generateArchitecture(root);
  if (snapshot.diagnostics.length) throw new Error(snapshot.diagnostics.join("\n"));
  writeCanonicalArchitecture(root, snapshot, check, architectureCanonicalTool(root));
  return snapshot;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = writeArchitecture(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), process.argv.includes("--check"));
  console.log(`코드 설계도: ${result.nodes.length}개 모듈 · ${result.edges.length}개 참조 · ${result.digest.slice(0, 12)}`);
}
