import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, type FSWatcher } from 'fs';
import { fileURLToPath } from 'url';
import * as fsSync from 'fs';
import * as pty from 'node-pty';
import * as os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Packaged apps start in a system folder (e.g. C:\Windows\system32), so start with no folder open.
let workspaceRoot: string | null = app.isPackaged ? null : process.cwd();
let watcher: FSWatcher | null = null;
let mainWindow: BrowserWindow | null = null;
let ptyProcess: pty.IPty | null = null;

// --- Persistent PTY Terminal Session Setup ---
function createPtySession() {
  if (ptyProcess) return;

  const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';

  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: workspaceRoot ?? os.homedir(),
    env: process.env as { [key: string]: string },
  });

  ptyProcess.onData((data: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-incoming-data', data);
    }
  });

  ptyProcess.onExit(() => {
    ptyProcess = null;
  });
}

const createWindow = async () => {
  let preloadPath = path.join(__dirname, 'preload.js');
  if (!fsSync.existsSync(preloadPath)) {
    preloadPath = path.join(__dirname, 'preload.cjs');
  }

  // Packaged: icons are copied next to the app via extraResources (not inside the asar).
  const iconFile = 'icon.png';
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, iconFile)
    : path.join(__dirname, '../resources', iconFile);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  if (!app.isPackaged) {
    // Development: Vite dev server
    mainWindow.loadURL('http://localhost:8082');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: the Vite build output (outDir: "dist") packed inside the app
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    if (!fsSync.existsSync(indexPath)) {
      dialog.showErrorBox('Kiln failed to start', `Missing build output:\n${indexPath}`);
    } else {
      await mainWindow.loadFile(indexPath);
    }
    // Remove once everything works:
    mainWindow.webContents.openDevTools();
  }

  createPtySession();
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

export async function searchExtensions(query: string = ''): Promise<VsxExtension[]> {
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
      description: ext.description || 'No description provided.',
      iconUrl: ext.files?.icon,
      downloadCount: ext.downloadCount || 0,
      averageRating: ext.averageRating,
      files: ext.files,
    }));
  } catch (error) {
    console.warn('Open VSX fetch failed, using fallback extensions:', error);
    return getFallbackExtensions(query);
  }
}

function getFallbackExtensions(query: string): VsxExtension[] {
  const defaults: VsxExtension[] = [
    { namespace: 'esbenp', name: 'prettier-vscode', version: '10.0.0', displayName: 'Prettier', description: 'Opinionated code formatter', downloadCount: 48000000, averageRating: 4.8, files: {} },
    { namespace: 'dbaeumer', name: 'vscode-eslint', version: '2.4.0', displayName: 'ESLint', description: 'Integrates ESLint into the editor', downloadCount: 32000000, averageRating: 4.6, files: {} },
    { namespace: 'eamodio', name: 'gitlens', version: '14.0.0', displayName: 'GitLens', description: 'Supercharge Git inside your editor', downloadCount: 29000000, averageRating: 4.7, files: {} },
    { namespace: 'bradlc', name: 'vscode-tailwindcss', version: '0.10.0', displayName: 'Tailwind CSS IntelliSense', description: 'Autocomplete and linting for Tailwind CSS', downloadCount: 11000000, averageRating: 4.9, files: {} },
  ];

  if (!query.trim()) return defaults;

  return defaults.filter((e) => {
    const title = e.displayName ?? e.name;
    const desc = e.description ?? '';
    return (title + ' ' + desc + ' ' + e.name).toLowerCase().includes(query.toLowerCase());
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

const IGNORED = new Set(['node_modules', '.git', 'dist', 'dist-electron', '.output']);

async function buildTree(dirPath: string, parentId: string | null, out: Record<string, FsNodeItem>) {
  let entries: fsSync.Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return; // unreadable folder (EPERM etc.): skip it
  }
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
  const root = workspaceRoot;
  if (!root) return;
  try {
    watcher = watch(root, { recursive: true }, (eventType, filename) => {
      if (!filename || !mainWindow || mainWindow.isDestroyed()) return;
      const id = path.join(root, filename);
      mainWindow.webContents.send('kiln:fileChanged', {
        id,
        kind: eventType === 'rename' ? 'created' : 'changed',
      });
    });
  } catch {}
}

ipcMain.handle('kiln:loadWorkspace', async () => {
  if (!workspaceRoot) {
    return {
      root: { id: 'root', name: 'No folder open', type: 'folder', parentId: null },
    } as Record<string, FsNodeItem>;
  }
  const nodes: Record<string, FsNodeItem> = {
    root: { id: 'root', name: path.basename(workspaceRoot), type: 'folder', parentId: null },
  };
  await buildTree(workspaceRoot, 'root', nodes);
  startWatching();
  return nodes;
});

ipcMain.handle('kiln:openNewWindow', async () => {
  await createWindow();
});

// --- Terminal IPC Handlers ---
ipcMain.on('terminal-write', (_event, data) => {
  if (!ptyProcess) createPtySession();
  ptyProcess?.write(data);
});

ipcMain.handle('kiln:exec', async (_event, { input }) => {
  if (!ptyProcess) createPtySession();
  ptyProcess?.write(input + '\r');
  return { lines: [] };
});

// --- Open VSX Extensions Search Handler ---
ipcMain.handle('kiln:searchExtensions', async (_event, query: string = '') => {
  console.log('[Main Process] Received search query:', query);
  const results = await searchExtensions(query);
  console.log('[Main Process] Returning results count:', results.length);
  return results;
});

ipcMain.handle('kiln:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  workspaceRoot = result.filePaths[0];

  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }
  createPtySession();

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

app.whenReady().then(() => {
  app.setAppUserModelId('com.kiln.ide');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  watcher?.close();
  ptyProcess?.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});