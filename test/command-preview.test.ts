/**
 * @verifies RESP-CHAT-MESSAGES-EXECUTION
 * @verifies RESP-CHAT-MESSAGES-PREVIEW
 */
import { describe, expect, test } from "bun:test";
import { commandOutput, commandPreview, jsonTokens, shellTokens } from "../src/command-preview";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandView } from "../src/command-card";
import { ChatRowMemoryContext } from "../src/chat-row-state";
import { project } from "../src/projection";
import type { AppEvent } from "../src/shared";

describe("명령 출력 미리보기", () => {
  test("빈 출력과 들여쓰기, CRLF, 긴 줄을 보존한다", () => {
    expect(commandPreview("", false)).toEqual({ text: "", hiddenLines: 0 });
    const output = "    들여쓰기\r\n\t탭\r\n" + "x".repeat(2000);
    expect(commandPreview(output, false).text).toBe(output.replace(/\r\n/g, "\n"));
  });
  test("1줄과 10줄은 생략하지 않고 종료 개행은 논리 줄로 세지 않는다", () => {
    for (const count of [1, 10]) {
      const output = Array.from({ length: count }, (_, index) => `  ${index}`).join("\n");
      expect(commandPreview(output + "\n", false)).toEqual({ text: output, hiddenLines: 0 });
    }
  });
  test("11줄과 대량 출력은 실행 중 최근 10줄, 종료 뒤 앞 10줄이다", () => {
    for (const count of [11, 10000]) {
      const lines = Array.from({ length: count }, (_, index) => `  ${index}`);
      expect(commandPreview(lines.join("\n"), true)).toEqual({ text: lines.slice(-10).join("\n"), hiddenLines: count - 10 });
      expect(commandPreview(lines.join("\n"), false)).toEqual({ text: lines.slice(0, 10).join("\n"), hiddenLines: count - 10 });
    }
  });
});

test("긴 출력은 한 영역에서 펼치며 짧은 출력에는 전환이 없다", () => {
  for (const count of [0, 10, 11]) {
    const output = Array.from({ length: count }, (_, index) => `줄-${index}`).join("\n");
    const block = project([{ seq: 1, at: "2026-11-13T00:00:00Z", kind: "notification", method: "item/completed", params: { item: { id: `cmd-${count}`, type: "commandExecution", status: "completed", exitCode: 0, aggregatedOutput: output } } }]).blocks[0];
    if (block?.kind !== "command") throw Error("명령 없음");
    const render = (open: boolean) => renderToStaticMarkup(createElement(ChatRowMemoryContext.Provider, { value: new Map([[block.id, open]]) }, createElement(CommandView, { block })));
    const collapsed = render(false);
    const expanded = render(true);
    expect((collapsed.match(/data-testid="command-preview"/g) ?? []).length).toBe(1         ) ;
    expect((expanded.match(/data-testid="command-preview"/g) ?? []).length ).toBe(1         ) ;
    expect(collapsed.includes("aria-expanded=")                            ).toBe(count > 10) ;
    expect(expanded.includes("aria-expanded=")                             ).toBe(count > 10) ;
    if (count > 10) {
      expect(collapsed                             ).not.toContain("줄-10") ;
      expect(expanded                              )    .toContain("줄-10") ;
      expect((expanded.match(/줄-0/g) ?? []).length)    .toBe     (1      ) ;
    }
  }
});

test("실패 명령은 기본 펼침이며 개별 기억은 기본값보다 우선한다", () => {
  const output = Array.from({ length: 11 }, (_, index) => `실패-${index}`).join("\n");
  const block = project([{ seq: 1, at: "2026-11-13T00:00:00Z", kind: "notification", method: "item/completed", params: { item: { id: "failed", type: "commandExecution", status: "failed", exitCode: 1, aggregatedOutput: output } } }]).blocks[0];
  if (block?.kind !== "command") throw Error("명령 없음");
  const render = (memory: Map<string, boolean>) => renderToStaticMarkup(createElement(ChatRowMemoryContext.Provider, { value: memory }, createElement(CommandView, { block })));
  expect(render(new Map())).toContain("실패-10");
  expect(render(new Map([[block.id, false]]))).not.toContain("실패-10");
});

