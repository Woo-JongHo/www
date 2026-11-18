/** @verifies RESP-CHAT-ACTIVITY-PROJECTION */
import { describe, expect, test } from "bun:test";
import { projectAgentOverview } from "../src/agent-overview";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResourceActivitySidebar } from "../src/native-activity-view";
import type { AppEvent } from "../src/shared";

function event(seq: number, method: string, params: unknown, historical = false): AppEvent {
  return { seq, method, params, historical, at: `time-${seq}`, kind: "notification" };
}
function start(seq = 1, turn = "a", historical = false): AppEvent {
  return event(seq, "turn/started", { threadId: "t", turn: { id: turn } }, historical);
}
function item(seq: number, value: unknown, method = "item/started", turn = "a", historical = false): AppEvent {
  return event(seq, method, { threadId: "t", turnId: turn, item: value }, historical);
}
function plan(seq: number, steps: unknown[], explanation?: string): AppEvent {
  return event(seq, "turn/plan/updated", { threadId: "t", turnId: "a", plan: steps, explanation });
}
function call(seq: number, overrides: object = {}, method = "item/started", historical = false): AppEvent {
  return item(seq, { id: `call-${seq}`, type: "collabAgentToolCall", tool: "spawnAgent", senderThreadId: "t", receiverThreadIds: ["child"], agentsStates: {}, ...overrides }, method, "a", historical);
}

