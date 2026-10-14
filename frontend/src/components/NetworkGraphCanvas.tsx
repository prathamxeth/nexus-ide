"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Filter, Play, Search, ChevronDown, Check, RotateCw, Maximize2, GitFork, Network, ShieldAlert } from "lucide-react";

// Dynamically import react-force-graph-2d client-side only
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center text-xs font-mono text-neutral-500 gap-2">
      <RotateCw className="w-5 h-5 text-sky-400 animate-spin" />
      <span>Rendering Network Topology...</span>
    </div>
  ),
});

export interface NodeItem {
  id: string;
  name?: string;
  label: string;
  type?: string;
  layer?: string;
  color?: string;
  val?: number;
  properties?: Record<string, any>;
  x?: number;
  y?: number;
  collapsed?: boolean;
}

export interface EdgeItem {
  source: string | any;
  target: string | any;
  relationship?: string;
  type?: string;
}

interface NetworkGraphCanvasProps {
  nodes: NodeItem[];
  edges: EdgeItem[];
  selectedNodeId: string | null;
  onSelectNode: (node: NodeItem | null) => void;
  onRunAction?: (node: NodeItem | null) => void;
  highlightedNodeIds?: string[] | Set<string>;
}

const COLOR_MAP: Record<string, string> = {
  Module: "#9fbbe0",    // Cursor timeline-read (pastel blue)
  Endpoint: "#f54e00",  // Cursor primary (Cursor Orange)
  File: "#c0a8dd",      // Cursor timeline-edit (lavender)
  Class: "#9fc9a2",     // Cursor timeline-grep (mint)
  Function: "#dfa88f",  // Cursor timeline-thinking (peach)
};

