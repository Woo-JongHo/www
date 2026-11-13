import { describe, expect, test } from "bun:test";
import { commandPreview } from "../src/command-preview";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandView } from "../src/command-card";
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

test("원본 보관 한도 초과는 보관된 범위의 미리보기와 원본 줄 수 미확인으로 안내한다", () => {
  const output = Array.from({ length: 10000 }, (_, index) => `  출력 ${index}`).join("\n");
  const event: AppEvent = { seq: 1, at: "2026-11-13T00:00:00Z", kind: "notification", method: "item/completed", params: { item: { id: "large", type: "commandExecution", status: "completed", exitCode: 0, aggregatedOutput: output } } };
  const block = project([event]).blocks[0];
  if (block?.kind !== "command") throw Error("명령 투영 없음");
  const html = renderToStaticMarkup(createElement(CommandView, { block }));
  expect(block.outputTruncated).toBe(true);
  expect(html).toContain("보관된 출력의 앞 10줄 미리보기");
  expect(html).toContain("보관 범위 안에서");
  expect(html).toContain("제거된 원본 줄 수는 미확인");
  expect(html).toContain("중간 줄에서 시작할 수 있습니다");
});

test("명령 거절과 턴 중단의 미확인 결과 문구를 구별한다", () => {
  for (const status of ["declined", "unknown"]) {
    const event: AppEvent = { seq: 1, at: "2026-11-13T00:00:00Z", kind: "notification", method: "item/completed", params: { item: { id: "stop", type: "commandExecution", status } } };
    const block = project([event]).blocks[0];
    if (block?.kind !== "command") throw Error("명령 투영 없음");
    if (status === "unknown") block.turnInterrupted = true;
    const html = renderToStaticMarkup(createElement(CommandView, { block }));
    expect(html).toContain(status === "declined" ? "거절" : "턴 중단 · 명령 결과 미확인");
  }
});