describe("WWW Agent 개요", () => {
  test("항상 다섯 스킬만 표시하고 실제 구조화 경로 요청만 선택한다", () => {
    const base = projectAgentOverview([], "t", "/repo");
    expect(base.skills.map((skill) => skill.name)).toEqual(["spec", "design", "build", "diagnose", "verify"]);
    const mention = item(2, { id: "u", type: "userMessage", content: [{ type: "skill", name: "www-build" }] });
    expect(projectAgentOverview([start(), mention], "t", "/repo").selectedSkillId).toBeNull();
    const request = item(3, { id: "u2", type: "userMessage", content: [{ type: "skill", name: "www-build", path: "/repo/skills/www/www-build/SKILL.md" }] });
    expect(projectAgentOverview([start(), request], "t", "/repo").selectedSkillId).toBe("www-build");
    const end = event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } });
    expect(projectAgentOverview([start(), request, end], "t", "/repo").selectedSkillId).toBeNull();
    expect(projectAgentOverview([start(1, "a", true), { ...request, historical: true }], "t", "/repo").selectedSkillId).toBeNull();
    expect(projectAgentOverview([start(), request], "other", "/repo").selectedSkillId).toBeNull();
  });
  test("도구 완료와 에이전트 완료를 구분하고 후속 작업으로 다시 실행한다", () => {
    const completedCall = call(3, {}, "item/completed");
    const done = item(4, { id: "activity", type: "subAgentActivity", agentThreadId: "child", kind: "completed", agentPath: "worker" });
    expect(projectAgentOverview([start(), call(2), completedCall], "t").subagents[0]?.status).toBe("pending");
    expect(projectAgentOverview([start(), call(2), done], "t").subagents[0]?.status).toBe("completed");
    const followup = call(5, { tool: "followupTask", agentsStates: { child: { status: "running" } } });
    expect(projectAgentOverview([start(), call(2), done, followup], "t").subagents[0]).toMatchObject({ id: "child", parentId: "t", path: "worker", status: "running" });
    expect(projectAgentOverview([start(), call(2), done, call(5, { tool: "followupTask" })], "t").subagents[0]?.status).toBe("pending");
    expect(projectAgentOverview([start(), call(2), done, call(5, { tool: "followupTask" }), call(6, { tool: "followupTask", status: "failed" }, "item/completed")], "t").subagents[0]?.status).toBe("unknown");
  });
  test("상태 근거, 외부 sender, 전송 종료와 복원 이력을 구분한다", () => {
    const failed = call(2, { agentsStates: { child: { status: "errored", message: "실패" } } }, "item/completed");
    expect(projectAgentOverview([start(), failed], "t").subagents[0]).toMatchObject({ status: "failed", message: "실패" });
    const interrupted = call(3, { agentsStates: { child: { status: "interrupted" } } }, "item/completed");
    expect(projectAgentOverview([start(), interrupted], "t").subagents[0]?.status).toBe("interrupted");
    expect(projectAgentOverview([start(), call(2, { senderThreadId: "foreign" })], "t").subagents).toEqual([]);
    expect(projectAgentOverview([start(), call(2), event(3, "transport/closed", {})], "t").subagents[0]?.status).toBe("unknown");
    expect(projectAgentOverview([start(1, "a", true), call(2, { agentsStates: { child: { status: "running" } } }, "item/started", true)], "t").subagents[0]).toMatchObject({ status: "unknown", historical: true });
  });
  test("확정된 Subagent 결과는 늦은 시작과 상태 재전달로 되살리지 않는다", () => {
    for (const status of ["completed", "errored", "interrupted"] as const) {
      const expected = status === "errored" ? "failed" : status;
      const before = [start(), call(2, { id: "spawn", agentsStates: { child: { status: "running", message: "진행" } } }), call(3, { id: "spawn", agentsStates: { child: { status, message: "최종 결과" } } }, "item/completed")];
      const stale = [
        item(4, { id: "old", type: "subAgentActivity", agentThreadId: "child", kind: "started" }),
        item(5, { id: "different", type: "subAgentActivity", agentThreadId: "child", kind: "interacted" }),
        call(6, { id: "spawn", agentsStates: { child: { status: "running", message: "늦은 진행" } } }),
        call(7, { tool: "wait", agentsStates: { child: { status: "running", message: "이전 스냅샷" } } }, "item/completed"),
        call(8, { tool: "listAgents", agentsStates: { child: { status: "pendingInit" } } }, "item/completed", true),
      ];
      for (let count = 0; count <= stale.length; count++) {
        expect(projectAgentOverview([...before, ...stale.slice(0, count)], "t").subagents[0]).toMatchObject({ status: expected, message: "최종 결과", historical: false });
      }
    }
    for (const kind of ["completed", "interrupted"] as const) {
      const done = item(2, { id: "sub", type: "subAgentActivity", agentThreadId: "child", kind });
      expect(projectAgentOverview([start(), done, item(3, { id: "new-id", type: "subAgentActivity", agentThreadId: "child", kind: "started" })], "t").subagents[0]?.status).toBe(kind);
    }
  });
  test("명시 새 작업만 종료 경계를 열고 같은 호출의 늦은 started는 열지 않는다", () => {
    const done = item(2, { id: "sub", type: "subAgentActivity", agentThreadId: "child", kind: "completed" });
    for (const tool of ["spawnAgent", "sendInput", "resumeAgent", "followupTask"]) {
      const next = call(3, { id: "new-operation", tool, agentsStates: { child: { status: "running" } } });
      expect(projectAgentOverview([start(), done, next], "t").subagents[0]?.status).toBe("running");
      const final = call(4, { id: "new-operation", tool, agentsStates: { child: { status: "completed" } } }, "item/completed");
      const late = call(5, { id: "new-operation", tool, agentsStates: { child: { status: "running" } } });
      expect(projectAgentOverview([start(), done, next, final, late], "t").subagents[0]?.status).toBe("completed");
      expect(projectAgentOverview([start(), done, final, late], "t").subagents[0]?.status).toBe("completed");
      const priorSnapshot = call(3, { id: "new-operation", tool, agentsStates: { child: { status: "completed", message: "지난 결과" } } });
      expect(projectAgentOverview([start(), done, priorSnapshot], "t").subagents[0]).toMatchObject({ status: "pending", message: null });
    }
    for (const tool of ["wait", "listAgents", "closeAgent", "sendMessage", "interruptAgent"]) {
      expect(projectAgentOverview([start(), done, call(3, { tool, agentsStates: { child: { status: "running" } } })], "t").subagents[0]?.status).toBe("completed");
    }
    for (const overrides of [{ id: "" }, { senderThreadId: "foreign" }]) {
      expect(projectAgentOverview([start(), done, call(3, { tool: "followupTask", agentsStates: { child: { status: "running" } }, ...overrides })], "t").subagents[0]?.status).toBe("completed");
    }
  });
  test("전송 종료와 복원 뒤 늦은 active는 미확인이고 실제 결과와 새 작업은 수용한다", () => {
    for (const restored of [false, true]) {
      const initial = restored ? [start(), call(2, { id: "old", agentsStates: { child: { status: "running" } } }, "item/started", true)]
        : [start(), call(2, { id: "old", agentsStates: { child: { status: "running" } } }), event(3, "transport/closed", {})];
      const late = [item(4, { id: "late", type: "subAgentActivity", agentThreadId: "child", kind: "started" }), call(5, { id: "old", agentsStates: { child: { status: "running" } } }), call(6, { tool: "wait", agentsStates: { child: { status: "running" } } }, "item/completed")];
      expect(projectAgentOverview([...initial, ...late], "t").subagents[0]).toMatchObject({ status: "unknown", historical: restored });
      expect(projectAgentOverview([...initial, ...late, call(7, { tool: "wait", agentsStates: { child: { status: "completed" } } }, "item/completed")], "t").subagents[0]?.status).toBe("completed");
      expect(projectAgentOverview([...initial, ...late, event(7, "transport/connected", {}), call(8, { tool: "followupTask", agentsStates: { child: { status: "running" } } })], "t").subagents[0]?.status).toBe("running");
      expect(projectAgentOverview([...initial, call(7, { tool: "followupTask", agentsStates: { child: { status: "running" } } }, "item/started", true)], "t").subagents[0]?.status).toBe("unknown");
    }
    expect(projectAgentOverview([start(), event(2, "transport/closed", {}), item(3, { id: "late", type: "subAgentActivity", agentThreadId: "child", kind: "started" })], "t").subagents[0]?.status).toBe("unknown");
    const fresh = [start(), item(2, { id: "live", type: "subAgentActivity", agentThreadId: "child", kind: "started" })];
    expect(projectAgentOverview(fresh, "t").subagents[0]?.status).toBe("running");
    expect(projectAgentOverview([...fresh, call(3, { tool: "wait", agentsStates: { child: { status: "running", message: "새 관측" } } }, "item/completed")], "t").subagents[0]).toMatchObject({ status: "running", message: "새 관측" });
  });
  test("호출별 대상과 복원 경계를 보존하고 가시성 종료는 실제 결과로 정산한다", () => {
    const finished = call(2, { id: "old", agentsStates: { child: { status: "completed" } } }, "item/completed");
    const lateMetadata = item(3, { id: "activity", type: "subAgentActivity", agentThreadId: "child", kind: "started", agentPath: "worker", model: "resolved" });
    expect(projectAgentOverview([start(), finished, lateMetadata], "t").subagents[0]).toMatchObject({ status: "completed", path: "worker", model: "resolved" });
    const noTarget = call(3, { id: "followup", tool: "followupTask", receiverThreadIds: [] });
    const hasTarget = call(4, { id: "followup", tool: "followupTask", agentsStates: { child: { status: "running" } } }, "item/completed");
    expect(projectAgentOverview([start(), finished, noTarget, hasTarget], "t").subagents[0]?.status).toBe("running");
    const historical = call(3, { id: "restored", tool: "followupTask", agentsStates: { child: { status: "running" } } }, "item/started", true);
    const replay = { ...historical, seq: 4, historical: false };
    expect(projectAgentOverview([start(), historical, replay], "t").subagents[0]?.status).toBe("unknown");
    for (const closed of ["shutdown", "notFound"]) {
      const initial = [start(), call(2, { id: "spawn", agentsStates: { child: { status: closed } } }, "item/completed")];
      const late = call(3, { tool: "wait", agentsStates: { child: { status: "running" } } }, "item/completed");
      expect(projectAgentOverview([...initial, late], "t").subagents[0]?.status).toBe(closed === "shutdown" ? "interrupted" : "unknown");
      for (const status of ["completed", "errored", "interrupted"] as const) {
        expect(projectAgentOverview([...initial, late, call(4, { tool: "wait", agentsStates: { child: { status } } }, "item/completed")], "t").subagents[0]?.status).toBe(status === "errored" ? "failed" : status);
      }
    }
  });
  test("재연결은 새 Subagent의 첫 관측만 열고 기존 종료·미확인 경계는 유지한다", () => {
    const activity = (seq: number, id: string, kind = "started") => item(seq, { id: `activity-${seq}`, type: "subAgentActivity", agentThreadId: id, kind });
    const before = [start(), activity(2, "settled", "completed"), activity(3, "uncertain"), event(4, "transport/closed", {}), activity(5, "late")];
    const connected = event(6, "transport/connected", {});
    for (const historical of [false, true]) {
      const events = [...before, { ...connected, historical }, activity(7, "settled"), activity(8, "uncertain"), activity(9, "late"), activity(10, "fresh")];
      const statuses = Object.fromEntries(projectAgentOverview(events, "t").subagents.map(agent => [agent.id, agent.status]));
      expect(statuses).toEqual({ settled: "completed", uncertain: "unknown", late: "unknown", fresh: historical ? "unknown" : "running" });
      const refined = projectAgentOverview([...events, activity(11, "uncertain", "completed")], "t");
      expect(refined.subagents.find(agent => agent.id === "uncertain")?.status).toBe("completed");
    }
  });
  test("연결 가시성과 기존 결과를 작업 호출·activity 모든 조합에 일관되게 적용한다", () => {
    for (const connection of ["live", "closed", "reconnected", "historical-connected"]) {
      for (const prior of ["new", "active", "settled"]) {
        for (const surface of ["work", "activity"]) {
          for (const historical of [false, true]) {
            const activity = (seq: number, kind: string) => item(seq, { id: `activity-${seq}`, type: "subAgentActivity", agentThreadId: "child", kind });
            const rows = [start()];
            if (prior !== "new") rows.push(activity(2, prior === "settled" ? "completed" : "started"));
            if (connection !== "live") rows.push(event(3, "transport/closed", {}));
            if (connection === "reconnected" || connection === "historical-connected") rows.push(event(4, "transport/connected", {}, connection === "historical-connected"));
            const update = surface === "work" ? call(5, { tool: "followupTask", agentsStates: { child: { status: "running" } } }) : activity(5, "started");
            rows.push({ ...update, historical });
            const connected = connection === "live" || connection === "reconnected";
            const explicitWork = connected && !historical && surface === "work";
            const expected = prior === "settled" && !explicitWork ? "completed"
              : historical || !connected || (connection === "reconnected" && prior === "active" && surface === "activity") ? "unknown" : "running";
            expect(projectAgentOverview(rows, "t").subagents[0]?.status).toBe(expected);
          }
        }
      }
    }
  });
  test("commentary 완료 뒤 동일 ID 시작·delta를 막고 완료 snapshot 정산은 받는다", () => {
    const active = [{ step: "확인", status: "inProgress" }];
    const delta = (seq: number, id: string, value: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: value });
    const snapshot = (seq: number, value: string, method = "item/completed") => item(seq, { id: "msg", type: "agentMessage", phase: "commentary", text: value }, method);
    const before = [start(), plan(2, active), delta(3, "msg", "진행"), snapshot(4, "확인 완료")];
    for (const late of [delta(5, "msg", "늦은 조각"), snapshot(5, "늦은 시작", "item/started")]) {
      expect(projectAgentOverview([...before, late], "t").progress?.text).toBe("확인 완료");
    }
    const updated = [...before, snapshot(5, "정산된 완료")];
    expect(projectAgentOverview([...updated, delta(6, "msg", "늦은 조각"), snapshot(7, "늦은 시작", "item/started")], "t").progress?.text).toBe("정산된 완료");
    expect(projectAgentOverview([...before, delta(5, "fresh", "새 공개 설명")], "t").progress?.text).toBe("새 공개 설명");
    const ended = event(5, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } });
    expect(projectAgentOverview([...before, ended, delta(6, "fresh", "종료 뒤"), snapshot(7, "종료 뒤 snapshot")], "t").progress?.text).toBe("확인 완료");
    expect(projectAgentOverview([start(), plan(2, active), snapshot(3, ""), delta(4, "msg", "빈 완료 뒤")], "t").progress).toBeNull();
  });
  test("빈 완료 snapshot은 해당 산문을 제거하고 늦은 시작은 기존 조각을 덮지 않는다", () => {
    const active = [{ step: "확인", status: "inProgress" }];
    const delta = (seq: number, id: string, value: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: value });
    const snapshot = (seq: number, value: string, method = "item/completed", id = "msg") => item(seq, { id, type: "agentMessage", phase: "commentary", text: value }, method);
    for (const first of [delta(3, "msg", "진행 중"), snapshot(3, "시작 본문", "item/started")]) {
      const before = [start(), plan(2, active), first];
      expect(projectAgentOverview([...before, snapshot(4, "이전 시작", "item/started")], "t").progress?.text).toBe(first.method === "item/started" ? "시작 본문" : "진행 중");
      const empty = [...before, snapshot(4, "")];
      expect(projectAgentOverview(empty, "t").progress).toBeNull();
      expect(projectAgentOverview([...empty, delta(5, "msg", "늦은 조각"), snapshot(6, "늦은 시작", "item/started")], "t").progress).toBeNull();
      expect(projectAgentOverview([...empty, snapshot(5, "최종 정산"), delta(6, "msg", "늦은 조각")], "t").progress?.text).toBe("최종 정산");
    }
    const interleaved = [start(), plan(2, active), delta(3, "msg", "이전 메시지"), delta(4, "new-msg", "현재 메시지")];
    expect(projectAgentOverview([...interleaved, snapshot(5, "이전 시작", "item/started")], "t").progress?.text).toBe("현재 메시지");
    expect(projectAgentOverview([...interleaved, snapshot(5, "")], "t").progress?.text).toBe("현재 메시지");
    expect(projectAgentOverview([start(), plan(2, active), snapshot(3, "초기", "item/started"), delta(4, "msg", " 조각"), snapshot(5, "정식 완료")], "t").progress?.text).toBe("정식 완료");
  });
  test("활성 계획 변경 후 이전 commentary를 재사용하지 않고 delta만 누적한다", () => {
    const first = [{ step: "첫째", status: "inProgress" }, { step: "둘째", status: "pending" }];
    const second = [{ step: "첫째", status: "completed" }, { step: "둘째", status: "inProgress" }];
    const delta = (seq: number, content: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: seq > 5 ? "new-msg" : "msg", phase: "commentary", delta: content });
    const initial = [start(), plan(2, first), delta(3, "하나"), delta(4, "둘")];
    expect(projectAgentOverview(initial, "t").progress?.text).toBe("하나둘");
    expect(projectAgentOverview([...initial, plan(5, second)], "t").progress).toBeNull();
    expect(projectAgentOverview([...initial, plan(5, second), delta(6, "새 설명")], "t").progress).toMatchObject({ text: "새 설명", planIndex: 1 });
    expect(projectAgentOverview([...initial, plan(5, [{ step: "A", status: "inProgress" }, { step: "B", status: "inProgress" }])], "t").progress).toBeNull();
  });
  test("공개 plan 설명만 연결하고 다른 턴과 내부 추론을 무시한다", () => {
    const active = [{ step: "확인", status: "inProgress" }];
    const secret = item(3, { id: "secret", type: "agentMessage", phase: "analysis", text: "비밀 추론" });
    const other = event(0, "item/agentMessage/delta", { threadId: "t", turnId: "other", itemId: "x", phase: "commentary", delta: "다른 턴" });
    const projection = projectAgentOverview([start(), plan(2, active, "공개 설명"), secret, other], "t");
    expect(projection.progress).toMatchObject({ text: "공개 설명", source: "plan-explanation" });
    expect(JSON.stringify(projection)).not.toContain("비밀 추론");
    expect(JSON.stringify(projection)).not.toContain("다른 턴");
  });
  test("복수 Skill 요청과 읽기를 단일 현재 선택으로 추정하지 않는다", () => {
    const skills = item(2, { id: "u", type: "userMessage", content: ["spec", "build"].map((name) => ({ type: "skill", name: `www-${name}`, path: `/repo/skills/www/www-${name}/SKILL.md` })) });
    expect(projectAgentOverview([start(), skills], "t", "/repo").selectedSkillId).toBeNull();
    const read = item(2, { id: "r", type: "commandExecution", command: "cat skills/www/www-build/SKILL.md", cwd: "/repo", commandActions: [{ type: "read", path: "skills/www/www-build/SKILL.md" }] });
    const projection = projectAgentOverview([start(), read], "t", "/repo");
    expect(projection.selectedSkillId).toBeNull();
    expect(projection.skills.find((skill) => skill.id === "www-build")).toMatchObject({ observed: true, selected: false, basis: "구조화된 문서 읽기 관측 · 적용 미확인" });
  });
  test("Subagent 요청 모델과 부모 미제공을 실제 관측으로 승격하지 않는다", () => {
    expect(projectAgentOverview([start(), call(2, { model: "requested-model" })], "t").subagents[0]?.model).toBeNull();
    const activity = item(2, { id: "sub", type: "subAgentActivity", kind: "started", agentThreadId: "child", agentPath: "/root/work", model: "resolved-model" });
    expect(projectAgentOverview([start(), activity], "t").subagents[0]).toMatchObject({ parentId: null, model: "resolved-model", status: "running" });
  });
  test("계획 전 메시지와 활성 항목이 되돌아온 이전 메시지를 재귀속하지 않는다", () => {
    const a = [{ step: "A", status: "inProgress" }];
    const b = [{ step: "B", status: "inProgress" }];
    const delta = (seq: number, id: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: "이전 설명" });
    expect(projectAgentOverview([start(), delta(2, "before"), plan(3, a), delta(4, "before")], "t").progress).toBeNull();
    expect(projectAgentOverview([start(), plan(2, a), delta(3, "old"), plan(4, b), plan(5, a), delta(6, "old")], "t").progress).toBeNull();
  });
  test("종료된 턴과 복원 이력의 늦은 계획·공개 산문은 종료 전 기록을 바꾸지 않는다", () => {
    for (const historical of [false, true]) {
      for (const status of ["completed", "failed", "interrupted"] as const) {
        const before = [start(1, "a", historical), { ...plan(2, [{ step: "종료 전 계획", status: "inProgress" }]), historical }, item(3, { id: "msg", type: "agentMessage", phase: "commentary", text: "종료 전 설명" }, "item/completed", "a", historical), event(4, "turn/completed", { threadId: "t", turn: { id: "a", status } }, historical)];
        const late = [...before, start(5, "a", historical), { ...plan(6, [{ step: "늦은 계획", status: "inProgress" }], "늦은 설명"), historical }, event(7, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "msg", phase: "commentary", delta: "늦은 조각" }, historical), item(8, { id: "late", type: "agentMessage", phase: "commentary", text: "늦은 산문" }, "item/completed", "a", historical)];
        const projection = projectAgentOverview(late, "t");
        expect(projection.plan).toEqual([{ step: "종료 전 계획", status: "inProgress" }]);
        expect(projection.progress?.text).toBe("종료 전 설명");
        expect(projection.current?.status).toBe(status);
        expect(projection.current?.historical).toBe(historical);
      }
    }
  });
  test("명시된 새 턴은 같은 메시지 ID를 사용해도 이전 종료 경계와 분리한다", () => {
    const events = [start(), plan(2, [{ step: "A 계획", status: "inProgress" }]), item(3, { id: "shared", type: "agentMessage", phase: "commentary", text: "A 설명" }), event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), start(5, "b"), event(6, "turn/plan/updated", { threadId: "t", turnId: "b", plan: [{ step: "B 계획", status: "inProgress" }] }), item(7, { id: "shared", type: "agentMessage", phase: "commentary", text: "B 설명" }, "item/completed", "b"), plan(8, [{ step: "늦은 A 계획", status: "inProgress" }]), item(9, { id: "shared", type: "agentMessage", phase: "commentary", text: "늦은 A 설명" })];
    const projection = projectAgentOverview(events, "t");
    expect(projection.current?.turnId).toBe("b");
    expect(projection.plan).toEqual([{ step: "B 계획", status: "inProgress" }]);
    expect(projection.progress?.text).toBe("B 설명");
  });
  test("연결 종료 뒤 설명을 동결하고 이후 명시된 다른 턴은 받아들인다", () => {
    const closed = [start(), plan(2, [{ step: "A 계획", status: "inProgress" }]), item(3, { id: "shared", type: "agentMessage", phase: "commentary", text: "A 설명" }), event(4, "transport/closed", {}), plan(5, [{ step: "늦은 A 계획", status: "inProgress" }]), item(6, { id: "late", type: "agentMessage", phase: "commentary", text: "늦은 A 설명" })];
    expect(projectAgentOverview(closed, "t").progress?.text).toBe("A 설명");
    expect(projectAgentOverview(closed, "t").plan[0]?.step).toBe("A 계획");
    const resumed = [...closed, start(7, "b"), event(8, "turn/plan/updated", { threadId: "t", turnId: "b", plan: [{ step: "B 계획", status: "inProgress" }] }), item(9, { id: "shared", type: "agentMessage", phase: "commentary", text: "B 설명" }, "item/completed", "b")];
    expect(projectAgentOverview(resumed, "t").progress?.text).toBe("B 설명");
  });
  test("부모 턴 종료 뒤 제공된 Subagent 완료는 계속 관측한다", () => {
    const events = [start(), call(2, { agentsStates: { child: { status: "running" } } }), event(3, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), call(4, { agentsStates: { child: { status: "completed" } } }, "item/completed")];
    expect(projectAgentOverview(events, "t").subagents[0]?.status).toBe("completed");
  });
  test("Native가 식별한 완료 형태를 소비해 누락·중첩 thread의 늦은 산문도 막는다", () => {
    const completions = [
      { turn: { id: "a", status: "completed" } },
      { thread: { id: "t" }, turn: { id: "a", status: "completed" } },
      { turn: { threadId: "t", id: "a", status: "completed" } },
      { turnId: "a", turn: { status: "completed" } },
    ];
    for (const historical of [false, true]) {
      for (const completion of completions) {
        const events = [start(), plan(2, [{ step: "A 계획", status: "inProgress" }]), item(3, { id: "msg", type: "agentMessage", phase: "commentary", text: "종료 전" }), event(4, "turn/completed", completion), item(5, { id: "late", type: "agentMessage", phase: "commentary", text: "늦은 산문" }), plan(6, [{ step: "늦은 계획", status: "inProgress" }])].map((row) => ({ ...row, historical }));
        const projection = projectAgentOverview(events, "t");
        expect(projection.current?.endedSeq).toBe(4);
        expect(projection.plan[0]?.step).toBe("A 계획");
        expect(projection.progress?.text).toBe("종료 전");
      }
    }
  });
  test("같은 turn ID의 다른 thread는 완료 전 prefix에서만 모호성을 만든다", () => {
    const before = [start(), plan(2, [{ step: "A 계획", status: "inProgress" }]), item(3, { id: "msg", type: "agentMessage", phase: "commentary", text: "처음" })];
    const foreign = (seq: number) => event(seq, "turn/started", { threadId: "foreign", turn: { id: "a" } });
    const terminal = (seq: number) => event(seq, "turn/completed", { turn: { id: "a", status: "completed" } });
    const late = item(6, { id: "late", type: "agentMessage", phase: "commentary", text: "나중" });
    const ambiguous = projectAgentOverview([...before, foreign(4), terminal(5), late], "t");
    expect(ambiguous.current?.endedSeq).toBeNull();
    expect(ambiguous.current?.status).toBe("running");
    expect(ambiguous.progress?.text).toBe("나중");
    const closed = projectAgentOverview([...before, terminal(4), foreign(5), late], "t");
    expect(closed.current?.endedSeq).toBe(4);
    expect(closed.current?.status).toBe("completed");
    expect(closed.progress?.text).toBe("처음");
  });
  test("중복 완료가 도착해도 최초 종료 뒤의 산문을 다시 받지 않는다", () => {
    const terminal = (seq: number) => event(seq, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } });
    const projection = projectAgentOverview([start(), plan(2, [{ step: "A 계획", status: "inProgress" }]), item(3, { id: "msg", type: "agentMessage", phase: "commentary", text: "처음" }), terminal(4), item(5, { id: "late", type: "agentMessage", phase: "commentary", text: "늦은 설명" }), terminal(6)], "t");
    expect(projection.current?.endedSeq).toBe(4);
    expect(projection.progress?.text).toBe("처음");
  });
});

