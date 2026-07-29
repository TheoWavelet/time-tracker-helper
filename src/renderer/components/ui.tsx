import { useCallback, useRef, useState } from 'react'

interface ToastItem {
  id: number
  message: string
  durationMs: number
  actionLabel?: string
  onAction?: () => void
}

interface PushToastOptions {
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
}

let toastIdCounter = 0
const DEFAULT_TOAST_DURATION_MS = 1800

export function useToasts(): {
  toasts: ToastItem[]
  pushToast: (message: string, options?: PushToastOptions) => number
  dismissToast: (id: number) => void
} {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef(new Map<number, number>())

  const dismissToast = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id))
    const timer = timersRef.current.get(id)
    if (timer != null) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const pushToast = useCallback((message: string, options?: PushToastOptions) => {
    const id = ++toastIdCounter
    const durationMs = options?.durationMs ?? DEFAULT_TOAST_DURATION_MS
    setToasts((previous) => [
      ...previous,
      { id, message, durationMs, actionLabel: options?.actionLabel, onAction: options?.onAction }
    ])
    const timer = window.setTimeout(() => {
      timersRef.current.delete(id)
      setToasts((previous) => previous.filter((toast) => toast.id !== id))
    }, durationMs)
    timersRef.current.set(id, timer)
    return id
  }, [])

  return { toasts, pushToast, dismissToast }
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss?: (id: number) => void }): JSX.Element | null {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" style={{ animationDuration: `${toast.durationMs}ms` }}>
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                toast.onAction?.()
                onDismiss?.(toast.id)
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export function TrashIcon(): JSX.Element {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M6 1.5h4a1 1 0 0 1 1 1V3h3v1.5H2V3h3v-.5a1 1 0 0 1 1-1zM3.5 5h9l-.7 8.4a1.2 1.2 0 0 1-1.2 1.1H5.4a1.2 1.2 0 0 1-1.2-1.1L3.5 5z" /></svg>
}

export function LogsIcon(): JSX.Element {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="12" height="2" rx="1" /><rect x="2" y="7" width="12" height="2" rx="1" /><rect x="2" y="11" width="8" height="2" rx="1" /></svg>
}

export function CheckIcon(): JSX.Element {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.5" /></svg>
}

export function PlusIcon(): JSX.Element {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" /></svg>
}

export function ClockPlusIcon(): JSX.Element {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="7" cy="8" r="4.5" /><path d="M7 5.5V8l1.8 1.2M12.5 3.5v4M10.5 5.5h4" /></svg>
}

export function ChevronDownIcon(): JSX.Element {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6" /></svg>
}

export function ChartIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13V9M8 13V5M13 13V7" />
    </svg>
  )
}

export function ChromeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="#EA4335" strokeWidth="4" strokeDasharray="12.57 25.13" strokeDashoffset="0" />
      <circle cx="8" cy="8" r="6" fill="none" stroke="#FBBC05" strokeWidth="4" strokeDasharray="12.57 25.13" strokeDashoffset="-12.57" />
      <circle cx="8" cy="8" r="6" fill="none" stroke="#34A853" strokeWidth="4" strokeDasharray="12.57 25.13" strokeDashoffset="-25.13" />
      <circle cx="8" cy="8" r="3" fill="#4285F4" stroke="#fff" strokeWidth="1" />
    </svg>
  )
}

export function EdgeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="6.5" cy="8" r="6" fill="#00B7C3" />
      <circle cx="10" cy="7" r="5" fill="#0078D4" opacity="0.85" />
    </svg>
  )
}

export function GearIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}