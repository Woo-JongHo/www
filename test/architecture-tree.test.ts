/**
 * @verifies RESP-BLUEPRINT-LAYOUT
 */
import { describe, expect, test } from 'bun:test';
import { createArchitectureTree, layoutResponsibilities, layoutResponsibilityGraph, responsibilityHierarchyPoints, responsibilityHierarchyPath, responsibilityEdgePoints, responsibilityEdgePath, responsibilityFit, responsibilityLines, type TreeData } from '../src/architecture-tree';

function fixture(): TreeData {
  return {
    structure : {
      rootId : 'root',
      nodes  : [
        { id : 'root'      , parent : null        , title : '전체' , description : '' },
        { id : 'a'         , parent : 'root'      , title : '대화' , description : '' },
        { id : 'a.session' , parent : 'a'         , title : '세션' , description : '' },
        { id : 'a.restore' , parent : 'a.session' , title : '복원' , description : '' },
        { id : 'b'         , parent : 'root'      , title : '연결' , description : '' },
      ],
      requirements : [{ id: 'RESTORE-01', nodeId: 'a.restore', description: '복원', file: 'spec.md', line: 10 }]                  ,
      declarations : ['one.ts', 'two.ts'].map((file) => ({ file, nodeId: 'a.restore', requirementIds: ['RESTORE-01'], line: 2 })) ,
      tests        : [{ file: 'restore.test.ts', requirementIds: ['RESTORE-01'], line: 3 }]                                       ,
    },
    nodes     : [{ id: 'one.ts', structureId: 'a.restore' }, { id: 'two.ts', structureId: 'a.restore' }, { id: 'b.ts', structureId: 'b' }],
    edges     : [
      { id : '1' , from : 'one.ts' , to : 'b.ts'   , mode : 'type'    , line : 5 , endLine : 5 , statement : 'import type' },
      { id : '2' , from : 'two.ts' , to : 'b.ts'   , mode : 'mixed'   , line : 6 , endLine : 6 , statement : 'import'      },
      { id : '3' , from : 'one.ts' , to : 'two.ts' , mode : 'runtime' , line : 7 , endLine : 7 , statement : 'import'      },
      { id : '4' , from : 'b.ts'   , to : 'one.ts' , mode : 'runtime' , line : 8 , endLine : 8 , statement : 'import'      },
    ],
  };
}

describe('책임 계층 탐색', () => {
  test('직계 자식·ancestor·3단계 경로·leaf 이동', () => {
    const tree = createArchitectureTree(fixture());
    expect(tree.children('root').map((node) => node.id)       ).toEqual(['a', 'b']                                         ) ;
    expect(tree.breadcrumb('a.restore').map((node) => node.id)).toEqual(['root', 'a', 'a.session', 'a.restore']            ) ;
    expect(tree.ancestors('a.restore').length                 ).toBe   (3                                                  ) ;
    expect(tree.location('a.restore')                         ).toEqual({ currentId: 'a.session', selectedId: 'a.restore' }) ;
    expect(tree.location('a')                                 ).toEqual({ currentId: 'a', selectedId: 'a' }                ) ;
    expect(() => tree.children('missing')                     ).toThrow('없는 구조 ID'                                     ) ;
  });
  test('순환·없는 부모를 조용히 숨기지 않는다', () => {
    const data = fixture();
    data.structure.nodes[1]!.parent = 'a.restore';
    expect(() => createArchitectureTree(data)).toThrow('순환');
    data.structure.nodes[1]!.parent = 'missing';
    expect(() => createArchitectureTree(data)).toThrow('없는 구조 ID');
  });
  test('전역 ID·요구·제목·파일 검색과 빈 검색', () => {
    const tree = createArchitectureTree(fixture());
    for (const query of ['a.restore', 'restore-01', '복원', 'TWO.TS', 'restore.test.ts']) expect(tree.search(query).map((node) => node.id)).toEqual(['a.restore']);
    expect(tree.search('  ')).toEqual([]);
    expect(tree.search('없음')).toEqual([]);
  });
  test('공유 책임의 실제 선언과 검증 참조를 보존한다', () => {
    const refs = createArchitectureTree(fixture()).evidence('a.restore');
    expect(refs.declarations.map((entry) => entry.file)).toEqual(['one.ts', 'two.ts']) ;
    expect(refs.requirements[0]?.line                  ).toBe   (10                  ) ;
    expect(refs.tests[0]?.line                         ).toBe   (3                   ) ;
  });
  test('현재 단계 간선만 방향과 mode별 집계, 바깥 참조는 상세에 보존', () => {
    const tree = createArchitectureTree(fixture());
    expect(tree.dependencies('root')).toEqual([
      { from: 'a', to: 'b', runtime: 0, mixed: 1, type: 1 },
      { from: 'b', to: 'a', runtime: 1, mixed: 0, type: 0 },
    ]);
    expect(tree.dependencies('a')                                     ).toEqual([]             ) ;
    expect(tree.connections('a.restore').map((entry) => entry.edge.id)).toEqual(['1', '2', '4']) ;
    expect(tree.connections('a.restore')[2]?.outgoing                 ).toBe   (false          ) ;
  });
  test('입력 열거 순서에 독립적인 집계와 검색', () => {
    const data   = fixture               ()       ;
    const tree   = createArchitectureTree(data  ) ;
    const before = tree.dependencies     ('root') ;
    data.edges.reverse();
    data.structure.nodes.reverse();
    expect(createArchitectureTree(data).dependencies('root')                   ).toEqual(before    ) ;
    expect(createArchitectureTree(data).search('')                             ).toEqual([]        ) ;
    expect(createArchitectureTree(data).children('root').map((node) => node.id)).toEqual(['a', 'b']) ;
  });
});


