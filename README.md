# ⚡ NexusIDE (GraphiCode)
### The Graph-Native Agentic IDE Powered by FalkorDB

> **Context-aware code refactoring with zero blast-radius hallucinations.**  
> Built for the **FalkorDB Graph Hacks Hackathon 2026** — seamlessly delivering on **all 3 challenge tracks** in a unified, one-command deployment.

[![FalkorDB](https://img.shields.io/badge/Graph_Engine-FalkorDB_(GraphBLAS_<2ms)-red.svg)](https://falkordb.com)
[![FastMCP](https://img.shields.io/badge/Agent_Protocol-Model_Context_Protocol_(FastMCP)-purple.svg)](https://modelcontextprotocol.io)
[![Track 1](https://img.shields.io/badge/Track_1-Connected_Data_&_Graph--RAG-blue.svg)](https://www.wemakedevs.org/hackathons/falkordb/rules)
[![Track 2](https://img.shields.io/badge/Track_2-Agent_Memory_&_Coordination-yellow.svg)](https://www.wemakedevs.org/hackathons/falkordb/rules)
[![Track 3](https://img.shields.io/badge/Track_3-Company_Brain_&_Context-green.svg)](https://www.wemakedevs.org/hackathons/falkordb/rules)
[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js_16_+_Monaco-black.svg)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---

## 📌 Quick Links for Judges
- 🎬 **Demo Video Script**: [`demo_video_script.md`](./demo_video_script.md) *(3-minute high-impact walkthrough)*
- 📝 **Technical Blog Post**: [`blog_post.md`](./blog_post.md) *(In-depth architectural breakdown)*
- 🔌 **FastMCP Server**: [`backend/mcp_server.py`](./backend/mcp_server.py) *(Open agent protocol tool server)*
- 🚀 **1-Command Bootstrap**: [`run.sh`](./run.sh) / [`docker-compose.yml`](./docker-compose.yml)

---

## 🚨 The Core Problem: Why Vector RAG Fails for Code

Standard AI coding tools (Copilot, Cursor, Windsurf) rely on **Vector RAG** (embeddings + semantic similarity). While vector search retrieves similar text, it is catastrophically blind to codebase topology:

| Capability | Vector RAG (Cursor / Copilot) | NexusIDE (FalkorDB Graph-RAG) |
| :--- | :--- | :--- |
| **Multi-Hop Dependency Blast Radius** | ❌ Blind (Cannot trace `auth.ts` ➔ `billing.ts` ➔ `finance.ts`) | ✅ **<2ms** multi-hop Cypher traversal |
| **Architectural Node Criticality** | ❌ None (Treats all functions as flat text chunks) | ✅ **Native FalkorDB PageRank** (`algo.pageRank`) |
| **Episodic & Procedural Memory** | ❌ Hallucinates past bugs repeatedly across sessions | ✅ **Live Session Writes** on patch rejection (`⌘N`) |
| **Company Provenance & Intent** | ❌ Stripped away from vector text slices | ✅ **Company Brain** (PRs, Tickets, Git blame) |
| **External Agent Extensibility** | ❌ Closed proprietary prompt loops | ✅ **Standard FastMCP Server** tools |

---

## 🏆 Hackathon Tracks Alignment

```
               ┌────────────────────────────────────────────────────────┐
               │              NexusIDE Interactive Studio               │
               │   (Monaco Split-Diff + Real-time Interactive Graph)    │
               └───────────────────────────▲────────────────────────────┘
                                           │ SSE Live Stream
               ┌───────────────────────────┴────────────────────────────┐
               │          FastAPI Orchestrator & FastMCP Server         │
               └───────▲───────────────────▲───────────────────▲────────┘
                       │                   │                   │
             ┌─────────┴─────────┐ ┌───────┴─────────┐ ┌───────┴─────────┐
             │      TRACK 1      │ │      TRACK 2      │ │      TRACK 3      │
             │  Connected Data   │ │  Agent Memory &   │ │ Company Brain &   │
             │   & Graph-RAG     │ │   Coordination    │ │ Enterprise Context│
             └─────────┬─────────┘ └───────┬─────────┘ └───────┬─────────┘
                       │                   │                   │
      ┌────────────────┴───────────────────┴───────────────────┴────────────────┐
      │                        FalkorDB Engine (<2ms)                           │
      │  • AST Call Graphs   • Procedural Rules   • PRs, Tickets & Git Authors  │
      └─────────────────────────────────────────────────────────────────────────┘
```

### 🔹 Track 1: Connected Data & Graph-RAG
- **Tree-sitter AST Graph Extraction**: Synthesizes files, functions, classes, calls, and imports into a typed property graph.
- **Sub-2ms Blast Radius Cypher**: Traverses callers up to 4 hops away, highlighting them in pulsing red before editing code.
- **Native FalkorDB PageRank**: Uses GraphBLAS matrix multiplication (`CALL algo.pageRank('Function', 'CALLS')`) to score function centrality (e.g. `validateToken: 0.89`).

### 🔹 Track 2: Agent Memory & Multi-Agent Coordination
- **Procedural Guardrails**: Enforces incident rules (e.g., *"Must verify exp claim with clock skew <= 60s"*) directly in the agent context.
- **Live Dynamic Memory Writes**: When an engineer rejects a proposed diff via **Reject (`⌘N`)**, NexusIDE dynamically writes a `(:Memory {type: 'procedural_guardrail'})` node linked to the function in real time. Future agent prompts automatically respect this learned constraint!

### 🔹 Track 3: Company Brain & Enterprise Context
- **Git & Jira Provenance**: Correlates code syntax with Pull Requests (`PR #104`), commit history, and Jira security tickets (`SEC-402`).
- **Human Attribution**: Automatically surfaces author ownership (`@alex.chen`) and architectural rationales.

---

## ⚡ Quickstart (One Command)

Launch the entire stack with zero external dependencies:

```bash
git clone https://github.com/prathamxeth/nexus-ide.git
cd nexus-ide
chmod +x run.sh && ./run.sh
```

Or run directly with Docker Compose:
```bash
docker compose up -d
```

The bootstrap script will automatically:
1. Spin up **FalkorDB**, the **FastAPI + FastMCP backend**, and the **Next.js 16 frontend**.
2. Run database healthchecks and initialize indexed schemas.
3. Seed the AST knowledge graph, procedural rules, and enterprise provenance via `seed_demo_data.py`.
4. Open the interface at **`http://localhost:3000`**.

---

## 🔍 Core FalkorDB Cypher Queries

### 1. Multi-Hop Dependency Blast Radius (Track 1)
```cypher
MATCH (target:Function {name: $target_function})
OPTIONAL MATCH path = (caller:Function)-[:CALLS*1..4]->(target)
WHERE caller <> target
RETURN caller.name AS caller_name,
       caller.file AS caller_file,
       length(path) AS hop_distance,
       [node IN nodes(path) | node.name] AS call_chain
ORDER BY hop_distance ASC
```

### 2. Native FalkorDB PageRank Criticality (Track 1)
```cypher
CALL algo.pageRank('Function', 'CALLS')
YIELD node, score
RETURN node.name AS func_name, score
ORDER BY score DESC
LIMIT 10
```

### 3. Dynamic Procedural Memory Persistence on Rejection (Track 2)
```cypher
MATCH (fn:Function {name: $func_name})
CREATE (m:Memory {
    type: 'procedural_guardrail',
    rule: $reason,
    bad_diff_sample: $diff,
    created_at: timestamp()
})
CREATE (fn)-[:CONSTRAINED_BY]->(m)
RETURN m
```

### 4. Company Brain & Author Provenance (Track 3)
```cypher
MATCH (fn:Function {name: $target_function})
OPTIONAL MATCH (eng:Engineer)-[:AUTHORED]->(pr:PR)-[:TOUCHES]->(fn)
OPTIONAL MATCH (pr)-[:RESOLVES]->(t:Ticket)
RETURN eng.handle AS author,
       pr.number AS pr_number,
       pr.title AS pr_title,
       t.key AS ticket_key
ORDER BY pr.number DESC
LIMIT 3
```

---

## 🔌 Model Context Protocol (FastMCP Server)

NexusIDE exposes an open **Model Context Protocol (FastMCP)** server at [`backend/mcp_server.py`](./backend/mcp_server.py). Any external agent (Claude Desktop, Cursor, or LangChain / CrewAI agents) can query FalkorDB graph intelligence tools over standard stdio / SSE:

```bash
# Run standalone FastMCP server
python backend/mcp_server.py
```

### Published MCP Tools:
- `get_ast_blast_radius(function_name, max_depth)`: Multi-hop AST caller graph traversal.
- `retrieve_code_memory(function_name)`: Procedural guardrails and learned failure rules.
- `get_ast_centrality()`: Native FalkorDB PageRank node criticality scoring.
- `query_code_provenance(function_name)`: Git PR, Jira ticket, and engineer authorship history.

---

## 🛡️ Kill-Switch Compliance: "The Graph Does Real Work"

> **Hackathon Disqualification Litmus Test**: *"The graph has to do real work. A visualisation drawn on top of ordinary storage does not qualify: if the product still works once FalkorDB is taken out, the graph is decoration rather than the thing the product runs on."*

- **Hard Kill-Switch Enforced**: If FalkorDB on `localhost:6379` is stopped or unreachable, NexusIDE immediately aborts execution and explicitly emits an unhandled refusal event:
  > `🚨 [CRITICAL COMPLIANCE FAILURE] FalkorDB required on port 6379: Zero code generated.`
- **Zero Mock Decoration**: All silent mock fallbacks were deleted. FalkorDB is the mandatory computational engine of NexusIDE.

---

## 🎬 3-Minute Demo Flow

1. **The Agony (0:00 - 0:30)**: Attempting to refactor `validateToken` with standard vector RAG breaks `billing.ts` and `finance.ts`.
2. **FalkorDB Sub-Millisecond Traversal (0:30 - 1:30)**: In **<2ms**, FalkorDB calculates the full blast radius, pulses `processInvoice` and `auditAccount` in red, and outputs `validateToken`'s PageRank criticality score (0.89).
3. **The 3 Tracks in Action (1:30 - 2:15)**:
   - **Track 1**: Real-time AST call tree and FastMCP tool exposure.
   - **Track 2**: Amber procedural node blocks naive patches lacking clock skew tolerance.
   - **Track 3**: Emerald node attributes original intent to `@alex.chen` in `PR #104` (`SEC-402`).
4. **Live Memory Write & Hotkeys (2:15 - 2:45)**: Hit **Reject (`⌘N`)** on a patch to write a dynamic memory node to FalkorDB; hit **Accept (`⌘Y`)** to patch and re-index.
5. **Kill-Switch Verification (2:45 - 3:00)**: Kill the FalkorDB container and show the agent refusing to generate code.

---

## 🛠️ Tech Stack

- **Graph Database**: [FalkorDB](https://falkordb.com) (GraphBLAS in-memory engine, sub-millisecond Cypher, native algorithms)
- **Agent Protocol**: Python `mcp` / `FastMCP` standard
- **Static AST Extraction**: [Tree-sitter](https://tree-sitter.github.io) (C/Python bindings for full AST extraction)
- **Backend**: FastAPI with async Server-Sent Events (SSE) streaming
- **Frontend**: Next.js 16 (App Router), Monaco Code & Diff Editor, `@gravity-ui/graph`
- **Orchestration**: Docker Compose multi-stage builds

---

## 📜 License

Apache 2.0 License. Designed and built for the FalkorDB Graph Hacks Hackathon 2026.
