"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Search, FileCode, Network, Sparkles, Cpu, Cloud, 
  Settings, ArrowRight, ShieldAlert, BookOpen, GitPullRequest,
  Check, X, Info
} from "lucide-react";
import { playUiSound } from "@/lib/sound";

export interface CommandItem {
  id: string;
  category: "Files" | "Graph Actions" | "Agent Refactor" | "AI Models" | "Preferences";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: "auth.ts" | "billing.ts" | "finance.ts") => void;
  onSelectView: (view: "preview" | "diff" | "graph") => void;
  onSelectModel: (model: string) => void;
  onRunPrompt: (prompt: string) => void;
  onOpenSettings: () => void;
  onOpenAbout?: () => void;
  currentModel: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectFile,
  onSelectView,
  onSelectModel,
  onRunPrompt,
  onOpenSettings,
  onOpenAbout,
  currentModel,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Master command dictionary
  const allCommands: CommandItem[] = useMemo(() => [
    // 1. Files
    {
      id: "file-auth",
      category: "Files",
      title: "auth.ts",
      subtitle: "Main function: validateToken()",
      icon: <FileCode className="w-4 h-4 text-[#f54e00]" />,
      badge: "Target",
      badgeColor: "bg-[#1c1c1c] text-[#f54e00] border-[#333333]",
      shortcut: "⌘1",
      onSelect: () => {
        onSelectFile("auth.ts");
        onSelectView("preview");
      },
    },
    {
      id: "file-billing",
      category: "Files",
      title: "billing.ts",
      subtitle: "Connected caller: processInvoice() [Direct]",
      icon: <FileCode className="w-4 h-4 text-red-400" />,
      badge: "Connected",
      badgeColor: "bg-red-950/60 text-red-400 border-red-800/40",
      shortcut: "⌘2",
      onSelect: () => {
        onSelectFile("billing.ts");
        onSelectView("preview");
      },
    },
    {
      id: "file-finance",
      category: "Files",
      title: "finance.ts",
      subtitle: "Connected caller: auditAccount() [Indirect]",
      icon: <FileCode className="w-4 h-4 text-red-400" />,
      badge: "Connected",
      badgeColor: "bg-red-950/60 text-red-400 border-red-800/40",
      shortcut: "⌘3",
      onSelect: () => {
        onSelectFile("finance.ts");
        onSelectView("preview");
      },
    },

    // 2. Graph Actions
    {
      id: "graph-stratified",
      category: "Graph Actions",
      title: "Inspect Code Knowledge Graph",
      subtitle: "Connected Code, What Breaks, Memory & Team History",
      icon: <Network className="w-4 h-4 text-amber-400" />,
      badge: "FalkorDB",
      badgeColor: "bg-amber-950/60 text-amber-400 border-amber-800/40",
      shortcut: "⌘G",
      onSelect: () => {
        onSelectView("graph");
      },
    },
    {
      id: "graph-blast",
      category: "Graph Actions",
      title: "Find What Breaks on Changes",
      subtitle: "See all functions that call or rely on validateToken",
      icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
      badge: "2 Callers",
      badgeColor: "bg-red-950/60 text-red-400 border-red-800/40",
      onSelect: () => {
        onSelectView("graph");
        onRunPrompt("Track 1 · What breaks if validateToken changes?");
      },
    },
    {
      id: "graph-memory",
      category: "Graph Actions",
      title: "Check Remembered Rules",
      subtitle: "Verify remembered rule from PR #104: 'Check expiration within 60s'",
      icon: <BookOpen className="w-4 h-4 text-amber-400" />,
      badge: "Track 2",
      badgeColor: "bg-amber-950/60 text-amber-400 border-amber-800/40",
      onSelect: () => {
        onSelectView("graph");
      },
    },

    // 3. Agent Refactor Actions
    {
      id: "agent-harden",
      category: "Agent Refactor",
      title: "Update validateToken with expiration check",
      subtitle: "Follow remembered rule (skew <= 60s) from PR #104",
      icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
      badge: "Live SSE",
      badgeColor: "bg-emerald-950/60 text-emerald-400 border-emerald-800/40",
      shortcut: "↵",
      onSelect: () => {
        onSelectView("diff");
        onRunPrompt("Track 1 · What breaks if validateToken changes?");
      },
    },
    {
      id: "agent-diff-review",
      category: "Agent Refactor",
      title: "Open Side-by-Side Code Comparison",
      subtitle: "Compare pending changes with Accept (⌘Y) / Reject (⌘N)",
      icon: <ArrowRight className="w-4 h-4 text-neutral-300" />,
      badge: "Compare",
      badgeColor: "bg-[#1c1c1c] text-neutral-300 border-[#333333]",
      onSelect: () => {
        onSelectView("diff");
      },
    },

    // 4. AI Models
    {
      id: "model-claude",
      category: "AI Models",
      title: "Switch to Claude 3.5 Sonnet",
      subtitle: "Anthropic Claude reasoning engine",
      icon: <Cloud className="w-4 h-4 text-[#f54e00]" />,
      badge: currentModel.includes("claude") ? "Active" : "Cloud",
      badgeColor: currentModel.includes("claude") ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40" : "bg-neutral-800 text-neutral-400",
      onSelect: () => onSelectModel("claude-3.5-sonnet"),
    },
    {
      id: "model-qwen",
      category: "AI Models",
      title: "Switch to Qwen 2.5 Coder (Local)",
      subtitle: "Local offline inference via Ollama port 11434",
      icon: <Cpu className="w-4 h-4 text-emerald-400" />,
      badge: currentModel.includes("qwen") ? "Active" : "Ollama",
      badgeColor: currentModel.includes("qwen") ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40" : "bg-neutral-800 text-neutral-400",
      onSelect: () => onSelectModel("qwen2.5-coder (Local)"),
    },
    {
      id: "model-gpt4o",
      category: "AI Models",
      title: "Switch to GPT-4o",
      subtitle: "OpenAI multi-modal model",
      icon: <Cloud className="w-4 h-4 text-neutral-300" />,
      badge: currentModel.includes("gpt") ? "Active" : "Cloud",
      badgeColor: currentModel.includes("gpt") ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40" : "bg-neutral-800 text-neutral-400",
      onSelect: () => onSelectModel("gpt-4o"),
    },
    {
      id: "model-deepseek",
      category: "AI Models",
      title: "Switch to DeepSeek R1",
      subtitle: "DeepSeek Reasoning Model via OpenRouter",
      icon: <Cloud className="w-4 h-4 text-purple-400" />,
      badge: currentModel.includes("deepseek") ? "Active" : "Cloud",
      badgeColor: currentModel.includes("deepseek") ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40" : "bg-neutral-800 text-neutral-400",
      onSelect: () => onSelectModel("deepseek-r1"),
    },

    // 5. Preferences
    {
      id: "pref-about",
      category: "Preferences",
      title: "About NexusIDE",
      subtitle: "Graph-Native IDE Architecture, FalkorDB Engine & Hackathon Info",
      icon: <Info className="w-4 h-4 text-[#f54e00]" />,
      badge: "FalkorDB 2026",
      badgeColor: "bg-[#f54e00]/20 text-[#f54e00] border-[#f54e00]/40",
      onSelect: () => {
        if (onOpenAbout) onOpenAbout();
      },
    },
    {
      id: "pref-settings",
      category: "Preferences",
      title: "Open Preferences & BYOK Config",
      subtitle: "Configure API keys, Ollama host, and FalkorDB graph namespaces",
      icon: <Settings className="w-4 h-4 text-neutral-400" />,
      badge: "Preferences",
      badgeColor: "bg-neutral-800 text-neutral-300",
      shortcut: "⌘,",
      onSelect: onOpenSettings,
    },
  ], [currentModel, onSelectFile, onSelectView, onSelectModel, onRunPrompt, onOpenSettings, onOpenAbout]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [allCommands, query]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playUiSound("reject");
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          playUiSound("accept");
          filteredCommands[selectedIndex].onSelect();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Group filtered commands by category
  const categories = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filteredCommands.forEach((cmd) => {
      const list = map.get(cmd.category) || [];
      list.push(cmd);
      map.set(cmd.category, list);
    });
    return Array.from(map.entries());
  }, [filteredCommands]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={() => { playUiSound("reject"); onClose(); }}
    >
      <div 
        className="w-full max-w-xl bg-[#1c1c1c]/95 backdrop-blur-md border border-[#333333] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-neutral-200 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="h-12 px-4 border-b border-[#292929] flex items-center gap-3 shrink-0">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a file, command, Cypher action, or model..."
            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 outline-none font-mono"
          />
          {query && (
            <button 
              onClick={() => setQuery("")}
              className="text-neutral-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#272727] border border-[#383838] text-neutral-400">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2 space-y-3">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-neutral-500">
              No matching commands or files found for &quot;{query}&quot;
            </div>
          ) : (
            categories.map(([categoryName, items]) => (
              <div key={categoryName} className="space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                  {categoryName}
                </div>
                {items.map((cmd) => {
                  const currentIndex = flatIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <div
                      key={cmd.id}
                      onClick={() => {
                        playUiSound("accept");
                        cmd.onSelect();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#282828] text-white border border-[#3b3b3b]"
                          : "hover:bg-[#222222] text-neutral-300 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0">{cmd.icon}</div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate flex items-center gap-2">
                            <span>{cmd.title}</span>
                            {cmd.badge && (
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${cmd.badgeColor || "bg-neutral-800 text-neutral-400"}`}>
                                {cmd.badge}
                              </span>
                            )}
                          </div>
                          {cmd.subtitle && (
                            <div className="text-[11px] text-neutral-500 truncate mt-0.5 font-sans">
                              {cmd.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      {cmd.shortcut && (
                        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#202020] border border-[#333333] text-neutral-400 shrink-0 ml-2">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="h-8 px-4 bg-[#161616] border-t border-[#262626] flex items-center justify-between text-[10px] font-mono text-neutral-500 shrink-0">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-neutral-400">Nexus IDE Command Palette</span>
        </div>
      </div>
    </div>
  );
}
