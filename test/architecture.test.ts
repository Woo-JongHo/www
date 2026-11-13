import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateArchitecture } from "../scripts/generate-architecture.ts";
import { architecture, architectureConnections, architectureEdgePath, architectureLayout, architectureMatches, layerConnections } from "../src/architecture";

describe("코드 기반 설계도", () => {
  test("실제 소스에서 생성된 snapshot이 결정적이며 파일·행 근거와 일치한다", () => {
    const root = path.resolve(import.meta.dir, "..");
    expect(generateArchitecture(root)).toEqual(architecture);
    expect(generateArchitecture(root)).toEqual(generateArchitecture(root));
    for (const edge of architecture.edges) {
      const text = readFileSync(path.join(root, edge.from), "utf8");
      expect(text.split("\n").slice(edge.line - 1, edge.endLine).join("\n")).toContain(edge.statement);
      expect(architecture.nodes.some((node) => node.id === edge.to)).toBe(true);
    }
    expect(architecture.diagnostics).toEqual([]);
  });

  test("AST로 타입·혼합·값·export·동적 import를 구분하고 외부와 미해석을 드러낸다", () => {
    const root = mkdtempSync(path.join(tmpdir(), "www-architecture-"));
    try {
      mkdirSync(path.join(root, "src"));
      writeFileSync(path.join(root, "src/target.ts"), "export interface Shape {}\nexport const value = 1;\n");
      writeFileSync(path.join(root, "src/entry.ts"), [
        '// import fake from "./absent";',
        'import type { Shape } from "./target";',
        'import { type Shape as Alias } from "./target";',
        'import { value, type Shape as Other } from "./target";',
        'import "./target";',
        'export type { Shape } from "./target";',
        'export { value } from "./target";',
        'const load = () => import("./target");',
        'type Lazy = import("./target").Shape;',
        'import { readFileSync } from "node:fs";',
        'import { missing } from "./absent";',
      ].join("\n"));
      const result = generateArchitecture(root, ["src/entry.ts", "src/target.ts"]);
      expect(result.edges.map((edge) => [edge.line, edge.mode, edge.syntax])).toEqual([
        [2, "type", "import"], [3, "type", "import"], [4, "mixed", "import"], [5, "runtime", "import"],
        [6, "type", "export"], [7, "runtime", "export"], [8, "runtime", "dynamic-import"], [9, "type", "import-type"],
      ]);
      expect(result.excluded).toEqual([{ file: "src/entry.ts", line: 10, specifier: "node:fs", reason: "external" }]);
      expect(result.diagnostics).toEqual(["src/entry.ts:11: 해석하지 못한 로컬 참조 ./absent"]);
      const before = result.digest;
      writeFileSync(path.join(root, "src/target.ts"), "export const value = 2;\n");
      expect(generateArchitecture(root, ["src/entry.ts", "src/target.ts"]).digest).not.toBe(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("파일 검색·계층 필터와 실제 들어오고 나가는 참조를 탐색한다", () => {
    expect(architectureMatches(" RENDERER.TSX ").map((node) => node.id)).toEqual(["src/renderer.tsx"]);
    expect(architectureMatches("renderer", "host")).toEqual([]);
    expect(architectureMatches("없는모듈")).toEqual([]);
    expect(architectureConnections("src/renderer.tsx").some(({ edge, outgoing }) => outgoing && edge.to === "src/shared.ts" && edge.mode === "type")).toBe(true);
    expect(architectureConnections("src/shared.ts").some(({ outgoing }) => !outgoing)).toBe(true);
    for (const edge of layerConnections()) expect(edge.from).not.toBe(edge.to);
  });

  test("모든 모듈을 겹치지 않는 계층에 배치하고 연결선이 노드를 관통하지 않는다", () => {
    const layout = architectureLayout(false);
    expect(layout.nodes).toHaveLength(architecture.nodes.length);
    for (const edge of architecture.edges) {
      const from = layout.nodes.find((node) => node.id === edge.from)!;
      const to = layout.nodes.find((node) => node.id === edge.to)!;
      const route = architectureEdgePath(from, to, 0, false);
      const numbers = route.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      let x = numbers[0];
      let y = numbers[1];
      for (const [axis, value] of [["x", numbers[2]], ["y", numbers[3]], ["x", numbers[4]], ["y", numbers[5]], ["x", numbers[6]]]) {
        if (typeof value !== "number") throw Error("경로 좌표가 필요합니다.");
        for (const node of layout.nodes) {
          if (node.id === edge.from || node.id === edge.to) continue;
          const intersects = axis === "x" ? y > node.y && y < node.y + node.height && Math.max(x, value) > node.x && Math.min(x, value) < node.x + node.width : x > node.x && x < node.x + node.width && Math.max(y, value) > node.y && Math.min(y, value) < node.y + node.height;
          expect(intersects).toBe(false);
        }
        if (axis === "x") x = value;
        else y = value;
      }
    }
    expect(architectureLayout(true).nodes).toHaveLength(architecture.layers.length);
    const filtered = architectureLayout(false, "contract");
    expect(filtered.nodes.every((placed) => architecture.nodes.find((node) => node.id === placed.id)?.layer === "contract")).toBe(true);
  });
});
