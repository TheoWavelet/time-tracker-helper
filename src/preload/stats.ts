import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, TimerDTO, TimersSnapshot, WeeklyStats } from '@shared/types'

const api = {
  stats: {
    getWeekly: (): Promise<WeeklyStats> => ipcRenderer.invoke('stats:getWeekly')
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get')
  },
  archive: {
    list: (): Promise<TimerDTO[]> => ipcRenderer.invoke('archive:list'),
    clear: (): Promise<void> => ipcRenderer.invoke('archive:clear')
  },
  timers: {
    // Fired on any timer change app-wide (start/stop/delete/etc.) — used here just to know when
    // to refetch the archive list and weekly stats while this window is open.
    onChanged: (callback: (snapshot: TimersSnapshot) => void): (() => void) => {
      const listener = (_event: unknown, snapshot: TimersSnapshot): void => callback(snapshot)
      ipcRenderer.on('timers:changed', listener)
      return () => ipcRenderer.removeListener('timers:changed', listener)
    }
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
  }
}

export type StatsApi = typeof api

contextBridge.exposeInMainWorld('api', api)
