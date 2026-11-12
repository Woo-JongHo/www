import type { ReportReader, WorkReport } from "./reports.ts";

interface ViewState {
  current  : boolean  ;
  stale    : boolean  ;
  reasons  : string[] ;
  checked? : boolean  ;
}

const entities: Record<string, string> = {
  "&" : "&amp;"  ,
  "<" : "&lt;"   ,
  ">" : "&gt;"   ,
  '"' : "&quot;" ,
  "'" : "&#39;"  ,
};
const outcomeLabels: Record<WorkReport["outcome"], string> = {
  completed   : "완료로 기록"    ,
  partial     : "일부 확인"      ,
  blocked     : "차단 사항 남음" ,
  failed      : "실패 기록 있음" ,
  in_progress : "진행 중 기록"   ,
};

function escape(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

function paragraphs(values: string[]): string {
  return values.map((value) => `<p>${escape(value)}</p>`).join("");
}

function bullets(values: string[]): string {
  return values.length ? `<ul>${values.map((value) => `<li>${escape(value)}</li>`).join("")}</ul>` : "";
}

function resultLabel(value: string): string {
  return ({ passed: "당시 통과로 기록", failed: "당시 실패로 기록", blocked: "당시 차단으로 기록", unverified: "미검증으로 기록" })[value] ?? "판정 미확인";
}

function writtenAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function currentStatus(report: WorkReport, state: ViewState): string {
  if (!state.checked              ) return "발행 당시 기록입니다. 이 HTML 사본은 현재 파일 상태를 조회하지 않습니다.";
  if (state.stale                 ) return "보고서 대상 소스·기준이 바뀌었거나 비교할 수 없어 재확인이 필요합니다.";
  if (report.sourceDigest === null) return "비교할 검사 입력 지문이 없어 현행 소스 적용성은 미확인입니다.";
  return "읽기 시 비교한 파일·기준은 보고서 발행 대상과 같습니다. 검사별 현행 적용성과 실행 환경은 별도로 재확인하지 않았습니다.";
}

function requirements(report: WorkReport): string {
  const rows = report.narrative?.reader?.requirements;
  if (rows?.length) return '<p class="muted">아래는 작성자의 요구·결과 설명입니다. 연결 근거의 서술은 별도의 검사 판정을 새로 부여하지 않습니다.</p>' + rows.map((row) => `<article class="requirement"><h3>${escape(row.requirement)}</h3><p class="result">${escape(row.result)}</p>${row.evidence ? `<p class="support"><strong>근거</strong> ${escape(row.evidence)}</p>` : '<p class="muted">연결 근거가 기록되지 않았습니다.</p>'}${row.limitations ? `<p class="limit">${escape(row.limitations)}</p>` : ""}</article>`).join("");
  if (report.work.criteria.length) return `<p class="muted">구조화된 요구·결과 설명이 없어 저장된 수용 기준과 당시 상태를 그대로 보여 줍니다.</p><dl class="requirements">${report.work.criteria.map((row) => `<div><dt>${escape(row.description)}</dt><dd>${escape(resultLabel(row.result))}</dd></div>`).join("")}</dl>`;
  return '<p class="muted">요구와 결과의 연결 설명이 기록되지 않았습니다.</p>';
}

function decisions(report: WorkReport): string {
  const reader = report.narrative?.reader;
  if (reader) {
    if (!reader.decisions.length) return "";
    return `<section class="paper" id="report-decisions"><h2>중요한 선택과 그 이유</h2>${reader.decisions.map((item) => `<article class="decision"><h3>${escape(item.problem)}</h3><p><strong>선택</strong> ${escape(item.choice)}</p>${item.basis ? `<p><strong>판단 근거</strong> ${escape(item.basis)}</p>` : ""}${item.alternatives.length ? `<h4>함께 검토한 대안</h4>${bullets(item.alternatives)}` : ""}${item.tradeoff ? `<p class="limit"><strong>감수한 점</strong> ${escape(item.tradeoff)}</p>` : ""}</article>`).join("")}</section>`;
  }
  return report.narrative?.decisions.length ? `<section class="paper" id="report-decisions"><h2>기록에 남은 주요 선택</h2>${bullets(report.narrative.decisions)}</section>` : "";
}

function verificationChecks(checks: ReportReader["checks"]): string {
  return checks.length ? checks.map((item) => `<article class="check"><h3>${escape(item.target)}</h3><dl><div><dt>확인 방법</dt><dd>${escape(item.method)}</dd></div><div><dt>기대 결과</dt><dd>${escape(item.expected ?? "기대 결과가 기록되지 않았습니다.")}</dd></div><div><dt>실제 관측</dt><dd>${escape(item.observed ?? "관측 결과가 기록되지 않았습니다.")}</dd></div>${item.limitations ? `<div><dt>확인 범위와 한계</dt><dd>${escape(item.limitations)}</dd></div>` : ""}</dl></article>`).join("") : '<p class="muted">구체적인 검증 대상·방법·기대·관측 설명이 기록되지 않았습니다. 명령이나 종료 코드만으로 사용자 행동을 확인했다고 추정하지 않습니다.</p>';
}

function verificationCounts(report: WorkReport): string {
  const attempts = report.work.verifications                                  ;
  const passed   = attempts.filter((item) => item.result === "passed").length ;
  const failed   = attempts.filter((item) => item.result === "failed").length ;
  const unknown  = attempts.length - passed - failed                          ;
  return attempts.length ? `<p class="record-result">저장된 검사 이력의 당시 결과: 통과 ${passed}건${failed ? `, 실패 ${failed}건` : ""}${unknown ? `, 미확인 ${unknown}건` : ""}. 실제 프로세스 실행과 실제 모델·GUI·플랫폼 확인 범위는 각 검사 설명에서 구분합니다.</p>` : '<p class="record-result">연결된 검사 시도가 없습니다. 미검증입니다.</p>';
}

function verificationReview(report: WorkReport): string {
  const lastReview = report.work.reviews.at(-1);
  if (!lastReview) return '<p class="review-state">연결된 독립 검토가 없습니다. 미실행입니다.</p>';
  const label = lastReview.verdict === "pass" ? "당시 통과로 기록" : lastReview.verdict === "fail" ? "당시 수정 필요로 기록" : lastReview.verdict === "not_run" ? "미실행으로 기록" : "판정 미확인";
  return `<p class="review-state">독립 검토: ${escape(label)}${lastReview.executor !== "process" ? " · 주입·미확인 실행기의 기록" : ""}${lastReview.model === null ? " · 관측 모델 미확인" : ""}.</p>${lastReview.verdict === "fail" ? '<p class="limit">수정이 필요한 것으로 기록되어 후속 확인이 남아 있습니다. 지적 전문은 아래 원시 근거에서 확인할 수 있습니다.</p>' : ""}`;
}

function verification(report: WorkReport, state: ViewState): string {
  const checks = report.narrative?.reader?.checks ?? [];
  return `<section class="paper" id="report-verification"><h2>무엇을 어떻게 확인했나요</h2><p class="applicability"><strong>당시 관측과 현재 적용성은 다릅니다.</strong> ${escape(currentStatus(report, state))}</p>${checks.length ? '<p class="muted">검증 설명은 작성자가 기록한 내용이며, 아래 저장 당시 검사·검토 판정과 별개입니다.</p>' : ""}${verificationChecks(checks)}${verificationCounts(report)}<h3>독립 검토</h3>${verificationReview(report)}${report.narrative?.limitations.length ? `<h3>확인하지 못한 범위</h3>${bullets(report.narrative.limitations)}` : ""}</section>`;
}

function nextActions(report: WorkReport): string {
  const reader = report.narrative?.reader;
  if (reader?.nextActions.length) return `<section class="paper" id="report-next"><h2>남은 일과 해소 행동</h2>${reader.nextActions.map((item) => `<article class="next"><h3>${escape(item.action)}</h3><dl><div><dt>담당</dt><dd>${escape(item.owner ?? "미지정")}</dd></div><div><dt>해소 조건</dt><dd>${escape(item.doneWhen ?? "해소 조건이 기록되지 않았습니다.")}</dd></div>${item.impact ? `<div><dt>영향</dt><dd>${escape(item.impact)}</dd></div>` : ""}</dl></article>`).join("")}</section>`;
  if (!reader && report.narrative?.next.length) return `<section class="paper" id="report-next"><h2>남은 일과 해소 행동</h2>${bullets(report.narrative.next)}<p class="muted">담당·해소 조건·영향은 별도로 기록되지 않았습니다.</p></section>`;
  return report.work.blockedReason ? '<section class="paper" id="report-next"><h2>남은 일과 해소 행동</h2><p>차단 사항은 남아 있지만 구체적인 해소 행동이 기록되지 않았습니다.</p></section>' : "";
}

function omissions(report: WorkReport): string {
  const omitted = report.work.omitted;
  if (!omitted || !Object.values(omitted).some((count) => count > 0)) return "";
  const criteriaCount     = report.work.criteria.length                                                            ;
  const evidenceCount     = report.work.criteria.reduce((count, item) => count + item.evidence.length, 0)          ;
  const verificationCount = report.work.verifications.length                                                       ;
  const reviewCount       = report.work.reviews.length                                                             ;
  const argumentCount     = report.work.verifications.reduce((count, item) => count + (item.args?.length ?? 0), 0) ;
  const findingCount      = report.work.reviews.reduce((count, item) => count + item.findings.length, 0)           ;
  const rows: { label: string; shown: number; omitted: number }[] = [
    { label : "수용 기준" , shown : criteriaCount     , omitted : omitted.criteria      },
    { label : "기준 근거" , shown : evidenceCount     , omitted : omitted.evidence      },
    { label : "검사 이력" , shown : verificationCount , omitted : omitted.verifications },
    { label : "검토 이력" , shown : reviewCount       , omitted : omitted.reviews       },
    { label : "명령 인자" , shown : argumentCount     , omitted : omitted.arguments     },
    { label : "검토 지적" , shown : findingCount      , omitted : omitted.findings ?? 0 },
  ];
  const parts = rows.filter((item) => item.omitted > 0).map((item) => `${item.label} 전체 ${item.shown + item.omitted}개 중 ${item.shown}개 표시 (${item.omitted}개 제외)`);
  return `<aside class="omission"><strong>일부 원본 항목이 이 보고서에 보관되지 않았습니다.</strong><p>${escape(parts.join(", "))}.${omitted.unresolved ? ` 제외된 당시 기록 중 실패·차단·미확인 항목이 ${omitted.unresolved}건 있습니다.` : ""} 더 넓은 기록은 근거의 작업 파일과 대조해야 합니다.</p></aside>`;
}

function rawDetails(report: WorkReport, state: ViewState): string {
  return `<details id="report-raw"><summary>저장 당시 원시 근거와 식별 정보</summary><div class="raw"><p>아래 문구는 기록 시점의 원문입니다. ‘현재 적용 가능’ 같은 과거 요약도 현행 판정이 아닙니다.</p><dl><div><dt>작업·보고서 ID</dt><dd><code>${escape(report.workId)}<br>${escape(report.id)}</code></dd></div><div><dt>작업 기록 지문</dt><dd><code>${escape(report.workRecordHash)}</code></dd></div><div><dt>검사 입력 지문</dt><dd><code>${escape(report.sourceDigest ?? "legacy · 미확인")}</code></dd></div><div><dt>기준 지문</dt><dd><code>${escape(report.criteriaDigest ?? "legacy · 미확인")}</code></dd></div><div><dt>작업 상태 원문</dt><dd><code>${escape(report.work.status)}</code></dd></div></dl>${state.reasons.length ? `<h3>읽기 시 비교 결과</h3>${bullets(state.reasons)}` : ""}<h3>저장 당시 기준·명령·환경·실행 및 검토 이력</h3><pre>${escape(JSON.stringify(report.work, null, 2))}</pre>${report.narrative ? `<h3>원래 작성 서술</h3><pre>${escape(JSON.stringify(report.narrative, null, 2))}</pre>` : ""}</div></details>`;
}

function conclusionReview(report: WorkReport): string {
  const review = report.work.reviews.at(-1);
  if (!review                     ) return "미실행 · 연결 기록 없음";
  if (review.verdict === "pass"   ) return "당시 통과";
  if (review.verdict === "fail"   ) return "당시 수정 필요";
  if (review.verdict === "not_run") return "미실행 · 원인 미확인";
  return "판정 미확인";
}

function blockerMessage(report: WorkReport): string | null {
  const blocker = report.work.blockedReason;
  return blocker && /^독립 검토 not_run:/.test(blocker) ? "필수 독립 검토가 미실행입니다. 이 시도의 원인은 기록에서 확인되지 않았습니다." : blocker;
}

function conclusion(report: WorkReport, state: ViewState): string {
  const narrative       = report.narrative                                                ;
  const reader          = narrative?.reader                                               ;
  const missing         = report.work.criteria.filter((item) => item.result !== "passed") ;
  const attempts        = report.work.verifications                                       ;
  const firstAction     = reader ? reader.nextActions[0]?.action : narrative?.next[0]     ;
  const readableBlocker = blockerMessage(report)                                          ;
  return `<div class="state-grid"><p><span>저장 당시 검사</span><strong>${attempts.length ? `통과 ${attempts.filter((item) => item.result === "passed").length} · 실패 ${attempts.filter((item) => item.result === "failed").length} · 미확인 ${attempts.filter((item) => !["passed", "failed"].includes(item.result)).length}건` : "미검증 · 연결 기록 없음"}</strong></p><p><span>보고서 자료 현재성 · 검사 유효성과 별개</span><strong>${state.checked ? state.stale ? "재확인 필요" : report.sourceDigest === null ? "소스 적용성 미확인" : "보고서 대상과 동일" : "발행 시점 스냅샷"}</strong></p><p><span>저장 당시 독립 검토</span><strong>${escape(conclusionReview(report))}</strong></p><p><span>저장 당시 업무 상태</span><strong>${escape(outcomeLabels[report.outcome])}</strong></p></div>${firstAction ? `<p class="top-next"><strong>다음 행동</strong> ${escape(firstAction)}</p>` : ""}${!state.current ? '<p class="state-note">작업 기록 변경됨 · 발행 뒤 새로운 기록이 추가되거나 상태가 달라졌습니다.</p>' : ""}${readableBlocker ? `<p class="blocker"><strong>남은 차단 사항</strong> ${escape(readableBlocker)}</p>` : ""}${missing.length ? `<p class="state-note">저장 당시 기준 중 ${missing.length}개가 실패·차단·미검증 또는 미확인으로 남았습니다.</p>` : ""}`;
}

function referenceList(report: WorkReport): string {
  const references = report.narrative?.reader?.references ?? [];
  return references.length ? `<ol class="references">${references.map((item) => `<li><p>${escape(item.purpose)}</p><code>${escape(item.path)}</code></li>`).join("")}</ol>` : '<p class="muted">목적이 연결된 추가 근거 설명은 기록되지 않았습니다.</p>';
}

function reportStory(narrative: WorkReport["narrative"]): string {
  const reader = narrative?.reader;
  return reader?.story ?? (narrative ? [narrative.before, narrative.after].join("\n\n") : "자동 기록에는 작성자가 서술한 작업 이야기가 없습니다. 아래는 저장 당시 관찰값입니다.");
}

export function renderReportDocument(report: WorkReport, state: ViewState): string {
  const narrative = report.narrative  ;
  const reader    = narrative?.reader ;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(report.title)} — WWW 작업 보고서</title><style>
:root{--sky:#edf6fc;--paper:#fff;--ink:#203b4b;--muted:#536d7c;--line:#c8dce8;--blue:#245f91;--yellow:#f4ce62;--red:#b73836;--green:#236b58;--round:"Arial Rounded MT Bold","Apple SD Gothic Neo","Malgun Gothic",sans-serif;--body:"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--sky);color:var(--ink);font:16px/1.8 var(--body)}.page{width:min(1180px,calc(100% - 64px));margin:auto;padding:0 0 48px}header{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:24px 0;border-bottom:1px solid var(--line);font-size:13px}.book{font-weight:800}.written{color:var(--muted)}.hero{padding:36px 0 12px}h1{max-width:920px;font:800 clamp(29px,4.3vw,48px)/1.25 var(--round);letter-spacing:-.045em;margin:8px 0 20px;overflow-wrap:anywhere}.lead{font-size:19px;max-width:860px;word-break:keep-all;margin:0 0 24px}.state-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;border:1px solid var(--line);border-radius:15px;background:var(--paper);padding:14px 20px}.state-grid p{margin:0}.state-grid span{display:block;color:var(--muted);font-size:12px}.state-grid strong{font-size:16px}.state-note{font-size:14px;color:var(--muted);margin:12px 0}.blocker{border-left:4px solid var(--red);background:#fff0ed;border-radius:6px;padding:12px 16px;font-size:14px}.blocker strong{display:block}.story{font-size:17px;line-height:1.9;white-space:pre-wrap;max-width:860px;margin:28px 0 20px;word-break:keep-all;overflow-wrap:anywhere}.legacy-changes{max-width:860px;margin-bottom:26px}.paper{padding:28px;border:1px solid var(--line);background:var(--paper);border-radius:22px;margin:22px 0;box-shadow:0 5px 0 #dfecf5}h2{font:800 24px/1.4 var(--round);letter-spacing:-.025em;margin:0 0 20px}h3{font-size:17px;line-height:1.5;margin:18px 0 10px}h4{font-size:14px;margin:15px 0 8px}p,li,dd,dt{overflow-wrap:anywhere}p{margin:10px 0}ul,ol{padding-left:22px}li+li{margin-top:10px}.muted{color:var(--muted);font-size:14px}.requirement,.decision,.check,.next{padding:10px 0 22px;border-bottom:1px solid var(--line)}.requirement:last-child,.decision:last-child,.check:last-child,.next:last-child{border-bottom:0;padding-bottom:0}.result{font-weight:600}.support,.limit{font-size:14px;color:var(--muted)}dl{margin:12px 0}dl>div{display:grid;grid-template-columns:130px minmax(0,1fr);gap:14px;padding:10px 0}dt{font-weight:600;font-size:14px}dd{margin:0;white-space:pre-wrap}.requirements>div{border-bottom:1px solid var(--line);grid-template-columns:minmax(0,1fr) minmax(130px,.45fr)}.applicability{font-size:14px;border-left:3px solid var(--blue);padding:9px 14px;background:var(--sky);margin-bottom:24px}.record-result,.review-state{font-size:14px}.references li{padding:8px 0}.references p{margin:0 0 5px}code{font:12px/1.6 ui-monospace,monospace;overflow-wrap:anywhere;white-space:pre-wrap}.omission{padding:16px 20px;border:1px dashed var(--red);border-radius:12px;font-size:14px;margin:22px 0}.omission p{margin-bottom:0}details{margin-top:24px;padding-top:18px;border-top:1px solid var(--line);font-size:13px}summary{cursor:pointer;color:var(--blue);font-weight:600;padding:8px 0}summary:focus-visible{outline:3px solid var(--blue);outline-offset:4px}.raw{padding:14px 0;color:var(--muted)}pre{max-height:460px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 ui-monospace,monospace;background:#e7f0f6;padding:16px;border-radius:10px}.source{padding:15px 0;font-size:14px}.source p{margin:0 0 5px}@media(max-width:700px){.page{width:calc(100% - 28px)}header{flex-wrap:wrap;gap:5px;padding:18px 0}.hero{padding-top:22px}.lead{font-size:17px}.state-grid{grid-template-columns:1fr;padding:14px}.paper{padding:20px;border-radius:17px}h2{font-size:22px}.story{font-size:16px}.requirements>div,dl>div{grid-template-columns:1fr;gap:4px}dd{padding-left:0}pre{padding:12px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}@media print{body{background:white;color:#162d3c;font-size:11pt}.page{width:100%;padding:0}.hero{padding-top:18px}h1{font-size:25pt}.lead{font-size:13pt}.story{font-size:11pt;line-height:1.65}.paper{box-shadow:none;border-color:#9baeb9;padding:16px;break-inside:auto}.check,.requirement,.decision,.next{break-inside:avoid}#report-raw{display:none!important}pre{max-height:none;overflow:visible;white-space:pre-wrap;font-size:8pt}.state-grid{break-inside:avoid}.omission{break-inside:avoid}summary{color:#162d3c}}
</style></head><body><main class="page"><header><span class="book">WWW 작업 보고서</span><span class="written">${escape(writtenAt(report.createdAt))} · 한국 시간 · ${report.kind === "authored" ? "작성자 보고서" : "자동 기록"}</span></header><section class="hero" id="report-conclusion"><h1>${escape(report.title)}</h1><p class="lead">${escape(report.summary)}</p><div id="report-story" class="story">${escape(reportStory(narrative))}</div>${conclusion(report, state)}${!reader && narrative?.changes.length ? `<div class="legacy-changes"><h3>기록된 변경</h3>${bullets(narrative.changes)}</div>` : ""}</section>${omissions(report)}<section class="paper" id="report-requirements"><h2>요구와 결과</h2>${requirements(report)}</section>${decisions(report)}${verification(report, state)}${nextActions(report)}<section class="paper" id="report-references"><h2>판단을 되짚는 근거</h2>${referenceList(report)}<div class="source"><p>작업의 기준·실행 기록과 이 보고서의 출처를 대조할 때 확인할 파일입니다.</p><code>${escape(report.source.recordPath)}</code></div>${rawDetails(report, state)}</section></main></body></html>`;
}
