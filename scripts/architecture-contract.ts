/**
 * @architecture arch.tooling.structure-contract
 * @implements RESP-TOOLING-STRUCTURE-CONTRACT
 */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export interface StructureNode {
  id                  : string        ;
  parent              : string | null ;
  title               : string        ;
  description         : string        ;
  allowedDependencies : string[]      ;
}
export interface ArchitectureRequirement {
  id                     : string  ;
  nodeId                 : string  ;
  description            : string  ;
  implementationRequired : boolean ;
  verificationRequired   : boolean ;
  file                   : string  ;
  line                   : number  ;
}
export interface ArchitectureDeclaration {
  file           : string   ;
  nodeId         : string   ;
  requirementIds : string[] ;
  line           : number   ;
}
export interface RequirementTest {
  file           : string   ;
  requirementIds : string[] ;
  line           : number   ;
}
export interface FileDependency {
  from: string;
  to: string
}

function fail(message: string): never { throw new Error(`구조 계약: ${message}`); }
function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) fail("객체가 필요합니다.");
  return value;
}
function fields(value: Record<string, unknown>, names: string[]) {
  if (Object.keys(value).some((key) => !names.includes(key))) fail("알 수 없는 계약 필드가 있습니다.");
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) fail("비어 있지 않은 문자열이 필요합니다.");
  return value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) fail("배열이 필요합니다.");
  return value;
}
function flag(value: unknown): boolean {
  if (typeof value !== "boolean") fail("필수 여부는 boolean이어야 합니다.");
  return value;
}
function identifier(value: unknown, structure = false): string {
  const id = text(value);
  if (!(structure ? /^arch\.[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/ : /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/).test(id)) fail(`잘못된 ID ${id}`);
  return id;
}
function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) fail(`중복 ${label}`);
}

