import type { OverlayApi } from '../../../preload/overlay'

declare global {
  interface Window {
    api: OverlayApi
  }
}

export {}
