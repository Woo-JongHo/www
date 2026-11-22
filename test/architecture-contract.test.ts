/**
 * @verifies RESP-TOOLING-STRUCTURE-CONTRACT
 * @verifies RESP-TOOLING-MAP-VALIDATION
 * @verifies RESP-TOOLING-MAP-GENERATION
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkArchitectureContract } from "../scripts/architecture-contract.ts";
import { architectureCanonicalTool, architectureBoxboxMode, generateArchitecture, writeArchitecture } from "../scripts/generate-architecture.ts";

const sourceRoot = path.resolve(import.meta.dir, "..");
const fixtureMode = architectureBoxboxMode(sourceRoot, architectureCanonicalTool(sourceRoot));

const declaration = "/**\n * @architecture arch.feature\n * @implements FEATURE-OWNERSHIP\n */\nexport const marker = 1;\n"                                       ;
const testSource  = "/** @verifies FEATURE-OWNERSHIP */\nimport { test } from 'bun:test';\ntest('실행', () => { if (1 + 1 !== 2) throw Error('실행 실패'); });\n" ;

function fixture(run: (root: string) => void) {
  const previousMode = process.env.BOXBOX_MODE;
  process.env.BOXBOX_MODE = fixtureMode;
  const root = mkdtempSync(path.join(tmpdir(), "www-structure-contract-"));
  try {
    for (const directory of ["src", "scripts/workflow", "test", "docs/architecture", "docs/specs"]) mkdirSync(path.join(root, directory), { recursive: true });
    for (const file of ["src/entry.ts", "build.ts", "scripts/workflow.ts", "scripts/source-policy.ts", "scripts/generate-architecture.ts", "scripts/architecture-contract.ts", "scripts/check-architecture.ts"]) writeFileSync(path.join(root, file), declaration);
    writeFileSync(path.join(root, "test/feature.test.ts"), testSource);
    const nodes = [
      { id: "arch.www", parent: null, title: "WWW", description: "전체 책임", allowedDependencies: [] },
      { id: "arch.feature", parent: "arch.www", title: "기능", description: "독립 기능 책임", allowedDependencies: [] },
    ];
    writeFileSync(path.join(root, "docs/architecture/structure.json"), JSON.stringify({ schemaVersion: 1, rootId: "arch.www", specFiles: ["docs/specs/architecture.md"], nodes }));
    writeFileSync(path.join(root, "docs/specs/architecture.md"), '```architecture-requirements\n[{"id":"FEATURE-OWNERSHIP","nodeId":"arch.feature","description":"기능 책임","implementationRequired":true,"verificationRequired":true}]\n```\n');
    run(root);
  } finally {
    if (previousMode === undefined) delete process.env.BOXBOX_MODE; else process.env.BOXBOX_MODE = previousMode;
    rmSync(root, { recursive: true, force: true });
  }
}
function change(root: string, file: string, transform: (source: string) => string) {
  const target = path.join(root, file);
  writeFileSync(target, transform(readFileSync(target, "utf8")));
}
interface FixtureContract {
  nodes: { id: string; parent: string | null; title: string; description: string; allowedDependencies: string[] }[];
  specFiles: string[];
}
function isFixtureContract(value: unknown): value is FixtureContract {
  if (!value || typeof value !== "object" || !("nodes" in value) || !("specFiles" in value)) return false;
  if (!Array.isArray(value.specFiles) || !value.specFiles.every((file: unknown) => typeof file === "string")) return false;
  return Array.isArray(value.nodes) && value.nodes.every((node: unknown) => {
    if (!node || typeof node !== "object"                                               ) return false;
    if (!("id" in node) || typeof node.id !== "string"                                  ) return false;
    if (!("parent" in node) || (node.parent !== null && typeof node.parent !== "string")) return false;
    if (!("title" in node) || typeof node.title !== "string"                            ) return false;
    if (!("description" in node) || typeof node.description !== "string"                ) return false;
    return "allowedDependencies" in node && Array.isArray(node.allowedDependencies) && node.allowedDependencies.every((id: unknown) => typeof id === "string");
  });
}
function changeContract(root: string, transform: (contract: FixtureContract) => void) {
  change(root, "docs/architecture/structure.json", (source) => {
    const contract: unknown = JSON.parse(source);
    if (!isFixtureContract(contract)) throw Error("fixture 계약 형식 오류");
    transform(contract);
    return JSON.stringify(contract);
  });
}

