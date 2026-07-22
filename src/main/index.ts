import { app } from 'electron'
import { getDb } from './db/connection'
import { registerTimerIpc } from './ipc/timers.ipc'
import { registerTagsIpc } from './ipc/tags.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { registerShellIpc } from './ipc/shell.ipc'
import { createOverlayWindow, registerOverlayIpc, applyDockSide, setActiveTimerCount } from './windows/overlayWindow'
import { showDashboardWindow, registerDashboardIpc } from './windows/dashboardWindow'
import { createTray, refreshTrayMenu } from './tray'
import { getSnapshot, onTimersChanged } from './timerStore'
import { startIdleMonitor } from './idleMonitor'
import { setQuitting } from './appState'
import type { TimersSnapshot } from '@shared/types'

function countActiveTimers(snapshot: TimersSnapshot): number {
  return snapshot.timers.filter((t) => t.status === 'running' || t.status === 'paused').length
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showDashboardWindow()
  })

  app.whenReady().then(() => {
    getDb()

    registerTimerIpc()
    registerTagsIpc()
    registerSettingsIpc(applyDockSide)
    registerOverlayIpc()
    registerShellIpc()
    registerDashboardIpc()

    createOverlayWindow()
    createTray()
    startIdleMonitor()

    setActiveTimerCount(countActiveTimers(getSnapshot()))
    onTimersChanged((snapshot) => {
      refreshTrayMenu()
      setActiveTimerCount(countActiveTimers(snapshot))
    })
  })

  app.on('before-quit', () => setQuitting(true))

  app.on('window-all-closed', () => {
    // This is a tray app — closing/hiding the dashboard window must not quit it.
  })
}
