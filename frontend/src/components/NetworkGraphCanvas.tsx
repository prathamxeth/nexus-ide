"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Filter,
  Play,
  Search,
  ChevronDown,
  Check,
  RotateCw,
  Maximize2,
  GitFork,
  Network,
  ZoomIn,
  ZoomOut,
  Workflow,
  ChevronRight,
  FileCode,
  X,
  Sparkles,
} from "lucide-react";

// Dynamically import react-force-graph-2d client-side only
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center text-xs font-mono text-neutral-500 gap-2">
      <RotateCw className="w-5 h-5 text-neutral-400 animate-spin" />
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
  realtimeChangedNodeIds?: string[] | Set<string>;
  activeFileName?: string;
  activeFileCode?: string;
  isModified?: boolean;
}

const COLOR_MAP: Record<string, string> = {
  Module: "#d4d4d8",    // Clean silver neutral
  Endpoint: "#f54e00",  // Cursor primary (Cursor Orange)
  File: "#c0a8dd",      // Cursor timeline-edit (lavender)
  Class: "#9fc9a2",     // Cursor timeline-grep (mint)
  Function: "#dfa88f",  // Cursor timeline-thinking (peach)
};

// Topological hierarchy ranking for DAG Tree mode
function getNodeLevel(node: NodeItem): number {
  const t = node.type || "";
  const id = node.id || "";
  if (t === "Module" || id === "root" || id === "src" || id === "tests") return 0;
  if (t === "File" || id.endsWith(".ts") || id.endsWith(".py") || id.endsWith(".json") || id.endsWith(".md") || id.endsWith(".sh")) return 1;
  if (t === "Class") return 2;
  if (t === "Function") return 3;
  if (t === "Endpoint") return 4;
  return 3;
}

