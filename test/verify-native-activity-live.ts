// 명시 실행하는 실제 설치 Native의 읽기 전용 활동 관측 검사다.
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonRpcClient, type RpcMessage } from "../src/rpc";
import { resolveNativeCodex } from "../src/native-command";
import { projectNativeActivity } from "../src/native-activity";
import type { AppEvent } from "../src/shared";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const root = process.cwd();

await fs.mkdir(path.join(root, ".www/evidence"), { recursive: true });
const directory = await fs.mkdtemp(path.join(root, ".www/evidence/native-activity-live-"));



const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "www-native-activity-"));



const skillDirectory = path.join(workspace, "skills/activity-observation");
await fs.mkdir(skillDirectory, { recursive: true });
const skillPath = path.join(skillDirectory, "SKILL.md");
await fs.writeFile(skillPath, "# 활동 관측 검사\n이 문서를 읽은 뒤 공개 답변을 ACTIVITY_READ_OK 한 줄로 끝낸다. 다른 파일은 변경하지 않는다.\n");
const child = spawn(resolveNativeCodex(), ["app-server"], { cwd: workspace, stdio: ["pipe", "pipe", "pipe"] });



const rpc = new JsonRpcClient(child);



const events: AppEvent[] = [];


let turnId: string | null = null;


let completed = false;


let connectionError: Error | null = null;


let hookCount = 0;


let commandRead = false;


const startedAt = Date.now();

function event(method: string, params: unknown): void {
  events.push({ seq: events.length + 1, at: new Date().toISOString(), kind: "notification", method, params });
}

rpc.on("message", (message: RpcMessage) => {
  if (typeof message.method !== "string") return;
  if (typeof message.id === "number" || typeof message.id === "string") {
    void rpc.respond(message.id, { decision: "decline" }).catch(() => {});
    return;
  }
  if (message.method === "hook/started" || message.method === "hook/completed") hookCount += 1;
  const params = object(message.params) ? message.params : {};


  const item = object(params.item) ? params.item : {};
  if (item.type === "reasoning") return;
  if (item.type === "commandExecution" && Array.isArray(item.commandActions)) {
    commandRead ||= item.commandActions.some((action: unknown) => object(action) && action.type === "read" && action.path === skillPath);
  }
  if (["turn/started", "turn/completed", "item/started", "item/completed", "thread/tokenUsage/updated", "turn/plan/updated", "model/rerouted", "hook/started", "hook/completed"].includes(message.method)) event(message.method, params);
  if (message.method === "turn/completed") completed = true;
});
rpc.on("closed", (error: Error) => { if (!completed) connectionError = error; });
rpc.on("protocolError", () => { connectionError = new Error("실제 Native에서 JSON 프레임 오류가 발생했습니다."); });
const timeout = setTimeout(() => { connectionError = new Error("실제 Native 관측이 120초를 초과했습니다."); child.kill("SIGKILL"); }, 120_000);

try {
  await rpc.request("initialize", { clientInfo: { name: "www_activity_live_check", version: "0.1.0" }, capabilities: { experimentalApi: false } });
  rpc.notify("initialized", {});
  const response = await rpc.request("thread/start", { cwd: workspace, approvalPolicy: "never", sandbox: "read-only", ephemeral: true });
  if (!object(response) || !object(response.thread) || typeof response.thread.id !== "string") throw new Error("실제 Native thread 응답이 없습니다.");
  const threadId = response.thread.id;
  event("thread/configured", { threadId, model: response.model, modelProvider: response.modelProvider, isNew: true });
  const prompt = "읽기 전용 활동 표시 검사다. 셸로 정확히 cat " + JSON.stringify(skillPath) + " 를 실행해서 문서 내용을 읽고, ACTIVITY_READ_OK 한 줄로 답하라. 다른 도구·파일 변경·네트워크 작업은 하지 마라.";
  event("turn/userPrompt", { threadId, clientRequestId: "live-observation", text: prompt });
  const started = await rpc.request("turn/start", { threadId, effort: "low", input: [{ type: "text", text: prompt }] });
  if (!object(started) || !object(started.turn) || typeof started.turn.id !== "string") throw new Error("실제 Native turn 응답이 없습니다.");
  turnId = started.turn.id;
  event("turn/startAccepted", { threadId, turnId, clientRequestId: "live-observation" });
  while (!completed && !connectionError) await new Promise<void>((resolve) => setTimeout(resolve, 50));
  if (connectionError) throw connectionError;
  const projection = projectNativeActivity(events, threadId);


  const selected = projection.turns.find((turn) => turn.turnId === turnId);


  const checks = { publicAnswer: selected?.answer?.includes("ACTIVITY_READ_OK") === true, usageObserved: (projection.usage?.totalTokens ?? 0) > 0, modelObserved: !!selected?.model?.name, commandReadObserved: commandRead, skillReadProjected: selected?.entries.some((entry) => entry.kind === "skill" && entry.source === "file_read") === true };


  const summary = { executor: "actual-installed-native-read-only", result: Object.values(checks).every(Boolean) ? "passed" : "failed", elapsedMs: Date.now() - startedAt, checks, model: selected?.model ?? null, usage: projection.usage, hookNotifications: hookCount, limitations: ["한 번의 실제 설치 Native 읽기 관측이며 일반 모델 품질이나 UI 검증을 뜻하지 않습니다.", ...(hookCount === 0 ? ["실제 hook 알림은 관측되지 않았습니다. 합성 fixture hook 검증과 구분합니다."] : [])] };
  await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ evidence: path.relative(root, directory), ...summary }));
  if (summary.result !== "passed") process.exitCode = 1;
} catch (error) {
  const summary = { executor: "actual-installed-native-read-only", result: "failed", elapsedMs: Date.now() - startedAt, error: error instanceof Error ? error.name : "unknown", limitation: "원본 프로토콜·reasoning·stderr·계정 정보는 파일에 저장하지 않았습니다." };
  await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2));
  console.error(JSON.stringify({ evidence: path.relative(root, directory), ...summary }));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  child.kill("SIGTERM");
  const forced = setTimeout(() => child.kill("SIGKILL"), 3000);
  await new Promise<void>((resolve) => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once("close", () => resolve()); });
  clearTimeout(forced);
  await fs.rm(workspace, { recursive: true, force: true });
}
