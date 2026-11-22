/** @verifies RESP-CHAT-ACTIVITY-PROJECTION */
import { describe, expect, test } from "bun:test";
import { restoreConversationEvents } from "../src/conversations";
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
  test("공식 실행 영수증을 같은 턴의 최신 단계 시도와만 결속한다", () => {
    const workId = "work-36d312bc-a767-4e3e-a581-01898b35f75f";
    const stage = { threadId: "t", turnId: "a", workId, phase: "verify", attemptId: "first" };
    const declaration = event(2, "www/developmentStage", { ...stage, source: "role_declaration", status: "running" });
    const data = { ...stage, source: "workflow_receipt", outcome: "passed", completedAt: "2026-11-22T12:30:00.000Z" };
    const execution = event(3, "www/harnessObserved", data);
    const basis = (rows: AppEvent[]) => projectAgentOverview(rows, "t").skills.find(skill => skill.id === "www-verify")?.basis;
    expect(basis([start(), declaration])).toContain("하네스 실행 미연결");
    expect(basis([start(), declaration, execution])).toContain("하네스 실행 확인 · 성공");
    expect(basis([start(), declaration, { ...execution, historical: true }])).toContain("하네스 실행 미연결");
    expect(basis([start(), declaration, event(3, "www/harnessObserved", { ...data, source: "role_declaration" })])).toContain("하네스 실행 미연결");
    expect(basis([start(), declaration, event(3, "www/harnessObserved", { ...data, turnId: "other" })])).toContain("하네스 실행 미연결");
    const newer = event(4, "www/developmentStage", { ...stage, source: "role_declaration", status: "selected", attemptId: "second" });
    expect(basis([start(), declaration, execution, newer, { ...execution, seq: 5 }])).toContain("하네스 실행 미연결");
    const nextPhase = event(4, "www/developmentStage", { ...stage, source: "role_declaration", phase: "build", status: "selected", attemptId: "build-next" });
    expect(basis([start(), declaration, execution, nextPhase])).toContain("하네스 실행 확인 · 성공");
  });

  test("별개의 빈 설명이 완료돼도 직전 공개 진행 설명을 표시한다", () => {
    const previous = item(2, { id: "previous", type: "agentMessage", phase: "commentary", text: "파일 근거를 확인했습니다." }, "item/completed");
    const empty = item(3, { id: "empty", type: "agentMessage", phase: "commentary", text: "" }, "item/completed");
    expect(projectAgentOverview([start(), previous, empty], "t").progress).toMatchObject({ text: "파일 근거를 확인했습니다.", planIndex: null });
  });

  test("명시 계획 문서와 Native 계획을 분리하고 이전 턴·복원 자료를 연결하지 않는다", () => {
    const document = {
      threadId: "t", turnId: "a", source: "work_document", workId: "work-36d312bc-a767-4e3e-a581-01898b35f75f",
      path: "docs/work/Chat/015-plan/tasks.md", sha256: "a".repeat(64), status: "available", content: "- [ ] 원문",
    };
    const commentary = item(2, { id: "progress", type: "agentMessage", phase: "commentary", text: "공개 설명" }, "item/completed");
    const linked = event(3, "www/planLinked", document);
    const unrelated = event(4, "www/planLinked", { ...document, turnId: "other", content: "잘못된 문서" });
    const before = projectAgentOverview([start(), commentary, linked, unrelated], "t");
    expect(before.planDocument).toMatchObject({ content: document.content, at: "time-3" });
    expect(before.planState).toBe("unprovided");
    expect(before.progress).toMatchObject({ text: "공개 설명", planIndex: null });
    const native = plan(5, [{ step: "Native 항목", status: "inProgress" }]);
    const both = projectAgentOverview([start(), linked, native], "t");
    expect(both.planDocument).toMatchObject({ content: document.content });
    expect(both.plan).toEqual([{ step: "Native 항목", status: "inProgress" }]);
    expect(both.nativePlanAt).toBe("time-5");
    const failed = event(6, "www/planLinked", { ...document, path: null, status: "failed", content: null });
    expect(projectAgentOverview([start(), failed], "t").planDocument).toMatchObject({ path: null, status: "failed", content: null });
    const other = event(6, "www/planLinked", { ...document, workId: "work-efeaecc7-814e-412f-bb53-0cbf1c56303d" });
    const ambiguous = projectAgentOverview([start(), linked, native, other], "t");
    expect(ambiguous.planAmbiguous).toBe(true);
    expect(ambiguous.planDocument).toBeNull();
    expect(ambiguous.plan).toEqual(both.plan);
    const ambiguity = event(7, "www/planAmbiguous", { threadId: "t", turnId: "a", source: "work_document" });
    expect(projectAgentOverview([start(), linked, ambiguity], "t")).toMatchObject({ planDocument: null, planAmbiguous: true });
    expect(projectAgentOverview([start(), linked, { ...ambiguity, historical: true }], "t").planAmbiguous).toBe(false);
    expect(projectAgentOverview([start(), linked, start(6, "b")], "t").planDocument).toBeNull();
    expect(projectAgentOverview([start(1, "a", true), { ...linked, historical: true }], "t").planDocument).toBeNull();
  });

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
    const completedCall = call(3, { id: "initial-operation" }, "item/completed");
    const done = item(4, { id: "activity", type: "subAgentActivity", agentThreadId: "child", kind: "completed", agentPath: "worker" });
    expect(projectAgentOverview([start(), call(2, { id: "initial-operation" }), completedCall], "t").subagents[0]?.status).toBe("pending");
    expect(projectAgentOverview([start(), call(2), done], "t").subagents[0]?.status).toBe("unknown");
    const followup = call(5, { tool: "followupTask", agentsStates: { child: { status: "running" } } });
    expect(projectAgentOverview([start(), call(2), done, followup], "t").subagents[0]).toMatchObject({ id: "child", parentId: "t", path: "worker", status: "running" });
    expect(projectAgentOverview([start(), call(2), done, call(5, { tool: "followupTask" })], "t").subagents[0]?.status).toBe("pending");
    expect(projectAgentOverview([start(), call(2), done, call(5, { id: "followup", tool: "followupTask" }), call(6, { id: "followup", tool: "followupTask", status: "failed" }, "item/completed")], "t").subagents[0]?.status).toBe("unknown");
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
      expect(projectAgentOverview([...initial, ...late, call(7, { id: "current-wait", tool: "wait" }), call(8, { id: "current-wait", tool: "wait", agentsStates: { child: { status: "completed" } } }, "item/completed")], "t").subagents[0]?.status).toBe("completed");
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
        expect(projectAgentOverview([...initial, late, call(4, { id: "current-wait", tool: "wait" }), call(5, { id: "current-wait", tool: "wait", agentsStates: { child: { status } } }, "item/completed")], "t").subagents[0]?.status).toBe(status === "errored" ? "failed" : status);
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
    const events = [start(), call(2, { id: "spawn", agentsStates: { child: { status: "running" } } }), event(3, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), call(4, { id: "spawn", agentsStates: { child: { status: "completed" } } }, "item/completed")];
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


