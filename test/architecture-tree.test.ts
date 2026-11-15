/**
 * @verifies RESP-BLUEPRINT-LAYOUT
 */
import { describe, expect, test } from 'bun:test';
import { createArchitectureTree, layoutResponsibilities, layoutResponsibilityGraph, responsibilityHierarchyPoints, responsibilityHierarchyPath, responsibilityEdgePoints, responsibilityEdgePath, responsibilityFit, type TreeData } from '../src/architecture-tree';

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


describe('viewport 책임 배치와 간선 통로', () => {
  const entries = Array.from({ length: 6 }, (_, i) => ({ id: `node.${i}`, title: `책임 ${i}`, parent: 'root', description: '' }));
  test('정본 부모와 직계 자식만 연결하고 다행·좁은 지도에서도 계층선이 노드를 관통하지 않는다', () => {
    const parent = { id: 'root', parent: null, title: '제품 기능', description: '정본 계층' };
    for (const width of [416, 912, 1400]) {
      const layout = layoutResponsibilityGraph(parent, entries, width);
      expect(layout.nodes.map((node) => node.id)).toEqual(entries.map((node) => node.id));
      for (const child of layout.nodes) {
        const points = responsibilityHierarchyPoints(layout.parent, child);
        expect(points.at(-1)).toEqual({ x: child.x - 6, y: child.y + child.height / 2 });
        expect(responsibilityHierarchyPath(layout.parent, child)).toBe(points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '));
        for (let index = 1; index < points.length; index++) {
          const a = points[index - 1]!;
          const b = points[index]!;
          for (const node of [layout.parent, ...layout.nodes]) {
            const crosses = a.x === b.x
              ? a.x > node.x && a.x < node.x + node.width && Math.max(a.y, b.y) > node.y && Math.min(a.y, b.y) < node.y + node.height
              : a.y > node.y && a.y < node.y + node.height && Math.max(a.x, b.x) > node.x && Math.min(a.x, b.x) < node.x + node.width;
            expect(crosses).toBe(false);
          }
        }
      }
    }
    expect(() => layoutResponsibilityGraph(parent, [{ ...entries[0]!, parent: 'other' }], 912)).toThrow('직계 하위');
    expect(layoutResponsibilityGraph(parent, [], 912).nodes).toEqual([]);
  });
  test('데스크톱 6개 모두 2열 3행으로 표시하고 입력 순서에 독립적이다', () => {
    const layout = layoutResponsibilities(entries, 912);
    expect(layout.columns                                     ).toBe   (2                                                                  ) ;
    expect(layout.nodes.map((n) => [n.x, n.y])                ).toEqual([[24, 24], [456, 24], [24, 154], [456, 154], [24, 284], [456, 284]]) ;
    expect(layoutResponsibilities([...entries].reverse(), 912)).toEqual(layout                                                             ) ;
    const zoom = responsibilityFit(layout, { width: 912, height: 500 });
    expect(zoom).toBeGreaterThanOrEqual(1);
    for (const node of layout.nodes) {
      expect((node.x + node.width) * zoom).toBeLessThanOrEqual(912);
      expect((node.y + node.height) * zoom).toBeLessThanOrEqual(500);
    }
  });
  test('좁거나 자식이 적으면 한 열, 읽을 크기와 내부 스크롤을 유지한다', () => {
    for (const width of [416, 540, 640, 783]) {
      const layout = layoutResponsibilities(entries, width);
      expect(layout.columns                                   ).toBe                  (1    ) ;
      expect(layout.nodeWidth                                 ).toBeGreaterThanOrEqual(320  ) ;
      expect(layout.width                                     ).toBeLessThanOrEqual   (width) ;
      expect(layout.height                                    ).toBeGreaterThan       (300  ) ;
      expect(responsibilityFit(layout, { width, height: 180 })).toBe                  (1    ) ;
    }
    expect(layoutResponsibilities(entries.slice(0, 3), 912).columns).toBe(1);
    expect(layoutResponsibilities([], 912).nodes).toEqual([]);
  });
  test('모든 노드 쌍·각 간선 index의 경로는 source/target margin과 비관통을 지킨다', () => {
    for (const width of [540, 912, 1400]) {
      const layout = layoutResponsibilities(entries, width);
      for (const from of layout.nodes) for (const to of layout.nodes) {
        if (from.id === to.id) continue;
        for (let index = 0; index < 24; index++) {
          const points = responsibilityEdgePoints(from, to, index);
          expect(points[0]!.x                           ).toBe(from.x + from.width + 4                                         ) ;
          expect(points.at(-1)!.x                       ).toBe(to.x + to.width + 6                                             ) ;
          expect(points[0]!.y                           ).toBe(from.y + from.height / 2                                        ) ;
          expect(points.at(-1)!.y                       ).toBe(to.y + to.height / 2                                            ) ;
          expect(responsibilityEdgePath(from, to, index)).toBe(points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')) ;
          for (let i = 1; i < points.length; i++) {
            const a = points[i - 1]! ;
            const b = points[i    ]! ;
            expect(a.x === b.x || a.y === b.y).toBe(true);
            for (const node of layout.nodes) {
              const crosses = a.x === b.x
                ? a.x > node.x && a.x < node.x + node.width && Math.max(a.y, b.y) > node.y && Math.min(a.y, b.y) < node.y + node.height
                : a.y > node.y && a.y < node.y + node.height && Math.max(a.x, b.x) > node.x && Math.min(a.x, b.x) < node.x + node.width;
              expect(crosses).toBe(false);
            }
          }
        }
      }
    }
  });
});
