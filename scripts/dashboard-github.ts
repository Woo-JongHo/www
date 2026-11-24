import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { githubIssueRows, parseGitHubIssueConfig, parseGitHubIssueSnapshot } from "../src/dashboard-github.mts";

const root = realpathSync(new URL("..", import.meta.url));
const file = join(root, "docs", "github-issues.json");
const data = join(root, ".www");
const config = parseGitHubIssueConfig(JSON.parse(readFileSync(file, "utf8")));
const checkedAt = new Date().toISOString();
const snapshot = { schemaVersion: 1, repositoryId: config.repositoryId, checkedAt };
const endpoint = "repos/" + config.repository;
const gh = (args: string[]) => execFileSync("gh", ["api", "--hostname", "github.com", "--method", "GET", ...args],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });

const query = () => {
  try {
    if (Number(gh([endpoint, "--jq", ".id"])) !== config.repositoryId) throw Error("저장소 ID 불일치");
    const pages: unknown = JSON.parse(gh([endpoint + "/issues?state=all&per_page=100", "--paginate", "--slurp"]));
    const issues = githubIssueRows(pages);
    return parseGitHubIssueSnapshot({ ...snapshot, status: "available", issues }, config.repositoryId);
  } catch {
    return parseGitHubIssueSnapshot({ ...snapshot, status: "failed" }, config.repositoryId);
  }
};

mkdirSync(data, { recursive: true });
if (!lstatSync(data).isDirectory() || realpathSync(data) !== data) throw Error("이슈 갱신 파일을 안전한 로컬 폴더에 저장할 수 없습니다.");
const result = query();
const temporary = join(data, "github-issues-" + randomUUID() + ".tmp");
writeFileSync(temporary, JSON.stringify(result) + "\n", { flag: "wx" });
renameSync(temporary, join(data, "github-issues.snapshot.json"));
if (result.status === "failed") {
  console.error("GitHub 이슈 조회 실패를 기록했습니다.");
  process.exitCode = 1;
} else {
  console.log("GitHub 열린 이슈 " + result.issues.filter(issue => issue.state === "open").length + "개를 로컬에 기록했습니다.");
}
