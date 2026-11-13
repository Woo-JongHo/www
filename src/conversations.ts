import { resolve } from "node:path";
import type { AppEvent, ConversationCatalog, ConversationSummary } from "./shared";

export type ConversationEvent = Omit<AppEvent, "seq" | "at">;

interface NativeRequester {
  request(method: string, params: unknown): Promise<unknown>;
}

interface SavedTurn {
  id     : string    ;
  status : string    ;
  items  : unknown[] ;
}

export interface RestoredConversation {
  threadId : string              ;
  model    : string | null       ;
  provider : string | null       ;
  approvalPolicy : string | null;
  sandbox : string | null;
  events   : ConversationEvent[] ;
}

const MAX_RESTORED_EVENTS = 1_990;
const MAX_PUBLIC_TEXT = 100_000;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new Error("Native 대화 응답 형식이 올바르지 않습니다.");
  return value;
}

function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

function identifier(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 512 || /[\u0000-\u001f]/u.test(value)) throw new Error("대화 ID가 올바르지 않습니다.");
  return value;
}

function cursorValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !value || value.length > 4096) throw new Error("대화 페이지 커서가 올바르지 않습니다.");
  return value;
}

function sameWorkspace(value: unknown, cwd: string): boolean {
  return typeof value === "string" && value.startsWith("/") && resolve(value) === resolve(cwd);
}

function threadRecord(value: unknown, cwd: string, expectedId?: string): Record<string, unknown> {
  const thread = record(record(value).thread);
  const id = identifier(thread.id);
  if (expectedId && id !== expectedId) throw new Error("요청한 대화와 Native 응답이 다릅니다.");
  if (!sameWorkspace(thread.cwd, cwd)) throw new Error("선택한 작업 폴더에 속한 대화만 열 수 있습니다.");
  if (thread.originator !== "www") throw new Error("WWW에서 만든 대화만 열 수 있습니다.");
  if (thread.ephemeral === true) throw new Error("임시 대화는 다시 열 수 없습니다.");
  return thread;
}

function summary(thread: Record<string, unknown>): ConversationSummary {
  const preview = text(thread.preview).slice(0, 500);
  const status = object(thread.status) ? thread.status.type : null;
  return {
    id        : identifier(thread.id)                                                      ,
    title     : (text(thread.name).trim() || preview.trim() || "제목 없는 대화").slice(0, 120) ,
    preview                                                                               ,
    cwd       : text(thread.cwd)                                                          ,
    updatedAt : typeof thread.updatedAt === "number" && Number.isFinite(thread.updatedAt) ? thread.updatedAt : null,
    status    : status === "active" ? "active" : status === "idle" || status === "notLoaded" ? "idle" : "unknown"
  };
}

/** 저장된 화면 기록은 공개 필드만 복원하며 승인 요청·원문 reasoning은 재생하지 않는다. */
function publicItem(value: unknown): Record<string, unknown> | null {
  if (!object(value) || !text(value.id)) return null;
  const id = text(value.id);
  if (value.type === "agentMessage" || value.type === "plan") {
    if (typeof value.text !== "string" || value.phase === "analysis" || value.phase === "reasoning") return null;
    return { id, type: value.type, text: value.text, phase: value.phase === "commentary" ? "commentary" : null };
  }
  if (value.type === "reasoning") {
    const summary = list(value.summary).filter((part): part is string => typeof part === "string");
    return summary.length ? { id, type: "reasoning", summary } : null;
  }
  if (value.type === "commandExecution") {
    return {
      id, type: "commandExecution",
      command          : text(value.command).slice(0, MAX_PUBLIC_TEXT)           ,
      cwd              : text(value.cwd) || null                                ,
      aggregatedOutput : text(value.aggregatedOutput)            ,
      status           : value.status === "completed" || value.status === "failed" || value.status === "declined" ? value.status : "unknown",
      exitCode         : typeof value.exitCode === "number" && Number.isFinite(value.exitCode) ? value.exitCode : null
    };
  }
  if (value.type === "fileChange") {
    const changes = list(value.changes).flatMap((entry) => object(entry) && text(entry.path)
      ? [{ path: text(entry.path), diff: typeof entry.diff === "string" ? entry.diff : null }]
      : []);
    return { id, type: "fileChange", changes, status: value.status === "completed" || value.status === "failed" ? value.status : "unknown" };
  }
  return null;
}

function userText(value: Record<string, unknown>): string {
  return list(value.content).flatMap((part) => object(part) && part.type === "text" && typeof part.text === "string" ? [part.text] : []).join("\n").slice(0, MAX_PUBLIC_TEXT);
}

