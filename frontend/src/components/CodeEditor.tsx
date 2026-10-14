"use client";

import React, { useRef, useEffect } from "react";
import Editor, { DiffEditor, OnMount, DiffOnMount } from "@monaco-editor/react";
import {
  FileCode,
  X,
  Sparkles,
  Check,
  SplitSquareVertical,
  RotateCcw,
  ArrowRight,
  Code,
} from "lucide-react";

interface CodeEditorProps {
  files: string[];
  activeFile: string;
  onSelectTab: (fileName: string) => void;
  code: string;
  onChangeCode: (newCode: string) => void;
  isDiffMode: boolean;
  originalCode?: string;
  modifiedCode?: string;
  onAcceptDiff: () => void;
  onRejectDiff: () => void;
  onAnalyzeFunction?: (functionName: string) => void;
}

export function CodeEditor({
  files,
  activeFile,
  onSelectTab,
  code,
  onChangeCode,
  isDiffMode,
  originalCode = "",
  modifiedCode = "",
  onAcceptDiff,
  onRejectDiff,
  onAnalyzeFunction,
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);

  // Setup theme
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    monaco.editor.defineTheme("cursor-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A737D", fontStyle: "italic" },
        { token: "keyword", foreground: "F97583" },
        { token: "identifier", foreground: "E1E4E8" },
        { token: "string", foreground: "9ECBFF" },
        { token: "number", foreground: "79B8FF" },
        { token: "type", foreground: "B392F0" },
        { token: "delimiter", foreground: "B392F0" },
      ],
      colors: {
        "editor.background": "#141414",
        "editor.foreground": "#e5e5e5",
        "editorCursor.foreground": "#3b82f6",
        "editor.lineHighlightBackground": "#181818",
        "editorLineNumber.foreground": "#444444",
        "editorLineNumber.activeForeground": "#888888",
        "editor.selectionBackground": "#264f78",
        "editor.inactiveSelectionBackground": "#1e3750",
        "diffEditor.insertedTextBackground": "#22c55e25",
        "diffEditor.removedTextBackground": "#ef444425",
        "diffEditor.insertedLineBackground": "#22c55e15",
        "diffEditor.removedLineBackground": "#ef444415",
      },
    });

    monaco.editor.setTheme("cursor-dark");
  };

  const handleDiffDidMount: DiffOnMount = (_diffEditor, monaco) => {
    monaco.editor.setTheme("cursor-dark");
  };

  // Keyboard shortcut listener for Cmd/Ctrl+Y and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDiffMode) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        onAcceptDiff();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onRejectDiff();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDiffMode, onAcceptDiff, onRejectDiff]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#141414] overflow-hidden relative">
      {/* Tab Bar */}
      <div className="h-9 bg-[#181818] border-b border-[#282828] flex items-center justify-between px-1 select-none shrink-0 z-10">
        <div className="flex items-center h-full overflow-x-auto no-scrollbar">
          {files.map((file) => {
            const isActive = file === activeFile;
            return (
              <div
                key={file}
                onClick={() => onSelectTab(file)}
                className={`group h-full flex items-center gap-2 px-3 border-r border-[#282828] text-xs font-mono cursor-pointer transition-colors ${
                  isActive
                    ? "bg-[#141414] text-[#e5e5e5] border-t-2 border-t-[#3b82f6] font-medium"
                    : "bg-[#181818] text-[#888888] hover:bg-[#1a1a1a] hover:text-[#cccccc]"
                }`}
              >
                <FileCode
                  className={`w-3.5 h-3.5 ${
                    isActive ? "text-[#3b82f6]" : "text-[#777777]"
                  }`}
                />
                <span>{file}</span>
                {isDiffMode && isActive && (
                  <span className="text-[10px] bg-[#ef4444]/20 text-[#ef4444] px-1 py-0.2 rounded border border-[#ef4444]/30">
                    diff
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Header Pill */}
        <div className="flex items-center gap-2 pr-2 text-xs">
          {isDiffMode ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-[#22c55e] bg-[#22c55e]/15 border border-[#22c55e]/30">
              <SplitSquareVertical className="w-3 h-3 text-[#22c55e]" />
              <span>Diff View Active</span>
            </span>
          ) : (
            <button
              onClick={() => onAnalyzeFunction?.("validateToken")}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-[#3b82f6] bg-[#1a2333] hover:bg-[#202e44] border border-[#233554] transition-colors"
              title="Inspect Blast Radius for target function"
            >
              <Sparkles className="w-3 h-3 text-[#3b82f6]" />
              <span>Target: validateToken</span>
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb Bar */}
      <div className="h-6 bg-[#161616] border-b border-[#242424] px-4 flex items-center text-[11px] font-mono text-[#777777] shrink-0 justify-between">
        <div className="flex items-center">
          <span>nexus-core</span>
          <span className="mx-1.5 text-[#444444]">›</span>
          <span>src</span>
          <span className="mx-1.5 text-[#444444]">›</span>
          <span className="text-[#cccccc]">{activeFile}</span>
          {isDiffMode && (
            <>
              <span className="mx-1.5 text-[#444444]">›</span>
              <span className="text-[#22c55e]">Original (Left) vs Proposed Refactor (Right)</span>
            </>
          )}
        </div>
        {isDiffMode && (
          <span className="text-[10px] text-[#888888]">
            Press <kbd className="px-1 py-0.5 rounded bg-[#222222] border border-[#333333] text-[#cccccc]">⌘+Y</kbd> to accept diff
          </span>
        )}
      </div>

      {/* Floating Diff Action Bar Over Editor */}
      {isDiffMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#181818]/95 backdrop-blur-md border border-[#383838] shadow-2xl rounded-lg px-3 py-1.5 animate-fadeIn">
          <div className="flex items-center gap-1.5 pr-2 border-r border-[#2a2a2a] text-xs font-mono text-[#e5e5e5]">
            <Code className="w-3.5 h-3.5 text-[#3b82f6]" />
            <span className="font-semibold">Review Patch</span>
          </div>

          <button
            onClick={onAcceptDiff}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#22c55e] hover:bg-[#16a34a] text-[#ffffff] text-xs font-mono font-medium transition-all shadow-[0_0_12px_rgba(34,197,94,0.3)] hover:scale-102 active:scale-98"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Accept Diff (Cmd+Y)</span>
          </button>

          <button
            onClick={onRejectDiff}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#262626] hover:bg-[#333333] text-[#cccccc] hover:text-[#ffffff] text-xs font-mono transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>
        </div>
      )}

      {/* Editor Canvas: Dual Mode (Standard Editor or DiffEditor) */}
      <div className="flex-1 w-full relative">
        {isDiffMode ? (
          <DiffEditor
            height="100%"
            language="typescript"
            theme="cursor-dark"
            original={originalCode || code}
            modified={modifiedCode}
            onMount={handleDiffDidMount}
            options={{
              fontFamily: "Geist Mono, JetBrains Mono, Menlo, monospace",
              fontSize: 13,
              lineHeight: 20,
              renderSideBySide: true,
              readOnly: true,
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              diffCodeLens: true,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language="typescript"
            theme="cursor-dark"
            value={code}
            onChange={(value) => onChangeCode(value || "")}
            onMount={handleEditorDidMount}
            options={{
              fontFamily: "Geist Mono, JetBrains Mono, Menlo, monospace",
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: true, maxColumn: 40 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              bracketPairColorization: { enabled: true },
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: "all",
            }}
          />
        )}
      </div>
    </div>
  );
}
