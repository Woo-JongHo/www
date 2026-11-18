/**
 * @architecture arch.native.lifecycle
 * @implements RESP-NATIVE-LIFECYCLE
 */
import { createConversationService, type ConversationEvent, type RestoredConversation } from "./conversations";
import { nativeTurnStartParams } from "./native-chat";
import type { RpcId } from "./shared";

type Client = {
  request(method: string, params: unknown): Promise<unknown>;
  respond(id: RpcId, result: unknown): Promise<void>;
};
type Emit = (event: ConversationEvent) => void;
interface Approval {
  client: Client;
  requestId: RpcId;
  threadId: string;
  attempted: boolean;
  token: string;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function publicFieldsMatch(saved: unknown, live: unknown): boolean {
  if (saved === null) return live === null || live === undefined;
  if (Array.isArray(saved)) return Array.isArray(live) && saved.length === live.length && saved.every((part, index) => publicFieldsMatch(part, live[index]));
  if (object(saved)) return object(live) && Object.entries(saved).every(([key, value]) => key === "completedAtMs" ||
    publicFieldsMatch(value, key === "phase" && live[key] !== "commentary" ? null : live[key]));
  return saved === live;
}

/** 같은 Native turn/item의 최종 snapshot이 이미 포함한 알림만 재생에서 제외한다. */
export function createRestoredMessageFilter(events: readonly ConversationEvent[]) {
  const finished = new Map<string, string>();
  const items = new Map<string, Record<string, unknown>>();
  const coveredDeltas = new Set(["item/started", "item/agentMessage/delta", "item/reasoning/summaryTextDelta", "item/reasoning/summaryPartAdded", "item/commandExecution/outputDelta", "item/fileChange/outputDelta"]);
  for (const event of events) {
    if (event.method !== "turn/completed" || !object(event.params) || !object(event.params.turn)) continue;
    const turn = event.params.turn;
    if (typeof event.params.threadId === "string" && typeof turn.id === "string" && typeof turn.status === "string" && ["completed", "interrupted", "failed"].includes(turn.status)) finished.set(JSON.stringify([event.params.threadId, turn.id]), turn.status);
  }
  for (const event of events) {
    if (event.method !== "item/completed" || !object(event.params) || !object(event.params.item)) continue;
    const { threadId, turnId, item } = event.params;
    if (typeof threadId === "string" && typeof turnId === "string" && finished.has(JSON.stringify([threadId, turnId])) && typeof item.id === "string") items.set(JSON.stringify([threadId, turnId, item.id]), item);
  }
  return (message: { id?: unknown; method?: unknown; params?: unknown }): boolean => {
    if (message.id !== undefined || !object(message.params)) return false;
    const params = message.params;
    if (typeof params.threadId !== "string") return false;
    const turn = object(params.turn) ? params.turn : null;
    if ((message.method === "turn/started" || message.method === "turn/completed") && turn && typeof turn.id === "string") {
      const key = JSON.stringify([params.threadId, turn.id]);
      return finished.has(key) && (message.method === "turn/started" || finished.get(key) === turn.status);
    }
    const item = object(params.item) ? params.item : null;
    const itemId = item?.id ?? params.itemId;
    if (typeof params.turnId !== "string" || typeof itemId !== "string") return false;
    const saved = items.get(JSON.stringify([params.threadId, params.turnId, itemId]));
    if (!saved) return false;
    // snapshot의 선택 공개 필드가 빠졌어도 큐의 정식 완료에 있는 값은 재생한다.
    const enriched = item && ["aggregatedOutput", "changes", "summary", "model", "reasoningEffort"].some(key => !(key in saved) && key in item);
    return message.method === "item/completed" ? !enriched && publicFieldsMatch(saved, item) : typeof message.method === "string" && coveredDeltas.has(message.method);
  };
}

/** 연결 객체가 달라지면 저장된 thread도 read/resume 전에는 준비된 것이 아니다. */
export function createNativeLifecycle(emit: Emit) {
  let ready: { client: Client; cwd: string; threadId: string } | null = null;
  let unacceptedOpen: { client: Client; cwd: string; threadId: unknown } | null = null;
  let starting = false;
  let mutation: { client: Client; threadId: string } | null = null;
  let interruptedThread: string | null = null;
  const pending = new Map<RpcId, Approval>();
  let nextApproval = 0;
  const checked = (client: Client, valid: () => boolean, boundary?: (method: string, status: "started" | "completed" | "failed") => void) => ({
    async request(method: string, params: unknown) {
      if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
      boundary?.(method, "started");
      try {
        const result = await client.request(method, params);
        if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
        boundary?.(method, "completed");
        return result;
      } catch (error) {
        boundary?.(method, "failed");
        throw error;
      }
    }
  });
  const currentApproval = (id: RpcId, approval: Approval, valid: () => boolean) => valid() && pending.get(id) === approval;
  return {
    get approvalCount() { return pending.size; },
    markReady(client: Client, cwd: string, threadId: string) { ready = { client, cwd, threadId }; unacceptedOpen = null; },
    reset() { ready = null; interruptedThread = null; unacceptedOpen = null; },
    closed(client: Client, message: string, activeThread: string | null = null) {
      interruptedThread = activeThread ?? (mutation?.client === client ? mutation.threadId : interruptedThread);
      if (ready?.client === client) ready = null;
      if (unacceptedOpen?.client === client) unacceptedOpen = { ...unacceptedOpen };
      for (const [requestId, approval] of pending) {
        if (approval.client !== client) continue;
        pending.delete(requestId);
        emit({ kind: "notification", method: "approval/uncertain", params: { threadId: approval.threadId, message }, approvalToken: approval.token, requestId });
      }
    },
    async open(client: Client, cwd: string, threadId: unknown, valid: () => boolean) {
      const preparation = { client, cwd, threadId };
      unacceptedOpen = preparation;
      if (ready?.client === client && ready.cwd === cwd && ready.threadId === threadId) ready = null;
      const restored = await createConversationService(checked(client, valid), cwd).open(threadId);
      if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
      return { ...restored, accept(accepted: () => boolean) {
        if (unacceptedOpen !== preparation || !accepted()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
        interruptedThread = null;
        ready = { client, cwd, threadId: restored.threadId };
        unacceptedOpen = null;
      } };
    },
    async start(options: {
      connect(): Promise<Client>;
      valid(client: Client): boolean;
      cwd: string;
      threadId: string;
      prompt: string;
      restored(value: RestoredConversation): void;
      beforeStart(): void;
      requestBoundary?(method: string, status: "started" | "completed" | "failed"): void;
    }) {
      if (starting) throw new Error("Native 요청을 준비하고 있습니다.");
      if (interruptedThread === options.threadId) throw new Error("이전 턴의 종료를 확인할 수 없습니다. 대화를 명시적으로 다시 열어 주세요.");
      if (unacceptedOpen?.cwd === options.cwd && unacceptedOpen.threadId === options.threadId) throw new Error("복원 수용이 끝나지 않았습니다. 대화를 명시적으로 다시 열어 주세요.");
      starting = true;
      try {
        const client = await options.connect();
        const valid = () => options.valid(client);
        const transport = checked(client, valid, options.requestBoundary);
        if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
        if (ready?.client !== client || ready.cwd !== options.cwd || ready.threadId !== options.threadId) {
          const preparation = { client, cwd: options.cwd, threadId: options.threadId };
          unacceptedOpen = preparation;
          const restored = await createConversationService(transport, options.cwd).open(options.threadId);
          if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
          options.restored(restored);
          if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
          ready = { client, cwd: options.cwd, threadId: options.threadId };
          if (unacceptedOpen === preparation) unacceptedOpen = null;
        }
        if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
        if (pending.size > 0) throw new Error("복원 중 도착한 승인 요청을 먼저 처리해 주세요.");
        options.beforeStart();
        mutation = { client, threadId: options.threadId };
        return await transport.request("turn/start", nativeTurnStartParams(options.threadId, options.prompt));
      } finally { mutation = null; starting = false; }
    },
    approval(client: Client, requestId: RpcId, threadId: unknown): string | null {
      if (pending.has(requestId)) return null;
      if (typeof threadId !== "string" || !threadId) return null;
      const token = `www-approval-${++nextApproval}`;
      pending.set(requestId, { client, requestId, threadId, attempted: false, token });
      return token;
    },
    resolved(client: Client, params: unknown): boolean {
      if (!params || typeof params !== "object" || !("requestId" in params) || !("threadId" in params)) return false;
      const id = params.requestId;
      if (typeof id !== "string" && !(typeof id === "number" && Number.isInteger(id))) return false;
      for (const [requestId, approval] of pending) {
        if (approval.client !== client || approval.requestId !== id || approval.threadId !== params.threadId) continue;
        pending.delete(requestId);
        emit({ kind: "notification", method: "approval/responded", params: { threadId: approval.threadId, resolvedByServer: true }, requestId, approvalToken: approval.token });
        return true;
      }
      return false;
    },
    async respond(client: Client | null, requestId: RpcId, decision: string, approvalToken: string, valid: () => boolean) {
      const approval = pending.get(requestId);
      if (!approval || approval.client !== client || approval.token !== approvalToken || !valid()) throw new Error("Unknown or unsupported approval request");
      if (approval.attempted) throw new Error("Approval response has already been attempted");
      approval.attempted = true;
      emit({ kind: "notification", method: "approval/responding", params: { decision, threadId: approval.threadId }, requestId, approvalToken: approval.token });
      // emit 콜백도 request 해소를 일으킬 수 있으므로 쓰기 직전 다시 검사한다.
      if (!currentApproval(requestId, approval, valid)) return;
      try {
        await approval.client.respond(approval.requestId, { decision });
        if (!currentApproval(requestId, approval, valid)) return;
        pending.delete(requestId);
        emit({ kind: "notification", method: "approval/responded", params: { decision, threadId: approval.threadId }, requestId, approvalToken: approval.token });
      } catch (error) {
        if (!currentApproval(requestId, approval, valid)) return;
        pending.delete(requestId);
        emit({ kind: "notification", method: "approval/uncertain", params: { decision, threadId: approval.threadId, message: String(error) }, requestId, approvalToken: approval.token });
        throw error;
      }
    }
  };
}
