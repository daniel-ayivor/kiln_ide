import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, ChevronUp, ChevronDown, CircleX, TriangleAlert, Info, SquareTerminal, CheckCircle2 } from "lucide-react";
import { useIde } from "../store";
import type { PanelView } from "../types";
import { getPlatform, type TermLine as Line } from "../platform";
import { EmptyState } from "./common";
import { cn } from "@/lib/utils";
type Term = { id: number; name: string; lines: Line[]; cwd: string };

const banner: Line[] = [{ kind: "out", text: "Kiln integrated terminal — type 'help' for available commands." }];

function Terminal({ term, onUpdate }: { term: Term; onUpdate: (t: Term) => void }) {
  const ide = useIde();
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo(0, scroller.current.scrollHeight);
  }, [term.lines.length]);

  const run = (cmdline: string) => {
    const r = getPlatform().shell.exec(cmdline, {
      cwd: term.cwd,
      nodes: ide.nodes,
      branch: ide.branch,
      changes: ide.changes,
      createNode: ide.createNode,
      log: ide.log,
    });
    if (r.clear) return onUpdate({ ...term, lines: [] });
    onUpdate({ ...term, cwd: r.cwd ?? term.cwd, lines: [...term.lines, ...r.lines] });
  };

  return (
    <div ref={scroller} className="h-full overflow-auto px-4 py-2 font-mono text-[12.5px] leading-[1.55]" onClick={() => inputRef.current?.focus()}>
      {term.lines.map((l, i) => (
        <div key={i} className={cn("whitespace-pre-wrap", l.kind === "err" && "text-destructive", l.kind === "ok" && "text-ide-success")}>
          {l.kind === "in" ? (
            <><span className="text-ide-success">➜</span> <span className="text-ide-info">kiln-starter</span> {l.text}</>
          ) : (
            l.text || "\u00a0"
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="text-ide-success">➜</span>
        <span className="text-ide-info">{term.cwd === "~" ? "kiln-starter" : term.cwd.split("/").pop()}</span>
        <input
          ref={inputRef}
          autoFocus
          value={input}
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              run(input);
              if (input.trim()) setHist((h) => [input, ...h]);
              setHi(-1);
              setInput("");
            } else if (e.key === "ArrowUp") {
              const n = Math.min(hi + 1, hist.length - 1);
              if (hist[n] !== undefined) { setHi(n); setInput(hist[n]); }
              e.preventDefault();
            } else if (e.key === "ArrowDown") {
              const n = hi - 1;
              setHi(Math.max(n, -1));
              setInput(n >= 0 ? hist[n] : "");
            } else if (e.key === "l" && e.ctrlKey) {
              e.preventDefault();
              onUpdate({ ...term, lines: [] });
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
              className="ide-row h-[22px] gap-2 pl-7 pr-3"
              onClick={() => {
                if (!ide.nodes[fid]) return;
                ide.openFile(fid);
                ide.setReveal({ fileId: fid, line: p.line, n: Date.now() });
              }}
            >
              {p.severity === "error" ? <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" /> : p.severity === "warning" ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-ide-warning" /> : <Info className="h-3.5 w-3.5 shrink-0 text-ide-info" />}
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
                  {terms.map((t, i) => <option key={t.id} value={t.id}>{i + 1}: {t.name}</option>)}
                </select>
              )}
              <button title="New Terminal" className="ide-icon-btn h-6 w-6" onClick={() => { const id = Date.now(); setTerms((ts) => [...ts, { id, name: "zsh", lines: banner, cwd: "~" }]); setActiveTerm(id); }}>
                <Plus className="h-4 w-4" />
              </button>
              <button title="Kill Terminal" className="ide-icon-btn h-6 w-6" onClick={() => {
                const rest = terms.filter((t) => t.id !== term.id);
                if (!rest.length) { setTerms([{ id: Date.now(), name: "zsh", lines: banner, cwd: "~" }]); ide.setPanelOpen(false); return; }
                setTerms(rest); setActiveTerm(rest[0].id);
              }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button title={maximized ? "Restore Panel" : "Maximize Panel"} className="ide-icon-btn h-6 w-6" onClick={onMaximize}>
            {maximized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button title="Close Panel" className="ide-icon-btn h-6 w-6" onClick={() => ide.setPanelOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {ide.panelView === "terminal" && term && (
          <Terminal key={term.id} term={term} onUpdate={(t) => setTerms((ts) => ts.map((x) => (x.id === t.id ? t : x)))} />
        )}
        {ide.panelView === "problems" && <Problems />}
        {ide.panelView === "output" && <Output />}
        {ide.panelView === "debug" &&
          (ide.debugging ? <Output channel="Debug" /> : <EmptyState icon={<SquareTerminal className="h-7 w-7" />} title="No active debug session">Press F5 to start debugging.</EmptyState>)}
      </div>
    </div>
  );
}
