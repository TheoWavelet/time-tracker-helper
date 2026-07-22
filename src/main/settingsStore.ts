import Store from 'electron-store'
import type { AppSettings, DockSide } from '@shared/types'

const defaults: AppSettings = {
  dockSide: 'right',
  dockYOffset: null
}

const store = new Store<AppSettings>({ defaults })

export function getSettings(): AppSettings {
  return { dockSide: store.get('dockSide'), dockYOffset: store.get('dockYOffset') }
}

export function setDockSide(dockSide: DockSide): AppSettings {
  store.set('dockSide', dockSide)
  return getSettings()
}

export function setDockYOffset(dockYOffset: number | null): AppSettings {
  store.set('dockYOffset', dockYOffset)
  return getSettings()
}
