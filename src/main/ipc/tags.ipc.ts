import { ipcMain } from 'electron'
import { findOrCreateTagByLabelAndUrl, listTags, listTagsForPicker, toggleTagFavorite } from '../timerStore'

export function registerTagsIpc(): void {
  ipcMain.handle('tags:list', () => listTags())
  ipcMain.handle('tags:listForPicker', () => listTagsForPicker())
  ipcMain.handle('tags:findOrCreateByLabelAndUrl', (_event, label: string, url: string) => findOrCreateTagByLabelAndUrl(label, url))
  ipcMain.handle('tags:toggleFavorite', (_event, id: string) => toggleTagFavorite(id))
}
