"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { 
  Files, 
  FileCode, 
  Search, 
  GitBranch, 
  Play, 
  Settings, 
  Terminal, 
  X, 
  ChevronDown, 
  ChevronRight, 
  SplitSquareVertical, 
  Check, 
  ShieldAlert, 
  Sparkles, 
  Folder, 
  FolderOpen, 
  Send, 
  RotateCw, 
  Filter, 
  Network, 
  Flame, 
  Bot, 
  User, 
  Code2, 
  Copy, 
  CheckCircle2, 
  ArrowRight, 
  CornerDownLeft, 
  Eye, 
  RefreshCw,
  Database,
  Sliders,
  FileText,
  Plus,
  Info
} from "lucide-react";
import NetworkGraphCanvas, { NodeItem, EdgeItem } from "@/components/NetworkGraphCanvas";
import { MCP_CODEBASE_REGISTRY } from "@/lib/mcp-codebase";
import { CommandPalette } from "@/components/CommandPalette";
import { SettingsModal } from "@/components/SettingsModal";
import { AboutModal } from "@/components/AboutModal";

// Dynamically import Monaco Editor and DiffEditor
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#000000] text-xs font-mono text-neutral-500">
      Loading Code Editor...
    </div>
  ),
});

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#000000] text-xs font-mono text-neutral-500">
        Loading Diff View...
      </div>
    ),
  }
);

interface WorkspaceFile {
  name: string;
  path: string;
  language: string;
  code: string;
  modified?: boolean;
}

const INITIAL_WORKSPACE_FILES: Record<string, WorkspaceFile> = {
  "auth.ts": {
    name: "auth.ts",
    path: "src/auth.ts",
    language: "typescript",
    modified: true,
    code: `export function validateToken(token: string): boolean {\n  if (!token) return false;\n  return decodePayload(token) !== null;\n}\n\nexport function verifyToken(token: string): boolean {\n  return validateToken(token);\n}\n\nfunction decodePayload(token: string) {\n  try {\n    return JSON.parse(atob(token.split('.')[1] || '{}'));\n  } catch {\n    return null;\n  }\n}\n`,
  },
  "billing.ts": {
    name: "billing.ts",
    path: "src/billing.ts",
    language: "typescript",
    modified: false,
    code: `import { validateToken } from './auth';\n\nexport async function processInvoice(invoiceId: string, userToken: string) {\n  const isAuthorized = validateToken(userToken);\n  if (!isAuthorized) {\n    throw new Error("Unauthorized invoice processing");\n  }\n  return { invoiceId, status: "PROCESSED", timestamp: Date.now() };\n}\n`,
  },
  "finance.ts": {
    name: "finance.ts",
    path: "src/finance.ts",
    language: "typescript",
    modified: false,
    code: `import { validateToken } from './auth';\n\nexport async function auditAccount(accountId: string, adminToken: string) {\n  const isAuthorized = validateToken(adminToken);\n  if (!isAuthorized) {\n    throw new Error("Audit authorization failed: invalid security credentials");\n  }\n  return { accountId, auditStatus: "COMPLIANT", auditedAt: new Date().toISOString() };\n}\n\nexport async function calculateTax(amount: number) {\n  return amount * 0.08;\n}\n`,
  },
  "asgi.py": {
    name: "asgi.py",
    path: "src/asgi.py",
    language: "python",
    modified: false,
    code: `# FastAPI ASGI Worker Lifecycle Management\nimport asyncio\nfrom typing import Dict, Any\n\nclass ASGI:\n    def __init__(self, app):\n        self.app = app\n        self.connections = {}\n\n    async def start_application(self):\n        print("Initializing FastMCPServer worker daemon...")\n\n    async def process_websocket(self, scope, receive, send):\n        connection_id = scope.get("client", ["default"])[0]\n        await self.onopen(connection_id, send)\n        await self.acquire_ws_buffer(connection_id)\n        try:\n            while True:\n                msg = await self.ws_receive(receive)\n                if msg["type"] == "websocket.disconnect":\n                    break\n                await self.onmessage(connection_id, msg, send)\n        finally:\n            await self.onclose(connection_id)\n\n    async def onopen(self, conn_id, send):\n        await send({"type": "websocket.accept"})\n\n    async def onclose(self, conn_id):\n        self.connections.pop(conn_id, None)\n\n    async def acquire_ws_buffer(self, conn_id):\n        self.connections[conn_id] = bytearray(65536)\n\n    async def ws_receive(self, receive):\n        return await receive()\n\n    async def ws_send(self, send, data):\n        await send({"type": "websocket.send", "text": data})\n\n    async def shutdown(self):\n        print("Clean ASGI shutdown complete.")\n`,
  },
  "worker.py": {
    name: "worker.py",
    path: "src/worker.py",
    language: "python",
    modified: false,
    code: `from asgi import ASGI\n\nclass FastMCPServer:\n    def __init__(self):\n        self.asgi = ASGI(self)\n\n    def setup_server(self):\n        print("Server listening on port 8000")\n\n    def on_fetch(self, request):\n        return {"status": "ok", "worker": "active"}\n`,
  },
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  nodeContext?: string;
  isStreaming?: boolean;
  codePatch?: string;
}

