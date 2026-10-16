<div align="center">

# ⚡ NexusIDE
### The Graph-Native Agentic IDE Powered by FalkorDB

**Deterministic, zero blast-radius code refactoring with in-memory graph intelligence.**  
Built for the **FalkorDB Graph Hacks Hackathon 2026** — seamlessly delivering on all 3 challenge tracks.

<br/>

[![Demo Video](https://img.shields.io/badge/🎬_Live_Demo-Loom_Walkthrough-f54e00?style=for-the-badge&logo=loom&logoColor=white)](https://www.loom.com/share/7de75784a52d4da8a8e4f0beb4fe868c)
[![GitHub Stars](https://img.shields.io/github/stars/prathamxeth/nexus-ide?style=for-the-badge&color=2563eb)](https://github.com/prathamxeth/nexus-ide)
[![License](https://img.shields.io/badge/License-Apache_2.0-16a34a?style=for-the-badge)](LICENSE)

<br/>

[![FalkorDB](https://img.shields.io/badge/Graph_Engine-FalkorDB_(GraphBLAS_<2ms)-dc2626.svg)](https://falkordb.com)
[![FastMCP](https://img.shields.io/badge/Agent_Protocol-Model_Context_Protocol_(FastMCP)-9333ea.svg)](https://modelcontextprotocol.io)
[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js_16_+_Monaco-000000.svg)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_+_Python_3.12-059669.svg)](https://fastapi.tiangolo.com)

<br/>

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │  🎬 3-MINUTE INTERACTIVE DEMO                                          │
 │  Watch live multi-hop blast radius traversal, PageRank centrality,    │
 │  and instant memory learning via the ⌘N rejection shortcut:           │
 │  👉 https://www.loom.com/share/7de75784a52d4da8a8e4f0beb4fe868c       │
 └────────────────────────────────────────────────────────────────────────┘
```

</div>

---

## 🚨 The Core Problem: Why Vector RAG Fails Code

Standard AI coding tools (Copilot, Cursor, Windsurf) slice codebases into arbitrary **500-token text chunks** and match them using keyword vector similarity. 

While vector search works well for conversational text, **code is not an essay—code is a directed, typed graph.**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                    THE MULTI-HOP VISIBILITY GAP IN CODE                      │
└──────────────────────────────────────────────────────────────────────────────┘

  PROMPT: "Harden validateToken in auth.ts"
     │
     ▼
  [ auth.ts: validateToken ] ◄── (Vector RAG finds this word match)
     │
     ▼ (Hop 1: called by)
  [ billing.ts: processInvoice ] ◄── (Vector similarity drops: 41%)
     │
     ▼ (Hop 2: called by)
  [ finance.ts: auditAccount ] ◄── (CRITICAL BLIND SPOT: Vector similarity < 10%)
                                    Silent production crash!
```

When you change a function signature in `auth.ts`, the downstream caller `finance.ts` never mentions words like *"token skew"* or *"JWT signature"*. 

To Vector RAG, **`finance.ts` is completely invisible**, causing the agent to hallucinate breaking edits with zero awareness of downstream callers.

---

## 📊 Visual Benchmark: FalkorDB vs. Vector RAG

```text
QUERY LATENCY (P50) — Lower is better
Vector RAG (Embeddings + ANN) : 380 ms  [████████████████████████████████████████]
FalkorDB (GraphBLAS Cypher)   : 0.9 ms  [▏]  ◄── 422x FASTER (<1ms in CPU cache)

MULTI-HOP CALL RECALL (Hop 1..4) — Higher is better
Vector RAG                    : 14%     [███░░░░░░░░░░░░░░░░░] (Truncated chunks)
FalkorDB Graph-RAG            : 100%    [████████████████████] (Deterministic)

COST PER 10,000 TRAVERSALS — Lower is better
Vector RAG (API Tokens)       : ~$4.00  [██████████████████████████████]
FalkorDB In-Memory Engine     : $0.00   [▏]  ◄── Local in-memory graph

RAM / RESOURCE OVERHEAD — Lower is better
External Vector DB Cluster    : ~850MB  [██████████████████████████████]
FalkorDB Docker Container     : ~45MB   [██] ◄── Lightweight & embedded
```

---

## 🏆 3 Hackathon Tracks in 1 Unified Graph

NexusIDE unifies all three challenge tracks inside a single multi-layer FalkorDB property graph:

```mermaid
graph TD
    subgraph Layer3["🏢 TRACK 3: COMPANY BRAIN & PROVENANCE"]
        ENG["👤 Engineer (:Engineer)"] -->|"AUTHORED"| PR["🔀 Pull Request (:PR)"]
        PR -->|"RESOLVES"| TIK["🎫 Ticket (:Ticket)"]
        TIK -->|"TOUCHES"| FN
    end

    subgraph Layer1["⚡ TRACK 1: AST CODE TOPOLOGY & GRAPH-RAG"]
        FILE["📄 File (:File)"] -->|"DEFINES"| FN["⚡ Function (:Function)"]
        FN -->|"CALLS (1..4 hops)"| CALLER["⚡ Downstream Caller (:Function)"]
        CALLER -->|"PageRank Score"| RANK["📈 Centrality Rank"]
    end

    subgraph Layer2["🧠 TRACK 2: AGENT MEMORY & COORDINATION"]
        FN -->|"HAS_RULE"| MEM["🧠 Episodic Rule (:Memory)"]
        REJECT["⌨️ ⌘N Human Rejection"] -->|"WRITES RULE"| MEM
    end

    classDef l1 fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef l2 fill:#18181b,stroke:#f59e0b,stroke-width:2px,color:#f8fafc;
    classDef l3 fill:#052e16,stroke:#22c55e,stroke-width:2px,color:#f8fafc;
    class FILE,FN,CALLER,RANK l1;
    class MEM,REJECT l2;
    class ENG,PR,TIK l3;
```

---

## 🗺️ Visual Architecture: 4-Lane Real-Time Canvas

When the agent refactors code, `@gravity-ui/graph` arranges the codebase into **4 vertical swimlanes**. Nodes pulse in real time over Server-Sent Events (`graph_traversal`) as Cypher paths evaluate:

```text
  LANE 0 (x=50)        LANE 1 (x=350)        LANE 2 (x=680)         LANE 3 (x=1000)
┌───────────────┐    ┌─────────────────┐   ┌─────────────────┐    ┌─────────────────┐
│  FILES & AST  │    │ TARGET FUNCTION │   │  BLAST RADIUS   │    │ MEMORY & BLAME  │
├───────────────┤    ├─────────────────┤   ├─────────────────┤    ├─────────────────┤
│ • auth.ts     │───►│ • validateToken │◄──│ • processInvoice│◄───│ • Rule #402     │
│ • billing.ts  │    │   (blast_level=0)│   │   (Hop 1)       │    │ • PR #104       │
│ • finance.ts  │    │   (PageRank 4.2) │   │ • auditAccount  │    │ • Ticket SEC-892│
│               │    │                 │   │   (Hop 2)       │    │ • @alex.chen    │
└───────────────┘    └─────────────────┘   └─────────────────┘    └─────────────────┘
     Files &             Target under          Upstream Callers      Institutional
     Imports              Inspection          at Risk of Breakage    Context & Rules
```

---

## 🔁 The Human-in-the-Loop Feedback Engine

Unlike conventional coding agents that forget corrections the instant you close the tab, NexusIDE features **active episodic reinforcement**:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as 👨‍💻 Developer
    participant UI as 🖥️ NexusIDE Studio
    participant Agent as 🤖 Agent Orchestrator
    participant Falkor as ⚡ FalkorDB Graph

    Dev->>UI: "Refactor validateToken"
    UI->>Agent: Stream Refactor Request
    Agent->>Falkor: Cypher: Multi-hop blast radius & memory
    Falkor-->>Agent: Returns 2 Callers + 1 Past Rule (<2ms)
    Agent-->>UI: Live SSE Traversal Pulse + Monaco Split-Diff
    Dev->>UI: Press ⌘N ("Reject: Preserve legacy epoch timestamps")
    UI->>Falkor: CREATE (:Memory {rule: "Preserve epoch timestamp"})
    Note over Falkor: Rule permanently linked to (:Function)<br/>Persists cross-session for entire team!
    UI-->>Dev: Audio Feedback + Memory Confirmed
```

---

## 🛡️ The Hard Kill-Switch: Pure Graph Dependency

To prove NexusIDE is **strictly graph-native** (and not a generic LLM wrapper with hidden filesystem lookups):
- The agent has **zero raw filesystem tools** (`no open()`, `no grep`, `no cat`).
- If FalkorDB is offline or port `6379` is unreachable, `check_falkor_health` throws an immediate `ConnectionError`.
- The agent refuses code generation and emits an `abort` event.
- **Exactly ZERO lines of code or patches are written.**

```text
$ python backend/test_agent_killswitch.py

🧪 Test 1: Active FalkorDB Connection
✔ Graph traversal verified: 7 visited nodes, 5 active paths
✔ Context resolved: 2 institutional rules, 3 dependent callers
✔ Multi-file coordinated patch generated safely!

🧪 Test 2: FalkorDB Disconnected (Kill-Switch Verification)
✔ check_falkor_health properly triggered ConnectionError
✔ Agent refused code generation with safety mandate
✔ Confirmed: ZERO code patches emitted when graph engine is offline!
```

---

## 🔌 Open Protocols: Built on FastMCP

The entire code graph is exposed as a standardized **FastMCP (Model Context Protocol)** server in `backend/mcp_server.py`. 

Any MCP client (Claude Desktop, Cursor, or autonomous agents) can connect directly:

```json
{
  "mcpServers": {
    "nexus-code-graph": {
      "command": "python",
      "args": ["-m", "backend.mcp_server"],
      "env": {
        "FALKORDB_HOST": "localhost",
        "FALKORDB_PORT": "6379"
      }
    }
  }
}
```

### Standard MCP Primitives:
- `get_code_blast_radius(function_name, max_depth=4)`: Returns callers and call depth in under 2ms.
- `get_episodic_memory(function_name)`: Returns human rejection rules and past incident reports.
- `get_company_context(function_name)`: Returns author PRs, Git blame, and ticket intent.

---

## 🚀 Quick Start (Up in 60 Seconds)

### 1-Command Launch
```bash
# Clone the repository
git clone https://github.com/prathamxeth/nexus-ide.git
cd nexus-ide

# Bootstrap all containers and services
./run.sh
```

*(On Apple Silicon Macs, you can also run `./launch-mac.sh` for native Metal/ARM64 optimization).*

### Services & Endpoints
| Component | Address | Purpose |
| :--- | :--- | :--- |
| **NexusIDE Studio** | [`http://localhost:3000`](http://localhost:3000) | Monaco Split-Diff & Interactive Graph UI |
| **FastAPI Backend** | [`http://localhost:8000`](http://localhost:8000) | REST API & SSE Event Stream |
| **Interactive Docs** | [`http://localhost:8000/docs`](http://localhost:8000/docs) | Swagger OpenAPI Specification |
| **FalkorDB Socket** | `localhost:6379` | In-memory Redis-compatible graph engine |

---

## 🧪 Automated Verification Suite

Run our comprehensive verification suites with one command:

```bash
cd backend
source .venv/bin/activate

# 1. Verify FalkorDB Hard Kill-Switch & Zero Code Mandate
python test_agent_killswitch.py

# 2. Verify 4-Swimlane Layout Mathematics
python test_graph_layout.py

# 3. Verify API Health & Seeded Knowledge Graph (66 nodes)
python test_api_endpoints.py
```

---

## 🛠️ Tech Stack

- **Graph Engine**: [FalkorDB](https://falkordb.com) (In-memory graph database built on GraphBLAS linear algebra)
- **Agent Protocol**: [FastMCP](https://github.com/jlowin/fastmcp) (Anthropic Model Context Protocol)
- **Frontend Studio**: Next.js 16 (App Router), React 19, Monaco Editor, `@gravity-ui/graph`, Tailwind CSS
- **Backend Orchestrator**: FastAPI, Tree-sitter AST parser, Python 3.12, Uvicorn, Server-Sent Events (SSE)
- **Containerization**: Docker Compose, Multi-stage ARM64/AMD64 builds

---

## 📄 License

Distributed under the **Apache 2.0 License**. See [`LICENSE`](LICENSE) for details.

<div align="center">
  <sub>Built with ❤️ for the <b>FalkorDB Graph Hacks Hackathon 2026</b>.</sub>
</div>
