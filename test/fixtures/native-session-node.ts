import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { selected, setup, start, until } from "./native-session-setup";

type Fixture = Awaited<ReturnType<typeof setup>>;

async function failureIsolation(s: Fixture) {
  const a = s.add("tab-a", s.first);
  const b = s.add("tab-b", s.second);
  const thread = await start(a);
  await assert.rejects(a.invoke("turn:start", [selected(a), thread, "전송 실패 확인"]), /합성 전송 실패/);
  assert.equal(a.summary().failed, true);
  assert.equal(b.summary().failed, false);
  assert.equal(a.summary().busy, false);
  await a.invoke("conversations:new", [selected(a)]);
  assert.equal(a.summary().failed, false);
}

async function steer(s: Fixture) {
  const session = s.add("steer", s.first);
  const thread = await start(session);
  const turn = await session.invoke("turn:start", [selected(session), thread, "Steer 중단 확인"]) as { turnId: string };
  const selection = selected(session);
  const text = "  추가 지시\n";
  assert.deepEqual(await session.invoke("turn:steer", [selection, thread, turn.turnId, text, "steer-1"]), { turnId: turn.turnId });
  await assert.rejects(session.invoke("turn:steer", [selection, thread, turn.turnId, text, "steer-1"]));
  await assert.rejects(session.invoke("turn:steer", [selection, thread, "wrong", text, "steer-2"]));
  await assert.rejects(session.invoke("turn:steer", [selection, thread, turn.turnId, "mismatch", "steer-3"]));
  await assert.rejects(session.invoke("turn:steer", [selection, thread, turn.turnId, "종료 경합", "steer-4"]), /턴 종료/);
  await until(() => !session.summary().busy);
  const events = s.events.filter(event => event.method.startsWith("turn/steer"));
  assert.ok(events.some(event => event.method === "turn/steerAccepted" && (event.params as { text?: string }).text === text));
  assert.ok(events.some(event => event.method === "turn/steerUncertain" && (event.params as { clientUserMessageId?: string }).clientUserMessageId === "steer-3"));
  const calls = (await readFile(join(s.first, "fixture-calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
  const requests = calls.filter(call => call.method === "turn/steer");
  assert.equal(requests.length, 3);
  assert.deepEqual(requests[0].params, { threadId: thread, expectedTurnId: turn.turnId, clientUserMessageId: "steer-1", input: [{ type: "text", text, text_elements: [] }] });
  assert.equal(calls.filter(call => call.method === "turn/start").length, 1);
}

const [scenario, directory] = process.argv.slice(2);
assert.ok((scenario === "failure-isolation" || scenario === "steer") && directory);
const fixture = await setup({}, directory);
let timer: ReturnType<typeof setTimeout> | undefined;
try {
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Native 세션 ${scenario} 응답 시간 초과`)), 3_500);
  });
  await Promise.race([(scenario === "failure-isolation" ? failureIsolation : steer)(fixture), timeout]);
} finally {
  clearTimeout(timer);
  await fixture.close();
}
console.log("WWW_NATIVE_SESSION_NODE", scenario);
