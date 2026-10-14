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

  // Center camera on selected or real-time changed node smoothly
  useEffect(() => {
    if (!fgRef.current) return;
    const targetId = selectedNodeId || (realtimeChangedNodeIds && Array.isArray(realtimeChangedNodeIds) ? realtimeChangedNodeIds[0] : null);
    if (targetId) {
      const target = graphData.nodes.find((n) => n.id === targetId || n.label === targetId);
      if (target && target.x !== undefined && target.y !== undefined) {
        fgRef.current.centerAt(target.x, target.y, 400);
      }
    }
  }, [selectedNodeId, realtimeChangedNodeIds, graphData.nodes]);

  // Auto-center and fit whenever nodes, edges, or updates change in real-time
  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;
    try {
      if (layoutMode === "cluster") {
        fgRef.current.d3Force("charge")?.strength?.(-110)?.distanceMax?.(260)?.distanceMin?.(25);
        fgRef.current.d3Force("link")?.distance?.(55);
      }
    } catch {
      // Safe fallback
    }
    const timer = setTimeout(() => {
      fgRef.current?.zoomToFit(380, 32);
    }, 120);
    return () => clearTimeout(timer);
  }, [
    graphData.nodes.length,
    graphData.links.length,
    highlightedNodeIds,
    realtimeChangedNodeIds,
    dimensions.width,
    dimensions.height,
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

  const handleFit = () => {
    if (!fgRef.current) return;
    fgRef.current.zoomToFit(380, 32);
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
        fgRef.current.zoomToFit(380, 32);
      }
    }, 100);
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
        <div className="flex items-center gap-2 min-w-0">
          {hasHighlighted ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-950/90 border border-red-500/60 text-[11px] font-mono text-red-200 animate-pulse truncate shadow-sm shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_#ef4444]" />
              <span className="truncate max-w-[110px] font-medium">Blast Radius</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 min-w-0 truncate">
              <Network size={13} className="text-[#f54e00] shrink-0" />
              <span className="text-neutral-100 font-medium truncate">Topology Canvas</span>
            </div>
          )}
        </div>

        {/* NODES SEARCH DROPDOWN */}
        <div ref={searchDropdownRef} className="relative shrink-0">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex items-center gap-1.5 text-xs font-mono text-neutral-300 hover:text-white cursor-pointer px-2.5 py-1 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] transition-colors"
          >
            <span className="text-[11px] text-neutral-400 uppercase hidden sm:inline">Node:</span>
            <span className="max-w-[70px] sm:max-w-[100px] truncate text-neutral-100 font-semibold">{selectedNodeId || "Search"}</span>
            <ChevronDown size={11} className="text-neutral-400 shrink-0" />
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
                  placeholder="Filter nodes..."
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
      {/* 2. HIERARCHY FLOWCHART BREADCRUMBS BAR (HEADING - TOPIC - SUBTOPICS) */}
      {/* ======================================================== */}
      <div className="h-8 px-3 border-b border-[#181818] bg-[#050505] flex items-center justify-between text-[11px] font-mono text-neutral-400 select-none overflow-x-auto gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-none py-1">
          <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold shrink-0">Hierarchy:</span>
          
          {/* HEADING (Module) */}
          <span
            onClick={() => {
              const rootNode = graphData.nodes.find((n) => n.id === "src" || n.id === "root");
              if (rootNode) onSelectNode(rootNode);
            }}
            className="text-neutral-400 hover:text-white cursor-pointer px-1.5 py-0.5 rounded bg-[#101010] border border-[#222222] shrink-0 transition-colors"
            title="Module Root (Heading)"
          >
            src/
          </span>
          <ChevronRight size={10} className="text-neutral-600 shrink-0" />

          {/* TOPIC (File) */}
          <span
            onClick={() => {
              const fileNode = graphData.nodes.find((n) => n.id === activeFileName);
              if (fileNode) onSelectNode(fileNode);
            }}
            className={`px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 cursor-pointer transition-colors ${
              realtimeChangedSet.size > 0
                ? "text-[#e5c07b] bg-[#e5c07b]/10 border border-[#e5c07b]/30"
                : "text-neutral-300 bg-[#141414] border border-[#242424] hover:text-white"
            }`}
            title="Source File (Topic)"
          >
            <FileCode size={11} className={realtimeChangedSet.size > 0 ? "text-[#e5c07b]" : "text-neutral-400"} />
            <span>{activeFileName || "auth.ts"}</span>
          </span>
          <ChevronRight size={10} className="text-neutral-600 shrink-0" />

          {/* SUBTOPICS (Function / Call Target) */}
          <span
            onClick={() => {
              const activeNode = graphData.nodes.find((n) => n.id === (selectedNodeId || "validateToken"));
              if (activeNode) onSelectNode(activeNode);
            }}
            className="px-1.5 py-0.5 rounded text-[#f54e00] bg-[#f54e00]/10 border border-[#f54e00]/30 shrink-0 font-medium cursor-pointer truncate max-w-[120px]"
            title="Active Function (Subtopic)"
          >
            {selectedNodeId || "validateToken"}
          </span>

          {/* REAL-TIME EDITED PULSE BADGE */}
          {realtimeChangedSet.size > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-[#e5c07b] bg-[#e5c07b]/15 border border-[#e5c07b]/40 shrink-0 animate-pulse font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e5c07b]" />
              <span>Real-time Edit</span>
            </span>
          )}

          {/* BLAST RADIUS HUD */}
          {hasHighlighted && (
            <>
              <ChevronRight size={10} className="text-neutral-600 shrink-0" />
              <span className="px-1.5 py-0.5 rounded text-red-300 bg-red-950/70 border border-red-500/40 shrink-0 animate-pulse font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>{highlightedCount} Callers</span>
              </span>
            </>
          )}
        </div>

        {/* FLOWCHART OVERVIEW TOGGLE BUTTON */}
        <button
          id="hierarchy-toggle-btn"
          onClick={() => setIsHierarchyOpen(!isHierarchyOpen)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-[6px] border text-[11px] font-mono transition-colors cursor-pointer shrink-0 ${
            isHierarchyOpen
              ? "bg-[#1f1f1f] border-[#f54e00] text-white"
              : "bg-transparent border-[#262626] hover:border-[#383838] text-neutral-400 hover:text-white"
          }`}
          title="Toggle Flowchart & AST Hierarchy Overview"
        >
          <Workflow size={11} className={isHierarchyOpen ? "text-[#f54e00]" : "text-neutral-400"} />
          <span className="hidden sm:inline">Flowchart Map</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 3. INTERACTIVE FLOWCHART & HIERARCHY DRAWER OVERLAY */}
      {/* ======================================================== */}
      {isHierarchyOpen && (
        <div
          ref={hierarchyDrawerRef}
          className="absolute top-20 left-3 right-3 sm:right-auto sm:w-80 bg-[#0a0a0a]/95 backdrop-blur-md border border-[#262626] rounded-xl shadow-2xl z-30 p-3 font-mono text-[11px] flex flex-col gap-2.5 max-h-[75%] overflow-y-auto animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#202020]">
            <div className="flex items-center gap-1.5 text-neutral-200 font-semibold">
              <Workflow size={13} className="text-[#f54e00]" />
              <span>AST Flowchart & Hierarchy</span>
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
              1. Heading (Modules)
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
              2. Topic (Files)
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
              3. Subtopics (Functions & Callers)
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
                      <span className="text-[11px] text-red-400 font-semibold">BLAST</span>
                    ) : isRealtime ? (
                      <span className="text-[11px] text-[#e5c07b] font-semibold">EDIT</span>
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
          graphData={graphData}
          backgroundColor="#000000"
          nodeRelSize={5.5}
          dagMode={layoutMode === "tree" ? "td" : undefined}
          dagLevelDistance={dimensions.height < 500 ? 55 : 72}
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
            fgRef.current?.zoomToFit(250, 24);
          }}
          // Link styling: clean monochrome neutral connections
          linkColor={(link: any) => {
            if (!connectedNeighbors) return "#222222";
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (connectedNeighbors.has(s) && connectedNeighbors.has(t)) {
              return "#f54e00"; // highlighted link
            }
            return "#141414"; // dimmed
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
              // Warm gold / amber pulsing halo for real-time code modifications
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
            const fontSize = Math.max(8.5 / globalScale, 2.6);
            ctx.font = `${(isBig || isHighlighted || isRealtimeChanged) ? "600 " : "400 "}${fontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            if (isBig && radius * globalScale > 16) {
              ctx.fillStyle = "#ffffff";
              ctx.fillText(label, node.x, node.y);
            } else {
              const textWidth = ctx.measureText(label).width;
              const pillHeight = fontSize + 4 / globalScale;
              const pillY = node.y + radius + 2.5 / globalScale;
              const pillWidth = textWidth + 8 / globalScale;

              // Crisp backdrop pill in dark black
              ctx.fillStyle = "rgba(10, 10, 10, 0.92)";
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
                : isRealtimeChanged
                ? "rgba(229, 192, 123, 0.7)"
                : isSelected
                ? "rgba(245, 78, 0, 0.5)"
                : "rgba(255, 255, 255, 0.1)";
              ctx.lineWidth = 0.7 / globalScale;
              ctx.stroke();

              ctx.fillStyle = isHighlighted ? "#fca5a5" : isRealtimeChanged ? "#e5c07b" : isSelected ? "#f54e00" : "#d4d4d8";
              ctx.fillText(label, node.x, pillY + pillHeight / 2);
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
      <div className="h-10 px-2 sm:px-3 border-t border-[#1e1e1e] bg-[#080808] flex items-center justify-between shrink-0 z-20 gap-1.5 overflow-hidden">
        <div className="flex items-center gap-1 shrink-0">
          {/* Layout Mode Pill: Tree vs Cluster */}
          <div className="flex items-center bg-[#141414] border border-[#262626] rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => handleSwitchLayout("tree")}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                layoutMode === "tree"
                  ? "bg-[#242424] text-white border border-[#383838]"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Tree Graph Layout (Structured Hierarchical Top-Down)"
            >
              <GitFork size={11} className="text-neutral-300" />
              <span className={dimensions.width < 320 ? "hidden" : "inline"}>Tree</span>
            </button>
            <button
              onClick={() => handleSwitchLayout("cluster")}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                layoutMode === "cluster"
                  ? "bg-[#242424] text-white border border-[#383838]"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Compact Cluster Layout (Force Bounded Physics)"
            >
              <Network size={11} className="text-neutral-300" />
              <span className={dimensions.width < 320 ? "hidden" : "inline"}>Cluster</span>
            </button>
          </div>

          {/* Fit to View Button */}
          <button
            onClick={handleFit}
            className="flex items-center gap-1 px-2 py-1 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] text-[11px] font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Center and fit all nodes inside view"
          >
            <Maximize2 size={11} className="text-neutral-400" />
            <span className={dimensions.width < 300 ? "hidden" : "inline"}>Fit</span>
          </button>

          {/* Filter Node Types Pill */}
          <div ref={filterDropdownRef} className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1 px-2 py-1 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] text-[11px] font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Filter node layers"
            >
              <Filter size={11} className="text-neutral-400" />
              <span className={dimensions.width < 340 ? "hidden" : "inline"}>Filter</span>
            </button>

            {isFilterOpen && (
              <div className="absolute bottom-9 left-0 w-44 bg-[#111111] border border-[#282828] rounded-xl shadow-2xl p-2 z-40 flex flex-col gap-1">
                <div className="text-[11px] uppercase font-sans text-neutral-400 font-semibold px-2 py-1 border-b border-[#222222]">
                  Toggle Visible Layers
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

        {/* RIGHT SIDE: SHORTCUT HINTS & RUN BUTTON */}
        <div className="flex items-center gap-2 shrink-0">
          {dimensions.width >= 420 && (
            <div className="flex items-center gap-1.5 text-[11px] font-sans text-neutral-500 select-none">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-transparent hover:bg-[#f54e00]/10 border border-[#f54e00]/80 hover:border-[#f54e00] text-[#f54e00] hover:text-[#ff6a26] text-xs font-mono font-medium transition-colors cursor-pointer shadow-xs shrink-0"
            title="Refactor selected node with AI Agent"
          >
            <Play size={11} className="text-[#f54e00] fill-[#f54e00]" />
            <span>Run</span>
          </button>
        </div>
      </div>
    </div>
  );
}
