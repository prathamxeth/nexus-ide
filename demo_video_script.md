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
> "Look at that. In **under 2 milliseconds**, FalkorDB executes a multi-hop Cypher traversal.  
> Instead of guessing, the graph engine immediately traverses the AST and highlights all impacted callers in **pulsing red**:
> - `processInvoice` in `billing.ts` at Hop 1
> - `auditAccount` in `finance.ts` at Hop 2  
> 
> NexusIDE knows the exact blast radius *before* writing a single line of code."

---

### Segment 3: The Trifecta Demo (All 3 Tracks) (1:30 – 2:15)
**[Visual]**: Zoom in slightly on the graph nodes (Blue, Red, Yellow, Green) and the Composer active context pills.

**[Narrator]**:
> "This is where NexusIDE hits **all three FalkorDB tracks** simultaneously:
> 
> 1. **Track 1 (Connected Data)**: The blue focus node `validateToken` is connected directly to its multi-hop AST call tree via Tree-sitter and FalkorDB GraphBLAS queries.
> 
> 2. **Track 2 (Agent Memory & Coordination)**: Look at this amber node. NexusIDE queried procedural memory and surfaced a rule from a past incident: *'Must check exp claim with clock skew <= 60s'*. The agent is physically prevented from generating a naive patch.
> 
> 3. **Track 3 (Company Brain)**: Notice the emerald node. FalkorDB correlated the code syntax with Git commit history and Jira tickets—surfacing `PR #104` authored by `@alex.chen` (`SEC-402`), giving the AI the original author's intent."

---

### Segment 4: Monaco Split-Diff & Hotkey Resolution (2:15 – 2:45)
**[Visual]**: Monaco Diff view activates side-by-side with additions in green and deletions in red. Show the floating action bar.

**[Narrator]**:
> "Now look at the editor. NexusIDE toggled Monaco's side-by-side Diff view.  
> It injected the fail-closed null checks, respected the 60-second skew tolerance from procedural memory, and avoided any signature breaking changes.  
> 
> I can review the patch, press **`Cmd+Y`** to accept... and notice what happens in the graph: FalkorDB re-indexes the AST in real-time.  
> Now let's click `billing.ts` on the graph—it instantly jumps our editor directly to the caller line."

---

### Segment 5: One-Command Architecture & Conclusion (2:45 – 3:00)
**[Visual]**: Flash the terminal running `./run.sh` and the architectural flow diagram.

**[Narrator]**:
> "Best of all: NexusIDE is a **one-command deployment**. A single `./run.sh` builds FalkorDB, the FastAPI backend, and the Next.js frontend, seeding all AST and PR data with zero configuration.  
> 
> By replacing flat vector embeddings with FalkorDB's sub-millisecond graph intelligence, NexusIDE turns AI from a dangerous code guesser into an enterprise-grade software engineer.  
> 
> Thank you, and welcome to the graph-native future of software development."
