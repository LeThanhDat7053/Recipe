import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from './ui'
import { useStore } from '../store'
import { formatVnd, formatVndShort, normalize, parsePrice, timeAgo } from '../lib/utils'

const QUICK = [5000, 10000, 20000, 50000, 100000]

/** Nhập giá cho một thứ vừa mua. purchase: bản ghi đang sửa (nếu có) */
export function PriceSheet({ open, onClose, item, purchase, onSave, onDelete }) {
  const { purchases } = useStore()
  const [text, setText] = useState('')

  useEffect(() => {
    if (open) setText(purchase?.price ? String(purchase.price) : '')
  }, [open, purchase])

  const price = parsePrice(text)
  const last = useMemo(
    () => item && purchases.find((p) => p.id !== purchase?.id && p.price > 0 && normalize(p.name) === normalize(item.name)),
    [item, purchases, purchase],
  )

  const save = (e) => {
    e?.preventDefault()
    if (price > 0) onSave(price)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={purchase ? 'Sửa giá' : 'Mua hết bao nhiêu?'}
      footer={
        <div className="flex gap-3">
          {purchase ? (
            <button className="btn-danger px-4" onClick={onDelete} aria-label="Xoá giá">
              <Trash2 size={18} />
            </button>
          ) : (
            <button className="btn-soft" onClick={onClose}>
              Bỏ qua
            </button>
          )}
          <button className="btn-primary flex-1" onClick={save} disabled={!(price > 0)}>
            {price > 0 ? `Lưu ${formatVnd(price)}` : 'Lưu giá'}
          </button>
        </div>
      }
    >
      <form onSubmit={save} className="pt-2 space-y-3">
        {item && (
          <p className="text-muted">
            {[item.amount, item.unit].filter(Boolean).join(' ')} <b className="text-ink">{item.name}</b>
          </p>
        )}
        <div className="relative">
          <input
            autoFocus
            inputMode="decimal"
            enterKeyHint="done"
            className="input h-16 text-3xl font-bold pr-12"
            placeholder="0"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-muted pointer-events-none">đ</span>
        </div>
        <p className="text-sm text-muted">{price > 0 ? `= ${formatVnd(price)}` : 'Gõ 25 hoặc 25k = 25.000đ · 1tr2 = 1.200.000đ'}</p>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((v) => (
            <button type="button" key={v} onClick={() => setText(String((price || 0) + v))} className="chip">
              +{formatVndShort(v)}
            </button>
          ))}
        </div>
        {last && (
          <button type="button" onClick={() => setText(String(last.price))} className="w-full text-left rounded-2xl bg-surface-2 px-4 py-3 text-sm">
            Lần trước: <b>{formatVnd(last.price)}</b>
            {last.amount && ` cho ${[last.amount, last.unit].filter(Boolean).join(' ')}`} · {timeAgo(last.bought_at)}
            <span className="block text-brand font-medium mt-0.5">Dùng giá này</span>
          </button>
        )}
      </form>
    </Sheet>
  )
}
