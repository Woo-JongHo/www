#!/usr/bin/env node
// 실제 Native 대신 동결된 subprocess에 합성 활동 알림을 덧붙이는 검증 fixture다.
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const child = spawn(process.execPath, [fileURLToPath(new URL("./fake-app-server.ts", import.meta.url)), ...process.argv.slice(2)], { stdio: ["pipe", "pipe", "pipe"] });


const threadRequests = new Set<unknown>();


let turns = 0;


let turnId = "turn-fixture";


const threadId = "thread-fixture";
const fixtureWorkspace = process.env.WWW_PROBE_WORKSPACE ?? "/fixture";


let catalogCwd = process.env.WWW_PROBE_WORKSPACE ?? "/fixture";


let skillsListRequests = 0;


let pendingSkillsRequest: Record<string, unknown> | null = null;


let lateRestoreHookSent = false;
const pendingActivityApprovals = new Map<string | number, { threadId: string; turnId: string }>();


const send = (message: unknown): void => { process.stdout.write(`${JSON.stringify(message)}\n`); };


const notify = (method: string, params: Record<string, unknown>): void => send({ jsonrpc: "2.0", method, params });

// 별도 관측 시나리오: main의 등록·검증·응답 왕복을 검사한다. 실제 모델은 호출하지 않는다.
const stageProbe = process.env.WWW_STAGE_PROBE === "1";
const stageThread = `stage-thread-${process.pid}`;
const stageRestoredThread = "stage-probe-restored";
const stageWork = process.env.WWW_STAGE_WORK_ID ?? "work-36d312bc-a767-4e3e-a581-01898b35f75f";
let stageRegistered = false;
let planRegistered = false;
let stageTurn = "";
let stagePrompt = "";
let stageCalls: Record<string, unknown>[] = [];
let stageCallIndex = 0;
let stageCall: Record<string, unknown> | undefined;
let harnessEventId: string | undefined;
function nextStageCall(): void {
  stageCall = stageCalls.shift();
  if (stageCall) send({ jsonrpc: "2.0", id: `stage-request-${++stageCallIndex}`, method: "item/tool/call", params: stageCall });
  else if (!stagePrompt.includes("유지")) notify("turn/completed", { threadId: stageThread, turn: { id: stageTurn, status: "completed" } });
}
function stageMessage(message: Record<string, unknown>): void {
  const params = object(message.params) ? message.params : {};
  if (message.method === "initialize") {
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    notify("fixture/stageInitialized", { experimentalApi: object(params.capabilities) && params.capabilities.experimentalApi === true });
  } else if (message.method === "thread/start") {
    if (typeof params.cwd === "string") catalogCwd = params.cwd;
    stageRegistered = Array.isArray(params.dynamicTools) && params.dynamicTools.some(tool => object(tool) && tool.name === "www_development_stage");
    planRegistered = Array.isArray(params.dynamicTools) && params.dynamicTools.some(tool => object(tool) && tool.name === "www_link_plan");
    send({ jsonrpc: "2.0", id: message.id, result: { thread: { id: stageThread }, model: "fixture" } });
    notify("fixture/stageRegistered", { threadId: stageThread, registered: stageRegistered });
  } else if (message.method === "thread/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { data: [{
      id: stageRestoredThread, cwd: catalogCwd, originator: "www", source: "vscode", status: { type: "idle" },
      name: "복원 관측 표본", preview: "이전 대화의 공개 설명", updatedAt: Math.floor(Date.now() / 1000),
    }], nextCursor: null } });
  } else if (message.method === "thread/read" || message.method === "thread/resume") {
    stageRegistered = false;
    planRegistered = false;
    send({ jsonrpc: "2.0", id: message.id, result: { thread: { id: params.threadId, cwd: catalogCwd, originator: "www", status: { type: "idle" }, turns: [] }, model: "fixture" } });
  } else if (message.method === "thread/turns/list") {
    const data = params.threadId === stageRestoredThread ? [{
      id: "stage-probe-restored-turn", status: "completed", items: [{ id: "restored-public-commentary", type: "agentMessage", phase: "commentary", text: "이전 대화의 공개 설명" }],
    }] : [];
    send({ jsonrpc: "2.0", id: message.id, result: { data, nextCursor: null } });
  }
  else if (message.method === "turn/start") {
    stageTurn = `stage-turn-${++turns}`;
    stagePrompt = Array.isArray(params.input) && object(params.input[0]) ? String(params.input[0].text) : "";
    send({ jsonrpc: "2.0", id: message.id, result: { turn: { id: stageTurn } } });
    notify("turn/started", { threadId: params.threadId, turn: { id: stageTurn } });
    notify("item/completed", { threadId: params.threadId, turnId: stageTurn, item: { id: `public-${stageTurn}`, type: "agentMessage", phase: "commentary", text: "계획 없이 현재 단계를 확인하고 있습니다." } });
    if (process.env.WWW_CHAT007_PROBE === "1") {
      const items = [
        { id: "request", type: "userMessage", content: [{ type: "skill", name: "www-spec", path: fixtureWorkspace + "/skills/www/www-spec" }] },
        { id: "read", type: "commandExecution", cwd: fixtureWorkspace, exitCode: 0, commandActions: [{ type: "read", path: fixtureWorkspace + "/skills/www/www-build/SKILL.md" }] },
        { id: "cmd", type: "commandExecution", cwd: fixtureWorkspace, exitCode: 0, command: "cat skills/www/www-design/SKILL.md" },
      ];
      for (const item of items) notify("item/completed", { threadId: params.threadId, turnId: stageTurn, item });
    }
    const input = { workId: stageWork, phase: "build", status: "running", attemptId: "attempt-1" };
    const call = (callId: string, argumentsValue: unknown = input, overrides = {}) => ({ threadId: params.threadId, turnId: stageTurn, callId, tool: "www_development_stage", arguments: argumentsValue, ...overrides });
    stageCalls = stagePrompt.includes("종료지연") ? [call("after-end")] : stagePrompt.includes("유지") ? [call("running")]
      : [call("selected", { ...input, status: "selected" }), call("running"), call("running"), call("completed", { ...input, status: "completed" }),
        call("late-running"), call("unknown-work", { ...input, workId: "work-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
        call("extra-field", { ...input, reasoning: "PRIVATE_REASONING_DO_NOT_RENDER" }), call("foreign-turn", input, { turnId: "other-turn" }),
        call("foreign-thread", input, { threadId: "other-thread" }), call("wrong-namespace", input, { namespace: "other" })];
    if (planRegistered && stagePrompt.includes("계획 문서 연결")) {
      const args = { workId: stageWork, sha256: process.env.WWW_PLAN_PROBE_SHA256 };
      const linked = call("plan-link", args, { tool: "www_link_plan" });
      const foreignWork = call("foreign-work-plan", { workId: process.env.WWW_PLAN_PROBE_OTHER_WORK, sha256: process.env.WWW_PLAN_PROBE_OTHER_SHA256 }, { tool: "www_link_plan" });
      stageCalls.push({ ...linked, callId: "foreign-plan", turnId: "other-turn" }, foreignWork, linked, linked);
      notify("www/planLinked", { threadId: params.threadId, turnId: stageTurn, source: "work_document", ...args, path: "docs/work/Chat/forged/tasks.md", status: "available", content: "FORGED_PLAN" });
      notify("turn/plan/updated", { threadId: params.threadId, turnId: stageTurn, plan: [{ step: "Native 계획 항목", status: "inProgress" }] });
    }
    if (planRegistered && stagePrompt.includes("없는 작업의 계획 확인")) {
      const workId = stagePrompt.split("\n", 1)[0]?.split(" ")[1];
      stageCalls = [call("unavailable-plan", { workId, sha256: process.env.WWW_PLAN_PROBE_SHA256 }, { tool: "www_link_plan" })];
    }
    if (process.env.WWW_HARNESS_PROBE_OPTIONS) {
      harnessEventId = undefined;
      const attempt = { workId: stageWork, phase: "verify", attemptId: "harness-sample" };
      const observe = (id: string, overrides = {}) => call(id, attempt, { tool: "www_observe_harness", ...overrides });
      stageCalls = [
        call("harness-start", { ...attempt, status: "running" }),
        observe("before-process"),
        observe("outside-turn", { turnId: "another-turn" }),
        observe("confirm-process"),
        observe("repeat-process"),
      ];
      notify("www/harnessObserved", { threadId: params.threadId, turnId: stageTurn, source: "workflow_receipt", ...attempt, outcome: "failed", completedAt: new Date().toISOString() });
    }
    // 동명 알림을 main 검증 사건으로 오인해서는 안 된다.
    notify("www/developmentStage", { threadId: params.threadId, turnId: stageTurn, source: "role_declaration", ...input, phase: "verify" });
    if (stagePrompt.includes("종료지연")) notify("turn/completed", { threadId: params.threadId, turn: { id: stageTurn, status: "completed" } });
    nextStageCall();
  } else if (message.method === "turn/steer") {
    const input = Array.isArray(params.input) && object(params.input[0]) ? String(params.input[0].text) : "";
    if (input.includes("합성 추가 지시 거절")) {
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: "합성 추가 지시 거절" } });
      return;
    }
    const steerTurn = input.includes("합성 추가 지시 접수 미확인") ? "unconfirmed-turn" : stageTurn;
    send({ jsonrpc: "2.0", id: message.id, result: { turnId: steerTurn } });
    if (input === "관측 검증 이력 절단") {
      for (let index = 0; index < 2_050; index++) notify("fixture/stageOverflow", { threadId: params.threadId, turnId: stageTurn, index });
    }
    if (planRegistered && input.startsWith("/plan ") && !input.includes("도구 미호출 표본")) {
      const otherWorkId = process.env.WWW_PLAN_PROBE_OTHER_WORK;
      const foreign = otherWorkId !== undefined && input.includes(otherWorkId);
      const workId = foreign ? otherWorkId : stageWork;
      const sha256 = foreign ? process.env.WWW_PLAN_PROBE_OTHER_SHA256 : process.env.WWW_PLAN_PROBE_SHA256;
      stageCalls.push({ threadId: params.threadId, turnId: stageTurn, callId: params.clientUserMessageId, tool: "www_link_plan", arguments: { workId, sha256 } });
      nextStageCall();
    }
  } else if (!message.method && typeof message.id === "string" && message.id.startsWith("stage-request-")) {
    const result = object(message.result) ? message.result : {};
    const callId = stageCall?.callId;
    notify("fixture/stageResponse", { threadId: stageThread, turnId: stageTurn, success: result.success === true, callId });
    if (callId === "harness-start") harnessEventId = JSON.stringify(result.contentItems).match(/www-chat-[0-9a-f-]{36}/)?.[0];
    if (callId === "before-process" && harnessEventId && process.env.WWW_HARNESS_PROBE_OPTIONS && process.env.WWW_HARNESS_PROBE_ENTRY) {
      const options = JSON.parse(process.env.WWW_HARNESS_PROBE_OPTIONS);
      const args = [process.env.WWW_HARNESS_PROBE_ENTRY, JSON.stringify({ ...options, eventId: harnessEventId })];
      const first = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
      const second = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
      notify("fixture/harnessProcess", { threadId: stageThread, turnId: stageTurn, exitCode: first.status, duplicateExit: second.status, duplicateRejected: second.stderr?.includes("이미 사용한 대화 단계 실행 ID") === true });
    }
    nextStageCall();
  } else if (message.method === "turn/interrupt") {
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    notify("turn/completed", { threadId: params.threadId, turn: { id: stageTurn, status: "interrupted" } });
  } else if (message.id !== undefined) send({ jsonrpc: "2.0", id: message.id, result: {} });
}


