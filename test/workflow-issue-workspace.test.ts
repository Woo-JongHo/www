/**
 * @verifies RESP-DEVELOPMENT-AUTHORING
 */
import assert                    from "node:assert/strict";
import { execFile }              from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir }                from "node:os";
import { join }                  from "node:path";
import test                      from "node:test";
import type { TestContext }      from "node:test";
import { promisify }             from "node:util";
import { prepareIssueWorkspace } from "../scripts/workflow/issue-workspace.ts";
import { withWorkLock }          from "../scripts/workflow/lock.ts";

const exec    = promisify(execFile)           ;
const first   = "a".repeat(64)                ;
const second  = "b".repeat(64)                ;
const issue   = ".www/issue-loop.local.json"  ;
const dev     = ".www/development.local.json" ;
const source  = "value.ts"                    ;
const devData = "{\"local\":true}\n"          ;

function request(key: string) { return `issue-loop:${key}`; }

async function git(cwd: string, ...args: string[]) {
  const { stdout } = await exec("git", args, { cwd });
  return stdout;
}

async function repository(t: TestContext, setup?: string) {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), "www-issue-workspace-test-")));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const repo = join(temporary, "원본 저장소");
  await mkdir(join(repo, ".www"), { recursive: true });
  await git(repo, "init", "-q");
  const config = setup === undefined ? {} : {
    isolationSetup: { command: process.execPath, args: ["-e", setup, "$(echo literal)"] },
  };
  const issueData = `${JSON.stringify(config)}\n`;
  await writeFile(join(repo, issue), issueData);
  await writeFile(join(repo, dev), devData);
  await writeFile(join(repo, ".gitignore"), ".www/\nnode_modules/\n");
  await writeFile(join(repo, source), "export const value = 0;\n");
  await git(repo, "add", ".gitignore", source);
  await git(repo, "-c", "user.name=fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "기준선");
  return { repo, issueData };
}

test("서로 다른 이슈의 병렬 체크아웃은 부모의 dirty 소스·인덱스·잠금과 분리된다", async t => {
  const setup = `const fs = require('node:fs');
    if (process.cwd() !== process.env.INIT_CWD || process.cwd() !== process.env.PWD) process.exit(8);
    fs.mkdirSync('node_modules');
    fs.writeFileSync('node_modules/local.txt', process.argv[1]);`;
  const { repo, issueData } = await repository(t, setup);
  await mkdir(join(repo, "node_modules"));
  await writeFile(join(repo, "node_modules/local.txt"), "부모 의존성");
  await writeFile(join(repo, ".git/hooks/post-checkout"), "#!/bin/sh\ntouch checkout-hook-ran\n", { mode: 0o700 });
  await writeFile(join(repo, source), "export const value = 1;\n");
  await git(repo, "add", source);
  await writeFile(join(repo, source), "export const value = 2;\n");
  await writeFile(join(repo, "untracked.ts"), "export {};\n");
  const head           = await git(repo, "rev-parse", "HEAD")        ;
  const originalStatus = await git(repo, "status", "--porcelain=v1") ;
  const originalIndex  = await readFile(join(repo, ".git/index"))    ;
  const originalRefs   = await git(repo, "show-ref")                 ;

  const [checkoutA, checkoutB] = await withWorkLock(repo, () => Promise.all([
    prepareIssueWorkspace(repo, request(first)),
    prepareIssueWorkspace(repo, request(second)),
  ]), { scope: "issue-loop" });

  assert.notEqual(checkoutA, checkoutB);
  assert.equal(await git(repo, "show-ref"), originalRefs);
  for (const checkout of [checkoutA, checkoutB]) {
    assert.equal(await git(checkout, "rev-parse", "HEAD"), head);
    assert.equal(await git(checkout, "status", "--porcelain=v1"), "");
    assert.equal(await readFile(join(checkout, source), "utf8"), "export const value = 0;\n");
    assert.equal(await readFile(join(checkout, issue), "utf8"), issueData);
    assert.equal(await readFile(join(checkout, dev), "utf8"), devData);
    assert.equal(await readFile(join(checkout, "node_modules/local.txt"), "utf8"), "$(echo literal)");
    assert.equal((await stat(join(checkout, "node_modules/local.txt"))).nlink, 1);
  }
  await withWorkLock(checkoutA, () => withWorkLock(checkoutB, async () => {
    await writeFile(join(checkoutA, source), "export const value = 3;\n");
    await git(checkoutA, "add", source);
    assert.equal(await readFile(join(checkoutB, source), "utf8"), "export const value = 0;\n");
    assert.equal(await git(checkoutB, "status", "--porcelain=v1"), "");
  }, { scope: "issue-loop" }), { scope: "issue-loop" });
  assert.deepEqual(await readFile(join(repo, ".git/index")), originalIndex);
  assert.equal(await git(repo, "status", "--porcelain=v1"), originalStatus);
  assert.equal(await readFile(join(repo, source), "utf8"), "export const value = 2;\n");
  assert.equal(await readFile(join(repo, "node_modules/local.txt"), "utf8"), "부모 의존성");
});

