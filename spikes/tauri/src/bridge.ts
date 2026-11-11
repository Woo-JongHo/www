import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AppEvent, RpcId, WwwApi } from "../../../src/shared";

const api: WwwApi = {
  chooseWorkspace: () => invoke("choose_workspace"),
  workspace: () => invoke("workspace"),
  startThread: () => invoke("start_thread"),
  startTurn: (threadId, text) => invoke("start_turn", { threadId, text }),
  interrupt: (threadId, turnId) => invoke("interrupt", { threadId, turnId }),
  respond: (requestId: RpcId, decision: string) => invoke("respond", { requestId, decision }),
  events: () => invoke("events"),
  probeReady: () => invoke("probe_ready"),
  probeFinish: (result) => invoke("probe_finish", { result }),
  onEvent: (listener) => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<AppEvent>("app:event", ({ payload }) => listener(payload)).then((value) => {
      if (disposed) value();
      else unlisten = value;
    });
    return () => { disposed = true; unlisten?.(); };
  }
};
window.www = api;
