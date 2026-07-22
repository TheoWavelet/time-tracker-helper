"use strict";
const electron = require("electron");
const api = {
  timers: {
    getSnapshot: () => electron.ipcRenderer.invoke("timers:getSnapshot"),
    start: (input) => electron.ipcRenderer.invoke("timers:start", input),
    pause: (id) => electron.ipcRenderer.invoke("timers:pause", id),
    resume: (id) => electron.ipcRenderer.invoke("timers:resume", id),
    stop: (id) => electron.ipcRenderer.invoke("timers:stop", id),
    delete: (id) => electron.ipcRenderer.invoke("timers:delete", id),
    updateTitle: (id, title) => electron.ipcRenderer.invoke("timers:updateTitle", { id, title }),
    onChanged: (callback) => {
      const listener = (_event, snapshot) => callback(snapshot);
      electron.ipcRenderer.on("timers:changed", listener);
      return () => electron.ipcRenderer.removeListener("timers:changed", listener);
    }
  },
  tags: {
    list: () => electron.ipcRenderer.invoke("tags:list"),
    listForPicker: () => electron.ipcRenderer.invoke("tags:listForPicker")
  },
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    setDockSide: (dockSide) => electron.ipcRenderer.invoke("settings:setDockSide", dockSide)
  },
  shell: {
    openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url)
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
