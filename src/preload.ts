import { contextBridge, ipcRenderer } from "electron";
import type { AppEvent, RpcId, WwwApi } from "./shared";

const api: WwwApi = {
  chooseWorkspace: () => ipcRenderer.invoke("workspace:choose"),
  workspace: () => ipcRenderer.invoke("workspace:get"),
  startThread: () => ipcRenderer.invoke("thread:start"),
  startTurn: (threadId, text) => ipcRenderer.invoke("turn:start", threadId, text),
  interrupt: (threadId, turnId) => ipcRenderer.invoke("turn:interrupt", threadId, turnId),
  respond: (requestId: RpcId, decision: string) => ipcRenderer.invoke("approval:respond", requestId, decision),
  events: () => ipcRenderer.invoke("events:get"),
  onEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: AppEvent) => listener(entry);
    ipcRenderer.on("app:event", handler);
    return () => ipcRenderer.removeListener("app:event", handler);
  }
};
contextBridge.exposeInMainWorld("www", api);
