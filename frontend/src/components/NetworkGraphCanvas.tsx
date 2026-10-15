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

// Vertical multi-tier topological hierarchy ranking (0 to 7) for top-to-bottom vertical spread
function getNodeVerticalTier(node: NodeItem): { tier: number; order: number } {
  const t = node.type || "";
  const id = String(node.id || "");

  // Tier 0: Workspace Module Root (Top of canvas)
  if (t === "Module" || id === "root" || id === "src") return { tier: 0, order: id === "root" ? 0 : 1 };

  // Tier 1: Workspace Tests, Build Scripts & Project Config
  if (id === "tests" || id.endsWith(".sh") || id.endsWith(".json") || id.endsWith(".md") || id.endsWith(".txt") || id.endsWith(".toml")) {
    return { tier: 1, order: id === "tests" ? 0 : 1 };
  }

  // Tier 2: Domain Source Code Files (Python & TypeScript source files)
  if (t === "File" || id.endsWith(".py") || id.endsWith(".ts")) {
    const fileOrder = id === "asgi.py" ? 0 : id === "worker.py" ? 1 : id === "auth.ts" ? 2 : id === "billing.ts" ? 3 : id === "finance.ts" ? 4 : 5;
    return { tier: 2, order: fileOrder };
  }

  // Tier 3: Core Service Classes & Daemon Objects
  if (t === "Class" || id === "ASGI" || id === "FastMCPServer" || id === "background_task") {
    return { tier: 3, order: id === "ASGI" ? 0 : id === "FastMCPServer" ? 1 : 2 };
  }

  // Tier 4: Primary Daemon Starters, Public Routers & Inbound Handlers
  if (id === "process_websocket" || id === "start_application" || id === "setup_server" || id === "auditAccount" || id === "validateToken") {
    return { tier: 4, order: id === "process_websocket" ? 0 : id === "start_application" ? 1 : 2 };
  }

  // Tier 5: Core Business Logic, Frame Buffering & Verification
  if (id === "acquire_ws_buffer" || id === "calculateTax" || id === "processInvoice" || id === "verifyToken" || id === "decodePayload" || id === "ws_receive" || id === "onmessage") {
    return { tier: 5, order: 0 };
  }

  // Tier 6: Connection Hooks, Worker Loops & Lifecycle Teardowns
  if (id === "onopen" || id === "onclose" || id === "run_worker" || id === "ws_send" || id === "process_request" || id === "shutdown") {
    return { tier: 6, order: 0 };
  }

  // Tier 7: Leaf Endpoints, Utilities & Return States (Bottom of canvas)
  return { tier: 7, order: 0 };
}

function getNodeLevel(node: NodeItem): number {
  return getNodeVerticalTier(node).tier;
}

