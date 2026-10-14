import { contextBridge, ipcRenderer } from 'electron';

// Expose secure functions to the React frontend under window.ideAPI
contextBridge.exposeInMainWorld('ideAPI', {
  selectFolder: () => ipcRenderer.invoke('ide:selectFolder'),
  readDirectory: (folderPath: string) => ipcRenderer.invoke('ide:readDirectory', folderPath),
});
