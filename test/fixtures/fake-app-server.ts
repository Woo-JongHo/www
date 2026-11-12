#!/usr/bin/env node
import { createInterface } from "node:readline";

const modeArgument   = process.argv[2]                                                                                      ;
const mode           = modeArgument && modeArgument !== "app-server" ? modeArgument : process.env.WWW_FAKE_MODE ?? "normal" ;
const interruptDelay = Number(process.env.WWW_FIXTURE_INTERRUPT_DELAY_MS ?? 0)                                              ;
if (!Number.isFinite(interruptDelay) || interruptDelay < 0 || interruptDelay > 10_000) throw new Error("중단 완료 지연은 0~10000ms여야 합니다.");
let interruptRequests = 0                                                                          ;
const lines           = createInterface({ input: process.stdin })                                  ;
const send            = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`) ;

lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    if (mode === "eof") process.exit(17);
    send({ jsonrpc: "2.0", id: message.id, result: { serverInfo: { name: "fixture" } } });
  } else if (message.method === "thread/start") {
    send({ jsonrpc: "2.0", id: message.id, result: { thread: { id: "thread-fixture" } } });
  } else if (message.method === "turn/start") {
    send({ jsonrpc: "2.0", id: message.id, result: { turn: { id: "turn-fixture" } } });
    send({ jsonrpc: "2.0", method: "turn/started",                      params: { threadId: "thread-fixture", turn: { id: "turn-fixture" } }                                                                                                                                                });
    send({ jsonrpc: "2.0", method: "item/started", params: { threadId: "thread-fixture", turnId: "turn-fixture", item: { id: "summary-1", type: "reasoning", summary: [], content: ["PRIVATE_REASONING_SENTINEL"] } } });
    send({ jsonrpc: "2.0", method: "item/reasoning/summaryPartAdded", params: { threadId: "thread-fixture", turnId: "turn-fixture", itemId: "summary-1", summaryIndex: 0 } });
    send({ jsonrpc: "2.0", method: "item/reasoning/summaryTextDelta", params: { threadId: "thread-fixture", turnId: "turn-fixture", itemId: "summary-1", summaryIndex: 0, delta: "공개 요약을 정리합니다." } });
    send({ jsonrpc: "2.0", method: "item/reasoning/textDelta", params: { threadId: "thread-fixture", turnId: "turn-fixture", itemId: "summary-1", delta: "PRIVATE_REASONING_SENTINEL" } });
    send({ jsonrpc: "2.0", method: "item/completed", params: { threadId: "thread-fixture", turnId: "turn-fixture", item: { id: "summary-1", type: "reasoning", summary: ["fixture 공개 추론 요약: 확인할 근거를 정리했습니다."], content: ["PRIVATE_REASONING_SENTINEL"] } } });
    send({ jsonrpc: "2.0", method: "item/agentMessage/delta",           params: { threadId: "thread-fixture", turnId: "turn-fixture", itemId: "comment-1", phase: "commentary", delta: "fixture 공개 설명" }                                                                                    });
    send({ jsonrpc: "2.0", method: "item/completed",                    params: { threadId: "thread-fixture", turnId: "turn-fixture", item: { id: "comment-1", type: "agentMessage", phase: "commentary", text: "fixture 공개 설명" } }                                                         });
    send({ jsonrpc: "2.0", method: "item/agentMessage/delta",           params: { threadId: "thread-fixture", turnId: "turn-fixture", itemId: "answer-1", delta: "안녕" }                                                                                                                     });
    send({ jsonrpc: "2.0", method: "item/agentMessage/delta",           params: { threadId: "thread-fixture", turnId: "turn-fixture", itemId: "answer-1", delta: "하세요" }                                                                                                                    });
    send({ jsonrpc: "2.0", method: "item/started",                      params: { threadId: "thread-fixture", turnId: "turn-fixture", item: { id: "command-1", type: "commandExecution", command: "printf fixture" } }                                                                      });
    send({ jsonrpc: "2.0", method: "item/commandExecution/outputDelta", params: { threadId: "thread-fixture", turnId: "turn-fixture", itemId: "command-1", delta: "fixture" }                                                                                                               });
    send({ jsonrpc: "2.0", method: "item/completed",                    params: { threadId: "thread-fixture", turnId: "turn-fixture", item: { id: "command-failed", type: "commandExecution", command: "node failing-check.ts", aggregatedOutput: "긴 실패 출력\n".repeat(6000), exitCode: 3 } } });
    send({ jsonrpc: "2.0", method: "item/started",                      params: { threadId: "thread-fixture", turnId: "turn-fixture", item: { id: "file-1", type: "fileChange", changes: [{ path: "fixture.txt", diff: "--- a/fixture.txt\n+++ b/fixture.txt\n+fixture\n" }] } }            });
    send({ jsonrpc: "2.0", method: "item/completed",                    params: { threadId: "thread-fixture", turnId: "turn-fixture", item: { id: "file-1", type: "fileChange", changes: [{ path: "fixture.txt", diff: "--- a/fixture.txt\n+++ b/fixture.txt\n+fixture\n" }] } }            });
    for (let index = 0; index < 40; index += 1) {
      send({ jsonrpc: "2.0", method: "item/completed", params: { threadId: "thread-fixture", turnId: "turn-fixture", item: { id: `history-${index}`, type: "agentMessage", text: `과거 응답 ${index + 1}` } } });
    }
    send({ jsonrpc: "2.0", id: 42, method: "item/commandExecution/requestApproval", params: { threadId: "thread-fixture", turnId: "turn-fixture", command: "printf fixture" } });
  } else if (message.method === "turn/interrupt") {
    interruptRequests += 1;
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    if (interruptDelay > 0) send({ jsonrpc: "2.0", method: "fixture/interruptRequest", params: { threadId: "thread-fixture", turnId: "turn-fixture", count: interruptRequests } });
    const completeInterrupt = () => send({ jsonrpc: "2.0", method: "turn/completed", params: { turn: { id: "turn-fixture", status: "interrupted" } } });
    if (interruptDelay > 0) setTimeout(completeInterrupt, interruptDelay);
    else completeInterrupt();
  } else if (message.id === 42) {
    send({ jsonrpc: "2.0", method: "item/completed",           params: { threadId: "thread-fixture", turnId: "turn-fixture", item: { id: "command-1", type: "commandExecution", command: "printf fixture", aggregatedOutput: "fixture", exitCode: 0 } } });
    send({ jsonrpc: "2.0", method: "fixture/approvalResponse", params: { idType: typeof message.id, decision: message.result?.decision }                                                                                                                });
    if (mode === "duplicate-approval") send({ jsonrpc: "2.0", id: 42, method: "item/commandExecution/requestApproval", params: { threadId: "thread-fixture", turnId: "turn-fixture", command: "printf fixture" } });
  }
});
