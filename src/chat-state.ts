/**
 * @architecture arch.chat.sessions.reading
 * @implements RESP-CHAT-SESSIONS-READING
 */
// 입력 한도와 인용 결합은 Ovis에서 개작. Copyright (c) 2026 devswha, MIT.
// 원본 revision: d505c75e26c54f31573057d1e9aa431ecc56677f
// src/lib/composerLength.ts, src/lib/chatQuote.ts. docs/third-party/ovis.md 참고.
import type { AppEvent } from "./shared";

export const MAX_PROMPT_CHARS = 100_000;

export function composerFull(length: number, max: number): boolean {
  return length >= max;
}

export function pasteOverflow(current: string, start: number, end: number, pasted: string, max: number): number {
  const lo   = Math.min(start, end                          ) ;
  const hi   = Math.max(start, end                          ) ;
  const room = Math.max(0, max - (current.length - (hi - lo))) ;
  return Math.max(0, pasted.length - room);
}

export function draftWithQuote(draft: string, quote: string): string {
  if (quote.trim() === "") return draft;
  const block = quote.split("\n").map((line) => `> ${line}`).join("\n");
  const gap   = draft === "" || draft.endsWith("\n\n") ? "" : draft.endsWith("\n") ? "\n" : "\n\n";
  return `${draft}${gap}${block}\n\n`;
}

export function conversationKey(workspace: string, threadId: string | null): string {
  return JSON.stringify([workspace, threadId]);
}

export function eventThreadId(event: AppEvent): string | null {
  const value = event.params;
  if (!value || typeof value !== "object" || !("threadId" in value)) return null;
  return typeof value.threadId === "string" ? value.threadId : null;
}

export function belongsToConversation(event: AppEvent, threadId: string | null): boolean {
  const ownThread = eventThreadId(event);
  return ownThread === null || ownThread === threadId;
}

export function eventTurnId(event: AppEvent): string | null {
  if (!event.params || typeof event.params !== "object") return null;
  const params = event.params as Record<string, unknown>;
  if (typeof params.turnId === "string") return params.turnId;
  const turn = params.turn;
  if (turn && typeof turn === "object" && "id" in turn && typeof turn.id === "string") return turn.id;
  const item = params.item;
  if (item && typeof item === "object" && "turnId" in item && typeof item.turnId === "string") return item.turnId;
  return null;
}

export function currentTurnEvents(events: readonly AppEvent[], turnId: string | null): AppEvent[] {
  const firstCurrent = turnId === null ? -1 : events.findIndex((event) => eventTurnId(event) === turnId);
  const searchEnd = firstCurrent < 0 ? events.length - 1 : firstCurrent;
  let promptIndex = -1;
  for (let index = searchEnd; index >= 0; index -= 1) {
    if (events[index]?.method !== "turn/userPrompt") continue;
    promptIndex = index;
    break;
  }
  return events.slice(Math.max(0, promptIndex)).filter((event) =>
    turnId === null || eventTurnId(event) === turnId || event.method === "turn/userPrompt"
  );
}

export interface ConversationReadingState {
  draft     : string  ;
  scrollTop : number  ;
  followTail: boolean ;
}

export function blankReadingState(): ConversationReadingState {
  return { draft: "", scrollTop: 0, followTail: true };
}

export function externalChatUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
