import { useEffect, useRef, useState } from 'react'
import type { TimerDTO, TimerStatus } from '@shared/types'

const PULSE_DURATION_MS = 500

export type StatusPulse = 'pulse-start' | 'pulse-pause' | null

export function useElapsedMs(timer: TimerDTO | null | undefined): number {
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!timer || timer.status !== 'running') return
    const interval = setInterval(() => forceTick((value) => value + 1), 250)
    return () => clearInterval(interval)
  }, [timer?.id, timer?.status])

  if (!timer) return 0
  const isRunning = timer.status === 'running' && timer.currentSegmentStartedAt != null
  return timer.accumulatedMs + (isRunning ? Date.now() - timer.currentSegmentStartedAt! : 0)
}

export function useStatusPulse(status: TimerStatus, pausedReason: TimerDTO['pausedReason']): StatusPulse {
  const previousStatus = useRef(status)
  const [pulse, setPulse] = useState<StatusPulse>(null)

  useEffect(() => {
    const previous = previousStatus.current
    previousStatus.current = status
    if (previous === status) return

    if (status === 'running') setPulse('pulse-start')
    else if (status === 'paused' && pausedReason === 'manual') setPulse('pulse-pause')
    else return

    const timeout = window.setTimeout(() => setPulse(null), PULSE_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [status, pausedReason])

  return pulse
}