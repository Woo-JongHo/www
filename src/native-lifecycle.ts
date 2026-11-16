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

/** 연결 객체가 달라지면 저장된 thread도 read/resume 전에는 준비된 것이 아니다. */
export function createNativeLifecycle(emit: Emit) {
  let ready: { client: Client; cwd: string; threadId: string } | null = null;
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
    markReady(client: Client, cwd: string, threadId: string) { ready = { client, cwd, threadId }; },
    reset() { ready = null; interruptedThread = null; },
    closed(client: Client, message: string, activeThread: string | null = null) {
      interruptedThread = activeThread ?? (mutation?.client === client ? mutation.threadId : interruptedThread);
      if (ready?.client === client) ready = null;
      for (const [requestId, approval] of pending) {
        if (approval.client !== client) continue;
        pending.delete(requestId);
        emit({ kind: "notification", method: "approval/uncertain", params: { threadId: approval.threadId, message }, approvalToken: approval.token, requestId });
      }
    },
    async open(client: Client, cwd: string, threadId: unknown, valid: () => boolean) {
      const restored = await createConversationService(checked(client, valid), cwd).open(threadId);
      if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
      interruptedThread = null;
      ready = { client, cwd, threadId: restored.threadId };
      return restored;
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
      if (interruptedThread === options.threadId) throw new Error("이전 턴의 종료를 확인할 수 없습니다. 대화를 명시적으로 다시 열어 주세요.");
      if (starting) throw new Error("Native 요청을 준비하고 있습니다.");
      starting = true;
      try {
        const client = await options.connect();
        const valid = () => options.valid(client);
        const transport = checked(client, valid, options.requestBoundary);
        if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
        if (ready?.client !== client || ready.cwd !== options.cwd || ready.threadId !== options.threadId) {
          const restored = await createConversationService(transport, options.cwd).open(options.threadId);
          if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
          ready = { client, cwd: options.cwd, threadId: options.threadId };
          options.restored(restored);
        }
        if (!valid()) throw new Error("Native 연결 또는 대화 선택이 변경됐습니다.");
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
