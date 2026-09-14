import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { RecipeListSkeleton, RecipeRow } from '../components/RecipeCard'
import { EmptyState, PageHeader } from '../components/ui'
import { totalTime } from '../lib/utils'

const SORTS = {
  new: { label: 'Mới nhất', fn: (a, b) => b.created_at.localeCompare(a.created_at) },
  az: { label: 'A → Z', fn: (a, b) => a.title.localeCompare(b.title, 'vi') },
  fast: { label: 'Nhanh nhất', fn: (a, b) => (totalTime(a) || 9999) - (totalTime(b) || 9999) },
}

export default function CategoryDetail() {
  const { id } = useParams()
  const { recipes, categoryMap, loading, canEdit } = useStore()
  const [sort, setSort] = useState('new')

  const meta =
    id === 'favorites'
      ? { icon: '❤️', name: 'Yêu thích' }
      : id === 'none'
        ? { icon: '📦', name: 'Chưa phân loại' }
        : categoryMap[id]

  const list = useMemo(() => {
    const filtered = recipes.filter((r) =>
      id === 'favorites' ? r.is_favorite : id === 'none' ? !r.category_id : r.category_id === id,
    )
    return filtered.sort(SORTS[sort].fn)
  }, [recipes, id, sort])

  return (
    <>
      <PageHeader back backTo="/categories" title={meta ? `${meta.icon} ${meta.name}` : 'Danh mục'}>
        {list.length > 1 && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
            {Object.entries(SORTS).map(([key, s]) => (
              <button key={key} onClick={() => setSort(key)} className={`chip ${sort === key ? 'chip-active' : ''}`}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      {loading ? (
        <RecipeListSkeleton />
      ) : !meta ? (
        <EmptyState emoji="🤔" title="Không tìm thấy danh mục" />
      ) : list.length === 0 ? (
        <EmptyState
          emoji={meta.icon}
          title="Chưa có món nào"
          action={
            canEdit &&
            id !== 'favorites' && (
              <Link to={`/recipe/new${id !== 'none' ? `?category=${id}` : ''}`} className="btn-primary px-6">
                Thêm món vào đây
              </Link>
            )
          }
        />
      ) : (
        <div className="px-2">
          <p className="px-2 pb-1 text-sm text-muted">{list.length} món</p>
          {list.map((r) => (
            <RecipeRow key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </>
  )
}
