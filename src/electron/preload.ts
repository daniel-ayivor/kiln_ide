

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

  ai: {
    getConfig: () => ipcRenderer.invoke('kiln:getAiConfig'),
    saveConfig: (cfg: { apiKey: string; baseURL?: string; model?: string }) =>
      ipcRenderer.invoke('kiln:saveAiConfig', cfg),
    streamChat: (
      payload: { messages: unknown[]; snippet?: unknown },
      handlers: {
        onChunk: (chunk: Uint8Array) => void;
        onEnd: () => void;
        onError: (message: string) => void;
      },
      signal?: AbortSignal,
    ) => {
      const streamId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let finished = false;

      const cleanup = () => {
        finished = true;
        ipcRenderer.removeAllListeners(`kiln:aiChunk:${streamId}`);
        ipcRenderer.removeAllListeners(`kiln:aiEnd:${streamId}`);
        ipcRenderer.removeAllListeners(`kiln:aiError:${streamId}`);
      };

      ipcRenderer.on(`kiln:aiChunk:${streamId}`, (_event, chunk: Uint8Array) => {
        if (finished) return;
        handlers.onChunk(chunk);
      });
      ipcRenderer.once(`kiln:aiEnd:${streamId}`, () => {
        if (finished) return;
        cleanup();
        handlers.onEnd();
      });
      ipcRenderer.once(`kiln:aiError:${streamId}`, (_event, msg: string) => {
        if (finished) return;
        cleanup();
        handlers.onError(msg);
      });

      if (typeof signal?.addEventListener === 'function') {
        signal.addEventListener(
          'abort',
          () => {
            if (finished) return;
            cleanup();
            ipcRenderer.send('kiln:aiAbort', streamId);
          },
          { once: true },
        );
      }

      ipcRenderer.send('kiln:aiChat', { streamId, ...payload });
    },
  },

  shell: {
    exec: (input: string, ctx: { cwd: string }) => ipcRenderer.invoke('kiln:exec', { input, cwd: ctx.cwd }),
  },

extensions: {
    search: (query: string) => ipcRenderer.invoke('kiln:searchExtensions', query),
    listInstalled: () => ipcRenderer.invoke('kiln:listInstalledExtensions'),
    install: (ext: {
      namespace: string;
      name: string;
      version?: string;
      displayName?: string;
      description?: string;
      iconUrl?: string;
      downloadUrl?: string;
    }) => ipcRenderer.invoke('kiln:installExtension', ext),
    uninstall: (extensionId: string) => ipcRenderer.invoke('kiln:uninstallExtension', extensionId),
    applyToFile: (payload: {
      extensionId: string;
      fileId: string;
      content: string;
      language?: string;
    }) => ipcRenderer.invoke('kiln:applyExtensionToFile', payload),
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