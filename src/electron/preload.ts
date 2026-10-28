import { contextBridge, ipcRenderer } from 'electron';

/**
 * Exposes `window.kilnBridge` — the KilnPlatform contract the workbench UI
 * already speaks (see src/ide/platform/types.ts). getPlatform() picks this up
 * automatically, so no component changes are needed.
 */
contextBridge.exposeInMainWorld('kilnBridge', {
  kind: 'electron',
  capabilities: { realFileSystem: true, realTerminal: true, windowControls: true },

  fs: {
    // Loads the workspace tree from the real disk (async IPC round-trip).
    loadWorkspace: () => ipcRenderer.invoke('kiln:loadWorkspace'),
    // Persists a file to disk. Called on Save / Save All / auto-save.
    saveFile: (id: string, content: string) => ipcRenderer.invoke('kiln:saveFile', { id, content }),
    // Reads one file back from disk (used after an external change event).
    readFile: (id: string) => ipcRenderer.invoke('kiln:readFile', id),
    // Native folder picker.
    openFolder: () => ipcRenderer.invoke('kiln:openFolder'),
    // fs.watch notifications from the main process. Returns an unsubscribe fn.
    onFileChange: (cb: (e: { id: string; kind: 'changed' | 'created' | 'deleted' }) => void) => {
      const listener = (_event: unknown, payload: { id: string; kind: 'changed' | 'created' | 'deleted' }) => cb(payload);
      ipcRenderer.on('kiln:fileChanged', listener);
      return () => ipcRenderer.removeListener('kiln:fileChanged', listener);
    },
  },

  shell: {
    // Real terminal: runs the command in the main process.
    exec: (input: string, ctx: { cwd: string }) => ipcRenderer.invoke('kiln:exec', { input, cwd: ctx.cwd }),
  },

  extensions: {
    search: (query: string) => ipcRenderer.invoke('kiln:searchExtensions', query),
  },
  
  window: {
    minimize: () => ipcRenderer.send('kiln:minimize'),
    toggleMaximize: () => ipcRenderer.send('kiln:toggleMaximize'),
    close: () => ipcRenderer.send('kiln:close'),
    // Spawns a fresh window instance natively
    openNewWindow: () => ipcRenderer.invoke('kiln:openNewWindow'),
  },
});