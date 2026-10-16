"use client";

import React, { useState, useEffect } from "react";
import { 
  X, ExternalLink, Sparkles, Network, BookOpen, 
  GitPullRequest, ShieldCheck, Database, Play, Check, Copy, Flame 
} from "lucide-react";
import { playUiSound } from "@/lib/sound";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  falkorLatency?: string;
  falkorConnected?: boolean;
}

export function AboutModal({
  isOpen,
  onClose,
  falkorLatency = "0.8ms",
  falkorConnected = true,
}: AboutModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playUiSound("reject");
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyRepoLink = () => {
    navigator.clipboard.writeText("https://github.com/prathamxeth/nexus-ide");
    setCopiedLink(true);
    playUiSound("accept");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0c0c0c] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-5 border-b border-[#202020] flex items-center justify-between bg-[#080808] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#f54e00]/20 border border-[#f54e00]/40 flex items-center justify-center text-[#f54e00] shadow-[0_0_12px_rgba(245,78,0,0.3)]">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono tracking-tight">NexusIDE</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#1c1c1c] text-[#f54e00] border border-[#f54e00]/30">
                  v1.0.0-hackathon
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-sans">
                The Graph-Native Agentic IDE Powered by FalkorDB
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playUiSound("reject");
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-[#1c1c1c] text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs font-sans text-neutral-300 custom-scrollbar">
          {/* Mission statement */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#141414] to-[#101010] border border-[#222222] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Flame size={14} className="text-[#f54e00]" />
                Built for FalkorDB Graph Hacks 2026
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full ${falkorConnected ? "bg-emerald-400 shadow-[0_0_8px_#22c55e]" : "bg-amber-400"}`} />
                <span className="text-neutral-400">Engine:</span>
                <span className={falkorConnected ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                  {falkorLatency} (FalkorDB GraphBLAS)
                </span>
              </div>
            </div>
            <p className="text-neutral-400 text-xs leading-relaxed">
              Standard AI coding assistants rely on flat text chunking (Vector RAG), which is catastrophically blind to multi-hop call chains. 
              <strong className="text-white"> NexusIDE embeds FalkorDB directly into the agent&apos;s inner loop</strong>, evaluating caller contracts, 
              past rejection memories, and team provenance in under 2 milliseconds before touching a line of code.
            </p>
          </div>

          {/* 3 Challenge Tracks */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              Unified Hackathon Tracks
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Track 1 */}
              <div className="p-3 rounded-xl bg-[#121212] border border-[#222222] hover:border-sky-500/40 transition-colors">
                <div className="flex items-center gap-1.5 text-sky-400 font-mono font-semibold text-xs mb-1">
                  <Network size={14} />
                  <span>Track 1: Graph-RAG</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal">
                  Tree-sitter AST parsing + 4-hop upstream/downstream call traversal in &lt;2ms. Native FalkorDB PageRank centrality identifies critical code bottlenecks.
                </p>
              </div>

              {/* Track 2 */}
              <div className="p-3 rounded-xl bg-[#121212] border border-[#222222] hover:border-amber-500/40 transition-colors">
                <div className="flex items-center gap-1.5 text-amber-400 font-mono font-semibold text-xs mb-1">
                  <BookOpen size={14} />
                  <span>Track 2: Agent Memory</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal">
                  Live human rejection (<code className="text-amber-300 font-mono">⌘N</code>) records structured episodic rule nodes into FalkorDB, permanently preventing regressions across sessions.
                </p>
              </div>

              {/* Track 3 */}
              <div className="p-3 rounded-xl bg-[#121212] border border-[#222222] hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-semibold text-xs mb-1">
                  <GitPullRequest size={14} />
                  <span>Track 3: Company Brain</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal">
                  Connects pull requests, Linear/Jira tickets, and Git blame authors directly to AST nodes, injecting architectural intent before any refactor is proposed.
                </p>
              </div>
            </div>
          </div>

          {/* Architectural Pillars */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              Key Architectural Primitives
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[#101010] border border-[#1f1f1f] flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-[#f54e00] shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-semibold">Hard Kill-Switch</div>
                  <div className="text-[11px] text-neutral-400 font-sans mt-0.5">
                    Zero raw file-reading tools. If FalkorDB drops, exactly 0 lines of code are written.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#101010] border border-[#1f1f1f] flex items-start gap-2.5">
                <Database size={16} className="text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-semibold">FastMCP Server</div>
                  <div className="text-[11px] text-neutral-400 font-sans mt-0.5">
                    Open Model Context Protocol tools for Claude Desktop, Cursor, and custom agents.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Links */}
        <div className="h-16 px-6 border-t border-[#202020] bg-[#080808] flex items-center justify-between shrink-0 font-mono text-xs">
          <div className="flex items-center gap-2">
            <a
              href="https://www.loom.com/share/7de75784a52d4da8a8e4f0beb4fe868c"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f54e00]/15 hover:bg-[#f54e00]/25 border border-[#f54e00]/40 text-[#f54e00] transition-colors cursor-pointer font-medium"
            >
              <Play size={13} fill="currentColor" />
              <span>Watch 3-Min Loom Demo</span>
              <ExternalLink size={12} />
            </a>

            <a
              href="https://github.com/prathamxeth/nexus-ide"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <span>GitHub Repo</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <button
            onClick={copyRepoLink}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1a1a1a] text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Copy GitHub URL"
          >
            {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedLink ? "Copied!" : "Copy URL"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
