"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { GraphCanvas, useGraph } from "@gravity-ui/graph/react";
import { GraphState, type TBlock, type TConnection } from "@gravity-ui/graph";
import { ShieldAlert, GitPullRequest, Brain, Code2, ExternalLink } from "lucide-react";
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
    zoomPadding = 150,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { graph, setEntities, start } = useGraph({});

  useImperativeHandle(ref, () => ({
    zoomToCenter: (padding = zoomPadding) => {
      try {
        graph?.zoomTo("center", { padding });
      } catch (err) {
        console.warn("zoomTo error:", err);
      }
    },
    graph,
  }));

  useEffect(() => {
    if (blocks && blocks.length > 0) {
      try {
        const formattedBlocks: TBlock[] = blocks.map((b, idx) => {
          const { id, title, width, height, x, y, ...rest } = b;
          return {
            ...rest,
            id,
            is: "block",
            name: title || id,
            x: x ?? (idx % 3) * 310 - 310,
            y: y ?? Math.floor(idx / 3) * 170 - 85,
            width: width || 260,
            height: height || 120,
          };
        });

        const formattedConnections: TConnection[] = (connections || []).map((c, idx) => ({
          id: c.id || `conn_${idx}`,
          sourceBlockId: c.sourceBlockId || c.source,
          targetBlockId: c.targetBlockId || c.target,
          label: c.label,
          styles: {
            background: c.color || (c.type === "blast" ? "#ef4444" : c.type === "memory" ? "#f59e0b" : c.type === "company" ? "#10b981" : "#3b82f6"),
          },
        }));

        setEntities({ blocks: formattedBlocks, connections: formattedConnections });

        // Auto zoom to center when entities update
        setTimeout(() => {
          try {
            graph?.zoomTo("center", { padding: zoomPadding });
          } catch {
            // ignore if not ready
          }
        }, 120);
      } catch (err) {
        console.warn("Graph entities sync error:", err);
      }
    }
  }, [blocks, connections, setEntities, graph, zoomPadding]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative bg-[#121212] overflow-hidden select-none ${className}`}
    >
      <GraphCanvas
        graph={graph}
        renderBlock={(block: any) => {
          const isBlast = block.type === "blast_radius";
          const isMemory = block.type === "memory";
          const isPR = block.type === "company_pr";
          const isFunction = block.type === "function" || (!isBlast && !isMemory && !isPR);

          return (
            <div
              onClick={() => onSelectBlock(block, block.file, block.data?.line)}
              className={`p-3.5 rounded-xl border text-xs font-mono shadow-2xl transition-all cursor-pointer select-none group relative overflow-hidden backdrop-blur-md ${
                isBlast
                  ? "bg-red-950/20 border-red-500/80 text-red-200 hover:border-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.35)]"
                  : isMemory
                  ? "bg-amber-950/20 border-amber-500/80 text-amber-200 hover:border-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                  : isPR
                  ? "bg-emerald-950/20 border-emerald-500/80 text-emerald-200 hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                  : "bg-[#1c1c1c] border-[#383838] text-neutral-200 hover:border-[#555] hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              }`}
              style={{
                width: block.width || 260,
                minHeight: block.height || 120,
              }}
            >
              {/* Header Badge */}
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
                <span className="font-bold flex items-center gap-1.5 truncate text-[11px]">
                  {isBlast && <ShieldAlert size={14} className="text-red-400 shrink-0 stroke-[2.5]" />}
                  {isMemory && <Brain size={14} className="text-amber-400 shrink-0 stroke-[2.5]" />}
                  {isPR && <GitPullRequest size={14} className="text-emerald-400 shrink-0 stroke-[2.5]" />}
                  {isFunction && <Code2 size={14} className="text-blue-400 shrink-0 stroke-[2.5]" />}
                  <span className="truncate">{block.title || block.id}</span>
                </span>
                
                {isBlast ? (
                  <span className="text-[8px] tracking-wider uppercase px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-300 border border-red-500/30 whitespace-nowrap">
                    💥 BLAST RADIUS (Hop {block.data?.hop || 1})
                  </span>
                ) : isMemory ? (
                  <span className="text-[8px] tracking-wider uppercase px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                    GUARDRAIL RULE
                  </span>
                ) : isPR ? (
                  <span className="text-[8px] tracking-wider uppercase px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                    COMPANY BRAIN
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    TS
                  </span>
                )}
              </div>

              {/* File / Caller Path */}
              <div className="flex items-center justify-between text-[10px] text-neutral-400 truncate mb-1">
                <span className="truncate">
                  {isBlast ? `Caller: ${block.file || "billing.ts"}` : block.file || "Internal AST Node"}
                </span>
                {block.data?.line && (
                  <span className="text-neutral-500 text-[9px] font-mono">:{block.data.line}</span>
                )}
              </div>

              {/* Function Signature */}
              {isFunction && block.data?.signature && (
                <div className="mt-1 text-[9px] text-neutral-300 font-mono bg-black/40 px-1.5 py-0.5 rounded truncate border border-white/5">
                  {block.data.signature}
                </div>
              )}

              {/* Guardrail Memory Rule */}
              {isMemory && (
                <div className="mt-1.5 text-[10px] text-amber-200/95 italic bg-amber-950/40 p-1.5 rounded border border-amber-500/30 leading-snug">
                  &ldquo;{block.data?.memory_rule || block.title}&rdquo;
                </div>
              )}

              {/* PR # and Author Handle */}
              {isPR && (
                <div className="mt-1.5 text-[10px] text-emerald-200 font-mono flex items-center justify-between bg-emerald-950/40 px-2 py-1 rounded border border-emerald-500/30">
                  <span className="font-semibold">PR #{block.data?.pr_id || "104"}</span>
                  <span className="text-emerald-400">{block.data?.author || "@alex.chen"}</span>
                </div>
              )}

              {/* External Link Indicator on Hover */}
              <div className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink size={11} className="text-neutral-400" />
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
