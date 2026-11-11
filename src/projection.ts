import type { AppEvent, ApprovalState, InterruptState, RpcId, TransportState, TurnState } from "./shared";

export type Block =
  | { kind: "answer"; id: string; turnId: string | null; text: string; streaming: boolean }
  | { kind: "command"; id: string; turnId: string | null; command: string; cwd: string | null; output: string; outputTruncated: boolean; running: boolean; exitCode: number | null }
  | { kind: "files"; id: string; turnId: string | null; paths: string[]; running: boolean }
  | { kind: "approval"; requestId: RpcId; method: string; summary: string; supported: boolean; state: ApprovalState; open: boolean };

export interface Projection {
  blocks: Block[];
  working: boolean;
  turnId: string | null;
  transport: TransportState;
  turn: TurnState;
  interrupt: InterruptState;
}
const MAX_OUTPUT = 32_768;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const string = (value: unknown): string => typeof value === "string" ? value : "";
const eventTurnId = (params: Record<string, unknown>, fallback: string | null): string | null =>
  string(params.turnId) || string(object(params.turn).id) || string(object(params.item).turnId) || fallback;

export function project(events: readonly AppEvent[]): Projection {
  const blocks: Block[] = [];
  let working = false;
  let turnId: string | null = null;
  let transport: TransportState = "connected";
  let turn: TurnState = "idle";
  let interrupt: InterruptState = "idle";
  for (const event of events) {
    const p = object(event.params);
    const item = object(p.item);
    const id = string(item.id) || string(p.itemId) || `event-${event.seq}`;
    const relatedTurnId = eventTurnId(p, turnId);
    const blockId = `${relatedTurnId ?? "unknown"}:${id}`;
    if (event.method === "turn/started") { working = true; turnId = relatedTurnId; turn = "running"; interrupt = "idle"; }
    if (event.method === "turn/completed") {
      working = false;
      const status = string(object(p.turn).status);
      turn = status === "interrupted" ? "interrupted" : status === "failed" ? "failed" : "completed";
      if (interrupt === "requested") interrupt = "acknowledged";
    }
    if (event.method === "turn/interruptRequested") interrupt = "requested";
    if (event.method === "turn/interruptAcknowledged") interrupt = "acknowledged";
    if (event.method === "turn/interruptUncertain") interrupt = "uncertain";
    if (event.method === "transport/closed") { transport = "closed"; working = false; if (turn === "running") turn = "failed"; }
    if (event.method === "transport/error") transport = "error";
    if (event.method === "item/agentMessage/delta") {
      const existing = blocks.find((block): block is Extract<Block, {kind: "answer"}> => block.kind === "answer" && block.id === blockId);
      if (existing) existing.text += string(p.delta);
      else blocks.push({ kind: "answer", id: blockId, turnId: relatedTurnId, text: string(p.delta), streaming: true });
    }
    if (event.method === "item/completed" && item.type === "agentMessage") {
      const existing = blocks.find((block): block is Extract<Block, {kind: "answer"}> => block.kind === "answer" && block.id === blockId);
      const text = string(item.text);
      if (existing) { existing.text = text || existing.text; existing.streaming = false; }
      else blocks.push({ kind: "answer", id: blockId, turnId: relatedTurnId, text, streaming: false });
    }
    if (event.method === "item/started" && item.type === "commandExecution") blocks.push({ kind: "command", id: blockId, turnId: relatedTurnId, command: string(item.command), cwd: string(item.cwd) || null, output: "", outputTruncated: false, running: true, exitCode: null });
    if (event.method === "item/commandExecution/outputDelta") {
      const command = blocks.find((block): block is Extract<Block, {kind: "command"}> => block.kind === "command" && block.id === blockId);
      if (command) {
        command.output += string(p.delta);
        if (command.output.length > MAX_OUTPUT) { command.output = command.output.slice(-MAX_OUTPUT); command.outputTruncated = true; }
      }
    }
    if (event.method === "item/completed" && item.type === "commandExecution") {
      const command = blocks.find((block): block is Extract<Block, {kind: "command"}> => block.kind === "command" && block.id === blockId);
      if (command) { command.running = false; command.exitCode = typeof item.exitCode === "number" ? item.exitCode : null; command.output ||= string(item.aggregatedOutput); }
    }
    if (event.method === "item/started" && item.type === "fileChange") blocks.push({ kind: "files", id: blockId, turnId: relatedTurnId, paths: Array.isArray(item.changes) ? item.changes.map((x) => string(object(x).path)).filter(Boolean) : [], running: true });
    if (event.method === "item/completed" && item.type === "fileChange") {
      const files = blocks.find((block): block is Extract<Block, {kind: "files"}> => block.kind === "files" && block.id === blockId);
      if (files) files.running = false;
    }
    if (event.kind === "request" && event.requestId !== undefined) blocks.push({ kind: "approval", requestId: event.requestId, method: event.method, summary: approvalSummary(event.method, p), supported: event.supported === true, state: "open", open: true });
    if (event.method.startsWith("approval/") && event.requestId !== undefined) {
      const approval = blocks.find((block): block is Extract<Block, {kind: "approval"}> => block.kind === "approval" && block.requestId === event.requestId);
      if (approval) {
        approval.state = event.method === "approval/responding" ? "responding" : event.method === "approval/responded" ? "responded" : "uncertain";
        approval.open = false;
      }
    }
  }
  return { blocks, working, turnId, transport, turn, interrupt };
}

function approvalSummary(method: string, params: Record<string, unknown>): string {
  if (method === "item/commandExecution/requestApproval") return string(params.command) || string(params.reason) || "명령 실행 요청";
  if (method === "item/fileChange/requestApproval") return string(params.reason) || `파일 변경 요청: ${string(params.itemId)}`;
  return `지원하지 않는 구조화 요청: ${method}`;
}
