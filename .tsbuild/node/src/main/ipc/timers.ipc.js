import { BrowserWindow, ipcMain } from 'electron';
import * as timerStore from '../timerStore';
export function registerTimerIpc() {
    ipcMain.handle('timers:getSnapshot', () => timerStore.getSnapshot());
    ipcMain.handle('timers:start', (_event, input) => timerStore.startTimer(input));
    ipcMain.handle('timers:pause', (_event, id) => timerStore.pauseTimer(id));
    ipcMain.handle('timers:resume', (_event, id) => timerStore.resumeTimer(id));
    ipcMain.handle('timers:stop', (_event, id) => timerStore.stopTimer(id));
    ipcMain.handle('timers:submit', (_event, { id, tagLabel }) => timerStore.submitTimer(id, tagLabel));
    ipcMain.handle('timers:discard', (_event, id) => timerStore.discardTimer(id));
    ipcMain.handle('timers:updateTitle', (_event, { id, title }) => timerStore.updateTimerTitle(id, title));
    timerStore.onTimersChanged((snapshot) => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed())
                win.webContents.send('timers:changed', snapshot);
        }
    });
}
