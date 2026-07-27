import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  BrowserPairingInfo,
  ClockworkStatus,
  CustomTimerLogInput,
  DockSide,
  DomainHistoryItem,
  OpenTabInfo,
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
    createCustomLog: (input: CustomTimerLogInput): Promise<TimerDTO> => ipcRenderer.invoke('timers:createCustomLog', input),
    pause: (id: string) => ipcRenderer.invoke('timers:pause', id),
    resume: (id: string) => ipcRenderer.invoke('timers:resume', id),
    stop: (id: string) => ipcRenderer.invoke('timers:stop', id),
    delete: (id: string) => ipcRenderer.invoke('timers:delete', id),
    updateTitle: (id: string, title: string) => ipcRenderer.invoke('timers:updateTitle', { id, title }),
    markLinkOpened: (id: string): Promise<void> => ipcRenderer.invoke('timers:markLinkOpened', id),
    toggleLoggedConfirmed: (id: string): Promise<void> => ipcRenderer.invoke('timers:toggleLoggedConfirmed', id),
    setLoggedConfirmed: (ids: string[], confirmed: boolean): Promise<void> =>
      ipcRenderer.invoke('timers:setLoggedConfirmed', ids, confirmed),
    onChanged: (callback: (snapshot: TimersSnapshot) => void): (() => void) => {
      const listener = (_event: unknown, snapshot: TimersSnapshot): void => callback(snapshot)
      ipcRenderer.on('timers:changed', listener)
      return () => ipcRenderer.removeListener('timers:changed', listener)
    }
  },
  tags: {
    list: (): Promise<TagDTO[]> => ipcRenderer.invoke('tags:list'),
    listForPicker: (): Promise<TagPickerEntry[]> => ipcRenderer.invoke('tags:listForPicker'),
    findOrCreateByLabelAndUrl: (label: string, url: string): Promise<TagPickerEntry> =>
      ipcRenderer.invoke('tags:findOrCreateByLabelAndUrl', label, url),
    toggleFavorite: (id: string): Promise<TagPickerEntry> => ipcRenderer.invoke('tags:toggleFavorite', id)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    setDockSide: (dockSide: DockSide): Promise<AppSettings> => ipcRenderer.invoke('settings:setDockSide', dockSide),
    setHighlightPausedTimers: (value: boolean): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:setHighlightPausedTimers', value),
    setBrowserDomainFilter: (value: string): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:setBrowserDomainFilter', value),
    setClockworkSyncEnabled: (value: boolean): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:setClockworkSyncEnabled', value),
    onChanged: (callback: (settings: AppSettings) => void): (() => void) => {
      const listener = (_event: unknown, settings: AppSettings): void => callback(settings)
      ipcRenderer.on('settings:changed', listener)
      return () => ipcRenderer.removeListener('settings:changed', listener)
    }
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
  },
  app: {
    openStats: (): Promise<void> => ipcRenderer.invoke('stats:show')
  },
  browser: {
    listOpenTabs: (): Promise<OpenTabInfo[]> => ipcRenderer.invoke('browser:listOpenTabs'),
    searchHistoryByDomain: (): Promise<DomainHistoryItem[]> =>
      ipcRenderer.invoke('browser:searchHistoryByDomain'),
    getPairingInfo: (): Promise<BrowserPairingInfo> => ipcRenderer.invoke('browser:getPairingInfo')
  },
  clockwork: {
    getStatus: (): Promise<ClockworkStatus> => ipcRenderer.invoke('clockwork:getStatus'),
    setApiToken: (token: string): Promise<ClockworkStatus> => ipcRenderer.invoke('clockwork:setApiToken', token)
  }
}

export type DashboardApi = typeof api

contextBridge.exposeInMainWorld('api', api)