// Computes strictly sequential vertical levels for Tree mode (strictly one above another)
function computeSequentialTreeLevels(validNodes: NodeItem[]): Map<string, number> {
  const map = new Map<string, number>();

  const priorityOrder = [
    "root", "src", "tests", "build.sh", "package.json", "README.md", "vendor.txt", "pyproject.toml",
    // asgi.py and its pipeline
    "asgi.py", "ASGI", "start_application", "process_websocket", "onopen", "acquire_ws_buffer", "ws_receive", "ws_send", "onclose", "fetch", "websocket",
    // worker.py and its pipeline
    "worker.py", "FastMCPServer", "setup_server", "run_worker", "calculate_bmi", "add", "echo_prompt", "get_greeting", "on_fetch",
    // auth.ts and its functions
    "auth.ts", "validateToken", "verifyToken", "decodePayload",
    // billing.ts and its functions
    "billing.ts", "Invoice", "processInvoice", "calculateTax", "persistInvoice",
    // finance.ts and its functions
    "finance.ts", "auditAccount",
    // logger & exceptions
    "logger.py", "exceptions.py", "uvicorn.py"
  ];

  let currentLevel = 0;
  for (const id of priorityOrder) {
    if (validNodes.some((n) => n.id === id) && !map.has(id)) {
      map.set(id, currentLevel++);
    }
  }

  // Any remaining nodes get consecutive levels
  for (const n of validNodes) {
    if (!map.has(n.id)) {
      map.set(n.id, currentLevel++);
    }
  }

  return map;
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

  // Filter nodes & links based on activeTypes, collapsed state, and Tree vs Cluster Layout
  const graphData = useMemo(() => {
    const validNodes = nodes.filter((n) => {
      const typeKey = n.type || "Function";
      return activeTypes[typeKey] !== false;
    });

    const nodeTierMap = new Map<string, number>();
    const treeLevelMap = computeSequentialTreeLevels(validNodes);
    const tierGroups: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };

    const enrichedNodes = validNodes.map((n) => {
      const { tier, order } = getNodeVerticalTier(n);
      nodeTierMap.set(n.id, tier);
      return { ...n, tier, order };
    });

    for (const n of enrichedNodes) {
      if (!tierGroups[n.tier]) tierGroups[n.tier] = [];
      tierGroups[n.tier].push(n);
    }

    // Sort nodes within each tier for consistent positioning in cluster mode
    Object.keys(tierGroups).forEach((tierStr) => {
      const tier = Number(tierStr);
      tierGroups[tier].sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
    });

    const totalTreeNodes = validNodes.length;

    // Compute vertical & horizontal coordinates: Tree mode is strictly one above another (one above, one below)
    const finalNodes = enrichedNodes.map((n) => {
      const treeLvl = treeLevelMap.get(n.id) ?? 0;
      let targetX = 0;
      let targetY = 0;

      if (layoutMode === "tree") {
        // Tree Mode: strictly one above another vertically (one above, one below)
        const totalHeight = Math.max(totalTreeNodes * 25, 420);
        targetY = -totalHeight / 2 + treeLvl * 25;
        // Clean alternating subtle step: one above, one below, with micro lateral offset
        targetX = (treeLvl % 2 === 0 ? -10 : 10);
      } else {
        // Cluster Mode: organic vertical cluster (fine in orientation, kept tightly inside canvas)
        const group = tierGroups[n.tier] || [n];
        const count = group.length;
        const idx = group.findIndex((m) => m.id === n.id);

        const baseY = -210 + n.tier * 60;
        const staggerY = count > 1 ? (idx % 2 === 0 ? -8 : 8) : 0;
        targetY = baseY + staggerY;

        if (count === 1) {
          targetX = 0;
        } else {
          // Bounded horizontal spread so nothing ever clips out of canvas
          const spreadWidth = Math.min(count * 22, 100);
          const startX = -spreadWidth / 2;
          const stepX = spreadWidth / (count - 1);
          targetX = startX + idx * stepX;
        }
      }

      return {
        ...n,
        // In tree mode, level is strictly unique sequential so nodes stack one above another
        level: layoutMode === "tree" ? treeLvl : n.tier,
        targetY,
        targetX,
        x: n.x ?? targetX,
        y: n.y ?? targetY,
      };
    });

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

    // Strictly orient links top-down to guarantee an acyclic vertical DAG (0 cycles, 0 errors)
    const links = rawLinks
      .map((e) => {
        const sLvl = layoutMode === "tree" ? (treeLevelMap.get(e.source) ?? 0) : (nodeTierMap.get(e.source) ?? 2);
        const tLvl = layoutMode === "tree" ? (treeLevelMap.get(e.target) ?? 0) : (nodeTierMap.get(e.target) ?? 2);
        if (sLvl > tLvl) {
          return { source: e.target, target: e.source, relationship: e.relationship };
        }
        return e;
      })
      .filter((e) => {
        const sLvl = layoutMode === "tree" ? (treeLevelMap.get(e.source) ?? 0) : (nodeTierMap.get(e.source) ?? 2);
        const tLvl = layoutMode === "tree" ? (treeLevelMap.get(e.target) ?? 0) : (nodeTierMap.get(e.target) ?? 2);
        if (sLvl === tLvl && e.source > e.target) {
          return false;
        }
        return true;
      });

    return { nodes: finalNodes, links };
  }, [nodes, edges, activeTypes, collapsedNodes, layoutMode]);

  // Dedicated File Flowchart Data: Vertical Linked Concise & Precise Pipeline (matching system flowchart)
  const flowchartData = useMemo(() => {
    if (!activeFileName) return null;

    interface FlowStep {
      id: string;
      label: string;
      desc: string;
      category?: "entry" | "core" | "logic" | "calc" | "output" | "side";
      accentColor?: string;
      isSPI?: boolean;
      isSideBranch?: boolean;
    }

    let pipelineSteps: FlowStep[] = [];
    let sideSteps: { step: FlowStep; connectedTo: string }[] = [];

    if (activeFileName === "finance.ts") {
      pipelineSteps = [
        { id: "file:finance.ts", label: "finance.ts", desc: "Financial Compliance SPI", category: "entry", isSPI: true, accentColor: "#c084fc" },
        { id: "auditAccount", label: "auditAccount()", desc: "Validates Authorization & Token", category: "core", accentColor: "#38bdf8" },
        { id: "validateToken", label: "validateToken()", desc: "Inbound JWT Security Check", category: "logic", accentColor: "#a855f7" },
        { id: "calculateTax", label: "calculateTax()", desc: "Applies 8% Compliant Tax Rate", category: "calc", accentColor: "#10b981" },
        { id: "auditResult", label: "Status: COMPLIANT", desc: "Audited Ledger Output Record", category: "output", accentColor: "#34d399" },
      ];
    } else if (activeFileName === "asgi.py") {
      pipelineSteps = [
        { id: "file:asgi.py", label: "asgi.py", desc: "FastAPI ASGI Daemon Entry", category: "entry", isSPI: true, accentColor: "#c084fc" },
        { id: "ASGI", label: "ASGI.__init__()", desc: "Worker Lifecycle Initialization", category: "core", accentColor: "#38bdf8" },
        { id: "start_application", label: "start_application()", desc: "Starts FastMCP Worker Daemon", category: "logic", accentColor: "#2dd4bf" },
        { id: "process_websocket", label: "process_websocket()", desc: "Async WebSocket Frame Router", category: "core", accentColor: "#38bdf8" },
        { id: "onopen", label: "onopen()", desc: "Handshake Connection Hook", category: "side", accentColor: "#fb923c" },
        { id: "acquire_ws_buffer", label: "acquire_ws_buffer()", desc: "Buffers Client Connection Frames", category: "calc", accentColor: "#10b981" },
        { id: "onclose", label: "onclose()", desc: "Graceful Connection Teardown", category: "output", accentColor: "#94a3b8" },
      ];
      sideSteps = [];
    } else if (activeFileName === "auth.ts") {
      pipelineSteps = [
        { id: "file:auth.ts", label: "auth.ts", desc: "Security Gateway SPI", category: "entry", isSPI: true, accentColor: "#c084fc" },
        { id: "validateToken", label: "validateToken()", desc: "Validates Bearer Credentials", category: "core", accentColor: "#38bdf8" },
        { id: "verifyToken", label: "verifyToken()", desc: "Clock Skew <= 60s & Expiry Check", category: "logic", accentColor: "#10b981" },
        { id: "decodePayload", label: "decodePayload()", desc: "Decodes JWT Claims & Subject", category: "calc", accentColor: "#2dd4bf" },
        { id: "authState", label: "Session: AUTHORIZED", desc: "Security Handshake Verified", category: "output", accentColor: "#34d399" },
      ];
    } else if (activeFileName === "billing.ts") {
      pipelineSteps = [
        { id: "file:billing.ts", label: "billing.ts", desc: "Billing & Invoicing Engine", category: "entry", isSPI: true, accentColor: "#c084fc" },
        { id: "Invoice", label: "Invoice Model", desc: "Typed Schema Definition", category: "side", accentColor: "#fb923c" },
        { id: "processInvoice", label: "processInvoice()", desc: "Parses Items & Tax Liability", category: "core", accentColor: "#38bdf8" },
        { id: "calculateTax", label: "calculateTax()", desc: "External Regional Tax Formula", category: "calc", accentColor: "#a855f7" },
        { id: "persistInvoice", label: "persistInvoice()", desc: "Commits Invoice to Database", category: "logic", accentColor: "#10b981" },
        { id: "billingState", label: "State: PROCESSED", desc: "Emits Transaction Dispatched", category: "output", accentColor: "#34d399" },
      ];
      sideSteps = [];
    } else if (activeFileName === "worker.py") {
      pipelineSteps = [
        { id: "file:worker.py", label: "worker.py", desc: "FastMCP Worker Service SPI", category: "entry", isSPI: true, accentColor: "#c084fc" },
        { id: "FastMCPServer", label: "FastMCPServer()", desc: "Protocol Server Instance", category: "core", accentColor: "#38bdf8" },
        { id: "setup_server", label: "setup_server()", desc: "Registers Tools & Prompts", category: "logic", accentColor: "#2dd4bf" },
        { id: "run_worker", label: "run_worker()", desc: "Executes Long-Running Loop", category: "calc", accentColor: "#10b981" },
        { id: "workerState", label: "Status: RUNNING", desc: "Listening for MCP Clients", category: "output", accentColor: "#34d399" },
      ];
    } else {
      // Dynamic fallback for any other file
      const rawFns: string[] = [];
      if (activeFileCode) {
        const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
        let m;
        while ((m = fnRegex.exec(activeFileCode)) !== null) rawFns.push(m[1]);
      }
      if (rawFns.length === 0) {
        rawFns.push(activeFileName.replace(/\.[^/.]+$/, ""));
      }

      pipelineSteps = [
        { id: `file:${activeFileName}`, label: activeFileName, desc: "Source Entry Point", category: "entry", isSPI: true, accentColor: "#c084fc" },
        ...rawFns.map((fn, i) => ({
          id: fn,
          label: `${fn}()`,
          desc: i === 0 ? "Entry Handler" : i === rawFns.length - 1 ? "Output Return" : "Logic Step",
          category: (i === 0 ? "core" : i === rawFns.length - 1 ? "output" : "logic") as any,
          accentColor: i % 2 === 0 ? "#38bdf8" : "#10b981"
        }))
      ];
    }

    // Build Nodes with sequential vertical levels (Level 0, 1, 2, 3...)
    const fNodes: any[] = [];
    const fLinks: any[] = [];

    pipelineSteps.forEach((step, idx) => {
      const isEdited = realtimeChangedSet.has(step.id) || realtimeChangedSet.has(activeFileName) || (idx === 1 && Boolean(isModified));
      const isHighlighted = highlightedNodeIds
        ? (highlightedNodeIds instanceof Set ? highlightedNodeIds.has(step.id) : highlightedNodeIds.includes(step.id))
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
        id: step.id,
        label: step.label,
        desc: step.desc,
        level: idx, // Strictly sequential vertical level!
        type: step.category === "entry" ? "EntrySPI" : step.category === "output" ? "Result" : "Function",
        isSPI: step.isSPI,
        isResult: step.category === "output",
        accentColor: step.accentColor,
        isEdited,
        isHighlighted,
        changeSnippet,
      });

      // Sequential Downward Link (Step i -> Step i+1)
      if (idx > 0) {
        const prevStep = pipelineSteps[idx - 1];
        fLinks.push({
          source: prevStep.id,
          target: step.id,
          relationship: "FLOWS_TO"
        });
      }
    });

    // Add any side branch nodes (e.g. notifications / schema on the side)
    sideSteps.forEach(({ step, connectedTo }) => {
      const parentNode = fNodes.find(n => n.id === connectedTo);
      const parentLevel = parentNode ? parentNode.level : 2;
      fNodes.push({
        id: step.id,
        label: step.label,
        desc: step.desc,
        level: parentLevel, // Sits on same level as connected parent
        type: "SideBranch",
        isSideBranch: true,
        accentColor: step.accentColor,
        isEdited: realtimeChangedSet.has(step.id),
      });

      fLinks.push({
        source: connectedTo,
        target: step.id,
        relationship: "NOTIFIES"
      });
    });

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

  // Centroid-based camera centering and bounded zoom fit
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

      // Real extent of content including node card bounds and label projection
      const contentWidth = Math.max(maxX - minX + (viewMode === "flowchart" ? 130 : 90), 80);
      const contentHeight = Math.max(maxY - minY + (viewMode === "flowchart" ? 60 : 70), 80);

      // Generous padding ensures nothing ever clips or overflows outside canvas borders
      const padding = 38;
      const availWidth = Math.max(dimensions.width - padding * 2, 80);
      const availHeight = Math.max(dimensions.height - padding * 2, 80);

      let fitZoom = Math.min(availWidth / contentWidth, availHeight / contentHeight);

      if (viewMode === "flowchart") {
        // Lock flowchart zoom to Screenshot 1 size (~1.65) so it never diminishes
        const targetFlowZoom = Math.min(Math.max((dimensions.width * 0.62) / 120, 1.55), 1.85);
        fitZoom = targetFlowZoom;
      } else {
        // Full graph fills max canvas space vertically & horizontally without shrinking
        fitZoom = Math.min(Math.max(fitZoom, 0.65), 1.35);
      }

      fgRef.current.centerAt(midX, midY, 260);
      fgRef.current.zoom(fitZoom, 260);
    } else {
      fgRef.current.zoomToFit(260, 32);
    }
  }, [currentGraphData.nodes, viewMode, dimensions.width, dimensions.height]);

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
      if (viewMode === "graph") {
        // Dynamic oscillation & boundary containment force (oscillates dynamically, no still, nothing out of canvas)
        let oscillationAngle = 0;
        const dynamicPhysicsForce = () => {
          let fNodes: any[] = [];
          const force = (alpha: number) => {
            oscillationAngle += 0.035;
            const boundX = Math.max(dimensions.width / 2 - 45, 60);
            const boundY = Math.max(dimensions.height / 2 - 40, 80);

            for (let i = 0; i < fNodes.length; i++) {
              const node = fNodes[i];
              // Target coordinate attraction
              if (node.targetY !== undefined) {
                node.vy += (node.targetY - node.y) * 0.28 * alpha;
              }
              if (node.targetX !== undefined) {
                node.vx += (node.targetX - node.x) * 0.32 * alpha;
              }

              // Gentle organic dynamic oscillation (never freezes still)
              const phase = i * 0.5 + oscillationAngle;
              node.vx += Math.sin(phase) * 0.16;
              node.vy += Math.cos(phase * 0.7) * 0.12;

              // Absolute boundary containment: nothing out of canvas
              if (node.x > boundX) {
                node.x = boundX;
                node.vx = -Math.abs(node.vx) * 0.5;
              } else if (node.x < -boundX) {
                node.x = -boundX;
                node.vx = Math.abs(node.vx) * 0.5;
              }
              if (node.y > boundY) {
                node.y = boundY;
                node.vy = -Math.abs(node.vy) * 0.5;
              } else if (node.y < -boundY) {
                node.y = -boundY;
                node.vy = Math.abs(node.vy) * 0.5;
              }
            }
          };
          force.initialize = (_nodes: any[]) => {
            fNodes = _nodes;
          };
          return force;
        };

        fgRef.current.d3Force("dynamicPhysics", dynamicPhysicsForce());
        if (layoutMode === "cluster") {
          fgRef.current.d3Force("charge")?.strength?.(-40)?.distanceMax?.(160)?.distanceMin?.(15);
          fgRef.current.d3Force("link")?.distance?.(34);
        } else {
          // Tree Mode: clean vertical line, no horizontal explosion
          fgRef.current.d3Force("charge")?.strength?.(-20)?.distanceMax?.(110);
          fgRef.current.d3Force("link")?.distance?.(24);
        }
      } else if (viewMode === "flowchart") {
        fgRef.current.d3Force("dynamicPhysics", null);
        fgRef.current.d3Force("charge")?.strength?.(0); // Zero repulsive drift so cards stay fixed
        fgRef.current.d3Force("link")?.distance?.(48);
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
          fgRef.current.d3Force("charge")?.strength?.(-50)?.distanceMax?.(180)?.distanceMin?.(15);
          fgRef.current.d3Force("link")?.distance?.(38);
        } else {
          fgRef.current.d3Force("charge")?.strength?.(-35)?.distanceMax?.(140);
          fgRef.current.d3Force("link")?.distance?.(30);
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
          nodeRelSize={6}
          dagMode={viewMode === "flowchart" ? "td" : undefined}
          dagLevelDistance={viewMode === "flowchart" ? 48 : 50}
          minZoom={0.25}
          maxZoom={3.0}
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
          cooldownTicks={viewMode === "flowchart" ? 120 : Infinity}
          warmupTicks={30}
          d3VelocityDecay={0.35}
          d3AlphaDecay={viewMode === "flowchart" ? 0.03 : 0.002}
          onEngineStop={() => {
            if (viewMode === "graph") {
              handleFit();
            }
          }}
          // Hit area detection matching world coordinates
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            if (viewMode === "flowchart") {
              const isEdited = Boolean(node.isEdited) || realtimeChangedSet.has(String(node.id));
              const cardWidth = isEdited && node.changeSnippet ? 124 : 106;
              const cardHeight = isEdited && node.changeSnippet ? 28 : 22;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.rect(node.x - cardWidth / 2, node.y - cardHeight / 2, cardWidth, cardHeight);
              ctx.fill();
            } else {
              const nid = String(node.id);
              const isBig = nid === "root" || nid === "src";
              const radius = isBig ? 8 : 5;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI, false);
              ctx.fill();
            }
          }}
          // Link styling: highlighted visible connections with prominent directional arrows
          linkColor={(link: any) => {
            if (viewMode === "flowchart") {
              const tgt = typeof link.target === "object" ? link.target.id : link.target;
              if (realtimeChangedSet.has(tgt) || Boolean(isModified)) return "#e5c07b";
              return "#555555";
            }
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (connectedNeighbors && connectedNeighbors.has(s) && connectedNeighbors.has(t)) {
              return "#f54e00"; // Glowing orange for active/selected path
            }
            return "rgba(255, 255, 255, 0.45)"; // Highly visible, crisp white-slate line
          }}
          linkWidth={(link: any) => {
            if (viewMode === "flowchart") return 1.6;
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (connectedNeighbors && connectedNeighbors.has(s) && connectedNeighbors.has(t)) {
              return 2.5;
            }
            return 1.4;
          }}
          linkDirectionalArrowLength={viewMode === "flowchart" ? 6 : 4.5}
          linkDirectionalArrowRelPos={0.96}
          linkDirectionalArrowColor={(link: any) => {
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (connectedNeighbors && connectedNeighbors.has(s) && connectedNeighbors.has(t)) {
              return "#f54e00";
            }
            return "rgba(255, 255, 255, 0.70)";
          }}
          linkDirectionalParticles={viewMode === "flowchart" ? 2 : 1}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleWidth={1.8}
          linkDirectionalParticleColor={(link: any) => {
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (connectedNeighbors && connectedNeighbors.has(s) && connectedNeighbors.has(t)) {
              return "#f54e00";
            }
            return "#38bdf8";
          }}
          linkCurvature={0}
          // Custom Node Painting
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const nid = String(node.id);
            const nLabel = String(node.label || "");
            const nName = String(node.name || "");

            // ========================================================
            // FLOWCHART MODE: RENDER VERTICAL LINKED PIPELINE CARDS
            // (Strictly styled like the system architecture flowchart)
            // ========================================================
            if (viewMode === "flowchart") {
              const isSelected = selectedNodeId === nid || selectedNodeId === nLabel.replace("()", "");
              const isEdited = Boolean(node.isEdited) || realtimeChangedSet.has(nid) || realtimeChangedSet.has(nLabel.replace("()", ""));
              const isHighlighted = Boolean(node.isHighlighted);
              const isSPI = Boolean(node.isSPI) || node.type === "EntrySPI";
              const isResult = Boolean(node.isResult) || node.type === "Result";

              // Clean uniform card dimensions
              const cardWidth = isEdited && node.changeSnippet ? 124 : 106;
              const cardHeight = isEdited && node.changeSnippet ? 28 : 22;
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
                ? "rgba(26, 20, 10, 0.96)"
                : isHighlighted
                ? "rgba(35, 12, 16, 0.96)"
                : isSelected
                ? "rgba(28, 14, 8, 0.96)"
                : isSPI
                ? "rgba(28, 16, 40, 0.95)"
                : isResult
                ? "rgba(16, 28, 24, 0.95)"
                : "rgba(13, 17, 23, 0.95)";

              ctx.beginPath();
              if (typeof ctx.roundRect === "function") {
                ctx.roundRect(node.x - halfW, node.y - halfH, cardWidth, cardHeight, 4);
              } else {
                ctx.rect(node.x - halfW, node.y - halfH, cardWidth, cardHeight);
              }
              ctx.fill();

              // Card Border
              if (isSPI) {
                ctx.setLineDash([3, 2]);
              } else {
                ctx.setLineDash([]);
              }

              ctx.strokeStyle = isEdited
                ? "#e5c07b"
                : isHighlighted
                ? "#ef4444"
                : isSelected
                ? "#f54e00"
                : isSPI
                ? "#c084fc"
                : isResult
                ? "#34d399"
                : (node.accentColor || "#38bdf8");
              ctx.lineWidth = (isEdited || isHighlighted || isSelected) ? 1.4 : 1.0;
              ctx.stroke();

              // Reset line dash & shadow
              ctx.setLineDash([]);
              ctx.shadowBlur = 0;

              // Title Text (Centered horizontally)
              const titleFontSize = 5.8;
              ctx.font = `600 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              const titleY = node.desc || (isEdited && node.changeSnippet) ? node.y - 4.0 : node.y;

              ctx.fillStyle = isEdited
                ? "#ffe2a3"
                : isHighlighted
                ? "#fca5a5"
                : isSelected
                ? "#ffffff"
                : isSPI
                ? "#e9d5ff"
                : isResult
                ? "#a7f3d0"
                : "#f1f5f9";

              const rawTitle = nLabel || nid;
              const maxTitleLen = isEdited && node.changeSnippet ? 18 : 16;
              const displayTitle = rawTitle.length > maxTitleLen ? `${rawTitle.slice(0, maxTitleLen - 1)}…` : rawTitle;
              ctx.fillText(displayTitle, node.x, titleY);

              // Sub-caption / Exact Change Detail (Centered below title)
              const subFontSize = 4.3;
              ctx.font = `400 ${subFontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              if (isEdited && node.changeSnippet) {
                ctx.fillStyle = "#e5c07b";
                const rawSnippet = String(node.changeSnippet);
                const displaySnippet = rawSnippet.length > 25 ? `${rawSnippet.slice(0, 24)}…` : rawSnippet;
                ctx.fillText(displaySnippet, node.x, node.y + 4.8);
              } else if (node.desc) {
                ctx.fillStyle = isSPI ? "#d8b4fe" : isResult ? "#6ee7b7" : "#94a3b8";
                const rawDesc = String(node.desc);
                const displayDesc = rawDesc.length > 22 ? `${rawDesc.slice(0, 21)}…` : rawDesc;
                ctx.fillText(displayDesc, node.x, node.y + 4.6);
              }

              // Badges for Edited / Breaks
              if (isEdited) {
                const badgeFont = 4.0;
                ctx.font = `700 ${badgeFont}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
                ctx.textAlign = "right";
                ctx.fillStyle = "#e5c07b";
                ctx.fillText("● EDITED", node.x + halfW - 4, titleY);
              } else if (isHighlighted) {
                const badgeFont = 4.0;
                ctx.font = `700 ${badgeFont}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
                ctx.textAlign = "right";
                ctx.fillStyle = "#ef4444";
                ctx.fillText("● BREAKS", node.x + halfW - 4, titleY);
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

            // Refined dot sizes: reduced down so they are crisp, sleek, and not enlarged
            const isBig = nid === "root" || nid === "src";
            const isFileNode = node.type === "File" || isBig;
            const baseRadius = isBig ? 5.5 : isFileNode ? 4.5 : node.type === "Class" ? 4.0 : 3.4;
            const radius = (isSelected || isHighlighted || isRealtimeChanged) ? baseRadius + 1.6 : baseRadius;

            ctx.save();
            if (isDimmed && !isHighlighted && !isRealtimeChanged) {
              ctx.globalAlpha = 0.25;
            }

            // 1. Subtle, refined halo pulse when selected or edited
            if (isHighlighted) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 2.5 / globalScale, 0, 2 * Math.PI, false);
              ctx.fillStyle = "rgba(207, 45, 86, 0.25)";
              ctx.fill();
              ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
              ctx.lineWidth = 1.0 / globalScale;
              ctx.stroke();
            } else if (isRealtimeChanged) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 2.0 / globalScale, 0, 2 * Math.PI, false);
              ctx.fillStyle = "rgba(229, 192, 123, 0.2)";
              ctx.fill();
              ctx.strokeStyle = "rgba(229, 192, 123, 0.85)";
              ctx.lineWidth = 1.0 / globalScale;
              ctx.stroke();
            } else if (isSelected) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 2.0 / globalScale, 0, 2 * Math.PI, false);
              ctx.strokeStyle = "#f54e00";
              ctx.lineWidth = 1.2 / globalScale;
              ctx.stroke();
            }

            // 2. Node Core Disc (Crisp, sleek dot)
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = isHighlighted ? "#cf2d56" : isRealtimeChanged ? "#d19a66" : baseColor;
            ctx.fill();

            ctx.strokeStyle = isHighlighted ? "#fce7ee" : isRealtimeChanged ? "#ffe2a3" : "#111111";
            ctx.lineWidth = 0.8 / globalScale;
            ctx.stroke();

            // 3. Crisp Label Text (Positioned to the right of the dot, tree-style)
            const label = String(node.label || node.id);
            const isImportant = isBig || isSelected || isHighlighted || isRealtimeChanged || isFileNode;

            const targetScreenPx = isImportant ? 9.2 : 7.8;
            const fontSize = Math.min(Math.max(targetScreenPx / globalScale, 4.0), 16.0);
            ctx.font = `${isImportant ? "600 " : "400 "}${fontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", monospace`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";

            const displayLabel = (!isImportant && label.length > 20) ? `${label.slice(0, 18)}…` : label;
            const textWidth = ctx.measureText(displayLabel).width;
            const labelX = node.x + radius + 3.5 / globalScale;
            const labelY = node.y;

            const pillPadX = 3.5 / globalScale;
            const pillPadY = 1.8 / globalScale;
            const pillWidth = textWidth + pillPadX * 2;
            const pillHeight = fontSize + pillPadY * 2;

            // Compact backdrop pill
            ctx.fillStyle = "rgba(10, 10, 14, 0.88)";
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(labelX - pillPadX, labelY - pillHeight / 2, pillWidth, pillHeight, 2.5 / globalScale);
            } else {
              ctx.rect(labelX - pillPadX, labelY - pillHeight / 2, pillWidth, pillHeight);
            }
            ctx.fill();

            // Subtle border
            ctx.strokeStyle = isHighlighted
              ? "rgba(239, 68, 68, 0.85)"
              : isRealtimeChanged
              ? "rgba(229, 192, 123, 0.95)"
              : isSelected
              ? "rgba(245, 78, 0, 0.95)"
              : isFileNode
              ? "rgba(192, 168, 221, 0.45)"
              : "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = 0.7 / globalScale;
            ctx.stroke();

            // Label text color
            ctx.fillStyle = isHighlighted
              ? "#fca5a5"
              : isRealtimeChanged
              ? "#fef08a"
              : isSelected
              ? "#ff7a38"
              : isFileNode
              ? "#e9d5ff"
              : type === "Class"
              ? "#bbf7d0"
              : type === "Endpoint"
              ? "#fed7aa"
              : "#e2e8f0";
            ctx.fillText(displayLabel, labelX, labelY);

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
