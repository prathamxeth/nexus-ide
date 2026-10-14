"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  ShieldAlert,
  Send,
  Loader2,
  CheckCircle2,
  GitPullRequest,
  BookOpen,
  ArrowRight,
  Code,
  Check,
  Bot,
  X,
  SplitSquareVertical,
} from "lucide-react";
import { DependentCaller } from "@/lib/agent-client";

interface AgentPanelProps {
  activeFile: string;
  code: string;
  targetFunction: string;
  onApplyPatch: (newCode: string) => void;
  // External streaming props from page.tsx:
  prompt?: string;
  onPromptChange?: (val: string) => void;
  isStreaming?: boolean;
  reasoningText?: string;
  onTriggerRefactor?: () => void;
  blastInfo?: { count: number; dependents: DependentCaller[] };
  memoryRules?: string[];
  ownership?: {
    author?: string | null;
    pr_number?: string | number | null;
    ticket_key?: string | null;
  };
  isDiffMode?: boolean;
  onAcceptDiff?: () => void;
  onRejectDiff?: () => void;
}

export function AgentPanel({
  activeFile,
  code,
  targetFunction,
  onApplyPatch,
  prompt: propPrompt,
  onPromptChange: propOnPromptChange,
  isStreaming: propIsStreaming,
  reasoningText: propReasoningText,
  onTriggerRefactor,
  blastInfo: propBlastInfo,
  memoryRules: propMemoryRules,
  ownership: propOwnership,
  isDiffMode = false,
  onAcceptDiff,
  onRejectDiff,
}: AgentPanelProps) {
  const [internalPrompt, setInternalPrompt] = useState(
    "Harden validateToken with fail-closed null checks and strict token expiration validation per security guidelines."
  );

  const prompt = propPrompt !== undefined ? propPrompt : internalPrompt;
  const setPrompt = propOnPromptChange || setInternalPrompt;
  const isStreaming = propIsStreaming ?? false;
  const reasoningText = propReasoningText ?? "";

  const blastInfo = propBlastInfo || {
    count: 3,
    dependents: [
      { name: "handleApiRequest", file: "src/api_handler.ts", depth: 1 },
      { name: "authenticateAndRoute", file: "src/router.ts", depth: 2 },
      { name: "verifySession", file: "src/auth_service.ts", depth: 2 },
    ],
  };

  const memoryRules = propMemoryRules || [
    "RULE: Always fail-closed on malformed or null tokens (PR #142)",
  ];

  const ownership = propOwnership || {
    author: "security-lead",
    pr_number: 142,
    ticket_key: "SEC-804",
  };

  const feedEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll reasoning feed
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reasoningText, isDiffMode]);

  // Keyboard shortcut listener: Cmd/Ctrl + Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onTriggerRefactor?.();
    }
  };

  return (
    <aside className="w-100 h-full bg-[#181818] border-l border-[#282828] flex flex-col justify-between select-none shrink-0 overflow-hidden">
      {/* Agent Header */}
      <div className="h-9 px-3 border-b border-[#282828] flex items-center justify-between bg-[#181818] shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#3b82f6]" />
          <span className="text-xs font-semibold tracking-wide text-[#e5e5e5]">
            Nexus Agent
          </span>
          <span className="text-[10px] font-mono text-[#888888] px-1.5 py-0.5 rounded bg-[#222222] border border-[#2a2a2a]">
            claude-3.5-sonnet
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isStreaming
                ? "bg-[#22c55e] animate-ping"
                : "bg-[#22c55e]"
            }`}
          />
          <span className="text-[10px] font-mono text-[#888888]">
            {isStreaming ? "Reasoning..." : isDiffMode ? "Diff Pending" : "Ready"}
          </span>
        </div>
      </div>

      {/* Dynamic Graph Pills Bar */}
      <div className="p-2.5 border-b border-[#242424] bg-[#151515] flex flex-col gap-1.5 shrink-0">
        <div className="text-[10px] font-semibold tracking-wider uppercase text-[#777777] flex items-center justify-between">
          <span>Active Graph Context</span>
          <span className="text-[10px] font-mono text-[#3b82f6]">FalkorDB Synced</span>
        </div>

        {/* Dynamic Pills */}
        <div className="flex flex-wrap gap-1.5">
          {/* Blast Radius Pill */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#281517] border border-[#ef4444]/30 text-[11px] font-mono text-[#ef4444]"
            title={`${blastInfo.count} dependent functions in reverse call graph`}
          >
            <ShieldAlert className="w-3 h-3 text-[#ef4444]" />
            <span>
              Blast: <strong className="font-bold">{targetFunction}</strong> (
              {blastInfo.count} callers)
            </span>
          </div>

          {/* Procedural Memory Guardrail Pill */}
          {memoryRules.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#271d0e] border border-[#f59e0b]/30 text-[11px] font-mono text-[#f59e0b]"
              title={memoryRules[0]}
            >
              <BookOpen className="w-3 h-3 text-[#f59e0b]" />
              <span className="truncate max-w-50">
                {memoryRules[0].replace(/^RULE:\s*/, "")}
              </span>
            </div>
          )}

          {/* Code Ownership Pill */}
          {ownership.author && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#132238] border border-[#3b82f6]/30 text-[11px] font-mono text-[#3b82f6]">
              <GitPullRequest className="w-3 h-3 text-[#3b82f6]" />
              <span>
                @{ownership.author} {ownership.pr_number ? `• PR #${ownership.pr_number}` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Reasoning Feed & Stream Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs bg-[#161616]">
        {/* Initial prompt summary if not streaming yet */}
        {!reasoningText && !isStreaming && (
          <div className="p-3 rounded border border-[#262626] bg-[#1a1a1a] text-[#888888] space-y-2">
            <div className="flex items-center gap-1.5 text-[#cccccc] font-medium text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span>Graph-Informed Refactoring Engine</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Every refactoring request executes FalkorDB multi-hop traversal to identify all upstream
              callers, fetches procedural guardrails from memory, and emits real-time reasoning before
              generating side-by-side diffs.
            </p>
            <div className="pt-2 border-t border-[#252525] flex flex-col gap-1 text-[11px]">
              <span className="text-[#666666]">Sample Prompt:</span>
              <button
                onClick={() =>
                  setPrompt(
                    "Harden validateToken with fail-closed null checks and strict token expiration validation per security guidelines."
                  )
                }
                className="text-left text-[#3b82f6] hover:underline"
              >
                &ldquo;Harden validateToken with fail-closed null checks...&rdquo;
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Traversal Log */}
        {blastInfo.dependents.length > 0 && (
          <div className="p-2.5 rounded border border-[#282828] bg-[#1a1a1a] text-[#888888] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#e5e5e5] font-semibold">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-[#ef4444]" />
                FalkorDB Call Graph Traversal
              </span>
              <span className="text-[10px] text-[#ef4444] font-mono">
                {blastInfo.dependents.length} Affected
              </span>
            </div>
            <div className="space-y-1 pt-1 border-t border-[#242424] text-[11px]">
              {blastInfo.dependents.map((dep, idx) => (
                <div key={idx} className="flex items-center justify-between text-[#999999]">
                  <span className="flex items-center gap-1 truncate">
                    <ArrowRight className="w-2.5 h-2.5 text-[#ef4444]" />
                    <span className="text-[#e5e5e5]">{dep.name}</span>
                    <span className="text-[#666666]">({dep.file})</span>
                  </span>
                  <span className="text-[10px] px-1 rounded bg-[#242424] text-[#888888]">
                    hop {dep.depth}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Streaming Reasoning Output */}
        {reasoningText && (
          <div className="p-3 rounded border border-[#282828] bg-[#181818] text-[#cccccc] space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3b82f6]">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Dual-Agent Reasoning Stream</span>
            </div>
            <div className="text-[12px] leading-relaxed whitespace-pre-wrap font-sans text-[#d4d4d4]">
              {reasoningText}
            </div>
          </div>
        )}

        {/* Step 3: Diff Active Status Banner */}
        {isDiffMode && (
          <div className="p-3 rounded border border-[#22c55e]/40 bg-[#16251c] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#22c55e]">
                <SplitSquareVertical className="w-3.5 h-3.5" />
                <span>Side-by-Side Diff Active</span>
              </div>
              <span className="text-[10px] font-mono text-[#22c55e] bg-[#22c55e]/15 px-1.5 py-0.5 rounded">
                Pending Acceptance
              </span>
            </div>
            <p className="text-[11px] text-[#a7f3d0] font-sans">
              Review modifications in Monaco DiffEditor. Accept or reject the patch.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onAcceptDiff}
                className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-[#22c55e] hover:bg-[#16a34a] text-[#ffffff] font-semibold text-[11px] transition-colors active:scale-[0.98]"
              >
                <Check className="w-3 h-3 stroke-[2.5]" />
                <span>Accept (Cmd+Y)</span>
              </button>
              <button
                onClick={onRejectDiff}
                className="flex items-center justify-center gap-1 py-1 px-3 rounded bg-[#2a2a2a] hover:bg-[#333333] text-[#cccccc] text-[11px] transition-colors active:scale-[0.98]"
              >
                <X className="w-3 h-3" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        )}

        <div ref={feedEndRef} />
      </div>

      {/* Prompt Input Box */}
      <div className="p-3 border-t border-[#282828] bg-[#181818] flex flex-col gap-2 shrink-0">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask agent to refactor with blast radius awareness... (Cmd+Enter to run)"
            rows={3}
            className="w-full bg-[#141414] border border-[#2c2c2c] focus:border-[#3b82f6] rounded p-2.5 text-xs text-[#e5e5e5] placeholder-[#555555] font-mono resize-none outline-none transition-colors"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#777777]">
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <kbd className="px-1.5 py-0.5 rounded bg-[#222222] border border-[#2c2c2c] text-[#888888]">
              ⌘
            </kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#222222] border border-[#2c2c2c] text-[#888888]">
              Enter
            </kbd>
            <span className="ml-1 text-[#555555]">to run</span>
          </div>

          <button
            onClick={onTriggerRefactor}
            disabled={isStreaming || !prompt.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#3b82f6] hover:bg-[#2563eb] text-[#ffffff] font-medium transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Streaming...</span>
              </>
            ) : (
              <>
                <Send className="w-3 h-3" />
                <span>Run Refactor</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