export default function NetworkGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onRunAction,
  highlightedNodeIds,
  realtimeChangedNodeIds,
  activeFileName,
  activeFileCode,
  isModified,
}: NetworkGraphCanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 600 });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<"tree" | "cluster">("tree");
  const [viewMode, setViewMode] = useState<"graph" | "flowchart">("graph");

  // Keep track of active file and user manual preference
  const prevActiveFileRef = useRef<string | undefined>(undefined);
  const userPrefersGraphRef = useRef<boolean>(false);

  // Auto-switch to flowchart when a file is opened, clicked, or closed
  useEffect(() => {
    if (activeFileName && activeFileName !== prevActiveFileRef.current) {
      prevActiveFileRef.current = activeFileName;
      userPrefersGraphRef.current = false;
      setViewMode("flowchart");
    } else if (!activeFileName) {
      prevActiveFileRef.current = undefined;
      setViewMode("graph");
    }
  }, [activeFileName]);

  // Auto-switch to flowchart when code is modified or highlighted, unless user explicitly clicked Graph
  useEffect(() => {
    const hasChanges = (realtimeChangedNodeIds && (Array.isArray(realtimeChangedNodeIds) ? realtimeChangedNodeIds.length > 0 : realtimeChangedNodeIds.size > 0)) || Boolean(isModified);
    const hasHighlights = highlightedNodeIds && (highlightedNodeIds instanceof Set ? highlightedNodeIds.size > 0 : highlightedNodeIds.length > 0);
    if (hasChanges || hasHighlights) {
      if (!userPrefersGraphRef.current) {
        setViewMode("flowchart");
      }
    }
  }, [realtimeChangedNodeIds, isModified, highlightedNodeIds]);

  // Node type filters
  const [activeTypes, setActiveTypes] = useState<Record<string, boolean>>({
    Module: true,
    File: true,
    Class: true,
    Function: true,
    Endpoint: true,
  });

  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const hierarchyDrawerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns and drawers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
      if (hierarchyDrawerRef.current && !hierarchyDrawerRef.current.contains(target)) {
        const toggleBtn = document.getElementById("hierarchy-toggle-btn");
        if (!toggleBtn || !toggleBtn.contains(target)) {
          setIsHierarchyOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Pre-index realtime changed node ids
  const realtimeChangedSet = useMemo(() => {
    if (!realtimeChangedNodeIds) return new Set<string>();
    if (realtimeChangedNodeIds instanceof Set) return realtimeChangedNodeIds;
    return new Set(realtimeChangedNodeIds);
  }, [realtimeChangedNodeIds]);

  // Filter nodes & links based on activeTypes, collapsed state, and Tree vs Cluster layout
  const graphData = useMemo(() => {
    const validNodes = nodes.filter((n) => {
      const typeKey = n.type || "Function";
      return activeTypes[typeKey] !== false;
    });

    const nodeLevelMap = new Map<string, number>();
    for (const n of validNodes) {
      nodeLevelMap.set(n.id, getNodeLevel(n));
    }

    const validNodeIds = new Set(validNodes.map((n) => n.id));

    const rawLinks = edges
      .map((e) => {
        const src = typeof e.source === "object" ? e.source.id : e.source;
        const tgt = typeof e.target === "object" ? e.target.id : e.target;
        return { source: src, target: tgt, relationship: e.relationship || e.type || "LINKS" };
      })
      .filter((e) => {
        if (!validNodeIds.has(e.source) || !validNodeIds.has(e.target)) return false;
        if (e.source === e.target) return false;
        if (collapsedNodes.has(e.source) && !collapsedNodes.has(e.target)) {
          return false;
        }
        return true;
      });

    // In tree mode, strictly orient links top-down to guarantee an acyclic DAG (0 cycles, 0 errors)
    const links = rawLinks
      .map((e) => {
        if (layoutMode === "tree") {
          const sLvl = nodeLevelMap.get(e.source) ?? 2;
          const tLvl = nodeLevelMap.get(e.target) ?? 2;
          if (sLvl > tLvl) {
            return { source: e.target, target: e.source, relationship: e.relationship };
          }
        }
        return e;
      })
      .filter((e) => {
        if (layoutMode === "tree") {
          const sLvl = nodeLevelMap.get(e.source) ?? 2;
          const tLvl = nodeLevelMap.get(e.target) ?? 2;
          if (sLvl === tLvl && e.source > e.target) {
            return false;
          }
        }
        return true;
      });

    return { nodes: validNodes, links };
  }, [nodes, edges, activeTypes, collapsedNodes, layoutMode]);

  // Dedicated File Flowchart Data (Focused on exact active file, its functions, changes & callers)
  const flowchartData = useMemo(() => {
    if (!activeFileName) return null;

    const fileFnIds = new Set<string>();
    for (const n of nodes) {
      if (n.properties?.file === activeFileName) {
        fileFnIds.add(n.id);
      } else if (activeFileName === "auth.ts" && (n.id === "validateToken" || n.id === "verifyToken" || n.id === "decodePayload")) {
        fileFnIds.add(n.id);
      } else if (activeFileName === "billing.ts" && (n.id === "processInvoice" || n.id === "Invoice")) {
        fileFnIds.add(n.id);
      } else if (activeFileName === "finance.ts" && (n.id === "auditAccount" || n.id === "calculateTax")) {
        fileFnIds.add(n.id);
      } else if (activeFileName === "asgi.py" && (n.id.includes("websocket") || n.id.includes("ASGI") || n.id.includes("ws_"))) {
        fileFnIds.add(n.id);
      } else if (activeFileName === "worker.py" && (n.id.includes("worker") || n.id.includes("FastMCP") || n.id.includes("setup_server"))) {
        fileFnIds.add(n.id);
      }
    }

    if (activeFileCode) {
      const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
      let m;
      while ((m = fnRegex.exec(activeFileCode)) !== null) {
        fileFnIds.add(m[1]);
      }
    }

    if (fileFnIds.size === 0) {
      fileFnIds.add(activeFileName.replace(/\.[^/.]+$/, ""));
    }

    // Inbound callers from other files that call functions in this file
    const inboundCallerIds = new Set<string>();
    for (const e of edges) {
      const src = typeof e.source === "object" ? e.source.id : e.source;
      const tgt = typeof e.target === "object" ? e.target.id : e.target;
      if (fileFnIds.has(tgt) && !fileFnIds.has(src)) {
        inboundCallerIds.add(src);
      }
    }

    const fNodes: any[] = [];
    const fNodeIds = new Set<string>();

    // 1. File Root Node (Level 0)
    const fileRootId = `file:${activeFileName}`;
    fNodes.push({
      id: fileRootId,
      label: activeFileName,
      type: "File",
      level: 0,
      isFileRoot: true,
      desc: activeFileName.endsWith(".ts") ? "TypeScript Source" : "Python Source",
    });
    fNodeIds.add(fileRootId);

    // 2. Inbound Caller Nodes (Level 0)
    for (const callerId of inboundCallerIds) {
      const orig = nodes.find((n) => n.id === callerId);
      const label = orig ? orig.label : callerId;
      fNodes.push({
        id: callerId,
        label: `${label}()`,
        type: "Caller",
        level: 0,
        isCaller: true,
        desc: "Inbound Caller",
        isHighlighted: highlightedNodeIds
          ? (highlightedNodeIds instanceof Set ? highlightedNodeIds.has(callerId) : highlightedNodeIds.includes(callerId))
          : false,
      });
      fNodeIds.add(callerId);
    }

    // 3. Functions defined in this file (Level 1+)
    let idx = 0;
    for (const fnId of fileFnIds) {
      const orig = nodes.find((n) => n.id === fnId);
      const label = orig ? orig.label : fnId;
      const isEdited = realtimeChangedSet.has(fnId) || realtimeChangedSet.has(activeFileName) || Boolean(isModified);
      const isHighlighted = highlightedNodeIds
        ? (highlightedNodeIds instanceof Set ? highlightedNodeIds.has(fnId) : highlightedNodeIds.includes(fnId))
        : false;

      let changeSnippet: string | undefined = undefined;
      if (isEdited) {
        if (activeFileCode?.includes("clockTolerance") || activeFileCode?.includes("skew")) {
          changeSnippet = "Exact Change: clockTolerance skew <= 60s";
        } else if (activeFileCode?.includes("calculateTax") || activeFileCode?.includes("0.08")) {
          changeSnippet = "Exact Change: tax rate calculation updated";
        } else if (activeFileCode?.includes("status: \"PROCESSED\"")) {
          changeSnippet = "Exact Change: invoice processing status verified";
        } else if (isModified) {
          changeSnippet = "Exact Change: Live modified in editor";
        } else {
          changeSnippet = "Exact Change: Saved cleanly to file ✓";
        }
      }

      fNodes.push({
        id: fnId,
        label: `${label}()`,
        type: "Function",
        level: 1 + Math.floor(idx / 3),
        isEdited,
        isHighlighted,
        changeSnippet,
        desc: isEdited ? "Modified in Real-time" : "Local Definition",
      });
      fNodeIds.add(fnId);
      idx++;
    }

    // 4. Directional Links
    const fLinks: any[] = [];
    const linkSet = new Set<string>();

    // File root -> functions
    for (const fnId of fileFnIds) {
      const key = `${fileRootId}->${fnId}`;
      if (!linkSet.has(key)) {
        fLinks.push({ source: fileRootId, target: fnId, relationship: "EXPORTS" });
        linkSet.add(key);
      }
    }

    // Inbound callers -> functions
    for (const e of edges) {
      const src = typeof e.source === "object" ? e.source.id : e.source;
      const tgt = typeof e.target === "object" ? e.target.id : e.target;
      if (fNodeIds.has(src) && fNodeIds.has(tgt)) {
        const key = `${src}->${tgt}`;
        if (!linkSet.has(key)) {
          fLinks.push({ source: src, target: tgt, relationship: e.relationship || "CALLS" });
          linkSet.add(key);
        }
      }
    }

    return { nodes: fNodes, links: fLinks };
  }, [activeFileName, activeFileCode, nodes, edges, realtimeChangedSet, highlightedNodeIds, isModified]);

  // Current active data: Flowchart when in flowchart mode, else Full Graph
  const currentGraphData = useMemo(() => {
    if (viewMode === "flowchart" && flowchartData && flowchartData.nodes.length > 0) {
      return flowchartData;
    }
    return graphData;
  }, [viewMode, flowchartData, graphData]);

  // Connected nodes map for highlighting neighbor links
  const connectedNeighbors = useMemo(() => {
    if (!selectedNodeId) return null;
    const set = new Set<string>([selectedNodeId]);
    for (const link of currentGraphData.links) {
      const s = typeof link.source === "object" ? link.source.id : link.source;
      const t = typeof link.target === "object" ? link.target.id : link.target;
      if (s === selectedNodeId) set.add(t);
      if (t === selectedNodeId) set.add(s);
    }
    return set;
  }, [selectedNodeId, currentGraphData.links]);

  // Centroid-based camera centering and fit
  const handleFit = useCallback(() => {
    if (!fgRef.current || currentGraphData.nodes.length === 0) return;
    const validNodes = currentGraphData.nodes.filter(
      (n: any) => typeof n.x === "number" && typeof n.y === "number" && !isNaN(n.x) && !isNaN(n.y)
    );
    if (validNodes.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of validNodes) {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
      }
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      fgRef.current.centerAt(midX, midY, 200);
    }
    fgRef.current.zoomToFit(280, viewMode === "flowchart" ? 54 : 36);
  }, [currentGraphData.nodes, viewMode]);

  // Center camera on selected or real-time changed node smoothly
  useEffect(() => {
    if (!fgRef.current) return;
    const targetId = selectedNodeId || (realtimeChangedNodeIds && Array.isArray(realtimeChangedNodeIds) ? realtimeChangedNodeIds[0] : null);
    if (targetId) {
      const target = currentGraphData.nodes.find((n) => n.id === targetId || n.label === targetId);
      if (target && target.x !== undefined && target.y !== undefined) {
        fgRef.current.centerAt(target.x, target.y, 350);
      }
    }
  }, [selectedNodeId, realtimeChangedNodeIds, currentGraphData.nodes]);

  // Auto-center and fit whenever nodes, edges, viewMode, or updates change in real-time
  useEffect(() => {
    if (!fgRef.current || currentGraphData.nodes.length === 0) return;
    try {
      if (viewMode === "graph" && layoutMode === "cluster") {
        fgRef.current.d3Force("charge")?.strength?.(-110)?.distanceMax?.(260)?.distanceMin?.(25);
        fgRef.current.d3Force("link")?.distance?.(55);
      } else if (viewMode === "flowchart") {
        fgRef.current.d3Force("charge")?.strength?.(-130)?.distanceMax?.(280);
      }
    } catch {
      // Safe fallback
    }
    const timer = setTimeout(() => {
      handleFit();
    }, 120);
    return () => clearTimeout(timer);
  }, [
    viewMode,
    layoutMode,
    currentGraphData.nodes.length,
    currentGraphData.links.length,
    highlightedNodeIds,
    realtimeChangedNodeIds,
    dimensions.width,
    dimensions.height,
    handleFit,
  ]);

  // Zoom control handlers
  const handleZoomIn = () => {
    if (!fgRef.current) return;
    const currentZoom = fgRef.current.zoom();
    fgRef.current.zoom(currentZoom * 1.35, 250);
  };

  const handleZoomOut = () => {
    if (!fgRef.current) return;
    const currentZoom = fgRef.current.zoom();
    fgRef.current.zoom(Math.max(currentZoom / 1.35, 0.1), 250);
  };

  const handleSwitchLayout = (mode: "tree" | "cluster") => {
    setLayoutMode(mode);
    setTimeout(() => {
      if (fgRef.current) {
        if (mode === "cluster") {
          fgRef.current.d3Force("charge")?.strength?.(-110)?.distanceMax?.(260)?.distanceMin?.(25);
          fgRef.current.d3Force("link")?.distance?.(55);
        }
        fgRef.current.d3ReheatSimulation?.();
        handleFit();
      }
    }, 80);
  };

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

  const highlightedCount = highlightedNodeIds
    ? (highlightedNodeIds instanceof Set ? highlightedNodeIds.size : highlightedNodeIds.length)
    : 0;

  // Group nodes for Hierarchy Drawer (Heading -> Topic -> Subtopics)
  const hierarchyGroups = useMemo(() => {
    const modules: NodeItem[] = [];
    const files: NodeItem[] = [];
    const functions: NodeItem[] = [];

    for (const n of graphData.nodes) {
      const lvl = getNodeLevel(n);
      if (lvl === 0) modules.push(n);
      else if (lvl === 1) files.push(n);
      else functions.push(n);
    }

    return { modules, files, functions };
  }, [graphData.nodes]);

  return (
    <div className="w-full h-full bg-[#000000] flex flex-col overflow-hidden select-none relative">
      {/* ======================================================== */}
      {/* 1. TOP HEADER TOOLBAR: STATUS & SEARCH DROPDOWN */}
      {/* ======================================================== */}
      <div className="h-10 px-3 border-b border-[#1e1e1e] bg-[#080808] flex items-center justify-between shrink-0 z-20 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Mode Switcher: Whole Graph vs File Flowchart */}
          <div className="flex items-center bg-[#121212] border border-[#242424] rounded-lg p-0.5 shadow-sm shrink-0">
            <button
              onClick={() => {
                userPrefersGraphRef.current = true;
                setViewMode("graph");
                setTimeout(handleFit, 60);
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono transition-colors cursor-pointer ${
                viewMode === "graph"
                  ? "bg-[#222222] text-white border border-[#333333]"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Full project code graph"
            >
              <Network size={11} className={viewMode === "graph" ? "text-[#f54e00]" : "text-neutral-400"} />
              <span>Graph</span>
            </button>
            <button
              onClick={() => {
                userPrefersGraphRef.current = false;
                setViewMode("flowchart");
                setTimeout(handleFit, 60);
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono transition-colors cursor-pointer ${
                viewMode === "flowchart"
                  ? "bg-[#f54e00]/20 text-[#f54e00] border border-[#f54e00]/50"
                  : "text-neutral-400 hover:text-white"
              }`}
              title={`File logic flowchart for ${activeFileName || "current file"}`}
            >
              <Workflow size={11} className={viewMode === "flowchart" ? "text-[#f54e00]" : "text-neutral-400"} />
              <span className="truncate max-w-[80px]">{activeFileName ? `Flow: ${activeFileName}` : "Flowchart"}</span>
              {realtimeChangedSet.size > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#e5c07b] animate-pulse" />}
            </button>
          </div>

          {/* Status Badge */}
          {hasHighlighted ? (
            <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-950/90 border border-red-500/60 text-[10px] font-mono text-red-200 animate-pulse truncate shadow-sm shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_#ef4444]" />
              <span className="truncate max-w-[90px] font-medium">{highlightedCount} Affected</span>
            </div>
          ) : realtimeChangedSet.size > 0 ? (
            <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#e5c07b]/15 border border-[#e5c07b]/40 text-[10px] font-mono text-[#e5c07b] animate-pulse truncate shadow-sm shrink-0 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e5c07b] shrink-0" />
              <span>Exact Change</span>
            </div>
          ) : null}
        </div>

        {/* NODES SEARCH DROPDOWN */}
        <div ref={searchDropdownRef} className="relative shrink-0">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex items-center gap-1 text-[11px] font-mono text-neutral-300 hover:text-white cursor-pointer px-2 py-1 rounded-[6px] bg-[#121212] hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] transition-colors shrink-0"
            title="Search code nodes"
          >
            <Search size={11} className="text-neutral-400 shrink-0" />
            <span className="max-w-[70px] truncate text-neutral-200">{selectedNodeId || "Search"}</span>
            <ChevronDown size={10} className="text-neutral-500 shrink-0" />
          </button>

          {/* Dropdown Popover */}
          {isSearchOpen && (
            <div className="absolute right-0 top-9 w-64 bg-[#111111] border border-[#282828] rounded-xl shadow-2xl p-2 z-40 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0a0a0a] rounded-lg border border-[#222222] text-xs font-mono text-neutral-200 mb-1">
                <Search size={12} className="text-neutral-500 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter functions & files..."
                  autoFocus
                  className="bg-transparent outline-none w-full text-xs text-white placeholder-neutral-500 font-mono"
                />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {searchResults.map((n) => {
                  const isSelected = selectedNodeId === n.id;
                  const nodeColor = COLOR_MAP[n.type || "Function"] || "#d4d4d8";
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        onSelectNode(n);
                        setIsSearchOpen(false);
                        setSearchQuery("");
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-colors ${
                        isSelected ? "bg-[#f54e00]/15 text-[#f54e00]" : "text-neutral-300 hover:bg-[#1a1a1a] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: nodeColor }} />
                        <span className="truncate">{n.label}</span>
                      </div>
                      <span className="text-[11px] text-neutral-500 uppercase ml-2">{n.type}</span>
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
      {/* ======================================================== */}
      {/* 2. HIERARCHY FLOWCHART BREADCRUMBS BAR (HEADING - TOPIC - SUBTOPICS) */}
      {/* ======================================================== */}
      <div className="h-7 px-2.5 border-b border-[#181818] bg-[#050505] flex items-center text-[10.5px] font-mono text-neutral-400 select-none overflow-x-auto scrollbar-none gap-1.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-none py-0.5">
          <button
            onClick={() => setIsHierarchyOpen(!isHierarchyOpen)}
            className="text-[10px] text-neutral-500 hover:text-[#f54e00] uppercase tracking-wider font-semibold shrink-0 cursor-pointer flex items-center gap-1 transition-colors"
            title="Toggle Code Flow & Structure Map"
          >
            <Workflow size={10} className="text-[#f54e00]" />
            <span>Hierarchy:</span>
          </button>
          
          {/* HEADING (Module) */}
          <span
            onClick={() => {
              const rootNode = graphData.nodes.find((n) => n.id === "src" || n.id === "root");
              if (rootNode) onSelectNode(rootNode);
            }}
            className="text-neutral-400 hover:text-white cursor-pointer px-1 py-0.5 rounded bg-[#101010] border border-[#222222] shrink-0 transition-colors text-[10px]"
            title="Module Root (Heading)"
          >
            src/
          </span>
          <ChevronRight size={9} className="text-neutral-600 shrink-0" />

          {/* TOPIC (File) */}
          <span
            onClick={() => {
              const fileNode = graphData.nodes.find((n) => n.id === activeFileName);
              if (fileNode) onSelectNode(fileNode);
            }}
            className={`px-1 py-0.5 rounded shrink-0 flex items-center gap-1 cursor-pointer transition-colors text-[10px] ${
              realtimeChangedSet.size > 0
                ? "text-[#e5c07b] bg-[#e5c07b]/10 border border-[#e5c07b]/30"
                : "text-neutral-300 bg-[#141414] border border-[#242424] hover:text-white"
            }`}
            title="Source File (Topic)"
          >
            <FileCode size={10} className={realtimeChangedSet.size > 0 ? "text-[#e5c07b]" : "text-neutral-400"} />
            <span>{activeFileName || "auth.ts"}</span>
          </span>
          {/* SUBTOPICS (Function / Call Target) - Only render if a specific item is selected */}
          {selectedNodeId && (
            <>
              <ChevronRight size={9} className="text-neutral-600 shrink-0" />
              <span
                onClick={() => {
                  const activeNode = graphData.nodes.find((n) => n.id === selectedNodeId);
                  if (activeNode) onSelectNode(activeNode);
                }}
                className="px-1.5 py-0.5 rounded text-[#f54e00] bg-[#f54e00]/10 border border-[#f54e00]/30 shrink-0 font-medium cursor-pointer text-[10px] max-w-[130px] truncate"
                title={`Active Function: ${selectedNodeId}`}
              >
                {selectedNodeId}
              </span>
            </>
          )}

          {/* REAL-TIME EDITED PULSE BADGE */}
          {realtimeChangedSet.size > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#e5c07b] bg-[#e5c07b]/15 border border-[#e5c07b]/40 shrink-0 animate-pulse font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e5c07b]" />
              <span>Edited</span>
            </span>
          )}

          {/* WHAT BREAKS HUD */}
          {hasHighlighted && (
            <>
              <ChevronRight size={9} className="text-neutral-600 shrink-0" />
              <span className="px-1.5 py-0.5 rounded text-red-300 bg-red-950/70 border border-red-500/40 shrink-0 animate-pulse font-medium flex items-center gap-1 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>{highlightedCount} Affected</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. INTERACTIVE FLOWCHART & HIERARCHY DRAWER OVERLAY */}
      {/* ======================================================== */}
      {isHierarchyOpen && (
        <div
          ref={hierarchyDrawerRef}
          className="absolute bottom-12 left-3 right-3 sm:right-auto sm:w-80 bg-[#0a0a0a]/95 backdrop-blur-md border border-[#262626] rounded-xl shadow-2xl z-30 p-3 font-mono text-[11px] flex flex-col gap-2.5 max-h-[70%] overflow-y-auto animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#202020]">
            <div className="flex items-center gap-1.5 text-neutral-200 font-semibold">
              <Workflow size={13} className="text-[#f54e00]" />
              <span>Code Flow & Structure</span>
            </div>
            <button
              onClick={() => setIsHierarchyOpen(false)}
              className="p-1 rounded hover:bg-[#1a1a1a] text-neutral-400 hover:text-white cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>

          {/* Section 1: Heading - Modules */}
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">
              1. Folders
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {hierarchyGroups.modules.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelectNode(m);
                    setIsHierarchyOpen(false);
                  }}
                  className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer ${
                    selectedNodeId === m.id
                      ? "bg-[#f54e00]/20 border-[#f54e00] text-white"
                      : "bg-[#141414] border-[#262626] text-neutral-300 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Topic - Source Files */}
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">
              2. Files
            </div>
            <div className="grid grid-cols-2 gap-1">
              {hierarchyGroups.files.map((f) => {
                const isModified = realtimeChangedSet.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      onSelectNode(f);
                      setIsHierarchyOpen(false);
                    }}
                    className={`flex items-center justify-between px-2 py-1 rounded-md border text-[11px] transition-colors cursor-pointer text-left ${
                      selectedNodeId === f.id
                        ? "bg-[#f54e00]/20 border-[#f54e00] text-white"
                        : isModified
                        ? "bg-[#1a160e] border-[#e5c07b]/40 text-[#e5c07b]"
                        : "bg-[#141414] border-[#262626] text-neutral-300 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{f.label}</span>
                    {isModified && <span className="text-[11px] text-[#e5c07b]">●</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Subtopics - Functions & Callers */}
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">
              3. Functions & Connections
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {hierarchyGroups.functions.map((fn) => {
                const isBlastRadius = highlightedNodeIds
                  ? (highlightedNodeIds instanceof Set ? highlightedNodeIds.has(fn.id) : highlightedNodeIds.includes(fn.id))
                  : false;
                const isRealtime = realtimeChangedSet.has(fn.id);
                return (
                  <button
                    key={fn.id}
                    onClick={() => {
                      onSelectNode(fn);
                      setIsHierarchyOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-md border text-[11px] transition-colors cursor-pointer text-left ${
                      selectedNodeId === fn.id
                        ? "bg-[#f54e00]/20 border-[#f54e00] text-white"
                        : isBlastRadius
                        ? "bg-red-950/40 border-red-500/50 text-red-200"
                        : isRealtime
                        ? "bg-[#1a160e] border-[#e5c07b]/40 text-[#e5c07b]"
                        : "bg-[#141414] border-[#262626] text-neutral-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: fn.color || COLOR_MAP[fn.type || "Function"] }} />
                      <span className="truncate">{fn.label}</span>
                    </div>
                    {isBlastRadius ? (
                      <span className="text-[11px] text-red-400 font-semibold">BREAKS</span>
                    ) : isRealtime ? (
                      <span className="text-[11px] text-[#e5c07b] font-semibold">EDITED</span>
                    ) : (
                      <span className="text-[11px] text-neutral-500">{fn.type}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. DYNAMIC RESIZE-AWARE FORCE GRAPH 2D CANVAS */}
      {/* ======================================================== */}
      <div ref={canvasContainerRef} className="flex-1 w-full min-h-0 relative overflow-hidden bg-[#000000]">
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={currentGraphData}
          backgroundColor="#000000"
          nodeRelSize={viewMode === "flowchart" ? 8 : 5.5}
          dagMode={viewMode === "flowchart" ? "td" : layoutMode === "tree" ? "td" : undefined}
          dagLevelDistance={viewMode === "flowchart" ? 64 : dimensions.height < 500 ? 55 : 72}
          onNodeClick={handleNodeClick}
          onNodeHover={(node: any) => {
            if (canvasContainerRef.current) {
              const canvas = canvasContainerRef.current.querySelector("canvas");
              if (canvas) {
                canvas.style.cursor = node ? "pointer" : "default";
              }
            }
          }}
          onBackgroundClick={() => onSelectNode(null)}
          cooldownTicks={120}
          warmupTicks={50}
          d3VelocityDecay={0.35}
          d3AlphaDecay={0.03}
          onEngineStop={() => {
            handleFit();
          }}
          // Hit area detection matching world coordinates
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            if (viewMode === "flowchart") {
              const isFile = Boolean(node.isFileRoot);
              const isEdited = Boolean(node.isEdited) || realtimeChangedSet.has(String(node.id));
              const cardWidth = isFile ? 88 : (isEdited && node.changeSnippet) ? 128 : 100;
              const cardHeight = (isEdited && node.changeSnippet) ? 26 : 19;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.rect(node.x - cardWidth / 2, node.y - cardHeight / 2, cardWidth, cardHeight);
              ctx.fill();
            } else {
              const nid = String(node.id);
              const isBig = nid === "root" || nid === "src";
              const radius = isBig ? 13 : 8;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
              ctx.fill();
            }
          }}
          // Link styling: clean monochrome neutral connections or flowchart flow
          linkColor={(link: any) => {
            if (viewMode === "flowchart") {
              const tgt = typeof link.target === "object" ? link.target.id : link.target;
              if (realtimeChangedSet.has(tgt) || Boolean(isModified)) return "#e5c07b";
              return "#383838";
            }
            if (!connectedNeighbors) return "#222222";
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (connectedNeighbors.has(s) && connectedNeighbors.has(t)) {
              return "#f54e00"; // highlighted link
            }
            return "#141414"; // dimmed
          }}
          linkWidth={(link: any) => {
            if (viewMode === "flowchart") return 1.4;
            if (!connectedNeighbors) return 0.9;
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            return connectedNeighbors.has(s) && connectedNeighbors.has(t) ? 2.0 : 0.4;
          }}
          linkDirectionalArrowLength={viewMode === "flowchart" ? 5.5 : 0}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={viewMode === "flowchart" ? 2 : 0}
          linkDirectionalParticleSpeed={0.007}
          linkCurvature={viewMode === "flowchart" ? 0.08 : 0}
          // Custom Node Painting
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const nid = String(node.id);
            const nLabel = String(node.label || "");
            const nName = String(node.name || "");

            // ========================================================
            // FLOWCHART MODE: RENDER RECTANGULAR FLOWCHART CARDS
            // ========================================================
            if (viewMode === "flowchart") {
              const isSelected = selectedNodeId === nid || selectedNodeId === nLabel.replace("()", "");
              const isEdited = Boolean(node.isEdited) || realtimeChangedSet.has(nid) || realtimeChangedSet.has(nLabel.replace("()", ""));
              const isHighlighted = Boolean(node.isHighlighted);
              const isCaller = Boolean(node.isCaller);
              const isFile = Boolean(node.isFileRoot);

              // Fixed world dimensions proportional to DAG layout (dagLevelDistance ~58)
              const cardWidth = isFile ? 88 : (isEdited && node.changeSnippet) ? 128 : 100;
              const cardHeight = (isEdited && node.changeSnippet) ? 26 : 19;
              const halfW = cardWidth / 2;
              const halfH = cardHeight / 2;

              ctx.save();

              // Card Glow
              if (isEdited) {
                ctx.shadowColor = "rgba(229, 192, 123, 0.85)";
                ctx.shadowBlur = 6;
              } else if (isHighlighted) {
                ctx.shadowColor = "rgba(239, 68, 68, 0.85)";
                ctx.shadowBlur = 6;
              } else if (isSelected) {
                ctx.shadowColor = "rgba(245, 78, 0, 0.85)";
                ctx.shadowBlur = 6;
              }

              // Card Background
              ctx.fillStyle = isEdited
                ? "rgba(24, 18, 9, 0.96)"
                : isHighlighted
                ? "rgba(35, 12, 16, 0.96)"
                : isSelected
                ? "rgba(28, 12, 6, 0.96)"
                : "rgba(14, 14, 14, 0.95)";

              ctx.beginPath();
              if (typeof ctx.roundRect === "function") {
                ctx.roundRect(node.x - halfW, node.y - halfH, cardWidth, cardHeight, 3);
              } else {
                ctx.rect(node.x - halfW, node.y - halfH, cardWidth, cardHeight);
              }
              ctx.fill();

              // Card Border
              ctx.strokeStyle = isEdited
                ? "#e5c07b"
                : isHighlighted
                ? "#ef4444"
                : isSelected
                ? "#f54e00"
                : isFile
                ? "#3c3c3c"
                : isCaller
                ? "#63478c"
                : "#242424";
              ctx.lineWidth = (isEdited || isHighlighted || isSelected) ? 1.4 : 0.9;
              ctx.stroke();

              ctx.shadowBlur = 0;

              // Title Text with truncation
              const titleFontSize = 6.4;
              ctx.font = `600 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";

              const paddingX = 6;
              const titleY = (isEdited && node.changeSnippet) ? node.y - 4.5 : node.y;

              ctx.fillStyle = isEdited
                ? "#ffe2a3"
                : isHighlighted
                ? "#fca5a5"
                : isSelected
                ? "#ffffff"
                : isFile
                ? "#e4e4e7"
                : "#d4d4d8";

              const rawTitle = nLabel || nid;
              const maxTitleLen = (isEdited && node.changeSnippet) ? 15 : isFile ? 13 : 16;
              const displayTitle = rawTitle.length > maxTitleLen ? `${rawTitle.slice(0, maxTitleLen - 1)}…` : rawTitle;
              ctx.fillText(displayTitle, node.x - halfW + paddingX, titleY);

              // Subtitle / Exact Change Detail
              if (isEdited && node.changeSnippet) {
                const subFontSize = 4.6;
                ctx.font = `500 ${subFontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
                ctx.fillStyle = "#e5c07b";
                const rawSnippet = String(node.changeSnippet);
                const displaySnippet = rawSnippet.length > 25 ? `${rawSnippet.slice(0, 24)}…` : rawSnippet;
                ctx.fillText(displaySnippet, node.x - halfW + paddingX, node.y + 5.5);
              } else if (node.desc && isFile) {
                const subFontSize = 4.4;
                ctx.font = `400 ${subFontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
                ctx.fillStyle = "#71717a";
                const rawDesc = String(node.desc);
                const displayDesc = rawDesc.length > 20 ? `${rawDesc.slice(0, 19)}…` : rawDesc;
                ctx.fillText(displayDesc, node.x - halfW + paddingX, node.y + 5.0);
              }

              // Badges on right side
              if (isEdited) {
                const badgeFont = 4.4;
                ctx.font = `700 ${badgeFont}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
                ctx.textAlign = "right";
                ctx.fillStyle = "#e5c07b";
                ctx.fillText("● EDITED", node.x + halfW - paddingX, titleY);
              } else if (isHighlighted) {
                const badgeFont = 4.4;
                ctx.font = `700 ${badgeFont}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
                ctx.textAlign = "right";
                ctx.fillStyle = "#ef4444";
                ctx.fillText("● BREAKS", node.x + halfW - paddingX, titleY);
              }

              ctx.restore();
              return;
            }

            // ========================================================
            // GRAPH OVERVIEW MODE: RENDER CLEAN DISCS & LABELS
            // ========================================================
            const type = node.type || "Function";
            const baseColor = node.color || COLOR_MAP[type] || "#d4d4d8";

            const isSelected = selectedNodeId === nid;
            const isConnected = connectedNeighbors ? connectedNeighbors.has(nid) : true;
            const isDimmed = connectedNeighbors !== null && !isConnected;

            // Check if visited by backend graph_traversal event
            const isHighlighted = highlightedNodeIds
              ? (highlightedNodeIds instanceof Set
                  ? (highlightedNodeIds.has(nid) || highlightedNodeIds.has(nLabel) || highlightedNodeIds.has(nName))
                  : (highlightedNodeIds.includes(nid) || highlightedNodeIds.includes(nLabel) || highlightedNodeIds.includes(nName)))
              : false;

            // Real-time edited node check
            const isRealtimeChanged = realtimeChangedSet.has(nid) || realtimeChangedSet.has(nLabel) || realtimeChangedSet.has(nName);

            // Compute radius based on importance
            const isBig = nid === "root" || nid === "src" || nid === "FastMCPServer" || nid === "ASGI" || nid === "asgi.py" || nid === "worker.py";
            const baseRadius = isBig ? 11 : 6.5;
            const radius = (isSelected || isHighlighted || isRealtimeChanged) ? baseRadius + 2.5 : baseRadius;

            ctx.save();
            if (isDimmed && !isHighlighted && !isRealtimeChanged) {
              ctx.globalAlpha = 0.22;
            }

            // 1. Real-time Changed / Blast-Radius / Selected halo pulse
            if (isHighlighted) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 5 / globalScale, 0, 2 * Math.PI, false);
              ctx.fillStyle = "rgba(207, 45, 86, 0.25)";
              ctx.fill();
              ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
              ctx.lineWidth = 1.5 / globalScale;
              ctx.stroke();
            } else if (isRealtimeChanged) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI, false);
              ctx.fillStyle = "rgba(229, 192, 123, 0.18)";
              ctx.fill();
              ctx.strokeStyle = "rgba(229, 192, 123, 0.85)";
              ctx.lineWidth = 1.8 / globalScale;
              ctx.stroke();
            } else if (isSelected) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI, false);
              ctx.strokeStyle = "#f54e00";
              ctx.lineWidth = 1.8 / globalScale;
              ctx.stroke();
            }

            // 2. Node Core Disc
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = isHighlighted ? "#cf2d56" : isRealtimeChanged ? "#d19a66" : baseColor;
            ctx.fill();

            ctx.strokeStyle = isHighlighted ? "#fce7ee" : isRealtimeChanged ? "#ffe2a3" : "#000000";
            ctx.lineWidth = (isHighlighted || isRealtimeChanged) ? 1.8 / globalScale : 1.2 / globalScale;
            ctx.stroke();

            // 3. Label text with clean backdrop pill
            const label = String(node.label || node.id);
            const isImportant = isBig || isSelected || isHighlighted || isRealtimeChanged;

            if (!isImportant && globalScale < 0.65) {
              ctx.restore();
              return;
            }

            const fontSize = Math.min(Math.max(6.5 / globalScale, 2.5), 8.5);
            ctx.font = `${isImportant ? "600 " : "400 "}${fontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            if (isBig && radius * globalScale > 16) {
              ctx.fillStyle = "#ffffff";
              ctx.fillText(label, node.x, node.y);
            } else {
              const displayLabel = (!isImportant && label.length > 13) ? `${label.slice(0, 11)}…` : label;
              const textWidth = ctx.measureText(displayLabel).width;
              const pillHeight = fontSize + 3.5 / globalScale;
              const pillY = node.y + radius + 2 / globalScale;
              const pillWidth = textWidth + 6 / globalScale;

              ctx.fillStyle = "rgba(8, 8, 8, 0.94)";
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
                ? "rgba(239, 68, 68, 0.6)"
                : isRealtimeChanged
                ? "rgba(229, 192, 123, 0.7)"
                : isSelected
                ? "rgba(245, 78, 0, 0.7)"
                : "rgba(255, 255, 255, 0.12)";
              ctx.lineWidth = 0.7 / globalScale;
              ctx.stroke();

              ctx.fillStyle = isHighlighted ? "#fca5a5" : isRealtimeChanged ? "#e5c07b" : isSelected ? "#f54e00" : "#d4d4d8";
              ctx.fillText(displayLabel, node.x, pillY + pillHeight / 2);
            }

            ctx.restore();
          }}
        />

        {/* FLOATING ZOOM CONTROLS HUD */}
        <div className="absolute right-3 bottom-3 flex flex-col items-center bg-[#0d0d0d]/90 backdrop-blur-sm border border-[#262626] rounded-lg p-1 shadow-xl z-20 gap-1 select-none">
          <button
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-[#1a1a1a] text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-[#1a1a1a] text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={12} />
          </button>
          <div className="w-3 h-px bg-[#262626] my-0.5" />
          <button
            onClick={handleFit}
            className="p-1 rounded hover:bg-[#1a1a1a] text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Center & Fit All Nodes"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. INTEGRATED BOTTOM TOOLBAR (ZERO COLLISION / ZERO OVERLAP) */}
      {/* ======================================================== */}
      <div className="h-10 px-2 sm:px-3 border-t border-[#1e1e1e] bg-[#080808] flex items-center justify-between shrink-0 z-20 gap-1.5">
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          {viewMode === "graph" ? (
            /* Layout Mode Pill: Tree vs Cluster (preserved perfectly) */
            <div className="flex items-center bg-[#141414] border border-[#262626] rounded-lg p-0.5 shadow-sm shrink-0">
              <button
                onClick={() => handleSwitchLayout("tree")}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  layoutMode === "tree"
                    ? "bg-[#242424] text-white border border-[#383838]"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Tree Graph Layout (Structured Hierarchical Top-Down)"
              >
                <GitFork size={11} className="text-neutral-300" />
                <span className={dimensions.width < 340 ? "hidden" : "inline"}>Tree</span>
              </button>
              <button
                onClick={() => handleSwitchLayout("cluster")}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  layoutMode === "cluster"
                    ? "bg-[#242424] text-white border border-[#383838]"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Compact Cluster Layout (Force Bounded Physics)"
              >
                <Network size={11} className="text-neutral-300" />
                <span className={dimensions.width < 340 ? "hidden" : "inline"}>Cluster</span>
              </button>
            </div>
          ) : (
            /* Flowchart layout indicator with fast Return to Full Graph */
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  userPrefersGraphRef.current = true;
                  setViewMode("graph");
                  setTimeout(() => fgRef.current?.zoomToFit(380, 36), 80);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#141414] hover:bg-[#1f1f1f] border border-[#282828] hover:border-[#383838] text-[11px] font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="Return to full codebase graph"
              >
                <Network size={11} className="text-[#f54e00]" />
                <span>Full Graph</span>
              </button>
              <span className="text-[10px] font-mono text-neutral-500 hidden sm:inline">
                {activeFileName ? `Flowchart: ${activeFileName}` : "File DAG"}
              </span>
            </div>
          )}

          {/* Fit to View Button */}
          <button
            onClick={handleFit}
            className="flex items-center gap-1 px-1.5 py-1 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] text-[11px] font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Center and fit all nodes inside view"
          >
            <Maximize2 size={11} className="text-neutral-400" />
            <span className={dimensions.width < 360 ? "hidden" : "inline"}>Fit</span>
          </button>

          {/* Filter Node Types Pill */}
          <div ref={filterDropdownRef} className="relative shrink-0">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1 px-1.5 py-1 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] text-[11px] font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Filter node layers"
            >
              <Filter size={11} className="text-neutral-400" />
              <span className={dimensions.width < 380 ? "hidden" : "inline"}>Filter</span>
            </button>

            {isFilterOpen && (
              <div className="absolute bottom-9 left-0 w-44 bg-[#111111] border border-[#282828] rounded-xl shadow-2xl p-2 z-40 flex flex-col gap-1">
                <div className="text-[11px] uppercase font-sans text-neutral-400 font-semibold px-2 py-1 border-b border-[#222222]">
                  Filter Code Types
                </div>
                {Object.keys(activeTypes).map((typeKey) => {
                  const isActive = activeTypes[typeKey];
                  const color = COLOR_MAP[typeKey] || "#d4d4d8";
                  return (
                    <button
                      key={typeKey}
                      onClick={() =>
                        setActiveTypes((prev) => ({
                          ...prev,
                          [typeKey]: !prev[typeKey],
                        }))
                      }
                      className="flex items-center justify-between px-2 py-1 rounded-md text-xs font-mono text-neutral-200 hover:bg-[#1c1c1c] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span>{typeKey}</span>
                      </div>
                      {isActive && <Check size={12} className="text-[#f54e00]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: RUN BUTTON (ALWAYS FULLY VISIBLE, NEVER CUT OFF, SHRINK-0) */}
        <div className="flex items-center gap-1.5 shrink-0 z-10 pl-1">
          <button
            id="graph-run-btn"
            onClick={() => {
              const target = currentGraphData.nodes.find((n) => n.id === selectedNodeId) || null;
              onRunAction?.(target);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-transparent hover:bg-[#f54e00]/10 border border-[#f54e00]/80 hover:border-[#f54e00] text-[#f54e00] hover:text-[#ff6a26] text-xs font-mono font-medium transition-colors cursor-pointer shadow-xs shrink-0 whitespace-nowrap min-w-[64px]"
            title="Run analysis on selected function with AI Agent"
          >
            <Play size={11} className="text-[#f54e00] fill-[#f54e00] shrink-0" />
            <span>Run</span>
          </button>
        </div>
      </div>
    </div>
  );
}
