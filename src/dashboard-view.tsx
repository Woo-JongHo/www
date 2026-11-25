/**
 * @architecture arch.chat.workspace
 * @implements RESP-CHAT-WORKSPACE
 */
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DashboardProject, DashboardSnapshot, DashboardWork, DashboardWorkDetail, WorkStatus } from "./shared";

interface DashboardViewProps {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  projectKey?: string;
  onRefresh: () => void;
  onOpenWork?: (card: DashboardWork) => void;
  onLoadWork?: (card: DashboardWork) => Promise<DashboardWorkDetail>;
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

function currentCriteriaLabel(valid: number | undefined, unknown: number | undefined, total: number) {
  if (unknown === undefined || (total > 0 && unknown === total)) return "현재 미평가";
  return `현재 유효 ${valid ?? 0}/${total}${unknown ? ` · 미평가 ${unknown}` : ""}`;
}

export function DashboardView({ snapshot, loading, error, projectKey, onRefresh, onOpenWork, onLoadWork, responseWorkKeys = [] }: DashboardViewProps) {
  const [filter, setFilter] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [selected, setSelected] = useState<{ card: DashboardWork; project: DashboardProject; scope: string } | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; scope: string; snapshot: DashboardSnapshot | null; value: DashboardWorkDetail | null; error: string | null; loading: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const request = useRef(0);
  const cardButton = useRef<HTMLButtonElement | null>(null);
  const board = useRef<HTMLElement | null>(null);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const projects = snapshot?.projects ?? [];
  const activeKey = projectKey ?? filter;
  const activeProject = projects.find((item) => item.project.key === activeKey);
  const groupKey = activeProject?.canonicalKey ?? activeKey;
  const visible = groupKey ? projects.filter((item) => (item.canonicalKey ?? item.project.key) === groupKey) : projects;
  const incomplete = visible.some((item) => item.coverage === "partial" || item.coverage === "failed");
  const github = visible.some(({ project }) => project.kind === "www") ? snapshot?.githubIssues : undefined;
  const githubLinks = new Map(github?.links.map(({ workId, number }) => [workId, number]));
  const cards = visible.flatMap(({ cards, project, canonicalKey }) => cards.map((card) => ({ card, project, canonicalKey })));
  const responseKeys = new Set(responseWorkKeys);
  const needsResponse = (card: DashboardWork) => responseKeys.has(`${card.projectKey}:${card.id}`);
  const scope = projectKey === undefined ? `filter:${filter}` : `project:${projectKey}`;
  const selectedProject = selected && selected.scope === scope ? visible.find(item => item.project.key === selected.project.key) : undefined;
  const listedDetail = selectedProject && selected ? cards.find(({ card }) => card.id === selected.card.id && card.projectKey === selected.card.projectKey) : undefined;
  const selectionIncomplete = selectedProject?.coverage === "partial" || selectedProject?.coverage === "failed";
  const candidate = listedDetail ?? (selectionIncomplete && selected && selectedProject ? { card: selected.card, project: selectedProject.project, canonicalKey: selectedProject.canonicalKey } : undefined);
  const detail = candidate && (showCancelled || candidate.card.status !== "cancelled") ? candidate : undefined;
  const detailKey = detail ? `${detail.card.projectKey}:${detail.card.id}` : null;
  const currentLoad = loaded && loaded.key === detailKey && loaded.scope === scope ? loaded : null;
  const detailSummary = detail && currentLoad?.value ? {
    ...detail.card,
    title: currentLoad.value.title,
    status: currentLoad.value.status,
    sourcePath: currentLoad.value.sourcePath,
    owner: currentLoad.value.owner,
    areas: currentLoad.value.areas,
    blockedReason: currentLoad.value.blockedReason,
    requiredCriteria: currentLoad.value.criteria.filter((criterion) => criterion.required).length,
    currentCriteria: currentLoad.value.criteria.filter(c => c.required && c.applicability?.status === "current").length,
    unassessedCriteria: currentLoad.value.criteria.filter(c => c.required && (!c.applicability || c.applicability.status === "unassessed")).length,
    passedCriteria: currentLoad.value.criteria.filter((criterion) => criterion.required && criterion.result === "passed").length,
  } : detail?.card;
  useEffect(() => {
    if (selected && !detailKey) {
      request.current++;
      setSelected(null);
      setLoaded(null);
    }
  }, [selected, detailKey, scope]);
  useEffect(() => {
    if (!detail || !detailKey || !onLoadWork) return;
    const sequence = ++request.current;
    setLoaded((previous) => previous?.key === detailKey && previous.scope === scope
      ? { ...previous, error: null, loading: true }
      : { key: detailKey, scope, snapshot: null, value: null, error: null, loading: true });
    onLoadWork(detail.card).then((value) => {
      if (request.current !== sequence) return;
      if (value.projectKey !== detail.card.projectKey || value.workId !== detail.card.id) {
        throw new Error("선택한 작업과 다른 상세가 반환되었습니다.");
      }
      setLoaded({ key: detailKey, scope, snapshot, value, error: null, loading: false });
    }).catch((reason: unknown) => {
      if (request.current === sequence) setLoaded((previous) => previous?.key === detailKey && previous.scope === scope
        ? { ...previous, error: reason instanceof Error ? reason.message : String(reason), loading: false }
        : null);
    });
    return () => { request.current++; };
  }, [detailKey, scope, snapshot, onLoadWork, retry]);
  useEffect(() => {
    if (!detailKey) return;
    detailHeading.current?.scrollIntoView?.({ block: "nearest" });
    detailHeading.current?.focus();
  }, [detailKey]);
  const closeDetail = () => {
    request.current++;
    setSelected(null);
    setLoaded(null);
    const currentCard = Array.from(board.current?.querySelectorAll<HTMLButtonElement>(".dashboard-card") ?? [])
      .find((button) => button.dataset.projectKey === selected?.card.projectKey && button.dataset.workId === selected?.card.id);
    if (currentCard) currentCard.focus();
    else if (cardButton.current?.isConnected) cardButton.current.focus();
    else board.current?.querySelector<HTMLButtonElement>(".dashboard-header button")?.focus();
  };
  const displayColumns: readonly (Column | "취소")[] = showCancelled ? [...columns, "취소"] : columns;

  return <section ref={board} className="dashboard" aria-label="작업 대시보드" data-testid="dashboard">
    <header className="dashboard-header"><div><p className="dashboard-eyebrow">WORK OVERVIEW</p><h1>{projectKey ? "프로젝트 대시보드" : "전체 대시보드"}</h1><p>작업 기록의 원본 업무 상태를 보여줍니다.</p></div><button type="button" onClick={onRefresh} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button></header>
    <div className="dashboard-toolbar">
      {!projectKey && <label>프로젝트 <select aria-label="대시보드 프로젝트 필터" value={filter} onChange={(event) => { request.current++; setFilter(event.target.value); setSelected(null); setLoaded(null); }}><option value="">전체</option>{projects.map(({ project }) => <option key={project.key} value={project.key}>{project.name}</option>)}</select></label>}
      {projectKey && <span>{activeProject?.project.name ?? "선택한 프로젝트"}</span>}
      <label className="dashboard-cancelled"><input type="checkbox" checked={showCancelled} onChange={(event) => setShowCancelled(event.target.checked)}/> 취소 작업 표시</label>
      {snapshot && <span className="dashboard-captured">수집 시각 <time dateTime={snapshot.capturedAt}>{snapshot.capturedAt}</time></span>}
    </div>
    {github && <div className="dashboard-notice">
      {github.status === "available"
        ? <p>GitHub 열린 이슈 {github.open}개 · 조회 기준 · 미연결 {github.unlinkedOpen}개 · {github.repository}</p>
        : <p>GitHub 열린 이슈 수 미확인 · {github.status === "failed" ? "조회 실패" : github.status === "invalid" ? "조회 기록 또는 연결 설정 오류" : "조회 기록 없음"}</p>}
      {github.checkedAt && <p>GitHub 조회 시각 <time dateTime={github.checkedAt}>{github.checkedAt}</time></p>}
    </div>}
    {loading && <p className="dashboard-notice" role="status">작업 기록을 불러오는 중입니다.</p>}
    {error && <p className="dashboard-notice is-error" role="alert">대시보드를 불러오지 못했습니다: {error}</p>}
    {!snapshot && !loading && !error && <p className="dashboard-notice">작업 기록을 아직 수집하지 않았습니다.</p>}
    {snapshot && visible.length === 0 && <p className="dashboard-notice">이 범위의 프로젝트 정보가 없습니다.</p>}
    {visible.length > 0 && <div className="dashboard-coverage" aria-label="프로젝트 수집 상태">{visible.map(({ project, coverage, issues, canonicalKey }) => <section key={project.key} className={`dashboard-coverage-item is-${coverage}`}>
      <div><strong>{project.name}</strong>{canonicalKey && <span>WWW 연결 체크아웃</span>}<span>{coverage === "complete" ? "수집 완료" : coverage === "empty" ? "작업 기록 없음" : coverage === "partial" ? "일부 수집 실패" : "수집 실패"}</span></div>
      {issues.length > 0 && <ul>{issues.map((issue, index) => <li key={`${issue.code}:${issue.path}:${index}`}><strong>{issue.code}</strong> · {issue.path} · {issue.message}</li>)}</ul>}
    </section>)}</div>}
    {incomplete && <p className="dashboard-notice">일부 프로젝트의 작업을 수집하지 못해 전체 작업 수는 확인되지 않았습니다.</p>}
    {snapshot && visible.length > 0 && <p className="dashboard-notice">업무 단계별 집계 · 이 보드 범위에서 수집한 로컬 work.json 기준</p>}
    {snapshot && visible.length > 0 && <div className="dashboard-board" aria-label="업무 상태별 작업">{displayColumns.map((column) => {
      const items = cards.filter(({ card }) => workColumn(card, needsResponse(card)) === column);
      return <section className="dashboard-column" key={column} aria-label={`${column} 작업`}><div className="dashboard-column-heading"><h2>{column}</h2><span aria-label={incomplete ? `확인 ${items.length}개, 전체 미확인` : `${items.length}개`}>{incomplete ? `확인 ${items.length}개` : items.length}</span></div>
        {items.length === 0 ? <p className="dashboard-column-empty">{incomplete ? "수집된 작업 없음 · 전체 미확인" : "표시할 작업 없음"}</p> : <ul>{items.map(({ card, project, canonicalKey }) => <li key={`${card.projectKey}:${card.id}`}><button type="button" className="dashboard-card" data-testid="dashboard-work-card" data-project-key={card.projectKey} data-work-id={card.id} onClick={(event) => { cardButton.current = event.currentTarget; if (detailKey !== `${card.projectKey}:${card.id}`) { request.current++; setLoaded(null); setSelected({ card, project, scope }); } }}>
          <span className="dashboard-card-project" title={project.path}>{canonicalKey ? `연결 체크아웃 · ${project.name}` : project.name}</span><strong>{card.title}</strong><span className="dashboard-card-meta"><span>{statusLabels[card.status]}</span>{needsResponse(card) && <span className="dashboard-response">응답 필요</span>}{card.status === "verifying" && <span data-testid="dashboard-next-action">{nextActionLabel(card)}</span>}{(project.kind === "www" || canonicalKey) && github?.repository && <span>{githubLinks.has(card.id.toLowerCase()) ? `GitHub #${githubLinks.get(card.id.toLowerCase())}` : "GitHub 이슈 미연결"}</span>}</span>{card.blockedReason && <span className="dashboard-card-blocked">차단: {card.blockedReason}</span>}<small>기록된 필수 기준 {card.passedCriteria}/{card.requiredCriteria} · {currentCriteriaLabel(card.currentCriteria, card.unassessedCriteria, card.requiredCriteria)}</small>{card.assessmentReason && <small>{card.assessmentReason}</small>}
        </button></li>)}</ul>}
      </section>;
    })}</div>}
    {detail && detailSummary && <aside className="dashboard-detail" aria-label="작업 상세"><div className="dashboard-detail-heading"><h2 ref={detailHeading} tabIndex={-1}>작업 상세</h2><button type="button" onClick={closeDetail} aria-label="작업 상세 닫기">닫기</button></div><h3>{detailSummary.title}</h3><dl><dt>{detail.canonicalKey ? "출처 체크아웃" : "프로젝트"}</dt><dd title={detail.project.path}>{detail.project.name}</dd><dt>원본 업무 상태</dt><dd>{statusLabels[detailSummary.status]} ({detailSummary.status})</dd><dt>작업 UUID</dt><dd>{detail.card.id}</dd><dt>원본 경로</dt><dd>{detailSummary.sourcePath}</dd><dt>담당</dt><dd>{detailSummary.owner}</dd><dt>영역</dt><dd>{detailSummary.areas.join(", ") || "없음"}</dd><dt>차단 사유</dt><dd>{detailSummary.blockedReason ?? "없음"}</dd><dt>기록된 필수 기준</dt><dd>{detailSummary.passedCriteria}/{detailSummary.requiredCriteria}</dd><dt>현재 유효한 필수 기준</dt><dd>{currentCriteriaLabel(detailSummary.currentCriteria, detailSummary.unassessedCriteria, detailSummary.requiredCriteria)}</dd></dl>
      {selectionIncomplete && !listedDetail && <p role="status">현재 목록 수집이 불완전해 이 작업을 확인하지 못했습니다.{currentLoad?.value ? " 마지막으로 수집한 상세를 표시합니다." : " 상세 조회 결과를 확인해 주세요."}</p>}
      {onLoadWork && (!currentLoad || (!currentLoad.value && currentLoad.loading)) && <p role="status">작업 상세를 불러오는 중입니다.</p>}
      {currentLoad?.value && <p className="dashboard-detail-captured">상세 수집 시각 <time dateTime={currentLoad.value.capturedAt}>{currentLoad.value.capturedAt}</time>{(currentLoad.loading || (currentLoad.snapshot !== snapshot && currentLoad.error === null)) && <span role="status"> · 이전 수집 내용을 표시하며 갱신 중입니다.</span>}{(currentLoad.error !== null || error !== null) && <span> · 갱신 전 수집 내용입니다.</span>}</p>}
      {currentLoad && currentLoad.error !== null && <div role="alert"><p>작업 상세를 불러오지 못했습니다: {currentLoad.error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></div>}
      {currentLoad?.value && <WorkDetailContent detail={currentLoad.value}/>}
      {onOpenWork && <button type="button" onClick={() => onOpenWork(detail.card)}>연결된 작업 열기</button>}
    </aside>}
  </section>;
}

const resultLabels = { unverified: "미검증", passed: "통과", failed: "실패", blocked: "차단" } as const;
const nextActionLabels = new Map([ ["spec", "명세 작성"], ["design", "설계"], ["build", "구현"], ["diagnose", "진단"], ["verify", "검증"], ["review", "검토"], ["complete", "완료 처리"] ]);
const waitingActionLabels = new Map([
  ["verify", "검증 대기"], ["review", "리뷰 대기"], ["build", "수정 대기"], ["complete", "완료 처리 대기"],
]);

function nextActionLabel({ status, nextAction, legacyKind }: Pick<DashboardWork, "status" | "nextAction" | "legacyKind">): string {
  if (legacyKind === "native-summary") return "이전 실행 요약 · 다음 단계 미기록";
  if (legacyKind === "legacy") return "이전 형식 기록 · 다음 단계 미기록";
  if (!nextAction) return "기록된 다음 단계 없음";
  if (status === "verifying") return waitingActionLabels.get(nextAction) ?? nextActionLabels.get(nextAction) ?? nextAction;
  return nextActionLabels.get(nextAction) ?? nextAction;
}

const applicabilityLabels = { current: "유효", stale: "유효하지 않음", missing: "근거 없음", unassessed: "미평가" } as const;
const documentLabels = { spec: "명세", design: "설계", tasks: "계획", verification: "검증 근거" } as const;

export function WorkDetailContent({ detail }: { detail: DashboardWorkDetail }) {
  return <div className="dashboard-detail-content">
    <section><h4>다음 단계</h4><p>{nextActionLabel(detail)}</p></section>
    <section><h4>수용 기준 <span>기록 및 현재 적용성</span></h4>{detail.criteria.length === 0 ? <p>기록된 수용 기준이 없습니다.</p> : <ul className="dashboard-criteria">{detail.criteria.map((criterion) => <li key={criterion.id}><strong>{criterion.id}</strong> {criterion.description}<small>{criterion.required ? "필수" : "선택"} · 기록 {resultLabels[criterion.result]} · 증거 {criterion.evidenceCount}개</small><small>현재 {applicabilityLabels[criterion.applicability?.status ?? "unassessed"]}{criterion.applicability?.reasons.length ? ` · ${criterion.applicability.reasons.join(" · ")}` : ""}</small></li>)}</ul>}</section>
    <section><h4>작업 문서</h4>{detail.documents.map((document) => <details key={document.kind} className="dashboard-document"><summary>{documentLabels[document.kind]} <span>{document.status === "available" ? "읽기 가능" : document.status === "missing" ? "없음" : "읽기 실패"}</span></summary><p className="dashboard-document-path">{document.path}</p>{document.status === "missing" ? <p>{document.kind === "tasks" ? "기록된 계획이 없습니다." : "문서가 없습니다."}</p> : document.status === "failed" ? <p role="alert">{document.message ?? "문서를 읽지 못했습니다."}</p> : !document.content?.trim() ? <p>문서가 비어 있습니다.</p> : <div className="dashboard-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ a: ({ children }) => <span>{children}</span>, img: () => null }}>{document.content}</ReactMarkdown></div>}</details>)}</section>
  </div>;
}
