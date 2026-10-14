import type { FsNode } from "../types";

/**
 * Platform seam — every OS capability the workbench needs goes through these
 * interfaces. The browser build uses the mock implementation in ./browser.ts;
 * an Electron build injects `window.kilnBridge` from the preload script and
 * getPlatform() (./index.ts) returns it instead. No component changes needed.
 */

export type TermLine = { kind: "in" | "out" | "err" | "ok"; text: string };

export type ShellContext = {
  cwd: string;
  nodes: Record<string, FsNode>;
  branch: string;
  changes: { id: string; status: "M" | "U" | "D" }[];
  createNode: (parentId: string, type: "file" | "folder") => void;
  log: (line: string, channel?: string) => void;
};

export type ShellResult = { lines: TermLine[]; cwd?: string; clear?: boolean };

export interface KilnFileSystem {
  /** Initial workspace tree. Sync in the browser; may be async in Electron. */
  loadWorkspace(): Record<string, FsNode>;
}

export interface KilnShell {
  /** Execute one command line. Returns output lines and an optional new cwd. */
  exec(input: string, ctx: ShellContext): ShellResult;
}

export interface KilnWindowControls {
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
}

export interface KilnPlatform {
  kind: "browser" | "electron";
  capabilities: {
    realFileSystem: boolean;
    realTerminal: boolean;
    windowControls: boolean;
  };
  fs: KilnFileSystem;
  shell: KilnShell;
  /** Native window controls. Absent in the browser; the Electron bridge provides it. */
  window?: KilnWindowControls;
}

/** Shape an Electron preload script should expose on `window`. */
declare global {
  interface Window {
    kilnBridge?: KilnPlatform;
  }
}
