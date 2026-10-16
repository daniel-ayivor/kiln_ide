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
      // Target the compiled JavaScript asset generated in the build folder
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
    const files = await fs.readdir(folderPath);
    return { success: true, files };
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
