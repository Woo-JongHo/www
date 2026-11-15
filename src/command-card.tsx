/**
 * @architecture arch.chat.messages.execution
 * @implements RESP-CHAT-MESSAGES-EXECUTION
 */
import { useEffect, useMemo, useState } from "react";
import { useChatRowToggle } from "./chat-row-state";
import { commandOutput, commandPreview, jsonTokens, shellTokens, type SyntaxToken } from "./command-preview";
import { MAX_OUTPUT_CODE_UNITS, type Block } from "./projection";

function Highlight({ tokens }: { tokens: SyntaxToken[] }) {
  return tokens.map((token, index) => token.kind === 'plain' ? token.text
    : <span className={`syntax-${token.kind}`} key={index}>{token.text}</span>);
}

export function CommandView({ block }: { block: Extract<Block, { kind: "command" }> }) {
  const [raw, setRaw] = useChatRowToggle(`${block.id}:raw-output`, false);
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => { setCopyStatus(''); }, [block.output]);
  const display = useMemo(() => commandOutput(block.output, block.running, block.outputTruncated), [block.output, block.running, block.outputTruncated]);
  const text = raw ? block.output : display.text;
  const copy = async () => {
    try { await navigator.clipboard.writeText(block.output); setCopyStatus('원문 복사됨'); }
    catch { setCopyStatus('원문 복사 실패'); }
  };
  const failed = block.status === "failed";
  const [selectedOpen, setOpen, remembered] = useChatRowToggle(block.id, failed);
  const open = remembered ? selectedOpen : failed;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!block.running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [block.running]);
  const state = block.running ? "실행 중"
    : failed ? "실패"
        : block.status === "declined" ? "거절"
          : block.turnInterrupted && block.status === "unknown" ? "턴 중단 · 명령 결과 미확인"
      : block.status === "completed" ? "실행 종료" : "결과 미확인";
  const preview = commandPreview(text, block.running);

  const endpoint = block.endedAt ?? (block.running ? now : null);
  const elapsed = block.startedAt !== null && endpoint !== null
    ? `${Math.max(0, Math.floor((endpoint - block.startedAt) / 1000))}초`
    : "시간 미제공";
  return <section className={`cmd command-card item-${block.status}`} data-testid="command-card">
    <header className="command-heading"><span className="command-state"><span aria-hidden="true">{block.running ? "●" : failed ? "×" : block.status === "completed" ? "✓" : "?"}</span> {state}</span><span className="muted">{elapsed}{block.exitCode !== null ? ` · 종료 코드 ${block.exitCode}` : !block.running ? " · 종료 코드 미제공" : ""}</span></header>
    <div className="cmdline" tabIndex={0} aria-label="실행 명령"><Highlight tokens={shellTokens(block.command || "명령 정보 미제공")}/></div>
    {block.cwd && <div className="command-path">작업 경로: {block.cwd}</div>}
    {display.review && <div className={`command-review review-${display.review}`}>
      출력의 검토 판정: <strong>{{ pass: '통과', fail: '수정 필요', not_run: '미실행' }[display.review]}</strong>
      <span>출력에 기록된 보고값 · 프로세스 종료와 별개이며 업무 완료를 보증하지 않습니다.</span>
    </div>}
    <div className="command-output-tools">
      {display.json && <button type="button" aria-pressed={raw} onClick={() => setRaw(!raw)}>{raw ? 'JSON 정렬 보기' : '원문 보기'}</button>}
      <span>{display.json && !raw ? 'JSON · 2칸 들여쓰기' : '원문 출력'}</span>
      <button type="button" disabled={!block.output} onClick={() => { void copy(); }}>원문 복사</button>
      <span role="status">{copyStatus}</span>
    </div>
    <pre tabIndex={0} aria-label="명령 출력 미리보기" data-testid="command-preview">{display.json && !raw ? <Highlight tokens={jsonTokens(preview.text)}/> : preview.text || "출력 없음"}</pre>
    {preview.hiddenLines > 0 && <div className="command-note">{block.outputTruncated ? "보관된 출력의 " : ""}{block.running ? "최근" : "앞"} 10줄 미리보기 · {block.outputTruncated ? "보관 범위 안에서 " : ""}{preview.hiddenLines.toLocaleString("ko-KR")}줄 생략{display.json && !raw ? " · 정렬된 표시 줄 기준" : ""}</div>}
    {block.outputTruncated && <div className="command-note">보관 범위가 중간 줄에서 시작할 수 있습니다. 제거된 원본 줄 수는 미확인입니다.</div>}
    <details open={open} className="command-output">
      <summary onClick={(event) => { event.preventDefault(); setOpen(!open); }}>보관된 출력 {open ? "접기" : "펼치기"}</summary>
      <pre tabIndex={0} aria-label="보관된 명령 출력">{display.json && !raw ? <Highlight tokens={jsonTokens(text)}/> : text || "출력 없음"}</pre>
      <div className="command-note">{block.outputTruncated ? "앞부분 보관 한도 초과" : "수신한 출력"} · 출력 스트림 구분은 미제공</div>
    </details>
    {block.outputTruncated && <div className="command-note">최근 {MAX_OUTPUT_CODE_UNITS.toLocaleString("ko-KR")} UTF-16 코드 단위만 보관합니다. 앞부분은 제거되어 복원할 수 없습니다.</div>}
  </section>;
}
