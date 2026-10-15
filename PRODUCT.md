# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Individual full-stack developers looking for an intelligent IDE with live AST dependency visualization, who need to refactor interdependent modules without accidental breaking changes.

## Product Purpose
NexusIDE is a graph-native agentic development environment powered by FalkorDB. It eliminates blast-radius hallucinations during AI refactoring by mapping the entire AST call-graph, historical procedural rules, and enterprise PR/commit history directly into the inner loop of the IDE. Success means a developer can prompt an edit on a core function, see upstream caller impacts in real-time (<2ms Cypher traversal), and accept verified side-by-side Monaco diffs with zero downstream regressions.

## Positioning
Unlike conventional AI code editors that rely strictly on flat vector RAG (embeddings and cosine similarity) and suffer from topological blindness, NexusIDE executes sub-millisecond Cypher traversals over live AST graphs. It guarantees topological awareness across multi-hop call chains and injects procedural memory guardrails to block previously failed patterns.

## Operating Context
- Local developer workspace with dual-split pane: Monaco code editor on the left and real-time interactive FalkorDB Network Graph canvas on the right.
- Real-time Server-Sent Events (SSE) streaming traversal events (`graph_traversal`), highlighting affected upstream callers in pulsing blast-radius indicators.
- In-IDE chat interface with dual-agent orchestration (FastAPI backend + Tree-sitter parser + FalkorDB graph engine).
- Side-by-side Monaco diff review with atomic acceptance (`Cmd+Y` / Apply patch).

## Capabilities and Constraints
- Sub-2ms graph traversals using FalkorDB's GraphBLAS matrix engine.
- Tree-sitter AST extraction for TypeScript and Python (`File`, `Function`, `Class`, `CALLS`, `IMPORTS`).
- Procedural memory guardrail enforcement (blocking regressions like token expiration clock skew bugs).
- Dark pure-black aesthetic (`#000000`, `#050505`, `#080808`), neutral greys (`#888888`), zero unwanted blue/indigo cast, distinct unchanged vs modified file indicators, and border-based minimalist controls.

## Brand Commitments
- Name: NexusIDE
- Visual Language: Inspired by Cursor desktop design system, adhering to pure black surfaces, high-contrast monospace code readability, and quiet border-styled interactive elements.

## Evidence on Hand
- Complete working full-stack implementation: FastAPI backend (`/backend`), Next.js 16 frontend (`/frontend`), Monaco diff editor, ForceGraph2D canvas, and FalkorDB Docker container.
- Seed demo dataset with multi-hop dependencies: `auth.ts` -> `billing.ts` -> `finance.ts`, procedural rules, and PR #104 / SEC-402 commit records.
- Live verified background services running via `./launch-mac.sh` (Next.js on `:3000`) and FastAPI Uvicorn on `:8000`.

## Product Principles
1. **Topological Grounding over Semantic Guesswork**: Never generate or patch multi-file code without querying the live AST graph for caller dependencies.
2. **Zero Regressions via Procedural Memory**: Explicitly consult episodic memory and rule guardrails before presenting code proposals to the user.
3. **Transparent Blast Radius**: Surface affected upstream components visually and immediately so the developer is always in complete control.
4. **Focused Monastic Ergonomics**: The IDE interface must feel ultra-responsive, distraction-free, and dark, letting code and topology lead without UI clutter.

## Accessibility & Inclusion
- WCAG AA contrast compliance across pure-black backgrounds (`#000000`) and foreground elements (`#f3f3f3`, `#e5c07b`, `#888888`).
- Visible focus rings and keyboard navigability (`Cmd+Y`, tab switches, dismissable dropdowns with Escape/outside-click).
