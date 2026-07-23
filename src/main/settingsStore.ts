import Store from 'electron-store'
import type { AppSettings, DockSide } from '@shared/types'

const defaults: AppSettings = {
  dockSide: 'right',
  dockYOffset: null,
  highlightPausedTimers: true,
  browserDomainFilter: 'atlassian.net'
}

const store = new Store<AppSettings>({ defaults })

export function getSettings(): AppSettings {
  return {
    dockSide: store.get('dockSide'),
    dockYOffset: store.get('dockYOffset'),
    highlightPausedTimers: store.get('highlightPausedTimers'),
    browserDomainFilter: store.get('browserDomainFilter')
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
