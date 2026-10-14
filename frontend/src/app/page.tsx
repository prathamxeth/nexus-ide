"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { 
  RotateCw, 
  Send, 
  Bot, 
  FileText, 
  Copy, 
  Check, 
  Layers,
  Network,
  Zap,
  Activity,
  Flame
} from "lucide-react";
import NetworkGraphCanvas, { NodeItem, EdgeItem } from "@/components/NetworkGraphCanvas";
import type { GraphBlock, GraphConnection } from "@/components/GraphCanvas";
import { MCP_CODEBASE_REGISTRY } from "@/lib/mcp-codebase";

// Dynamically import Monaco Editor
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1017] text-xs font-mono text-neutral-500">
      Loading Code Editor...
    </div>
  ),
});

// Dynamically import Gravity UI Graph Canvas to avoid SSR issues
const GraphCanvas = dynamic(() => import("@/components/GraphCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center text-xs font-mono text-neutral-500 gap-2">
      <RotateCw className="w-5 h-5 text-emerald-400 animate-spin" />
      <span>Rendering Gravity UI 4-Lane Graph...</span>
    </div>
  ),
});

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  nodeContext?: string;
  isStreaming?: boolean;
}

export default function NexusIDE() {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<"chat" | "code">("chat");
  const [canvasMode, setCanvasMode] = useState<"gravity" | "network">("gravity");
  const [leftPanelWidth, setLeftPanelWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);

  // Graph Data State
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [edges, setEdges] = useState<EdgeItem[]>([]);
  const [gravityBlocks, setGravityBlocks] = useState<GraphBlock[]>([]);
  const [gravityConnections, setGravityConnections] = useState<GraphConnection[]>([]);
  const [visitedBlockIds, setVisitedBlockIds] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"connected" | "connecting" | "offline">("connecting");

  // Chat State (Clean, zero pre-fed mock conversations)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active Code View State
  const [activeFileCode, setActiveFileCode] = useState<string>(
    `export function validateToken(token: string): boolean {\n  if (!token) return false;\n  return decodePayload(token) !== null;\n}\n\nexport function verifyToken(token: string): boolean {\n  return validateToken(token);\n}\n\nfunction decodePayload(token: string) {\n  try {\n    return JSON.parse(atob(token.split('.')[1] || '{}'));\n  } catch {\n    return null;\n  }\n}\n`
  );
  const [activeFileName, setActiveFileName] = useState<string>("src/auth.ts");
  const [activeFileLanguage, setActiveFileLanguage] = useState<string>("typescript");
  const [isCopied, setIsCopied] = useState(false);

  // Fetch real graph data from backend /api/graph/data and /api/graph/inspect
  const fetchGraphData = useCallback(async () => {
    setIsLoadingGraph(true);
    let connected = false;

    // 1. Fetch Gravity UI 4-Lane Graph Data (x=50, 350, 680, 1000)
    try {
      const targetFn = selectedNode?.label || "validateToken";
      const gravRes = await fetch(`http://localhost:8000/api/graph/data?function_name=${encodeURIComponent(targetFn)}`);
      if (gravRes.ok) {
        const gravData = await gravRes.json();
        if (gravData.blocks && gravData.blocks.length > 0) {
          setGravityBlocks(gravData.blocks);
          setGravityConnections(gravData.connections || []);
          connected = true;
        }
      }
    } catch (err) {
      console.warn("Gravity graph fetch error:", err);
    }

    // 2. Fetch Network Topology Data
    try {
      const res = await fetch("http://localhost:8000/api/graph/inspect");
      if (res.ok) {
        const data = await res.json();
        if (data.nodes && data.nodes.length > 0) {
          const mappedNodes: NodeItem[] = data.nodes.map((n: any) => ({
            id: n.id,
            label: n.label || n.properties?.name || n.id,
            type: n.type || "Function",
            properties: n.properties || {},
          }));
          const mappedEdges: EdgeItem[] = (data.edges || []).map((e: any) => ({
            source: e.source,
            target: e.target,
            relationship: e.relationship,
          }));
          setNodes(mappedNodes);
          setEdges(mappedEdges);
          connected = true;
        }
      }
    } catch (err) {
      console.warn("Network graph fetch error:", err);
    }

    if (connected) {
      setBackendStatus("connected");
      setIsLoadingGraph(false);
      return;
    }

    // Fallback if backend is starting up or offline
    const fallbackNodes: NodeItem[] = [
      { id: "validateToken", label: "validateToken", type: "Function" },
      { id: "verifyToken", label: "verifyToken", type: "Function" },
      { id: "processInvoice", label: "processInvoice", type: "Function" },
      { id: "auditAccount", label: "auditAccount", type: "Function" },
      { id: "src/auth.ts", label: "src/auth.ts", type: "File" },
      { id: "src/billing.ts", label: "src/billing.ts", type: "File" },
      { id: "src/finance.ts", label: "src/finance.ts", type: "File" },
    ];

    const fallbackEdges: EdgeItem[] = [
      { source: "verifyToken", target: "validateToken", relationship: "CALLS" },
      { source: "processInvoice", target: "validateToken", relationship: "CALLS" },
      { source: "auditAccount", target: "validateToken", relationship: "CALLS" },
      { source: "src/auth.ts", target: "validateToken", relationship: "DEFINES" },
      { source: "src/billing.ts", target: "processInvoice", relationship: "DEFINES" },
      { source: "src/finance.ts", target: "auditAccount", relationship: "DEFINES" },
    ];

    setNodes(fallbackNodes);
    setEdges(fallbackEdges);
    setBackendStatus("offline");
    setIsLoadingGraph(false);
  }, [selectedNode]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Handle Node Selection
  const handleSelectNode = useCallback((node: NodeItem | null) => {
    setSelectedNode(node);
    if (!node) return;

    // Check codebase registry
    const codeEntry = MCP_CODEBASE_REGISTRY[node.id] || MCP_CODEBASE_REGISTRY[node.label];
    if (codeEntry) {
      setActiveFileCode(codeEntry.code);
      setActiveFileName(codeEntry.name);
      setActiveFileLanguage(codeEntry.language);
    } else if (node.label === "validateToken" || node.id === "validateToken") {
      setActiveFileName("src/auth.ts");
      setActiveFileLanguage("typescript");
    }
  }, []);

  // Handle Block Selection in Gravity UI Graph
  const handleSelectBlock = useCallback((block: any) => {
    if (!block) return;
    const title = block.title || block.id;
    const matchedNode = nodes.find((n) => n.id === block.id || n.label === title);
    if (matchedNode) {
      setSelectedNode(matchedNode);
    } else {
      setSelectedNode({ id: block.id, label: title, type: block.type });
    }

    if (block.file) {
      setActiveFileName(block.file);
    }
  }, [nodes]);

  // Submit Query to Agent via POST /api/agent/stream
  const handleSendQuery = async () => {
    if (!inputQuery.trim() || isGenerating) return;

    const query = inputQuery.trim();
    setInputQuery("");

    const newMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      nodeContext: selectedNode?.label,
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsGenerating(true);

    const assistantMsgId = String(Date.now() + 1);
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isStreaming: true,
      },
    ]);

    // Target function determined by context or query
    let targetFn = "validateToken";
    if (selectedNode && selectedNode.label) {
      targetFn = selectedNode.label;
    } else if (query.toLowerCase().includes("process_websocket")) {
      targetFn = "process_websocket";
    }

    try {
      const response = await fetch("http://localhost:8000/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: query,
          target_function: targetFn,
          code: activeFileCode,
          file_path: activeFileName,
          provider: "mock",
          model: "claude-3-5-sonnet",
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let agentReply = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const ev of events) {
            if (!ev.trim()) continue;
            let eventName = "message";
            let dataStr = "";
            const lines = ev.split("\n");
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventName = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                dataStr = line.slice(6).trim();
              }
            }

            if (!dataStr) continue;
            try {
              const parsed = JSON.parse(dataStr);

              // 1. Graph Traversal Event: Contains visitedBlockIds to highlight in red!
              if (eventName === "graph_traversal") {
                const visited: string[] = parsed.visitedBlockIds || parsed.visited_block_ids || [];
                setVisitedBlockIds(visited);

                if (parsed.blocks && parsed.blocks.length > 0) {
                  setGravityBlocks(parsed.blocks);
                  if (parsed.connections) {
                    setGravityConnections(parsed.connections);
                  }
                }
              } 
              // 2. Context Resolved: FalkorDB Brain & Provenance
              else if (eventName === "context_resolved") {
                const rulesCount = parsed.rules?.length || 0;
                const callersCount = parsed.blast_radius_count || 0;
                const author = parsed.ownership?.author || "@alex.chen";
                const prNum = parsed.ownership?.pr_number || 104;

                agentReply += `**FalkorDB Blast Radius Verified:** \`${callersCount} callers\` in call hierarchy\n`;
                agentReply += `**Company Brain:** Modified by \`${author}\` in PR #${prNum}\n`;
                if (rulesCount > 0) {
                  agentReply += `**Enforced Guardrail Rules (${rulesCount}):**\n`;
                  for (const r of parsed.rules) {
                    agentReply += `- *${r}*\n`;
                  }
                }
                agentReply += "\n---\n\n";

                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: agentReply } : m))
                );
              } 
              // 3. Reasoning Chunk
              else if (eventName === "reasoning_chunk") {
                if (parsed.chunk) {
                  agentReply += parsed.chunk;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, content: agentReply } : m))
                  );
                }
              } 
              // 4. Code Patch
              else if (eventName === "code_patch") {
                if (parsed.modified_code) {
                  setActiveFileCode(parsed.modified_code);
                  agentReply += `\n\n\`\`\`typescript\n// Refactored AST Code Patch for ${parsed.target_function}\n${parsed.modified_code.trim()}\n\`\`\`\n`;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, content: agentReply } : m))
                  );
                }
              } 
              // 5. Completion
              else if (eventName === "done") {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
                );
                setIsGenerating(false);
              }
            } catch {
              // Parse fallback
            }
          }
        }
        setIsGenerating(false);
        return;
      }
    } catch (err) {
      console.warn("Agent stream connection failed:", err);
    }

    // Fallback if local backend is unreachable
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `### Architecture Analysis: \`${targetFn}\`\n\n- **Status**: Backend connecting to FalkorDB on port 6379.\n- **Lanes**: 4 Gravity-UI lanes (x=50, 350, 680, 1000) active.\n- Click **Run** on any node or test with \`validateToken\` to observe live red node highlighting.`,
                isStreaming: false,
              }
            : m
        )
      );
      setIsGenerating(false);
    }, 400);
  };

  // Drag resizer logic
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(320, Math.min(e.clientX, 680));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="w-screen h-screen min-h-dvh bg-[#080a0f] text-[#e2e8f0] font-sans antialiased overflow-hidden flex select-none">
      {/* ======================================================== */}
      {/* 1. LEFT PANEL (HEADER, TABS: CHAT | CODE & DOCS, SHORTCUTS) */}
      {/* ======================================================== */}
      <div 
        style={{ width: leftPanelWidth }} 
        className="h-full bg-[#0c0e14] border-r border-[#1e2330] flex flex-col shrink-0 select-none overflow-hidden"
      >
        {/* PANEL HEADER: REPOSITORY NAME + BRANCH + REFRESH BUTTON */}
        <div className="h-14 px-4 border-b border-[#1b202c] flex items-center justify-between shrink-0">
          <div>
            <div className="text-sm font-semibold tracking-tight text-white font-mono flex items-center gap-2">
              <span>fastapi-worker-dani-mcp-server</span>
            </div>
            <div className="text-[11px] font-mono text-neutral-400 mt-0.5 flex items-center gap-2">
              <span>main</span>
              <span className="text-neutral-600">•</span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === "connected" ? "bg-emerald-400 shadow-[0_0_6px_#22c55e]" : "bg-amber-400"}`} />
                <span className={backendStatus === "connected" ? "text-emerald-400" : "text-amber-400"}>
                  {backendStatus === "connected" ? "Backend SSE Live" : "Connecting..."}
                </span>
              </span>
            </div>
          </div>

          <button
            onClick={fetchGraphData}
            title="Refresh code graph"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#181c28] transition-colors cursor-pointer"
          >
            <RotateCw size={14} className={isLoadingGraph ? "animate-spin text-sky-400" : ""} />
          </button>
        </div>

        {/* SEGMENTED TAB SWITCHER: CHAT | CODE & DOCS */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-4 text-xs font-medium border-b border-[#1b202c]">
          <button
            onClick={() => setActiveTab("chat")}
            className={`pb-1.5 cursor-pointer transition-colors relative ${
              activeTab === "chat" ? "text-white font-semibold" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span>Chat</span>
            {activeTab === "chat" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("code")}
            className={`pb-1.5 cursor-pointer transition-colors relative ${
              activeTab === "code" ? "text-white font-semibold" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span>Code & Docs</span>
            {activeTab === "code" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full" />
            )}
          </button>
        </div>

        {/* TAB CONTENT: CHAT VIEW */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Top Chat Input Area matching screenshot */}
            <div className="p-4 border-b border-[#1b202c] bg-[#0c0e14]">
              <div className="text-[11px] font-sans text-neutral-400 font-medium mb-1.5 flex items-center justify-between">
                <span>Chat</span>
                {visitedBlockIds.length > 0 && (
                  <span className="text-[10px] text-red-400 font-mono flex items-center gap-1">
                    <Flame size={11} className="text-red-400 animate-pulse" />
                    <span>{visitedBlockIds.length} Visited Nodes (Red)</span>
                  </span>
                )}
              </div>
              <div className="relative bg-[#11141d] border border-[#202636] focus-within:border-sky-500/70 rounded-xl p-2.5 transition-colors">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendQuery();
                  }}
                  placeholder="Ask agent to refactor validateToken or analyze blast radius..."
                  className="w-full bg-transparent text-xs font-mono text-white placeholder-neutral-500 outline-none pr-8"
                />
                <button
                  onClick={handleSendQuery}
                  disabled={!inputQuery.trim() || isGenerating}
                  className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-sky-400 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {isGenerating ? (
                    <RotateCw size={13} className="animate-spin text-sky-400" />
                  ) : (
                    <Send size={13} />
                  )}
                </button>
              </div>
            </div>

            {/* Conversation Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-6 text-neutral-500 text-xs font-mono">
                  <Bot className="w-8 h-8 text-neutral-600 mb-2 stroke-[1.5]" />
                  <p className="text-neutral-400 font-sans font-medium mb-1">
                    Ready to stream agent refactoring
                  </p>
                  <p className="text-[11px] text-neutral-500 max-w-xs leading-relaxed">
                    Type a prompt like &quot;Refactor validateToken with 60s clock skew&quot; to watch real-time graph traversal.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col gap-1 text-xs ${
                      m.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono">
                      <span>{m.role === "user" ? "You" : "Nexus Agent"}</span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                    </div>
                    <div
                      className={`p-3 rounded-xl max-w-[95%] leading-relaxed ${
                        m.role === "user"
                          ? "bg-sky-600/20 border border-sky-500/30 text-sky-100 font-mono"
                          : "bg-[#121622] border border-[#202738] text-neutral-200 font-sans whitespace-pre-wrap"
                      }`}
                    >
                      {m.content}
                      {m.isStreaming && (
                        <span className="inline-block w-1.5 h-3 ml-1 bg-sky-400 animate-pulse align-middle" />
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Keyboard Legend */}
            <div className="p-3 bg-[#0a0c12] border-t border-[#1b202c] flex items-center justify-between text-[11px] font-sans text-neutral-400 select-none">
              <div className="flex items-center gap-2">
                <span>Focus on node</span>
                <kbd className="px-2 py-0.5 rounded-md bg-[#161a25] border border-[#242b3d] text-neutral-300 font-mono text-[10px]">
                  Click
                </kbd>
              </div>

              <div className="flex items-center gap-2">
                <span>Expand/collapse</span>
                <kbd className="px-2 py-0.5 rounded-md bg-[#161a25] border border-[#242b3d] text-neutral-300 font-mono text-[10px]">
                  ⌘ + Click
                </kbd>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: CODE & DOCS VIEW */}
        {activeTab === "code" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0a0c12]">
            {/* Breadcrumb Header */}
            <div className="h-9 px-4 border-b border-[#1b202c] flex items-center justify-between text-xs font-mono text-neutral-400 bg-[#0d1017]">
              <div className="flex items-center gap-1.5 truncate">
                <FileText size={13} className="text-sky-400 shrink-0" />
                <span className="text-white font-medium truncate">{activeFileName}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeFileCode);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 1500);
                }}
                title="Copy code"
                className="p-1 text-neutral-400 hover:text-white rounded hover:bg-[#181c28] transition-colors"
              >
                {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>

            {/* Real Monaco Editor */}
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                language={activeFileLanguage}
                theme="vs-dark"
                value={activeFileCode}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  renderLineHighlight: "all",
                  padding: { top: 8, bottom: 8 },
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. SPLIT RESIZER HANDLE MATCHING SCREENSHOT (||) */}
      {/* ======================================================== */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1.5 hover:w-2 bg-[#121622] hover:bg-sky-500/50 cursor-col-resize transition-all duration-150 flex items-center justify-center relative group select-none z-30"
      >
        <div className="w-1 h-6 rounded-full bg-neutral-600 group-hover:bg-white flex items-center justify-center">
          <span className="text-[8px] font-mono text-neutral-400 select-none pointer-events-none">||</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. RIGHT PANEL: INTERACTIVE GRAPH CANVAS */}
      {/* ======================================================== */}
      <div className="flex-1 h-full min-w-0 relative bg-[#080a0f] overflow-hidden flex flex-col">
        {/* TOP CANVAS CONTROLLER: 4-LANE GRAVITY UI vs TOPOLOGY SWITCHER */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <div className="flex items-center bg-[#12151e]/90 backdrop-blur-md border border-[#232838] rounded-xl p-1 shadow-2xl">
            <button
              onClick={() => setCanvasMode("gravity")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                canvasMode === "gravity"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Layers size={13} />
              <span>4-Lane Swimlanes</span>
            </button>
            <button
              onClick={() => setCanvasMode("network")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                canvasMode === "network"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Network size={13} />
              <span>Force Topology</span>
            </button>
          </div>

          {visitedBlockIds.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-500/60 text-xs font-mono text-red-200 shadow-2xl animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
              <span>Blast Radius Traversal: {visitedBlockIds.length} Nodes</span>
            </div>
          )}
        </div>

        {/* CANVAS RENDERER */}
        <div className="flex-1 w-full h-full min-h-0 relative">
          {canvasMode === "gravity" ? (
            <GraphCanvas
              blocks={gravityBlocks}
              connections={gravityConnections}
              highlightedBlockIds={visitedBlockIds}
              onSelectBlock={handleSelectBlock}
            />
          ) : (
            <NetworkGraphCanvas
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNode ? selectedNode.id : null}
              highlightedNodeIds={visitedBlockIds}
              onSelectNode={handleSelectNode}
              onRunAction={(node) => {
                const target = node ? node.label : "validateToken";
                setInputQuery(`Refactor ${target} with 60-second clock skew tolerance and add error telemetry`);
                setActiveTab("chat");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