describe("기본 오른쪽 바", () => {
  function markup(events: AppEvent[], sending = false) {
    return renderToStaticMarkup(createElement(ResourceActivitySidebar, { events, resources: null, threadId: "t", workspacePath: "/repo", sending, hidden: false, onOpenMonitor: () => {} }));
  }
  test("미관측 상태에서도 고정 트리와 개요를 표시하고 Hook·범용 목록을 제외한다", () => {
    const html = markup([start(), event(2, "hook/started", { threadId: "t", turnId: "a", run: { id: "h", eventName: "preToolUse", executionMode: "sync", status: "running" } })]);
    for (const id of ["spec", "design", "build", "diagnose", "verify"]) expect(html).toContain(`data-skill-id="www-${id}"`);
    expect(html.match(/data-skill-id=/g)).toHaveLength(5);
    expect(html).toContain("WWW Agent");
    expect(html).toContain("현재 스킬 선택 미확인");
    expect(html).toContain("단계·체크리스트 미제공");
    expect(html).not.toContain("preToolUse");
    expect(html).not.toContain("www-commit");
    expect(html).not.toContain("대화 누적 리소스");
  });
  test("활성 항목의 공개 산문과 같은 Subagent 완료 표시를 유지하고 전송 중 이전 개요를 비운다", () => {
    const events = [start(), plan(2, [{ step: "로그인 로직 개발", status: "inProgress" }]), item(3, { id: "msg", type: "agentMessage", phase: "commentary", text: "사용자 입력 검증을 확인하고 있습니다." }), call(4, { agentsStates: { child: { status: "completed" } } }, "item/completed")];
    const html = markup(events);
    expect(html).toContain("연결 항목 · 로그인 로직 개발");
    expect(html).toContain("사용자 입력 검증을 확인하고 있습니다.");
    expect(html).toContain('data-agent-id="child" data-agent-status="completed"');
    expect(html).toContain('class="ao-agent-light" aria-hidden="true">✓');
    const sending = markup(events, true);
    expect(sending).toContain("전송 중");
    expect(sending).not.toContain("로그인 로직 개발");
    expect(sending).not.toContain("사용자 입력 검증을 확인하고 있습니다.");
    expect(sending.match(/data-skill-id=/g)).toHaveLength(5);
  });
});

