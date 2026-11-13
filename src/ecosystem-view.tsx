import { useEffect, useMemo, useRef, useState } from "react";
import { ecosystemEdges, ecosystemGroups, ecosystemNodes, matchingNodes, nodeConnections, type EcosystemGroup, type EcosystemNode } from "./ecosystem";

import { architecture, architectureConnections, architectureEdgePath, architectureLayout, architectureMatches, layerConnections, type ArchitectureNode } from "./architecture";

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

function EcosystemGuide() {
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

export function EcosystemView() {
  const [guide, setGuide] = useState(false);
  return <section className="ecosystem-shell" aria-label="WWW 구조 탐색">
    <nav className="blueprint-tabs" aria-label="구조 보기">
      <button aria-pressed={!guide} onClick={() => setGuide(false)} data-testid="architecture-tab">코드 설계도</button>
      <button aria-pressed={guide} onClick={() => setGuide(true)} data-testid="ecosystem-guide-tab">생태계 안내</button>
      <span>{guide ? "수동 구조 안내 · 후속 방향 포함" : "TypeScript 소스에서 추출한 모듈 참조"}</span>
    </nav>
    <div className="ecosystem-page">{guide ? <EcosystemGuide/> : <CodeBlueprintView/>}</div>
  </section>;
}

function CodeBlueprintView() {
  const [overview, setOverview] = useState(true);
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState("all");
  const [selectedId, setSelectedId] = useState("src/renderer.tsx");
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const reveal = useRef(false);
  const layout = useMemo(() => architectureLayout(overview, layer), [overview, layer]);
  const selected = architecture.nodes.find((node) => node.id === selectedId)!;
  const selectedLayer = architecture.layers.find((entry) => entry.id === selected.layer)!;
  const matches = architectureMatches(query, layer);
  const matchIds = new Set(matches.map((node) => node.id));
  const connections = architectureConnections(selectedId);
  const neighborhood = new Set([selectedId, ...connections.map(({ node }) => node.id)]);
  const placed = new Map(layout.nodes.map((node) => [node.id, node]));
  const aggregates = layerConnections();
  const edges = overview
    ? aggregates.filter((edge) => placed.has(edge.from) && placed.has(edge.to)).map((edge) => ({ ...edge, id: `${edge.from}:${edge.to}`, mode: edge.runtime ? "runtime" : "type", active: edge.from === selected.layer || edge.to === selected.layer }))
    : connections.map(({ edge }) => ({ ...edge, active: true })).filter((edge) => placed.has(edge.from) && placed.has(edge.to));

  function fit() {
    const element = viewport.current;
    if (!element) return;
    setZoom(Math.max(0.05, Math.min(1.15, (element.clientWidth - 24) / layout.width, (element.clientHeight - 24) / layout.height)));
    element.scrollTo(0, 0);
  }

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // 처음에는 읽을 수 있는 크기를 지키며 스크롤을 허용한다. 전체 보기는 명시적으로 맞춘다.
    setZoom(overview ? Math.max(0.72, Math.min(1, (element.clientWidth - 24) / layout.width, (element.clientHeight - 24) / layout.height)) : 0.9);
  }, []);

  useEffect(() => {
    if (!reveal.current || overview) return;
    const node = layout.nodes.find((entry) => entry.id === selectedId);
    const element = viewport.current;
    if (!node || !element) return;
    element.scrollTo({ left: (node.x + node.width / 2) * zoom - element.clientWidth / 2, top: (node.y + node.height / 2) * zoom - element.clientHeight / 2 });
    reveal.current = false;
  }, [selectedId, overview, layout, zoom]);

  function select(node: ArchitectureNode, move = false) {
    if (move) {
      reveal.current = true;
      if (overview) setZoom(0.9);
      setOverview(false);
      if (layer !== "all" && layer !== node.layer) setLayer("all");
      const position = layout.nodes.find((entry) => entry.id === node.id);
      if (!overview && position && viewport.current) {
        viewport.current.scrollTo({ left: (position.x + position.width / 2) * zoom - viewport.current.clientWidth / 2, top: (position.y + position.height / 2) * zoom - viewport.current.clientHeight / 2 });
      }
    }
    setSelectedId(node.id);
  }

  function filterLayer(id: string) {
    setLayer(id);
    if (id !== "all" && selected.layer !== id) {
      const first = architecture.nodes.find((node) => node.layer === id);
      if (first) setSelectedId(first.id);
    }
  }

  function focusNext(index: number, key: string) {
    const available = layout.nodes.filter((node) => overview ? matches.some((match) => match.layer === node.id) : matchIds.has(node.id));
    const current = available.findIndex((node) => node.id === layout.nodes[index]?.id);
    const next = key === "Home" ? 0 : key === "End" ? available.length - 1 : Math.max(0, Math.min(available.length - 1, current + (key === "ArrowDown" || key === "ArrowRight" ? 1 : -1)));
    const target = available[next];
    if (target) document.getElementById(`architecture-node-${layout.nodes.indexOf(target)}`)?.focus();
  }

  return <>
    <main className="ecosystem-work blueprint-work" aria-label="WWW 코드 아키텍처 설계도">
      <header className="ecosystem-header blueprint-header"><div><div className="blueprint-eyebrow">WWW / CODE ARCHITECTURE</div><h1>코드에서 읽는 설계도</h1><p>계층의 책임에서 모듈의 실제 참조까지</p></div><span className="ecosystem-badge">소스 기반 · {architecture.nodes.length} modules</span></header>
      <div className="blueprint-summary"><span><strong>{architecture.layers.length}</strong> 계층</span><span><strong>{architecture.edges.length}</strong> 모듈 참조</span><span><strong>{architecture.edges.filter((edge) => edge.mode === "type").length}</strong> 타입 전용</span><code title={architecture.digest}>snapshot {architecture.digest.slice(0, 10)}</code></div>
      <div className="ecosystem-toolbar">
        <label className="ecosystem-search"><span>검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="모듈, 역할, 파일 경로" aria-label="코드 모듈 검색"/></label>
        <div className="ecosystem-zoom" aria-label="설계도 배율"><button aria-label="설계도 축소" disabled={zoom <= 0.25} onClick={() => setZoom((value) => Math.max(0.25, value - 0.15))}>−</button><output data-testid="architecture-zoom">{Math.round(zoom * 100)}%</output><button aria-label="설계도 확대" disabled={zoom >= 1.75} onClick={() => setZoom((value) => Math.min(1.75, value + 0.15))}>＋</button><button onClick={fit} data-testid="architecture-fit">전체 보기</button></div>
      </div>
      <div className="blueprint-view-switch"><button aria-pressed={overview} onClick={() => setOverview(true)}>계층 개요</button><button aria-pressed={!overview} onClick={() => setOverview(false)} data-testid="architecture-modules">모듈 상세</button><span>{overview ? "계층 간 참조를 묶어서 표시" : `선택한 모듈의 참조 ${edges.length}개 표시`}</span></div>
      <nav className="ecosystem-filters" aria-label="코드 계층 필터"><button aria-pressed={layer === "all"} onClick={() => filterLayer("all")}>전체</button>{architecture.layers.map((entry) => <button key={entry.id} aria-pressed={layer === entry.id} onClick={() => filterLayer(entry.id)} data-layer={entry.id}><i style={{ background: entry.color }}/>{entry.title}</button>)}</nav>
      {(query || layer !== "all") && <div className="ecosystem-results" aria-live="polite"><span>{matches.length ? `${matches.length}개 일치` : "일치하는 모듈이 없습니다."}</span>{matches.map((node) => <button key={node.id} onClick={() => select(node, true)}>{node.title}</button>)}<button className="ecosystem-clear" onClick={() => { setQuery(""); setLayer("all"); }}>필터 초기화</button></div>}
      <div className="blueprint-canvas-caption"><span>{overview ? "LAYER OVERVIEW" : "MODULE DEPENDENCIES"}</span><span>화살표: 참조하는 쪽 → 참조되는 쪽</span></div>
      <div className="ecosystem-viewport blueprint-viewport" ref={viewport} tabIndex={0} aria-label="코드 설계도. Tab과 방향키로 노드 이동, Enter와 Space로 선택."
        onPointerDown={(event) => { if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest('[role="button"]')) return; drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (!drag.current) return; event.currentTarget.scrollLeft = drag.current.left - event.clientX + drag.current.x; event.currentTarget.scrollTop = drag.current.top - event.clientY + drag.current.y; }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
        <svg className="ecosystem-svg blueprint-svg" width={layout.width * zoom} height={layout.height * zoom} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-label={overview ? "계층별 코드 참조 개요" : "실제 소스 모듈과 선택된 참조"}>
          <defs><marker id="architecture-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>
          {layout.bands.map((band) => { const entry = architecture.layers.find((item) => item.id === band.id)!; return <g key={band.id} className="blueprint-band"><rect {...{ x: band.x, y: band.y, width: band.width, height: band.height }} rx="8"/><text x={band.x + 12} y={band.y + 29} fill={entry.color}>{entry.title}</text><text x={band.x + 12} y={band.y + 51} className="blueprint-band-count">{architecture.nodes.filter((node) => node.layer === band.id).length} MODULES</text></g>; })}
          <g aria-hidden="true">{edges.map((edge, index) => <path key={edge.id} data-from={edge.from} data-to={edge.to} className={`blueprint-edge ${edge.active ? "is-connected" : ""} ${edge.mode === "type" ? "is-type" : ""}`} d={architectureEdgePath(placed.get(edge.from)!, placed.get(edge.to)!, index, overview)} markerEnd="url(#architecture-arrow)"><title>{edge.from} → {edge.to}</title></path>)}</g>
          {layout.nodes.map((position, index) => {
            const entry = overview ? architecture.layers.find((item) => item.id === position.id)! : architecture.nodes.find((item) => item.id === position.id)!;
            const entryLayer = architecture.layers.find((item) => item.id === (overview ? entry.id : "layer" in entry ? entry.layer : ""))!;
            const matched = overview ? matches.some((node) => node.layer === entry.id) : matchIds.has(entry.id);
            const active = overview ? entry.id === selected.layer : entry.id === selectedId;
            const layerNodes = architecture.nodes.filter((node) => node.layer === entry.id);
            function choose() { if (overview) { const first = layerNodes[0]; if (first) select(first); } else { const node = architecture.nodes.find((item) => item.id === entry.id); if (node) select(node); } }
            return <g key={entry.id} id={`architecture-node-${index}`} transform={`translate(${position.x} ${position.y})`} role="button" tabIndex={matched ? 0 : -1} aria-label={overview ? `${entry.title}, ${layerNodes.length}개 모듈` : `${entry.title}, ${"file" in entry ? entry.file : ""}`} aria-pressed={active} data-node-id={entry.id}
              className={`blueprint-node ${active ? "is-selected" : ""} ${!overview && neighborhood.has(entry.id) ? "is-neighbor" : ""} ${matched ? "" : "is-dimmed"}`}
              onClick={choose} onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(); } else if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); focusNext(index, event.key); } }}>
              <rect width={position.width} height={position.height} rx="7"/><rect className="blueprint-node-accent" width="3" height={position.height - 22} x="0" y="11" fill={entryLayer.color}/>
              <text x="16" y={overview ? "31" : "26"} className="blueprint-node-title">{entry.title}</text>
              <text x="16" y={overview ? "57" : "47"} className="blueprint-node-meta">{overview && "description" in entry ? entry.description : "file" in entry ? entry.file.replace("scripts/workflow/", "") : ""}</text>
              {overview && <text x="516" y="34" textAnchor="end" className="blueprint-node-count">{layerNodes.length.toString().padStart(2, "0")}</text>}
            </g>;
          })}
        </svg>
      </div>
      <footer className="ecosystem-legend"><span><i className="eco-line"/>값 참조 · 혼합 참조</span><span><i className="eco-line planned"/>타입 전용</span><span>배경 드래그 · Tab / 방향키로 탐색</span></footer>
    </main>
    <aside className="ecosystem-detail blueprint-detail" aria-label="코드 근거와 모듈 상세">
      <div className="ecosystem-detail-heading">{overview ? "계층의 책임" : "선택한 모듈"}<span>CODE EVIDENCE</span></div>
      <div className="ecosystem-detail-content">
        <span className="ecosystem-category" style={{ color: selectedLayer.color }}>{selectedLayer.title}</span><h2>{overview ? selectedLayer.title : selected.title}</h2><p>{overview ? selectedLayer.description : selected.role}</p>
        {overview ? <><h3>포함된 모듈</h3><div className="blueprint-module-list">{architecture.nodes.filter((node) => node.layer === selected.layer).map((node) => <button key={node.id} onClick={() => select(node, true)}><strong>{node.title}</strong><code>{node.file}</code></button>)}</div><h3>계층 간 참조</h3><div className="blueprint-layer-relations">{aggregates.filter((edge) => edge.from === selected.layer || edge.to === selected.layer).map((edge) => <p key={`${edge.from}:${edge.to}`}>{architecture.layers.find((entry) => entry.id === edge.from)!.title} → {architecture.layers.find((entry) => entry.id === edge.to)!.title}<small>값·혼합 {edge.runtime} · 타입 {edge.types}</small></p>)}</div></> : <>
          <div className="blueprint-file"><code>{selected.file}:1–{selected.lines}</code><span>SHA-256 {selected.digest.slice(0, 12)}</span></div>
          <h3>실제 참조 <span>{connections.length}</span></h3><div className="ecosystem-connections">{connections.map(({ edge, node, outgoing }) => <div className="blueprint-connection" key={edge.id}>
            <button onClick={() => select(node, true)}><span className="ecosystem-direction">{outgoing ? "참조하는 모듈 →" : "← 이 모듈을 참조"} · {edge.mode === "type" ? "타입 전용" : edge.mode === "mixed" ? "값·타입 혼합" : "값 참조"}</span><strong>{node.title}</strong><code>{edge.from}:{edge.line}{edge.endLine !== edge.line ? `–${edge.endLine}` : ""}</code></button><details><summary>원문 근거 · {edge.syntax}</summary><pre>{edge.statement}</pre></details>
          </div>)}</div>{!connections.length && <p>분석 범위 안의 모듈 참조가 없습니다.</p>}
        </>}
        <details className="blueprint-scope"><summary>분석 범위와 한계</summary><p>src의 TypeScript와 개발 workflow 핵심 모듈의 정적 import·export, 문자열 dynamic import·require를 추출합니다. 실행 추적이 아니며 IPC·JSON-RPC 호출은 간선에 포함하지 않습니다.</p><p>외부 패키지·생성 JSON·범위 밖 참조 {architecture.excluded.length}개는 노드에서 제외합니다. 계층·역할은 사람이 정의한 분류입니다. 빌드 시 갱신하며 선택한 작업 폴더를 실시간 분석하지 않습니다.</p><code>{architecture.scope}</code></details>
      </div><p className="ecosystem-note">번들에 포함된 소스 snapshot입니다. 파일·행은 해당 snapshot 기준입니다. 현재 실행 상태와 생태계의 후속 방향은 별도입니다.</p>
    </aside>
  </>;
}
