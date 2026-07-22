import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  DockSide,
  StartTimerInput,
  TagDTO,
  TagPickerEntry,
  TimerDTO,
  TimersSnapshot
} from '@shared/types'

const api = {
  timers: {
    getSnapshot: (): Promise<TimersSnapshot> => ipcRenderer.invoke('timers:getSnapshot'),
    start: (input: StartTimerInput): Promise<TimerDTO> => ipcRenderer.invoke('timers:start', input),
    pause: (id: string) => ipcRenderer.invoke('timers:pause', id),
    resume: (id: string) => ipcRenderer.invoke('timers:resume', id),
    stop: (id: string) => ipcRenderer.invoke('timers:stop', id),
    delete: (id: string) => ipcRenderer.invoke('timers:delete', id),
    updateTitle: (id: string, title: string) => ipcRenderer.invoke('timers:updateTitle', { id, title }),
    onChanged: (callback: (snapshot: TimersSnapshot) => void): (() => void) => {
      const listener = (_event: unknown, snapshot: TimersSnapshot): void => callback(snapshot)
      ipcRenderer.on('timers:changed', listener)
      return () => ipcRenderer.removeListener('timers:changed', listener)
    }
  },
  tags: {
    list: (): Promise<TagDTO[]> => ipcRenderer.invoke('tags:list'),
    listForPicker: (): Promise<TagPickerEntry[]> => ipcRenderer.invoke('tags:listForPicker')
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    setDockSide: (dockSide: DockSide): Promise<AppSettings> => ipcRenderer.invoke('settings:setDockSide', dockSide)
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
  }
}

export type DashboardApi = typeof api

contextBridge.exposeInMainWorld('api', api)