test("이전 Subagent 호출의 중복 완료는 현재 후속 작업을 종료하지 않는다", () => {
  const rows = [start(), call(2, { id: "A", agentsStates: { child: { status: "running" } } }), call(3, { id: "A", agentsStates: { child: { status: "completed" } } }, "item/completed"), call(4, { id: "B", tool: "followupTask", agentsStates: { child: { status: "running" } } }), call(5, { id: "A", agentsStates: { child: { status: "completed" } } }, "item/completed"), call(6, { id: "B", tool: "followupTask", agentsStates: { child: { status: "running" } } })];
  expect(projectAgentOverview(rows, "t").subagents[0]?.status).toBe("running");
  expect(projectAgentOverview([...rows, call(7, { id: "B", tool: "followupTask", agentsStates: { child: { status: "completed" } } }, "item/completed")], "t").subagents[0]?.status).toBe("completed");
});
test("선택이 verify로 바뀌면 build 진행 선언의 현재성은 미확인이다", () => {
  const rows = [start(), ...(["build", "verify"] as const).map((phase, index) => event(index + 2, "www/developmentStage", { threadId: "t", turnId: "a", source: "role_declaration", workId: "work-36d312bc-a767-4e3e-a581-01898b35f75f", phase, status: "running", attemptId: `attempt-${phase}` }))];
  const html = renderToStaticMarkup(createElement(ResourceActivitySidebar, { events: rows, resources: null, threadId: "t", sending: false, hidden: false, onOpenMonitor() {} }));
  expect(html.match(/data-skill-id="www-build"[\s\S]*?<\/li>/)?.[0]).toContain("현재 상태 미확인");
  expect(html.match(/data-skill-id="www-verify"[\s\S]*?<\/li>/)?.[0]).not.toContain("현재 상태 미확인");
});


