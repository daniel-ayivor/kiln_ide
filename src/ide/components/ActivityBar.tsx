import { Files, Search, GitBranch, Play, Blocks, Settings, CircleUser, MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIde } from "../store";
import { SETTINGS_TAB, type SidebarView } from "../types";
import { cn } from "@/lib/utils";
import { useAccount } from "../auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getCommands } from "../commands";
import { toast } from "sonner";

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
        <Button variant="ghost"
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
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ActivityBar({ chatOpen, onChat }: { chatOpen: boolean; onChat: () => void }) {
  const ide = useIde();
  const { user, signIn, signOut, openProfile } = useAccount();
  const run = (id: string) => getCommands(ide).find((c) => c.id === id)?.run();
  const display = user?.name || "";
  const initials = String(display).split(/[\s@]+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
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
        <Btn label="AI Chat" active={chatOpen} onClick={onChat}><MessageSquare className="h-[21px] w-[21px]" strokeWidth={1.5} /></Btn>
      </div>
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" aria-label="Account" className="flex h-11 w-full items-center justify-center text-muted-foreground hover:text-foreground">
              {user ? <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{initials}</span> : <CircleUser className="h-[21px] w-[21px]" strokeWidth={1.5} />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="min-w-[230px]">
            {user ? <>
              <DropdownMenuLabel className="text-xs"><div className="font-semibold">{user.name}</div><div className="font-normal text-muted-foreground">{user.email} · {user.role}</div></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openProfile}>Edit Profile…</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Settings Sync is on (demo)")}>Backup and Sync Settings…</DropdownMenuItem>
              <DropdownMenuItem onClick={() => ide.setChatOpen(true)}>Open AI Chat</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>Sign Out</DropdownMenuItem>
            </> : <>
              <DropdownMenuItem onClick={signIn}>Sign in with demo account</DropdownMenuItem>
            </>}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" aria-label="Manage" className="flex h-11 w-full items-center justify-center text-muted-foreground hover:text-foreground">
              <Settings className="h-[21px] w-[21px]" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="min-w-[240px]">
            <DropdownMenuItem onClick={() => run("view.commandPalette")}>Command Palette…<DropdownMenuShortcut>Ctrl+Shift+P</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => ide.openFile(SETTINGS_TAB)}>Settings<DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("view.extensions")}>Extensions<DropdownMenuShortcut>Ctrl+Shift+X</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("help.shortcuts")}>Keyboard Shortcuts</DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("theme.toggle")}>Toggle Color Theme</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => run("help.updates")}>Check for Updates…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
