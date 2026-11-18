/**
 * @architecture arch.chat.activity.view
 * @implements RESP-CHAT-ACTIVITY-VIEW
 */
import type { AgentOverviewProjection } from "./agent-overview";
import type { ActivityStatus } from "./native-activity";

function requestState(status: ActivityStatus): string {
  switch (status) {
    case "pending": return "대기";
    case "running": return "진행 중";
    case "completed": return "요청 완료";
    case "failed": return "실패";
    case "blocked": return "승인 대기";
    case "interrupted": return "중단";
    default: return "결과 미확인";
  }
}

const agentStates = {
  pending: "시작 대기",
  running: "진행 중",
  completed: "완료",
  failed: "실패",
  interrupted: "중단",
  unknown: "결과 미확인",
};
const declarationStates = {
  selected: "선택 선언", running: "진행 선언", completed: "완료 선언", failed: "실패 선언", interrupted: "중단 선언",
};

export function AgentOverviewView({ projection, sending }: { projection: AgentOverviewProjection; sending: boolean }) {
  const current = sending ? null : projection.current;
  const selected = sending ? null : projection.selectedSkillId;
  const plan = current ? projection.plan : [];
  const progress = current ? projection.progress : null;
  const active = current && projection.activePlanIndex !== null ? plan[projection.activePlanIndex] : null;
  return <>
    <section className="ao-agents" aria-label="Agent 트리" data-testid="agent-tree">
      <div className="ao-agent-root"><span className="ao-role-mark" aria-hidden="true">W</span><div><h3>WWW Agent</h3><p>{!sending && projection.selectionBasis ? projection.selectionBasis : "현재 스킬 선택 미확인"}</p></div></div>
      <p className="ao-empty ao-stage-connection">{projection.stageConnection}</p>
      <ul className="ao-skills" aria-label="WWW 개발 Skills">
        {projection.skills.map((skill) => <li key={skill.id} data-skill-id={skill.id} className={selected === skill.id ? "ao-skill is-selected" : "ao-skill"} aria-current={selected === skill.id ? "step" : undefined}>
          <span className="ao-skill-light" aria-hidden="true"/>
          <span className="ao-skill-name"><strong>{skill.name}</strong><small>{skill.label}</small></span>
          <span className="ao-skill-state" title={sending ? undefined : skill.basis ?? undefined}>{!sending && skill.declaration ? `${declarationStates[skill.declaration.status]}${selected !== skill.id && ["selected", "running"].includes(skill.declaration.status) ? " · 현재 상태 미확인" : ""}` : selected === skill.id ? "명시 요청" : !sending && skill.observed ? "읽기 관측" : "미관측"}</span>
          {!sending && skill.basis && <small className="ao-skill-basis">{skill.basis}</small>}
        </li>)}
      </ul>
      <div className="ao-subagents"><div className="na-section-heading"><h3>Subagent</h3><span>{projection.subagents.length}개 관측</span></div>
        {projection.subagents.length ? <ul data-testid="subagent-list">{projection.subagents.map((agent) => <li key={agent.id} data-agent-id={agent.id} data-agent-status={agent.status} className={`ao-subagent ao-agent-${agent.status}`}>
          <div className="ao-subagent-heading"><span className="ao-agent-light" aria-hidden="true">{agent.status === "completed" ? "✓" : ""}</span><strong title={agent.id}>{agent.path || agent.id}</strong><span className="ao-subagent-state">{agentStates[agent.status]}</span></div>
          <p className="ao-agent-parent">부모 {agent.parentId === projection.threadId ? "WWW Agent" : agent.parentId ?? "미제공"}{agent.historical ? " · 복원된 이력" : ""}</p>
          {agent.model && <p className="ao-agent-model">모델 {agent.model}</p>}
          {agent.message && <p className="ao-agent-message">{agent.message}</p>}
        </li>)}</ul> : <p className="ao-empty">실제 Subagent 호출 미제공</p>}
      </div>
    </section>
    <section className="ao-overview na-monitor" aria-label="작업 개요" data-testid="agent-overview">
      <div className="na-section-heading"><h3>개요</h3><span>{sending ? "전송 중" : current ? current.historical ? "복원된 이력" : requestState(current.status) : "요청 대기"}</span></div>
      <p className="ao-request-title">{sending ? "새 요청을 보내고 있습니다." : current?.title ?? "현재 요청 미제공"}</p>
      <section className="ao-plan" aria-label="Plan" data-testid="agent-plan"><div className="ao-section-title"><h4>Plan</h4><span>{plan.length ? "Native 계획" : !sending && projection.planState === "empty" ? "Native 계획 없음" : !sending && projection.planState === "invalid" ? "계획 자료 해석 실패" : "자료 미제공"}</span></div>
        {plan.length ? <ol>{plan.map((step, index) => <li key={`${index}:${step.step}`} data-plan-index={index} data-plan-status={step.status} className={`ao-plan-${step.status}`} aria-current={projection.activePlanIndex === index ? "step" : undefined}>
          <span className="ao-plan-mark" aria-hidden="true">{step.status === "completed" ? "✓" : step.status === "inProgress" ? "●" : "○"}</span>
          <span>{step.step}<small>{step.status === "completed" ? "완료" : step.status === "inProgress" ? "진행 중" : "대기"}</small></span>
        </li>)}</ol> : <p className="ao-empty">{!sending && projection.planState === "empty" ? "Native가 빈 계획을 제공했습니다." : !sending && projection.planState === "invalid" ? "제공된 계획의 형식을 확인하지 못했습니다." : "단계·체크리스트 미제공 · 계획 문서 미연결"}</p>}
        {projection.historyTruncated && <p className="ao-empty">일부 이력만 보관되어 이전 계획의 제공 여부는 확인할 수 없습니다.</p>}
      </section>
      <section className="ao-progress" aria-label="Progress" data-testid="agent-progress" data-plan-index={progress?.planIndex}>
        <div className="ao-section-title"><h4>Progress</h4><span>{progress ? progress.planIndex === null ? "계획 미연결 공개 진행 설명" : progress.source === "commentary" ? "공개 진행 설명" : "Native 계획 설명" : "자료 미제공"}</span></div>
        {active && progress?.planIndex !== null && <p className="ao-progress-context">연결 항목 · {active.step}</p>}
        <p className={progress ? "ao-progress-prose" : "ao-empty"}>{progress?.text ?? (active ? "이 계획 항목에 연결된 공개 진행 설명이 아직 없습니다." : plan.length ? "현재 활성 계획 항목이 하나로 확인되지 않았습니다." : "현재 요청의 공개 진행 설명이 아직 제공되지 않았습니다.")}</p>
      </section>
    </section>
  </>;
}