test("시작 사건을 볼 수 없는 이전 호출의 완료는 현재 후속 작업을 정산하지 않는다", () => {
  const active = call(2, { id: "new-operation", tool: "sendInput", agentsStates: { child: { status: "running", message: "현재 작업" } } });
  const late = call(3, { id: "omitted-old-operation", tool: "sendInput", agentsStates: { child: { status: "completed", message: "이전 결과" } } }, "item/completed");
  expect(projectAgentOverview([start(), active, late], "t").subagents[0]).toMatchObject({ status: "running", message: "현재 작업" });
});

test("저장된 실제 Subagent 공개 결과를 복원 parser부터 완료 표시까지 유지한다", () => {
  const rows = restoreConversationEvents("t", [{ id: "a", status: "completed", items: [{ id: "call", type: "collabAgentToolCall", tool: "spawnAgent", senderThreadId: "t", receiverThreadIds: ["child"], status: "completed", agentsStates: { child: { status: "completed" } } }, { id: "activity", type: "subAgentActivity", agentThreadId: "child", agentPath: "worker", kind: "completed" }] }], true).map((row, index) => ({ ...row, seq: index + 1, at: `time-${index}` }));
  expect(projectAgentOverview(rows, "t").subagents[0]).toMatchObject({ id: "child", parentId: "t", path: "worker", status: "completed", historical: true });
});


for (const status of ["errored", "running"] as const) test(`복원된 후속 Subagent의 ${status} 결과는 이전 성공을 대체한다`, () => {
  const operation = (id: string, state: string) => ({ id, type: "collabAgentToolCall", tool: "sendInput", senderThreadId: "t", receiverThreadIds: ["child"], status: "completed", agentsStates: { child: { status: state, message: id } } });
  const rows = restoreConversationEvents("t", [{ id: "a", status: "completed", items: [operation("A", "completed"), operation("B", status)] }], true).map((row, index) => ({ ...row, seq: index + 1, at: `time-${index}` }));
  expect(projectAgentOverview(rows, "t").subagents[0]).toMatchObject({ id: "child", status: status === "errored" ? "failed" : "unknown", message: "B", historical: true });
});
test("시작을 확인하지 못한 이전 activity는 대기 중인 후속 호출을 시작하지 않는다", () => {
  const first = call(2, { id: "A", agentsStates: { child: { status: "completed" } } }, "item/completed");
  const next = call(3, { id: "B", tool: "followupTask", agentsStates: { child: { status: "completed" } } });
  const before = [start(), first, next];
  for (const kind of ["started", "interacted"]) {
    const late = item(4, { id: "late-A", type: "subAgentActivity", agentThreadId: "child", kind, agentPath: "worker" });
    expect(projectAgentOverview([...before, late], "t").subagents[0]).toMatchObject({ status: "pending", path: "worker" });
  }
});
test("시작을 보지 못한 다른 호출의 완료가 현재 확정 결과를 덮지 않는다", () => {
  const earlier = call(2, { id: "unseen-A", tool: "sendInput", receiverThreadIds: [] });
  const next = call(3, { id: "B", tool: "followupTask", agentsStates: { child: { status: "running" } } });
  const finished = call(4, { id: "B", tool: "followupTask", agentsStates: { child: { status: "completed", message: "B 결과" } } }, "item/completed");
  const late = call(5, { id: "unseen-A", tool: "sendInput", agentsStates: { child: { status: "errored", message: "A 결과" } } }, "item/completed");
  for (const prior of [[], [earlier]]) {
    expect(projectAgentOverview([start(), ...prior, next, finished, late], "t").subagents[0]).toMatchObject({ status: "completed", message: "B 결과" });
  }
});
test("활성 계획 항목이 없어도 Native의 공개 설명을 Progress에 표시한다", () => {
  for (const steps of [[], [{ step: "검증", status: "pending" }]]) {
    const projected = projectAgentOverview([start(), plan(2, steps, "검증 대상을 확인하고 있습니다.")], "t");
    expect(projected.progress).toMatchObject({ text: "검증 대상을 확인하고 있습니다.", planIndex: null, source: "plan-explanation" });
  }
});
test("이전 Subagent activity 완료 재전송은 후속 작업을 정산하지 않는다", () => {
  const a = item(2, { id: "activity-A", type: "subAgentActivity", agentThreadId: "child", agentPath: "worker", kind: "completed" }, "item/completed");
  const b = call(3, { id: "operation-B", tool: "sendInput", agentsStates: { child: { status: "running", message: "B" } } });
  const rows = [start(), a, b, { ...a, seq: 4 }];
  expect(projectAgentOverview(rows, "t").subagents[0]).toMatchObject({ status: "running", message: "B" });
  const completed = item(5, { id: "activity-B", type: "subAgentActivity", agentThreadId: "child", agentPath: "worker", kind: "completed" }, "item/completed");
  expect(projectAgentOverview([...rows, completed], "t").subagents[0]?.status).toBe("unknown");
  expect(projectAgentOverview([...rows, completed, call(6, { id: "operation-B", tool: "sendInput", agentsStates: { child: { status: "completed" } } }, "item/completed")], "t").subagents[0]?.status).toBe("completed");
});
test("Subagent opaque 식별자는 다른 턴의 새 호출과 activity를 전역 중복으로 버리지 않는다", () => {
  const first = call(2, { id: "reused", agentsStates: { child: { status: "completed" } } }, "item/completed");
  const next = { ...call(4, { id: "reused", tool: "sendInput", agentsStates: { child: { status: "running" } } }), params: { ...first.params as object, turnId: "b", item: { ...(first.params as { item: object }).item, tool: "sendInput", agentsStates: { child: { status: "running" } } } } };
  expect(projectAgentOverview([start(), first, start(3, "b"), next], "t").subagents[0]?.status).toBe("running");
});


