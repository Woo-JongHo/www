/**
 * @architecture arch.development.records.state
 * @implements RESP-DEVELOPMENT-RECORDS-STATE
 */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export interface StatechartReference { file: string; symbol: string }
export interface StatechartTransition {
  id: string;
  from: string;
  to: string;
  event: string;
  guards: string[];
  effect: string;
  code: StatechartReference[];
  tests: StatechartReference[];
}
export interface StatechartModel {
  schemaVersion: number;
  id: string;
  structureId: string;
  title: string;
  initial: string;
  states: { id: string; title: string }[];
  rules: { id: string; description: string }[];
  transitions: StatechartTransition[];
  counterexamples: { id: string; events: string[]; rejectedBy: string; test: StatechartReference }[];
}
export interface StatechartSnapshot {
  models: StatechartModel[];
  modelDigest: string;
  sourceDigest: string;
  sources: { file: string; digest: string }[];
  checks: { status: "not_run"; reason: string };
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("상태도: 비어 있지 않은 문자열이 필요합니다.");
  return value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("상태도: 배열이 필요합니다.");
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new Error("상태도: 객체가 필요합니다.");
  return value;
}
function fields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error("상태도: 알 수 없는 필드");
}
function reference(value: unknown): StatechartReference {
  const item = record(value);
  fields(item, ["file", "symbol"]);
  const file = text(item.file);
  if (path.isAbsolute(file) || file.includes("\\") || file.split("/").some(part => !part || part === "." || part === "..")) throw new Error("상태도: 안전하지 않은 근거 경로");
  return { file, symbol: text(item.symbol) };
}
function unique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`상태도: 중복 ${label}`);
}
/** 구조 검사는 실행 결과가 아니며, 완료 가능 여부는 work.ts의 공통 판정이 소유한다. */
export function parseWorkflowStatechart(value: unknown, structureIds: string[]): StatechartModel {
  const raw = record(value);
  fields(raw, ["schemaVersion", "id", "structureId", "title", "initial", "states", "rules", "transitions", "counterexamples"]);
  if (raw.schemaVersion !== 1) throw new Error("상태도: 지원하지 않는 schemaVersion");
  const model: StatechartModel = {
    schemaVersion: 1, id: text(raw.id), structureId: text(raw.structureId), title: text(raw.title), initial: text(raw.initial),
    states: array(raw.states).map(value => { const state = record(value); fields(state, ["id", "title"]); return { id: text(state.id), title: text(state.title) }; }),
    rules: array(raw.rules).map(value => { const rule = record(value); fields(rule, ["id", "description"]); return { id: text(rule.id), description: text(rule.description) }; }),
    transitions: array(raw.transitions).map(value => {
      const entry = record(value);
      fields(entry, ["id", "from", "to", "event", "guards", "effect", "code", "tests"]);
      return { id: text(entry.id), from: text(entry.from), to: text(entry.to), event: text(entry.event), guards: array(entry.guards).map(text), effect: text(entry.effect), code: array(entry.code).map(reference), tests: array(entry.tests).map(reference) };
    }),
    counterexamples: array(raw.counterexamples).map(value => {
      const entry = record(value);
      fields(entry, ["id", "events", "rejectedBy", "test"]);
      return { id: text(entry.id), events: array(entry.events).map(text), rejectedBy: text(entry.rejectedBy), test: reference(entry.test) };
    }),
  };
  if (!structureIds.includes(model.structureId)) throw new Error(`상태도: 없는 구조 ID ${model.structureId}`);
  const ids = [...model.states.map(item => item.id), ...model.rules.map(item => item.id), ...model.transitions.map(item => item.id), ...model.counterexamples.map(item => item.id)];
  unique(ids, "상태·규칙·전이·반례 ID");
  const states = new Set(model.states.map(item => item.id));
  const rules = new Set(model.rules.map(item => item.id));
  if (!states.has(model.initial)) throw new Error("상태도: 미정의 초기 상태");
  for (const transition of model.transitions) {
    if (!states.has(transition.from) || !states.has(transition.to)) throw new Error(`상태도: 미정의 상태 ${transition.id}`);
    unique(transition.guards, "전이 조건");
    if (transition.guards.some(id => !rules.has(id)) || !transition.code.length || !transition.tests.length) throw new Error(`상태도: 필수 조건·코드·검증 근거 누락 ${transition.id}`);
    if (transition.to === "work.done" && ["rule.criteria-current", "rule.review-current", "rule.report-current", "rule.source-stable", "rule.unit-acceptance"].some(id => !transition.guards.includes(id))) throw new Error(`상태도: 완료 전이의 현재성 조건 누락 ${transition.id}; 반례: 검증 통과 → 대상 소스 변경 → 완료 요청`);
  }
  if (!model.transitions.some(item => item.to === "work.done")) throw new Error("상태도: 완료 전이 누락");
  for (const entry of model.counterexamples) {
    if (!entry.events.length || !rules.has(entry.rejectedBy)) throw new Error(`상태도: 반례 사건·규칙 누락 ${entry.id}`);
  }
  if (!model.counterexamples.length) throw new Error("상태도: 반례 연결 누락");
  return model;
}
function sourceText(root: string, file: string): string {
  let current = realpathSync(root);
  for (const part of file.split("/")) {
    current = path.join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error(`상태도: 심볼릭 링크 근거 ${file}`);
  }
  return readFileSync(current, "utf8");
}
function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function implementedFunctions(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some(item => item.kind === ts.SyntaxKind.DeclareKeyword)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) names.add(statement.name.text);
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) names.add(declaration.name.text);
    }
  }
  return names;
}
interface TestApi { suite: boolean; node: boolean; namespace?: boolean }
function bindingNames(name: ts.BindingName): string[] {
  return ts.isIdentifier(name) ? [name.text] : name.elements.flatMap(item => ts.isBindingElement(item) ? bindingNames(item.name) : []);
}
function testImports(source: ts.SourceFile): Map<string, TestApi> {
  const names = new Map<string, TestApi>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
      !["node:test", "bun:test"].includes(statement.moduleSpecifier.text) || statement.importClause?.isTypeOnly) continue;
    const clause = statement.importClause;
    const node = statement.moduleSpecifier.text === "node:test";
    if (clause?.name && node) names.set(clause.name.text, { suite: false, node });
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) names.set(bindings.name.text, { suite: false, node, namespace: true });
    if (bindings && ts.isNamedImports(bindings)) for (const entry of bindings.elements) {
      const imported = (entry.propertyName ?? entry.name).text;
      if (!entry.isTypeOnly && ["test", "it", "describe", ...(node ? ["suite"] : [])].includes(imported)) {
        names.set(entry.name.text, { suite: ["describe", "suite"].includes(imported), node });
      }
    }
  }
  return names;
}
function testApi(expression: ts.Expression, names: Map<string, TestApi>): TestApi | undefined {
  if (ts.isIdentifier(expression)) {
    const api = names.get(expression.text);
    return api?.namespace ? undefined : api;
  }
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    const origin = names.get(expression.expression.text);
    const member = expression.name.text;
    if (origin?.namespace && ["test", "it", "describe", ...(origin.node ? ["suite"] : [])].includes(member)) {
      return { suite: ["describe", "suite"].includes(member), node: origin.node };
    }
  }
  return undefined;
}
function testOptions(options: ts.Expression, node: boolean): boolean {
  if (!node && ts.isNumericLiteral(options)) return true;
  if (!ts.isObjectLiteralExpression(options)) return false;
  const allowed = node ? ["concurrency", "expectFailure", "signal", "tags", "timeout", "plan", "skip", "todo", "only"] : ["timeout", "retry", "repeats", "skip", "todo", "only"];
  return options.properties.every(property => {
    if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) return false;
    const name = property.name.text;
    return allowed.includes(name) && (!["skip", "todo", "only"].includes(name) || property.initializer.kind === ts.SyntaxKind.FalseKeyword);
  });
}
function testCallback(call: ts.CallExpression, api: TestApi): ts.ArrowFunction | ts.FunctionExpression | undefined {
  const [name, second, third] = call.arguments;
  if (!name || !(ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))) return undefined;
  const inline = (value: ts.Expression | undefined): value is ts.ArrowFunction | ts.FunctionExpression =>
    !!value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value));
  if (call.arguments.length === 2 && inline(second)) return second;
  if (call.arguments.length === 3 && second && inline(third) && testOptions(second, api.node)) return third;
  if (!api.node && call.arguments.length === 3 && inline(second) && third && testOptions(third, false)) return second;
  return undefined;
}
/** 선언의 존재만 확인한다. 조건부 등록이나 일반 helper의 실행을 추정하지 않는다. */
function activeTestNames(source: ts.SourceFile): Set<string> {
  const found = new Set<string>();
  function visit(statements: ts.NodeArray<ts.Statement>, inherited: Map<string, TestApi>, parameters: readonly ts.ParameterDeclaration[] = []) {
    const names = new Map(inherited);
    for (const parameter of parameters) for (const name of bindingNames(parameter.name)) names.delete(name);
    for (const statement of statements) {
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) names.delete(statement.name.text);
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
        for (const name of bindingNames(declaration.name)) names.delete(name);
      }
    }
    for (const statement of statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
      const call = statement.expression;
      const api = testApi(call.expression, names);
      const callback = api && testCallback(call, api);
      if (!api || !callback) continue;
      if (api.suite) {
        const nested = new Map(names);
        if (ts.isFunctionExpression(callback) && callback.name) nested.delete(callback.name.text);
        if (ts.isBlock(callback.body)) visit(callback.body.statements, nested, callback.parameters);
      } else {
        const name = call.arguments[0];
        if (name && (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))) found.add(name.text);
      }
    }
  }
  visit(source.statements, testImports(source));
  return found;
}
/** 생성기는 정의와 내용 식별을 묶는다. 테스트를 실행했거나 통과했다는 값을 생성하지 않는다. */
export function collectWorkflowStatecharts(root: string, structureIds: string[]): StatechartSnapshot {
  const model = parseWorkflowStatechart(JSON.parse(sourceText(root, "docs/architecture/statecharts/development-work.json")), structureIds);
  const code = model.transitions.flatMap(item => item.code).concat([{ file: "scripts/workflow/statechart.ts", symbol: "parseWorkflowStatechart" }]);
  const tests = model.transitions.flatMap(item => item.tests).concat(model.counterexamples.map(item => item.test));
  const references = [...code, ...tests];
  const sources = [...new Set(references.map(item => item.file))].sort().map(file => {
    const source = sourceText(root, file);
    const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const [refs, names] of [[code, implementedFunctions(syntax)], [tests, activeTestNames(syntax)]] as const) {
      for (const ref of refs.filter(item => item.file === file)) if (!names.has(ref.symbol)) throw new Error(`상태도: 없는 근거 ${file} ${ref.symbol}`);
    }
    return { file, digest: digest(source) };
  });
  return { models: [model], modelDigest: digest(JSON.stringify(model)), sourceDigest: digest(JSON.stringify(sources)), sources,
    checks: { status: "not_run", reason: "정의·참조 검사만 수행했습니다. 행동 검사·반례 재현·GUI 실행 결과는 별도 작업 근거에서 확인합니다." } };
}
