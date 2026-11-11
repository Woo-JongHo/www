import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateRepository, validateWorkRecord } from "../scripts/check-workflow.mjs";

function initial(overrides = {}) {
  return {
    schemaVersion: 1,
    id: "work-123e4567-e89b-42d3-a456-426614174000",
    title: "예시 작업",
    kind: "feature",
    areas: ["ui", "dev"],
    owner: "ui",
    status: "draft",
    blockedReason: null,
    relations: [],
    criteria: [{ id: "AC-1", description: "관찰 가능한 결과", required: true, result: "unverified", evidence: [] }],
    ...overrides,
  };
}

function messages(record, options) {
  return validateWorkRecord(record, options).join("\n");
}

test("유효한 초기 작업 기록을 허용한다", () => {
  assert.deepEqual(validateWorkRecord(initial()), []);
});

test("잘못된 상태를 거부한다", () => {
  assert.match(messages(initial({ status: "complete" })), /status/);
});

test("영역에 없는 주 책임과 잘못된 영역을 거부한다", () => {
  assert.match(messages(initial({ areas: ["ui", "sales"], owner: "dev" })), /areas/);
  assert.match(messages(initial({ areas: ["ui"], owner: "dev" })), /owner/);
});

test("작업 디렉터리를 벗어나는 증거 경로를 거부한다", () => {
  const criterion = { id: "AC-1", description: "결과", required: true, result: "passed", evidence: [{ path: "../verification.md#attempt-1", summary: "요약" }] };
  assert.match(messages(initial({ criteria: [criterion] })), /벗어납니다|verification\.md#앵커/);
});

test("done 상태의 미검증 필수 기준을 거부한다", () => {
  assert.match(messages(initial({ status: "done" })), /passed/);
});

test("done 상태의 증거 없는 통과를 거부한다", () => {
  const criterion = { id: "AC-1", description: "결과", required: true, result: "passed", evidence: [] };
  assert.match(messages(initial({ status: "done", criteria: [criterion] })), /증거가 필요/);
});

test("차단된 done 상태를 거부한다", () => {
  const dir = mkdtempSync(join(tmpdir(), "www-workflow-"));
  writeFileSync(join(dir, "verification.md"), '<a id="attempt-1"></a>\n통과');
  const criterion = { id: "AC-1", description: "결과", required: true, result: "passed", evidence: [{ path: "verification.md#attempt-1", summary: "통과" }] };
  assert.match(messages(initial({ status: "done", blockedReason: "외부 승인 대기", criteria: [criterion] }), { baseDir: dir }), /blockedReason/);
});

test("선택 기준 required=false는 done에서 미검증이어도 허용한다", () => {
  const dir = mkdtempSync(join(tmpdir(), "www-workflow-"));
  writeFileSync(join(dir, "verification.md"), '<a id="attempt-1"></a>\n통과');
  const required = { id: "AC-1", description: "필수", required: true, result: "passed", evidence: [{ path: "verification.md#attempt-1", summary: "통과" }] };
  const optional = { id: "AC-2", description: "선택", required: false, result: "unverified", evidence: [] };
  assert.deepEqual(validateWorkRecord(initial({ status: "done", criteria: [required, optional] }), { baseDir: dir }), []);
});

function skillFixture(discovery = "correct") {
  const root = mkdtempSync(join(tmpdir(), "www-repository-"));
  const names = ["www-spec", "www-design", "www-build", "www-diagnose", "www-verify", "www-commit"];
  for (const path of ["docs/skills/profiles", "docs/skills/examples", "docs/skills/templates", "docs/work", "skills/www", ".agents/skills"]) {
    mkdirSync(join(root, path), { recursive: true });
  }
  writeFileSync(join(root, "docs/skills/WORKFLOW.md"), "# 계약\n");
  writeFileSync(join(root, "docs/skills/profiles/desktop.md"), "# 프로필\n");
  writeFileSync(join(root, "docs/skills/examples/approval-waiting.md"), "# 예시\n");
  writeFileSync(join(root, "docs/skills/templates/work.json"), `${JSON.stringify(initial())}\n`);
  writeFileSync(join(root, "docs/skills/templates/commit.md"), "# 커밋 준비\n");
  writeFileSync(join(root, "docs/work/INDEX.md"), "# 작업 목차\n");
  for (const name of names) {
    const canonical = join(root, "skills/www", name);
    mkdirSync(canonical);
    writeFileSync(join(canonical, "SKILL.md"), `---\nname: ${name}\n---\n\n${["호출 조건", "입력", "진입 조건", "절차", "출력 경로", "허용 변경", "완료 조건", "인계"].map((heading) => `## ${heading}`).join("\n")}\n\n[계약](../../../docs/skills/WORKFLOW.md)\n[템플릿](../../../docs/skills/templates/work.json)\n`);
    const link = join(root, ".agents/skills", name);
    if (discovery === "copy" && name === "www-spec") {
      mkdirSync(link);
      writeFileSync(join(link, "SKILL.md"), "duplicate");
    } else if (discovery === "external" && name === "www-spec") {
      symlinkSync(tmpdir(), link);
    } else {
      symlinkSync(`../../skills/www/${name}`, link);
    }
  }
  return root;
}

test("정본 스킬과 저장소 내부 발견 링크를 허용한다", () => {
  assert.deepEqual(validateRepository(skillFixture()), []);
});

test("커밋 스킬 정본이 없으면 발견 링크만 있어도 거부한다", () => {
  const root = skillFixture();
  unlinkSync(join(root, "skills/www/www-commit/SKILL.md"));
  assert.match(validateRepository(root).join("\n"), /www-commit 정본 스킬 파일이 없습니다/);
});

test("커밋 준비 양식이 없으면 거부한다", () => {
  const root = skillFixture();
  unlinkSync(join(root, "docs/skills/templates/commit.md"));
  assert.match(validateRepository(root).join("\n"), /필수 파일이 없습니다: docs\/skills\/templates\/commit\.md/);
});

test("발견 위치의 중복 복사본을 거부한다", () => {
  assert.match(validateRepository(skillFixture("copy")).join("\n"), /심볼릭 링크/);
});

test("외부 또는 잘못된 발견 링크를 거부한다", () => {
  assert.match(validateRepository(skillFixture("external")).join("\n"), /의도한 정본/);
});

function addWork(root, area, folder, record = initial(), files = {}) {
  const dir = join(root, "docs/work", area, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "work.json"), files.workJson ?? `${JSON.stringify(record)}\n`);
  if (!files.omitSpec) writeFileSync(join(dir, "spec.md"), "# 명세\n");
  return dir;
}

test("한글·공백 경로와 UUID와 독립된 폴더명을 허용한다", () => {
  const root = skillFixture();
  addWork(root, "새영역", "001-한글 작업 이름");
  writeFileSync(join(root, "docs/work/INDEX.md"), "# 목차\n[명세](%EC%83%88%EC%98%81%EC%97%AD/001-%ED%95%9C%EA%B8%80%20%EC%9E%91%EC%97%85%20%EC%9D%B4%EB%A6%84/spec.md)\n");
  assert.deepEqual(validateRepository(root), []);
});

test("옛 flat 작업 경로를 거부한다", () => {
  const root = skillFixture();
  addWork(root, "", "work-123e4567-e89b-42d3-a456-426614174000");
  assert.match(validateRepository(root).join("\n"), /작업 폴더|영역/);
});

test("0·잘못된 형식·같은 숫자의 중복 번호를 거부한다", () => {
  const root = skillFixture();
  addWork(root, "Chat", "000-영번", initial({ id: "work-223e4567-e89b-42d3-a456-426614174000" }));
  addWork(root, "Chat", "001-첫째", initial());
  addWork(root, "Chat", "0001-중복", initial({ id: "work-323e4567-e89b-42d3-a456-426614174000" }));
  assert.match(validateRepository(root).join("\n"), /0이 아닌|중복/);
});

test("중복 UUID를 거부한다", () => {
  const root = skillFixture();
  addWork(root, "Chat", "001-첫째");
  addWork(root, "Workflow", "001-둘째");
  assert.match(validateRepository(root).join("\n"), /UUID가 중복/);
});

test("작업 트리의 외부 심볼릭 링크를 거부한다", () => {
  const root = skillFixture();
  mkdirSync(join(root, "docs/work/Chat"));
  symlinkSync(tmpdir(), join(root, "docs/work/Chat/001-외부"));
  assert.match(validateRepository(root).join("\n"), /심볼릭 링크/);
});

test("이관 작업의 evidence 앵커를 실제 폴더 기준으로 확인한다", () => {
  const root = skillFixture();
  const dir = addWork(root, "Chat", "001-이관", initial({
    status: "done",
    criteria: [{ id: "AC-1", description: "결과", required: true, result: "passed", evidence: [{ path: "verification.md#attempt-1", summary: "통과" }] }],
  }));
  writeFileSync(join(dir, "verification.md"), '<a id="attempt-1"></a>\n통과\n');
  assert.deepEqual(validateRepository(root), []);
});

test("목차의 깨진 링크와 malformed encoding을 진단한다", () => {
  const root = skillFixture();
  writeFileSync(join(root, "docs/work/INDEX.md"), "# 목차\n[인코딩](Chat/001-%ZZ/spec.md)\n[깨짐](Chat/001-%EC%97%86%EC%9D%8C/spec.md)\n");
  const errors = validateRepository(root).join("\n");
  assert.match(errors, /encoding/);
  assert.match(errors, /로컬 링크가 깨졌습니다/);
});

test("잘못된 작업 객체와 null 관계·기준은 예외 대신 진단한다", () => {
  const root = skillFixture();
  addWork(root, "Chat", "001-객체 아님", null);
  addWork(root, "Chat", "002-잘못된 배열", initial({ relations: [null], criteria: [null], status: "done" }));
  const errors = validateRepository(root).join("\n");
  assert.match(errors, /JSON 객체/);
  assert.match(errors, /relations\[0\]/);
  assert.match(errors, /criteria\[0\]/);
});

test("UUID 대소문자가 달라도 중복을 감지하고 관계를 해석한다", () => {
  const root = skillFixture();
  addWork(root, "Chat", "001-원본");
  addWork(root, "Workflow", "001-참조", initial({
    id: "work-223e4567-e89b-42d3-a456-426614174000",
    relations: [{ type: "relates_to", target: initial().id.toUpperCase() }],
  }));
  assert.deepEqual(validateRepository(root), []);
  addWork(root, "Chat", "002-중복", initial({ id: initial().id.toUpperCase() }));
  assert.match(validateRepository(root).join("\n"), /UUID가 중복/);
});

test("work.json 파일의 외부 심볼릭 링크를 읽지 않는다", () => {
  const root = skillFixture();
  const dir = addWork(root, "Chat", "001-외부 기록");
  const external = join(mkdtempSync(join(tmpdir(), "www-external-")), "record.json");
  writeFileSync(external, JSON.stringify(initial()));
  unlinkSync(join(dir, "work.json"));
  symlinkSync(external, join(dir, "work.json"));
  assert.match(validateRepository(root).join("\n"), /작업 파일 심볼릭 링크/);
});