describe("구조·요구 계약 fixture", () => {
  test("유효 계약을 결정적으로 생성하고 파일을 옮겨도 구조 ID를 보존한다", () => fixture((root) => {
    const before = generateArchitecture(root);
    expect(before).toEqual(generateArchitecture(root));
    expect(before.structure.requirements[0]!.id).toBe("FEATURE-OWNERSHIP");
    renameSync(path.join(root, "src/entry.ts"), path.join(root, "src/moved.ts"));
    expect(generateArchitecture(root).nodes.find((node) => node.file === "src/moved.ts")!.structureId).toBe("arch.feature");
  }));

  test("명세 변경과 오래된 지도는 digest·stale 검사에 반영한다", () => fixture((root) => {
    cpSync(path.join(path.resolve(import.meta.dir, ".."), ".boxbox"), path.join(root, ".boxbox"), { recursive: true });
    mkdirSync(path.join(root, ".www"), { recursive: true });
    cpSync(path.join(path.resolve(import.meta.dir, ".."), ".www/development.local.json"), path.join(root, ".www/development.local.json"));
    const before = writeArchitecture(root);
    expect(writeArchitecture(root, true)).toEqual(before);
    change(root, "docs/specs/architecture.md", (source) => source.replace("기능 책임", "변경된 기능 책임"));
    expect(generateArchitecture(root).digest                                                          ).not.toBe   (before.digest) ;
    expect(() => writeArchitecture(root, true)                                                        )    .toThrow("snapshot"   ) ;
    expect(JSON.parse(readFileSync(path.join(root, "src/architecture.generated.json"), "utf8")).digest)    .toBe   (before.digest) ;
  }));

  test("복수 선행 JSDoc의 구조 태그와 기존 설명을 함께 보존한다", () => fixture((root) => {
    change(root, "src/entry.ts", (source) => source.replace("export const", "/** 기존 설명을 보존한다. */\nexport const"));
    const result = generateArchitecture(root);
    expect(result.structure.declarations.find((entry) => entry.file === "src/entry.ts")?.nodeId).toBe("arch.feature");
    expect(readFileSync(path.join(root, "src/entry.ts"), "utf8")).toContain("기존 설명을 보존한다.");
  }));

  test("catalog의 요구 위치는 fence가 아니라 실제 ID 정의 행이다", () => fixture((root) => {
    change(root, "docs/specs/architecture.md", (source) => source.replace('[{"id"', '[\n  {\n    "id"'));
    const requirement = generateArchitecture(root).structure.requirements[0]!                                     ;
    const row         = readFileSync(path.join(root, requirement.file), "utf8").split("\n")[requirement.line - 1] ;
    expect(row).toContain('"id":"FEATURE-OWNERSHIP"');
    expect(requirement.line).toBe(4);
  }));

  for (const outer of ["````markdown", "~~~~markdown"]) {
    test(`예시 fence ${outer} 속 가짜 catalog는 정의로 받지 않는다`, () => fixture((root) => {
      const original = readFileSync(path.join(root, "docs/specs/architecture.md"), "utf8") ;
      const example  = `${outer}\n${original}${outer.slice(0, 4)}\n`                       ;
      change(root, "docs/specs/architecture.md", () => example);
      expect(() => generateArchitecture(root)).toThrow("catalog");
      change(root, "docs/specs/architecture.md", () => example + original);
      expect(generateArchitecture(root).structure.requirements).toHaveLength(1);
    }));
  }

  const registrations: [string, string, string, boolean][] = [
    ["Bun describe.skip 별칭 부모", "import { test as check, describe as group } from 'bun:test';", "group.skip('부모', () => { check('자식', () => {}); });", false],
    ["Node suite.skip 별칭 부모", "import { it as check, suite as group } from 'node:test';", "group.skip('부모', () => { check('자식', () => {}); });", false],
    ["Node describe.skip 부모", "import { test, describe } from 'node:test';", "describe.skip('부모', () => { test('자식', () => {}); });", false],
    ["Bun 정상 describe 별칭", "import { it as check, describe as group } from 'bun:test';", "group('부모', () => { check('자식', () => {}); });", true],
    ["Node 정상 suite 별칭", "import { test as check, suite as group } from 'node:test';", "group('부모', () => { check('자식', () => {}); });", true],
    ["Node skip true 두 번째 옵션", "import { test as check } from 'node:test';", "check('이름', { skip: true }, () => {});", false],
    ["Node todo true 두 번째 옵션", "import { it as check } from 'node:test';", "check('이름', { todo: true }, () => {});", false],
    ["Node skip true 첫 번째 옵션", "import check from 'node:test';", "check({ skip: true }, () => {});", false],
    ["Node todo true 첫 번째 옵션", "import { test } from 'node:test';", "test({ todo: true }, () => {});", false],
    ["Node skip false 정상 등록", "import { test } from 'node:test';", "test('이름', { skip: false, todo: false }, () => {});", true],
    ["Node suite skip true 옵션 부모", "import { test, suite } from 'node:test';", "suite('부모', { skip: true }, () => { test('자식', () => {}); });", false],
    ["Node suite todo true 옵션 부모", "import { test, suite } from 'node:test';", "suite({ todo: true }, () => { test('자식', () => {}); });", false],
    ["Node suite skip false 정상 부모", "import { test, suite } from 'node:test';", "suite('부모', { skip: false }, () => { test('자식', () => {}); });", true],
    ["Node 세 번째 잘못된 옵션 제외", "import { test } from 'node:test';", "test('이름', () => {}, { skip: true });", false],
    ["Bun 지원 옵션 두 번째 위치", "import { test } from 'bun:test';", "test('이름', { timeout: 100 }, () => {});", true],
    ["Bun 지원 옵션 세 번째 위치", "import { test } from 'bun:test';", "test('이름', () => {}, { timeout: 100 });", true],
    ["제외 부모 밖 정상 등록 보존", "import { test, describe } from 'bun:test';", "describe.skip('부모', () => { test('제외', () => {}); }); test('등록', () => {});", true],
    ["호출 문자열 위장 거부", "import { test } from 'bun:test';", "const fake = \"test('가짜', () => {});\";", false],
    ["호출 주석 위장 거부", "import { test } from 'bun:test';", "/* test('가짜', () => {}); */", false],
  ];
  const nested = "() => { test('자식', () => {}); }";
  for (const callee of ["describe.if(false)", "describe.skipIf(true)", "describe.todoIf(true)",
    "describe.each([1])", "describe.each`행`", "describe.only", "describe.todo", "describe.concurrent",
    "(describe).skip", "describe['skip']", "(describe as unknown)!.skip", "(describe satisfies unknown).skip",
    "describe('반환값', () => {})"]) {
    registrations.push([`Bun 미지원 호출사슬 ${callee}`, "import { test, describe } from 'bun:test';", `${callee}('부모', ${nested});`, false]);
  }
  for (const [imports, callee] of [
    ["import test from 'node:test';", "test.describe.skip"],
    ["import test from 'node:test';", "test.describe"],
    ["import * as framework from 'node:test'; import { test } from 'node:test';", "framework.skip"],
    ["import * as framework from 'bun:test'; import { test } from 'bun:test';", "framework.test"],
    ["import { before as hook, test } from 'node:test';", "hook"],
    ["import { beforeEach as hook, test } from 'bun:test';", "hook"],
  ]) registrations.push([`framework value 루트 ${callee}`, imports!, `${callee}('부모', ${nested});`, false]);
  for (const body of [
    `const helper = describe; helper('부모', ${nested});`,
    `function helper() { test('자식', () => {}); }`,
    `const helper = ${nested};`,
    `[1].forEach(${nested});`,
    `unknownHelper(${nested});`,
    `describe('부모', helper);`,
    `describe('부모', () => { unknownHelper(${nested}); });`,
  ]) registrations.push([`일반 functionlike 본문 제외 ${body}`, "import { test, describe } from 'bun:test';", body, false]);
  for (const framework of ["node:test", "bun:test"]) {
    for (const options of ["opts", "makeOptions()", "{ ...{ timeout: 10 } }", "{ ['timeout']: 10 }",
      "{ timeout }", "{ get timeout() { return 10; } }", "{ timeout() {} }", "{ unknown: false }"]) {
      registrations.push([`${framework} 불명확 옵션 ${options}`, `import { test } from '${framework}';`,
        `test('이름', ${options}, ${nested});`, false]);
    }
  }
  registrations.push(
    ["Node fn", "import test from 'node:test';", "test(() => {});", true]                                                                                                                                     ,
    ["Node 정적 template 이름", "import { it as check } from 'node:test';", "check(`이름`, function () {});", true]                                                                                           ,
    ["Node 빈 옵션", "import { test } from 'node:test';", "test({}, () => {});", true]                                                                                                                        ,
    ["Node 동적 이름 명시 옵션", "import { test } from 'node:test';", "test(dynamicName, {}, () => {});", true]                                                                                               ,
    ["Node 동적 두 인자 모호성", "import { test } from 'node:test';", "test(dynamicName, () => {});", false]                                                                                                  ,
    ["Node template 치환 이름 모호성", "import { test } from 'node:test';", "test(`이름${dynamicName}`, () => {});", false]                                                                                   ,
    ["Node only false", "import { test } from 'node:test';", "test('이름', { only: false }, () => {});", true]                                                                                                ,
    ["Node only true", "import { test } from 'node:test';", "test('이름', { only: true }, () => {});", false]                                                                                                 ,
    ["Node 확인된 옵션 필드", "import { test } from 'node:test';", "test('이름', { concurrency: 1, expectFailure: false, signal, tags: [], timeout: 100, plan: 0 }, () => {});", false]                       ,
    ["Node 확인된 명시 옵션 필드", "import { test } from 'node:test';", "test('이름', { concurrency: 1, expectFailure: false, signal: controller.signal, tags: [], timeout: 100, plan: 0 }, () => {});", true],
    ["Node suite fn", "import { suite, test } from 'node:test';", `suite(${nested});`, true]                                                                                                                  ,
    ["Bun describe fn", "import { describe, test } from 'bun:test';", `describe(${nested});`, true]                                                                                                           ,
    ["Bun 빈 옵션", "import { test } from 'bun:test';", "test('이름', {}, () => {});", true]                                                                                                                  ,
    ["Bun 확인된 필드", "import { test } from 'bun:test';", "test(dynamicName, () => {}, { timeout: 100, retry: 1, repeats: 1 });", true]                                                                     ,
    ["Bun timeout 둘째", "import { test } from 'bun:test';", "test('이름', 100, () => {});", true]                                                                                                            ,
    ["Bun timeout 셋째", "import { test } from 'bun:test';", "test('이름', () => {}, 100);", true]                                                                                                            ,
    ["Bun 미지원 skip 옵션", "import { test } from 'bun:test';", "test('이름', { skip: false }, () => {});", false]                                                                                           ,
    ["Bun 미지원 todo 옵션", "import { test } from 'bun:test';", "test('이름', () => {}, { todo: false });", false]                                                                                           ,
    ["module block 반복 선언", "import { test } from 'bun:test';", "{ for (const name of ['이름']) test(name, () => {}); }", true]                                                                            ,
  );
  // 아래 API 예시는 실행하지 않는 소스 문자열이며 등록 판정만 검사한다.
  for (const api of ["test", "it", "suite", "describe", "alias", "default"]) {
    const imports = api === "default" ? "import check from 'node:test';" :
      api === "alias" ? "import { test as check } from 'node:test';" : `import { ${api} as check, test } from 'node:test';`;
    const body = ["suite", "describe"].includes(api) ? "() => { test('자식', () => {}); }" : "() => {}";
    for (const option of ["skip", "todo"]) for (const [value, accepted] of [
      ["'미구현'", false], ['""', false], ["false", true], ["true", false], ["1", false],
      ["0", false], ["null", false], ["undefined", false], ["unknownOption", false],
      ["Boolean('')", false], ["false ? true : false", false],
    ] as const) for (const named of [true, false]) {
      registrations.push([`Node ${api} ${option}:${value} ${named ? "두 번째" : "첫 번째"} 옵션`, imports,
        `check(${named ? "'이름', " : ""}{ ${option}: ${value} }, ${body});`, accepted]);
    }
    for (const option of ["skip", "todo"]) registrations.push([`Node ${api} ${option} 축약 변수 제외`, imports,
      `const ${option} = unknownOption; check({ ${option} }, ${body});`, false]);
  }
  for (const [name, imports, call, accepted] of registrations) test(name, () => fixture((root) => {
    change(root, "test/feature.test.ts", () => `/** @verifies FEATURE-OWNERSHIP */\n${imports}\n${call}\n`);
    if (accepted) expect(checkArchitectureContract(root, []).declarations.length).toBe(7);
    else expect(() => checkArchitectureContract(root, [])).toThrow("실제 테스트 호출 누락");
  }));

  const invalid: [string, (root: string) => void, string][] = [
    ["같은 행 후행 선언", (root) => change(root, "src/entry.ts", (source) => source.trimEnd() + " /** @implements FEATURE-OWNERSHIP */"), "첫 문장 앞"],
    ["EOF 후행 선언", (root) => change(root, "src/entry.ts", (source) => source + "\n/** @architecture arch.feature */"), "첫 문장 앞"],
    ["후행 복수 JSDoc 선언", (root) => change(root, "src/entry.ts", (source) => source + "\n/** @architecture arch.feature */\n/** 후행 설명 */\nexport const second = 2;"), "첫 문장 앞"],
    ["후행 중복 선언", (root) => change(root, "src/entry.ts", (source) => source + "\n/** @architecture arch.feature */\nexport const second = 2;"), "첫 문장 앞"],
    ["잘못된 요구 ID", (root) => change(root, "src/entry.ts", (source) => source.replace("FEATURE-OWNERSHIP", "feature_invalid")), "잘못된 ID"],
    ["알 수 없는 필드", (root) => change(root, "docs/architecture/structure.json", (source) => source.replace('"schemaVersion":1', '"extra":true,"schemaVersion":1')), "알 수 없는 계약 필드"],
    ["leaf 요구 누락", (root) => change(root, "docs/specs/architecture.md", (source) => source.replace(/\[.*\]/, "[]")), "leaf 요구 누락"],
    ["구조 ID 중복", (root) => changeContract(root, (value) => value.nodes.push(value.nodes[1]!)), "중복 구조 ID"],
    ["부모 누락", (root) => changeContract(root, (value) => { value.nodes[1]!.parent = "arch.absent"; }), "부모 누락"],
    ["부모 순환", (root) => changeContract(root, (value) => { value.nodes[1]!.parent = "arch.feature"; }), "부모 순환"],
    ["복수 root", (root) => changeContract(root, (value) => { value.nodes[1]!.parent = null; }), "단일 root"],
    ["wildcard", (root) => changeContract(root, (value) => { value.nodes[1]!.allowedDependencies = ["*"]; }), "잘못된 ID"],
    ["미정의 허용 대상", (root) => changeContract(root, (value) => { value.nodes[1]!.allowedDependencies = ["arch.absent"]; }), "미정의 허용 의존성"],
    ["미정의 요구 구조", (root) => change(root, "docs/specs/architecture.md", (source) => source.replace("arch.feature", "arch.absent")), "미정의 요구 구조"],
    ["중복 요구", (root) => change(root, "docs/specs/architecture.md", (source) => source.replace(/\[(.*)\]/, "[$1,$1]")), "중복 요구 ID"],
    ["구조 선언 누락", (root) => change(root, "src/entry.ts", () => "export const marker = 1;"), "구조 선언"],
    ["구조 선언 중복", (root) => change(root, "src/entry.ts", (source) => source.replace("@architecture arch.feature", "@architecture arch.feature\n * @architecture arch.feature")), "구조 선언"],
    ["미정의 구조", (root) => change(root, "src/entry.ts", (source) => source.replace("arch.feature", "arch.absent")), "미정의 구조"],
    ["미정의 요구", (root) => change(root, "src/entry.ts", (source) => source.replace("FEATURE-OWNERSHIP", "FEATURE-UNKNOWN")), "미정의 요구"],
    ["구현 선언 누락", (root) => change(root, "src/entry.ts", (source) => source.replace(" * @implements FEATURE-OWNERSHIP\n", "")), "구현 선언 누락"],
    ["구현 선언 중복", (root) => change(root, "src/entry.ts", (source) => source.replace("@implements FEATURE-OWNERSHIP", "@implements FEATURE-OWNERSHIP\n * @implements FEATURE-OWNERSHIP")), "중복"],
    ["요구 소속 불일치", (root) => change(root, "src/entry.ts", (source) => source.replace("arch.feature", "arch.www")), "소속 불일치"],
    ["필수 테스트 누락", (root) => change(root, "test/feature.test.ts", () => "export const value = 1;"), "필수 검증 누락"],
    ["실제 테스트 호출 누락", (root) => change(root, "test/feature.test.ts", () => "/** @verifies FEATURE-OWNERSHIP */\nexport const value = 1;"), "실제 테스트 호출 누락"],
    ["skip 테스트", (root) => change(root, "test/feature.test.ts", (source) => source.replace("test(", "test.skip(")), "실제 테스트 호출 누락"],
    ["미정의 검증 요구", (root) => change(root, "test/feature.test.ts", (source) => source.replace("FEATURE-OWNERSHIP", "FEATURE-UNKNOWN")), "미정의 검증 요구"],
    ["문자열 위장", (root) => change(root, "src/entry.ts", () => `const fake = ${JSON.stringify(declaration)};`), "구조 선언"],
    ["일반 주석 위장", (root) => change(root, "src/entry.ts", (source) => source.replace("/**", "/*")), "구조 선언"],
    ["명세 경로 탈출", (root) => changeContract(root, (value) => { value.specFiles = ["../escape.md"]; }), "안전하지 않은 경로"],
    ["소스 symlink", (root) => { renameSync(path.join(root, "src/entry.ts"), path.join(root, "original.ts")); symlinkSync(path.join(root, "original.ts"), path.join(root, "src/entry.ts")); }, "심볼릭 링크"],
  ];
  for (const [name, mutate, error] of invalid) test(name, () => fixture((root) => {
    mutate(root);
    expect(() => generateArchitecture(root)).toThrow(error);
  }));

  test("추가된 필수 구현의 누락을 차단한다", () => fixture((root) => {
    change(root, "docs/specs/architecture.md", (source) => source.replace(/\[(.*)\]/, '[$1,{"id":"FEATURE-ADDITIONAL","nodeId":"arch.feature","description":"추가 책임","implementationRequired":true,"verificationRequired":true}]'));
    expect(() => generateArchitecture(root)).toThrow("필수 구현 누락");
  }));

  test("부모·자식 의존성도 명시 허용이 있어야 한다", () => fixture((root) => {
    changeContract(root, (value) => { value.nodes[0]!.allowedDependencies = []; });
    change(root, "build.ts", (source) => source.replace("arch.feature", "arch.www").replace("FEATURE-OWNERSHIP", "ROOT-OWNERSHIP"));
    change(root, "docs/specs/architecture.md", (source) => source.replace(/\[(.*)\]/, '[$1,{"id":"ROOT-OWNERSHIP","nodeId":"arch.www","description":"전체 책임","implementationRequired":true,"verificationRequired":false}]'));
    const edges = [{ from: "build.ts", to: "src/entry.ts" }];
    expect(() => checkArchitectureContract(root, edges)).toThrow("미허용 의존성");
    change(root, "build.ts", (source) => source + '\nimport "./src/entry.ts";\n');
    expect(() => generateArchitecture(root)).toThrow("미허용 의존성");
    changeContract(root, (value) => { value.nodes[0]!.allowedDependencies = ["arch.feature"]; });
    expect(checkArchitectureContract(root, edges).declarations.length).toBe(7);
    expect(generateArchitecture(root).edges).toHaveLength(1);
  }));

  test("부분 파일 목록으로 제품 계약을 우회할 수 없다", () => fixture((root) => {
    expect(() => generateArchitecture(root, ["src/entry.ts"])).toThrow("생략할 수 없습니다");
  }));
});