function savedTurn(value: unknown): SavedTurn {
  const turn = record(value);
  if (!Array.isArray(turn.items)) throw new Error("저장된 대화 항목이 제공되지 않았습니다.");
  return { id: identifier(turn.id), status: text(turn.status), items: turn.items };
}

export function restoreConversationEvents(threadId: string, turns: readonly SavedTurn[], complete: boolean): ConversationEvent[] {
  const events: ConversationEvent[] = [];
  const append = (method: string, params: unknown) => events.push({ kind: "notification", method, params, historical: true });
  for (const turn of turns) {
    append("turn/started", { threadId, turn: { id: turn.id } });
    for (const value of turn.items) {
      if (object(value) && value.type === "userMessage") {
        const clientRequestId = `history:${threadId}:${turn.id}:${text(value.id)}`;
        append("turn/userPrompt", { threadId, clientRequestId, text: userText(value) || "텍스트 외 입력" });
        append("turn/startAccepted", { threadId, turnId: turn.id, clientRequestId });
      } else {
        const item = publicItem(value);
        if (item) append("item/completed", { threadId, turnId: turn.id, item });
      }
    }
    const status = ["completed", "interrupted", "failed"].includes(turn.status) ? turn.status : "unknown";
    append("turn/completed", { threadId, turn: { id: turn.id, status } });
  }
  const retained = events.slice(-MAX_RESTORED_EVENTS);
  const isComplete = complete && retained.length === events.length;
  return [{ kind: "notification", method: "conversation/restored", params: { threadId, complete: isComplete }, historical: true }, ...retained];
}

/** Native 원장을 저장 원본으로 사용한다. 별도 메시지 DB나 자동 재전송을 만들지 않는다. */
export function createConversationService(client: NativeRequester, cwd: string) {
  return {
    async list(cursor?: unknown): Promise<ConversationCatalog> {
      const result = record(await client.request("thread/list", {
        cwd, sourceKinds: ["appServer", "vscode"], archived: false, limit: 50, sortKey: "updated_at", cursor: cursorValue(cursor)
      }));
      if (!Array.isArray(result.data)) throw new Error("Native 대화 목록이 제공되지 않았습니다.");
      const threads = result.data.flatMap((value) => object(value) && sameWorkspace(value.cwd, cwd) && value.originator === "www" && value.ephemeral !== true ? [summary(value)] : []);
      return { threads, nextCursor: cursorValue(result.nextCursor) };
    },

    async open(threadIdValue: unknown): Promise<RestoredConversation> {
      const threadId = identifier(threadIdValue);
      const initial = threadRecord(await client.request("thread/read", { threadId, includeTurns: false }), cwd, threadId);
      if (object(initial.status) && initial.status.type === "active") throw new Error("실행 중인 대화는 종료 후 다시 열 수 있습니다.");
      const resumed = record(await client.request("thread/resume", {
        threadId, excludeTurns: true
      }));
      const thread = threadRecord(resumed, cwd, threadId);
      if (object(thread.status) && thread.status.type === "active") throw new Error("대화가 실행 중입니다. 종료 후 다시 열어 주세요.");
      const turns: SavedTurn[] = [];
      const seen = new Set<string>();
      const cursors = new Set<string>();
      let cursor: string | null = null;
      let complete = true;
      let count = 0;
      do {
        const page = record(await client.request("thread/turns/list", { threadId, cursor, limit: 20, sortDirection: "desc", itemsView: "full" }));
        if (!Array.isArray(page.data)) throw new Error("저장된 대화 턴이 제공되지 않았습니다.");
        for (const value of page.data) {
          const turn = savedTurn(value);
          if (seen.has(turn.id)) continue;
          seen.add(turn.id);
          if (object(value) && value.itemsView && value.itemsView !== "full") throw new Error("Native가 전체 대화 항목을 제공하지 않았습니다. 내용을 생략한 채 복원하지 않습니다.");
          turns.push(turn);
          count += 2 + turn.items.length * 2;
        }
        const next = cursorValue(page.nextCursor);
        if (next !== null && cursors.has(next)) throw new Error("Native 대화 페이지 커서가 반복됐습니다.");
        if (next !== null) cursors.add(next);
        cursor = next;
        if (count >= MAX_RESTORED_EVENTS && cursor !== null) { complete = false; break; }
      } while (cursor !== null);
      return {
        threadId,
        model    : text(resumed.model) || null         ,
        provider : text(resumed.modelProvider) || null ,
        approvalPolicy: text(resumed.approvalPolicy) || null,
        sandbox: object(resumed.sandbox) ? text(resumed.sandbox.type) || null : null,
        events   : restoreConversationEvents(threadId, turns.reverse(), complete)
      };
    }
  };
}
