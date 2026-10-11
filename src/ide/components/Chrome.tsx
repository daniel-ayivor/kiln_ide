import { useEffect, useMemo, useRef, useState } from "react";
import { Search, GitBranch, CircleX, TriangleAlert, Bell, Bug, Check, Minus, Square, X, PanelLeft, PanelBottom } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIde } from "../store";
import { getCommands } from "../commands";
import { languageFor } from "../mockFs";
import { SETTINGS_TAB } from "../types";
import { FileIcon } from "./Explorer";
import { cn } from "@/lib/utils";

export function TopBar() {
  const ide = useIde();
  const cmds = getCommands(ide);
  const by = (id: string) => cmds.find((c) => c.id === id)!;
  const menus: Record<string, (string | null)[]> = {
    File: ["file.new", "file.newFolder", "file.newWindow", null, "file.open", "file.openFolder", "file.openRecent", null, "file.save", "file.saveAs", "file.saveAll", null, "file.autoSave", "settings.open", null, "file.revert", "editor.close", "file.closeFolder", null, "file.exit"],
    Edit: ["edit.undo", "edit.redo", null, "edit.cut", "edit.copy", "edit.paste", null, "edit.find", "edit.replace", null, "edit.findInFiles", "edit.replaceInFiles", null, "edit.comment", "edit.blockComment", "edit.format"],
    Selection: ["sel.all", "sel.expand", "sel.shrink", null, "sel.copyUp", "sel.copyDown", "sel.moveUp", "sel.moveDown", "sel.duplicate", null, "sel.cursorAbove", "sel.cursorBelow", "sel.nextOccurrence", "sel.allOccurrences", null, "ai.explainSelection"],
    View: ["view.commandPalette", null, "view.explorer", "view.search", "view.scm", "view.run", "view.extensions", "view.chat", null, "view.problems", "view.output", "view.debugConsole", "view.terminal", null, "view.sidebar", "view.panel", "editor.split", null, "editor.wrap", "editor.minimap", "zoom.in", "zoom.out", "theme.toggle"],
    Go: ["go.back", "go.forward", null, "file.quickOpen", "go.symbol", "go.definition", "go.references", "go.line", "go.bracket", null, "go.nextProblem", "go.prevProblem"],
    Run: ["debug.start", "debug.runNoDebug", "debug.stop", "debug.restart", null, "debug.addConfig", null, "debug.breakpoint"],
    Terminal: ["term.new", "term.split", null, "term.runTask", "term.buildTask", null, "term.configure"],
    Help: ["help.welcome", "view.commandPalette", "help.docs", "help.tips", null, "help.shortcuts", null, "help.issue", "help.updates", null, "help.about"],
  };
  return (
    <header className="grid h-9 shrink-0 select-none grid-cols-[1fr_minmax(0,480px)_1fr] items-center gap-2 border-b bg-ide-titlebar px-2">
      <div className="flex min-w-0 items-center gap-1">
        <div className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary font-mono text-[11px] font-bold text-primary-foreground">k</div>
        <div className="hidden min-w-0 items-center lg:flex">
          {Object.entries(menus).map(([name, ids]) => (
            <DropdownMenu key={name}>
              <DropdownMenuTrigger className="rounded px-2 py-0.5 text-[12.5px] text-muted-foreground outline-none hover:bg-ide-hover hover:text-foreground data-[state=open]:bg-ide-hover data-[state=open]:text-foreground">
                {name}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[240px]">
                                {ids.map((id, i) =>
                  id === null ? (
                    <DropdownMenuSeparator key={i} />
                  ) : (
                    <DropdownMenuItem key={id} onClick={() => by(id).run()} className="text-[12.5px]">
                      {by(id).label.replace(/^[^:]+: /, "")}
                      {by(id).shortcut && <DropdownMenuShortcut>{by(id).shortcut}</DropdownMenuShortcut>}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>
      </div>
      <button
        onClick={() => ide.setPalette("files")}
        className="flex h-6 items-center justify-center gap-2 rounded-md border bg-input text-[12px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="truncate">kiln-starter</span>
      </button>
      <div className="flex items-center justify-end gap-0.5">
        <button title="Toggle Sidebar (Ctrl+B)" className={cn("ide-icon-btn h-6 w-6", ide.sidebarOpen && "text-foreground")} onClick={() => ide.setSidebarOpen((o) => !o)}>
          <PanelLeft className="h-4 w-4" />
        </button>
        <button title="Toggle Panel (Ctrl+J)" className={cn("ide-icon-btn h-6 w-6", ide.panelOpen && "text-foreground")} onClick={() => ide.setPanelOpen((o) => !o)}>
          <PanelBottom className="h-4 w-4" />
        </button>
        <div className="ml-2 hidden items-center sm:flex" aria-hidden>
          <span className="ide-icon-btn h-7 w-9"><Minus className="h-3.5 w-3.5" /></span>
          <span className="ide-icon-btn h-7 w-9"><Square className="h-3 w-3" /></span>
          <span className="ide-icon-btn h-7 w-9 hover:!bg-destructive hover:!text-destructive-foreground"><X className="h-4 w-4" /></span>
        </div>
      </div>
    </header>
  );
}

export function StatusBar() {
  const ide = useIde();
  const active = ide.groups[ide.activeGroup]?.active;
  const node = active && active !== SETTINGS_TAB ? ide.nodes[active] : null;
  const errors = ide.problems.filter((p) => p.severity === "error").length;
  const warnings = ide.problems.length - errors;
  const Item = ({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) => (
    <button title={title} onClick={onClick} className="flex h-full items-center gap-1 px-2 hover:bg-ide-hover">{children}</button>
  );
  return (
    <footer
      className={cn(
        "flex h-6 shrink-0 select-none items-center justify-between border-t text-[11.5px] transition-colors",
        ide.debugging ? "bg-primary text-primary-foreground" : "bg-ide-status text-ide-status-foreground",
      )}
    >
      <div className="flex h-full min-w-0 items-center">
        <Item title="Source Control" onClick={() => ide.showView("scm")}><GitBranch className="h-3.5 w-3.5" />{ide.branch}{ide.changes.length ? "*" : ""}</Item>
        <Item title="Problems" onClick={() => ide.showPanel("problems")}>
          <CircleX className="h-3.5 w-3.5" />{errors}
          <TriangleAlert className="ml-1 h-3.5 w-3.5" />{warnings}
        </Item>
        {ide.debugging && <Item onClick={() => ide.setDebugging(false)}><Bug className="h-3.5 w-3.5" />Debugging — click to stop</Item>}
      </div>
      <div className="flex h-full items-center">
        {node && (
          <>
            <Item>Ln {ide.cursor.line}, Col {ide.cursor.column}</Item>
            <Item onClick={() => ide.openFile(SETTINGS_TAB)}>Spaces: {ide.settings.tabSize}</Item>
            <span className="hidden h-full sm:contents">
              <Item>UTF-8</Item>
              <Item>LF</Item>
            </span>
            <Item>{languageFor(node.name).replace(/^./, (c) => c.toUpperCase())}</Item>
          </>
        )}
        <Item title={ide.dirty.size ? `${ide.dirty.size} unsaved` : "All saved"}>{ide.dirty.size ? `${ide.dirty.size} unsaved` : <><Check className="h-3.5 w-3.5" /> Saved</>}</Item>
        <Item title="Notifications" onClick={() => ide.showPanel("output")}><Bell className="h-3.5 w-3.5" /></Item>
      </div>
    </footer>
  );
}

function fuzzy(text: string, q: string) {
  if (!q) return 1;
  const t = text.toLowerCase();
  const s = q.toLowerCase();
  if (t.includes(s)) return 100 - t.indexOf(s);
  let j = 0;
  for (const ch of t) if (ch === s[j]) j++;
  return j === s.length ? 1 : 0;
}

export function CommandPalette() {
  const ide = useIde();
  const mode = ide.palette;
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode) {
      setQ(mode === "commands" ? ">" : "");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [mode]);

  const isCmd = q.startsWith(">");
  const term = isCmd ? q.slice(1).trim() : q.trim();

  const items = useMemo(() => {
    if (!mode) return [];
    if (isCmd)
      return getCommands(ide)
        .map((c) => ({ key: c.id, label: c.label, hint: c.shortcut, run: c.run, score: fuzzy(c.label, term), file: undefined as string | undefined }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);
    return Object.values(ide.nodes)
      .filter((n) => n.type === "file")
      .map((n) => ({ key: n.id, label: n.name, hint: n.id.split("/").slice(0, -1).join("/"), run: () => ide.openFile(n.id), score: fuzzy(n.id, term) + fuzzy(n.name, term) * 2, file: n.name }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [mode, isCmd, term, ide]);

  if (!mode) return null;
  const close = () => ide.setPalette(null);
  const choose = (i: number) => {
    const it = items[i];
    close();
    it?.run();
  };

  return (
    <div className="fixed inset-0 z-40" onMouseDown={close}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="mx-auto mt-12 w-[min(600px,92vw)] animate-in fade-in-0 slide-in-from-top-2 overflow-hidden rounded-lg border bg-popover shadow-2xl duration-150"
      >
        <div className="p-1.5">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              else if (e.key === "Enter") choose(sel);
            }}
            placeholder={isCmd ? "Type a command" : "Search files by name (type > for commands)"}
            className="h-8 w-full rounded border border-primary bg-input px-2.5 text-[13px] outline-none"
          />
        </div>
        <div className="max-h-[360px] overflow-auto pb-1.5">
          {items.slice(0, 50).map((it, i) => (
            <div
              key={it.key}
              onMouseMove={() => setSel(i)}
              onClick={() => choose(i)}
              className={cn("mx-1.5 flex cursor-pointer items-center gap-2 rounded px-2.5 py-1 text-[13px]", i === sel && "bg-ide-selected")}
            >
              {it.file && <FileIcon name={it.file} />}
              <span className="truncate">{it.label}</span>
              {it.hint && <span className={cn("ml-auto shrink-0 text-[11.5px] text-muted-foreground", isCmd && "font-mono")}>{it.hint}</span>}
            </div>
          ))}
          {!items.length && <div className="px-4 py-3 text-[13px] text-muted-foreground">No matching results</div>}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const { confirm, setConfirm } = useIde();
  return (
    <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[15px]">{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px]">{confirm?.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
          <AlertDialogAction className="h-8 bg-destructive text-[13px] text-destructive-foreground hover:bg-destructive/90" onClick={() => { confirm?.onOk(); setConfirm(null); }}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
