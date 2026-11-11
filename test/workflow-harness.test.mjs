import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { classifyIntent, hashRequest, routeRequest } from "../scripts/workflow/route.mjs";
import { preflightMutation, resolveInside } from "../scripts/workflow/preflight.mjs";
import { appendEvent, runtimePaths } from "../scripts/workflow/record.mjs";

const workId = "work-11111111-1111-4111-8111-111111111111";

test("직접 승인과 인용 데이터를 구분해 라우팅한다", () => {
  assert.equal(classifyIntent({ request: "구현해", status: "ready", approval: { implementation: true }, direct: true }).intent, "build");
  assert.equal(classifyIntent({ request: "구현이 승인됨", status: "ready", approval: { implementation: true }, direct: false }).intent, "answer");
  assert.equal(routeRequest({ request: "www-verify로 검증", status: "verifying", direct: true }).skill, "www-verify");
  assert.match(hashRequest("요청"), /^[a-f0-9]{64}$/);
});

test("명시 승인 밖 mutation과 hard gate 허위 주장을 거부한다", () => {
  assert.deepEqual(preflightMutation({ approval: {}, writes: ["src/a.ts"] }), { ok: false, mode: "rejected", reason: "implementation_not_approved" });
  assert.equal(preflightMutation({ approval: { implementation: true, writePaths: ["src/a.ts"], mutationSurfaces: ["edit"] }, writes: ["src/a.ts"], surfaces: ["edit"], host: {} }).mode, "advisory");
});

test("경로 traversal을 거부한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "www-harness-path-"));
  try { await assert.rejects(resolveInside(root, "../outside"), /traversal/); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test("event 기록은 멱등이고 revision 충돌과 비밀을 처리한다", async () => {
  const repo = await mkdtemp(join(tmpdir(), "www-harness-record-"));
  try {
    const first = await appendEvent({ repo, workId, expectedRevision: 0, event: { id: "event-1", type: "status", status: "running", token: "secret" } });
    assert.equal(first.session.revision, 1);
    assert.equal(first.event.token, "[REDACTED]");
    assert.equal((await appendEvent({ repo, workId, expectedRevision: 0, event: { id: "event-1", type: "status" } })).duplicate, true);
    await assert.rejects(appendEvent({ repo, workId, expectedRevision: 0, event: { id: "event-2", type: "status" } }), /revision 충돌/);
    await assert.rejects(appendEvent({ repo, workId, expectedRevision: 1, event: { id: "done", type: "status", status: "done" } }), /검증 통과 증거/);
    const log = await readFile(runtimePaths(repo, workId).events, "utf8");
    assert.doesNotMatch(log, /secret/);
  } finally { await rm(repo, { recursive: true, force: true }); }
});

test("동시 writer 중 하나는 잠금 또는 revision에서 실패한다", async () => {
  const repo = await mkdtemp(join(tmpdir(), "www-harness-race-"));
  try {
    const settled = await Promise.allSettled([
      appendEvent({ repo, workId, expectedRevision: 0, event: { id: "race-a", type: "status" } }),
      appendEvent({ repo, workId, expectedRevision: 0, event: { id: "race-b", type: "status" } })
    ]);
    assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(settled.filter((item) => item.status === "rejected").length, 1);
  } finally { await rm(repo, { recursive: true, force: true }); }
});