test("같은 이슈는 부모 HEAD·설정 변경 뒤에도 최초 기준선·재개 파일·준비 결과를 재사용한다", async t => {
  const { repo, issueData } = await repository(t, "require('node:fs').appendFileSync('.www/setup.log', 'run\\n')");
  const checkout = await prepareIssueWorkspace(repo, request(first));

  const head = await git(checkout, "rev-parse", "HEAD");
  await writeFile(join(checkout, ".www/checkpoint.json"), "실행 재개");
  await writeFile(join(checkout, source), "후보 소스");
  await writeFile(join(repo, source), "새 부모의 소스");
  await git(repo, "-c", "user.name=fixture", "-c", "user.email=fixture@example.test", "commit", "-qam", "다음 기준선");
  await writeFile(join(repo, issue), "{}\n");
  await writeFile(join(repo, dev), "{}\n");

  assert.notEqual(await git(repo, "rev-parse", "HEAD"), head);
  assert.equal(await prepareIssueWorkspace(repo, request(first)), checkout);
  assert.equal(await git(checkout, "rev-parse", "HEAD"), head);
  assert.equal(await readFile(join(checkout, source), "utf8"), "후보 소스");
  assert.equal(await readFile(join(checkout, issue), "utf8"), issueData);
  assert.equal(await readFile(join(checkout, dev), "utf8"), devData);
  assert.equal(await readFile(join(checkout, ".www/checkpoint.json"), "utf8"), "실행 재개");
  assert.equal(await readFile(join(checkout, ".www/setup.log"), "utf8"), "run\n");
});

test("실패한 준비는 기존 파일과 Git 등록을 보존하며 같은 명령을 재실행하지 않는다", async t => {
  const { repo } = await repository(t, "require('node:fs').appendFileSync('.www/setup.log', 'run\\n'); process.exit(7)");
  await assert.rejects(prepareIssueWorkspace(repo, request(first)), /격리 작업 트리 준비를 완료하지 못했습니다/);
  const checkout  = join(repo, ".www/issue-workspaces", first)         ;
  const worktrees = await git(repo, "worktree", "list", "--porcelain") ;
  await writeFile(join(repo, issue), "{}\n");

  await assert.rejects(prepareIssueWorkspace(repo, request(first)), /준비가 진행 중이거나 중단되었습니다/);
  assert.equal(await git(repo, "worktree", "list", "--porcelain"), worktrees);
  assert.equal(await readFile(join(checkout, ".www/setup.log"), "utf8"), "run\n");
  assert.ok(await prepareIssueWorkspace(repo, request(second)));
});

test("준비 명령이 추적 소스 또는 무시되지 않은 파일을 바꾸면 준비 기록을 공개하지 않는다", async t => {
  const mutations = [
    "require('node:fs').writeFileSync('value.ts', '변경된 소스')",
    "require('node:fs').writeFileSync('extra.ts', '새 소스')",
  ];
  for (const command of mutations) {
    const { repo } = await repository(t, command);
    await assert.rejects(prepareIssueWorkspace(repo, request(first)), error =>
      error instanceof Error && String(error.cause).includes("기준선의 소스 또는 인덱스"));
    await assert.rejects(prepareIssueWorkspace(repo, request(first)), /준비가 진행 중이거나 중단되었습니다/);
    assert.equal(await readFile(join(repo, source), "utf8"), "export const value = 0;\n");
    assert.equal(await git(repo, "status", "--porcelain=v1"), "");
  }
});

test("실행 단계에 상속될 Git 인덱스 재지정 환경은 작업 트리 등록 전에 거부한다", async t => {
  const { repo } = await repository(t);
  const workspaces = await git(repo, "worktree", "list", "--porcelain");

  const module = new URL("../scripts/workflow/issue-workspace.ts", import.meta.url).href;
  const code = `import {prepareIssueWorkspace} from ${JSON.stringify(module)};
    await prepareIssueWorkspace(process.argv[1], ${JSON.stringify(request(first))});`;
  const env = { ...process.env, GIT_INDEX_FILE: join(repo, ".git/index") };
  await assert.rejects(exec("node", ["--input-type=module", "--eval", code, repo], { env }), /환경 변수를 해제해야 합니다: GIT_INDEX_FILE/);
  assert.equal(await git(repo, "worktree", "list", "--porcelain"), workspaces);
});

test("요청 ID·설정 심볼릭 링크·대소문자 별칭을 작업 트리 등록 전에 거부한다", async t => {
  const { repo } = await repository(t);
  const worktrees = await git(repo, "worktree", "list", "--porcelain");
  await assert.rejects(prepareIssueWorkspace(repo, request(first.toUpperCase())), /요청 ID/);
  await assert.rejects(prepareIssueWorkspace(repo, request("../outside")), /요청 ID/);
  await rename(join(repo, issue), join(repo, ".www/actual.json"));
  await symlink("actual.json", join(repo, issue));
  await assert.rejects(prepareIssueWorkspace(repo, request(first)), /심볼릭 링크/);
  await rm(join(repo, issue));
  await rename(join(repo, ".www/actual.json"), join(repo, issue));
  await mkdir(join(repo, ".www/issue-workspaces", first.toUpperCase()));
  await assert.rejects(prepareIssueWorkspace(repo, request(first)), error => error instanceof Error && String(error.cause).includes("대소문자"));
  assert.equal(await git(repo, "worktree", "list", "--porcelain"), worktrees);
});

test("같은 저장소의 다른 등록을 가리키거나 detached HEAD를 바꾸면 재개를 거부한다", async t => {
  const { repo } = await repository(t);
  const checkoutA = await prepareIssueWorkspace(repo, request(first) ) ;
  const checkoutB = await prepareIssueWorkspace(repo, request(second)) ;
  await writeFile(join(checkoutA, ".git"), await readFile(join(checkoutB, ".git")));
  await assert.rejects(prepareIssueWorkspace(repo, request(first)), /Git 등록 위치/);
  const branch = (await git(repo, "symbolic-ref", "HEAD")).trimEnd();
  await git(checkoutB, "symbolic-ref", "HEAD", branch);
  await assert.rejects(prepareIssueWorkspace(repo, request(second)), /detached HEAD/);
});