function skillsResult(id: unknown, cwd: string, names: readonly string[]): void {
  send({ jsonrpc: "2.0", id, result: { data: [{ cwd, errors: [], skills: names.map((name) => ({
    name,
    path: `/fixture/skills/${name === "unused-skill" ? "unused" : name}/SKILL.md`,
    enabled: true,
    scope: name === "unused-skill" ? "user" : "repo",
    description: "fixture",
  })) }] } });
}

function hook(id: string, eventName: string, scoped: boolean): void {
  const startedAt = Math.floor(Date.now() / 1000);


  const run = { id, eventName, handlerType: "command", scope: scoped ? "turn" : "thread", executionMode: "sync", source: "project", sourcePath: "/fixture/hooks.json", startedAt, displayOrder: 1, entries: [] };


  const params = scoped ? { threadId, turnId } : { threadId };
  notify("hook/started", { ...params, run: { ...run, status: "running" } });
  notify("hook/completed", { ...params, run: { ...run, status: eventName === "preToolUse" ? "failed" : "completed", entries: eventName === "preToolUse" ? [{ kind: "error", text: "plugin contents changed; hook approval required" }] : [], completedAt: startedAt, durationMs: 12 } });
}

function injectActivity(): void {
  notify("turn/plan/updated", { threadId, turnId, plan: [{ step: "자료 확인", status: "completed" }, { step: "구현·검사", status: "inProgress" }, { step: "답변 정리", status: "pending" }] });
  hook(`hook-${turnId}`, "preToolUse", true);
  const command = `cat ${fixtureWorkspace}/skills/www/www-design/SKILL.md`;


  const commandActions = [{ type: "read", path: "/fixture/skills/www-design/SKILL.md", name: "SKILL.md", command }];
  if (turns > 1) commandActions.push({ type: "read", path: "/fixture/skills/unused/SKILL.md", name: "SKILL.md", command });
  commandActions.push({ type: "read", path: `${fixtureWorkspace}/skills/www/www-design/SKILL.md`, name: "SKILL.md", command });
  const item = { id: `skill-${turnId}`, type: "commandExecution", command, cwd: fixtureWorkspace, commandActions };
  notify("item/started", { threadId, turnId, item: { ...item, status: "inProgress" } });
  notify("item/completed", { threadId, turnId, item: { ...item, status: "completed", exitCode: 0 } });
  const role = { id: `role-${turnId}`, type: "commandExecution", command: "cat AGENTS.md agents/www/AGENT.md", cwd: fixtureWorkspace, commandActions: [{ type: "unknown", command: "cat AGENTS.md agents/www/AGENT.md" }] };
  notify("item/started", { threadId, turnId, item: { ...role, status: "inProgress" } });
  notify("item/completed", { threadId, turnId, item: { ...role, status: "completed", exitCode: 0 } });
  notify("item/completed", { threadId, turnId, item: { id: `private-${turnId}`, type: "reasoning", summary: ["공개 요약: 작업 흐름과 확인한 결과를 정리했습니다."], content: ["PRIVATE_REASONING_DO_NOT_RENDER"] } });
  const first = { inputTokens: 800, outputTokens: 200, cachedInputTokens: 200, reasoningOutputTokens: 50, totalTokens: 1000 };


  const total = turns === 1 ? first : { inputTokens: 1400, outputTokens: 600, cachedInputTokens: 300, reasoningOutputTokens: 150, totalTokens: 2000 };


  const last = turns === 1 ? first : { inputTokens: 600, outputTokens: 400, cachedInputTokens: 100, reasoningOutputTokens: 100, totalTokens: 1000 };


  const tokenUsage = { total, last, modelContextWindow: 128000 };
  notify("thread/tokenUsage/updated", { threadId, turnId, tokenUsage });
  notify("thread/tokenUsage/updated", { threadId, turnId, tokenUsage });
  if (turns > 1) notify("model/rerouted", { threadId, turnId, fromModel: "fixture-model-a", toModel: "fixture-model-b", reason: "highRiskCyberActivity" });
  if (turns > 1) setTimeout(() => notify("item/started", { threadId, turnId, item: { id: `skill-late-${turnId}`, type: "commandExecution", status: "inProgress", commandActions: [{ type: "read", path: "/fixture/skills/www-design/SKILL.md" }] } }), 730);
}

