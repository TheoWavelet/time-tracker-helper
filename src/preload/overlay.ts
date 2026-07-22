import { contextBridge, ipcRenderer } from 'electron'
import type { StartTimerInput, TagPickerEntry, TimerDTO, TimersSnapshot } from '@shared/types'

const api = {
  timers: {
    getSnapshot: (): Promise<TimersSnapshot> => ipcRenderer.invoke('timers:getSnapshot'),
    start: (input: StartTimerInput): Promise<TimerDTO> => ipcRenderer.invoke('timers:start', input),
    pause: (id: string) => ipcRenderer.invoke('timers:pause', id),
    resume: (id: string) => ipcRenderer.invoke('timers:resume', id),
    stop: (id: string) => ipcRenderer.invoke('timers:stop', id),
    onChanged: (callback: (snapshot: TimersSnapshot) => void): (() => void) => {
      const listener = (_event: unknown, snapshot: TimersSnapshot): void => callback(snapshot)
      ipcRenderer.on('timers:changed', listener)
      return () => ipcRenderer.removeListener('timers:changed', listener)
    }
  },
  tags: {
    listForPicker: (): Promise<TagPickerEntry[]> => ipcRenderer.invoke('tags:listForPicker')
  },
  overlay: {
    setExpanded: (expanded: boolean): Promise<boolean> => ipcRenderer.invoke('overlay:setExpanded', expanded),
    setBarWide: (wide: boolean): Promise<boolean> => ipcRenderer.invoke('overlay:setBarWide', wide),
    dragStart: (): void => ipcRenderer.send('overlay:dragStart'),
    dragMove: (): void => ipcRenderer.send('overlay:dragMove'),
    dragEnd: (): void => ipcRenderer.send('overlay:dragEnd')
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
  },
  app: {
    openDashboard: (): Promise<void> => ipcRenderer.invoke('dashboard:show')
  }
}

export type OverlayApi = typeof api

contextBridge.exposeInMainWorld('api', api)
