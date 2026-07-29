"use strict";
const electron = require("electron");
const api = {
  stats: {
    getWeekly: () => electron.ipcRenderer.invoke("stats:getWeekly")
  },
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get")
  },
  archive: {
    list: () => electron.ipcRenderer.invoke("archive:list"),
    clear: () => electron.ipcRenderer.invoke("archive:clear")
  },
  timers: {
    // Fired on any timer change app-wide (start/stop/delete/etc.) — used here just to know when
    // to refetch the archive list and weekly stats while this window is open.
    onChanged: (callback) => {
      const listener = (_event, snapshot) => callback(snapshot);
      electron.ipcRenderer.on("timers:changed", listener);
      return () => electron.ipcRenderer.removeListener("timers:changed", listener);
    }
  },
  shell: {
    openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url)
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
