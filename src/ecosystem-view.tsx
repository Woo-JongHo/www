import { useEffect, useRef, useState } from "react";
import { ecosystemEdges, ecosystemGroups, ecosystemNodes, matchingNodes, nodeConnections, type EcosystemGroup, type EcosystemNode } from "./ecosystem";

const WIDTH       = 1180 ;
const HEIGHT      = 940  ;
const NODE_WIDTH  = 230  ;
const NODE_HEIGHT = 76   ;

function edgePath(from: EcosystemNode, to: EcosystemNode): string {
  if (from.id === "main" && to.id === "core") {
    return "M 850 150 H 880 V 400 H 1025 V 415";
  }
  if (from.y === to.y) {
    return `M ${from.x + NODE_WIDTH} ${from.y + 38} L ${to.x - 5} ${to.y + 38}`;
  }
  const down    = to.y > from.y                            ;
  const startX  = from.x + NODE_WIDTH / 2                  ;
  const endX    = to.x + NODE_WIDTH / 2                    ;
  const startY  = down ? from.y + NODE_HEIGHT : from.y     ;
  const endY    = down ? to.y - 5 : to.y + NODE_HEIGHT + 5 ;
  const middleY = (startY + endY) / 2                      ;
  return `M ${startX} ${startY} C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}`;
}

