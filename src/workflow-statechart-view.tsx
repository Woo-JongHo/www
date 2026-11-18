/**
 * @architecture arch.blueprint.layout
 * @implements RESP-BLUEPRINT-LAYOUT
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { workflowEvidenceLabels, workflowEvidenceState, type WorkflowEvidence, type WorkflowStatechart, type WorkflowReportDocument } from "./workflow-statechart";

interface Props {
  model: WorkflowStatechart | null;
  snapshotState: "missing" | "stale" | "unverified";
  modelDigest: string | null;
  sourceDigest: string | null;
  onClose(): void;
  onReadEvidence(workId: string): Promise<WorkflowEvidence>;
  initialEvidence?: WorkflowEvidence;
  onReadReport(workId: string): Promise<{ document: WorkflowReportDocument | null; repository: string; warnings: string[] }>;
  initialReport?: WorkflowReportDocument;
}
export function WorkflowStatechartView({ model, snapshotState, modelDigest, sourceDigest, onClose, onReadEvidence, initialEvidence, onReadReport, initialReport }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const evidenceButton = useRef<HTMLButtonElement>(null);
  const reportButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeButton.current?.focus(); }, []);
  const [selected, setSelected] = useState(model?.transitions[0]?.id ?? "");
  const [workId, setWorkId] = useState(initialEvidence?.workId ?? "work-048bfa71-3960-4ad0-a8fe-e6217100d6df");
  const [evidence, setEvidence] = useState<WorkflowEvidence | null>(initialEvidence ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<WorkflowReportDocument | null>(initialReport ?? null);
  const [reportRepository, setReportRepository] = useState("");
  const [reportWarnings, setReportWarnings] = useState<string[]>([]);
  const [reportError, setReportError] = useState("");
  const [readingReport, setReadingReport] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);
  useLayoutEffect(() => {
    const target = closeButton.current;
    if ((loading || readingReport) && document.activeElement === document.body
      && target?.isConnected && !target.closest("[hidden]") && target.getClientRects().length > 0) {
      target.focus({ preventScroll: true });
    }
  }, [loading, readingReport]);
  const transition = model?.transitions.find(entry => entry.id === selected);
  const evidenceState = workflowEvidenceState(evidence);
  async function readEvidence() {
    setLoading(true); setError(""); setEvidence(null);
    try { setEvidence(await onReadEvidence(workId.trim())); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally {
      setLoading(false);
      requestAnimationFrame(() => {
        const target = evidenceButton.current;
        if (document.activeElement === document.body && target?.isConnected) target.focus();
      });
    }
  }
  async function readReport() {
    setReadingReport(true); setReport(null); setReportError(""); setReportLoaded(false); setReportWarnings([]);
    try {
      const result = await onReadReport(workId.trim());
      setReport(result.document); setReportRepository(result.repository); setReportWarnings(result.warnings); setReportLoaded(true);
    } catch (failure) { setReportError(failure instanceof Error ? failure.message : String(failure)); }
    finally {
      setReadingReport(false);
      requestAnimationFrame(() => {
        const target = reportButton.current;
        if (document.activeElement === document.body && target?.isConnected) target.focus();
      });
    }
  }
  return <section className="workflow-statechart" aria-label="개발 작업 상태도" data-testid="workflow-statechart" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
    <header><div><span>상태 전이</span><h2>{model?.title ?? "상태 모델 없음"}</h2></div><button ref={closeButton} data-testid="workflow-statechart-close" onClick={onClose}>원래 지도로 돌아가기</button></header>
    <p className="workflow-statechart-note">정적인 개발 작업의 대표 흐름입니다. 실시간 실행 상태나 형식 증명이 아닙니다.</p>
    {!model ? <p data-testid="workflow-statechart-empty">이 책임에는 상태 모델이 등록되지 않았습니다.</p> : <>
      <div className="workflow-statechart-status" data-testid="workflow-statechart-model-status" data-status={snapshotState}><strong>{snapshotState === "stale" ? "오래된 모델·소스 식별" : snapshotState === "missing" ? "모델 검사 정보 없음" : "검증 미실행"}</strong><span>정의·참조 연결은 행동 검사 통과를 뜻하지 않습니다. 번들의 코드 식별만 대조하며 테스트 파일의 현재 내용은 앱에서 다시 읽지 않습니다.</span><code>모델 {modelDigest?.slice(0, 12) ?? "미제공"} · 소스 {sourceDigest?.slice(0, 12) ?? "미제공"}</code></div>
      <ol className="workflow-statechart-states" aria-label="작업 상태">{model.states.map(state => <li key={state.id}><strong>{state.title}</strong><code>{state.id}</code></li>)}</ol>
      <div className="workflow-statechart-body"><nav aria-label="상태 전이 목록">{model.transitions.map(entry => <button key={entry.id} data-transition-id={entry.id} aria-pressed={entry.id === selected} onClick={() => setSelected(entry.id)}><strong>{entry.event}</strong><span>{model.states.find(state => state.id === entry.from)?.title} → {model.states.find(state => state.id === entry.to)?.title}</span></button>)}</nav>
        {transition && <article data-testid="workflow-statechart-transition"><code>{transition.id}</code><h3>{transition.event}</h3><h4>조건과 규칙</h4><ul>{transition.guards.map(id => <li key={id}><code>{id}</code><p>{model.rules.find(rule => rule.id === id)?.description}</p></li>)}</ul><h4>효과</h4><p>{transition.effect}</p><h4>담당 코드</h4>{transition.code.map(ref => <p key={ref.file + ref.symbol}><code>{ref.file}</code><br/><code>{ref.symbol}</code></p>)}<h4>검사 선언</h4>{transition.tests.map(ref => <p key={ref.file + ref.symbol}><code>{ref.file}</code><br/>{ref.symbol}</p>)}<p>연결 선언입니다. 실제 실행 결과는 아래 작업 기록에서 확인합니다.</p></article>}
      </div>
      <section className="workflow-counterexamples" aria-label="반례와 재현 근거"><h3>반례와 재현 근거</h3>{model.counterexamples.map(entry => <details key={entry.id} data-counterexample-id={entry.id}><summary>{entry.events.join(" → ")}</summary><code>{entry.id}</code><p>거부 규칙: <code>{entry.rejectedBy}</code></p><code>{entry.test.file}</code><p>{entry.test.symbol}</p><p>재현 테스트의 참조입니다. 이 화면에서 반례를 실행하지 않았습니다.</p></details>)}</section>
    </>}
    <section className="workflow-work-evidence" aria-label="작업 실행 근거"><h3>작업 실행 근거</h3><form onSubmit={event => { event.preventDefault(); void readEvidence(); }}><label>작업 UUID<input aria-label="상태도의 작업 UUID" disabled={loading || readingReport} value={workId} onChange={event => { setWorkId(event.target.value); setEvidence(null); setError(""); setReport(null); setReportLoaded(false); setReportError(""); setReportWarnings([]); }}/></label><button ref={evidenceButton} data-testid="workflow-evidence-read" disabled={loading || !workId.trim()}>{loading ? "조회 중…" : "선택 프로젝트에서 조회"}</button></form><p>작업 상태는 현재 탭의 프로젝트에서 읽습니다. 보고서에서 별도로 선택한 프로젝트가 다르면 보고서 읽기를 차단합니다.</p>
      <div data-testid="workflow-evidence-status" data-status={evidenceState}><strong>{workflowEvidenceLabels[evidenceState]}</strong>{error && <p role="alert">자료를 읽을 수 없습니다: {error}</p>}{evidence && <><p>작업 상태: <code>{evidence.status}</code></p><code>대상 소스: {evidence.sourceDigest ?? "미제공"}</code><ul>{evidence.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></>}</div><p>이 조회에는 검증 시도 ID·방법·실행 환경·스크린샷이 포함되지 않습니다. 모델 검사 결과나 다른 환경의 통과로 대신하지 않습니다.</p>
      <div className="workflow-report-evidence"><button ref={reportButton} type="button" data-testid="workflow-report-read" disabled={readingReport || !workId.trim()} onClick={() => void readReport()}>{readingReport ? "보고서 읽는 중…" : "같은 작업의 실행 근거 보고서 읽기"}</button><p>보고서에서 검증 시도·방법·환경·산출물과 당시 한계를 확인합니다. 기록에 없는 항목은 미확인입니다.</p>
        {reportError && <p role="alert">보고서를 읽을 수 없습니다: {reportError}</p>}
        {reportWarnings.map((warning, index) => <p key={index} role="status">{warning}</p>)}
        {reportLoaded && !report && <p data-testid="workflow-report-empty">이 작업의 보고서가 없습니다. 검증 근거가 있다고 추정하지 않습니다.</p>}
        {report && <><p data-testid="workflow-report-status" data-status={report.stale ? "stale" : report.current ? "current" : "unverified"}>{report.stale ? "오래된 보고서" : report.current ? "현재 기록의 보고서" : "현재 적용 미확인 보고서"} · <code>{report.report.id}</code></p><p>읽는 프로젝트: <code>{reportRepository || "조회 전"}</code></p><p>기록 종류: {report.report.kind === "authored" ? "저작 보고서" : "실행 snapshot"} · {report.report.createdAt}</p><ul>{report.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul><iframe data-testid="workflow-report-frame" title={`${report.report.title} 실행 근거 보고서`} sandbox="" referrerPolicy="no-referrer" srcDoc={report.html}/></>}
      </div>
    </section>
  </section>;
}
