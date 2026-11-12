import type {
  AppEvent,
  ApprovalState,
  InterruptState,
  RequestState,
  RpcId,
  TransportState,
  TurnState,
} from "./shared";

export const MAX_OUTPUT_CODE_UNITS = 32_768;

type ItemStatus = "running" | "completed" | "failed" | "unknown";

export type Block =
  | { kind: "user"; id: string; threadId: string | null; turnId: string | null; text: string; state: RequestState; error: string | null }
  | { kind: "explanation"; id: string; threadId: string | null; turnId: string | null; text: string; streaming: boolean; source: "commentary" | "publicPlan" }
  | { kind: "answer"; id: string; threadId: string | null; turnId: string | null; text: string; streaming: boolean }
  | { kind: "command"; id: string; threadId: string | null; turnId: string | null; command: string; cwd: string | null; output: string; outputTruncated: boolean; running: boolean; status: ItemStatus; exitCode: number | null }
  | { kind: "files"; id: string; threadId: string | null; turnId: string | null; changes: { path: string; diff: string | null; truncated: boolean }[]; running: boolean; status: ItemStatus }
  | { kind: "approval"; id: string; requestId: RpcId; threadId: string | null; turnId: string | null; method: string; summary: string; supported: boolean; state: ApprovalState; open: boolean };

export interface Projection {
  blocks: Block[];
  working: boolean;
  threadId: string | null;
  turnId: string | null;
  transport: TransportState;
  turn: TurnState;
  interrupt: InterruptState;
  historyTruncated: boolean;
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};
const string = (value: unknown): string => typeof value === "string" ? value : "";
const nullableString = (value: unknown): string | null => string(value) || null;
const eventTurnId = (params: Record<string, unknown>, fallback: string | null): string | null =>
  nullableString(params.turnId) ?? nullableString(object(params.turn).id) ?? nullableString(object(params.item).turnId) ?? fallback;
const eventThreadId = (params: Record<string, unknown>, fallback: string | null): string | null =>
  nullableString(params.threadId) ?? nullableString(object(params.thread).id) ?? nullableString(object(params.turn).threadId) ?? fallback;

function limitOutput(value: string): { output: string; truncated: boolean } {
  if (value.length <= MAX_OUTPUT_CODE_UNITS) return { output: value, truncated: false };
  return { output: value.slice(-MAX_OUTPUT_CODE_UNITS), truncated: true };
}

function publicMessageKind(method: string, item: Record<string, unknown>, params: Record<string, unknown>): "answer" | "commentary" | "publicPlan" | null {
  const type = string(item.type);
  const phase = string(params.phase) || string(item.phase);
  if (type === "reasoning" || phase === "reasoning" || phase === "analysis") return null;
  if (method.includes("publicPlan") || type === "publicPlan" || type === "plan") return "publicPlan";
  if (phase === "commentary") return "commentary";
  if (method.includes("agentMessage") || type === "agentMessage") return "answer";
  return null;
}

function itemStatus(item: Record<string, unknown>): ItemStatus {
  const exitCode = item.exitCode;
  if (typeof exitCode === "number") return exitCode === 0 ? "completed" : "failed";
  const status = string(item.status);
  if (status === "failed") return "failed";
  if (status === "completed") return "completed";
  return "unknown";
}

