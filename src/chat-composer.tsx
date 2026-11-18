/**
 * @architecture arch.chat.workspace
 * @implements RESP-CHAT-WORKSPACE
 */
import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { MAX_PROMPT_CHARS, composerFull, pasteOverflow } from './chat-state';
import { handlePromptKeyDown, normalizeCompositionEnd } from './input';
import type { chatStatus } from './chat-status';

interface ComposerProps {
  snapshot: { text: string; revision: number };
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onDraft: (text: string) => void;
  onSubmit: () => void;
  onInterrupt: () => void;
  status: ReturnType<typeof chatStatus>;
  disabled: boolean;
  blocked: boolean;
  sending: boolean;
  working: boolean;
  interruptPending: boolean;
  notice: string;
  startedAt: number | null;
  lastActivityAt: number | null;
}

function WorkingIndicator({ status, startedAt, lastActivityAt }: Pick<ComposerProps, 'status' | 'startedAt' | 'lastActivityAt'>) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (status.tone !== 'working') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status.tone]);
  return <div className={`chat-working-status is-${status.tone}`} data-testid="working-status" role="status"><span aria-hidden="true">{status.tone === 'working' ? '●' : status.tone === 'failed' ? '×' : '○'}</span> {status.label}{status.tone === 'working' && startedAt !== null && <span> · {Math.max(0, Math.floor((now - startedAt) / 1000))}초</span>}{status.tone === 'working' && lastActivityAt !== null && now - lastActivityAt >= 15000 && <span> · 새 활동 대기</span>}</div>;
}

// 입력값은 이 경계 안에서 즉시 갱신한다. 부모에는 ref와 빈 초안 여부만 전달한다.
export const ChatComposer = memo(function ChatComposer(props: ComposerProps) {
  const [draft, setDraft] = useState(props.snapshot.text);
  const [notice, setNotice] = useState('');
  const composing = useRef(false);
  const compositionEnd = useRef<number | null>(null);
  useLayoutEffect(() => { setDraft(props.snapshot.text); setNotice(''); }, [props.snapshot]);
  const actionBlocked = props.blocked || props.disabled || props.sending || !draft.trim() || draft.length > MAX_PROMPT_CHARS || (props.working && !props.status.steer);
  return <>
    <WorkingIndicator status={props.status} startedAt={props.startedAt} lastActivityAt={props.lastActivityAt}/>
    {props.working && <div className="chat-steer-notice" data-testid="steer-notice">{props.status.reason}</div>}
    <div className="compose"><span className="prompt" aria-hidden="true">›</span><textarea ref={props.inputRef} data-testid="prompt-input" value={draft} maxLength={MAX_PROMPT_CHARS} disabled={props.disabled} aria-label="Codex에게 작업 요청" onChange={(event) => { const text = event.currentTarget.value; setDraft(text); props.onDraft(text); setNotice(composerFull(text.length, MAX_PROMPT_CHARS) ? '입력 한도에 도달했습니다.' : ''); }} onPaste={(event) => {
      const count = pasteOverflow(draft, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, event.clipboardData.getData('text/plain'), MAX_PROMPT_CHARS);
      if (count > 0) { event.preventDefault(); setNotice(`붙여넣을 내용이 입력 한도를 ${count.toLocaleString('ko-KR')}자 넘어서 추가하지 않았습니다.`); }
    }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={(event) => { composing.current = false; compositionEnd.current = normalizeCompositionEnd(event.nativeEvent.timeStamp); }} onBlur={() => { composing.current = false; }} onKeyDown={(event) => handlePromptKeyDown(event, () => { if (!actionBlocked) props.onSubmit(); }, composing.current, compositionEnd.current)} placeholder={props.status.steer ? '현재 작업에 추가 지시' : 'Codex에게 작업 요청'}/>
      <div className="actions">{props.working && <button data-testid="interrupt-button" className="secondary" onClick={props.onInterrupt} disabled={props.interruptPending}>중단{props.interruptPending ? ' 확인 중' : ''}</button>}<button data-testid="send-button" className="primary" onClick={props.onSubmit} disabled={actionBlocked}>{props.sending ? '전송 중' : props.status.steer ? 'Steer · 추가 지시' : '보내기'}</button></div>
    </div><div className="chat-compose-note" role="status">{notice || props.notice || `Enter ${props.status.steer ? '추가 지시' : '전송'} · Shift+Enter 줄바꿈 · ${draft.length.toLocaleString('ko-KR')}/${MAX_PROMPT_CHARS.toLocaleString('ko-KR')}`}</div>
  </>;
});
