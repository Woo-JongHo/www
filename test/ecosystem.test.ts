import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ecosystemEdges, ecosystemGroups, ecosystemNodes, matchingNodes, nodeConnections } from "../src/ecosystem";

describe("WWW 생태계 구조", () => {
  test("모든 노드·관계·출처가 실제 저장소와 연결된다", () => {
    const ids = new Set(ecosystemNodes.map((node) => node.id));
    expect(ids.size).toBe(ecosystemNodes.length);
    for (const node of ecosystemNodes) {
      expect(ecosystemGroups.some((group) => group.id === node.group)).toBe(true);
      expect(node.sources.length).toBeGreaterThan(0);
      for (const source of node.sources) expect(existsSync(resolve(import.meta.dir, "..", source))).toBe(true);
      expect(nodeConnections(node.id).length).toBeGreaterThan(0);
    }
    for (const edge of ecosystemEdges) {
      expect(ids.has(edge.from) && ids.has(edge.to)).toBe(true);
      if (ecosystemNodes.some((node) => node.group === "future" && [edge.from, edge.to].includes(node.id))) expect(edge.planned).toBe(true);
    }
  });

  test("제품 실행 경로와 개발 검토 경로를 구분한다", () => {
    expect(nodeConnections("chat").map(({ node }) => node.id).sort()                    ).toEqual(["bridge", "projection"]) ;
    expect(nodeConnections("review").find(({ node }) => node.id === "core")?.outgoing   ).toBe   (true                    ) ;
    expect(ecosystemEdges.some((edge) => edge.from === "native" && edge.to === "review")).toBe   (false                   ) ;
  });

  test("한국어·대소문자·파일 경로 검색과 영역 필터를 함께 적용한다", () => {
    expect(matchingNodes("  JSON-RPC  ", "app").map((node) => node.id)   ).toContain   ("main"               ) ;
    expect(matchingNodes("EVIDENCE.TS", "records").map((node) => node.id)).toEqual     (["evidence"]         ) ;
    expect(matchingNodes("검토", "future").map((node) => node.id)        ).toContain   ("hooks"              ) ;
    expect(matchingNodes("존재하지않는노드", "all")                      ).toEqual     ([]                   ) ;
    expect(matchingNodes("", "all")                                      ).toHaveLength(ecosystemNodes.length) ;
  });
});
