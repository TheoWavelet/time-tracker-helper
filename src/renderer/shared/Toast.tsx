import { useCallback, useState } from 'react'

interface ToastItem {
  id: number
  message: string
}

let toastIdCounter = 0
const TOAST_DURATION_MS = 1800

export function useToasts(): { toasts: ToastItem[]; pushToast: (message: string) => void } {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushToast = useCallback((message: string) => {
    const id = ++toastIdCounter
    setToasts((prev) => [...prev, { id, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
  }, [])

  return { toasts, pushToast }
}

export function ToastStack({ toasts }: { toasts: ToastItem[] }): JSX.Element | null {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          {toast.message}
        </div>
      ))}
    </div>
  )
}
