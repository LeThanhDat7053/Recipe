import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { useStore } from '../store'
import { RecipeListSkeleton, RecipeRow } from '../components/RecipeCard'
import { CollectionFormSheet } from '../components/RecipeSheets'
import { EmptyState, PageHeader } from '../components/ui'
import { SORTS, sortRecipes } from '../lib/sorts'
import { cx } from '../lib/utils'

export default function CategoryDetail({ kind }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recipes, categoryMap, collections, cookStats, loading, canEdit } = useStore()
  const [sort, setSort] = useState('new')
  const [editCollection, setEditCollection] = useState(false)

  const collection = kind === 'collection' ? collections.find((c) => c.id === id) : null
  const meta =
    kind === 'collection'
      ? collection
      : id === 'favorites'
        ? { icon: '❤️', name: 'Yêu thích' }
        : id === 'none'
          ? { icon: '📦', name: 'Chưa phân loại' }
          : categoryMap[id]

  const list = useMemo(() => {
    const filtered = recipes.filter((r) => {
      if (kind === 'collection') return (collection?.recipe_ids || []).includes(r.id)
      if (id === 'favorites') return r.is_favorite
      if (id === 'none') return !r.category_id
      return r.category_id === id
    })
    return sortRecipes(filtered, sort, cookStats)
  }, [recipes, id, kind, collection, sort, cookStats])

  return (
    <>
      <PageHeader
        back
        backTo="/categories"
        title={meta ? `${meta.icon} ${meta.name}` : 'Danh mục'}
        right={
          collection &&
          canEdit && (
            <button onClick={() => setEditCollection(true)} className="icon-btn text-brand" aria-label="Sửa bộ sưu tập">
              <Pencil size={20} />
            </button>
          )
        }
      >
        {list.length > 1 && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
            {Object.entries(SORTS).map(([key, s]) => (
              <button key={key} onClick={() => setSort(key)} className={cx('chip', sort === key && 'chip-active')}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      {loading ? (
        <RecipeListSkeleton />
      ) : !meta ? (
        <EmptyState emoji="🤔" title="Không tìm thấy" />
      ) : list.length === 0 ? (
        <EmptyState
          emoji={meta.icon}
          title="Chưa có món nào"
          text={kind === 'collection' ? 'Mở một công thức, bấm ⋯ rồi chọn "Thêm vào bộ sưu tập".' : undefined}
          action={
            canEdit &&
            kind === 'category' &&
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

      {collection && (
        <CollectionFormSheet
          open={editCollection}
          onClose={() => setEditCollection(false)}
          collection={collection}
          onDeleted={() => navigate('/categories', { replace: true })}
        />
      )}
    </>
  )
}
