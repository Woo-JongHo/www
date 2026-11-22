/**
 * @architecture arch.native.protocol
 * @implements RESP-NATIVE-PROTOCOL
 */
export type RpcId = string | number;

export type NativeTimingPhase = "request" | "connect" | "initialize" | "thread/start" | "thread/read" | "thread/resume" | "thread/turns/list" | "turn/start" | "first-native";
export type NativeTimingStatus = "started" | "completed" | "failed" | "cancelled";
export interface NativeTimingEvent {
  traceId   : string             ;
  threadId  : string | null      ;
  phase     : NativeTimingPhase  ;
  status    : NativeTimingStatus ;
  elapsedMs : number             ;
  source    : "www" | "native"   ;
}

export type WorkStatus = "draft" | "ready" | "in_progress" | "verifying" | "done" | "cancelled";
export interface RpaStandardUnit {
  id: string;
  effect: "none" | "read" | "write_local" | "write_external";
  rerun: boolean | "unknown";
  abort: boolean | null;
}

export type RpaStandardRun =
  | { state: "missing" | "invalid" | "limit" }
  | { state: "unfinished"; id: string }
  | {
      state: "observed"; id: string; status: "completed" | "partial" | "incomplete" | "failed";
      finishedAt: string; exitCode: number;
      units: { id: string; status: "completed" | "failed" | "skipped"; seconds: number }[];
      logs: { name: string; present: boolean }[];
    };

export interface RpaStandardCase {
  id: string;
  unit: string;
  condition: string;
  expected: string;
  handling: string;
  rerun: "safe" | "unsafe" | "unknown";
}
export type RpaStandardSnapshot = {
  projectId: string;
  standardVersion: string;
  coreVersion: string;
  processes: { id: string; name: string; tasks: { id: string; name: string; units: RpaStandardUnit[] }[] }[];
  core: { status: "matched" | "different" | "missing" | "invalid"; matched: number; total: number; differences: string[] };
  cases: RpaStandardCase[] | null;
  run: RpaStandardRun;
} | null;

export interface DashboardProject { key: string; name: string; path: string; kind: "rpa" | "www" }
export interface DashboardWork {
  id: string; projectKey: string; title: string; status: WorkStatus; blockedReason: string | null;
  sourcePath: string; areas: string[]; owner: string; requiredCriteria: number; passedCriteria: number;
}
export interface DashboardIssue { code: string; path: string; message: string }
export interface DashboardProjectSnapshot {
  project: DashboardProject; coverage: "complete" | "empty" | "partial" | "failed";
  cards: DashboardWork[]; issues: DashboardIssue[];
}
export interface DashboardSnapshot { capturedAt: string; projects: DashboardProjectSnapshot[] }
export interface DashboardWorkDetail {
  projectKey: string; workId: string; title: string; sourcePath: string; status: WorkStatus;
  owner: string; areas: string[];
  blockedReason: string | null; nextAction: string | null; capturedAt: string;
  criteria: { id: string; description: string; required: boolean; result: "unverified" | "passed" | "failed" | "blocked"; evidenceCount: number }[];
  documents: { kind: "spec" | "design" | "tasks" | "verification"; path: string; status: "available" | "missing" | "failed"; content: string | null; message: string | null }[];
}

export interface AppEvent {
  seq            : number                                   ;
  at             : string                                   ;
  kind           : "notification" | "request" | "transport" ;
  method         : string                                   ;
  params         : unknown                                  ;
  requestId?     : RpcId                                    ;
  approvalToken? : string                                   ;
  supported?     : boolean                                  ;
  historical?    : boolean                                  ;
}

/** 실제 IPC 배달과 요청의 필수 선택 경계. */
export interface SelectionRef {
  sessionId?     : string ;
  workspaceKey   : string ;
  selectionEpoch : number ;
  processEpoch   : string ;
}
export interface ScopedAppEvent extends AppEvent, SelectionRef {
  connectionGeneration: number;
}
export interface WorkspaceSelection extends WorkspaceInfo, SelectionRef { hasRpaProfile?: boolean }
export interface ProjectInfo {
  workspaceKey : string  ;
  name         : string  ;
  path         : string  ;
  favorite     : boolean ;
}
export interface ConversationSelection {
  workspace                : WorkspaceSelection      ;
  threadId                 : string | null           ;
  events                   : ScopedAppEvent[]        ;
  resources                : ResourceSnapshot | null ;
  resourceStorageWarnings? : ResourceScope[]         ;
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
  id        : string                        ;
  title     : string                        ;
  preview   : string                        ;
  cwd       : string                        ;
  updatedAt : number | null                 ;
  status    : "idle" | "active" | "unknown" ;
}

export interface ConversationCatalog {
  threads    : ConversationSummary[] ;
  nextCursor : string | null         ;
}

export interface NativeModelOption {
  model: string;
  displayName: string;
  isDefault: boolean;
}

export type NativeCompaction =
  | { state: "idle" | "pending" | "running" | "completed" }
  | { state: "failed"; message: string };

export interface NativeSessionSummary {
  id            : string             ;
  title         : string             ;
  workspace     : WorkspaceSelection ;
  threadId      : string | null      ;
  busy          : boolean            ;
  approvalCount : number             ;
  failed        : boolean            ;
  compaction    : NativeCompaction   ;
}

export type ChatTheme = "terminal-basic" | "www-mint";

