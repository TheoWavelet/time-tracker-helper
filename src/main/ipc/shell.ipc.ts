import { ipcMain, shell } from 'electron'

export function registerShellIpc(): void {
  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url))
}