/** 저장소 밖 경로와 경로 조각의 symlink를 모두 거부한다. */
export function architecturePath(root: string, file: string): string {
  if (path.isAbsolute(file) || file.includes("\\") || file.split("/").some((part) => !part || part === "." || part === "..")) fail(`안전하지 않은 경로 ${file}`);
  let current = realpathSync(root);
  for (const part of file.split("/")) {
    current = path.join(current, part);
    if (lstatSync(current).isSymbolicLink()) fail(`심볼릭 링크 ${file}`);
  }
  return current;
}
function read(root: string, file: string): string { return readFileSync(architecturePath(root, file), "utf8"); }
function sources(root: string, directory: string): string[] {
  return readdirSync(architecturePath(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    architecturePath(root, file);
    if (entry.isDirectory()) return sources(root, file);
    return /\.(?:ts|tsx|mts|cts)$/.test(file) && !/\.d\.(?:ts|mts|cts)$/.test(file) ? [file] : [];
  });
}
export function managedArchitectureSources(root: string): string[] {
  return [...sources(root, "src"), ...sources(root, "scripts/workflow"),
    "build.ts", "scripts/workflow.ts", "scripts/source-policy.ts", "scripts/generate-architecture.ts",
    "scripts/architecture-contract.ts", "scripts/check-architecture.ts"].sort();
}
function loadStructure(root: string) {
  const raw            = read      (root, "docs/architecture/structure.json") ;
  const value: unknown = JSON.parse(raw                                     ) ;
  const contract       = object    (value                                   ) ;
  fields(contract, ["schemaVersion", "rootId", "specFiles", "nodes"]);
  if (contract.schemaVersion !== 1) fail("지원하지 않는 schemaVersion");
  const rootId = identifier(contract.rootId, true);
  if (rootId !== "arch.www") fail("rootId는 arch.www여야 합니다.");
  const specFiles = array(contract.specFiles).map(text);
  unique(specFiles, "명세 파일");
  if (!specFiles.length) fail("명세 파일이 필요합니다.");
  const nodes = array(contract.nodes).map((entry): StructureNode => {
    const node = object(entry);
    fields(node, ["id", "parent", "title", "description", "allowedDependencies"]);
    const allowedDependencies = array(node.allowedDependencies).map((id) => identifier(id, true));
    unique(allowedDependencies, "허용 의존성");
    return { id: identifier(node.id, true), parent: node.parent === null ? null : identifier(node.parent, true), title: text(node.title), description: text(node.description), allowedDependencies };
  });
  unique(nodes.map((node) => node.id), "구조 ID");
  const index = new Map(nodes.map((node) => [node.id, node]));
  if (nodes.filter((node) => node.parent === null).length !== 1 || index.get(rootId)?.parent !== null) fail("단일 root가 필요합니다.");
  for (const node of nodes) {
    if (node.parent !== null && !index.has(node.parent)) fail(`부모 누락 ${node.id}`);
    for (const target of node.allowedDependencies) if (!index.has(target)) fail(`미정의 허용 의존성 ${target}`);
    const visited                          = new Set<string>() ;
    let current: StructureNode | undefined = node              ;
    while (current) {
      if (visited.has(current.id)) fail(`부모 순환 ${node.id}`);
      visited.add(current.id);
      current = current.parent === null ? undefined : index.get(current.parent);
    }
    if (!visited.has(rootId)) fail(`고아 구조 ${node.id}`);
  }
  return { rootId, specFiles, nodes, raw };
}
function loadRequirements(root: string, files: string[]): ArchitectureRequirement[] {
  const requirements: ArchitectureRequirement[] = [];
  for (const file of files) {
    const source                                                                             = read(root, file)   ;
    const lines                                                                              = source.split("\n") ;
    const blocks : { body: string; offset: number }[]                                        = []                 ;
    let fence    : { marker: string; width: number; catalog: boolean; start: number } | null = null               ;
    let offset                                                                               = 0                  ;
    for (const row of lines) {
      const opening = /^( {0,3})(`{3,}|~{3,})([^\r]*)\r?$/.exec(row);
      if (fence) {
        const closing = /^( {0,3})(`{3,}|~{3,})[ \t]*\r?$/.exec(row);
        if (closing && closing[2]![0] === fence.marker && closing[2]!.length >= fence.width) {
          if (fence.catalog) blocks.push({ body: source.slice(fence.start, offset), offset: fence.start });
          fence = null;
        }
      } else if (opening && !(opening[2]![0] === "`" && opening[3]!.includes("`"))) {
        fence = { marker: opening[2]![0]!, width: opening[2]!.length, catalog: opening[3]!.trim() === "architecture-requirements", start: offset + row.length + 1 };
      }
      offset += row.length + 1;
    }
    if (blocks.length !== 1 || fence?.catalog) fail(`${file}: 요구 catalog는 정확히 하나여야 합니다.`);
    const block            = blocks[0]!                         ;
    const entries: unknown = JSON.parse(block.body)             ;
    const json             = ts.parseJsonText(file, block.body) ;
    const expression       = json.statements[0]?.expression     ;
    if (!expression || !ts.isArrayLiteralExpression(expression)) fail(`${file}: 요구 배열이 필요합니다.`);
    let entryIndex = 0;
    for (const entry of array(entries)) {
      const requirement = object(entry);
      fields(requirement, ["id", "nodeId", "description", "implementationRequired", "verificationRequired"]);
      const element = expression.elements[entryIndex++];
      if (!element || !ts.isObjectLiteralExpression(element)) fail(`${file}: 요구 객체가 필요합니다.`);
      const idProperty = element.properties.find((property) => ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name) && property.name.text === "id");
      if (!idProperty || !ts.isPropertyAssignment(idProperty)) fail(`${file}: 요구 ID 위치가 필요합니다.`);
      const line = source.slice(0, block.offset + idProperty.name.getStart(json)).split("\n").length;
      requirements.push({ id: identifier(requirement.id), nodeId: identifier(requirement.nodeId, true), description: text(requirement.description), implementationRequired: flag(requirement.implementationRequired), verificationRequired: flag(requirement.verificationRequired), file, line });
    }
  }
  unique(requirements.map((requirement) => requirement.id), "요구 ID");
  return requirements;
}

