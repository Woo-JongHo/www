/**
 * @architecture arch.chat.activity.projection
 * @implements RESP-CHAT-ACTIVITY-PROJECTION
 */
import { projectNativeActivity, type ActivityTurn, type PlanStep } from "./native-activity";
import type { AppEvent } from "./shared";
import { parseWwwDevelopmentStage, type WwwDevelopmentStage } from "./www-activity";

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
  stageConnection: string;
  skills: { id: SkillId; name: string; label: string; observed: boolean; selected: boolean; basis: string | null; declaration: WwwDevelopmentStage | null }[];
  subagents: Subagent[];
  plan: PlanStep[];
  activePlanIndex: number | null;
  planState: "provided" | "empty" | "unprovided" | "invalid";
  historyTruncated: boolean;
  progress: { text: string; planIndex: number | null; source: "commentary" | "plan-explanation"; at: string } | null;
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
  // 선언 자체로 Native 턴을 만들거나 현재 요청을 바꾸지 않는다.
  const native = projectNativeActivity(events.filter(event => event.method !== "www/developmentStage"), threadId, workspacePath);
  const current = threadId ? native.turns.at(-1) ?? null : null;
  const live = current && !current.historical && !current.endedAt && ["running", "pending", "blocked"].includes(current.status);
  const requested = live ? current.entries.filter((entry) => entry.source === "request" && entry.wwwArtifact?.kind === "skill") : [];
  const selectedSkills = WWW_AGENT_SKILLS.filter((skill) => requested.some((entry) => entry.wwwArtifact?.id === skill.id));
  let selectedSkillId = selectedSkills.length === 1 ? selectedSkills[0]?.id ?? null : null;
  let selectionBasis = selectedSkillId ? "구조화된 Skill 요청" : selectedSkills.length > 1 ? "복수 Skill 요청 · 현재 단계 모호" : null;
  let stageConnectionState: "unknown" | "available" | "resume_unavailable" | "other_workspace" | "closed" = "unknown";
  const missingConfiguration = native.historyTruncated ? " · 설정 사건 미보관" : "";
  let stageConnection = `단계 관측 연결 설정 미확인${missingConfiguration} · 외부 개발 세션 미연결`;
  const declarations = new Map<SkillId, WwwDevelopmentStage>();
  const stageAttempts = new Map<string, string>();
  const latestStageAttempts = new Map<string, string>();
  const stageWorks = new Set<string>();
  let latestStage: WwwDevelopmentStage | null = null;
  let planState: AgentOverviewProjection["planState"] = "unprovided";
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
        stageConnectionState = "closed";
        stageConnection = "Native 연결 종료 · 단계 관측 미연결 · 마지막 선언의 현재 상태 미확인";
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
    if (event.method === "thread/configured") {
      if (data.developmentStage === "available" || data.developmentStage === "resume_unavailable" || data.developmentStage === "other_workspace") stageConnectionState = data.developmentStage;
      stageConnection = data.developmentStage === "available" ? "현재 새 WWW 대화에 역할 선언 도구 연결 · 하네스 실행 미연결"
        : data.developmentStage === "resume_unavailable" ? "복원 대화의 단계 관측 미연결 · Native 재개는 도구 등록을 제공하지 않습니다."
        : data.developmentStage === "other_workspace" ? "다른 프로젝트의 단계 관측 미연결" : stageConnection;
    }
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
    if (event.method === "www/developmentStage" && data.source === "role_declaration" && !event.historical && !current.historical) {
      if (stageConnectionState === "resume_unavailable" || stageConnectionState === "other_workspace" || stageConnectionState === "closed") continue;
      const { threadId: _thread, turnId: _turn, source: _source, ...input } = data;
      const declaration = parseWwwDevelopmentStage(input);
      if (!declaration) continue;
      const key = JSON.stringify([declaration.workId, declaration.phase, declaration.attemptId]);
      const prior = stageAttempts.get(key);
      if (prior && latestStageAttempts.get(declaration.workId) !== key) continue;
      if (prior && !["selected", "running"].includes(prior)) continue;
      if (prior === "running" && declaration.status === "selected") continue;
      stageAttempts.set(key, declaration.status);
      latestStageAttempts.set(declaration.workId, key);
      declarations.set(`www-${declaration.phase}`, declaration);
      stageWorks.add(declaration.workId);
      latestStage = declaration;
      if (stageConnectionState === "unknown") stageConnection = `단계 관측 연결 설정 미확인${missingConfiguration} · 현재 턴의 역할 선언 수신 · 하네스 실행 미연결`;
      continue;
    }
    if (event.method === "turn/plan/updated") {
      planState = !Array.isArray(data.plan) ? "invalid" : data.plan.length ? "provided" : "empty";
      plan = Array.isArray(data.plan) ? data.plan.flatMap((value): PlanStep[] => {
        const row = record(value);
        return text(row.step) && (row.status === "pending" || row.status === "inProgress" || row.status === "completed") ? [{ step: text(row.step), status: row.status }] : [];
      }) : [];
      if (Array.isArray(data.plan) && plan.length !== data.plan.length) planState = "invalid";
      // 일부 유효 행도 손상된 계획의 활성 항목으로 사용하지 않는다.
      if (planState === "invalid") plan = [];
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
    const contextKey = `${progressEpoch}:${progressKey || "unlinked"}`;
    if (commentaryId && !messageKeys.has(commentaryId)) messageKeys.set(commentaryId, contextKey);
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
  const finalPlan = planState === "invalid" ? [] : current?.plan ?? [];
  const activePlanIndex = activeIndex(finalPlan);
  if (latestStage) {
    selectedSkillId = live && stageWorks.size === 1 && ["selected", "running"].includes(latestStage.status) ? `www-${latestStage.phase}` : null;
    selectionBasis = stageWorks.size > 1 ? "복수 작업의 역할 선언 · 현재 단계 모호" : "역할의 단계 선언 · 하네스 실행 미연결";
  }
  const skills = WWW_AGENT_SKILLS.map((skill) => {
    const observations = current?.entries.filter((entry) => entry.wwwArtifact?.id === skill.id && (entry.source === "file_read" || entry.source === "command_reference")) ?? [];
    const declaration = declarations.get(skill.id) ?? null;
    const reading = observations.some((entry) => entry.source === "file_read") ? "구조화된 문서 읽기 관측 · 적용 미확인" : observations.length ? "명령의 문서 참조 · 읽기·적용 미확인" : null;
    const declared = declaration ? `역할의 단계 선언 · ${declaration.workId} · 시도 ${declaration.attemptId} · 하네스 실행 미연결 · 업무 수용 미확인` : null;
    const basis = declared ? [declared, reading].filter(Boolean).join(" · ") : skill.id === selectedSkillId ? selectionBasis : reading;
    return { ...skill, observed: observations.length > 0, selected: skill.id === selectedSkillId, basis, declaration };
  });
  return { threadId, current, selectedSkillId, selectionBasis, stageConnection, skills, subagents: [...agents.values()], plan: finalPlan, activePlanIndex, planState, historyTruncated: native.historyTruncated, progress };
}
