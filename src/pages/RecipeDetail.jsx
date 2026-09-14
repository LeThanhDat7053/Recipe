import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChefHat, ChevronLeft, Clock, Flame, Heart, Pencil, RotateCcw, Share2, Users } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { RecipeImage } from '../components/RecipeCard'
import { EmptyState, Spinner, Stepper, useGoBack } from '../components/ui'
import { useSessionState, useWakeLock } from '../lib/hooks'
import { cx, DIFFICULTY, formatMinutes, scaleAmount, totalTime } from '../lib/utils'

export default function RecipeDetail() {
  const { id } = useParams()
  const { recipes, loading } = useStore()
  const recipe = recipes.find((r) => r.id === id)

  if (!recipe) {
    return loading ? (
      <Spinner className="pt-40" />
    ) : (
      <div className="pt-safe">
        <EmptyState
          emoji="🥲"
          title="Không tìm thấy món này"
          action={
            <Link to="/" className="btn-primary px-6">
              Về trang chủ
            </Link>
          }
        />
      </div>
    )
  }
  // key: reset state khi chuyển sang món khác
  return <Detail key={recipe.id} recipe={recipe} />
}

function Detail({ recipe }) {
  const { categoryMap, canEdit, toggleFavorite } = useStore()
  const toast = useToast()
  const goBack = useGoBack('/')
  const wake = useWakeLock()
  const cat = categoryMap[recipe.category_id]

  const baseServings = recipe.servings || 1
  const [servings, setServings] = useSessionState(`servings:${recipe.id}`, baseServings)
  const [checked, setChecked] = useSessionState(`ing:${recipe.id}`, [])
  const [done, setDone] = useSessionState(`steps:${recipe.id}`, [])

  const ingredients = recipe.ingredients || []
  const steps = recipe.steps || []
  const itemCount = ingredients.filter((i) => i.type !== 'group').length
  const tabs = [
    { key: 'ing', label: 'Nguyên liệu', count: itemCount },
    { key: 'steps', label: 'Cách làm', count: steps.length },
    ...(recipe.notes?.trim() ? [{ key: 'notes', label: 'Ghi chú' }] : []),
  ]
  const [tab, setTab] = useSessionState(`tab:${recipe.id}`, 'ing')
  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'ing'
  const factor = servings / baseServings

  const toggle = (setter, key) => setter((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]))

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: recipe.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Đã sao chép liên kết')
      }
    } catch { /* người dùng huỷ */ }
  }

  const fav = async () => {
    try {
      await toggleFavorite(recipe)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const difficulty = DIFFICULTY[recipe.difficulty]
  const total = totalTime(recipe)

  return (
    <article className={wake.supported ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : 'pb-safe'}>
      {/* Ảnh + nút nổi */}
      <div className="relative">
        <RecipeImage
          recipe={recipe}
          emoji={cat?.icon}
          eager
          className="w-full aspect-[4/3] max-h-[55dvh] text-5xl"
        />
        <div className="absolute inset-x-0 top-0 pt-safe bg-gradient-to-b from-black/35 to-transparent">
          <div className="flex items-center gap-2 p-3">
            <FloatBtn onClick={goBack} label="Quay lại">
              <ChevronLeft size={26} />
            </FloatBtn>
            <span className="flex-1" />
            <FloatBtn onClick={share} label="Chia sẻ">
              <Share2 size={20} />
            </FloatBtn>
            {canEdit && (
              <>
                <FloatBtn onClick={fav} label="Yêu thích">
                  <Heart size={20} fill={recipe.is_favorite ? 'currentColor' : 'none'} className={recipe.is_favorite ? 'text-rose-400' : ''} />
                </FloatBtn>
                <Link
                  to={`/recipe/${recipe.id}/edit`}
                  className="icon-btn bg-black/35 text-white backdrop-blur-md"
                  aria-label="Sửa"
                >
                  <Pencil size={20} />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative -mt-7 rounded-t-[1.75rem] bg-bg px-4 pt-5">
        {cat && (
          <Link to={`/categories/${cat.id}`} className="chip h-8 text-xs mb-2">
            {cat.icon} {cat.name}
          </Link>
        )}
        <h1 className="text-[1.65rem] leading-tight font-bold tracking-tight">{recipe.title}</h1>
        {recipe.description && <p className="mt-2 text-muted leading-relaxed">{recipe.description}</p>}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Meta icon={Clock} label="Tổng" value={formatMinutes(total) || '—'} sub={recipe.cook_time ? `Nấu ${recipe.cook_time}p` : null} />
          <Meta icon={Users} label="Khẩu phần" value={`${baseServings} người`} />
          <Meta icon={ChefHat} label="Độ khó" value={difficulty?.label || '—'} />
        </div>

        {recipe.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.tags.map((t) => (
              <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="text-sm text-brand bg-brand-soft rounded-full px-3 py-1">
                #{t}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tabs dính trên cùng */}
      <div className="sticky top-0 z-20 pt-safe bg-bg/90 backdrop-blur-xl">
        <div className="mx-4 mt-4 mb-2 flex rounded-2xl bg-surface-2 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cx(
                'flex-1 h-10 rounded-xl text-sm font-semibold transition',
                activeTab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-muted',
              )}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1 opacity-60">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 animate-fade-in" key={activeTab}>
        {activeTab === 'ing' && (
          <>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-semibold">Khẩu phần</p>
                {factor !== 1 && (
                  <button onClick={() => setServings(baseServings)} className="text-xs text-brand flex items-center gap-1 mt-0.5">
                    <RotateCcw size={12} /> Về gốc ({baseServings})
                  </button>
                )}
              </div>
              <Stepper value={servings} onChange={setServings} />
            </div>

            {ingredients.length === 0 ? (
              <p className="py-8 text-center text-muted">Chưa có nguyên liệu</p>
            ) : (
              <ul className="mt-1">
                {ingredients.map((ing) =>
                  ing.type === 'group' ? (
                    <li key={ing.id} className="pt-5 pb-1 text-xs font-bold uppercase tracking-wider text-brand">
                      {ing.name}
                    </li>
                  ) : (
                    <li key={ing.id}>
                      <button
                        onClick={() => toggle(setChecked, ing.id)}
                        className="w-full flex items-center gap-3 py-3 text-left border-b border-line active:opacity-60"
                      >
                        <CheckCircle on={checked.includes(ing.id)} />
                        <span className={cx('flex-1 leading-snug transition', checked.includes(ing.id) && 'line-through text-muted')}>
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
            )}
            {checked.length > 0 && (
              <button onClick={() => setChecked([])} className="mt-3 text-sm text-muted flex items-center gap-1.5 mx-auto p-2">
                <RotateCcw size={14} /> Bỏ chọn tất cả
              </button>
            )}
          </>
        )}

        {activeTab === 'steps' &&
          (steps.length === 0 ? (
            <p className="py-8 text-center text-muted">Chưa có hướng dẫn</p>
          ) : (
            <>
              <p className="py-2 text-sm text-muted">
                Chạm vào bước để đánh dấu đã xong · {done.filter((d) => steps.some((s) => s.id === d)).length}/{steps.length}
              </p>
              <ol className="space-y-3">
                {steps.map((s, i) => {
                  const isDone = done.includes(s.id)
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => toggle(setDone, s.id)}
                        className={cx('card w-full flex gap-3 p-4 text-left transition active:scale-[0.99]', isDone && 'opacity-50')}
                      >
                        <span
                          className={cx(
                            'grid place-items-center size-8 shrink-0 rounded-full text-sm font-bold',
                            isDone ? 'bg-ok text-white' : 'bg-brand-soft text-brand',
                          )}
                        >
                          {isDone ? <Check size={16} strokeWidth={3} /> : i + 1}
                        </span>
                        <span className="flex-1 pt-1 leading-relaxed whitespace-pre-wrap">{s.text}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </>
          ))}

        {activeTab === 'notes' && (
          <div className="card p-4 mt-2 leading-relaxed whitespace-pre-wrap">{recipe.notes}</div>
        )}

        <p className="py-8 text-center text-xs text-muted">
          Cập nhật {new Date(recipe.updated_at || recipe.created_at).toLocaleDateString('vi-VN')}
        </p>
      </div>

      {wake.supported && (
        <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
          <div className="mx-auto max-w-2xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button
              onClick={wake.toggle}
              className={cx(
                'pointer-events-auto btn w-full shadow-xl',
                wake.on ? 'bg-ink text-bg' : 'bg-brand text-brand-ink shadow-brand/30',
              )}
            >
              <Flame size={20} fill={wake.on ? 'currentColor' : 'none'} />
              {wake.on ? 'Đang nấu · màn hình luôn sáng' : 'Bắt đầu nấu'}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

const FloatBtn = ({ children, label, ...props }) => (
  <button className="icon-btn bg-black/35 text-white backdrop-blur-md" aria-label={label} {...props}>
    {children}
  </button>
)

const Meta = ({ icon: Icon, label, value, sub }) => (
  <div className="card p-3">
    <Icon size={18} className="text-brand" />
    <p className="mt-1.5 text-[11px] text-muted">{label}</p>
    <p className="font-semibold text-sm leading-tight">{value}</p>
    {sub && <p className="text-[11px] text-muted">{sub}</p>}
  </div>
)

const CheckCircle = ({ on }) => (
  <span
    className={cx(
      'grid place-items-center size-6 shrink-0 rounded-full border-2 transition',
      on ? 'bg-ok border-ok text-white' : 'border-line',
    )}
  >
    {on && <Check size={14} strokeWidth={3} />}
  </span>
)