test("다른 턴의 opaque activity도 현재 호출의 완료를 확정하지 않는다", () => {
  const a = item(2, { id: "reused-activity", type: "subAgentActivity", agentThreadId: "child", agentPath: "worker", kind: "completed" }, "item/completed");
  const b = call(4, { id: "B", tool: "sendInput", agentsStates: { child: { status: "running" } } }, "item/started");
  const scopedB = { ...b, params: { ...b.params as object, turnId: "b" } };
  const actualB = { ...a, seq: 6, params: { ...a.params as object, turnId: "b" } };
  const rows = [start(), a, start(3, "b"), scopedB, { ...a, seq: 5 }];
  expect(projectAgentOverview(rows, "t").subagents[0]?.status).toBe("running");
  expect(projectAgentOverview([...rows, actualB], "t").subagents[0]?.status).toBe("unknown");
});
test("식별자가 없는 완료 activity와 늦은 역사 호출은 현재 Subagent를 종료하지 않는다", () => {
  const b = call(2, { id: "B", tool: "sendInput", agentsStates: { child: { status: "running" } } });
  const invalid = item(3, { type: "subAgentActivity", agentThreadId: "child", agentPath: "worker", kind: "completed" }, "item/completed");
  const old = call(4, { id: "old", tool: "sendInput", agentsStates: { child: { status: "errored" } } }, "item/completed", true);
  expect(projectAgentOverview([start(), b, invalid, old], "t").subagents[0]?.status).toBe("running");
});

 test("첫 늦은 terminal activity는 현재 Subagent 작업 완료의 근거가 아니다", () => {
  const rows = [start(), call(2, { id: "B", tool: "followupTask", agentsStates: { child: { status: "running" } } }), item(3, { id: "late-A", type: "subAgentActivity", agentThreadId: "child", agentPath: "worker", kind: "completed" }, "item/completed")];
  expect(projectAgentOverview(rows, "t").subagents[0]?.status).toBe("unknown");
  expect(projectAgentOverview([...rows, call(4, { id: "B", tool: "followupTask", agentsStates: { child: { status: "completed" } } }, "item/completed")], "t").subagents[0]?.status).toBe("completed");
 });
 test("이미 완료한 commentary 재전송은 현재 Progress를 되돌리지 않는다", () => {
  const a = item(3, { id: "A", type: "agentMessage", phase: "commentary", text: "A 완료" }, "item/completed");
  const rows = [start(), plan(2, [{ step: "구현", status: "inProgress" }]), a, item(4, { id: "B", type: "agentMessage", phase: "commentary", text: "B 진행" })];
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("B 진행");
  expect(projectAgentOverview([...rows, { ...a, seq: 5 }], "t").progress?.text).toBe("B 진행");
 });

 test("이전 작업 wait의 늦은 완료와 terminal-only wait는 현재 후속 작업을 닫지 않는다", () => {
  const a = call(2, { id: "A", agentsStates: { child: { status: "completed" } } }, "item/completed");
  const wait = call(3, { id: "wait-A", tool: "wait", agentsStates: {} });
  const b = call(4, { id: "B", tool: "followupTask", agentsStates: { child: { status: "running", message: "B" } } });
  for (const id of ["wait-A", "unseen-wait"]) {
    const late = call(5, { id, tool: "wait", agentsStates: { child: { status: "completed" } } }, "item/completed");
    const rows = [start(), a, wait, b, late, { ...late, seq: 6 }];
    expect(projectAgentOverview(rows, "t").subagents[0]).toMatchObject({ status: "running", message: "B" });
    expect(projectAgentOverview([...rows, call(7, { id: "B", tool: "followupTask", agentsStates: { child: { status: "completed" } } }, "item/completed")], "t").subagents[0]?.status).toBe("completed");
  }
  const currentWait = call(5, { id: "wait-B", tool: "wait", agentsStates: { child: { status: "running" } } });
  const done = call(6, { id: "wait-B", tool: "wait", agentsStates: { child: { status: "completed" } } }, "item/completed");
  expect(projectAgentOverview([start(), a, wait, b, currentWait, done], "t").subagents[0]?.status).toBe("completed");
 });
 test("이전 commentary의 첫 완료도 현재 Progress를 덮지 않는다", () => {
  const delta = (seq: number, id: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: id });
  const rows = [start(), plan(2, [{ step: "구현", status: "inProgress" }]), delta(3, "A"), delta(4, "B")];
  for (const text of ["A 최초 완료", ""]) {
    const done = item(5, { id: "A", type: "agentMessage", phase: "commentary", text }, "item/completed");
    expect(projectAgentOverview([...rows, done], "t").progress?.text).toBe("B");
    expect(projectAgentOverview([...rows, done, { ...done, seq: 6 }], "t").progress?.text).toBe("B");
  }
  expect(projectAgentOverview([...rows, item(5, { id: "B", type: "agentMessage", phase: "commentary", text: "B 완료" }, "item/completed")], "t").progress?.text).toBe("B 완료");
  expect(projectAgentOverview([...rows, item(5, { id: "C", type: "agentMessage", phase: "commentary", text: "새 C 완료" }, "item/completed")], "t").progress?.text).toBe("새 C 완료");
 });

 test("wait 귀속은 동일 호출의 turn과 thread를 지키고 started 재전송으로 바뀌지 않는다", () => {
  const a = call(2, { id: "A", agentsStates: { child: { status: "running" } } });
  const wait = call(3, { id: "wait", tool: "wait" });
  const b = call(4, { id: "B", tool: "followupTask", agentsStates: { child: { status: "running", message: "B" } } });
  const done = call(6, { id: "wait", tool: "wait", agentsStates: { child: { status: "completed" } } }, "item/completed");
  expect(projectAgentOverview([start(), a, wait, b, { ...wait, seq: 5 }, done], "t").subagents[0]?.status).toBe("running");
  for (const params of [{ threadId: "other" }, { turnId: "other" }]) {
    const scoped = { ...done, params: { ...done.params as object, ...params } };
    expect(projectAgentOverview([start(), a, wait, scoped], "t").subagents[0]?.status).toBe("running");
  }
 });
 test("본문 없는 이전 commentary 시작의 첫 완료도 최신 Progress를 덮지 않는다", () => {
  const rows = [start(), plan(2, [{ step: "구현", status: "inProgress" }]), item(3, { id: "A", type: "agentMessage", phase: "commentary" }), item(4, { id: "B", type: "agentMessage", phase: "commentary", text: "B" }), item(5, { id: "A", type: "agentMessage", phase: "commentary", text: "A 완료" }, "item/completed")];
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("B");
 });

 test("본문 없는 현재 commentary의 최초 완료와 새 completed-only는 정산한다", () => {
  const rows = [start(), plan(2, [{ step: "구현", status: "inProgress" }]), item(3, { id: "A", type: "agentMessage", phase: "commentary" })];
  const done = item(4, { id: "A", type: "agentMessage", phase: "commentary", text: "A 완료" }, "item/completed");
  expect(projectAgentOverview([...rows, done], "t").progress?.text).toBe("A 완료");
  expect(projectAgentOverview([...rows, { ...done, params: { ...done.params as object, threadId: "other" } }], "t").progress).toBeNull();
 });

 for (const superseded of [false, true]) test(`다중 Agent wait는 ${superseded ? "한 Agent 후속 작업을 보존하고 다른 Agent만" : "서로 다른 현재 operation을 모두"} 정산한다`, () => {
  const spawn = (seq: number, id: string, receiver: string) => call(seq, { id, receiverThreadIds: [receiver], agentsStates: { [receiver]: { status: "running" } } });
  const wait = (seq: number, method: string) => call(seq, { id: "both-wait", tool: "wait", receiverThreadIds: ["a", "b"], agentsStates: method === "item/completed" ? { a: { status: "completed" }, b: { status: "completed" } } : {} }, method);
  const rows = [start(), spawn(2, "spawn-a", "a"), spawn(3, "spawn-b", "b"), wait(4, "item/started")];
  const states = (events: AppEvent[]) => Object.fromEntries(projectAgentOverview(events, "t").subagents.map(agent => [agent.id, agent.status]));
  if (!superseded) {
    expect(states([...rows, wait(5, "item/completed")])).toEqual({ a: "completed", b: "completed" });
    return;
  }
  const followup = call(5, { id: "a2", tool: "followupTask", receiverThreadIds: ["a"], agentsStates: { a: { status: "running" } } });
  expect(states([...rows, followup, wait(6, "item/completed")])).toEqual({ a: "running", b: "completed" });
  expect(states([...rows, followup, wait(6, "item/completed"), wait(7, "item/completed")])).toEqual({ a: "running", b: "completed" });
 });

