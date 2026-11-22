/**
 * @verifies RESP-CHAT-ACTIVITY-CATALOG
 */
import { describe, expect, test } from "bun:test";
import {
  ActivitySnapshotBoundary,
  consumeActivitySidebarPulses,
  createActivitySidebarState,
  parseHooksListResponse,
  parseSkillsListResponse,
  projectActivitySidebar,
  projectActivitySidebarState,
  updateActivitySidebarSnapshot,
  updateActivitySidebarState,
} from "../src/activity-sidebar";
import type { AppEvent } from "../src/shared";

function event(seq: number, method: string, params: unknown): AppEvent {
  return { seq, method, params, at: `2026-11-12T00:00:${String(seq).padStart(2, "0")}Z`, kind: "notification" };
}

const skills = event(1, "activity/skillsListed", { complete: true, skills: [
  { name: "first", path: "/skills/first/SKILL.md", enabled: true, scope: "repo" },
  { name: "second", path: "/skills/second/SKILL.md", enabled: false, scope: "user" },
] });

const hooks = event(2, "activity/hooksListed", { complete: true, threadId: null, hooks: [
  { key: "stop", eventName: "stop", sourcePath: "/hooks.json", displayOrder: 1, handlerType: "command", enabled: true, source: "project" },
  { key: "pre-tool", eventName: "preToolUse", sourcePath: "/hooks.json", displayOrder: 2, handlerType: "command", enabled: true, source: "project" },
] });

function skillRead(seq: number, itemId = "read", path = "/skills/first/SKILL.md", threadId = "thread"): AppEvent {
  return event(seq, "item/started", { threadId, turnId: "turn", item: { id: itemId, type: "commandExecution", commandActions: [{ type: "read", path }] } });
}

function hookStart(seq: number, id = "run", overrides: Record<string, unknown> = {}): AppEvent {
  return event(seq, "hook/started", { threadId: "thread", turnId: "turn", run: { id, eventName: "preToolUse", sourcePath: "/hooks.json", displayOrder: 2, handlerType: "command", executionMode: "sync", status: "running", ...overrides } });
}

function fillers(firstSeq: number, count: number): AppEvent[] {
  return Array.from({ length: count }, (_, index) => event(firstSeq + index, "account/rateLimits/updated", {}));
}

function pulseRows(result: ReturnType<typeof projectActivitySidebar>): { seq: number; rowId: string }[] {
  return result.pulses.map(({ seq, rowId }) => ({ seq, rowId }));
}

