/**
 * @architecture arch.chat.workspace
 * @implements RESP-CHAT-WORKSPACE
 */
import { useRef } from "react";
import type { KeyboardEvent } from "react";
import type { NativeSessionSummary } from "./shared";

interface ClosePermission { allowed: boolean; reason?: string }
export interface SessionTabsProps {
  tabs: NativeSessionSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  creating: boolean;
  canCreate?: boolean;
  error?: string;
  canClose?: (id: string) => ClosePermission;
}

export function sessionTabDestination(key: string, index: number, count: number): number | null {
  if (count < 1) return null;
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index + count - 1) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

export function SessionTabs({ tabs, activeId, onSelect, onCreate, onClose, creating, canCreate = true, error, canClose }: SessionTabsProps) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const destination = sessionTabDestination(event.key, index, tabs.length);
    if (destination === null) return;
    event.preventDefault();
    const target = tabs[destination];
    if (target) { onSelect(target.id); buttons.current.get(target.id)?.focus(); }
  }
  return <div className="session-tabs-bar">
    <div className="session-tabs-list" role="tablist" aria-label="Codex 대화 탭">
      {tabs.map((tab, index) => {
        const permission = canClose?.(tab.id);
        const reason = tabs.length === 1 ? "마지막 탭은 닫을 수 없습니다." : tab.approvalCount > 0 ? "승인 요청을 처리한 뒤 닫을 수 있습니다." : tab.busy ? "실행이 끝난 뒤 닫을 수 있습니다." : permission && !permission.allowed ? permission.reason || "이 탭은 지금 닫을 수 없습니다." : "";
        return <div className={`session-tab-item${tab.id === activeId ? " is-active" : ""}`} key={tab.id}>
          <button type="button" role="tab" id={`session-tab-${tab.id}`} aria-controls={`session-panel-${tab.id}`} aria-describedby={reason ? `session-close-reason-${tab.id}` : undefined} aria-selected={tab.id === activeId} tabIndex={tab.id === activeId ? 0 : -1} ref={(node) => { if (node) buttons.current.set(tab.id, node); else buttons.current.delete(tab.id); }} onClick={() => onSelect(tab.id)} onKeyDown={(event) => navigate(event, index)}>
            <span className="session-tab-title" title={tab.title}>{tab.title}</span><span className="session-tab-project" title={tab.workspace.path}>{tab.workspace.name}</span>
            {tab.busy && <span className="session-tab-state running">실행 중</span>}
            {tab.approvalCount > 0 && <span className="session-tab-state approval">승인 {tab.approvalCount}</span>}
            {tab.failed && <span className="session-tab-state failed">실패</span>}
          </button>
          <button type="button" className="session-tab-close" aria-label={`${tab.title} 탭 닫기${reason ? `: ${reason}` : ""}`} title={reason || `${tab.title} 탭 닫기`} disabled={Boolean(reason)} onClick={() => onClose(tab.id)}>×</button>
          {reason && <span className="sr-only" id={`session-close-reason-${tab.id}`}>{reason}</span>}
        </div>;
      })}
    </div>
    <button type="button" className="session-tab-create" onClick={onCreate} disabled={creating || !canCreate} aria-label="새 대화 탭 추가" title={creating ? "탭을 추가하는 중" : !canCreate ? "작업 폴더를 선택해 주세요" : "새 대화 탭 추가"}>＋</button>
    {error && <span className="session-tabs-error" role="alert">{error}</span>}
  </div>;
}
