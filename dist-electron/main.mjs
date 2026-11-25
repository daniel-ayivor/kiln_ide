// src/electron/main.ts
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import { watch } from "fs";
import { fileURLToPath } from "url";
import * as fsSync from "fs";
import * as pty from "node-pty";
import * as os from "os";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var workspaceRoot = app.isPackaged ? null : process.cwd();
var watcher = null;
var mainWindow = null;
var ptyProcess = null;
var terminalCwd = workspaceRoot ?? os.homedir();
function createPtySession() {
  if (ptyProcess) return;
  const shell = os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "bash";
  ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: workspaceRoot ?? os.homedir(),
    env: process.env
  });
  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("terminal-incoming-data", data);
    }
  });
  ptyProcess.onExit(() => {
    ptyProcess = null;
  });
}
var createWindow = async () => {
  let preloadPath = path.join(__dirname, "preload.js");
  if (!fsSync.existsSync(preloadPath)) {
    preloadPath = path.join(__dirname, "preload.cjs");
  }
  const iconFile = "icon.png";
  const iconPath = app.isPackaged ? path.join(process.resourcesPath, iconFile) : path.join(__dirname, "../resources", iconFile);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });
  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:8082");
  } else {
    const indexPath = path.join(app.getAppPath(), "dist", "index.html");
    if (!fsSync.existsSync(indexPath)) {
      dialog.showErrorBox("Kiln failed to start", `Missing build output:
${indexPath}`);
    } else {
      await mainWindow.loadFile(indexPath);
    }
  }
  createPtySession();
};
async function searchExtensions(query = "") {
  try {
    const url = `https://open-vsx.org/api/-/search?query=${encodeURIComponent(query)}&size=20`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open VSX API error: ${res.statusText}`);
    const data = await res.json();
    if (!data.extensions || data.extensions.length === 0) {
      return getFallbackExtensions(query);
    }
    return data.extensions.map((ext) => ({
      namespace: ext.namespace,
      name: ext.name,
      version: ext.version,
      displayName: ext.displayName || ext.name,
      description: ext.description || "No description provided.",
      iconUrl: ext.files?.icon,
      downloadCount: ext.downloadCount || 0,
      averageRating: ext.averageRating,
      files: ext.files
    }));
  } catch (error) {
    console.warn("Open VSX fetch failed, using fallback extensions:", error);
    return getFallbackExtensions(query);
  }
}
function getFallbackExtensions(query) {
  const defaults = [
    { namespace: "esbenp", name: "prettier-vscode", version: "10.0.0", displayName: "Prettier", description: "Opinionated code formatter", downloadCount: 48e6, averageRating: 4.8, files: {} },
    { namespace: "dbaeumer", name: "vscode-eslint", version: "2.4.0", displayName: "ESLint", description: "Integrates ESLint into the editor", downloadCount: 32e6, averageRating: 4.6, files: {} },
    { namespace: "eamodio", name: "gitlens", version: "14.0.0", displayName: "GitLens", description: "Supercharge Git inside your editor", downloadCount: 29e6, averageRating: 4.7, files: {} },
    { namespace: "bradlc", name: "vscode-tailwindcss", version: "0.10.0", displayName: "Tailwind CSS IntelliSense", description: "Autocomplete and linting for Tailwind CSS", downloadCount: 11e6, averageRating: 4.9, files: {} }
  ];
  if (!query.trim()) return defaults;
  return defaults.filter((e) => {
    const title = e.displayName ?? e.name;
    const desc = e.description ?? "";
    return (title + " " + desc + " " + e.name).toLowerCase().includes(query.toLowerCase());
  });
}
ipcMain.on("kiln:minimize", () => mainWindow?.minimize());
ipcMain.on("kiln:toggleMaximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("kiln:close", () => mainWindow?.close());
var IGNORED = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-electron",
  ".output",
  ".vite",
  ".next",
  ".cache",
  "coverage"
]);
var MAX_PRELOAD_BYTES = 512 * 1024;
var MAX_TREE_FILES = 3e3;
function isIgnoredPath(relPath) {
  const segments = relPath.split(/[\\/]/);
  return segments.some((seg) => IGNORED.has(seg));
}
async function buildTree(dirPath, parentId, out, counter = { files: 0 }) {
  if (counter.files >= MAX_TREE_FILES) return;
  let entries;
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
    const node = {
      id: absolutePath,
      name: entry.name,
      type: isDirectory ? "folder" : "file",
      parentId
    };
    if (!isDirectory) {
      counter.files++;
      try {
        const stat2 = await fs.stat(absolutePath);
        if (stat2.size <= MAX_PRELOAD_BYTES) {
          node.content = await fs.readFile(absolutePath, "utf-8");
        } else {
          node.content = "";
        }
      } catch {
        node.content = "";
      }
    }
    out[absolutePath] = node;
    if (isDirectory) await buildTree(absolutePath, absolutePath, out, counter);
  }
}
var pendingWatchTimers = /* @__PURE__ */ new Map();
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
            mainWindow.webContents.send("kiln:fileChanged", {
              id,
              kind: eventType === "rename" ? "created" : "changed"
            });
          }
        }, 250)
      );
    });
  } catch {
  }
}
var activeLoadPromise = null;
ipcMain.handle("kiln:loadWorkspace", async () => {
  if (!workspaceRoot) {
    return {
      root: { id: "root", name: "No folder open", type: "folder", parentId: null }
    };
  }
  if (activeLoadPromise) return activeLoadPromise;
  activeLoadPromise = (async () => {
    try {
      const nodes = {
        root: { id: "root", name: path.basename(workspaceRoot), type: "folder", parentId: null }
      };
      await buildTree(workspaceRoot, "root", nodes);
      startWatching();
      return nodes;
    } finally {
      activeLoadPromise = null;
    }
  })();
  return activeLoadPromise;
});
ipcMain.handle("kiln:openNewWindow", async () => {
  await createWindow();
});
ipcMain.on("terminal-write", (_event, data) => {
  if (!ptyProcess) createPtySession();
  ptyProcess?.write(data);
});
ipcMain.on("kiln:syncTerminalCwd", (_event, cwd) => {
  if (cwd && fsSync.existsSync(cwd)) {
    terminalCwd = cwd;
  }
});
ipcMain.handle("kiln:completePath", async (_event, { partial, dirsOnly }) => {
  try {
    const unquoted = partial.replace(/^["']/, "");
    const endsWithSep = /[\\/]$/.test(unquoted);
    let searchDir;
    let prefix;
    if (!unquoted) {
      searchDir = terminalCwd;
      prefix = "";
    } else if (endsWithSep) {
      searchDir = path.resolve(terminalCwd, unquoted);
      prefix = "";
    } else {
      const resolved = path.resolve(terminalCwd, unquoted);
      searchDir = path.dirname(resolved);
      prefix = path.basename(resolved).toLowerCase();
    }
    const entries = await fs.readdir(searchDir, { withFileTypes: true });
    const matches = entries.filter((e) => {
      if (dirsOnly && !e.isDirectory()) return false;
      return e.name.toLowerCase().startsWith(prefix);
    }).map((e) => {
      const baseDir = endsWithSep ? unquoted : unquoted.includes("/") || unquoted.includes("\\") ? unquoted.slice(0, Math.max(unquoted.lastIndexOf("/"), unquoted.lastIndexOf("\\")) + 1) : "";
      const full = `${baseDir}${e.name}${e.isDirectory() ? "\\" : ""}`;
      return full.includes(" ") ? `"${full}"` : full;
    }).sort((a, b) => a.localeCompare(b));
    return matches;
  } catch {
    return [];
  }
});
ipcMain.handle("kiln:exec", async (_event, { input }) => {
  if (!ptyProcess) createPtySession();
  ptyProcess?.write(input + "\r");
  return { lines: [] };
});
ipcMain.handle("kiln:searchExtensions", async (_event, query = "") => {
  return await searchExtensions(query);
});
ipcMain.handle("kiln:openFolder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
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
ipcMain.handle("kiln:readFile", async (_event, filePath) => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
});
ipcMain.handle("kiln:saveFile", async (_event, { id, content }) => {
  try {
    await fs.writeFile(id, content, "utf-8");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
app.whenReady().then(() => {
  app.setAppUserModelId("com.kiln.ide");
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  watcher?.close();
  ptyProcess?.kill();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
export {
  searchExtensions
};
