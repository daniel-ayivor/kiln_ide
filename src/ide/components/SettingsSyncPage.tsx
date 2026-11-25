import { useState } from "react";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { useAccount } from "../auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type SyncCategory = {
  id: "settings" | "keybindings" | "extensions" | "uiState";
  label: string;
  desc: string;
};

const CATEGORIES: SyncCategory[] = [
  { id: "settings", label: "Settings", desc: "Editor font size, tab size, word wrap, and color theme preferences." },
  { id: "keybindings", label: "Keyboard Shortcuts", desc: "Custom keybindings across desktop and web sessions." },
  { id: "extensions", label: "Extensions", desc: "Installed extensions and enabled/disabled states." },
  { id: "uiState", label: "UI State", desc: "Sidebar layout, panel visibility, and active view configuration." },
];

export function SettingsSyncPage() {
  const { user, signIn } = useAccount();
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [lastSynced, setLastSynced] = useState("Just now");
  const [selected, setSelected] = useState<Record<SyncCategory["id"], boolean>>({
    settings: true,
    keybindings: true,
    extensions: true,
    uiState: true,
  });

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Sign in to back up and sync your settings across devices.
        </p>
        <Button onClick={signIn}>Sign in with demo account</Button>
      </div>
    );
  }

  const handleSyncNow = () => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setLastSynced(`Today at ${time}`);
    toast.success("Settings synced (demo)");
  };

  const toggleSync = (enabled: boolean) => {
    setSyncEnabled(enabled);
    toast(enabled ? "Settings Sync turned on (demo)" : "Settings Sync turned off (demo)");
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Backup and Sync Settings</h1>
            <p className="text-[13px] text-muted-foreground">
              Signed in as <span className="text-foreground">{user.email}</span> · Demo only — changes last until reload.
            </p>
          </div>
          <Button onClick={handleSyncNow} disabled={!syncEnabled} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Now
          </Button>
        </div>

        {/* Master Toggle & Status */}
        <div className="flex items-center justify-between rounded border border-border bg-input/50 px-4 py-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <span>Settings Sync</span>
              {syncEnabled && (
                <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              {syncEnabled ? `Last synced: ${lastSynced}` : "Sync is currently paused."}
            </p>
          </div>
          <Switch checked={syncEnabled} onCheckedChange={toggleSync} />
        </div>

        {/* Sync Categories */}
        <div className="space-y-1">
          <h2 className="px-3 pb-1 text-[14px] font-semibold text-foreground">Configure Synced Data</h2>
          {CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between gap-4 rounded px-3 py-3 hover:bg-ide-hover"
            >
              <div className="space-y-0.5">
                <Label htmlFor={`sync-${cat.id}`} className="cursor-pointer text-[13px] font-semibold text-foreground">
                  {cat.label}
                </Label>
                <p className="text-[12.5px] text-muted-foreground">{cat.desc}</p>
              </div>
              <Switch
                id={`sync-${cat.id}`}
                checked={selected[cat.id]}
                disabled={!syncEnabled}
                onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [cat.id]: v }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}