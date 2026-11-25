import { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, ChevronUp, ChevronDown, CircleX, TriangleAlert, Info, SquareTerminal, CheckCircle2 } from "lucide-react";
import { useIde } from "../store";
import type { PanelView } from "../types";
import { EmptyState } from "./common";
import { cn } from "@/lib/utils";

type TermLine = { kind: "in" | "out" | "err" | "ok"; text: string };
type Term = { id: number; name: string; lines: TermLine[]; cwd: string };

const banner: TermLine[] = [{ kind: "out", text: "Kiln integrated terminal (powered by node-pty) — type 'help' or commands." }];

function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[@-Z\\-_]/g, "")
    .replace(/\x07/g, "")
    // Remove braille spinner characters emitted by npm/cli tools
    .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s*/g, "")
    // Normalize carriage returns so lines don't glue together
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function Terminal({
  term,
  onAppendLines,
  onClearLines,
}: {
  term: Term;
  onAppendLines: (id: number, lines: TermLine[]) => void;
  onClearLines: (id: number) => void;
}) {
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const tabMatchesRef = useRef<{ matches: string[]; index: number; prefixInput: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    scroller.current?.scrollTo(0, scroller.current.scrollHeight);
  }, [term.lines.length]);

  // Connect to real node-pty backend via IPC bridge if available
  useEffect(() => {
    const bridge = (window as any).kilnBridge;
    if (!bridge?.terminal?.onData) return;

    const removeListener = bridge.terminal.onData((data: string) => {
      // Clear React state if the shell/program emits an ANSI clear-screen sequence
      if (/\x1b\[[23]J/.test(data)) {
        onClearLines(term.id);
      }

      const cleaned = stripAnsi(data);
      if (!cleaned.trim()) return;

      // Sync main-process terminalCwd when PowerShell prints its prompt
      const promptMatch = cleaned.match(/PS\s+([A-Za-z]:\\[^>]+)>/);
      if (promptMatch?.[1]) {
        bridge.terminal.syncCwd?.(promptMatch[1].trim());
      }

      onAppendLines(term.id, [{ kind: "out", text: cleaned }]);
    });

    return () => {
      removeListener?.();
    };
  }, [term.id, onAppendLines, onClearLines]);

  const handleTabComplete = async () => {
    const bridge = (window as any).kilnBridge;
    if (!bridge?.terminal?.completePath) return;

    if (tabMatchesRef.current && tabMatchesRef.current.matches.length > 0) {
      const state = tabMatchesRef.current;
      state.index = (state.index + 1) % state.matches.length;
      setInput(`${state.prefixInput}${state.matches[state.index]}`);
      return;
    }

    const match = input.match(/^(\s*\S+\s+)(.*)$/);
    const prefixInput = match ? match[1] : "";
    const partialArg = match ? match[2] : input;
    const dirsOnly = /^\s*(cd|chdir|pushd|rmdir|rd)\s+/i.test(input);

    const matches: string[] = await bridge.terminal.completePath(partialArg, dirsOnly);
    if (!matches || matches.length === 0) return;

    tabMatchesRef.current = { matches, index: 0, prefixInput };
    setInput(`${prefixInput}${matches[0]}`);
  };

  const run = (cmdline: string) => {
    const trimmed = cmdline.trim();
    if (!trimmed) return;

    const bridge = (window as any).kilnBridge;

    // Handle cls / clear directly in the UI state
    if (trimmed.toLowerCase() === "cls" || trimmed.toLowerCase() === "clear") {
      onClearLines(term.id);
      bridge?.terminal?.write?.("\r");
      return;
    }

    onAppendLines(term.id, [{ kind: "in", text: cmdline }]);

    if (bridge?.terminal?.write) {
      bridge.terminal.write(cmdline + "\r");
    } else {
      onAppendLines(term.id, [{ kind: "err", text: "Terminal bridge not connected to main process." }]);
    }
  };

  return (
    <div
      ref={scroller}
      className="h-full overflow-auto bg-background px-4 py-2 font-mono text-[12.5px] leading-[1.55] text-foreground"
      onClick={() => inputRef.current?.focus()}
    >
      {term.lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            "whitespace-pre-wrap",
            l.kind === "err" && "text-destructive",
            l.kind === "ok" && "text-ide-success",
          )}
        >
          {l.kind === "in" ? (
            <>
              <span className="text-ide-success">➜</span> <span className="text-ide-info">kiln</span> {l.text}
            </>
          ) : (
            l.text || "\u00a0"
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="text-ide-success">➜</span>
        <span className="text-ide-info">kiln</span>
        <input
          ref={inputRef}
          autoFocus
          value={input}
          spellCheck={false}
          onChange={(e) => {
            tabMatchesRef.current = null;
            setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              handleTabComplete();
            } else if (e.key === "Enter") {
              tabMatchesRef.current = null;
              run(input);
              if (input.trim()) setHist((h) => [input, ...h]);
              setHi(-1);
              setInput("");
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              tabMatchesRef.current = null;
              const n = Math.min(hi + 1, hist.length - 1);
              if (hist[n] !== undefined) {
                setHi(n);
                setInput(hist[n]);
              }
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              tabMatchesRef.current = null;
              const n = hi - 1;
              setHi(Math.max(n, -1));
              setInput(n >= 0 ? hist[n] : "");
            } else if (e.key === "l" && e.ctrlKey) {
              e.preventDefault();
              onClearLines(term.id);
            }
          }}
          className="min-w-0 flex-1 bg-transparent caret-primary outline-none"
        />
      </div>
    </div>
  );
}