describe("Skills와 Hook 활동 사이드바 투영", () => {
  test("이미 watermark 100이어도 snapshot에 없던 큐 전용 live 98·99는 한 번 반응한다", () => {
    const current = updateActivitySidebarState(createActivitySidebarState(), [event(100, "account/updated", {})]) ;
    const live    = [skillRead(98, "queued-read"), hookStart(99, "queued-hook")]                                  ;
    const batch   = { snapshot: [event(101, "thread/configured", { threadId: "thread" })], live }                 ;
    const next    = updateActivitySidebarSnapshot(current, batch)                                                 ;
    expect(next.pulses.map((pulse) => pulse.seq)                                 ).toEqual([98, 99]   ) ;
    expect(next.processedThrough                                                 ).toBe   (101        ) ;
    expect(projectActivitySidebarState(next, "thread").skills[0]?.lastActivitySeq).toBe   (98         ) ;
    expect(projectActivitySidebarState(next, "thread").hooks[0]?.lastActivitySeq ).toBe   (99         ) ;
    expect(updateActivitySidebarSnapshot(next, batch).pulses                     ).toEqual(next.pulses) ;
    expect(current.pulses                                                        ).toEqual([]         ) ;
    expect(current.processedThrough                                              ).toBe   (100        ) ;
  });

  test("watermark 아래 snapshot은 관측만 복원하고 이미 알려진 동일 seq 사건은 재반응하지 않는다", () => {
    const known    = hookStart                    (100, "known-seq"                                           ) ;
    const current  = updateActivitySidebarState   (createActivitySidebarState(), [known]                      ) ;
    const restored = hookStart                    (99, "restored-hook", { eventName: "stop", displayOrder: 1 }) ;
    const next     = updateActivitySidebarSnapshot(current, { snapshot: [restored], live: [restored, known] } ) ;
    expect(next.pulses                                                                                           ).toEqual([] ) ;
    expect(projectActivitySidebarState(next, "thread").hooks.find((row) => row.label === "stop")?.lastActivitySeq).toBe   (99 ) ;
    expect(next.processedThrough                                                                                 ).toBe   (100) ;
    const replay = updateActivitySidebarSnapshot(next, { snapshot: [], live: [restored] });
    expect(replay.pulses).toEqual([]);
  });

  test("늦은 큐 활동은 최근 관측과 완료된 handler를 되감지 않고 이미 수신한 시작은 재생하지 않는다", () => {
    const current = updateActivitySidebarState(createActivitySidebarState(), [
      hookStart(97, "completed"),
      event(98, "hook/completed", { threadId: "thread", turnId: "turn", run: { id: "completed" } }),
      hookStart(100, "latest"),
    ], { emitPulses: true });
    const next = updateActivitySidebarSnapshot(current, { snapshot: [], live: [
      hookStart(97, "completed"), hookStart(99, "earlier"),
    ] });
    expect(next.pulses.map((pulse) => pulse.seq)                                                       ).toEqual     ([97, 100, 99]) ;
    expect(projectActivitySidebarState(next, "thread").hooks[0]?.lastActivitySeq                       ).toBe        (100          ) ;
    expect(next.hookLifecycles.flatMap((bucket) => [...bucket.values()]).filter((run) => run.completed)).toHaveLength(1            ) ;
    expect(current.pulses.map((pulse) => pulse.seq)                                                    ).toEqual     ([97, 100]    ) ;
  });

  test("낮은 seq의 미수신 Hook 시작·완료는 이미 더 나중인 handler 상태를 다시 열거나 닫지 않는다", () => {
    const running = updateActivitySidebarState(createActivitySidebarState(), [hookStart(100, "handler")], { emitPulses: true });
    const lateCompletion = updateActivitySidebarSnapshot(running, { snapshot: [], live: [
      event(99, "hook/completed", { threadId: "thread", turnId: "turn", run: { id: "handler" } }),
      hookStart(101, "handler"),
    ] });
    expect(lateCompletion.pulses.map((pulse) => pulse.seq)).toEqual([100]);
    expect(lateCompletion.hookLifecycles.flatMap((bucket) => [...bucket.values()])[0]?.completed).toBe(false);

    const closed = updateActivitySidebarState(createActivitySidebarState(), [
      hookStart(97, "handler"),
      event(100, "hook/completed", { threadId: "thread", turnId: "turn", run: { id: "handler" } }),
    ], { emitPulses: true });
    const lateStart = updateActivitySidebarSnapshot(closed, { snapshot: [], live: [hookStart(99, "handler")] });
    expect(lateStart.pulses.map((pulse) => pulse.seq)                                      ).toEqual([97]                    ) ;
    expect(lateStart.hookLifecycles.flatMap((bucket) => [...bucket.values()])[0]?.completed).toBe   (true                    ) ;
    expect(closed.hookLifecycles                                                           ).toBe   (lateStart.hookLifecycles) ;
    expect(running.pulses.map((pulse) => pulse.seq)                                        ).toEqual([100]                   ) ;
  });

  test("UI pulse cursor는 seq 100 뒤 새 99를 수용하고 리렌더·대화 재진입은 재생하지 않는다", () => {
    const seen    = new Set<string>()                                                                                         ;
    const current = updateActivitySidebarState(createActivitySidebarState(), [hookStart(100, "first")], { emitPulses: true }) ;
    expect(consumeActivitySidebarPulses(projectActivitySidebarState(current, "thread").pulses, seen).map((pulse) => pulse.seq)).toEqual([100]);
    const next   = updateActivitySidebarSnapshot(current, { snapshot: [], live: [hookStart(99, "late")] }) ;
    const pulses = projectActivitySidebarState(next, "thread").pulses                                      ;
    expect(consumeActivitySidebarPulses(pulses, seen).map((pulse) => pulse.seq)).toEqual([99]) ;
    expect(consumeActivitySidebarPulses(pulses, seen)                          ).toEqual([]  ) ;
    expect(consumeActivitySidebarPulses([], seen)                              ).toEqual([]  ) ;
    expect(consumeActivitySidebarPulses(pulses, seen)                          ).toEqual([]  ) ;
  });

  test("UI cursor는 전역 pulse 보존 상한 512개로 제한하고 다른 대화에 다녀와도 과거 pulse를 재생하지 않는다", () => {
    const seen = new Set<string>()            ;
    let state  = createActivitySidebarState() ;
    for (let seq = 1; seq <= 600; seq += 1) {
      const threadId = seq % 2 ? "A" : "B"              ;
      const value    = hookStart(seq, `handler-${seq}`) ;
      state = updateActivitySidebarState(state, [{ ...value, params: { ...value.params as Record<string, unknown>, threadId } }], { emitPulses: true });
      expect(consumeActivitySidebarPulses(projectActivitySidebarState(state, threadId).pulses, seen, state.pulses).map((pulse) => pulse.seq)).toEqual([seq]);
      expect(seen.size).toBeLessThanOrEqual(512);
    }
    for (const thread of ["A", "B", "A"]) expect(consumeActivitySidebarPulses(projectActivitySidebarState(state, thread).pulses, seen, state.pulses)).toEqual([]);
    expect(state.pulses).toHaveLength(512);
    expect(seen.size).toBe(512);
  });

  test("UI는 선택하지 않았던 대화의 보존 pulse를 재생하지 않고 그 대화의 새 낮은 seq만 반응한다", () => {
    const seen = new Set<string>();
    const start = (seq: number, id: string, threadId: string): AppEvent => {
      const value = hookStart(seq, id);
      return { ...value, params: { ...value.params as Record<string, unknown>, threadId } };
    };
    const current = updateActivitySidebarState(createActivitySidebarState(), [start(99, "old-B", "B"), start(100, "A", "A")], { emitPulses: true });
    expect(consumeActivitySidebarPulses(projectActivitySidebarState(current, "A").pulses, seen, current.pulses).map((pulse) => pulse.seq)).toEqual([100]);
    expect(consumeActivitySidebarPulses(projectActivitySidebarState(current, "B").pulses, seen, current.pulses)).toEqual([]);
    const next = updateActivitySidebarSnapshot(current, { snapshot: [], live: [start(98, "new-B", "B")] });
    expect(consumeActivitySidebarPulses(projectActivitySidebarState(next, "B").pulses, seen, next.pulses).map((pulse) => pulse.seq)).toEqual([98]);
    expect(consumeActivitySidebarPulses(projectActivitySidebarState(next, "A").pulses, seen, next.pulses)).toEqual([]);
  });

  test("개별 Hook 완료 없이 turn이 끝나도 다른 turn의 첫 시작은 반응하고 이전 turn은 되돌아오지 않는다", () => {
    for (const [startedAt, laterTime] of [[undefined, undefined], [100, 101], ["2026-11-12T00:00:00Z", "2026-11-12T00:00:01Z"]]) {
      const start = (seq: number, turnId: string, time = startedAt): AppEvent => {
        const value = hookStart(seq, "handler", { startedAt: time });
        return { ...value, at: "2026-11-12T00:00:00Z", params: { ...value.params as Record<string, unknown>, turnId } };
      };
      const end       = (seq: number, turnId: string, time = startedAt) => event(seq, "hook/completed", { threadId: "thread", turnId, run: { id: "handler", startedAt: time } })     ;
      const first     = updateActivitySidebarState(createActivitySidebarState(), [start(1, "A")], { emitPulses: true })                                                              ;
      const turnEnded = updateActivitySidebarState(first, [event(2, "turn/completed", { threadId: "thread", turn: { id: "A", status: "completed" } })])                              ;
      const before    = turnEnded.hookLifecycles.map((bucket) => [...bucket])                                                                                                        ;
      const next      = updateActivitySidebarState(turnEnded, [start(3, "B"), start(4, "B"), start(5, "A", laterTime), end(6, "A", laterTime), start(7, "B")], { emitPulses: true }) ;
      expect(next.pulses.map((pulse) => pulse.seq)).toEqual([1, 3]);
      expect(projectActivitySidebarState(next, "thread").hooks[0]?.lastActivitySeq).toBe(3);
      const lifecycle = (state: typeof first) => state.hookLifecycles.flatMap((bucket) => [...bucket.values()]);
      expect(lifecycle(turnEnded)                                 ).toEqual      (lifecycle(first)                                ) ;
      expect(lifecycle(turnEnded)[0]                              ).toMatchObject({ turnId: "A", started: true, completed: false }) ;
      expect(lifecycle(next)[0]                                   ).toMatchObject({ turnId: "B", started: true, completed: false }) ;
      expect(turnEnded.hookLifecycles.map((bucket) => [...bucket])).toEqual      (before                                          ) ;
      expect(first.pulses.map((pulse) => pulse.seq)               ).toEqual      ([1]                                             ) ;
      const restarted = updateActivitySidebarState(next, [end(8, "B"), start(9, "B"), start(10, "B")], { emitPulses: true });
      expect(restarted.pulses.map((pulse) => pulse.seq)).toEqual([1, 3]);
    }
  });

  test("다른 turn의 완료 선관측은 활성 Hook을 닫지 않고 해당 turn의 늦은 시작만 억제한다", () => {
    for (const [startedAt, newerTime] of [[undefined, undefined], [100, 101], ["2026-11-12T00:00:00Z", "2026-11-12T00:00:01Z"]]) {
      const start = (seq: number, turnId: string, time = startedAt): AppEvent => {
        const value = hookStart(seq, "handler", { startedAt: time });
        return { ...value, at: "2026-11-12T00:00:00Z", params: { ...value.params as Record<string, unknown>, turnId } };
      };
      const first          = updateActivitySidebarState(createActivitySidebarState(), [start(1, "A")], { emitPulses: true })                                              ;
      const completion     = event(2, "hook/completed", { threadId: "thread", turnId: "B", run: { id: "handler", startedAt } })                                           ;
      const completedFirst = updateActivitySidebarState(first, [completion])                                                                                              ;
      const before         = completedFirst.hookLifecycles.map((bucket) => [...bucket])                                                                                   ;
      const active         = (state: typeof first) => state.hookLifecycles.flatMap((bucket) => [...bucket]).find(([key]) => key === "hook\u0000thread\u0000handler")?.[1] ;
      expect(active(completedFirst)).toEqual(active(first));
      expect(active(completedFirst)).toMatchObject({ turnId: "A", completed: false });
      const late = updateActivitySidebarState(completedFirst, [start(3, "B"), start(4, "A")], { emitPulses: true });
      expect(late.pulses.map((pulse) => pulse.seq)).toEqual([1]);
      expect(projectActivitySidebarState(late, "thread").hooks[0]?.lastActivitySeq).toBe(1);
      const closedA = updateActivitySidebarState(late, [
        event(5, "hook/completed", { threadId: "thread", turnId: "A", run: { id: "handler", startedAt } }), start(6, "B"),
      ], { emitPulses: true });
      expect(closedA.pulses.map((pulse) => pulse.seq)).toEqual([1]);
      // B의 완료 선관측은 C 전환 뒤에도 남고, 시각이 명확히 더 새로우면 B의 새 실행을 허용한다.
      const other = updateActivitySidebarState(closedA, [start(7, "C"), start(8, "B")], { emitPulses: true });
      expect(other.pulses.map((pulse) => pulse.seq)).toEqual([1, 7]);
      if (newerTime !== undefined) {
        const newer = updateActivitySidebarState(other, [start(9, "B", newerTime), start(10, "B", newerTime), start(11, "A", newerTime)], { emitPulses: true });
        expect(newer.pulses.map((pulse) => pulse.seq)).toEqual([1, 7, 9]);
        expect(active(newer)).toMatchObject({ turnId: "B", startedAt: typeof newerTime === "number" ? newerTime : Date.parse(newerTime), completed: false });
        const restarted = updateActivitySidebarState(newer, [
          event(12, "hook/completed", { threadId: "thread", turnId: "B", run: { id: "handler", startedAt: newerTime } }), start(13, "B", newerTime),
          event(14, "hook/completed", { threadId: "thread", turnId: "B", run: { id: "handler", startedAt } }), start(15, "B", newerTime),
        ], { emitPulses: true });
        expect(restarted.pulses.map((pulse) => pulse.seq)).toEqual([1, 7, 9]);
        expect(active(restarted)?.completed).toBe(true);
      }
      expect(completedFirst.hookLifecycles.map((bucket) => [...bucket])).toEqual(before);
      expect(first.hookLifecycles.flatMap((bucket) => [...bucket.values()])).toHaveLength(1);
    }
  });

  test("다른 turn의 historical 완료는 live 상태를 되감거나 새 turn의 첫 시작을 막지 않는다", () => {
    const start = (seq: number, turnId: string): AppEvent => {
      const value = hookStart(seq, "handler", { startedAt: 100 });
      return { ...value, params: { ...value.params as Record<string, unknown>, turnId } };
    };
    const restored = updateActivitySidebarSnapshot(createActivitySidebarState(), { snapshot: [start(1, "A")], live: [] }) ;
    const live     = updateActivitySidebarState   (restored, [start(2, "B")], { emitPulses: true }                      ) ;
    expect(live.pulses.map((pulse) => pulse.seq)).toEqual([2]);
    const replay = updateActivitySidebarSnapshot(live, { snapshot: [
      start(3, "C"),
      event(4, "hook/completed", { threadId: "thread", turnId: "C", run: { id: "handler", startedAt: 100 } }),
    ], live: [] });
    const next = updateActivitySidebarState(replay, [start(5, "B"), start(6, "C"), start(7, "A")], { emitPulses: true });
    expect(next.pulses.map((pulse) => pulse.seq)).toEqual([2, 6]             ) ;
    expect(replay.hookLifecycles                ).toBe   (live.hookLifecycles) ;
    expect(restored.pulses                      ).toEqual([]                 ) ;
  });

  test("snapshot 완료 선관측은 보존하고 새 연결 세대에서만 늦은 시작 억제를 회수한다", () => {
    const start = (seq: number, turnId: string): AppEvent => {
      const value = hookStart(seq, "handler", { startedAt: 100 });
      return { ...value, params: { ...value.params as Record<string, unknown>, turnId } };
    };
    const restored = updateActivitySidebarSnapshot(createActivitySidebarState(), { snapshot: [
      event(1, "transport/connected", { connectionGeneration: 1 }), start(2, "A"),
      event(3, "hook/completed", { threadId: "thread", turnId: "B", run: { id: "handler", startedAt: 100 } }),
    ], live: [] });
    const before = restored.hookLifecycles.map((bucket) => [...bucket]);
    const same = updateActivitySidebarState(restored, [
      event(4, "transport/connected", { connectionGeneration: 1, restored: true }), start(5, "B"),
    ], { emitPulses: true });
    expect(same.pulses).toEqual([]);
    const reset = updateActivitySidebarState(same, [
      event(6, "transport/connected", { connectionGeneration: 2 }), start(7, "B"),
    ], { emitPulses: true });
    expect(reset.pulses.map((pulse) => pulse.seq)).toEqual([7]);
    expect(restored.hookLifecycles.map((bucket) => [...bucket])).toEqual(before);
  });

  test("재사용 handler는 식별 근거 없는 같은 turn 재전송을 무시하고 다른 turn에 반응한다", () => {
    for (const startedAt of [undefined, 100, "2026-11-12T00:00:00Z"]) for (const nextTurn of ["turn", "next-turn"]) {
      const start = (seq: number, turnId: string): AppEvent => {
        const value = hookStart(seq, "handler", { startedAt });
        return { ...value, at: "2026-11-12T00:00:00Z", params: { ...value.params as Record<string, unknown>, turnId } };
      };
      const first  = updateActivitySidebarState(createActivitySidebarState(), [start(1, "turn")], { emitPulses: true }                                        ) ;
      const closed = updateActivitySidebarState(first, [event(2, "hook/completed", { threadId: "thread", turnId: "turn", run: { id: "handler", startedAt } })]) ;
      const next   = updateActivitySidebarState(closed, [start(3, nextTurn), start(4, nextTurn)], { emitPulses: true }                                        ) ;
      expect(next.pulses.map((pulse) => pulse.seq)                                                           ).toEqual     (nextTurn === "turn" ? [1] : [1, 3]) ;
      expect(projectActivitySidebarState(next, "thread").hooks[0]?.lastActivitySeq                           ).toBe        (nextTurn === "turn" ? 1 : 3       ) ;
      expect(first.pulses.map((pulse) => pulse.seq)                                                          ).toEqual     ([1]                               ) ;
      expect(closed.pulses.map((pulse) => pulse.seq)                                                         ).toEqual     ([1]                               ) ;
      expect([...first.hookLifecycles.flatMap((bucket) => [...bucket.values()])].map((run) => run.completed) ).toEqual     ([false]                           ) ;
      expect([...closed.hookLifecycles.flatMap((bucket) => [...bucket.values()])].map((run) => run.completed)).toEqual     ([true]                            ) ;
      expect(next.hookLifecycles.filter((bucket, index) => bucket !== closed.hookLifecycles[index])          ).toHaveLength(nextTurn === "turn" ? 0 : 1       ) ;
    }
  });

  test("과거 turn 재수신은 시각이 없거나 같은 초여도 새 실행이 아니다", () => {
    for (const startedAt of [undefined, 100]) {
      const start = (seq: number, turnId: string): AppEvent => {
        const value = hookStart(seq, "handler", { startedAt });
        return { ...value, params: { ...value.params as Record<string, unknown>, turnId } };
      };
      const end    = (seq: number, turnId: string) => event(seq, "hook/completed", { threadId: "thread", turnId, run: { id: "handler", startedAt } })                                           ;
      const first  = updateActivitySidebarState(createActivitySidebarState(), [event(0, "transport/connected", { connectionGeneration: 1 }), start(1, "A"), end(2, "A")], { emitPulses: true }) ;
      const before = first.dedupe.buckets.map((bucket) => [...bucket])                                                                                                                          ;
      const replay = updateActivitySidebarState(first, [start(3, "B"), end(4, "B"), start(5, "A")], { emitPulses: true })                                                                       ;
      expect(replay.pulses.map((pulse) => pulse.seq)).toEqual([1, 3]);
      expect(first.dedupe.buckets.map((bucket) => [...bucket])).toEqual(before);
      const state = updateActivitySidebarState(replay, [start(6, "C"), end(7, "C"), start(8, "C")], { emitPulses: true });
      expect(state.pulses.map((pulse) => pulse.seq)).toEqual([1, 3, 6]);
      const reset = updateActivitySidebarState(state, [event(9, "transport/connected", { connectionGeneration: 9 }), start(10, "A")], { emitPulses: true });
      expect(reset.pulses.at(-1)?.seq).toBe(10);
    }
  });

  test("historical 완료 뒤 같은 시각의 live 재전송은 억제하고 새 시각만 허용한다", () => {
    const restored = updateActivitySidebarSnapshot(createActivitySidebarState(), { snapshot: [
      hookStart(1, "handler", { startedAt: 100 }),
      event(2, "hook/completed", { threadId: "thread", turnId: "turn", run: { id: "handler", startedAt: 100 } }),
    ], live: [] });
    expect(restored.pulses).toEqual([]);
    const next = updateActivitySidebarState(restored, [hookStart(3, "handler", { startedAt: 100 })], { emitPulses: true });
    expect(next.pulses.map((pulse) => pulse.seq)).toEqual([]);
    const replay = updateActivitySidebarSnapshot(next, { snapshot: [
      { ...hookStart(4, "handler", { startedAt: 100 }), historical: true },
      event(5, "hook/completed", { threadId: "thread", run: { id: "handler", startedAt: 100 } }),
    ], live: [] });
    const duplicate = updateActivitySidebarState(replay, [hookStart(6, "handler", { startedAt: 100 })], { emitPulses: true });
    expect(duplicate.pulses.map((pulse) => pulse.seq)).toEqual([]);
    const fresh = updateActivitySidebarState(duplicate, [hookStart(7, "handler", { startedAt: 200 })], { emitPulses: true });
    expect(fresh.pulses.map((pulse) => pulse.seq)).toEqual([7]);
  });

  test("구조화 시작 시각은 이전 실행의 늦은 시작·완료와 완료 선관측을 구분한다", () => {
    const start = (seq: number, startedAt: number) => hookStart(seq, "handler", { startedAt })                                                                ;
    const end   = (seq: number, startedAt: number) => event(seq, "hook/completed", { threadId: "thread", turnId: "turn", run: { id: "handler", startedAt } }) ;
    const state = updateActivitySidebarState(createActivitySidebarState(), [
      start(1, 100), end(2, 100), start(3, 101), end(4, 100), start(5, 100), start(6, 101), end(7, 101), start(8, 102),
      event(9, "hook/completed", { threadId: "thread", turnId: "turn", run: { id: "completion-first", startedAt: 103 } }),
      hookStart(10, "completion-first", { startedAt: 103 }),
      hookStart(11, "completion-first", { startedAt: 104 }),
    ], { emitPulses: true });
    expect(state.pulses.map((pulse) => pulse.seq)).toEqual([1, 3, 8, 11]);
  });

  test("전환 early return 큐는 boundary.queue 없이 성공·실패 경계로 전달된다", () => {
    for (const failed of [false, true]) {
      const boundary = new ActivitySnapshotBoundary()                                       ;
      const token    = boundary.begin()                                                     ;
      const arrived  = [hookStart(2, "live-only"), hookStart(3, "included")]                ;
      const snapshot = [arrived[1]!, event(4, "thread/configured", { threadId: "thread" })] ;
      // renderer.acceptEvent는 switching 중 외부 queuedEvents에만 넣고 반환한다.
      const batch = failed ? boundary.fail(token, arrived) : boundary.complete(token, snapshot, arrived);
      if (!batch) throw new Error("전환 batch가 필요합니다.");
      const state = updateActivitySidebarSnapshot(createActivitySidebarState(), batch);
      expect(state.pulses.map((pulse) => pulse.seq)).toEqual(failed ? [2, 3] : [2]);
      expect(state.processedThrough).toBe(failed ? 3 : 4);
    }
  });

  test("등록 목록 순서를 유지하고 정확한 Skill path와 Hook tuple에 반응한다", () => {
    const result = projectActivitySidebar([skills, hooks, skillRead(3), hookStart(4)], "thread");
    expect(result.skills.map((row) => row.label)).toEqual(["first", "second"]   ) ;
    expect(result.hooks.map((row) => row.label) ).toEqual(["stop", "preToolUse"]) ;
    expect(result.skills[0]?.lastActivityLabel  ).toBe   ("읽기"                ) ;
    expect(result.skills[1]?.lastActivityLabel).toBeNull();
    expect(result.hooks[1]?.lastActivityLabel).toBe("시작");
    expect(pulseRows(result)).toEqual([
      { seq: 3, rowId: "skill:/skills/first/SKILL.md" },
      { seq: 4, rowId: "hook:pre-tool" },
    ]);
  });

  test("Skill 이름 언급·임의 문자열·완료와 같은 읽기 재수신은 새 반응이 아니다", () => {
    const mention = event(3, "item/started", { threadId: "thread", turnId: "turn", item: { id: "mention", type: "commandExecution", command: "echo first /skills/first/SKILL.md" } }) ;
    const request = event(4, "item/started", { threadId: "thread", turnId: "turn", item: { id: "request", type: "userMessage", content: [{ type: "skill", name: "first" }] } })       ;
    const read    = skillRead(5)                                                                                                                                                      ;
    const replay  = { ...read, seq: 6 }                                                                                                                                               ;
    const finish  = event(7, "item/completed", { threadId: "thread", turnId: "turn", item: { id: "read", type: "commandExecution", exitCode: 0 } })                                   ;
    const result  = projectActivitySidebar([skills, mention, request, read, replay, finish], "thread")                                                                                ;
    expect(pulseRows(result)).toEqual([{ seq: 5, rowId: "skill:/skills/first/SKILL.md" }]);
  });

  test("Hook 완료·중복·비동기·다른 thread·늦은 시작을 새 실행으로 처리하지 않는다", () => {
    const completedFirst = event(3, "hook/completed", { threadId: "thread", run: { id: "late" } })                                                   ;
    const lateStart      = hookStart(4, "late")                                                                                                      ;
    const first          = hookStart(5, "one")                                                                                                       ;
    const duplicate      = hookStart(6, "one")                                                                                                       ;
    const completed      = event(7, "hook/completed", { threadId: "thread", run: { id: "one" } })                                                    ;
    const asyncRun       = hookStart(8, "async", { executionMode: "async" })                                                                         ;
    const otherThread    = { ...hookStart(9, "other"), params: { ...(hookStart(9, "other").params as Record<string, unknown>), threadId: "other" } } ;
    const result         = projectActivitySidebar([hooks, completedFirst, lateStart, first, duplicate, completed, asyncRun, otherThread], "thread")  ;
    expect(pulseRows(result)).toEqual([{ seq: 5, rowId: "hook:pre-tool" }]);
  });

  test("등록 Hook 매핑이 불명확하면 기존 행을 추정하지 않고 감지 행을 추가한다", () => {
    const ambiguous = event(2, "activity/hooksListed", { complete: true, hooks: [
      { key: "a", eventName: "stop", sourcePath: "/same.json", displayOrder: 1, handlerType: "command", enabled: true },
      { key: "b", eventName: "stop", sourcePath: "/same.json", displayOrder: 1, handlerType: "command", enabled: true },
    ] });
    const started = hookStart             (3, "ambiguous", { eventName: "stop", sourcePath: "/same.json", displayOrder: 1 }) ;
    const result  = projectActivitySidebar([ambiguous, started], "thread"                                                  ) ;
    expect(result.hooks                                                         ).toHaveLength(3    ) ;
    expect(result.hooks.slice(0, 2).every((row) => row.lastActivitySeq === null)).toBe        (true ) ;
    expect(result.hooks[2]?.catalogued                                          ).toBe        (false) ;
    expect(result.pulses[0]?.rowId.startsWith("hook-observed:")                 ).toBe        (true ) ;
  });

  test("목록 실패는 감지 범위를 유지하고 등록 밖 읽기를 뒤에 추가한다", () => {
    const partial = event                 (1, "activity/skillsListed", { complete: false, skills: [{ name: "known", path: "/skills/known/SKILL.md", enabled: true, scope: "repo" }] }) ;
    const result  = projectActivitySidebar([partial, skillRead(2, "new", "C:\\skills\\new\\SKILL.md")], "thread"                                                                     ) ;
    expect(result.skillsComplete                ).toBe   (false           ) ;
    expect(result.skills.map((row) => row.label)).toEqual(["known", "new"]) ;
    expect(result.skills[1]?.catalogued         ).toBe   (false           ) ;
  });

  test("seq 중복과 다른 thread를 억제하고 연결·이력 상태를 분리한다", () => {
    const connected = event                 (5, "transport/connected", {}                                                                                       ) ;
    const read      = skillRead             (7                                                                                                                  ) ;
    const result    = projectActivitySidebar([connected, { ...skills, seq: 6 }, read, read, skillRead(8, "other", "/skills/second/SKILL.md", "other")], "thread") ;
    expect(result.transport       ).toBe   ("connected"                                        ) ;
    expect(result.historyTruncated).toBe   (true                                               ) ;
    expect(pulseRows(result)      ).toEqual([{ seq: 7, rowId: "skill:/skills/first/SKILL.md" }]) ;
  });

  test("중복 목록 식별자는 한 행만 남기고 전체 목록으로 주장하지 않는다", () => {
    const duplicateSkills = event(1, "activity/skillsListed", { complete: true, skills: [
      { name: "first", path: "/skills/first/SKILL.md", enabled: true },
      { name: "duplicate", path: "/skills/first/SKILL.md", enabled: true },
    ] });
    const duplicateHooks = event(2, "activity/hooksListed", { complete: true, hooks: [
      { key: "same", eventName: "stop", sourcePath: "/hooks.json", displayOrder: 1, handlerType: "command", enabled: true },
      { key: "same", eventName: "preToolUse", sourcePath: "/hooks.json", displayOrder: 2, handlerType: "command", enabled: true },
    ] });
    const result = projectActivitySidebar([duplicateSkills, duplicateHooks], "thread");
    expect(result.skills        ).toHaveLength(1    ) ;
    expect(result.hooks         ).toHaveLength(1    ) ;
    expect(result.skillsComplete).toBe        (false) ;
    expect(result.hooksComplete ).toBe        (false) ;
  });

  test("식별 메타데이터가 불완전한 Hook 시작은 행이나 반응을 만들지 않는다", () => {
    const malformed = hookStart             (3, "malformed", { sourcePath: "", displayOrder: null }) ;
    const result    = projectActivitySidebar([hooks, malformed], "thread"                          ) ;
    expect(result.hooks).toHaveLength(2);
    expect(pulseRows(result)).toEqual([]);
  });

  test("최근 사건 범위 밖으로 밀린 등록 snapshot을 목록 상태로 유지한다", () => {
    let state = updateActivitySidebarState(createActivitySidebarState(), [skills]);
    state     = updateActivitySidebarState(state, fillers(2, 2_000));
    const result = projectActivitySidebarState(state, "thread");
    expect(result.skills.map((row) => row.label)).toEqual(["first", "second"]);
    expect(result.skillsComplete).toBe(true);
  });

  test("선택 thread Hook 목록은 늦은 workspace 응답과 오래된 요청 세대보다 우선한다", () => {
    const threadHooks = event(3, "activity/hooksListed", { complete: true, requestGeneration: 2, scope: "thread", threadId: "thread", hooks: [
      { key: "thread-specific", eventName: "preToolUse", sourcePath: "/thread.json", displayOrder: 1, handlerType: "command", enabled: true },
    ] });
    const lateWorkspace = event(4, "activity/hooksListed", { complete: true, requestGeneration: 1, scope: "workspace", threadId: null, hooks: [
      { key: "workspace", eventName: "stop", sourcePath: "/workspace.json", displayOrder: 1, handlerType: "command", enabled: true },
    ] });
    const staleThread = event(5, "activity/hooksListed", { complete: true, requestGeneration: 1, scope: "thread", threadId: "thread", hooks: [
      { key: "stale", eventName: "sessionStart", sourcePath: "/stale.json", displayOrder: 1, handlerType: "command", enabled: true },
    ] });
    const result = projectActivitySidebar([threadHooks, lateWorkspace, staleThread], "thread");
    expect(result.hooks.map((row) => row.label)).toEqual(["preToolUse"]);
  });

  test("한 commandActions 사건의 여러 Skill 읽기를 모두 별도 행 반응으로 보존한다", () => {
    const multiple = event(3, "item/started", { threadId: "thread", turnId: "turn", item: { id: "multiple", type: "commandExecution", commandActions: [
      { type: "read", path: "/skills/first/SKILL.md" },
      { type: "read", path: "/skills/second/SKILL.md" },
    ] } });
    const result = projectActivitySidebar([skills, multiple], "thread");
    expect(pulseRows(result)).toEqual([
      { seq: 3, rowId: "skill:/skills/first/SKILL.md" },
      { seq: 3, rowId: "skill:/skills/second/SKILL.md" },
    ]);
  });

  test("연결 수명주기 동안 이력 절단 뒤 같은 Hook run과 완료 뒤 늦은 시작을 다시 반응시키지 않는다", () => {
    const completed = event    (3, "hook/completed", { threadId: "thread", run: { id: "late" } }) ;
    const first     = hookStart(4, "same"                                                       ) ;
    let state = updateActivitySidebarState(createActivitySidebarState(), [
      event(1, "transport/connected", {}),
      hooks,
      completed,
      first,
    ], { emitPulses: true });
    state = updateActivitySidebarState(state, fillers(5, 2_000), { emitPulses: true });
    state = updateActivitySidebarState(state, [
      hookStart(2_005, "same"),
      hookStart(2_006, "late"),
    ], { emitPulses: true });
    const result = projectActivitySidebarState(state, "thread");
    expect(pulseRows(result)).toEqual([{ seq: 4, rowId: "hook:pre-tool" }]);
  });

  test("Hook pulse 식별자는 늦은 catalog 매핑에도 안정적이고 새 연결에서는 같은 run ID를 다시 허용한다", () => {
    let state    = updateActivitySidebarState (createActivitySidebarState(), [event(1, "transport/connected", { connectionGeneration: 1 }), hookStart(2, "same")], { emitPulses: true }) ;
    const before = projectActivitySidebarState(state, "thread"                                                                                                                         ) ;
    state = updateActivitySidebarState(state, [{ ...hooks, seq: 3 }], { emitPulses: true });
    const catalogued = projectActivitySidebarState(state, "thread");
    expect(catalogued.pulses[0]?.id).toBe(before.pulses[0]?.id);
    expect(catalogued.pulses[0]?.rowId).toBe("hook:pre-tool");

    state = updateActivitySidebarState(state, [event(4, "transport/connected", { connectionGeneration: 2 }), hookStart(5, "same")], { emitPulses: true });
    expect(pulseRows(projectActivitySidebarState(state, "thread"))).toEqual([
      { seq: 2, rowId: "hook:pre-tool" },
      { seq: 5, rowId: "hook:pre-tool" },
    ]);
  });

  test("같은 transport 연결 세대의 대화 복원 표시는 Hook 중복 방지를 초기화하지 않는다", () => {
    let state = updateActivitySidebarState(createActivitySidebarState(), [
      event(1, "transport/connected", { connectionGeneration: 7 }),
      hookStart(2, "same"),
      event(3, "hook/completed", { threadId: "thread", run: { id: "same" } }),
    ], { emitPulses: true });
    state = updateActivitySidebarState(state, [
      event(4, "transport/connected", { connectionGeneration: 7, restored: true }),
      hookStart(5, "same"),
    ], { emitPulses: true, historySnapshot: true });
    expect(pulseRows(projectActivitySidebarState(state, "thread"))).toEqual([
      { seq: 2, rowId: "hook-observed:preToolUse%00%2Fhooks.json%002%00command" },
    ]);
  });

  test("2만 사건에서 처리·dedupe·관측 상태가 제한되고 오래된 Hook 시작은 재점멸하지 않는다", () => {
    const started = performance.now();
    let state = updateActivitySidebarState(createActivitySidebarState(), [
      event(1, "transport/connected", { connectionGeneration: 11 }),
      hookStart(2, "old-run"),
      event(3, "hook/completed", { threadId: "thread", run: { id: "late-run" } }),
    ], { emitPulses: true });
    for (let seq = 4; seq <= 20_003; seq += 1) {
      state = updateActivitySidebarState(state, [event(seq, "account/rateLimits/updated", {})], { emitPulses: true });
    }
    state = updateActivitySidebarState(state, [hookStart(20_004, "old-run"), hookStart(20_005, "late-run")], { emitPulses: true });
    const elapsedMs = performance.now() - started;
    expect(pulseRows(projectActivitySidebarState(state, "thread"))).toEqual([
      { seq: 2, rowId: "hook-observed:preToolUse%00%2Fhooks.json%002%00command" },
    ]);
    expect(state.processedThrough ).toBe               (20_005) ;
    expect(state.dedupe.buckets   ).toHaveLength       (64    ) ;
    expect(state.dedupe.size      ).toBe               (2     ) ;
    expect(state.observations.size).toBeLessThanOrEqual(512   ) ;
    expect(state.threadHooks.size ).toBeLessThanOrEqual(32    ) ;
    expect(elapsedMs              ).toBeLessThan       (5_000 ) ;
  });

  test("2만개 고유 Hook run을 모두 새 활동으로 반응하고 이전 run과 완료 후 느린 시작은 정확히 억제한다", () => {
    const started = performance.now();
    const hookRun = (seq: number, id: string): AppEvent => {
      const value = hookStart(seq, id);
      return { ...value, params: { ...(value.params as Record<string, unknown>), threadId: "t" } };
    };
    let observed = 0;
    let state = updateActivitySidebarState(createActivitySidebarState(), [
      event(1, "transport/connected", { connectionGeneration: 17 }),
    ], { emitPulses: true });
    for (let index = 0; index < 20_000; index += 1) {
      const seq = index + 2;
      state = updateActivitySidebarState(state, [hookRun(seq, `run-${index}`)], { emitPulses: true });
      if (state.pulses.at(-1)?.seq === seq) observed += 1;
    }
    state = updateActivitySidebarState(state, [
      hookRun(20_002, "run-0"),
      event(20_003, "hook/completed", { threadId: "t", run: { id: "late-before-start" } }),
      hookRun(20_004, "late-before-start"),
    ], { emitPulses: true });
    expect(observed                                           ).toBe        (20_000) ;
    expect(state.pulses.filter((pulse) => pulse.seq >= 20_002)).toEqual     ([]    ) ;
    expect(state.dedupe.size                                  ).toBe        (20_001) ;
    expect(performance.now() - started                        ).toBeLessThan(5_000 ) ;
  });

  test("live 사건이 먼저 와도 느린 bootstrap snapshot의 연결과 catalog를 안전하게 수용한다", () => {
    let state = updateActivitySidebarState(createActivitySidebarState(), [hookStart(3, "live")], { emitPulses: true });
    state = updateActivitySidebarState(state, [
      event(1, "transport/connected", { connectionGeneration: 19 }),
      { ...skills, seq: 2 },
    ], { historySnapshot: true });
    const result = projectActivitySidebarState(state, "thread");
    expect(result.transport                       ).toBe   ("connected"        ) ;
    expect(result.skills.map((row) => row.label)  ).toEqual(["first", "second"]) ;
    expect(result.pulses.map((pulse) => pulse.seq)).toEqual([3]                ) ;
  });

  test("bootstrap·전환 boundary는 snapshot과 대기 live를 seq로 병합하고 실패·재진입에서 live를 잃지 않는다", () => {
    const boundary  = new ActivitySnapshotBoundary() ;
    const bootstrap = boundary.begin()               ;
    expect(boundary.queue(hookStart(3, "live-after-snapshot"))).toBe(true);
    const batch = boundary.complete(bootstrap, [
      event(1, "transport/connected", { connectionGeneration: 23 }),
      { ...skills, seq: 2 },
    ]);
    if (!batch) throw new Error("bootstrap batch가 필요합니다.");
    let state = updateActivitySidebarSnapshot(createActivitySidebarState(), batch);
    expect(projectActivitySidebarState(state, "thread").pulses.map((pulse) => pulse.seq)).toEqual([3]);

    const failedSwitch = boundary.begin();
    expect(boundary.queue(hookStart(4, "live-during-failure"))).toBe(true);
    const failedBatch = boundary.fail(failedSwitch);
    if (!failedBatch) throw new Error("실패 boundary batch가 필요합니다.");
    state = updateActivitySidebarSnapshot(state, failedBatch);
    expect(projectActivitySidebarState(state, "thread").pulses.map((pulse) => pulse.seq)).toEqual([3, 4]);

    const firstEffect = boundary.begin();
    expect(boundary.queue(hookStart(5, "snapshot-era"))).toBe(true);
    boundary.cancel(firstEffect);
    const secondEffect = boundary.begin();
    expect(boundary.complete(firstEffect, [])).toBeNull();
    expect(boundary.queue(hookStart(6, "live-after-reentry"))).toBe(true);
    const restoredBatch = boundary.complete(secondEffect, [
      event(1, "transport/connected", { connectionGeneration: 23 }),
      hookStart(5, "snapshot-era"),
    ]);
    if (!restoredBatch) throw new Error("재진입 boundary batch가 필요합니다.");
    state = updateActivitySidebarSnapshot(state, restoredBatch);
    expect(projectActivitySidebarState(state, "thread").pulses.map((pulse) => pulse.seq)).toEqual([3, 4, 6]);
  });

  test("복원 snapshot보다 seq가 낮아도 snapshot에 없는 live 활동은 반응하고 포함된 활동은 재생하지 않는다", () => {
    const connected = updateActivitySidebarState(createActivitySidebarState(), [
      event(1, "transport/connected", { connectionGeneration: 31 }),
    ]);
    const live = hookStart(2, "during-restore");
    const snapshot = [
      event(3, "transport/status", { connectionGeneration: 31 }),
      event(4, "thread/configured", { threadId: "thread" }),
    ];
    const boundary = new ActivitySnapshotBoundary() ;
    const token    = boundary.begin()               ;
    expect(boundary.queue(live)).toBe(true);
    const batch = boundary.complete(token, snapshot);
    if (!batch) throw new Error("복원 batch가 필요합니다.");
    const observed = updateActivitySidebarSnapshot(connected, batch);
    expect(projectActivitySidebarState(observed, "thread").pulses.map((pulse) => pulse.seq)).toEqual([2]);
    const duplicated = updateActivitySidebarSnapshot(connected, { snapshot: [live, ...snapshot], live: [live] });
    expect(projectActivitySidebarState(duplicated, "thread").pulses).toEqual([]);
  });

  test("정확 dedupe는 바뀐 버킷만 copy-on-write하고 이전 state를 변경하지 않는다", () => {
    const previous = updateActivitySidebarState(createActivitySidebarState(), [
      event(1, "transport/connected", { connectionGeneration: 29 }),
    ]);
    const next = updateActivitySidebarState(previous, [hookStart(2, "first")], { emitPulses: true });
    expect(previous.dedupe.size                                                                    ).toBe        (0   ) ;
    expect(next.dedupe.size                                                                        ).toBe        (1   ) ;
    expect(next.dedupe.buckets.filter((bucket, index) => bucket !== previous.dedupe.buckets[index])).toHaveLength(1   ) ;
    expect(previous.dedupe.buckets.every((bucket) => bucket.size === 0)                            ).toBe        (true) ;
  });

  test("많은 고유 활동과 thread 목록에서도 관측·pulse·목록 보존 크기가 고정된다", () => {
    const activity = Array.from({ length: 700 }, (_, index) => skillRead(index + 2, `read-${index}`, `/skills/skill-${index}/SKILL.md`));
    const catalogs = Array.from({ length: 40 }, (_, index) => event(702 + index, "activity/hooksListed", {
      complete          : true              ,
      requestGeneration : index + 1         ,
      scope             : "thread"          ,
      threadId          : `thread-${index}` ,
      hooks             : []                ,
    }));
    const state = updateActivitySidebarState(createActivitySidebarState(), [
      event(1, "transport/connected", { connectionGeneration: 13 }),
      ...activity,
      ...catalogs,
    ], { emitPulses: true });
    expect(state.observations.size).toBe        (512) ;
    expect(state.pulses           ).toHaveLength(512) ;
    expect(state.threadHooks.size ).toBe        (32 ) ;
    expect(state.dedupe.size      ).toBe        (700) ;
    expect(state.dedupe.buckets   ).toHaveLength(64 ) ;
  });
});

