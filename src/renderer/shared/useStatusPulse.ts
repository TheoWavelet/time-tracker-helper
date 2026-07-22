import { useEffect, useRef, useState } from 'react'
import type { TimerStatus } from '@shared/types'

const PULSE_DURATION_MS = 500

export type StatusPulse = 'pulse-start' | 'pulse-pause' | null

export function useStatusPulse(status: TimerStatus): StatusPulse {
  const previousStatus = useRef(status)
  const [pulse, setPulse] = useState<StatusPulse>(null)

  useEffect(() => {
    const previous = previousStatus.current
    previousStatus.current = status
    if (previous === status) return

    if (status === 'running') setPulse('pulse-start')
    else if (status === 'paused') setPulse('pulse-pause')
    else return

    const timeout = window.setTimeout(() => setPulse(null), PULSE_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [status])

  return pulse
}
