import { useEffect, useRef } from "react";
import { setActiveEditor, askAboutSelection } from "../editorBridge";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { X, Columns2, MoreHorizontal, ChevronRight, Settings as SettingsIcon, Loader2 } from "lucide-react";
import { useIde } from "../store";
import { languageFor, pathOf } from "../mockFs";
import { SETTINGS_TAB, type EditorGroup, type Problem } from "../types";
import { FileIcon } from "./Explorer";
import { SettingsView } from "./SettingsView";
import { Kbd } from "./common";
import { cn } from "@/lib/utils";

let themesDefined = false;
let markersHooked = false;

function defineThemes(monaco: Monaco) {
  if (themesDefined) return;
  themesDefined = true;
  monaco.editor.defineTheme("kiln-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7d7468", fontStyle: "italic" },
      { token: "keyword", foreground: "f0a060" },
      { token: "string", foreground: "a8c98a" },
      { token: "number", foreground: "e6c07b" },
      { token: "type", foreground: "8fb8de" },
      { token: "delimiter", foreground: "a39b90" },
    ],
    colors: {
      "editor.background": "#1c1a18",
      "editor.foreground": "#ddd8d0",
      "editorLineNumber.foreground": "#4f4a44",
      "editorLineNumber.activeForeground": "#c9c2b8",
      "editor.lineHighlightBackground": "#24211e",
      "editor.selectionBackground": "#5a3f2a",
      "editorCursor.foreground": "#f0a060",
      "editorIndentGuide.background1": "#2c2926",
      "editorWidget.background": "#24211e",
    },
  });
  monaco.editor.defineTheme("kiln-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "9a9186", fontStyle: "italic" },
      { token: "keyword", foreground: "b8541a" },
      { token: "string", foreground: "4f7a2e" },
      { token: "number", foreground: "9a6a10" },
      { token: "type", foreground: "2f6497" },
    ],
    colors: {
      "editor.background": "#fcfbf9",
      "editor.lineHighlightBackground": "#f3f0ea",
      "editorLineNumber.foreground": "#c2bbb1",
      "editorCursor.foreground": "#c8601e",
      "editor.selectionBackground": "#f2d7c0",
    },
  });
  monaco.editor.defineTheme("kiln-hc-dark", {
    base: "hc-black",
    inherit: true,
    rules: [
      { token: "comment", foreground: "9a9186", fontStyle: "italic" },
      { token: "keyword", foreground: "ffb86b" },
      { token: "string", foreground: "a8e06a" },
      { token: "number", foreground: "ffe08a" },
      { token: "type", foreground: "a8d4ff" },
    ],
    colors: {
      "editor.background": "#0d0b09",
      "editor.foreground": "#f4efe8",
      "editor.lineHighlightBackground": "#1c1916",
      "editorLineNumber.foreground": "#8a8178",
      "editorCursor.foreground": " #ffb86b",
      "editor.selectionBackground": "#7a4f2a",
    },
  });
  monaco.editor.defineTheme("kiln-hc-light", {
    base: "hc-light",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b6257", fontStyle: "italic" },
      { token: "keyword", foreground: "a33f0f" },
      { token: "string", foreground: "3d6423" },
      { token: "number", foreground: "7d5608" },
      { token: "type", foreground: "1f4d7d" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.lineHighlightBackground": "#eceae4",
      "editorLineNumber.foreground": "#8a8178",
      "editorCursor.foreground": "#a33f0f",
      "editor.selectionBackground": "#e8c9a8",
    },
  });
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  });
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ diagnosticCodesToIgnore: [2307, 2792, 7026, 2875] });
}

function Breadcrumbs({ id }: { id: string }) {
  const ide = useIde();
  if (id === SETTINGS_TAB) return null;
  const parts = pathOf(ide.nodes, id);
  return (
    <div className="flex h-6 shrink-0 items-center gap-0.5 overflow-hidden border-b bg-background px-3 text-[12px] text-muted-foreground">
      {parts.map((p, i) => (
        <span key={p.id} className="flex min-w-0 items-center gap-0.5">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
          {p.type === "file" && <FileIcon name={p.name} className="h-3.5 w-3.5" />}
          <button
            className={cn("truncate hover:text-foreground", i === parts.length - 1 && "text-foreground/90")}
            onClick={() => p.type === "folder" && ide.toggleFolder(p.id)}
          >
            {p.name}
          </button>
        </span>
      ))}
    </div>
  );
}

