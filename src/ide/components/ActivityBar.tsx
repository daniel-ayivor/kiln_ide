import { Files, Search, GitBranch, Play, Blocks, Settings, CircleUser } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIde } from "../store";
import { SETTINGS_TAB, type SidebarView } from "../types";
import { cn } from "@/lib/utils";

const items: { id: SidebarView; icon: typeof Files; label: string; key: string }[] = [
  { id: "explorer", icon: Files, label: "Explorer", key: "Ctrl+Shift+E" },
  { id: "search", icon: Search, label: "Search", key: "Ctrl+Shift+F" },
  { id: "scm", icon: GitBranch, label: "Source Control", key: "Ctrl+Shift+G" },
  { id: "run", icon: Play, label: "Run and Debug", key: "Ctrl+Shift+D" },
  { id: "extensions", icon: Blocks, label: "Extensions", key: "Ctrl+Shift+X" },
];

function Btn({ label, active, onClick, children, badge }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode; badge?: number }) {
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          onClick={onClick}
          className={cn(
            "relative flex h-11 w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
            active && "text-foreground before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:rounded-r before:bg-primary",
          )}
        >
          {children}
          {!!badge && (
            <span className="absolute right-2 bottom-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9.5px] font-semibold text-primary-foreground">
              {badge}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ActivityBar() {
  const ide = useIde();
  return (
    <nav className="flex w-12 shrink-0 flex-col justify-between border-r bg-ide-activity py-1">
      <div>
        {items.map(({ id, icon: Icon, label, key }) => (
          <Btn
            key={id}
            label={`${label} (${key})`}
            active={ide.sidebarOpen && ide.sidebarView === id}
            onClick={() => ide.showView(id)}
            badge={id === "scm" ? ide.changes.length : undefined}
          >
            <Icon className="h-[21px] w-[21px]" strokeWidth={1.5} />
          </Btn>
        ))}
      </div>
      <div>
        <Btn label="Account" onClick={() => ide.log("Signed in as developer@kiln.dev")}>
          <CircleUser className="h-[21px] w-[21px]" strokeWidth={1.5} />
        </Btn>
        <Btn label="Settings (Ctrl+,)" onClick={() => ide.openFile(SETTINGS_TAB)}>
          <Settings className="h-[21px] w-[21px]" strokeWidth={1.5} />
        </Btn>
      </div>
    </nav>
  );
}
