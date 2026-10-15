# ⚡ NexusIDE: The Graph-Native Agentic IDE Powered by FalkorDB

> **Context-aware code refactoring with zero blast-radius hallucinations.**  
> Built for the **FalkorDB Hackathon 2026** — hitting **all 3 challenge tracks** in a unified, one-command deployment.

[![FalkorDB](https://img.shields.io/badge/Powered_by-FalkorDB-red.svg)](https://falkordb.com)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_&_Python-blue.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---

## 🚨 The Problem: Why Vector RAG Fails for Codebases

Standard AI code editors rely on **Vector RAG** (embeddings + semantic similarity). While vector search is adequate for answering generic documentation questions, it fails when executing refactoring in production codebases:

1. **Topological Blindness**: Vector embeddings treat code as flat text chunks. When an AI modifies a function signature (e.g. `validateToken`), it is blind to the fact that `billing.ts` and `finance.ts` call that function across multiple hops.
2. **Amnesia on Regressions**: LLMs repeatedly produce patches with known bugs because vector retrieval lacks episodic and procedural memory of past failed deployments or breaking changes.
3. **No Organizational Context**: Code does not exist in a vacuum. Semantic search cannot correlate syntax with Git pull requests, Jira tickets, security compliance mandates, or author ownership.

**NexusIDE solves this by embedding FalkorDB directly into the inner loop of the agentic IDE.**

---

## 🏆 How NexusIDE Conquers All 3 Tracks

```
               ┌────────────────────────────────────────────────────────┐
               │                      Nexus IDE                         │
               │   (Monaco Split-Diff + Real-time Interactive Graph)    │
               └───────────────────────────▲────────────────────────────┘
                                           │ SSE Live Stream
               ┌───────────────────────────┴────────────────────────────┐
               │          Dual-Agent Orchestrator (FastAPI)             │
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

### 1. Track 1: Connected Data & Graph-RAG (Code Topology & Blast Radius)
- **Tree-sitter AST Extraction**: Ingests TypeScript and TSX into syntactic entities (`File`, `Function`, `Class`, `Method`, `CALLS`, `IMPORTS`).
- **Multi-Hop Cypher Traversal**: Calculates reverse dependency call-chains in **<2ms**, identifying callers up to 4 hops away.
- **Pulsing Visual Blast Radius**: Highlights all affected nodes in pulsing red in the UI graph canvas before synthesizing modifications.

### 2. Track 2: Agent Memory & Multi-Agent Coordination (Procedural Guardrails)
- **Episodic Failure Tracking**: Records past deployment failures, test errors, and rejected diffs as graph nodes linked to target functions.
- **Procedural Rule Injection**: Enforces organizational guardrails (e.g., *"Must check exp with clock skew <= 60s"*) directly into the agent context, preventing regressions.

### 3. Track 3: Company Brain & Enterprise Context (Git & Ticket Attribution)
- **Git & Jira Knowledge Graph**: Connects AST syntax nodes to PR history (`PR #104`), commit metadata, and security tickets (`SEC-402`).
- **Engineer Attribution**: Identifies original authors (`@alex.chen`) and architectural rationales to inform code generation.

---

## ⚡ Quickstart (One Command)

Judges can launch the entire stack with zero configuration:

```bash
git clone https://github.com/your-username/nexus-ide.git
cd nexus-ide
chmod +x run.sh && ./run.sh
```

The bootstrap script will automatically:
1. Build and run `falkordb`, `backend`, and `frontend` via `docker-compose.yml`.
2. Wait for FalkorDB and the FastAPI backend healthcheck probe.
3. Execute `seed_demo_data.py` to index the AST call-graph, procedural rules, and PR metadata.
4. Launch the interface at **`http://localhost:3000`**.

---

## 🔍 FalkorDB Cypher Query Showcase

Here are the real production Cypher queries executed inside NexusIDE:

### 1. Multi-Hop Reverse Blast Radius Query (Track 1)
Traverses the AST dependency graph to detect all upstream caller functions that will break if a target function is modified:

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

### 2. Native FalkorDB Graph Algorithms: PageRank & Criticality (Track 1)
Calculates architectural node criticality using native FalkorDB PageRank GraphBLAS matrix operations:

```cypher
CALL algo.pageRank('Function', 'CALLS')
YIELD node, score
RETURN node.name AS func_name, score
ORDER BY score DESC
LIMIT 10
```

### 3. Procedural Memory Guardrail Retrieval (Track 2)
Pulls historical error resolutions and constraints preventing regression loops:

```cypher
MATCH (fn:Function {name: $target_function})
OPTIONAL MATCH (fn)-[:ASSOCIATED_WITH]->(rule:ProceduralRule)
OPTIONAL MATCH (fn)<-[:FAILED_ON]-(s:Session)-[:VIOLATED_RULE]->(vr:ProceduralRule)
RETURN DISTINCT coalesce(rule.rule, vr.rule) AS guardrail_rule
```

### 4. Dynamic Runtime Memory Writes (Track 2 Across Sessions)
When an engineer rejects a proposed code patch (`⌘N` or UI Reject button), a procedural guardrail node is created dynamically in FalkorDB in real time:

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

### 5. Company Brain Context & Author Attribution (Track 3)
Correlates the function with previous Pull Requests, tickets, and code authors:

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

NexusIDE exposes an open **Model Context Protocol (FastMCP)** server at `backend/mcp_server.py`. Standard external agents (Claude Desktop, Cursor, Open-Source Agent frameworks) can directly consume FalkorDB graph intelligence tools:

```bash
# Run standalone MCP server
python backend/mcp_server.py
```

### Published MCP Tools:
- `get_ast_blast_radius(function_name: str, max_depth: int = 4)`: Cypher multi-hop call graph traversal.
- `retrieve_code_memory(function_name: str)`: Procedural guardrails and learned failure memories.
- `get_ast_centrality()`: Native FalkorDB PageRank scoring for AST node criticality.
- `query_code_provenance(function_name: str)`: Company Brain Git PR, Jira ticket, and engineer authorship lookup.

---

## 🛡️ Kill-Switch Compliance: "The Graph Does Real Work"

Per Hackathon Rules: *"A visualisation drawn on top of ordinary storage does not qualify: if the product still works once FalkorDB is taken out, the graph is decoration rather than the thing the product runs on."*

- **Hard Kill-Switch Enforced**: If FalkorDB on `localhost:6379` is stopped or unreachable, NexusIDE immediately aborts execution and explicitly emits an unhandled refusal event:
  > `[CRITICAL COMPLIANCE FAILURE] FalkorDB required on port 6379: Zero code generated.`
- **Zero Mock Decoration**: No mock fallback patches are generated if the database is disconnected. FalkorDB is the mandatory computational engine of NexusIDE.

---

## 🎬 3-Minute Demo Walkthrough

1. **The Agony (0:00 - 0:30)**:
   - Try refactoring `validateToken` in standard AI editors. The AI changes `auth.ts`, but breaks `billing.ts` and `finance.ts` because it has no topological awareness.
2. **The FalkorDB Advantage (0:30 - 1:30)**:
   - Open NexusIDE at `http://localhost:3000`.
   - Issue prompt: *"Harden validateToken with expiration validation."*
   - Watch the interactive graph instantly light up in **<2ms**, identifying `processInvoice` and `auditAccount` as blast-radius callers in pulsing red.
3. **The Trifecta Verification (1:30 - 2:15)**:
   - **Track 1**: Call-chain traversal displayed in the bottom graph.
   - **Track 2**: Yellow node enforces procedural rule: *`Must check exp with clock skew <= 60s`*.
   - **Track 3**: Green node traces PR #104 by `@alex.chen` (`SEC-402`).
4. **Monaco Side-by-Side Diff (2:15 - 2:45)**:
   - Review live side-by-side diff in Monaco Editor.
   - Press **`Cmd+Y`** to accept the patch and automatically synchronize the graph.

---

## 🛠️ Tech Stack & Architecture

- **Graph Engine**: [FalkorDB](https://falkordb.com) (Redis-compatible graph database using GraphBLAS matrices for sub-millisecond Cypher traversals).
- **Static Analysis**: [Tree-sitter](https://tree-sitter.github.io) (C/Python bindings for full AST extraction of TypeScript & Python).
- **Backend API**: [FastAPI](https://fastapi.tiangolo.com) with Server-Sent Events (SSE) streaming.
- **Frontend IDE**: [Next.js 16](https://nextjs.org), [Monaco Editor](https://microsoft.github.io/monaco-editor/), [ForceGraph2D](https://github.com/vasturiano/react-force-graph), and Tailwind CSS.
- **Orchestration**: Docker Compose with multi-stage builds.

---

## 📜 License

Apache 2.0 License. Designed and built for the FalkorDB Hackathon 2026.
