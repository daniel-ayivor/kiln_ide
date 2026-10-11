import { useEffect, useRef, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IdeProvider, useIde } from "./store";
import { getCommands } from "./commands";
import { ActivityBar } from "./components/ActivityBar";
import { Explorer } from "./components/Explorer";
import { SearchPanel, SourceControlPanel, RunPanel, ExtensionsPanel } from "./components/SidePanels";
import { EditorArea } from "./components/EditorArea";
import { BottomPanel } from "./components/BottomPanel";
import { TopBar, StatusBar, CommandPalette, ConfirmDialog } from "./components/Chrome";
import { ContextMenuLayer, Resizer } from "./components/common";
import { AccountProvider } from "./auth";
import { ChatPanel } from "./components/ChatPanel";

function useShortcuts() {
  const ide = useIde();
  const ref = useRef(ide);
  ref.current = ide;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = ref.current;
      const mod = e.ctrlKey || e.metaKey;
      const run = (id: string) => {
        e.preventDefault();
        e.stopPropagation();
        getCommands(i).find((c) => c.id === id)?.run();
      };
      const k = e.key.toLowerCase();
      if (e.key === "F5") return run(e.shiftKey ? "debug.stop" : "debug.start");
      if (e.altKey && k === "z") return run("editor.wrap");
      if (!mod) return;
      if (e.shiftKey) {
        if (k === "p") return run("file.quickOpen"), i.setPalette("commands");
        if (k === "e") return run("view.explorer");
        if (k === "f") return run("view.search");
        if (k === "g") return run("view.scm");
        if (k === "d") return run("view.run");
        if (k === "x") return run("view.extensions");
        return;
      }
      if (k === "p") return run("file.quickOpen");
      if (k === "s") return run("file.save");
      if (k === "b") return run("view.sidebar");
      if (k === "j") return run("view.panel");
      if (k === "`") return run("view.terminal");
      if (k === "\\") return run("editor.split");
      if (k === ",") return run("settings.open");
      if (k === "w") return run("editor.close");
      if (k === "n") return run("file.new");
      if (k === "i") return run("ai.explainSelection");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}

function Shell() {
  const ide = useIde();
  useShortcuts();
  const [sidebarW, setSidebarW] = useState(260);
  const [panelH, setPanelH] = useState(240);
  const [maxPanel, setMaxPanel] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const { chatOpen, setChatOpen } = ide;

  const View = {
    explorer: Explorer,
    search: SearchPanel,
    scm: SourceControlPanel,
    run: RunPanel,
    extensions: ExtensionsPanel,
  }[ide.sidebarView];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground" onContextMenu={(e) => e.preventDefault()}>
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ActivityBar chatOpen={chatOpen} onChat={() => setChatOpen(v => !v)} />
        {ide.sidebarOpen && (
          <>
            <aside className="shrink-0 overflow-hidden border-r bg-sidebar text-sidebar-foreground" style={{ width: sidebarW }}>
              <View />
            </aside>
            <Resizer direction="x" onResize={(d) => setSidebarW((w) => Math.max(170, Math.min(600, w + d)))} />
          </>
        )}
        <div ref={mainRef} className="flex min-w-0 flex-1 flex-col">
          {!(ide.panelOpen && maxPanel) && <EditorArea />}
          {ide.panelOpen && (
            <>
              {!maxPanel && (
                <Resizer
                  direction="y"
                  onResize={(d) =>
                    setPanelH((h) => Math.max(100, Math.min((mainRef.current?.clientHeight ?? 800) - 120, h - d)))
                  }
                />
              )}
              <div className={maxPanel ? "min-h-0 flex-1" : "shrink-0"} style={maxPanel ? undefined : { height: panelH }}>
                <BottomPanel maximized={maxPanel} onMaximize={() => setMaxPanel((m) => !m)} />
              </div>
            </>
          )}
        </div>
        {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
      </div>
      <StatusBar />
      <CommandPalette />
      <ContextMenuLayer />
      <ConfirmDialog />
    </div>
  );
}

export function Workbench() {
  return (
    <IdeProvider>
      <TooltipProvider>
        <AccountProvider><Shell /></AccountProvider>
      </TooltipProvider>
    </IdeProvider>
  );
}
