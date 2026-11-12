import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validateSkillLibrary } from "../scripts/check-skill-library.ts";

interface SourceFixture {
  id                         : string                              ;
  url                        : string                              ;
  commit                     : string                              ;
  snapshotRoot               : string                              ;
  copiedPaths                : string[]                            ;
  license                    : string                              ;
  copiedLicenseFiles         : string[]                            ;
  categories                 : string[]                            ;
  missingRuntimeDependencies : string[]                            ;
  additionalLicenses?        : { license: string; file: string }[] ;
}
interface InventoryFixture {
  source         : string ;
  originPath     : string ;
  localPath      : string ;
  sha256         : string ;
  bytes          : number ;
  originalSha256 : string ;
  originalBytes  : number ;
  language       : string ;
}
interface SourcesFixture {
  schemaVersion : number;
  translation   : { mode: string; language: string };
  sources       : SourceFixture[]
}
interface InventoryDocument {
  schemaVersion : number;
  files         : InventoryFixture[]
}

const sha    = (body: string) => createHash("sha256").update(body).digest("hex") ;
const notice = "> 한국어 번역본: 고정 원문의 자연어를 번역해 수정한 문서입니다." ;

async function fixture() {
  const root                          = await mkdtemp(path.join(tmpdir(), "www-skill-library-"))                            ;
  const sources   : SourcesFixture    = { schemaVersion: 2, translation: { mode: "replace", language: "ko" }, sources: [] } ;
  const inventory : InventoryDocument = { schemaVersion: 2, files: [] }                                                     ;
  for (let index = 0; index < 7; index++) {
    const id           = `source-${index}`              ;
    const snapshotRoot = `skill-library/upstream/${id}` ;
    await mkdir(path.join(root, snapshotRoot), { recursive: true });
    sources.sources.push({ id, url: `https://github.com/example/${id}`, commit: "a".repeat(40), snapshotRoot, copiedPaths: ["LICENSE", "SKILL.md"], license: index === 6 ? "Apache-2.0" : "MIT", copiedLicenseFiles: ["LICENSE"], categories: ["verification"], missingRuntimeDependencies: ["테스트 자료이며 실제 호스트는 포함하지 않습니다."] });
    const license    = index === 6 ? "Apache License\nVersion 2.0, January 2004\n" : "Permission is hereby granted, free of charge, to any person obtaining a copy.\n" ;
    const original   = "# Verification\nObserve actual behavior before reporting success.\n"                                                                           ;
    const translated = `${notice}\n\n# 검증\n성공을 보고하기 전에 실제 동작을 관찰합니다.\n`                                                                           ;
    for (const [originPath, body, before, language] of [["LICENSE", license, license, "original"], ["SKILL.md", translated, original, "ko"]]) {
      const localPath = `${snapshotRoot}/${originPath}`;
      await writeFile(path.join(root, localPath), body);
      inventory.files.push({ source: id, originPath, localPath, sha256: sha(body), bytes: Buffer.byteLength(body), originalSha256: sha(before), originalBytes: Buffer.byteLength(before), language });
    }
  }
  await save(root, sources, inventory);
  return { root, sources, inventory };
}

async function save(root: string, sources: SourcesFixture, inventory: InventoryDocument) {
  await writeFile(path.join(root, "skill-library/sources.json"), JSON.stringify(sources));
  await writeFile(path.join(root, "skill-library/inventory.json"), JSON.stringify(inventory));
}

