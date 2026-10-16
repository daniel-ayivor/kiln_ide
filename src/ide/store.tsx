import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { pathOf } from "./mockFs";
import { getPlatform } from "./platform";
import type {
  EditorGroup,
  FsNode,
  MenuItem,
  PanelView,
  Problem,
  Settings,
  SidebarView,
} from "./types";

const defaultSettings: Settings = {
  theme: "dark",
  fontSize: 13,
  tabSize: 2,
  wordWrap: false,
  minimap: true,
  lineNumbers: true,
  autoSave: false,
};

type Output = { channel: string; line: string; time: string };

function useIdeState() {
  const [initial] = useState(() => {
    const ws = getPlatform().fs.loadWorkspace();
    // Electron's loadWorkspace is async (IPC); start empty and fill in below.
    return ws instanceof Promise ? {} : ws;
  });
  const [nodes, setNodes] = useState<Record<string, FsNode>>(initial);

  // Async workspace load (Electron bridge) + external file-change subscription.
  useEffect(() => {
    const platform = getPlatform();
    const ws = platform.fs.loadWorkspace();
    if (ws instanceof Promise) {
      let cancelled = false;
      ws.then((loaded) => {
        if (cancelled) return;
        setNodes(loaded);
        const contents = Object.fromEntries(
          Object.values(loaded)
            .filter((n) => n.type === "file")
            .map((n) => [n.id, n.content ?? ""]),
        );
        setSaved(contents);
        setCommitted({ ...contents });
      });
      return () => {
        cancelled = true;
      };
    }
    const unsubscribe = platform.fs.onFileChange?.((e) => {
      if (e.kind === "deleted") {
        setNodes((n) => {
          const next = { ...n };
          delete next[e.id];
          return next;
        });
        return;
      }
      void platform.fs.readFile?.(e.id).then((content) => {
        if (content === null || content === undefined) return;
        setNodes((n) => (n[e.id] ? { ...n, [e.id]: { ...n[e.id], content } } : n));
        setSaved((s) => ({ ...s, [e.id]: content }));
      });
    });
    return unsubscribe;
  }, []);
  const [saved, setSaved] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.values(initial)
        .filter((n) => n.type === "file")
        .map((n) => [n.id, n.content ?? ""]),
    ),
  );
  const [committed, setCommitted] = useState<Record<string, string>>(() => ({ ...saved }));
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["root", "src", "src/components"]),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [groups, setGroups] = useState<EditorGroup[]>([
    { id: "g1", tabs: ["src/App.tsx"], active: "src/App.tsx" },
  ]);
  const [activeGroup, setActiveGroup] = useState(0);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelView, setPanelView] = useState<PanelView>("terminal");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [palette, setPalette] = useState<null | "commands" | "files">(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [problems, setProblems] = useState<Problem[]>([]);
  const [output, setOutput] = useState<Output[]>([
    { channel: "Kiln", line: "Workspace kiln-starter opened", time: new Date().toLocaleTimeString() },
  ]);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ fileId: string; line: number; n: number } | null>(null);
  const [debugging, setDebugging] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; body: string; onOk: () => void } | null>(
    null,
  );
  const [branch] = useState("main");
  const [selection, setSelection] = useState<{ fileId: string; text: string } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState<{ file: string; language: string; code: string; n: number } | null>(null);
  const [chatThreads, setChatThreads] = useState<{ id: string; title: string; messages: import("ai").UIMessage[] }[]>([]);

  // theme: persisted in the browser, "system" follows the OS preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kiln.theme");
      if (stored === "dark" || stored === "light" || stored === "hc-dark" || stored === "hc-light" || stored === "system") {
        setSettings((s) => (s.theme === stored ? s : { ...s, theme: stored }));
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("kiln.theme", settings.theme);
    } catch {
      /* storage unavailable */
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = settings.theme === "system" ? (media.matches ? "dark" : "light") : settings.theme;
      const el = document.documentElement;
      el.classList.toggle("dark", resolved === "dark" || resolved === "hc-dark");
      el.classList.toggle("hc", resolved === "hc-dark" || resolved === "hc-light");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);

  const log = useCallback((line: string, channel = "Kiln") => {
    setOutput((o) => [...o, { channel, line, time: new Date().toLocaleTimeString() }]);
  }, []);

  const openFile = useCallback(
    (id: string, groupIndex?: number) => {
      const gi = groupIndex ?? activeGroup;
      setGroups((gs) =>
        gs.map((g, i) =>
          i === gi ? { ...g, tabs: g.tabs.includes(id) ? g.tabs : [...g.tabs, id], active: id } : g,
        ),
      );
      setActiveGroup(gi);
      setSelected(id);
      // expand parents
      setNodes((n) => {
        const parents = pathOf(n, id).slice(0, -1).map((p) => p.id);
        setExpanded((e) => new Set([...e, ...parents]));
        return n;
      });
    },
    [activeGroup],
  );

  const closeTab = useCallback((gi: number, id: string) => {
    setGroups((gs) => {
      const next = gs.map((g, i) => {
        if (i !== gi) return g;
        const idx = g.tabs.indexOf(id);
        const tabs = g.tabs.filter((t) => t !== id);
        const active = g.active === id ? (tabs[Math.max(0, idx - 1)] ?? null) : g.active;
        return { ...g, tabs, active };
      });
      if (next.length > 1 && next[gi].tabs.length === 0) {
        const filtered = next.filter((_, i) => i !== gi);
        setActiveGroup(0);
        return filtered;
      }
      return next;
    });
  }, []);

  const closeOthers = useCallback((gi: number, id: string) => {
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, tabs: [id], active: id } : g)));
  }, []);
  const closeAll = useCallback((gi: number) => {
    setGroups((gs) => {
      if (gs.length > 1) return gs.filter((_, i) => i !== gi);
      return [{ ...gs[0], tabs: [], active: null }];
    });
    setActiveGroup(0);
  }, []);

  const splitRight = useCallback(() => {
    setGroups((gs) => {
      if (gs.length >= 3) return gs;
      const cur = gs[activeGroup];
      const tab = cur?.active;
      setActiveGroup(gs.length);
      return [...gs, { id: `g${Date.now()}`, tabs: tab ? [tab] : [], active: tab ?? null }];
    });
  }, [activeGroup]);

  const updateContent = useCallback((id: string, content: string) => {
    setNodes((n) => (n[id] ? { ...n, [id]: { ...n[id], content } } : n));
  }, []);

  const save = useCallback(
    (id?: string | null) => {
      const target = id ?? groups[activeGroup]?.active;
      if (!target || !nodes[target] || nodes[target].type !== "file") return;
      setSaved((s) => ({ ...s, [target]: nodes[target].content ?? "" }));
      log(`Saved ${target}`);
    },
    [groups, activeGroup, nodes, log],
  );
  const saveAll = useCallback(() => {
    setSaved(
      Object.fromEntries(
        Object.values(nodes)
          .filter((n) => n.type === "file")
          .map((n) => [n.id, n.content ?? ""]),
      ),
    );
    log("Saved all files");
  }, [nodes, log]);

  // autosave
  useEffect(() => {
    if (!settings.autoSave) return;
    const t = setTimeout(() => {
      setSaved((s) => {
        const next = { ...s };
        for (const n of Object.values(nodes)) if (n.type === "file") next[n.id] = n.content ?? "";
        return next;
      });
    }, 800);
    return () => clearTimeout(t);
  }, [nodes, settings.autoSave]);

  const createNode = useCallback(
    (parentId: string, type: "file" | "folder") => {
      const parent = nodes[parentId]?.type === "folder" ? parentId : (nodes[parentId]?.parentId ?? "root");
      const base = type === "file" ? "untitled" : "new-folder";
      let name = type === "file" ? `${base}.ts` : base;
      let i = 1;
      const prefix = parent === "root" ? "" : parent + "/";
      while (nodes[prefix + name]) name = type === "file" ? `${base}-${i++}.ts` : `${base}-${i++}`;
      const id = prefix + name;
      setNodes((n) => ({
        ...n,
        [id]: { id, name, type, parentId: parent, content: type === "file" ? "" : undefined },
      }));
      if (type === "file") setSaved((s) => ({ ...s, [id]: "" }));
      setExpanded((e) => new Set([...e, parent]));
      setRenaming(id);
      setSelected(id);
      setSidebarView("explorer");
      setSidebarOpen(true);
    },
    [nodes],
  );

  // rename keeps ids stable (ids are opaque after creation)
  const renameNode = useCallback((id: string, name: string) => {
    const clean = name.trim();
    setRenaming(null);
    if (!clean) return;
    setNodes((n) => ({ ...n, [id]: { ...n[id], name: clean } }));
  }, []);

  const deleteNode = useCallback(
    (id: string) => {
      const toDelete = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of Object.values(nodes))
          if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
            toDelete.add(n.id);
            grew = true;
          }
      }
      setNodes((n) => Object.fromEntries(Object.entries(n).filter(([k]) => !toDelete.has(k))));
      setGroups((gs) => {
        const next = gs.map((g) => {
          const tabs = g.tabs.filter((t) => !toDelete.has(t));
          return { ...g, tabs, active: g.active && toDelete.has(g.active) ? (tabs[0] ?? null) : g.active };
        });
        const nonEmpty = next.filter((g) => g.tabs.length > 0);
        return nonEmpty.length ? nonEmpty : [{ ...next[0], tabs: [], active: null }];
      });
      setActiveGroup(0);
      log(`Deleted ${nodes[id]?.name}`);
    },
    [nodes, log],
  );

  const commit = useCallback(
    (message: string) => {
      const snapshot = Object.fromEntries(
        Object.values(nodes)
          .filter((n) => n.type === "file")
          .map((n) => [n.id, n.content ?? ""]),
      );
      setCommitted(snapshot);
      setSaved(snapshot);
      log(`[main ${Math.random().toString(16).slice(2, 9)}] ${message}`, "Git");
    },
    [nodes, log],
  );

  const toggleFolder = useCallback((id: string) => {
    setExpanded((e) => {
      const n = new Set(e);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const showView = useCallback(
    (v: SidebarView) => {
      if (sidebarOpen && sidebarView === v) setSidebarOpen(false);
      else {
        setSidebarView(v);
        setSidebarOpen(true);
      }
    },
    [sidebarOpen, sidebarView],
  );

  const showPanel = useCallback((v: PanelView) => {
    setPanelView(v);
    setPanelOpen(true);
  }, []);

  const dirty = useMemo(
    () =>
      new Set(
        Object.values(nodes)
          .filter((n) => n.type === "file" && (n.content ?? "") !== (saved[n.id] ?? ""))
          .map((n) => n.id),
      ),
    [nodes, saved],
  );

  const changes = useMemo(() => {
    const out: { id: string; status: "M" | "U" | "D" }[] = [];
    for (const n of Object.values(nodes)) {
      if (n.type !== "file") continue;
      if (!(n.id in committed)) out.push({ id: n.id, status: "U" });
      else if ((n.content ?? "") !== committed[n.id]) out.push({ id: n.id, status: "M" });
    }
    for (const k of Object.keys(committed)) if (!nodes[k]) out.push({ id: k, status: "D" });
    return out;
  }, [nodes, committed]);

  return {
    nodes, expanded, selected, setSelected, groups, setGroups, activeGroup, setActiveGroup,
    sidebarView, sidebarOpen, setSidebarOpen, panelOpen, setPanelOpen, panelView, settings,
    setSettings, palette, setPalette, cursor, setCursor, problems, setProblems, output, log,
    menu, setMenu, renaming, setRenaming, reveal, setReveal, debugging, setDebugging, confirm,
    setConfirm, branch, dirty, selection, setSelection, chatOpen, setChatOpen, chatDraft, setChatDraft, chatThreads, setChatThreads, changes, committed,
    openFile, closeTab, closeOthers, closeAll, splitRight, updateContent, save, saveAll,
    createNode, renameNode, deleteNode, commit, toggleFolder, showView, showPanel,
  };
}

export type Ide = ReturnType<typeof useIdeState>;
const Ctx = createContext<Ide | null>(null);

export function IdeProvider({ children }: { children: ReactNode }) {
  const ide = useIdeState();
  return <Ctx.Provider value={ide}>{children}</Ctx.Provider>;
}

export function useIde() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useIde must be used within IdeProvider");
  return c;
}
