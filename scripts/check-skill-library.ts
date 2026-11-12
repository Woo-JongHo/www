import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

interface LibrarySource {
  id                         : string                            ;
  url                        : string                            ;
  commit                     : string                            ;
  snapshotRoot               : string                            ;
  categories                 : string[]                          ;
  missingRuntimeDependencies : string[]                          ;
  copiedLicenseFiles         : string[]                          ;
  copiedPaths                : string[]                          ;
  license                    : string                            ;
  additionalLicenses?        : {file: string; license: string}[] ;
}
interface InventoryFile {
  source         : string ;
  originPath     : string ;
  localPath      : string ;
  sha256         : string ;
  originalSha256 : string ;
  bytes          : number ;
  originalBytes  : number ;
  language       : string ;
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === "string"); }
function sourceShape(value: unknown): value is LibrarySource {
  return object(value) && typeof value.id === "string" && typeof value.url === "string" && typeof value.commit === "string" && typeof value.snapshotRoot === "string" && typeof value.license === "string"
    && strings(value.categories) && strings(value.missingRuntimeDependencies) && strings(value.copiedLicenseFiles) && strings(value.copiedPaths)
    && (value.additionalLicenses === undefined || (Array.isArray(value.additionalLicenses) && value.additionalLicenses.every(item => object(item) && typeof item.file === "string" && typeof item.license === "string")));
}
function fileShape(value: unknown): value is InventoryFile {
  return object(value) && typeof value.source === "string" && typeof value.originPath === "string" && typeof value.localPath === "string" && typeof value.sha256 === "string" && typeof value.originalSha256 === "string" && typeof value.bytes === "number" && typeof value.originalBytes === "number" && typeof value.language === "string";
}

const categories        = new Set(["requirements", "design", "implementation", "verification"])           ;
const discoverySegments = new Set([".agents", ".claude", ".codex", ".gjc"])                               ;
const digest            = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex") ;
function fail(message: string): never { throw new Error(message); }

function matchesLicense(license: string, body: string | undefined): boolean {
  if (body === undefined      ) return false;
  if (license === "MIT"       ) return /Permission is hereby granted, free of charge/i.test(body);
  if (license === "Apache-2.0") return /Apache License/.test(body) && /Version 2\.0, January 2004/.test(body);
  return false;
}

function relativePath(value: unknown): string {
  if (typeof value !== "string" || !value || value.includes("\\") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) fail("상대 경로가 필요합니다.");
  if (value.split("/").some((part) => !part || part === "." || part === "..")) fail(`경로 탈출 또는 비정규 경로: ${value}`);
  return value;
}

