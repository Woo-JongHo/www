import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { nativeThreadStartParams, nativeTurnStartParams } from "../src/native-chat";
import { project } from "../src/projection";
import { JsonRpcClient } from "../src/rpc";
import type { AppEvent } from "../src/shared";

test("Native params는 기존 권한·입력을 보존하며 진행 설명과 detailed 공개 요약만 요청한다", () => {
  const thread = nativeThreadStartParams("/workspace/한글");
  expect(thread                                           ).toEqual  ({ cwd: "/workspace/한글", approvalPolicy: "on-request", sandbox: "workspace-write", developerInstructions: expect.any(String) }) ;
  expect(thread.developerInstructions                     ).toContain("자연스러운 한국어"                                                                                                            ) ;
  expect(thread.developerInstructions                     ).toContain("실패하거나 방향을 바꾸면"                                                                                                     ) ;
  expect(thread.developerInstructions                     ).toContain("매 도구 호출마다 상투적인 문장을 반복하지"                                                                                    ) ;
  expect(nativeTurnStartParams("thread", " 사용자 원문\n")).toEqual  ({ threadId: "thread", input: [{ type: "text", text: " 사용자 원문\n", text_elements: [] }], summary: "detailed" }              ) ;
});

test("실제 stdio 사건의 공개 요약과 commentary를 투영하고 비공개 원문을 제외한다", async () => {
  const child = spawn(process.execPath, [join(import.meta.dir, "fixtures/fake-app-server.ts"), "app-server"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, WWW_FAKE_MODE: "normal" }
  });
  const rpc                 = new JsonRpcClient(child)     ;
  const events : AppEvent[] = []                           ;
  let timeout  : ReturnType<typeof setTimeout> | undefined ;
  const received = new Promise<void>((resolve) => {
    rpc.on("message", (message) => {
      if (typeof message.method !== "string") return;
      events.push({ seq: events.length + 1, at: new Date().toISOString(), kind: "notification", method: message.method, params: message.params });
      if (message.method === "item/commandExecution/requestApproval") resolve();
    });
  });
  try {
    await Promise.race([
      (async () => {
        await rpc.request("initialize", {});
        rpc.notify("initialized", {});
        expect(await rpc.request("thread/start", nativeThreadStartParams("/workspace/한글"))).toEqual({ thread: { id: "thread-fixture" } });
        expect(await rpc.request("turn/start", nativeTurnStartParams("thread-fixture", "진행 상황을 설명해 주세요."))).toEqual({ turn: { id: "turn-fixture" } });
        await received;
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Native stdio 사건 수신 시간 초과")), 2000);
      })
    ]);
    expect(events.some((event) => event.method === "item/reasoning/textDelta")).toBe(true);
    expect(JSON.stringify(events)).toContain("PRIVATE_REASONING_SENTINEL");
    const blocks = project(events).blocks;
    expect(blocks                )    .toContainEqual(expect.objectContaining({ kind: "explanation", source: "reasoningSummary", text: "fixture 공개 추론 요약: 확인할 근거를 정리했습니다." })) ;
    expect(blocks                )    .toContainEqual(expect.objectContaining({ kind: "explanation", source: "commentary", text: "fixture 공개 설명" })                                        ) ;
    expect(JSON.stringify(blocks)).not.toContain     ("PRIVATE_REASONING_SENTINEL"                                                                                                             ) ;
    expect(JSON.stringify(blocks)).not.toContain     ("item/reasoning/textDelta"                                                                                                               ) ;
  } finally {
    if (timeout) clearTimeout(timeout);
    child.kill();
  }
}, 5000);