function Problems() {
  const ide = useIde();
  if (!ide.problems.length)
    return <EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title="No problems have been detected in the workspace." />;
  const byFile = Object.entries(
    ide.problems.reduce<Record<string, typeof ide.problems>>((a, p) => ((a[p.fileId] ??= []).push(p), a), {}),
  );
  return (
    <div className="h-full overflow-auto py-1 text-[12.5px]">
      {byFile.map(([fid, ps]) => (
        <div key={fid}>
          <div className="ide-row h-[22px] gap-2 px-3 font-medium">
            {ide.nodes[fid]?.name ?? fid}
            <span className="text-[11px] text-muted-foreground">{fid}</span>
            <span className="rounded-full bg-muted px-1.5 text-[10.5px]">{ps.length}</span>
          </div>
          {ps.map((p, i) => (
            <div
              key={i}
              className="ide-row h-[22px] gap-2 pl-7 pr-3 cursor-pointer"
              onClick={() => {
                if (!ide.nodes[fid]) return;
                ide.openFile(fid);
                ide.setReveal({ fileId: fid, line: p.line, n: Date.now() });
              }}
            >
              {p.severity === "error" ? (
                <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
              ) : p.severity === "warning" ? (
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-ide-warning" />
              ) : (
                <Info className="h-3.5 w-3.5 shrink-0 text-ide-info" />
              )}
              <span className="truncate">{p.message}</span>
              <span className="shrink-0 text-muted-foreground">[Ln {p.line}, Col {p.column}]</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Output({ channel }: { channel?: string }) {
  const { output } = useIde();
  const lines = channel ? output.filter((o) => o.channel === channel) : output;
  return (
    <div className="h-full overflow-auto px-4 py-2 font-mono text-[12px] leading-relaxed">
      {lines.map((o, i) => (
        <div key={i}>
          <span className="text-muted-foreground">[{o.time}]</span> <span className="text-primary">[{o.channel}]</span> {o.line}
        </div>
      ))}
      {!lines.length && <div className="text-muted-foreground">No output yet. Start a debug session from Run and Debug.</div>}
    </div>
  );
}

export function BottomPanel({ maximized, onMaximize }: { maximized: boolean; onMaximize: () => void }) {
  const ide = useIde();
  const [terms, setTerms] = useState<Term[]>([{ id: 1, name: "zsh", lines: banner, cwd: "~" }]);
  const [activeTerm, setActiveTerm] = useState(1);
  const errors = ide.problems.filter((p) => p.severity === "error").length;
  const tabs: { id: PanelView; label: string; count?: number }[] = [
    { id: "problems", label: "Problems", count: ide.problems.length },
    { id: "output", label: "Output" },
    { id: "debug", label: "Debug Console" },
    { id: "terminal", label: "Terminal" },
  ];
  const term = terms.find((t) => t.id === activeTerm) ?? terms[0];

  const appendLines = useCallback((id: number, newLines: TermLine[]) => {
    setTerms((ts) => ts.map((t) => (t.id === id ? { ...t, lines: [...t.lines, ...newLines] } : t)));
  }, []);

  const clearLines = useCallback((id: number) => {
    setTerms((ts) => ts.map((t) => (t.id === id ? { ...t, lines: [] } : t)));
  }, []);

  return (
    <div className="flex h-full flex-col border-t bg-ide-panel">
      <div className="flex h-9 shrink-0 items-center gap-1 px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => ide.showPanel(t.id)}
            className={cn(
              "relative flex h-full items-center gap-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground",
              ide.panelView === t.id && "text-foreground after:absolute after:inset-x-2 after:bottom-1 after:h-px after:bg-primary",
            )}
          >
            {t.label}
            {!!t.count && <span className={cn("rounded-full px-1.5 text-[10px]", errors ? "bg-destructive/80 text-destructive-foreground" : "bg-muted")}>{t.count}</span>}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-0.5">
          {ide.panelView === "terminal" && (
            <>
              {terms.length > 1 && (
                <select value={activeTerm} onChange={(e) => setActiveTerm(Number(e.target.value))} className="h-6 rounded border bg-input px-1 text-[11.5px] outline-none">
                  {terms.map((t, i) => (
                    <option key={t.id} value={t.id}>
                      {i + 1}: {t.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                title="New Terminal"
                className="ide-icon-btn h-6 w-6 flex items-center justify-center rounded hover:bg-accent"
                onClick={() => {
                  const id = Date.now();
                  setTerms((ts) => [...ts, { id, name: "zsh", lines: banner, cwd: "~" }]);
                  setActiveTerm(id);
                }}
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                title="Kill Terminal"
                className="ide-icon-btn h-6 w-6 flex items-center justify-center rounded hover:bg-accent"
                onClick={() => {
                  const rest = terms.filter((t) => t.id !== term.id);
                  if (!rest.length) {
                    setTerms([{ id: Date.now(), name: "zsh", lines: banner, cwd: "~" }]);
                    ide.setPanelOpen(false);
                    return;
                  }
                  setTerms(rest);
                  setActiveTerm(rest[0].id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button title={maximized ? "Restore Panel" : "Maximize Panel"} className="ide-icon-btn h-6 w-6 flex items-center justify-center rounded hover:bg-accent" onClick={onMaximize}>
            {maximized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button title="Close Panel" className="ide-icon-btn h-6 w-6 flex items-center justify-center rounded hover:bg-accent" onClick={() => ide.setPanelOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {ide.panelView === "terminal" && term && (
          <Terminal key={term.id} term={term} onAppendLines={appendLines} onClearLines={clearLines} />
        )}
        {ide.panelView === "problems" && <Problems />}
        {ide.panelView === "output" && <Output />}
        {ide.panelView === "debug" &&
          (ide.debugging ? <Output channel="Debug" /> : <EmptyState icon={<SquareTerminal className="h-7 w-7" />} title="No active debug session">Press F5 to start debugging.</EmptyState>)}
      </div>
    </div>
  );
}