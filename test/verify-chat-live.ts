// 명시 실행 전용: 실제 인증과 모델 사용량을 사용하는 읽기 전용 재개 검사.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { JsonRpcClient, type RpcMessage } from "../src/rpc";
import { resolveNativeCodex } from "../src/native-command";
import { createConversationService } from "../src/conversations";
import { project } from "../src/projection";

interface Session {
  child   : ChildProcessWithoutNullStreams ;
  rpc     : JsonRpcClient                  ;
  answers : Map<string, string>            ;
  ended   : Map<string, string>            ;
  failure : Error | null                  ;
  tools   : number                        ;
  hooks   : number                        ;
}

const expected = "CHAT_RESUME_OK";
const directory = path.join(process.cwd(), ".www/evidence/work-baa0963b-ea71-48e7-a34f-0d229ba704b1");
const workspace = path.join(directory, "live-workspace");
const summary = {
  startedAt: new Date().toISOString(), completedAt: "", outcome: "running", stage: "prepare", failureKind: "",
  configuredModel: "", threadIdHash: "", firstAnswerExact: false, firstTurnEnded: false, firstProcessEnded: false,
  persistedListed: false, sameThreadResumed: false, publicRestored: false, followupExact: false,
  secondTurnEnded: false, toolAttempts: 0, hookEvents: 0
};
const sessions: Session[] = [];
let active: Session | null = null;
let expired = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new Error("PROTOCOL_SHAPE");
  return value;
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function requireId(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("PROTOCOL_ID");
  return value;
}

function startSession(): Session {
  const child = spawn(resolveNativeCodex(), ["app-server"], { cwd: workspace, stdio: ["pipe", "pipe", "pipe"] });
  const rpc = new JsonRpcClient(child);
  const session: Session = { child, rpc, answers: new Map(), ended: new Map(), failure: null, tools: 0, hooks: 0 };
  sessions.push(session);
  rpc.on("message", (message: RpcMessage) => {
    const method = text(message.method);
    const params = object(message.params) ? message.params : {};
    const item = object(params.item) ? params.item : {};
    const turn = object(params.turn) ? params.turn : {};
    const turnId = text(params.turnId) || text(turn.id);
    if (method === "hook/started" || method === "hook/completed") session.hooks += 1;
    const request = typeof message.id === "number" || typeof message.id === "string";
    const tool = method === "item/started" && ["commandExecution", "fileChange", "mcpToolCall", "dynamicToolCall", "webSearch"].includes(text(item.type));
    if (request || tool) {
      session.tools += 1;
      session.failure = new Error("TOOLS_FORBIDDEN");
      child.kill("SIGTERM");
      return;
    }
    if (method === "item/completed" && item.type === "agentMessage" && item.phase !== "analysis" && typeof item.text === "string" && turnId) session.answers.set(turnId, item.text.trim());
    if (method === "turn/completed" && turnId) session.ended.set(turnId, text(turn.status));
  });
  rpc.on("protocolError", () => { session.failure = new Error("PROTOCOL_FRAME"); });
  rpc.on("closed", (error: Error) => { session.failure ??= error; });
  return session;
}

async function initialize(session: Session): Promise<void> {
  await session.rpc.request("initialize", { clientInfo: { name: "www", version: "0.1.0" }, capabilities: { experimentalApi: false } });
  session.rpc.notify("initialized", {});
}

async function ask(session: Session, threadId: string, prompt: string): Promise<{ exact: boolean; ended: boolean }> {
  const response = record(await session.rpc.request("turn/start", { threadId, input: [{ type: "text", text: prompt }] }));
  const turnId = requireId(record(response.turn).id);
  while (!session.ended.has(turnId)) {
    if (expired) throw new Error("CHECK_TIMEOUT");
    if (session.failure) throw session.failure;
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
  }
  if (session.failure) throw session.failure;
  return { exact: session.answers.get(turnId) === expected, ended: session.ended.get(turnId) === "completed" };
}

async function stopSession(session: Session): Promise<boolean> {
  if (session.child.exitCode !== null || session.child.signalCode !== null) return false;
  return new Promise<boolean>((resolve) => {
    const stopped = setTimeout(() => { session.child.kill("SIGTERM"); resolve(false); }, 5000);
    session.child.once("exit", (code, signal) => { clearTimeout(stopped); resolve(code === 0 && signal === null); });
    session.child.stdin.end();
  });
}

