import { ipcMain } from 'electron'
import { getSettings, setDockSide } from '../settingsStore'
import type { DockSide } from '@shared/types'

export function registerSettingsIpc(onDockSideChange: (dockSide: DockSide) => void): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:setDockSide', (_event, dockSide: DockSide) => {
    const updated = setDockSide(dockSide)
    onDockSideChange(updated.dockSide)
    return updated
  })
}
