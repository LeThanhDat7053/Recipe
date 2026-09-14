import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LoaderCircle, X } from 'lucide-react'
import { useLockBody } from '../lib/hooks'
import { cx } from '../lib/utils'

export function Spinner({ className, size = 28 }) {
  return (
    <div className={cx('flex justify-center text-brand', className)}>
      <LoaderCircle size={size} className="animate-spin" />
    </div>
  )
}

export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback, { replace: true }))
}

export function PageHeader({ title, back, backTo = '/', right, children }) {
  const goBack = useGoBack(backTo)
  return (
    <header className="sticky top-0 z-30 pt-safe bg-bg/85 backdrop-blur-xl">
      <div className="flex items-center gap-1 h-14 px-2">
        {back ? (
          <button onClick={goBack} className="icon-btn active:bg-surface-2" aria-label="Quay lại">
            <ChevronLeft size={26} />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="flex-1 min-w-0 truncate text-xl font-bold tracking-tight">{title}</h1>
        {right}
      </div>
      {children}
    </header>
  )
}

export function EmptyState({ emoji = '🍳', title, text, action }) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-14 animate-fade-in">
      <div className="text-6xl mb-4">{emoji}</div>
      <p className="text-lg font-bold">{title}</p>
      {text && <p className="mt-1 text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Sheet({ open, onClose, title, children, footer }) {
  useLockBody(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-t-[1.75rem] bg-bg shadow-2xl animate-slide-up"
      >
        <div className="flex justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        {title && (
          <div className="flex items-center gap-2 pl-5 pr-2 pt-1">
            <h2 className="flex-1 text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="icon-btn active:bg-surface-2" aria-label="Đóng">
              <X size={22} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmSheet({ open, onClose, onConfirm, title, message, confirmText = 'Xác nhận', danger, busy }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-soft" onClick={onClose}>
            Huỷ
          </button>
          <button
            className={danger ? 'btn bg-danger text-white' : 'btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <LoaderCircle size={20} className="animate-spin" /> : confirmText}
          </button>
        </div>
      }
    >
      <div className="pt-3 text-center">
        <p className="text-lg font-bold">{title}</p>
        {message && <p className="mt-1.5 text-muted">{message}</p>}
      </div>
    </Sheet>
  )
}

export function Stepper({ value, onChange, min = 1, max = 99 }) {
  return (
    <div className="inline-flex items-center rounded-full bg-surface-2 p-1">
      <button
        type="button"
        className="size-9 grid place-items-center rounded-full bg-surface text-lg font-bold shadow-sm active:scale-90 transition disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Giảm"
      >
        −
      </button>
      <span className="w-10 text-center font-bold tabular-nums">{value}</span>
      <button
        type="button"
        className="size-9 grid place-items-center rounded-full bg-surface text-lg font-bold shadow-sm active:scale-90 transition disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Tăng"
      >
        +
      </button>
    </div>
  )
}
