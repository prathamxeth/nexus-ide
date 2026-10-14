"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Filter, Play, Search, ChevronDown, Check, RotateCw } from "lucide-react";

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
}

const COLOR_MAP: Record<string, string> = {
  Module: "#0284c7",    // Blue
  Endpoint: "#0284c7",  // Blue
  File: "#8b5cf6",      // Purple
  Class: "#10b981",     // Green
  Function: "#06b6d4",  // Cyan
};

export default function NetworkGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onRunAction,
}: NetworkGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Node type filters
  const [activeTypes, setActiveTypes] = useState<Record<string, boolean>>({
    Module: true,
    File: true,
    Class: true,
    Function: true,
  });

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
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

  // Initial fit
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        fgRef.current?.zoomToFit(400, 40);
      }, 300);
    }
  }, [graphData.nodes.length]);

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

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#080a0f] overflow-hidden select-none">
      {/* TOP-RIGHT NODES SEARCH DROPDOWN */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end">
        <div className="flex items-center gap-2 bg-[#12151e]/90 backdrop-blur-md border border-[#232838] rounded-xl px-3.5 py-1.5 shadow-2xl">
          <span className="text-[11px] font-sans text-neutral-400">Nodes</span>
          <div className="relative">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center gap-2 text-xs font-mono text-neutral-200 hover:text-white cursor-pointer px-2 py-0.5 rounded-lg hover:bg-[#1a1f2e] transition-colors"
            >
              <span>{selectedNodeId || "Search a node"}</span>
              <ChevronDown size={14} className="text-neutral-500" />
            </button>

            {/* Dropdown Popover */}
            {isSearchOpen && (
              <div className="absolute right-0 top-9 w-64 bg-[#141824] border border-[#282f45] rounded-xl shadow-2xl p-2 z-30 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0d1019] rounded-lg border border-[#23283a] text-xs font-mono text-neutral-200 mb-1">
                  <Search size={12} className="text-neutral-500 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search node..."
                    autoFocus
                    className="bg-transparent outline-none w-full text-xs text-white placeholder-neutral-500"
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
      </div>

      {/* FORCE GRAPH 2D CANVAS */}
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="#080a0f"
        nodeRelSize={6}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => onSelectNode(null)}
        cooldownTicks={120}
        d3VelocityDecay={0.3}
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
          const type = node.type || "Function";
          const baseColor = node.color || COLOR_MAP[type] || "#06b6d4";

          const isSelected = selectedNodeId === nid;
          const isConnected = connectedNeighbors ? connectedNeighbors.has(nid) : true;
          const isDimmed = connectedNeighbors !== null && !isConnected;

          // Compute radius based on importance
          const isBig = nid === "root" || nid === "src" || nid === "FastMCPServer" || nid === "ASGI" || nid === "asgi.py" || nid === "worker.py";
          const baseRadius = isBig ? 12 : 7.5;
          const radius = isSelected ? baseRadius + 2.5 : baseRadius;

          ctx.save();
          if (isDimmed) {
            ctx.globalAlpha = 0.2;
          }

          // 1. Halo / Glow when selected
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
            ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
            ctx.lineWidth = 2.5 / globalScale;
            ctx.stroke();
          } else if (connectedNeighbors && isConnected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI, false);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 1.2 / globalScale;
            ctx.stroke();
          }

          // 2. Main Circle Fill
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = baseColor;
          ctx.fill();

          ctx.strokeStyle = "#0d1117";
          ctx.lineWidth = 1.5 / globalScale;
          ctx.stroke();

          // 3. Label text
          const label = String(node.label || node.id);
          const fontSize = Math.max(9 / globalScale, 2.8);
          ctx.font = `${isBig ? "bold " : ""}${fontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // If big node, render text centered inside or slightly below
          if (isBig && radius * globalScale > 18) {
            ctx.fillStyle = "#ffffff";
            ctx.fillText(label, node.x, node.y);
          } else {
            // Text below node
            ctx.fillStyle = isSelected ? "#38bdf8" : "#e2e8f0";
            ctx.fillText(label, node.x, node.y + radius + 4.5 / globalScale);
          }

          ctx.restore();
        }}
      />

      {/* BOTTOM FLOATING CONTROLS: FILTER NODE TYPES & RUN */}
      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-3">
        {/* Filter Node Types Pill */}
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#12151e]/90 hover:bg-[#1a1f2e] border border-[#232838] text-xs font-mono text-neutral-200 hover:text-white shadow-2xl transition-colors cursor-pointer"
          >
            <Filter size={13} className="text-neutral-400" />
            <span>Filter Node Types</span>
          </button>

          {isFilterOpen && (
            <div className="absolute bottom-11 left-0 w-48 bg-[#141824] border border-[#282f45] rounded-xl shadow-2xl p-2 z-30 flex flex-col gap-1">
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
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-neutral-200 hover:bg-[#1e2436] transition-colors cursor-pointer"
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

        {/* Run Pill */}
        <button
          onClick={() => {
            const target = graphData.nodes.find((n) => n.id === selectedNodeId) || null;
            onRunAction?.(target);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#12151e]/90 hover:bg-[#1a1f2e] border border-[#232838] text-xs font-mono text-neutral-200 hover:text-white shadow-2xl transition-colors cursor-pointer"
        >
          <Play size={12} className="text-emerald-400 fill-emerald-400" />
          <span>Run</span>
        </button>
      </div>
    </div>
  );
}
