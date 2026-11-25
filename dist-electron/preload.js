"use strict";

// src/electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("kilnBridge", {
  kind: "electron",
  capabilities: { realFileSystem: true, realTerminal: true, windowControls: true },
  fs: {
    loadWorkspace: () => import_electron.ipcRenderer.invoke("kiln:loadWorkspace"),
    saveFile: (id, content) => import_electron.ipcRenderer.invoke("kiln:saveFile", { id, content }),
    readFile: (id) => import_electron.ipcRenderer.invoke("kiln:readFile", id),
    openFolder: () => import_electron.ipcRenderer.invoke("kiln:openFolder"),
    onFileChange: (cb) => {
      const listener = (_event, payload) => cb(payload);
      import_electron.ipcRenderer.on("kiln:fileChanged", listener);
      return () => import_electron.ipcRenderer.removeListener("kiln:fileChanged", listener);
    }
  },
  shell: {
    exec: (input, ctx) => import_electron.ipcRenderer.invoke("kiln:exec", { input, cwd: ctx.cwd })
  },
  extensions: {
    search: (query) => import_electron.ipcRenderer.invoke("kiln:searchExtensions", query)
  },
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
    },
    completePath: (partial, dirsOnly = false) => import_electron.ipcRenderer.invoke("kiln:completePath", { partial, dirsOnly }),
    syncCwd: (cwd) => import_electron.ipcRenderer.send("kiln:syncTerminalCwd", cwd)
  },
  window: {
    minimize: () => import_electron.ipcRenderer.send("kiln:minimize"),
    toggleMaximize: () => import_electron.ipcRenderer.send("kiln:toggleMaximize"),
    close: () => import_electron.ipcRenderer.send("kiln:close"),
    openNewWindow: () => import_electron.ipcRenderer.invoke("kiln:openNewWindow")
  }
});
