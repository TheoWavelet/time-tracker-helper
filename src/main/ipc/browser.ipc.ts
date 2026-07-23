import { ipcMain } from 'electron'
import { getPairingToken, isExtensionConnected, listOpenTabs, searchHistoryByDomain } from '../browserBridge'
import { getSettings } from '../settingsStore'

export function registerBrowserIpc(): void {
  ipcMain.handle('browser:listOpenTabs', () => listOpenTabs(getSettings().browserDomainFilter))
  ipcMain.handle('browser:searchHistoryByDomain', () => searchHistoryByDomain(getSettings().browserDomainFilter))
  ipcMain.handle('browser:getPairingInfo', () => ({
    token: getPairingToken(),
    connected: isExtensionConnected()
  }))
}
