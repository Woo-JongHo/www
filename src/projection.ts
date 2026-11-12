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
  | {
      kind     : "user"        ;
      id       : string        ;
      threadId : string | null ;
      turnId   : string | null ;
      text     : string        ;
      state    : RequestState  ;
      error    : string | null ;
    }
  | {
      kind              : "explanation"                                    ;
      id                : string                                           ;
      threadId          : string | null                                    ;
      turnId            : string | null                                    ;
      text              : string                                           ;
      streaming         : boolean                                          ;
      source            : "commentary" | "publicPlan" | "reasoningSummary" ;
      summaryTruncated? : boolean                                          ;
    }
  | {
      kind      : "answer"      ;
      id        : string        ;
      threadId  : string | null ;
      turnId    : string | null ;
      text      : string        ;
      streaming : boolean       ;
    }
  | {
      kind            : "command"     ;
      id              : string        ;
      threadId        : string | null ;
      turnId          : string | null ;
      command         : string        ;
      cwd             : string | null ;
      output          : string        ;
      outputTruncated : boolean       ;
      running         : boolean       ;
      status          : ItemStatus    ;
      exitCode        : number | null ;
    }
  | {
      kind     : "files"       ;
      id       : string        ;
      threadId : string | null ;
      turnId   : string | null ;
      changes  : {
        path      : string        ;
        diff      : string | null ;
        truncated : boolean       ;
      }[];
      running  : boolean        ;
      status   : ItemStatus     ;
    }
  | {
      kind      : "approval"    ;
      id        : string        ;
      requestId : RpcId         ;
      threadId  : string | null ;
      turnId    : string | null ;
      method    : string        ;
      summary   : string        ;
      supported : boolean       ;
      state     : ApprovalState ;
      open      : boolean       ;
    };

export interface Projection {
  blocks           : Block[]        ;
  working          : boolean        ;
  threadId         : string | null  ;
  turnId           : string | null  ;
  transport        : TransportState ;
  turn             : TurnState      ;
  interrupt        : InterruptState ;
  historyTruncated : boolean        ;
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};
const string         = (value: unknown): string => typeof value === "string" ? value : "" ;
const nullableString = (value: unknown): string | null => string(value) || null           ;
const eventTurnId = (params: Record<string, unknown>, fallback: string | null): string | null =>
  nullableString(params.turnId) ?? nullableString(object(params.turn).id) ?? nullableString(object(params.item).turnId) ?? fallback;
const eventThreadId = (params: Record<string, unknown>, fallback: string | null): string | null =>
  nullableString(params.threadId) ?? nullableString(object(params.thread).id) ?? nullableString(object(params.turn).threadId) ?? fallback;

function limitOutput(value: string): { output: string; truncated: boolean } {
  if (value.length <= MAX_OUTPUT_CODE_UNITS) return { output: value, truncated: false };
  return { output: value.slice(-MAX_OUTPUT_CODE_UNITS), truncated: true };
}

function publicMessageKind(method: string, item: Record<string, unknown>, params: Record<string, unknown>): "answer" | "commentary" | "publicPlan" | null {
  if (method.startsWith("item/reasoning/")) return null;
  const type  = string(item.type)                          ;
  const phase = string(params.phase) || string(item.phase) ;
  if (type === "reasoning" || phase === "reasoning" || phase === "analysis"    ) return null;
  if (method.includes("publicPlan") || type === "publicPlan" || type === "plan") return "publicPlan";
  if (phase === "commentary"                                                   ) return "commentary";
  if (method.includes("agentMessage") || type === "agentMessage"               ) return "answer";
  return null;
}

function isSummary(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (const part of value) {
    if (typeof part !== "string") return false;
  }
  return true;
}

function itemStatus(item: Record<string, unknown>): ItemStatus {
  const exitCode = item.exitCode;
  if (typeof exitCode === "number") return exitCode === 0 ? "completed" : "failed";
  const status = string(item.status);
  if (status === "failed")          return "failed";
  if (status === "completed")       return "completed";
  return "unknown";
}

