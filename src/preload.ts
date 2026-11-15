/**
 * @architecture arch.native.bridge
 * @implements RESP-NATIVE-BRIDGE
 */
import { contextBridge, ipcRenderer } from "electron";
import type { ResourceSnapshot, ScopedAppEvent, WwwApi } from "./shared";

const api: WwwApi = {
  listConversations: (selection, cursor) => ipcRenderer.invoke("conversations:list", selection, cursor),
  openConversation: (selection, threadId) => ipcRenderer.invoke("conversations:open", selection, threadId),
  newConversation: (selection) => ipcRenderer.invoke("conversations:new", selection),
  openExternal: (url) => ipcRenderer.invoke("link:open", url),
  chooseWorkspace: (selection) => ipcRenderer.invoke("workspace:choose", selection),
  workspace: () => ipcRenderer.invoke("workspace:get"),
  listProjects: (selection) => ipcRenderer.invoke("projects:list", selection),
  setProjectFavorite: (selection, key, favorite) => ipcRenderer.invoke("projects:favorite", selection, key, favorite),
  switchProject: (selection, key) => ipcRenderer.invoke("projects:switch", selection, key),
  startThread: (selection) => ipcRenderer.invoke("thread:start", selection),
  startTurn: (selection, threadId, text) => ipcRenderer.invoke("turn:start", selection, threadId, text),
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
  developmentPolicy       : () => ipcRenderer.invoke("development:policy")                                       ,
  developmentStatus       : (workId) => ipcRenderer.invoke("development:status", workId)                         ,
  completeDevelopmentWork : (workId) => ipcRenderer.invoke("development:complete", workId)                       ,
  listReports             : () => ipcRenderer.invoke("reports:list")                                             ,
  readReport              : (reportId) => ipcRenderer.invoke("reports:read", reportId)                           ,
  chooseReportRepository  : () => ipcRenderer.invoke("reports:choose")                                           ,
  exportReport            : (reportId) => ipcRenderer.invoke("reports:export", reportId)                         ,
  nativeReportStatus      : () => ipcRenderer.invoke("reports:native-status")                                    ,
  setNativeReportEnabled  : (enabled) => ipcRenderer.invoke("reports:native-enabled", enabled)                   ,
  retryNativeReport       : (key) => ipcRenderer.invoke("reports:native-retry", key)                             ,
  onEvent                 : (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: ScopedAppEvent) => listener(entry);
    ipcRenderer.on("app:event", handler);
    return () => ipcRenderer.removeListener("app:event", handler);
  }
};
contextBridge.exposeInMainWorld("www", api);
