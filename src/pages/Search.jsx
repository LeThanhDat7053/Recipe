import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react'
import { useStore } from '../store'
import { RecipeListSkeleton, RecipeRow } from '../components/RecipeCard'
import { EmptyState, OptionChips, Sheet } from '../components/ui'
import { SORTS, sortRecipes } from '../lib/sorts'
import { cx, DIFFICULTY, matchRecipe, totalTime } from '../lib/utils'

const TIME_OPTS = [['', 'Tất cả'], ['15', '≤ 15 phút'], ['30', '≤ 30 phút'], ['60', '≤ 1 giờ']]
const DIFF_OPTS = [['', 'Tất cả'], ...Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label])]
const RATING_OPTS = [['', 'Tất cả'], ['3', '3★ trở lên'], ['4', '4★ trở lên'], ['5', '5★']]
const SORT_OPTS = Object.entries(SORTS).map(([k, v]) => [k, v.label])

export default function Search() {
  const { recipes, categories, cookStats, loading } = useStore()
  const [params, setParams] = useSearchParams()
  const [filterOpen, setFilterOpen] = useState(false)

  const q = params.get('q') ?? ''
  const f = params.get('f') || 'all'
  const t = params.get('t') || ''
  const d = params.get('d') || ''
  const r = params.get('r') || ''
  const s = params.get('s') || 'new'
  const deferredQ = useDeferredValue(q)

  const update = (patch) => {
    const next = { q, f, t, d, r, s, ...patch }
    const clean = {}
    Object.entries(next).forEach(([k, v]) => {
      if (v && !(k === 'f' && v === 'all') && !(k === 's' && v === 'new')) clean[k] = v
    })
    setParams(clean, { replace: true, preventScrollReset: true })
  }

  const activeFilters = [t, d, r].filter(Boolean).length + (s !== 'new' ? 1 : 0)

  const results = useMemo(() => {
    const filtered = recipes.filter(
      (x) =>
        (f === 'all' || (f === 'fav' ? x.is_favorite : x.category_id === f)) &&
        (!t || (totalTime(x) > 0 && totalTime(x) <= +t)) &&
        (!d || x.difficulty === d) &&
        (!r || (x.rating || 0) >= +r) &&
        matchRecipe(x, deferredQ),
    )
    return sortRecipes(filtered, s, cookStats)
  }, [recipes, f, t, d, r, s, deferredQ, cookStats])

  return (
    <>
      <header className="sticky top-0 z-30 pt-safe bg-bg/85 backdrop-blur-xl">
        <div className="flex gap-2 px-4 pt-3">
          <div className="relative flex-1 min-w-0">
            <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoFocus={!q && !activeFilters}
              className="input pl-12 pr-11 [&::-webkit-search-cancel-button]:hidden"
              placeholder="Tên món, nguyên liệu, tag…"
              value={q}
              onChange={(e) => update({ q: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            {q && (
              <button onClick={() => update({ q: '' })} className="absolute right-0.5 top-1/2 -translate-y-1/2 icon-btn text-muted" aria-label="Xoá">
                <X size={20} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            className={cx('relative icon-btn size-12 rounded-2xl border', activeFilters ? 'bg-ink text-bg border-ink' : 'bg-surface border-line')}
            aria-label="Bộ lọc"
          >
            <SlidersHorizontal size={20} />
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid place-items-center size-5 rounded-full bg-brand text-brand-ink text-[11px] font-bold">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
          <Link to="/fridge" className="chip bg-brand-soft border-transparent text-brand">
            🧊 Tủ lạnh còn gì?
          </Link>
          <FilterChip active={f === 'all'} onClick={() => update({ f: 'all' })}>
            Tất cả
          </FilterChip>
          <FilterChip active={f === 'fav'} onClick={() => update({ f: 'fav' })}>
            ❤️ Yêu thích
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.id} active={f === c.id} onClick={() => update({ f: c.id })}>
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
          action={
            activeFilters > 0 && (
              <button className="btn-soft px-5" onClick={() => update({ t: '', d: '', r: '', s: 'new' })}>
                Xoá bộ lọc
              </button>
            )
          }
        />
      ) : (
        <div className="px-2">
          <p className="px-2 pb-1 text-sm text-muted">
            {results.length} món{s !== 'new' && ` · ${SORTS[s]?.label}`}
          </p>
          {results.map((x) => (
            <RecipeRow key={x.id} recipe={x} />
          ))}
        </div>
      )}

      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Lọc & sắp xếp"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-soft" onClick={() => update({ t: '', d: '', r: '', s: 'new' })}>
              Xoá bộ lọc
            </button>
            <button className="btn-primary" onClick={() => setFilterOpen(false)}>
              Xem {results.length} món
            </button>
          </div>
        }
      >
        <div className="pt-3 space-y-5">
          <FilterGroup title="Tổng thời gian">
            <OptionChips options={TIME_OPTS} value={t} onChange={(v) => update({ t: v })} />
          </FilterGroup>
          <FilterGroup title="Độ khó">
            <OptionChips options={DIFF_OPTS} value={d} onChange={(v) => update({ d: v })} />
          </FilterGroup>
          <FilterGroup title="Đánh giá">
            <OptionChips options={RATING_OPTS} value={r} onChange={(v) => update({ r: v })} />
          </FilterGroup>
          <FilterGroup title="Sắp xếp">
            <OptionChips options={SORT_OPTS} value={s} onChange={(v) => update({ s: v })} />
          </FilterGroup>
        </div>
      </Sheet>
    </>
  )
}

const FilterChip = ({ active, ...props }) => <button type="button" className={cx('chip', active && 'chip-active')} {...props} />

const FilterGroup = ({ title, children }) => (
  <div>
    <p className="label">{title}</p>
    {children}
  </div>
)
