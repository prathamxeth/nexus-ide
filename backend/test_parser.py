"""CLI Test Routine for Tree-sitter AST Extraction and FalkorDB Graph Ingestion.

Parses a dummy sample TypeScript file, executes graph ingestion, and queries FalkorDB
to verify File, Function, Class, Method, Import, and Call nodes and edges.
"""

from __future__ import annotations

import sys
from services.ast_parser import get_ast_parser
from services.falkor_client import get_falkor_service

SAMPLE_TYPESCRIPT = """import { calculateTax, formatCurrency } from "./finance";
import Logger from "./logger";

export function processInvoice(invoiceId: string, amount: number): number {
    const tax = calculateTax(amount);
    const total = amount + tax;
    Logger.log("Processed invoice " + invoiceId);
    return total;
}

export const generateReport = (invoiceId: string): string => {
    const finalAmount = processInvoice(invoiceId, 500);
    return `Invoice ${invoiceId}: total = ${finalAmount}`;
};

export class BillingManager {
    approveInvoice(invoiceId: string): boolean {
        generateReport(invoiceId);
        return true;
    }
}
"""


def run_tests() -> None:
    print("=" * 65)
    print("🚀 Running Nexus IDE AST Parser & FalkorDB Ingestion CLI Test")
    print("=" * 65)

    falkor = get_falkor_service()
    if not falkor.is_healthy():
        print("❌ Error: FalkorDB is not reachable. Ensure container is running on port 6379.")
        sys.exit(1)

    print("✅ FalkorDB is live and reachable.")

    # 1. Initialize schema
    print("\n[Step 1] Enforcing schema indices...")
    schema_res = falkor.init_schema()
    print("Schema Indices Status:", schema_res)

    # 2. Run AST Parser Ingestion
    file_path = "src/services/billing.ts"
    parser = get_ast_parser()
    print(f"\n[Step 2] Ingesting '{file_path}' into graph...")
    ingest_result = parser.index_source_file(file_path=file_path, code_content=SAMPLE_TYPESCRIPT)
    print("Ingestion Result Summary:", ingest_result)

    # 3. Verify File Node
    print("\n[Step 3] Verifying (:File) node...")
    file_nodes = falkor.query(
        "MATCH (f:File {path: $path}) RETURN f.path, f.lines",
        {"path": file_path},
    )
    assert file_nodes and len(file_nodes) > 0, "File node was not created!"
    print(f"✔ File Node Verified: Path={file_nodes[0][0]}, Lines={file_nodes[0][1]}")

    # 4. Verify Functions
    print("\n[Step 4] Verifying (:Function) nodes...")
    fn_nodes = falkor.query(
        "MATCH (f:Function {file: $path}) RETURN f.name, f.is_exported, f.start_line, f.end_line ORDER BY f.start_line",
        {"path": file_path},
    )
    fn_names = [row[0] for row in fn_nodes]
    print(f"Functions found ({len(fn_nodes)}):", fn_names)
    assert "processInvoice" in fn_names, "Missing processInvoice function!"
    assert "generateReport" in fn_names, "Missing generateReport arrow function!"
    print("✔ Function and Arrow Function nodes verified.")

    # 5. Verify Class & Methods
    print("\n[Step 5] Verifying (:Class) and (:Method) nodes...")
    class_nodes = falkor.query(
        "MATCH (c:Class {file: $path})-[:HAS_METHOD]->(m:Method) RETURN c.name, m.name, m.start_line",
        {"path": file_path},
    )
    assert class_nodes and len(class_nodes) > 0, "Class with method not found!"
    print(f"✔ Class Verified: Class={class_nodes[0][0]}, Method={class_nodes[0][1]}")

    # 6. Verify Imports
    print("\n[Step 6] Verifying (:File)-[:IMPORTS]->(:File) relationships...")
    imports = falkor.query(
        "MATCH (src:File {path: $path})-[r:IMPORTS]->(tgt:File) RETURN src.path, r.specifier, tgt.path",
        {"path": file_path},
    )
    print(f"Imports found ({len(imports)}):")
    for src, spec, tgt in imports:
        print(f"  ({src}) -[:IMPORTS {{specifier: '{spec}'}}]-> ({tgt})")
    assert any(r[1] == "./finance" for r in imports), "Missing ./finance import relation!"
    print("✔ Import relationships verified.")

    # 7. Verify Intra-file and Cross-file Calls
    print("\n[Step 7] Verifying (caller:Function)-[:CALLS]->(target:Function) relationships...")
    calls = falkor.query(
        "MATCH (caller:Function {file: $path})-[r:CALLS]->(target:Function) "
        "RETURN caller.name, target.name, target.file",
        {"path": file_path},
    )
    print(f"Function Calls found ({len(calls)}):")
    call_pairs = [(c[0], c[1]) for c in calls]
    for caller, target, tgt_file in calls:
        call_type = "Intra-file" if tgt_file == file_path else "Cross-file"
        print(f"  [{call_type}] {caller} -> {target} (file: {tgt_file})")

    # Intra-file call: generateReport -> processInvoice
    assert ("generateReport", "processInvoice") in call_pairs, "Missing intra-file call: generateReport -> processInvoice!"
    # Cross-file call: processInvoice -> calculateTax
    assert ("processInvoice", "calculateTax") in call_pairs, "Missing cross-file call: processInvoice -> calculateTax!"
    print("✔ Both Intra-file and Cross-file CALLS edges verified.")

    # 8. Test Idempotency / Live Edit Re-indexing
    print("\n[Step 8] Verifying live reload idempotency (re-indexing same file)...")
    reindex_result = parser.index_source_file(file_path=file_path, code_content=SAMPLE_TYPESCRIPT)
    fn_nodes_after = falkor.query(
        "MATCH (f:Function {file: $path}) RETURN count(f)",
        {"path": file_path},
    )
    assert fn_nodes_after[0][0] == len(fn_nodes), f"Duplicate nodes created! Expected {len(fn_nodes)}, found {fn_nodes_after[0][0]}"
    print(f"✔ Idempotency verified: exactly {fn_nodes_after[0][0]} functions present after re-indexing.")

    print("\n" + "=" * 65)
    print("🎉 ALL AST & GRAPH INGESTION VERIFICATIONS PASSED!")
    print("=" * 65)


if __name__ == "__main__":
    run_tests()
