import { app, Menu, nativeImage, Tray } from 'electron'
import { showDashboardWindow } from './windows/dashboardWindow'
import { getSnapshot, pauseTimer } from './timerStore'
import { setQuitting } from './appState'

let tray: Tray | null = null

function createPlaceholderIcon(): Electron.NativeImage {
  const size = 16
  const buffer = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4
    buffer[offset] = 0x0b // B
    buffer[offset + 1] = 0x9e // G
    buffer[offset + 2] = 0xf5 // R (amber)
    buffer[offset + 3] = 0xff // A
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size })
}

export function createTray(): Tray {
  tray = new Tray(createPlaceholderIcon())
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
        setQuitting(true)
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
}