function failureKind(error: unknown): string {
  if (expired) return "timeout";
  const value = error instanceof Error ? error.message : "";
  if (/TOOLS_FORBIDDEN/.test(value)) return "tool_attempt";
  if (/auth|unauthorized|login|credential|401/i.test(value)) return "authentication";
  if (/quota|usage.limit|rate.limit|429/i.test(value)) return "quota";
  if (/network|connect|tls|socket|fetch|dns|timeout/i.test(value)) return "network";
  if (/PROTOCOL|shape|frame/i.test(value)) return "protocol";
  return "verification";
}

try {
  await fs.mkdir(workspace, { recursive: true });
  timer = setTimeout(() => { expired = true; active?.child.kill("SIGTERM"); }, 120_000);
  summary.stage = "first_process_initialize";
  active = startSession();
  await initialize(active);
  summary.stage = "persistent_thread_start";
  const started = record(await active.rpc.request("thread/start", {
    cwd: workspace, approvalPolicy: "never", sandbox: "read-only", ephemeral: false,
    developerInstructions: "읽기 전용 대화 재개 검증입니다. 도구 호출·명령 실행·파일 읽기나 변경·네트워크 요청 없이 사용자의 짧은 질문에 답하세요."
  }));
  const threadId = requireId(record(started.thread).id);
  summary.threadIdHash = createHash("sha256").update(threadId).digest("hex").slice(0, 16);
  summary.configuredModel = text(started.model).replace(/[^a-zA-Z0-9._:/-]/g, "").slice(0, 120);
  summary.stage = "first_model_turn";
  const first = await ask(active, threadId, "이 대화의 확인단어는 CHAT_RESUME_OK입니다. 도구를 사용하지 말고 확인단어만 답하세요.");
  summary.firstAnswerExact = first.exact;
  summary.firstTurnEnded = first.ended;
  if (!first.exact || !first.ended) throw new Error("FIRST_ANSWER_MISMATCH");
  summary.stage = "first_process_normal_exit";
  summary.firstProcessEnded = await stopSession(active);
  if (!summary.firstProcessEnded) throw new Error("FIRST_PROCESS_NOT_GRACEFUL");
  active = null;
  summary.stage = "second_process_initialize";
  active = startSession();
  await initialize(active);
  summary.stage = "persisted_list";
  const service = createConversationService(active.rpc, workspace);
  const catalog = await service.list();
  summary.persistedListed = catalog.threads.some((thread) => thread.id === threadId);
  if (!summary.persistedListed) throw new Error("PERSISTED_THREAD_NOT_LISTED");
  summary.stage = "same_thread_resume";
  const opened = await service.open(threadId);
  summary.sameThreadResumed = opened.threadId === threadId;
  const blocks = project(opened.events.map((event, index) => ({ ...event, seq: index + 1, at: summary.startedAt }))).blocks;
  summary.publicRestored = blocks.some((block) => block.kind === "answer" && block.text.trim() === expected);
  if (!summary.sameThreadResumed || !summary.publicRestored) throw new Error("PUBLIC_HISTORY_NOT_RESTORED");
  summary.stage = "followup_model_turn";
  const second = await ask(active, opened.threadId, "도구를 사용하지 말고 이 대화의 확인단어만 답하세요.");
  summary.followupExact = second.exact;
  summary.secondTurnEnded = second.ended;
  if (!second.exact || !second.ended) throw new Error("FOLLOWUP_CONTEXT_MISMATCH");
  summary.stage = "second_process_normal_exit";
  if (!await stopSession(active)) throw new Error("SECOND_PROCESS_NOT_GRACEFUL");
  active = null;
  summary.stage = "complete";
  summary.outcome = "passed";
} catch (error) {
  summary.outcome = "failed";
  summary.failureKind = failureKind(error);
  process.exitCode = 1;
} finally {
  if (timer) clearTimeout(timer);
  active?.child.kill("SIGTERM");
  summary.toolAttempts = sessions.reduce((total, session) => total + session.tools, 0);
  summary.hookEvents = sessions.reduce((total, session) => total + session.hooks, 0);
  summary.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(directory, "chat-native-live.json"), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(summary));
}