const input = createInterface({ input: process.stdin });
input.on("line", (line) => {
  const message: unknown = JSON.parse(line);
  if (!object(message)) throw new Error("fixture 요청 객체가 필요합니다.");
  if (stageProbe) { stageMessage(message); return; }
  if (message.method === "skills/list") {
    const params = object(message.params) ? message.params : {};
    const cwd    = Array.isArray(params.cwds) && typeof params.cwds[0] === "string" ? params.cwds[0] : "/fixture";
    catalogCwd = cwd;
    skillsListRequests += 1;
    if (skillsListRequests === 1) {
      pendingSkillsRequest = message;
      notify("skills/changed", { cwd });
      return;
    }
    if (skillsListRequests === 2 && pendingSkillsRequest) {
      notify("fixture/inventoryRequest2Started", { cwd });
      skillsResult(pendingSkillsRequest.id, cwd, ["stale-skill"]);
      pendingSkillsRequest = null;
      setTimeout(() => {
        send({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: "fixture request 2 failed" } });
        notify("fixture/inventoryRequest2Failed", { cwd });
        setTimeout(() => notify("skills/changed", { cwd }), 20);
      }, 80);
      return;
    }
    skillsResult(message.id, cwd, ["www-design", "unused-skill"]);
    notify("fixture/inventoryRaceComplete", { cwd, requests: skillsListRequests });
    return;
  }
  if (message.method === "hooks/list") {
    const params = object(message.params) ? message.params : {};
    const cwd    = Array.isArray(params.cwds) && typeof params.cwds[0] === "string" ? params.cwds[0] : catalogCwd;
    catalogCwd = cwd;
    send({ jsonrpc: "2.0", id: message.id, result: { data: [{ cwd, errors: [], warnings: [], hooks: [
      { key: "session-start", eventName: "sessionStart", sourcePath: "/fixture/hooks.json", displayOrder: 1, handlerType: "command", enabled: true, source: "project", currentHash: "a", isManaged: false, timeoutSec: 5, trustStatus: "trusted", command: "fixture", async: false },
      { key: "pre-tool", eventName: "preToolUse", sourcePath: "/fixture/hooks.json", displayOrder: 1, handlerType: "command", enabled: true, source: "project", currentHash: "b", isManaged: false, timeoutSec: 5, trustStatus: "trusted", command: "fixture", async: false },
    ] }] } });
    return;
  }
  if (message.method === "account/rateLimits/read") {
    const resetsAt = Math.floor(Date.now() / 1000) + 3600;


    const rateLimits = { limitId: "codex", limitName: "fixture 계정", primary: { usedPercent: 25, windowDurationMins: 300, resetsAt }, secondary: { usedPercent: 40, windowDurationMins: 10080, resetsAt } };
    send({ jsonrpc: "2.0", id: message.id, result: { rateLimits, rateLimitsByLimitId: { codex: rateLimits } } });
    return;
  }
  if (message.method === "thread/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { data: [
      { id: threadId, name: "Fixture current", preview: "current", cwd: catalogCwd, updatedAt: 2, status: { type: "idle" }, ephemeral: false, originator: "www" },
      { id: "thread-saved", name: "Fixture saved", preview: "saved", cwd: catalogCwd, updatedAt: 1, status: { type: "idle" }, ephemeral: false, originator: "www" },
    ], nextCursor: null } });
    return;
  }
  if (message.method === "thread/read" || message.method === "thread/resume") {
    const params = object(message.params) ? message.params : {};
    const requestedThread = typeof params.threadId === "string" ? params.threadId : "thread-saved";
    send({ jsonrpc: "2.0", id: message.id, result: {
      thread: { id: requestedThread, cwd: catalogCwd, status: { type: "idle" }, ephemeral: false, originator: "www" },
      model: "fixture-model-a",
      modelProvider: "fixture",
      approvalPolicy: "on-request",
      sandbox: { type: "workspace-write" },
    } });
    return;
  }
  if (message.method === "thread/turns/list") {
    const params = object(message.params) ? message.params : {};
    const requestedThread = typeof params.threadId === "string" ? params.threadId : "thread-saved";
    send({ jsonrpc: "2.0", id: message.id, result: { data: [], nextCursor: null } });
    if (requestedThread === "thread-saved" && !lateRestoreHookSent) {
      lateRestoreHookSent = true;
      setTimeout(() => {
        notify("hook/started", { threadId, run: { id: "hook-session-start", eventName: "sessionStart", handlerType: "command", executionMode: "sync", source: "project", sourcePath: "/fixture/hooks.json", startedAt: Math.floor(Date.now() / 1000), displayOrder: 1, entries: [], status: "running" } });
        notify("fixture/lateHookAfterRestore", { threadId: requestedThread, lateHookThreadId: threadId });
      }, 100);
    }
    return;
  }
  if (message.method === "thread/start") threadRequests.add(message.id);
  if (message.method === "turn/start") {
    turns += 1;
    turnId = turns === 1 ? "turn-fixture" : "turn-activity-2";
  }
  if ((typeof message.id === 'string' || typeof message.id === 'number') && typeof message.method !== 'string') pendingActivityApprovals.delete(message.id);
  child.stdin.write(`${line}\n`);
});
input.on("close", () => child.stdin.end());

