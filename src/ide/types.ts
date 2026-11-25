export type FsNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  parentId: string | null;
  content?: string;
};

export type SidebarView = "explorer" | "search" | "scm" | "run" | "extensions";
export type PanelView = "terminal" | "problems" | "output" | "debug";

export const SETTINGS_TAB = "__settings__";
export const PROFILE_TAB = "__profile__";
export const SYNC_TAB = "__sync__";
export const UPDATES_TAB = "__updates__";

export type EditorGroup = { id: string; tabs: string[]; active: string | null };

export type Settings = {
  theme: "dark" | "light" | "hc-dark" | "hc-light" | "system";
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
};

export type Problem = {
  fileId: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning" | "info";
};

export type MenuItem =
  | { label: string; shortcut?: string; onClick: () => void; danger?: boolean }
  | { separator: true };