export function EcosystemView() {
  const [selectedId, setSelectedId] = useState("chat")                        ;
  const [query     , setQuery     ] = useState("")                            ;
  const [group     , setGroup     ] = useState<EcosystemGroup | "all">("all") ;
  const [zoom      , setZoom      ] = useState(1)                             ;
  const viewport     = useRef<HTMLDivElement>(null)                                             ;
  const drag         = useRef<{ x: number; y: number; left: number; top: number } | null>(null) ;
  const selected     = ecosystemNodes.find((node) => node.id === selectedId)!                   ;
  const matches      = matchingNodes(query, group)                                              ;
  const matchIds     = new Set(matches.map((node) => node.id))                                  ;
  const filtering    = query.trim() !== "" || group !== "all"                                   ;
  const connections  = nodeConnections(selectedId)                                              ;
  const neighborhood = new Set([selectedId, ...connections.map(({ node }) => node.id)])         ;

  function fit() {
    const element = viewport.current;
    if (!element) return;
    setZoom(Math.max(0.35, Math.min(1.25, (element.clientWidth - 24) / WIDTH, (element.clientHeight - 24) / HEIGHT)));
    element.scrollTo(0, 0);
  }

  useEffect(() => {
    fit();
  }, []);

  function selectNode(node: EcosystemNode, reveal = false) {
    setSelectedId(node.id);
    if (reveal && viewport.current) {
      const element = viewport.current;
      element.scrollTo({ left: (node.x + NODE_WIDTH / 2) * zoom - element.clientWidth / 2, top: (node.y + NODE_HEIGHT / 2) * zoom - element.clientHeight / 2 });
    }
  }

  return <>
    <main className="ecosystem-work" aria-label="WWW 생태계 지도">
      <header className="ecosystem-header"><div><h1>WWW 생태계</h1><p>요청에서 실행으로, 작업에서 검증으로 이어지는 구조</p></div><span className="ecosystem-badge">로컬 구조 안내</span></header>
      <div className="ecosystem-toolbar">
        <label className="ecosystem-search"><span>검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="역할, 모듈, 파일 경로" aria-label="생태계 노드 검색"/></label>
        <div className="ecosystem-zoom" aria-label="지도 배율"><button onClick={() => setZoom((value) => Math.max(0.35, value - 0.15))} disabled={zoom <= 0.35} aria-label="지도 축소">−</button><output>{Math.round(zoom * 100)}%</output><button onClick={() => setZoom((value) => Math.min(1.75, value + 0.15))} disabled={zoom >= 1.75} aria-label="지도 확대">＋</button><button onClick={fit}>전체 보기</button></div>
      </div>
      <nav className="ecosystem-filters" aria-label="생태계 영역"><button aria-pressed={group === "all"} onClick={() => setGroup("all")}>전체</button>{ecosystemGroups.map((entry) => <button key={entry.id} className={`eco-${entry.id}`} aria-pressed={group === entry.id} onClick={() => setGroup(entry.id)}><i/>{entry.title}</button>)}<span>{filtering ? `${matches.length}개 일치` : `${ecosystemNodes.length}개 노드`}</span></nav>
      {filtering && <div className="ecosystem-results" aria-live="polite">{matches.length ? matches.map((node) => <button key={node.id} onClick={() => selectNode(node, true)}>{node.title}</button>) : <span>일치하는 노드가 없습니다. 검색어나 영역을 바꿔 보세요.</span>}<button className="ecosystem-clear" onClick={() => { setQuery(""); setGroup("all"); }}>필터 초기화</button></div>}
      <div className="ecosystem-viewport" ref={viewport} tabIndex={0} aria-label="구조 그래프. 방향키로 스크롤하고 Tab으로 노드를 선택하세요."
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest('[role="button"]')) return;
          const element = event.currentTarget;
          drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
          element.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
          event.currentTarget.scrollTop  = start.top  - (event.clientY - start.y);
        }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <svg className="ecosystem-svg" width={WIDTH * zoom} height={HEIGHT * zoom} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="WWW 모듈과 관계">
          <defs><marker id="eco-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>
          {ecosystemGroups.map((entry) => <g key={entry.id} className={`eco-band eco-${entry.id}`}><rect x="20" y={entry.y - 10} width="1140" height={entry.id === "app" ? 300 : 180} rx="12"/><text x="40" y={entry.y + 20} className="eco-band-title">{entry.title}</text><text x="180" y={entry.y + 20} className="eco-band-description">{entry.description}</text></g>)}
          <g aria-hidden="true">{ecosystemEdges.map((edge) => {
            const from   = ecosystemNodes.find((node) => node.id === edge.from)!             ;
            const to     = ecosystemNodes.find((node) => node.id === edge.to)!               ;
            const active = edge.from === selectedId || edge.to === selectedId                ;
            const dimmed = filtering && (!matchIds.has(edge.from) || !matchIds.has(edge.to)) ;
            return <path key={`${edge.from}-${edge.to}`} d={edgePath(from, to)} className={`eco-edge ${active ? "is-connected" : ""} ${edge.planned ? "is-planned" : ""} ${dimmed ? "is-dimmed" : ""}`} markerEnd="url(#eco-arrow)"><title>{from.title} → {to.title}: {edge.label}</title></path>;
          })}</g>
          {ecosystemNodes.map((node) => <g key={node.id} transform={`translate(${node.x} ${node.y})`} role="button" tabIndex={0} aria-label={`${node.title}, ${node.subtitle}`} aria-pressed={selectedId === node.id}
            className={`eco-node eco-${node.group} ${selectedId === node.id ? "is-selected" : ""} ${neighborhood.has(node.id) ? "is-neighbor" : ""} ${filtering && !matchIds.has(node.id) ? "is-dimmed" : ""}`}
            onClick={() => selectNode(node)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectNode(node); } }}>
            <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="9"/><circle cx="19" cy="24" r="4"/><text x="33" y="30" className="eco-node-title">{node.title}</text><text x="18" y="56" className="eco-node-subtitle">{node.subtitle}</text>
          </g>)}
        </svg>
      </div>
      <footer className="ecosystem-legend"><span><i className="eco-line"/>현재 구조</span><span><i className="eco-line planned"/>후속 방향</span><span>배경을 드래그해 이동 · 노드를 눌러 관계 확인</span></footer>
    </main>
    <aside className="ecosystem-detail" aria-label="선택한 노드 상세">
      <div className="ecosystem-detail-heading">노드 살펴보기</div>
      <div className={`ecosystem-detail-content eco-${selected.group}`}><span className="ecosystem-category">{ecosystemGroups.find((entry) => entry.id === selected.group)!.title}</span><h2>{selected.title}</h2><div className="ecosystem-subtitle">{selected.subtitle}</div><p>{selected.description}</p>
        <h3>연결 관계 <span>{connections.length}</span></h3>
        <div className="ecosystem-connections">{connections.map(({ edge, node, outgoing }) => <button key={`${edge.from}-${edge.to}`} onClick={() => selectNode(node, true)}><span className="ecosystem-direction">{outgoing ? "나가는 연결 ↗" : "들어오는 연결 ↙"}{edge.planned ? " · 후속" : ""}</span><strong>{node.title}</strong><span>{edge.label}</span></button>)}</div>
        <h3>구조의 근거</h3><ul className="ecosystem-sources">{selected.sources.map((source) => <li key={source}><code>{source}</code></li>)}</ul>
      </div>
      <p className="ecosystem-note">번들에 포함된 구조 안내입니다. 실시간 실행 상태나 자동 소스 분석 결과가 아닙니다. 근거 경로는 저장소 기준입니다.</p>
    </aside>
  </>;
}