for (const linked of [false, true]) test(`A/B/A 늦은 delta는 현재 Progress를 되돌리지 않는다: 계획 연결 ${linked}`, () => {
  const delta = (seq: number, id: string, value: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: value });
  const rows = [start(), ...(linked ? [plan(2, [{ step: "구현", status: "inProgress" }])] : []), delta(3, "A", "A 앞"), delta(4, "A", "뒤")];
  expect(projectAgentOverview(rows, "t").progress).toMatchObject({ text: "A 앞뒤", planIndex: linked ? 0 : null });
  rows.push(delta(5, "B", "B 앞"), delta(6, "A", "늦은 A 조각"));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("B 앞");
  rows.push(delta(7, "B", "뒤"));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("B 앞뒤");
  rows.push(item(8, { id: "A", type: "agentMessage", phase: "commentary", text: "늦은 A 완료" }, "item/completed"));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("B 앞뒤");
  rows.push(item(9, { id: "B", type: "agentMessage", phase: "commentary", text: "B 정식 완료" }, "item/completed"));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("B 정식 완료");
  rows.push(delta(10, "C", "새 C 설명"), delta(11, "B", "완료 뒤 B 조각"));
  expect(projectAgentOverview(rows, "t").progress).toMatchObject({ text: "새 C 설명", planIndex: linked ? 0 : null });
});

