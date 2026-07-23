"use strict";
const electron = require("electron");
const api = {
  timers: {
    getSnapshot: () => electron.ipcRenderer.invoke("timers:getSnapshot"),
    start: (input) => electron.ipcRenderer.invoke("timers:start", input),
    pause: (id) => electron.ipcRenderer.invoke("timers:pause", id),
    resume: (id) => electron.ipcRenderer.invoke("timers:resume", id),
    stop: (id) => electron.ipcRenderer.invoke("timers:stop", id),
    onChanged: (callback) => {
      const listener = (_event, snapshot) => callback(snapshot);
      electron.ipcRenderer.on("timers:changed", listener);
      return () => electron.ipcRenderer.removeListener("timers:changed", listener);
    }
  },
  tags: {
    listForPicker: () => electron.ipcRenderer.invoke("tags:listForPicker"),
    findOrCreateByLabelAndUrl: (label, url) => electron.ipcRenderer.invoke("tags:findOrCreateByLabelAndUrl", label, url),
    toggleFavorite: (id) => electron.ipcRenderer.invoke("tags:toggleFavorite", id)
  },
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    onChanged: (callback) => {
      const listener = (_event, settings) => callback(settings);
      electron.ipcRenderer.on("settings:changed", listener);
      return () => electron.ipcRenderer.removeListener("settings:changed", listener);
    }
  },
  overlay: {
    setExpanded: (expanded) => electron.ipcRenderer.invoke("overlay:setExpanded", expanded),
    setBarWide: (wide) => electron.ipcRenderer.invoke("overlay:setBarWide", wide),
    dragStart: () => electron.ipcRenderer.send("overlay:dragStart"),
    dragMove: () => electron.ipcRenderer.send("overlay:dragMove"),
    dragEnd: () => electron.ipcRenderer.send("overlay:dragEnd")
  },
  shell: {
    openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url)
  },
  app: {
    openDashboard: () => electron.ipcRenderer.invoke("dashboard:show")
  },
  browser: {
    listOpenTabs: () => electron.ipcRenderer.invoke("browser:listOpenTabs"),
    searchHistoryByDomain: () => electron.ipcRenderer.invoke("browser:searchHistoryByDomain"),
    getPairingInfo: () => electron.ipcRenderer.invoke("browser:getPairingInfo")
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