createInterface({ input: child.stdout }).on("line", (line) => {
  const message: unknown = JSON.parse(line);
  if (!object(message)) throw new Error("fixture 응답 객체가 필요합니다.");
  if (object(message.params)) {
    if (message.method === "turn/completed" && typeof message.params.threadId !== "string") message.params.threadId = threadId;
    if (message.params.turnId === "turn-fixture") message.params.turnId = turnId;
    if (object(message.params.turn) && message.params.turn.id === "turn-fixture") message.params.turn.id = turnId;
  }
  if (object(message.result)) {
    if (object(message.result.turn) && message.result.turn.id === "turn-fixture") message.result.turn.id = turnId;
    if (threadRequests.delete(message.id)) {
      message.result.model = "fixture-model-a";
      message.result.modelProvider = "fixture";
      if (object(message.result.thread)) message.result.thread.model = "fixture-model-a";
      send(message);
      hook("hook-session-start", "sessionStart", false);
      return;
    }
  }
  if (message.method === 'item/commandExecution/requestApproval' && (typeof message.id === 'string' || typeof message.id === 'number') && object(message.params) && typeof message.params.threadId === 'string' && typeof message.params.turnId === 'string') {
    pendingActivityApprovals.set(message.id, { threadId: message.params.threadId, turnId: message.params.turnId });
  }
  send(message);
  if (message.method === 'turn/completed' && object(message.params) && object(message.params.turn) && message.params.turn.status === 'interrupted') {
    for (const [requestId, approval] of pendingActivityApprovals) {
      if (approval.threadId !== message.params.threadId || approval.turnId !== message.params.turn.id) continue;
      notify('serverRequest/resolved', { threadId: approval.threadId, requestId });
      pendingActivityApprovals.delete(requestId);
    }
  }
  if (message.method === "item/started" && object(message.params) && object(message.params.item) && message.params.item.id === "command-1") injectActivity();
});
child.stderr.pipe(process.stderr);
child.once("error", (error) => { console.error(error.message); process.exitCode = 1; input.close(); });
child.once("close", (code) => { input.close(); process.exitCode = code ?? 1; });
const stop = (): void => { child.kill("SIGTERM"); input.close(); };
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
process.once("exit", () => { child.kill("SIGTERM"); });