// v6: 현재 Progress의 등장 순서·정지/재개·실제 완료를 함께 대조한다.
for (const linked of [false, true]) for (const initialText of [undefined, ""]) for (const delivery of ["delta", "completed"]) test(`v6 F4 본문없는 B 시작과 정상 후속: ${linked}/${initialText}/${delivery}`, () => {
  const delta = (seq: number, id: string, text: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: text });
  const rows = [start(), ...(linked ? [plan(2, [{ step: "구현", status: "inProgress" }])] : []), delta(3, "A", "A 설명"), item(4, { id: "B", type: "agentMessage", phase: "commentary", ...(initialText === undefined ? {} : { text: initialText }) })];
  rows.push(delivery === "delta" ? delta(5, "B", "B 설명") : item(5, { id: "B", type: "agentMessage", phase: "commentary", text: "B 설명" }, "item/completed"));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("B 설명");
  rows.push(delta(6, "A", "늦은 A"), item(7, { id: "A", type: "agentMessage", phase: "commentary", text: "늦은 A 완료" }, "item/completed"));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("B 설명");
});
for (const explanation of [undefined, "새 계획 설명"]) for (const delivery of ["delta", "completed", "empty"]) test(`v6 F5 계획 설명 순서 경계: ${explanation}/${delivery}`, () => {
  const delta = (seq: number, id: string, text: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: text });
  const rows = [start(), plan(2, [{ step: "구현", status: "inProgress" }]), delta(3, "A", "A 설명"), plan(4, [{ step: "구현", status: "inProgress" }], explanation)];
  rows.push(delivery === "delta" ? delta(5, "A", " 추가") : item(5, { id: "A", type: "agentMessage", phase: "commentary", text: delivery === "empty" ? "" : "A 정식 완료" }, "item/completed"));
  expect(projectAgentOverview(rows, "t").progress?.text ?? null).toBe(explanation ?? (delivery === "delta" ? "A 설명 추가" : delivery === "empty" ? null : "A 정식 완료"));
  rows.push(delta(6, "B", "새 B"));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("새 B");
});
for (const paused of ["delta", "started", "completed", "plan"]) test(`v6 F3 정지 구간 ${paused}를 재개 뒤 소급 수용하지 않는다`, () => {
  const saved = restoreConversationEvents("t", [{ id: "a", status: "inProgress", items: [{ id: "A", type: "agentMessage", phase: "commentary", text: "A 기존" }] }], true).map((row, index) => ({ ...row, seq: index + 1, at: `saved-${index}` }));
  const delta = (seq: number, id: string, text: string) => event(seq, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: id, phase: "commentary", delta: text });
  const late = paused === "delta" ? delta(10, "B", "정지 중 B") : paused === "plan" ? plan(10, [{ step: "정지 중 계획", status: "inProgress" }], "정지 중 설명") : item(10, { id: "B", type: "agentMessage", phase: "commentary", text: "정지 중 B" }, paused === "started" ? "item/started" : "item/completed");
  const rows = [...saved, late];
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("A 기존");
  rows.push(start(20));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("A 기존");
  expect(projectAgentOverview(rows, "t").planState).toBe("unprovided");
  rows.push(delta(21, "C", "재개 후 C"));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("재개 후 C");
  rows.push({ ...event(22, "turn/completed", { threadId: "t", turn: { id: "a", status: "unknown" } }), historical: true }, delta(23, "D", "두 번째 정지 D"), start(24));
  expect(projectAgentOverview(rows, "t").progress?.text).toBe("재개 후 C");
});
for (const definite of [false, true]) for (const actualBeforeResume of [false, true]) for (const boundary of ["valid", "EOF", "terminal", "scope"]) test(`v6 F6 합성 완료만 같은 scope 재개에서 해제: ${definite}/${actualBeforeResume}/${boundary}`, () => {
  const scope = { connectionGeneration: 7, processEpoch: "p", sessionId: "s", workspaceKey: "w", selectionEpoch: 1 };
  const saved = restoreConversationEvents("t", [{ id: "a", status: boundary === "terminal" ? "completed" : "inProgress", items: [{ id: "A", type: "agentMessage", phase: "commentary", text: "A 기존", ...(definite ? { completedAtMs: 100 } : {}) }] }], true).map((row, index) => ({ ...row, ...scope, seq: index + 1, at: `saved-${index}` }));
  const completed = { ...item(10, { id: "A", type: "agentMessage", phase: "commentary", text: "실제 완료" }, "item/completed"), ...scope };
  const rows = [...saved, ...(actualBeforeResume ? [completed] : []), ...(boundary === "EOF" ? [{ ...event(11, "transport/closed", {}), ...scope }] : []), { ...start(20), ...scope, ...(boundary === "scope" ? { connectionGeneration: 8 } : {}) }, { ...event(21, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase: "commentary", delta: " 추가" }), ...scope }];
  expect(projectAgentOverview(rows, "t").progress?.text).toBe(!definite && !actualBeforeResume && boundary === "valid" ? "A 기존 추가" : "A 기존");
});

