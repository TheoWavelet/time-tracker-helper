import type { StatsApi } from '../../../preload/stats'

declare global {
  interface Window {
    api: StatsApi
  }
}

export {}
