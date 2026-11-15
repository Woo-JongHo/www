/**
 * @architecture arch.blueprint.view
 * @implements RESP-BLUEPRINT-VIEW
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ecosystemEdges, ecosystemGroups, ecosystemNodes, matchingNodes, nodeConnections, type EcosystemGroup, type EcosystemNode } from "./ecosystem";

import { architecture } from "./architecture";
import { createArchitectureTree, layoutResponsibilityGraph, responsibilityHierarchyPath, responsibilityEdgePath, responsibilityFit } from "./architecture-tree";

const structureTree = createArchitectureTree(architecture);

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

function EcosystemGuide({ onLocate, active }: { onLocate: (id: string) => void; active: boolean }) {
  const [selectedId, setSelectedId] = useState("chat")                        ;
  const [query     , setQuery     ] = useState("")                            ;
  const [group     , setGroup     ] = useState<EcosystemGroup | "all">("all") ;
  const [zoom      , setZoom      ] = useState(1)                             ;
  const fitted = useRef(false);
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
    if (!element || !element.clientWidth || !element.clientHeight) return;
    setZoom(Math.max(0.35, Math.min(1.25, (element.clientWidth - 24) / WIDTH, (element.clientHeight - 24) / HEIGHT)));
    element.scrollTo(0, 0);
  }

  useEffect(() => {
    if (active && !fitted.current) { fit(); fitted.current = true; }
  }, [active]);

  function selectNode(node: EcosystemNode, reveal = false) {
    setSelectedId(node.id);
    if (reveal && viewport.current) {
      const element = viewport.current;
      element.scrollTo({ left: (node.x + NODE_WIDTH / 2) * zoom - element.clientWidth / 2, top: (node.y + NODE_HEIGHT / 2) * zoom - element.clientHeight / 2 });
    }
  }

  return <>
    <main className="ecosystem-work" aria-label="WWW 생태계 지도">
      <header className="ecosystem-header"><div><h1>기능과 처리 관계</h1><p>제품의 개념 관계에서 근거가 있는 담당 코드로 이동합니다.</p></div><span className="ecosystem-badge">개념 지도 · 실행 추적 아님</span></header>
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
      <footer className="ecosystem-legend"><span><i className="eco-line"/>개념적 처리 관계</span><span><i className="eco-line planned"/>후속 방향</span><span>실제 호출 순서 아님 · 배경 드래그로 이동</span></footer>
    </main>
    <aside className="ecosystem-detail" aria-label="선택한 노드 상세">
      <div className="ecosystem-detail-heading">노드 살펴보기</div>
      <div className={`ecosystem-detail-content eco-${selected.group}`}><span className="ecosystem-category">{ecosystemGroups.find((entry) => entry.id === selected.group)!.title}</span><h2>{selected.title}</h2><div className="ecosystem-subtitle">{selected.subtitle}</div><p>{selected.description}</p>
        <h3>연결 관계 <span>{connections.length}</span></h3>
        <div className="ecosystem-connections">{connections.map(({ edge, node, outgoing }) => <button key={`${edge.from}-${edge.to}`} onClick={() => selectNode(node, true)}><span className="ecosystem-direction">{outgoing ? "나가는 연결 ↗" : "들어오는 연결 ↙"}{edge.planned ? " · 후속" : ""}</span><strong>{node.title}</strong><span>{edge.label}</span></button>)}</div>
        <h3>구조의 근거와 담당 코드</h3><ul className="ecosystem-sources">{selected.sources.map((source) => {
          const matches = structureTree.search(source);
          return <li key={source}><code>{source}</code>{matches.length ? matches.map((entry) => <button key={entry.id} className="blueprint-source-link" onClick={() => onLocate(entry.id)}>{entry.title} · <code>{entry.id}</code> 보기</button>) : <span>이 근거에 연결된 구조 ID 미제공</span>}</li>;
        })}</ul>
      </div>
      <p className="ecosystem-note">번들에 포함된 구조 안내입니다. 실시간 실행 상태나 자동 소스 분석 결과가 아닙니다. 근거 경로는 저장소 기준입니다.</p>
    </aside>
  </>;
}

export const EcosystemView = memo(function EcosystemView({ hidden }: { hidden: boolean }) {
  const [guide, setGuide] = useState(false);
  const [requested, setRequested] = useState<{ id: string; revision: number } | null>(null);
  function locate(id: string) {
    setGuide(false);
    setRequested((previous) => ({ id, revision: (previous?.revision ?? 0) + 1 }));
  }
  return <section className="ecosystem-shell" hidden={hidden} aria-label="WWW 구조 탐색">
    <nav className="blueprint-tabs" aria-label="구조 보기">
      <button aria-pressed={!guide} onClick={() => setGuide(false)} data-testid="architecture-tab">기능·책임 지도</button>
      <button aria-pressed={guide} onClick={() => setGuide(true)} data-testid="ecosystem-guide-tab">개념 처리 관계</button>
      <span>{guide ? "개념 관계와 실제 코드 근거를 구별합니다" : "기능 → 처리 책임 → 담당 코드 · 안정 구조 ID"}</span>
    </nav>
    <div className="ecosystem-page" hidden={guide}><CodeBlueprintView requested={requested}/></div>
    <div className="ecosystem-page" hidden={!guide}><EcosystemGuide onLocate={locate} active={guide && !hidden}/></div>
  </section>;
});

function CodeBlueprintView({ requested }: { requested: { id: string; revision: number } | null }) {
  const tree = structureTree;
  const [currentId, setCurrentId] = useState(architecture.structure.rootId);
  const [selectedId, setSelectedId] = useState(architecture.structure.rootId);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const manualZoom           = useRef(false)                                                            ;
  const viewport             = useRef<HTMLDivElement>(null)                                             ;
  const drag                 = useRef<{ x: number; y: number; left: number; top: number } | null>(null) ;
  const focusAfterNavigation = useRef(false)                                                            ;
  const previousCurrentId    = useRef(currentId)                                                        ;
  const current              = tree.node(currentId)                                                     ;
  const selected             = tree.node(selectedId)                                                    ;
  const children             = tree.children(currentId)                                                 ;
  const matches              = tree.search(query)                                                       ;
  const refs                 = tree.evidence(selectedId)                                                ;
  const connections          = tree.connections(selectedId)                                             ;
  const dependencies         = tree.dependencies(currentId)                                             ;
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      // 스크롤바 등장만으로 수동 확대를 다시 맞추지 않는다.
      const bounds = element.getBoundingClientRect()                                  ;
      const width  = Math   .max                  (0, Math.floor(bounds.width) - 16 ) ;
      const height = Math   .max                  (0, Math.floor(bounds.height) - 16) ;
      if (!width || !height) return;
      setViewportSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    });
    const resized = () => { manualZoom.current = false; };
    window.addEventListener("resize", resized);
    observer.observe(element, { box: "border-box" });
    return () => { observer.disconnect(); window.removeEventListener("resize", resized); };
  }, []);
  const layout = useMemo(() => layoutResponsibilityGraph(tree.node(currentId), tree.children(currentId), viewportSize.width), [currentId, viewportSize.width]) ;
  const placed = new Map(layout.nodes.map((entry) => [entry.id, entry]))                                                                       ;

  function fit() {
    const element = viewport.current;
    if (!element || !element.clientWidth || !element.clientHeight) return;
    manualZoom.current = false;
    setZoom(responsibilityFit(layout, { width: element.clientWidth, height: element.clientHeight }));
    element.scrollTo(0, 0);
  }
  useEffect(() => { manualZoom.current = false; }, [currentId]);
  useEffect(() => { if (!manualZoom.current) fit(); }, [currentId, viewportSize.width, viewportSize.height]);
  function changeZoom(delta: number) {
    manualZoom.current = true;
    setZoom((value) => Math.max(0.25, Math.min(2.5, value + delta)));
  }
  function navigate(id: string, keyboard = false) {
    const location = tree.location(id);
    setCurrentId(location.currentId);
    setSelectedId(location.selectedId);
    setDetailOpen(true);
    setQuery("");
    focusAfterNavigation.current = keyboard;
  }
  function returnTo(id: string) {
    setCurrentId(id);
    setSelectedId(id);
    setQuery("");
    focusAfterNavigation.current = true;
  }
  function closeDetail() {
    setDetailOpen(false);
    requestAnimationFrame(() => document.querySelector<SVGElement>(`[data-node-id="${selectedId}"]`)?.focus({ preventScroll: true }));
  }
  useEffect(() => { if (requested) navigate(requested.id, true); }, [requested]);
  useEffect(() => {
    const navigationZoom = previousCurrentId.current === currentId ? zoom : responsibilityFit(layout, viewportSize);
    previousCurrentId.current = currentId;
    const position = layout.nodes.find((entry) => entry.id === selectedId) ;
    const element  = viewport.current                                      ;
    if (element) element.scrollTo({ left: position ? Math.max(0, (position.x + position.width / 2) * navigationZoom - element.clientWidth / 2) : 0, top: position ? Math.max(0, (position.y + position.height / 2) * navigationZoom - element.clientHeight / 2) : 0 });
    if (focusAfterNavigation.current) {
      const target = document.querySelector<SVGElement>(`.blueprint-node[data-node-id="${selectedId}"]`) ?? document.querySelector<SVGElement>('.blueprint-node');
      target?.focus({ preventScroll: true });
      focusAfterNavigation.current = false;
    }
  }, [currentId, selectedId]);
  function focusNext(index: number, key: string) {
    const next = key === 'Home' ? 0 : key === 'End' ? children.length - 1 : Math.max(0, Math.min(children.length - 1, index + (key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1)));
    document.getElementById(`architecture-node-${next}`)?.focus();
  }
  return <>
    <main className="ecosystem-work blueprint-work" aria-label="WWW 기능과 코드 연결 지도" data-current-id={currentId} onKeyDown={(event) => { if (event.key === "Escape" && detailOpen) { event.preventDefault(); closeDetail(); } }}>
      <header className="ecosystem-header blueprint-header"><div><h1>WWW Node Map</h1><p>기능에서 처리 책임을 따라 담당 코드와 근거를 읽습니다.</p></div></header>
      <div className="blueprint-summary"><span>현재 구조 <code data-testid="architecture-current">{currentId}</code></span><code title={architecture.digest}>snapshot {architecture.digest.slice(0, 10)}</code></div>
      <nav className="blueprint-breadcrumb" aria-label="구조 경로"><button data-testid="architecture-root" onClick={() => returnTo(architecture.structure.rootId)}>전체</button>{tree.breadcrumb(currentId).map((entry) => <button key={entry.id} data-ancestor-id={entry.id} aria-current={entry.id === currentId ? 'location' : undefined} onClick={() => returnTo(entry.id)}>{entry.title}</button>)}<button disabled={!current.parent} onClick={() => current.parent && returnTo(current.parent)}>뒤로</button></nav>
      <div className="ecosystem-toolbar">
        <label className="ecosystem-search"><span>검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="구조 ID, 요구 ID, 제목, 파일" aria-label="구조와 요구 검색"/></label>
        <div className="ecosystem-zoom" aria-label="설계도 배율"><button aria-label="설계도 축소" disabled={zoom <= 0.25} onClick={() => changeZoom(-0.15)}>−</button><output data-testid="architecture-zoom">{Math.round(zoom * 100)}%</output><button aria-label="설계도 확대" disabled={zoom >= 2.5} onClick={() => changeZoom(0.15)}>＋</button><button data-testid="architecture-fit" onClick={fit}>크기 맞춤</button><button data-testid="architecture-detail-toggle" aria-pressed={detailOpen} onClick={() => detailOpen ? closeDetail() : setDetailOpen(true)}>선택 상세</button></div>
      </div>
      {query.trim() && <div className="ecosystem-results" aria-live="polite">{matches.length ? matches.map((entry) => <button key={entry.id} data-result-id={entry.id} onClick={() => navigate(entry.id, true)}>{entry.title} <code>{entry.id}</code></button>) : <span>일치하는 구조가 없습니다. 검색어를 바꿔 보세요.</span>}<button className="ecosystem-clear" onClick={() => setQuery("")}>검색 초기화</button></div>}
      <div className="blueprint-canvas-caption"><span>{current.title} → 직계 하위 책임 {children.length}개</span><span>회색: 계층 · 파랑: 실제 import · 점선: 타입 전용</span></div>
      <div className="ecosystem-viewport blueprint-viewport" ref={viewport} tabIndex={0} aria-label="책임 계층 지도. Tab과 방향키로 이동, Enter 또는 Space로 진입"
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest('[role="button"]')) return;
          const element = event.currentTarget;
          drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
          element.setPointerCapture(event.pointerId);
        }} onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
          event.currentTarget.scrollTop = start.top - (event.clientY - start.y);
        }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <svg className="ecosystem-svg blueprint-svg" width={layout.width * zoom} height={layout.height * zoom} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-label={`${current.title} 하위 책임`}>
          <defs><marker id="blueprint-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>
          {layout.nodes.map((entry) => <path key={`parent:${entry.id}`} className="blueprint-hierarchy" d={responsibilityHierarchyPath(layout.parent, entry)} markerEnd="url(#blueprint-arrow)"><title>{current.id} → {entry.id}: 정본 책임 계층 · 실행 순서 아님</title></path>)}
          {dependencies.map((edge, index) => <path key={`${edge.from}:${edge.to}`} d={responsibilityEdgePath(placed.get(edge.from)!, placed.get(edge.to)!, index)} markerEnd="url(#blueprint-arrow)" className={`blueprint-edge is-connected ${edge.type && !edge.runtime && !edge.mixed ? 'is-type' : ''}`}><title>{edge.from} → {edge.to}: runtime {edge.runtime}, mixed {edge.mixed}, type {edge.type}</title></path>)}
          <g className="blueprint-parent" data-node-id={current.id} transform={`translate(${layout.parent.x} ${layout.parent.y})`} role="button" tabIndex={0} aria-label={`${current.title}, 현재 기능과 책임`} onClick={() => { setSelectedId(current.id); setDetailOpen(true); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(current.id); setDetailOpen(true); } }}><rect width={layout.parent.width} height={layout.parent.height} rx="7"/><text x="18" y="24" className="blueprint-node-title">{current.title}</text><text x="18" y="43" className="blueprint-node-meta">{current.id}</text></g>
          {layout.nodes.map((entry, index) => <g key={entry.id} id={`architecture-node-${index}`} data-node-id={entry.id} className={`blueprint-node ${entry.id === selectedId ? 'is-selected' : ''}`} transform={`translate(${entry.x} ${entry.y})`} role="button" tabIndex={0} aria-label={`${entry.title}, ${entry.id}, ${tree.children(entry.id).length ? '하위 책임 열기' : '명세와 구현 보기'}`} aria-pressed={entry.id === selectedId}
            onClick={() => navigate(entry.id)} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(entry.id, true); }
              else if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); focusNext(index, event.key); }
            }}>
            <rect width={entry.width} height={entry.height} rx="7"/><text x="18" y="29" className="blueprint-node-title">{entry.title}</text><text x="18" y="52" className="blueprint-node-meta">{entry.id}</text><text x="18" y="70" className="blueprint-node-meta">{tree.children(entry.id).length ? `하위 책임 ${tree.children(entry.id).length}개 · 눌러서 진입` : '명세 · 구현 · 검증 참조 보기'}</text>
          </g>)}
        </svg>
      </div>
      <details className="blueprint-stage-dependencies"><summary>현재 단계의 실제 의존 {dependencies.length}개</summary>{dependencies.map((edge) => <p key={`${edge.from}:${edge.to}`}><code>{edge.from} → {edge.to}</code><span>runtime {edge.runtime} · mixed {edge.mixed} · type {edge.type}</span></p>)}{!dependencies.length && <p>직계 하위 책임 사이의 import 참조가 없습니다. 범위 밖 참조는 선택한 책임의 상세에서 읽습니다.</p>}</details>
      <footer className="ecosystem-legend"><span>배경 드래그로 이동 · 기능/책임 진입 · 선택 후 코드 근거</span><span>계층·import는 실행 추적이 아닙니다.</span></footer>
    </main>
    <aside className="ecosystem-detail blueprint-detail" hidden={!detailOpen} aria-label="선택한 책임 상세" data-selected-id={selectedId} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeDetail(); } }}>
      <div className="ecosystem-detail-heading"><button data-testid="architecture-detail-close" aria-label="지도 선택 상세 닫기" onClick={closeDetail}>닫기</button>선택한 책임 <code>{selectedId}</code></div>
      <div className="ecosystem-detail-content"><h2>{selected.title}</h2><p>{selected.description}</p>
        {tree.children(selectedId).length > 0 && <p>하위 책임을 선택하면 해당 ID의 명세·구현·검증 참조를 읽을 수 있습니다.</p>}
        <h3>명세 요구</h3><ul className="ecosystem-sources blueprint-requirements">{refs.requirements.map((ref) => <li key={ref.id}><strong>{ref.id}</strong><p>{ref.description}</p><code>{ref.file}:{ref.line}</code></li>)}</ul>{!refs.requirements.length && <p>이 단계에 직접 등록된 요구가 없습니다. 하위 책임에서 확인하세요.</p>}
        <h3>구현 선언</h3><ul className="ecosystem-sources blueprint-declarations">{refs.declarations.map((ref) => <li key={ref.file}><code>{ref.file}:{ref.line}</code><span>{ref.requirementIds.join(', ')}</span></li>)}</ul>
        {!refs.declarations.length && <p>이 책임의 직접 구현 근거 미제공입니다. 하위 책임 또는 등록된 명세를 확인하세요.</p>}
        <h3>검증 참조 / 선언</h3><ul className="ecosystem-sources blueprint-tests">{refs.tests.map((ref) => <li key={ref.file}><code>{ref.file}:{ref.line}</code><span>{ref.requirementIds.filter((id) => refs.requirements.some((req) => req.id === id)).join(', ')}</span></li>)}</ul><p>테스트 등록은 현재 테스트 실행 결과나 통과 판정이 아닙니다.</p>
        <h3>선택 범위 밖 실제 참조 <span>{connections.length}</span></h3><div className="ecosystem-connections">{connections.map(({ edge, target, outgoing }) => <div className="blueprint-connection" key={edge.id}><button onClick={() => navigate(target.id, true)}><span className="ecosystem-direction">{outgoing ? '참조하는 책임 →' : '← 이 책임을 참조'} · {edge.mode}</span><strong>{target.title}</strong><code>{target.id}</code><code>{edge.from}:{edge.line} → {edge.to}</code></button><details><summary>import 원문 근거</summary><pre>{edge.statement}</pre></details></div>)}</div>
        <details className="blueprint-scope"><summary>분석 범위와 한계</summary><p>구조와 단일 부모는 정본 계약의 선언입니다. 파일 경로는 이동할 수 있고 책임 ID는 유지합니다. 선은 정적 import를 현재 하위 책임으로 축약한 실제 참조이며 IPC·함수 호출·실행 추적이 아닙니다. 같은 책임을 공유하는 파일 사이 참조는 경계선으로 표시하지 않습니다.</p><p>외부 패키지·생성물 등 제외 {architecture.excluded.length}개. 선택한 저장소의 실시간 분석이 아닌 번들 snapshot입니다.</p></details>
      </div><p className="ecosystem-note">명세·파일·테스트의 행은 snapshot의 선언 위치입니다. 등록 검사는 요구 충족의 의미를 증명하지 않습니다.</p>
    </aside>
  </>;
}
