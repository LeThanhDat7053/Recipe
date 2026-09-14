import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, CloudOff, RefreshCw, Search, Settings, Shuffle } from 'lucide-react'
import { useStore } from '../store'
import { RecipeListSkeleton, RecipeRow, RecipeTile } from '../components/RecipeCard'
import { EmptyState } from '../components/ui'
import { daysSince, timeAgo } from '../lib/utils'

function greeting(name) {
  const h = new Date().getHours()
  const who = name ? `, ${name.trim().split(/\s+/).pop()}` : ''
  if (h < 11) return `Chào buổi sáng${who} ☀️`
  if (h < 14) return `Chào buổi trưa${who} 🍚`
  if (h < 18) return `Chào buổi chiều${who} 🌤️`
  return `Chào buổi tối${who} 🌙`
}

export default function Home() {
  const { recipes, categories, cookStats, shoppingItems, loading, error, pendingCount, canEdit } = useStore()
  const navigate = useNavigate()

  const favorites = useMemo(() => recipes.filter((r) => r.is_favorite), [recipes])
  const stale = useMemo(
    () =>
      recipes
        .filter((r) => cookStats[r.id] && daysSince(cookStats[r.id].last) >= 14)
        .sort((a, b) => cookStats[a.id].last.localeCompare(cookStats[b.id].last))
        .slice(0, 10),
    [recipes, cookStats],
  )
  const recent = recipes.slice(0, 8)
  const toBuy = shoppingItems.filter((i) => !i.checked).length
  const counts = useMemo(() => {
    const map = {}
    recipes.forEach((r) => (map[r.category_id] = (map[r.category_id] || 0) + 1))
    return map
  }, [recipes])

  const randomPick = () => {
    if (!recipes.length) return
    navigate(`/recipe/${recipes[Math.floor(Math.random() * recipes.length)].id}`)
  }

  return (
    <div className="pt-safe">
      <header className="px-4 pt-5 pb-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted truncate">{greeting()}</p>
            <h1 className="mt-0.5 text-[1.75rem] leading-tight font-bold tracking-tight">Hôm nay nấu gì?</h1>
          </div>
          {recipes.length > 1 && (
            <button onClick={randomPick} className="icon-btn bg-brand-soft text-brand" aria-label="Chọn ngẫu nhiên một món" title="Chọn ngẫu nhiên">
              <Shuffle size={20} />
            </button>
          )}
          <Link to="/account" className="icon-btn bg-surface border border-line" aria-label="Cài đặt">
            <Settings size={20} />
          </Link>
        </div>

        <Link
          to="/search"
          className="mt-4 flex items-center gap-3 h-12 px-4 rounded-2xl bg-surface border border-line text-muted active:scale-[0.99] transition"
        >
          <Search size={20} />
          <span>Tìm món, nguyên liệu…</span>
        </Link>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <QuickCard to="/fridge" emoji="🧊" title="Tủ lạnh còn gì?" text="Gợi ý món nấu được" />
          <QuickCard to="/shopping" emoji="🛒" title="Đi chợ" text={toBuy ? `${toBuy} thứ cần mua` : 'Danh sách trống'} />
        </div>
      </header>

      {pendingCount > 0 ? (
        <Banner icon={RefreshCw}>Đang chờ đồng bộ {pendingCount} thay đổi khi có mạng.</Banner>
      ) : error === 'offline' ? (
        <Banner icon={CloudOff}>Đang offline, hiển thị dữ liệu đã lưu trên máy.</Banner>
      ) : (
        error && <Banner icon={CloudOff}>{error}</Banner>
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
            <Carousel title="Yêu thích ❤️" to="/categories/favorites" list={favorites} />
          )}
          {stale.length > 0 && (
            <Carousel
              title="Lâu rồi chưa nấu 🕰️"
              to="/search?s=stale"
              list={stale}
              caption={(r) => `Lần cuối ${timeAgo(cookStats[r.id].last)}`}
            />
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

function QuickCard({ to, emoji, title, text }) {
  return (
    <Link to={to} className="card flex flex-col gap-2 p-3 active:scale-[0.98] transition">
      <span className="grid place-items-center size-10 rounded-2xl bg-surface-2 text-xl">{emoji}</span>
      <span className="min-w-0">
        <span className="block font-semibold leading-tight">{title}</span>
        <span className="block text-xs text-muted mt-0.5">{text}</span>
      </span>
    </Link>
  )
}

function Banner({ icon: Icon, children }) {
  return (
    <div className="mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
      <Icon size={18} className="shrink-0" />
      {children}
    </div>
  )
}

function Carousel({ title, to, list, caption }) {
  return (
    <section className="pt-6">
      <SectionHead title={title} to={to} />
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 px-4 pb-1">
        {list.map((r) => (
          <div key={r.id} className="w-[42%] max-w-44 shrink-0 snap-start">
            <RecipeTile recipe={r} caption={caption?.(r)} />
          </div>
        ))}
      </div>
    </section>
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