describe('읽을 수 있는 구성과 방향별 간선', () => {
  const entries = Array.from({ length: 6 }, (_, i) => ({ id: `node.${i}`, title: `책임 ${i}`, parent: 'root', description: '이 구성요소가 담당하는 역할을 설명한다.' }));
  const parent = { id: 'root', parent: null, title: '제품 기능', description: '정본 계층' };
  function assertClear(points: { x: number; y: number }[], nodes: { x: number; y: number; width: number; height: number }[]) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
      for (const node of nodes) {
        const crosses = a.x === b.x
          ? a.x > node.x && a.x < node.x + node.width && Math.max(a.y, b.y) > node.y && Math.min(a.y, b.y) < node.y + node.height
          : a.y > node.y && a.y < node.y + node.height && Math.max(a.x, b.x) > node.x && Math.min(a.x, b.x) < node.x + node.width;
        expect(crosses).toBe(false);
      }
    }
  }
  test('하위 포함 집계는 직접 근거와 구분하고 공유 테스트를 중복 집계하지 않는다', () => {
    const data = fixture();
    data.structure.requirements.push({ id: 'SESSION-01', nodeId: 'a.session', description: '세션', file: 'spec.md', line: 9 });
    data.structure.tests[0]!.requirementIds.push('SESSION-01');
    const tree = createArchitectureTree(data);
    expect(tree.evidence('a').declarations).toEqual([]);
    expect(tree.summary('a').components.map((entry) => entry.id)).toEqual(['a.session']);
    expect(tree.summary('a').declarations.map((entry) => entry.file)).toEqual(['one.ts', 'two.ts']);
    expect(tree.summary('a').requirements.map((entry) => entry.id)).toEqual(['RESTORE-01', 'SESSION-01']);
    expect(tree.summary('a').tests).toHaveLength(1);
    expect(tree.summary('b').declarations).toEqual([]);
    expect(() => tree.summary('missing')).toThrow('없는 구조 ID');
  });
  test('모든 단계·viewport에서 부모와 자식 규격을 유지하며 충분한 폭에서는 두세 열이다', () => {
    for (const width of [416, 760, 912, 1400]) {
      const layout = layoutResponsibilityGraph(parent, entries, width);
      expect(layout.parent.width).toBe(360);
      expect(layout.parent.height).toBe(112);
      expect(layout.nodes.every((node) => node.width === 360 && node.height === 112)).toBe(true);
      expect(layout.columns).toBe(width >= 1200 ? 3 : width >= 804 ? 2 : 1);
      expect(layoutResponsibilityGraph(parent, [...entries].reverse(), width)).toEqual(layout);
      expect(responsibilityFit(layout, { width, height: 180 })).toBe(1);
      for (const child of layout.nodes) {
        const points = responsibilityHierarchyPoints(layout.parent, child);
        assertClear(points, [layout.parent, ...layout.nodes]);
        expect(responsibilityHierarchyPath(layout.parent, child)).toBe(points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '));
      }
    }
    expect(() => layoutResponsibilityGraph(parent, [{ ...entries[0]!, parent: 'other' }], 912)).toThrow('직계 하위');
    expect(layoutResponsibilities([], 912).nodes).toEqual([]);
    expect(layoutResponsibilities(entries.slice(0, 3), 1400).columns).toBe(2);
  });
  test('한 열·두 열·고밀도 30개 간선이 별도 출발/도착 포트와 통로를 쓰고 노드를 관통하지 않는다', () => {
    const count = 30;
    for (const width of [540, 2400]) {
      const layout = layoutResponsibilityGraph(parent, entries, width, count);
      for (const from of layout.nodes) for (const to of layout.nodes) {
        if (from.id === to.id) continue;
        const lanes = new Set<number>();
        const ports = new Set<number>();
        for (let index = 0; index < count; index++) {
          const points = responsibilityEdgePoints(from, to, index, count);
          expect(points[0]!.x).toBe(from.x + from.width + 4);
          expect(points.at(-1)!.x).toBe(to.x - 6);
          lanes.add(points[1]!.x);
          ports.add(points[0]!.y);
          assertClear(points, [layout.parent, ...layout.nodes]);
          for (const point of points) {
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(layout.width);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeLessThanOrEqual(layout.height);
          }
          expect(responsibilityEdgePath(from, to, index, count)).toBe(points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '));
        }
        expect(lanes.size).toBe(count);
        expect(ports.size).toBe(count);
        const forward = responsibilityEdgePoints(from, to, 0, count);
        const reverse = responsibilityEdgePoints(to, from, 1, count);
        expect(forward[1]!.x).not.toBe(reverse[3]!.x);
        expect(forward[2]!.y).not.toBe(reverse[2]!.y);
      }
    }
  });
  test('긴 한국어·보조 평면 문자를 두 줄 요약하고 원문은 바꾸지 않는다', () => {
    const text = '대화별 초안과 읽기 상태를 보관하고 Native 대화 목록과 복원을 연결한다. '.repeat(3);
    const before = text;
    const lines = responsibilityLines(text);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith('…')).toBe(true);
    expect(Array.from(lines[1]!).length).toBe(26);
    expect(text).toBe(before);
    expect(responsibilityLines('짧은 역할')).toEqual(['짧은 역할']);
    expect(responsibilityLines('')).toEqual([]);
    expect(responsibilityLines('😀'.repeat(28))[1]).toBe('😀😀');
  });
});
