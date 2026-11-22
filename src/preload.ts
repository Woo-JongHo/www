/**
 * @architecture arch.native.bridge
 * @implements RESP-NATIVE-BRIDGE
 */
import { contextBridge, ipcRenderer } from "electron";
import type { NativeSessionSummary, ResourceSnapshot, ScopedAppEvent, WwwApi } from "./shared";

const api: WwwApi = {
  listSessions: () => ipcRenderer.invoke("sessions:list"),
  createSession: selection => ipcRenderer.invoke("sessions:create", selection),
  closeSession: sessionId => ipcRenderer.invoke("sessions:close", sessionId),
  onSessions: listener => {
    const handler = (_event: Electron.IpcRendererEvent, sessions: NativeSessionSummary[]) => listener(sessions);
    ipcRenderer.on("sessions:changed", handler);
    return () => ipcRenderer.removeListener("sessions:changed", handler);
  },
  listConversations: (selection, cursor) => ipcRenderer.invoke("conversations:list", selection, cursor),
  openConversation: (selection, threadId) => ipcRenderer.invoke("conversations:open", selection, threadId),
  newConversation: (selection) => ipcRenderer.invoke("conversations:new", selection),
  openExternal: (url, sessionId) => ipcRenderer.invoke("link:open", url, sessionId),
  chooseWorkspace: (selection) => ipcRenderer.invoke("workspace:choose", selection),
  workspace: (sessionId) => ipcRenderer.invoke("workspace:get", sessionId),
  listProjects: (selection) => ipcRenderer.invoke("projects:list", selection),
  dashboard: (selection) => ipcRenderer.invoke("dashboard:get", selection),
  rpaStandard: (selection) => ipcRenderer.invoke("rpa:standard", selection),
  dashboardWork: (selection, projectKey, workId) => ipcRenderer.invoke("dashboard:get", selection, { projectKey, workId }),
  selectWww: (selection) => ipcRenderer.invoke("projects:www", selection),
  setProjectFavorite: (selection, key, favorite) => ipcRenderer.invoke("projects:favorite", selection, key, favorite),
  switchProject: (selection, key) => ipcRenderer.invoke("projects:switch", selection, key),
  startThread: (selection) => ipcRenderer.invoke("thread:start", selection),
  startTurn: (selection, threadId, text) => ipcRenderer.invoke("turn:start", selection, threadId, text),
  steerTurn: (selection, threadId, turnId, text, id) => ipcRenderer.invoke("turn:steer", selection, threadId, turnId, text, id),
  interrupt: (selection, threadId, turnId) => ipcRenderer.invoke("turn:interrupt", selection, threadId, turnId),
  respond: (selection, requestId, decision, approvalToken) => ipcRenderer.invoke("approval:respond", selection, requestId, decision, approvalToken),
  events: (selection) => ipcRenderer.invoke("events:get", selection),
  refreshActivity: (selection) => ipcRenderer.invoke("activity:refresh", selection),
  activityResources: (selection) => ipcRenderer.invoke("activity:resources", selection),
  onActivityResources: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: ResourceSnapshot) => listener(snapshot);
    ipcRenderer.on("activity:resources", handler);
    return () => ipcRenderer.removeListener("activity:resources", handler);
  },
  probeReady              : () => ipcRenderer.invoke("probe:ready")                                              ,
  probeFinish             : (result) => ipcRenderer.invoke("probe:finish", result)                               ,
  developmentPolicy       : (sessionId) => ipcRenderer.invoke("development:policy", sessionId)                                       ,
  developmentStatus       : (workId, sessionId) => ipcRenderer.invoke("development:status", workId, sessionId)                         ,
  completeDevelopmentWork : (workId, sessionId) => ipcRenderer.invoke("development:complete", workId, sessionId)                       ,
  listReports             : (sessionId) => ipcRenderer.invoke("reports:list", sessionId)                                             ,
  readReport              : (reportId, sessionId) => ipcRenderer.invoke("reports:read", reportId, sessionId)                           ,
  chooseReportRepository  : (sessionId) => ipcRenderer.invoke("reports:choose", sessionId)                                           ,
  exportReport            : (reportId, sessionId) => ipcRenderer.invoke("reports:export", reportId, sessionId)                         ,
  nativeReportStatus      : (sessionId) => ipcRenderer.invoke("reports:native-status", sessionId)                                    ,
  setNativeReportEnabled  : (enabled, sessionId) => ipcRenderer.invoke("reports:native-enabled", enabled, sessionId)                   ,
  retryNativeReport       : (key, sessionId) => ipcRenderer.invoke("reports:native-retry", key, sessionId)                             ,
  onEvent                 : (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: ScopedAppEvent) => listener(entry);
    ipcRenderer.on("app:event", handler);
    return () => ipcRenderer.removeListener("app:event", handler);
  }
};
contextBridge.exposeInMainWorld("www", api);
