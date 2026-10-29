"use strict";

// src/electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("kilnBridge", {
  kind: "electron",
  capabilities: { realFileSystem: true, realTerminal: true, windowControls: true },
  fs: {
    // Loads the workspace tree from the real disk (async IPC round-trip).
    loadWorkspace: () => import_electron.ipcRenderer.invoke("kiln:loadWorkspace"),
    // Persists a file to disk. Called on Save / Save All / auto-save.
    saveFile: (id, content) => import_electron.ipcRenderer.invoke("kiln:saveFile", { id, content }),
    // Reads one file back from disk (used after an external change event).
    readFile: (id) => import_electron.ipcRenderer.invoke("kiln:readFile", id),
    // Native folder picker.
    openFolder: () => import_electron.ipcRenderer.invoke("kiln:openFolder"),
    // fs.watch notifications from the main process. Returns an unsubscribe fn.
    onFileChange: (cb) => {
      const listener = (_event, payload) => cb(payload);
      import_electron.ipcRenderer.on("kiln:fileChanged", listener);
      return () => import_electron.ipcRenderer.removeListener("kiln:fileChanged", listener);
    }
  },
  shell: {
    // Real terminal: runs the command in the main process.
    exec: (input, ctx) => import_electron.ipcRenderer.invoke("kiln:exec", { input, cwd: ctx.cwd })
  },
  extensions: {
    search: (query) => import_electron.ipcRenderer.invoke("kiln:searchExtensions", query)
  },
  // Add terminal bridge here:
  terminal: {
    write: (data) => {
      import_electron.ipcRenderer.send("terminal-write", data);
    },
    onData: (callback) => {
      const subscription = (_event, data) => callback(data);
      import_electron.ipcRenderer.on("terminal-incoming-data", subscription);
      return () => {
        import_electron.ipcRenderer.removeListener("terminal-incoming-data", subscription);
      };
    }
  },
  window: {
    minimize: () => import_electron.ipcRenderer.send("kiln:minimize"),
    toggleMaximize: () => import_electron.ipcRenderer.send("kiln:toggleMaximize"),
    close: () => import_electron.ipcRenderer.send("kiln:close"),
    // Spawns a fresh window instance natively
    openNewWindow: () => import_electron.ipcRenderer.invoke("kiln:openNewWindow")
  }
});
