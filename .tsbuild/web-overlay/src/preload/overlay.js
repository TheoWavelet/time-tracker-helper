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
        onChanged: (callback) => {
            const listener = (_event, snapshot) => callback(snapshot);
            ipcRenderer.on('timers:changed', listener);
            return () => ipcRenderer.removeListener('timers:changed', listener);
        }
    },
    overlay: {
        setExpanded: (expanded) => ipcRenderer.invoke('overlay:setExpanded', expanded)
    }
};
contextBridge.exposeInMainWorld('api', api);
