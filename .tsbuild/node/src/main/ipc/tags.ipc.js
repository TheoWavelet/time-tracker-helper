import { ipcMain } from 'electron';
import { listTags } from '../timerStore';
export function registerTagsIpc() {
    ipcMain.handle('tags:list', () => listTags());
}
