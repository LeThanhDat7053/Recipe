import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, Plus, Timer, X } from 'lucide-react'
import { Sheet } from './components/ui'
import { cx, formatClock, uid } from './lib/utils'

const KEY = 'recipebook:timers:v1'
const TimersContext = createContext(null)

/* ---------------- Âm báo ---------------- */
let audioCtx = null
function unlockAudio() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch { /* ignore */ }
}
function beep() {
  try {
    unlockAudio()
    if (!audioCtx) return
    const t0 = audioCtx.currentTime
    for (let i = 0; i < 3; i++) {
      const start = t0 + i * 0.35
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(start)
      osc.stop(start + 0.3)
    }
  } catch { /* ignore */ }
}

export function TimersProvider({ children }) {
  const [timers, setTimers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || []
    } catch {
      return []
    }
  })
  const [now, setNow] = useState(Date.now)
  const lastAlarm = useRef({})

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(timers))
    } catch { /* ignore */ }
  }, [timers])

  useEffect(() => {
    if (!timers.length) return
    const tick = () => {
      const t = Date.now()
      setNow(t)
      timers.forEach((tm) => {
        const over = t - tm.endAt
        // Kêu + rung mỗi 5 giây trong 90 giây sau khi hết giờ
        if (over >= 0 && over < 90000 && t - (lastAlarm.current[tm.id] || 0) > 5000) {
          lastAlarm.current[tm.id] = t
          beep()
          navigator.vibrate?.([400, 200, 400, 200, 800])
        }
      })
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [timers])

  const start = useCallback(({ label, seconds, recipeId, recipeTitle }) => {
    unlockAudio() // cần thao tác chạm của người dùng để được phát âm thanh
    setNow(Date.now())
    setTimers((ts) => [...ts, { id: uid(), label, seconds, recipeId, recipeTitle, endAt: Date.now() + seconds * 1000 }])
  }, [])
  const addTime = useCallback((id, seconds) => {
    setTimers((ts) => ts.map((t) => (t.id === id ? { ...t, endAt: Math.max(t.endAt, Date.now()) + seconds * 1000 } : t)))
  }, [])
  const remove = useCallback((id) => {
    delete lastAlarm.current[id]
    setTimers((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => ({ timers, now, start, addTime, remove }), [timers, now, start, addTime, remove])
  return <TimersContext.Provider value={value}>{children}</TimersContext.Provider>
}

export const useTimers = () => useContext(TimersContext)

/** Danh sách đồng hồ đầy đủ (trong sheet và chế độ nấu) */
export function TimerList() {
  const { timers, now, addTime, remove } = useTimers()
  const sorted = [...timers].sort((a, b) => a.endAt - b.endAt)
  return (
    <ul className="space-y-2">
      {sorted.map((t) => {
        const left = (t.endAt - now) / 1000
        const done = left <= 0
        return (
          <li key={t.id} className={cx('card flex items-center gap-3 p-3', done && 'border-danger bg-danger/10')}>
            <div className={cx('grid place-items-center size-11 shrink-0 rounded-full', done ? 'bg-danger text-white animate-pulse' : 'bg-brand-soft text-brand')}>
              {done ? <BellRing size={20} /> : <Timer size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cx('text-2xl font-bold tabular-nums leading-none', done && 'text-danger')}>
                {done ? 'Hết giờ!' : formatClock(left)}
              </p>
              <p className="mt-1 text-sm text-muted truncate">
                {t.label}
                {t.recipeTitle && ` · ${t.recipeTitle}`}
              </p>
            </div>
            {!done && (
              <button onClick={() => addTime(t.id, 60)} className="chip h-9 px-3" aria-label="Thêm 1 phút">
                <Plus size={14} /> 1p
              </button>
            )}
            <button
              onClick={() => remove(t.id)}
              className={cx('icon-btn size-10', done ? 'bg-danger text-white' : 'text-muted')}
              aria-label={done ? 'Tắt' : 'Huỷ'}
            >
              <X size={18} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Các đồng hồ nổi ở góc màn hình */
export function TimerDock({ hidden }) {
  const { timers, now, remove } = useTimers()
  const [open, setOpen] = useState(false)
  if (!timers.length) return null
  const sorted = [...timers].sort((a, b) => a.endAt - b.endAt)

  return (
    <>
      {!hidden && (
        <div className="fixed left-3 z-40 bottom-[calc(6rem+env(safe-area-inset-bottom))] flex flex-col items-start gap-2">
          {sorted.slice(0, 3).map((t) => {
            const left = (t.endAt - now) / 1000
            const done = left <= 0
            return (
              <button
                key={t.id}
                onClick={() => (done ? remove(t.id) : setOpen(true))}
                className={cx(
                  'flex items-center gap-2 h-10 pl-3 pr-4 max-w-[70vw] rounded-full shadow-lg text-sm font-semibold animate-pop-in',
                  done ? 'bg-danger text-white animate-pulse' : 'bg-ink text-bg',
                )}
              >
                {done ? <BellRing size={16} /> : <Timer size={16} />}
                <span className="tabular-nums">{done ? 'Xong!' : formatClock(left)}</span>
                <span className="truncate font-normal opacity-80">{t.label}</span>
              </button>
            )
          })}
          {sorted.length > 3 && (
            <button onClick={() => setOpen(true)} className="chip shadow-lg">
              +{sorted.length - 3} đồng hồ
            </button>
          )}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Hẹn giờ">
        <div className="pt-2">
          <TimerList />
        </div>
      </Sheet>
    </>
  )
}
