import { contextBridge, ipcRenderer } from 'electron';
const api = {
    timers: {
        getSnapshot: () => ipcRenderer.invoke('timers:getSnapshot'),
        start: (input) => ipcRenderer.invoke('timers:start', input),
        pause: (id) => ipcRenderer.invoke('timers:pause', id),
        resume: (id) => ipcRenderer.invoke('timers:resume', id),
        stop: (id) => ipcRenderer.invoke('timers:stop', id),
        submit: (id, tagLabel) => ipcRenderer.invoke('timers:submit', { id, tagLabel }),
        discard: (id) => ipcRenderer.invoke('timers:discard', id),
        updateTitle: (id, title) => ipcRenderer.invoke('timers:updateTitle', { id, title }),
        onChanged: (callback) => {
            const listener = (_event, snapshot) => callback(snapshot);
            ipcRenderer.on('timers:changed', listener);
            return () => ipcRenderer.removeListener('timers:changed', listener);
        }
    },
    tags: {
        list: () => ipcRenderer.invoke('tags:list')
    },
    settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        setDockSide: (dockSide) => ipcRenderer.invoke('settings:setDockSide', dockSide)
    }
};
contextBridge.exposeInMainWorld('api', api);
