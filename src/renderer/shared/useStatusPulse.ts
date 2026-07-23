import { useEffect, useRef, useState } from 'react'
import type { TimerDTO, TimerStatus } from '@shared/types'

const PULSE_DURATION_MS = 500

export type StatusPulse = 'pulse-start' | 'pulse-pause' | null

/**
 * `pausedReason` gates the pause flash to a manual click — pausing as a side effect of starting
 * or resuming a *different* timer ('switched'), or of idle detection, shouldn't flash this row.
 */
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