async function withFixture(run: (state: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  const state = await fixture();
  try { await run(state); }
  finally { await rm(state.root, { recursive: true, force: true }); }
}

test("한국어 수정본과 원문 법문·출처를 구분해 오프라인 검증한다", async () => {
  await withFixture(async ({ root }) => {
    const result = await validateSkillLibrary(root);
    assert.equal(result.translated, 7);
    assert.equal(result.preserved, 7);
    assert.equal(result.files, 14);
  });
});

test("파일을 수정하고 현재 해시를 갱신하지 않으면 거부한다", async () => {
  await withFixture(async ({ root, inventory }) => {
    const file = inventory.files.find((item) => item.language === "ko");
    assert.ok(file);
    await writeFile(path.join(root, file.localPath), "수정됐지만 검토하지 않은 내용");
    await assert.rejects(validateSkillLibrary(root), /현재 파일 해시·크기 불일치/);
  });
});

test("법문 변경을 번역본의 새 해시로 세탁할 수 없다", async () => {
  await withFixture(async ({ root, sources, inventory }) => {
    const file = inventory.files[0]                                                        ;
    const body = `${await readFile(path.join(root, file.localPath), "utf8")}추가한 내용\n` ;
    await writeFile(path.join(root, file.localPath), body);
    file.sha256 = sha(body);
    file.bytes = Buffer.byteLength(body);
    await save(root, sources, inventory);
    await assert.rejects(validateSkillLibrary(root), /법문·코드 원문이 변경/);
  });
});

test("Apache 법문을 MIT로 잘못 표시하면 실제 내용과 대조해 거부한다", async () => {
  await withFixture(async ({ root, sources, inventory }) => {
    sources.sources[6].license = "MIT";
    await save(root, sources, inventory);
    await assert.rejects(validateSkillLibrary(root), /선언과 실제 법문이 일치하지 않습니다/);
  });
});

test("한국어 고지만 붙인 영어 본문은 번역 완료로 받지 않는다", async () => {
  await withFixture(async ({ root, sources, inventory }) => {
    const file = inventory.files.find((item) => item.language === "ko");
    assert.ok(file);
    const body = `${notice}\n\n# Verification\nObserve the actual behavior before reporting success.\n`;
    await writeFile(path.join(root, file.localPath), body);
    file.sha256 = sha(body);
    file.bytes = Buffer.byteLength(body);
    await save(root, sources, inventory);
    await assert.rejects(validateSkillLibrary(root), /한국어 본문이 없습니다/);
  });
});

test("번역의 원문 해시를 없애거나 잘못된 값으로 바꾸면 거부한다", async () => {
  await withFixture(async ({ root, sources, inventory }) => {
    inventory.files[1].originalSha256 = "확인하지 못한 원문";
    await save(root, sources, inventory);
    await assert.rejects(validateSkillLibrary(root), /원문·번역본 해시가 필요/);
  });
});

test("검증되지 않은 추가 파일을 게시 목록에 조용히 섞지 않는다", async () => {
  await withFixture(async ({ root }) => {
    await writeFile(path.join(root, "skill-library/upstream/source-0/unreviewed.md"), "미검토 문서");
    await assert.rejects(validateSkillLibrary(root), /목록에 없는 보관 파일/);
  });
});

test("보관 파일을 외부 파일의 심볼릭 링크로 바꾸면 읽지 않고 거부한다", async () => {
  await withFixture(async ({ root, inventory }) => {
    const file    = path.join(root, inventory.files[1].localPath) ;
    const outside = path.join(root, "outside.md"                ) ;
    await writeFile(outside, "테스트용 외부 내용");
    await rm(file);
    await symlink(outside, file);
    await assert.rejects(validateSkillLibrary(root), /일반 파일이 아닌 항목/);
  });
});

test("기존 원문 전용 스키마를 번역본 검증으로 오인하지 않는다", async () => {
  await withFixture(async ({ root, sources, inventory }) => {
    inventory.schemaVersion = 1;
    await save(root, sources, inventory);
    await assert.rejects(validateSkillLibrary(root), /schemaVersion 2/);
  });
});

test("하위 디렉터리 출처 URL을 허용해도 main을 고정 커밋으로 받지 않는다", async () => {
  await withFixture(async ({ root, sources, inventory }) => {
    sources.sources[0].url = "https://github.com/example/source-0/tree/main/skills";
    await save(root, sources, inventory);
    await validateSkillLibrary(root);
    sources.sources[0].commit = "main";
    await save(root, sources, inventory);
    await assert.rejects(validateSkillLibrary(root), /전체 원문 커밋 SHA/);
  });
});

test("주 라이선스가 맞아도 제3자 라이선스의 실제 법문이 다르면 거부한다", async () => {
  await withFixture(async ({ root, sources, inventory }) => {
    sources.sources[0].additionalLicenses = [{ license: "Apache-2.0", file: "LICENSE" }];
    await save(root, sources, inventory);
    await assert.rejects(validateSkillLibrary(root), /제3자 법문 누락·불일치/);
  });
});

test("에이전트 UI와 절 manifest의 한국어도 번역 대상에 포함한다", async () => {
  await withFixture(async ({ root, sources, inventory }) => {
    const source = sources.sources[0];
    const additions = [
      ["agents/openai.yaml", "interface:\n  display_name: Review\n", "interface:\n  display_name: 검토\n"],
      ["sections/manifest.json", '{"sections":[{"id":"review","title":"Review"}]}', '{"sections":[{"id":"review","title":"검토"}]}'],
    ];
    for (const [originPath, original, body] of additions) {
      const localPath = `${source.snapshotRoot}/${originPath}`;
      await mkdir(path.dirname(path.join(root, localPath)), { recursive: true });
      await writeFile(path.join(root, localPath), body);
      source.copiedPaths.push(originPath);
      inventory.files.push({ source: source.id, originPath, localPath, sha256: sha(body), bytes: Buffer.byteLength(body), originalSha256: sha(original), originalBytes: Buffer.byteLength(original), language: "ko" });
    }
    await save(root, sources, inventory);
    const result = await validateSkillLibrary(root);
    assert.equal(result.translated, 9);
    assert.equal(result.preserved, 7);
  });
});
