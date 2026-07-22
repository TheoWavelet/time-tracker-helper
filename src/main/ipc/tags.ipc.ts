import { ipcMain } from 'electron'
import { listTags, listTagsForPicker } from '../timerStore'

export function registerTagsIpc(): void {
  ipcMain.handle('tags:list', () => listTags())
  ipcMain.handle('tags:listForPicker', () => listTagsForPicker())
}