test("짧은 원문 출력은 끝 개행과 들여쓰기를 그대로 표시한다", () => {
  const outputs = ["", "  한 줄\n", Array.from({ length: 10 }, (_, index) => `  줄 ${index}`).join("\n") + "\n", '{"value": 1}\n'];
  for (const [index, output] of outputs.entries()) {
    const block = project([{ seq: 1, at: "2026-11-13T00:00:00Z", kind: "notification", method: "item/completed", params: { item: { id: `short-${index}`, type: "commandExecution", status: "completed", exitCode: 0, aggregatedOutput: output } } }]).blocks[0];
    if (block?.kind !== "command") throw Error("명령 없음");
    const memory = new Map([[`${block.id}:raw-output`, true]]);
    const html = renderToStaticMarkup(createElement(ChatRowMemoryContext.Provider, { value: memory }, createElement(CommandView, { block })));
    const content = html.match(/<pre[^>]*data-testid="command-preview"[^>]*>([\s\S]*?)<\/pre>/)?.[1];
    expect(content?.replaceAll("&quot;", '"')).toBe(output || "출력 없음");
    expect(html).not.toContain("aria-expanded=");
  }
});

test("명령별 펼침과 JSON 원문 선택은 서로 독립적이다", () => {
  const output = JSON.stringify(Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`key${index}`, index])));
  const blocks = project(["first", "second"].map((id, index) => ({ seq: index + 1, at: "2026-11-13T00:00:00Z", kind: "notification" as const, method: "item/completed", params: { item: { id, type: "commandExecution", status: "completed", exitCode: 0, aggregatedOutput: output } } }))).blocks;
  const first = blocks[0];
  const second = blocks[1];
  if (first?.kind !== "command" || second?.kind !== "command") throw Error("명령 없음");
  const memory = new Map([[first.id, true], [`${second.id}:raw-output`, true]]);
  const render = (block: typeof first) => renderToStaticMarkup(createElement(ChatRowMemoryContext.Provider, { value: memory }, createElement(CommandView, { block })));
  const firstHtml = render(first);
  const secondHtml = render(second);
  expect(firstHtml )    .toContain("key11"               ) ;
  expect(firstHtml )    .toContain('aria-expanded="true"') ;
  expect(secondHtml)    .toContain('aria-pressed="true"' ) ;
  expect(secondHtml).not.toContain("aria-expanded="      ) ;
  expect(secondHtml)    .toContain("key11"               ) ;
});

test("원본 보관 한도 초과는 보관된 범위의 미리보기와 원본 줄 수 미확인으로 안내한다", () => {
  const output          = Array.from({ length: 10000 }, (_, index) => `  출력 ${index}`).join("\n")                                                                                                                                       ;
  const event: AppEvent = { seq: 1, at: "2026-11-13T00:00:00Z", kind: "notification", method: "item/completed", params: { item: { id: "large", type: "commandExecution", status: "completed", exitCode: 0, aggregatedOutput: output } } } ;
  const block           = project([event]).blocks[0]                                                                                                                                                                                      ;
  if (block?.kind !== "command") throw Error("명령 투영 없음");
  const html = renderToStaticMarkup(createElement(CommandView, { block }));
  expect(block.outputTruncated).toBe     (true                            ) ;
  expect(html                 ).toContain("보관된 출력의 앞 10줄 미리보기") ;
  expect(html                 ).toContain("보관 범위 안에서"              ) ;
  expect(html                 ).toContain("제거된 원본 줄 수는 미확인"    ) ;
  expect(html                 ).toContain("중간 줄에서 시작할 수 있습니다") ;
});

test("명령 거절과 턴 중단의 미확인 결과 문구를 구별한다", () => {
  for (const status of ["declined", "unknown"]) {
    const event: AppEvent = { seq: 1, at: "2026-11-13T00:00:00Z", kind: "notification", method: "item/completed", params: { item: { id: "stop", type: "commandExecution", status } } } ;
    const block           = project([event]).blocks[0]                                                                                                                                 ;
    if (block?.kind !== "command") throw Error("명령 투영 없음");
    if (status === "unknown") block.turnInterrupted = true;
    const html = renderToStaticMarkup(createElement(CommandView, { block }));
    expect(html).toContain(status === "declined" ? "거절" : "턴 중단 · 명령 결과 미확인");
  }
});


