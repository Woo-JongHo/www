import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = ["www-spec", "www-design", "www-build", "www-diagnose", "www-verify", "www-commit"];
const STATUSES = new Set(["draft", "ready", "in_progress", "verifying", "done", "cancelled"]);
const KINDS = new Set(["feature", "bug", "maintenance"]);
const AREAS = new Set(["ui", "dev", "ops"]);
const RESULTS = new Set(["unverified", "passed", "failed", "blocked"]);
const RELATIONS = new Set(["fixes", "relates_to"]);
const WORK_ID = /^work-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORK_DIR = /^([0-9]{3,})-(.+)$/u;
const WINDOWS_FORBIDDEN = /[<>:"/\\|?*]/u;

function add(errors, condition, message) { if (!condition) errors.push(message); }
function collisionKey(value) { return value.normalize("NFC").toLocaleLowerCase("und"); }
function validSegment(value) {
  return value && value !== "." && value !== ".." && !WINDOWS_FORBIDDEN.test(value) && !/[ .]$/u.test(value);
}

export function validateWorkRecord(record, options = {}) {
  const errors = [];
  const baseDir = resolve(options.baseDir ?? ROOT);
  const pathExists = options.pathExists ?? existsSync;
  add(errors, record && typeof record === "object" && !Array.isArray(record), "작업 기록은 JSON 객체여야 합니다.");
  if (errors.length) return errors;
  add(errors, record.schemaVersion === 1, "schemaVersion은 1이어야 합니다.");
  add(errors, typeof record.id === "string" && WORK_ID.test(record.id), "id는 work-UUID 형식이어야 합니다.");
  add(errors, typeof record.title === "string" && record.title.trim().length > 0, "title은 비어 있지 않아야 합니다.");
  add(errors, KINDS.has(record.kind), "kind가 허용된 값이 아닙니다.");
  add(errors, Array.isArray(record.areas) && record.areas.length > 0 && new Set(record.areas).size === record.areas.length && record.areas.every((area) => AREAS.has(area)), "areas는 중복 없는 ui/dev/ops 배열이어야 합니다.");
  add(errors, AREAS.has(record.owner), "owner는 ui/dev/ops 중 하나여야 합니다.");
  add(errors, Array.isArray(record.areas) && record.areas.includes(record.owner), "owner는 areas에도 포함되어야 합니다.");
  add(errors, STATUSES.has(record.status), "status가 허용된 값이 아닙니다.");
  add(errors, record.blockedReason === null || (typeof record.blockedReason === "string" && record.blockedReason.trim()), "blockedReason은 null 또는 비어 있지 않은 문자열이어야 합니다.");
  add(errors, Array.isArray(record.relations), "relations는 배열이어야 합니다.");
  for (const [index, relation] of (Array.isArray(record.relations) ? record.relations : []).entries()) {
    add(errors, relation && RELATIONS.has(relation.type), `relations[${index}].type이 허용된 값이 아닙니다.`);
    add(errors, relation && typeof relation.target === "string" && WORK_ID.test(relation.target), `relations[${index}].target은 work-UUID여야 합니다.`);
  }
  add(errors, Array.isArray(record.criteria) && record.criteria.length > 0, "criteria는 하나 이상이어야 합니다.");
  const ids = new Set();
  for (const [index, criterion] of (Array.isArray(record.criteria) ? record.criteria : []).entries()) {
    add(errors, criterion && typeof criterion.id === "string" && criterion.id.trim(), `criteria[${index}].id가 비어 있습니다.`);
    if (criterion?.id) { add(errors, !ids.has(criterion.id), `criteria id가 중복됩니다: ${criterion.id}`); ids.add(criterion.id); }
    add(errors, criterion && typeof criterion.description === "string" && criterion.description.trim(), `criteria[${index}].description이 비어 있습니다.`);
    add(errors, criterion && typeof criterion.required === "boolean", `criteria[${index}].required는 boolean이어야 합니다.`);
    add(errors, criterion && RESULTS.has(criterion.result), `criteria[${index}].result가 허용된 값이 아닙니다.`);
    add(errors, criterion && Array.isArray(criterion.evidence), `criteria[${index}].evidence는 배열이어야 합니다.`);
    for (const [evidenceIndex, evidence] of (Array.isArray(criterion?.evidence) ? criterion.evidence : []).entries()) {
      const prefix = `criteria[${index}].evidence[${evidenceIndex}]`;
      add(errors, evidence && typeof evidence.path === "string", `${prefix}.path가 필요합니다.`);
      add(errors, evidence && typeof evidence.summary === "string" && evidence.summary.trim(), `${prefix}.summary가 비어 있습니다.`);
      if (typeof evidence?.path !== "string") continue;
      const [filePart, anchor] = evidence.path.split("#");
      const target = resolve(baseDir, normalize(filePart));
      const within = target === baseDir || target.startsWith(`${baseDir}${sep}`);
      add(errors, filePart === "verification.md" && Boolean(anchor), `${prefix}.path는 verification.md#앵커 형식이어야 합니다.`);
      add(errors, within, `${prefix}.path가 작업 디렉터리를 벗어납니다.`);
      add(errors, within && pathExists(target), `${prefix}가 가리키는 verification.md가 없습니다.`);
      if (within && pathExists(target) && anchor) {
        const text = readFileSync(target, "utf8");
        add(errors, text.includes(`id="${anchor}"`) || new RegExp(`^#{1,6}\\s+.*\\{#${anchor}\\}`, "m").test(text), `${prefix}의 앵커를 찾을 수 없습니다.`);
      }
    }
  }
  if (record.status === "done") {
    add(errors, record.blockedReason === null, "done 작업에는 blockedReason이 없어야 합니다.");
    for (const criterion of Array.isArray(record.criteria) ? record.criteria : []) if (criterion?.required) {
      add(errors, criterion.result === "passed", `done 작업의 필수 기준 ${criterion.id ?? "(알 수 없음)"}은 passed여야 합니다.`);
      add(errors, Array.isArray(criterion.evidence) && criterion.evidence.length > 0, `done 작업의 필수 기준 ${criterion.id ?? "(알 수 없음)"}에는 증거가 필요합니다.`);
    }
  }
  return errors;
}

function markdownFiles(path) {
  if (!existsSync(path)) return [];
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) return path.endsWith(".md") ? [path] : [];
  if (!stat.isDirectory()) return [];
  return readdirSync(path, { withFileTypes: true }).filter((entry) => !entry.isSymbolicLink()).flatMap((entry) => markdownFiles(join(path, entry.name)));
}

