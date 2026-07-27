import { ipcMain } from 'electron'
import * as timerStore from '../timerStore'
import * as statsStore from '../statsStore'

export function registerArchiveIpc(): void {
  ipcMain.handle('archive:list', () => timerStore.listArchivedTimers())

  ipcMain.handle('archive:clear', () => timerStore.clearArchive())

  ipcMain.handle('stats:getWeekly', () => statsStore.getWeeklyStats())
}
