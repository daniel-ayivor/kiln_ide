// src/electron/main.ts
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  mainWindow.loadURL("http://localhost:8082");
  mainWindow.webContents.on("did-fail-load", () => {
    mainWindow.loadURL("http://localhost:8082");
  });
  ipcMain.on("electron:setTitle", (event, title) => {
    mainWindow.setTitle(title);
  });
};
ipcMain.handle("ide:selectFolder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
ipcMain.handle("ide:readDirectory", async (event, folderPath) => {
  try {
    async function buildTree(dirPath) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const nodes = await Promise.all(
        entries.map(async (entry) => {
          const absolutePath = path.join(dirPath, entry.name);
          const isDirectory = entry.isDirectory();
          return {
            id: absolutePath,
            // Unique identifier used by frontend tree nodes
            name: entry.name,
            type: isDirectory ? "folder" : "file",
            // Recursively build children array if it's a directory
            children: isDirectory ? await buildTree(absolutePath) : void 0
          };
        })
      );
      return nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    const treeData = await buildTree(folderPath);
    return { success: true, files: treeData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("ide:readFile", async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("ide:writeFile", async (event, { filePath, content }) => {
  try {
    await fs.writeFile(filePath, content, "utf-8");
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});
