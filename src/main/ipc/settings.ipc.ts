import { BrowserWindow, ipcMain } from 'electron'
import {
  getSettings,
  setBrowserDomainFilter,
  setClockworkSyncEnabled,
  setDockSide,
  setHighlightPausedTimers
} from '../settingsStore'
import type { DockSide } from '@shared/types'

function broadcastSettings(): void {
  const settings = getSettings()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('settings:changed', settings)
  }
}

export function registerSettingsIpc(onDockSideChange: (dockSide: DockSide) => void): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:setDockSide', (_event, dockSide: DockSide) => {
    const updated = setDockSide(dockSide)
    onDockSideChange(updated.dockSide)
    broadcastSettings()
    return updated
  })

  ipcMain.handle('settings:setHighlightPausedTimers', (_event, value: boolean) => {
    const updated = setHighlightPausedTimers(value)
    broadcastSettings()
    return updated
  })

  ipcMain.handle('settings:setBrowserDomainFilter', (_event, value: string) => {
    const updated = setBrowserDomainFilter(value)
    broadcastSettings()
    return updated
  })

  ipcMain.handle('settings:setClockworkSyncEnabled', (_event, value: boolean) => {
    const updated = setClockworkSyncEnabled(value)
    broadcastSettings()
    return updated
  })
}