function validateMarkdownLinks(file, root) {
  const errors = [];
  for (const match of readFileSync(file, "utf8").matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const encoded = match[1].split("#")[0];
    if (!encoded || /^(https?:|mailto:)/.test(encoded)) continue;
    let ref;
    try { ref = decodeURIComponent(encoded); } catch { errors.push(`${relative(root, file)}의 링크 encoding이 잘못됐습니다: ${match[1]}`); continue; }
    const target = resolve(dirname(file), ref);
    add(errors, (target === root || target.startsWith(`${root}${sep}`)) && existsSync(target), `${relative(root, file)}의 로컬 링크가 깨졌습니다: ${match[1]}`);
  }
  return errors;
}

function collectWorkRecords(root, errors) {
  const workRoot = join(root, "docs", "work");
  const records = [];
  if (!existsSync(workRoot)) return records;
  const areaKeys = new Set();
  for (const area of readdirSync(workRoot, { withFileTypes: true })) {
    if (area.name === "INDEX.md") continue;
    if (area.isSymbolicLink()) { errors.push(`작업 영역 심볼릭 링크를 허용하지 않습니다: docs/work/${area.name}`); continue; }
    if (!area.isDirectory()) { errors.push(`docs/work에는 INDEX.md와 영역 디렉터리만 허용합니다: ${area.name}`); continue; }
    add(errors, validSegment(area.name), `작업 영역 이름이 안전하지 않습니다: ${area.name}`);
    const areaKey = collisionKey(area.name);
    add(errors, !areaKeys.has(areaKey), `작업 영역 경로가 casefold/Unicode NFC 기준으로 충돌합니다: ${area.name}`);
    areaKeys.add(areaKey);
    const numbers = new Map();
    const names = new Set();
    for (const work of readdirSync(join(workRoot, area.name), { withFileTypes: true })) {
      const shown = `docs/work/${area.name}/${work.name}`;
      if (work.isSymbolicLink()) { errors.push(`작업 디렉터리 심볼릭 링크를 허용하지 않습니다: ${shown}`); continue; }
      if (!work.isDirectory()) { errors.push(`작업 영역에는 작업 디렉터리만 허용합니다: ${shown}`); continue; }
      const match = WORK_DIR.exec(work.name);
      add(errors, Boolean(match), `작업 폴더는 <최소 3자리 번호>-<작업명> 형식이어야 합니다: ${shown}`);
      if (!match) continue;
      const number = Number(match[1]);
      add(errors, Number.isSafeInteger(number) && number > 0, `작업 번호는 0이 아닌 정수여야 합니다: ${shown}`);
      add(errors, validSegment(match[2]), `작업명이 안전하지 않습니다: ${shown}`);
      add(errors, !numbers.has(number), `영역 ${area.name}의 작업 번호가 중복됩니다: ${match[1]} (${numbers.get(number)}, ${work.name})`);
      numbers.set(number, work.name);
      const nameKey = collisionKey(work.name);
      add(errors, !names.has(nameKey), `작업 경로가 casefold/Unicode NFC 기준으로 충돌합니다: ${shown}`);
      names.add(nameKey);
      const dir = join(workRoot, area.name, work.name);
      const links = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isSymbolicLink());
      if (links.length) {
        for (const link of links) errors.push(`작업 파일 심볼릭 링크를 허용하지 않습니다: ${shown}/${link.name}`);
        continue;
      }
      const file = join(dir, "work.json");
      if (!existsSync(file)) { errors.push(`실제 작업 디렉터리에 work.json이 없습니다: ${relative(root, file)}`); continue; }
      if (!existsSync(join(dir, "spec.md"))) errors.push(`실제 작업 디렉터리에 spec.md가 없습니다: ${relative(root, join(dir, "spec.md"))}`);
      try {
        const record = JSON.parse(readFileSync(file, "utf8"));
        errors.push(...validateWorkRecord(record, { baseDir: dir }).map((message) => `${shown}: ${message}`));
        if (record && typeof record === "object" && !Array.isArray(record)) records.push({ record, dir, shown });
      } catch (error) { errors.push(`${relative(root, file)}을 읽을 수 없습니다: ${error.message}`); }
    }
  }
  return records;
}

