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
var workspaceRoot = process.cwd();
var watcher = null;
var mainWindow = null;
var ptyProcess = null;
function createPtySession() {
  if (ptyProcess) return;
  const shell = os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "bash";
  ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: workspaceRoot,
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
var createWindow = () => {
  let preloadPath = path.join(__dirname, "preload.js");
  if (!fsSync.existsSync(preloadPath)) {
    preloadPath = path.join(__dirname, "preload.cjs");
  }
  console.log("[Electron Main] Preload script path:", preloadPath);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../../src/assets/Neon Orange Geometric K Logo.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:8082";
  if (!app.isPackaged) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/client/index.html"));
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
var IGNORED = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "dist-electron"]);
async function buildTree(dirPath, parentId, out) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
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
      try {
        node.content = await fs.readFile(absolutePath, "utf-8");
      } catch {
        node.content = "";
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
      mainWindow.webContents.send("kiln:fileChanged", {
        id,
        kind: eventType === "rename" ? "created" : "changed"
      });
    });
  } catch {
  }
}
ipcMain.handle("kiln:loadWorkspace", async () => {
  const nodes = {
    root: { id: "root", name: path.basename(workspaceRoot), type: "folder", parentId: null }
  };
  await buildTree(workspaceRoot, "root", nodes);
  startWatching();
  return nodes;
});
ipcMain.handle("kiln:openNewWindow", () => {
  createWindow();
});
ipcMain.on("terminal-write", (_event, data) => {
  if (!ptyProcess) createPtySession();
  ptyProcess?.write(data);
});
ipcMain.handle("kiln:exec", async (_event, { input }) => {
  if (!ptyProcess) createPtySession();
  ptyProcess?.write(input + "\r");
  return { lines: [] };
});
ipcMain.handle("kiln:searchExtensions", async (_event, query = "") => {
  console.log("[Main Process] Received search query:", query);
  const results = await searchExtensions(query);
  console.log("[Main Process] Returning results count:", results.length);
  return results;
});
ipcMain.handle("kiln:openFolder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || result.filePaths.length === 0) return null;
  workspaceRoot = result.filePaths[0];
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
