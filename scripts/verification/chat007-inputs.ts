import { isBuiltin } from "node:module";
import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

interface BundleInput { imports: { path: string; original?: string; kind: string; external?: boolean }[] }

/** 실제 제품 번들에 포함된 파일과 외부 import가 등록한 범위를 벗어나면 판정을 중단한다. */
export function verifyMonitorBundle(repo: string, inputs: Record<string, BundleInput>, outputs: Record<string, BundleInput>, entry?: string) {
  const root = realpathSync(repo);
  const trace = process.env.WWW_CHAT007_SCRIPT_TRACE;
  if (trace && entry) appendFileSync(trace, JSON.stringify([entry, null]) + "\n");
  const modules = realpathSync(path.join(repo, "node_modules")) + path.sep;
  const packages = new Map<string, string>();
  let locked: Record<string, {version?: string; integrity?: string}> | undefined;
  for (const output of Object.values(outputs)) {
    for (const edge of output.imports) {
      if (edge.external && edge.path !== "electron" && !isBuiltin(edge.path)) throw Error("미관찰 외부 import: " + edge.path);
    }
  }
  for (const [input, info] of Object.entries(inputs)) {
    const file = realpathSync(path.resolve(repo, input));
    const relative = path.relative(root, file).split(path.sep).join("/");
    const installed = file.startsWith(modules);
    if (trace && entry && relative.startsWith("scripts/")) appendFileSync(trace, JSON.stringify([entry, relative]) + "\n");
    if (installed) {
      const parts = path.relative(modules, file).split(path.sep);
      const name = parts.slice(0, parts[0].startsWith("@") ? 2 : 1).join("/");
      if (!packages.has(name)) {
        locked ??= JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8")).packages;
        const expected = locked?.["node_modules/" + name];
        const version = JSON.parse(readFileSync(path.join(modules, name, "package.json"), "utf8")).version;
        if (!expected?.integrity || !version || expected.version !== version) throw Error("설치·잠금 불일치: " + name);
        packages.set(name, version);
      }
    }
    if (!installed && !relative.startsWith("src/") && !relative.startsWith("scripts/") && !relative.startsWith("docs/architecture/")) throw Error("미등록 번들 입력: " + relative);
    if (!installed && /\.[cm]?[jt]sx?$/.test(file)) {
      const contents = readFileSync(file, "utf8");
      if (/\b(?:import|require)\s*\(/.test(contents)) {
        const ast = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest);
        function inspect(node: ts.Node) {
          if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
            const specifier = node.arguments[0];
            if (!specifier || !ts.isStringLiteral(specifier) || !isBuiltin(specifier.text)) throw Error("동적 모듈 입력 검토 필요: " + relative);
          }
          ts.forEachChild(node, inspect);
        }
        inspect(ast);
      }
    }
    for (const edge of info.imports) {
      if (edge.kind === "dynamic-import" && !isBuiltin(edge.path)) throw Error("미관찰 import: " + edge.path);
      if (edge.path.startsWith("scripts/") && edge.original && !path.extname(edge.original)) throw Error("해석 후보가 정해지지 않은 스크립트: " + edge.original);
      if (edge.path.endsWith("architecture.generated.json") && relative !== "src/architecture.ts") throw Error("새 설계도 소비 경로: " + relative);
    }
  }
}

/** 모듈 선택이 나중에 생긴 파일 하나로 달라지거나 동적으로 계산되면 현재 관찰만 재사용할 수 없다. */
export function verifyMonitorScriptRequests(repo: string, scripts: string[]) {
  let locked: Record<string, {integrity?: string}> | undefined;
  for (const script of scripts) {
    if (script.endsWith(".json")) continue;
    const ast = ts.createSourceFile(script, readFileSync(path.join(repo, script), "utf8"), ts.ScriptTarget.Latest);
    function visit(node: ts.Node) {
      let specifier: ts.Node | undefined;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        specifier = node.arguments[0];
        if (!specifier || !ts.isStringLiteral(specifier)) throw Error("동적으로 계산한 실행 모듈: " + script);
        if (!isBuiltin(specifier.text)) {
          const name = specifier.text;
          if (!/^(?:@[a-z0-9][a-z0-9_-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name)) throw Error("선택적 모듈의 부재를 입증할 수 없음: " + script);
          locked ??= JSON.parse(readFileSync(path.join(repo, "package-lock.json"), "utf8")).packages;
          if (!locked?.["node_modules/" + name]?.integrity) throw Error("잠금 파일에 없는 선택적 모듈: " + name);
        }
      }
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith(".") && !path.extname(specifier.text)) throw Error("명시적 확장자가 없는 실행 모듈: " + script);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
}
