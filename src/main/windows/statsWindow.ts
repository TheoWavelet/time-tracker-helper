import path from 'node:path'
import { BrowserWindow, ipcMain, shell } from 'electron'

let statsWindow: BrowserWindow | null = null

export function createStatsWindow(): BrowserWindow {
  if (statsWindow && !statsWindow.isDestroyed()) return statsWindow

  statsWindow = new BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 420,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/stats.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  statsWindow.on('ready-to-show', () => statsWindow?.show())
  statsWindow.on('closed', () => {
    statsWindow = null
  })

  statsWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    statsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/stats/`)
  } else {
    statsWindow.loadFile(path.join(__dirname, '../renderer/stats/index.html'))
  }

  return statsWindow
}

export function showStatsWindow(): void {
  const win = createStatsWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

export function registerStatsWindowIpc(): void {
  ipcMain.handle('stats:show', () => showStatsWindow())
}
