import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ideAPI', {
  selectFolder: () => ipcRenderer.invoke('ide:selectFolder'),
  readDirectory: (folderPath: string) => ipcRenderer.invoke('ide:readDirectory', folderPath),
  readFile: (filePath: string) => ipcRenderer.invoke('ide:readFile', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('ide:writeFile', { filePath, content }),
});

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title: string) => ipcRenderer.send('electron:setTitle', title),
});
