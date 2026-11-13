import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const layers = [
  { id: "presentation", title: "화면과 상호작용", description: "React 화면 · 입력 · 읽기 상태", color: "#91baff" },
  { id: "model", title: "상태와 투영", description: "사건 해석 · 순수 모델 · 탐색", color: "#83c9bc" },
  { id: "contract", title: "브리지와 계약", description: "preload · IPC 허용 목록 · 공용 타입", color: "#dac391" },
  { id: "host", title: "Electron과 Native", description: "프로세스 · JSON-RPC · 저장 서비스", color: "#baa6e0" },
  { id: "workflow", title: "개발과 기록", description: "권한 · 실행 · 증거 · 검토 · 보고서", color: "#a6b4c4" },
  { id: "tooling", title: "빌드와 소스 정책", description: "번들 · 분석 생성 · 작성 하네스", color: "#c8ab99" },
];

const roles: Record<string, string> = {
  "renderer": "화면 전환과 대화 상태 통합", "main": "앱·Native 수명주기와 IPC 처리", "preload": "제한된 WwwApi 노출", "shared": "프로세스 간 공용 타입 계약",
  "projection": "공개 사건을 읽을 수 있는 블록으로 투영", "rpc": "JSONL 요청·응답과 EOF 처리", "conversations": "Native 대화 목록·이력 복원", "development": "개발 상태와 완료 서비스",
  "ecosystem-view": "코드 설계도와 생태계 안내 탐색", "architecture": "계층·모듈 탐색과 결정적 배치", "ecosystem": "수동 생태계 안내와 후속 방향",
  "native-reports": "자동 보고서 큐와 수명주기", "report-judge": "별도 읽기 전용 Native 보고서 판단", "reports-service": "작업 보고서의 안전한 목록·읽기",
};

function layerFor(file: string): string {
  if (file === "scripts/workflow.ts" || file === "scripts/source-policy.ts" || file === "build.ts" || file === "scripts/generate-architecture.ts") return "tooling";
  if (file.startsWith("scripts/workflow/")) return "workflow";
  const name = path.basename(file, path.extname(file));
  if (["shared", "preload"].includes(name)) return "contract";
  if (file.endsWith(".tsx") || name === "input") return "presentation";
  if (["projection", "chat-state", "activity-sidebar", "architecture", "ecosystem", "native-activity", "native-chat"].includes(name)) return "model";
  return "host";
}

function sourcesIn(root: string, directory: string): string[] {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourcesIn(root, file);
    return /\.(ts|tsx|mts|cts)$/.test(file) && !file.endsWith(".d.ts") ? [file] : [];
  });
}

export function generateArchitecture(root: string, inputFiles?: string[]) {
  const files = [...new Set(inputFiles ?? [
    ...sourcesIn(root, "src"), ...sourcesIn(root, "scripts/workflow"),
    "scripts/workflow.ts", "scripts/source-policy.ts", "scripts/generate-architecture.ts", "build.ts",
  ])].sort();
  const options: ts.CompilerOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowImportingTsExtensions: true, resolveJsonModule: true };
  const texts = new Map(files.map((file) => [file, readFileSync(path.join(root, file), "utf8")]));
  const nodes = files.map((file) => {
    const text = texts.get(file)!;
    const name = path.basename(file, path.extname(file));
    return { id: file, file, title: name, layer: layerFor(file), role: roles[name] ?? (file.startsWith("scripts/workflow/") ? `개발 절차 모듈 · ${name}` : `앱 모듈 · ${name}`), line: 1, lines: text.split("\n").length, digest: createHash("sha256").update(text).digest("hex") };
  });
  const edges: { id: string; from: string; to: string; mode: string; syntax: string; specifier: string; line: number; endLine: number; statement: string }[] = [];
  const excluded: { file: string; line: number; specifier: string; reason: string }[] = [];
  const diagnostics: string[] = [];
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
        const clause = node.importClause;
        const bindings = clause?.namedBindings;
        const named = bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
        const types = named.filter((entry) => entry.isTypeOnly).length;
        const onlyTypes = !!clause?.isTypeOnly || (!clause?.name && named.length > 0 && types === named.length);
        record(node, node.moduleSpecifier.text, onlyTypes ? "type" : types ? "mixed" : "runtime", "import");
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const named = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : [];
        const types = named.filter((entry) => entry.isTypeOnly).length;
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
  return { schemaVersion: 1, digest, scope: "src/**/*.ts(x), scripts/workflow/**/*.ts, workflow.ts, source-policy.ts, generate-architecture.ts, build.ts", layers, nodes, edges, excluded, diagnostics };
}

export function writeArchitecture(root: string, check = false) {
  const snapshot = generateArchitecture(root);
  if (snapshot.diagnostics.length) throw new Error(snapshot.diagnostics.join("\n"));
  const output = JSON.stringify(snapshot, null, 2) + "\n";
  const file = path.join(root, "src/architecture.generated.json");
  if (check) {
    if (readFileSync(file, "utf8") !== output) throw new Error("코드 설계도 snapshot이 현재 소스와 다릅니다. node scripts/generate-architecture.ts로 다시 생성하세요.");
  } else writeFileSync(file, output);
  return snapshot;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = writeArchitecture(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), process.argv.includes("--check"));
  console.log(`코드 설계도: ${result.nodes.length}개 모듈 · ${result.edges.length}개 참조 · ${result.digest.slice(0, 12)}`);
}
