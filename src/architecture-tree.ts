/**
 * @architecture arch.blueprint.layout
 * @implements RESP-BLUEPRINT-LAYOUT
 */
export interface StructureNode {
  id     : string        ;
  parent : string | null ;
  title  : string        ;
  description: string
}
export interface TreeData {
  structure: {
    rootId       : string                                                                            ;
    nodes        : StructureNode[]                                                                   ;
    requirements : { id: string; nodeId: string; description: string; file: string; line: number }[] ;
    declarations : { file: string; nodeId: string; requirementIds: string[]; line: number }[]        ;
    tests        : { file: string; requirementIds: string[]; line: number }[]                        ;
  };
  nodes: { id: string; structureId: string }[];
  edges: { id: string; from: string; to: string; mode: string; line: number; endLine: number; statement: string }[];
}

export function createArchitectureTree(data: TreeData) {
  const structure = data.structure                                                 ;
  const nodes     = new Map(structure.nodes.map((node) => [node.id, node]))        ;
  const files     = new Map(data.nodes.map((node) => [node.id, node.structureId])) ;
  function node(id: string) {
    const found = nodes.get(id);
    if (!found) throw Error(`없는 구조 ID: ${id}`);
    return found;
  }
  function children(id: string) {
    node(id);
    return structure.nodes.filter((entry) => entry.parent === id).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  }
  function breadcrumb(id: string) {
    const result : StructureNode[]           = []                ;
    const seen                               = new Set<string>() ;
    let current  : StructureNode | undefined = node(id)          ;
    while (current) {
      if (seen.has(current.id)) throw Error(`구조 부모 순환: ${current.id}`);
      seen.add(current.id);
      result.unshift(current);
      current = current.parent === null ? undefined : node(current.parent);
    }
    if (result[0]?.id !== structure.rootId) throw Error(`root에 연결되지 않은 구조: ${id}`);
    return result;
  }
  for (const entry of structure.nodes) breadcrumb(entry.id);
  function ancestors(id: string) { return breadcrumb(id).slice(0, -1); }
  function contains(parent: string, id: string) { return breadcrumb(id).some((entry) => entry.id === parent); }
  function evidence(id: string) {
    node(id);
    const requirements = structure.requirements.filter((entry) => entry.nodeId === id) ;
    const ids          = new Set(requirements.map((entry) => entry.id))                ;
    return {
      requirements                                                                                       ,
      declarations : structure.declarations.filter((entry) => entry.nodeId === id)                       ,
      tests        : structure.tests.filter((entry) => entry.requirementIds.some((ref) => ids.has(ref))) ,
    };
  }
  function summary(id: string) {
    const scope = new Set(structure.nodes.filter((entry) => contains(id, entry.id)).map((entry) => entry.id));
    const requirements = structure.requirements.filter((entry) => scope.has(entry.nodeId));
    const requirementIds = new Set(requirements.map((entry) => entry.id));
    return {
      components: children(id),
      requirements,
      declarations: structure.declarations.filter((entry) => scope.has(entry.nodeId)),
      tests: structure.tests.filter((entry) => entry.requirementIds.some((ref) => requirementIds.has(ref))),
    };
  }
  function search(query: string) {
    const needle = query.trim().toLocaleLowerCase('ko-KR');
    if (!needle) return [];
    return [...nodes.values()].filter((entry) => {
      const refs = evidence(entry.id);
      return [entry.id, entry.title, entry.description, ...refs.requirements.map((ref) => ref.id), ...refs.declarations.map((ref) => ref.file), ...refs.tests.map((ref) => ref.file)].join(' ').toLocaleLowerCase('ko-KR').includes(needle);
    }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  }
  function connections(id: string) {
    node(id);
    return data.edges.flatMap((edge) => {
      const from = files.get(edge.from) ;
      const to   = files.get(edge.to  ) ;
      if (!from || !to) return [];
      const outgoing = contains(id, from) ;
      const incoming = contains(id, to  ) ;
      if (outgoing === incoming) return [];
      return [{ edge, from, to, outgoing, target: node(outgoing ? to : from) }];
    }).sort((a, b) => a.edge.id.localeCompare(b.edge.id, 'en'));
  }
  function dependencies(id: string) {
    const visible = children(id)                                                                                  ;
    const groups  = new Map<string, { from: string; to: string; runtime: number; mixed: number; type: number }>() ;
    for (const edge of data.edges) {
      const source = files.get(edge.from) ;
      const target = files.get(edge.to  ) ;
      if (!source || !target) continue;
      const from = visible.find((entry) => contains(entry.id, source))?.id ;
      const to   = visible.find((entry) => contains(entry.id, target))?.id ;
      if (!from || !to || from === to) continue;
      const key   = `${from}:${to}`                                                ;
      const group = groups.get(key) ?? { from, to, runtime: 0, mixed: 0, type: 0 } ;
      if (edge.mode === 'type') group.type++;
      else if (edge.mode === 'mixed') group.mixed++;
      else group.runtime++;
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`, 'en'));
  }
  function location(id: string) {
    const target = node(id);
    return { currentId: children(id).length ? id : target.parent ?? id, selectedId: id };
  }
  return { node, children, ancestors, breadcrumb, search, evidence, summary, connections, dependencies, location };
}

export interface ResponsibilityRect extends StructureNode {
  x     : number ;
  y     : number ;
  width : number ;
  height: number
}

// 출발은 오른쪽, 도착은 왼쪽이다. 간선마다 별도 통로를 확보한다.
export function layoutResponsibilities(entries: StructureNode[], viewportWidth: number, edgeCount = 0) {
  const edgeCorridor = 36 + edgeCount * 12;
  const padding = 24 + edgeCount * 12;
  const nodeWidth = 360;
  const nodeHeight = 112;
  const rowGap = 48 + edgeCount * 6;
  const columns = entries.length >= 6 && viewportWidth >= nodeWidth * 3 + padding * 2 + edgeCorridor * 2 ? 3
    : entries.length >= 2 && viewportWidth >= nodeWidth * 2 + padding * 2 + edgeCorridor ? 2 : 1;
  const rows = Math.max(1, Math.ceil(entries.length / columns));
  const nodes = [...entries].sort((a, b) => a.id.localeCompare(b.id, 'en')).map((entry, index) => ({
    ...entry,
    x: padding + index % columns * (nodeWidth + edgeCorridor),
    y: padding + Math.floor(index / columns) * (nodeHeight + rowGap),
    width: nodeWidth,
    height: nodeHeight,
  }));
  return { nodes, columns, nodeWidth, nodeHeight, rowGap, edgeCorridor,
    width: padding * 2 + columns * nodeWidth + (columns - 1) * edgeCorridor,
    height: padding * 2 + rows * nodeHeight + (rows - 1) * rowGap };
}

export function responsibilityEdgePoints(from: ResponsibilityRect, to: ResponsibilityRect, index: number, total = index + 1) {
  const offset = 16 + index * 6;
  const port = 20 + (index + 1) * 72 / (Math.max(total, index + 1) + 1);
  const sourceX = from.x + from.width;
  const targetX = to.x;
  const startY = from.y + port;
  const endY = to.y + port;
  const corridorY = to.y - offset;
  return [
    { x: sourceX + 4, y: startY }, { x: sourceX + offset, y: startY },
    { x: sourceX + offset, y: corridorY }, { x: targetX - offset, y: corridorY },
    { x: targetX - offset, y: endY }, { x: targetX - 6, y: endY },
  ];
}

export function responsibilityEdgePath(from: ResponsibilityRect, to: ResponsibilityRect, index: number, total = index + 1) {
  return responsibilityEdgePoints(from, to, index, total).map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
}

// 글자 크기를 줄여 전체를 욱여넣지 않고, 낮거나 좁은 창은 내부 스크롤한다.
export function responsibilityFit(layout: { width: number; height: number }, viewport: { width: number; height: number }) {
  return Math.max(1, Math.min(1.1, viewport.width / layout.width, viewport.height / layout.height));
}

export function layoutResponsibilityGraph(parent: StructureNode, entries: StructureNode[], viewportWidth: number, edgeCount = 0) {
  if (entries.some((entry) => entry.parent !== parent.id)) throw new Error("직계 하위 책임만 계층 지도에 연결할 수 있습니다.");
  const layout = layoutResponsibilities(entries, viewportWidth, edgeCount);
  return {
    ...layout,
    parent : { ...parent, x: (layout.width - layout.nodeWidth) / 2, y: 24, width: layout.nodeWidth, height: layout.nodeHeight } ,
    nodes  : layout.nodes.map((entry) => ({ ...entry, y: entry.y + layout.nodeHeight + 48 }))                                        ,
    height : layout.height + layout.nodeHeight + 48                                                                                  ,
  };
}

export function responsibilityHierarchyPoints(parent: ResponsibilityRect, child: ResponsibilityRect) {
  const x      = parent.x + parent.width / 2   ;
  const bend   = parent.y + parent.height + 18 ;
  const gutter = child.x - 12                  ;
  const y      = child.y + child.height / 2    ;
  return [{ x, y: parent.y + parent.height + 4 }, { x, y: bend }, { x: gutter, y: bend }, { x: gutter, y }, { x: child.x - 6, y }];
}

export function responsibilityHierarchyPath(parent: ResponsibilityRect, child: ResponsibilityRect) {
  return responsibilityHierarchyPoints(parent, child).map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

// SVG는 자동 줄바꿈하지 않으므로 요약만 두 줄로 표시하고 상세에는 원문을 둔다.
export function responsibilityLines(text: string, limit = 26) {
  const characters = Array.from(text);
  return [characters.slice(0, limit).join(''), characters.length > limit * 2
    ? `${characters.slice(limit, limit * 2 - 1).join('')}…`
    : characters.slice(limit, limit * 2).join('')].filter(Boolean);
}
