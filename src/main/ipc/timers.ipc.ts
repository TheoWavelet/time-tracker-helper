import { BrowserWindow, ipcMain } from 'electron'
import * as timerStore from '../timerStore'
import type { StartTimerInput } from '@shared/types'

export function registerTimerIpc(): void {
  ipcMain.handle('timers:getSnapshot', () => timerStore.getSnapshot())

  ipcMain.handle('timers:start', (_event, input: StartTimerInput) => timerStore.startTimer(input))

  ipcMain.handle('timers:pause', (_event, id: string) => timerStore.pauseTimer(id))

  ipcMain.handle('timers:resume', (_event, id: string) => timerStore.resumeTimer(id))

  ipcMain.handle('timers:stop', (_event, id: string) => timerStore.stopTimer(id))

  ipcMain.handle('timers:delete', (_event, id: string) => timerStore.deleteTimer(id))

  ipcMain.handle('timers:updateTitle', (_event, { id, title }: { id: string; title: string }) =>
    timerStore.updateTimerTitle(id, title)
  )

  timerStore.onTimersChanged((snapshot) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('timers:changed', snapshot)
    }
  })
}