/** 실제 선행 JSDoc들을 읽고 내장 구현 태그도 원문 범위로 판독한다. */
function annotations(file: string, sourceText: string) {
  const source                                                = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true) ;
  const first                                                 = source.statements[0]                                                ;
  const tags: { name: string; value: string; line: number }[] = []                                                                  ;
  const seen                                                  = new Set<number>()                                                   ;
  function inspect(node: ts.Node) {
    for (const range of [...(ts.getLeadingCommentRanges(sourceText, node.pos) ?? []), ...(ts.getTrailingCommentRanges(sourceText, node.end) ?? [])]) {
      if (seen.has(range.pos) || !sourceText.startsWith("/**", range.pos)) continue;
      seen.add(range.pos);
      const comment = sourceText.slice           (range.pos, range.end                                                          ) ;
      const parsed  = ts        .createSourceFile(file, `${comment}\nexport const annotation = 0;`, ts.ScriptTarget.Latest, true) ;
      for (const tag of ts.getJSDocTags(parsed.statements[0]!)) {
        const name = tag.tagName.text;
        if (!["architecture", "implements", "verifies"].includes(name)) continue;
        if (!first || range.end > first.getStart(source)) fail(`${file}: 선언은 첫 문장 앞 JSDoc에만 허용합니다.`);
        const value = tag.getText(parsed).slice(name.length + 1).replace(/\r?\n[ \t]*\*?[ \t]*$/, "").trim() ;
        const line  = source.getLineAndCharacterOfPosition(range.pos + tag.getStart(parsed)).line + 1        ;
        tags.push({ name, value, line });
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
  const values = (name: string) => tags.filter((tag) => tag.name === name).map((tag) => ({
    id: identifier(tag.value, name === "architecture"), line: tag.line,
  }));
  const architecture   = values("architecture") ;
  const implementsTags = values("implements"  ) ;
  const verifies       = values("verifies"    ) ;
  unique(implementsTags.map((tag) => tag.id), `${file}: 구현 선언`);
  unique(verifies.map((tag) => tag.id), `${file}: 검증 선언`);
  return { source, architecture, implementsTags, verifies };
}
function containsTest(source: ts.SourceFile): boolean {
  const origins = new Set<string>()                                    ;
  const names   = new Map<string, { suite: boolean; node: boolean }>() ;
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !["bun:test", "node:test"].includes(statement.moduleSpecifier.text)) continue;
    const clause = statement.importClause;
    if (clause?.isTypeOnly) continue;
    const node = statement.moduleSpecifier.text === "node:test";
    if (clause?.name) {
      origins.add(clause.name.text);
      if (node) names.set(clause.name.text, { suite: false, node });
    }
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) origins.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) for (const entry of bindings.elements) {
      if (entry.isTypeOnly) continue;
      origins.add(entry.name.text);
      const imported = (entry.propertyName ?? entry.name).text;
      if (["test", "it", "describe"].includes(imported) || (node && imported === "suite")) names.set(entry.name.text, { suite: ["describe", "suite"].includes(imported), node });
    }
  }
  function frameworkOrigin(expression: ts.Expression): boolean {
    if (ts.isIdentifier(expression)) return origins.has(expression.text);
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) || ts.isCallExpression(expression) ||
      ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) || ts.isSatisfiesExpression(expression)) return frameworkOrigin(expression.expression);
    if (ts.isTaggedTemplateExpression(expression)) return frameworkOrigin(expression.tag);
    return false;
  }
  function optionsAllowed(options: ts.Expression, node: boolean): boolean {
    if (!node && ts.isNumericLiteral(options)) return true;
    if (!ts.isObjectLiteralExpression(options)) return false;
    const fields = node ? ["concurrency", "expectFailure", "only", "signal", "skip", "tags", "timeout", "todo", "plan"] : ["timeout", "retry", "repeats"];
    return options.properties.every((property) => {
      if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) return false;
      const name = property.name.text;
      if (!fields.includes(name)) return false;
      return !["skip", "todo", "only"].includes(name) || property.initializer.kind === ts.SyntaxKind.FalseKeyword;
    });
  }
  function inline(expression: ts.Expression | undefined): expression is ts.ArrowFunction | ts.FunctionExpression {
    return !!expression && (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression));
  }
  function callback(call: ts.CallExpression, api: { suite: boolean; node: boolean }): ts.ArrowFunction | ts.FunctionExpression | undefined {
    const [first, second, third] = call.arguments;
    if (api.node) {
      if (call.arguments.length === 1 && inline(first)) return first;
      if (call.arguments.length === 2 && inline(second) && first &&
        (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first) || optionsAllowed(first, true))) return second;
      if (call.arguments.length === 3 && first && second && inline(third) && optionsAllowed(second, true)) return third;
    } else if (api.suite) {
      if (call.arguments.length === 1 && inline(first)) return first;
      if (call.arguments.length === 2 && inline(second)) return second;
    } else {
      if (call.arguments.length === 2 && inline(second)) return second;
      if (call.arguments.length === 3 && second && third) {
        if (inline(second) && optionsAllowed(third, false)) return second;
        if (optionsAllowed(second, false) && inline(third)) return third;
      }
    }
    return undefined;
  }
  let found = false;
  function visit(node: ts.Node) {
    // 일반 helper/콜백 본문은 실행 여부를 추정하지 않는다. 승인된 suite만 명시적으로 진입한다.
    if (ts.isFunctionLike(node)) return;
    if (ts.isTaggedTemplateExpression(node) && frameworkOrigin(node.tag)) return;
    if (ts.isCallExpression(node) && frameworkOrigin(node.expression)) {
      const api  = ts.isIdentifier(node.expression) ? names.get(node.expression.text) : undefined ;
      const body = api && callback(node, api)                                                     ;
      if (api && body) {
        if (api.suite) visit(body.body);
        else found = true;
      }
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}
export function checkArchitectureContract(root: string, dependencies: FileDependency[]) {
  const contract         = loadStructure(root)                                                       ;
  const requirements     = loadRequirements(root, contract.specFiles)                                ;
  const nodes            = new Map(contract.nodes.map((node) => [node.id, node]))                    ;
  const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement])) ;
  for (const requirement of requirements) if (!nodes.has(requirement.nodeId)) fail(`미정의 요구 구조 ${requirement.nodeId}`);
  for (const node of contract.nodes) {
    if (!contract.nodes.some((child) => child.parent === node.id) && !requirements.some((requirement) => requirement.nodeId === node.id)) fail(`leaf 요구 누락 ${node.id}`);
  }
  const declarations: ArchitectureDeclaration[] = [];
  for (const file of managedArchitectureSources(root)) {
    const tags = annotations(file, read(root, file));
    if (tags.architecture.length !== 1) fail(`${file}: 구조 선언은 정확히 하나여야 합니다.`);
    const declaration = tags.architecture[0]!;
    if (!nodes.has(declaration.id)) fail(`${file}: 미정의 구조 ${declaration.id}`);
    if (!tags.implementsTags.length) fail(`${file}: 구현 선언 누락`);
    if (tags.verifies.length) fail(`${file}: 소스에 검증 선언을 둘 수 없습니다.`);
    for (const tag of tags.implementsTags) {
      const requirement = requirementsById.get(tag.id);
      if (!requirement) fail(`${file}: 미정의 요구 ${tag.id}`);
      if (requirement.nodeId !== declaration.id) fail(`${file}: 요구 구조 소속 불일치 ${tag.id}`);
    }
    declarations.push({ file, nodeId: declaration.id, requirementIds: tags.implementsTags.map((tag) => tag.id), line: declaration.line });
  }
  const tests: RequirementTest[] = [];
  for (const file of sources(root, "test").sort().filter((file) => /\.test\.tsx?$/.test(file))) {
    const tags = annotations(file, read(root, file));
    if (!tags.verifies.length) continue;
    if (!containsTest(tags.source)) fail(`${file}: 실제 테스트 호출 누락`);
    if (tags.architecture.length > 1) fail(`${file}: 구조 선언 중복`);
    for (const tag of tags.verifies) {
      const requirement = requirementsById.get(tag.id);
      if (!requirement) fail(`${file}: 미정의 검증 요구 ${tag.id}`);
      if (tags.architecture.length && tags.architecture[0]!.id !== requirement.nodeId) fail(`${file}: 검증 구조 소속 불일치`);
    }
    tests.push({ file, requirementIds: tags.verifies.map((tag) => tag.id), line: tags.verifies[0]!.line });
  }
  for (const requirement of requirements) {
    if (requirement.implementationRequired && !declarations.some((entry) => entry.requirementIds.includes(requirement.id))) fail(`필수 구현 누락 ${requirement.id}`);
    if (requirement.verificationRequired && !tests.some((entry) => entry.requirementIds.includes(requirement.id))) fail(`필수 검증 누락 ${requirement.id}`);
  }
  const files = new Map(declarations.map((entry) => [entry.file, entry.nodeId]));
  for (const edge of dependencies) {
    const from = files.get(edge.from) ;
    const to   = files.get(edge.to  ) ;
    if (!from || !to) fail(`관리 범위 밖 의존성 입력 ${edge.from} → ${edge.to}`);
    if (from !== to && !nodes.get(from)!.allowedDependencies.includes(to)) fail(`미허용 의존성 ${from} → ${to} (${edge.from} → ${edge.to})`);
  }
  const digest = createHash("sha256").update(JSON.stringify({ contract: contract.raw, specs: contract.specFiles.map((file) => [file, read(root, file)]), declarations, tests: tests.map((test) => ({ ...test, source: read(root, test.file) })) })).digest("hex");
  return { rootId: contract.rootId, nodes: contract.nodes, requirements, declarations, tests, digest };
}
