import path from 'node:path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import { isQuitting } from '../appState'

let dashboardWindow: BrowserWindow | null = null

export function createDashboardWindow(): BrowserWindow {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) return dashboardWindow

  dashboardWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/dashboard.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  dashboardWindow.on('ready-to-show', () => dashboardWindow?.show())

  dashboardWindow.on('close', (event) => {
    if (!isQuitting()) {
      event.preventDefault()
      dashboardWindow?.hide()
    }
  })

  dashboardWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    dashboardWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/dashboard/`)
  } else {
    dashboardWindow.loadFile(path.join(__dirname, '../renderer/dashboard/index.html'))
  }

  return dashboardWindow
}

export function showDashboardWindow(): void {
  const win = createDashboardWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

export function registerDashboardIpc(): void {
  ipcMain.handle('dashboard:show', () => showDashboardWindow())
}
