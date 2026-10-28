import React, { useEffect, useState } from "react";
import { VsxExtension } from "./SidePanels";
import { Download, Star, ShieldCheck, Package, ExternalLink, Check, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ExtensionDetailViewProps {
  extension?: VsxExtension;
  installState?: "idle" | "installing" | "installed";
  onInstall?: (ext: VsxExtension) => void;
  onUninstall?: (ext: VsxExtension) => void;
}

export function ExtensionDetailView({
  extension,
  onInstall,
  onUninstall,
}: {
  extension?: VsxExtension;
  onInstall?: (ext: VsxExtension) => void;
  onUninstall?: (ext: VsxExtension) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "metadata">("overview");
  const [, setTick] = useState(0);

  // Subscribe to installation state changes
  useEffect(() => {
    const handleStateChange = () => setTick((t) => t + 1);
    window.addEventListener("kiln-install-state-changed", handleStateChange);
    return () => window.removeEventListener("kiln-install-state-changed", handleStateChange);
  }, []);

  if (!extension) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading extension details...
      </div>
    );
  }

  const extKey = `${extension.namespace}.${extension.name}`;
  const currentState: "idle" | "installing" | "installed" =
    (window as any).__kilnInstallStates?.[extKey] || "idle";

  const isInstalling = currentState === "installing";
  const isInstalled = currentState === "installed";

  const handleInstallClick = () => {
    if (onInstall) {
      onInstall(extension);
    } else if ((window as any).__kilnHandleInstall) {
      (window as any).__kilnHandleInstall(extension);
    }
  };

  const handleUninstallClick = () => {
    if (onUninstall) {
      onUninstall(extension);
    } else if ((window as any).__kilnHandleUninstall) {
      (window as any).__kilnHandleUninstall(extension);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background p-6 text-foreground">
      {/* Header Banner */}
      <div className="flex gap-6 border-b pb-6">
        {extension.iconUrl ? (
          <img
            src={extension.iconUrl}
            alt={extension.name}
            className="h-24 w-24 rounded-lg object-cover border bg-muted shrink-0"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border">
            <Package className="h-12 w-12" />
          </div>
        )}

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{extension.displayName || extension.name}</h1>
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                v{extension.version}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{extension.description || "No description provided."}</p>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted-foreground mt-3">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> {extension.namespace}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-4 w-4" /> {extension.downloadCount?.toLocaleString() ?? 0} downloads
            </span>
            {extension.averageRating && (
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-ide-warning text-ide-warning" />
                {extension.averageRating.toFixed(1)} rating
              </span>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            {isInstalled ? (
              <button
                onClick={handleUninstallClick}
                className="flex h-8 items-center gap-2 rounded bg-destructive px-4 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Uninstall
              </button>
            ) : (
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className={cn(
                  "flex h-8 items-center gap-2 rounded px-4 text-xs font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90",
                  isInstalling && "opacity-80 cursor-not-allowed"
                )}
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Installing...
                  </>
                ) : (
                  "Install"
                )}
              </button>
            )}

            <a
              href={`https://open-vsx.org/extension/${extension.namespace}/${extension.name}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 items-center gap-1.5 rounded border px-3 text-xs font-medium hover:bg-accent"
            >
              Open VSX Page <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b text-xs font-medium text-muted-foreground mt-4">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn("py-2 border-b-2 transition-colors", activeTab === "overview" ? "border-primary text-foreground" : "border-transparent hover:text-foreground")}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("metadata")}
          className={cn("py-2 border-b-2 transition-colors", activeTab === "metadata" ? "border-primary text-foreground" : "border-transparent hover:text-foreground")}
        >
          Raw Metadata
        </button>
      </div>

      {/* Content Area */}
      <div className="mt-4 flex-1 text-sm leading-relaxed">
        {activeTab === "overview" ? (
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Extension Details</h3>
            <p className="text-muted-foreground">
              {extension.description || "No expanded description available."}
            </p>

            <div className="rounded-lg border bg-card p-4 space-y-2 font-mono text-xs text-card-foreground">
              <div><span className="text-muted-foreground">Identifier:</span> {extension.namespace}.{extension.name}</div>
              <div><span className="text-muted-foreground">Publisher:</span> {extension.namespace}</div>
              <div><span className="text-muted-foreground">Version:</span> {extension.version}</div>
            </div>
          </div>
        ) : (
          <pre className="rounded border bg-muted/50 p-4 overflow-x-auto font-mono text-xs">
            {JSON.stringify(extension, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}