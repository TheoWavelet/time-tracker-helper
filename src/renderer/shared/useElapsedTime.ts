import { useEffect, useState } from 'react'
import type { TimerDTO } from '@shared/types'

/** Renderer-local ticking clock: never depends on IPC firing every second, just a timestamp diff. */
export function useElapsedMs(timer: TimerDTO | null | undefined): number {
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!timer || timer.status !== 'running') return
    const interval = setInterval(() => forceTick((n) => n + 1), 250)
    return () => clearInterval(interval)
  }, [timer?.id, timer?.status])

  if (!timer) return 0
  const isRunning = timer.status === 'running' && timer.currentSegmentStartedAt != null
  return timer.accumulatedMs + (isRunning ? Date.now() - (timer.currentSegmentStartedAt as number) : 0)
}