test("계획 없는 공개 진행 설명은 미연결로 표시하고 빈 Native 계획과 미제공을 구별한다", () => {
  const prose = item(2, { id: "p", type: "agentMessage", phase: "commentary", text: "계획 없이 확인 중입니다." });
  const projection = projectAgentOverview([start(), prose], "t");
  expect(projection.progress).toMatchObject({ text: "계획 없이 확인 중입니다.", planIndex: null });
  expect(projection.planState).toBe("unprovided");
  expect(projectAgentOverview([start(), plan(2, [])], "t").planState).toBe("empty");
  const html = renderToStaticMarkup(createElement(ResourceActivitySidebar, { events: [start(), prose], resources: null, threadId: "t", sending: false, hidden: false, onOpenMonitor() {} }));
  expect(html).toContain("계획 미연결 공개 진행 설명");
  expect(html).not.toContain('ao-skill-state">대기');
});

test("역할 단계 선언은 문서 읽기와 하네스 실행을 구별하고 종료 뒤 선언을 무시한다", () => {
  const stage = event(2, "www/developmentStage", { threadId: "t", turnId: "a", source: "role_declaration", workId: "work-36d312bc-a767-4e3e-a581-01898b35f75f", phase: "build", status: "running", attemptId: "attempt-1" });
  const projection = projectAgentOverview([start(), stage], "t");
  expect(projection.selectedSkillId).toBe("www-build");
  expect(projection.selectionBasis).toContain("역할의 단계 선언");
  expect(projection.skills.find(skill => skill.id === "www-build")?.basis).toContain("하네스 실행 미연결");
  const ended = [...[start(), event(2, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } })], { ...stage, seq: 3 }];
  expect(projectAgentOverview(ended, "t").selectedSkillId).toBeNull();
  expect(projectAgentOverview([start(), { ...stage, historical: true }], "t").selectedSkillId).toBeNull();
});