export function project(events: readonly AppEvent[]): Projection {
  const blocks  : Block[]        = []             ;
  let threadId  : string | null  = null           ;
  let turnId    : string | null  = null           ;
  let transport : TransportState = "disconnected" ;
  let turn      : TurnState      = "idle"         ;
  let interrupt : InterruptState = "idle"         ;

  const seen        = new Set<number>()                                                                            ;
  const closedTurns = new Set<string>()                                                                            ;
  const summaries   = new Map<string, { sections: Map<number, string>; completed: boolean; truncated: boolean }>() ;
  const turnKey     = (thread: string | null, turn: string | null) => JSON.stringify([thread, turn])               ;
  const closeMessages = (thread: string | null, turn: string | null) => {
    closedTurns.add(turnKey(thread, turn));
    for (const block of blocks) {
      if ((block.kind === "explanation" || block.kind === "answer") && block.threadId === thread && block.turnId === turn) block.streaming = false;
    }
  };

  for (const event of events) {
    if (seen.has(event.seq)) continue;
    seen.add(event.seq);
    const params          = object(event.params)                                                      ;
    const item            = object(params.item)                                                       ;
    const relatedTurnId   = eventTurnId(params, turnId)                                               ;
    const relatedThreadId = eventThreadId(params, threadId)                                           ;
    const itemId          = string(item.id) || string(params.itemId) || `event-${event.seq}`          ;
    const blockId         = `${relatedThreadId ?? "unknown"}:${relatedTurnId ?? "unknown"}:${itemId}` ;
    const activeTurn      = relatedThreadId === threadId && relatedTurnId === turnId                  ;

    if (event.method === "turn/userPrompt"             ) {
      const id = string(params.clientRequestId) || `request-${event.seq}`;
      blocks.push({
        kind: "user" ,
        id           ,
        threadId : relatedThreadId     ,
        turnId   : null                ,
        text     : string(params.text) ,
        state    : "sending"           ,
        error    : null                ,
      });
      threadId = relatedThreadId;
    }
    if (event.method === "turn/startAccepted" && !activeTurn && turnId !== null) closeMessages(threadId, turnId);
    if (event.method === "turn/startAccepted"          ) {
      const id = string(params.clientRequestId);
      const request = blocks.find(
        (block): block is Extract<Block, { kind: "user" }> =>
          block.kind === "user" && block.id === id
      );
      if (request) {
        request.state = "accepted";
        request.turnId = relatedTurnId;
      }
      threadId = relatedThreadId;
      turnId = relatedTurnId;
      if (!activeTurn) turn = "starting";
    }
    if (event.method === "turn/startFailed"            ) {
      const id = string(params.clientRequestId);
      const request = blocks.find(
        (block): block is Extract<Block, { kind: "user" }> =>
          block.kind === "user" && block.id === id
      );
      if (request) {
        request.state = "failed";
        request.error = string(params.message) || "전송 결과 미확인";
      }
      if (!turnId) turn = "failed";
    }
    if (event.method === "turn/started" && !activeTurn && turnId !== null) closeMessages(threadId, turnId);
    if (event.method === "turn/completed") closeMessages(relatedThreadId, relatedTurnId);
    if (event.method === "turn/started"                ) {
      threadId  = relatedThreadId ;
      turnId    = relatedTurnId   ;
      turn      = "running"       ;
      interrupt = "idle"          ;
    }
    if (event.method === "turn/completed" && activeTurn) {
      const status = string(object(params.turn).status);
      if (status === "completed") turn = "completed";
      else if (status === "interrupted") turn = "interrupted";
      else if (status === "failed") turn = "failed";
      else turn = "unknown";
      if (interrupt !== "idle") {
        interrupt = status === "interrupted" ? "acknowledged" : "uncertain";
      }
    }
    if (event.method === "turn/interruptRequested" && activeTurn && turn === "running"                                ) interrupt = "requested";
    if (event.method === "turn/interruptAcknowledged" && activeTurn && turn === "running" && interrupt === "requested") interrupt = "accepted";
    if (event.method === "turn/interruptUncertain" && activeTurn && turn === "running" && interrupt !== "idle"        ) interrupt = "uncertain";
    if (event.method === "transport/connected") transport = "connected";
    if (event.method === "transport/status" && (params.state === "connected" || params.state === "closed" || params.state === "error" || params.state === "disconnected")) transport = params.state;
    if (event.method === "transport/closed") {
      transport = "closed";
      closedTurns.add(turnKey(threadId, turnId));
      if (turn === "running" || turn === "starting") {
        turn = "unknown";
        if (interrupt === "requested" || interrupt === "accepted") interrupt = "uncertain";
      }
      for (const block of blocks) {
        if (block.kind === "explanation" || block.kind === "answer") {
          closedTurns.add(turnKey(block.threadId, block.turnId));
          block.streaming = false;
        }
        if (block.kind === "command" && block.running              ) {
          block.running = false;
          block.status = "unknown";
        }
        if (block.kind === "files" && block.running                ) {
          block.running = false;
          block.status = "unknown";
        }
      }
    }
    if (event.method === "transport/error") transport = "error";

    const summaryDelta    = event.method === "item/reasoning/summaryTextDelta"                                                  ;
    const summaryPart     = event.method === "item/reasoning/summaryPartAdded"                                                  ;
    const summarySnapshot = (event.method === "item/started" || event.method === "item/completed") && item.type === "reasoning" ;
    if ((summaryDelta || summaryPart || summarySnapshot) && params.phase !== "analysis" && item.phase !== "analysis") {
      // 공개 필드만 읽고 식별 metadata는 본문에 섞지 않는다.
      const explicitItemId = string(item.id) || string(params.itemId)                                               ;
      const explicitScope  = !!string(params.threadId) && !!string(params.turnId)                                   ;
      const summaryId      = `reasoningSummary:${JSON.stringify([relatedThreadId, relatedTurnId, explicitItemId])}` ;
      const closed = closedTurns.has(turnKey(relatedThreadId, relatedTurnId)) || transport === "closed" ||
        (turnId !== null && !activeTurn);
      const prior      = summaries.get(summaryId)                                                   ;
      const index      = typeof params.summaryIndex === "number" ? params.summaryIndex : -1         ;
      const validIndex = Number.isSafeInteger(index) && index >= 0 && index < MAX_OUTPUT_CODE_UNITS ;
      const snapshot   = isSummary(item.summary) ? item.summary : null                              ;
      if (explicitScope && explicitItemId && summarySnapshot && event.method === "item/completed" && snapshot === null) {
        const state = prior ?? { sections: new Map<number, string>(), completed: false, truncated: false };
        state.completed = true;
        summaries.set(summaryId, state);
        const block = blocks.find((value) => value.kind === "explanation" && value.id === summaryId);
        if (block?.kind === "explanation") block.streaming = false;
      }
      if (explicitScope && explicitItemId && ((summarySnapshot && snapshot !== null) ||
          (summaryDelta && validIndex && typeof params.delta === "string" && !closed && !prior?.completed))) {
        const state = prior ?? { sections: new Map<number, string>(), completed: false, truncated: false };
        if (summarySnapshot) {
          // 완료 snapshot은 빈 배열도 포함해 이전 공개 요약을 대체한다.
          if (event.method === "item/completed" || !state.completed) {
            state.sections.clear();
            state.truncated = false;
            let remaining = MAX_OUTPUT_CODE_UNITS;
            for (const [section, value] of (snapshot ?? []).entries()) {
              const separator = state.sections.size ? 2 : 0        ;
              const available = Math.max(0, remaining - separator) ;
              if (value.length > available) state.truncated = true;
              const text = value.slice(0, available);
              if (text) {
                state.sections.set(section, text);
                remaining -= separator + text.length;
              }
            }
          }
          if (event.method === "item/completed") state.completed = true;
        } else {
          const used      = [...state.sections.values()].reduce((total, text) => total + text.length + 2, -2)                                    ;
          const available = Math.max(0, MAX_OUTPUT_CODE_UNITS - Math.max(0, used) - (!state.sections.has(index) && state.sections.size ? 2 : 0)) ;
          const delta     = string(params.delta)                                                                                                 ;
          if (delta.length > available) state.truncated = true;
          if (delta && available) state.sections.set(index, (state.sections.get(index) ?? "") + delta.slice(0, available));
        }
        summaries.set(summaryId, state);
        const text          = [...state.sections].sort(([a], [b]) => a - b).map(([, value]) => value).join("\n\n")                                       ;
        const existingIndex = blocks.findIndex((block) => block.kind === "explanation" && block.source === "reasoningSummary" && block.id === summaryId) ;
        if (text.trim()) {
          const replacement: Block = { kind: "explanation", source: "reasoningSummary", id: summaryId, threadId: relatedThreadId, turnId: relatedTurnId, text, streaming: !closed && !state.completed, summaryTruncated: state.truncated };
          if (existingIndex < 0) blocks.push(replacement);
          else blocks[existingIndex] = replacement;
        } else if (existingIndex >= 0) blocks.splice(existingIndex, 1);
      }
    }

    const messageKind      = publicMessageKind(event.method, item, params)                   ;
    const isDelta          = event.method.endsWith("/delta")                                 ;
    const isCompleted      = event.method === "item/completed"                               ;
    const isMessageStarted = event.method === "item/started" && item.type === "agentMessage" ;
    if (messageKind && (isDelta || isCompleted || isMessageStarted)) {
      const existingIndex = blocks.findIndex((block) =>
        (block.kind === "answer" || block.kind === "explanation") && block.id === blockId
      );
      const prior    = blocks[existingIndex]                                                         ;
      const existing = prior?.kind === "answer" || prior?.kind === "explanation" ? prior : undefined ;
      const phase    = string(params.phase) || string(item.phase)                                    ;
      const source   = !phase && existing?.kind === "explanation" ? existing.source : messageKind    ;
      const kind     = source === "answer" ? "answer" : "explanation"                                ;
      const text     = isDelta ? string(params.delta) : string(item.text) || string(item.content)    ;
      const message = {
        id        : blockId                                                                ,
        threadId  : relatedThreadId                                                        ,
        turnId    : relatedTurnId                                                          ,
        text      : isDelta ? (existing?.text ?? "") + text : text || existing?.text || "" ,
        streaming : isCompleted ? false : existing?.streaming ?? true                      ,
      };
      const replacement: Block = kind === "answer"
        ? { ...message, kind: "answer" }
        : { ...message, kind: "explanation", source: source === "publicPlan" ? "publicPlan" : "commentary" };
      if (existingIndex < 0) blocks.push(replacement);
      else blocks[existingIndex] = replacement;
    }

    if ((event.method === "item/started" && item.type === "commandExecution") || event.method === "item/commandExecution/outputDelta") {
      let command = blocks.find(
        (block): block is Extract<Block, { kind: "command" }> =>
          block.kind === "command" && block.id === blockId
      );
      if (!command) {
        command = {
          kind            : "command"                ,
          id              : blockId                  ,
          threadId        : relatedThreadId          ,
          turnId          : relatedTurnId            ,
          command         : string(item.command)     ,
          cwd             : nullableString(item.cwd) ,
          output          : ""                       ,
          outputTruncated : false                    ,
          running         : true                     ,
          status          : "running"                ,
          exitCode        : null                     ,
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
      let command = blocks.find(
        (block): block is Extract<Block, { kind: "command" }> =>
          block.kind === "command" && block.id === blockId
      );
      if (!command) {
        command = {
          kind            : "command"                ,
          id              : blockId                  ,
          threadId        : relatedThreadId          ,
          turnId          : relatedTurnId            ,
          command         : string(item.command)     ,
          cwd             : nullableString(item.cwd) ,
          output          : ""                       ,
          outputTruncated : false                    ,
          running         : false                    ,
          status          : "unknown"                ,
          exitCode        : null                     ,
        };
        blocks.push(command);
      }
      command.command ||= string(item.command);
      command.cwd ||= nullableString(item.cwd);
      command.running  = false                                                    ;
      command.exitCode = typeof item.exitCode === "number" ? item.exitCode : null ;
      command.status   = itemStatus(item)                                         ;
      const aggregatedOutput = string(item.aggregatedOutput);
      if (aggregatedOutput) {
        const limited = limitOutput(aggregatedOutput);
        command.output = limited.output;
        command.outputTruncated ||= limited.truncated;
      }
    }

    if (event.method === "item/started" && item.type === "fileChange") {
      let files = blocks.find(
        (block): block is Extract<Block, { kind: "files" }> =>
          block.kind === "files" && block.id === blockId
      );
      if (!files) {
        files = { kind: "files", id: blockId, threadId: relatedThreadId, turnId: relatedTurnId, changes: [], running: true, status: "running" };
        blocks.push(files);
      }
      const changes = fileChanges(item);
      if (changes.length) files.changes = changes;
    }
    if (event.method === "item/completed" && item.type === "fileChange") {
      let files = blocks.find(
        (block): block is Extract<Block, { kind: "files" }> =>
          block.kind === "files" && block.id === blockId
      );
      if (!files) {
        files = { kind: "files", id: blockId, threadId: relatedThreadId, turnId: relatedTurnId, changes: [], running: false, status: "unknown" };
        blocks.push(files);
      }
      const changes = fileChanges(item);
      if (changes.length) files.changes = changes;
      files.running = false;
      files.status = string(item.status) === "failed" ? "failed" : string(item.status) && string(item.status) !== "completed" ? "unknown" : "completed";
    }

    if (event.kind === "request" && event.requestId !== undefined && !event.historical) {
      blocks.push({
        kind      : "approval"                                                                   ,
        id        : `approval-${typeof event.requestId}-${String(event.requestId)}-${event.seq}` ,
        requestId : event.requestId                                                              ,
        threadId  : relatedThreadId                                                              ,
        turnId    : relatedTurnId                                                                ,
        method    : event.method                                                                 ,
        summary   : approvalSummary(event.method, params)                                        ,
        supported : event.supported === true                                                     ,
        state     : "open"                                                                       ,
        open      : event.supported === true                                                     ,
      });
    }
    if (event.method.startsWith("approval/") && event.requestId !== undefined) {
      const approval = blocks.find(
        (block): block is Extract<Block, { kind: "approval" }> =>
          block.kind === "approval" && block.supported && block.requestId === event.requestId
      );
      if (approval) {
        approval.state = event.method === "approval/responding" ? "responding" : event.method === "approval/responded" ? "responded" : "uncertain";
        approval.open = false;
      }
    }
  }

  const working          = turn === "starting" || turn === "running" ;
  const restored = events.find((event) => event.method === "conversation/restored" && event.historical);
  const historyTruncated = restored ? object(restored.params).complete !== true : events.length > 0 && events[0]!.seq > 1;
  return {
    blocks           ,
    working          ,
    threadId         ,
    turnId           ,
    transport        ,
    turn             ,
    interrupt        ,
    historyTruncated ,
  };
}

function fileChanges(item: Record<string, unknown>): Extract<Block, { kind: "files" }>["changes"] {
  const changes: Extract<Block, { kind: "files" }>["changes"] = [];
  if (!Array.isArray(item.changes)) return changes;
  for (const value of item.changes) {
    const change = object(value      ) ;
    const path   = string(change.path) ;
    if (!path) continue;
    const diff    = typeof change.diff === "string" ? change.diff : null ;
    const limited = limitOutput(diff ?? "")                              ;
    changes.push({ path, diff: diff === null ? null : limited.output, truncated: limited.truncated });
  }
  return changes;
}

function approvalSummary(method: string, params: Record<string, unknown>): string {
  if (params.duplicateRequestId === true                ) return "중복된 승인 ID를 수신해 응답하지 않았습니다.";
  if (method === "item/commandExecution/requestApproval") return string(params.command) || string(params.reason) || "명령 실행 요청";
  if (method === "item/fileChange/requestApproval"      ) return string(params.reason) || `파일 변경 요청: ${string(params.itemId)}`;
  return `지원하지 않는 구조화 요청: ${method}`;
}
