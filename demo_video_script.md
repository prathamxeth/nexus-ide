# 🎬 NexusIDE — 3-Minute Hackathon Winning Demo Script

> **Recording Tool**: Loom or Screen Studio (1080p / 60fps)  
> **Total Duration**: 3:00  
> **Speaker Tone**: Confident, fast-paced, high technical clarity.

---

### Segment 1: The Agony & Contrast (0:00 – 0:30)
**[Visual]**: Split screen. On the left, a standard chat window or Cursor. On the right, terminal showing test suite.

**[Narrator]**:
> "Every developer has experienced this nightmare: You ask an AI code assistant to refactor a critical authentication function: *'Harden validateToken with strict validation'*.  
> 
> The AI modifies `auth.ts`. It looks plausible. But the moment you deploy or run your test suite—**BOOM**.  
> `billing.ts` explodes. `finance.ts` fails in production.  
> 
> Why? Because **Vector RAG is topologically blind**. Embeddings find semantically similar text, but they have zero awareness of caller graphs, multi-hop dependencies, or procedural constraints.  
> 
> To solve this, we built **NexusIDE**—the graph-native agentic IDE powered by **FalkorDB**."

---

### Segment 2: The FalkorDB Advantage (0:30 – 1:30)
**[Visual]**: Transition to NexusIDE running at `http://localhost:3000`. Show the sleek dark desktop interface.

**[Narrator]**:
> "Here is NexusIDE. Notice the left sidebar with our active review queue, our central Composer Agent, and our interactive live workspace.  
> 
> Let's run that exact same prompt: *'Add expiration check to validateToken and update callers'*. Watch the bottom drawer."

**[Action]**: Click the **↑** submit button.

**[Narrator]**:
> "Look at that. In **under 2 milliseconds**, FalkorDB executes a multi-hop Cypher traversal and native **PageRank GraphBLAS algorithms**.  
> Instead of guessing, the graph engine immediately traverses the AST and highlights all impacted callers in **pulsing red**:
> - `processInvoice` in `billing.ts` at Hop 1
> - `auditAccount` in `finance.ts` at Hop 2  
> - And calculates `validateToken`'s centrality score at **0.89**—identifying it as a high-risk architectural hub.
> 
> NexusIDE knows the exact blast radius *before* writing a single line of code."

---

### Segment 3: The Trifecta Demo (All 3 Tracks) (1:30 – 2:15)
**[Visual]**: Zoom in slightly on the graph nodes (Blue, Red, Yellow, Green) and the Composer active context pills.

**[Narrator]**:
> "This is where NexusIDE hits **all three FalkorDB tracks** simultaneously:
> 
> 1. **Track 1 (Connected Data)**: The AST call tree is traversed in real-time, exposed via an open **FastMCP Server** (`backend/mcp_server.py`) so external agents like Claude or Cursor can query blast radius and centrality via standard MCP tools.
> 
> 2. **Track 2 (Agent Memory & Coordination)**: Look at this amber node. NexusIDE queried procedural memory and surfaced a rule from a past incident: *'Must check exp claim with clock skew <= 60s'*. The agent is physically prevented from generating a naive patch.
> 
> 3. **Track 3 (Company Brain)**: Notice the emerald node. FalkorDB correlated code syntax with Git commit history and Jira tickets—surfacing `PR #104` authored by `@alex.chen` (`SEC-402`), preserving the original author's intent."

---

### Segment 4: Monaco Split-Diff & Dynamic Memory Rejection (2:15 – 2:45)
**[Visual]**: Monaco Diff view activates side-by-side. Point out the Reject (⌘N) and Accept & Save (⌘Y) buttons.

**[Narrator]**:
> "Now look at the editor. NexusIDE opens Monaco's side-by-side Diff view.  
> It injected the fail-closed null checks, respected the 60-second skew tolerance, and avoided breaking caller signatures.  
> 
> But what if the user rejects a patch? Watch this: I hit **Reject (⌘N)**.  
> In real time, NexusIDE executes a dynamic Cypher write to FalkorDB, persisting this rejection as a new procedural guardrail node. Future agent sessions immediately learn this constraint!  
> 
> When I hit **Accept & Save (⌘Y)**, the code is patched and FalkorDB re-indexes the AST instantly."

---

### Segment 5: The Kill-Switch & One-Command Architecture (2:45 – 3:00)
**[Visual]**: Flash the terminal running `docker compose up -d` or `./run.sh`, showing FalkorDB running.

**[Narrator]**:
> "Most importantly, NexusIDE passes the hackathon's strictest litmus test: **The Kill-Switch**.  
> The graph is not decoration—if FalkorDB is offline, the agent strictly refuses to generate code.  
> 
> Everything runs in one command via `./run.sh` or `docker compose up -d`.  
> By replacing flat vector embeddings with FalkorDB's sub-millisecond graph intelligence, NexusIDE turns AI code editors from dangerous guessers into true enterprise software engineers.  
> 
> Thank you, and welcome to the graph-native future of software development."
