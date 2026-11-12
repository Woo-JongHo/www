import { project } from "./projection";
import type { AppEvent } from "./shared";
import type { NativeReportInput } from "./report-judge";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

function completionIds(events: readonly AppEvent[], completed: AppEvent): { threadId: string; turnId: string } | null {
  const params = object(completed.params) ;
  const turn   = object(params.turn)      ;
  const turnId = params.turnId ?? turn.id ;
  if (typeof turnId !== "string" || !turnId || turnId.length > 200) return null;
  const candidates = [
    ...new Set(
      project(events).blocks
        .filter((block) => block.turnId === turnId && block.threadId)
        .map((block) => block.threadId)
    )
  ];
  const threadId = params.threadId ?? turn.threadId ?? (candidates.length === 1 ? candidates[0] : null);
  if (typeof threadId !== "string" || !threadId || threadId.length > 200) return null;
  return { threadId, turnId };
}

export function completedNativeReportInput(events: readonly AppEvent[], completed: AppEvent): NativeReportInput | null {
  if (completed.method !== "turn/completed")                       return null;
  const ids = completionIds(events, completed);
  if (!ids)                                                        return null;
  const { threadId, turnId } = ids;
  const projection = project(events);
  const blocks = projection.blocks.filter(
    (block) => block.threadId === threadId && block.turnId === turnId
  );
  const prompts = blocks.flatMap((block) => block.kind === "user"                       ? [block.text] : []) ;
  const answers = blocks.flatMap((block) => block.kind === "answer" && !block.streaming ? [block.text] : []) ;
  if (!prompts.length || !answers.some((answer) => answer.trim())) return null;
  const prompt = prompts.join("\n"  ) ;
  const answer = answers.join("\n\n") ;
  const commands = blocks
    .filter((block) => block.kind === "command")
    .slice(-100)
    .map((block) => ({
      command  : block.command.slice(0, 1000) ,
      exitCode : block.exitCode               ,
      status   : block.status
    }));
  const files = [
    ...new Set(
      blocks
        .filter((block) => block.kind === "files")
        .flatMap((block) => block.changes.map((change) => change.path))
    )
  ].slice(0, 100).map((file) => file.slice(0, 400));
  const boundedCommands = commands.slice(-20  ) ;
  const boundedFiles    = files   .slice(0, 30) ;
  const input: NativeReportInput = {
    threadId ,
    turnId   ,
    prompt   : prompt.slice(0, 16_000) ,
    answer   : answer.slice(0, 40_000) ,
    commands : boundedCommands         ,
    files    : boundedFiles            ,
    truncated:
         projection.historyTruncated
      || prompt.length > 16_000
      || answer.length > 40_000
      || commands.length > 20
      || files.length > 30
      || blocks.some((block) =>
        block.kind === "command" && block.command.length > 1000
        || block.kind === "files" && block.changes.some((change) => change.path.length > 400)),
  };
  while (new TextEncoder().encode(JSON.stringify(input)).byteLength > 90_000) {
    input.truncated = true;
    if (input.answer.length) input.answer = input.answer.slice(0, Math.floor(input.answer.length * 0.8));
    else if (input.prompt.length) input.prompt = input.prompt.slice(0, Math.floor(input.prompt.length * 0.8));
    else if (input.commands.length) input.commands.pop();
    else if (input.files.length) input.files.pop();
    else return null;
  }
  return input;
}

export class NativeCompletionCollector {
  private pending = new Map<string, AppEvent>();
  private seen = new Set<string>();

  observe(events: readonly AppEvent[], event: AppEvent): NativeReportInput[] {
    if (!["turn/completed", "turn/startAccepted", "item/completed"].includes(event.method)) return [];
    if (event.method === "turn/completed") {
      const ids = completionIds(events, event);
      if (ids) {
        const { threadId, turnId } = ids;
        const key = JSON.stringify([threadId, turnId]);
        if (!this.seen.has(key)) this.pending.set(key, { ...event, params: { threadId, turn: { id: turnId } } });
      }
    }
    const ready: NativeReportInput[] = [];
    for (const [key, completed] of this.pending) {
      const input = completedNativeReportInput(events, completed);
      if (!input) continue;
      this.pending.delete(key);
      this.seen.add(key);
      ready.push(input);
    }
    while (this.pending.size > 20) {
      const first = this.pending.keys().next().value;
      if (first !== undefined) this.pending.delete(first);
    }
    while (this.seen.size > 2000) {
      const first = this.seen.values().next().value;
      if (first !== undefined) this.seen.delete(first);
    }
    return ready;
  }
}
