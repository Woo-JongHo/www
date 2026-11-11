import type { AppEvent, RpcId } from "./shared";

export type Block =
  | { kind: "answer"; id: string; text: string; streaming: boolean }
  | { kind: "command"; id: string; command: string; output: string; running: boolean; exitCode: number | null }
  | { kind: "files"; id: string; paths: string[]; running: boolean }
  | { kind: "approval"; requestId: RpcId; method: string; summary: string; supported: boolean; open: boolean };

export interface Projection { blocks: Block[]; working: boolean; turnId: string | null; }
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const string = (value: unknown): string => typeof value === "string" ? value : "";

export function project(events: readonly AppEvent[]): Projection {
  const blocks: Block[] = [];
  let working = false;
  let turnId: string | null = null;
  for (const event of events) {
    const p = object(event.params);
    const item = object(p.item);
    const id = string(item.id || p.itemId) || `event-${event.seq}`;
    if (event.method === "turn/started") { working = true; turnId = string(object(p.turn).id) || turnId; }
    if (event.method === "turn/completed") working = false;
    if (event.method === "item/agentMessage/delta") {
      const existing = blocks.find((block): block is Extract<Block, {kind: "answer"}> => block.kind === "answer" && block.id === id);
      if (existing) existing.text += string(p.delta);
      else blocks.push({ kind: "answer", id, text: string(p.delta), streaming: true });
    }
    if (event.method === "item/completed" && item.type === "agentMessage") {
      const existing = blocks.find((block): block is Extract<Block, {kind: "answer"}> => block.kind === "answer" && block.id === id);
      const text = string(item.text);
      if (existing) { existing.text = text || existing.text; existing.streaming = false; }
      else blocks.push({ kind: "answer", id, text, streaming: false });
    }
    if (event.method === "item/started" && item.type === "commandExecution") blocks.push({ kind: "command", id, command: string(item.command), output: "", running: true, exitCode: null });
    if (event.method === "item/commandExecution/outputDelta") {
      const command = blocks.find((block): block is Extract<Block, {kind: "command"}> => block.kind === "command" && block.id === id);
      if (command) command.output += string(p.delta);
    }
    if (event.method === "item/completed" && item.type === "commandExecution") {
      const command = blocks.find((block): block is Extract<Block, {kind: "command"}> => block.kind === "command" && block.id === id);
      if (command) { command.running = false; command.exitCode = typeof item.exitCode === "number" ? item.exitCode : null; command.output ||= string(item.aggregatedOutput); }
    }
    if (event.method === "item/started" && item.type === "fileChange") blocks.push({ kind: "files", id, paths: Array.isArray(item.changes) ? item.changes.map((x) => string(object(x).path)).filter(Boolean) : [], running: true });
    if (event.method === "item/completed" && item.type === "fileChange") {
      const files = blocks.find((block): block is Extract<Block, {kind: "files"}> => block.kind === "files" && block.id === id);
      if (files) files.running = false;
    }
    if (event.kind === "request" && event.requestId !== undefined) blocks.push({ kind: "approval", requestId: event.requestId, method: event.method, summary: approvalSummary(event.method, p), supported: event.supported === true, open: true });
  }
  return { blocks, working, turnId };
}

function approvalSummary(method: string, params: Record<string, unknown>): string {
  if (method === "item/commandExecution/requestApproval") return string(params.command) || string(params.reason) || "명령 실행 요청";
  if (method === "item/fileChange/requestApproval") return string(params.reason) || `파일 변경 요청: ${string(params.itemId)}`;
  return `지원하지 않는 구조화 요청: ${method}`;
}
