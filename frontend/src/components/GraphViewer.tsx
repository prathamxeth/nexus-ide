"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { GraphData, GraphNode, GraphEdge } from "@/lib/agent-client";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Layers,
  Cpu,
  ShieldAlert,
  BookOpen,
  GitPullRequest,
  Check,
  X,
  Info,
} from "lucide-react";

// Dynamically load ForceGraph2D client-side only
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center text-xs font-mono text-[#888888] gap-2">
      <Cpu className="w-5 h-5 text-[#3b82f6] animate-pulse" />
      <span>Initializing FalkorDB Stratified AST Force Graph...</span>
    </div>
  ),
});

export interface GraphViewerProps {
  graphData: GraphData;
  focusNodeId?: string;
  blastRadiusNodeIds?: Set<string> | string[];
  memoryNodeIds?: Set<string> | string[];
  onNodeClick?: (node: GraphNode) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// Stratified Layer Palette per requirements:
// - Layer 0 (Top): Target Function & AST calls (#3b82f6)
// - Layer 1 (Left): Downstream Blast Radius callers (#ef4444)
// - Layer 2 (Center-Right): Procedural Memory constraints (#f59e0b)
// - Layer 3 (Bottom-Right): Company Brain / PRs / Authors (#10b981)
const LAYER_CONFIG = {
  ast: {
    name: "AST",
    label: "Target & AST",
    color: "#3b82f6",
    haloColor: "rgba(59, 130, 246, 0.4)",
    textColor: "#93c5fd",
    baseY: -110,
    baseX: 0,
  },
  blast: {
    name: "Blast Radius",
    label: "Blast Radius",
    color: "#ef4444",
    haloColor: "rgba(239, 68, 68, 0.4)",
    textColor: "#fca5a5",
    baseY: 0,
    baseX: -180,
  },
  memory: {
    name: "Memory",
    label: "Procedural Memory",
    color: "#f59e0b",
    haloColor: "rgba(245, 158, 11, 0.4)",
    textColor: "#fde68a",
    baseY: -20,
    baseX: 130,
  },
  company: {
    name: "Company",
    label: "Company Brain",
    color: "#10b981",
    haloColor: "rgba(16, 185, 129, 0.4)",
    textColor: "#a7f3d0",
    baseY: 90,
    baseX: 160,
  },
} as const;

type LayerKey = keyof typeof LAYER_CONFIG;

export function GraphViewer({
  graphData,
  focusNodeId = "validateToken",
  blastRadiusNodeIds,
  memoryNodeIds,
  onNodeClick,
  onRefresh,
  isLoading = false,
}: GraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 350 });

  // Interactive states: Inspect, Hover, and Filters
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<any | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Layer Filter Toggles
  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
    ast: true,
    blast: true,
    memory: true,
    company: true,
  });

  // Normalize blast radius & memory sets
  const blastSet = useMemo(() => {
    if (!blastRadiusNodeIds) return new Set<string>();
    return blastRadiusNodeIds instanceof Set ? blastRadiusNodeIds : new Set(blastRadiusNodeIds);
  }, [blastRadiusNodeIds]);

  const memorySet = useMemo(() => {
    if (!memoryNodeIds) return new Set<string>();
    return memoryNodeIds instanceof Set ? memoryNodeIds : new Set(memoryNodeIds);
  }, [memoryNodeIds]);

  // Determine a node's stratified layer
  const getNodeLayer = useCallback((node: GraphNode): LayerKey => {
    if (node.layer && (node.layer in LAYER_CONFIG)) {
      return node.layer as LayerKey;
    }
    const id = String(node.id || "");
    const name = String(node.properties?.name || node.label || id);
    const type = String(node.type || "");

    if (id === focusNodeId || name === focusNodeId || id.includes("validateToken") || id.includes("verifyToken")) {
      return "ast";
    }
    if (blastSet.has(id) || blastSet.has(name) || id.includes("billing") || id.includes("finance") || id.includes("Invoice") || id.includes("audit")) {
      return "blast";
    }
    if (memorySet.has(id) || memorySet.has(name) || type.includes("Rule") || id.startsWith("rule") || id.includes("RULE")) {
      return "memory";
    }
    if (type.includes("PR") || type.includes("Ticket") || type.includes("Engineer") || id.startsWith("pr") || id.includes("@")) {
      return "company";
    }
    return "ast";
  }, [focusNodeId, blastSet, memorySet]);

  // Hierarchically position and stratify nodes
  const processedData = useMemo(() => {
    const rawNodes = graphData.nodes || [];
    const rawEdges = graphData.edges || (graphData as any).links || [];

    // Group nodes by layer for structured layout offsets
    const layerCounters: Record<LayerKey, number> = { ast: 0, blast: 0, memory: 0, company: 0 };

    const nodesWithPositions = rawNodes.map((rawNode) => {
      const layer = getNodeLayer(rawNode);
      const count = layerCounters[layer]++;
      const cfg = LAYER_CONFIG[layer];

      // Staggered horizontal and vertical placement per layer
      let offsetX = 0;
      let offsetY = 0;

      if (layer === "ast") {
        offsetX = (count - 0.5) * 80;
        offsetY = count % 2 === 0 ? 0 : 25;
      } else if (layer === "blast") {
        offsetX = -(count * 50);
        offsetY = (count - 1) * 60;
      } else if (layer === "memory") {
        offsetX = count * 50;
        offsetY = (count - 1) * 55;
      } else if (layer === "company") {
        offsetX = count * 45;
        offsetY = (count - 0.5) * 50;
      }

      return {
        ...rawNode,
        layer,
        x: cfg.baseX + offsetX,
        y: cfg.baseY + offsetY,
        // Give slight fixed force pull to maintain hierarchical topology
        fx: rawNode.fx ?? (cfg.baseX + offsetX),
        fy: rawNode.fy ?? (cfg.baseY + offsetY),
      };
    });

    // Filter nodes by active layer toggles
    const filteredNodes = nodesWithPositions.filter((n) => activeLayers[n.layer as LayerKey]);
    const filteredNodeIds = new Set(filteredNodes.map((n) => String(n.id)));

    // Filter edges accordingly
    const filteredLinks = rawEdges
      .map((e: any) => {
        const srcId = typeof e.source === "object" ? String(e.source.id) : String(e.source);
        const tgtId = typeof e.target === "object" ? String(e.target.id) : String(e.target);
        return {
          source: srcId,
          target: tgtId,
          type: e.type || e.relationship || "CALLS",
        };
      })
      .filter((e: any) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

    return {
      nodes: filteredNodes,
      links: filteredLinks,
    };
  }, [graphData, getNodeLayer, activeLayers]);

  // Build connected subgraph set for Click-to-Inspect
  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const connected = new Set<string>([selectedNodeId]);
    for (const link of processedData.links) {
      const s = typeof link.source === "object" ? String((link.source as any).id) : String(link.source);
      const t = typeof link.target === "object" ? String((link.target as any).id) : String(link.target);
      if (s === selectedNodeId) connected.add(t);
      if (t === selectedNodeId) connected.add(s);
    }
    return connected;
  }, [selectedNodeId, processedData.links]);

  // Responsive canvas sizing
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

  // Center on graph on mount or layout change
  useEffect(() => {
    if (fgRef.current && processedData.nodes.length > 0) {
      setTimeout(() => {
        fgRef.current?.zoomToFit(400, 35);
      }, 250);
    }
  }, [processedData.nodes.length]);

  // Node Click: Inspect / Highlight Subgraph
  const handleNodeClick = (node: any) => {
    const nid = String(node.id);
    if (selectedNodeId === nid) {
      setSelectedNodeId(null);
    } else {
      setSelectedNodeId(nid);
      onNodeClick?.(node);
      if (fgRef.current && node.x !== undefined && node.y !== undefined) {
        fgRef.current.centerAt(node.x, node.y, 500);
      }
    }
  };

  // Recenter helper
  const handleRecenter = () => {
    setSelectedNodeId(null);
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 40);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      }}
      className="relative w-full h-full bg-[#0e0e0e] overflow-hidden select-none"
    >
      {/* 1. TOP-LEFT: STRATIFIED LAYER LEGEND */}
      <div className="absolute top-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg px-2.5 py-1 text-[11px] font-mono shadow-xl">
        <span className="flex items-center gap-1 text-[#3b82f6]">
          <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
          L0: AST
        </span>
        <span className="text-[#333]">•</span>
        <span className="flex items-center gap-1 text-[#ef4444]">
          <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
          L1: Blast
        </span>
        <span className="text-[#333]">•</span>
        <span className="flex items-center gap-1 text-[#f59e0b]">
          <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
          L2: Memory
        </span>
        <span className="text-[#333]">•</span>
        <span className="flex items-center gap-1 text-[#10b981]">
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
          L3: Company
        </span>
      </div>

      {/* 2. TOP-RIGHT: MINI CONTROLS & LAYER FILTER TOGGLES */}
      <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg p-1 text-[11px] font-mono shadow-xl">
        {/* Layer Filters */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-[#262626]">
          {(["ast", "blast", "memory", "company"] as LayerKey[]).map((layer) => {
            const isChecked = activeLayers[layer];
            const cfg = LAYER_CONFIG[layer];
            return (
              <button
                key={layer}
                onClick={() =>
                  setActiveLayers((prev) => ({
                    ...prev,
                    [layer]: !prev[layer],
                  }))
                }
                title={`Toggle ${cfg.label}`}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                  isChecked
                    ? "bg-[#222222] text-white border border-[#333333]"
                    : "opacity-40 hover:opacity-80 text-neutral-500"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                <span>{cfg.name}</span>
              </button>
            );
          })}
        </div>

        {/* Zoom & Recenter Buttons */}
        <button
          onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300)}
          title="Zoom In"
          className="p-1 hover:bg-[#222] text-neutral-400 hover:text-white rounded transition-colors"
        >
          <ZoomIn size={13} />
        </button>
        <button
          onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300)}
          title="Zoom Out"
          className="p-1 hover:bg-[#222] text-neutral-400 hover:text-white rounded transition-colors"
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={handleRecenter}
          title="Recenter & Fit View"
          className="p-1 hover:bg-[#222] text-neutral-400 hover:text-white rounded transition-colors"
        >
          <Maximize2 size={13} />
        </button>
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh Graph"
            className="p-1 hover:bg-[#222] text-neutral-400 hover:text-white rounded transition-colors"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin text-[#f54e00]" : ""} />
          </button>
        )}
      </div>

      {/* 3. HOVER METADATA TOOLTIP */}
      {hoverNode && (
        <div
          className="absolute pointer-events-none z-30 bg-[#161616]/95 backdrop-blur-md border border-[#2f2f2f] rounded-lg p-2.5 text-xs font-mono shadow-2xl text-neutral-200 max-w-xs transition-opacity duration-150"
          style={{
            left: Math.min(mousePos.x + 12, dimensions.width - 250),
            top: Math.min(mousePos.y + 12, dimensions.height - 120),
          }}
        >
          <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-[#262626]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: LAYER_CONFIG[hoverNode.layer as LayerKey]?.color || "#f54e00" }}
            />
            <span className="font-semibold text-white truncate">
              {hoverNode.label || hoverNode.id}
            </span>
            <span className="ml-auto text-[9px] uppercase px-1 rounded bg-[#222] text-neutral-400 border border-[#333]">
              {hoverNode.layer}
            </span>
          </div>

          <div className="space-y-1 text-[11px] text-neutral-400">
            {hoverNode.file && (
              <div className="text-neutral-400 truncate">
                File: <span className="text-neutral-200">{hoverNode.file}</span>
              </div>
            )}
            {hoverNode.metadata?.rule && (
              <div className="text-amber-400">
                Rule: <span className="text-neutral-300 font-sans">{hoverNode.metadata.rule}</span>
              </div>
            )}
            {hoverNode.metadata?.author && (
              <div className="text-emerald-400">
                Author: <span className="text-neutral-300">{hoverNode.metadata.author}</span>
                {hoverNode.metadata.pr_number && ` (PR #${hoverNode.metadata.pr_number})`}
              </div>
            )}
            {hoverNode.metadata?.ticket && (
              <div className="text-neutral-400">
                Ticket: <span className="text-neutral-300">{hoverNode.metadata.ticket}</span>
              </div>
            )}
            {hoverNode.metadata?.hop !== undefined && (
              <div className="text-red-400">
                Blast Depth: <span className="text-neutral-300">{hoverNode.metadata.hop} hop(s)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. SELECTED NODE SUBGRAPH BANNER */}
      {selectedNodeId && (
        <div className="absolute bottom-2.5 left-2.5 z-20 bg-[#161616]/95 backdrop-blur-md border border-[#3b82f6]/40 rounded-lg px-3 py-1.5 text-xs font-mono shadow-2xl flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping" />
            <span className="text-white font-semibold">{selectedNodeId}</span>
            <span className="text-neutral-500 text-[10px]">
              ({connectedIds ? connectedIds.size - 1 : 0} connections highlighted)
            </span>
          </div>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="text-neutral-500 hover:text-white text-xs ml-2"
            title="Reset highlight"
          >
            ✕
          </button>
        </div>
      )}

      {/* 5. FORCEGRAPH CANVAS */}
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={processedData}
        backgroundColor="#0e0e0e"
        nodeRelSize={5}
        onNodeClick={handleNodeClick}
        onNodeHover={(node: any) => setHoverNode(node || null)}
        onBackgroundClick={() => setSelectedNodeId(null)}
        linkColor={(link: any) => {
          if (!connectedIds) return "#222a35";
          const s = typeof link.source === "object" ? String(link.source.id) : String(link.source);
          const t = typeof link.target === "object" ? String(link.target.id) : String(link.target);
          if (connectedIds.has(s) && connectedIds.has(t)) {
            return "#38bdf8"; // Neon highlighted edge
          }
          return "#14171d"; // Dimmed edge
        }}
        linkWidth={(link: any) => {
          if (!connectedIds) return 1.2;
          const s = typeof link.source === "object" ? String(link.source.id) : String(link.source);
          const t = typeof link.target === "object" ? String(link.target.id) : String(link.target);
          return connectedIds.has(s) && connectedIds.has(t) ? 2.4 : 0.6;
        }}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={0.96}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const nid = String(node.id);
          const layer = (node.layer as LayerKey) || "ast";
          const cfg = LAYER_CONFIG[layer] || LAYER_CONFIG.ast;

          // Inspection highlight state
          const isSelected = selectedNodeId === nid;
          const isConnected = connectedIds ? connectedIds.has(nid) : true;
          const isDimmed = connectedIds !== null && !isConnected;

          const baseRadius = layer === "ast" ? 8 : layer === "blast" ? 7 : 6;
          const radius = isSelected ? baseRadius + 2 : baseRadius;
          const label = String(node.label || node.id);

          ctx.save();
          if (isDimmed) {
            ctx.globalAlpha = 0.22;
          }

          // 1. Neon ring on inspect or blast pulse
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI, false);
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 2.5 / globalScale;
            ctx.stroke();
          } else if (connectedIds && isConnected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI, false);
            ctx.strokeStyle = cfg.haloColor;
            ctx.lineWidth = 1.8 / globalScale;
            ctx.stroke();
          }

          if (layer === "blast" && !isDimmed) {
            const now = Date.now();
            const pulse = (Math.sin(now / 220) + 1) / 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 3 + pulse * 4, 0, 2 * Math.PI, false);
            ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 - pulse * 0.5})`;
            ctx.lineWidth = 1.5 / globalScale;
            ctx.stroke();
          }

          // 2. Main Node Circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = cfg.color;
          ctx.fill();
          ctx.strokeStyle = "#141414";
          ctx.lineWidth = 1.2 / globalScale;
          ctx.stroke();

          // 3. Node Text Label
          const fontSize = Math.max(10 / globalScale, 2.5);
          ctx.font = `${isSelected || layer === "ast" ? "bold " : ""}${fontSize}px -apple-system, BlinkMacSystemFont, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          // Shadow for readability
          ctx.fillStyle = "rgba(10, 10, 10, 0.9)";
          ctx.fillText(label, node.x, node.y + radius + 3 / globalScale);

          ctx.fillStyle = isSelected ? "#38bdf8" : cfg.textColor;
          ctx.fillText(label, node.x, node.y + radius + 2.5 / globalScale);

          ctx.restore();
        }}
      />
    </div>
  );
}
