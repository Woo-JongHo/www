/**
 * @architecture arch.chat.workspace
 * @implements RESP-CHAT-WORKSPACE
 */
import { useEffect, useState } from "react";
import type { RpaStandardCase, RpaStandardSnapshot, WorkspaceSelection } from "./shared";
import { useSessionApi } from "./session-api";

const resultLabel = {
  completed: "완료", partial: "부분 실패", incomplete: "미완료", failed: "실패", skipped: "건너뜀",
};
const caseRerun = { safe: "가능", unsafe: "차단", unknown: "반영 확인 필요" };
const effectLabel = { none: "없음", read: "읽기", write_local: "파일 쓰기", write_external: "외부 변경" };
const coreLabel = { matched: "일치", different: "불일치", missing: "manifest 없음", invalid: "조회 실패" };

export function RpaStandardView({ workspace }: { workspace: WorkspaceSelection }) {
  const api = useSessionApi();
  const { workspaceKey, processEpoch, selectionEpoch, sessionId } = workspace;
  const [snapshot, setSnapshot] = useState<RpaStandardSnapshot>();
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setError(false);
    setSnapshot(undefined);
    void api.rpaStandard({ workspaceKey, processEpoch, selectionEpoch, sessionId }).then(value => {
      if (current) setSnapshot(value);
    }, () => {
      if (current) setError(true);
    });
    return () => { current = false; };
  }, [api, workspaceKey, processEpoch, selectionEpoch, sessionId, refresh]);
  const run = snapshot?.run;
  const outcomes = new Map<string, Extract<NonNullable<RpaStandardSnapshot>["run"], { state: "observed" }>["units"]>();
  if (run?.state === "observed") for (const item of run.units) {
    const attempts = outcomes.get(item.id);
    if (attempts) attempts.push(item);
    else outcomes.set(item.id, [item]);
  }
  const knownUnits = new Set(snapshot?.processes.flatMap(process => process.tasks.flatMap(task => task.units.map(unit => unit.id))));
  const casesByUnit = new Map<string, RpaStandardCase[]>();
  for (const item of snapshot?.cases ?? []) {
    const cases = casesByUnit.get(item.unit);
    if (cases) cases.push(item);
    else casesByUnit.set(item.unit, [item]);
  }
  const unmapped = [...outcomes.keys()].filter(id => !knownUnits.has(id));

  return <section className="monitoring-work" aria-label="RPA 표준">
    <header className="monitoring-identity">
      <h1>RPA 표준</h1>
      <p>{workspace.name}{snapshot && <> · <code>{snapshot.projectId}</code> · 표준 {snapshot.standardVersion}</>}</p>
      <button className="secondary" type="button" onClick={() => setRefresh(value => value + 1)}>새로고침</button>
    </header>
    {error && <p role="alert">RPA 개발 프로필 또는 지도를 읽지 못했습니다.</p>}
    {!error && snapshot === undefined && <p role="status">RPA 표준을 불러오는 중…</p>}
    {snapshot === null && <p>RPA 개발 프로필이 없습니다.</p>}
    {snapshot && <>
      <section className="monitoring-identity" aria-label="공통 Core">
        <h2>공통 Core</h2>
        <p>{snapshot.coreVersion} · {coreLabel[snapshot.core.status]} · 관리 파일 {snapshot.core.matched}/{snapshot.core.total}</p>
        {snapshot.core.differences.length > 0 && <ul>{snapshot.core.differences.map(item => <li key={item}>{item}</li>)}</ul>}
      </section>
      <section className="monitoring-identity" aria-label="최근 실행 로그">
        <h2>최근 실행 로그</h2>
        {run?.state === "missing" && <p>로컬에서 공통 실행 기록을 찾지 못했습니다.</p>}
        {run?.state === "limit" && <p>실행 디렉터리 조회 한도(1,000개)를 넘어 최신 기록을 확인하지 못했습니다.</p>}
        {run?.state === "invalid" && <p>공통 실행 기록을 확인할 수 없습니다.</p>}
        {run?.state === "unfinished" && <p><code>{run.id}</code> · 종료 결과 없음</p>}
        {run?.state === "observed" && <>
          <p><code>{run.id}</code> · {resultLabel[run.status]} · 종료 코드 {run.exitCode} · {new Date(run.finishedAt).toLocaleString("ko-KR")}</p>
          <ul>{run.logs.map(log => <li key={log.name}><code>{log.name}</code> · {log.present ? "있음" : "없음"}</li>)}</ul>
        </>}
        {unmapped.length > 0 && <p>현재 지도에 없는 실행 Unit · {unmapped.join(", ")}</p>}
      </section>
      <section className="monitoring-identity" aria-label="업무 구조">
        <h2>Process · Task · Unit</h2>
        {snapshot.cases === null && <p role="status">업무 Case를 읽을 수 없습니다.</p>}
        {snapshot.processes.map(process => <section key={process.id}>
          <h3><code>{process.id}</code> {process.name}</h3>
          {process.tasks.map(task => <details key={task.id} open>
            <summary><code>{task.id}</code> {task.name}</summary>
            <ul>{task.units.map(unit => {
              const attempts = outcomes.get(unit.id) ?? [];
              return <li key={unit.id}>
                <code>{unit.id}</code> · 부수효과 {effectLabel[unit.effect]} · 재실행 {unit.rerun === "unknown" ? "미확인" : unit.rerun ? "가능" : "차단"} · 실패 시 {unit.abort === null ? "미확인" : unit.abort ? "중단" : "계속"}
                {(casesByUnit.get(unit.id) ?? []).map(item => <details key={item.id}>
                  <summary>대응 Case · {item.condition}</summary>
                  <p>기대 결과 · {item.expected}</p>
                  <p>다음 조치 · {item.handling}</p>
                  <p>재실행 · {caseRerun[item.rerun]}</p>
                </details>)}
                {attempts.length > 0 && <> · 최근 실행 {attempts.map(item => `${resultLabel[item.status]} (${item.seconds.toFixed(2)}초)`).join(" → ")}</>}
              </li>;
            })}</ul>
          </details>)}
        </section>)}
      </section>
    </>}
  </section>;
}