export function project(events: readonly AppEvent[]): Projection {
  const blocks: Block[] = [];
  let threadId: string | null = null;
  let turnId: string | null = null;
  let transport: TransportState = "disconnected";
  let turn: TurnState = "idle";
  let interrupt: InterruptState = "idle";

  for (const event of events) {
    const params = object(event.params);
    const item = object(params.item);
    const relatedTurnId = eventTurnId(params, turnId);
    const relatedThreadId = eventThreadId(params, threadId);
    const itemId = string(item.id) || string(params.itemId) || `event-${event.seq}`;
    const blockId = `${relatedThreadId ?? "unknown"}:${relatedTurnId ?? "unknown"}:${itemId}`;
    const activeTurn = relatedThreadId === threadId && relatedTurnId === turnId;

    if (event.method === "turn/userPrompt") {
      const id = string(params.clientRequestId) || `request-${event.seq}`;
      blocks.push({
        kind: "user",
        id,
        threadId: relatedThreadId,
        turnId: null,
        text: string(params.text),
        state: "sending",
        error: null,
      });
      threadId = relatedThreadId;
    }
    if (event.method === "turn/startAccepted") {
      const id = string(params.clientRequestId);
      const request = blocks.find((block): block is Extract<Block, { kind: "user" }> => block.kind === "user" && block.id === id);
      if (request) {
        request.state = "accepted";
        request.turnId = relatedTurnId;
      }
      threadId = relatedThreadId;
      turnId = relatedTurnId;
      if (!activeTurn) turn = "starting";
    }
    if (event.method === "turn/startFailed") {
      const id = string(params.clientRequestId);
      const request = blocks.find((block): block is Extract<Block, { kind: "user" }> => block.kind === "user" && block.id === id);
      if (request) {
        request.state = "failed";
        request.error = string(params.message) || "전송 결과 미확인";
      }
      if (!turnId) turn = "failed";
    }
    if (event.method === "turn/started") {
      threadId = relatedThreadId;
      turnId = relatedTurnId;
      turn = "running";
      interrupt = "idle";
    }
    if (event.method === "turn/completed" && activeTurn) {
      const status = string(object(params.turn).status);
      if (status === "completed") turn = "completed";
      else if (status === "interrupted") turn = "interrupted";
      else if (status === "failed") turn = "failed";
      else turn = "unknown";
      if (interrupt === "requested") {
        interrupt = status === "interrupted" ? "acknowledged" : "uncertain";
      }
    }
    if (event.method === "turn/interruptRequested" && activeTurn) interrupt = "requested";
    if (event.method === "turn/interruptUncertain" && activeTurn) interrupt = "uncertain";
    if (event.method === "transport/connected") transport = "connected";
    if (event.method === "transport/closed") {
      transport = "closed";
      if (turn === "running" || turn === "starting") turn = "unknown";
      for (const block of blocks) {
        if (block.kind === "command" && block.running) {
          block.running = false;
          block.status = "unknown";
        }
        if (block.kind === "files" && block.running) {
          block.running = false;
          block.status = "unknown";
        }
      }
    }
    if (event.method === "transport/error") transport = "error";

    const messageKind = publicMessageKind(event.method, item, params);
    const isDelta = event.method.endsWith("/delta");
    const isCompleted = event.method === "item/completed";
    const isMessageStarted = event.method === "item/started" && item.type === "agentMessage";
    if (messageKind && (isDelta || isCompleted || isMessageStarted)) {
      const existingIndex = blocks.findIndex((block) => (block.kind === "answer" || block.kind === "explanation") && block.id === blockId);
      const prior = blocks[existingIndex];
      const existing = prior?.kind === "answer" || prior?.kind === "explanation" ? prior : undefined;
      const phase = string(params.phase) || string(item.phase);
      const source = !phase && existing?.kind === "explanation" ? existing.source : messageKind;
      const kind = source === "answer" ? "answer" : "explanation";
      const text = isDelta ? string(params.delta) : string(item.text) || string(item.content);
      const message = {
        id: blockId,
        threadId: relatedThreadId,
        turnId: relatedTurnId,
        text: isDelta ? (existing?.text ?? "") + text : text || existing?.text || "",
        streaming: isCompleted ? false : existing?.streaming ?? true,
      };
      const replacement: Block = kind === "answer"
        ? { ...message, kind: "answer" }
        : { ...message, kind: "explanation", source: source === "publicPlan" ? "publicPlan" : "commentary" };
      if (existingIndex < 0) blocks.push(replacement);
      else blocks[existingIndex] = replacement;
    }

    if ((event.method === "item/started" && item.type === "commandExecution") || event.method === "item/commandExecution/outputDelta") {
      let command = blocks.find((block): block is Extract<Block, { kind: "command" }> => block.kind === "command" && block.id === blockId);
      if (!command) {
        command = {
          kind: "command",
          id: blockId,
          threadId: relatedThreadId,
          turnId: relatedTurnId,
          command: string(item.command),
          cwd: nullableString(item.cwd),
          output: "",
          outputTruncated: false,
          running: true,
          status: "running",
          exitCode: null,
        };
        blocks.push(command);
      } else {
        command.command ||= string(item.command);
        command.cwd ||= nullableString(item.cwd);
      }
      if (event.method === "item/commandExecution/outputDelta") {
        const limited = limitOutput(command.output + string(params.delta));
        command.output = limited.output;
        command.outputTruncated ||= limited.truncated;
      }
    }
    if (event.method === "item/completed" && item.type === "commandExecution") {
      let command = blocks.find((block): block is Extract<Block, { kind: "command" }> => block.kind === "command" && block.id === blockId);
      if (!command) {
        command = {
          kind: "command",
          id: blockId,
          threadId: relatedThreadId,
          turnId: relatedTurnId,
          command: string(item.command),
          cwd: nullableString(item.cwd),
          output: "",
          outputTruncated: false,
          running: false,
          status: "unknown",
          exitCode: null,
        };
        blocks.push(command);
      }
      command.command ||= string(item.command);
      command.cwd ||= nullableString(item.cwd);
      command.running = false;
      command.exitCode = typeof item.exitCode === "number" ? item.exitCode : null;
      command.status = itemStatus(item);
      const aggregatedOutput = string(item.aggregatedOutput);
      if (aggregatedOutput) {
        const limited = limitOutput(aggregatedOutput);
        command.output = limited.output;
        command.outputTruncated ||= limited.truncated;
      }
    }

    if (event.method === "item/started" && item.type === "fileChange") {
      let files = blocks.find((block): block is Extract<Block, { kind: "files" }> => block.kind === "files" && block.id === blockId);
      if (!files) {
        files = { kind: "files", id: blockId, threadId: relatedThreadId, turnId: relatedTurnId, changes: [], running: true, status: "running" };
        blocks.push(files);
      }
      const changes = fileChanges(item);
      if (changes.length) files.changes = changes;
    }
    if (event.method === "item/completed" && item.type === "fileChange") {
      let files = blocks.find((block): block is Extract<Block, { kind: "files" }> => block.kind === "files" && block.id === blockId);
      if (!files) {
        files = { kind: "files", id: blockId, threadId: relatedThreadId, turnId: relatedTurnId, changes: [], running: false, status: "unknown" };
        blocks.push(files);
      }
      const changes = fileChanges(item);
      if (changes.length) files.changes = changes;
      files.running = false;
      files.status = string(item.status) === "failed" ? "failed" : string(item.status) && string(item.status) !== "completed" ? "unknown" : "completed";
    }

    if (event.kind === "request" && event.requestId !== undefined) {
      blocks.push({
        kind: "approval",
        id: `approval-${typeof event.requestId}-${String(event.requestId)}-${event.seq}`,
        requestId: event.requestId,
        threadId: relatedThreadId,
        turnId: relatedTurnId,
        method: event.method,
        summary: approvalSummary(event.method, params),
        supported: event.supported === true,
        state: "open",
        open: event.supported === true,
      });
    }
    if (event.method.startsWith("approval/") && event.requestId !== undefined) {
      const approval = blocks.find((block): block is Extract<Block, { kind: "approval" }> => block.kind === "approval" && block.supported && block.requestId === event.requestId);
      if (approval) {
        approval.state = event.method === "approval/responding" ? "responding" : event.method === "approval/responded" ? "responded" : "uncertain";
        approval.open = false;
      }
    }
  }

  return {
    blocks,
    working: turn === "starting" || turn === "running",
    threadId,
    turnId,
    transport,
    turn,
    interrupt,
    historyTruncated: events.length > 0 && events[0]!.seq > 1,
  };
}

function fileChanges(item: Record<string, unknown>): Extract<Block, { kind: "files" }>["changes"] {
  const changes: Extract<Block, { kind: "files" }>["changes"] = [];
  if (!Array.isArray(item.changes)) return changes;
  for (const value of item.changes) {
    const change = object(value);
    const path = string(change.path);
    if (!path) continue;
    const diff = typeof change.diff === "string" ? change.diff : null;
    const limited = limitOutput(diff ?? "");
    changes.push({ path, diff: diff === null ? null : limited.output, truncated: limited.truncated });
  }
  return changes;
}

function approvalSummary(method: string, params: Record<string, unknown>): string {
  if (params.duplicateRequestId === true) return "중복된 승인 ID를 수신해 응답하지 않았습니다.";
  if (method === "item/commandExecution/requestApproval") return string(params.command) || string(params.reason) || "명령 실행 요청";
  if (method === "item/fileChange/requestApproval") return string(params.reason) || `파일 변경 요청: ${string(params.itemId)}`;
  return `지원하지 않는 구조화 요청: ${method}`;
}
