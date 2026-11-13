export type RpcId = string | number;

export interface AppEvent {
  seq        : number                                   ;
  at         : string                                   ;
  kind       : "notification" | "request" | "transport" ;
  method     : string                                   ;
  params     : unknown                                  ;
  requestId? : RpcId                                    ;
  supported? : boolean                                  ;
  historical?: boolean                                  ;
}

export type TransportState = "disconnected" | "connected" | "closed" | "error"                                    ;
export type TurnState      = "idle" | "starting" | "running" | "completed" | "interrupted" | "failed" | "unknown" ;
export type InterruptState = "idle" | "requested" | "accepted" | "acknowledged" | "uncertain"                     ;
export type ApprovalState  = "open" | "responding" | "responded" | "uncertain"                                    ;
export type RequestState   = "sending" | "accepted" | "failed"                                                    ;

export interface WorkspaceInfo {
  name    : string        ;
  path    : string        ;
  branch  : string | null ;
  changes : number        ;
}

export interface DevelopmentPolicyInfo {
  id            : string ;
  version       : number ;
  hash          : string ;
  primaryModel  : string ;
  fallbackModel : string ;
}

export interface DevelopmentWorkStatus {
  workId       : string        ;
  status       : string        ;
  canComplete  : boolean       ;
  reasons      : string[]      ;
  nextAction   : string        ;
  sourceDigest : string | null ;
}

export interface WorkReportSummary {
  id        : string                                                         ;
  workId    : string                                                         ;
  title     : string                                                         ;
  summary   : string                                                         ;
  outcome   : "completed" | "partial" | "blocked" | "failed" | "in_progress" ;
  kind      : "authored" | "snapshot"                                        ;
  createdAt : string                                                         ;
}

export interface WorkReportCatalog {
  repository : string              ;
  reports    : WorkReportSummary[] ;
  warnings   : string[]            ;
}

export interface WorkReportDocument {
  report  : WorkReportSummary ;
  html    : string            ;
  current : boolean           ;
  stale   : boolean           ;
  reasons : string[]          ;
}

export interface NativeReportJob {
  key             : string                                                                ;
  threadId        : string                                                                ;
  turnId          : string                                                                ;
  status          : "queued" | "judging" | "skipped" | "saved" | "failed" | "interrupted" ;
  reason          : string                                                                ;
  reportId        : string | null                                                         ;
  updatedAt       : string                                                                ;
  workId?         : string                                                                ;
  retryAvailable? : boolean                                                               ;
}

export interface ConversationSummary {
  id        : string                      ;
  title     : string                      ;
  preview   : string                      ;
  cwd       : string                      ;
  updatedAt : number | null               ;
  status    : "idle" | "active" | "unknown";
}

export interface ConversationCatalog {
  threads    : ConversationSummary[] ;
  nextCursor : string | null         ;
}

export interface WwwApi {
  listConversations      (cursor?: string                     ): Promise<ConversationCatalog>;
  openConversation       (threadId: string                     ): Promise<{ threadId: string; events: AppEvent[] }>;
  newConversation        ()                                   : Promise<void>;
  openExternal           (url: string                          ): Promise<void>;
  chooseWorkspace        ()                                   : Promise<WorkspaceInfo | null>;
  workspace              ()                                   : Promise<WorkspaceInfo>;
  startThread            ()                                   : Promise<{ threadId: string }>;
  startTurn              (threadId: string, text: string     ): Promise<{ turnId: string }>;
  interrupt              (threadId: string, turnId: string   ): Promise<void>;
  respond                (requestId: RpcId, decision: string ): Promise<void>;
  events                 ()                                   : Promise<AppEvent[]>;
  refreshActivity        ()                                   : Promise<void>;
  onEvent                (listener: (event: AppEvent) => void): () => void;
  probeReady             ()                                   : Promise<{ enabled: boolean; readinessMs?: number; developmentPolicyAvailable?: boolean; developmentWorkId?: string; expectDevelopmentComplete?: boolean; checkInterruptPending?: boolean; checkReports?: boolean; checkNativeReports?: boolean; checkActivity?: boolean }>;
  probeFinish            (result: Record<string, unknown>    ): Promise<void>;
  developmentPolicy      ()                                   : Promise<DevelopmentPolicyInfo>;
  developmentStatus      (workId: string                     ): Promise<DevelopmentWorkStatus>;
  completeDevelopmentWork(workId: string                     ): Promise<{ workId: string; status: string }>;
  listReports            ()                                   : Promise<WorkReportCatalog>;
  readReport             (reportId: string                   ): Promise<WorkReportDocument>;
  chooseReportRepository ()                                   : Promise<boolean>;
  exportReport           (reportId: string                   ): Promise<string | null>;
  nativeReportStatus     ()                                   : Promise<{ enabled: boolean; jobs: NativeReportJob[] }>;
  setNativeReportEnabled (enabled: boolean                   ): Promise<boolean>;
  retryNativeReport      (key: string                        ): Promise<NativeReportJob>;
}
