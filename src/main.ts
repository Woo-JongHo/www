import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { JsonRpcClient, type RpcMessage } from "./rpc";
import type { AppEvent, RpcId, WorkspaceInfo } from "./shared";

const DIST = join(app.getAppPath(), "dist");
const CODEX = process.env.WWW_CODEX_BIN || "codex";
const PROBE_PATH = process.env.WWW_PROBE_PATH;
const nativeEntry = process.hrtime.bigint();
let workspace = app.getPath("home");
let rpc: JsonRpcClient | null = null;
let window: BrowserWindow | null = null;
let threadStarted = false;
let seq = 0;
const eventLog: AppEvent[] = [];
const pendingApprovals = new Map<RpcId, string>();
const approvalAttempts = new Set<RpcId>();
const SUPPORTED = new Set(["item/commandExecution/requestApproval", "item/fileChange/requestApproval"]);
const DECISIONS = new Set(["accept", "acceptForSession", "decline", "cancel"]);

function publish(event: Omit<AppEvent, "seq" | "at">): void {
  const entry = { ...event, seq: ++seq, at: new Date().toISOString() };
  eventLog.push(entry);
  if (eventLog.length > 2000) eventLog.shift();
  window?.webContents.send("app:event", entry);
}

function connect(): Promise<JsonRpcClient> {
  if (rpc) return Promise.resolve(rpc);
  return new Promise((resolveClient, reject) => {
    const child = spawn(CODEX, ["app-server"], { stdio: ["pipe", "pipe", "pipe"] });
    const client = new JsonRpcClient(child);
    let settled = false;
    client.once("closed", (error: Error) => {
      rpc = null;
      for (const requestId of pendingApprovals.keys()) {
        publish({ kind: "notification", method: "approval/uncertain", params: { message: error.message }, requestId });
      }
      pendingApprovals.clear();
      approvalAttempts.clear();
      publish({ kind: "transport", method: "transport/closed", params: { message: error.message } });
      if (!settled) reject(error);
    });
    client.on("stderr", (text: string) => publish({ kind: "transport", method: "transport/stderr", params: { text } }));
    client.on("protocolError", (message: string) => publish({ kind: "transport", method: "transport/error", params: { message } }));
    client.on("message", (message: RpcMessage) => {
      const method = String(message.method);
      const id = message.id;
      if (typeof id === "string" || typeof id === "number") {
        const supported = SUPPORTED.has(method);
        if (supported && (pendingApprovals.has(id) || approvalAttempts.has(id))) {
          const params = message.params && typeof message.params === "object" && !Array.isArray(message.params)
            ? message.params as Record<string, unknown>
            : {};
          publish({ kind: "request", method, params: { ...params, duplicateRequestId: true }, requestId: id, supported: false });
        } else {
          if (supported) pendingApprovals.set(id, method);
          publish({ kind: "request", method, params: message.params, requestId: id, supported });
        }
      } else publish({ kind: "notification", method, params: message.params });
    });
    void client.request("initialize", { clientInfo: { name: "www", title: "WWW", version: app.getVersion() }, capabilities: { experimentalApi: false } })
      .then(() => {
        client.notify("initialized", {});
        rpc = client;
        settled = true;
        publish({ kind: "transport", method: "transport/connected", params: {} });
        resolveClient(client);
      })
      .catch((error) => { settled = true; reject(error); });
  });
}

function workspaceInfo(): WorkspaceInfo {
  const git = (args: string[]) => { try { return execFileSync("git", args, { cwd: workspace, encoding: "utf8" }).trim(); } catch { return ""; } };
  return { name: basename(workspace), path: workspace, branch: git(["branch", "--show-current"]) || null, changes: git(["status", "--porcelain"]).split("\n").filter(Boolean).length };
}
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object") throw new Error("Invalid app-server response"); return value as Record<string, unknown>; }
function requiredString(value: unknown, name: string): string { if (typeof value !== "string" || !value) throw new Error(`Invalid ${name}`); return value; }
function validId(value: unknown): asserts value is RpcId { if (typeof value !== "string" && typeof value !== "number") throw new Error("Invalid request ID"); }

