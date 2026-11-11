export type RpcId = string | number;

export interface AppEvent {
  seq: number;
  at: string;
  kind: "notification" | "request" | "transport";
  method: string;
  params: unknown;
  requestId?: RpcId;
  supported?: boolean;
}

export type TransportState = "connected" | "closed" | "error";
export type TurnState = "idle" | "running" | "completed" | "interrupted" | "failed";
export type InterruptState = "idle" | "requested" | "acknowledged" | "uncertain";
export type ApprovalState = "open" | "responding" | "responded" | "uncertain";

export interface WorkspaceInfo {
  name: string;
  path: string;
  branch: string | null;
  changes: number;
}

export interface WwwApi {
  chooseWorkspace(): Promise<WorkspaceInfo | null>;
  workspace(): Promise<WorkspaceInfo>;
  startThread(): Promise<{ threadId: string }>;
  startTurn(threadId: string, text: string): Promise<{ turnId: string }>;
  interrupt(threadId: string, turnId: string): Promise<void>;
  respond(requestId: RpcId, decision: string): Promise<void>;
  events(): Promise<AppEvent[]>;
  onEvent(listener: (event: AppEvent) => void): () => void;
  probeReady(): Promise<{ enabled: boolean; readinessMs?: number }>;
  probeFinish(result: Record<string, unknown>): Promise<void>;
}
