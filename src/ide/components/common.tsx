import { useEffect, useRef, type ReactNode } from "react";
import { useIde } from "../store";
import { cn } from "@/lib/utils";

export function ContextMenuLayer() {
  const { menu, setMenu } = useIde();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
    };
  }, [menu, setMenu]);
  if (!menu) return null;
  const x = Math.min(menu.x, window.innerWidth - 230);
  const y = Math.min(menu.y, window.innerHeight - menu.items.length * 28 - 16);
  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed z-50 min-w-[210px] animate-in fade-in-0 zoom-in-95 rounded-md border bg-popover p-1 text-popover-foreground shadow-xl duration-100"
      style={{ left: x, top: y }}
    >
      {menu.items.map((item, i) =>
        "separator" in item ? (
          <div key={i} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={i}
            onClick={() => {
              setMenu(null);
              item.onClick();
            }}
            className={cn(
              "flex w-full items-center justify-between gap-6 rounded-sm px-2.5 py-1 text-left text-[12.5px] hover:bg-primary hover:text-primary-foreground",
              item.danger && "text-destructive",
            )}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="text-[11px] opacity-60">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

export function Resizer({
  direction,
  onResize,
}: {
  direction: "x" | "y";
  onResize: (delta: number) => void;
}) {
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    let last = direction === "x" ? e.clientX : e.clientY;
    const move = (ev: PointerEvent) => {
      const cur = direction === "x" ? ev.clientX : ev.clientY;
      onResize(cur - last);
      last = cur;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = direction === "x" ? "col-resize" : "row-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div
      onPointerDown={start}
      className={cn(
        "relative z-10 shrink-0 transition-colors hover:bg-primary/60",
        direction === "x" ? "-mx-[2px] w-[4px] cursor-col-resize" : "-my-[2px] h-[4px] cursor-row-resize",
      )}
    />
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-muted-foreground">
      <div className="opacity-60">{icon}</div>
      <div className="text-[12.5px] font-medium text-foreground/80">{title}</div>
      {children && <div className="text-[12px]">{children}</div>}
    </div>
  );
}

export function SectionHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="truncate">{title}</span>
      <div className="flex items-center gap-0.5">{actions}</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
      {children}
    </kbd>
  );
}
