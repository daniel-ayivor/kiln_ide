import { toast } from "sonner";
import type { Ide } from "./store";
import { SETTINGS_TAB, PROFILE_TAB,SYNC_TAB, UPDATES_TAB } from "./types";
import { runEditorAction, pasteIntoEditor, askAboutSelection } from "./editorBridge";

export type Command = { id: string; label: string; shortcut?: string; run: () => void | Promise<void>; checked?: boolean; disabled?: boolean };

export const demo = (what: string) => () => toast(`${what}`, { description: "This is a demo workspace — nothing is saved." });

export function getCommands(ide: Ide): Command[] {
  const g = ide.groups[ide.activeGroup];
  const ed = (id: string) => () => runEditorAction(id);
  const hasFile = !!g?.active && g.active !== SETTINGS_TAB && g.active !== PROFILE_TAB && g.active !== SYNC_TAB && g.active !== UPDATES_TAB;
  
  const list: Command[] = [
    // File
    { id: "file.new", label: "File: New Text File", shortcut: "Ctrl+N", run: () => ide.createNode(ide.selected ?? "root", "file") },
    { id: "file.newFolder", label: "File: New Folder", run: () => ide.createNode(ide.selected ?? "root", "folder") },
    { id: "sync.open", label: "Preferences: Open Settings Sync", run: () => ide.openFile(SYNC_TAB) },
    { id: "help.updates", label: "Help: Check for Updates…", run: () => ide.openFile(UPDATES_TAB) },
    { 
      id: "file.newWindow", 
      label: "File: New Window", 
      shortcut: "Ctrl+Shift+N", 
      run: async () => {
        if (window.kilnBridge?.window?.openNewWindow) {
          await window.kilnBridge.window.openNewWindow();
        } else {
          toast("New window requires desktop app environment.");
        }
      } 
    },
    { id: "file.open", label: "File: Open File…", shortcut: "Ctrl+O", run: () => ide.setPalette("files") },
    { 
      id: "file.openFolder", 
      label: "File: Open Folder…", 
      run: async () => {
        if (window.kilnBridge?.fs?.openFolder) {
          const folderPath = await window.kilnBridge.fs.openFolder();
          if (folderPath) {
            toast(`Opened folder: ${folderPath}`);
            const nodes = await window.kilnBridge.fs.loadWorkspace();
            if (nodes) {
              if ('setWorkspaceNodes' in ide && typeof (ide as any).setWorkspaceNodes === 'function') {
                (ide as any).setWorkspaceNodes(nodes);
              } else if ('setNodes' in ide && typeof (ide as any).setNodes === 'function') {
                (ide as any).setNodes(nodes);
              } else if ('openFolder' in ide && typeof (ide as any).openFolder === 'function') {
                await (ide as any).openFolder();
              }
            }
          }
        } else {
          toast("Native folder picker requires desktop app environment.");
        }
      } 
    },
    { id: "file.openRecent", label: "File: Open Recent", run: () => ide.setPalette("files") },
    { id: "file.save", label: "File: Save", shortcut: "Ctrl+S", run: () => ide.save() },
    { id: "file.saveAs", label: "File: Save As…", shortcut: "Ctrl+Shift+S", run: () => { ide.save(); toast("Saved a copy in memory"); } },
    { id: "file.saveAll", label: "File: Save All", run: () => ide.saveAll() },
    { id: "file.autoSave", label: `File: ${ide.settings.autoSave ? "Disable" : "Enable"} Auto Save`, run: () => ide.setSettings((s) => ({ ...s, autoSave: !s.autoSave })) },
    { id: "file.revert", label: "File: Revert File", run: ed("undo") },
    { id: "file.closeFolder", label: "File: Close Folder", run: () => ide.closeAll(ide.activeGroup) },
    { 
      id: "file.exit", 
      label: "File: Exit", 
      run: () => {
        if (window.kilnBridge?.window?.close) {
          window.kilnBridge.window.close();
        } else {
          window.close();
        }
      } 
    },
    { id: "file.quickOpen", label: "Go to File…", shortcut: "Ctrl+P", run: () => ide.setPalette("files") },
    
    // Edit
    { id: "edit.undo", label: "Edit: Undo", shortcut: "Ctrl+Z", run: ed("undo") },
    { id: "edit.redo", label: "Edit: Redo", shortcut: "Ctrl+Y", run: ed("redo") },
    { id: "edit.cut", label: "Edit: Cut", shortcut: "Ctrl+X", run: ed("editor.action.clipboardCutAction") },
    { id: "edit.copy", label: "Edit: Copy", shortcut: "Ctrl+C", run: ed("editor.action.clipboardCopyAction") },
    { id: "edit.paste", label: "Edit: Paste", shortcut: "Ctrl+V", run: () => void pasteIntoEditor() },
    { id: "edit.find", label: "Edit: Find", shortcut: "Ctrl+F", run: ed("actions.find") },
    { id: "edit.replace", label: "Edit: Replace", shortcut: "Ctrl+H", run: ed("editor.action.startFindReplaceAction") },
    { id: "edit.findInFiles", label: "Edit: Find in Files", shortcut: "Ctrl+Shift+F", run: () => ide.showView("search") },
    { id: "edit.replaceInFiles", label: "Edit: Replace in Files", shortcut: "Ctrl+Shift+H", run: () => ide.showView("search") },
    { id: "edit.comment", label: "Edit: Toggle Line Comment", shortcut: "Ctrl+/", run: ed("editor.action.commentLine") },
    { id: "edit.blockComment", label: "Edit: Toggle Block Comment", shortcut: "Shift+Alt+A", run: ed("editor.action.blockComment") },
    { id: "edit.format", label: "Edit: Format Document", shortcut: "Shift+Alt+F", run: ed("editor.action.formatDocument") },
    
    // Selection
    { id: "sel.all", label: "Selection: Select All", shortcut: "Ctrl+A", run: ed("editor.action.selectAll") },
    { id: "sel.expand", label: "Selection: Expand Selection", shortcut: "Shift+Alt+→", run: ed("editor.action.smartSelect.expand") },
    { id: "sel.shrink", label: "Selection: Shrink Selection", shortcut: "Shift+Alt+←", run: ed("editor.action.smartSelect.shrink") },
    { id: "sel.copyUp", label: "Selection: Copy Line Up", shortcut: "Shift+Alt+↑", run: ed("editor.action.copyLinesUpAction") },
    { id: "sel.copyDown", label: "Selection: Copy Line Down", shortcut: "Shift+Alt+↓", run: ed("editor.action.copyLinesDownAction") },
    { id: "sel.moveUp", label: "Selection: Move Line Up", shortcut: "Alt+↑", run: ed("editor.action.moveLinesUpAction") },
    { id: "sel.moveDown", label: "Selection: Move Line Down", shortcut: "Alt+↓", run: ed("editor.action.moveLinesDownAction") },
    { id: "sel.duplicate", label: "Selection: Duplicate Selection", shortcut: "Ctrl+D", run: ed("editor.action.duplicateSelection") },
    { id: "sel.cursorAbove", label: "Selection: Add Cursor Above", shortcut: "Ctrl+Alt+↑", run: ed("editor.action.insertCursorAbove") },
    { id: "sel.cursorBelow", label: "Selection: Add Cursor Below", shortcut: "Ctrl+Alt+↓", run: ed("editor.action.insertCursorBelow") },
    { id: "sel.nextOccurrence", label: "Selection: Add Next Occurrence", shortcut: "Ctrl+D", run: ed("editor.action.addSelectionToNextFindMatch") },
    { id: "sel.allOccurrences", label: "Selection: Select All Occurrences", shortcut: "Ctrl+Shift+L", run: ed("editor.action.selectHighlights") },
    
    // View
    { id: "view.commandPalette", label: "View: Command Palette…", shortcut: "Ctrl+Shift+P", run: () => ide.setPalette("commands") },
    { id: "editor.close", label: "View: Close Editor", shortcut: "Ctrl+W", run: () => g?.active && ide.closeTab(ide.activeGroup, g.active) },
    { id: "editor.closeAll", label: "View: Close All Editors", run: () => ide.closeAll(ide.activeGroup) },
    { id: "editor.split", label: "View: Split Editor Right", shortcut: "Ctrl+\\", run: () => ide.splitRight() },
    { id: "view.sidebar", label: "View: Toggle Primary Side Bar", shortcut: "Ctrl+B", run: () => ide.setSidebarOpen((o) => !o) },
    { id: "view.panel", label: "View: Toggle Panel", shortcut: "Ctrl+J", run: () => ide.setPanelOpen((o) => !o) },
    { id: "view.chat", label: "View: Toggle AI Chat", run: () => ide.setChatOpen((o) => !o) },
    { id: "view.terminal", label: "View: Toggle Terminal", shortcut: "Ctrl+`", run: () => (ide.panelOpen && ide.panelView === "terminal" ? ide.setPanelOpen(false) : ide.showPanel("terminal")) },
    { id: "view.explorer", label: "View: Show Explorer", shortcut: "Ctrl+Shift+E", run: () => ide.showView("explorer") },
    { id: "view.search", label: "View: Show Search", shortcut: "Ctrl+Shift+F", run: () => ide.showView("search") },
    { id: "view.scm", label: "View: Show Source Control", shortcut: "Ctrl+Shift+G", run: () => ide.showView("scm") },
    { id: "view.run", label: "View: Show Run and Debug", shortcut: "Ctrl+Shift+D", run: () => ide.showView("run") },
    { id: "view.extensions", label: "View: Show Extensions", shortcut: "Ctrl+Shift+X", run: () => ide.showView("extensions") },
    { id: "view.problems", label: "View: Show Problems", shortcut: "Ctrl+Shift+M", run: () => ide.showPanel("problems") },
    { id: "view.output", label: "View: Show Output", shortcut: "Ctrl+Shift+U", run: () => ide.showPanel("output") },
    { id: "view.debugConsole", label: "View: Show Debug Console", shortcut: "Ctrl+Shift+Y", run: () => ide.showPanel("debug") },
    { id: "settings.open", label: "Preferences: Open Settings", shortcut: "Ctrl+,", run: () => ide.openFile(SETTINGS_TAB) },
    { id: "editprofile.open", label: "Preferences: Open Profile", run: () => ide.openFile(PROFILE_TAB) },
    { id: "theme.toggle", label: "Preferences: Toggle Light/Dark Theme", run: () => ide.setSettings((s) => {
      const resolved = s.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : s.theme;
      return { ...s, theme: resolved === "dark" ? "light" : "dark" };
    }) },
    { id: "editor.wrap", label: "View: Toggle Word Wrap", shortcut: "Alt+Z", run: () => ide.setSettings((s) => ({ ...s, wordWrap: !s.wordWrap })) },
    { id: "editor.minimap", label: "View: Toggle Minimap", run: () => ide.setSettings((s) => ({ ...s, minimap: !s.minimap })) },
    { id: "zoom.in", label: "View: Zoom In", shortcut: "Ctrl+=", run: () => ide.setSettings((s) => ({ ...s, fontSize: Math.min(28, s.fontSize + 1) })) },
    { id: "zoom.out", label: "View: Zoom Out", shortcut: "Ctrl+-", run: () => ide.setSettings((s) => ({ ...s, fontSize: Math.max(9, s.fontSize - 1) })) },
    
    // Go
    { id: "go.back", label: "Go: Back", shortcut: "Alt+←", run: ed("cursorUndo") },
    { id: "go.forward", label: "Go: Forward", shortcut: "Alt+→", run: ed("cursorRedo") },
    { id: "go.symbol", label: "Go: Go to Symbol in Editor…", shortcut: "Ctrl+Shift+O", run: ed("editor.action.quickOutline") },
    { id: "go.definition", label: "Go: Go to Definition", shortcut: "F12", run: ed("editor.action.revealDefinition") },
    { id: "go.references", label: "Go: Go to References", shortcut: "Shift+F12", run: ed("editor.action.goToReferences") },
    { id: "go.line", label: "Go: Go to Line/Column…", shortcut: "Ctrl+G", run: ed("editor.action.gotoLine") },
    { id: "go.bracket", label: "Go: Go to Bracket", shortcut: "Ctrl+Shift+\\", run: ed("editor.action.jumpToBracket") },
    { id: "go.nextProblem", label: "Go: Next Problem", shortcut: "F8", run: ed("editor.action.marker.next") },
    { id: "go.prevProblem", label: "Go: Previous Problem", shortcut: "Shift+F8", run: ed("editor.action.marker.prev") },
    
    // Run
    { id: "debug.start", label: "Run: Start Debugging", shortcut: "F5", run: () => { ide.setDebugging(true); ide.showPanel("debug"); } },
    { 
      id: "debug.runNoDebug", 
      label: "Run: Run Without Debugging", 
      shortcut: "Ctrl+F5", 
      run: async () => {
        ide.showPanel("terminal");
        toast("Executing shell command...");
        if (window.kilnBridge?.shell?.exec) {
          const shellCtx = {
            cwd: "~",
            nodes: ide.nodes,
            branch: (ide as any).branch ?? "main",
            changes: (ide as any).changes ?? [],
            createNode: ide.createNode,
            log: (ide as any).log ?? (() => {}),
          };
          const result = await window.kilnBridge.shell.exec("npm run dev", shellCtx as any);
          if (result?.lines && typeof (ide as any).appendTerminalLines === "function") {
            (ide as any).appendTerminalLines(result.lines);
          }
        }
      } 
    },
    { id: "debug.stop", label: "Run: Stop Debugging", shortcut: "Shift+F5", run: () => ide.setDebugging(false) },
    { id: "debug.restart", label: "Run: Restart Debugging", shortcut: "Ctrl+Shift+F5", run: () => { ide.setDebugging(false); setTimeout(() => ide.setDebugging(true), 150); } },
    { id: "debug.breakpoint", label: "Run: Toggle Breakpoint", shortcut: "F9", run: demo("Breakpoint toggled") },
    { id: "debug.addConfig", label: "Run: Add Configuration…", run: () => ide.showView("run") },
    
    // Terminal
    { id: "term.new", label: "Terminal: New Terminal", shortcut: "Ctrl+Shift+`", run: () => ide.showPanel("terminal") },
    { id: "term.split", label: "Terminal: Split Terminal", run: () => ide.showPanel("terminal") },
    { id: "term.runTask", label: "Terminal: Run Task…", run: () => { ide.showPanel("terminal"); toast("Task “dev” started"); } },
    { id: "term.buildTask", label: "Terminal: Run Build Task…", shortcut: "Ctrl+Shift+B", run: () => { ide.showPanel("output"); toast("Build finished with 0 errors"); } },
    { id: "term.configure", label: "Terminal: Configure Tasks…", run: demo("Tasks configured") },
    
    // AI
    { id: "ai.explainSelection", label: "Kiln AI: Ask About Selected Code", shortcut: "Ctrl+I", run: () => askAboutSelection(ide) },
    
    // Help
    { id: "help.welcome", label: "Help: Welcome", run: demo("Welcome to Kiln") },
    { id: "help.docs", label: "Help: Documentation", run: demo("Documentation would open here") },
    { id: "help.shortcuts", label: "Help: Keyboard Shortcuts Reference", shortcut: "Ctrl+K Ctrl+R", run: () => ide.setPalette("commands") },
    { id: "help.tips", label: "Help: Tips and Tricks", run: demo("Tip: Ctrl+I asks Kiln about selected code") },
    { id: "help.issue", label: "Help: Report Issue", run: demo("Thanks — issue report drafted") },
    { id: "help.updates", label: "Help: Check for Updates…", run: demo("Kiln is up to date") },
    { id: "help.about", label: "Help: About", run: demo("Kiln 1.0 — desktop build") },
  ];

  const needFile = /^(edit\.(undo|redo|cut|copy|paste|find|replace|comment|blockComment|format)|sel\.|go\.(back|forward|symbol|definition|references|line|bracket|nextProblem|prevProblem)|file\.(save|saveAs|revert)$|editor\.(close|split|closeAll)|ai\.explainSelection|debug\.breakpoint)/;
  
  const checks: Record<string, boolean> = {
    "file.autoSave": !!ide.settings.autoSave, 
    "editor.wrap": !!ide.settings.wordWrap, 
    "editor.minimap": !!ide.settings.minimap,
    "view.sidebar": ide.sidebarOpen, 
    "view.panel": ide.panelOpen, 
    "view.chat": ide.chatOpen,
    "view.terminal": ide.panelOpen && ide.panelView === "terminal",
  };

  return list.map((c) => ({
    ...c,
    label: c.id === "file.autoSave" ? "File: Auto Save" : c.label,
    checked: c.id in checks ? checks[c.id] : undefined,
    disabled: (needFile.test(c.id) && !hasFile) || (c.id === "file.saveAll" && !ide.dirty.size) || (c.id === "debug.start" || c.id === "debug.runNoDebug" ? ide.debugging : c.id === "debug.stop" || c.id === "debug.restart" ? !ide.debugging : false),
  }));
}