export default function NetworkGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onRunAction,
  highlightedNodeIds,
}: NetworkGraphCanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 600 });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<"tree" | "cluster">("tree");

  // Node type filters
  const [activeTypes, setActiveTypes] = useState<Record<string, boolean>>({
    Module: true,
    File: true,
    Class: true,
    Function: true,
  });

  // Track canvas container dimensions dynamically with ResizeObserver
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 20 && height > 20) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(canvasContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter nodes & links based on activeTypes and collapsed state
  const graphData = useMemo(() => {
    const validNodes = nodes.filter((n) => {
      const typeKey = n.type || "Function";
      return activeTypes[typeKey] !== false;
    });

    const validNodeIds = new Set(validNodes.map((n) => n.id));

    // Collapse logic: if a parent node is collapsed, hide links to its leaf children
    const links = edges
      .map((e) => {
        const src = typeof e.source === "object" ? e.source.id : e.source;
        const tgt = typeof e.target === "object" ? e.target.id : e.target;
        return { source: src, target: tgt, relationship: e.relationship || e.type || "LINKS" };
      })
      .filter((e) => {
        if (!validNodeIds.has(e.source) || !validNodeIds.has(e.target)) return false;
        if (collapsedNodes.has(e.source) && !collapsedNodes.has(e.target)) {
          return false;
        }
        return true;
      });

    return { nodes: validNodes, links };
  }, [nodes, edges, activeTypes, collapsedNodes]);

  // Connected nodes map for highlighting neighbor links
  const connectedNeighbors = useMemo(() => {
    if (!selectedNodeId) return null;
    const set = new Set<string>([selectedNodeId]);
    for (const link of graphData.links) {
      const s = typeof link.source === "object" ? link.source.id : link.source;
      const t = typeof link.target === "object" ? link.target.id : link.target;
      if (s === selectedNodeId) set.add(t);
      if (t === selectedNodeId) set.add(s);
    }
    return set;
  }, [selectedNodeId, graphData.links]);

  // Center camera on selected node smoothly
  useEffect(() => {
    if (selectedNodeId && fgRef.current) {
      const target = graphData.nodes.find((n) => n.id === selectedNodeId);
      if (target && target.x !== undefined && target.y !== undefined) {
        fgRef.current.centerAt(target.x, target.y, 400);
      }
    }
  }, [selectedNodeId, graphData.nodes]);

  // Keep all nodes bounded within view: auto-fit on load, dimension resize, or layoutMode switch
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      try {
        if (layoutMode === "cluster") {
          // Bounded forces to ensure nodes never shoot off-screen
          fgRef.current.d3Force("charge")?.strength?.(-90)?.distanceMax?.(240)?.distanceMin?.(25);
          fgRef.current.d3Force("link")?.distance?.(50);
        }
      } catch {
        // Safe fallback
      }
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(350, 24);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [graphData.nodes.length, dimensions.width, dimensions.height, layoutMode]);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: any, event: MouseEvent) => {
      // ⌘ + Click toggles collapse
      if (event.metaKey || event.ctrlKey) {
        setCollapsedNodes((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          return next;
        });
        return;
      }

      if (selectedNodeId === node.id) {
        onSelectNode(null);
      } else {
        onSelectNode(node);
      }
    },
    [selectedNodeId, onSelectNode]
  );

  // Search filtered node list
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return nodes.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return nodes.filter(
      (n) => n.label.toLowerCase().includes(q) || (n.type && n.type.toLowerCase().includes(q))
    );
  }, [nodes, searchQuery]);

  const hasHighlighted = highlightedNodeIds && (
    highlightedNodeIds instanceof Set ? highlightedNodeIds.size > 0 : highlightedNodeIds.length > 0
  );

  return (
    <div className="w-full h-full bg-[#080a0f] flex flex-col overflow-hidden select-none relative">
      {/* ======================================================== */}
      {/* 1. TOP HEADER TOOLBAR: STATUS & SEARCH DROPDOWN */}
      {/* ======================================================== */}
      <div className="h-10 px-3 border-b border-[#1b202c] bg-[#0c0e14] flex items-center justify-between shrink-0 z-20 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasHighlighted ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-950/90 border border-red-500/60 text-[10px] font-mono text-red-200 animate-pulse truncate shadow-sm shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_#ef4444]" />
              <span className="truncate max-w-[110px] font-medium">Blast Radius</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 min-w-0 truncate">
              <Network size={13} className="text-sky-400 shrink-0" />
              <span className="text-white font-medium truncate">Topology Canvas</span>
            </div>
          )}
        </div>

        {/* NODES SEARCH DROPDOWN */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex items-center gap-1.5 text-xs font-mono text-neutral-200 hover:text-white cursor-pointer px-2 py-1 rounded-lg bg-[#141824] hover:bg-[#1a1f2e] border border-[#232838] transition-colors"
          >
            <span className="text-[10px] text-neutral-400 uppercase hidden sm:inline">Node:</span>
            <span className="max-w-[70px] sm:max-w-[100px] truncate text-sky-300 font-semibold">{selectedNodeId || "Search"}</span>
            <ChevronDown size={11} className="text-neutral-400 shrink-0" />
          </button>

          {/* Dropdown Popover */}
          {isSearchOpen && (
            <div className="absolute right-0 top-9 w-64 bg-[#141824] border border-[#282f45] rounded-xl shadow-2xl p-2 z-40 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0d1019] rounded-lg border border-[#23283a] text-xs font-mono text-neutral-200 mb-1">
                <Search size={12} className="text-neutral-500 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter nodes..."
                  autoFocus
                  className="bg-transparent outline-none w-full text-xs text-white placeholder-neutral-500 font-mono"
                />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {searchResults.map((n) => {
                  const isSelected = selectedNodeId === n.id;
                  const nodeColor = COLOR_MAP[n.type || "Function"] || "#06b6d4";
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        onSelectNode(n);
                        setIsSearchOpen(false);
                        setSearchQuery("");
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-colors ${
                        isSelected ? "bg-sky-500/20 text-sky-200" : "text-neutral-300 hover:bg-[#1e2436] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: nodeColor }} />
                        <span className="truncate">{n.label}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 uppercase ml-2">{n.type}</span>
                    </div>
                  );
                })}
                {searchResults.length === 0 && (
                  <div className="p-3 text-center text-xs text-neutral-500 font-mono">No matching nodes</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. DYNAMIC RESIZE-AWARE FORCE GRAPH 2D CANVAS */}
      {/* ======================================================== */}
      <div ref={canvasContainerRef} className="flex-1 w-full min-h-0 relative overflow-hidden bg-[#080a0f]">
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          backgroundColor="#080a0f"
          nodeRelSize={5.5}
          dagMode={layoutMode === "tree" ? "td" : undefined}
          dagLevelDistance={55}
          onNodeClick={handleNodeClick}
          onBackgroundClick={() => onSelectNode(null)}
          cooldownTicks={120}
          warmupTicks={50}
          d3VelocityDecay={0.35}
          d3AlphaDecay={0.03}
          onEngineStop={() => {
            fgRef.current?.zoomToFit(250, 24);
          }}
          // Link styling: fine white / grey connections
          linkColor={(link: any) => {
            if (!connectedNeighbors) return "#222a38";
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (connectedNeighbors.has(s) && connectedNeighbors.has(t)) {
              return "#38bdf8"; // highlighted link
            }
            return "#141924"; // dimmed
          }}
          linkWidth={(link: any) => {
            if (!connectedNeighbors) return 0.9;
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            return connectedNeighbors.has(s) && connectedNeighbors.has(t) ? 2.0 : 0.4;
          }}
          // Custom Node Painting matching user screenshot
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const nid = String(node.id);
            const nLabel = String(node.label || "");
            const nName = String(node.name || "");
            const type = node.type || "Function";
            const baseColor = node.color || COLOR_MAP[type] || "#06b6d4";

            const isSelected = selectedNodeId === nid;
            const isConnected = connectedNeighbors ? connectedNeighbors.has(nid) : true;
            const isDimmed = connectedNeighbors !== null && !isConnected;

            // Check if visited by backend graph_traversal event
            const isHighlighted = highlightedNodeIds
              ? (highlightedNodeIds instanceof Set
                  ? (highlightedNodeIds.has(nid) || highlightedNodeIds.has(nLabel) || highlightedNodeIds.has(nName))
                  : (highlightedNodeIds.includes(nid) || highlightedNodeIds.includes(nLabel) || highlightedNodeIds.includes(nName)))
              : false;

            // Compute radius based on importance
            const isBig = nid === "root" || nid === "src" || nid === "FastMCPServer" || nid === "ASGI" || nid === "asgi.py" || nid === "worker.py";
            const baseRadius = isBig ? 11 : 6.5;
            const radius = (isSelected || isHighlighted) ? baseRadius + 2.5 : baseRadius;

            ctx.save();
            if (isDimmed && !isHighlighted) {
              ctx.globalAlpha = 0.22;
            }

            // 1. Red / Cursor Orange Blast Radius Glow when node is traversed/visited during refactor
            if (isHighlighted) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI, false);
              ctx.strokeStyle = "rgba(207, 45, 86, 0.45)";
              ctx.lineWidth = 3.5 / globalScale;
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 2.5, 0, 2 * Math.PI, false);
              ctx.strokeStyle = "rgba(207, 45, 86, 0.95)";
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
            } else if (isSelected) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 3.5, 0, 2 * Math.PI, false);
              ctx.strokeStyle = "rgba(245, 78, 0, 0.95)";
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
            } else if (connectedNeighbors && isConnected) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI, false);
              ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
              ctx.lineWidth = 1 / globalScale;
              ctx.stroke();
            }

            // 2. Main Circle Fill
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = isHighlighted ? "#cf2d56" : baseColor;
            ctx.fill();

            ctx.strokeStyle = isHighlighted ? "#fce7ee" : "#0d1117";
            ctx.lineWidth = (isHighlighted ? 1.8 : 1.2) / globalScale;
            ctx.stroke();

            // 3. Label text with clean backdrop pill (prevents overlapping text clutter)
            const label = String(node.label || node.id);
            const fontSize = Math.max(8.5 / globalScale, 2.6);
            ctx.font = `${(isBig || isHighlighted) ? "600 " : "400 "}${fontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            if (isBig && radius * globalScale > 16) {
              ctx.fillStyle = "#ffffff";
              ctx.fillText(label, node.x, node.y);
            } else {
              const textWidth = ctx.measureText(label).width;
              const pillHeight = fontSize + 4 / globalScale;
              const pillY = node.y + radius + 2.5 / globalScale;
              const pillWidth = textWidth + 6 / globalScale;

              // Crisp backdrop pill
              ctx.fillStyle = "rgba(10, 14, 22, 0.88)";
              ctx.beginPath();
              if (typeof ctx.roundRect === "function") {
                ctx.roundRect(
                  node.x - pillWidth / 2,
                  pillY,
                  pillWidth,
                  pillHeight,
                  2 / globalScale
                );
              } else {
                ctx.rect(node.x - pillWidth / 2, pillY, pillWidth, pillHeight);
              }
              ctx.fill();

              ctx.strokeStyle = isHighlighted
                ? "rgba(239, 68, 68, 0.5)"
                : isSelected
                ? "rgba(56, 189, 248, 0.4)"
                : "rgba(255, 255, 255, 0.08)";
              ctx.lineWidth = 0.7 / globalScale;
              ctx.stroke();

              ctx.fillStyle = isHighlighted ? "#fca5a5" : isSelected ? "#38bdf8" : "#cbd5e1";
              ctx.fillText(label, node.x, pillY + pillHeight / 2);
            }

            ctx.restore();
          }}
        />
      </div>

      {/* ======================================================== */}
      {/* 3. INTEGRATED BOTTOM TOOLBAR (ZERO COLLISION / ZERO OVERLAP) */}
      {/* ======================================================== */}
      <div className="h-10 px-2 sm:px-3 border-t border-[#1b202c] bg-[#0c0e14] flex items-center justify-between shrink-0 z-20 gap-1.5 overflow-hidden">
        <div className="flex items-center gap-1 shrink-0">
          {/* Layout Mode Pill: Tree vs Cluster */}
          <div className="flex items-center bg-[#141824] border border-[#232838] rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => setLayoutMode("tree")}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                layoutMode === "tree"
                  ? "bg-sky-500/25 text-sky-200 border border-sky-500/40"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Tree Graph Layout (Structured Hierarchical)"
            >
              <GitFork size={11} className="text-sky-400" />
              <span className={dimensions.width < 320 ? "hidden" : "inline"}>Tree</span>
            </button>
            <button
              onClick={() => setLayoutMode("cluster")}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                layoutMode === "cluster"
                  ? "bg-sky-500/25 text-sky-200 border border-sky-500/40"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Compact Cluster Layout (Force Bounded)"
            >
              <Network size={11} className="text-emerald-400" />
              <span className={dimensions.width < 320 ? "hidden" : "inline"}>Cluster</span>
            </button>
          </div>

          {/* Fit to View Button */}
          <button
            onClick={() => fgRef.current?.zoomToFit(300, 24)}
            className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[#141824] hover:bg-[#1e2436] border border-[#232838] text-[11px] font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Fit all nodes inside view"
          >
            <Maximize2 size={11} className="text-neutral-400" />
            <span className={dimensions.width < 300 ? "hidden" : "inline"}>Fit</span>
          </button>

          {/* Filter Node Types Pill */}
          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[#141824] hover:bg-[#1e2436] border border-[#232838] text-[11px] font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Filter node layers"
            >
              <Filter size={11} className="text-neutral-400" />
              <span className={dimensions.width < 340 ? "hidden" : "inline"}>Filter</span>
            </button>

            {isFilterOpen && (
              <div className="absolute bottom-9 left-0 w-44 bg-[#141824] border border-[#282f45] rounded-xl shadow-2xl p-2 z-40 flex flex-col gap-1">
                <div className="text-[10px] uppercase font-sans text-neutral-400 font-semibold px-2 py-1 border-b border-[#232838]">
                  Toggle Visible Layers
                </div>
                {Object.keys(activeTypes).map((typeKey) => {
                  const isActive = activeTypes[typeKey];
                  const color = COLOR_MAP[typeKey] || "#06b6d4";
                  return (
                    <button
                      key={typeKey}
                      onClick={() =>
                        setActiveTypes((prev) => ({
                          ...prev,
                          [typeKey]: !prev[typeKey],
                        }))
                      }
                      className="flex items-center justify-between px-2 py-1 rounded-md text-xs font-mono text-neutral-200 hover:bg-[#1e2436] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span>{typeKey}</span>
                      </div>
                      {isActive && <Check size={12} className="text-sky-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: SHORTCUT HINTS & RUN BUTTON */}
        <div className="flex items-center gap-2 shrink-0">
          {dimensions.width >= 420 && (
            <div className="flex items-center gap-1.5 text-[10px] font-sans text-neutral-500 select-none">
              <span>Click: Focus</span>
              <span>•</span>
              <span>⌘+Click: Fold</span>
            </div>
          )}

          <button
            onClick={() => {
              const target = graphData.nodes.find((n) => n.id === selectedNodeId) || null;
              onRunAction?.(target);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#f54e00] hover:bg-[#d04200] text-white text-xs font-mono font-medium transition-colors cursor-pointer shadow-sm shrink-0"
            title="Refactor selected node with AI Agent"
          >
            <Play size={11} className="text-white fill-white" />
            <span>Run</span>
          </button>
        </div>
      </div>
    </div>
  );
}
