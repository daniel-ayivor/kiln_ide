

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, type FSWatcher } from 'fs';
import { fileURLToPath } from 'url';
import * as fsSync from 'fs';
import * as pty from 'node-pty';
import * as os from 'os';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import { initAutoUpdater } from './updater';   // with the other imports

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env ourselves: `electron --env-file` is not reliably honored.
// Existing environment variables are not overridden.
try {
  const envPath = path.join(app.getAppPath(), '.env');
  (process as any).loadEnvFile(envPath);
  console.log('[env] loaded', envPath);
} catch (e: any) {
  console.warn('[env] could not load .env:', e?.message);
}

// Packaged apps start in a system folder (e.g. C:\Windows\system32), so start with no folder open.
let workspaceRoot: string | null = app.isPackaged ? null : process.cwd();
let watcher: FSWatcher | null = null;
let mainWindow: BrowserWindow | null = null;
let ptyProcess: pty.IPty | null = null;
let terminalCwd: string = workspaceRoot ?? os.homedir();

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
    mainWindow.loadURL('http://localhost:8082');
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    if (!fsSync.existsSync(indexPath)) {
      dialog.showErrorBox('Kiln failed to start', `Missing build output:\n${indexPath}`);
    } else {
      await mainWindow.loadFile(indexPath);
    }
  }

  createPtySession();
  initAutoUpdater();
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

const IGNORED = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  '.output',
  '.vite',
  '.next',
  '.cache',
  'coverage',
]);

const MAX_PRELOAD_BYTES = 512 * 1024; // 512 KB cap per file during initial tree scan
const MAX_TREE_FILES = 3000;

function isIgnoredPath(relPath: string): boolean {
  const segments = relPath.split(/[\\/]/);
  return segments.some((seg) => IGNORED.has(seg));
}

async function buildTree(
  dirPath: string,
  parentId: string | null,
  out: Record<string, FsNodeItem>,
  counter = { files: 0 },
) {
  if (counter.files >= MAX_TREE_FILES) return;

  let entries: fsSync.Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (counter.files >= MAX_TREE_FILES) break;
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
      counter.files++;
      try {
        const stat = await fs.stat(absolutePath);
        if (stat.size <= MAX_PRELOAD_BYTES) {
          node.content = await fs.readFile(absolutePath, 'utf-8');
        } else {
          node.content = ''; // Large files load on-demand via kiln:readFile
        }
      } catch {
        node.content = '';
      }
    }

    out[absolutePath] = node;
    if (isDirectory) await buildTree(absolutePath, absolutePath, out, counter);
  }
}

const pendingWatchTimers = new Map<string, NodeJS.Timeout>();

function startWatching() {
  watcher?.close();
  watcher = null;
  for (const t of pendingWatchTimers.values()) clearTimeout(t);
  pendingWatchTimers.clear();

  const root = workspaceRoot;
  if (!root) return;

  try {
    watcher = watch(root, { recursive: true }, (eventType, filename) => {
      if (!filename || !mainWindow || mainWindow.isDestroyed()) return;
      if (isIgnoredPath(filename)) return;

      const id = path.join(root, filename);
      const existing = pendingWatchTimers.get(id);
      if (existing) clearTimeout(existing);

      pendingWatchTimers.set(
        id,
        setTimeout(() => {
          pendingWatchTimers.delete(id);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('kiln:fileChanged', {
              id,
              kind: eventType === 'rename' ? 'created' : 'changed',
            });
          }
        }, 250),
      );
    });
  } catch {}
}

let activeLoadPromise: Promise<Record<string, FsNodeItem>> | null = null;

