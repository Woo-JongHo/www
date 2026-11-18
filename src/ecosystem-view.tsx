/**
 * @architecture arch.blueprint.view
 * @implements RESP-BLUEPRINT-VIEW
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ecosystemEdges, ecosystemGroups, ecosystemNodes, matchingNodes, nodeConnections, type EcosystemGroup, type EcosystemNode } from "./ecosystem";

import { architecture } from "./architecture";
import { useSessionApi } from "./session-api";
import { developmentStatechart, readWorkflowReport, statechartSnapshotState, workflowModelFor } from "./workflow-statechart";
import { WorkflowStatechartView } from "./workflow-statechart-view";
import { createArchitectureTree, layoutResponsibilityGraph, responsibilityHierarchyPath, responsibilityEdgePath, responsibilityEdgePoints, responsibilityLines, responsibilityFit } from "./architecture-tree";

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

function EcosystemGuide({ onLocate, active, namespace }: { onLocate: (id: string) => void; active: boolean; namespace: string }) {
  const arrowId = `${namespace}-eco-arrow`;
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
          <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>
          {ecosystemGroups.map((entry) => <g key={entry.id} className={`eco-band eco-${entry.id}`}><rect x="20" y={entry.y - 10} width="1140" height={entry.id === "app" ? 300 : 180} rx="12"/><text x="40" y={entry.y + 20} className="eco-band-title">{entry.title}</text><text x="180" y={entry.y + 20} className="eco-band-description">{entry.description}</text></g>)}
          <g aria-hidden="true">{ecosystemEdges.map((edge) => {
            const from   = ecosystemNodes.find((node) => node.id === edge.from)!             ;
            const to     = ecosystemNodes.find((node) => node.id === edge.to)!               ;
            const active = edge.from === selectedId || edge.to === selectedId                ;
            const dimmed = filtering && (!matchIds.has(edge.from) || !matchIds.has(edge.to)) ;
            return <path key={`${edge.from}-${edge.to}`} d={edgePath(from, to)} className={`eco-edge ${active ? "is-connected" : ""} ${edge.planned ? "is-planned" : ""} ${dimmed ? "is-dimmed" : ""}`} markerEnd={`url(#${arrowId})`}><title>{from.title} → {to.title}: {edge.label}</title></path>;
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

export const EcosystemView = memo(function EcosystemView({ hidden, namespace = "default", onNavigationChange }: { hidden: boolean; namespace?: string; onNavigationChange?: (open: boolean) => void }) {
  const [guide, setGuide] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [requested, setRequested] = useState<{ id: string; revision: number } | null>(null);
  function locate(id: string) {
    setGuide(false);
    setRequested((previous) => ({ id, revision: (previous?.revision ?? 0) + 1 }));
  }
  return <section className="ecosystem-shell" hidden={hidden} data-navigation-open={navigationOpen} aria-label="WWW 구조 탐색">
    <nav className="blueprint-tabs" aria-label="구조 보기">
      <button data-testid="architecture-navigation-toggle" aria-expanded={navigationOpen} aria-controls={`workspace-sidebar-${namespace}`} onClick={() => { const open = !navigationOpen; setNavigationOpen(open); onNavigationChange?.(open); }}>{navigationOpen ? '탐색 접기' : '탐색 열기'}</button>
      <button aria-pressed={!guide} onClick={() => setGuide(false)} data-testid="architecture-tab">기능·책임 지도</button>
      <button aria-pressed={guide} onClick={() => setGuide(true)} data-testid="ecosystem-guide-tab">개념 처리 관계</button>
      <span>{guide ? "개념 관계와 실제 코드 근거를 구별합니다" : "기능 → 처리 책임 → 담당 코드 · 안정 구조 ID"}</span>
    </nav>
    <div className="ecosystem-page" hidden={guide}><CodeBlueprintView requested={requested} namespace={namespace}/></div>
    <div className="ecosystem-page" hidden={!guide}><EcosystemGuide onLocate={locate} active={guide && !hidden} namespace={namespace}/></div>
  </section>;
});

function CodeBlueprintView({ requested, namespace }: { requested: { id: string; revision: number } | null; namespace: string }) {
  const api = useSessionApi();
  const [statechartOpen, setStatechartOpen] = useState(false);
  const statechartSnapshot = statechartSnapshotState(architecture);
  const arrowId = `${namespace}-blueprint-arrow`;
  const tree = structureTree;
  const [currentId, setCurrentId] = useState(architecture.structure.rootId);
  const [selectedId, setSelectedId] = useState(architecture.structure.rootId);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [relationMode, setRelationMode] = useState<'structure' | 'references'>('structure');
  const [referenceFocus, setReferenceFocus] = useState('all');
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
  const overview             = tree.summary(selectedId);
  const dependencies         = tree.dependencies(currentId)                                             ;
  const visibleDependencies = dependencies.filter((edge) => referenceFocus === 'all' || edge.from === referenceFocus || edge.to === referenceFocus);
  const drawnDependencies = relationMode === 'references' ? visibleDependencies : [];
  const connectionGroups = [...new Map(connections.map((connection) => {
    const key = `${connection.outgoing}:${connection.target.id}`;
    return [key, { key, target: connection.target, outgoing: connection.outgoing,
      refs: connections.filter((entry) => entry.target.id === connection.target.id && entry.outgoing === connection.outgoing) }];
  })).values()];
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
  const layout = useMemo(() => layoutResponsibilityGraph(tree.node(currentId), tree.children(currentId), viewportSize.width, drawnDependencies.length), [currentId, viewportSize.width, drawnDependencies.length]) ;
  const placed = new Map(layout.nodes.map((entry) => [entry.id, entry]))                                                                       ;

  function fit() {
    const element = viewport.current;
    if (!element || !element.clientWidth || !element.clientHeight) return;
    manualZoom.current = false;
    setZoom(responsibilityFit(layout, { width: element.clientWidth, height: element.clientHeight }));
    element.scrollTo(0, 0);
  }
  useEffect(() => { manualZoom.current = false; setReferenceFocus("all"); }, [currentId]);
  useEffect(() => { if (!manualZoom.current) fit(); }, [currentId, viewportSize.width, viewportSize.height, relationMode, referenceFocus]);
  function changeZoom(delta: number) {
    manualZoom.current = true;
    setZoom((value) => Math.max(0.25, Math.min(2.5, value + delta)));
  }
  function navigate(id: string, keyboard = false) {
    setStatechartOpen(false);
    const location = tree.location(id);
    setCurrentId(location.currentId);
    setSelectedId(location.selectedId);
    setQuery("");
    focusAfterNavigation.current = keyboard;
  }
  function returnTo(id: string) {
    setStatechartOpen(false);
    setDetailOpen(false);
    setCurrentId(id);
    setSelectedId(id);
    setQuery("");
    focusAfterNavigation.current = true;
  }
  function closeDetail() {
    setDetailOpen(false);
    requestAnimationFrame(() => viewport.current?.querySelector<SVGElement>(`[data-node-id="${selectedId}"]`)?.focus({ preventScroll: true }));
  }
  useEffect(() => { if (requested) { navigate(requested.id, true); setDetailOpen(true); } }, [requested]);
  useEffect(() => {
    const navigationZoom = previousCurrentId.current === currentId ? zoom : responsibilityFit(layout, viewportSize);
    previousCurrentId.current = currentId;
    const position = layout.nodes.find((entry) => entry.id === selectedId) ;
    const element  = viewport.current                                      ;
    if (element) element.scrollTo({ left: position ? Math.max(0, (position.x + position.width / 2) * navigationZoom - element.clientWidth / 2) : 0, top: position ? Math.max(0, (position.y + position.height / 2) * navigationZoom - element.clientHeight / 2) : 0 });
    if (focusAfterNavigation.current) {
      const target = viewport.current?.querySelector<SVGElement>(`.blueprint-node[data-node-id="${selectedId}"]`) ?? viewport.current?.querySelector<SVGElement>('.blueprint-node');
      target?.focus({ preventScroll: true });
      focusAfterNavigation.current = false;
    }
  }, [currentId, selectedId]);
  function focusNext(index: number, key: string) {
    const next = key === 'Home' ? 0 : key === 'End' ? children.length - 1 : Math.max(0, Math.min(children.length - 1, index + (key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1)));
    document.getElementById(`${namespace}-architecture-node-${next}`)?.focus();
  }
  return <>
    <main hidden={statechartOpen} className="ecosystem-work blueprint-work" aria-label="WWW 기능과 코드 연결 지도" data-current-id={currentId} onKeyDown={(event) => { if (event.key === "Escape" && detailOpen) { event.preventDefault(); closeDetail(); } }}>
      <header className="ecosystem-header blueprint-header"><div><h1>WWW 구조 지도</h1><p>역할과 구성을 살펴보고, 연결된 책임과 담당 코드를 찾습니다.</p></div></header>
      <div className="blueprint-summary"><span>현재 구조 <code data-testid="architecture-current">{currentId}</code></span><code title={architecture.digest}>snapshot {architecture.digest.slice(0, 10)}</code></div>
      <nav className="blueprint-breadcrumb" aria-label="구조 경로"><button data-testid="architecture-root" onClick={() => returnTo(architecture.structure.rootId)}>전체</button>{tree.breadcrumb(currentId).map((entry) => <button key={entry.id} data-ancestor-id={entry.id} aria-current={entry.id === currentId ? 'location' : undefined} onClick={() => returnTo(entry.id)}>{entry.title}</button>)}<button disabled={!current.parent} onClick={() => current.parent && returnTo(current.parent)}>뒤로</button></nav>
      <div className="ecosystem-toolbar">
        <label className="ecosystem-search"><span>검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="구조 ID, 요구 ID, 제목, 파일" aria-label="구조와 요구 검색"/></label>
        <div className="ecosystem-zoom" aria-label="설계도 배율"><button aria-label="설계도 축소" disabled={zoom <= 0.25} onClick={() => changeZoom(-0.15)}>−</button><output data-testid="architecture-zoom">{Math.round(zoom * 100)}%</output><button aria-label="설계도 확대" disabled={zoom >= 2.5} onClick={() => changeZoom(0.15)}>＋</button><button data-testid="architecture-fit" onClick={fit}>크기 맞춤</button></div>
      </div>
      {query.trim() && <div className="ecosystem-results" aria-live="polite">{matches.length ? matches.map((entry) => <button key={entry.id} data-result-id={entry.id} onClick={() => navigate(entry.id, true)}>{entry.title} <code>{entry.id}</code></button>) : <span>일치하는 구조가 없습니다. 검색어를 바꿔 보세요.</span>}<button className="ecosystem-clear" onClick={() => setQuery("")}>검색 초기화</button></div>}
      <div className="blueprint-relation-toolbar">
        <div className="blueprint-relation-switch" aria-label="관계 표시">
          <button data-testid="architecture-structure-mode" aria-pressed={relationMode === 'structure'} onClick={() => setRelationMode('structure')}>내부 구성</button>
          <button data-testid="architecture-reference-mode" aria-pressed={relationMode === 'references'} onClick={() => setRelationMode('references')}>코드 의존 관계 <span>{dependencies.length}</span></button>
        </div>
        {relationMode === 'references' && <label>참조 강조 <select aria-label="참조 강조 대상" value={referenceFocus} onChange={(event) => { setReferenceFocus(event.target.value); if (event.target.value !== 'all') { setSelectedId(event.target.value); } }}><option value="all">현재 단계 전체</option>{children.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>}
      </div>
      <div className="blueprint-canvas-caption"><span>{current.title} · 하위 구성 {children.length}개</span><span>{relationMode === 'structure' ? '포함 관계 · 노드를 누르면 역할과 내부 구성 열기' : '오른쪽에서 참조 → 왼쪽으로 도착 · 점선은 타입 전용'}</span></div>
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
          <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>
          {relationMode === 'structure' && layout.nodes.map((entry) => <path key={`parent:${entry.id}`} className="blueprint-hierarchy" d={responsibilityHierarchyPath(layout.parent, entry)} markerEnd={`url(#${arrowId})`}><title>{current.id} → {entry.id}: 정본 책임 계층 · 실행 순서 아님</title></path>)}
          {drawnDependencies.map((edge, index) => {
            const from = placed.get(edge.from)!;
            const to = placed.get(edge.to)!;
            const start = responsibilityEdgePoints(from, to, index, drawnDependencies.length)[0]!;
            return <g key={`${edge.from}:${edge.to}`} className="blueprint-reference" data-from={edge.from} data-to={edge.to}>
              <path d={responsibilityEdgePath(from, to, index, drawnDependencies.length)} markerEnd={`url(#${arrowId})`} className={`blueprint-edge is-connected ${edge.type && !edge.runtime && !edge.mixed ? 'is-type' : ''} ${referenceFocus === edge.to ? 'is-incoming' : ''}`}><title>{from.title} → {to.title}: runtime {edge.runtime}, mixed {edge.mixed}, type {edge.type}</title></path>
              <text x={start.x + 8} y={start.y - 5} className="blueprint-edge-number">{index + 1}</text>
            </g>;
          })}
          <g className="blueprint-parent" data-node-id={current.id} transform={`translate(${layout.parent.x} ${layout.parent.y})`} role="button" tabIndex={0} aria-label={`${current.title}, 현재 기능과 책임`} onClick={() => { setSelectedId(current.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(current.id); } }}>
            <title>{current.id} · {current.description}</title><rect width={layout.parent.width} height={layout.parent.height} rx="8"/>
            <text x="18" y="27" className="blueprint-node-title">{current.title}</text>
            <text x="18" y="50" className="blueprint-node-description">{responsibilityLines(current.description).map((line, index) => <tspan key={index} x="18" dy={index ? 18 : 0}>{line}</tspan>)}</text>
            <text x="18" y="96" className="blueprint-node-meta">현재 구성 · 하위 책임 {children.length}개</text>
          </g>
          {layout.nodes.map((entry, index) => <g key={entry.id} id={`${namespace}-architecture-node-${index}`} data-node-id={entry.id} className={`blueprint-node ${entry.id === selectedId ? 'is-selected' : ''}`} transform={`translate(${entry.x} ${entry.y})`} role="button" tabIndex={0} aria-label={`${entry.title}, ${entry.id}, ${tree.children(entry.id).length ? '하위 책임 열기' : '명세와 구현 보기'}`} aria-pressed={entry.id === selectedId}
            onClick={() => navigate(entry.id)} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(entry.id, true); }
              else if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); focusNext(index, event.key); }
            }}>
            <title>{entry.id} · {entry.description}</title><rect width={entry.width} height={entry.height} rx="8"/>
            <text x="18" y="27" className="blueprint-node-title">{entry.title}</text>
            <text x="18" y="50" className="blueprint-node-description">{responsibilityLines(entry.description).map((line, lineIndex) => <tspan key={lineIndex} x="18" dy={lineIndex ? 18 : 0}>{line}</tspan>)}</text>
            <text x="18" y="96" className="blueprint-node-meta">{tree.children(entry.id).length ? `하위 구성 ${tree.children(entry.id).length}개 · 열기 →` : `담당 코드 ${tree.evidence(entry.id).declarations.length}개 · 상세 보기 →`}</text>
          </g>)}
        </svg>
      </div>
      {relationMode === 'references' && <div className="blueprint-stage-dependencies" aria-label="현재 단계 코드 의존 목록">
        {drawnDependencies.map((edge, index) => <div key={`${edge.from}:${edge.to}`} className="blueprint-dependency-row"><span>{index + 1}</span><button onClick={() => { setReferenceFocus(edge.from); setSelectedId(edge.from); }}>{tree.node(edge.from).title}</button><span>→</span><button onClick={() => { setReferenceFocus(edge.to); setSelectedId(edge.to); }}>{tree.node(edge.to).title}</button><small>실행 {edge.runtime} · 혼합 {edge.mixed} · 타입 {edge.type}</small></div>)}
        {!drawnDependencies.length && <p>현재 표시 범위의 구성 사이에 import 참조가 없습니다. 범위 밖 참조는 선택 상세에서 확인합니다.</p>}
      </div>}
      <section className="blueprint-selection-summary" aria-label="선택한 노드 요약" data-selected-id={selectedId}>
        <div><strong>{selected.title}</strong><p>{selected.description}</p><span>하위 구성 {overview.components.length}개 · 담당 코드 {overview.declarations.length}개</span></div>
        <div className="blueprint-selection-actions">{selectedId !== developmentStatechart.structureId && <button data-testid="architecture-workflow-locate" onClick={() => { navigate(developmentStatechart.structureId); setStatechartOpen(true); }}>개발 작업의 검증·수용·완료 상태도</button>}<button id={`${namespace}-statechart-open`} data-testid="architecture-statechart-open" onClick={() => setStatechartOpen(true)}>상태 전이 보기{workflowModelFor(selectedId) ? "" : " · 모델 없음"}</button>
        <button data-testid="architecture-detail-toggle" aria-expanded={detailOpen} aria-controls={`${namespace}-architecture-detail`} onClick={() => detailOpen ? closeDetail() : setDetailOpen(true)}>{detailOpen ? '상세 접기' : '자세히 보기'}</button></div>
      </section>

      <footer className="ecosystem-legend"><span>배경 드래그로 이동 · 노드를 눌러 내부 구성 탐색</span><span>포함 관계와 코드 참조 · 실행 추적 아님</span></footer>
    </main>
    {statechartOpen && <WorkflowStatechartView key={selectedId} model={workflowModelFor(selectedId)} snapshotState={statechartSnapshot.state} modelDigest={statechartSnapshot.modelDigest} sourceDigest={statechartSnapshot.sourceDigest} onReadEvidence={id => api.developmentStatus(id)} onReadReport={id => readWorkflowReport(api, id)} onClose={() => { setStatechartOpen(false); requestAnimationFrame(() => document.getElementById(`${namespace}-statechart-open`)?.focus()); }}/>}
    <aside id={`${namespace}-architecture-detail`} className="ecosystem-detail blueprint-detail" hidden={!detailOpen || statechartOpen} aria-label="선택한 책임 상세" data-selected-id={selectedId} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeDetail(); } }}>
      <div className="ecosystem-detail-heading"><button data-testid="architecture-detail-close" aria-label="지도 선택 상세 닫기" onClick={closeDetail}>닫기</button>선택한 책임 <code>{selectedId}</code></div>
      <div className="ecosystem-detail-content"><h2>{selected.title}</h2>
        <section className="blueprint-role" aria-label="역할과 책임"><h3>역할과 책임</h3><p>{selected.description}</p></section>
        <div className="blueprint-inventory" aria-label="선택 범위 구성 요약"><span><strong>{overview.components.length}</strong>하위 구성</span><span><strong>{overview.declarations.length}</strong>담당 코드</span><span><strong>{overview.requirements.length}</strong>명세 요구</span></div>
        <p className="blueprint-inventory-note">담당 코드·명세 수는 하위 책임을 포함한 범위입니다.</p>
        <section aria-label="내부 구성"><h3>내부 구성</h3><div className="blueprint-component-list">{overview.components.map((entry) => <button key={entry.id} onClick={() => navigate(entry.id, true)}><strong>{entry.title}<span>열기 →</span></strong><span>{entry.description}</span><small>하위 구성 {tree.children(entry.id).length}개 · 담당 코드 {tree.summary(entry.id).declarations.length}개</small></button>)}</div>
          {!overview.components.length && <p>더 나뉜 하위 책임이 없는 구성요소입니다. 아래 담당 코드에서 구현을 확인합니다.</p>}
        </section>
        <section aria-label="담당 코드"><h3>담당 코드 <span>{overview.declarations.length}</span></h3><ul className="ecosystem-sources blueprint-owned-code">{overview.declarations.map((ref) => <li key={ref.file}><code>{ref.file}:{ref.line}</code><button className="blueprint-source-link" onClick={() => navigate(ref.nodeId, true)}>{tree.node(ref.nodeId).title} · 담당 책임 보기</button></li>)}</ul>{!overview.declarations.length && <p>이 범위에 등록된 구현 선언이 없습니다.</p>}</section>
        {[true, false].map((outgoing) => <section key={String(outgoing)} aria-label={outgoing ? '참조하는 책임' : '이 책임을 참조'}><h3>{outgoing ? '참조하는 책임 →' : '← 이 책임을 참조'} <span>{connectionGroups.filter((entry) => entry.outgoing === outgoing).length}</span></h3><div className="ecosystem-connections">{connectionGroups.filter((entry) => entry.outgoing === outgoing).map((group) => <div className="blueprint-connection" key={group.key}><button data-target-id={group.target.id} onClick={() => navigate(group.target.id, true)}><strong>{group.target.title}</strong><span>{group.target.description}</span><span>import 근거 {group.refs.length}개 · 담당 책임 열기</span></button><details><summary>파일과 import 원문</summary>{group.refs.map(({ edge }) => <div key={edge.id}><code>{edge.from}:{edge.line} → {edge.to} · {edge.mode}</code><pre>{edge.statement}</pre></div>)}</details></div>)}</div>{!connectionGroups.some((entry) => entry.outgoing === outgoing) && <p>선택 범위 밖의 정적 import 참조가 없습니다.</p>}</section>)}
        <details className="blueprint-evidence"><summary>명세·구현·검증의 직접 등록 근거</summary>
        <h3>명세 요구</h3><ul className="ecosystem-sources blueprint-requirements">{refs.requirements.map((ref) => <li key={ref.id}><strong>{ref.id}</strong><p>{ref.description}</p><code>{ref.file}:{ref.line}</code></li>)}</ul>{!refs.requirements.length && <p>이 단계에 직접 등록된 요구가 없습니다. 하위 책임에서 확인하세요.</p>}
        <h3>구현 선언</h3><ul className="ecosystem-sources blueprint-declarations">{refs.declarations.map((ref) => <li key={ref.file}><code>{ref.file}:{ref.line}</code><span>{ref.requirementIds.join(', ')}</span></li>)}</ul>
        {!refs.declarations.length && <p>이 책임의 직접 구현 근거 미제공입니다. 하위 책임 또는 등록된 명세를 확인하세요.</p>}
        <h3>검증 참조 / 선언</h3><ul className="ecosystem-sources blueprint-tests">{refs.tests.map((ref) => <li key={ref.file}><code>{ref.file}:{ref.line}</code><span>{ref.requirementIds.filter((id) => refs.requirements.some((req) => req.id === id)).join(', ')}</span></li>)}</ul><p>테스트 등록은 현재 테스트 실행 결과나 통과 판정이 아닙니다.</p>
        </details>
        <details className="blueprint-scope"><summary>분석 범위와 한계</summary><p>구조와 단일 부모는 정본 계약의 선언입니다. 파일 경로는 이동할 수 있고 책임 ID는 유지합니다. 선은 정적 import를 현재 하위 책임으로 축약한 실제 참조이며 IPC·함수 호출·실행 추적이 아닙니다. 같은 책임을 공유하는 파일 사이 참조는 경계선으로 표시하지 않습니다.</p><p>외부 패키지·생성물 등 제외 {architecture.excluded.length}개. 선택한 저장소의 실시간 분석이 아닌 번들 snapshot입니다.</p></details>
      </div><p className="ecosystem-note">명세·파일·테스트의 행은 snapshot의 선언 위치입니다. 등록 검사는 요구 충족의 의미를 증명하지 않습니다.</p>
    </aside>
  </>;
}
