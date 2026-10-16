// import { app, BrowserWindow, ipcMain, dialog } from 'electron';
// import * as path from 'path';
// import * as fs from 'fs/promises';
// import { fileURLToPath } from 'url';

// // Reconstruct __dirname for ES modules (Fixes the ReferenceError)
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const createWindow = () => {
//   const mainWindow = new BrowserWindow({
//     width: 1200,
//     height: 800,
//     frame: false, 
//     autoHideMenuBar: true,
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//       // Target the compiled JavaScript asset generated in the build folder
//       preload: path.join(__dirname, 'preload.js'), 
//     },
//   });

//   mainWindow.loadURL('http://localhost:8082');

//   // Gracefully handle reloading if the dev server isn't ready instantly
//   mainWindow.webContents.on('did-fail-load', () => {
//     mainWindow.loadURL('http://localhost:8082');
//   });

//   // IPC channel to update title from renderer if needed
//   ipcMain.on('electron:setTitle', (event, title: string) => {
//     mainWindow.setTitle(title);
//   });
// };

// // --- IPC File System Handlers ---

// // Native Operating System folder picker
// ipcMain.handle('ide:selectFolder', async () => {
//   const result = await dialog.showOpenDialog({
//     properties: ['openDirectory'],
//   });
//   if (result.canceled || result.filePaths.length === 0) return null;
//   return result.filePaths[0];
// });

// // Safe Directory Reader returning filenames
// ipcMain.handle('ide:readDirectory', async (event, folderPath: string) => {
//   try {
//     const files = await fs.readdir(folderPath);
//     return { success: true, files };
//   } catch (error: any) {
//     return { success: false, error: error.message };
//   }
// });

// app.whenReady().then(() => {
//   createWindow();

//   app.on('activate', () => {
//     if (BrowserWindow.getAllWindows().length === 0) {
//       createWindow();
//     }
//   });
// });

// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });



import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = () => {
  const mainWindow = new BrowserWindow({
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

  mainWindow.loadURL('http://localhost:8082');

  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL('http://localhost:8082');
  });

  ipcMain.on('electron:setTitle', (event, title: string) => {
    mainWindow.setTitle(title);
  });
};

// --- IPC IDE File System Handlers ---

// 1. Native Folder Picker
ipcMain.handle('ide:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0]; // Returns a single absolute folder path string
});

// 2. Recursive Directory Mapper for Nested Sidebars
ipcMain.handle('ide:readDirectory', async (event, folderPath: string) => {
  try {
    async function buildTree(dirPath: string): Promise<any[]> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const nodes = await Promise.all(
        entries.map(async (entry) => {
          const absolutePath = path.join(dirPath, entry.name);
          const isDirectory = entry.isDirectory();

          return {
            id: absolutePath, // Unique identifier used by frontend tree nodes
            name: entry.name,
            type: isDirectory ? 'folder' : 'file',
            // Recursively build children array if it's a directory
            children: isDirectory ? await buildTree(absolutePath) : undefined,
          };
        })
      );
      
      // Sort folders first, then files alphabetically
      return nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }

    const treeData = await buildTree(folderPath);
    return { success: true, files: treeData };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 3. File Reader (Triggered on file node click)
ipcMain.handle('ide:readFile', async (event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 4. File Writer (Triggered on Save shortcut Ctrl+S)
ipcMain.handle('ide:writeFile', async (event, { filePath, content }: { filePath: string; content: string }) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
