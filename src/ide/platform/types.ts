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

/** Notification that a file changed outside the editor (e.g. fs.watch). */
export type FileChangeEvent = { id: string; kind: "changed" | "created" | "deleted" };

export interface KilnFileSystem {
  /**
   * Initial workspace tree. Sync in the browser; may be async in Electron
   * (IPC round-trip), so callers must handle a Promise.
   */
  loadWorkspace(): Record<string, FsNode> | Promise<Record<string, FsNode>>;
  /**
   * Persist a file's content. The browser build writes to localStorage;
   * the Electron build writes to the real file on disk. Called on Save,
   * Save All, and auto-save.
   */
  saveFile(id: string, content: string): void | Promise<void>;
  /**
   * Subscribe to file changes made outside the editor (another program
   * editing the file on disk). Returns an unsubscribe function. Optional:
   * the browser build has no external changes to report.
   */
  onFileChange?(cb: (e: FileChangeEvent) => void): () => void;
  /**
   * Read the current content of one file. Used to refresh a file after an
   * external "changed" event. Optional in the browser (content is in memory).
   */
  readFile?(id: string): Promise<string | null>;
  /** Native folder picker. Electron only; absent in the browser. */
  openFolder?(): Promise<string | null>;
}

export interface KilnShell {
  /** Execute one command line. Returns output lines and an optional new cwd. */
  exec(input: string, ctx: ShellContext): ShellResult | Promise<ShellResult>;
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
