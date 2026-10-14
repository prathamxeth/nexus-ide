"""Nexus IDE Backend Service.

FastAPI application exposing AST parsing, FalkorDB graph-native intelligence,
multi-hop graph traversals, and blast radius analysis.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.ast_parser import get_ast_parser
from services.falkor_client import get_falkor_service

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("nexus.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for resource initialization and teardown."""
    logger.info("Initializing Nexus IDE backend resources...")
    falkor = get_falkor_service()
    try:
        falkor.connect()
        logger.info("FalkorDB connection established successfully.")
        # Enforce required graph indices on startup
        schema_results = falkor.init_schema()
        logger.info("FalkorDB schema initialized successfully: %s", schema_results)
    except Exception as exc:
        logger.warning(
            "FalkorDB not immediately reachable at startup (%s). Will connect and initialize lazily.",
            exc,
        )
    yield
    logger.info("Shutting down Nexus IDE backend resources...")
    falkor.close()


app = FastAPI(
    title="Nexus IDE Backend API",
    description="Knowledge graph and AST parsing engine for Nexus IDE.",
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for frontend development (Next.js typically on port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Request & Response Models ---------------- #

class ParseRequest(BaseModel):
    code: str = Field(..., description="Source code content to parse")
    language: str = Field("typescript", description="Language: typescript, tsx, python")
    file_path: Optional[str] = Field("src/module.ts", description="Relative or absolute file path")


class IndexCodePayload(BaseModel):
    path: Optional[str] = Field(None, description="Path of the source file")
    content: Optional[str] = Field(None, description="Source code content")
    # Backwards-compatible aliases
    file_path: Optional[str] = Field(None, description="Legacy alias for path")
    code: Optional[str] = Field(None, description="Legacy alias for content")
    language: Optional[str] = Field("typescript", description="Source code language")

    def get_file_path(self) -> str:
        return self.path or self.file_path or f"src/sample.{self.language or 'ts'}"

    def get_content(self) -> str:
        return self.content or self.code or ""


class IndexCodeResponse(BaseModel):
    success: bool
    file: str
    nodes_created: int
    relationships_created: int
    execution_time_ms: float
    counts: Dict[str, int]


class CypherQueryRequest(BaseModel):
    query: str = Field(..., description="Cypher query statement to execute")
    params: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Query parameters")


class DatabaseHealth(BaseModel):
    status: str = Field(..., description="Database connection status: connected | disconnected")
    active_nodes_count: int = Field(..., description="Total active nodes in graph")
    latency_ms: Optional[float] = Field(None, description="Round-trip Cypher query ping latency in ms")
    host: str = Field(..., description="Database host")
    port: int = Field(..., description="Database port")
    graph: str = Field(..., description="Selected graph name")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Service overall status: healthy | degraded")
    database: DatabaseHealth = Field(..., description="FalkorDB database health and performance metrics")
    falkordb_connected: bool = Field(..., description="Quick boolean check for database connectivity")
    details: Dict[str, Any] = Field(default_factory=dict, description="Diagnostic details map")


class GraphNode(BaseModel):
    id: str
    label: str
    layer: str = Field("ast", description="ast | blast | memory | company")
    file: Optional[str] = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)
    type: Optional[str] = "Node"
    properties: Optional[Dict[str, Any]] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str = Field("CALLS", description="CALLS | IMPACTS | CONSTRAINED_BY | AUTHORED_BY")
    relationship: Optional[str] = "CALLS"
    properties: Optional[Dict[str, Any]] = None


class GraphInspectResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    execution_time_ms: float


class DependentFunction(BaseModel):
    name: str
    file: str
    depth: int


class BlastRadiusResponse(BaseModel):
    root_function: str
    max_depth: int
    total_affected_functions: int
    affected_files: List[str]
    dependents: List[DependentFunction]
    execution_time_ms: float


# ---------------- Endpoints ---------------- #

@app.get("/health", response_model=HealthResponse, tags=["Diagnostics"])
def health_check() -> HealthResponse:
    """Diagnostic health check verifying backend service, active nodes count, and latency in ms."""
    falkor = get_falkor_service()
    metrics = falkor.get_health_metrics()
    is_connected = metrics["status"] == "connected"

    db_health = DatabaseHealth(
        status=metrics["status"],
        active_nodes_count=metrics["active_nodes_count"],
        latency_ms=metrics["latency_ms"],
        host=metrics["host"],
        port=metrics["port"],
        graph=metrics["graph"],
    )

    return HealthResponse(
        status="healthy" if is_connected else "degraded",
        database=db_health,
        falkordb_connected=is_connected,
        details=metrics,
    )


@app.post("/api/ast/parse", tags=["AST Engine"])
def parse_code(request: ParseRequest) -> Dict[str, Any]:
    """Parse source code into AST symbol abstractions."""
    parser = get_ast_parser()
    try:
        result = parser.parse(code=request.code, language=request.language)
        return {"success": True, "data": result}
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as exc:
        logger.error("AST Parsing error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Parsing error: {exc}",
        )


@app.post("/api/graph/index-code", response_model=IndexCodeResponse, tags=["Knowledge Graph"])
def index_code(payload: IndexCodePayload) -> IndexCodeResponse:
    """Index source code AST into FalkorDB and return created nodes, relations, and execution latency."""
    parser = get_ast_parser()
    falkor = get_falkor_service()

    file_path = payload.get_file_path()
    content = payload.get_content()

    try:
        result = parser.index_source_file(
            file_path=file_path,
            code_content=content,
            falkor_service=falkor,
        )
        return IndexCodeResponse(
            success=result["success"],
            file=result["file"],
            nodes_created=result["nodes_created"],
            relationships_created=result["relationships_created"],
            execution_time_ms=result["execution_time_ms"],
            counts=result["counts"],
        )
    except Exception as exc:
        logger.error("Failed to index code into FalkorDB: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Code indexing failed: {exc}",
        )


@app.get("/api/graph/inspect", response_model=GraphInspectResponse, tags=["Knowledge Graph"])
def inspect_graph(file: Optional[str] = Query(None, description="Optional file path filter")) -> GraphInspectResponse:
    """Inspect code graph nodes and edges for visualization and verification."""
    falkor = get_falkor_service()
    start_time = time.perf_counter()

    try:
        if file:
            cypher = "MATCH (f:File {path: $file})-[r]->(target) RETURN f, type(r) AS rel, target LIMIT 100"
            params = {"file": file}
        else:
            cypher = "MATCH (f:File)-[r]->(target) RETURN f, type(r) AS rel, target LIMIT 100"
            params = {}

        raw_results = falkor.query(cypher, params)

        nodes_map: Dict[str, GraphNode] = {}
        edges: List[GraphEdge] = []

        for row in raw_results:
            if len(row) < 3:
                continue
            src_node, rel_type, tgt_node = row[0], row[1], row[2]

            for node in (src_node, tgt_node):
                nid = f"node_{node.id}" if hasattr(node, "id") else str(node)
                if nid not in nodes_map:
                    ntype = node.labels[0] if (hasattr(node, "labels") and node.labels) else "Node"
                    props = getattr(node, "properties", {})
                    nlabel = props.get("name") or props.get("path") or nid
                    nodes_map[nid] = GraphNode(
                        id=nid,
                        label=str(nlabel),
                        type=ntype,
                        properties=props,
                    )

            src_id = f"node_{src_node.id}" if hasattr(src_node, "id") else str(src_node)
            tgt_id = f"node_{tgt_node.id}" if hasattr(tgt_node, "id") else str(tgt_node)
            edges.append(
                GraphEdge(
                    source=src_id,
                    target=tgt_id,
                    relationship=str(rel_type),
                )
            )

        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return GraphInspectResponse(
            nodes=list(nodes_map.values()),
            edges=edges,
            execution_time_ms=execution_time_ms,
        )
    except Exception as exc:
        logger.error("Error inspecting graph: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Graph inspection failed: {exc}",
        )


@app.get("/api/graph/stratified", tags=["Knowledge Graph"])
def get_stratified_graph(
    function_name: str = Query("validateToken", description="Target function name to evaluate 4-layer stratified graph")
) -> Dict[str, Any]:
    """Fetch typed, 4-layer stratified graph (AST, Blast Radius, Memory, Company)."""
    parser = get_ast_parser()
    falkor = get_falkor_service()
    try:
        return parser.query_stratified_subgraph(function_name, falkor)
    except Exception as exc:
        logger.error("Error fetching stratified graph: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stratified graph query failed: {exc}",
        )


@app.get("/api/graph/blast-radius", response_model=BlastRadiusResponse, tags=["Knowledge Graph"])
def get_blast_radius(
    function_name: str = Query(..., description="Target function name to evaluate call blast radius"),
    max_depth: int = Query(4, ge=1, le=10, description="Maximum traversal depth (1 to 10 hops)"),
) -> BlastRadiusResponse:
    """Multi-hop call hierarchy traversal returning affected callers and impacted files."""
    falkor = get_falkor_service()
    start_time = time.perf_counter()

    try:
        cypher = (
            f"MATCH path = (root:Function {{name: $name}})<-[:CALLS*1..{max_depth}]-(dependent:Function) "
            "RETURN dependent.name AS name, dependent.file AS file, min(length(path)) AS depth "
            "ORDER BY depth ASC, name ASC"
        )
        results = falkor.query(cypher, {"name": function_name})

        dependents: List[DependentFunction] = []
        affected_files_set = set()

        for row in results:
            dep_name, dep_file, depth = row[0], row[1], int(row[2])
            dependents.append(
                DependentFunction(
                    name=dep_name,
                    file=dep_file,
                    depth=depth,
                )
            )
            affected_files_set.add(dep_file)

        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return BlastRadiusResponse(
            root_function=function_name,
            max_depth=max_depth,
            total_affected_functions=len(dependents),
            affected_files=sorted(list(affected_files_set)),
            dependents=dependents,
            execution_time_ms=execution_time_ms,
        )
    except Exception as exc:
        logger.error("Error querying blast radius for '%s': %s", function_name, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Blast radius calculation failed: {exc}",
        )


@app.post("/api/graph/query", tags=["Knowledge Graph"])
def execute_query(request: CypherQueryRequest) -> Dict[str, Any]:
    """Execute raw Cypher queries against FalkorDB graph."""
    falkor = get_falkor_service()
    try:
        results = falkor.query(request.query, request.params)
        return {"success": True, "results": results}
    except Exception as exc:
        logger.error("Cypher execution failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cypher execution failed: {exc}",
        )


# ---------------- Memory & Enterprise Context Endpoints ---------------- #

class RecordFailureRequest(BaseModel):
    session_id: str = Field(..., description="Active agent session ID")
    function_name: str = Field(..., description="Target function where patch failed")
    patch_diff: str = Field(..., description="Git patch/diff that caused the failure")
    error_message: str = Field(..., description="Error message / stack trace")


class RecordResolutionRequest(BaseModel):
    function_name: str = Field(..., description="Target function name")
    resolved_rule: str = Field(..., description="Discovered rule / constraint to persist")
    action_error: Optional[str] = Field(None, description="Optional original error context")


@app.get("/api/memory/rules", tags=["Procedural Memory"])
def get_memory_rules(
    function_name: str = Query(..., description="Target function name to query procedural rules")
) -> Dict[str, Any]:
    """Retrieve historical procedural memory rules and pitfalls for a function."""
    from services.memory_service import get_memory_service
    service = get_memory_service()
    try:
        rules = service.fetch_memory_rules(function_name)
        return {
            "function_name": function_name,
            "count": len(rules),
            "rules": rules,
        }
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@app.post("/api/memory/record-failure", tags=["Procedural Memory"])
def record_failure(payload: RecordFailureRequest) -> Dict[str, Any]:
    """Record an action failure during an agent session."""
    from services.memory_service import get_memory_service
    service = get_memory_service()
    try:
        return service.record_action_failure(
            session_id=payload.session_id,
            function_name=payload.function_name,
            patch_diff=payload.patch_diff,
            error_message=payload.error_message,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@app.post("/api/memory/record-resolution", tags=["Procedural Memory"])
def record_resolution(payload: RecordResolutionRequest) -> Dict[str, Any]:
    """Record a verified procedural rule after resolving a failure."""
    from services.memory_service import get_memory_service
    service = get_memory_service()
    try:
        return service.record_action_resolution(
            action_error=payload.action_error or "",
            resolved_rule=payload.resolved_rule,
            function_name=payload.function_name,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@app.get("/api/context/function", tags=["Enterprise Context"])
def get_function_context(
    function_name: str = Query(..., description="Target function name to query git & ticket context")
) -> Dict[str, Any]:
    """Fetch PR, Ticket, Author, and procedural memory context for a function."""
    from services.memory_service import get_memory_service
    service = get_memory_service()
    try:
        return service.fetch_function_context(function_name)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ---------------- AI Agent Orchestration Endpoints ---------------- #

class VerifyKeyRequest(BaseModel):
    provider: str = Field(..., description="Provider: openai, anthropic, openrouter, ollama")
    api_key: Optional[str] = Field("", description="API key to verify")
    model: Optional[str] = Field(None, description="Optional model to test")


class VerifyKeyResponse(BaseModel):
    valid: bool
    provider: str
    message: str


@app.get("/api/models/available", tags=["AI Orchestration"])
def get_available_models() -> Dict[str, Any]:
    """Check Ollama local daemon and list all supported BYOK cloud models."""
    from services.llm_provider import LLMProviderFactory
    return LLMProviderFactory.get_available_models()


@app.post("/api/models/verify-key", tags=["AI Orchestration"], response_model=VerifyKeyResponse)
def verify_api_key(payload: VerifyKeyRequest) -> VerifyKeyResponse:
    """Validate a BYOK API key or local Ollama daemon connectivity."""
    from services.llm_provider import LLMProviderFactory
    provider = LLMProviderFactory.get_provider(payload.provider)
    valid, message = provider.verify_key(payload.api_key or "", payload.model)
    return VerifyKeyResponse(valid=valid, provider=payload.provider, message=message)


class StreamRefactorRequest(BaseModel):
    prompt: str = Field(..., description="Refactoring prompt or objective")
    target_function: str = Field(..., description="Name of the function being modified")
    code: str = Field(..., description="Source code containing the target function")
    file_path: str = Field(..., description="File path of the code")
    provider: Optional[str] = Field("mock", description="LLM provider: ollama, openai, anthropic, openrouter, mock")
    model: Optional[str] = Field("claude-3-5-sonnet", description="Specific model to run")
    api_key: Optional[str] = Field(None, description="Optional user BYOK key override")


@app.post("/api/agent/stream-refactor", tags=["AI Orchestration"])
async def stream_refactor(request: StreamRefactorRequest) -> StreamingResponse:
    """Stream AI agent refactoring loop via Server-Sent Events (SSE).

    Emits typed events:
    - graph_traversal: Transversed FalkorDB AST & CALLS nodes/edges
    - context_resolved: Memory rules, blast radius count, ownership info
    - reasoning_chunk: Streaming architectural reasoning tokens
    - code_patch: Target function update & dependent caller patches
    - done: Completion status & execution time
    """
    from services.agent_orchestrator import get_agent_orchestrator
    orchestrator = get_agent_orchestrator()
    generator = orchestrator.stream_refactor(
        prompt=request.prompt,
        target_function=request.target_function,
        code=request.code,
        file_path=request.file_path,
        provider=request.provider,
        model=request.model,
        api_key=request.api_key,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )




if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
