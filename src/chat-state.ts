/**
 * @architecture arch.chat.sessions.reading
 * @implements RESP-CHAT-SESSIONS-READING
 */
// 입력 한도와 인용 결합은 Ovis에서 개작. Copyright (c) 2026 devswha, MIT.
// 원본 revision: d505c75e26c54f31573057d1e9aa431ecc56677f
// src/lib/composerLength.ts, src/lib/chatQuote.ts. docs/third-party/ovis.md 참고.
import type { AppEvent, InterruptState, NativeSessionSummary, ScopedAppEvent, SelectionRef, TransportState, TurnState } from "./shared";

export const MAX_PROMPT_CHARS = 100_000;

export function slashCommand(text: string): "model" | "compact" | "theme" | "btw" | null {
  const value = text.trim();
  if (value === "/model") return "model";
  if (value === "/compact") return "compact";
  if (value === "/theme") return "theme";
  if (/^\/btw(?:\s|$)/.test(value)) return "btw";
  return null;
}

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

interface ReconnectBoundary extends SelectionRef {
  seq: number;
  connectionGeneration: number;
  threadId: string;
}

export interface ConversationEventState {
  events: ScopedAppEvent[];
  reconnect: ReconnectBoundary | null;
}

export interface ConversationEventBatch extends ConversationEventState {
  snapshot: ScopedAppEvent[];
  live: ScopedAppEvent[];
  replaced: boolean;
}

function sameSelection(left: SelectionRef, right: SelectionRef): boolean {
  return left.sessionId === right.sessionId && left.workspaceKey === right.workspaceKey
    && left.selectionEpoch === right.selectionEpoch && left.processEpoch === right.processEpoch;
}

interface ChatInputState {
  transport: TransportState;
  turn: TurnState;
  turnId: string | null;
  working: boolean;
  interrupt: InterruptState;
  approvals: number;
}

export function liveChatInput(
  session: NativeSessionSummary,
  selection: SelectionRef | null,
  threadId: string | null,
  connectionGeneration: number,
  history: Pick<ChatInputState, "turn" | "interrupt">,
): ChatInputState {
  if (!selection || !sameSelection(session.workspace, selection) || session.threadId !== threadId
    || session.connectionGeneration < connectionGeneration) {
    const working = history.turn === "starting" || history.turn === "running";
    return { transport: "disconnected", turn: history.turn, turnId: null, working, interrupt: "idle", approvals: 0 };
  }
  const turnId = session.transport === "connected" && threadId !== null ? session.activeTurnId : null;
  const historicalTurn = history.turn === "running" || history.turn === "starting"
    ? (session.transport === "connected" ? "idle" : "unknown")
    : history.turn;
  const turn = session.turnStarting ? "starting" : turnId ? "running" : historicalTurn;
  const interrupt = !session.interrupting ? "idle" : history.interrupt === "accepted" ? "accepted" : "requested";
  return { transport: session.transport, turn, turnId, working: turn === "starting" || turn === "running", interrupt, approvals: session.approvalCount };
}

function scopedEvent(value: unknown): value is ScopedAppEvent {
  if (!value || typeof value !== "object") return false;
  return "seq" in value && Number.isSafeInteger(value.seq) && Number(value.seq) > 0
    && "at" in value && typeof value.at === "string"
    && "kind" in value && (value.kind === "notification" || value.kind === "request" || value.kind === "transport")
    && "method" in value && typeof value.method === "string" && "params" in value
    && "workspaceKey" in value && typeof value.workspaceKey === "string"
    && "selectionEpoch" in value && Number.isSafeInteger(value.selectionEpoch)
    && "processEpoch" in value && typeof value.processEpoch === "string"
    && "connectionGeneration" in value && Number.isSafeInteger(value.connectionGeneration);
}

