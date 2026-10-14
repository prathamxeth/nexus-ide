"use client";

import React, { useEffect, useRef, useState, useMemo, useImperativeHandle, forwardRef, useCallback } from "react";
import { GraphCanvas, useGraph } from "@gravity-ui/graph/react";
import { GraphState, type TBlock, type TConnection } from "@gravity-ui/graph";
import { 
  ShieldAlert, GitPullRequest, Brain, Code2, ExternalLink, 
  ZoomIn, ZoomOut, Maximize2, Crosshair, Sparkles, Activity, 
  Layers, Folder, Hash, ArrowUpRight, CheckCircle2, ShieldCheck,
  Terminal, Database, Zap
} from "lucide-react";
import "@gravity-ui/uikit/styles/fonts.css";
import "@gravity-ui/uikit/styles/styles.css";

export interface GraphBlock {
  id: string;
  title: string;
  type: "function" | "blast_radius" | "memory" | "company_pr" | string;
  file?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  data?: {
    signature?: string;
    memory_rule?: string;
    hop?: number;
    callers?: number;
    pr_id?: number | string;
    author?: string;
    ticket?: string;
    line?: number;
    status?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface GraphConnection {
  id: string;
  source: string;
  target: string;
  sourceBlockId?: string;
  targetBlockId?: string;
  label?: string;
  type?: string;
  color?: string;
  [key: string]: any;
}

export interface GraphCanvasHandle {
  zoomToCenter: (padding?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  graph: any;
}

export interface GraphCanvasProps {
  blocks: GraphBlock[];
  connections: GraphConnection[];
  onSelectBlock: (block: any, file?: string, line?: number) => void;
  className?: string;
  zoomPadding?: number;
}

const GraphCanvasViewer = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvasViewer(
  {
    blocks,
    connections,
    onSelectBlock,
    className = "",
    zoomPadding = 140,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { graph, setEntities, start } = useGraph({});
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [selectedBlockId, setSelectedBlockId] = useState<string>("validateToken");
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Imperative handle for parent orchestration
  useImperativeHandle(ref, () => ({
    zoomToCenter: (padding = zoomPadding) => {
      try {
        graph?.zoomTo("center", { padding });
        setZoomLevel(100);
      } catch (err) {
        console.warn("zoomTo error:", err);
      }
    },
    zoomIn: () => {
      try {
        const curScale = (graph as any)?.cameraService?.scale ?? 1;
        (graph as any)?.zoom({ scale: Math.min(2.5, curScale * 1.25) });
        setZoomLevel((prev) => Math.min(200, Math.round(prev * 1.25)));
      } catch (err) {
        console.warn("zoomIn error:", err);
      }
    },
    zoomOut: () => {
      try {
        const curScale = (graph as any)?.cameraService?.scale ?? 1;
        (graph as any)?.zoom({ scale: Math.max(0.4, curScale * 0.8) });
        setZoomLevel((prev) => Math.max(40, Math.round(prev * 0.8)));
      } catch (err) {
        console.warn("zoomOut error:", err);
      }
    },
    graph,
  }));

  // Filtered blocks based on selected layer chip
  const filteredBlocks = useMemo(() => {
    if (!blocks || blocks.length === 0) return [];
    if (activeFilter === "all") return blocks;
    if (activeFilter === "function") return blocks.filter(b => b.type === "function");
    if (activeFilter === "blast") return blocks.filter(b => b.type === "blast_radius");
    if (activeFilter === "memory") return blocks.filter(b => b.type === "memory");
    if (activeFilter === "pr") return blocks.filter(b => b.type === "company_pr");
    return blocks;
  }, [blocks, activeFilter]);

  // Sync entities with Gravity UI graph
  useEffect(() => {
    if (filteredBlocks && filteredBlocks.length > 0) {
      try {
        const formattedBlocks: TBlock[] = filteredBlocks.map((b, idx) => {
          const { id, title, width, height, x, y, ...rest } = b;
          return {
            ...rest,
            id,
            is: "block",
            name: title || id,
            x: x ?? (idx % 3) * 320 - 320,
            y: y ?? Math.floor(idx / 3) * 175 - 90,
            width: width || 280,
            height: height || 135,
          };
        });

        const activeBlockIds = new Set(filteredBlocks.map(b => b.id));
        const relevantConnections = (connections || []).filter(c => {
          const s = c.sourceBlockId || c.source;
          const t = c.targetBlockId || c.target;
          return activeBlockIds.has(s) && activeBlockIds.has(t);
        });

        const formattedConnections: TConnection[] = relevantConnections.map((c, idx) => {
          const isBlast = c.type === "blast" || c.source?.includes("Invoice") || c.source?.includes("audit");
          const isMemory = c.type === "memory" || c.source?.includes("RULE");
          const isPR = c.type === "company" || c.source?.includes("PR");

          const strokeColor = c.color || (isBlast ? "#f43f5e" : isMemory ? "#f59e0b" : isPR ? "#22c55e" : "#3b82f6");

          return {
            id: c.id || `conn_${idx}`,
            sourceBlockId: c.sourceBlockId || c.source,
            targetBlockId: c.targetBlockId || c.target,
            label: c.label,
            styles: {
              background: strokeColor,
            },
          };
        });

        setEntities({ blocks: formattedBlocks, connections: formattedConnections });

        // Auto center on initial setup or entity change
        const timer = setTimeout(() => {
          try {
            graph?.zoomTo("center", { padding: zoomPadding });
          } catch {
            // ignore if canvas still initializing
          }
        }, 150);

        return () => clearTimeout(timer);
      } catch (err) {
        console.warn("Graph entities sync error:", err);
      }
    }
  }, [filteredBlocks, connections, setEntities, graph, zoomPadding]);

  const handleBlockClick = useCallback((block: any) => {
    setSelectedBlockId(block.id);
    onSelectBlock(block, block.file, block.data?.line);
  }, [onSelectBlock]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative bg-[#090D16] overflow-hidden select-none font-mono ${className}`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.08) 1.5px, transparent 0),
          radial-gradient(circle at 1px 1px, rgba(34, 197, 94, 0.03) 1px, transparent 0)
        `,
        backgroundSize: "24px 24px, 48px 48px",
      }}
    >
      {/* Subtle OLED Vignette for Depth */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(9,13,22,0.85)_100%)] z-10" />

      {/* TOP-LEFT LAYER FILTER HUD */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-[#0F172A]/90 backdrop-blur-md border border-[#334155]/60 rounded-lg p-1 shadow-2xl">
        <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-neutral-400 border-r border-[#334155]/60 font-semibold tracking-wider">
          <Layers size={11} className="text-emerald-400" />
          <span>LAYERS</span>
        </div>
        {[
          { key: "all", label: `All (${blocks.length})` },
          { key: "function", label: "AST Focus" },
          { key: "blast", label: "Blast Radius" },
          { key: "memory", label: "Guardrails" },
          { key: "pr", label: "Git Context" },
        ].map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-[#1E293B] text-white shadow-sm border border-emerald-500/30"
                  : "text-neutral-400 hover:text-white hover:bg-[#1E293B]/50"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* TOP-RIGHT TELEMETRY & VIEWPORT CONTROLS */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {/* Engine status indicator */}
        <div className="flex items-center gap-2 bg-[#0F172A]/90 backdrop-blur-md border border-[#334155]/60 rounded-lg px-2.5 py-1 text-[10px] text-neutral-300 shadow-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#22c55e]" />
          <span className="text-neutral-400">FalkorDB GraphBLAS:</span>
          <span className="text-emerald-400 font-semibold">0.8ms</span>
        </div>

        {/* Viewport Control Buttons */}
        <div className="flex items-center bg-[#0F172A]/90 backdrop-blur-md border border-[#334155]/60 rounded-lg p-0.5 shadow-xl text-neutral-300">
          <button
            onClick={() => {
              try {
                const curScale = (graph as any)?.cameraService?.scale ?? 1;
                (graph as any)?.zoom({ scale: Math.min(2.5, curScale * 1.25) });
                setZoomLevel((prev) => Math.min(200, Math.round(prev * 1.25)));
              } catch (e) {
                console.warn(e);
              }
            }}
            title="Zoom In"
            className="p-1.5 hover:text-white hover:bg-[#1E293B] rounded transition-colors cursor-pointer"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={() => {
              try {
                const curScale = (graph as any)?.cameraService?.scale ?? 1;
                (graph as any)?.zoom({ scale: Math.max(0.4, curScale * 0.8) });
                setZoomLevel((prev) => Math.max(40, Math.round(prev * 0.8)));
              } catch (e) {
                console.warn(e);
              }
            }}
            title="Zoom Out"
            className="p-1.5 hover:text-white hover:bg-[#1E293B] rounded transition-colors cursor-pointer"
          >
            <ZoomOut size={12} />
          </button>
          <div className="w-[1px] h-3 bg-[#334155]/60 mx-0.5" />
          <button
            onClick={() => {
              try {
                graph?.zoomTo("center", { padding: zoomPadding });
                setZoomLevel(100);
              } catch (e) {
                console.warn(e);
              }
            }}
            title="Center & Fit Canvas (150px)"
            className="px-2 py-1 flex items-center gap-1 hover:text-white hover:bg-[#1E293B] rounded transition-colors text-[10px] cursor-pointer"
          >
            <Crosshair size={11} className="text-emerald-400" />
            <span>Center</span>
          </button>
        </div>
      </div>

      {/* BOTTOM-LEFT TELEMETRY WATERMARK */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-[#0F172A]/85 backdrop-blur-md border border-[#334155]/50 rounded-lg px-2.5 py-1 text-[10px] text-neutral-400 shadow-xl">
        <Zap size={11} className="text-amber-400" />
        <span>Stratified AST Traversal</span>
        <span className="text-neutral-600">•</span>
        <span className="text-neutral-300">{filteredBlocks.length} Nodes</span>
        <span className="text-neutral-600">•</span>
        <span className="text-neutral-300">{connections.length} Multi-Hop Edges</span>
      </div>

      {/* GRAVITY-UI GRAPH CANVAS */}
      <GraphCanvas
        graph={graph}
        renderBlock={(block: any) => {
          const isBlast = block.type === "blast_radius";
          const isMemory = block.type === "memory";
          const isPR = block.type === "company_pr";
          const isFunction = block.type === "function" || (!isBlast && !isMemory && !isPR);
          const isSelected = selectedBlockId === block.id;

          return (
            <div
              onClick={() => handleBlockClick(block)}
              className={`p-3.5 rounded-xl border font-mono shadow-2xl transition-all duration-200 cursor-pointer select-none group relative overflow-hidden backdrop-blur-xl ${
                isSelected ? "ring-2 ring-white/30" : ""
              } ${
                isBlast
                  ? "bg-[#1E1117]/95 border-rose-500/60 hover:border-rose-400 text-rose-100 hover:shadow-[0_0_30px_rgba(244,63,94,0.35)]"
                  : isMemory
                  ? "bg-[#1F190F]/95 border-amber-500/60 hover:border-amber-400 text-amber-100 hover:shadow-[0_0_30px_rgba(245,158,11,0.35)]"
                  : isPR
                  ? "bg-[#0E2018]/95 border-emerald-500/60 hover:border-emerald-400 text-emerald-100 hover:shadow-[0_0_30px_rgba(34,197,94,0.35)]"
                  : "bg-[#151D2F]/95 border-blue-500/50 hover:border-blue-400 text-blue-100 hover:shadow-[0_0_30px_rgba(59,130,246,0.35)]"
              }`}
              style={{
                width: block.width || 280,
                minHeight: block.height || 135,
              }}
            >
              {/* Top Accent Gradient Bar */}
              <div 
                className={`absolute top-0 left-0 right-0 h-[2px] ${
                  isBlast
                    ? "bg-gradient-to-r from-rose-500 via-red-400 to-transparent"
                    : isMemory
                    ? "bg-gradient-to-r from-amber-500 via-orange-400 to-transparent"
                    : isPR
                    ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-transparent"
                    : "bg-gradient-to-r from-blue-500 via-cyan-400 to-transparent"
                }`}
              />

              {/* Header Badge & Pulsing State Dot */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    isBlast
                      ? "bg-rose-400 shadow-[0_0_8px_#f43f5e] animate-pulse"
                      : isMemory
                      ? "bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse"
                      : isPR
                      ? "bg-emerald-400 shadow-[0_0_8px_#22c55e] animate-pulse"
                      : "bg-blue-400 shadow-[0_0_8px_#3b82f6] animate-pulse"
                  }`} />
                  
                  <span className="font-bold flex items-center gap-1.5 truncate text-[11px] text-white tracking-wide">
                    {isBlast && <ShieldAlert size={13} className="text-rose-400 shrink-0" />}
                    {isMemory && <Brain size={13} className="text-amber-400 shrink-0" />}
                    {isPR && <GitPullRequest size={13} className="text-emerald-400 shrink-0" />}
                    {isFunction && <Code2 size={13} className="text-blue-400 shrink-0" />}
                    <span className="truncate">{block.title || block.id}</span>
                  </span>
                </div>
                
                {/* Clean SVG Badges without Emojis (Complying with Nexus IDE Master Design System) */}
                {isBlast ? (
                  <span className="text-[8px] tracking-wider uppercase px-1.5 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                    BLAST RADIUS (HOP {block.data?.hop || 1})
                  </span>
                ) : isMemory ? (
                  <span className="text-[8px] tracking-wider uppercase px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                    GUARDRAIL RULE
                  </span>
                ) : isPR ? (
                  <span className="text-[8px] tracking-wider uppercase px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                    COMPANY BRAIN
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 shrink-0">
                    TS
                  </span>
                )}
              </div>

              {/* File / Caller Path with Icon */}
              <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1.5">
                <span className="flex items-center gap-1 truncate font-medium text-neutral-300">
                  <Folder size={11} className={isBlast ? "text-rose-400" : isMemory ? "text-amber-400" : isPR ? "text-emerald-400" : "text-blue-400"} />
                  <span className="truncate">{block.file || "Internal AST Node"}</span>
                </span>
                {block.data?.line && (
                  <span className="text-neutral-400 text-[9px] px-1 py-0.2 rounded bg-black/40 border border-white/5">
                    L:{block.data.line}
                  </span>
                )}
              </div>

              {/* Function Signature for AST Node */}
              {isFunction && block.data?.signature && (
                <div className="mt-1 text-[9px] text-blue-200/90 font-mono bg-[#0B132B]/80 px-2 py-1 rounded border border-blue-500/20 truncate">
                  <span className="text-purple-400">function </span>
                  <span className="text-blue-300">{block.data.signature}</span>
                </div>
              )}

              {/* Guardrail Procedural Memory Rule Callout */}
              {isMemory && (
                <div className="mt-1 text-[10px] text-amber-200/95 italic bg-amber-950/40 p-1.5 rounded border border-amber-500/30 leading-snug">
                  &ldquo;{block.data?.memory_rule || block.title}&rdquo;
                </div>
              )}

              {/* PR / Git Context Callout */}
              {isPR && (
                <div className="mt-1 text-[10px] text-emerald-200 font-mono flex items-center justify-between bg-emerald-950/40 px-2 py-1 rounded border border-emerald-500/30">
                  <span className="font-semibold flex items-center gap-1">
                    <Hash size={11} className="text-emerald-400" />
                    <span>PR #{block.data?.pr_id || "104"}</span>
                  </span>
                  <span className="text-emerald-300 font-medium">{block.data?.author || "@alex.chen"}</span>
                </div>
              )}

              {/* Blast Radius Caller Impact Note */}
              {isBlast && (
                <div className="mt-1 text-[9px] text-rose-300/80 font-mono flex items-center justify-between bg-rose-950/30 px-2 py-0.5 rounded border border-rose-500/20">
                  <span>Impact: {block.data?.callers || 2} callers</span>
                  <span className="text-rose-400 font-medium">Auto-Protected</span>
                </div>
              )}

              {/* Hover Inspect Indicator Pill */}
              <div className="mt-2 pt-1 border-t border-white/5 flex items-center justify-between text-[9px] text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity">
                <span>Inspect in Monaco</span>
                <ArrowUpRight size={11} className="text-neutral-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          );
        }}
        onStateChanged={(data: any) => {
          if (data?.state === GraphState.ATTACHED || data?.state === GraphState.READY) {
            try {
              start();
              graph?.zoomTo("center", { padding: zoomPadding });
            } catch (e) {
              console.debug("Graph start/zoom initialization", e);
            }
          }
        }}
      />
    </div>
  );
});

export default GraphCanvasViewer;