test("별개의 본문 없는 설명으로 완료돼도 기존 진행 설명을 보존한다", () => {
  const delta = event(3, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase: "commentary", delta: "A 설명" });
  for (const explanation of [undefined, "새 계획 설명"]) {
    const rows = [start(), plan(2, [{ step: "구현", status: "inProgress" }]), delta, ...(explanation ? [plan(4, [{ step: "구현", status: "inProgress" }], explanation)] : []), item(5, { id: "B", type: "agentMessage", phase: "commentary" }), item(6, { id: "B", type: "agentMessage", phase: "commentary", text: "" }, "item/completed")];
    expect(projectAgentOverview(rows, "t").progress?.text ?? null).toBe(explanation ?? "A 설명");
  }
});
test("같은 thread와 turn의 다른 연결에서 온 계획은 현재 설명과 연결하지 않는다", () => {
  const current = { connectionGeneration: 3, processEpoch: "p", sessionId: "s", workspaceKey: "w", selectionEpoch: 1 };
  const other = { ...current, connectionGeneration: 4 };
  const first = { ...plan(2, [{ step: "현재 계획", status: "inProgress" }], "현재 설명"), ...current };
  const stale = { ...plan(3, [{ step: "다른 연결", status: "inProgress" }]), ...other };
  const view = projectAgentOverview([{ ...start(), ...current }, first, stale], "t");
  expect(view.plan.map(step => step.step)).toEqual(["현재 계획"]);
  expect(view.progress).toMatchObject({ text: "현재 설명", planIndex: 0 });
});

