import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CircleCheck, CircleAlert } from 'lucide-react'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef()

  const show = useCallback((message, type = 'ok') => {
    clearTimeout(timer.current)
    setToast({ message, type, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), type === 'error' ? 4000 : 2200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 bottom-[calc(6rem+env(safe-area-inset-bottom))]"
      >
        {toast && (
          <div
            key={toast.key}
            className="animate-pop-in flex items-center gap-2 max-w-sm rounded-2xl bg-ink text-bg px-4 py-3 text-sm font-medium shadow-xl"
          >
            {toast.type === 'error' ? (
              <CircleAlert size={18} className="shrink-0 text-danger" />
            ) : (
              <CircleCheck size={18} className="shrink-0 text-ok" />
            )}
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
