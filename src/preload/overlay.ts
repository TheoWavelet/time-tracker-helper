import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  BrowserPairingInfo,
  CustomTimerLogInput,
  DomainHistoryItem,
  OpenTabInfo,
  StartTimerInput,
  TagPickerEntry,
  TimerDTO,
  TimersSnapshot
} from '@shared/types'

const api = {
  timers: {
    getSnapshot: (): Promise<TimersSnapshot> => ipcRenderer.invoke('timers:getSnapshot'),
    start: (input: StartTimerInput): Promise<TimerDTO> => ipcRenderer.invoke('timers:start', input),
    createCustomLog: (input: CustomTimerLogInput): Promise<TimerDTO> => ipcRenderer.invoke('timers:createCustomLog', input),
    pause: (id: string) => ipcRenderer.invoke('timers:pause', id),
    resume: (id: string) => ipcRenderer.invoke('timers:resume', id),
    stop: (id: string) => ipcRenderer.invoke('timers:stop', id),
    delete: (id: string) => ipcRenderer.invoke('timers:delete', id),
    onChanged: (callback: (snapshot: TimersSnapshot) => void): (() => void) => {
      const listener = (_event: unknown, snapshot: TimersSnapshot): void => callback(snapshot)
      ipcRenderer.on('timers:changed', listener)
      return () => ipcRenderer.removeListener('timers:changed', listener)
    }
  },
  tags: {
    listForPicker: (): Promise<TagPickerEntry[]> => ipcRenderer.invoke('tags:listForPicker'),
    findOrCreateByLabelAndUrl: (label: string, url: string): Promise<TagPickerEntry> =>
      ipcRenderer.invoke('tags:findOrCreateByLabelAndUrl', label, url),
    toggleFavorite: (id: string): Promise<TagPickerEntry> => ipcRenderer.invoke('tags:toggleFavorite', id)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    onChanged: (callback: (settings: AppSettings) => void): (() => void) => {
      const listener = (_event: unknown, settings: AppSettings): void => callback(settings)
      ipcRenderer.on('settings:changed', listener)
      return () => ipcRenderer.removeListener('settings:changed', listener)
    }
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
  },
  browser: {
    listOpenTabs: (): Promise<OpenTabInfo[]> => ipcRenderer.invoke('browser:listOpenTabs'),
    searchHistoryByDomain: (): Promise<DomainHistoryItem[]> =>
      ipcRenderer.invoke('browser:searchHistoryByDomain'),
    getPairingInfo: (): Promise<BrowserPairingInfo> => ipcRenderer.invoke('browser:getPairingInfo')
  }
}

export type OverlayApi = typeof api

contextBridge.exposeInMainWorld('api', api)
