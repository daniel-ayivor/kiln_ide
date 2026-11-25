import { useState } from "react";
import { RefreshCw, CheckCircle2, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type UpdateStatus = "idle" | "checking" | "up-to-date" | "available";

export function UpdatesPage() {
  const [status, setStatus] = useState<UpdateStatus>("up-to-date");
  const [channel, setChannel] = useState<"stable" | "insiders">("stable");
  const [autoCheck, setAutoCheck] = useState(true);
  const [lastChecked, setLastChecked] = useState("Just now");

  const handleCheckUpdates = () => {
    setStatus("checking");
    setTimeout(() => {
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastChecked(`Today at ${time}`);
      if (channel === "insiders") {
        setStatus("available");
        toast("Kiln 1.1.0-insider is available");
      } else {
        setStatus("up-to-date");
        toast.success("Kiln is up to date");
      }
    }, 650);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Software Updates</h1>
            <p className="text-[13px] text-muted-foreground">
              Kiln Desktop 1.0.0 · Last checked: {lastChecked}
            </p>
          </div>
          <Button onClick={handleCheckUpdates} disabled={status === "checking"} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${status === "checking" ? "animate-spin" : ""}`} />
            {status === "checking" ? "Checking…" : "Check for Updates"}
          </Button>
        </div>

        {/* Status Banner */}
        <div className="flex items-center justify-between rounded border border-border bg-input/50 px-4 py-3">
          <div className="flex items-center gap-3">
            {status === "available" ? (
              <Download className="h-5 w-5 text-primary" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
            <div>
              <div className="text-[13px] font-semibold text-foreground">
                {status === "checking"
                  ? "Checking update server…"
                  : status === "available"
                    ? "Kiln 1.1.0-insider is ready to download"
                    : "Kiln is up to date (v1.0.0)"}
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                {status === "available"
                  ? "Includes early AI inline completions and faster workspace indexing."
                  : "You are running the latest version on the Stable channel."}
              </p>
            </div>
          </div>
          {status === "available" && (
            <Button
              size="sm"
              onClick={() => {
                toast.success("Update installed (demo) — changes apply on next reload");
                setStatus("up-to-date");
              }}
            >
              Install Update
            </Button>
          )}
        </div>

        {/* Update Preferences */}
        <div className="space-y-2">
          <h2 className="px-3 text-[14px] font-semibold text-foreground">Update Preferences</h2>

          <div className="flex items-center justify-between gap-4 rounded px-3 py-3 hover:bg-ide-hover">
            <div className="space-y-0.5">
              <Label htmlFor="update-channel" className="text-[13px] font-semibold text-foreground">
                Release Channel
              </Label>
              <p className="text-[12.5px] text-muted-foreground">
                Choose between Stable releases or preview Insiders builds.
              </p>
            </div>
            <select
              id="update-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as "stable" | "insiders")}
              className="h-8 w-40 rounded border border-border bg-input px-2.5 text-[13px] text-foreground outline-none focus:border-primary"
            >
              <option value="stable">Stable</option>
              <option value="insiders">Insiders (Preview)</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded px-3 py-3 hover:bg-ide-hover">
            <div className="space-y-0.5">
              <Label htmlFor="auto-update" className="cursor-pointer text-[13px] font-semibold text-foreground">
                Automatically Check for Updates
              </Label>
              <p className="text-[12.5px] text-muted-foreground">
                Check for new Kiln releases in the background on startup.
              </p>
            </div>
            <Switch id="auto-update" checked={autoCheck} onCheckedChange={setAutoCheck} />
          </div>
        </div>

        {/* Release Notes */}
        <div className="space-y-3 rounded border border-border bg-input/30 p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>What’s New in Kiln 1.0.0</span>
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] text-muted-foreground">
            <li>Dedicated editor tabs for Settings, Profile, Settings Sync, and Software Updates.</li>
            <li>Integrated Monaco editor with Kiln Dark, Light, and High Contrast themes.</li>
            <li>Built-in AI assistant (`Ctrl+I`) for inline selection explanations.</li>
            <li>Integrated terminal, source control diffing, and split editor groups (`Ctrl+\`).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}