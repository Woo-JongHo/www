/**
 * @architecture arch.chat.activity.projection
 * @implements RESP-CHAT-ACTIVITY-PROJECTION
 */
import { projectNativeActivity, type ActivityTurn, type PlanStep } from "./native-activity";
import type { AppEvent } from "./shared";

export const WWW_AGENT_SKILLS = [
  { id: "www-spec", name: "spec", label: "명세" },
  { id: "www-design", name: "design", label: "설계" },
  { id: "www-build", name: "build", label: "구현" },
  { id: "www-diagnose", name: "diagnose", label: "진단" },
  { id: "www-verify", name: "verify", label: "검증" },
] as const;

type SkillId = typeof WWW_AGENT_SKILLS[number]["id"];
type AgentStatus = "pending" | "running" | "completed" | "failed" | "interrupted" | "unknown";
type AgentBoundary = "open" | "uncertain" | "settled";
interface Subagent {
  id: string;
  parentId: string | null;
  path: string | null;
  status: AgentStatus;
  message: string | null;
  model: string | null;
  historical: boolean;
}
export interface AgentOverviewProjection {
  threadId: string | null;
  current: ActivityTurn | null;
  selectedSkillId: SkillId | null;
  selectionBasis: string | null;
  skills: { id: SkillId; name: string; label: string; observed: boolean; selected: boolean; basis: string | null }[];
  subagents: Subagent[];
  plan: PlanStep[];
  activePlanIndex: number | null;
  progress: { text: string; planIndex: number; source: "commentary" | "plan-explanation"; at: string } | null;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function agentStatus(value: unknown): AgentStatus {
  switch (value) {
    case "pendingInit": return "pending";
    case "running": return "running";
    case "completed": return "completed";
    case "errored": return "failed";
    case "interrupted": case "shutdown": return "interrupted";
    default: return "unknown";
  }
}
function activeIndex(plan: PlanStep[]): number | null {
  const indexes = plan.flatMap((step, index) => step.status === "inProgress" ? [index] : []);
  return indexes.length === 1 ? indexes[0] ?? null : null;
}

/** 공개 이벤트의 근거만 사용해 WWW 개요를 만든다. */
export function projectAgentOverview(events: readonly AppEvent[], threadId: string | null, workspacePath?: string): AgentOverviewProjection {
  const native = projectNativeActivity(events, threadId, workspacePath);
  const current = threadId ? native.turns.at(-1) ?? null : null;
  const live = current && !current.historical && !current.endedAt && ["running", "pending", "blocked"].includes(current.status);
  const requested = live ? current.entries.filter((entry) => entry.source === "request" && entry.wwwArtifact?.kind === "skill") : [];
  const selectedSkills = WWW_AGENT_SKILLS.filter((skill) => requested.some((entry) => entry.wwwArtifact?.id === skill.id));
  const selectedSkillId = selectedSkills.length === 1 ? selectedSkills[0]?.id ?? null : null;
  const selectionBasis = selectedSkillId ? "구조화된 Skill 요청" : null;
  const skills = WWW_AGENT_SKILLS.map((skill) => {
    const observations = current?.entries.filter((entry) => entry.wwwArtifact?.id === skill.id && (entry.source === "file_read" || entry.source === "command_reference")) ?? [];
    const basis = observations.some((entry) => entry.source === "file_read") ? "구조화된 문서 읽기 관측 · 적용 미확인" : observations.length ? "명령의 문서 참조 · 읽기·적용 미확인" : null;
    return { ...skill, observed: observations.length > 0, selected: skill.id === selectedSkillId, basis: skill.id === selectedSkillId ? selectionBasis : basis };
  });
  const agents = new Map<string, Subagent>();
  const boundaries = new Map<string, AgentBoundary>();
  const operations = new Set<string>();
  let transportClosed = false;
  // 두 Native 표면에 같은 규칙을 적용한다. 작업 결과와 연결 가시성 종료를 구분한다.
  const observeAgent = (agent: Subagent, status: AgentStatus, conclusive: boolean, historical: boolean, newOperation = false, visibilityClosed = false): boolean => {
    let boundary = boundaries.get(agent.id) ?? (transportClosed ? "uncertain" : "open");
    if (newOperation) { boundary = "open"; agent.message = null; }
    if (boundary === "settled" || (boundary === "uncertain" && !conclusive)) {
      boundaries.set(agent.id, boundary);
      return false;
    }
    if (historical && (status === "running" || status === "pending")) {
      status = "unknown";
      boundary = "uncertain";
    }
    if (visibilityClosed) boundary = "uncertain";
    agent.status = status;
    agent.historical = historical;
    if (conclusive) agent.message = null;
    boundaries.set(agent.id, conclusive ? "settled" : boundary);
    return true;
  };
  let plan: PlanStep[] = [];
  let progress: AgentOverviewProjection["progress"] = null;
  let progressKey = "";
  let progressEpoch = 0;
  let messageId = "";
  const messageKeys = new Map<string, string>();
  const completedMessages = new Set<string>();
  const messageBodies = new Set<string>();
  const seen = new Set<number>();
  for (const event of [...events].sort((a, b) => a.seq - b.seq).slice(-2_000)) {
    if (seen.has(event.seq)) continue;
    seen.add(event.seq);
    if (event.method === "transport/connected") {
      if (!event.historical) transportClosed = false;
      continue;
    }
    if (event.method === "transport/closed") {
      if (!event.historical) {
        transportClosed = true;
        for (const agent of agents.values()) if (boundaries.get(agent.id) !== "settled") {
          agent.status = "unknown";
          agent.message = null;
          boundaries.set(agent.id, "uncertain");
        }
      }
      continue;
    }
    const data = record(event.params);
    if (!threadId || text(data.threadId) !== threadId) continue;
    if (event.kind !== "notification") continue;
    const item = record(data.item);
    if ((event.method === "item/started" || event.method === "item/completed") && item.type === "collabAgentToolCall" && text(item.senderThreadId) === threadId) {
      const states = record(item.agentsStates);
      const receivers = Array.isArray(item.receiverThreadIds) ? item.receiverThreadIds.filter((id): id is string => typeof id === "string" && !!id) : [];
      for (const id of new Set(receivers)) {
        const state = record(states[id]);
        const existing = agents.get(id);
        const agent: Subagent = existing ?? { id, parentId: threadId, path: null, status: "unknown", message: null, model: null, historical: event.historical === true };
        const explicit = text(state.status);
        const operationKey = JSON.stringify([text(item.id), id]);
        const workOperation = !!text(item.id) && ["spawnAgent", "sendInput", "resumeAgent", "followupTask"].includes(text(item.tool));
        const newOperation = workOperation && !operations.has(operationKey) && !event.historical && !transportClosed;
        if (workOperation) operations.add(operationKey);
        const reopening = newOperation && !!existing && boundaries.get(id) !== "open";
        // started의 agentsStates는 마지막 상태다. 새 작업을 이전 결과로 완료시키지 않는다.
        const priorResult = reopening && event.method === "item/started" && !["running", "pendingInit"].includes(explicit);
        const conclusive = !priorResult && ["completed", "errored", "interrupted"].includes(explicit);
        const status = priorResult ? "pending" : explicit ? agentStatus(explicit)
          : event.method === "item/completed" && item.status === "failed" ? "unknown"
          : newOperation || (!existing && event.method === "item/started") ? "pending" : agent.status;
        if (observeAgent(agent, status, conclusive, event.historical === true, newOperation, !priorResult && ["shutdown", "notFound"].includes(explicit))) {
          agent.parentId = threadId;
          if (!priorResult) agent.message = text(state.message) || agent.message;
        }
        agents.set(id, agent);
      }
    }
    if ((event.method === "item/started" || event.method === "item/completed") && item.type === "subAgentActivity") {
      const id = text(item.agentThreadId);
      if (id && id !== threadId) {
        const agent: Subagent = agents.get(id) ?? { id, parentId: null, path: null, status: "unknown", message: null, model: null, historical: event.historical === true };
        const kind = text(item.kind);
        const conclusive = kind === "completed" || kind === "interrupted";
        const status = kind === "completed" ? "completed" : kind === "interrupted" ? "interrupted"
          : kind === "started" || kind === "interacted" ? "running" : agent.status;
        if (observeAgent(agent, status, conclusive, event.historical === true)) {
          agent.path = text(item.agentPath) || agent.path;
          agent.model = text(item.model) || agent.model;
        }
        // 결과 경계가 닫혀도 처음 제공된 실제 식별 정보는 보존한다.
        agent.path ??= text(item.agentPath) || null;
        agent.model ??= text(item.model) || null;
        agents.set(id, agent);
      }
    }
    if (!current?.turnId || text(data.turnId) !== current.turnId) continue;
    if (current.endedSeq !== null && event.seq > current.endedSeq) continue;
    if (event.method === "turn/plan/updated") {
      plan = Array.isArray(data.plan) ? data.plan.flatMap((value): PlanStep[] => {
        const row = record(value);
        return text(row.step) && (row.status === "pending" || row.status === "inProgress" || row.status === "completed") ? [{ step: text(row.step), status: row.status }] : [];
      }) : [];
      const index = activeIndex(plan);
      const key = index === null ? "" : `${index}:${plan[index]?.step}`;
      if (key !== progressKey) { progress = null; messageId = ""; progressEpoch++; }
      progressKey = key;
      if (index !== null && text(data.explanation)) { progress = { text: text(data.explanation), planIndex: index, source: "plan-explanation", at: event.at }; messageId = ""; }
      continue;
    }
    const index = activeIndex(plan);
    const commentaryId = event.method === "item/agentMessage/delta" && data.phase === "commentary" ? text(data.itemId)
      : (event.method === "item/started" || event.method === "item/completed") && item.type === "agentMessage" && item.phase === "commentary" ? text(item.id) : "";
    if (commentaryId && completedMessages.has(commentaryId) && event.method !== "item/completed") continue;
    if (commentaryId && messageBodies.has(commentaryId) && event.method === "item/started") continue;
    if (commentaryId && event.method === "item/completed") completedMessages.add(commentaryId);
    const contextKey = progressKey ? `${progressEpoch}:${progressKey}` : "";
    if (commentaryId && !messageKeys.has(commentaryId)) messageKeys.set(commentaryId, contextKey);
    if (index === null || !progressKey) continue;
    if (event.method === "item/agentMessage/delta" && data.phase === "commentary" && text(data.delta) && text(data.itemId)) {
      const id = text(data.itemId);
      if (messageKeys.get(id) !== contextKey) continue;
      const prior = messageId === id && progress?.source === "commentary" ? progress.text : "";
      progress = { text: prior + text(data.delta), planIndex: index, source: "commentary", at: event.at };
      messageId = id;
      messageBodies.add(id);
    } else if ((event.method === "item/started" || event.method === "item/completed") && item.type === "agentMessage" && item.phase === "commentary" && typeof item.text === "string") {
      const id = text(item.id);
      if (!id || messageKeys.get(id) !== contextKey) continue;
      if (item.text) {
        progress = { text: item.text, planIndex: index, source: "commentary", at: event.at };
        messageId = id;
        messageBodies.add(id);
      } else if (event.method === "item/completed" && messageId === id && progress?.source === "commentary") {
        progress = null;
        messageId = "";
      }
    }
  }
  const finalPlan = current?.plan ?? [];
  const activePlanIndex = activeIndex(finalPlan);
  return { threadId, current, selectedSkillId, selectionBasis, skills, subagents: [...agents.values()], plan: finalPlan, activePlanIndex, progress: activePlanIndex === null ? null : progress };
}
