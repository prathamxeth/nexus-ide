"use client";

import React, { useState } from "react";
import { GraphViewer } from "./GraphViewer";
import { GraphData, GraphNode } from "@/lib/agent-client";
import {
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  ShieldAlert,
} from "lucide-react";

interface AstGraphDrawerProps {
  graphData: GraphData;
  focusNodeId?: string;
  blastRadiusNodeIds?: Set<string> | string[];
  memoryNodeIds?: Set<string> | string[];
  onNodeClick?: (node: GraphNode) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function AstGraphDrawer({
  graphData,
  focusNodeId = "validateToken",
  blastRadiusNodeIds,
  memoryNodeIds,
  onNodeClick,
  onRefresh,
  isLoading = false,
}: AstGraphDrawerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const blastCount = blastRadiusNodeIds
    ? blastRadiusNodeIds instanceof Set
      ? blastRadiusNodeIds.size
      : blastRadiusNodeIds.length
    : 0;

  return (
    <div
      className={`border-t border-[#282828] bg-[#141414] transition-[height] duration-200 ease-out flex flex-col shrink-0 ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-[#141414]"
          : isOpen
          ? "h-[290px]"
          : "h-9"
      }`}
    >
      {/* Drawer Header */}
      <div className="h-9 px-3 bg-[#181818] border-b border-[#282828] flex items-center justify-between select-none shrink-0">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 cursor-pointer text-xs font-mono text-[#e5e5e5]"
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#888888]" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-[#888888]" />
          )}
          <span className="font-semibold tracking-wide">FalkorDB Code Graph</span>
          <span className="text-[11px] text-[#888888] px-1.5 py-0.5 rounded bg-[#222222]">
            {graphData.nodes.length} items • {graphData.edges.length} connections
          </span>
          {blastCount > 0 && (
            <span className="text-[10px] text-[#ef4444] px-1.5 py-0.5 rounded bg-[#3b1219] border border-[#ef4444]/30 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              What Breaks: {blastCount} items
            </span>
          )}
        </div>

        {/* Drawer Window Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Maximize"}
            className="p-1 hover:bg-[#222222] rounded text-[#888888] hover:text-[#e5e5e5] transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Drawer Body using GraphViewer */}
      {isOpen && (
        <div className="flex-1 w-full relative overflow-hidden">
          <GraphViewer
            graphData={graphData}
            focusNodeId={focusNodeId}
            blastRadiusNodeIds={blastRadiusNodeIds}
            memoryNodeIds={memoryNodeIds}
            onNodeClick={onNodeClick}
            onRefresh={onRefresh}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
