import { useDeferredValue, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, X } from 'lucide-react'
import { useStore } from '../store'
import { RecipeListSkeleton, RecipeRow } from '../components/RecipeCard'
import { EmptyState } from '../components/ui'
import { matchRecipe } from '../lib/utils'

export default function Search() {
  const { recipes, categories, loading } = useStore()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const filter = params.get('f') ?? 'all'
  const deferredQ = useDeferredValue(q)

  const update = (next) => {
    const merged = { q, f: filter, ...next }
    const clean = {}
    if (merged.q) clean.q = merged.q
    if (merged.f && merged.f !== 'all') clean.f = merged.f
    setParams(clean, { replace: true, preventScrollReset: true })
  }

  const results = useMemo(
    () =>
      recipes.filter(
        (r) =>
          (filter === 'all' || (filter === 'fav' ? r.is_favorite : r.category_id === filter)) &&
          matchRecipe(r, deferredQ),
      ),
    [recipes, filter, deferredQ],
  )

  return (
    <>
      <header className="sticky top-0 z-30 pt-safe bg-bg/85 backdrop-blur-xl">
        <div className="px-4 pt-3">
          <div className="relative">
            <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoFocus={!q}
              className="input pl-12 pr-12 [&::-webkit-search-cancel-button]:hidden"
              placeholder="Tên món, nguyên liệu, tag…"
              value={q}
              onChange={(e) => update({ q: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            {q && (
              <button
                onClick={() => update({ q: '' })}
                className="absolute right-1 top-1/2 -translate-y-1/2 icon-btn text-muted"
                aria-label="Xoá"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
          <FilterChip active={filter === 'all'} onClick={() => update({ f: 'all' })}>
            Tất cả
          </FilterChip>
          <FilterChip active={filter === 'fav'} onClick={() => update({ f: 'fav' })}>
            ❤️ Yêu thích
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.id} active={filter === c.id} onClick={() => update({ f: c.id })}>
              {c.icon} {c.name}
            </FilterChip>
          ))}
        </div>
      </header>

      {loading ? (
        <RecipeListSkeleton />
      ) : results.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="Không tìm thấy món nào"
          text={q ? `Không có kết quả cho "${q}"` : 'Thử bộ lọc khác nhé.'}
        />
      ) : (
        <div className="px-2">
          <p className="px-2 pb-1 text-sm text-muted">{results.length} món</p>
          {results.map((r) => (
            <RecipeRow key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </>
  )
}

const FilterChip = ({ active, ...props }) => (
  <button type="button" className={`chip ${active ? 'chip-active' : ''}`} {...props} />
)
