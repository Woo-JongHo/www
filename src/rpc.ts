import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { RpcId } from "./shared";

const MAX_FRAME_BYTES = 4 * 1024 * 1024;
export type RpcMessage = Record<string, unknown>;

export class RpcClosedError extends Error {
  constructor(message: string, readonly uncertain: boolean) { super(message); }
}

export class JsonRpcClient extends EventEmitter {
  private nextId = 1;
  private buffer = "";
  private closed = false;
  private pending = new Map<RpcId, { resolve(value: unknown): void; reject(reason: Error): void }>();

  constructor(private readonly child: Pick<ChildProcessWithoutNullStreams, "stdin" | "stdout" | "stderr" | "once">) {
    super();
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.consume(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => this.emit("stderr", chunk));
    child.once("error", (error: Error) => this.close(`Codex app-server error: ${error.message}`));
    child.once("exit", (code: number | null, signal: NodeJS.Signals | null) => this.close(`Codex app-server closed (${signal ?? code ?? "EOF"})`));
  }

  request(method: string, params: unknown): Promise<unknown> {
    if (this.closed) return Promise.reject(new RpcClosedError("Codex app-server is closed", false));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params: unknown): void { this.write({ jsonrpc: "2.0", method, params }); }

  respond(id: RpcId, result: unknown): Promise<void> {
    if (this.closed) return Promise.reject(new RpcClosedError("Codex app-server is closed", false));
    const payload = `${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`;
    return new Promise((resolve, reject) => {
      this.child.stdin.write(payload, (error?: Error | null) => {
        if (error) reject(new RpcClosedError(`Codex app-server response write failed: ${error.message}`, true));
        else resolve();
      });
    });
  }

  private write(message: RpcMessage): void {
    if (this.closed) throw new RpcClosedError("Codex app-server is closed", false);
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private consume(chunk: string): void {
    this.buffer += chunk;
    if (Buffer.byteLength(this.buffer) > MAX_FRAME_BYTES && !this.buffer.includes("\n")) {
      this.close("Codex app-server sent an oversized frame");
      return;
    }
    for (;;) {
      const end = this.buffer.indexOf("\n");
      if (end < 0) return;
      const line = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      if (!line.trim()) continue;
      if (Buffer.byteLength(line) > MAX_FRAME_BYTES) { this.close("Codex app-server sent an oversized frame"); return; }
      let message: RpcMessage;
      try { message = JSON.parse(line) as RpcMessage; }
      catch { this.emit("protocolError", "Codex app-server sent invalid JSON"); continue; }
      const id = message.id;
      if ((typeof id === "string" || typeof id === "number") && ("result" in message || "error" in message) && !message.method) {
        const pending = this.pending.get(id);
        if (!pending) continue;
        this.pending.delete(id);
        if ("error" in message) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else if (typeof message.method === "string") {
        this.emit("message", message);
      }
    }
  }

  private close(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    const error = new RpcClosedError(`${reason}; pending mutations were not retried`, this.pending.size > 0);
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.emit("closed", error);
  }
}
