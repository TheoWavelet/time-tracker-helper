import { ipcMain } from 'electron'
import { hasClockworkApiToken, setClockworkApiToken } from '../clockworkTokenStore'
import type { ClockworkStatus } from '@shared/types'

export function registerClockworkIpc(): void {
  ipcMain.handle('clockwork:getStatus', (): ClockworkStatus => ({ hasToken: hasClockworkApiToken() }))

  ipcMain.handle('clockwork:setApiToken', (_event, token: string): ClockworkStatus => {
    setClockworkApiToken(token)
    return { hasToken: hasClockworkApiToken() }
  })
}
