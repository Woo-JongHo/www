/**
 * @architecture arch.native.projects
 * @implements RESP-NATIVE-PROJECTS
 */
export type GitHubIssueLink = { number: number; workId: string };
export type GitHubIssueConfig = { repository: string; repositoryId: number; links: GitHubIssueLink[] };
type GitHubIssueState = { number: number; state: "open" | "closed" };
type SnapshotResult =
  | { status: "available"; issues: GitHubIssueState[] }
  | { status: "failed" };
export type GitHubIssueSnapshot = { schemaVersion: 1; repositoryId: number; checkedAt: string } & SnapshotResult;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseGitHubIssueConfig(value: unknown): GitHubIssueConfig {
  if (!object(value) || value.schemaVersion !== 1 || typeof value.repository !== "string"
    || !/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(value.repository)
    || !positiveInteger(value.repositoryId) || !Array.isArray(value.links)) throw Error("이슈 연결 설정이 올바르지 않습니다.");
  const numbers = new Set<number>();
  const ids = new Set<string>();
  const rawLinks: unknown[] = value.links;
  const links = rawLinks.map((link): GitHubIssueLink => {
    if (!object(link) || !positiveInteger(link.number) || typeof link.workId !== "string"
      || !/^work-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(link.workId)
      || numbers.has(link.number) || ids.has(link.workId.toLowerCase())) throw Error("이슈와 작업 UUID 연결이 올바르지 않거나 중복됩니다.");
    numbers.add(link.number);
    ids.add(link.workId.toLowerCase());
    return { number: link.number, workId: link.workId.toLowerCase() };
  });
  return { repository: value.repository, repositoryId: value.repositoryId, links };
}

export function githubIssueRows(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw Error("이슈 조회 페이지를 확인할 수 없습니다.");
  const pages: unknown[] = value;
  return pages.flatMap((page) => {
    if (!Array.isArray(page)) throw Error("이슈 조회 페이지가 배열이 아닙니다.");
    const rows: unknown[] = page;
    return rows.flatMap((row) => {
      if (!object(row)) throw Error("이슈 조회 항목이 객체가 아닙니다.");
      return "pull_request" in row ? [] : [{ number: row.number, state: row.state }];
    });
  });
}

export function parseGitHubIssueSnapshot(value: unknown, repositoryId: number): GitHubIssueSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || value.repositoryId !== repositoryId
    || typeof value.checkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.checkedAt)
    || !Number.isFinite(Date.parse(value.checkedAt))) throw Error("이슈 수집 결과를 읽을 수 없습니다.");
  const base = { schemaVersion: 1 as const, repositoryId, checkedAt: value.checkedAt };
  if (value.status === "failed") return { ...base, status: "failed" };
  if (value.status !== "available" || !Array.isArray(value.issues)) throw Error("이슈 조회 결과가 올바르지 않습니다.");
  const numbers = new Set<number>();
  const rawIssues: unknown[] = value.issues;
  const issues = rawIssues.map((issue): GitHubIssueState => {
    if (!object(issue) || !positiveInteger(issue.number) || numbers.has(issue.number)
      || (issue.state !== "open" && issue.state !== "closed")) throw Error("이슈 상태가 잘못되었거나 번호가 중복됩니다.");
    numbers.add(issue.number);
    return { number: issue.number, state: issue.state };
  });
  return { ...base, status: "available", issues };
}