describe("명령 카드 구조화 출력", () => {
  test("숫자·중복 키·이스케이프 토큰을 바꾸지 않고 들여쓴다", () => {
    const raw = ' {"n":9007199254740993,"n":-0,"e":1e+09,"s":"\\u003cscript>\\n","a":[true,null,{},[]]}\n';
    const view = commandOutput(raw, false, false);
    expect(view.json                                              ).toBe     (true                                                ) ;
    expect(view.text                                              ).toContain('\n  "n": 9007199254740993,\n  "n": -0,'            ) ;
    expect(view.text                                              ).toContain('"e": 1e+09'                                        ) ;
    expect(view.text                                              ).toContain('"s": "\\u003cscript>\\n"'                          ) ;
    expect(JSON.parse(view.text)                                  ).toEqual  (JSON.parse(raw)                                     ) ;
    expect(jsonTokens(view.text).map(token => token.text).join('')).toBe     (view.text                                           ) ;
    expect(new Set(jsonTokens(view.text).map(token => token.kind))).toEqual  (new Set(['plain','key','number','string','literal'])) ;
  });
  test("일반 로그·NDJSON·스칼라·실시간·절단·깊이 제한은 원문 그대로다", () => {
    for (const raw of ['  log\n\tkeep', '{"a":', '{"a":1}\n{"b":2}', 'true', '"text"', '['.repeat(25)+'0'+']'.repeat(25), ' '.repeat(32768)+'{}']) {
      expect(commandOutput(raw, false, false)).toEqual({ text: raw, json: false, review: null });
    }
    for (const [running, truncated] of [[true,false],[false,true]]) {
      expect(commandOutput('{"a":1}', running, truncated)).toEqual({ text:'{"a":1}',json:false,review:null });
    }
  });
  test("검토 형태의 종료 출력만 판정을 보고하며 원문·프로세스 상태를 바꾸지 않는다", () => {
    for (const verdict of ['pass','fail','not_run'] as const) {
      const raw = JSON.stringify({id:'review-example',provider:'anthropic',model:'opus',verdict});
      expect(commandOutput(raw,false,false).review).toBe(verdict);
      expect(commandOutput(raw,true,false).review).toBeNull();
      const block = project([{seq:1,at:'2026-11-15T00:00:00Z',kind:'notification',method:'item/completed',params:{item:{id:'review',type:'commandExecution',command:'node --input-type=module -e \'test\'',status:'completed',exitCode:0,aggregatedOutput:raw}}}]).blocks[0];
      if (block?.kind !== 'command') throw Error('명령 없음');
      const html = renderToStaticMarkup(createElement(CommandView,{block}));
      expect(html        ).toContain('실행 종료'                                             ) ;
      expect(html        ).toContain('종료 코드 0'                                           ) ;
      expect(html        ).toContain({pass:'통과',fail:'수정 필요',not_run:'미실행'}[verdict]) ;
      expect(html        ).toContain('업무 완료를 보증하지 않습니다'                         ) ;
      expect(html        ).toContain('syntax-option'                                         ) ;
      expect(html        ).toContain('syntax-string'                                         ) ;
      expect(block.output).toBe     (raw                                                     ) ;
    }
    expect(commandOutput('{"verdict":"pass"}',false,false).review).toBeNull();
  });
  test("HTML은 텍스트로 이스케이프되고 명령 토큰은 원문을 보존한다", () => {
    const command = 'node --input-type=module -e \'console.log("<script>alert(1)</script>")\'';
    expect(shellTokens(command).map(token=>token.text).join('')).toBe(command);
    const block = project([{seq:1,at:'2026-11-15T00:00:00Z',kind:'notification',method:'item/completed',params:{item:{id:'xss',type:'commandExecution',command,status:'completed',exitCode:0,aggregatedOutput:'{"html":"<img src=x onerror=alert(1)>"}'}}}]).blocks[0];
    if (block?.kind !== 'command') throw Error('명령 없음');
    const html=renderToStaticMarkup(createElement(CommandView,{block}));
    expect(html).not.toContain('<script>' ) ;
    expect(html).not.toContain('<img'     ) ;
    expect(html)    .toContain('&lt;img'  ) ;
    expect(html)    .toContain('원문 보기') ;
    expect(html)    .toContain('원문 복사') ;
  });
});

test('JSON 정렬 팽창은 32768 표시 상한 안에서만 사용하고 보관 원문을 보존한다', () => {
  const raw = JSON.stringify(Array.from({length:7000},()=>0));
  expect(raw.length).toBeLessThan(32768);
  expect(commandOutput(raw,false,false)).toEqual({text:raw,json:false,review:null});
  const small = commandOutput(JSON.stringify({value:[1,2,3]}),false,false);
  expect(small.json).toBe(true);
  expect(small.text.length).toBeLessThanOrEqual(32768);
});
