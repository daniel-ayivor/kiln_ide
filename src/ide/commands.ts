import type { Ide } from "./store";
import { SETTINGS_TAB } from "./types";

export type Command = { id: string; label: string; shortcut?: string; run: () => void };

export function getCommands(ide: Ide): Command[] {
  const g = ide.groups[ide.activeGroup];
  return [
    { id: "file.new", label: "File: New File", shortcut: "Ctrl+N", run: () => ide.createNode(ide.selected ?? "root", "file") },
    { id: "file.newFolder", label: "File: New Folder", run: () => ide.createNode(ide.selected ?? "root", "folder") },
    { id: "file.save", label: "File: Save", shortcut: "Ctrl+S", run: () => ide.save() },
    { id: "file.saveAll", label: "File: Save All", run: () => ide.saveAll() },
    { id: "file.quickOpen", label: "Go to File…", shortcut: "Ctrl+P", run: () => ide.setPalette("files") },
    { id: "editor.close", label: "View: Close Editor", shortcut: "Ctrl+W", run: () => g?.active && ide.closeTab(ide.activeGroup, g.active) },
    { id: "editor.closeAll", label: "View: Close All Editors", run: () => ide.closeAll(ide.activeGroup) },
    { id: "editor.split", label: "View: Split Editor Right", shortcut: "Ctrl+\\", run: () => ide.splitRight() },
    { id: "view.sidebar", label: "View: Toggle Sidebar", shortcut: "Ctrl+B", run: () => ide.setSidebarOpen((o) => !o) },
    { id: "view.panel", label: "View: Toggle Panel", shortcut: "Ctrl+J", run: () => ide.setPanelOpen((o) => !o) },
    { id: "view.terminal", label: "View: Toggle Terminal", shortcut: "Ctrl+`", run: () => (ide.panelOpen && ide.panelView === "terminal" ? ide.setPanelOpen(false) : ide.showPanel("terminal")) },
    { id: "view.explorer", label: "View: Show Explorer", shortcut: "Ctrl+Shift+E", run: () => ide.showView("explorer") },
    { id: "view.search", label: "View: Show Search", shortcut: "Ctrl+Shift+F", run: () => ide.showView("search") },
    { id: "view.scm", label: "View: Show Source Control", shortcut: "Ctrl+Shift+G", run: () => ide.showView("scm") },
    { id: "view.run", label: "View: Show Run and Debug", shortcut: "Ctrl+Shift+D", run: () => ide.showView("run") },
    { id: "view.extensions", label: "View: Show Extensions", shortcut: "Ctrl+Shift+X", run: () => ide.showView("extensions") },
    { id: "view.problems", label: "View: Show Problems", run: () => ide.showPanel("problems") },
    { id: "view.output", label: "View: Show Output", run: () => ide.showPanel("output") },
    { id: "settings.open", label: "Preferences: Open Settings", shortcut: "Ctrl+,", run: () => ide.openFile(SETTINGS_TAB) },
    { id: "theme.toggle", label: "Preferences: Toggle Light/Dark Theme", run: () => ide.setSettings((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" })) },
    { id: "editor.wrap", label: "View: Toggle Word Wrap", shortcut: "Alt+Z", run: () => ide.setSettings((s) => ({ ...s, wordWrap: !s.wordWrap })) },
    { id: "editor.minimap", label: "View: Toggle Minimap", run: () => ide.setSettings((s) => ({ ...s, minimap: !s.minimap })) },
    { id: "zoom.in", label: "Editor: Increase Font Size", run: () => ide.setSettings((s) => ({ ...s, fontSize: Math.min(28, s.fontSize + 1) })) },
    { id: "zoom.out", label: "Editor: Decrease Font Size", run: () => ide.setSettings((s) => ({ ...s, fontSize: Math.max(9, s.fontSize - 1) })) },
    { id: "debug.start", label: "Debug: Start Debugging", shortcut: "F5", run: () => { ide.setDebugging(true); ide.showPanel("debug"); } },
    { id: "debug.stop", label: "Debug: Stop", shortcut: "Shift+F5", run: () => ide.setDebugging(false) },
  ];
}
