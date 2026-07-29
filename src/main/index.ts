import { app } from 'electron'
import { getDb } from './db/connection'
import { backfillClockworkIssueKeys } from './db/repositories/tags.repo'
import { registerTimerIpc } from './ipc/timers.ipc'
import { registerTagsIpc } from './ipc/tags.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { registerShellIpc } from './ipc/shell.ipc'
import { registerBrowserIpc } from './ipc/browser.ipc'
import { registerArchiveIpc } from './ipc/archive.ipc'
import { registerClockworkIpc } from './ipc/clockwork.ipc'
import { createOverlayWindow, registerOverlayIpc, applyDockSide, setActiveTimerCount } from './windows/overlayWindow'
import { showDashboardWindow, registerDashboardIpc } from './windows/dashboardWindow'
import { registerStatsWindowIpc } from './windows/statsWindow'
import { createTray, refreshTrayMenu } from './tray'
import { getSnapshot, onTimersChanged } from './timerStore'
import { startIdleMonitor } from './idleMonitor'
import { startBrowserBridge } from './browserBridge'
import { startClockworkSync } from './clockworkSync'
import type { TimersSnapshot } from '@shared/types'

function countActiveTimers(snapshot: TimersSnapshot): number {
  return snapshot.timers.filter((t) => t.status === 'running' || t.status === 'paused').length
}

// Works around a well-known Chromium/Windows quirk where a transparent, frameless BrowserWindow
// (the overlay) briefly flashes its opaque backing surface during GPU-compositor redraws —
// especially frequent here since hovering the collapsed bar and expand/collapse both animate its
// bounds continuously. Must be called before app is ready / any window is created.
app.disableHardwareAcceleration()

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.setAppUserModelId('com.timetrackinghelper.app')

  app.on('second-instance', () => {
    showDashboardWindow()
  })

  app.whenReady().then(() => {
    getDb()
    backfillClockworkIssueKeys()

    registerTimerIpc()
    registerTagsIpc()
    registerSettingsIpc(applyDockSide)
    registerOverlayIpc()
    registerShellIpc()
    registerDashboardIpc()
    registerBrowserIpc()
    registerArchiveIpc()
    registerStatsWindowIpc()
    registerClockworkIpc()

    createOverlayWindow()
    createTray()
    startIdleMonitor()
    startBrowserBridge()
    startClockworkSync()

    setActiveTimerCount(countActiveTimers(getSnapshot()))
    onTimersChanged((snapshot) => {
      refreshTrayMenu()
      setActiveTimerCount(countActiveTimers(snapshot))
    })
  })

  app.on('window-all-closed', () => {
    // This is a tray app — closing/hiding the dashboard window must not quit it.
  })
}
