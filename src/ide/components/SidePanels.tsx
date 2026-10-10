import { useMemo, useState } from "react";
import {
  CaseSensitive,
  Regex,
  WholeWord,
  Check,
  Undo2,
  Plus,
  Play,
  Square,
  Bug,
  Circle,
  Star,
  Download,
  GitBranch,
  SearchX,
} from "lucide-react";
import { useIde } from "../store";
import { FileIcon } from "./Explorer";
import { EmptyState, SectionHeader } from "./common";
import { cn } from "@/lib/utils";

export function SearchPanel() {
  const ide = useIde();
  const [q, setQ] = useState("");
  const [cs, setCs] = useState(false);
  const [ww, setWw] = useState(false);
  const [re, setRe] = useState(false);
  const [replace, setReplace] = useState("");

  const results = useMemo(() => {
    if (!q) return [];
    let rx: RegExp;
    try {
      const src = re ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      rx = new RegExp(ww ? `\\b${src}\\b` : src, cs ? "g" : "gi");
    } catch {
      return [];
    }
    return Object.values(ide.nodes)
      .filter((n) => n.type === "file")
      .map((n) => {
        const lines = (n.content ?? "").split("\n");
        const matches = lines
          .map((text, i) => ({ text, line: i + 1, hit: (rx.lastIndex = 0, rx.test(text)) }))
          .filter((m) => m.hit);
        return { node: n, matches };
      })
      .filter((r) => r.matches.length);
  }, [q, cs, ww, re, ide.nodes]);

  const total = results.reduce((a, r) => a + r.matches.length, 0);
  const Toggle = ({ on, set, children, title }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode; title: string }) => (
    <button title={title} onClick={() => set(!on)} className={cn("ide-icon-btn h-5 w-5", on && "bg-primary/20 text-primary")}>{children}</button>
  );

  const highlight = (text: string) => {
    const idx = cs ? text.indexOf(q) : text.toLowerCase().indexOf(q.toLowerCase());
    const t = text.trim();
    if (re || idx < 0) return <span className="truncate">{t}</span>;
    const lead = text.length - text.trimStart().length;
    const s = idx - lead;
    return (
      <span className="truncate">
        {t.slice(0, s)}
        <mark className="rounded-sm bg-primary/30 text-foreground">{t.slice(s, s + q.length)}</mark>
        {t.slice(s + q.length)}
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Search" />
      <div className="space-y-1.5 px-3 pb-2">
        <div className="flex items-center rounded border bg-input pr-1 focus-within:border-primary">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-7 min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none" />
          <Toggle title="Match Case" on={cs} set={setCs}><CaseSensitive className="h-4 w-4" /></Toggle>
          <Toggle title="Match Whole Word" on={ww} set={setWw}><WholeWord className="h-4 w-4" /></Toggle>
          <Toggle title="Use Regular Expression" on={re} set={setRe}><Regex className="h-3.5 w-3.5" /></Toggle>
        </div>
        <div className="flex items-center gap-1">
          <input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Replace" className="h-7 min-w-0 flex-1 rounded border bg-input px-2 text-[13px] outline-none focus:border-primary" />
          <button
            title="Replace All"
            disabled={!q || re}
            onClick={() => {
              results.forEach(({ node }) => ide.updateContent(node.id, (node.content ?? "").split(q).join(replace)));
              ide.log(`Replaced ${total} occurrences of "${q}"`);
            }}
            className="ide-icon-btn h-7 px-2 text-[11px] disabled:opacity-40"
          >
            All
          </button>
        </div>
      </div>
      {q && (
        <div className="px-4 pb-1 text-[12px] text-muted-foreground">
          {total} results in {results.length} files
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {q && !results.length && <EmptyState icon={<SearchX className="h-8 w-8" />} title="No results found" />}
        {results.map(({ node, matches }) => (
          <div key={node.id}>
            <div className="ide-row h-[22px] gap-1.5 px-3 text-[13px]" onClick={() => ide.openFile(node.id)}>
              <FileIcon name={node.name} />
              <span className="truncate">{node.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">{node.id.split("/").slice(0, -1).join("/")}</span>
              <span className="ml-auto rounded-full bg-muted px-1.5 text-[10.5px]">{matches.length}</span>
            </div>
            {matches.map((m) => (
              <div
                key={m.line}
                className="ide-row h-[22px] gap-2 pl-9 pr-3 font-mono text-[12px]"
                onClick={() => {
                  ide.openFile(node.id);
                  ide.setReveal({ fileId: node.id, line: m.line, n: Date.now() });
                }}
              >
                <span className="w-5 shrink-0 text-right text-muted-foreground">{m.line}</span>
                {highlight(m.text)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SourceControlPanel() {
  const ide = useIde();
  const [msg, setMsg] = useState("");
  const doCommit = () => {
    if (!msg.trim() || !ide.changes.length) return;
    ide.commit(msg.trim());
    setMsg("");
  };
  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Source Control" actions={<span className="flex items-center gap-1 text-[11px] normal-case"><GitBranch className="h-3.5 w-3.5" />{ide.branch}</span>} />
      <div className="space-y-2 px-3 pb-3">
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && doCommit()}
          placeholder={`Message (Ctrl+Enter to commit on '${ide.branch}')`}
          rows={2}
          className="w-full resize-none rounded border bg-input px-2 py-1.5 text-[13px] outline-none focus:border-primary"
        />
        <button
          onClick={doCommit}
          disabled={!msg.trim() || !ide.changes.length}
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded bg-primary text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> Commit
        </button>
      </div>
      <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Changes <span className="ml-1 rounded-full bg-muted px-1.5">{ide.changes.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {!ide.changes.length && <EmptyState icon={<Check className="h-8 w-8" />} title="No changes">Your working tree is clean.</EmptyState>}
        {ide.changes.map((c) => {
          const name = ide.nodes[c.id]?.name ?? c.id.split("/").pop()!;
          return (
            <div key={c.id} className="group ide-row h-[22px] gap-1.5 px-4 text-[13px]" onClick={() => ide.nodes[c.id] && ide.openFile(c.id)}>
              <FileIcon name={name} />
              <span className={cn("truncate", c.status === "D" && "line-through")}>{name}</span>
              <span className="truncate text-[11px] text-muted-foreground">{c.id.split("/").slice(0, -1).join("/")}</span>
              <button
                title="Discard changes"
                className="ide-icon-btn ml-auto hidden h-5 w-5 group-hover:inline-flex"
                onClick={(e) => {
                  e.stopPropagation();
                  if (c.status === "M") ide.updateContent(c.id, ide.committed[c.id]);
                }}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <span className={cn("w-3 text-[11px] font-semibold", c.status === "M" ? "text-ide-warning" : c.status === "U" ? "text-ide-success" : "text-destructive")}>{c.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RunPanel() {
  const ide = useIde();
  const [config, setConfig] = useState("Launch Dev Server");
  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Run and Debug" />
      <div className="space-y-2 px-3 pb-3">
        <div className="flex gap-1">
          <button
            onClick={() => {
              if (ide.debugging) {
                ide.setDebugging(false);
                ide.log("Debug session ended", "Debug");
              } else {
                ide.setDebugging(true);
                ide.showPanel("debug");
                ide.log(`Starting "${config}"…`, "Debug");
              }
            }}
            className={cn("flex h-7 flex-1 items-center justify-center gap-1.5 rounded text-[12.5px] font-medium", ide.debugging ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")}
          >
            {ide.debugging ? <><Square className="h-3.5 w-3.5" /> Stop</> : <><Play className="h-3.5 w-3.5" /> Start Debugging</>}
          </button>
        </div>
        <select value={config} onChange={(e) => setConfig(e.target.value)} className="h-7 w-full rounded border bg-input px-1.5 text-[12.5px] outline-none">
          <option>Launch Dev Server</option>
          <option>Run Tests (vitest)</option>
          <option>Attach to Node Process</option>
        </select>
      </div>
      {[
        { title: "Variables", rows: ide.debugging ? ["count: 3", "total: \"$59.97\"", "props: {…}"] : [] },
        { title: "Watch", rows: ["count * 19.99"] },
        { title: "Call Stack", rows: ide.debugging ? ["App  App.tsx:8", "renderWithHooks  react-dom.js:1204", "mountIndeterminateComponent"] : [] },
        { title: "Breakpoints", rows: ["App.tsx  line 8", "format.ts  line 2"] },
      ].map((s) => (
        <div key={s.title} className="border-t">
          <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.title}</div>
          {s.rows.length ? (
            s.rows.map((r) => (
              <div key={r} className="ide-row h-[22px] gap-2 px-5 font-mono text-[12px]">
                {s.title === "Breakpoints" ? <Circle className="h-2.5 w-2.5 fill-destructive text-destructive" /> : s.title === "Call Stack" ? <Bug className="h-3 w-3 text-muted-foreground" /> : null}
                <span className="truncate">{r}</span>
              </div>
            ))
          ) : (
            <div className="px-5 pb-2 text-[12px] text-muted-foreground">Not paused</div>
          )}
        </div>
      ))}
    </div>
  );
}

const EXTENSIONS = [
  { id: "prettier", name: "Prettier", author: "Prettier", desc: "Opinionated code formatter", downloads: "48M", rating: 4.8 },
  { id: "eslint", name: "ESLint", author: "Microsoft", desc: "Integrates ESLint into the editor", downloads: "32M", rating: 4.6 },
  { id: "gitlens", name: "GitLens", author: "GitKraken", desc: "Supercharge Git inside your editor", downloads: "29M", rating: 4.7 },
  { id: "tailwind", name: "Tailwind IntelliSense", author: "Tailwind Labs", desc: "Autocomplete and linting for Tailwind CSS", downloads: "11M", rating: 4.9 },
  { id: "errorlens", name: "Error Lens", author: "Alexander", desc: "Inline diagnostics, highlighted", downloads: "6M", rating: 4.8 },
  { id: "docker", name: "Docker", author: "Microsoft", desc: "Build, manage and deploy containers", downloads: "27M", rating: 4.4 },
  { id: "vim", name: "Vim Keys", author: "vscodevim", desc: "Vim emulation for the editor", downloads: "6M", rating: 4.2 },
];

export function ExtensionsPanel() {
  const ide = useIde();
  const [q, setQ] = useState("");
  const [installed, setInstalled] = useState<Set<string>>(new Set(["prettier", "eslint"]));
  const [busy, setBusy] = useState<string | null>(null);
  const list = EXTENSIONS.filter((e) => (e.name + e.desc + e.author).toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string, name: string) => {
    setBusy(id);
    setTimeout(() => {
      setInstalled((s) => {
        const n = new Set(s);
        if (n.has(id)) { n.delete(id); ide.log(`Uninstalled ${name}`, "Extensions"); }
        else { n.add(id); ide.log(`Installed ${name}`, "Extensions"); }
        return n;
      });
      setBusy(null);
    }, 700);
  };
  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Extensions" />
      <div className="px-3 pb-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search extensions in marketplace" className="h-7 w-full rounded border bg-input px-2 text-[13px] outline-none focus:border-primary" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {list.map((e) => {
          const on = installed.has(e.id);
          return (
            <div key={e.id} className="flex gap-3 px-3 py-2.5 hover:bg-ide-hover">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/15 font-mono text-base font-semibold text-primary">
                {e.name.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold">{e.name}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground"><Download className="h-3 w-3" />{e.downloads}</span>
                </div>
                <div className="truncate text-[12px] text-muted-foreground">{e.desc}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{e.author}</span>
                  <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-ide-warning text-ide-warning" />{e.rating}</span>
                  <button
                    onClick={() => toggle(e.id, e.name)}
                    disabled={busy === e.id}
                    className={cn("ml-auto rounded px-2 py-0.5 text-[11px] font-medium disabled:opacity-60", on ? "border bg-transparent text-foreground hover:bg-ide-hover" : "bg-primary text-primary-foreground")}
                  >
                    {busy === e.id ? "…" : on ? "Uninstall" : "Install"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {!list.length && <EmptyState icon={<Plus className="h-8 w-8" />} title="No extensions found" />}
      </div>
    </div>
  );
}
