import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useIde } from "../store";
import type { Settings } from "../types";

type Row = { key: keyof Settings; section: string; label: string; desc: string; kind: "bool" | "num" | "theme" };

const ROWS: Row[] = [
  { key: "theme", section: "Workbench", label: "Color Theme", desc: "Specifies the color theme used in the workbench and editor.", kind: "theme" },
  { key: "fontSize", section: "Editor", label: "Font Size", desc: "Controls the font size in pixels.", kind: "num" },
  { key: "tabSize", section: "Editor", label: "Tab Size", desc: "The number of spaces a tab is equal to.", kind: "num" },
  { key: "wordWrap", section: "Editor", label: "Word Wrap", desc: "Controls how lines should wrap.", kind: "bool" },
  { key: "minimap", section: "Editor", label: "Minimap", desc: "Controls whether the minimap is shown.", kind: "bool" },
  { key: "lineNumbers", section: "Editor", label: "Line Numbers", desc: "Controls the display of line numbers.", kind: "bool" },
  { key: "autoSave", section: "Files", label: "Auto Save", desc: "Automatically save dirty files after a short delay.", kind: "bool" },
];

export function SettingsView() {
  const { settings, setSettings } = useIde();
  const [q, setQ] = useState("");
  const rows = ROWS.filter((r) => (r.label + r.desc + r.section).toLowerCase().includes(q.toLowerCase()));
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  return (
    <div className="h-full overflow-auto bg-background">
      <div className="mx-auto max-w-3xl px-8 py-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search settings"
          className="mb-6 h-8 w-full rounded border bg-input px-3 text-[13px] outline-none focus:border-primary"
        />
        {rows.map((r, i) => (
          <div key={r.key}>
            {(i === 0 || rows[i - 1].section !== r.section) && (
              <h2 className="mb-2 mt-6 text-[15px] font-semibold first:mt-0">{r.section}</h2>
            )}
            <div className="rounded px-3 py-3 hover:bg-ide-hover">
              <div className="text-[13px] font-semibold">
                <span className="text-muted-foreground">{r.section}: </span>
                {r.label}
              </div>
              <div className="mb-2 text-[12.5px] text-muted-foreground">{r.desc}</div>
              {r.kind === "bool" && (
                <Switch checked={settings[r.key] as boolean} onCheckedChange={(v) => set(r.key, v as never)} />
              )}
              {r.kind === "num" && (
                <input
                  type="number"
                  value={settings[r.key] as number}
                  min={1}
                  max={40}
                  onChange={(e) => set(r.key, Number(e.target.value) as never)}
                  className="h-7 w-24 rounded border bg-input px-2 text-[13px] outline-none focus:border-primary"
                />
              )}
              {r.kind === "theme" && (
                <select
                  value={settings.theme}
                  onChange={(e) => set("theme", e.target.value as Settings["theme"])}
                  className="h-7 w-56 rounded border bg-input px-2 text-[13px] outline-none"
                >
                  <option value="dark">Kiln Dark</option>
                  <option value="light">Kiln Light</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