ipcMain.handle('kiln:loadWorkspace', async () => {
  if (!workspaceRoot) {
    return {
      root: { id: 'root', name: 'No folder open', type: 'folder', parentId: null },
    } as Record<string, FsNodeItem>;
  }

  if (activeLoadPromise) return activeLoadPromise;

  activeLoadPromise = (async () => {
    try {
      const nodes: Record<string, FsNodeItem> = {
        root: { id: 'root', name: path.basename(workspaceRoot!), type: 'folder', parentId: null },
      };
      await buildTree(workspaceRoot!, 'root', nodes);
      startWatching();
      return nodes;
    } finally {
      activeLoadPromise = null;
    }
  })();

  return activeLoadPromise;
});

ipcMain.handle('kiln:openNewWindow', async () => {
  await createWindow();
});

// --- Terminal IPC Handlers ---
ipcMain.on('terminal-write', (_event, data) => {
  if (!ptyProcess) createPtySession();
  ptyProcess?.write(data);
});

ipcMain.on('kiln:syncTerminalCwd', (_event, cwd: string) => {
  if (cwd && fsSync.existsSync(cwd)) {
    terminalCwd = cwd;
  }
});

ipcMain.handle('kiln:completePath', async (_event, { partial, dirsOnly }: { partial: string; dirsOnly: boolean }) => {
  try {
    const unquoted = partial.replace(/^["']/, '');
    const endsWithSep = /[\\/]$/.test(unquoted);

    let searchDir: string;
    let prefix: string;

    if (!unquoted) {
      searchDir = terminalCwd;
      prefix = '';
    } else if (endsWithSep) {
      searchDir = path.resolve(terminalCwd, unquoted);
      prefix = '';
    } else {
      const resolved = path.resolve(terminalCwd, unquoted);
      searchDir = path.dirname(resolved);
      prefix = path.basename(resolved).toLowerCase();
    }

    const entries = await fs.readdir(searchDir, { withFileTypes: true });
    const matches = entries
      .filter((e) => {
        if (dirsOnly && !e.isDirectory()) return false;
        return e.name.toLowerCase().startsWith(prefix);
      })
      .map((e) => {
        const baseDir = endsWithSep
          ? unquoted
          : unquoted.includes('/') || unquoted.includes('\\')
            ? unquoted.slice(0, Math.max(unquoted.lastIndexOf('/'), unquoted.lastIndexOf('\\')) + 1)
            : '';
        const full = `${baseDir}${e.name}${e.isDirectory() ? '\\' : ''}`;
        return full.includes(' ') ? `"${full}"` : full;
      })
      .sort((a, b) => a.localeCompare(b));

    return matches;
  } catch {
    return [];
  }
});

// --- AI Chat Configuration & Streaming ---
const aiConfigPath = path.join(app.getPath('userData'), 'kiln-ai.json');

async function getAiSettings(): Promise<{ apiKey: string; baseURL?: string; model: string }> {
  const envKey = (
    process.env.VITE_AI ||
    process.env.GROQ_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  ).trim();

  const isGroqKey = envKey.startsWith('gsk_') || Boolean(process.env.GROQ_API_KEY);
  const isXaiKey = !isGroqKey && (envKey.startsWith('xai-') || Boolean(process.env.XAI_API_KEY));

  const envBaseURL =
    process.env.OPENAI_BASE_URL ||
    (isGroqKey ? 'https://api.groq.com/openai/v1' : isXaiKey ? 'https://api.x.ai/v1' : undefined);

  const defaultModel = isGroqKey
    ? 'openai/gpt-oss-120b'
    : isXaiKey
      ? 'grok-3-mini'
      : 'gpt-4o-mini';

  try {
    const raw = await fs.readFile(aiConfigPath, 'utf-8');
    const saved = JSON.parse(raw);
    return {
      apiKey: (saved.apiKey || envKey).trim(),
      baseURL: saved.baseURL || envBaseURL,
      model: saved.model || defaultModel,
    };
  } catch {
    return {
      apiKey: envKey,
      baseURL: envBaseURL,
      model: defaultModel,
    };
  }
}

ipcMain.handle('kiln:getAiConfig', async () => {
  const cfg = await getAiSettings();
  return { hasKey: Boolean(cfg.apiKey), baseURL: cfg.baseURL ?? '', model: cfg.model };
});

ipcMain.handle('kiln:saveAiConfig', async (_event, payload: { apiKey: string; baseURL?: string; model?: string }) => {
  const current = await getAiSettings();
  const nextKey = payload.apiKey.trim() || current.apiKey;
  const fallbackModel = nextKey.startsWith('gsk_')
    ? 'openai/gpt-oss-120b'
    : nextKey.startsWith('xai-')
      ? 'grok-3-mini'
      : 'gpt-4o-mini';

  const next = {
    apiKey: nextKey,
    baseURL: payload.baseURL?.trim() || undefined,
    model: payload.model?.trim() || current.model || fallbackModel,
  };
  await fs.writeFile(aiConfigPath, JSON.stringify(next, null, 2), 'utf-8');
  return { hasKey: Boolean(next.apiKey), baseURL: next.baseURL ?? '', model: next.model };
});

const activeAiStreams = new Map<string, AbortController>();

ipcMain.on('kiln:aiAbort', (_event, streamId: string) => {
  activeAiStreams.get(streamId)?.abort();
  activeAiStreams.delete(streamId);
});

ipcMain.on('kiln:aiChat', async (event, { streamId, messages, snippet }: { streamId: string; messages: any[]; snippet?: any }) => {
  const abortController = new AbortController();
  activeAiStreams.set(streamId, abortController);

  try {
    const cfg = await getAiSettings();
    const k = (cfg.apiKey || '').trim();
    console.log('[kiln:aiChat cfg]', {
      hasKey: Boolean(k),
      len: k.length,
      baseURL: cfg.baseURL,
      model: cfg.model,
      configPath: aiConfigPath,
      configExists: fsSync.existsSync(aiConfigPath),
    });

    if (!k) {
      event.sender.send(`kiln:aiError:${streamId}`, 'Missing API key. Click the gear icon in Kiln Chat to add your API key.');
      return;
    }

    const provider = createOpenAI({
      apiKey: k,
      ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
    });

    const systemPrompt = [
      'You are Kiln, a concise, expert coding assistant embedded inside the Kiln desktop IDE.',
      'Provide clear explanations and clean, copy-ready code blocks with language tags.',
      snippet?.file ? `The user is asking about file "${snippet.file}" (${snippet.language || 'code'}).` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const languageModel = cfg.baseURL ? provider.chat(cfg.model) : provider(cfg.model);

    const result = streamText({
      model: languageModel,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      abortSignal: abortController.signal,
    });

    // Stream AI SDK UIMessage chunks directly back to DefaultChatTransport
    const response = result.toUIMessageStreamResponse();
    const reader = response.body?.getReader();
    if (!reader) {
      event.sender.send(`kiln:aiEnd:${streamId}`);
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && !event.sender.isDestroyed()) {
        event.sender.send(`kiln:aiChunk:${streamId}`, value);
      }
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send(`kiln:aiEnd:${streamId}`);
    }
  } catch (err: any) {
    console.error('[kiln:aiChat error]', err);
    if (err?.name !== 'AbortError' && !event.sender.isDestroyed()) {
      const detail = err?.cause?.message ? `${err.message} (${err.cause.message})` : err?.message;
      event.sender.send(`kiln:aiError:${streamId}`, detail || 'AI request failed.');
    }
  } finally {
    activeAiStreams.delete(streamId);
  }
});

ipcMain.handle('kiln:exec', async (_event, { input }) => {
  if (!ptyProcess) createPtySession();
  ptyProcess?.write(input + '\r');
  return { lines: [] };
});

// --- Open VSX Extensions Search Handler ---
ipcMain.handle('kiln:searchExtensions', async (_event, query: string = '') => {
  return await searchExtensions(query);
});

ipcMain.handle('kiln:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  workspaceRoot = result.filePaths[0];
  terminalCwd = workspaceRoot;

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