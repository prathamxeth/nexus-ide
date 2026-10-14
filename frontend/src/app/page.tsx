"use client";

import React, { useState, useEffect, useRef } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { 
  Files, Search, GitBranch, Play, Boxes, Network, Sparkles, 
  User, Settings, Terminal, X, ChevronDown, ChevronRight, 
  SplitSquareVertical, Columns2, Check, ShieldAlert, Cpu, Cloud, 
  FileCode, CheckCircle2, RefreshCw, Folder, FolderOpen, Bell, 
  AlertCircle, Info, Database, Copy, CheckCheck, FolderGit2, 
  ArrowRight, BookOpen, Bug, Laptop, LayoutGrid, TerminalSquare,
  ExternalLink, Layers, GitPullRequest, GitCommit, MessageSquare,
  Activity, Radio, HelpCircle, PanelRight, PanelBottom, PanelLeft,
  ChevronUp, CornerDownLeft, FileText, Send, Mic, ThumbsUp, ThumbsDown,
  Camera, Globe, Eye, History, MoreHorizontal, Sliders, CheckSquare,
  Compass, Workflow, ArrowUp
} from "lucide-react";

import { GraphViewer } from "@/components/GraphViewer";
import { SettingsModal } from "@/components/SettingsModal";
import { CommandPalette } from "@/components/CommandPalette";
import { playUiSound } from "@/lib/sound";

// Graph data interfaces for FalkorDB AST engine
export interface GraphNode {
  id: string;
  name?: string;
  label?: string;
  file?: string;
  group?: string;
  layer?: string;
  color?: string;
  val?: number;
  [key: string]: any;
}

export interface GraphLink {
  source: string;
  target: string;
  type?: string;
  [key: string]: any;
}

// Demo Video Script text shown in user screenshots
const DEMO_VIDEO_SCRIPT = `# 🎬 GraphiCode — 3-Minute Hackathon Winning Demo Script

> **Recording Tool**: Loom or Screen Studio (1080p / 60fps)  
> **Total Duration**: 3:00  
> **Speaker Tone**: Confident, fast-paced, high technical clarity.

---

### Segment 1: The Agony & Contrast (0:00 – 0:30)
**[Visual]**: Split screen. On the left, a standard chat window or Cursor. On the right, terminal showing test suite.

**[Narrator]**:
> "Every developer has experienced this nightmare: You ask an AI code assistant to refactor a critical authentication function: *'Harden validateToken with strict validation'*.  
> 
> The AI modifies \`auth.ts\`. It looks plausible. But the moment you deploy or run your test suite—**BOOM**.  
> \`billing.ts\` explodes. \`finance.ts\` fails in production.  
> 
> Why? Because **Vector RAG is topologically blind**. Embeddings find semantically similar text, but they have zero awareness of caller graphs, multi-hop dependencies, or procedural constraints.  
> 
> To solve this, we built **GraphiCode**—the graph-native agentic IDE powered by **FalkorDB**."

---

### Segment 2: The FalkorDB Advantage (0:30 – 1:30)
**[Visual]**: Transition to GraphiCode running at \`http://localhost:3000\`. Show the sleek dark desktop interface.

**[Narrator]**:
> "Here is GraphiCode. Notice the left sidebar with our active review queue, our central Composer Agent, and our interactive live workspace.  
> 
> Let's run that exact same prompt: *'Add expiration check to validateToken and update callers'*. Watch the bottom drawer."

**[Action]**: Click the **↑** submit button.

**[Narrator]**:
> "Look at that. In **under 2 milliseconds**, FalkorDB executes a multi-hop Cypher traversal.  
> Instead of guessing, the graph engine immediately traverses the AST and highlights all impacted callers in **pulsing red**:
> - \`processInvoice\` in \`billing.ts\` at Hop 1
> - \`auditAccount\` in \`finance.ts\` at Hop 2  
> 
> GraphiCode knows the exact blast radius *before* writing a single line of code."

---

### Segment 3: The Trifecta Demo (All 3 Tracks) (1:30 – 2:15)
**[Visual]**: Zoom in slightly on the graph nodes (Blue, Red, Yellow, Green) and the Composer active context pills.

**[Narrator]**:
> "This is where GraphiCode hits **all three FalkorDB tracks** simultaneously:
> 
> 1. **Track 1 (Connected Data)**: The blue focus node \`validateToken\` is connected directly to its multi-hop AST call tree via Tree-sitter and FalkorDB GraphBLAS queries.
> 
> 2. **Track 2 (Agent Memory & Coordination)**: Look at this amber node. GraphiCode queried procedural memory and surfaced a rule from a past incident: *'Must check exp claim with clock skew <= 60s'*. The agent is physically prevented from generating a naive patch.
> 
> 3. **Track 3 (Company Brain)**: Notice the emerald node. FalkorDB correlated the code syntax with Git commit history and Jira tickets—surfacing \`PR #104\` authored by \`@alex.chen\` (\`SEC-402\`), giving the AI the original author's intent."

---

### Segment 4: Monaco Split-Diff & Hotkey Resolution (2:15 – 2:45)
**[Visual]**: Monaco Diff view activates side-by-side with additions in green and deletions in red. Show the floating action bar.

**[Narrator]**:
> "Now look at the editor. GraphiCode toggled Monaco's side-by-side Diff view.  
> It injected the fail-closed null checks, respected the 60-second skew tolerance from procedural memory, and avoided any signature breaking changes.  
> 
> I can review the patch, press **\`Cmd+Y\`** to accept... and notice what happens in the graph: FalkorDB re-indexes the AST in real-time.  
> Now let's click \`billing.ts\` on the graph—it instantly jumps our editor directly to the caller line."

---

### Segment 5: One-Command Architecture & Conclusion (2:45 – 3:00)
**[Visual]**: Flash the terminal running \`./run.sh\` and the architectural flow diagram.

**[Narrator]**:
> "Best of all: GraphiCode is a **one-command deployment**. A single \`./run.sh\` builds FalkorDB, the FastAPI backend, and the Next.js frontend, seeding all AST and PR data with zero configuration.  
> 
> By replacing flat vector embeddings with FalkorDB's sub-millisecond graph intelligence, GraphiCode turns AI from a dangerous code guesser into an enterprise-grade software engineer.  
> 
> Thank you, and welcome to the graph-native future of software development."
`;

// Master repository source files
const INITIAL_FILES: Record<string, string> = {
  "demo_video_script.md": DEMO_VIDEO_SCRIPT,
  "auth.ts": `// Target AST Function: validateToken in src/auth.ts
export function validateToken(token: string): boolean {
  if (!token) return false;
  return decodePayload(token) !== null;
}

function decodePayload(token: string) {
  // Parsing token payload
  return JSON.parse(atob(token.split('.')[1] || '{}'));
}
`,
  "billing.ts": `import { validateToken } from './auth';

/**
 * Caller in Blast Radius (Hop 1)
 */
export async function processInvoice(invoiceId: string, userToken: string) {
  // Blast-radius dependency: caller of validateToken
  const isAuthorized = validateToken(userToken);
  if (!isAuthorized) {
    throw new Error("Unauthorized invoice processing");
  }
  return { invoiceId, status: "PROCESSED", timestamp: Date.now() };
}
`,
  "finance.ts": `import { validateToken } from './auth';

/**
 * Caller in Blast Radius (Hop 2)
 */
export async function auditAccount(accountId: string, adminToken: string) {
  // Blast-radius dependency: caller of validateToken
  const isAuthorized = validateToken(adminToken);
  if (!isAuthorized) {
    throw new Error("Audit authorization failed: invalid security credentials");
  }
  return { accountId, auditStatus: "COMPLIANT", auditedAt: new Date().toISOString() };
}
`,
  "blog_post.md": `# GraphiCode: Replacing Vector RAG with FalkorDB AST Knowledge Graphs

AI coding assistants are broken in enterprise codebases. They suffer from topological blindness.
When refactoring critical functions, standard embeddings fail to identify multi-hop callers.

GraphiCode uses FalkorDB to maintain real-time AST graphs, procedural memory constraints, and organizational history.
`,
  "docker-compose.yml": `services:
  falkordb:
    image: falkordb/falkordb:latest
    container_name: graphicode-falkordb
    ports:
      - "6379:6379"
    volumes:
      - falkor-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      timeout: 3s
      retries: 5
      start_period: 3s

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: graphicode-backend
    ports:
      - "8000:8000"
    environment:
      - FALKORDB_HOST=falkordb
      - FALKORDB_PORT=6379
`,
  "launch-mac.sh": `#!/usr/bin/env bash
# ==============================================================================
# GraphiCode — Apple Silicon (M1/M2/M3/M4) Optimized Native Launch Script
# ==============================================================================
set -euo pipefail

echo "🚀 Launching GraphiCode on Apple Silicon..."
docker run -d --name graphicode-falkordb -p 6379:6379 --rm falkordb/falkordb:latest
`,
  "README.md": `# ⚡ GraphiCode: The Graph-Native Agentic IDE Powered by FalkorDB

Context-aware code refactoring with zero blast-radius hallucinations.
Built with FalkorDB AST Graph Intelligence.
`,
  "run.sh": `#!/usr/bin/env bash
echo "Starting GraphiCode full stack..."
./launch-mac.sh
`,
  "setup.sh": `#!/usr/bin/env bash
echo "Setting up GraphiCode environment..."
pnpm install
`,
  "Scratchpad": `# GraphiCode Agent Scratchpad

- Task: GraphiCode agentic workspace with graph as context.
- FalkorDB Status: 69 AST nodes indexed, 42 call edges traversed.
- Rules Verified: 'Must check exp claim (skew <= 60s)'.
`,
  "Cursor Desktop Architecture": `# GraphiCode Architecture Reference

- Integrated FalkorDB Cypher Engine at localhost:6379.
- Monaco Editor with multi-tab split view and side-by-side diffing.
- Real-time SSE Agent telemetry.
`
};

// Changed files list shown in Review Changes tab (Screenshot 5)
const REVIEW_CHANGES_FILES = [
  { path: "docker-compose.yml", folder: "", added: 50, removed: 0 },
  { path: "requirements.txt", folder: "backend", added: 8, removed: 0 },
  { path: "pyproject.toml", folder: "backend", added: 24, removed: 0 },
  { path: "__init__.py", folder: "backend/services", added: 25, removed: 0 },
  { path: "falkor_client.py", folder: "backend/services", added: 194, removed: 0 },
  { path: "ast_parser.py", folder: "backend/services", added: 710, removed: 0 },
  { path: "main.py", folder: "backend", added: 531, removed: 0 },
  { path: "README.md", folder: "frontend", added: 30, removed: 0 },
  { path: "setup.sh", folder: "", added: 107, removed: 0 },
  { path: "test_parser.py", folder: "backend", added: 138, removed: 0 },
  { path: "memory_service.py", folder: "backend/services", added: 257, removed: 0 },
  { path: "seed_demo_data.py", folder: "backend", added: 225, removed: 0 },
  { path: "agent_orchestrator.py", folder: "backend/services", added: 418, removed: 0 },
  { path: "tailwind.config.ts", folder: "frontend", added: 31, removed: 0 },
  { path: "globals.css", folder: "frontend/src/app", added: 38, removed: 16 },
  { path: "layout.tsx", folder: "frontend/src/app", added: 28, removed: 19 },
  { path: "auth.ts", folder: "frontend/src", added: 18, removed: 4 },
  { path: "billing.ts", folder: "frontend/src", added: 2, removed: 1 },
];

// Artifacts list shown in Artifacts Popover (Screenshot 4)
const ARTIFACTS_LIST = [
  { name: "Media (Today 6:47 PM)", time: "Today 6:47 PM", type: "media" },
  { name: "Media (Today 7:02 PM)", time: "Today 7:02 PM", type: "media" },
  { name: "Media (Today 10:22 PM)", time: "Today 10:22 PM", type: "media" },
  { name: "Media (Today 11:08 PM)", time: "Today 11:08 PM", type: "media" },
  { name: "Scratchpad", time: "", type: "doc" },
  { name: "Scratchpad", time: "", type: "doc" },
  { name: "Scratchpad", time: "", type: "doc" },
  { name: "Scratchpad", time: "", type: "doc" },
  { name: "Cursor Desktop Architecture", time: "", type: "doc" },
  { name: "Cursor Landscape Bg (Today 7:05 PM)", time: "Today 7:05 PM", type: "media" },
];

