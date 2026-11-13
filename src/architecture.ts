import snapshot from "./architecture.generated.json";

export const architecture = snapshot;
export type ArchitectureNode = typeof snapshot.nodes[number];
export type ArchitectureEdge = typeof snapshot.edges[number];
export type ArchitectureLayer = typeof snapshot.layers[number];
export interface PlacedNode { id: string; x: number; y: number; width: number; height: number }

export function architectureMatches(query: string, layer = "all"): ArchitectureNode[] {
  const needle = query.trim().toLocaleLowerCase("ko-KR");
  return architecture.nodes.filter((node) => (layer === "all" || node.layer === layer) && `${node.file} ${node.role} ${node.title}`.toLocaleLowerCase("ko-KR").includes(needle));
}

export function architectureConnections(id: string) {
  return architecture.edges.filter((edge) => edge.from === id || edge.to === id).map((edge) => ({
    edge, outgoing: edge.from === id, node: architecture.nodes.find((node) => node.id === (edge.from === id ? edge.to : edge.from))!,
  }));
}

export function layerConnections() {
  const groups = new Map<string, { from: string; to: string; runtime: number; types: number }>();
  for (const edge of architecture.edges) {
    const from = architecture.nodes.find((node) => node.id === edge.from)!.layer;
    const to = architecture.nodes.find((node) => node.id === edge.to)!.layer;
    if (from === to) continue;
    const key = `${from}:${to}`;
    const group = groups.get(key) ?? { from, to, runtime: 0, types: 0 };
    if (edge.mode === "type") group.types++;
    else group.runtime++;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function architectureLayout(overview: boolean, layer = "all") {
  const visibleLayers = architecture.layers.filter((entry) => layer === "all" || entry.id === layer);
  if (overview) {
    const nodes = visibleLayers.map((entry, index) => ({ id: entry.id, x: 28, y: 32 + index * 106, width: 540, height: 80 }));
    return { nodes, width: 810, height: 64 + visibleLayers.length * 106, bands: [] };
  }
  const columns = visibleLayers.map((entry) => architecture.nodes.filter((node) => node.layer === entry.id));
  const rows = Math.max(1, ...columns.map((column) => column.length));
  const nodes = columns.flatMap((column, index) => column.map((node, row) => ({ id: node.id, x: 28 + index * 288, y: 100 + row * 88, width: 236, height: 64 })));
  const bands = visibleLayers.map((entry, index) => ({ id: entry.id, x: 16 + index * 288, y: 16, width: 260, height: 100 + rows * 88 }));
  return { nodes, bands, width: Math.max(340, visibleLayers.length * 288 + 40), height: 140 + rows * 88 };
}

export function architectureEdgePath(from: PlacedNode, to: PlacedNode, index: number, overview: boolean): string {
  const startY = from.y + from.height / 2;
  const endY = to.y + to.height / 2;
  if (overview) {
    const lane = 598 + index * 10;
    return `M ${from.x + from.width} ${startY - 8} H ${lane} V ${endY + 8} H ${to.x + to.width + 2}`;
  }
  // 모든 열의 행 간격이 같다. 수평 구간은 행 사이, 수직 구간은 열 사이를 지난다.
  const sourceLane = from.x + from.width + 8 + index % 4 * 3;
  const targetLane = to.x - 8 - index % 4 * 3;
  const corridor = from.y - 12 - index % 3 * 3;
  return `M ${from.x + from.width} ${startY} H ${sourceLane} V ${corridor} H ${targetLane} V ${endY} H ${to.x - 2}`;
}
