import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Shuffle, CloudOff } from 'lucide-react'
import { useStore } from '../store'
import { RecipeListSkeleton, RecipeRow, RecipeTile } from '../components/RecipeCard'
import { EmptyState } from '../components/ui'

function greeting(name) {
  const h = new Date().getHours()
  const who = name ? `, ${name.trim().split(/\s+/).pop()}` : ''
  if (h < 11) return `Chào buổi sáng${who} ☀️`
  if (h < 14) return `Chào buổi trưa${who} 🍚`
  if (h < 18) return `Chào buổi chiều${who} 🌤️`
  return `Chào buổi tối${who} 🌙`
}

export default function Home() {
  const { recipes, categories, loading, error, canEdit, user } = useStore()
  const navigate = useNavigate()

  const favorites = useMemo(() => recipes.filter((r) => r.is_favorite), [recipes])
  const recent = recipes.slice(0, 8)
  const counts = useMemo(() => {
    const map = {}
    recipes.forEach((r) => (map[r.category_id] = (map[r.category_id] || 0) + 1))
    return map
  }, [recipes])

  const randomPick = () => {
    const pool = recipes
    if (!pool.length) return
    navigate(`/recipe/${pool[Math.floor(Math.random() * pool.length)].id}`)
  }

  return (
    <div className="pt-safe">
      <header className="px-4 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{greeting(user?.user_metadata?.full_name)}</p>
            <h1 className="mt-0.5 text-[1.75rem] leading-tight font-bold tracking-tight">Hôm nay nấu gì?</h1>
          </div>
          {recipes.length > 1 && (
            <button
              onClick={randomPick}
              className="icon-btn bg-brand-soft text-brand"
              aria-label="Chọn ngẫu nhiên một món"
              title="Chọn ngẫu nhiên"
            >
              <Shuffle size={20} />
            </button>
          )}
        </div>

        <Link
          to="/search"
          className="mt-4 flex items-center gap-3 h-12 px-4 rounded-2xl bg-surface border border-line text-muted active:scale-[0.99] transition"
        >
          <Search size={20} />
          <span>Tìm món, nguyên liệu…</span>
        </Link>
      </header>

      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
          <CloudOff size={18} className="shrink-0" />
          Không kết nối được máy chủ — đang hiển thị dữ liệu đã lưu.
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-1">
          {categories.map((c) => (
            <Link key={c.id} to={`/categories/${c.id}`} className="chip">
              <span>{c.icon}</span>
              {c.name}
              {counts[c.id] > 0 && <span className="text-muted">{counts[c.id]}</span>}
            </Link>
          ))}
        </div>
      )}

      {loading ? (
        <div className="pt-6">
          <RecipeListSkeleton />
        </div>
      ) : recipes.length === 0 ? (
        <EmptyState
          emoji="📖"
          title="Chưa có công thức nào"
          text="Bắt đầu ghi lại món ngon đầu tiên của bạn."
          action={
            canEdit && (
              <Link to="/recipe/new" className="btn-primary px-6">
                Thêm món đầu tiên
              </Link>
            )
          }
        />
      ) : (
        <>
          {favorites.length > 0 && (
            <section className="pt-6">
              <SectionHead title="Yêu thích ❤️" to="/categories/favorites" />
              <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 px-4 pb-1">
                {favorites.map((r) => (
                  <div key={r.id} className="w-[42%] max-w-44 shrink-0 snap-start">
                    <RecipeTile recipe={r} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="pt-6">
            <SectionHead title="Mới thêm" to={recipes.length > recent.length ? '/search' : null} />
            <div className="px-2">
              {recent.map((r) => (
                <RecipeRow key={r.id} recipe={r} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function SectionHead({ title, to }) {
  return (
    <div className="flex items-center justify-between px-4 mb-3">
      <h2 className="section-title">{title}</h2>
      {to && (
        <Link to={to} className="flex items-center text-sm font-medium text-brand -mr-1 p-1">
          Xem tất cả <ChevronRight size={16} />
        </Link>
      )}
    </div>
  )
}
