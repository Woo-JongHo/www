import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { loadReviewPolicy, validateReview } from "./workflow/review.ts";
import { captureSource, criteriaDigest } from "./workflow/evidence.ts";
import { readWork } from "./workflow/work.ts";

// 실제 실행 후 회수한 원문을 대조한다. 이 명령 자체가 앱이나 OS IME를 실행한 것은 아니다.
// 과거 승인 스냅샷의 .mjs 경로를 보존하므로 TS 이관 뒤 현재 소스와는 불일치가 정상이다.
const root = ".www/scratchpad/eight-items";
interface ArtifactProof extends Record<string, unknown> {
  path   : string ;
  digest : string ;
}
interface SnapshotProof {
  files: {
    path    : string ;
    type    : string ;
    digest? : string
  }[];
  inputs  : string[] ;
  digest? : string   ;
}
interface AttemptProof {
  executor        : unknown             ;
  result          : unknown             ;
  exitCode        : unknown             ;
  sourceStable    : unknown             ;
  environment     : {platform: unknown} ;
  criteriaDigest  : unknown             ;
  source          : SnapshotProof       ;
  artifactsStable : unknown             ;
  artifacts       : ArtifactProof[]     ;
  args            : string[]            ;
  startedAt       : string              ;
}
interface NativeItem {
  type?             : unknown ;
  exitCode?         : unknown ;
  status?           : unknown ;
  aggregatedOutput? : unknown ;
}
interface NativeEvent {
  method?    : string  ;
  kind?      : string  ;
  supported? : unknown ;
  requestId? : unknown ;
  params: {
    item?     : NativeItem ;
    decision? : unknown    ;
    turn?     : {status?: unknown}
  };
}
interface NativeRecord extends Record<string, unknown> { events: NativeEvent[]; }
interface NativeProof {
  attempt         : AttemptProof      ;
  before          : {digest: unknown} ;
  after           : {digest: unknown} ;
  artifactDigests : ArtifactProof[]   ;
}
interface WindowsProof {
  approvedManifestDigest : unknown        ;
  before                 : unknown        ;
  after                  : unknown        ;
  attempts               : AttemptProof[] ;
  metadataDigest         : unknown        ;
}
interface WindowsApproval { entries: ArtifactProof[]; }
interface WindowsMetadata {
  platform       : unknown                 ;
  arch           : unknown                 ;
  policies       : Record<string, unknown> ;
  executableHash : string                  ;
  versions: {
    status  : unknown ;
    logical : unknown ;
    stdout  : string  ;
    actualInvocation: {
      platform         : unknown ;
      command          : string  ;
      executableDigest : string
    }
  }[];
  nativeProbe: {
    platform                 : unknown ;
    codexEnvironmentOverride  : unknown ;
    result: {
      policy: {hash: unknown};
      turnCompleted: {
        turn: {
          status    : unknown ;
          startedAt : number  ;
          items: {
            type : unknown ;
            text : string
          }[]
        }
      };
      error: unknown
    }
  };
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function obj(value: unknown): Record<string, unknown> { assert(object(value), "증거 JSON 객체가 필요합니다."); return value; }
function list(value: unknown): unknown[] { assert(Array.isArray(value), "증거 JSON 배열이 필요합니다."); return value; }
function text(value: unknown): string { assert.equal(typeof value, "string", "증거 문자열이 필요합니다."); assert(typeof value === "string"); return value; }
function artifact(value: unknown): ArtifactProof {
  const v = obj(value);
  return {
    ...v,
    path   : text(v.path) ,
    digest : text(v.digest)
  };
}
function snapshot(value: unknown): SnapshotProof {
  const v = obj(value);
  return {
    files: list(v.files).map(f => {
      const x = obj(f);
      return {
        path : text(x.path) ,
        type : text(x.type) ,
        ...(typeof x.digest === "string" ? {digest: x.digest} : {})
      };
    }),
    inputs: list(v.inputs).map(text),
    ...(typeof v.digest === "string" ? {digest: v.digest} : {})
  };
}
function attempt(value: unknown): AttemptProof {
  const v = obj(value);
  return {
    executor        : v.executor                              ,
    result          : v.result                                ,
    exitCode        : v.exitCode                              ,
    sourceStable    : v.sourceStable                          ,
    environment     : {platform: obj(v.environment).platform} ,
    criteriaDigest  : v.criteriaDigest                        ,
    source          : snapshot(v.source)                      ,
    artifactsStable : v.artifactsStable                       ,
    artifacts       : list(v.artifacts).map(artifact)         ,
    args            : list(v.args).map(text)                  ,
    startedAt       : text(v.startedAt)
  };
}
function nativeRecord(value: unknown): NativeRecord {
  const v = obj(value);
  return {
    ...v,
    events: list(v.events).map(e => {
      const x = obj(e),
            p = x.params === undefined ? {} : obj(x.params);
      return {
        ...(typeof x.method === "string" ? {method: x.method} : {}),
        ...(typeof x.kind === "string" ? {kind: x.kind} : {}),
        supported : x.supported ,
        requestId : x.requestId ,
        params    : {
          ...(p.item === undefined ? {} : {item: obj(p.item)}),
          decision: p.decision,
          ...(p.turn === undefined ? {} : {turn: obj(p.turn)})
        }
      };
    })
  };
}
function parseNativeProof(value: unknown): NativeProof {
  const v = obj(value);
  return {
    attempt         : attempt(v.attempt)             ,
    before          : {digest: obj(v.before).digest} ,
    after           : {digest: obj(v.after).digest}  ,
    artifactDigests : list(v.artifactDigests).map(artifact)
  };
}
function parseWindowsProof(value: unknown): WindowsProof {
  const v = obj(value);
  return {
    approvedManifestDigest : v.approvedManifestDigest      ,
    before                 : v.before                      ,
    after                  : v.after                       ,
    attempts               : list(v.attempts).map(attempt) ,
    metadataDigest         : v.metadataDigest
  };
}
function windowsMetadata(value: unknown): WindowsMetadata {
  const v      = obj(value)                         ,
        probe  = obj(v.nativeProbe)                 ,
        result = obj(probe.result)                  ,
        turn   = obj(obj(result.turnCompleted).turn);
  assert(typeof turn.startedAt === "number");
  return {
    platform       : v.platform             ,
    arch           : v.arch                 ,
    policies       : obj(v.policies)        ,
    executableHash : text(v.executableHash) ,
    versions    : list(v.versions).map(x => {
      const a = obj(x),
            i = obj(a.actualInvocation);
      return {
        status  : a.status       ,
        logical : a.logical      ,
        stdout  : text(a.stdout) ,
        actualInvocation : {
          platform         : i.platform      ,
          command          : text(i.command) ,
          executableDigest : text(i.executableDigest)
        }
      };
    }),
    nativeProbe : {
      platform                 : probe.platform                 ,
      codexEnvironmentOverride : probe.codexEnvironmentOverride ,
      result                   : {
        policy        : {hash: obj(result.policy).hash} ,
        turnCompleted : {
          turn: {
            status    : turn.status    ,
            startedAt : turn.startedAt ,
            items     : list(turn.items).map(x => {
              const a = obj(x);
              return {
                type : a.type ,
                text : typeof a.text === "string" ? a.text : ""
              };
            })
          }
        },
        error         : result.error
      }
    }
  };
}
async function read(file: "native/current-source-proof.json"): Promise<NativeProof>;
async function read(file: "windows/current-source-proof.json"): Promise<WindowsProof>;
async function read(file: "windows/final-metadata.json"): Promise<WindowsMetadata>;
async function read(file: string): Promise<NativeRecord>;
async function read(file: string): Promise<unknown> {
  const value: unknown = JSON.parse(await readFile(`${root}/${file}`,"utf8"));
  if (file === "native/current-source-proof.json" ) return parseNativeProof(value);
  if (file === "windows/current-source-proof.json") return parseWindowsProof(value);
  if (file === "windows/final-metadata.json"      ) return windowsMetadata(value);
  return nativeRecord(value);
}

const work   = await readWork({ workId: "work-e9007dfb-f546-426b-88c6-58174641acc8" }) ;
const record = work.record                                                             ;
assert(record.schemaVersion === 2, "현재 역할 작업 기록이 필요합니다.");
const policy = await loadReviewPolicy({ root: process.cwd() });
if (process.argv[2] === "--review") {
  const source = await captureSource({ repo: process.cwd(), inputs: record.workflow.inputs })                                                                                                                         ;
  const state  = validateReview({ repo: process.cwd(), policy: policy.policy, review: record.workflow.reviews.at(-1), sourceDigest: source.digest, criteriaDigest: criteriaDigest(record), policyHash: policy.hash }) ;
  assert.equal(state.usable, true, state.reasons.join("; "));
  console.log("AC-7의 현재 소스·기준·정책과 실제 Opus 검토 영수증 대조 통과");
  process.exit(0);
}
const fileDefinitions = (snapshot: SnapshotProof) => snapshot.files.filter((file) => file.type === "file" && file.path !== "test/skill-library.test.mjs")
  .map(({ path, digest }) => ({ path, digest })).sort((a, b) => a.path.localeCompare(b.path));
const windowsPrivateInputs                  = [".www/native-cdp-probe.mjs", ".www/final-metadata.mjs", ".www/parent-work-criteria.json"] ;
let windowsApproval: WindowsApproval | null = null                                                                                       ;
async function artifactHash(relative: string): Promise<string> {
  assert(!path.isAbsolute(relative) && !relative.split(/[\\/]/).some((part) => part === ".." || part === "."));
  const repo  = await realpath(process.cwd()) ;
  let current = repo                          ;
  for (const part of relative.split(/[\\/]/)) {
    current = path.join(current, part);
    assert.equal((await lstat(current)).isSymbolicLink(), false);
  }
  assert((await lstat(current)).isFile());
  return createHash("sha256").update(await readFile(current)).digest("hex");
}
async function currentAttempt(attempt: AttemptProof, requiredInputs: string[], platform: string): Promise<void> {
  assert.equal(attempt.executor, "process");
  assert.equal(attempt.result, "passed");
  assert.equal(attempt.exitCode, 0);
  assert.equal(attempt.sourceStable, true);
  assert.equal(attempt.environment.platform, platform);
  assert.equal(attempt.criteriaDigest, criteriaDigest(record));
  for (const input of requiredInputs) assert(attempt.source.inputs.includes(input), `검사 입력 부족: ${input}`);
  const current = await captureSource({ repo: process.cwd(), inputs: attempt.source.inputs });
  assert.deepEqual(fileDefinitions(attempt.source), fileDefinitions(current), "실행 대상과 현재 소스가 다릅니다.");
  if (platform === "darwin") {
    assert.equal(attempt.artifactsStable, true);
    assert(attempt.artifacts.length > 0);
    for (const artifact of attempt.artifacts) assert.equal(await artifactHash(artifact.path), artifact.digest);
  } else {
    assert.equal(attempt.artifactsStable, true);
    for (const input of windowsPrivateInputs) {
      const actual   = attempt.artifacts?.find((artifact) => artifact.path === input) ;
      const approved = windowsApproval?.entries.find((entry) => entry.path === input) ;
      assert(actual && approved, `Windows 검사 원문 고정 누락: ${input}`);
      assert.equal(actual.digest, approved.digest);
    }
  }
}
const nativeProof = await read("native/current-source-proof.json");
await currentAttempt(nativeProof.attempt, ["src", "scripts/workflow", "build.ts", "package.json", "package-lock.json", "tsconfig.json", "agents/www"], "darwin");
assert.equal(nativeProof.before.digest, nativeProof.after.digest);
assert.equal(nativeProof.before.digest, nativeProof.attempt.source.digest);
const scenarios = ["initial-result", "accept-result", "decline-result", "ui-accept-result", "ui-decline-result", "interrupt-result", "ui-interrupt-result", "duplicate-response-result"];
for (const scenario of scenarios) assert(nativeProof.artifactDigests.some((artifact) => artifact.path === `native/final/${scenario}.json`));
for (const artifact of nativeProof.artifactDigests) {
  assert(artifact.path.startsWith("native/final/") && !artifact.path.split("/").includes(".."));
  assert.equal(await artifactHash(`${root}/${artifact.path}`), artifact.digest);
}
const duplicate = await read("native/final/duplicate-response-result.json");
assert.equal(duplicate.rejected, true);
assert.match(text(duplicate.error), /Unknown or unsupported approval request/);
const commands = (record: NativeRecord): NativeItem[] => record.events.flatMap(event => event.method === "item/completed" && event.params.item?.type === "commandExecution" ? [event.params.item] : []) ;
const initial  = await read("native/final/initial-result.json")                                                                                                                                         ;
assert.equal(initial.completed, true);
assert.equal(initial.output, "native-e2e-한국어-42\nNATIVE-E2E\n");
assert(commands(initial).some((item) => item.exitCode === 7 && item.status === "failed" && item.aggregatedOutput === "EXPECTED_FAILURE\n"));
assert(initial.events.some((event) => event.method === "item/completed" && event.params.item?.type === "fileChange" && event.params.item.status === "completed"));
for (const prefix of ["", "ui-"]) {
  for (const decision of ["accept", "decline"]) {
    const record = await read(`native/final/${prefix}${decision}-result.json`);
    assert.equal(record.approvalCount, 1);
    const request = record.events.find((event) => event.kind === "request" && event.supported);
    assert(request);
    assert.equal(typeof request.requestId, "number");
    assert(record.events.some((event) => event.method === "approval/responded" && event.requestId === request.requestId && event.params.decision === decision));
    const items = commands(record);
    assert.equal(items.length, 1);
    assert.equal(items[0].status, decision === "accept" ? "completed" : "declined");
    assert.equal(items[0].exitCode, decision === "accept" ? 0 : null);
    assert.equal(items[0].aggregatedOutput, decision === "accept" ? "NATIVE_APPROVAL_ACCEPTED\n" : null);
  }
  const record = await read(`native/final/${prefix}interrupt-result.json`);
  assert.equal(record.events.find((event) => event.method === "turn/completed")?.params.turn?.status, "interrupted");
  assert.equal(record.events.filter((event) => event.method === "turn/interruptRequested").length, 1);
  assert(record.events.some((event) => event.method === "turn/interruptAcknowledged"));
}
const windows        = await read("windows/final-metadata.json")              ;
const windowsProof   = await read("windows/current-source-proof.json")        ;
const approvedSource = await readFile(`${root}/windows/approved-source.json`) ;
windowsApproval = {entries:list(obj(JSON.parse(approvedSource.toString("utf8")) as unknown).entries).map(artifact)};
assert.equal(windowsProof.approvedManifestDigest, createHash("sha256").update(approvedSource).digest("hex"));
const approvedEntries     = [...windowsApproval.entries].sort((a, b) => a.path.localeCompare(b.path))  ;
const approvedFingerprint = createHash("sha256").update(JSON.stringify(approvedEntries)).digest("hex") ;
assert.equal(windowsProof.before, approvedFingerprint);
assert.equal(windowsProof.after, approvedFingerprint);
for (const entry of approvedEntries) {
  const file = entry.path.startsWith(".www/") ? `${root}/windows/approved-inputs/${entry.path}` : entry.path;
  assert.equal(await artifactHash(file), entry.digest, `승인한 Windows 실행 입력이 현재 원문과 다릅니다: ${entry.path}`);
}
const windowsInputs = ["src", "scripts/workflow", "scripts/windows-setup.mjs", "scripts/windows-package.mjs", "test", "package.json", "package-lock.json", "build.ts", "tsconfig.json", "agents/www", "docs/skills/WORKFLOW.md", "docs/specs/chat.md"];
for (const attempt of windowsProof.attempts) await currentAttempt(attempt, windowsInputs, "win32");
const checkAttempt   = windowsProof.attempts.find((attempt) => JSON.stringify(attempt.args.slice(-2)) === JSON.stringify(["run", "check"])) ;
const packageAttempt = windowsProof.attempts.find((attempt) => attempt.args.some((arg) => /(?:^|[\\/])windows-package\.mjs$/.test(arg))   ) ;
const nativeAttempt  = windowsProof.attempts.find((attempt) => attempt.args.some((arg) => /(?:^|[\\/])native-cdp-probe\.mjs$/.test(arg))  ) ;
assert(checkAttempt && packageAttempt && nativeAttempt, "Windows 전체 검사·패키지·실제 Native 실행 기록이 필요합니다.");
assert.equal(windowsProof.metadataDigest, createHash("sha256").update(await readFile(`${root}/windows/final-metadata.json`)).digest("hex"));
assert.equal(windows.platform, "win32");
assert.equal(windows.arch, "x64");
for (const key of ["source", "dist", "asar"]) assert.equal(windows.policies[key], policy.hash);
assert.match(windows.executableHash, /^[a-f0-9]{64}$/);
for (const version of windows.versions) {
  assert.equal(version.status, 0);
  assert.equal(version.actualInvocation.platform, "win32");
  assert.match(version.actualInvocation.command, /\.exe$/i);
  assert.match(version.actualInvocation.executableDigest, /^[a-f0-9]{64}$/);
  assert(version.stdout.trim());
}
assert(windows.versions.some((version) => version.logical === "codex"));
assert(windows.versions.some((version) => version.logical === "claude"));
const probe = windows.nativeProbe;
assert.equal(probe.platform, "win32");
assert.equal(probe.codexEnvironmentOverride, false);
assert.equal(probe.result.policy.hash, policy.hash);
assert.equal(probe.result.turnCompleted.turn.status, "completed");
assert(probe.result.turnCompleted.turn.startedAt * 1000 >= Date.parse(nativeAttempt.startedAt) - 1000, "예전 Native 응답을 새 실행의 결과로 재사용할 수 없습니다.");
const reply = probe.result.turnCompleted.turn.items.find((item) => item.type === "agentMessage");
assert(reply);
assert.equal(reply.text.trim(), "WINDOWS_NATIVE_READY");
assert.equal(probe.result.error, "");
console.log("AC-1~AC-3의 실제 Native·Windows 원문 대조 통과. OS IME와 수정 후 수동 재실기는 이 검사 범위 밖입니다.");
