/**
 * @architecture arch.chat.workspace
 * @implements RESP-CHAT-WORKSPACE
 */
import { memo, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { MAX_PROMPT_CHARS, composerFull, pasteOverflow, slashCommand } from './chat-state';
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
  const [dismissedSlash, setDismissedSlash] = useState('');
  const [selectedSlash, setSelectedSlash] = useState(0);
  const slashListId = useId();
  const composing = useRef(false);
  const compositionEnd = useRef<number | null>(null);
  const endedInHangul = useRef(false);
  const enterGesture = useRef<{ released: boolean; koreanCommitted: boolean } | null>(null);
  useLayoutEffect(() => {
    enterGesture.current = null;
    endedInHangul.current = false;
    setDraft(props.snapshot.text);
    setNotice('');
    setDismissedSlash('');
    setSelectedSlash(0);
  }, [props.snapshot]);
  const actionBlocked = props.blocked || props.disabled || props.sending || !draft.trim() || draft.length > MAX_PROMPT_CHARS || (props.working && !props.status.steer);
  const slashOptions = ['/model', '/compact', '/theme'].filter((value) => /^\/\S*$/.test(draft) && value.startsWith(draft));
  const slashOpen = !actionBlocked && !props.working && slashOptions.length > 0 && dismissedSlash !== draft;
  const chooseSlash = (value: string) => {
    if (actionBlocked || props.working) return;
    const command = slashCommand(value);
    if (!command) return;
    setDismissedSlash(value);
    setDraft(value);
    props.onDraft(value);
    props.onSubmit();
  };
  const sendCommitted = (input: HTMLTextAreaElement) => {
    const text = input.value;
    enterGesture.current = null;
    endedInHangul.current = false;
    if (document.activeElement !== input || props.blocked || props.disabled || props.sending
      || !text.trim() || text.length > MAX_PROMPT_CHARS || (props.working && !props.status.steer)) return;
    props.onDraft(text);
    props.onSubmit();
  };
  return <>
    <WorkingIndicator status={props.status} startedAt={props.startedAt} lastActivityAt={props.lastActivityAt}/>
    {props.working && <div className="chat-steer-notice" data-testid="steer-notice">{props.status.reason}</div>}
    <div className="compose-shell"><div className="compose"><span className="prompt" aria-hidden="true">›</span><textarea ref={props.inputRef} data-testid="prompt-input" value={draft} maxLength={MAX_PROMPT_CHARS} disabled={props.disabled} aria-label="Codex에게 작업 요청" aria-expanded={slashOpen} aria-controls={slashOpen ? slashListId : undefined} onChange={(event) => { const text = event.currentTarget.value; setDraft(text); setDismissedSlash(''); setSelectedSlash(0); props.onDraft(text); setNotice(composerFull(text.length, MAX_PROMPT_CHARS) ? '입력 한도에 도달했습니다.' : ''); }} onPaste={(event) => {
      const count = pasteOverflow(draft, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, event.clipboardData.getData('text/plain'), MAX_PROMPT_CHARS);
      if (count > 0) { event.preventDefault(); setNotice(`붙여넣을 내용이 입력 한도를 ${count.toLocaleString('ko-KR')}자 넘어서 추가하지 않았습니다.`); }
    }} onCompositionStart={() => {
      composing.current = true;
      endedInHangul.current = false;
      enterGesture.current = null;
    }} onCompositionEnd={(event) => {
      composing.current = false;
      compositionEnd.current = normalizeCompositionEnd(event.nativeEvent.timeStamp);
      endedInHangul.current = /\p{Script=Hangul}/u.test(event.data);
      const gesture = enterGesture.current;
      if (!gesture) return;
      if (!endedInHangul.current) { enterGesture.current = null; return; }
      gesture.koreanCommitted = true;
      if (gesture.released) {
        const input = event.currentTarget;
        queueMicrotask(() => { if (enterGesture.current === gesture) sendCommitted(input); });
      }
    }} onPointerDown={() => {
      endedInHangul.current = false;
      enterGesture.current = null;
    }} onBlur={() => {
      endedInHangul.current = false;
      composing.current = false;
      enterGesture.current = null;
    }} onKeyDown={(event) => {
      if (slashOpen && !composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        setSelectedSlash((current) => (current + (event.key === 'ArrowDown' ? 1 : slashOptions.length - 1)) % slashOptions.length);
        return;
      }
      if (slashOpen && !composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && event.key === 'Escape') {
        event.preventDefault();
        setDismissedSlash(draft);
        return;
      }
      const enter = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
      if (!enter || event.shiftKey) {
        endedInHangul.current = false;
        enterGesture.current = null;
        return;
      }
      // 일부 IME는 같은 물리 Enter의 keydown보다 compositionend를 먼저 전달한다.
      const boundary = compositionEnd.current;
      if (!enterGesture.current && !composing.current && endedInHangul.current
        && (event.nativeEvent.keyCode === 229 || (boundary !== null && event.nativeEvent.timeStamp <= boundary))) {
        if (!event.repeat) enterGesture.current = { released: false, koreanCommitted: true };
        endedInHangul.current = false;
        event.preventDefault();
        return;
      }
      if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
        if (!event.repeat && !enterGesture.current) enterGesture.current = { released: false, koreanCommitted: false };
        return;
      }
      if (enterGesture.current || event.repeat) { event.preventDefault(); return; }
      if (slashOpen) {
        event.preventDefault();
        chooseSlash(slashOptions[selectedSlash] ?? slashOptions[0]!);
        return;
      }
      handlePromptKeyDown(event, () => { if (!actionBlocked) props.onSubmit(); }, false, compositionEnd.current);
    }} onKeyUp={(event) => {
      const gesture = enterGesture.current;
      if (!gesture || !(event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter')) return;
      gesture.released = true;
      if (gesture.koreanCommitted) sendCommitted(event.currentTarget);
      else if (!composing.current) enterGesture.current = null;
      else window.setTimeout(() => {
        if (enterGesture.current === gesture) enterGesture.current = null;
      }, 0);
    }} placeholder={props.status.steer ? '현재 작업에 추가 지시' : 'Codex에게 작업 요청'}/>
      <div className="actions">{props.working && <button data-testid="interrupt-button" className="secondary" onClick={props.onInterrupt} disabled={props.interruptPending}>중단{props.interruptPending ? ' 확인 중' : ''}</button>}<button data-testid="send-button" className="primary" onClick={props.onSubmit} disabled={actionBlocked}>{props.sending ? '전송 중' : props.status.steer ? 'Steer · 추가 지시' : '보내기'}</button></div>
    </div>{slashOpen && <div id={slashListId} className="slash-command-list" data-testid="slash-command-list" role="listbox" aria-label="슬래시 명령 목록">{slashOptions.map((value, index) => <button key={value} type="button" role="option" aria-selected={index === selectedSlash} data-testid="slash-command-option" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSlash(value)}>{value}</button>)}</div>}</div><div className="chat-compose-note" role="status">{notice || props.notice || `Enter ${props.status.steer ? '추가 지시' : '전송'} · Shift+Enter 줄바꿈 · ${draft.length.toLocaleString('ko-KR')}/${MAX_PROMPT_CHARS.toLocaleString('ko-KR')}`}</div>
  </>;
});