test("v6 실제 terminal과 EOF는 후행 unknown 이력으로 재개되지 않는다", () => {
  for (const end of [event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "completed" } }), event(4, "transport/closed", {})]) {
    const rows = [start(), item(3, { id: "A", type: "agentMessage", phase: "commentary", text: "기존" }), end, event(5, "transport/connected", {}), { ...event(6, "turn/completed", { threadId: "t", turn: { id: "a", status: "unknown" } }), historical: true }, start(7), event(8, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase: "commentary", delta: "늦음" })];
    expect(projectAgentOverview(rows, "t").progress?.text).toBe("기존");
  }
});

for (const field of ["connectionGeneration", "processEpoch", "sessionId", "workspaceKey", "selectionEpoch"] as const) test(`v6 개요도 재개 뒤 다른 ${field}의 설명·계획을 받지 않는다`, () => {
  const scope = { connectionGeneration: 7, processEpoch: "p", sessionId: "s", workspaceKey: "w", selectionEpoch: 1 };
  const changed = field === "connectionGeneration" || field === "selectionEpoch" ? { [field]: 99 } : { [field]: "other" };
  const saved = restoreConversationEvents("t", [{ id: "a", status: "inProgress", items: [{ id: "A", type: "agentMessage", phase: "commentary", text: "기존" }] }], true).map((row, index) => ({ ...row, ...scope, seq: index + 1, at: `saved-${index}` }));
  const rows = [...saved, { ...start(20), ...scope }, { ...event(21, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase: "commentary", delta: " 정상" }), ...scope }];
  const foreign = [{ ...event(22, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase: "commentary", delta: " 타 scope" }), ...scope, ...changed }, { ...item(23, { id: "A", type: "agentMessage", phase: "commentary", text: "타 scope 완료" }, "item/completed"), ...scope, ...changed }, { ...plan(24, [{ step: "타 scope 계획", status: "inProgress" }], "타 scope 설명"), ...scope, ...changed }];
  const result = projectAgentOverview([...rows, ...foreign], "t");
  expect(result.progress?.text).toBe("기존 정상");
  expect(result.planState).toBe("unprovided");
});
for (const text of ["실제 완료", ""]) test(`v6 개요의 열린 구간 실제 완료는 unknown 재개 뒤에도 유지한다: ${text}`, () => {
  const rows = [start(), event(2, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase: "commentary", delta: "기존" }), item(3, { id: "A", type: "agentMessage", phase: "commentary", text }, "item/completed"), { ...event(4, "turn/completed", { threadId: "t", turn: { id: "a", status: "unknown" } }), historical: true }, start(5), event(6, "item/agentMessage/delta", { threadId: "t", turnId: "a", itemId: "A", phase: "commentary", delta: " 늦음" })];
  expect(projectAgentOverview(rows, "t").progress?.text ?? null).toBe(text || null);
});
