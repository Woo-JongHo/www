/**
 * @architecture arch.development.authoring
 * @implements RESP-DEVELOPMENT-AUTHORING
 */
import { execFile }                  from "node:child_process";
import { constants, promises as fs } from "node:fs";
import { devNull }                   from "node:os";
import path                          from "node:path";
import { promisify }                 from "node:util";

const exec      = promisify(execFile)               ;
const issueFile = "issue-loop.local.json"           ;
const devFile   = "development.local.json"          ;
const workRoot  = ".www/issue-workspaces/"          ;
const fileLimit = 32_768                            ;
const commitId  = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/ ;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function execute(command: string, args: string[], cwd: string, timeout: number) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")));
  return exec(command, args, {
    cwd, env: { ...env, PWD: cwd, INIT_CWD: cwd }, timeout, killSignal: "SIGKILL", maxBuffer: 1_048_576,
  });
}

async function git(cwd: string, args: string[]) {
  const options = ["--no-replace-objects", "-c", `core.hooksPath=${devNull}`, "-c", "core.fsmonitor=false"];
  const { stdout } = await execute("git", [...options, ...args], cwd, 60_000);
  return stdout.replace(/\r?\n$/, "");
}

async function entry(parent: string, name: string) {
  const names = await fs.readdir(parent);
  if (names.some(item => item !== name && item.toLowerCase() === name.toLowerCase())) {
    throw new Error(`격리 작업 트리 경로의 대소문자가 충돌합니다: ${path.join(parent, name)}`);
  }
  try {
    const stat = await fs.lstat(path.join(parent, name));
    if (stat.isSymbolicLink()) throw new Error(`격리 작업 트리에 심볼릭 링크를 사용할 수 없습니다: ${path.join(parent, name)}`);
    return stat;
  } catch (error) {
    if (object(error) && error.code === "ENOENT") return null;
    throw error;
  }
}

async function directory(parent: string, name: string) {
  if (!(await entry(parent, name))?.isDirectory()) throw new Error(`격리 작업 트리 디렉터리를 확인할 수 없습니다: ${path.join(parent, name)}`);
  return path.join(parent, name);
}

async function regular(parent: string, name: string) {
  const file = path.join(parent, name);
  if (!(await entry(parent, name))?.isFile()) throw new Error(`격리 작업 트리 설정과 기록은 일반 파일이어야 합니다: ${file}`);
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > fileLimit) throw new Error(`격리 작업 트리 설정과 기록은 32 KiB 이하의 일반 파일이어야 합니다: ${file}`);
    const source = await handle.readFile();
    if (source.byteLength > fileLimit) throw new Error(`격리 작업 트리 파일이 읽는 동안 커졌습니다: ${file}`);
    return source;
  } finally {
    await handle.close();
  }
}

function setupFrom(source: Buffer) {
  const config: unknown = JSON.parse(source.toString("utf8"));
  if (!object(config)) throw new Error("격리 작업 트리에 올바른 이슈 실행 설정이 필요합니다.");
  const setup = config.isolationSetup;
  if (setup === undefined) return null;
  if (!object(setup) || typeof setup.command !== "string" || !setup.command.trim() || setup.command.includes("\0")
    || !Array.isArray(setup.args) || !setup.args.every((arg: unknown): arg is string => typeof arg === "string" && !arg.includes("\0"))) {
    throw new Error("isolationSetup에 실행 파일과 문자열 인자 배열이 필요합니다.");
  }
  return { command: setup.command, args: setup.args };
}

