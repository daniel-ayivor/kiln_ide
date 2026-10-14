
// import { app, BrowserWindow } from 'electron';

// const createWindow = () => {
//   const mainWindow = new BrowserWindow({
//     width: 1200,
//     height: 800,
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//     },
//   });

//   // Load your React + Vite app
//  // Electron main process file
// mainWindow.loadURL('http://localhost:8081');
// };

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


// // import { app, BrowserWindow, ipcMain, dialog } from 'electron'; // 👈 Added ipcMain and dialog
// // import * as path from 'path';
// // import * as fs from 'fs/promises'; // 👈 Added Node's native file system

// // const createWindow = () => {
// //   const mainWindow = new BrowserWindow({
// //     width: 800,
// //     height: 600,
// //     webPreferences: {
// //       nodeIntegration: false,
// //       contextIsolation: true,
// //       // 👇 1. Point this to your compiled preload.js script!
// //       preload: path.join(__dirname, 'preload.js'), 
// //     },
// //   });

// //   mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
// // };

// // // --- 2. IPC HANDLERS (The API backend for your IDE) ---

// // // Handle folder selection dialog requests from React
// // ipcMain.handle('ide:selectFolder', async () => {
// //   const result = await dialog.showOpenDialog({
// //     properties: ['openDirectory'],
// //   });
// //   if (result.canceled) return null;
// //   return result.filePaths[0]; // Returns the chosen folder path string
// // });

// // // Handle scanning the directory contents
// // ipcMain.handle('ide:readDirectory', async (event, folderPath: string) => {
// //   try {
// //     const files = await fs.readdir(folderPath, { withFileTypes: true });
// //     return files.map(file => ({
// //       name: file.name,
// //       isDirectory: file.isDirectory(),
// //       path: path.join(folderPath, file.name)
// //     }));
// //   } catch (error: any) {
// //     return { error: error.message };
// //   }
// // });

// // app.whenReady().then(() => {
// //   createWindow();

// //   app.on('activate', () => {
// //     if (BrowserWindow.getAllWindows().length === 0) {
// //       createWindow();
// //     }
// //   });
// // });

// // app.on('window-all-closed', () => {
// //   if (process.platform !== 'darwin') {
// //     app.quit();
// //   }
// // });



import { app, BrowserWindow } from 'electron';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL('http://localhost:8082');
};

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