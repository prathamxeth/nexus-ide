export interface GraphNode {
  id: string;
  label: string;
  layer?: "ast" | "blast" | "memory" | "company" | string;
  file?: string;
  metadata?: Record<string, any>;
  type?: string;
  properties?: Record<string, any>;
  color?: string;
  val?: number;
  x?: number;
  y?: number;
  [key: string]: any;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type?: "CALLS" | "IMPACTS" | "CONSTRAINED_BY" | "AUTHORED_BY" | string;
  relationship?: string;
  properties?: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DependentCaller {
  name: string;
  file: string;
  depth: number;
}

export interface ContextResolvedPayload {
  target_function: string;
  file_path: string;
  rules: string[];
  blast_radius_count: number;
  dependents: DependentCaller[];
  ownership: {
    author?: string | null;
    pr_number?: string | number | null;
    pr_title?: string | null;
    ticket_key?: string | null;
  };
}

export interface DependentPatch {
  function: string;
  file: string;
  depth: number;
  original_call: string;
  updated_call: string;
  diff: string;
}

export interface CodePatchPayload {
  target_function: string;
  file_path: string;
  original_code: string;
  modified_code: string;
  dependent_patches?: DependentPatch[];
}

export interface StreamRefactorOptions {
  prompt: string;
  targetFunction: string;
  code: string;
  filePath: string;
  onGraphTraversal?: (graph: GraphData) => void;
  onContextResolved?: (context: ContextResolvedPayload) => void;
  onReasoningChunk?: (chunk: string) => void;
  onCodePatch?: (patch: CodePatchPayload) => void;
  onDone?: (data: any) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * Connect to FastAPI SSE stream endpoint (/api/agent/stream-refactor)
 * Reads chunked SSE events, extracts typed event payloads, and notifies callbacks.
 */
export async function streamRefactor({
  prompt,
  targetFunction,
  code,
  filePath,
  onGraphTraversal,
  onContextResolved,
  onReasoningChunk,
  onCodePatch,
  onDone,
  onError,
  signal,
}: StreamRefactorOptions): Promise<void> {
  try {
    const response = await fetch("/api/agent/stream-refactor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        prompt,
        target_function: targetFunction,
        code,
        file_path: filePath,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`SSE stream failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("ReadableStream not supported by browser or backend response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      // Keep unfinished part in buffer
      buffer = events.pop() || "";

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;

        const lines = eventBlock.split("\n");
        let eventType = "message";
        let dataStr = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataStr = line.slice(5).trim();
          }
        }

        if (!dataStr) continue;

        try {
          const parsedData = JSON.parse(dataStr);

          switch (eventType) {
            case "graph_traversal":
              if (onGraphTraversal) {
                onGraphTraversal({
                  nodes: parsedData.nodes || [],
                  edges: parsedData.edges || parsedData.links || [],
                });
              }
              break;

            case "context_resolved":
              if (onContextResolved) {
                onContextResolved(parsedData);
              }
              break;

            case "reasoning_chunk":
              if (onReasoningChunk) {
                const chunk = parsedData.chunk || parsedData.content || "";
                onReasoningChunk(chunk);
              }
              break;

            case "code_patch":
              if (onCodePatch) {
                onCodePatch(parsedData);
              }
              break;

            case "done":
              if (onDone) {
                onDone(parsedData);
              }
              break;

            default:
              break;
          }
        } catch (err) {
          console.warn("Failed to parse SSE JSON payload:", dataStr, err);
        }
      }
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log("SSE Stream aborted by user");
      return;
    }
    console.error("Agent SSE stream error:", error);
    onError?.(error);
  }
}
