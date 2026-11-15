/**
 * @architecture arch.native.protocol
 * @implements RESP-NATIVE-PROTOCOL
 */
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

/** 실제 IPC 배달과 요청의 필수 선택 경계. */
export interface SelectionRef {
  workspaceKey: string;
  selectionEpoch: number;
  processEpoch: string;
}
export interface ScopedAppEvent extends AppEvent, SelectionRef {
  connectionGeneration: number;
}
export interface WorkspaceSelection extends WorkspaceInfo, SelectionRef {}
export interface ProjectInfo {
  workspaceKey: string;
  name: string;
  path: string;
  favorite: boolean;
}
export interface ConversationSelection {
  workspace: WorkspaceSelection;
  threadId: string | null;
  events: ScopedAppEvent[];
  resources: ResourceSnapshot | null;
  resourceStorageWarnings?: ResourceScope[];
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
  listConversations(selection: SelectionRef, cursor?: string): Promise<ConversationCatalog>;
  openConversation(selection: SelectionRef, threadId: string): Promise<ConversationSelection>;
  newConversation(selection: SelectionRef): Promise<ConversationSelection>;
  openExternal(url: string): Promise<void>;
  chooseWorkspace(selection: SelectionRef): Promise<ConversationSelection | null>;
  workspace(): Promise<WorkspaceSelection>;
  listProjects(selection: SelectionRef): Promise<readonly ProjectInfo[]>;
  setProjectFavorite(selection: SelectionRef, workspaceKey: string, favorite: boolean): Promise<void>;
  switchProject(selection: SelectionRef, workspaceKey: string): Promise<ConversationSelection>;
  startThread(selection: SelectionRef): Promise<{ threadId: string }>;
  startTurn(selection: SelectionRef, threadId: string, text: string): Promise<{ turnId: string }>;
  interrupt(selection: SelectionRef, threadId: string, turnId: string): Promise<void>;
  respond(selection: SelectionRef, requestId: RpcId, decision: string): Promise<void>;
  events(selection: SelectionRef): Promise<ScopedAppEvent[]>;
  refreshActivity(selection: SelectionRef): Promise<void>;
  activityResources(selection: SelectionRef): Promise<ResourceSnapshot | null>;
  onActivityResources(listener: (snapshot: ResourceSnapshot) => void): () => void;
  onEvent(listener: (event: ScopedAppEvent) => void): () => void;
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

/** main이 검증한 실제 workspace와 Native thread의 원장 경계. */
export interface ResourceScope {
  workspaceKey: string;
  threadId: string;
}

export type ResourceSource =
  | { kind: "hook"; hookRunId: string; turnId: string | null; providerRunNamespace: string }
  | { kind: "item"; itemId: string; turnId: string; nativeInvocationId?: string };

export interface ResourceObservation {
  id: string;
  source: ResourceSource;
  resource: { kind: "skill" | "hook" | "document" | "tool"; identity: string; label: string };
  action: "invoke" | "read";
  status: "observed" | "running" | "completed" | "failed" | "unknown";
  conflicts?: { turn?: true; terminal?: true };
}

/** 검증·정규화한 관측만 전달한다. namespace의 실제 유일성 근거는 caller가 소유한다. */
export type ResourceObservationInput = Omit<ResourceObservation, "id" | "conflicts">;
export type ResourceGap = "native-missing" | "unstable-id" | "disconnect" | "unclean-exit"
  | "retention-limit" | "corrupt" | "unsupported-version" | "read-failed" | "write-failed";

export interface ResourceCoverage {
  startedAt: string | null;
  completeness: "partial" | "complete-for-covered-range";
  gaps: ResourceGap[];
}

export interface ResourceSnapshot {
  scope: ResourceScope;
  processEpoch: string;
  selectionEpoch: number;
  revision: number;
  durableRevision: number;
  observations: ResourceObservation[];
  coverage: ResourceCoverage;
  storage: "saved" | "saving" | "volatile" | "full" | "corrupt" | "unavailable";
}
