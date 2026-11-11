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
}
