import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ListChecks, PartyPopper, RotateCcw, SlidersHorizontal, Timer, Volume2, VolumeX, X } from 'lucide-react'
import { VoiceSheet } from '../components/VoiceSheet'
import { useStore } from '../store'
import { QuickTimerSheet, TimerList, useTimers } from '../timers'
import { useToast } from '../components/Toast'
import { LogSheet } from '../components/RecipeSheets'
import { CheckCircle, EmptyState, Sheet, Spinner, Stepper, useGoBack } from '../components/ui'
import { useSessionState, useSpeech, useWakeLock } from '../lib/hooks'
import { cx, detectTimers, scaleAmount } from '../lib/utils'

export default function CookMode() {
  const { id } = useParams()
  const { recipes, loading } = useStore()
  const recipe = recipes.find((r) => r.id === id)
  if (!recipe) return loading ? <Spinner className="pt-40" /> : <EmptyState emoji="🥲" title="Không tìm thấy món này" />
  return <Cook key={recipe.id} recipe={recipe} />
}

function Cook({ recipe }) {
  const toast = useToast()
  const goBack = useGoBack(`/recipe/${recipe.id}`)
  const steps = (recipe.steps || []).filter((s) => s.text?.trim() || s.image_url)
  const [index, setIndex] = useSessionState(`cook:${recipe.id}`, 0)
  const current = Math.min(index, Math.max(0, steps.length - 1))
  const step = steps[current]
  const isLast = current === steps.length - 1

  const wake = useWakeLock(true)
  const speech = useSpeech()
  const [autoRead, setAutoRead] = useState(false)
  const { timers, start } = useTimers()
  const [sheet, setSheet] = useState(null) // ing | log

  const baseServings = recipe.servings || 1
  const [servings, setServings] = useSessionState(`servings:${recipe.id}`, baseServings)
  const [checked, setChecked] = useSessionState(`ing:${recipe.id}`, [])
  const factor = servings / baseServings
  const touch = useRef(null)

  useEffect(() => {
    if (autoRead && step?.text) speech.speak(`Bước ${current + 1}. ${step.text}`)
  }, [current, autoRead]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!steps.length) {
    return (
      <div className="pt-safe">
        <EmptyState
          emoji="📝"
          title="Món này chưa có các bước"
          action={
            <Link to={`/recipe/${recipe.id}/edit`} className="btn-primary px-6">
              Thêm các bước
            </Link>
          }
        />
      </div>
    )
  }

  const go = (dir) => {
    const next = current + dir
    if (next < 0) return
    if (next >= steps.length) {
      speech.stop()
      setSheet('log')
      return
    }
    setIndex(next)
    window.scrollTo({ top: 0 })
  }

  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
  }

  const toggleRead = () => {
    if (autoRead) {
      setAutoRead(false)
      speech.stop()
    } else {
      setAutoRead(true)
      toast('Sẽ tự đọc to mỗi bước')
    }
  }

  const finish = () => {
    setIndex(0)
    goBack()
  }

  const detected = detectTimers(step.text)

  return (
    <div className="min-h-dvh" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="sticky top-0 z-20 pt-safe bg-bg/95 backdrop-blur-xl">
        <div className="flex items-center gap-1 h-14 px-2">
          <button onClick={goBack} className="icon-btn" aria-label="Thoát chế độ nấu">
            <X size={24} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="truncate font-semibold leading-tight">{recipe.title}</p>
            {wake.on && <p className="text-[11px] text-muted leading-tight">Màn hình luôn sáng</p>}
          </div>
          {speech.supported && (
            <>
              <button onClick={() => setSheet('voice')} className="icon-btn" aria-label="Cài đặt giọng đọc">
                <SlidersHorizontal size={20} />
              </button>
              <button onClick={toggleRead} className={cx('icon-btn', autoRead && 'bg-brand-soft text-brand')} aria-label="Đọc to">
                {autoRead ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>
            </>
          )}
          <button onClick={() => setSheet('ing')} className="icon-btn" aria-label="Nguyên liệu">
            <ListChecks size={22} />
          </button>
        </div>
        <div className="flex gap-1 px-4 pb-3">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= current ? 'bg-brand' : 'bg-line')}
              aria-label={`Tới bước ${i + 1}`}
            />
          ))}
        </div>
      </header>

      <main key={current} className="px-5 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] animate-fade-in">
        <p className="text-sm font-bold uppercase tracking-wider text-brand">
          Bước {current + 1} / {steps.length}
        </p>
        <p className="mt-3 text-[1.5rem] leading-relaxed font-medium whitespace-pre-wrap">{step.text}</p>
        {step.image_url && <img src={step.image_url} alt="" className="mt-5 w-full max-h-[40dvh] object-cover rounded-3xl" />}

        <div className="mt-6 flex flex-wrap gap-2">
          {detected.map((t) => (
            <button
              key={t.seconds}
              onClick={() => {
                start({ label: `Bước ${current + 1} · ${t.label}`, seconds: t.seconds, recipeId: recipe.id, recipeTitle: recipe.title })
                toast(`Đã hẹn giờ ${t.label}`)
              }}
              className="btn h-12 bg-brand-soft text-brand"
            >
              <Timer size={20} /> Hẹn giờ {t.label}
            </button>
          ))}
          <button onClick={() => setSheet('timer')} className="btn-soft h-12">
            <Timer size={20} /> {detected.length ? 'Hẹn giờ khác' : 'Hẹn giờ'}
          </button>
          {speech.supported && !autoRead && (
            <button onClick={() => speech.speak(`Bước ${current + 1}. ${step.text}`)} className="btn-soft h-12">
              <Volume2 size={20} /> Đọc bước này
            </button>
          )}
        </div>

        {timers.length > 0 && (
          <div className="mt-8">
            <p className="label">Đồng hồ đang chạy</p>
            <TimerList />
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted">Vuốt trái / phải để chuyển bước</p>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 bg-bg/95 backdrop-blur-xl border-t border-line">
        <div className="mx-auto max-w-2xl flex gap-3 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button onClick={() => go(-1)} disabled={current === 0} className="btn-soft w-16 h-14 shrink-0" aria-label="Bước trước">
            <ArrowLeft size={24} />
          </button>
          <button onClick={() => go(1)} className="btn-primary flex-1 h-14 text-base">
            {isLast ? (
              <>
                <PartyPopper size={22} /> Hoàn thành
              </>
            ) : (
              <>
                Bước tiếp <ArrowRight size={22} />
              </>
            )}
          </button>
        </div>
      </footer>

      <Sheet open={sheet === 'ing'} onClose={() => setSheet(null)} title="Nguyên liệu">
        <div className="flex items-center justify-between py-2">
          <p className="font-semibold">Khẩu phần</p>
          <Stepper value={servings} onChange={setServings} />
        </div>
        <ul>
          {(recipe.ingredients || []).map((ing) =>
            ing.type === 'group' ? (
              <li key={ing.id} className="pt-4 pb-1 text-xs font-bold uppercase tracking-wider text-brand">
                {ing.name}
              </li>
            ) : (
              <li key={ing.id}>
                <button
                  onClick={() => setChecked((l) => (l.includes(ing.id) ? l.filter((x) => x !== ing.id) : [...l, ing.id]))}
                  className="w-full flex items-center gap-3 py-3 text-left border-b border-line"
                >
                  <CheckCircle on={checked.includes(ing.id)} />
                  <span className={cx('flex-1 leading-snug', checked.includes(ing.id) && 'line-through text-muted')}>
                    {(ing.amount || ing.unit) && (
                      <b className="font-semibold mr-1.5">
                        {scaleAmount(ing.amount, factor)} {ing.unit}
                      </b>
                    )}
                    {ing.name}
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
        {checked.length > 0 && (
          <button onClick={() => setChecked([])} className="mt-3 text-sm text-muted flex items-center gap-1.5 mx-auto p-2">
            <RotateCcw size={14} /> Bỏ chọn tất cả
          </button>
        )}
      </Sheet>

      <VoiceSheet open={sheet === 'voice'} onClose={() => setSheet(null)} />
      <QuickTimerSheet open={sheet === 'timer'} onClose={() => setSheet(null)} recipe={recipe} defaultLabel={`Bước ${current + 1}`} />

      <LogSheet
        open={sheet === 'log'}
        onClose={() => setSheet(null)}
        recipe={recipe}
        title="🎉 Xong rồi! Ghi lại lần nấu này?"
        onSaved={finish}
        onSkip={finish}
      />
    </div>
  )
}
