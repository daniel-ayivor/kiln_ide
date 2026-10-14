export interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface IdeAPI {
  selectFolder: () => Promise<string | null>;
  readDirectory: (folderPath: string) => Promise<FileNode[] | { error: string }>;
}

declare global {
  interface Window {
    ideAPI: IdeAPI;
  }
}