export async function validateSkillLibrary(root: string) {
  const library = path.resolve(root, "skill-library") ;
  const info    = await lstat(library)                ;
  if (!info.isDirectory() || info.isSymbolicLink()) fail("라이브러리는 실제 디렉터리여야 합니다.");
  const canonical = await realpath(library);
  const readLocal = async (relative: string) => {
    relativePath(relative);
    const local  = path.resolve (root, relative) ;
    const within = path.relative(library, local) ;
    if (!within || within.startsWith(`..${path.sep}`) || within === ".." || path.isAbsolute(within)) fail(`라이브러리 밖 경로: ${relative}`);
    const stat = await lstat(local);
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`일반 파일이 아닌 항목: ${relative}`);
    if (await realpath(local) !== path.join(canonical, within)) fail(`심볼릭 링크 경유 경로: ${relative}`);
    return readFile(local);
  };
  const sources   : unknown = JSON.parse((await readLocal("skill-library/sources.json")).toString("utf8")  ) ;
  const inventory : unknown = JSON.parse((await readLocal("skill-library/inventory.json")).toString("utf8")) ;
  if (!object(sources) || !object(inventory) || sources.schemaVersion !== 2 || inventory.schemaVersion !== 2) fail("한국어 대체본 schemaVersion 2가 필요합니다.");
  if (!object(sources.translation) || sources.translation.mode !== "replace" || sources.translation.language !== "ko") fail("한국어 대체 번역 정책이 필요합니다.");
  if (!Array.isArray(sources.sources) || sources.sources.length !== 7) fail("고정된 일곱 출처가 필요합니다.");
  if (!Array.isArray(inventory.files) || !inventory.files.length) fail("파일 목록이 비어 있습니다.");
  const bySource = new Map<string, { source: LibrarySource; paths: Set<string>; legal: Set<string> }>();
  for (const source of sources.sources) {
    if (!sourceShape(source)) fail("출처 항목의 필드 형식이 올바르지 않습니다.");
    if (!/^[a-z0-9-]+$/.test(source.id) || bySource.has(source.id)) fail("중복 또는 잘못된 출처 ID입니다.");
    if (typeof source.url !== "string" || !/^https:\/\/github\.com\/[^/?#]+\/[^/?#]+(?:\/tree\/[^?#]+)?$/.test(source.url)) fail(`원문 저장소 URL이 필요합니다: ${source.id}`);
    if (!/^[0-9a-f]{40}$/.test(source.commit)) fail(`전체 원문 커밋 SHA가 필요합니다: ${source.id}`);
    if (source.snapshotRoot !== `skill-library/upstream/${source.id}`) fail(`잘못된 출처 디렉터리: ${source.id}`);
    if (source.snapshotRoot.split("/").some((part) => discoverySegments.has(part))) fail("자동 발견 디렉터리를 사용할 수 없습니다.");
    if (!Array.isArray(source.categories) || !source.categories.length || source.categories.some((value) => !categories.has(value))) fail(`잘못된 분류: ${source.id}`);
    if (!Array.isArray(source.missingRuntimeDependencies) || !source.missingRuntimeDependencies.length) fail(`런타임 한계 설명이 필요합니다: ${source.id}`);
    if (!Array.isArray(source.copiedLicenseFiles) || !source.copiedLicenseFiles.length) fail(`라이선스 파일이 필요합니다: ${source.id}`);
    if (!Array.isArray(source.copiedPaths) || !source.copiedPaths.length || new Set(source.copiedPaths).size !== source.copiedPaths.length) fail(`잘못된 복사 목록: ${source.id}`);
    for (const copied of source.copiedPaths) relativePath(copied);
    let licenseFound    = false                     ;
    const licenseBodies = new Map<string, string>() ;
    for (const license of source.copiedLicenseFiles) {
      if (!source.copiedPaths.includes(license)) fail(`라이선스가 목록에 없습니다: ${source.id}`);
      const body = (await readLocal(`${source.snapshotRoot}/${relativePath(license)}`)).toString("utf8");
      licenseBodies.set(license, body);
      if (matchesLicense(source.license, body)) licenseFound = true;
    }
    if (!licenseFound) fail(`선언과 실제 법문이 일치하지 않습니다: ${source.id}`);
    if (source.additionalLicenses !== undefined && !Array.isArray(source.additionalLicenses)) fail(`잘못된 제3자 라이선스 목록: ${source.id}`);
    for (const extra of source.additionalLicenses ?? []) {
      if (!licenseBodies.has(extra.file) || !matchesLicense(extra.license, licenseBodies.get(extra.file))) fail(`제3자 법문 누락·불일치: ${source.id}`);
    }
    bySource.set(source.id, { source, paths: new Set<string>(), legal: new Set(source.copiedLicenseFiles) });
  }
  const localPaths = new Set<string>() ;
  let totalBytes   = 0                 ;
  let translated   = 0                 ;
  let preserved    = 0                 ;
  for (const file of inventory.files) {
    if (!fileShape(file)) fail("파일 목록 항목의 필드 형식이 올바르지 않습니다.");
    const entry = bySource.get(file.source);
    if (!entry) fail(`알 수 없는 출처: ${file.source}`);
    relativePath(file.originPath);
    if (file.localPath !== `${entry.source.snapshotRoot}/${file.originPath}` || localPaths.has(file.localPath)) fail(`중복 또는 출처와 다른 파일 경로: ${file.localPath}`);
    if (!/^[0-9a-f]{64}$/.test(file.sha256) || !/^[0-9a-f]{64}$/.test(file.originalSha256)) fail(`원문·번역본 해시가 필요합니다: ${file.localPath}`);
    if (!Number.isInteger(file.bytes) || file.bytes < 0 || !Number.isInteger(file.originalBytes) || file.originalBytes < 0) fail(`잘못된 파일 크기: ${file.localPath}`);
    const bytes = await readLocal(file.localPath);
    if (digest(bytes) !== file.sha256 || bytes.byteLength !== file.bytes) fail(`현재 파일 해시·크기 불일치: ${file.localPath}`);
    const isTranslation = !entry.legal.has(file.originPath) && (/\.(?:md|ya?ml)$/.test(file.originPath) || /(?:^|\/)sections\/manifest\.json$/.test(file.originPath));
    if (isTranslation) {
      if (file.language !== "ko" || file.sha256 === file.originalSha256) fail(`번역되지 않은 문서: ${file.localPath}`);
      const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (file.originPath.endsWith(".md") && !body.includes("> 한국어 번역본:")) fail(`수정 고지가 없습니다: ${file.localPath}`);
      const prose = body.split("\n").filter((line) => !line.startsWith("> 한국어 번역본:")).join("\n");
      if (!/\p{Script=Hangul}/u.test(prose)) fail(`한국어 본문이 없습니다: ${file.localPath}`);
      translated++;
    } else {
      if (file.language !== "original" || file.sha256 !== file.originalSha256 || file.bytes !== file.originalBytes) fail(`법문·코드 원문이 변경됐습니다: ${file.localPath}`);
      preserved++;
    }
    localPaths.add(file.localPath);
    entry.paths.add(file.originPath);
    totalBytes += bytes.byteLength;
  }
  for (const { source, paths } of bySource.values()) {
    if (source.copiedPaths.length !== paths.size || source.copiedPaths.some((file) => !paths.has(file))) fail(`출처와 파일 목록 불일치: ${source.id}`);
  }
  const inspectDirectory = async (directory: string): Promise<void> => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const local    = path.join(directory, item.name)                      ;
      const relative = path.relative(root, local).split(path.sep).join("/") ;
      if (item.isSymbolicLink()) fail(`보관소 심볼릭 링크: ${relative}`);
      if (item.isDirectory()) await inspectDirectory(local);
      else if (!item.isFile() || !localPaths.has(relative)) fail(`목록에 없는 보관 파일: ${relative}`);
    }
  };
  await inspectDirectory(path.join(library, "upstream"));
  return { sources: bySource.size, files: localPaths.size, translated, preserved, bytes: totalBytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateSkillLibrary(process.cwd());
  console.log(`스킬 라이브러리 검증 통과: 출처 ${result.sources}개, 파일 ${result.files}개, 한국어 문서 ${result.translated}개, 원문 보존 ${result.preserved}개, ${result.bytes}바이트`);
  console.log("이 검사는 경로·라이선스 표기·수정 고지·해시·한국어 존재를 확인하며 문장별 번역 정확성을 보증하지 않습니다.");
}
