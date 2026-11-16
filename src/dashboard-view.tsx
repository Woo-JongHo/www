/**
 * @architecture arch.chat.workspace
 * @implements RESP-CHAT-WORKSPACE
 */
import { useState } from "react";
import type { DashboardSnapshot, DashboardWork, WorkStatus } from "./shared";

interface DashboardViewProps {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  projectKey?: string;
  onRefresh: () => void;
  onOpenProject?: (projectKey: string) => void;
  onOpenWork?: (card: DashboardWork) => void;
  responseWorkKeys?: readonly string[];
}

const statusLabels: Record<WorkStatus, string> = {
  draft: "초안", ready: "준비", in_progress: "진행 중", verifying: "검토 중", done: "완료", cancelled: "취소",
};
const columns = ["대기", "응답 필요", "진행 중", "검토 필요", "완료"] as const;
type Column = typeof columns[number];

function workColumn(card: DashboardWork, response: boolean): Column | "취소" {
  if (card.status === "cancelled") return "취소";
  if (card.status === "done") return "완료";
  if (response) return "응답 필요";
  if (card.status === "in_progress") return "진행 중";
  if (card.status === "verifying") return "검토 필요";
  return "대기";
}

export function DashboardView({ snapshot, loading, error, projectKey, onRefresh, onOpenProject, onOpenWork, responseWorkKeys = [] }: DashboardViewProps) {
  const [filter, setFilter] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [selected, setSelected] = useState<{ projectKey: string; id: string } | null>(null);
  const projects = snapshot?.projects ?? [];
  const activeKey = projectKey ?? filter;
  const visible = activeKey ? projects.filter((item) => item.project.key === activeKey) : projects;
  const incomplete = visible.some((item) => item.coverage === "partial" || item.coverage === "failed");
  const cards = visible.flatMap((item) => item.cards.map((card) => ({ card, project: item.project })));
  const responseKeys = new Set(responseWorkKeys);
  const needsResponse = (card: DashboardWork) => responseKeys.has(`${card.projectKey}:${card.id}`);
  const detail = selected ? cards.find(({ card }) => card.id === selected.id && card.projectKey === selected.projectKey) : undefined;
  const displayColumns: readonly (Column | "취소")[] = showCancelled ? [...columns, "취소"] : columns;

  return <section className="dashboard" aria-label="작업 대시보드" data-testid="dashboard">
    <header className="dashboard-header"><div><p className="dashboard-eyebrow">WORK OVERVIEW</p><h1>{projectKey ? "프로젝트 대시보드" : "전체 대시보드"}</h1><p>작업 기록의 원본 업무 상태를 보여줍니다.</p></div><button type="button" onClick={onRefresh} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button></header>
    <div className="dashboard-toolbar">
      {!projectKey && <label>프로젝트 <select aria-label="대시보드 프로젝트 필터" value={filter} onChange={(event) => { setFilter(event.target.value); setSelected(null); }}><option value="">전체</option>{projects.map(({ project }) => <option key={project.key} value={project.key}>{project.name}</option>)}</select></label>}
      {projectKey && <span>{visible[0]?.project.name ?? "선택한 프로젝트"}</span>}
      <label className="dashboard-cancelled"><input type="checkbox" checked={showCancelled} onChange={(event) => setShowCancelled(event.target.checked)}/> 취소 작업 표시</label>
      {snapshot && <span className="dashboard-captured">수집 시각 <time dateTime={snapshot.capturedAt}>{snapshot.capturedAt}</time></span>}
    </div>
    {loading && <p className="dashboard-notice" role="status">작업 기록을 불러오는 중입니다.</p>}
    {error && <p className="dashboard-notice is-error" role="alert">대시보드를 불러오지 못했습니다: {error}</p>}
    {!snapshot && !loading && !error && <p className="dashboard-notice">작업 기록을 아직 수집하지 않았습니다.</p>}
    {snapshot && visible.length === 0 && <p className="dashboard-notice">이 범위의 프로젝트 정보가 없습니다.</p>}
    {visible.length > 0 && <div className="dashboard-coverage" aria-label="프로젝트 수집 상태">{visible.map(({ project, coverage, issues }) => <section key={project.key} className={`dashboard-coverage-item is-${coverage}`}>
      <div><strong>{project.name}</strong><span>{coverage === "complete" ? "수집 완료" : coverage === "empty" ? "작업 기록 없음" : coverage === "partial" ? "일부 수집 실패" : "수집 실패"}</span>{onOpenProject && <button type="button" onClick={() => onOpenProject(project.key)}>프로젝트 열기</button>}</div>
      {issues.length > 0 && <ul>{issues.map((issue, index) => <li key={`${issue.code}:${issue.path}:${index}`}><strong>{issue.code}</strong> · {issue.path} · {issue.message}</li>)}</ul>}
    </section>)}</div>}
    {incomplete && <p className="dashboard-notice">일부 프로젝트의 작업을 수집하지 못해 전체 작업 수는 확인되지 않았습니다.</p>}
    {snapshot && visible.length > 0 && <div className="dashboard-board" aria-label="업무 상태별 작업">{displayColumns.map((column) => {
      const items = cards.filter(({ card }) => workColumn(card, needsResponse(card)) === column);
      return <section className="dashboard-column" key={column} aria-label={`${column} 작업`}><div className="dashboard-column-heading"><h2>{column}</h2><span aria-label={incomplete ? `확인 ${items.length}개, 전체 미확인` : `${items.length}개`}>{incomplete ? `확인 ${items.length}개` : items.length}</span></div>
        {items.length === 0 ? <p className="dashboard-column-empty">{incomplete ? "수집된 작업 없음 · 전체 미확인" : "표시할 작업 없음"}</p> : <ul>{items.map(({ card, project }) => <li key={`${card.projectKey}:${card.id}`}><button type="button" className="dashboard-card" onClick={() => setSelected({ projectKey: card.projectKey, id: card.id })}>
          <span className="dashboard-card-project">{project.name}</span><strong>{card.title}</strong><span className="dashboard-card-meta"><span>{statusLabels[card.status]}</span>{needsResponse(card) && <span className="dashboard-response">응답 필요</span>}</span>{card.blockedReason && <span className="dashboard-card-blocked">차단: {card.blockedReason}</span>}<small>기록된 필수 기준 {card.passedCriteria}/{card.requiredCriteria}</small>
        </button></li>)}</ul>}
      </section>;
    })}</div>}
    {detail && <aside className="dashboard-detail" aria-label="작업 상세"><div className="dashboard-detail-heading"><h2>작업 상세</h2><button type="button" onClick={() => setSelected(null)} aria-label="작업 상세 닫기">닫기</button></div><h3>{detail.card.title}</h3><dl><dt>프로젝트</dt><dd>{detail.project.name}</dd><dt>원본 업무 상태</dt><dd>{statusLabels[detail.card.status]} ({detail.card.status})</dd><dt>작업 UUID</dt><dd>{detail.card.id}</dd><dt>원본 경로</dt><dd>{detail.card.sourcePath}</dd><dt>담당</dt><dd>{detail.card.owner}</dd><dt>영역</dt><dd>{detail.card.areas.join(", ") || "없음"}</dd><dt>차단 사유</dt><dd>{detail.card.blockedReason ?? "없음"}</dd><dt>기록된 필수 기준</dt><dd>{detail.card.passedCriteria}/{detail.card.requiredCriteria}</dd></dl><p>기준 수치는 작업 기록에 남은 결과이며 현재 재검증 결과를 뜻하지 않습니다.</p>{onOpenWork && <button type="button" onClick={() => onOpenWork(detail.card)}>연결된 작업 열기</button>}</aside>}
  </section>;
}
