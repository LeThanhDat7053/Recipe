import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen, CalendarCheck, Check, ChefHat, ChevronLeft, Clock, Copy, Ellipsis, Flame, FolderHeart, Heart,
  ImageDown, Link2, LoaderCircle, NotebookPen, Pencil, RotateCcw, ShoppingCart, Timer, Trash2, Users,
} from 'lucide-react'
import { useStore } from '../store'
import { useTimers } from '../timers'
import { useToast } from '../components/Toast'
import { RecipeImage } from '../components/RecipeCard'
import { CardSheet, CollectionSheet, LogSheet, ShareSheet } from '../components/RecipeSheets'
import { CheckCircle, ConfirmSheet, EmptyState, MenuItem, Sheet, Spinner, Stars, Stepper, useGoBack } from '../components/ui'
import { useSessionState } from '../lib/hooks'
import { cx, detectTimers, DIFFICULTY, formatMinutes, scaleAmount, timeAgo, totalTime } from '../lib/utils'

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
  return <RecipeView key={recipe.id} recipe={recipe} />
}

/** Dùng chung cho món của mình và món xem qua link chia sẻ (shared) */
export function RecipeView({ recipe, shared }) {
  const owner = !shared
  const store = useStore()
  const { categoryMap, cookLogs, cookStats } = store
  const toast = useToast()
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const { start } = useTimers()
  const cat = owner ? categoryMap[recipe.category_id] : null

  const baseServings = recipe.servings || 1
  const [servings, setServings] = useSessionState(`servings:${recipe.id}`, baseServings)
  const [checked, setChecked] = useSessionState(`ing:${recipe.id}`, [])
  const [done, setDone] = useSessionState(`steps:${recipe.id}`, [])
  const [sheet, setSheet] = useState(null) // more | share | card | collection | log | trash

  const ingredients = recipe.ingredients || []
  const steps = (recipe.steps || []).filter((s) => s.text?.trim() || s.image_url)
  const logs = owner ? cookLogs.filter((l) => l.recipe_id === recipe.id) : []
  const stats = owner ? cookStats[recipe.id] : null
  const itemCount = ingredients.filter((i) => i.type !== 'group').length
  const tabs = [
    { key: 'ing', label: 'Nguyên liệu', count: itemCount },
    { key: 'steps', label: 'Các bước', count: steps.length },
    ...(recipe.notes?.trim() ? [{ key: 'notes', label: 'Ghi chú' }] : []),
    ...(owner ? [{ key: 'log', label: 'Nhật ký', count: logs.length }] : []),
  ]
  const [tab, setTab] = useSessionState(`tab:${recipe.id}`, 'ing')
  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'ing'
  const factor = servings / baseServings

  const toggle = (setter, key) => setter((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]))
  const run = (fn) => async () => {
    try {
      await fn()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const addToShopping = run(async () => {
    const items = ingredients
      .filter((i) => i.type !== 'group' && !checked.includes(i.id))
      .map((i) => ({ ...i, amount: scaleAmount(i.amount, factor) }))
    if (!items.length) return toast('Bạn đã tick hết nguyên liệu rồi')
    const n = await store.addShoppingItems(items, recipe.title)
    setSheet(null)
    toast(`Đã thêm ${n} thứ vào danh sách đi chợ`)
  })

  const difficulty = DIFFICULTY[recipe.difficulty]
  const total = totalTime(recipe)

  return (
    <article className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Ảnh + nút nổi */}
      <div className="relative">
        <RecipeImage recipe={recipe} emoji={cat?.icon} eager className="w-full aspect-[4/3] max-h-[55dvh] text-5xl" />
        <div className="absolute inset-x-0 top-0 pt-safe bg-gradient-to-b from-black/35 to-transparent">
          <div className="flex items-center gap-2 p-3">
            <FloatBtn onClick={shared ? () => navigate('/') : goBack} label="Quay lại">
              <ChevronLeft size={26} />
            </FloatBtn>
            <span className="flex-1" />
            {owner && (
              <>
                <FloatBtn onClick={run(() => store.toggleFavorite(recipe))} label="Yêu thích">
                  <Heart size={20} fill={recipe.is_favorite ? 'currentColor' : 'none'} className={recipe.is_favorite ? 'text-rose-400' : ''} />
                </FloatBtn>
                <Link to={`/recipe/${recipe.id}/edit`} className="icon-btn bg-black/35 text-white backdrop-blur-md" aria-label="Sửa">
                  <Pencil size={20} />
                </Link>
                <FloatBtn onClick={() => setSheet('more')} label="Thêm">
                  <Ellipsis size={22} />
                </FloatBtn>
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
        {shared && recipe.author_name && (
          <p className="mt-1 text-sm text-muted">
            Công thức của <b className="text-ink">{recipe.author_name}</b>
          </p>
        )}
        {recipe.description && <p className="mt-2 text-muted leading-relaxed">{recipe.description}</p>}

        {owner && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <Stars value={recipe.rating || 0} onChange={(n) => run(() => store.setRating(recipe, n))()} size={24} />
            <button onClick={() => setSheet('log')} className="chip">
              <CalendarCheck size={16} className="text-brand" /> Đã nấu
            </button>
          </div>
        )}
        {stats && (
          <p className="mt-1 text-sm text-muted">
            Đã nấu {stats.count} lần · gần nhất {timeAgo(stats.last)}
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Meta icon={Clock} label="Tổng" value={formatMinutes(total) || '—'} sub={recipe.cook_time ? `Nấu ${recipe.cook_time}p` : null} />
          <Meta icon={Users} label="Khẩu phần" value={`${baseServings} người`} />
          <Meta icon={ChefHat} label="Độ khó" value={difficulty?.label || '—'} />
        </div>

        {recipe.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.tags.map((t) =>
              owner ? (
                <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="text-sm text-brand bg-brand-soft rounded-full px-3 py-1">
                  #{t}
                </Link>
              ) : (
                <span key={t} className="text-sm text-brand bg-brand-soft rounded-full px-3 py-1">
                  #{t}
                </span>
              ),
            )}
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
                'flex-1 h-10 rounded-xl text-[13px] font-semibold whitespace-nowrap transition',
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
            {owner && itemCount > 0 && (
              <button onClick={addToShopping} className="btn-soft w-full mt-4">
                <ShoppingCart size={18} /> {checked.length ? 'Thêm thứ chưa tick vào đi chợ' : 'Thêm vào danh sách đi chợ'}
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
                  const timers = isDone ? [] : detectTimers(s.text)
                  return (
                    <li
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(setDone, s.id)}
                      className={cx('card p-4 cursor-pointer transition active:scale-[0.99]', isDone && 'opacity-50')}
                    >
                      <div className="flex gap-3">
                        <span
                          className={cx(
                            'grid place-items-center size-8 shrink-0 rounded-full text-sm font-bold',
                            isDone ? 'bg-ok text-white' : 'bg-brand-soft text-brand',
                          )}
                        >
                          {isDone ? <Check size={16} strokeWidth={3} /> : i + 1}
                        </span>
                        <p className="flex-1 pt-1 leading-relaxed whitespace-pre-wrap">{s.text}</p>
                      </div>
                      {s.image_url && !isDone && (
                        <img src={s.image_url} alt="" loading="lazy" className="mt-3 w-full max-h-80 object-cover rounded-2xl" />
                      )}
                      {timers.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 pl-11">
                          {timers.map((t) => (
                            <button
                              key={t.seconds}
                              onClick={(e) => {
                                e.stopPropagation()
                                start({ label: `Bước ${i + 1} · ${t.label}`, seconds: t.seconds, recipeId: recipe.id, recipeTitle: recipe.title })
                                toast(`Đã hẹn giờ ${t.label}`)
                              }}
                              className="chip h-8 bg-brand-soft border-transparent text-brand"
                            >
                              <Timer size={14} /> {t.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </>
          ))}

        {activeTab === 'notes' && <div className="card p-4 mt-2 leading-relaxed whitespace-pre-wrap">{recipe.notes}</div>}

        {activeTab === 'log' && (
          <>
            <button className="btn-soft w-full mt-2" onClick={() => setSheet('log')}>
              <NotebookPen size={18} /> Ghi lại lần nấu
            </button>
            {logs.length === 0 ? (
              <p className="py-8 text-center text-muted">Chưa nấu lần nào. Nấu xong nhớ ghi lại nhé!</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {logs.map((l) => (
                  <li key={l.id} className="card p-4 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold first-letter:uppercase">
                        {new Date(l.cooked_at).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted">{timeAgo(l.cooked_at)}</p>
                      {l.note && <p className="mt-2 whitespace-pre-wrap leading-relaxed">{l.note}</p>}
                    </div>
                    <button className="icon-btn size-9 text-muted" onClick={run(() => store.deleteCookLog(l.id))} aria-label="Xoá">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <p className="py-8 text-center text-xs text-muted">
          Cập nhật {new Date(recipe.updated_at || recipe.created_at).toLocaleDateString('vi-VN')}
        </p>
      </div>

      {/* Nút chính dưới cùng */}
      <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
        <div className="mx-auto max-w-2xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {owner ? (
            <Link
              to={`/recipe/${recipe.id}/cook`}
              className="pointer-events-auto btn-primary w-full h-13 text-base shadow-xl shadow-brand/30"
            >
              <Flame size={20} /> Bắt đầu nấu
            </Link>
          ) : (
            <Link to={`/recipe/${recipe.id}`} className="pointer-events-auto btn-primary w-full h-13 text-base shadow-xl shadow-brand/30">
              <BookOpen size={20} /> Mở trong sổ tay
            </Link>
          )}
        </div>
      </div>

      {owner && (
        <>
          <Sheet open={sheet === 'more'} onClose={() => setSheet(null)}>
            <div className="pt-2">
              <MenuItem icon={ShoppingCart} label="Thêm vào đi chợ" hint="Gộp nguyên liệu vào danh sách mua" onClick={addToShopping} />
              <MenuItem icon={FolderHeart} label="Thêm vào bộ sưu tập" onClick={() => setSheet('collection')} />
              <MenuItem
                icon={Link2}
                label="Chia sẻ bằng link"
                hint={recipe.share_id ? 'Đang bật chia sẻ' : 'Người nhận không cần tài khoản'}
                onClick={() => setSheet('share')}
              />
              <MenuItem icon={ImageDown} label="Xuất ảnh thẻ công thức" hint="Gửi Zalo, đăng mạng, in ra" onClick={() => setSheet('card')} />
              <MenuItem icon={Copy} label="Nhân bản món" hint="Tạo biến tấu từ món này" onClick={() => navigate(`/recipe/new?from=${recipe.id}`)} />
              <MenuItem icon={Trash2} label="Chuyển vào thùng rác" danger onClick={() => setSheet('trash')} />
            </div>
          </Sheet>
          <ShareSheet open={sheet === 'share'} onClose={() => setSheet(null)} recipe={recipe} />
          <CollectionSheet open={sheet === 'collection'} onClose={() => setSheet(null)} recipe={recipe} />
          <CardSheet open={sheet === 'card'} onClose={() => setSheet(null)} recipe={recipe} factor={factor} servings={servings} />
          <LogSheet open={sheet === 'log'} onClose={() => setSheet(null)} recipe={recipe} />
          <ConfirmSheet
            open={sheet === 'trash'}
            onClose={() => setSheet(null)}
            danger
            title={`Chuyển "${recipe.title}" vào thùng rác?`}
            message="Có thể khôi phục trong 30 ngày ở Tài khoản → Thùng rác."
            confirmText="Chuyển"
            onConfirm={run(async () => {
              await store.trashRecipe(recipe)
              toast('Đã chuyển vào thùng rác')
              navigate('/', { replace: true })
            })}
          />
        </>
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
