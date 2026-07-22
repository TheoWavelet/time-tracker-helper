import type { DashboardApi } from '../../../preload/dashboard'

declare global {
  interface Window {
    api: DashboardApi
  }
}

export {}