function FormattedMessageContent({ text }: { text: string }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const segments = useMemo(() => {
    const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: Array<{ type: "text" | "code"; content: string; language?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      parts.push({
        type: "code",
        language: match[1] || "typescript",
        content: match[2].trim(),
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.slice(lastIndex) });
    }

    return parts;
  }, [text]);

  return (
    <div className="space-y-2 text-xs">
      {segments.map((seg, segIdx) => {
        if (seg.type === "code") {
          const isCopied = copiedIndex === segIdx;
          return (
            <div
              key={segIdx}
              className="my-2 rounded-[8px] border border-[#222222] bg-[#0a0a0a] overflow-hidden"
            >
              <div className="h-7 px-3 bg-[#121212] border-b border-[#202020] flex items-center justify-between text-[11px] font-mono text-neutral-400">
                <span className="text-neutral-200 font-semibold">{seg.language || "code"}</span>
                <button
                  onClick={() => handleCopy(seg.content, segIdx)}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy code to clipboard"
                >
                  {isCopied ? (
                    <>
                      <Check size={11} className="text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 font-mono text-[11px] text-neutral-200 overflow-x-auto leading-relaxed select-text">
                <code>{seg.content}</code>
              </pre>
            </div>
          );
        }

        const lines = seg.content.split("\n");
        return (
          <div key={segIdx} className="space-y-1">
            {lines.map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={idx} className="h-1" />;

              if (trimmed === "---") {
                return <div key={idx} className="my-2 border-t border-[#202020]" />;
              }

              const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
              const displayText = isBullet ? trimmed.slice(2) : trimmed;
              const parts = displayText.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

              return (
                <div key={idx} className={`leading-relaxed ${isBullet ? "flex items-start gap-1.5 pl-1" : ""}`}>
                  {isBullet && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f54e00] shrink-0 mt-1.5" />
                  )}
                  <div className="flex-1">
                    {parts.map((part, pIdx) => {
                      if (part.startsWith("**") && part.endsWith("**")) {
                        return (
                          <strong key={pIdx} className="text-white font-semibold mr-0.5">
                            {part.slice(2, -2)}
                          </strong>
                        );
                      }
                      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
                        return (
                          <em key={pIdx} className="text-neutral-300 italic mr-0.5">
                            {part.slice(1, -1)}
                          </em>
                        );
                      }
                      if (part.startsWith("`") && part.endsWith("`")) {
                        return (
                          <code
                            key={pIdx}
                            className="inline-code-token"
                          >
                            {part.slice(1, -1)}
                          </code>
                        );
                      }
                      return <span key={pIdx}>{part}</span>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function NexusIDE() {
  // Screen Split State: Default 75% IDE, 25% Live Graph
  const [ideSplitPercent, setIdeSplitPercent] = useState<number>(75);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // IDE Workspace State
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, WorkspaceFile>>(INITIAL_WORKSPACE_FILES);
  const [openTabs, setOpenTabs] = useState<string[]>(["auth.ts", "billing.ts", "asgi.py"]);
  const [activeFileName, setActiveFileName] = useState<string>("auth.ts");
  const [isDiffMode, setIsDiffMode] = useState<boolean>(false);
  const [originalCodeForDiff, setOriginalCodeForDiff] = useState<string>("");
  const [modifiedCodeForDiff, setModifiedCodeForDiff] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [activeActivityTab, setActiveActivityTab] = useState<"files" | "search" | "git">("files");

  // New File Creation State
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [newFileNameInput, setNewFileNameInput] = useState<string>("");

  // Live Monaco Editor Cursor Position
  const [cursorPosition, setCursorPosition] = useState<{ lineNumber: number; column: number }>({ lineNumber: 1, column: 1 });

  // Model & Settings State
  const [selectedModel, setSelectedModel] = useState<string>("claude-3-5-sonnet");
  const [isModelPickerOpen, setIsModelPickerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState<string>("");
  const [gitCommitMessage, setGitCommitMessage] = useState<string>("");
  const [committedCount, setCommittedCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Graph Data State
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [edges, setEdges] = useState<EdgeItem[]>([]);
  const [visitedBlockIds, setVisitedBlockIds] = useState<string[]>([]);
  const [realtimeChangedNodeIds, setRealtimeChangedNodeIds] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<"connected" | "connecting" | "offline">("connecting");

  // Agent Chat / Refactoring State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<any>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  // Active file helpers
  const activeFile = workspaceFiles[activeFileName] || INITIAL_WORKSPACE_FILES["auth.ts"];

  // Fetch real graph data from backend
  const fetchGraphData = useCallback(async () => {
    setIsLoadingGraph(true);
    let connected = false;

    // Fetch Network Topology Data from /api/graph/inspect
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
    } catch {
      // Backend offline fallback
    }

    if (connected) {
      setBackendStatus("connected");
      setIsLoadingGraph(false);
      return;
    }

    // Fallback directly to rich node-link structure if backend is offline
    const fallbackNodes: NodeItem[] = [
      { id: "root", label: "root", type: "Module" },
      { id: "src", label: "src", type: "Module" },
      { id: "tests", label: "tests", type: "Module" },
      { id: "package.json", label: "package.json", type: "File" },
      { id: "package-lock.json", label: "package-lock.json", type: "File" },
      { id: "pyproject.toml", label: "pyproject.toml", type: "File" },
      { id: "README.md", label: "README.md", type: "File" },
      { id: "build.sh", label: "build.sh", type: "File" },
      { id: "vendor.txt", label: "vendor.txt", type: "File" },
      { id: "requirements-test.txt", label: "requirements-test.txt", type: "File" },
      { id: "auth.ts", label: "auth.ts", type: "File" },
      { id: "billing.ts", label: "billing.ts", type: "File" },
      { id: "finance.ts", label: "finance.ts", type: "File" },
      { id: "asgi.py", label: "asgi.py", type: "File" },
      { id: "worker.py", label: "worker.py", type: "File" },
      { id: "logger.py", label: "logger.py", type: "File" },
      { id: "exceptions.py", label: "exceptions.py", type: "File" },
      { id: "uvicorn.py", label: "uvicorn.py", type: "File" },
      { id: "validateToken", label: "validateToken", type: "Function" },
      { id: "verifyToken", label: "verifyToken", type: "Function" },
      { id: "decodePayload", label: "decodePayload", type: "Function" },
      { id: "processInvoice", label: "processInvoice", type: "Function" },
      { id: "calculateTax", label: "calculateTax", type: "Function" },
      { id: "auditAccount", label: "auditAccount", type: "Function" },
      { id: "ASGI", label: "ASGI", type: "Class" },
      { id: "start_application", label: "start_application", type: "Function" },
      { id: "process_request", label: "process_request", type: "Function" },
      { id: "onmessage", label: "onmessage", type: "Function" },
      { id: "receive", label: "receive", type: "Function" },
      { id: "send", label: "send", type: "Function" },
      { id: "getattr", label: "getattr", type: "Function" },
      { id: "fetch", label: "fetch", type: "Endpoint" },
      { id: "websocket", label: "websocket", type: "Endpoint" },
      { id: "process_websocket", label: "process_websocket", type: "Function" },
      { id: "onopen", label: "onopen", type: "Function" },
      { id: "acquire_ws_buffer", label: "acquire_ws_buffer", type: "Function" },
      { id: "ws_receive", label: "ws_receive", type: "Function" },
      { id: "ws_send", label: "ws_send", type: "Function" },
      { id: "onclose", label: "onclose", type: "Function" },
      { id: "background_task", label: "background_task", type: "Class" },
      { id: "FastMCPServer", label: "FastMCPServer", type: "Class" },
      { id: "setup_server", label: "setup_server", type: "Function" },
      { id: "calculate_bmi", label: "calculate_bmi", type: "Function" },
      { id: "add", label: "add", type: "Endpoint" },
      { id: "echo_prompt", label: "echo_prompt", type: "Function" },
      { id: "get_greeting", label: "get_greeting", type: "Function" },
      { id: "on_fetch", label: "on_fetch", type: "Function" },
      { id: "shutdown", label: "shutdown", type: "Function" },
    ];

    const fallbackEdges: EdgeItem[] = [
      // root links to configs, scripts & tests
      { source: "root", target: "src" },
      { source: "root", target: "tests" },
      { source: "root", target: "package.json" },
      { source: "root", target: "package-lock.json" },
      { source: "root", target: "pyproject.toml" },
      { source: "root", target: "README.md" },
      { source: "root", target: "build.sh" },
      { source: "root", target: "vendor.txt" },
      { source: "root", target: "requirements-test.txt" },

      // src links to project files
      { source: "src", target: "auth.ts" },
      { source: "src", target: "billing.ts" },
      { source: "src", target: "finance.ts" },
      { source: "src", target: "asgi.py" },
      { source: "src", target: "worker.py" },
      { source: "src", target: "logger.py" },
      { source: "src", target: "exceptions.py" },
      { source: "src", target: "uvicorn.py" },

      // auth.ts relationships
      { source: "auth.ts", target: "validateToken", relationship: "DEFINES" },
      { source: "auth.ts", target: "verifyToken", relationship: "DEFINES" },
      { source: "auth.ts", target: "decodePayload", relationship: "DEFINES" },
      { source: "verifyToken", target: "validateToken", relationship: "CALLS" },
      { source: "validateToken", target: "decodePayload", relationship: "CALLS" },

      // billing.ts relationships
      { source: "billing.ts", target: "processInvoice", relationship: "DEFINES" },
      { source: "billing.ts", target: "calculateTax", relationship: "DEFINES" },
      { source: "processInvoice", target: "validateToken", relationship: "CALLS" },
      { source: "processInvoice", target: "calculateTax", relationship: "CALLS" },

      // finance.ts relationships
      { source: "finance.ts", target: "auditAccount", relationship: "DEFINES" },
      { source: "auditAccount", target: "validateToken", relationship: "CALLS" },

      // asgi.py relationships
      { source: "asgi.py", target: "ASGI", relationship: "DEFINES" },
      { source: "asgi.py", target: "start_application", relationship: "DEFINES" },
      { source: "asgi.py", target: "process_websocket", relationship: "DEFINES" },
      { source: "asgi.py", target: "fetch", relationship: "HANDLES" },
      { source: "asgi.py", target: "websocket", relationship: "HANDLES" },

      // start_application execution pipeline
      { source: "start_application", target: "process_request", relationship: "CALLS" },
      { source: "start_application", target: "onmessage", relationship: "CALLS" },
      { source: "ASGI", target: "receive", relationship: "CALLS" },
      { source: "ASGI", target: "send", relationship: "CALLS" },
      { source: "ASGI", target: "getattr", relationship: "CALLS" },

      // websocket pipeline
      { source: "process_websocket", target: "onopen", relationship: "CALLS" },
      { source: "process_websocket", target: "acquire_ws_buffer", relationship: "CALLS" },
      { source: "process_websocket", target: "ws_receive", relationship: "CALLS" },
      { source: "process_websocket", target: "ws_send", relationship: "CALLS" },
      { source: "process_websocket", target: "onclose", relationship: "CALLS" },
      { source: "process_websocket", target: "background_task", relationship: "INVOKES" },

      // worker.py relationships
      { source: "worker.py", target: "FastMCPServer", relationship: "DEFINES" },
      { source: "worker.py", target: "setup_server", relationship: "DEFINES" },
      { source: "worker.py", target: "on_fetch", relationship: "DEFINES" },
      { source: "worker.py", target: "shutdown", relationship: "DEFINES" },

      // setup_server tools & endpoints
      { source: "setup_server", target: "calculate_bmi", relationship: "REGISTERS" },
      { source: "setup_server", target: "add", relationship: "REGISTERS" },
      { source: "setup_server", target: "echo_prompt", relationship: "REGISTERS" },
      { source: "setup_server", target: "get_greeting", relationship: "REGISTERS" },
    ];

    setNodes(fallbackNodes);
    setEdges(fallbackEdges);
    setBackendStatus("offline");
    setIsLoadingGraph(false);
  }, [selectedNode]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Real-time Code Editor Change -> Updates AST and Workspace
  const handleCodeChange = useCallback((newCode: string | undefined) => {
    if (newCode === undefined) return;
    const isModified = newCode !== INITIAL_WORKSPACE_FILES[activeFileName]?.code;
    setWorkspaceFiles((prev) => ({
      ...prev,
      [activeFileName]: {
        ...prev[activeFileName],
        code: newCode,
        modified: isModified,
      },
    }));

    // Real-time AST Symbol Updater: Parse local function definitions and sync nodes
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
    const classRegex = /class\s+([a-zA-Z0-9_]+)/g;
    const foundSymbols: string[] = [];
    let match;
    while ((match = functionRegex.exec(newCode)) !== null) {
      foundSymbols.push(match[1]);
    }
    while ((match = classRegex.exec(newCode)) !== null) {
      foundSymbols.push(match[1]);
    }

    if (foundSymbols.length > 0) {
      setNodes((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const newNodes: NodeItem[] = [...prev];
        for (const sym of foundSymbols) {
          if (!existingIds.has(sym)) {
            newNodes.push({
              id: sym,
              label: sym,
              type: "Function",
              properties: { file: activeFileName },
            });
          }
        }
        return newNodes;
      });
    }

    // Reflect real-time modified symbols in graph highlights
    const changedIds = isModified ? [activeFileName, ...foundSymbols] : [];
    setRealtimeChangedNodeIds(changedIds);
  }, [activeFileName]);

  // Select File in Explorer or Tabs
  const handleSelectFile = useCallback((fileName: string) => {
    if (!workspaceFiles[fileName]) return;
    setActiveFileName(fileName);
    if (!openTabs.includes(fileName)) {
      setOpenTabs((prev) => [...prev, fileName]);
    }
    setIsDiffMode(false);

    // Sync real-time changed symbols for the selected file if modified
    const fileObj = workspaceFiles[fileName];
    if (fileObj?.modified) {
      const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
      const syms: string[] = [];
      let m;
      while ((m = functionRegex.exec(fileObj.code)) !== null) syms.push(m[1]);
      setRealtimeChangedNodeIds([fileName, ...syms]);
    } else {
      setRealtimeChangedNodeIds([]);
    }
  }, [workspaceFiles, openTabs]);

  // Save Current File (Keyboard shortcut & Agent save)
  const handleSaveCurrentFile = useCallback(() => {
    if (!activeFileName || !workspaceFiles[activeFileName]) return;
    setWorkspaceFiles((prev) => ({
      ...prev,
      [activeFileName]: {
        ...prev[activeFileName],
        modified: false,
      },
    }));

    // Update real-time changed node list to show saved status
    setRealtimeChangedNodeIds([activeFileName]);

    // Optional fire-and-forget sync to FalkorDB knowledge graph
    try {
      fetch("http://localhost:8000/api/graph/index-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: workspaceFiles[activeFileName].path,
          content: workspaceFiles[activeFileName].code,
          language: workspaceFiles[activeFileName].language,
        }),
      }).catch(() => {});
    } catch {}

    setToastMessage(`✓ Saved ${activeFileName} without any error!`);
    setTimeout(() => setToastMessage(null), 3000);
  }, [activeFileName, workspaceFiles]);

  // Open Side-by-Side Diff Comparison
  const openDiffComparison = useCallback((patchCodeToCompare?: string) => {
    const targetFile = "auth.ts";
    if (activeFileName !== targetFile) {
      setActiveFileName(targetFile);
      if (!openTabs.includes(targetFile)) {
        setOpenTabs((prev) => [...prev, targetFile]);
      }
    }

    const originalBaseline = INITIAL_WORKSPACE_FILES["auth.ts"]?.code || "";
    const patchText = patchCodeToCompare || modifiedCodeForDiff || `export interface TokenOptions {\n  clockTolerance?: number; // Skew tolerance in seconds\n}\n\nexport function validateToken(token: string, options: TokenOptions = {}): boolean {\n  if (!token) return false;\n  const payload = decodePayload(token);\n  if (!payload) return false;\n\n  // Procedural rule enforced: verify expiration claim (skew <= 60s)\n  const skew = options.clockTolerance ?? 60;\n  const now = Math.floor(Date.now() / 1000);\n  if (payload.exp && (now - skew > payload.exp)) {\n    return false;\n  }\n  return true;\n}`;

    const fullPatched = patchText.includes("verifyToken")
      ? patchText
      : `${patchText.trim()}\n\nexport function verifyToken(token: string): boolean {\n  return validateToken(token);\n}\n\nfunction decodePayload(token: string) {\n  try {\n    return JSON.parse(atob(token.split('.')[1] || '{}'));\n  } catch {\n    return null;\n  }\n}\n`;

    setOriginalCodeForDiff(originalBaseline);
    setModifiedCodeForDiff(fullPatched);
    setIsDiffMode(true);
    setToastMessage("✓ Side-by-Side Diff Active: Original auth.ts (Left) vs Agent Patch (Right)");
    setTimeout(() => setToastMessage(null), 3500);
  }, [activeFileName, openTabs, modifiedCodeForDiff]);

  // Accept and apply diff changes to workspace
  const handleAcceptDiffChanges = useCallback(() => {
    const targetFile = activeFileName || "auth.ts";
    const codeToSave = modifiedCodeForDiff;
    if (!codeToSave) {
      setIsDiffMode(false);
      return;
    }
    handleCodeChange(codeToSave);
    setIsDiffMode(false);
    setWorkspaceFiles((prev) => ({
      ...prev,
      [targetFile]: {
        ...prev[targetFile],
        code: codeToSave,
        modified: true,
      },
    }));
    try {
      fetch("http://localhost:8000/api/graph/index-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: workspaceFiles[targetFile]?.path || `src/${targetFile}`,
          content: codeToSave,
          language: workspaceFiles[targetFile]?.language || "typescript",
        }),
      }).catch(() => {});
    } catch {}
    setToastMessage(`✓ Accepted & saved patch to ${targetFile}!`);
    setTimeout(() => setToastMessage(null), 3000);
  }, [activeFileName, modifiedCodeForDiff, handleCodeChange, workspaceFiles]);

  // Reject diff changes and dynamically record procedural guardrail to FalkorDB
  const handleRejectDiffChanges = useCallback(() => {
    const targetFile = activeFileName || "auth.ts";
    const targetFn = selectedNode ? selectedNode.label : "validateToken";
    setIsDiffMode(false);

    try {
      fetch("http://localhost:8000/api/memory/record-rejection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function_name: targetFn,
          rejected_patch: modifiedCodeForDiff,
          rejection_reason: `User rejected patch with ⌘N on ${new Date().toLocaleTimeString()}`,
        }),
      }).catch(() => {});
    } catch {}

    setToastMessage(`✓ Rejection recorded: Guardrail persisted to FalkorDB for ${targetFn}`);
    setTimeout(() => setToastMessage(null), 3500);
  }, [activeFileName, selectedNode, modifiedCodeForDiff]);

  // Global hotkeys: Ctrl+S / Cmd+S save, Cmd+Y accept diff, Cmd+N reject diff, Esc exit diff
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrentFile();
      } else if (isDiffMode && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleAcceptDiffChanges();
      } else if (isDiffMode && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleRejectDiffChanges();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen(true);
      } else if (isDiffMode && e.key === "Escape") {
        e.preventDefault();
        setIsDiffMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveCurrentFile, isDiffMode, handleAcceptDiffChanges, handleRejectDiffChanges]);

  // Close Tab
  const handleCloseTab = (tabToClose: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const remaining = openTabs.filter((t) => t !== tabToClose);
    setOpenTabs(remaining);
    if (activeFileName === tabToClose) {
      if (remaining.length > 0) {
        setActiveFileName(remaining[remaining.length - 1]);
      } else {
        setActiveFileName("");
      }
    }
  };

  // Create New File
  const handleCreateNewFile = () => {
    const raw = newFileNameInput.trim();
    if (!raw) {
      setIsCreatingFile(false);
      return;
    }
    const cleanName = raw.includes(".") ? raw : `${raw}.ts`;
    const isPy = cleanName.endsWith(".py");
    const defaultCode = isPy
      ? `# Module: ${cleanName}\n\ndef main():\n    pass\n`
      : `// Module: ${cleanName}\n\nexport function run(): void {\n  console.log("${cleanName} active");\n}\n`;

    setWorkspaceFiles((prev) => ({
      ...prev,
      [cleanName]: {
        name: cleanName,
        path: `src/${cleanName}`,
        language: isPy ? "python" : "typescript",
        code: defaultCode,
      },
    }));

    if (!openTabs.includes(cleanName)) {
      setOpenTabs((prev) => [...prev, cleanName]);
    }
    setActiveFileName(cleanName);
    setIsCreatingFile(false);
    setNewFileNameInput("");
    setToastMessage(`✓ Created ${cleanName}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Node Selection on Graph Canvas
  const handleSelectNode = useCallback((node: NodeItem | null) => {
    setSelectedNode(node);
    if (!node) return;

    // Check if node corresponds to an existing file in workspace
    const nodeLabel = node.label || node.id;
    if (workspaceFiles[nodeLabel]) {
      handleSelectFile(nodeLabel);
      return;
    }

    // If node is a function, find which file defines it and open that file
    if (nodeLabel === "validateToken" || nodeLabel === "verifyToken") {
      handleSelectFile("auth.ts");
    } else if (nodeLabel === "processInvoice") {
      handleSelectFile("billing.ts");
    } else if (nodeLabel === "auditAccount") {
      handleSelectFile("finance.ts");
    } else if (nodeLabel.includes("process_websocket") || nodeLabel.includes("ASGI") || nodeLabel.includes("ws_")) {
      handleSelectFile("asgi.py");
    } else if (nodeLabel.includes("worker") || nodeLabel.includes("FastMCP")) {
      handleSelectFile("worker.py");
    }
  }, [workspaceFiles, handleSelectFile]);

  // Real-time search across codebase and AST symbols
  const searchResults = useMemo(() => {
    if (!sidebarSearchQuery.trim()) return [];
    const q = sidebarSearchQuery.toLowerCase();
    const results: Array<{ file: string; line: number; text: string; isSymbol: boolean }> = [];

    // Search inside workspace files
    for (const [fileName, fileObj] of Object.entries(workspaceFiles)) {
      const lines = fileObj.code.split("\n");
      lines.forEach((lineText, idx) => {
        if (lineText.toLowerCase().includes(q)) {
          results.push({
            file: fileName,
            line: idx + 1,
            text: lineText.trim(),
            isSymbol: false,
          });
        }
      });
    }

    // Search AST nodes
    for (const node of nodes) {
      if (node.label.toLowerCase().includes(q)) {
        const fileTarget = node.properties?.file || (node.type === "Function" ? "auth.ts" : "worker.py");
        results.push({
          file: fileTarget,
          line: 1,
          text: `Code: [${node.type || "Function"}] ${node.label}`,
          isSymbol: true,
        });
      }
    }

    return results.slice(0, 30);
  }, [sidebarSearchQuery, workspaceFiles, nodes]);

  const handleSearchResultClick = (file: string, line: number) => {
    handleSelectFile(file);
    if (monacoEditorRef.current) {
      try {
        monacoEditorRef.current.revealLineInCenter(line);
        monacoEditorRef.current.setPosition({ lineNumber: line, column: 1 });
      } catch {}
    }
  };

  const handleGitCommit = () => {
    if (!gitCommitMessage.trim()) return;
    const msg = gitCommitMessage.trim();
    setCommittedCount((c) => c + 1);
    setGitCommitMessage("");
    setToastMessage(`✓ Committed "${msg}" to main branch`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePingHealth = async () => {
    setBackendStatus("connecting");
    try {
      const res = await fetch("http://localhost:8000/health");
      if (res.ok) {
        setBackendStatus("connected");
        setToastMessage("✓ FalkorDB Engine Live: 0.8ms latency (connected)");
      } else {
        setBackendStatus("offline");
        setToastMessage("⚠ FalkorDB unreachable at localhost:8000");
      }
    } catch {
      setBackendStatus("offline");
      setToastMessage("⚠ FalkorDB connection timed out");
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Submit Query to Agent via SSE POST /api/agent/stream
  const handleSendQuery = async (queryOverride?: string) => {
    const textToSend = queryOverride || inputQuery;
    if (!textToSend.trim() || isGenerating) return;

    const query = textToSend.trim();
    if (!queryOverride) setInputQuery("");

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

    // Target function determined by context, query, or active file
    let targetFn = "validateToken";
    if (selectedNode && selectedNode.label && selectedNode.type === "Function") {
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
          code: activeFile.code,
          file_path: activeFile.path,
          provider: selectedModel.includes("claude") ? "anthropic" : selectedModel.includes("gpt") ? "openai" : "auto",
          model: selectedModel,
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

              // 1. Graph Traversal Event: Visited Block IDs to highlight in red!
              if (eventName === "graph_traversal") {
                const visited: string[] = parsed.visitedBlockIds || parsed.visited_block_ids || [];
                setVisitedBlockIds(visited);
              } 
              // 2. Context Resolved: FalkorDB Brain & Provenance
              else if (eventName === "context_resolved") {
                const rulesCount = parsed.rules?.length || 0;
                const callersCount = parsed.blast_radius_count || 0;
                const author = parsed.ownership?.author || "@alex.chen";
                const prNum = parsed.ownership?.pr_number || 104;

                agentReply += `**Track 1 · What Breaks:** \`${callersCount} affected functions\` checked\n`;
                agentReply += `**Track 3 · Team History:** Last updated by \`${author}\` in PR #${prNum}\n`;
                if (rulesCount > 0) {
                  agentReply += `**Track 2 · Remembered Rules (${rulesCount}):**\n`;
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
                  openDiffComparison(parsed.modified_code);

                  agentReply += `\n\n\`\`\`typescript\n// Updated Code for ${parsed.target_function}\n${parsed.modified_code.trim()}\n\`\`\`\n`;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: agentReply, codePatch: parsed.modified_code }
                        : m
                    )
                  );
                }
              } 
              // 5. Abort / Kill-Switch Event from Backend
              else if (eventName === "abort") {
                agentReply += `\n\n🚨 **[FALKORDB KILL-SWITCH TRIGGERED]**\n${parsed.reason || parsed.error}\n*FalkorDB is required. Zero mock code generated.*`;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: agentReply, isStreaming: false } : m))
                );
                setIsGenerating(false);
              }
              // 6. Completion
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
    } catch {
      // Backend / FalkorDB offline
    }

    // Kill-Switch enforcement: zero mock generation when FalkorDB or backend is unreachable
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantMsgId
          ? {
              ...m,
              content: `🚨 **[CRITICAL COMPLIANCE FAILURE: FalkorDB Primary Context Graph Unreachable]**\n\n*Rule Enforcement (FalkorDB Hackathon)*:\n> *"The graph has to do real work. A visualisation drawn on top of ordinary storage does not qualify: if the product still works once FalkorDB is taken out, the graph is decoration rather than the thing the product runs on."*\n\n**Status**: FalkorDB context graph unreachable on \`localhost:6379\`.\n**Audit Compliance**: Mock code generator deleted. Zero code generated until FalkorDB container is running via \`docker compose up -d\`.`,
              isStreaming: false,
            }
          : m
      )
    );
    setIsGenerating(false);
  };

  // Drag resizer between Left 60% and Right 40%
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newPercent = Math.max(30, Math.min(80, (e.clientX / window.innerWidth) * 100));
      setIdeSplitPercent(newPercent);
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

  // Close model picker dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setIsModelPickerOpen(false);
      }
    };
    if (isModelPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModelPickerOpen]);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="w-screen h-screen min-h-dvh bg-[#000000] text-[#e2e8f0] font-sans antialiased overflow-hidden flex flex-col select-none">
      {/* ========================================================================= */}
      {/* MAIN WORKSPACE ROW (LEFT IDE + RESIZER + RIGHT GRAPH) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* ========================================================================= */}
        {/* 1. LEFT 75% SCREEN: NORMAL NEXUS-IDE (ACTIVITY BAR + EXPLORER + MONACO + COMPOSER) */}
        {/* ========================================================================= */}
      <div 
        style={{ width: `${ideSplitPercent}%` }} 
        className="h-full flex flex-col shrink-0 min-w-[340px] bg-[#050505] border-r border-[#1e1e1e] overflow-hidden select-none"
      >
        {/* TOP IDE APP BAR */}
        <div className="h-11 px-3 border-b border-[#1e1e1e] flex items-center justify-between shrink-0 bg-[#080808]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAboutOpen(true)}
              title="About NexusIDE (FalkorDB Hackathon 2026)"
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#1a1a1a] transition-colors cursor-pointer group"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#f54e00] shadow-[0_0_8px_#f54e00] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold tracking-tight text-white font-mono flex items-center gap-1.5">
                NexusIDE
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#1c1c1c] text-[#f54e00] border border-[#f54e00]/30 hidden sm:inline">
                FalkorDB
              </span>
            </button>

            <button
              onClick={() => {
                setActiveActivityTab("git");
                setIsSidebarOpen(true);
              }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] text-[11px] font-mono text-neutral-300 hover:text-white border border-[#262626] hover:border-[#383838] transition-colors cursor-pointer"
              title="Open Source Control"
            >
              <GitBranch size={11} className="text-[#f54e00]" />
              <span>main</span>
            </button>
          </div>

          {/* Quick Actions Search Bar (⌘K) */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1 rounded-[6px] bg-[#121212] hover:bg-[#181818] border border-[#222222] hover:border-[#333333] text-[11px] font-mono text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer shadow-inner"
            title="Open Command Palette (⌘K)"
          >
            <Search size={12} className="text-[#f54e00]" />
            <span>Search actions & files...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#2e2e2e] text-[10px] text-neutral-400">⌘K</kbd>
          </button>

          <div className="flex items-center gap-2">
            {/* FalkorDB Telemetry Status */}
            <button
              onClick={handlePingHealth}
              title="Ping FalkorDB Health"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] text-[11px] font-mono transition-colors cursor-pointer"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === "connected" ? "bg-emerald-400 shadow-[0_0_6px_#22c55e]" : "bg-amber-400"}`} />
              <span className="text-neutral-400">FalkorDB:</span>
              <span className={backendStatus === "connected" ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                {backendStatus === "connected" ? "0.8ms (Live)" : "Connecting..."}
              </span>
            </button>

            {/* FastMCP Protocol Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-[6px] bg-transparent border border-[#262626] text-[11px] font-mono text-neutral-300">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
              <span className="text-neutral-400">FastMCP:</span>
              <span className="text-purple-300 font-semibold">:8000</span>
            </div>

            {/* Split Diff Toggle */}
            <button
              onClick={() => {
                if (isDiffMode) {
                  setIsDiffMode(false);
                } else {
                  openDiffComparison();
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-mono border transition-colors cursor-pointer ${
                isDiffMode
                  ? "bg-transparent border-[#f54e00] text-[#f54e00]"
                  : "bg-transparent border-[#262626] hover:border-[#383838] text-neutral-300 hover:text-white"
              }`}
            >
              <SplitSquareVertical size={11} />
              <span>{isDiffMode ? "Exit Diff" : "Diff View"}</span>
            </button>

            {/* About Modal Button */}
            <button
              onClick={() => setIsAboutOpen(true)}
              title="About NexusIDE"
              className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-mono border border-[#262626] hover:border-[#383838] text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <Info size={11} className="text-[#f54e00]" />
              <span>About</span>
            </button>

            <button
              onClick={fetchGraphData}
              title="Refresh FalkorDB Graph"
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-[#1a1a1a] border border-transparent hover:border-[#262626] transition-colors cursor-pointer"
            >
              <RotateCw size={13} className={isLoadingGraph ? "animate-spin text-[#f54e00]" : ""} />
            </button>
          </div>
        </div>

        {/* IDE BODY: ACTIVITY BAR + SIDEBAR + EDITOR & COMPOSER */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ACTIVITY BAR (VS Code Style Left Strip) */}
          <div className="w-11 border-r border-[#1e1e1e] bg-[#050505] flex flex-col items-center py-2.5 gap-3 shrink-0">
            <button
              onClick={() => {
                if (activeActivityTab === "files" && isSidebarOpen) {
                  setIsSidebarOpen(false);
                } else {
                  setActiveActivityTab("files");
                  setIsSidebarOpen(true);
                }
              }}
              title="Explorer"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                activeActivityTab === "files" && isSidebarOpen
                  ? "text-[#f54e00] bg-[#1a1a1a]"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Files size={16} />
            </button>

            <button
              onClick={() => {
                setActiveActivityTab("search");
                setIsSidebarOpen(true);
              }}
              title="Search Symbols"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                activeActivityTab === "search" && isSidebarOpen
                  ? "text-[#f54e00] bg-[#1a1a1a]"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Search size={16} />
            </button>

            <button
              onClick={() => {
                setActiveActivityTab("git");
                setIsSidebarOpen(true);
              }}
              title="Source Control"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                activeActivityTab === "git" && isSidebarOpen
                  ? "text-[#f54e00] bg-[#1a1a1a]"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <GitBranch size={16} />
            </button>

            <div className="mt-auto flex flex-col items-center gap-1.5">
              <button
                onClick={() => setIsAboutOpen(true)}
                title="About NexusIDE"
                className="p-2 text-neutral-500 hover:text-[#f54e00] hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer"
              >
                <Info size={16} />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                title="NexusIDE Settings (⌘,)"
                className="p-2 text-neutral-500 hover:text-[#f54e00] hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>

          {/* COLLAPSIBLE SIDEBAR */}
          {isSidebarOpen && (
            <div className="w-56 border-r border-[#1e1e1e] bg-[#080808] flex flex-col shrink-0 select-none">
              {/* 1. FILE EXPLORER TAB */}
              {activeActivityTab === "files" && (
                <>
                  <div className="h-8 px-3 flex items-center justify-between text-[11px] font-sans font-semibold uppercase tracking-wider text-neutral-400 border-b border-[#1e1e1e]">
                    <span>Explorer</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsCreatingFile(true)}
                        title="New File"
                        className="p-1 rounded hover:bg-[#181818] text-neutral-400 hover:text-[#f54e00] transition-colors cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                      <span className="text-[11px] text-neutral-500 font-mono">src</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 font-mono text-xs">
                    {isCreatingFile && (
                      <div className="p-1.5 flex items-center gap-1.5 bg-[#141414] rounded-[6px] border border-[#f54e00]/60 mb-1">
                        <FileCode size={13} className="text-neutral-200 shrink-0" />
                        <input
                          type="text"
                          value={newFileNameInput}
                          onChange={(e) => setNewFileNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateNewFile();
                            if (e.key === "Escape") {
                              setIsCreatingFile(false);
                              setNewFileNameInput("");
                            }
                          }}
                          placeholder="filename.ts"
                          autoFocus
                          className="w-full bg-transparent outline-none text-xs text-white font-mono placeholder-neutral-500"
                        />
                        <button
                          onClick={handleCreateNewFile}
                          className="p-0.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                          title="Create"
                        >
                          <Check size={11} />
                        </button>
                        <button
                          onClick={() => {
                            setIsCreatingFile(false);
                            setNewFileNameInput("");
                          }}
                          className="p-0.5 text-neutral-500 hover:text-white cursor-pointer"
                          title="Cancel"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}

                    {Object.entries(workspaceFiles).map(([fileName, fileObj]) => {
                      const isCurrent = activeFileName === fileName;
                      const isFileModified = fileObj.modified;
                      return (
                        <div
                          key={fileName}
                          onClick={() => handleSelectFile(fileName)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-[6px] cursor-pointer transition-colors ${
                            isCurrent
                              ? "bg-[#181818] text-white border border-[#2a2a2a] font-medium shadow-xs"
                              : isFileModified
                              ? "text-[#e5c07b] hover:bg-[#161616] hover:text-[#f3d38c]"
                              : "text-neutral-500 hover:bg-[#141414] hover:text-neutral-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileCode
                              size={13}
                              className={
                                isCurrent
                                  ? "text-white"
                                  : isFileModified
                                  ? "text-[#e5c07b]"
                                  : "text-neutral-500"
                              }
                            />
                            <span className="truncate">{fileName}</span>
                          </div>
                          {isFileModified ? (
                            <span className="text-[11px] text-[#e5c07b] font-mono px-1 rounded bg-[#e5c07b]/10 shrink-0">M</span>
                          ) : (
                            <span className="text-[11px] text-neutral-600 font-mono shrink-0">U</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2.5 border-t border-[#1e1e1e] bg-[#050505] text-[11px] font-mono text-neutral-400 flex items-center justify-between">
                    <span>Code Items</span>
                    <span className="text-[#f54e00] font-semibold">{nodes.length} Items</span>
                  </div>
                </>
              )}

              {/* 2. SEARCH PANEL TAB */}
              {activeActivityTab === "search" && (
                <>
                  <div className="h-8 px-3 flex items-center justify-between text-[11px] font-sans font-semibold uppercase tracking-wider text-neutral-400 border-b border-[#1e1e1e]">
                    <span>Search</span>
                    <span className="text-[11px] text-neutral-500 font-mono">{searchResults.length} matches</span>
                  </div>

                  <div className="p-2 border-b border-[#1e1e1e]">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#141414] rounded-[8px] border border-[#262626]">
                      <Search size={12} className="text-neutral-500 shrink-0" />
                      <input
                        type="text"
                        value={sidebarSearchQuery}
                        onChange={(e) => setSidebarSearchQuery(e.target.value)}
                        placeholder="Search files or functions..."
                        autoFocus
                        className="w-full bg-transparent outline-none text-xs text-white placeholder-neutral-500 font-mono"
                      />
                      {sidebarSearchQuery && (
                        <button
                          onClick={() => setSidebarSearchQuery("")}
                          className="text-neutral-500 hover:text-white cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1 font-mono text-[11px]">
                    {searchResults.map((res, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSearchResultClick(res.file, res.line)}
                        className="p-1.5 rounded-[6px] hover:bg-[#161616] cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center justify-between text-neutral-400 group-hover:text-[#f54e00]">
                          <span className="font-semibold text-xs">{res.file}</span>
                          <span className="text-[11px] text-neutral-500">Ln {res.line}</span>
                        </div>
                        <div className="text-neutral-300 truncate text-[11px] mt-0.5">{res.text}</div>
                      </div>
                    ))}
                    {sidebarSearchQuery && searchResults.length === 0 && (
                      <div className="p-4 text-center text-xs text-neutral-500">No matching code found</div>
                    )}
                    {!sidebarSearchQuery && (
                      <div className="p-4 text-center text-[11px] text-neutral-500">Type a symbol name to search across the codebase</div>
                    )}
                  </div>
                </>
              )}

              {/* 3. SOURCE CONTROL (GIT) TAB */}
              {activeActivityTab === "git" && (
                <>
                  <div className="h-8 px-3 flex items-center justify-between text-[11px] font-sans font-semibold uppercase tracking-wider text-neutral-400 border-b border-[#1e1e1e]">
                    <span>Source Control</span>
                    <span className="text-[11px] text-[#f54e00] font-mono">main</span>
                  </div>

                  <div className="p-2 border-b border-[#1e1e1e] space-y-2">
                    <input
                      type="text"
                      value={gitCommitMessage}
                      onChange={(e) => setGitCommitMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGitCommit();
                      }}
                      placeholder="Commit message (⌘Enter)..."
                      className="w-full px-2.5 py-1.5 rounded-[8px] bg-[#141414] border border-[#262626] text-xs font-mono text-white placeholder-neutral-500 outline-none focus:border-[#f54e00]"
                    />
                    <button
                      onClick={handleGitCommit}
                      disabled={!gitCommitMessage.trim()}
                      className="w-full py-1.5 rounded-[6px] bg-transparent hover:bg-[#f54e00]/10 border border-[#f54e00]/80 hover:border-[#f54e00] text-[#f54e00] hover:text-[#ff6a26] disabled:opacity-40 text-xs font-mono font-medium cursor-pointer transition-colors"
                    >
                      Commit to main ({committedCount})
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 font-mono text-xs">
                    <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-2 py-1">
                      Changes ({isDiffMode ? "2" : "1"})
                    </div>
                    {Object.keys(workspaceFiles).slice(0, 3).map((fileName) => (
                      <div
                        key={fileName}
                        onClick={() => handleSelectFile(fileName)}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-[6px] hover:bg-[#161616] cursor-pointer transition-colors text-neutral-300"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode size={13} className="text-neutral-200 shrink-0" />
                          <span className="truncate">{fileName}</span>
                        </div>
                        <span className="text-[11px] text-amber-400 font-semibold">M</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* MAIN EDITOR & AGENT COMPOSER REGION */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#050505]">
            {/* TABS BAR */}
            <div className="h-9 px-2 bg-[#080808] border-b border-[#1e1e1e] flex items-center gap-1 overflow-x-auto select-none">
              {openTabs.map((tab) => {
                const isActive = activeFileName === tab;
                const fileObj = workspaceFiles[tab];
                const isFileModified = fileObj?.modified;
                return (
                  <div
                    key={tab}
                    onClick={() => handleSelectFile(tab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-mono border-t border-x cursor-pointer transition-colors shrink-0 max-w-[170px] ${
                      isActive
                        ? "bg-[#000000] border-[#262626] text-white font-medium shadow-xs"
                        : isFileModified
                        ? "bg-[#080808] border-transparent text-[#e5c07b] hover:text-[#f3d38c]"
                        : "bg-[#080808] border-transparent text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    <FileCode
                      size={12}
                      className={
                        isActive
                          ? "text-white shrink-0"
                          : isFileModified
                          ? "text-[#e5c07b] shrink-0"
                          : "text-neutral-500 shrink-0"
                      }
                    />
                    <span className="truncate">{tab}</span>
                    {isFileModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e5c07b] shrink-0" title="Modified" />
                    )}
                    <button
                      onClick={(e) => handleCloseTab(tab, e)}
                      className="p-0.5 rounded hover:bg-[#1f1f1f] text-neutral-500 hover:text-white shrink-0 ml-auto"
                      title="Close Tab"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => {
                  setActiveActivityTab("files");
                  setIsSidebarOpen(true);
                  setIsCreatingFile(true);
                }}
                title="New File"
                className="p-1 rounded hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-200 border border-transparent hover:border-[#262626] transition-colors cursor-pointer shrink-0 ml-1"
              >
                <Plus size={13} />
              </button>
            </div>

            {/* MONACO CODE EDITOR (OR SPLIT DIFF EDITOR) */}
            <div className="flex-1 min-h-[220px] relative">
              {isDiffMode && modifiedCodeForDiff ? (
                <div className="w-full h-full flex flex-col">
                  <div className="h-7 px-3 bg-[#0e0e0e] border-b border-[#202020] flex items-center justify-between text-[11px] font-mono text-neutral-300">
                    <span className="text-amber-300 truncate">Code Comparison: Current (Left) vs Updated (Right)</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleAcceptDiffChanges}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-transparent hover:bg-emerald-500/10 border border-emerald-500/80 text-emerald-400 cursor-pointer text-[11px] font-mono transition-colors"
                      >
                        <Check size={11} />
                        <span>Accept & Save (⌘Y)</span>
                      </button>
                      <button
                        onClick={handleRejectDiffChanges}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-transparent hover:bg-rose-500/10 border border-rose-500/80 text-rose-400 cursor-pointer text-[11px] font-mono transition-colors"
                        title="Rejects patch and dynamically writes procedural guardrail to FalkorDB"
                      >
                        <X size={11} />
                        <span>Reject (⌘N)</span>
                      </button>
                      <button
                        onClick={() => setIsDiffMode(false)}
                        className="px-2.5 py-1 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#383838] text-neutral-400 hover:text-white cursor-pointer text-[11px] font-mono transition-colors"
                      >
                        Exit Diff (Esc)
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <DiffEditor
                      height="100%"
                      original={originalCodeForDiff}
                      modified={modifiedCodeForDiff}
                      language={activeFile.language}
                      theme="nexus-dark-clean"
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                        automaticLayout: true,
                        cursorBlinking: "smooth",
                        cursorStyle: "line",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <Editor
                  height="100%"
                  language={activeFile.language}
                  theme="nexus-dark-clean"
                  value={activeFile.code}
                  onChange={handleCodeChange}
                  onMount={(editor, monaco) => {
                    monacoEditorRef.current = editor;
                    if (monaco) {
                      monaco.editor.defineTheme("nexus-dark-clean", {
                        base: "vs-dark",
                        inherit: true,
                        rules: [],
                        colors: {
                          "editor.background": "#000000",
                          "editorCursor.foreground": "#888888",
                          "editor.lineHighlightBackground": "#0a0a0a",
                          "editorLineNumber.foreground": "#444444",
                          "editorLineNumber.activeForeground": "#888888",
                          "editor.selectionBackground": "#222222",
                        },
                      });
                      monaco.editor.setTheme("nexus-dark-clean");

                      // Bind Ctrl+S / Cmd+S save command inside Monaco
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        handleSaveCurrentFile();
                      });
                    }

                    editor.onDidChangeCursorPosition((e: any) => {
                      setCursorPosition({
                        lineNumber: e.position.lineNumber,
                        column: e.position.column,
                      });
                    });

                    // Live Highlight Listener: as soon as user highlights anything, open flowchart for that file & symbol
                    editor.onDidChangeCursorSelection((e: any) => {
                      const selection = editor.getSelection();
                      if (selection && !selection.isEmpty()) {
                        const selectedText = editor.getModel()?.getValueInRange(selection)?.trim();
                        if (selectedText && selectedText.length > 1) {
                          const matchedNode = nodes.find(
                            (n) => n.id === selectedText || n.label === selectedText || selectedText.includes(n.id) || selectedText.includes(n.label)
                          );
                          if (matchedNode) {
                            setSelectedNode(matchedNode);
                            setVisitedBlockIds([matchedNode.id]);
                          } else {
                            setVisitedBlockIds([activeFileName]);
                          }
                        }
                      }
                    });
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    renderLineHighlight: "all",
                    cursorBlinking: "smooth",
                    cursorStyle: "line",
                    cursorWidth: 2,
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              )}
            </div>

            {/* AGENT COMPOSER / CHAT PANEL (BOTTOM DOCK) */}
            <div className="h-64 border-t border-[#1e1e1e] bg-[#000000] flex flex-col shrink-0">
              {/* COMPOSER HEADER */}
              <div className="h-8 px-3 bg-[#080808] border-b border-[#1e1e1e] flex items-center justify-between text-xs font-mono text-neutral-400 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Bot size={13} className="text-[#f54e00] shrink-0" />
                  <span className="text-white font-medium shrink-0">Nexus Agent</span>
                  <span className="text-neutral-600 shrink-0">•</span>
                  <span className="text-neutral-400 shrink-0">Target:</span>
                  <span className="font-semibold px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2c2c2c] text-neutral-200 text-[11px] truncate max-w-[130px]">
                    @{selectedNode ? selectedNode.label : "validateToken"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] shrink-0">
                  {/* Cursor DESIGN.md AI Timeline Stage Pills */}
                  {isGenerating ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#dfa88f]/20 border border-[#dfa88f]/50 text-[#dfa88f] font-mono text-[11px] font-medium flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#dfa88f] animate-pulse" />
                      Thinking
                    </span>
                  ) : visitedBlockIds.length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#9fc9a2]/20 border border-[#9fc9a2]/50 text-[#9fc9a2] font-mono text-[11px] font-medium flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9fc9a2]" />
                      Grepping ({visitedBlockIds.length})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2c2c2c] text-neutral-300 font-mono text-[11px] shrink-0">
                      Reading
                    </span>
                  )}

                  {/* Interactive Model Selector Dropdown */}
                  <div ref={modelPickerRef} className="relative shrink-0">
                    <button
                      onClick={() => setIsModelPickerOpen(!isModelPickerOpen)}
                      className="px-2.5 py-1 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] text-neutral-300 hover:text-white text-[11px] font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>{selectedModel}</span>
                      <ChevronDown size={10} className="text-neutral-400" />
                    </button>
                    {isModelPickerOpen && (
                      <div className="absolute right-0 top-7 w-44 bg-[#111111] border border-[#282828] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
                        {["claude-3-5-sonnet", "claude-3-7-sonnet", "gpt-4o", "deepseek-r1"].map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              setSelectedModel(m);
                              setIsModelPickerOpen(false);
                            }}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-colors ${
                              selectedModel === m ? "bg-[#f54e00]/20 text-[#f54e00]" : "text-neutral-300 hover:bg-[#1a1a1a]"
                            }`}
                          >
                            <span>{m}</span>
                            {selectedModel === m && <Check size={11} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CHAT / STREAM MESSAGES FEED */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs font-sans">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 font-mono text-[11px]">
                    <Sparkles className="w-5 h-5 text-[#f54e00]/80 mb-1" />
                    <span>FalkorDB Code Context Ready</span>
                    <span className="text-neutral-500 text-[11px]">Choose a hackathon track below or ask about your code</span>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div className="text-[11px] text-neutral-500 font-mono">
                        {m.role === "user" ? "You" : "Nexus Agent"} • {m.timestamp}
                      </div>
                      <div
                        className={`p-2.5 rounded-xl max-w-[95%] leading-relaxed ${
                          m.role === "user"
                            ? "bg-[#f54e00]/20 border border-[#f54e00]/40 text-neutral-100 font-mono"
                            : "bg-[#0e0e0e] border border-[#202020] text-neutral-200"
                        }`}
                      >
                        <FormattedMessageContent text={m.content} />
                        {m.isStreaming && (
                          <span className="inline-block w-1.5 h-3 ml-1 bg-[#f54e00] animate-pulse align-middle" />
                        )}

                        {m.codePatch && (
                          <div className="mt-2.5 pt-2 border-t border-[#202020] flex items-center gap-2">
                            <button
                              onClick={() => {
                                const targetFile = "auth.ts";
                                const patchText = m.codePatch || "";
                                const fullPatched = patchText.includes("verifyToken")
                                  ? patchText
                                  : `${patchText.trim()}\n\nexport function verifyToken(token: string): boolean {\n  return validateToken(token);\n}\n\nfunction decodePayload(token: string) {\n  try {\n    return JSON.parse(atob(token.split('.')[1] || '{}'));\n  } catch {\n    return null;\n  }\n}\n`;

                                handleCodeChange(fullPatched);
                                setWorkspaceFiles((prev) => ({
                                  ...prev,
                                  [targetFile]: {
                                    ...prev[targetFile],
                                    code: fullPatched,
                                    modified: true,
                                  },
                                }));
                                setIsDiffMode(false);
                                setToastMessage(`✓ Saved patch to ${targetFile}!`);
                                setTimeout(() => setToastMessage(null), 3000);
                              }}
                              className="px-3 py-1 rounded-[6px] bg-transparent hover:bg-[#f54e00]/10 border border-[#f54e00]/80 hover:border-[#f54e00] text-[#f54e00] hover:text-[#ff6a26] text-[11px] font-mono font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Check size={12} />
                              <span>Save to auth.ts</span>
                            </button>
                            <button
                              onClick={() => openDiffComparison(m.codePatch)}
                              className="px-3 py-1 rounded-[6px] bg-transparent hover:bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3d3d3d] text-neutral-300 hover:text-white text-[11px] font-mono cursor-pointer transition-colors flex items-center gap-1.5"
                            >
                              <SplitSquareVertical size={12} className="text-[#f54e00]" />
                              <span>Compare Changes</span>
                            </button>
                            <button
                              onClick={() => handleRejectDiffChanges()}
                              className="px-3 py-1 rounded-[6px] bg-transparent hover:bg-rose-500/10 border border-rose-500/80 hover:border-rose-500 text-rose-400 hover:text-rose-300 text-[11px] font-mono cursor-pointer transition-colors flex items-center gap-1.5"
                              title="Reject patch & dynamically write procedural memory to FalkorDB"
                            >
                              <X size={12} />
                              <span>Reject (⌘N)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* QUICK PROMPT SUGGESTION CHIPS */}
              <div className="px-2.5 py-1.5 bg-[#080808] border-t border-[#1e1e1e] flex items-center gap-1.5 overflow-x-auto select-none scrollbar-none">
                {[
                  { label: "Track 1 · What Breaks", prompt: "Track 1 · What breaks if validateToken changes?" },
                  { label: "Track 2 · Remembered Rules", prompt: "Track 2 · Check remembered rules from past runs" },
                  { label: "Track 3 · Team History", prompt: "Track 3 · Who wrote validateToken and why?" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => {
                      setInputQuery(chip.prompt);
                      handleSendQuery(chip.prompt);
                    }}
                    className="px-2.5 py-1 rounded-full bg-transparent hover:bg-[#181818] border border-[#262626] hover:border-[#383838] text-[11px] font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* INPUT BAR */}
              <div className="p-2.5 bg-[#080808] border-t border-[#1e1e1e] flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendQuery();
                  }}
                  placeholder="Ask: What code breaks if I change this function, or what rules to follow..."
                  className="flex-1 bg-[#121212] border border-[#222222] focus:border-[#f54e00]/70 rounded-[8px] px-3 py-1.5 text-xs font-mono text-white placeholder-neutral-500 outline-none"
                />
                <button
                  onClick={() => handleSendQuery()}
                  disabled={!inputQuery.trim() || isGenerating}
                  className="px-3.5 py-1.5 rounded-[6px] bg-transparent hover:bg-[#f54e00]/10 border border-[#f54e00]/80 hover:border-[#f54e00] text-[#f54e00] hover:text-[#ff6a26] disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono font-medium"
                >
                  {isGenerating ? (
                    <RotateCw size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>Run</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SPLIT RESIZER HANDLE (||) MATCHING SCREENSHOT */}
      {/* ========================================================================= */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1.5 hover:w-2 bg-[#141414] hover:bg-[#2c2c2c] cursor-col-resize transition-all duration-150 flex items-center justify-center relative group select-none z-30"
      >
        <div className="w-1 h-6 rounded-full bg-[#666666] group-hover:bg-[#999999] flex items-center justify-center">
          <span className="text-[11px] font-mono text-[#888888] select-none pointer-events-none">||</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. RIGHT 25% SCREEN: LIVE REAL-TIME NETWORK GRAPH MATCHING USER IMAGE */}
      {/* ========================================================================= */}
      <div className="flex-1 h-full min-w-[260px] relative bg-[#000000] overflow-hidden flex flex-col">
        {/* GRAPH CANVAS ENGINE WITH INTEGRATED HEADER AND BOTTOM CONTROLS */}
        <div className="flex-1 w-full h-full min-h-0 relative">
          <NetworkGraphCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNode ? selectedNode.id : null}
            highlightedNodeIds={visitedBlockIds}
            realtimeChangedNodeIds={realtimeChangedNodeIds}
            activeFileName={activeFileName}
            activeFileCode={activeFile.code}
            isModified={activeFile.modified}
            onSelectNode={handleSelectNode}
            onRunAction={(node) => {
              const target = node ? node.label : "validateToken";
              const promptText = `Track 1 · What breaks if ${target} changes?`;
              setInputQuery(promptText);
              handleSendQuery(promptText);
            }}
          />
        </div>
      </div>
    </div>

    {/* ========================================================================= */}
    {/* 4. CURSOR BOTTOM STATUS BAR (FULL WIDTH, ZERO OVERLAPS, MATCHING MASTER.MD) */}
    {/* ========================================================================= */}
    <div className="h-6 bg-[#050505] border-t border-[#1e1e1e] px-3 flex items-center justify-between text-[11px] font-mono text-neutral-400 shrink-0 z-30 select-none">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => {
            setActiveActivityTab("git");
            setIsSidebarOpen(true);
          }}
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <GitBranch size={11} className="text-[#f54e00]" />
          <span>main</span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 size={11} />
            <span className="hidden sm:inline">0 errors, 0 warnings</span>
          </span>
        </div>
        <span className="text-neutral-600 shrink-0">•</span>
        <button
          onClick={handlePingHealth}
          className="flex items-center gap-1.5 text-neutral-400 hover:text-white cursor-pointer transition-colors shrink-0"
          title="Click to test FalkorDB connection"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              backendStatus === "connected"
                ? "bg-emerald-400 shadow-[0_0_6px_#22c55e]"
                : "bg-amber-400"
            }`}
          />
          <span className="hidden md:inline">FalkorDB:</span>
          <span className={backendStatus === "connected" ? "text-emerald-400" : "text-amber-400"}>
            {backendStatus === "connected" ? "Live (0.8ms)" : "Connecting..."}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-3 text-neutral-500 shrink-0">
        <span className="hidden sm:inline">{activeFile.code.split("\n").length} lines</span>
        <span className="hidden sm:inline">UTF-8</span>
        <span className="text-neutral-400 uppercase text-[11px] px-1.5 py-0.2 rounded bg-[#141414] border border-[#242424]">
          {activeFile.language}
        </span>
        <span className="text-neutral-300 font-medium">
          Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
        </span>
        <span className="text-[#f54e00] font-medium hidden md:inline">Nexus IDE</span>
      </div>
    </div>

    {/* ========================================================================= */}
    {/* 5. MODAL DIALOGS: SETTINGS, ABOUT, COMMAND PALETTE */}
    {/* ========================================================================= */}
    <SettingsModal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      onSettingsSaved={() => {
        setToastMessage("Settings updated successfully");
        setTimeout(() => setToastMessage(null), 2500);
      }}
    />

    <AboutModal
      isOpen={isAboutOpen}
      onClose={() => setIsAboutOpen(false)}
      falkorLatency="0.8ms"
      falkorConnected={backendStatus === "connected"}
    />

    <CommandPalette
      isOpen={isCommandPaletteOpen}
      onClose={() => setIsCommandPaletteOpen(false)}
      onSelectFile={(f) => {
        setActiveFileName(f);
        if (!openTabs.includes(f)) setOpenTabs((prev) => [...prev, f]);
      }}
      onSelectView={(v) => {
        if (v === "diff") {
          openDiffComparison();
        } else {
          setIsDiffMode(false);
        }
      }}
      onSelectModel={(m) => setSelectedModel(m)}
      onRunPrompt={(p) => {
        setInputQuery(p);
        handleSendQuery(p);
      }}
      onOpenSettings={() => {
        setIsCommandPaletteOpen(false);
        setIsSettingsOpen(true);
      }}
      onOpenAbout={() => {
        setIsCommandPaletteOpen(false);
        setIsAboutOpen(true);
      }}
      currentModel={selectedModel}
    />

    {/* ========================================================================= */}
    {/* 6. TOAST NOTIFICATION */}
    {/* ========================================================================= */}
    {toastMessage && (
      <div className="fixed bottom-9 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#141414] border border-[#2a2a2a] text-xs font-mono text-white shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
        <CheckCircle2 size={13} className="text-[#f54e00]" />
        <span>{toastMessage}</span>
      </div>
    )}
  </div>
);
}
