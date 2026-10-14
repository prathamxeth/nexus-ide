"""Seed Initial Enterprise Context, AST Topology & Procedural Memory into FalkorDB.

Populates AST call-graph (auth.ts, billing.ts, finance.ts), Git PRs, Tickets,
Engineers, and historical procedural rules for 'validateToken' and 'verifyToken'
to enable zero-friction hackathon demos across all 3 FalkorDB tracks.
"""

from __future__ import annotations

import sys
import time
from dotenv import load_dotenv

load_dotenv()

from services.falkor_client import get_falkor_service
from services.memory_service import get_memory_service
from services.ast_parser import get_ast_parser


def seed_data() -> None:
    print("=" * 65)
    print("🌱 Nexus IDE Demo Data Seeder — Multi-Track Pipeline")
    print("=" * 65)

    falkor = get_falkor_service()
    if not falkor.is_healthy():
        print("❌ Error: FalkorDB is not reachable on port 6379.")
        sys.exit(1)

    # 1. Enforce indices (Track 1)
    print("\n[1/5] Enforcing FalkorDB schema indices...")
    schema_res = falkor.init_schema()
    print("  ✔ Schema Indices Status:", schema_res)

    # 2. Ingest AST Call-Graph for auth.ts, billing.ts, finance.ts (Track 1)
    print("\n[2/5] Ingesting Codebase AST Call-Graph (Tree-sitter -> FalkorDB)...")
    parser = get_ast_parser()

    auth_code = """export function validateToken(token: string): boolean {
  if (!token) return false;
  return decodePayload(token) !== null;
}

export function verifyToken(token: string): boolean {
  return validateToken(token);
}

function decodePayload(token: string) {
  return JSON.parse(atob(token.split('.')[1] || '{}'));
}
"""

    billing_code = """import { validateToken } from './auth';

export async function processInvoice(invoiceId: string, userToken: string) {
  const isAuthorized = validateToken(userToken);
  if (!isAuthorized) {
    throw new Error("Unauthorized invoice processing");
  }
  return { invoiceId, status: "PROCESSED", timestamp: Date.now() };
}
"""

    finance_code = """import { validateToken } from './auth';

export async function auditAccount(accountId: string, adminToken: string) {
  const isAuthorized = validateToken(adminToken);
  if (!isAuthorized) {
    throw new Error("Audit authorization failed: invalid security credentials");
  }
  return { accountId, auditStatus: "COMPLIANT", auditedAt: new Date().toISOString() };
}

export async function calculateTax(amount: number) {
  return amount * 0.08;
}
"""

    files_to_index = [
        ("src/auth.ts", auth_code),
        ("src/billing.ts", billing_code),
        ("src/finance.ts", finance_code),
    ]

    for path, code in files_to_index:
        res = parser.index_source_file(path, code)
        print(f"  ✔ AST Ingested: {path} ({res.get('nodes_created', 0)} nodes, {res.get('relationships_created', 0)} edges)")

    # Ensure explicit multi-hop CALLS relationships in graph
    calls_cypher = """
    MERGE (authFile:File {path: "src/auth.ts"})
    MERGE (billingFile:File {path: "src/billing.ts"})
    MERGE (financeFile:File {path: "src/finance.ts"})

    MERGE (valTok:Function {name: "validateToken", file: "src/auth.ts"})
    MERGE (verTok:Function {name: "verifyToken", file: "src/auth.ts"})
    MERGE (procInv:Function {name: "processInvoice", file: "src/billing.ts"})
    MERGE (audAcc:Function {name: "auditAccount", file: "src/finance.ts"})

    MERGE (authFile)-[:DEFINES]->(valTok)
    MERGE (authFile)-[:DEFINES]->(verTok)
    MERGE (billingFile)-[:DEFINES]->(procInv)
    MERGE (financeFile)-[:DEFINES]->(audAcc)

    MERGE (procInv)-[:CALLS]->(valTok)
    MERGE (audAcc)-[:CALLS]->(valTok)
    MERGE (verTok)-[:CALLS]->(valTok)
    """
    falkor.query(calls_cypher)
    print("  ✔ Verified multi-hop reverse call-graph: processInvoice -> validateToken, auditAccount -> validateToken")

    memory_service = get_memory_service()

    # 3. Seed Company Context (Engineers, PRs, Tickets) (Track 3)
    print("\n[3/5] Seeding Company Brain Context (Track 3: Git PRs, Tickets, Ownership)...")
    contexts = [
        {
            "file_path": "src/auth.ts",
            "function_name": "validateToken",
            "author_handle": "@alex.chen",
            "pr_number": 104,
            "pr_title": "Implement RFC 7519 JWT verification & replay protection",
            "ticket_key": "SEC-402",
        },
        {
            "file_path": "src/auth.ts",
            "function_name": "verifyToken",
            "author_handle": "@alex.chen",
            "pr_number": 104,
            "pr_title": "Implement RFC 7519 JWT verification & replay protection",
            "ticket_key": "SEC-402",
        },
        {
            "file_path": "src/billing.ts",
            "function_name": "processInvoice",
            "author_handle": "@sarah.connor",
            "pr_number": 72,
            "pr_title": "Integrate ERP ledger sync and idempotent billing events",
            "ticket_key": "FIN-215",
        },
        {
            "file_path": "src/finance.ts",
            "function_name": "auditAccount",
            "author_handle": "@marcus.vance",
            "pr_number": 95,
            "pr_title": "Add multi-jurisdiction compliance audit routines",
            "ticket_key": "TAX-108",
        },
    ]

    for ctx in contexts:
        res = memory_service.seed_company_context(**ctx)
        print(f"  ✔ Context Linked: {res['engineer']} -> PR #{res['pr_number']} -> {res['ticket_key']} -> {res['function_name']}")

    # 4. Seed Procedural Memory Rules & Historical Failure Traces (Track 2)
    print("\n[4/5] Seeding Procedural & Episodic Memory (Track 2: Guardrails & Pitfalls)...")
    rules_to_seed = [
        (
            "validateToken",
            "TokenExpiredError: Token verified without expiration claim validation",
            "Must check exp and nbf claims with clock skew tolerance <= 60s",
        ),
        (
            "validateToken",
            "SecurityWarning: Insecure algorithm 'none' allowed in header",
            "Reject tokens using 'none' algorithm or symmetric HS256 on RS256 endpoints",
        ),
        (
            "verifyToken",
            "TokenExpiredError: Token verified without expiration claim validation",
            "Must check exp and nbf claims with clock skew tolerance <= 60s",
        ),
        (
            "processInvoice",
            "DuplicatePaymentException: Race condition on webhook replay",
            "Requires idempotent invoice deduplication check prior to ledger journal write",
        ),
        (
            "auditAccount",
            "NullReferenceException: Missing audit role validation",
            "Ensure adminToken holds verified system-auditor claim before accessing ledger",
        ),
    ]

    for fn_name, err, rule in rules_to_seed:
        res = memory_service.record_action_resolution(
            action_error=err,
            resolved_rule=rule,
            function_name=fn_name,
        )
        print(f"  ✔ Memory Rule [{fn_name}]: \"{res['rule']}\"")

    memory_service.record_action_failure(
        session_id="sess_sec_audit_demo",
        function_name="validateToken",
        patch_diff=(
            "diff --git a/src/auth.ts b/src/auth.ts\n"
            "--- a/src/auth.ts\n"
            "+++ b/src/auth.ts\n"
            "@@ -10,3 +10,4 @@\n"
            "-    return jwt.verify(token, secret, { complete: true });\n"
            "+    return jwt.decode(token); // Skip validation for testing\n"
        ),
        error_message="SecurityAssertionError: Token signature and claims validation bypassed",
    )
    print("  ✔ Recorded Action Failure for 'validateToken' in session 'sess_sec_audit_demo'")

    # 5. Verification Query
    print("\n[5/5] Executing Blast Radius Verification Query...")
    blast_res = falkor.query(
        """
        MATCH (target:Function {name: "validateToken"})
        OPTIONAL MATCH path = (caller:Function)-[:CALLS*1..3]->(target)
        RETURN count(DISTINCT caller) AS caller_count, collect(DISTINCT caller.name) AS callers
        """
    )
    if blast_res:
        count, callers = blast_res[0][0], blast_res[0][1]
        print(f"  ✔ Blast Radius for 'validateToken': {count} upstream callers detected -> {callers}")

    health = falkor.get_health_metrics()
    print("\n" + "=" * 65)
    print(f"🎉 DEMO DATA SEEDING COMPLETE! Active Graph Nodes: {health['active_nodes_count']} (Latency: {health['latency_ms']}ms)")
    print("=" * 65)


if __name__ == "__main__":
    seed_data()
