import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronRight, Pencil, Plus } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { CollectionFormSheet } from '../components/RecipeSheets'
import { ConfirmSheet, EmojiGrid, PageHeader, Sheet } from '../components/ui'

export default function Categories() {
  const { categories, collections, recipes, canEdit } = useStore()
  const [manage, setManage] = useState(false)
  const [newCollection, setNewCollection] = useState(false)

  const counts = useMemo(() => {
    const map = { favorites: 0, none: 0 }
    recipes.forEach((r) => {
      map[r.category_id ?? 'none'] = (map[r.category_id ?? 'none'] || 0) + 1
      if (r.is_favorite) map.favorites++
    })
    return map
  }, [recipes])
  const activeIds = useMemo(() => new Set(recipes.map((r) => r.id)), [recipes])

  return (
    <>
      <PageHeader
        title="Danh mục"
        right={
          canEdit && (
            <button onClick={() => setManage(true)} className="btn-ghost h-10 px-3 text-brand">
              <Pencil size={18} /> Sửa
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 px-4 pt-2">
        <CategoryCard to="/categories/favorites" icon="❤️" name="Yêu thích" count={counts.favorites} highlight />
        {categories.map((c) => (
          <CategoryCard key={c.id} to={`/categories/${c.id}`} icon={c.icon} name={c.name} count={counts[c.id] || 0} />
        ))}
        {counts.none > 0 && <CategoryCard to="/categories/none" icon="📦" name="Chưa phân loại" count={counts.none} />}
      </div>

      <section className="px-4 pt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-title">Bộ sưu tập</h2>
          {canEdit && (
            <button onClick={() => setNewCollection(true)} className="flex items-center gap-1 text-sm font-medium text-brand p-1">
              <Plus size={16} /> Tạo mới
            </button>
          )}
        </div>
        {collections.length === 0 ? (
          <button
            onClick={() => canEdit && setNewCollection(true)}
            className="w-full rounded-3xl border-2 border-dashed border-line p-5 text-left text-muted active:scale-[0.99] transition"
          >
            <p className="font-medium text-ink">Gom món theo dịp 🎉</p>
            <p className="text-sm mt-0.5">VD: "Mâm cỗ Tết", "Món cho bé", "Ăn kiêng". Một món có thể nằm trong nhiều bộ.</p>
          </button>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {collections.map((c) => (
              <li key={c.id}>
                <Link to={`/collections/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                  <span className="text-2xl w-8 text-center">{c.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{c.name}</span>
                    <span className="block text-xs text-muted">{(c.recipe_ids || []).filter((id) => activeIds.has(id)).length} món</span>
                  </span>
                  <ChevronRight size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CategoryManager open={manage} onClose={() => setManage(false)} />
      <CollectionFormSheet open={newCollection} onClose={() => setNewCollection(false)} />
    </>
  )
}

function CategoryCard({ to, icon, name, count, highlight }) {
  return (
    <Link
      to={to}
      className={`flex flex-col justify-between min-h-32 p-4 rounded-3xl border active:scale-[0.97] transition ${
        highlight ? 'bg-brand-soft border-transparent' : 'bg-surface border-line'
      }`}
    >
      <span className="text-4xl">{icon}</span>
      <div>
        <p className="font-semibold leading-tight line-clamp-2">{name}</p>
        <p className="text-sm text-muted mt-0.5">{count} món</p>
      </div>
    </Link>
  )
}

function CategoryManager({ open, onClose }) {
  const { categories, saveCategory, saveCategories, deleteCategory } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState(null) // null | { id?, name, icon }
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const move = async (index, dir) => {
    const a = categories[index]
    const b = categories[index + dir]
    if (!a || !b) return
    const orderA = b.sort_order
    const orderB = a.sort_order === b.sort_order ? a.sort_order + dir : a.sort_order
    try {
      await saveCategories([
        { ...a, sort_order: orderA },
        { ...b, sort_order: orderB },
      ])
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!editing.name.trim()) return
    setBusy(true)
    try {
      await saveCategory({ ...editing, name: editing.name.trim() })
      toast(editing.id ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục')
      setEditing(null)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteCategory(editing.id)
      toast('Đã xoá danh mục')
      setConfirmDelete(false)
      setEditing(null)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <>
        <Sheet
          open={open && !confirmDelete}
          onClose={() => setEditing(null)}
          title={editing.id ? 'Sửa danh mục' : 'Danh mục mới'}
          footer={
            <div className="flex gap-3">
              {editing.id && (
                <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
                  Xoá
                </button>
              )}
              <button form="cat-form" className="btn-primary flex-1" disabled={busy || !editing.name.trim()}>
                Lưu
              </button>
            </div>
          }
        >
          <form id="cat-form" onSubmit={save} className="pt-3 space-y-4">
            <div className="flex gap-3">
              <div className="grid place-items-center size-12 shrink-0 rounded-2xl bg-surface-2 text-3xl">{editing.icon || '🍽️'}</div>
              <input
                className="input"
                placeholder="Tên danh mục"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                autoFocus={!editing.id}
                enterKeyHint="done"
              />
            </div>
            <div>
              <p className="label">Biểu tượng</p>
              <EmojiGrid value={editing.icon} onChange={(icon) => setEditing({ ...editing, icon })} />
            </div>
          </form>
        </Sheet>
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={remove}
          busy={busy}
          danger
          title={`Xoá "${editing.name}"?`}
          message="Các món trong danh mục này sẽ chuyển sang Chưa phân loại."
          confirmText="Xoá"
        />
      </>
    )
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Quản lý danh mục"
      footer={
        <button className="btn-primary w-full" onClick={() => setEditing({ name: '', icon: '🍽️' })}>
          <Plus size={20} /> Thêm danh mục
        </button>
      }
    >
      <ul className="pt-2 divide-y divide-line">
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            <span className="text-2xl w-9 text-center">{c.icon}</span>
            <button className="flex-1 min-w-0 text-left font-medium truncate py-2" onClick={() => setEditing(c)}>
              {c.name}
            </button>
            <button className="icon-btn size-10 text-muted disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Lên">
              <ArrowUp size={18} />
            </button>
            <button
              className="icon-btn size-10 text-muted disabled:opacity-30"
              onClick={() => move(i, 1)}
              disabled={i === categories.length - 1}
              aria-label="Xuống"
            >
              <ArrowDown size={18} />
            </button>
            <button className="icon-btn size-10 text-brand" onClick={() => setEditing(c)} aria-label="Sửa">
              <Pencil size={18} />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
