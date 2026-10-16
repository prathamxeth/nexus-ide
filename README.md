<div align="center">

# ⚡ NexusIDE
### The Graph-Native Agentic IDE Powered by FalkorDB

**Context-aware code refactoring with zero blast-radius hallucinations.**  
Built for the **FalkorDB Graph Hacks Hackathon 2026** — delivering all 3 challenge tracks in a single, unified studio.

[![Demo Video](https://img.shields.io/badge/🎬_Watch_Demo-Loom_Walkthrough-f54e00?style=for-the-badge)](https://www.loom.com/share/7de75784a52d4da8a8e4f0beb4fe868c)
[![GitHub Stars](https://img.shields.io/github/stars/prathamxeth/nexus-ide?style=for-the-badge&color=blue)](https://github.com/prathamxeth/nexus-ide)
[![License](https://img.shields.io/badge/License-Apache_2.0-22c55e?style=for-the-badge)](LICENSE)

<br/>

[![FalkorDB](https://img.shields.io/badge/Graph_Engine-FalkorDB_(GraphBLAS_<2ms)-red.svg)](https://falkordb.com)
[![FastMCP](https://img.shields.io/badge/Protocol-Model_Context_Protocol_(FastMCP)-purple.svg)](https://modelcontextprotocol.io)
[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js_16_+_Monaco-black.svg)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_+_Python_3.12-009688.svg)](https://fastapi.tiangolo.com)

<br/>

<a href="https://www.loom.com/share/7de75784a52d4da8a8e4f0beb4fe868c">
  <img src="frontend/public/nexus-bg.jpg" alt="NexusIDE Studio Overview" width="92%" style="border-radius: 12px; border: 1px solid #262626; box-shadow: 0 20px 40px rgba(0,0,0,0.6);" />
</a>

<p align="center">
  <b><a href="https://www.loom.com/share/7de75784a52d4da8a8e4f0beb4fe868c">▶ Watch the 3-Minute Live Interactive Loom Screencast</a></b>
</p>

</div>

---

## 💡 Why NexusIDE?

Every engineer using modern AI coding assistants knows this pain:

> You ask the AI: *"Harden `validateToken` in `auth.ts` to reject expired tokens."*  
> The AI updates the file. It compiles locally. You commit.  
> Ten minutes later, your build pipeline redlines because downstream services (`billing.ts` and `finance.ts`) were calling `validateToken` with a legacy timestamp format the AI never knew existed.

### The Real Problem: Code is a Graph, Not an Essay

Current tools (Copilot, Cursor, Windsurf) treat code as **flat text chunks** matched by keyword similarity (Vector RAG). 

When you refactor a core function, your downstream billing or accounting files do not mention keywords like *"token expiration"*. To a vector search engine, those downstream files are invisible.

| Capability | Standard AI Tools (Vector RAG) | NexusIDE (FalkorDB Graph-RAG) |
| :--- | :--- | :--- |
| **Dependency Awareness** | ❌ **Blind** (cannot trace callers across files) | ✅ **Exact Multi-Hop Graph Traversal** (<2ms) |
| **Architectural Impact** | ❌ Treats all code as equal flat text | ✅ **Native FalkorDB PageRank** highlights critical bottlenecks |
| **Agent Memory** | ❌ Forgets mistakes the second you close the tab | ✅ **Live Episodic Memory** (`⌘N` saves rules permanently) |
| **Team Context** | ❌ Strips out Git blame and pull request history | ✅ **Company Brain** (PRs, Linear tickets, and authors) |
| **Agent Extensibility** | ❌ Closed, proprietary prompts | ✅ **Open FastMCP Server** for any AI agent |

---

## 🏆 3 Hackathon Tracks in 1 Unified Experience

NexusIDE was designed from the ground up to solve all three challenge tracks within a single, cohesive architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXUSIDE UNIFIED STUDIO                         │
│       Interactive Knowledge Graph Canvas + Monaco Split-Diff Editor    │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ Real-Time SSE Stream
┌───────────────────────────────────┴────────────────────────────────────┐
│                  FastAPI Backend + FastMCP Tool Server                 │
└───────▲───────────────────────────▲───────────────────────────▲────────┘
        │                           │                           │
┌───────┴───────────────┐   ┌───────┴───────────────┐   ┌───────┴───────────────┐
│        TRACK 1        │   │        TRACK 2        │   │        TRACK 3        │
│    CONNECTED DATA     │   │     AGENT MEMORY      │   │     COMPANY BRAIN     │
│   & GRAPH-RAG (AST)   │   │   & COORDINATION      │   │  & TEAM PROVENANCE    │
│                       │   │                       │   │                       │
│ • AST Call Hierarchy  │   │ • Live Rejection (⌘N) │   │ • Git Blame & PRs     │
│ • 4-Hop Blast Radius  │   │ • Persistent Rules    │   │ • Issue Ticket Intent │
│ • Native PageRank     │   │ • Cross-Session Learn │   │ • Author Attribution  │
└───────┬───────────────┘   └───────┬───────────────┘   └───────┬───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │                  FalkorDB Graph Engine                  │
       │       In-Memory GraphBLAS Linear Algebra (<2ms)         │
       └─────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 1. 🔍 Sub-Millisecond Blast Radius Calculation
Before suggesting any refactoring, the agent queries FalkorDB to find every function that directly or indirectly depends on the target code. Built on GraphBLAS matrix multiplication, multi-hop traversals execute in **under 2 milliseconds**.

### 2. 🧠 Rejection Learning (`⌘N`)
If the agent proposes a change you disagree with, simply hit **`⌘N`** (or click **Reject & Learn**). NexusIDE records a structured rule directly into FalkorDB attached to that specific function:
> *"When refactoring validateToken, always maintain backward compatibility with legacy epoch timestamps for billing.ts."*  

Across future sessions and across your entire engineering team, the agent retrieves this rule and never makes the same mistake twice.

### 3. 🏢 The Company Brain
Why was a weird workaround added 8 months ago? NexusIDE connects your code nodes to pull requests, authors, and tickets. When touching sensitive modules, the agent alerts you:
> *"Notice: Modified in PR #104 by @alex.chen to resolve SEC-892 (Replay Attack Vulnerability)."*

### 4. ⚡ Live Topological Canvas
Watch the agent think. Powered by `@gravity-ui/graph`, the IDE visually arranges your codebase into 4 structured vertical swimlanes (Files, Core Functions, Blast Radius Callers, and Memory Rules). Nodes pulse in neon cyan in real time as the agent traverses the graph.

### 5. 🛑 The Hard Kill-Switch
We believe in true graph dependency. The agent has **zero local file-reading tools** (`no open()`, `no grep`). If FalkorDB is offline, the agent strictly refuses to hallucinate code, emitting an immediate safety abort.

### 6. 🔌 Open FastMCP Tool Protocol
NexusIDE exposes its entire graph intelligence via the **Model Context Protocol** (`backend/mcp_server.py`). You can connect Claude Desktop, Cursor, or your own autonomous agents to query blast radius, memory, and company context via standard MCP tools.

---

## 🚀 Quick Start (Up in 60 Seconds)

You can launch the entire system with Docker and one shell command:

### Prerequisites
- [Docker Desktop](https://www.docker.com/)
- [Node.js 20+](https://nodejs.org/) & [pnpm](https://pnpm.io/)
- Python 3.12+ (or run via Docker)

### 1-Command Launch
```bash
# Clone the repository
git clone https://github.com/prathamxeth/nexus-ide.git
cd nexus-ide

# Run the bootstrap script (starts FalkorDB, Backend, and Frontend)
./run.sh
```

*(On macOS Apple Silicon, you can also run `./launch-mac.sh` for native Metal-optimized initialization).*

### Access the Studio
| Service | URL | Description |
| :--- | :--- | :--- |
| **NexusIDE Studio** | [http://localhost:3000](http://localhost:3000) | Full interactive web IDE |
| **FastAPI Backend** | [http://localhost:8000](http://localhost:8000) | REST API & SSE streaming |
| **Interactive API Docs**| [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger OpenAPI documentation |
| **FalkorDB Graph** | `localhost:6379` | In-memory Redis-compatible graph socket |

---

## 🧪 Automated Verification Suite

Validate the system end-to-end with our built-in test runners:

```bash
cd backend
source .venv/bin/activate

# 1. Test FalkorDB Hard Kill-Switch (proves zero code without graph)
python test_agent_killswitch.py

# 2. Test 4-Swimlane Layout Mathematics
python test_graph_layout.py

# 3. Test API Health & Seeded Knowledge Graph
python test_api_endpoints.py
```

---

## 🛠️ Tech Stack

- **Graph Database**: [FalkorDB](https://falkordb.com) (In-memory graph database built on GraphBLAS sparse linear algebra)
- **Agent Protocol**: [FastMCP](https://github.com/jlowin/fastmcp) (Anthropic Model Context Protocol)
- **Frontend**: Next.js 16 (App Router), React 19, Monaco Editor, `@gravity-ui/graph`, Tailwind CSS
- **Backend**: FastAPI, Tree-sitter AST parser, Python 3.12, Uvicorn, Server-Sent Events (SSE)
- **Deployment**: Docker Compose, Multi-stage ARM64/AMD64 builds

---

## 📄 License

Distributed under the **Apache 2.0 License**. See [`LICENSE`](LICENSE) for more information.

<div align="center">
  <sub>Built with ❤️ for the <b>FalkorDB Graph Hacks Hackathon 2026</b>.</sub>
</div>