async function registeredCheckout(checkout: string, commonDir: string, head: string) {
  const dotGit = await regular(checkout, ".git");

  const pointer = /^gitdir: ([^\r\n]+)\r?\n$/.exec(dotGit.toString("utf8"));
  if (!pointer) throw new Error("격리 작업 트리의 Git 등록 포인터가 유효하지 않습니다.");
  const gitDir    = path.resolve(checkout, pointer[1])      ;
  const worktrees = await directory(commonDir, "worktrees") ;
  if (path.dirname(gitDir) !== worktrees) throw new Error("격리 작업 트리의 Git 원본이 부모 저장소와 다릅니다.");
  await directory(worktrees, path.basename(gitDir));
  const [backlink, detached, top, resolvedHead, resolvedCommonDir] = await Promise.all([
    regular(gitDir, "gitdir"),
    regular(gitDir, "HEAD"),
    git(checkout, ["rev-parse", "--show-toplevel"]),
    git(checkout, ["rev-parse", "--verify", "HEAD^{commit}"]),
    git(checkout, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
  ]);
  if (await fs.realpath(resolvedCommonDir) !== commonDir) throw new Error("격리 작업 트리의 공통 Git 저장소가 부모 저장소와 다릅니다.");
  if (path.resolve(gitDir, backlink.toString("utf8").replace(/\r?\n$/, "")) !== path.join(checkout, ".git") || await fs.realpath(top) !== checkout) {
    throw new Error("격리 작업 트리의 Git 등록 위치가 일치하지 않습니다.");
  }
  if (detached.toString("utf8").replace(/\r?\n$/, "") !== head || resolvedHead !== head) {
    throw new Error("격리 작업 트리의 detached HEAD가 기록된 커밋과 다릅니다.");
  }
  return gitDir;
}

async function resume(parent: string, commonDir: string, slots: string, key: string) {
  const state = await directory(slots, `${key}.state`);
  if (!(await entry(state, "ready.json"))) throw new Error(`격리 작업 트리 준비가 진행 중이거나 중단되었습니다: ${state}`);
  const record: unknown = JSON.parse((await regular(state, "ready.json")).toString("utf8"));
  if (!object(record) || record.parent !== parent || record.commonDir !== commonDir || record.key !== key
    || typeof record.head !== "string" || !commitId.test(record.head)) throw new Error(`격리 작업 트리 준비 기록을 확인할 수 없습니다: ${state}`);
  const checkout = await directory(slots, key);
  if (await registeredCheckout(checkout, commonDir, record.head) !== record.gitDir) throw new Error("격리 작업 트리 Git 등록이 준비 때와 다릅니다.");
  const local = await directory(checkout, ".www");
  await Promise.all([regular(local, issueFile), regular(local, devFile)]);
  return checkout;
}

export async function prepareIssueWorkspace(repo: string, requestId: string): Promise<string> {
  const request = /^issue-loop:([0-9a-f]{64})$/.exec(requestId);
  if (!request) throw new Error("유효한 격리 이슈 요청 ID가 필요합니다.");
  const parent = await fs.realpath(repo);

  const localEnv = [
    ...(await git(parent, ["rev-parse", "--local-env-vars"])).split("\n"),
    "GIT_CONFIG_GLOBAL",
    "GIT_CONFIG_SYSTEM",
  ];
  const overrides = localEnv.filter(key => process.env[key] !== undefined);
  if (overrides.length) throw new Error(`격리 이슈에서는 Git 저장소를 재지정하는 환경 변수를 해제해야 합니다: ${overrides.join(", ")}`);

  const [top, common] = await Promise.all([
    git(parent, ["rev-parse", "--show-toplevel"]),
    git(parent, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
  ]);
  if (await fs.realpath(top) !== parent) throw new Error("격리 이슈에는 부모 Git 작업 트리 루트가 필요합니다.");
  const commonDir = await fs.realpath(common)       ;
  const local     = await directory(parent, ".www") ;
  if (await git(parent, ["ls-files", "-z", "--", workRoot])) throw new Error("격리 작업 트리 저장 경로에 추적 파일이 있습니다.");
  try { await git(parent, ["check-ignore", "--quiet", "--", workRoot]); }
  catch (cause) { throw new Error("격리 작업 트리 저장 경로는 Git에서 무시되어야 합니다.", { cause }); }
  if (!(await entry(local, "issue-workspaces"))) await fs.mkdir(path.join(local, "issue-workspaces"), { recursive: true, mode: 0o700 });
  const slots = await directory(local, "issue-workspaces");

  const key       = request[1]     ;
  const stateName = `${key}.state` ;
  if (await entry(slots, stateName)) return resume(parent, commonDir, slots, key);
  const [issue, development, head] = await Promise.all([
    regular(local, issueFile),
    regular(local, devFile),
    git(parent, ["rev-parse", "--verify", "HEAD^{commit}"]),
  ]);
  if (!commitId.test(head)) throw new Error("격리 이슈에는 확정된 부모 HEAD 커밋이 필요합니다.");
  const setup = setupFrom(issue);

  const state = path.join(slots, stateName);
  try { await fs.mkdir(state, { mode: 0o700 }); }
  catch (error) {
    if (object(error) && error.code === "EEXIST") return resume(parent, commonDir, slots, key);
    throw error;
  }
  const checkout = path.join(slots, key);
  try {
    if (await entry(slots, key)) throw new Error(`기존 경로가 격리 작업 트리 자리를 차지합니다: ${checkout}`);
    await git(parent, ["worktree", "add", "--detach", "--", checkout, head]);
    await directory(slots, key);
    const gitDir = await registeredCheckout(checkout, commonDir, head);
    if (!(await entry(checkout, ".www"))) await fs.mkdir(path.join(checkout, ".www"), { mode: 0o700 });
    const settings = await directory(checkout, ".www");
    for (const [name, source] of [[issueFile, issue], [devFile, development]] as const) {
      if (await entry(settings, name)) throw new Error(`기존 격리 작업 트리 설정이 있습니다: ${path.join(settings, name)}`);
      await fs.writeFile(path.join(settings, name), source, { flag: "wx", mode: 0o600 });
    }
    if (setup) {
      try { await execute(setup.command, setup.args, checkout, 300_000); }
      catch (cause) { throw new Error("격리 작업 트리 의존성 준비 명령이 실패했습니다.", { cause }); }
    }
    if (await registeredCheckout(checkout, commonDir, head) !== gitDir) throw new Error("격리 작업 트리 준비 중 Git 등록이 바뀌었습니다.");
    const local = await directory(checkout, ".www");
    const [currentIssue, currentDevelopment] = await Promise.all([regular(local, issueFile), regular(local, devFile)]);
    if (!issue.equals(currentIssue) || !development.equals(currentDevelopment)) throw new Error("격리 작업 트리 준비 중 로컬 설정이 바뀌었습니다.");
    if (await git(checkout, ["status", "--porcelain=v1", "--untracked-files=normal", "--ignore-submodules=none"])) {
      throw new Error("격리 작업 트리 준비 중 기준선의 소스 또는 인덱스가 바뀌었습니다.");
    }
    const prepared = path.join(state, "ready.pending");
    await fs.writeFile(prepared, JSON.stringify({ parent, commonDir, key, head, gitDir }), { flag: "wx", mode: 0o600 });
    await fs.rename(prepared, path.join(state, "ready.json"));
    return checkout;
  } catch (cause) {
    throw new Error(`격리 작업 트리 준비를 완료하지 못했습니다: ${state}`, { cause });
  }
}