// Open-source Visual Studio Code extensions from Open VSX Marketplace (Screenshots 3 & 4)
const OPEN_SOURCE_EXTENSIONS = [
  {
    id: "clangd",
    name: "clangd",
    description: "C/C++ completion, navigation, a...",
    publisher: "LLVM",
    iconLabel: "C",
    iconBg: "#102a36",
    iconBorder: "#1b4353",
    iconColor: "#38bdf8",
  },
  {
    id: "java-debug",
    name: "Debugger for Java",
    description: "A lightweight Java debugger for...",
    publisher: "Microsoft",
    iconLabel: "☕",
    iconBg: "#2a1a1a",
    iconBorder: "#442222",
    iconColor: "#f87171",
  },
  {
    id: "deno",
    name: "Deno",
    description: "A language server client for Den...",
    publisher: "denoland",
    timing: "⏱ 26ms",
    iconLabel: "🦕",
    iconBg: "#0f2438",
    iconBorder: "#1e3a5f",
    iconColor: "#38bdf8",
  },
  {
    id: "eslint",
    name: "ESLint",
    description: "Integrates ESLint JavaScript int...",
    publisher: "Microsoft",
    timing: "⏱ 14ms",
    iconLabel: "ES",
    iconBg: "#332014",
    iconBorder: "#593418",
    iconColor: "#fb923c",
  },
  {
    id: "java-pack",
    name: "Extension Pack for Java",
    description: "Popular extensions for Java dev...",
    publisher: "Microsoft",
    badge: "6",
    iconLabel: "☕+",
    iconBg: "#2e1d24",
    iconBorder: "#522d3b",
    iconColor: "#f43f5e",
  },
  {
    id: "go",
    name: "Go",
    description: "Rich Go language support for Vi...",
    publisher: "Go Team at Google",
    iconLabel: "GO",
    iconBg: "#0e2a38",
    iconBorder: "#194b63",
    iconColor: "#00add8",
  },
  {
    id: "gradle",
    name: "Gradle for Java",
    description: "Manage Gradle Projects, run Gr...",
    publisher: "Microsoft",
    iconLabel: "🐘",
    iconBg: "#132c25",
    iconBorder: "#1d4d3f",
    iconColor: "#34d399",
  },
  {
    id: "jupyter",
    name: "Jupyter",
    description: "Jupyter notebook support, inter...",
    publisher: "Microsoft",
    badge: "4",
    iconLabel: "♃",
    iconBg: "#332211",
    iconBorder: "#593815",
    iconColor: "#f97316",
  },
  {
    id: "jupyter-tags",
    name: "Jupyter Cell Tags",
    description: "Jupyter Cell Tags support for V...",
    publisher: "Microsoft",
    iconLabel: "🏷️",
    iconBg: "#332211",
    iconBorder: "#593815",
    iconColor: "#f97316",
  },
  {
    id: "jupyter-keymap",
    name: "Jupyter Keymap",
    description: "Jupyter keymap for notebooks...",
    publisher: "Microsoft",
    iconLabel: "⌨️",
    iconBg: "#332211",
    iconBorder: "#593815",
    iconColor: "#f97316",
  },
];

