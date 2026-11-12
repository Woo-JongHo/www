import { contextBridge, ipcRenderer } from "electron";
import type { AppEvent, WwwApi } from "./shared";

const api: WwwApi = {
  chooseWorkspace         : () => ipcRenderer.invoke("workspace:choose")                                         ,
  workspace               : () => ipcRenderer.invoke("workspace:get")                                            ,
  startThread             : () => ipcRenderer.invoke("thread:start")                                             ,
  startTurn               : (threadId, text) => ipcRenderer.invoke("turn:start", threadId, text)                 ,
  interrupt               : (threadId, turnId) => ipcRenderer.invoke("turn:interrupt", threadId, turnId)         ,
  respond                 : (requestId, decision) => ipcRenderer.invoke("approval:respond", requestId, decision) ,
  events                  : () => ipcRenderer.invoke("events:get")                                               ,
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
    const handler = (_event: Electron.IpcRendererEvent, entry: AppEvent) => listener(entry);
    ipcRenderer.on("app:event", handler);
    return () => ipcRenderer.removeListener("app:event", handler);
  }
};
contextBridge.exposeInMainWorld("www", api);