test("계획 미연결 산문은 늦은 계획으로 재귀속하지 않고 새로운 메시지부터 연결한다", () => {
  const delta = (seq: number, id: string, value = "설명") => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: value });
  const before = [start(), delta(2, "before")];
  expect(projectAgentOverview(before, "t").progress).toMatchObject({ planIndex: null, text: "설명" });
  const latePlan = [...before, plan(3, [{ step: "뒤늦은 계획", status: "inProgress" }]), delta(4, "before")];
  expect(projectAgentOverview(latePlan, "t").progress).toBeNull();
  expect(projectAgentOverview([...latePlan, delta(5, "new")], "t").progress).toMatchObject({ planIndex: 0, text: "설명" });
  const ambiguous = [start(), plan(2, [{ step: "A", status: "inProgress" }, { step: "B", status: "inProgress" }]), delta(3, "unlinked")];
  expect(projectAgentOverview(ambiguous, "t").progress?.planIndex).toBeNull();
});

test("단계 선언의 시도·다른 턴·복수 작업·종료 및 복원 경계를 보존한다", () => {
  const stage = (seq: number, overrides: object = {}) => event(seq, "www/developmentStage", { threadId: "t", turnId: "a", source: "role_declaration", workId: "work-36d312bc-a767-4e3e-a581-01898b35f75f", phase: "build", status: "running", attemptId: "one", ...overrides });
  const prior = [start(), stage(2), stage(3, { status: "failed" }), stage(4)];
  expect(projectAgentOverview(prior, "t").skills.find(s => s.id === "www-build")?.declaration?.status).toBe("failed");
  expect(projectAgentOverview([...prior, stage(5, { attemptId: "two" })], "t").selectedSkillId).toBe("www-build");
  expect(projectAgentOverview([...prior, stage(5, { attemptId: "two" }), stage(6, { attemptId: "one", status: "completed" })], "t").skills.find(s => s.id === "www-build")?.declaration?.attemptId).toBe("two");
  const multiple = projectAgentOverview([start(), stage(2), stage(3, { workId: "work-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", phase: "verify" })], "t");
  expect(multiple.selectedSkillId).toBeNull();
  expect(multiple.selectionBasis).toContain("복수 작업");
  expect(projectAgentOverview([start(), stage(2, { turnId: "foreign" })], "t").selectedSkillId).toBeNull();
  expect(projectAgentOverview([start(), event(2, "transport/closed", {}), stage(3)], "t").skills.every(s => !s.declaration)).toBe(true);
  const restored = projectAgentOverview([event(1, "thread/configured", { threadId: "t", developmentStage: "resume_unavailable" }), start(2, "a", true), { ...stage(3), historical: true }], "t");
  expect(restored.stageConnection).toContain("복원 대화");
  expect(restored.selectedSkillId).toBeNull();
});

