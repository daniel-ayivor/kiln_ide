import { BrowserWindow, app, dialog, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import { watch } from "fs";
import { exec } from "child_process";
import { fileURLToPath } from "url";
//#region src/electron/main.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var workspaceRoot = process.cwd();
var watcher = null;
var mainWindow = null;
var DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:8082";
var createWindow = () => {
	let preloadPath = path.join(__dirname, "preload.js");
	if (!fsSync.existsSync(preloadPath)) preloadPath = path.join(__dirname, "preload.cjs");
	console.log("[Electron Main] Preload script path:", preloadPath);
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		frame: false,
		autoHideMenuBar: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: preloadPath
		}
	});
	if (DEV_SERVER_URL) {
		mainWindow.loadURL(DEV_SERVER_URL);
		mainWindow.webContents.on("did-fail-load", () => mainWindow?.loadURL(DEV_SERVER_URL));
	} else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
};
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
	"dist-electron"
]);
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
		if (!isDirectory) try {
			node.content = await fs.readFile(absolutePath, "utf-8");
		} catch {
			node.content = "";
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
	} catch {}
}
ipcMain.handle("kiln:loadWorkspace", async () => {
	const nodes = { root: {
		id: "root",
		name: path.basename(workspaceRoot),
		type: "folder",
		parentId: null
	} };
	await buildTree(workspaceRoot, "root", nodes);
	startWatching();
	return nodes;
});
ipcMain.handle("kiln:openFolder", async () => {
	const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
	if (result.canceled || result.filePaths.length === 0) return null;
	workspaceRoot = result.filePaths[0];
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
		return {
			success: false,
			error: error.message
		};
	}
});
ipcMain.handle("kiln:exec", (_event, { input, cwd }) => {
	const dir = cwd === "~" || !cwd ? workspaceRoot : cwd;
	return new Promise((resolve) => {
		exec(input, {
			cwd: dir,
			timeout: 3e4
		}, (error, stdout, stderr) => {
			const lines = [{
				kind: "in",
				text: input
			}];
			if (stdout) stdout.trimEnd().split("\n").forEach((l) => lines.push({
				kind: "out",
				text: l
			}));
			if (stderr) stderr.trimEnd().split("\n").forEach((l) => lines.push({
				kind: "err",
				text: l
			}));
			if (error && !stderr) lines.push({
				kind: "err",
				text: error.message
			});
			resolve({ lines });
		});
	});
});
app.whenReady().then(() => {
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
app.on("window-all-closed", () => {
	watcher?.close();
	if (process.platform !== "darwin") app.quit();
});
//#endregion
export {};