function registerIpc(): void {
  ipcMain.handle("workspace:get", () => workspaceInfo());
  ipcMain.handle("workspace:choose", async () => {
    if (threadStarted) throw new Error("작업 폴더는 첫 스레드 전에만 변경할 수 있습니다.");
    const result = await dialog.showOpenDialog(window!, { properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;
    workspace = resolve(result.filePaths[0]);
    return workspaceInfo();
  });
  ipcMain.handle("thread:start", async () => {
    const client = await connect();
    const result = record(await client.request("thread/start", { cwd: workspace, approvalPolicy: "on-request", sandbox: "workspace-write" }));
    const threadId = requiredString(record(result.thread).id, "thread ID");
    threadStarted = true;
    return { threadId };
  });
  ipcMain.handle("turn:start", async (_event, threadId: unknown, text: unknown) => {
    const validThreadId = requiredString(threadId, "thread ID");
    if (typeof text !== "string" || !text.trim() || text.length > 100_000) throw new Error("Invalid prompt");
    const prompt = text.trim();
    const clientRequestId = randomUUID();
    publish({ kind: "notification", method: "turn/userPrompt", params: { clientRequestId, threadId: validThreadId, text: prompt } });
    try {
      const result = record(await (await connect()).request("turn/start", { threadId: validThreadId, input: [{ type: "text", text: prompt, text_elements: [] }] }));
      const turnId = requiredString(record(result.turn).id, "turn ID");
      publish({ kind: "notification", method: "turn/startAccepted", params: { clientRequestId, threadId: validThreadId, turnId } });
      return { turnId };
    } catch (error) {
      publish({ kind: "notification", method: "turn/startFailed", params: { clientRequestId, threadId: validThreadId, message: String(error) } });
      throw error;
    }
  });
  ipcMain.handle("turn:interrupt", async (_event, threadId: unknown, turnId: unknown) => {
    requiredString(threadId, "thread ID"); requiredString(turnId, "turn ID");
    publish({ kind: "notification", method: "turn/interruptRequested", params: { threadId, turnId } });
    try {
      await (await connect()).request("turn/interrupt", { threadId, turnId });
      publish({ kind: "notification", method: "turn/interruptAcknowledged", params: { threadId, turnId } });
    } catch (error) {
      publish({ kind: "notification", method: "turn/interruptUncertain", params: { threadId, turnId, message: String(error) } });
      throw error;
    }
  });
  ipcMain.handle("approval:respond", async (_event, requestId: unknown, decision: unknown) => {
    validId(requestId);
    if (typeof decision !== "string" || !DECISIONS.has(decision)) throw new Error("Unsupported approval decision");
    if (!pendingApprovals.has(requestId)) throw new Error("Unknown or unsupported approval request");
    if (approvalAttempts.has(requestId)) throw new Error("Approval response has already been attempted");
    approvalAttempts.add(requestId);
    publish({ kind: "notification", method: "approval/responding", params: { decision }, requestId });
    try {
      await (await connect()).respond(requestId, { decision });
      pendingApprovals.delete(requestId);
      publish({ kind: "notification", method: "approval/responded", params: { decision }, requestId });
    } catch (error) {
      pendingApprovals.delete(requestId);
      publish({ kind: "notification", method: "approval/uncertain", params: { decision, message: String(error) }, requestId });
      throw error;
    }
  });
  ipcMain.handle("events:get", () => [...eventLog]);
  ipcMain.handle("probe:ready", () => ({
    enabled: !!PROBE_PATH,
    ...(PROBE_PATH ? { readinessMs: Number(process.hrtime.bigint() - nativeEntry) / 1e6 } : {})
  }));
  ipcMain.handle("probe:finish", async (_event, result: unknown) => {
    if (!PROBE_PATH) throw new Error("Probe mode is disabled");
    mkdirSync(join(PROBE_PATH, ".."), { recursive: true });
    if (!window) throw new Error("Probe window is unavailable");
    const screenshot = await window.webContents.capturePage();
    writeFileSync(join(PROBE_PATH, "..", "electron-chat.png"), screenshot.toPNG());
    writeFileSync(PROBE_PATH, `${JSON.stringify({ shell: "electron", ...record(result) }, null, 2)}\n`);
    setImmediate(() => app.quit());
  });
}

function createWindow(): void {
  window = new BrowserWindow({ width: 1440, height: 900, minWidth: 1040, minHeight: 680, backgroundColor: "#0b0b0c", webPreferences: { preload: join(DIST, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  void window.loadFile(join(DIST, "index.html"));
}

void app.whenReady().then(() => { registerIpc(); createWindow(); });
app.on("window-all-closed", () => app.quit());