function reconnectSnapshot(marker: ScopedAppEvent, threadId: string | null): ScopedAppEvent[] | null {
  const params = marker.params;
  if (!scopedEvent(marker) || marker.kind !== "notification" || marker.historical || !params || typeof params !== "object"
    || !("threadId" in params) || params.threadId !== threadId || typeof params.threadId !== "string"
    || !("events" in params) || !Array.isArray(params.events) || params.events.length === 0) return null;
  const snapshot: ScopedAppEvent[] = [];
  for (const event of params.events) {
    if (!scopedEvent(event) || !sameSelection(event, marker) || event.connectionGeneration !== marker.connectionGeneration
      || event.seq >= marker.seq || event.historical !== true || event.method === "conversation/reconnected"
      || !belongsToConversation(event, threadId)) return null;
    snapshot.push(event);
  }
  if (!snapshot.some((event) => event.method === "transport/status")
    || !snapshot.some((event) => event.method === "thread/configured" && eventThreadId(event) === threadId)) return null;
  return snapshot;
}

/** 전환 중 외부 큐·bootstrap·일반 수신이 공유하는 대화 원장 경계. watermark는 raw-event 절단과 별도로 보존한다. */
export function reduceConversationEvents(
  current: ConversationEventState,
  snapshot: readonly ScopedAppEvent[],
  incoming: readonly ScopedAppEvent[],
  selection: SelectionRef,
  threadId: string | null,
): ConversationEventBatch {
  const belongs = (event: ScopedAppEvent) => sameSelection(event, selection) && belongsToConversation(event, threadId);
  let events = current.events.filter(belongs);
  let reconnect = current.reconnect && sameSelection(current.reconnect, selection) && current.reconnect.threadId === threadId ? current.reconnect : null;
  let restored: ScopedAppEvent[] = [];
  let replaced = false;
  let live: ScopedAppEvent[] = [];
  // 입력 순서와 무관하게 가장 최신의 유효 marker부터 원자 대체한다.
  const candidates = [...snapshot, ...incoming].filter(belongs);
  const generation = Math.max(0, ...events.map((event) => event.connectionGeneration), reconnect?.connectionGeneration ?? 0,
    ...candidates.filter((event) => event.method !== "conversation/reconnected").map((event) => event.connectionGeneration));
  const markers = candidates.filter((event) => event.method === "conversation/reconnected")
    .sort((a, b) => b.connectionGeneration - a.connectionGeneration || b.seq - a.seq);
  for (const marker of markers) {
    if (marker.connectionGeneration < generation || reconnect && (marker.connectionGeneration < reconnect.connectionGeneration
      || marker.connectionGeneration === reconnect.connectionGeneration && marker.seq <= reconnect.seq)) continue;
    const replacement = reconnectSnapshot(marker, threadId);
    if (!replacement) continue;
    reconnect = { sessionId: marker.sessionId, workspaceKey: marker.workspaceKey, selectionEpoch: marker.selectionEpoch, processEpoch: marker.processEpoch,
      connectionGeneration: marker.connectionGeneration, seq: marker.seq, threadId: eventThreadId(marker) ?? "" };
    restored = replacement;
    replaced = true;
    break;
  }
  const afterMarker = (event: ScopedAppEvent) => !reconnect || event.connectionGeneration > reconnect.connectionGeneration || event.connectionGeneration === reconnect.connectionGeneration && event.seq > reconnect.seq;
  const ordinary = (event: ScopedAppEvent) => event.method !== "conversation/reconnected";
  if (replaced) {
    live = [...events, ...incoming].filter((event) => belongs(event) && ordinary(event) && afterMarker(event) && !event.historical);
    events = [...restored, ...live];
  } else {
    restored = snapshot.filter((event) => belongs(event) && ordinary(event) && afterMarker(event));
    live = incoming.filter((event) => belongs(event) && ordinary(event) && afterMarker(event) && event.connectionGeneration >= generation);
    events = [...events, ...restored, ...live];
  }
  const key = (event: ScopedAppEvent) => JSON.stringify([event.processEpoch, event.connectionGeneration, event.seq]);
  const unique = (values: ScopedAppEvent[]) => [...new Map(values.map((event) => [key(event), event])).values()]
    .sort((a, b) => a.connectionGeneration - b.connectionGeneration || a.seq - b.seq);
  return { events: unique(events).slice(-2_000), reconnect, snapshot: unique(restored), live: unique(live), replaced };
}
