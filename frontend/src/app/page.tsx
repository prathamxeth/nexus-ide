"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { 
  RotateCw, 
  Send, 
  Bot, 
  User, 
  Code2, 
  FileText, 
  Sparkles, 
  ChevronRight, 
  Copy, 
  Check, 
  Terminal,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import NetworkGraphCanvas, { NodeItem, EdgeItem } from "@/components/NetworkGraphCanvas";
import { MCP_CODEBASE_REGISTRY } from "@/lib/mcp-codebase";

// Dynamically import Monaco Editor to avoid SSR issues
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1017] text-xs font-mono text-neutral-500">
      Loading Code Editor...
    </div>
  ),
});

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  nodeContext?: string;
}

export default function NexusIDE() {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<"chat" | "code">("chat");
  const [leftPanelWidth, setLeftPanelWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);

  // Graph Data State
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [edges, setEdges] = useState<EdgeItem[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"connected" | "connecting" | "offline">("connecting");

  // Chat State (Clean, zero pre-fed mock conversations)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active Code View State
  const [activeFileCode, setActiveFileCode] = useState<string>(MCP_CODEBASE_REGISTRY["asgi.py"].code);
  const [activeFileName, setActiveFileName] = useState<string>("asgi.py");
  const [activeFileLanguage, setActiveFileLanguage] = useState<string>("python");
  const [isCopied, setIsCopied] = useState(false);

  // Fetch real graph data from backend /api/graph/inspect
  const fetchGraphData = useCallback(async () => {
    setIsLoadingGraph(true);
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
          setBackendStatus("connected");
          setIsLoadingGraph(false);
          return;
        }
      }
    } catch {
      // Backend unavailable or starting up
    }

    // Fallback directly to registry node-link structure if backend is offline
    const fallbackNodes: NodeItem[] = [
      { id: "root", label: "root", type: "Module" },
      { id: "src", label: "src", type: "Module" },
      { id: "tests", label: "tests", type: "Module" },
      { id: "add", label: "add", type: "Endpoint" },
      { id: "fetch", label: "fetch", type: "Endpoint" },
      { id: "websocket", label: "websocket", type: "Endpoint" },
      { id: "worker.py", label: "worker.py", type: "File" },
      { id: "logger.py", label: "logger.py", type: "File" },
      { id: "asgi.py", label: "asgi.py", type: "File" },
      { id: "exceptions.py", label: "exceptions.py", type: "File" },
      { id: "uvicorn.py", label: "uvicorn.py", type: "File" },
      { id: "build.sh", label: "build.sh", type: "File" },
      { id: "vendor.txt", label: "vendor.txt", type: "File" },
      { id: "package.json", label: "package.json", type: "File" },
      { id: "README.md", label: "README.md", type: "File" },
      { id: "requirements-test.txt", label: "requirements-test.txt", type: "File" },
      { id: "package-lock.json", label: "package-lock.json", type: "File" },
      { id: "pyproject.toml", label: "pyproject.toml", type: "File" },
      { id: "FastMCPServer", label: "FastMCPServer", type: "Class" },
      { id: "ASGI", label: "ASGI", type: "Class" },
      { id: "background_task", label: "background_task", type: "Class" },
      { id: "setup_server", label: "setup_server", type: "Function" },
      { id: "echo_prompt", label: "echo_prompt", type: "Function" },
      { id: "get_greeting", label: "get_greeting", type: "Function" },
      { id: "calculate_bmi", label: "calculate_bmi", type: "Function" },
      { id: "on_fetch", label: "on_fetch", type: "Function" },
      { id: "ws_receive", label: "ws_receive", type: "Function" },
      { id: "onmessage", label: "onmessage", type: "Function" },
      { id: "process_request", label: "process_request", type: "Function" },
      { id: "process_websocket", label: "process_websocket", type: "Function" },
      { id: "onopen", label: "onopen", type: "Function" },
      { id: "onclose", label: "onclose", type: "Function" },
      { id: "ws_send", label: "ws_send", type: "Function" },
      { id: "getattr", label: "getattr", type: "Function" },
      { id: "shutdown", label: "shutdown", type: "Function" },
      { id: "start_application", label: "start_application", type: "Function" },
      { id: "receive", label: "receive", type: "Function" },
      { id: "send", label: "send", type: "Function" },
      { id: "acquire_ws_buffer", label: "acquire_ws_buffer", type: "Function" },
    ];

    const fallbackEdges: EdgeItem[] = [
      { source: "root", target: "src" },
      { source: "root", target: "tests" },
      { source: "root", target: "build.sh" },
      { source: "root", target: "vendor.txt" },
      { source: "root", target: "package.json" },
      { source: "root", target: "README.md" },
      { source: "root", target: "package-lock.json" },
      { source: "root", target: "requirements-test.txt" },
      { source: "root", target: "pyproject.toml" },
      { source: "root", target: "uvicorn.py" },
      { source: "src", target: "worker.py" },
      { source: "src", target: "logger.py" },
      { source: "src", target: "asgi.py" },
      { source: "src", target: "exceptions.py" },
      { source: "src", target: "onmessage" },
      { source: "src", target: "process_request" },
      { source: "src", target: "onopen" },
      { source: "worker.py", target: "setup_server" },
      { source: "worker.py", target: "FastMCPServer" },
      { source: "worker.py", target: "on_fetch" },
      { source: "worker.py", target: "logger.py" },
      { source: "worker.py", target: "exceptions.py" },
      { source: "setup_server", target: "calculate_bmi" },
      { source: "setup_server", target: "add" },
      { source: "setup_server", target: "echo_prompt" },
      { source: "setup_server", target: "get_greeting" },
      { source: "FastMCPServer", target: "calculate_bmi" },
      { source: "FastMCPServer", target: "setup_server" },
      { source: "logger.py", target: "setup_server" },
      { source: "logger.py", target: "asgi.py" },
      { source: "asgi.py", target: "ASGI" },
      { source: "asgi.py", target: "process_websocket" },
      { source: "asgi.py", target: "ws_send" },
      { source: "asgi.py", target: "ws_receive" },
      { source: "asgi.py", target: "onopen" },
      { source: "asgi.py", target: "onclose" },
      { source: "asgi.py", target: "fetch" },
      { source: "asgi.py", target: "websocket" },
      { source: "asgi.py", target: "shutdown" },
      { source: "asgi.py", target: "start_application" },
      { source: "asgi.py", target: "getattr" },
      { source: "process_websocket", target: "ws_receive" },
      { source: "process_websocket", target: "ws_send" },
      { source: "process_websocket", target: "onclose" },
      { source: "process_websocket", target: "onopen" },
      { source: "process_websocket", target: "acquire_ws_buffer" },
      { source: "process_websocket", target: "background_task" },
      { source: "ASGI", target: "start_application" },
      { source: "ASGI", target: "shutdown" },
      { source: "ASGI", target: "receive" },
      { source: "ASGI", target: "send" },
      { source: "ASGI", target: "ws_send" },
      { source: "fetch", target: "process_request" },
      { source: "fetch", target: "getattr" },
      { source: "websocket", target: "asgi.py" },
      { source: "start_application", target: "receive" },
      { source: "start_application", target: "send" },
      { source: "start_application", target: "shutdown" },
    ];

    setNodes(fallbackNodes);
    setEdges(fallbackEdges);
    setBackendStatus("offline");
    setIsLoadingGraph(false);
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Handle Node Selection
  const handleSelectNode = useCallback((node: NodeItem | null) => {
    setSelectedNode(node);
    if (!node) return;

    // If node exists in code registry, update Code & Docs
    const codeEntry = MCP_CODEBASE_REGISTRY[node.id] || MCP_CODEBASE_REGISTRY[node.label];
    if (codeEntry) {
      setActiveFileCode(codeEntry.code);
      setActiveFileName(codeEntry.name);
      setActiveFileLanguage(codeEntry.language);
    }
  }, []);

  // Submit Query to Agent
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

    try {
      // Attempt streaming from backend agent refactor API
      const response = await fetch("http://localhost:8000/api/agent/stream-refactor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: query,
          target_file: selectedNode ? selectedNode.label : "src/asgi.py",
          active_model: "claude-3-5-sonnet-20241022",
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let agentReply = "";

        const assistantMsgId = String(Date.now() + 1);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: "",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.content) {
                  agentReply += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, content: agentReply } : m))
                  );
                }
              } catch {
                // non-json stream chunk
              }
            }
          }
        }
        setIsGenerating(false);
        return;
      }
    } catch {
      // Offline fallback: provide accurate technical explanation of the node
    }

    // Dynamic, accurate architectural explanation for the node
    setTimeout(() => {
      let explanation = "";
      if (query.toLowerCase().includes("process_websocket") || selectedNode?.id === "process_websocket") {
        explanation = `### \`process_websocket\` Execution Lifecycle

\`process_websocket\` is the core asynchronous loop in **\`src/asgi.py\`** managing bidirectional WebSocket streams:

1. **Connection Handshake**: Receives scope client credentials and calls \`await self.onopen(connection_id, send)\` to dispatch \`websocket.accept\`.
2. **Buffer Allocation**: Invokes \`await self.acquire_ws_buffer(connection_id)\` to reserve worker memory.
3. **Continuous Framing Loop**:
   - Loops over \`await self.ws_receive(receive)\` awaiting binary/text packets.
   - Forwards frames to \`onmessage\`, which queues asynchronous execution via \`asyncio.create_task(self.background_task(...))\`.
4. **Clean Teardown**: Upon \`websocket.disconnect\` or \`WebSocketClosed\`, cleanly flushes socket state via \`await self.onclose(connection_id)\`.`;
      } else if (selectedNode) {
        explanation = `### Node Context: \`${selectedNode.label}\` (\`${selectedNode.type}\`)

- **Layer**: ${selectedNode.type}
- **Connected Graph Neighbors**: ${edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length} links
- **Description**: ${MCP_CODEBASE_REGISTRY[selectedNode.id]?.description || "Core component within fastapi-worker-dani-mcp-server."}`;
      } else {
        explanation = `### Codebase Overview: \`fastapi-worker-dani-mcp-server\`

- **Active Runtime**: Python ASGI with FastMCPServer worker lifecycle.
- **Indexed Nodes**: ${nodes.length} nodes across Modules, Files, Classes, and Functions.
- Click any node on the graph canvas or type a query to inspect relationships and source code.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: explanation,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
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
            <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
              main
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
              <div className="text-[11px] font-sans text-neutral-400 font-medium mb-1.5">
                Chat
              </div>
              <div className="relative bg-[#11141d] border border-[#202636] focus-within:border-sky-500/70 rounded-xl p-2.5 transition-colors">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendQuery();
                  }}
                  placeholder="Ask anything about the codebase or architecture..."
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
                    Ready to query codebase topology
                  </p>
                  <p className="text-[11px] text-neutral-500 max-w-xs leading-relaxed">
                    Select any node on the graph or type an architectural question above.
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
                      <span>{m.role === "user" ? "You" : "Nexus Assistant"}</span>
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
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Keyboard Legend matching user screenshot */}
            <div className="p-3 bg-[#0a0c12] border-t border-[#1b202c] flex items-center justify-between text-[11px] font-sans text-neutral-400 select-none">
              <div className="flex items-center gap-2">
                <span>Focus on node</span>
                <kbd className="px-2 py-0.5 rounded-md bg-[#161a25] border border-[#242b3d] text-neutral-300 font-mono text-[10px]">
                  Click
                </kbd>
              </div>

              <div className="flex items-center gap-2">
                <span>Expand/collapse node</span>
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
      {/* 3. RIGHT PANEL: INTERACTIVE FORCE-DIRECTED NETWORK GRAPH */}
      {/* ======================================================== */}
      <div className="flex-1 h-full min-w-0 relative bg-[#080a0f] overflow-hidden">
        <NetworkGraphCanvas
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNode ? selectedNode.id : null}
          onSelectNode={handleSelectNode}
          onRunAction={(node) => {
            if (node) {
              setInputQuery(`Analyze and inspect relationships for ${node.label}`);
              setActiveTab("chat");
            }
          }}
        />
      </div>
    </div>
  );
}
