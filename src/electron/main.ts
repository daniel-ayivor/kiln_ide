import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, type FSWatcher } from 'fs';
import { exec as execCb } from 'child_process';
import { fileURLToPath } from 'url';
import * as fsSync from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let workspaceRoot = process.cwd();
let watcher: FSWatcher | null = null;
let mainWindow: BrowserWindow | null = null;

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:8082';

const createWindow = () => {
  let preloadPath = path.join(__dirname, 'preload.js');
  if (!fsSync.existsSync(preloadPath)) {
    preloadPath = path.join(__dirname, 'preload.cjs');
  }

  console.log('[Electron Main] Preload script path:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.on('did-fail-load', () => mainWindow?.loadURL(DEV_SERVER_URL));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

type VsxExtension = {
  namespace: string;
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  iconUrl?: string;
  downloadCount: number;
  averageRating?: number;
  files: any;
};

export async function searchExtensions(query: string = ""): Promise<VsxExtension[]> {
  try {
    const url = `https://open-vsx.org/api/-/search?query=${encodeURIComponent(query)}&size=20`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open VSX API error: ${res.statusText}`);
    const data = await res.json();
    
    if (!data.extensions || data.extensions.length === 0) {
      return getFallbackExtensions(query);
    }

    return data.extensions.map((ext: any) => ({
      namespace: ext.namespace,
      name: ext.name,
      version: ext.version,
      displayName: ext.displayName || ext.name,
      description: ext.description || "No description provided.",
      iconUrl: ext.files?.icon,
      downloadCount: ext.downloadCount || 0,
      averageRating: ext.averageRating,
      files: ext.files,
    }));
  } catch (error) {
    console.warn("Open VSX fetch failed, using fallback extensions:", error);
    return getFallbackExtensions(query);
  }
}

function getFallbackExtensions(query: string): VsxExtension[] {
  const defaults: VsxExtension[] = [
    { namespace: "esbenp", name: "prettier-vscode", version: "10.0.0", displayName: "Prettier", description: "Opinionated code formatter", downloadCount: 48000000, averageRating: 4.8, files: {} },
    { namespace: "dbaeumer", name: "vscode-eslint", version: "2.4.0", displayName: "ESLint", description: "Integrates ESLint into the editor", downloadCount: 32000000, averageRating: 4.6, files: {} },
    { namespace: "eamodio", name: "gitlens", version: "14.0.0", displayName: "GitLens", description: "Supercharge Git inside your editor", downloadCount: 29000000, averageRating: 4.7, files: {} },
    { namespace: "bradlc", name: "vscode-tailwindcss", version: "0.10.0", displayName: "Tailwind CSS IntelliSense", description: "Autocomplete and linting for Tailwind CSS", downloadCount: 11000000, averageRating: 4.9, files: {} },
  ];
  
  if (!query.trim()) return defaults;

  return defaults.filter((e) => {
    const title = e.displayName ?? e.name;
    const desc = e.description ?? "";
    return (title + " " + desc + " " + e.name).toLowerCase().includes(query.toLowerCase());
  });
}






// --- Window controls (frameless window) ---
ipcMain.on('kiln:minimize', () => mainWindow?.minimize());
ipcMain.on('kiln:toggleMaximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('kiln:close', () => mainWindow?.close());

// --- File system handlers ---
type FsNodeItem = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  content?: string;
};

const IGNORED = new Set(['node_modules', '.git', 'dist', 'dist-electron']);

async function buildTree(dirPath: string, parentId: string | null, out: Record<string, FsNodeItem>) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const absolutePath = path.join(dirPath, entry.name);
    const isDirectory = entry.isDirectory();
    const node: FsNodeItem = {
      id: absolutePath,
      name: entry.name,
      type: isDirectory ? 'folder' : 'file',
      parentId,
    };
    if (!isDirectory) {
      try {
        node.content = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        node.content = '';
      }
    }
    out[absolutePath] = node;
    if (isDirectory) await buildTree(absolutePath, absolutePath, out);
  }
}

function startWatching() {
  watcher?.close();
  watcher = null;
  try {
    watcher = watch(workspaceRoot, { recursive: true }, (eventType, filename) => {
      if (!filename || !mainWindow) return;
      const id = path.join(workspaceRoot, filename);
      mainWindow.webContents.send('kiln:fileChanged', {
        id,
        kind: eventType === 'rename' ? 'created' : 'changed',
      });
    });
  } catch {}
}

ipcMain.handle('kiln:loadWorkspace', async () => {
  const nodes: Record<string, FsNodeItem> = {
    root: { id: 'root', name: path.basename(workspaceRoot), type: 'folder', parentId: null },
  };
  await buildTree(workspaceRoot, 'root', nodes);
  startWatching();
  return nodes;
});

ipcMain.handle('kiln:openNewWindow', () => {
  createWindow();
});


// --- Open VSX Extensions Search Handler ---
ipcMain.handle('kiln:searchExtensions', async (_event, query: string = "") => {
  console.log('[Main Process] Received search query:', query);
  const results = await searchExtensions(query);
  console.log('[Main Process] Returning results count:', results.length);
  return results;
});

ipcMain.handle('kiln:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  workspaceRoot = result.filePaths[0];
  return workspaceRoot;
});

ipcMain.handle('kiln:readFile', async (_event, filePath: string) => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
});

ipcMain.handle('kiln:saveFile', async (_event, { id, content }: { id: string; content: string }) => {
  try {
    await fs.writeFile(id, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


// --- Real terminal ---
ipcMain.handle('kiln:exec', (_event, { input, cwd }: { input: string; cwd: string }) => {
  const dir = cwd === '~' || !cwd ? workspaceRoot : cwd;
  return new Promise((resolve) => {
    execCb(input, { cwd: dir, timeout: 30_000 }, (error, stdout, stderr) => {
      const lines: { kind: string; text: string }[] = [{ kind: 'in', text: input }];
      if (stdout) stdout.trimEnd().split('\n').forEach((l) => lines.push({ kind: 'out', text: l }));
      if (stderr) stderr.trimEnd().split('\n').forEach((l) => lines.push({ kind: 'err', text: l }));
      if (error && !stderr) lines.push({ kind: 'err', text: error.message });
      resolve({ lines });
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  watcher?.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});