export interface WwwApi {
  chatTheme(): Promise<ChatTheme>;
  setChatTheme(theme: ChatTheme): Promise<ChatTheme>;
  listSessions(): Promise<NativeSessionSummary[]>;
  createSession(selection?: SelectionRef): Promise<NativeSessionSummary>;
  closeSession(sessionId: string): Promise<void>;
  onSessions(listener: (sessions: NativeSessionSummary[]) => void): () => void;
  listConversations(selection: SelectionRef, cursor?: string): Promise<ConversationCatalog>;
  openConversation(selection: SelectionRef, threadId: string): Promise<ConversationSelection>;
  newConversation(selection: SelectionRef): Promise<ConversationSelection>;
  openExternal(url: string, sessionId?: string): Promise<void>;
  chooseWorkspace(selection: SelectionRef): Promise<ConversationSelection | null>;
  workspace(sessionId?: string): Promise<WorkspaceSelection>;
  listProjects(selection: SelectionRef): Promise<readonly ProjectInfo[]>;
  dashboard(selection: SelectionRef): Promise<DashboardSnapshot>;
  rpaStandard(selection: SelectionRef): Promise<RpaStandardSnapshot>;
  dashboardWork(selection: SelectionRef, projectKey: string, workId: string): Promise<DashboardWorkDetail>;
  selectWww(selection: SelectionRef): Promise<ConversationSelection>;
  setProjectFavorite(selection: SelectionRef, workspaceKey: string, favorite: boolean): Promise<void>;
  switchProject(selection: SelectionRef, workspaceKey: string): Promise<ConversationSelection>;
  startThread(selection: SelectionRef): Promise<{ threadId: string }>;
  startTurn(selection: SelectionRef, threadId: string, text: string, model?: string): Promise<{ turnId: string }>;
  listModels(selection: SelectionRef): Promise<NativeModelOption[]>;
  compactThread(selection: SelectionRef, threadId: string): Promise<void>;
  steerTurn(selection: SelectionRef, threadId: string, expectedTurnId: string, text: string, clientUserMessageId: string): Promise<{ turnId: string }>;
  interrupt(selection: SelectionRef, threadId: string, turnId: string): Promise<void>;
  respond(selection: SelectionRef, requestId: RpcId, decision: string, approvalToken: string): Promise<void>;
  events(selection: SelectionRef): Promise<ScopedAppEvent[]>;
  refreshActivity(selection: SelectionRef): Promise<void>;
  activityResources(selection: SelectionRef): Promise<ResourceSnapshot | null>;
  onActivityResources(listener: (snapshot: ResourceSnapshot) => void): () => void;
  onEvent(listener: (event: ScopedAppEvent) => void): () => void;
  probeReady             ()                                   : Promise<{ enabled: boolean; readinessMs?: number; developmentPolicyAvailable?: boolean; developmentWorkId?: string; expectDevelopmentComplete?: boolean; checkInterruptPending?: boolean; checkReports?: boolean; checkNativeReports?: boolean; checkActivity?: boolean }>;
  probeFinish            (result: Record<string, unknown>    ): Promise<void>;
  developmentPolicy      (sessionId?: string)                                   : Promise<DevelopmentPolicyInfo>;
  developmentStatus      (workId: string, sessionId?: string): Promise<DevelopmentWorkStatus>;
  completeDevelopmentWork(workId: string, sessionId?: string): Promise<{ workId: string; status: string }>;
  listReports            (sessionId?: string)                                   : Promise<WorkReportCatalog>;
  readReport             (reportId: string, sessionId?: string): Promise<WorkReportDocument>;
  chooseReportRepository (sessionId?: string)                                   : Promise<boolean>;
  exportReport           (reportId: string, sessionId?: string): Promise<string | null>;
  nativeReportStatus     (sessionId?: string)                                   : Promise<{ enabled: boolean; jobs: NativeReportJob[] }>;
  setNativeReportEnabled (enabled: boolean, sessionId?: string): Promise<boolean>;
  retryNativeReport      (key: string, sessionId?: string): Promise<NativeReportJob>;
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
  id         : string                                                                            ;
  source     : ResourceSource                                                                    ;
  resource   : { kind: "skill" | "hook" | "document" | "tool"; identity: string; label: string } ;
  action     : "invoke" | "read"                                                                 ;
  status     : "observed" | "running" | "completed" | "failed" | "unknown"                       ;
  conflicts? : { turn?: true; terminal?: true }                                                  ;
}

/** 검증·정규화한 관측만 전달한다. namespace의 실제 유일성 근거는 caller가 소유한다. */
export type ResourceObservationInput = Omit<ResourceObservation, "id" | "conflicts">;
export type ResourceGap = "native-missing" | "unstable-id" | "disconnect" | "unclean-exit"
  | "retention-limit" | "corrupt" | "unsupported-version" | "read-failed" | "write-failed";

export interface ResourceCoverage {
  startedAt    : string | null                            ;
  completeness : "partial" | "complete-for-covered-range" ;
  gaps         : ResourceGap[]                            ;
}

export interface ResourceSnapshot {
  sessionId?      : string                                                               ;
  scope           : ResourceScope                                                        ;
  processEpoch    : string                                                               ;
  selectionEpoch  : number                                                               ;
  revision        : number                                                               ;
  durableRevision : number                                                               ;
  observations    : ResourceObservation[]                                                ;
  coverage        : ResourceCoverage                                                     ;
  storage         : "saved" | "saving" | "volatile" | "full" | "corrupt" | "unavailable" ;
}
