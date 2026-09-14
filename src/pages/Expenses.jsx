import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, LoaderCircle, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { EmptyState, PageHeader, Sheet } from '../components/ui'
import { cx, formatVnd, formatVndShort, normalize, nowISO, parsePrice } from '../lib/utils'

const PERIODS = [
  ['week', 'Tuần'],
  ['month', 'Tháng'],
  ['year', 'Năm'],
]
const PREV_NAME = { week: 'tuần trước', month: 'tháng trước', year: 'năm trước' }
const DAY = 86400000
const pad = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const shortDate = (d) => `${d.getDate()}/${d.getMonth() + 1}`
const sumPrice = (list) => list.reduce((s, p) => s + (p.price || 0), 0)
const inRange = (p, start, end) => {
  const t = new Date(p.bought_at).getTime()
  return t >= start.getTime() && t < end.getTime()
}

function getRange(period, offset) {
  const now = new Date()
  if (period === 'week') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = new Date(today)
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7) // tuần bắt đầu Thứ Hai
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return { start, end }
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) }
  }
  const start = new Date(now.getFullYear() + offset, 0, 1)
  return { start, end: new Date(start.getFullYear() + 1, 0, 1) }
}

function getBuckets(period, start, end) {
  if (period === 'week') {
    return ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((label, i) => {
      const s = new Date(start)
      s.setDate(start.getDate() + i)
      const e = new Date(s)
      e.setDate(s.getDate() + 1)
      return { start: s, end: e, label, title: s.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' }) }
    })
  }
  if (period === 'month') {
    const days = Math.round((end - start) / DAY)
    return Array.from({ length: days }, (_, i) => {
      const s = new Date(start.getFullYear(), start.getMonth(), i + 1)
      const e = new Date(start.getFullYear(), start.getMonth(), i + 2)
      return { start: s, end: e, label: i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : '', title: `Ngày ${shortDate(s)}` }
    })
  }
  return Array.from({ length: 12 }, (_, i) => ({
    start: new Date(start.getFullYear(), i, 1),
    end: new Date(start.getFullYear(), i + 1, 1),
    label: String(i + 1),
    title: `Tháng ${i + 1}/${start.getFullYear()}`,
  }))
}

/** Làm tròn trục lên số đẹp: 1 / 2 / 5 × 10^n */
function niceMax(v) {
  if (v <= 0) return 0
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

export default function Expenses() {
  const { purchases } = useStore()
  const [period, setPeriod] = useState('month')
  const [offset, setOffset] = useState(0)
  const [active, setActive] = useState(null)
  const [editing, setEditing] = useState(null) // {} = thêm mới | purchase

  const { start, end } = getRange(period, offset)
  const prev = getRange(period, offset - 1)
  const key = `${period}:${offset}`

  const list = useMemo(() => purchases.filter((p) => inRange(p, start, end)), [purchases, key]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = sumPrice(list)
  const prevTotal = useMemo(() => sumPrice(purchases.filter((p) => inRange(p, prev.start, prev.end))), [purchases, key]) // eslint-disable-line react-hooks/exhaustive-deps
  const buckets = useMemo(
    () => getBuckets(period, start, end).map((b) => ({ ...b, total: sumPrice(list.filter((p) => inRange(p, b.start, b.end))) })),
    [list, key], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const top = useMemo(() => {
    const map = new Map()
    list.forEach((p) => {
      const k = normalize(p.name)
      const e = map.get(k) || { name: p.name, total: 0, count: 0 }
      e.total += p.price || 0
      e.count++
      map.set(k, e)
    })
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5)
  }, [list])
  const days = useMemo(() => {
    const map = new Map()
    list.forEach((p) => {
      const d = new Date(p.bought_at)
      const k = dateKey(d)
      if (!map.has(k)) map.set(k, { key: k, date: d, items: [] })
      map.get(k).items.push(p)
    })
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [list])

  useEffect(() => setActive(null), [key])

  const lastDay = new Date(end - DAY)
  const label =
    period === 'week'
      ? offset === 0 ? 'Tuần này' : offset === -1 ? 'Tuần trước' : `Tuần ${shortDate(start)}`
      : period === 'month'
        ? offset === 0 ? 'Tháng này' : `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`
        : offset === 0 ? 'Năm nay' : `Năm ${start.getFullYear()}`
  const sub =
    period === 'week' ? `${shortDate(start)} – ${shortDate(lastDay)}` : period === 'month' ? `Tháng ${start.getMonth() + 1}/${start.getFullYear()}` : String(start.getFullYear())

  // Trung bình: theo ngày (tuần/tháng) hoặc theo tháng (năm), chỉ tính phần đã trôi qua
  const now = new Date()
  const avg =
    period === 'year'
      ? total / (offset === 0 ? now.getMonth() + 1 : 12)
      : total / Math.max(1, Math.min(buckets.length, offset === 0 ? Math.floor((now - start) / DAY) + 1 : buckets.length))
  const pct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null

  return (
    <>
      <PageHeader
        back
        backTo="/shopping"
        title="Sổ tiền chợ"
        right={
          <button onClick={() => setEditing({})} className="icon-btn text-brand" aria-label="Thêm khoản chi">
            <Plus size={24} />
          </button>
        }
      >
        <div className="mx-4 mb-3 flex rounded-2xl bg-surface-2 p-1">
          {PERIODS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => {
                setPeriod(k)
                setOffset(0)
              }}
              className={cx('flex-1 h-9 rounded-xl text-sm font-semibold transition', period === k ? 'bg-surface text-ink shadow-sm' : 'text-muted')}
            >
              {l}
            </button>
          ))}
        </div>
      </PageHeader>

      {purchases.length === 0 ? (
        <EmptyState
          emoji="💰"
          title="Chưa có khoản chi nào"
          text="Khi đi chợ, tick đã mua rồi nhập giá. Hoặc bấm nút + để ghi tay."
          action={
            <button className="btn-primary px-6" onClick={() => setEditing({})}>
              <Plus size={18} /> Ghi khoản chi
            </button>
          }
        />
      ) : (
        <div className="px-4 space-y-6 pb-6">
          <section>
            <div className="flex items-center justify-between">
              <button onClick={() => setOffset((o) => o - 1)} className="icon-btn" aria-label="Kỳ trước">
                <ChevronLeft size={22} />
              </button>
              <div className="text-center">
                <p className="font-semibold">{label}</p>
                <p className="text-xs text-muted">{sub}</p>
              </div>
              <button onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} className="icon-btn disabled:opacity-30" aria-label="Kỳ sau">
                <ChevronRight size={22} />
              </button>
            </div>

            <p className="mt-3 text-center text-5xl font-bold tracking-tight">{formatVnd(total)}</p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted">
              {pct == null ? (
                `Chưa có dữ liệu ${PREV_NAME[period]} để so sánh`
              ) : (
                <>
                  {pct >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  <span>
                    <b className="text-ink">
                      {pct > 0 ? '+' : ''}
                      {pct}%
                    </b>{' '}
                    so với {PREV_NAME[period]} ({formatVndShort(prevTotal)})
                  </span>
                </>
              )}
            </p>
            {total > 0 && (
              <p className="mt-1 text-center text-sm text-muted">
                Trung bình {formatVndShort(avg)}/{period === 'year' ? 'tháng' : 'ngày'} · {list.length} lần mua
              </p>
            )}
          </section>

          <section className="card p-4">
            <BarChart buckets={buckets} active={active} onActive={setActive} />
          </section>

          {top.length > 0 && (
            <section>
              <h2 className="section-title mb-2">Tốn tiền nhất</h2>
              <ul className="card divide-y divide-line">
                {top.map((t) => (
                  <li key={t.name} className="px-4 py-3">
                    <div className="flex items-baseline gap-2">
                      <span className="flex-1 min-w-0 truncate font-medium">{t.name}</span>
                      <span className="text-xs text-muted">{t.count} lần</span>
                      <span className="font-semibold tabular-nums">{formatVnd(t.total)}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full bg-chart" style={{ width: `${(t.total / top[0].total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="section-title mb-2">Chi tiết</h2>
            {days.length === 0 ? (
              <p className="py-6 text-center text-muted">Không có khoản chi nào trong kỳ này</p>
            ) : (
              <div className="space-y-4">
                {days.map((d) => (
                  <div key={d.key}>
                    <div className="flex items-baseline justify-between px-1 pb-1">
                      <p className="text-sm font-semibold first-letter:uppercase">
                        {d.date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                      </p>
                      <p className="text-sm text-muted tabular-nums">{formatVnd(sumPrice(d.items))}</p>
                    </div>
                    <ul className="card divide-y divide-line overflow-hidden">
                      {d.items.map((p) => (
                        <li key={p.id}>
                          <button onClick={() => setEditing(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                            <span className="flex-1 min-w-0">
                              <span className="block font-medium truncate">
                                {p.name}
                                {(p.amount || p.unit) && <span className="font-normal text-muted"> · {[p.amount, p.unit].filter(Boolean).join(' ')}</span>}
                              </span>
                              {(p.recipe_title || p.note) && <span className="block text-xs text-muted truncate">{p.note || p.recipe_title}</span>}
                            </span>
                            <span className="font-semibold tabular-nums">{formatVnd(p.price)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <ExpenseSheet open={!!editing} onClose={() => setEditing(null)} purchase={editing} />
    </>
  )
}

function BarChart({ buckets, active, onActive }) {
  const max = Math.max(0, ...buckets.map((b) => b.total))
  const axisTop = niceMax(max)
  const maxIdx = max > 0 ? buckets.findIndex((b) => b.total === max) : -1
  const shown = active != null ? buckets[active] : maxIdx >= 0 ? buckets[maxIdx] : null

  return (
    <div onPointerLeave={(e) => e.pointerType === 'mouse' && onActive(null)}>
      <p className="h-5 text-sm">
        {shown ? (
          <>
            <span className="text-muted">{active != null ? `${shown.title}:` : `Cao nhất · ${shown.title}:`}</span>{' '}
            <b className="tabular-nums">{formatVnd(shown.total)}</b>
          </>
        ) : (
          <span className="text-muted">Chưa có khoản chi trong kỳ này</span>
        )}
      </p>
      <div className="relative mt-3 h-40">
        {axisTop > 0 && (
          <>
            <span className="absolute left-0 -top-1 text-[11px] text-muted tabular-nums">{formatVndShort(axisTop)}</span>
            <div className="absolute inset-x-0 top-4 border-t border-line" />
            <div className="absolute inset-x-0 top-[calc(50%+0.5rem)] border-t border-line" />
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 top-4 flex items-end gap-0.5 border-b border-line">
          {buckets.map((b, i) => {
            const h = axisTop ? (b.total / axisTop) * 100 : 0
            return (
              <button
                key={i}
                type="button"
                onClick={() => onActive(active === i ? null : i)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onActive(i)}
                aria-label={`${b.title}: ${formatVnd(b.total)}`}
                className="flex-1 h-full flex items-end justify-center"
              >
                <span
                  className={cx('w-full max-w-6 rounded-t-[4px] bg-chart transition-opacity', active != null && active !== i && 'opacity-35')}
                  style={{ height: b.total > 0 ? `max(${h}%, 3px)` : 0 }}
                />
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-0.5">
        {buckets.map((b, i) => (
          <span key={i} className={cx('flex-1 text-center text-[10px] tabular-nums', active === i ? 'text-ink font-semibold' : 'text-muted')}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ExpenseSheet({ open, onClose, purchase }) {
  const { savePurchase, deletePurchase } = useStore()
  const toast = useToast()
  const isNew = !purchase?.id
  const [form, setForm] = useState({ name: '', price: '', date: '', note: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      name: purchase?.name || '',
      price: purchase?.price ? String(purchase.price) : '',
      date: dateKey(purchase?.bought_at ? new Date(purchase.bought_at) : new Date()),
      note: purchase?.note || '',
    })
  }, [open, purchase])

  const price = parsePrice(form.price)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const save = async (e) => {
    e?.preventDefault()
    if (!(price > 0)) return
    setBusy(true)
    try {
      const originalKey = purchase?.bought_at ? dateKey(new Date(purchase.bought_at)) : null
      const bought_at =
        form.date === originalKey
          ? purchase.bought_at
          : form.date === dateKey(new Date())
            ? nowISO()
            : new Date(`${form.date}T12:00:00`).toISOString()
      await savePurchase({ ...(purchase || {}), name: form.name, note: form.note.trim(), price, bought_at })
      toast(isNew ? 'Đã ghi khoản chi' : 'Đã cập nhật')
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    try {
      await deletePurchase(purchase.id)
      toast('Đã xoá khoản chi')
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? 'Ghi khoản chi' : 'Sửa khoản chi'}
      footer={
        <div className="flex gap-3">
          {!isNew && (
            <button className="btn-danger px-4" onClick={remove} aria-label="Xoá">
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn-primary flex-1" onClick={save} disabled={busy || !(price > 0)}>
            {busy ? <LoaderCircle size={20} className="animate-spin" /> : price > 0 ? `Lưu ${formatVnd(price)}` : 'Lưu'}
          </button>
        </div>
      }
    >
      <form onSubmit={save} className="pt-2 space-y-4">
        <div>
          <label className="label" htmlFor="exp-name">Mua gì</label>
          <input id="exp-name" className="input" placeholder="VD: Chợ sáng, Thịt bò, Siêu thị…" value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus={isNew} />
        </div>
        <div>
          <label className="label" htmlFor="exp-price">Số tiền</label>
          <div className="relative">
            <input
              id="exp-price"
              inputMode="decimal"
              className="input h-14 text-2xl font-bold pr-12"
              placeholder="0"
              value={form.price}
              onChange={(e) => set({ price: e.target.value })}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted pointer-events-none">đ</span>
          </div>
          <p className="mt-1.5 text-sm text-muted">{price > 0 ? `= ${formatVnd(price)}` : 'Gõ 250 hoặc 250k = 250.000đ'}</p>
        </div>
        <div>
          <label className="label" htmlFor="exp-date">Ngày</label>
          <input id="exp-date" type="date" className="input" value={form.date} max={dateKey(new Date())} onChange={(e) => set({ date: e.target.value || dateKey(new Date()) })} />
        </div>
        <div>
          <label className="label" htmlFor="exp-note">Ghi chú</label>
          <input id="exp-note" className="input" placeholder="VD: mua ở chợ Bến Thành" value={form.note} onChange={(e) => set({ note: e.target.value })} />
        </div>
      </form>
    </Sheet>
  )
}