describe("Skills와 Hook 목록 응답 검증", () => {
  const validSkill = { name: "first", path: "/skills/first/SKILL.md", description: "first", enabled: true, scope: "repo" }                                                                                                                                                          ;
  const validHook  = { key: "pre-tool", eventName: "preToolUse", sourcePath: "/hooks.json", displayOrder: 1, handlerType: "command", enabled: true, source: "project", currentHash: "hash", isManaged: false, timeoutSec: 5, trustStatus: "trusted", command: "run", async: false } ;

  test("정확한 cwd와 필수 배열이 있는 응답만 완전한 목록으로 수용한다", () => {
    expect(parseSkillsListResponse({ data: [{ cwd: "/repo", errors: [], skills: [validSkill] }] }, "/repo")).toEqual({
      complete: true,
      skills: [{ name: "first", path: "/skills/first/SKILL.md", enabled: true, scope: "repo" }],
    });
    expect(parseHooksListResponse({ data: [{ cwd: "/repo", errors: [], warnings: [], hooks: [validHook] }] }, "/repo")).toEqual({
      complete: true,
      hooks: [{ key: "pre-tool", eventName: "preToolUse", sourcePath: "/hooks.json", displayOrder: 1, handlerType: "command", enabled: true, source: "project" }],
    });
  });

  test("cwd 불일치와 skills·hooks·errors·warnings 누락을 불완전 응답으로 표시한다", () => {
    expect(parseSkillsListResponse({ data: [{ cwd: "/other", errors: [], skills: [validSkill] }] }, "/repo")).toEqual({ complete: false, skills: [] });
    expect(parseSkillsListResponse({ data: [{ cwd: "/repo", errors: [] }] }, "/repo")).toEqual({ complete: false, skills: [] });
    expect(parseHooksListResponse({ data: [{ cwd: "/repo", hooks: [validHook] }] }, "/repo")).toEqual({ complete: false, hooks: [
      { key: "pre-tool", eventName: "preToolUse", sourcePath: "/hooks.json", displayOrder: 1, handlerType: "command", enabled: true, source: "project" },
    ] });
  });
});

 test("상대 Skill 읽기는 유효 command cwd로 등록 identity에 반응한다", () => {
  const catalog = event(1, "activity/skillsListed", { complete: true, skills: [{ name: "demo", path: "/repo/skills/demo/SKILL.md", enabled: true, scope: "repo" }] });
  for (const cwd of ["/repo", "/other", "", "relative"]) for (const path of ["./skills/demo/SKILL.md", "skills/other/../demo/SKILL.md"]) {
    const read   = event                 (2, "item/started", { threadId: "thread", turnId: "turn", item: { id: "read", type: "commandExecution", cwd, commandActions: [{ type: "read", path }] } }) ;
    const result = projectActivitySidebar([catalog, read], "thread"                                                                                                                               ) ;
    expect(result.skills.find(row => row.id === "skill:/repo/skills/demo/SKILL.md")?.lastActivitySeq).toBe(cwd === "/repo" ? 2 : null);
  }
 });
