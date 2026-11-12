import { useEffect, useMemo, useRef, useState } from "react";
import type { NativeReportJob, WorkReportCatalog, WorkReportDocument, WorkReportSummary } from "./shared";

const outcomes: Record<WorkReportSummary["outcome"], string> = {
  completed   : "완료"      ,
  partial     : "일부 확인" ,
  blocked     : "확인 대기" ,
  failed      : "실패 기록" ,
  in_progress : "진행 기록" ,
};

export function ReportsView() {
  const [catalog   , setCatalog   ] = useState<WorkReportCatalog | null>                            (   null   ) ;
  const [selectedId, setSelectedId] = useState<string | null>                                       (   null   ) ;
  const [mode      , setMode      ] = useState<"authored" | "snapshot">                             ("authored") ;
  const [query     , setQuery     ] = useState                                                      (    ""    ) ;
  const [document  , setDocument  ] = useState<WorkReportDocument | null>                           (   null   ) ;
  const [loading   , setLoading   ] = useState                                                      (   true   ) ;
  const [reading   , setReading   ] = useState                                                      (  false   ) ;
  const [error     , setError     ] = useState                                                      (    ""    ) ;
  const [readError , setReadError ] = useState                                                      (    ""    ) ;
  const [notice    , setNotice    ] = useState                                                      (    ""    ) ;
  const [revision  , setRevision  ] = useState                                                      (    0     ) ;
  const [exporting , setExporting ] = useState                                                      (  false   ) ;
  const [auto      , setAuto      ] = useState<{ enabled: boolean; jobs: NativeReportJob[] } | null>(   null   ) ;
  const [autoError , setAutoError ] = useState                                                      (    ""    ) ;
  const exportInFlight = useRef(false) ;
  const readSelection  = useRef(""   ) ;
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("ko-KR");
    return (catalog?.reports ?? []).filter((report) => report.kind === mode && `${report.title} ${report.summary}`.toLocaleLowerCase("ko-KR").includes(term));
  }, [catalog, query, mode]);
  const activeId = visible.some((report) => report.id === selectedId) ? selectedId : visible[0]?.id ?? null;

  useEffect(() => {
    let disposed = false ;
    let pending  = false ;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const [result, native] = await Promise.all([
          window.www.listReports(),
          window.www.nativeReportStatus().catch((failure) => { if (!disposed) setAutoError(String(failure)); return null; }),
        ]);
        if (!disposed) {
          setCatalog(result);
          setError("");
          if (native) { setAuto(native); setAutoError(""); }
        }
      } catch (failure) {
        if (!disposed) setError(String(failure));
      } finally {
        pending = false;
        if (!disposed) setLoading(false);
      }
    }
    void refresh();
    const timer = setInterval(() => { if (globalThis.document.visibilityState === "visible") void refresh(); }, 5000);
    return () => { disposed = true; clearInterval(timer); };
  }, [revision]);

  useEffect(() => {
    let disposed  = false                                           ;
    const key     = JSON.stringify([catalog?.repository, activeId]) ;
    const changed = readSelection.current !== key                   ;
    readSelection.current = key;
    if (changed) setDocument(null);
    setReadError("");
    if (!activeId) { setReading(false); return; }
    if (changed) setReading(true);
    void window.www.readReport(activeId).then((result) => {
      if (!disposed) setDocument(result);
    }).catch((failure) => {
      if (!disposed) setReadError(String(failure));
    }).finally(() => {
      if (!disposed) setReading(false);
    });
    return () => { disposed = true; };
  }, [activeId, catalog, revision]);

  async function choose() {
    try {
      if (await window.www.chooseReportRepository()) {
        setCatalog(null);
        setDocument(null);
        setSelectedId(null);
        setLoading(true);
        setNotice("");
        setRevision((value) => value + 1);
      }
    } catch (failure) { setError(String(failure)); }
  }

  async function exportHtml() {
    if (!activeId || exportInFlight.current) return;
    exportInFlight.current = true;
    setExporting(true);
    setNotice("");
    try {
      const file = await window.www.exportReport(activeId);
      if (file) setNotice(`HTML 보고서를 저장했습니다: ${file}`);
    } catch (failure) { setNotice(`저장 실패: ${String(failure)}`); }
    finally { exportInFlight.current = false; setExporting(false); }
  }

  async function toggleAutomatic(enabled: boolean) {
    try {
      const value = await window.www.setNativeReportEnabled(enabled);
      setAuto((current) => ({ enabled: value, jobs: current?.jobs ?? [] }));
      setAutoError("");
    } catch (failure) { setAutoError(String(failure)); }
  }

  async function retry(job: NativeReportJob) {
    try {
      await window.www.retryNativeReport(job.key);
      setNotice("이 답변의 보고서 필요 여부를 다시 판단합니다.");
      setRevision((value) => value + 1);
    } catch (failure) { setAutoError(String(failure)); }
  }

  const jobLabels: Record<NativeReportJob["status"], string> = {
    queued      : "판단 대기"         ,
    judging     : "LLM 판단·작성 중"  ,
    skipped     : "불필요해서 건너뜀" ,
    saved       : "보고서 생성됨"     ,
    failed      : "자동 생성 실패"    ,
    interrupted : "앱 종료로 중단됨"
  };

  return <main className="reports-work" aria-label="작업 보고서">
    <header className="reports-header"><div><h1>작업 보고서</h1><p>무엇을 바꾸고, 왜 선택했고, 어디까지 확인했는지.</p></div><div className="reports-actions"><button onClick={() => void choose()}>프로젝트 선택</button><button onClick={() => setRevision((value) => value + 1)}>새로고침</button><button onClick={() => void exportHtml()} disabled={!document || reading || exporting}>{exporting ? "저장 중" : "HTML 저장"}</button></div></header>
    <div className="reports-location"><span>읽는 프로젝트</span><code>{catalog?.repository ?? "확인 중"}</code><span>작성 기록과 실행 근거를 함께 읽습니다</span></div>
    <div className="reports-automatic"><label><input type="checkbox" checked={auto?.enabled ?? false} disabled={!auto} onChange={(event) => void toggleAutomatic(event.target.checked)}/>Native 답변 후 자동 보고서</label><span>LLM이 작업 규모를 판단하고 필요할 때만 작성합니다.</span>{auto?.jobs.length ? <details><summary>최근 자동 판단 {auto.jobs.length}개</summary><ul>{auto.jobs.slice(0, 8).map((job) => <li key={job.key}><strong>{jobLabels[job.status]}</strong><p>{job.reason}</p>{job.status === "failed" && job.retryAvailable === true ? <button onClick={() => void retry(job)}>다시 판단</button> : job.reportId ? <button onClick={() => { setMode("authored"); setQuery(""); setSelectedId(job.reportId); setRevision((value) => value + 1); }}>보고서 읽기</button> : null}</li>)}</ul></details> : null}</div>
    {autoError && <div className="reports-alert" role="alert">자동 보고서: {autoError}</div>}
    {error && <div className="reports-alert" role="alert">보고서 목록을 읽지 못했습니다. {error}</div>}
    {catalog?.warnings.length ? <details className="reports-alert"><summary>일부 기록 확인 필요 ({catalog.warnings.length})</summary><ul>{catalog.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details> : null}
    {notice && <div className="reports-notice" role="status">{notice}</div>}
    <div className="reports-layout">
      <aside className="reports-library" aria-label="보고서 목록"><div className="reports-modes"><button aria-pressed={mode === "authored"} onClick={() => setMode("authored")}>작성 보고서</button><button aria-pressed={mode === "snapshot"} onClick={() => setMode("snapshot")}>자동 기록</button></div><label className="reports-search"><span>보고서 찾기</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="작업 제목이나 내용"/></label><div className="reports-list" aria-live="polite">
        {loading ? <div className="reports-empty-list">보고서를 읽고 있습니다.</div> : visible.length ? visible.map((report) => <button className="report-entry" key={report.id} aria-current={activeId === report.id ? "true" : undefined} onClick={() => setSelectedId(report.id)}><div><span className={`report-outcome outcome-${report.outcome}`}>{outcomes[report.outcome]}</span><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleDateString("ko-KR")}</time></div><strong>{report.title}</strong><p>{report.summary}</p><span className="report-entry-kind">{report.kind === "authored" ? "작성자가 남긴 설명" : "실행 시점 자동 기록"}</span></button>) : <div className="reports-empty-list">{query.trim() ? "일치하는 보고서가 없습니다." : mode === "authored" ? "이 프로젝트에 작성 보고서가 아직 없습니다. 작업 종료 시 저자가 보고서를 작성하면 여기에 쌓입니다." : "검증·검토·하네스 종료 때 생성한 자동 기록이 아직 없습니다."}</div>}
      </div><footer>보고서는 저장 당시의 기록입니다.<br/>새 검증과 다음 작업은 별도 이력으로 남습니다.</footer></aside>
      <section className="reports-reader" aria-label="보고서 읽기">
        {reading ? <div className="reports-placeholder" role="status"><h2>보고서를 펼치고 있습니다.</h2></div> : readError ? <div className="reports-placeholder" role="alert"><h2>이 보고서를 읽지 못했습니다.</h2><p>{readError}</p><button className="secondary" onClick={() => setRevision((value) => value + 1)}>다시 읽기</button></div> : document ? <>
          {!document.current || document.stale ? <div className="reports-stale" role="status">기록 또는 검사 대상이 변경됐습니다. 아래는 저장 당시의 보고서입니다. <span>{document.reasons.join(" · ")}</span></div> : null}
          <iframe className="report-frame" title={`${document.report.title} 작업 보고서`} sandbox="" referrerPolicy="no-referrer" srcDoc={document.html}/>
        </> : <div className="reports-placeholder"><svg viewBox="0 0 160 125" aria-hidden="true"><rect x="34" y="21" width="80" height="94" rx="9" fill="#dcecf6" stroke="#a7c2d5"/><rect x="46" y="9" width="80" height="94" rx="9" fill="white" stroke="#a7c2d5"/><path d="M62 35h47M62 49h35M62 63h42" stroke="#6486a0" strokeWidth="4" strokeLinecap="round"/><circle cx="112" cy="91" r="22" fill="#f4ce62"/><path d="m102 91 7 7 13-15" fill="none" stroke="#203b4b" strokeWidth="4" strokeLinecap="round"/></svg><h2>작업의 끝을, 읽을 수 있는 한 장으로.</h2><p>목록에서 보고서를 선택하세요.<br/>변경 전후와 선택 이유, 검증 결과와 남은 일을 함께 보여줍니다.</p></div>}
      </section>
    </div>
  </main>;
}
