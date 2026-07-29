"use strict";
const electron = require("electron");
const api = {
  timers: {
    getSnapshot: () => electron.ipcRenderer.invoke("timers:getSnapshot"),
    start: (input) => electron.ipcRenderer.invoke("timers:start", input),
    createCustomLog: (input) => electron.ipcRenderer.invoke("timers:createCustomLog", input),
    pause: (id) => electron.ipcRenderer.invoke("timers:pause", id),
    resume: (id) => electron.ipcRenderer.invoke("timers:resume", id),
    stop: (id) => electron.ipcRenderer.invoke("timers:stop", id),
    delete: (id) => electron.ipcRenderer.invoke("timers:delete", id),
    updateTitle: (id, title) => electron.ipcRenderer.invoke("timers:updateTitle", { id, title }),
    markLinkOpened: (id) => electron.ipcRenderer.invoke("timers:markLinkOpened", id),
    toggleLoggedConfirmed: (id) => electron.ipcRenderer.invoke("timers:toggleLoggedConfirmed", id),
    setLoggedConfirmed: (ids, confirmed) => electron.ipcRenderer.invoke("timers:setLoggedConfirmed", ids, confirmed),
    onChanged: (callback) => {
      const listener = (_event, snapshot) => callback(snapshot);
      electron.ipcRenderer.on("timers:changed", listener);
      return () => electron.ipcRenderer.removeListener("timers:changed", listener);
    }
  },
  tags: {
    list: () => electron.ipcRenderer.invoke("tags:list"),
    listForPicker: () => electron.ipcRenderer.invoke("tags:listForPicker"),
    findOrCreateByLabelAndUrl: (label, url) => electron.ipcRenderer.invoke("tags:findOrCreateByLabelAndUrl", label, url),
    toggleFavorite: (id) => electron.ipcRenderer.invoke("tags:toggleFavorite", id)
  },
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    setDockSide: (dockSide) => electron.ipcRenderer.invoke("settings:setDockSide", dockSide),
    setHighlightPausedTimers: (value) => electron.ipcRenderer.invoke("settings:setHighlightPausedTimers", value),
    setBrowserDomainFilter: (value) => electron.ipcRenderer.invoke("settings:setBrowserDomainFilter", value),
    setClockworkSyncEnabled: (value) => electron.ipcRenderer.invoke("settings:setClockworkSyncEnabled", value),
    setDefaultLinkBrowser: (value) => electron.ipcRenderer.invoke("settings:setDefaultLinkBrowser", value),
    onChanged: (callback) => {
      const listener = (_event, settings) => callback(settings);
      electron.ipcRenderer.on("settings:changed", listener);
      return () => electron.ipcRenderer.removeListener("settings:changed", listener);
    }
  },
  shell: {
    openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url)
  },
  app: {
    openStats: () => electron.ipcRenderer.invoke("stats:show")
  },
  browser: {
    listOpenTabs: () => electron.ipcRenderer.invoke("browser:listOpenTabs"),
    searchHistoryByDomain: () => electron.ipcRenderer.invoke("browser:searchHistoryByDomain"),
    getPairingInfo: () => electron.ipcRenderer.invoke("browser:getPairingInfo")
  },
  clockwork: {
    getStatus: () => electron.ipcRenderer.invoke("clockwork:getStatus"),
    setApiToken: (token) => electron.ipcRenderer.invoke("clockwork:setApiToken", token)
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
