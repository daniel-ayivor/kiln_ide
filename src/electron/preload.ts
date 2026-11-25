import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('kilnBridge', {
  kind: 'electron',
  capabilities: { realFileSystem: true, realTerminal: true, windowControls: true },

  fs: {
    loadWorkspace: () => ipcRenderer.invoke('kiln:loadWorkspace'),
    saveFile: (id: string, content: string) => ipcRenderer.invoke('kiln:saveFile', { id, content }),
    readFile: (id: string) => ipcRenderer.invoke('kiln:readFile', id),
    openFolder: () => ipcRenderer.invoke('kiln:openFolder'),
    onFileChange: (cb: (e: { id: string; kind: 'changed' | 'created' | 'deleted' }) => void) => {
      const listener = (_event: unknown, payload: { id: string; kind: 'changed' | 'created' | 'deleted' }) => cb(payload);
      ipcRenderer.on('kiln:fileChanged', listener);
      return () => ipcRenderer.removeListener('kiln:fileChanged', listener);
    },
  },

  shell: {
    exec: (input: string, ctx: { cwd: string }) => ipcRenderer.invoke('kiln:exec', { input, cwd: ctx.cwd }),
  },

  extensions: {
    search: (query: string) => ipcRenderer.invoke('kiln:searchExtensions', query),
  },

  terminal: {
    write: (data: string) => {
      ipcRenderer.send('terminal-write', data);
    },
    onData: (callback: (data: string) => void) => {
      const subscription = (_event: any, data: string) => callback(data);
      ipcRenderer.on('terminal-incoming-data', subscription);
      return () => {
        ipcRenderer.removeListener('terminal-incoming-data', subscription);
      };
    },
    completePath: (partial: string, dirsOnly = false) =>
      ipcRenderer.invoke('kiln:completePath', { partial, dirsOnly }),
    syncCwd: (cwd: string) =>
      ipcRenderer.send('kiln:syncTerminalCwd', cwd),
  },

  window: {
    minimize: () => ipcRenderer.send('kiln:minimize'),
    toggleMaximize: () => ipcRenderer.send('kiln:toggleMaximize'),
    close: () => ipcRenderer.send('kiln:close'),
    openNewWindow: () => ipcRenderer.invoke('kiln:openNewWindow'),
  },
});