test("사건 절단 뒤 계획 없는 새 산문을 보여 주며 과거 계획을 합성하지 않는다", () => {
  const events = [start(), plan(2, [{ step: "잘린 계획", status: "inProgress" }]), ...Array.from({ length: 2000 }, (_, index) => event(index + 3, "fixture/noise", { threadId: "t", turnId: "a" })), item(2003, { id: "new", type: "agentMessage", phase: "commentary", text: "남아 있는 공개 설명" })];
  const projection = projectAgentOverview(events, "t");
  expect(projection.historyTruncated).toBe(true);
  expect(projection.plan).toEqual([]);
  expect(projection.progress).toMatchObject({ planIndex: null, text: "남아 있는 공개 설명" });
  expect(projectAgentOverview([start(), plan(2, [{ step: "손상", status: "unknown" }])], "t").planState).toBe("invalid");
});

test("혼합 손상 계획의 공개 산문은 미연결이며 같은 항목의 정상 계획에도 재귀속하지 않는다", () => {
  const delta = (seq: number, id: string, value: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: value });
  const mixed = [start(), plan(2, [{ step: "A", status: "inProgress" }, { step: "B", status: "unknown" }]), delta(3, "p", "손상 시점 설명")];
  const invalid = projectAgentOverview(mixed, "t");
  expect(invalid.planState).toBe("invalid");
  expect(invalid.plan).toEqual([]);
  expect(invalid.activePlanIndex).toBeNull();
  expect(invalid.progress).toMatchObject({ text: "손상 시점 설명", planIndex: null });
  const html = renderToStaticMarkup(createElement(ResourceActivitySidebar, { events: mixed, resources: null, threadId: "t", sending: false, hidden: false, onOpenMonitor() {} }));
  expect(html).toContain("계획 자료 해석 실패");
  expect(html).toContain("계획 미연결 공개 진행 설명");
  expect(html).not.toContain('data-plan-index="0"');
  const repaired = [...mixed, plan(4, [{ step: "A", status: "inProgress" }]), delta(5, "p", "늦은 추가")];
  expect(projectAgentOverview(repaired, "t").progress).toBeNull();
  expect(projectAgentOverview([...repaired, delta(6, "new", "새 항목 설명")], "t").progress).toMatchObject({ text: "새 항목 설명", planIndex: 0 });
});