function Tabs({ group, gi }: { group: EditorGroup; gi: number }) {
  const ide = useIde();
  return (
    <div className="flex h-9 shrink-0 items-stretch bg-ide-tab">
      <div className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
        {group.tabs.map((t) => {
          const isSettings = t === SETTINGS_TAB;
          const name = isSettings ? "Settings" : (ide.nodes[t]?.name ?? t);
          const active = group.active === t;
          const dirty = ide.dirty.has(t);
          return (
            <div
              key={t}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/tab", JSON.stringify({ t, gi }))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const data = e.dataTransfer.getData("text/tab");
                if (!data) return;
                const { t: src, gi: sgi } = JSON.parse(data);
                if (sgi !== gi) return;
                ide.setGroups((gs) =>
                  gs.map((g, i) => {
                    if (i !== gi) return g;
                    const tabs = g.tabs.filter((x) => x !== src);
                    tabs.splice(tabs.indexOf(t), 0, src);
                    return { ...g, tabs };
                  }),
                );
              }}
              onClick={() => ide.openFile(t, gi)}
              onAuxClick={(e) => e.button === 1 && ide.closeTab(gi, t)}
              onContextMenu={(e) => {
                e.preventDefault();
                ide.setMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: [
                    { label: "Close", shortcut: "Ctrl+W", onClick: () => ide.closeTab(gi, t) },
                    { label: "Close Others", onClick: () => ide.closeOthers(gi, t) },
                    { label: "Close All", onClick: () => ide.closeAll(gi) },
                    { separator: true },
                    { label: "Copy Path", onClick: () => navigator.clipboard?.writeText(t) },
                    { label: "Split Right", shortcut: "Ctrl+\\", onClick: () => ide.splitRight() },
                  ],
                });
              }}
              title={isSettings ? "Settings" : t}
              className={cn(
                "group relative flex min-w-0 max-w-[200px] shrink-0 cursor-pointer select-none items-center gap-1.5 border-r pl-3 pr-1.5 text-[13px] text-muted-foreground",
                active
                  ? "bg-background text-foreground before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-primary"
                  : "hover:bg-ide-hover",
                active && gi !== ide.activeGroup && "before:bg-muted-foreground/40",
              )}
            >
              {isSettings ? <SettingsIcon className="h-3.5 w-3.5 shrink-0" /> : <FileIcon name={name} className="h-3.5 w-3.5" />}
              <span className="truncate">{name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  ide.closeTab(gi, t);
                }}
                className="ide-icon-btn group/x ml-1 h-5 w-5 shrink-0"
                aria-label="Close tab"
              >
                {dirty ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-foreground/70 group-hover/x:hidden" />
                    <X className="hidden h-3.5 w-3.5 group-hover/x:block" />
                  </>
                ) : (
                  <X className={cn("h-3.5 w-3.5", !active && "opacity-0 group-hover:opacity-100")} />
                )}
              </button>
            </div>
          );
        })}
        <div className="flex-1 border-b" />
      </div>
      <div className="flex items-center gap-0.5 border-b px-1.5">
        <button className="ide-icon-btn h-6 w-6" title="Split Editor Right (Ctrl+\)" onClick={() => { ide.setActiveGroup(gi); ide.splitRight(); }}>
          <Columns2 className="h-4 w-4" />
        </button>
        <button
          className="ide-icon-btn h-6 w-6"
          title="More Actions"
          onClick={(e) =>
            ide.setMenu({
              x: e.clientX - 180,
              y: e.clientY + 10,
              items: [
                { label: "Close All", onClick: () => ide.closeAll(gi) },
                { label: "Save All", onClick: () => ide.saveAll() },
                { separator: true },
                { label: ide.settings.wordWrap ? "Disable Word Wrap" : "Enable Word Wrap", shortcut: "Alt+Z", onClick: () => ide.setSettings((s) => ({ ...s, wordWrap: !s.wordWrap })) },
                { label: ide.settings.minimap ? "Hide Minimap" : "Show Minimap", onClick: () => ide.setSettings((s) => ({ ...s, minimap: !s.minimap })) },
              ],
            })
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CodeEditor({ id, gi }: { id: string; gi: number }) {
  const ide = useIde();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const node = ide.nodes[id];
  const ideRef = useRef(ide);
  ideRef.current = ide;

  useEffect(() => {
    const r = ide.reveal;
    if (r && r.fileId === id && editorRef.current && gi === ide.activeGroup) {
      editorRef.current.revealLineInCenter(r.line);
      editorRef.current.setPosition({ lineNumber: r.line, column: 1 });
      editorRef.current.focus();
    }
  }, [ide.reveal, id, gi, ide.activeGroup]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setActiveEditor(editor);
    editor.onDidFocusEditorText(() => setActiveEditor(editor));
    editor.onDidChangeCursorSelection(() => {
      const sel = editor.getSelection();
      const text = sel ? editor.getModel()?.getValueInRange(sel) ?? "" : "";
      ideRef.current.setSelection(text.trim() ? { fileId: id, text } : null);
    });
    editor.addAction({
      id: "kiln.askAi", label: "Ask Kiln About Selection", contextMenuGroupId: "navigation", contextMenuOrder: 0,
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
      run: () => askAboutSelection(ideRef.current),
    });
    editor.onDidChangeCursorPosition((e) => {
      ideRef.current.setCursor({ line: e.position.lineNumber, column: e.position.column });
    });
    editor.onDidFocusEditorText(() => ideRef.current.setActiveGroup(gi));
    if (!markersHooked) {
      markersHooked = true;
      const collect = () => {
        const out: Problem[] = [];
        for (const m of monaco.editor.getModelMarkers({})) {
          const fileId = m.resource.path.replace(/^\//, "");
          out.push({
            fileId,
            line: m.startLineNumber,
            column: m.startColumn,
            message: m.message,
            severity: m.severity >= 8 ? "error" : m.severity >= 4 ? "warning" : "info",
          });
        }
        // custom TODO/FIXME hints
        for (const n of Object.values(ideRef.current.nodes)) {
          (n.content ?? "").split("\n").forEach((l, i) => {
            const mm = l.match(/(TODO|FIXME):?\s*(.*)/);
            if (mm) out.push({ fileId: n.id, line: i + 1, column: l.indexOf(mm[1]) + 1, message: `${mm[1]}: ${mm[2]}`, severity: mm[1] === "FIXME" ? "warning" : "info" });
          });
        }
        ideRef.current.setProblems(out);
      };
      monaco.editor.onDidChangeMarkers(collect);
      setTimeout(collect, 1500);
    }
  };

  if (!node) return null;
  return (
    <Editor
      path={id}
      language={languageFor(node.name)}
      value={node.content ?? ""}
      theme={ide.settings.theme === "dark" ? "kiln-dark" : "kiln-light"}
      beforeMount={defineThemes}
      onMount={onMount}
      onChange={(v) => ide.updateContent(id, v ?? "")}
      loading={
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading editor…
        </div>
      }
      options={{
        fontSize: ide.settings.fontSize,
        fontFamily: "'JetBrains Mono', monospace",
        fontLigatures: true,
        tabSize: ide.settings.tabSize,
        wordWrap: ide.settings.wordWrap ? "on" : "off",
        minimap: { enabled: ide.settings.minimap, scale: 1 },
        lineNumbers: ide.settings.lineNumbers ? "on" : "off",
        smoothScrolling: true,
        cursorSmoothCaretAnimation: "on",
        cursorBlinking: "smooth",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        renderLineHighlight: "all",
        scrollBeyondLastLine: false,
        padding: { top: 8 },
        automaticLayout: true,
        stickyScroll: { enabled: true },
      }}
    />
  );
}

function Welcome() {
  const ide = useIde();
  const rows: [string, string, () => void][] = [
    ["Show All Commands", "Ctrl+Shift+P", () => ide.setPalette("commands")],
    ["Go to File", "Ctrl+P", () => ide.setPalette("files")],
    ["New File", "Ctrl+N", () => ide.createNode("root", "file")],
    ["Toggle Terminal", "Ctrl+`", () => ide.showPanel("terminal")],
    ["Open Settings", "Ctrl+,", () => ide.openFile(SETTINGS_TAB)],
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-background">
      <div className="text-center">
        <div className="font-mono text-5xl font-bold tracking-tight text-foreground/10">kiln</div>
      </div>
      <div className="grid gap-2">
        {rows.map(([label, key, fn]) => (
          <button key={label} onClick={fn} className="flex w-72 items-center justify-between rounded px-3 py-1 text-[13px] text-muted-foreground hover:bg-ide-hover hover:text-foreground">
            <span>{label}</span>
            <Kbd>{key}</Kbd>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupView({ group, gi }: { group: EditorGroup; gi: number }) {
  const ide = useIde();
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col border-l first:border-l-0")}
      onMouseDown={() => gi !== ide.activeGroup && ide.setActiveGroup(gi)}
    >
      {group.tabs.length > 0 && <Tabs group={group} gi={gi} />}
      {group.active && <Breadcrumbs id={group.active} />}
      <div className="relative min-h-0 flex-1">
        {!group.active ? (
          <Welcome />
        ) : group.active === SETTINGS_TAB ? (
          <SettingsView />
        ) : ide.nodes[group.active] ? (
          <CodeEditor key={group.active} id={group.active} gi={gi} />
        ) : (
          <div className="p-6 text-muted-foreground">File not found.</div>
        )}
      </div>
    </div>
  );
}

export function EditorArea() {
  const ide = useIde();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-background">
      {ide.groups.map((g, i) => (
        <GroupView key={g.id} group={g} gi={i} />
      ))}
    </div>
  );
}