export function validateRepository(root = ROOT) {
  const errors = [];
  for (const name of SKILLS) {
    const canonicalDir = join(root, "skills", "www", name);
    const file = join(canonicalDir, "SKILL.md");
    add(errors, existsSync(file), `${name} 정본 스킬 파일이 없습니다.`);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    add(errors, new RegExp(`^name: ${name}$`, "m").test(text), `${name}의 frontmatter name이 잘못됐습니다.`);
    for (const heading of ["호출 조건", "입력", "진입 조건", "절차", "출력 경로", "허용 변경", "완료 조건", "인계"]) add(errors, text.includes(`## ${heading}`), `${name}에 '${heading}' 절이 없습니다.`);
    add(errors, text.includes("docs/skills/WORKFLOW.md"), `${name}이 공통 계약을 참조하지 않습니다.`);
    add(errors, text.includes("docs/skills/templates/"), `${name}이 템플릿을 참조하지 않습니다.`);
    const discovery = join(root, ".agents", "skills", name);
    add(errors, existsSync(discovery), `${name} 발견 링크가 없습니다.`);
    if (existsSync(discovery)) {
      const stat = lstatSync(discovery);
      add(errors, stat.isSymbolicLink(), `${name} 발견 항목은 중복 복사본이 아닌 심볼릭 링크여야 합니다.`);
      if (stat.isSymbolicLink()) {
        let actual = null;
        try { actual = realpathSync(discovery); } catch { errors.push(`${name} 발견 링크를 해석할 수 없습니다.`); }
        const expected = realpathSync(canonicalDir);
        add(errors, actual === expected, `${name} 발견 링크가 의도한 정본을 가리키지 않습니다.`);
        add(errors, expected.startsWith(`${realpathSync(root)}${sep}`), `${name} 정본이 저장소 밖에 있습니다.`);
      }
    }
  }
  for (const path of ["docs/skills/WORKFLOW.md", "docs/skills/profiles/desktop.md", "docs/skills/examples/approval-waiting.md", "docs/skills/templates/work.json", "docs/skills/templates/commit.md", "docs/work/INDEX.md"]) add(errors, existsSync(join(root, path)), `필수 파일이 없습니다: ${path}`);
  for (const file of [...markdownFiles(join(root, "skills", "www")), ...markdownFiles(join(root, "docs", "skills")), ...markdownFiles(join(root, "docs", "work"))]) errors.push(...validateMarkdownLinks(file, root));
  const templatePath = join(root, "docs", "skills", "templates", "work.json");
  if (existsSync(templatePath)) try { errors.push(...validateWorkRecord(JSON.parse(readFileSync(templatePath, "utf8")), { baseDir: dirname(templatePath) })); } catch (error) { errors.push(`work.json 템플릿을 읽을 수 없습니다: ${error.message}`); }
  const records = collectWorkRecords(root, errors);
  const byId = new Map();
  for (const item of records) {
    if (typeof item.record.id !== "string" || !WORK_ID.test(item.record.id)) continue;
    const key = item.record.id.toLowerCase();
    if (byId.has(key)) errors.push(`작업 UUID가 중복됩니다: ${item.record.id} (${byId.get(key)}, ${item.shown})`);
    else byId.set(key, item.shown);
  }
  for (const item of records) {
    if (!Array.isArray(item.record.relations)) continue;
    for (const relation of item.record.relations) {
      if (typeof relation?.target === "string" && WORK_ID.test(relation.target) && !byId.has(relation.target.toLowerCase())) errors.push(`${item.shown}의 관계 대상 작업을 찾을 수 없습니다: ${relation.target}`);
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateRepository();
  if (errors.length) { console.error(`워크플로 계약 검증 실패 (${errors.length}건)`); for (const error of errors) console.error(`- ${error}`); process.exitCode = 1; }
  else console.log("워크플로 계약 검증 통과: 스킬 6개, 중첩 작업 기록, 목차, 템플릿, 예시");
}
