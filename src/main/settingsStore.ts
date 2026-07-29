import Store from 'electron-store'
import type { AppSettings, DockSide, LinkBrowser } from '@shared/types'

const defaults: AppSettings = {
  dockSide: 'right',
  dockYOffset: null,
  highlightPausedTimers: false,
  browserDomainFilter: 'atlassian.net',
  // Off by default even once a token is set — this pushes real time entries to a shared work
  // system, so it should be a deliberate opt-in rather than switching on the moment a token exists.
  clockworkSyncEnabled: false,
  defaultLinkBrowser: 'chrome'
}

const store = new Store<AppSettings>({ defaults })

export function getSettings(): AppSettings {
  return {
    dockSide: store.get('dockSide'),
    dockYOffset: store.get('dockYOffset'),
    highlightPausedTimers: store.get('highlightPausedTimers'),
    browserDomainFilter: store.get('browserDomainFilter'),
    clockworkSyncEnabled: store.get('clockworkSyncEnabled'),
    defaultLinkBrowser: store.get('defaultLinkBrowser')
  }
}

export function setDockSide(dockSide: DockSide): AppSettings {
  store.set('dockSide', dockSide)
  return getSettings()
}

export function setDockYOffset(dockYOffset: number | null): AppSettings {
  store.set('dockYOffset', dockYOffset)
  return getSettings()
}

export function setHighlightPausedTimers(value: boolean): AppSettings {
  store.set('highlightPausedTimers', value)
  return getSettings()
}

export function setBrowserDomainFilter(value: string): AppSettings {
  store.set('browserDomainFilter', value.trim())
  return getSettings()
}

export function setClockworkSyncEnabled(value: boolean): AppSettings {
  store.set('clockworkSyncEnabled', value)
  return getSettings()
}

export function setDefaultLinkBrowser(value: LinkBrowser): AppSettings {
  store.set('defaultLinkBrowser', value)
  return getSettings()
}
