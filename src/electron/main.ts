import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, type FSWatcher } from 'fs';
import { exec as execCb } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Workspace root: the folder the user picked, or the app directory by default.
let workspaceRoot = process.cwd();
let watcher: FSWatcher | null = null;
let mainWindow: BrowserWindow | null = null;

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:8082';

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.on('did-fail-load', () => mainWindow?.loadURL(DEV_SERVER_URL));
  } else {
    // Packaged build: load the built UI from disk (requires vite base: './').
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

// --- Window controls (frameless window) ---

ipcMain.on('kiln:minimize', () => mainWindow?.minimize());
ipcMain.on('kiln:toggleMaximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('kiln:close', () => mainWindow?.close());

// --- File system handlers (kilnBridge.fs) ---

type FsNodeItem = {
  id: string; // absolute path
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
        node.content = ''; // binary or unreadable file
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
  } catch {
    // Recursive watch unsupported on this platform — file watching disabled.
  }
}

ipcMain.handle('kiln:loadWorkspace', async () => {
  const nodes: Record<string, FsNodeItem> = {
    root: { id: 'root', name: path.basename(workspaceRoot), type: 'folder', parentId: null },
  };
  await buildTree(workspaceRoot, 'root', nodes);
  startWatching();
  return nodes;
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

// --- Real terminal (kilnBridge.shell) ---

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
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  watcher?.close();
  if (process.platform !== 'darwin') app.quit();
});