test("설정 사건이 절단돼도 현재 역할 선언 수신과 설정 미확인을 구별한다", () => {
  const stage = event(2003, "www/developmentStage", { threadId: "t", turnId: "a", source: "role_declaration", workId: "work-36d312bc-a767-4e3e-a581-01898b35f75f", phase: "build", status: "running", attemptId: "one" });
  const retained = [...Array.from({ length: 1998 }, (_, index) => event(index + 4, "fixture/noise", { threadId: "t", turnId: "a" })), item(2002, { id: "p", type: "agentMessage", phase: "commentary", text: "현재 공개 설명" }), stage];
  expect(retained).toHaveLength(2000);
  const projection = projectAgentOverview(retained, "t");
  expect(projection.historyTruncated).toBe(true);
  expect(projection.selectedSkillId).toBe("www-build");
  expect(projection.stageConnection).toContain("설정 사건 미보관");
  expect(projection.stageConnection).toContain("현재 턴의 역할 선언 수신");
  expect(projection.stageConnection).toContain("하네스 실행 미연결");
  expect(projection.stageConnection).not.toContain("단계 관측 미연결");
  const unknown = projectAgentOverview([start()], "t");
  expect(unknown.stageConnection).toContain("연결 설정 미확인");
  expect(unknown.stageConnection).not.toContain("설정 사건 미보관");
  for (const reason of ["resume_unavailable", "other_workspace"]) {
    const unavailable = projectAgentOverview([event(1, "thread/configured", { threadId: "t", developmentStage: reason }), start(2), { ...stage, seq: 3 }], "t");
    expect(unavailable.stageConnection).toContain("단계 관측 미연결");
    expect(unavailable.stageConnection).not.toContain("설정 사건 미보관");
    expect(unavailable.selectedSkillId).toBeNull();
  }
});
