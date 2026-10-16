export interface FsNodeItem {
  id: string; // Absolute path
  name: string;
  type: 'file' | 'folder';
  children?: FsNodeItem[];
}

export interface IdeAPI {
  selectFolder: () => Promise<string | null>;
  readDirectory: (folderPath: string) => Promise<{ success: boolean; files?: FsNodeItem[]; error?: string }>;
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
}

export interface ElectronAPI {
  setTitle: (title: string) => void;
}

declare global {
  interface Window {
    ideAPI: IdeAPI;
    electronAPI: ElectronAPI;
  }
}