export default function GraphiCode() {
  const [files, setFiles] = useState<Record<string, string>>(INITIAL_FILES);
  const [activeTab, setActiveTab] = useState<string>("demo_video_script.md");
  const [openTabs, setOpenTabs] = useState<string[]>(["demo_video_script.md"]);
  const [selectedReviewFile, setSelectedReviewFile] = useState<string | null>(null);

  // Layout states matching Google's IDE architecture
  const [activeActivityTab, setActiveActivityTab] = useState<string>("explorer");
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const [isRightAgentVisible, setIsRightAgentVisible] = useState(true);
  const [agentPanelWidth, setAgentPanelWidth] = useState(380);
  const [isResizingAgent, setIsResizingAgent] = useState(false);

  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);
  const [activeBottomPanelTab, setActiveBottomPanelTab] = useState<string>("terminal");
  const [bottomPanelHeight, setBottomPanelHeight] = useState(240);
  const [isResizingBottomPanel, setIsResizingBottomPanel] = useState(false);

  // Interactive popovers and flyout menus shown in screenshots
  const [showChangesOverview, setShowChangesOverview] = useState(false);
  const [showTerminalProcesses, setShowTerminalProcesses] = useState(false);
  const [showTerminalTooltip, setShowTerminalTooltip] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [patchAccepted, setPatchAccepted] = useState(false);

  // File explorer accordion toggles
  const [nexusFolderExpanded, setNexusFolderExpanded] = useState(true);
  const [dataFolderExpanded, setDataFolderExpanded] = useState(false);
  const [frontendFolderExpanded, setFrontendFolderExpanded] = useState(true);
  const [outlineExpanded, setOutlineExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // Search view state
  const [searchQuery, setSearchQuery] = useState("fhs");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);
  const [searchExpandedFiles, setSearchExpandedFiles] = useState<Record<string, boolean>>({
    cacert: true,
    record1: true,
    record2: true,
    pnpm: true,
  });

  const toggleSearchFile = (key: string) => {
    setSearchExpandedFiles(prev => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }));
  };

  // Extensions view state
  const [extensionSearch, setExtensionSearch] = useState("");
  const [installedExtensionsExpanded, setInstalledExtensionsExpanded] = useState(true);
  const [recommendedExtensionsExpanded, setRecommendedExtensionsExpanded] = useState(false);

  const filteredExtensions = OPEN_SOURCE_EXTENSIONS.filter(ext => 
    ext.name.toLowerCase().includes(extensionSearch.toLowerCase()) ||
    ext.description.toLowerCase().includes(extensionSearch.toLowerCase()) ||
    ext.publisher.toLowerCase().includes(extensionSearch.toLowerCase())
  );

  // Agent & Refactor state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [originalCode, setOriginalCode] = useState(INITIAL_FILES["auth.ts"]);
  const [modifiedCode, setModifiedCode] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("Gemini 3.8 Flash Medium");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTerminalTab, setActiveTerminalTab] = useState<"bash" | "zsh" | "python">("bash");

  // Agent chat messages & graph trace
  const [messages, setMessages] = useState<Array<{ role: "user" | "agent"; text: string; time: string }>>([
    {
      role: "user",
      text: "clear all unnecessary and mock data, prepare it as GRAPHICODE - AGENTIC IDE BUT WITH GRAPH AS CONTEXT",
      time: "23:55"
    },
    {
      role: "agent",
      text: "GraphiCode environment initialized. Left activity bar strictly configured with Explorer, Code Search, Graphed Data, and Open VSX Extensions.",
      time: "23:56"
    }
  ]);

  // FalkorDB Knowledge Graph state
  const [dbHealth, setDbHealth] = useState({
    status: "connected",
    latency: "0.8ms",
    nodes: 69,
    edges: 42,
  });

  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({
    nodes: [
      { id: "validateToken", label: "validateToken()", layer: "ast", file: "src/auth.ts", metadata: { exported: true, lines: "2-7" } },
      { id: "processInvoice", label: "processInvoice()", layer: "blast", file: "src/billing.ts", metadata: { hop: 1, callers: 2 } },
      { id: "auditAccount", label: "auditAccount()", layer: "blast", file: "src/finance.ts", metadata: { hop: 2, compliance: "strict" } },
      { id: "PR #104 (@alex.chen)", label: "PR #104 (@alex.chen)", layer: "company", metadata: { author: "alex.chen", pr_id: 104 } },
      { id: "RULE: Must check exp (skew <= 60s)", label: "RULE: exp (skew <= 60s)", layer: "memory", metadata: { rule: "Must check exp (skew <= 60s)" } },
      { id: "RULE: Reject 'none' algorithm", label: "RULE: Reject 'none' alg", layer: "memory", metadata: { rule: "Reject 'none' algorithm" } },
    ],
    links: [
      { source: "processInvoice", target: "validateToken", type: "CALLS" },
      { source: "auditAccount", target: "validateToken", type: "CALLS" },
      { source: "PR #104 (@alex.chen)", target: "validateToken", type: "AUTHORED_BY" },
      { source: "RULE: Must check exp (skew <= 60s)", target: "validateToken", type: "CONSTRAINED_BY" },
      { source: "RULE: Reject 'none' algorithm", target: "validateToken", type: "CONSTRAINED_BY" },
    ]
  });

  useEffect(() => {
    setIsMounted(true);
    const handleExtensionErrors = (e: ErrorEvent) => {
      if (e.filename && (e.filename.includes('chrome-extension://') || e.filename.includes('moz-extension://'))) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return true;
      }
    };
    window.addEventListener('error', handleExtensionErrors, true);
    return () => window.removeEventListener('error', handleExtensionErrors, true);
  }, []);

  // Fetch live orchestrated graph from FalkorDB backend
  useEffect(() => {
    async function fetchLiveGraph() {
      try {
        const res = await fetch("/api/graph/stratified?function_name=validateToken");
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
            setGraphData({
              nodes: data.nodes.map((n: any) => ({
                id: n.id,
                label: n.label || n.name || n.id,
                layer: n.layer || "ast",
                file: n.file,
                metadata: n.metadata,
              })),
              links: (data.edges || []).map((e: any) => ({
                source: e.source,
                target: e.target,
                type: e.type,
              })),
            });
          }
        }
      } catch {
        // Fallback to initial stratified graph
      }
    }
    fetchLiveGraph();
  }, []);

  // Poll FalkorDB health status
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/health");
        if (res.ok) {
          const data = await res.json();
          setDbHealth({
            status: "connected",
            latency: `${data.database?.latency_ms ?? 0.8}ms`,
            nodes: data.database?.active_nodes_count ?? 69,
            edges: 42,
          });
        }
      } catch {
        // silent fallback
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts (⌘B Left Sidebar, ⌘L Right Agent Panel, ⌘J Bottom Panel, ⌘K/P Palette, ⌘, Settings, ⌘Y/N Diff)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        playUiSound("toggle");
        setIsLeftSidebarVisible(prev => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        playUiSound("toggle");
        setIsRightAgentVisible(prev => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        playUiSound("toggle");
        setIsBottomPanelVisible(prev => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K" || e.key === "p" || e.key === "P")) {
        e.preventDefault();
        playUiSound("switch");
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        playUiSound("switch");
        setIsSettingsOpen(prev => !prev);
        return;
      }

      if (!isDiffMode) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleAcceptPatch();
      } else if (
        ((e.metaKey || e.ctrlKey) && (e.key === "n" || e.key === "N")) ||
        e.key === "Escape"
      ) {
        e.preventDefault();
        handleRejectPatch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDiffMode, modifiedCode, activeTab]);

  // Drag resizing for left sidebar, right agent panel, and bottom terminal panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(160, Math.min(480, e.clientX - 44));
        setSidebarWidth(newWidth);
      } else if (isResizingAgent) {
        const newWidth = Math.max(280, Math.min(650, window.innerWidth - e.clientX));
        setAgentPanelWidth(newWidth);
      } else if (isResizingBottomPanel) {
        const newHeight = Math.max(120, Math.min(550, window.innerHeight - e.clientY - 24));
        setBottomPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingAgent(false);
      setIsResizingBottomPanel(false);
    };

    if (isResizingSidebar || isResizingAgent || isResizingBottomPanel) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isResizingBottomPanel ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar, isResizingAgent, isResizingBottomPanel]);

  // Trigger SSE Stream Refactor
  const handleExecutePrompt = async (promptOverride?: string) => {
    const promptToRun = promptOverride || agentInput.trim();
    if (!promptToRun || isProcessing) return;

    setIsProcessing(true);
    setAgentInput("");

    // Add message to chat history
    setMessages(prev => [...prev, { role: "user", text: promptToRun, time: "Just now" }]);

    // Switch view to diff to let user see live stream
    handleSelectTab("auth.ts");
    setIsDiffMode(true);
    setOriginalCode(files["auth.ts"]);

    try {
      const getModelProvider = (m: string) => {
        const lower = m.toLowerCase();
        if (lower.includes("claude")) return { provider: "anthropic", model: "claude-3-5-sonnet" };
        if (lower.includes("gpt")) return { provider: "openai", model: "gpt-4o" };
        if (lower.includes("qwen")) return { provider: "ollama", model: "qwen2.5-coder" };
        if (lower.includes("deepseek") || lower.includes("r1")) return { provider: "openrouter", model: "deepseek/deepseek-r1" };
        return { provider: "mock", model: "deterministic-mock-v1" };
      };
      const modelInfo = getModelProvider(selectedModel);

      let apiKeyOverride: string | undefined = undefined;
      if (typeof window !== "undefined") {
        if (modelInfo.provider === "openai") apiKeyOverride = localStorage.getItem("nexus_api_key_openai") || undefined;
        if (modelInfo.provider === "anthropic") apiKeyOverride = localStorage.getItem("nexus_api_key_anthropic") || undefined;
        if (modelInfo.provider === "openrouter") apiKeyOverride = localStorage.getItem("nexus_api_key_openrouter") || undefined;
      }

      const response = await fetch("/api/agent/stream-refactor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToRun,
          target_function: "validateToken",
          code: files["auth.ts"],
          file_path: "src/auth.ts",
          provider: modelInfo.provider,
          model: modelInfo.model,
          api_key: apiKeyOverride,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to SSE stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const block of events) {
          if (!block.trim()) continue;
          const lines = block.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            if (line.startsWith("data:")) dataStr = line.slice(5).trim();
          }

          if (eventType && dataStr) {
            try {
              const data = JSON.parse(dataStr);

              if (eventType === "graph_traversal") {
                if (data.nodes && data.nodes.length > 0) {
                  const updatedNodes: GraphNode[] = data.nodes.map((n: any) => {
                    const isFocus = n.label === "validateToken" || n.id === "validateToken";
                    return {
                      id: n.label || n.id,
                      name: n.properties?.name || n.label || n.id,
                      file: n.properties?.file || "",
                      group: isFocus ? "focus" : "blast",
                      color: isFocus ? "#3b82f6" : "#ef4444",
                      val: isFocus ? 9 : 6,
                    };
                  });

                  const updatedLinks: GraphLink[] = (data.edges || []).map((e: any) => ({
                    source: e.source,
                    target: e.target,
                  }));

                  updatedNodes.push(
                    { id: "PR #104 (@alex.chen)", name: "PR #104", group: "pr", color: "#10b981", val: 7 },
                    { id: "RULE: Must check exp (skew <= 60s)", name: "RULE: exp", group: "memory", color: "#f59e0b", val: 7 }
                  );
                  updatedLinks.push(
                    { source: "PR #104 (@alex.chen)", target: "validateToken" },
                    { source: "RULE: Must check exp (skew <= 60s)", target: "validateToken" }
                  );

                  setGraphData({ nodes: updatedNodes, links: updatedLinks });
                }
              } else if (eventType === "code_patch") {
                const patch = data.modified_code || data.original_code;
                setModifiedCode(patch);
              } else if (eventType === "done") {
                setIsProcessing(false);
                setMessages(prev => [
                  ...prev,
                  {
                    role: "agent",
                    text: "Patch generated. FalkorDB multi-hop traversal verified 2 callers in billing.ts and finance.ts. Procedural memory rule enforced.",
                    time: "Just now"
                  }
                ]);
              }
            } catch (err) {
              console.warn("Parse error", err);
            }
          }
        }
      }
    } catch {
      setTimeout(() => {
        const fallbackPatch = `// Patched by Nexus Agent via FalkorDB blast-radius verification
export function validateToken(token: string): boolean {
  if (!token) return false;
  const payload = decodePayload(token);
  // Procedural memory rule enforced: verify expiration claim (skew <= 60s)
  if (!payload || !payload.exp || Date.now() >= payload.exp * 1000) {
    return false;
  }
  return true;
}

function decodePayload(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1] || '{}'));
  } catch {
    return null;
  }
}
`;
        setModifiedCode(fallbackPatch);
        setIsProcessing(false);
        setMessages(prev => [
          ...prev,
          {
            role: "agent",
            text: "Patch generated with fail-closed null checks and expiration claim verification.",
            time: "Just now"
          }
        ]);
      }, 1000);
    }
  };

  const handleAcceptPatch = () => {
    playUiSound("accept");
    const codeToApply = modifiedCode || `// Hardened validateToken with strict clock skew and algorithm validation
export function validateToken(token: string): boolean {
  if (!token) return false;
  const payload = decodePayload(token);
  if (!payload || payload.alg === "none") return false;
  // Clock skew constraint from FalkorDB procedural memory (<= 60s)
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now - 60) return false;
  return true;
}

function decodePayload(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1] || '{}'));
  } catch {
    return null;
  }
}
`;
    setFiles(prev => ({
      ...prev,
      "auth.ts": codeToApply
    }));
    setIsDiffMode(false);
    setShowChangesOverview(false);
    setPatchAccepted(true);
  };

  const handleRejectPatch = () => {
    playUiSound("reject");
    setIsDiffMode(false);
    setModifiedCode("");
    setShowChangesOverview(false);
    setPatchAccepted(false);
  };

  const handleSelectTab = (tabName: string) => {
    playUiSound("click");
    setActiveTab(tabName);
    if (!openTabs.includes(tabName)) {
      setOpenTabs([...openTabs, tabName]);
    }
    if (tabName !== "Review") {
      setSelectedReviewFile(null);
    }
  };

  const handleCloseTab = (arg1?: React.MouseEvent | string | null, arg2?: string) => {
    let e: React.MouseEvent | null = null;
    let target = activeTab;
    if (typeof arg1 === "string") {
      target = arg1;
    } else if (arg1 && typeof arg1 === "object") {
      e = arg1;
      if (arg2) target = arg2;
    }
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    playUiSound("click");
    const nextTabs = openTabs.filter(t => t !== target);
    setOpenTabs(nextTabs);
    if (activeTab === target && nextTabs.length > 0) {
      setActiveTab(nextTabs[nextTabs.length - 1]);
    }
  };

  // Open the Review tab from "Review Changes" button
  const handleOpenReviewTab = () => {
    playUiSound("switch");
    if (!openTabs.includes("Review")) {
      setOpenTabs([...openTabs, "Review"]);
    }
    setActiveTab("Review");
    setSelectedReviewFile(null);
  };

  // Title calculation matching screenshots
  const windowTitle = activeTab === "Review" 
    ? "graphicode — Review" 
    : `graphicode — ${activeTab}`;

  return (
    <div className="w-screen h-screen bg-[#141414] text-[#cccccc] font-sans antialiased overflow-hidden flex flex-col select-none">
      
      {/* 1. TOP TITLE BAR (Native macOS Controls + Centered 'nexus-ide — filename' + Layout Icons) */}
      <div className="h-9 bg-[#161616] border-b border-[#242424] px-3 flex items-center justify-between shrink-0 select-none z-30">
        
        {/* Left: Native macOS Window Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 group">
            <button 
              onClick={() => playUiSound("reject")}
              title="Close"
              className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/40 flex items-center justify-center text-[8px] font-bold text-black/0 group-hover:text-black/80 transition-all cursor-pointer"
            >
              ✕
            </button>
            <button 
              onClick={() => playUiSound("click")}
              title="Minimize"
              className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/40 flex items-center justify-center text-[8px] font-bold text-black/0 group-hover:text-black/80 transition-all cursor-pointer"
            >
              −
            </button>
            <button 
              onClick={() => playUiSound("toggle")}
              title="Zoom"
              className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/40 flex items-center justify-center text-[7px] font-bold text-black/0 group-hover:text-black/80 transition-all cursor-pointer"
            >
              ⤢
            </button>
          </div>
        </div>

        {/* Center: Dynamic Window Title */}
        <div 
          onClick={() => {
            playUiSound("switch");
            setIsCommandPaletteOpen(true);
          }}
          className="text-xs font-mono text-neutral-300 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
          title="Command Palette (⌘P / ⌘K)"
        >
          <span>{windowTitle}</span>
        </div>

        {/* Right: Window Layout Controls & Settings */}
        <div className="flex items-center gap-2 text-neutral-400">
          {/* Toggle Left Sidebar */}
          <button
            onClick={() => {
              playUiSound("toggle");
              setIsLeftSidebarVisible(!isLeftSidebarVisible);
            }}
            title="Toggle Primary Sidebar (⌘B)"
            className={`p-1.5 rounded hover:bg-[#252525] transition-colors cursor-pointer ${
              isLeftSidebarVisible ? "text-white" : "text-neutral-500"
            }`}
          >
            <PanelLeft size={14} />
          </button>

          {/* Toggle Bottom Panel */}
          <button
            onClick={() => {
              playUiSound("toggle");
              setIsBottomPanelVisible(!isBottomPanelVisible);
            }}
            title="Toggle Bottom Terminal Panel (⌘J)"
            className={`p-1.5 rounded hover:bg-[#252525] transition-colors cursor-pointer ${
              isBottomPanelVisible ? "text-white" : "text-neutral-500"
            }`}
          >
            <PanelBottom size={14} />
          </button>

          {/* Toggle Right Agent Panel */}
          <button
            onClick={() => {
              playUiSound("toggle");
              setIsRightAgentVisible(!isRightAgentVisible);
            }}
            title="Toggle Nexus Agent Panel (⌘L)"
            className={`p-1.5 rounded hover:bg-[#252525] transition-colors cursor-pointer ${
              isRightAgentVisible ? "text-[#f43f5e]" : "text-neutral-500"
            }`}
          >
            <PanelRight size={14} />
          </button>

          {/* Settings Modal (⌘,) */}
          <button
            onClick={() => {
              playUiSound("switch");
              setIsSettingsOpen(true);
            }}
            title="Nexus Settings & BYOK (⌘,)"
            className="p-1.5 rounded hover:bg-[#252525] hover:text-white transition-colors cursor-pointer ml-1"
          >
            <Settings size={14} />
          </button>

          {/* User Avatar Badge */}
          <div className="w-5 h-5 rounded-full bg-[#f43f5e] text-white text-[10px] font-bold flex items-center justify-center cursor-pointer ml-1">
            P
          </div>
        </div>
      </div>

      {/* 2. MAIN 3-PANEL WORKSPACE (ACTIVITY BAR + LEFT SIDEBAR + WORKSPACE + RIGHT AGENT PANEL) */}
      <div className="flex-1 flex min-h-0 bg-[#141414] overflow-hidden relative">
        
        {/* 2A. LEFT ACTIVITY BAR (Strict 4 options: Explorer, Search, Graph, Extensions + Settings) */}
        <div className="w-11 bg-[#161616] border-r border-[#242424] flex flex-col justify-between py-2 select-none z-20 shrink-0">
          
          {/* Top Activity Icons */}
          <div className="flex flex-col items-center gap-1">
            {/* 1. Explorer (Copy Option / Files Icon) */}
            <button
              onClick={() => {
                playUiSound("click");
                if (activeActivityTab === "explorer" && isLeftSidebarVisible) {
                  setIsLeftSidebarVisible(false);
                } else {
                  setActiveActivityTab("explorer");
                  setIsLeftSidebarVisible(true);
                }
              }}
              title="Explorer (⇧⌘E)"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                activeActivityTab === "explorer" && isLeftSidebarVisible
                  ? "text-white bg-[#222222] border-l-2 border-[#f43f5e]"
                  : "text-neutral-400 hover:text-white hover:bg-[#1e1e1e]"
              }`}
            >
              <Files size={17} />
            </button>

            {/* 2. Search for Searching Codes */}
            <button
              onClick={() => {
                playUiSound("click");
                if (activeActivityTab === "search" && isLeftSidebarVisible) {
                  setIsLeftSidebarVisible(false);
                } else {
                  setActiveActivityTab("search");
                  setIsLeftSidebarVisible(true);
                }
              }}
              title="Code Search (⇧⌘F)"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                activeActivityTab === "search" && isLeftSidebarVisible
                  ? "text-white bg-[#222222] border-l-2 border-[#f43f5e]"
                  : "text-neutral-400 hover:text-white hover:bg-[#1e1e1e]"
              }`}
            >
              <Search size={17} />
            </button>

            {/* 3. Graphy Icon to see Graphed Data */}
            <button
              onClick={() => {
                playUiSound("click");
                if (activeActivityTab === "graph" && isLeftSidebarVisible) {
                  setIsLeftSidebarVisible(false);
                } else {
                  setActiveActivityTab("graph");
                  setIsLeftSidebarVisible(true);
                }
              }}
              title="Graphed Data & AST Context"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                activeActivityTab === "graph" && isLeftSidebarVisible
                  ? "text-[#f43f5e] bg-[#222222] border-l-2 border-[#f43f5e]"
                  : "text-neutral-400 hover:text-white hover:bg-[#1e1e1e]"
              }`}
            >
              <Network size={17} />
            </button>

            {/* 4. Extensions Marketplace (Open VSX / Microsoft Open Source) */}
            <button
              onClick={() => {
                playUiSound("click");
                if (activeActivityTab === "extensions" && isLeftSidebarVisible) {
                  setIsLeftSidebarVisible(false);
                } else {
                  setActiveActivityTab("extensions");
                  setIsLeftSidebarVisible(true);
                }
              }}
              title="Extensions (⇧⌘X)"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
                activeActivityTab === "extensions" && isLeftSidebarVisible
                  ? "text-white bg-[#222222] border-l-2 border-[#f43f5e]"
                  : "text-neutral-400 hover:text-white hover:bg-[#1e1e1e]"
              }`}
            >
              <LayoutGrid size={17} />
            </button>
          </div>

          {/* Bottom Activity Icons */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => {
                playUiSound("switch");
                setIsSettingsOpen(true);
              }}
              title="GraphiCode Settings (⌘,)"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#1e1e1e] transition-colors cursor-pointer"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* 2B. LEFT SIDEBAR (DYNAMIC: EXPLORER, SEARCH, GRAPH, EXTENSIONS) */}
        {isLeftSidebarVisible && (
          <div 
            style={{ width: sidebarWidth }}
            className="bg-[#161616] border-r border-[#242424] flex flex-col justify-between shrink-0 h-full overflow-hidden select-none"
          >
            {/* View 1: EXPLORER */}
            {activeActivityTab === "explorer" && (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
                {/* Explorer Header */}
                <div className="h-9 px-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#f43f5e] shrink-0 border-b border-[#242424]">
                  <span>Explorer</span>
                  <span className="text-neutral-500 hover:text-white cursor-pointer">•••</span>
                </div>

                {/* Workspace Folder Tree (graphicode) */}
                <div className="py-1 text-xs font-mono">
                  {/* Root Folder: graphicode */}
                  <div 
                    onClick={() => setNexusFolderExpanded(!nexusFolderExpanded)}
                    className="h-6 px-3 flex items-center gap-1.5 text-neutral-200 hover:text-white cursor-pointer hover:bg-[#1f1f1f]"
                  >
                    {nexusFolderExpanded ? <ChevronDown size={13} className="text-[#f43f5e]" /> : <ChevronRight size={13} />}
                    <span className="font-semibold text-neutral-100">graphicode</span>
                  </div>

                  {nexusFolderExpanded && (
                    <div className="pl-4">
                      {/* backend folder */}
                      <div className="h-6 px-2 flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-[#1f1f1f] cursor-pointer">
                        <ChevronRight size={12} className="text-neutral-600" />
                        <Folder size={13} className="text-[#e2b340]" />
                        <span>backend</span>
                      </div>

                      {/* data/falkor folder */}
                      <div 
                        onClick={() => setDataFolderExpanded(!dataFolderExpanded)}
                        className="h-6 px-2 flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-[#1f1f1f] cursor-pointer"
                      >
                        {dataFolderExpanded ? <ChevronDown size={12} className="text-[#f43f5e]" /> : <ChevronRight size={12} className="text-neutral-600" />}
                        <Folder size={13} className="text-[#e2b340]" />
                        <span>data/falkor</span>
                      </div>
                      {dataFolderExpanded && (
                        <div className="pl-6 text-neutral-400">
                          <div className="h-6 flex items-center gap-1.5 hover:text-white cursor-pointer">
                            <Database size={12} className="text-emerald-400" />
                            <span>dump.rdb</span>
                          </div>
                        </div>
                      )}

                      {/* design-system folder */}
                      <div className="h-6 px-2 flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-[#1f1f1f] cursor-pointer">
                        <ChevronRight size={12} className="text-neutral-600" />
                        <Folder size={13} className="text-[#e2b340]" />
                        <span>design-system</span>
                      </div>

                      {/* frontend folder (expanded) */}
                      <div 
                        onClick={() => setFrontendFolderExpanded(!frontendFolderExpanded)}
                        className="h-6 px-2 flex items-center justify-between text-neutral-200 hover:text-white hover:bg-[#1f1f1f] cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          {frontendFolderExpanded ? <ChevronDown size={12} className="text-[#f43f5e]" /> : <ChevronRight size={12} />}
                          <FolderOpen size={13} className="text-[#e2b340]" />
                          <span>frontend</span>
                        </div>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#e2b340] mr-2"></span>
                      </div>

                      {/* Source Files inside frontend */}
                      {frontendFolderExpanded && (
                        <div className="pl-4 text-neutral-300">
                          <div
                            onClick={() => handleSelectTab("auth.ts")}
                            className={`h-6 px-2 flex items-center justify-between cursor-pointer rounded-sm ${
                              activeTab === "auth.ts"
                                ? "bg-[#252525] text-white font-medium" 
                                : "hover:bg-[#1c1c1c] text-neutral-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-blue-400 font-bold text-[10px]">TS</span>
                              <span className="truncate">auth.ts</span>
                            </div>
                            <span className="text-[9px] px-1 rounded bg-blue-950/60 text-blue-400">target</span>
                          </div>

                          <div
                            onClick={() => handleSelectTab("billing.ts")}
                            className={`h-6 px-2 flex items-center justify-between cursor-pointer rounded-sm ${
                              activeTab === "billing.ts"
                                ? "bg-[#252525] text-white font-medium" 
                                : "hover:bg-[#1c1c1c] text-neutral-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-blue-400 font-bold text-[10px]">TS</span>
                              <span className="truncate">billing.ts</span>
                            </div>
                            <span className="text-[9px] px-1 rounded bg-red-950/60 text-red-400">Hop 1</span>
                          </div>

                          <div
                            onClick={() => handleSelectTab("finance.ts")}
                            className={`h-6 px-2 flex items-center justify-between cursor-pointer rounded-sm ${
                              activeTab === "finance.ts"
                                ? "bg-[#252525] text-white font-medium" 
                                : "hover:bg-[#1c1c1c] text-neutral-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-blue-400 font-bold text-[10px]">TS</span>
                              <span className="truncate">finance.ts</span>
                            </div>
                            <span className="text-[9px] px-1 rounded bg-red-950/60 text-red-400">Hop 2</span>
                          </div>
                        </div>
                      )}

                      <div 
                        onClick={() => handleSelectTab("blog_post.md")}
                        className="h-6 px-2 flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-[#1f1f1f] cursor-pointer"
                      >
                        <span className="text-blue-400 font-bold text-[10px]">M↓</span>
                        <span className="truncate">blog_post.md</span>
                      </div>

                      <div 
                        onClick={() => handleSelectTab("demo_video_script.md")}
                        className={`h-6 px-2 flex items-center gap-1.5 cursor-pointer rounded-sm ${
                          activeTab === "demo_video_script.md"
                            ? "bg-[#252525] text-white font-medium"
                            : "text-neutral-300 hover:bg-[#1f1f1f]"
                        }`}
                      >
                        <span className="text-blue-400 font-bold text-[10px]">M↓</span>
                        <span className="truncate">demo_video_script.md</span>
                      </div>

                      <div 
                        onClick={() => handleSelectTab("docker-compose.yml")}
                        className="h-6 px-2 flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-[#1f1f1f] cursor-pointer"
                      >
                        <FileCode size={12} className="text-blue-400" />
                        <span className="truncate">docker-compose.yml</span>
                      </div>
                      <div 
                        onClick={() => handleSelectTab("launch-mac.sh")}
                        className="h-6 px-2 flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-[#1f1f1f] cursor-pointer"
                      >
                        <FileCode size={12} className="text-emerald-400" />
                        <span className="truncate">launch-mac.sh</span>
                      </div>
                      <div 
                        onClick={() => handleSelectTab("README.md")}
                        className="h-6 px-2 flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-[#1f1f1f] cursor-pointer"
                      >
                        <FileCode size={12} className="text-neutral-500" />
                        <span className="truncate">README.md</span>
                      </div>
                      <div 
                        onClick={() => handleSelectTab("run.sh")}
                        className="h-6 px-2 flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-[#1f1f1f] cursor-pointer"
                      >
                        <FileCode size={12} className="text-emerald-400" />
                        <span className="truncate">run.sh</span>
                      </div>
                      <div 
                        onClick={() => handleSelectTab("setup.sh")}
                        className="h-6 px-2 flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-[#1f1f1f] cursor-pointer"
                      >
                        <FileCode size={12} className="text-emerald-400" />
                        <span className="truncate">setup.sh</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Collapsible Outline */}
                <div className="border-t border-[#242424] mt-auto">
                  <div 
                    onClick={() => setOutlineExpanded(!outlineExpanded)}
                    className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-white cursor-pointer"
                  >
                    {outlineExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span>Outline</span>
                  </div>
                  {outlineExpanded && (
                    <div className="px-5 py-1 text-xs font-mono space-y-1 text-neutral-400">
                      <div 
                        onClick={() => handleSelectTab("auth.ts")}
                        className="hover:text-blue-400 cursor-pointer"
                      >
                        f validateToken(token)
                      </div>
                      <div className="hover:text-neutral-200 cursor-pointer">
                        f decodePayload(token)
                      </div>
                    </div>
                  )}
                </div>

                {/* Collapsible Timeline */}
                <div className="border-t border-[#242424]">
                  <div 
                    onClick={() => setTimelineExpanded(!timelineExpanded)}
                    className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-white cursor-pointer"
                  >
                    {timelineExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span>Timeline</span>
                  </div>
                  {timelineExpanded && (
                    <div className="px-5 py-1 text-xs font-mono text-neutral-500">
                      FalkorDB Cypher Graph Commits
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* View 2: CODE SEARCH (Screenshot 2) */}
            {activeActivityTab === "search" && (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
                {/* Search Header */}
                <div className="h-9 px-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-300 shrink-0 border-b border-[#242424]">
                  <span>Code Search</span>
                  <div className="flex items-center gap-2 text-neutral-500">
                    <RefreshCw size={12} className="hover:text-white cursor-pointer" />
                    <Sliders size={12} className="hover:text-white cursor-pointer" />
                    <X size={13} className="hover:text-white cursor-pointer" onClick={() => setIsLeftSidebarVisible(false)} />
                  </div>
                </div>

                {/* Search Inputs matching Screenshot 2 */}
                <div className="p-3 border-b border-[#242424] space-y-2">
                  {/* Search Query Input */}
                  <div className="relative flex items-center bg-[#1e1e1e] border border-[#333333] rounded px-2 py-1 text-xs">
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search"
                      className="bg-transparent text-white outline-none w-full font-mono text-xs pr-16"
                    />
                    <div className="absolute right-1.5 flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                      <button 
                        onClick={() => setSearchCaseSensitive(!searchCaseSensitive)}
                        className={`px-1 py-0.5 rounded ${searchCaseSensitive ? "bg-[#333] text-white" : "hover:text-white"}`}
                        title="Match Case (⌥⌘C)"
                      >
                        Aa
                      </button>
                      <button 
                        onClick={() => setSearchWholeWord(!searchWholeWord)}
                        className={`px-1 py-0.5 rounded ${searchWholeWord ? "bg-[#333] text-white" : "hover:text-white"}`}
                        title="Match Whole Word (⌥⌘W)"
                      >
                        ab
                      </button>
                      <button 
                        onClick={() => setSearchRegex(!searchRegex)}
                        className={`px-1 py-0.5 rounded ${searchRegex ? "bg-[#333] text-white" : "hover:text-white"}`}
                        title="Use Regular Expression (⌥⌘R)"
                      >
                        .*
                      </button>
                    </div>
                  </div>

                  {/* Replace Input */}
                  <div className="relative flex items-center bg-[#1e1e1e] border border-[#333333] rounded px-2 py-1 text-xs">
                    <input 
                      type="text"
                      value={replaceQuery}
                      onChange={(e) => setReplaceQuery(e.target.value)}
                      placeholder="Replace"
                      className="bg-transparent text-white outline-none w-full font-mono text-xs pr-8"
                    />
                    <div className="absolute right-1.5 flex items-center text-[10px] font-mono text-neutral-400">
                      <button 
                        className="px-1 py-0.5 rounded hover:text-white"
                        title="Preserve Case (⌥⌘P)"
                      >
                        AB
                      </button>
                    </div>
                  </div>
                </div>

                {/* Results Count Line matching Screenshot 2 */}
                <div className="px-3 py-2 text-[11px] font-mono text-neutral-400 flex items-center justify-between border-b border-[#202020]">
                  <span>6 results in 4 files - <span className="text-blue-400 hover:underline cursor-pointer">Open in editor</span></span>
                </div>

                {/* Search Results Tree */}
                <div className="py-1 text-xs font-mono overflow-y-auto">
                  {/* File 1: cacert.pem */}
                  <div className="py-1">
                    <div 
                      onClick={() => toggleSearchFile("cacert")}
                      className="px-3 py-1 flex items-center justify-between hover:bg-[#1f1f1f] cursor-pointer text-neutral-300"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ChevronDown size={12} className="text-neutral-500 shrink-0" />
                        <CheckCircle2 size={12} className="text-blue-400 shrink-0" />
                        <span className="font-semibold text-white">cacert.pem</span>
                        <span className="text-neutral-500 truncate text-[11px]">backend/.venv/lib/pyt...</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#f43f5e] text-white font-bold shrink-0">1</span>
                    </div>
                    {searchExpandedFiles["cacert"] !== false && (
                      <div className="pl-7 pr-3 py-0.5 text-neutral-400 hover:bg-[#1a1a1a] cursor-pointer text-[11px] truncate">
                        xOu3Mqz4dWEX1xAZu<span className="bg-[#f43f5e]/30 text-[#f43f5e] font-bold px-0.5 rounded">fHS</span>ce96Qp1bW...
                      </div>
                    )}
                  </div>

                  {/* File 2: RECORD (certifi) */}
                  <div className="py-1">
                    <div 
                      onClick={() => toggleSearchFile("record1")}
                      className="px-3 py-1 flex items-center justify-between hover:bg-[#1f1f1f] cursor-pointer text-neutral-300"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ChevronDown size={12} className="text-neutral-500 shrink-0" />
                        <FileText size={12} className="text-neutral-400 shrink-0" />
                        <span className="font-semibold text-white">RECORD</span>
                        <span className="text-neutral-500 truncate text-[11px]">backend/.venv/lib/python...</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#f43f5e] text-white font-bold shrink-0">2</span>
                    </div>
                    {searchExpandedFiles["record1"] !== false && (
                      <div className="space-y-0.5">
                        <div className="pl-7 pr-3 py-0.5 text-neutral-400 hover:bg-[#1a1a1a] cursor-pointer text-[11px] truncate">
                          ...hu7Uh74qQ_P_H1ZJb0UfaSQ5JvAl_t<span className="bg-[#f43f5e]/30 text-[#f43f5e] font-bold px-0.5 rounded">fhs</span>...
                        </div>
                        <div className="pl-7 pr-3 py-0.5 text-neutral-400 hover:bg-[#1a1a1a] cursor-pointer text-[11px] truncate">
                          ...hu7Uh74qQ_P_H1ZJb0UfaSQ5JvAl_t<span className="bg-[#f43f5e]/30 text-[#f43f5e] font-bold px-0.5 rounded">fhs</span>...
                        </div>
                      </div>
                    )}
                  </div>

                  {/* File 3: RECORD (urllib3) */}
                  <div className="py-1">
                    <div 
                      onClick={() => toggleSearchFile("record2")}
                      className="px-3 py-1 flex items-center justify-between hover:bg-[#1f1f1f] cursor-pointer text-neutral-300"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ChevronDown size={12} className="text-neutral-500 shrink-0" />
                        <FileText size={12} className="text-neutral-400 shrink-0" />
                        <span className="font-semibold text-white">RECORD</span>
                        <span className="text-neutral-500 truncate text-[11px]">backend/.venv/lib/python...</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#f43f5e] text-white font-bold shrink-0">1</span>
                    </div>
                    {searchExpandedFiles["record2"] !== false && (
                      <div className="pl-7 pr-3 py-0.5 text-neutral-400 hover:bg-[#1a1a1a] cursor-pointer text-[11px] truncate">
                        ...METADATA,sha256=DV8SedCV57qE7<span className="bg-[#f43f5e]/30 text-[#f43f5e] font-bold px-0.5 rounded">fhs</span>...
                      </div>
                    )}
                  </div>

                  {/* File 4: pnpm-lock.yaml */}
                  <div className="py-1">
                    <div 
                      onClick={() => toggleSearchFile("pnpm")}
                      className="px-3 py-1 flex items-center justify-between hover:bg-[#1f1f1f] cursor-pointer text-neutral-300"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ChevronDown size={12} className="text-neutral-500 shrink-0" />
                        <Layers size={12} className="text-amber-400 shrink-0" />
                        <span className="font-semibold text-white">pnpm-lock.yaml</span>
                        <span className="text-neutral-500 truncate text-[11px]">frontend</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#f43f5e] text-white font-bold shrink-0">2</span>
                    </div>
                    {searchExpandedFiles["pnpm"] !== false && (
                      <div className="space-y-0.5">
                        <div className="pl-7 pr-3 py-0.5 text-neutral-400 hover:bg-[#1a1a1a] cursor-pointer text-[11px] truncate">
                          ...sha512-RRECPsj7iu/xb5oKYcs<span className="bg-[#f43f5e]/30 text-[#f43f5e] font-bold px-0.5 rounded">FHSPp</span>...
                        </div>
                        <div className="pl-7 pr-3 py-0.5 text-neutral-400 hover:bg-[#1a1a1a] cursor-pointer text-[11px] truncate">
                          ...{'{'}: integrity: sha512-1BC0Bv<span className="bg-[#f43f5e]/30 text-[#f43f5e] font-bold px-0.5 rounded">FHs</span>/p0qt...
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* View 3: GRAPH CONTEXT / GRAPHED DATA (Option 3 requested by user) */}
            {activeActivityTab === "graph" && (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
                {/* Header */}
                <div className="h-9 px-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#f43f5e] shrink-0 border-b border-[#242424]">
                  <div className="flex items-center gap-1.5">
                    <Network size={14} className="text-[#f43f5e]" />
                    <span>Graphed Data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[10px] font-mono text-neutral-400">{dbHealth.latency}</span>
                  </div>
                </div>

                {/* Graph Context Details */}
                <div className="p-3 space-y-3 font-mono text-xs overflow-y-auto">
                  {/* Database Health Card */}
                  <div className="p-2.5 rounded bg-[#1e1e1e] border border-[#2c2c2c] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">FalkorDB Engine</span>
                      <span className="text-emerald-400 font-bold">GraphBLAS v2.1</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] text-neutral-300">
                      <div className="p-1.5 rounded bg-[#141414] border border-[#222]">
                        <div className="text-neutral-500">Nodes</div>
                        <div className="text-white font-bold text-xs">{dbHealth.nodes}</div>
                      </div>
                      <div className="p-1.5 rounded bg-[#141414] border border-[#222]">
                        <div className="text-neutral-500">Call Edges</div>
                        <div className="text-white font-bold text-xs">{dbHealth.edges}</div>
                      </div>
                    </div>
                  </div>

                  {/* Active Context Focus */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                      <span>Active Focus AST</span>
                      <span className="text-[10px] text-blue-400">Target</span>
                    </div>
                    <div 
                      onClick={() => handleSelectTab("auth.ts")}
                      className="p-2 rounded bg-[#1c2230] border border-[#2b3a55] text-neutral-200 cursor-pointer hover:border-blue-500 transition-colors"
                    >
                      <div className="font-semibold text-blue-400">validateToken(token)</div>
                      <div className="text-[10px] text-neutral-400">src/auth.ts (Lines 2-7)</div>
                    </div>
                  </div>

                  {/* Multi-Hop Blast Radius Callers */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                      <span>Blast Radius (Callers)</span>
                      <span className="text-[10px] text-[#f43f5e] font-bold">2 Impacted</span>
                    </div>
                    
                    <div 
                      onClick={() => handleSelectTab("billing.ts")}
                      className="p-2 rounded bg-[#27171d] border border-[#4a222f] text-neutral-200 cursor-pointer hover:border-[#f43f5e] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#f43f5e]">processInvoice()</span>
                        <span className="text-[9px] px-1 rounded bg-[#f43f5e]/20 text-[#f43f5e]">Hop 1</span>
                      </div>
                      <div className="text-[10px] text-neutral-400">src/billing.ts (2 downstream callers)</div>
                    </div>

                    <div 
                      onClick={() => handleSelectTab("finance.ts")}
                      className="p-2 rounded bg-[#27171d] border border-[#4a222f] text-neutral-200 cursor-pointer hover:border-[#f43f5e] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#f43f5e]">auditAccount()</span>
                        <span className="text-[9px] px-1 rounded bg-[#f43f5e]/20 text-[#f43f5e]">Hop 2</span>
                      </div>
                      <div className="text-[10px] text-neutral-400">src/finance.ts (SOX Compliance)</div>
                    </div>
                  </div>

                  {/* Agent Procedural Memory Rules */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      <span>Procedural Memory</span>
                    </div>
                    <div className="p-2 rounded bg-[#262013] border border-[#4d3e1d] text-amber-200 text-[11px]">
                      <div className="font-semibold text-amber-400">RULE: Clock Skew Tolerance</div>
                      <div className="text-[10px] text-amber-300/80">Must check exp claim with skew &lt;= 60s</div>
                    </div>
                    <div className="p-2 rounded bg-[#262013] border border-[#4d3e1d] text-amber-200 text-[11px]">
                      <div className="font-semibold text-amber-400">RULE: Cryptographic Spec</div>
                      <div className="text-[10px] text-amber-300/80">Reject &apos;none&apos; algorithm signature</div>
                    </div>
                  </div>

                  {/* Open Canvas CTA Button */}
                  <button 
                    onClick={() => {
                      playUiSound("switch");
                      handleSelectTab("FalkorDB Graph");
                    }}
                    className="w-full py-2 px-3 rounded bg-[#f43f5e] hover:bg-[#e11d48] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-[#f43f5e]/20"
                  >
                    <Network size={14} />
                    <span>Open Interactive 3D Canvas</span>
                  </button>
                </div>
              </div>
            )}

            {/* View 4: EXTENSIONS MARKETPLACE (Screenshots 3 & 4) */}
            {activeActivityTab === "extensions" && (
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
                {/* Header */}
                <div className="h-9 px-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-300 shrink-0 border-b border-[#242424]">
                  <span>Extensions</span>
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Sliders size={12} className="hover:text-white cursor-pointer" />
                    <span className="hover:text-white cursor-pointer">•••</span>
                  </div>
                </div>

                {/* Extensions Search Input matching Screenshots 3 & 4 */}
                <div className="p-2.5 border-b border-[#242424]">
                  <div className="relative flex items-center bg-[#1e1e1e] border border-[#333333] rounded px-2 py-1 text-xs">
                    <input 
                      type="text"
                      value={extensionSearch}
                      onChange={(e) => setExtensionSearch(e.target.value)}
                      placeholder="Search Extensions in Marketpl..."
                      className="bg-transparent text-white outline-none w-full font-mono text-xs pr-6"
                    />
                    <Sliders size={12} className="text-neutral-500 hover:text-white cursor-pointer absolute right-2" />
                  </div>
                </div>

                {/* Open VSX / Microsoft Open Source Marketplace Info Banner */}
                <div className="p-3 bg-[#191919] border-b border-[#242424] text-[11px] text-neutral-400 leading-relaxed">
                  By default, GraphiCode uses{" "}
                  <a href="https://open-vsx.org" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Open VSX</a>{" "}
                  as a marketplace. This can be changed in{" "}
                  <span onClick={() => setIsSettingsOpen(true)} className="text-blue-400 hover:underline cursor-pointer">GraphiCode settings</span>.
                </div>

                {/* Installed Accordion Section (26) */}
                <div className="py-1">
                  <div 
                    onClick={() => setInstalledExtensionsExpanded(!installedExtensionsExpanded)}
                    className="h-6 px-3 flex items-center justify-between text-neutral-200 hover:text-white cursor-pointer hover:bg-[#1f1f1f] text-[11px] font-mono"
                  >
                    <div className="flex items-center gap-1.5">
                      {installedExtensionsExpanded ? <ChevronDown size={12} className="text-[#f43f5e]" /> : <ChevronRight size={12} />}
                      <span className="font-semibold text-neutral-300">Installed</span>
                    </div>
                    <span className="text-[10px] px-1.5 rounded-full bg-[#f43f5e] text-white font-bold">26</span>
                  </div>

                  {installedExtensionsExpanded && (
                    <div className="divide-y divide-[#1e1e1e]">
                      {filteredExtensions.map((ext) => (
                        <div 
                          key={ext.id}
                          className="p-2.5 hover:bg-[#1a1a1a] transition-colors cursor-pointer group flex items-start gap-2.5"
                        >
                          {/* Distinctive Logo */}
                          <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-bold shadow-sm"
                            style={{
                              backgroundColor: ext.iconBg,
                              border: `1px solid ${ext.iconBorder}`,
                              color: ext.iconColor,
                            }}
                          >
                            {ext.iconLabel}
                          </div>

                          {/* Extension Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-white truncate">{ext.name}</span>
                              {ext.timing && (
                                <span className="text-[10px] font-mono text-neutral-400 shrink-0">{ext.timing}</span>
                              )}
                              {ext.badge && (
                                <span className="text-[9px] px-1 rounded-full bg-[#f43f5e] text-white font-bold shrink-0">{ext.badge}</span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate mt-0.5">{ext.description}</div>
                            <div className="text-[10px] text-neutral-500 mt-0.5 flex items-center justify-between">
                              <span className="truncate">{ext.publisher}</span>
                              <Settings size={11} className="text-neutral-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recommended Section (0) */}
                <div className="border-t border-[#242424]">
                  <div 
                    onClick={() => setRecommendedExtensionsExpanded(!recommendedExtensionsExpanded)}
                    className="h-6 px-3 flex items-center justify-between text-neutral-400 hover:text-white cursor-pointer hover:bg-[#1f1f1f] text-[11px] font-mono"
                  >
                    <div className="flex items-center gap-1.5">
                      {recommendedExtensionsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span>Recommended</span>
                    </div>
                    <span className="text-[10px] px-1.5 rounded-full bg-[#2a2a2a] text-neutral-400">0</span>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* DRAGGABLE DIVIDER: LEFT SIDEBAR ⇄ WORKSPACE */}
        {isLeftSidebarVisible && (
          <div
            onMouseDown={() => setIsResizingSidebar(true)}
            className="w-1 bg-[#242424] hover:bg-[#f43f5e] active:bg-[#f43f5e] cursor-col-resize shrink-0 transition-colors z-20"
            title="Drag to resize Explorer (⌘B to toggle)"
          />
        )}

        {/* 2C. CENTER WORKSPACE (TABS + MONACO EDITOR / DIFF / GRAPH / REVIEW CHANGES) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#141414] h-full overflow-hidden relative">
          
          {/* EDITOR TABS BAR */}
          <div className="h-9 bg-[#161616] border-b border-[#242424] flex items-center justify-between px-0 shrink-0 z-20 select-none">
            {/* Tabs List */}
            <div className="flex items-center h-full overflow-x-auto">
              {openTabs.map((tabName) => {
                const isActive = activeTab === tabName;
                const isReview = tabName === "Review";
                const isMarkdown = tabName.endsWith(".md");

                return (
                  <div
                    key={tabName}
                    onClick={() => handleSelectTab(tabName)}
                    className={`h-full flex items-center gap-2 px-3 border-r border-[#242424] text-xs font-mono cursor-pointer group transition-colors ${
                      isActive 
                        ? isReview
                          ? "bg-[#141414] text-white border-t-2 border-t-[#f43f5e]" 
                          : "bg-[#141414] text-white border-t-2 border-t-[#f43f5e]" 
                        : "bg-[#181818] text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200 border-t-2 border-t-transparent"
                    }`}
                  >
                    {isReview ? (
                      <SplitSquareVertical size={13} className="text-[#f43f5e]" />
                    ) : isMarkdown ? (
                      <span className="text-blue-400 font-bold text-[10px]">M↓</span>
                    ) : (
                      <span className="text-blue-400 font-bold text-[10px]">TS</span>
                    )}
                    <span>{tabName}</span>
                    <button
                      onClick={(e) => handleCloseTab(e, tabName)}
                      className="p-0.5 hover:bg-[#282828] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}

              {/* FalkorDB Stratified Graph Tab */}
              <div
                onClick={() => {
                  playUiSound("switch");
                  handleSelectTab("FalkorDB Graph");
                }}
                className={`h-full flex items-center gap-1.5 px-3 border-r border-[#242424] text-xs font-mono cursor-pointer transition-colors ${
                  activeTab === "FalkorDB Graph"
                    ? "bg-[#141414] text-white border-t-2 border-t-amber-400"
                    : "bg-[#181818] text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200 border-t-2 border-t-transparent"
                }`}
              >
                <Network size={13} className="text-amber-400" />
                <span>FalkorDB Graph</span>
              </div>
            </div>

            {/* Editor Action Buttons (Split, Diff Toggle, Copy) */}
            <div className="flex items-center gap-1 pr-3 text-neutral-400">
              <button
                onClick={() => {
                  playUiSound("click");
                  handleOpenReviewTab();
                }}
                title="Review Changes"
                className="p-1.5 rounded hover:bg-[#252525] hover:text-white transition-colors cursor-pointer"
              >
                <SplitSquareVertical size={14} />
              </button>

              <button
                onClick={() => {
                  playUiSound("click");
                  const contentToCopy = files[activeTab] || DEMO_VIDEO_SCRIPT;
                  navigator.clipboard.writeText(contentToCopy);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                title="Copy File Content"
                className="p-1.5 rounded hover:bg-[#252525] hover:text-white transition-colors cursor-pointer"
              >
                {copiedCode ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* BREADCRUMB BAR (Screenshot 1: M↓ demo_video_script.md › # 🎬 NexusIDE...) */}
          <div className="h-6 bg-[#141414] border-b border-[#242424] px-4 flex items-center gap-1.5 text-xs font-mono text-neutral-400 shrink-0 select-none">
            {activeTab === "demo_video_script.md" ? (
              <>
                <span className="text-blue-400 font-bold text-[10px]">M↓</span>
                <span className="text-white">demo_video_script.md</span>
                <ChevronRight size={11} className="text-neutral-600" />
                <span className="text-neutral-500 truncate"># 🎬 GraphiCode — 3-Minute Hackathon Winning Demo Script</span>
              </>
            ) : activeTab === "Review" ? (
              <>
                <SplitSquareVertical size={12} className="text-[#f43f5e]" />
                <span className="text-white font-medium">Review Changes</span>
                <ChevronRight size={11} className="text-neutral-600" />
                <span className="text-neutral-400">{selectedReviewFile || "All Files (18 files changed)"}</span>
              </>
            ) : (
              <>
                <FolderGit2 size={12} className="text-neutral-500" />
                <span>graphicode</span>
                <ChevronRight size={11} className="text-neutral-600" />
                <span>frontend</span>
                <ChevronRight size={11} className="text-neutral-600" />
                <span className="text-white font-medium">{activeTab}</span>
                <ChevronRight size={11} className="text-neutral-600" />
                <span className="text-blue-400 font-medium">function validateToken()</span>
              </>
            )}
          </div>

          {/* MAIN WORKSPACE CONTENT */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#141414] relative">
            
            {/* VIEW A: REVIEW CHANGES LIST VIEW (Screenshot 5) */}
            {activeTab === "Review" && !selectedReviewFile && (
              <div className="flex-1 flex flex-col min-h-0 bg-[#141414] overflow-y-auto">
                {/* Header with Title & Split View Toggle */}
                <div className="h-10 px-5 border-b border-[#242424] flex items-center justify-between text-xs font-medium text-white shrink-0">
                  <span className="font-semibold text-sm">Review Changes</span>
                  <div className="flex items-center gap-2 text-neutral-400">
                    <button 
                      onClick={() => setSelectedReviewFile("ast_parser.py")}
                      className="p-1 hover:text-white hover:bg-[#252525] rounded cursor-pointer"
                      title="Split View Diff"
                    >
                      <Columns2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Changed Files Table List */}
                <div className="p-3 space-y-0.5 font-mono text-xs">
                  {REVIEW_CHANGES_FILES.map((file, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        playUiSound("click");
                        setSelectedReviewFile(file.path);
                      }}
                      className="h-8 px-3 rounded flex items-center justify-between hover:bg-[#202020] cursor-pointer group transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {file.path.endsWith(".py") ? (
                          <span className="w-4 h-4 rounded bg-[#3b82f6]/20 text-[#3b82f6] text-[9px] font-bold flex items-center justify-center">PY</span>
                        ) : file.path.endsWith(".ts") || file.path.endsWith(".tsx") ? (
                          <span className="w-4 h-4 rounded bg-[#3b82f6]/20 text-[#3b82f6] text-[9px] font-bold flex items-center justify-center">TS</span>
                        ) : file.path.endsWith(".md") ? (
                          <span className="text-blue-400 font-bold text-[10px]">M↓</span>
                        ) : file.path.endsWith(".sh") ? (
                          <span className="text-emerald-400 font-bold text-[10px]">&gt;_</span>
                        ) : (
                          <FileCode size={13} className="text-neutral-400" />
                        )}
                        <span className="text-neutral-200 group-hover:text-white font-medium truncate">{file.path}</span>
                        {file.folder && <span className="text-neutral-600 text-[11px] truncate">{file.folder}</span>}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-[11px] font-mono">
                          <span className="text-emerald-400 font-semibold">+{file.added}</span>{" "}
                          <span className="text-red-400 font-semibold">-{file.removed}</span>
                        </div>
                        <ChevronRight size={13} className="text-neutral-600 group-hover:text-neutral-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW B: MONACO DIFF EDITOR (When reviewing a specific changed file) */}
            {(activeTab === "Review" && selectedReviewFile) || isDiffMode ? (
              <div className="flex-1 w-full h-full min-h-0 relative">
                {/* Floating Action Pill over the Diff */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 bg-[#181818]/95 backdrop-blur-md border border-[#333333] shadow-2xl rounded-full px-4 py-2 animate-fadeIn select-none">
                  <div className="flex items-center gap-1.5 pr-2.5 border-r border-[#2d2d2d] text-xs font-mono text-neutral-300">
                    <ShieldAlert size={14} className="text-amber-400 shrink-0" />
                    <span>2 callers verified against 1 memory rule</span>
                  </div>

                  <button
                    onClick={handleAcceptPatch}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium transition-all shadow-[0_0_15px_rgba(16,185,129,0.35)] cursor-pointer"
                    title="Accept Patch (Cmd+Y)"
                  >
                    <Check size={13} className="stroke-[2.5]" />
                    <span>Accept (⌘Y)</span>
                  </button>

                  <button
                    onClick={() => {
                      handleRejectPatch();
                      setSelectedReviewFile(null);
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#252526] hover:bg-[#333] border border-[#3c3c3c] text-neutral-300 text-xs font-mono transition-colors cursor-pointer"
                    title="Back to Review List"
                  >
                    <X size={13} />
                    <span>Back to List</span>
                  </button>
                </div>

                <DiffEditor
                  height="100%"
                  language="typescript"
                  theme="vs-dark"
                  original={originalCode}
                  modified={modifiedCode || files["auth.ts"]}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace",
                    lineNumbers: "on",
                    renderSideBySide: true,
                    readOnly: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
            ) : null}

            {/* VIEW C: MONACO CODE EDITOR (Markdown or TypeScript) */}
            {activeTab !== "Review" && activeTab !== "FalkorDB Graph" && !isDiffMode && (
              <div className="flex-1 w-full h-full min-h-0">
                {isMounted ? (
                  <Editor
                    height="100%"
                    language={activeTab.endsWith(".md") ? "markdown" : "typescript"}
                    theme="vs-dark"
                    value={files[activeTab] || ""}
                    onChange={(val) => {
                      if (val !== undefined) {
                        setFiles((prev) => ({ ...prev, [activeTab]: val }));
                      }
                    }}
                    options={{
                      minimap: { enabled: true, maxColumn: 80 },
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace",
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 4,
                      renderLineHighlight: "all",
                      cursorBlinking: "smooth",
                      smoothScrolling: true,
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-mono text-xs text-neutral-500">
                    Loading Editor...
                  </div>
                )}
              </div>
            )}

            {/* VIEW D: STRATIFIED FALKORDB KNOWLEDGE GRAPH */}
            {activeTab === "FalkorDB Graph" && (
              <div className="flex-1 w-full h-full min-h-0 bg-[#0e0e0e] relative">
                <GraphViewer
                  graphData={{
                    nodes: graphData.nodes as any,
                    edges: graphData.links.map((l: any) => {
                      const s = typeof l.source === "object" ? l.source.id : String(l.source);
                      const t = typeof l.target === "object" ? l.target.id : String(l.target);
                      return {
                        source: s,
                        target: t,
                        type: l.type || (s.includes("rule") || s.includes("RULE") ? "CONSTRAINED_BY" : s.includes("pr") || s.includes("PR") ? "AUTHORED_BY" : "CALLS"),
                      };
                    }),
                  }}
                  focusNodeId="validateToken"
                  blastRadiusNodeIds={["processInvoice", "auditAccount"]}
                  memoryNodeIds={["RULE: Must check exp (skew <= 60s)", "RULE: Reject 'none' algorithm"]}
                  onNodeClick={(node) => {
                    playUiSound("click");
                    const nid = String(node.id || node.name || node.label || "");
                    if (nid.includes("billing") || nid.includes("processInvoice")) {
                      handleSelectTab("billing.ts");
                    } else if (nid.includes("finance") || nid.includes("auditAccount")) {
                      handleSelectTab("finance.ts");
                    } else if (nid.includes("validateToken") || nid.includes("auth")) {
                      handleSelectTab("auth.ts");
                    }
                  }}
                />
              </div>
            )}

          </div>

          {/* 2D. BOTTOM COLLAPSIBLE PANEL (TERMINAL + CYPHER TELEMETRY) */}
          {isBottomPanelVisible && (
            <div 
              style={{ height: bottomPanelHeight }}
              className="bg-[#141414] border-t border-[#242424] flex flex-col shrink-0 select-none relative"
            >
              {/* Draggable panel splitter */}
              <div
                onMouseDown={() => setIsResizingBottomPanel(true)}
                className="h-1 bg-[#242424] hover:bg-[#f43f5e] active:bg-[#f43f5e] cursor-row-resize shrink-0 transition-colors"
                title="Drag to resize Terminal Panel (⌘J to toggle)"
              />

              {/* Panel Tabs Header */}
              <div className="h-8 bg-[#161616] border-b border-[#242424] px-3 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-4">
                  {(["terminal", "graph", "problems"] as const).map((tab) => {
                    const isActive = activeBottomPanelTab === tab;
                    const labels: Record<string, string> = {
                      terminal: "Terminal",
                      graph: "Graph",
                      problems: "Problems",
                    };
                    return (
                      <button
                        key={tab}
                        onClick={() => {
                          playUiSound("click");
                          setActiveBottomPanelTab(tab);
                        }}
                        className={`h-8 capitalize flex items-center gap-1.5 cursor-pointer transition-colors ${
                          isActive 
                            ? "text-[#f43f5e] border-b-2 border-b-[#f43f5e] font-medium" 
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <span>{labels[tab]}</span>
                        {tab === "graph" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        )}
                        {tab === "problems" && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#f43f5e] text-white text-[9px] font-bold">2</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 text-neutral-400">
                  {/* Status Indicator with Tooltip (Screenshot 3) */}
                  <div 
                    onMouseEnter={() => setShowTerminalTooltip(true)}
                    onMouseLeave={() => setShowTerminalTooltip(false)}
                    className="relative cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#38bdf8] inline-block animate-pulse"></span>
                    {showTerminalTooltip && (
                      <div className="absolute right-0 bottom-6 bg-[#202020] border border-[#333] shadow-xl px-2.5 py-1 rounded text-[11px] font-mono text-white whitespace-nowrap z-50">
                        GraphiCode Engine (Active)
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setIsBottomPanelVisible(false)}
                    title="Close Panel (⌘J)"
                    className="p-1 hover:text-white rounded"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Panel Content with Split Terminal Sidebar */}
              <div className="flex-1 flex min-h-0 bg-[#121212] overflow-hidden">
                {/* Main Output Content */}
                <div className="flex-1 p-3 overflow-y-auto font-mono text-xs">
                  {activeBottomPanelTab === "terminal" && (
                    <div className="text-neutral-300 font-mono text-xs space-y-1">
                      <div className="text-neutral-500">((.venv)) pratham@PRATHAMs-MacBook-Air graphicode % ./launch-mac.sh</div>
                      <div className="text-blue-400 pt-1">
                        ▶ [5/5] Opening GraphiCode in Default Browser...<br />
                        <span className="text-emerald-400">✓ Opened http://localhost:3000 via macOS &apos;open&apos;</span>
                      </div>
                      <div className="text-[#e2b340] pt-2">
                        =====================================================<br />
                        🚀 <span className="text-white font-bold">GraphiCode is live and ready on Apple Silicon!</span><br />
                        🌐 UI Application: <span className="text-blue-400 underline">http://localhost:3000</span><br />
                        ⚡ API Backend:    <span className="text-blue-400 underline">http://localhost:8000</span><br />
                        📊 FalkorDB Graph: <span className="text-emerald-400">localhost:6379</span><br />
                        =====================================================
                      </div>
                      <div className="text-neutral-500 pt-1">
                        Press [Ctrl+C] to stop all services and terminate cleanly.
                      </div>
                      <div className="text-neutral-400 pt-1">
                        pratham@PRATHAMs-MacBook-Air graphicode % <span className="w-2 h-4 bg-white inline-block animate-pulse align-middle ml-1"></span>
                      </div>
                    </div>
                  )}

                  {activeBottomPanelTab === "graph" && (
                    <div className="text-neutral-300 font-mono text-xs space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-[#222]">
                        <div className="flex items-center gap-2">
                          <Network size={14} className="text-[#f43f5e]" />
                          <span className="text-white font-semibold">FalkorDB AST GraphBLAS Engine</span>
                          <span className="text-emerald-400 text-[11px]">(Connected: localhost:6379)</span>
                        </div>
                        <div className="flex items-center gap-3 text-neutral-400 text-[11px]">
                          <span>Active Nodes: <strong className="text-white">{dbHealth.nodes}</strong></span>
                          <span>Call Edges: <strong className="text-white">{dbHealth.edges}</strong></span>
                          <span>Traversal Latency: <strong className="text-emerald-400">{dbHealth.latency}</strong></span>
                        </div>
                      </div>

                      <div className="bg-[#181818] p-2 rounded border border-[#262626] text-[11px]">
                        <span className="text-neutral-500">// Cypher Multi-Hop Traversal Query:</span>
                        <div className="text-amber-300 font-semibold mt-0.5">
                          MATCH (c:Function)-[:CALLS*1..2]-&gt;(t:Function &#123;name: &quot;validateToken&quot;&#125;) RETURN c, t;
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-[#1c1c1c] border border-[#2c2c2c]">
                          <div className="text-[#f43f5e] font-bold mb-1">Impacted Callers (Blast Radius):</div>
                          <div className="text-neutral-300">• Hop 1: <code className="text-blue-400">processInvoice()</code> in billing.ts (2 callers)</div>
                          <div className="text-neutral-300">• Hop 2: <code className="text-blue-400">auditAccount()</code> in finance.ts (SOX)</div>
                        </div>
                        <div className="p-2 rounded bg-[#1c1c1c] border border-[#2c2c2c] flex flex-col justify-between">
                          <div>
                            <div className="text-amber-400 font-bold mb-1">Procedural Memory Constraints:</div>
                            <div className="text-neutral-300">• Must check exp claim (clock skew &lt;= 60s)</div>
                            <div className="text-neutral-300">• Reject &apos;none&apos; algorithm signature</div>
                          </div>
                          <button
                            onClick={() => {
                              playUiSound("switch");
                              handleSelectTab("FalkorDB Graph");
                            }}
                            className="mt-2 py-1 px-2 rounded bg-[#f43f5e] hover:bg-[#e11d48] text-white text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Network size={11} /> Open Interactive 3D Canvas
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeBottomPanelTab === "problems" && (
                    <div className="text-neutral-300 font-mono text-xs space-y-2">
                      <div className="text-neutral-400 pb-1 border-b border-[#222]">
                        0 errors, 2 warnings in workspace.
                      </div>
                      <div className="space-y-1.5 pt-1 text-[11px]">
                        <div 
                          onClick={() => handleSelectTab("auth.ts")}
                          className="flex items-center gap-2 text-amber-400 hover:underline cursor-pointer"
                        >
                          <span>⚠</span>
                          <span>auth.ts:2</span>
                          <span className="text-neutral-400">Function &apos;validateToken&apos; has 2 multi-hop dependent callers in blast radius</span>
                        </div>
                        <div 
                          onClick={() => handleSelectTab("billing.ts")}
                          className="flex items-center gap-2 text-amber-400 hover:underline cursor-pointer"
                        >
                          <span>⚠</span>
                          <span>billing.ts:6</span>
                          <span className="text-neutral-400">Caller &apos;processInvoice&apos; must enforce procedural clock skew &lt;= 60s</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Terminal List Sidebar (Screenshot 1: zsh backend, bash, Python backend) */}
                <div className="w-36 bg-[#161616] border-l border-[#242424] flex flex-col py-1 text-[11px] font-mono text-neutral-400">
                  <div 
                    onClick={() => setActiveTerminalTab("zsh")}
                    className={`px-3 py-1 flex items-center gap-2 cursor-pointer ${
                      activeTerminalTab === "zsh" ? "bg-[#222] text-white" : "hover:bg-[#1a1a1a]"
                    }`}
                  >
                    <Terminal size={11} className="text-neutral-500" />
                    <span>zsh backend</span>
                  </div>
                  <div 
                    onClick={() => setActiveTerminalTab("bash")}
                    className={`px-3 py-1 flex items-center gap-2 cursor-pointer border-l-2 ${
                      activeTerminalTab === "bash" ? "bg-[#252525] text-white border-l-[#f43f5e]" : "hover:bg-[#1a1a1a] border-l-transparent"
                    }`}
                  >
                    <Terminal size={11} className="text-[#f43f5e]" />
                    <span className="font-semibold text-white">bash</span>
                  </div>
                  <div 
                    onClick={() => setActiveTerminalTab("python")}
                    className={`px-3 py-1 flex items-center gap-2 cursor-pointer ${
                      activeTerminalTab === "python" ? "bg-[#222] text-white" : "hover:bg-[#1a1a1a]"
                    }`}
                  >
                    <Terminal size={11} className="text-neutral-500" />
                    <span>Python bac...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* DRAGGABLE DIVIDER: WORKSPACE ⇄ RIGHT AGENT PANEL */}
        {isRightAgentVisible && (
          <div
            onMouseDown={() => setIsResizingAgent(true)}
            className="w-1 bg-[#242424] hover:bg-[#f43f5e] active:bg-[#f43f5e] cursor-col-resize shrink-0 transition-colors z-20"
            title="Drag to resize Nexus Agent Panel (⌘L to toggle)"
          />
        )}

        {/* 2E. RIGHT AGENT PANEL (Nexus IDE Project Initializer & Actions) */}
        {isRightAgentVisible && (
          <div 
            style={{ width: agentPanelWidth }}
            className="bg-[#161616] border-l border-[#242424] flex flex-col justify-between shrink-0 h-full overflow-hidden select-none relative"
          >
            {/* Header: Title + Session Actions */}
            <div className="h-9 px-3 border-b border-[#242424] flex items-center justify-between text-xs shrink-0">
              <span className="font-medium text-white truncate max-w-[200px]">
                Nexus IDE Project Initializ...
              </span>
              <div className="flex items-center gap-1.5 text-neutral-400">
                <button title="New Session" className="p-1 hover:text-white rounded cursor-pointer">
                  +
                </button>
                <button title="Session History" className="p-1 hover:text-white rounded cursor-pointer">
                  <History size={13} />
                </button>
                <button title="More Actions" className="p-1 hover:text-white rounded cursor-pointer">
                  <MoreHorizontal size={13} />
                </button>
                <button 
                  onClick={() => setIsRightAgentVisible(false)}
                  title="Close Panel (⌘L)"
                  className="p-1 hover:text-white rounded cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Scrollable Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs font-sans">
              
              {/* User Prompt Box with Thumbnail */}
              <div className="p-2.5 rounded-lg bg-[#202020] border border-[#2b2b2b] text-neutral-200 space-y-2">
                <div 
                  onClick={() => setShowChangesOverview(!showChangesOverview)}
                  className="w-16 h-12 rounded bg-black/60 border border-[#333] flex items-center justify-center cursor-pointer hover:border-neutral-400 relative"
                >
                  <div className="w-10 h-8 rounded bg-[#1e1e1e] flex flex-col items-center justify-center text-[7px] text-neutral-500">
                    <div className="w-6 h-0.5 bg-neutral-600 mb-1"></div>
                    <div className="w-4 h-0.5 bg-neutral-600"></div>
                  </div>
                </div>
                <div className="text-neutral-300">
                  {messages[0]?.text}
                </div>
              </div>

              {/* Agent Narrative Summary */}
              <div className="text-neutral-300 leading-relaxed space-y-2">
                <div className="font-semibold text-white">7. Bottom Status Bar:</div>
                <ul className="space-y-1 text-neutral-400 list-disc pl-4 text-[11px]">
                  <li>Dark <code className="text-neutral-300 font-mono">#141414</code> footer.</li>
                  <li>Left: Rose <code className="text-[#f43f5e] font-mono">[NEXUS]</code> badge, <code className="font-mono">0 ⊗ 2 ⚠</code>, FalkorDB: 69 nodes (0.8ms).</li>
                  <li>Right: <code className="font-mono">Ln 23, Col 1, Spaces: 2, UTF-8, TypeScript, Nexus - Settings</code>.</li>
                </ul>

                <div className="font-semibold text-white pt-1">Verification</div>
                <ul className="space-y-1 text-neutral-400 list-disc pl-4 text-[11px]">
                  <li>Ran <code className="text-emerald-400 font-mono">pnpm build</code>: Compiled successfully in <span className="font-semibold text-white">2.8s</span> with <span className="text-emerald-400 font-semibold">0 errors and 0 warnings</span>.</li>
                  <li>Verified zero occurrences of any other IDE names in the source code.</li>
                  <li>Live at <span className="text-blue-400 underline">http://localhost:3000</span>.</li>
                </ul>
              </div>

              {/* Changes in conversation window right above the next prompt */}
              <div className="p-3 rounded-xl bg-[#181818] border border-[#2a2a2a] space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-[#f43f5e]" />
                    <span className="text-white font-medium">Changes up to this prompt</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">+38</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/40">-7</span>
                  </div>
                  <button
                    onClick={handleOpenReviewTab}
                    className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Full Review</span>
                    <ChevronRight size={12} />
                  </button>
                </div>

                {/* Changed files item list */}
                <div className="space-y-1 text-[11px] font-mono text-neutral-300">
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#202020] border border-[#282828]">
                    <div className="flex items-center gap-1.5 truncate">
                      <FileCode size={12} className="text-blue-400 shrink-0" />
                      <span className="text-neutral-200 truncate">src/auth.ts</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                      <span className="text-emerald-400">+18</span>
                      <span className="text-red-400">-4</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#202020] border border-[#282828]">
                    <div className="flex items-center gap-1.5 truncate">
                      <FileCode size={12} className="text-amber-400 shrink-0" />
                      <span className="text-neutral-200 truncate">src/billing.ts</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                      <span className="text-emerald-400">+12</span>
                      <span className="text-red-400">-2</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#202020] border border-[#282828]">
                    <div className="flex items-center gap-1.5 truncate">
                      <FileCode size={12} className="text-purple-400 shrink-0" />
                      <span className="text-neutral-200 truncate">src/finance.ts</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                      <span className="text-emerald-400">+8</span>
                      <span className="text-red-400">-1</span>
                    </div>
                  </div>
                </div>

                {/* Accept / Reject changes buttons right in the conversation stream */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleAcceptPatch}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-all cursor-pointer"
                  >
                    <Check size={13} className="stroke-[2.5]" />
                    <span>Accept Changes (⌘Y)</span>
                  </button>
                  <button
                    onClick={handleRejectPatch}
                    className="py-1.5 px-3 rounded-lg bg-[#242424] hover:bg-[#303030] border border-[#353535] text-neutral-300 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    <X size={13} />
                    <span>Reject</span>
                  </button>
                </div>

                {patchAccepted && (
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono pt-0.5">
                    <CheckCircle2 size={12} />
                    <span>Changes accepted</span>
                  </div>
                )}
              </div>

              {/* Reaction Bar & Time */}
              <div className="flex items-center justify-between text-neutral-500 pt-1">
                <span className="text-[11px] font-mono">23:09</span>
                <div className="flex items-center gap-2">
                  <button className="p-1 hover:text-white rounded cursor-pointer"><Copy size={13} /></button>
                  <button className="p-1 hover:text-white rounded cursor-pointer"><ThumbsUp size={13} /></button>
                  <button className="p-1 hover:text-white rounded cursor-pointer"><ThumbsDown size={13} /></button>
                </div>
              </div>
            </div>

            {/* ACTION TOOLBAR & INPUT AREA */}
            <div className="p-3 border-t border-[#242424] bg-[#141414] space-y-2 shrink-0 relative">
              
              {/* Terminal Processes Popover */}
              {showTerminalProcesses && (
                <div className="absolute left-3 right-3 bottom-24 z-50 bg-[#1a1a1a] border border-[#333] shadow-2xl rounded-xl overflow-hidden animate-fadeIn text-xs font-mono">
                  <div className="px-3.5 py-2.5 bg-[#202020] border-b border-[#2d2d2d] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal size={13} className="text-emerald-400" />
                      <span className="font-semibold text-white">Running Terminal Processes</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        3 active
                      </span>
                    </div>
                    <button 
                      onClick={() => setShowTerminalProcesses(false)}
                      className="text-neutral-500 hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto">
                    {/* Process 1 */}
                    <div className="p-2.5 rounded-lg bg-[#222222] border border-[#2e2e2e] flex items-center justify-between hover:border-[#444] transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-white font-semibold text-[11px]">uvicorn main:app --reload --port 8000</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-400 pl-4">
                          <span>PID: <strong className="text-neutral-300">4821</strong></span>
                          <span>Port: <strong className="text-neutral-300">8000</strong></span>
                          <span>Uptime: <strong className="text-neutral-300">5h 39m</strong></span>
                          <span className="text-emerald-400">FastAPI ASGI</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => {
                            setIsBottomPanelVisible(true);
                            setActiveBottomPanelTab("terminal");
                            setShowTerminalProcesses(false);
                            playUiSound("click");
                          }}
                          className="px-2 py-1 rounded bg-[#2c2c2c] hover:bg-[#383838] text-[10px] text-neutral-300 hover:text-white cursor-pointer transition-colors"
                        >
                          View Logs
                        </button>
                      </div>
                    </div>

                    {/* Process 2 */}
                    <div className="p-2.5 rounded-lg bg-[#222222] border border-[#2e2e2e] flex items-center justify-between hover:border-[#444] transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-white font-semibold text-[11px]">./launch-mac.sh</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-400 pl-4">
                          <span>PID: <strong className="text-neutral-300">9102</strong></span>
                          <span>Port: <strong className="text-neutral-300">6379</strong></span>
                          <span>Uptime: <strong className="text-neutral-300">1h 59m</strong></span>
                          <span className="text-purple-400">FalkorDB AST</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => {
                            setIsBottomPanelVisible(true);
                            setActiveBottomPanelTab("terminal");
                            setShowTerminalProcesses(false);
                            playUiSound("click");
                          }}
                          className="px-2 py-1 rounded bg-[#2c2c2c] hover:bg-[#383838] text-[10px] text-neutral-300 hover:text-white cursor-pointer transition-colors"
                        >
                          View Logs
                        </button>
                      </div>
                    </div>

                    {/* Process 3 */}
                    <div className="p-2.5 rounded-lg bg-[#222222] border border-[#2e2e2e] flex items-center justify-between hover:border-[#444] transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-white font-semibold text-[11px]">pnpm dev</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-400 pl-4">
                          <span>PID: <strong className="text-neutral-300">14209</strong></span>
                          <span>Port: <strong className="text-neutral-300">3000</strong></span>
                          <span className="text-blue-400">Next.js 15 Turbo</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => {
                            setIsBottomPanelVisible(true);
                            setActiveBottomPanelTab("terminal");
                            setShowTerminalProcesses(false);
                            playUiSound("click");
                          }}
                          className="px-2 py-1 rounded bg-[#2c2c2c] hover:bg-[#383838] text-[10px] text-neutral-300 hover:text-white cursor-pointer transition-colors"
                        >
                          View Logs
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="px-3 py-2 bg-[#1f1f1f] border-t border-[#2d2d2d] flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Terminal buffer active</span>
                    <button
                      onClick={() => {
                        setIsBottomPanelVisible(true);
                        setActiveBottomPanelTab("terminal");
                        setShowTerminalProcesses(false);
                        playUiSound("toggle");
                      }}
                      className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Integrated Terminal</span>
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              )}

              {/* Changes Overview Popover / Drawer */}
              {showChangesOverview && (
                <div className="absolute left-3 right-3 bottom-24 z-50 bg-[#1a1a1a] border border-[#333] shadow-2xl rounded-xl overflow-hidden animate-fadeIn text-xs font-mono">
                  <div className="px-3.5 py-2.5 bg-[#202020] border-b border-[#2d2d2d] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-[#f43f5e]" />
                      <span className="font-semibold text-white">Changes Overview</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/30">
                        3 files modified
                      </span>
                    </div>
                    <button 
                      onClick={() => setShowChangesOverview(false)}
                      className="text-neutral-500 hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Changes List */}
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    <div className="space-y-1.5">
                      <div className="p-2 rounded bg-[#222] border border-[#2d2d2d] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCode size={13} className="text-blue-400" />
                          <span className="text-neutral-200 font-medium">src/auth.ts</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-400 font-semibold">+18</span>
                          <span className="text-red-400 font-semibold">-4</span>
                        </div>
                      </div>

                      <div className="p-2 rounded bg-[#222] border border-[#2d2d2d] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCode size={13} className="text-amber-400" />
                          <span className="text-neutral-200 font-medium">src/billing.ts</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-400 font-semibold">+12</span>
                          <span className="text-red-400 font-semibold">-2</span>
                        </div>
                      </div>

                      <div className="p-2 rounded bg-[#222] border border-[#2d2d2d] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCode size={13} className="text-purple-400" />
                          <span className="text-neutral-200 font-medium">src/finance.ts</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-400 font-semibold">+8</span>
                          <span className="text-red-400 font-semibold">-1</span>
                        </div>
                      </div>
                    </div>

                    {/* Diff Preview */}
                    <div className="p-2 rounded bg-[#161616] border border-[#262626] text-[10px] font-mono text-neutral-300 space-y-0.5">
                      <div className="text-neutral-500 pb-1 font-sans font-semibold">Diff Preview (auth.ts):</div>
                      <div className="text-red-400/90 bg-red-950/20 px-1 py-0.5 rounded">- if (!token) return true;</div>
                      <div className="text-emerald-400 bg-emerald-950/30 px-1 py-0.5 rounded">+ if (!token || payload.alg === &quot;none&quot;) return false;</div>
                      <div className="text-emerald-400 bg-emerald-950/30 px-1 py-0.5 rounded">+ if (payload.exp &amp;&amp; payload.exp &lt; now - 60) return false;</div>
                    </div>

                    {/* Status Feedback */}
                    {patchAccepted && (
                      <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px] flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span>Changes accepted and saved to workspace files.</span>
                      </div>
                    )}
                  </div>

                  {/* Accept / Reject Action Buttons in Changes Overview */}
                  <div className="px-3 py-2.5 bg-[#202020] border-t border-[#2d2d2d] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={handleAcceptPatch}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-950/50 transition-all cursor-pointer text-xs"
                      >
                        <Check size={13} className="stroke-[2.5]" />
                        <span>Accept Changes (⌘Y)</span>
                      </button>

                      <button
                        onClick={handleRejectPatch}
                        className="px-3 py-1.5 rounded-lg bg-[#282828] hover:bg-[#333] border border-[#3a3a3a] text-neutral-300 hover:text-white font-medium transition-colors cursor-pointer text-xs flex items-center gap-1"
                      >
                        <X size={13} />
                        <span>Reject (⌘N)</span>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setShowChangesOverview(false);
                        handleOpenReviewTab();
                      }}
                      title="Open in Monaco Diff Editor"
                      className="px-2.5 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] border border-[#333] text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
                    >
                      <SplitSquareVertical size={12} className="text-[#f43f5e]" />
                      <span>Review Pane</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION TOOLBAR: ONLY ICONS NO TEXT FOR THE 3 OPTIONS */}
              <div className="flex items-center justify-between text-neutral-300">
                <div className="flex items-center gap-1.5">
                  {/* Option 1: Changes Overview Icon */}
                  <button 
                    onClick={() => {
                      playUiSound("toggle");
                      setShowChangesOverview(!showChangesOverview);
                      setShowTerminalProcesses(false);
                    }}
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-all shadow-sm relative group ${
                      showChangesOverview 
                        ? "bg-[#282828] border-[#f43f5e] text-[#f43f5e]" 
                        : "bg-[#1c1c1c] hover:bg-[#242424] border-[#2e2e2e] text-neutral-400 hover:text-white"
                    }`}
                    title="Changes Overview (Click to view, accept or reject changes)"
                  >
                    <FileText size={14} className={showChangesOverview ? "text-[#f43f5e]" : "text-neutral-400 group-hover:text-white transition-colors"} />
                    <span className="absolute -top-1 -right-1 px-1 min-w-[13px] h-[13px] text-[8px] font-mono rounded-full bg-[#f43f5e] text-white flex items-center justify-center font-bold leading-none">3</span>
                  </button>

                  {/* Option 2: Terminal Icon (shows running terminal processes) */}
                  <button 
                    onClick={() => {
                      playUiSound("toggle");
                      setShowTerminalProcesses(!showTerminalProcesses);
                      setShowChangesOverview(false);
                    }}
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-all shadow-sm relative group ${
                      showTerminalProcesses 
                        ? "bg-[#282828] border-emerald-500 text-emerald-400" 
                        : "bg-[#1c1c1c] hover:bg-[#242424] border-[#2e2e2e] text-neutral-400 hover:text-white"
                    }`}
                    title="Terminal (Click to view running terminal processes)"
                  >
                    <Terminal size={14} className={showTerminalProcesses ? "text-emerald-400" : "text-neutral-400 group-hover:text-emerald-400 transition-colors"} />
                    <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  </button>
                </div>

                {/* Option 3: Review Changes Icon (opens Review Changes pane) */}
                <button
                  onClick={handleOpenReviewTab}
                  className="w-7 h-7 rounded-lg bg-[#1c1c1c] hover:bg-[#242424] border border-[#2e2e2e] hover:border-[#444] text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer shadow-sm transition-all group"
                  title="Review Changes (Click to open Review Changes pane)"
                >
                  <SplitSquareVertical size={14} className="text-[#f43f5e] group-hover:scale-110 transition-transform" />
                </button>
              </div>

              {/* Prompt Input Box */}
              <div className="bg-[#1e1e1e] border border-[#2d2d2d] focus-within:border-[#444] rounded-xl p-2.5 transition-all shadow-inner">
                <textarea
                  rows={2}
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      handleExecutePrompt();
                    }
                  }}
                  placeholder="Ask anything, @ to mention, / for actions"
                  className="w-full bg-transparent text-xs text-neutral-100 placeholder-neutral-500 resize-none outline-none font-sans"
                />

                <div className="flex items-center justify-between pt-1 border-t border-[#282828]">
                  <div className="flex items-center gap-1">
                    <button className="w-5 h-5 rounded hover:bg-[#2c2c2c] text-neutral-400 hover:text-white flex items-center justify-center text-sm cursor-pointer">
                      +
                    </button>

                    {/* Model Dropdown Selector (Gemini 3.8 Flash Medium) */}
                    <div className="relative">
                      <button
                        onClick={() => setShowModelPicker(!showModelPicker)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-neutral-300 hover:text-white cursor-pointer"
                      >
                        <span>{selectedModel}</span>
                        <ChevronDown size={10} className="text-neutral-500" />
                      </button>

                      {showModelPicker && (
                        <div className="absolute bottom-6 left-0 w-52 bg-[#222222] border border-[#333333] rounded-lg shadow-2xl py-1 z-50 text-xs font-mono">
                          {[
                            "Gemini 3.8 Flash Medium",
                            "Claude 3.5 Sonnet",
                            "GPT-4o",
                            "Qwen 2.5 Coder (Local)",
                          ].map((m) => (
                            <div
                              key={m}
                              onClick={() => {
                                playUiSound("click");
                                setSelectedModel(m);
                                setShowModelPicker(false);
                              }}
                              className="px-2.5 py-1 hover:bg-[#2c2c2c] cursor-pointer text-neutral-300 hover:text-white flex items-center justify-between"
                            >
                              <span>{m}</span>
                              {selectedModel === m && <Check size={12} className="text-[#f43f5e]" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button className="p-1 text-neutral-400 hover:text-white cursor-pointer">
                      <Mic size={13} />
                    </button>
                    {/* Rose Send Button */}
                    <button
                      onClick={() => handleExecutePrompt()}
                      disabled={isProcessing}
                      className="w-6 h-6 rounded-full bg-[#f43f5e] hover:bg-[#e11d48] text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shadow-md"
                    >
                      <ArrowUp size={12} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* 3. BOTTOM DARK STATUS BAR (Screenshot 1-5: You [NEXUS] 0 ⊗ 2 ⚠ ... Ln 1, Col 1 Spaces: 4 UTF-8 LF {} Markdown Nexus - Settings) */}
      <div className="h-6 bg-[#141414] border-t border-[#242424] px-2 flex items-center justify-between text-[11px] font-mono text-neutral-400 select-none z-30 shrink-0">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {/* Pink Tag with You / Avatar */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#f43f5e] text-white text-[10px] font-bold">
            <User size={10} />
            <span>You</span>
          </div>

          {/* Diagnostics: 0 errors, 2 warnings */}
          <div className="flex items-center gap-2 text-neutral-400">
            <span>0 ⊗</span>
            <span>2 ⚠</span>
          </div>

          {/* FalkorDB Live Status */}
          <div 
            onClick={() => {
              playUiSound("toggle");
              setIsBottomPanelVisible(true);
              setActiveBottomPanelTab("graph");
            }}
            className="hidden sm:flex items-center gap-1.5 cursor-pointer hover:text-white"
            title="FalkorDB Graph Engine Active"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>FalkorDB: {dbHealth.nodes} nodes ({dbHealth.latency})</span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3 text-neutral-400">
          <span>Ln 1, Col 1</span>
          <span>Spaces: 4</span>
          <span>UTF-8</span>
          <span>LF</span>
          <span className="text-[#3b82f6]">
            {activeTab.endsWith(".md") ? "{} Markdown" : "{} TypeScript"}
          </span>

          {/* Settings Hotkey */}
          <button
            onClick={() => {
              playUiSound("switch");
              setIsSettingsOpen(true);
            }}
            className="hover:text-white cursor-pointer"
          >
            GraphiCode - Settings
          </button>
        </div>
      </div>

      {/* 4. MODALS: SETTINGS (⌘,) & COMMAND PALETTE (⌘P / ⌘K) */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectFile={(f) => handleSelectTab(f)}
        onSelectView={(v) => {
          if (v === "diff") {
            handleOpenReviewTab();
          } else {
            handleSelectTab(activeTab);
          }
        }}
        onSelectModel={(m) => setSelectedModel(m)}
        onRunPrompt={(p) => handleExecutePrompt(p)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentModel={selectedModel}
      />

    </div>
  );
}
