import path from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'
import { showDashboardWindow } from './windows/dashboardWindow'
import { getSnapshot, pauseTimer } from './timerStore'

let tray: Tray | null = null

function createTrayIcon(): Electron.NativeImage {
  // Windows wants the multi-resolution .ico; everywhere else (Linux, macOS) uses the dedicated
  // small PNG instead — a single 512px source would look oversized once Electron scales it down.
  const filename = process.platform === 'win32' ? 'icon.ico' : 'tray-icon.png'
  const iconPath = app.isPackaged ? path.join(process.resourcesPath, filename) : path.join(app.getAppPath(), 'build', filename)
  return nativeImage.createFromPath(iconPath)
}

export function createTray(): Tray {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('Time Tracker')
  tray.on('click', () => showDashboardWindow())
  refreshTrayMenu()
  return tray
}

export function refreshTrayMenu(): void {
  if (!tray) return

  const snapshot = getSnapshot()
  const running = snapshot.timers.find((t) => t.id === snapshot.runningTimerId) ?? null

  const menu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => showDashboardWindow() },
    { type: 'separator' },
    running
      ? { label: `Pause "${running.title}"`, click: () => pauseTimer(running.id) }
      : { label: 'No timer running', enabled: false },
    { type: 'separator' },
    {
      label: 'Quit Time Tracker',
      click: () => {
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
}
