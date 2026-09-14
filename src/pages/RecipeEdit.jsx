import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ClipboardPaste, Heading, ImagePlus, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { ConfirmSheet, EmptyState, Sheet, Spinner, Stepper, useGoBack } from '../components/ui'
import { cx, DIFFICULTY, uid } from '../lib/utils'

const UNITS = 'kg|g|mg|ml|l|lít|muỗng canh|muỗng cà phê|muỗng|thìa|chén|bát|cốc|ly|quả|trái|củ|tép|cây|nhánh|lá|miếng|lát|con|gói|hộp|túi|lon|nắm|bó|chút|ít'

const emptyItem = (type = 'item') => ({ id: uid(), type, amount: '', unit: '', name: '' })
const emptyStep = () => ({ id: uid(), text: '' })

export default function RecipeEdit() {
  const { id } = useParams()
  const { recipes, loading, canEdit, isCloud } = useStore()

  if (!canEdit) {
    return (
      <div className="pt-safe">
        <EmptyState
          emoji="🔒"
          title="Cần đăng nhập"
          text={isCloud ? 'Đăng nhập để thêm và chỉnh sửa công thức.' : ''}
          action={
            <Link to="/account" className="btn-primary px-6">
              Đăng nhập
            </Link>
          }
        />
      </div>
    )
  }
  if (!id) return <Editor />
  const recipe = recipes.find((r) => r.id === id)
  if (!recipe) return loading ? <Spinner className="pt-40" /> : <EmptyState emoji="🥲" title="Không tìm thấy món này" />
  return <Editor key={recipe.id} original={recipe} />
}

function Editor({ original }) {
  const { categories, saveRecipe, deleteRecipe, uploadImage, removeImage } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const goBack = useGoBack(original ? `/recipe/${original.id}` : '/')
  const [params] = useSearchParams()

  const [initial] = useState(() =>
    original
      ? {
          ...original,
          ingredients: original.ingredients?.length ? original.ingredients : [emptyItem()],
          steps: original.steps?.length ? original.steps : [emptyStep()],
          tags: original.tags || [],
        }
      : {
          title: '',
          description: '',
          category_id: params.get('category') || null,
          image_url: null,
          prep_time: '',
          cook_time: '',
          servings: 2,
          difficulty: 'easy',
          ingredients: [emptyItem(), emptyItem(), emptyItem()],
          steps: [emptyStep()],
          notes: '',
          tags: [],
          is_favorite: false,
        },
  )
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'leave' | 'delete'
  const [bulk, setBulk] = useState(null) // 'ing' | 'steps'
  const uploaded = useRef([]) // ảnh upload trong phiên sửa này
  const focusId = useRef(null)
  const titleRef = useRef()

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    if (!dirty) return
    const handler = (e) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Focus ô vừa thêm
  useEffect(() => {
    if (!focusId.current) return
    document.getElementById(focusId.current)?.focus()
    focusId.current = null
  })

  /* ---------- Ảnh ---------- */
  const pickImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file)
      uploaded.current.push(url)
      set({ image_url: url })
    } catch (err) {
      toast(err.message || 'Không tải ảnh lên được', 'error')
    } finally {
      setUploading(false)
    }
  }

  /* ---------- Danh sách ---------- */
  const updateList = (key, itemId, patch) =>
    set({ [key]: form[key].map((x) => (x.id === itemId ? { ...x, ...patch } : x)) })
  const removeFromList = (key, itemId) => set({ [key]: form[key].filter((x) => x.id !== itemId) })
  const insertAfter = (key, afterId, item) => {
    const list = [...form[key]]
    const idx = afterId ? list.findIndex((x) => x.id === afterId) : list.length - 1
    list.splice(idx + 1, 0, item)
    set({ [key]: list })
  }
  const move = (key, index, dir) => {
    const list = [...form[key]]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    set({ [key]: list })
  }

  const addIngredient = (afterId, type = 'item') => {
    const item = emptyItem(type)
    focusId.current = type === 'group' ? `name-${item.id}` : `amount-${item.id}`
    insertAfter('ingredients', afterId, item)
  }
  const addStep = () => {
    const step = emptyStep()
    focusId.current = `step-${step.id}`
    insertAfter('steps', null, step)
  }

  const applyBulk = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (bulk === 'ing') {
      const re = new RegExp(`^([\\d.,/½¼¾ ]+)?\\s*(${UNITS})?\\s+(.+)$`, 'i')
      const items = lines.map((line) => {
        const clean = line.replace(/^[-•*]\s*/, '')
        if (clean.endsWith(':')) return { ...emptyItem('group'), name: clean.slice(0, -1) }
        const m = clean.match(re)
        if (m && (m[1]?.trim() || m[2])) return { ...emptyItem(), amount: (m[1] || '').trim(), unit: m[2] || '', name: m[3] }
        return { ...emptyItem(), name: clean }
      })
      const kept = form.ingredients.filter((i) => i.name.trim() || i.amount.trim())
      set({ ingredients: [...kept, ...items] })
    } else {
      const items = lines.map((l) => ({ ...emptyStep(), text: l.replace(/^(bước\s*)?\d+[.):\-]\s*/i, '') }))
      set({ steps: [...form.steps.filter((s) => s.text.trim()), ...items] })
    }
    setBulk(null)
  }

  /* ---------- Lưu / xoá / huỷ ---------- */
  const save = async () => {
    if (!form.title.trim()) {
      toast('Hãy nhập tên món', 'error')
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      const toInt = (v) => (v === '' || v == null ? null : parseInt(v, 10) || null)
      const saved = await saveRecipe({
        ...form,
        title: form.title.trim(),
        prep_time: toInt(form.prep_time),
        cook_time: toInt(form.cook_time),
        ingredients: form.ingredients
          .filter((i) => i.name.trim() || i.amount.trim())
          .map((i) => ({ ...i, name: i.name.trim(), amount: i.amount.trim(), unit: i.unit.trim() })),
        steps: form.steps.filter((s) => s.text.trim()).map((s) => ({ ...s, text: s.text.trim() })),
      })
      // Dọn ảnh không còn dùng
      const unused = [...uploaded.current, original?.image_url].filter((u) => u && u !== saved.image_url)
      unused.forEach(removeImage)
      toast('Đã lưu công thức')
      navigate(`/recipe/${saved.id}`, { replace: true })
    } catch (err) {
      toast(err.message || 'Lưu thất bại', 'error')
      setSaving(false)
    }
  }

  const leave = () => {
    uploaded.current.forEach(removeImage)
    goBack()
  }

  const remove = async () => {
    setSaving(true)
    try {
      await deleteRecipe(original)
      toast('Đã xoá công thức')
      navigate('/', { replace: true })
    } catch (err) {
      toast(err.message, 'error')
      setSaving(false)
    }
  }

  return (
    <div className="pb-[calc(2rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-30 pt-safe bg-bg/85 backdrop-blur-xl border-b border-line">
        <div className="flex items-center gap-2 h-14 px-2">
          <button onClick={() => (dirty ? setConfirm('leave') : leave())} className="icon-btn" aria-label="Huỷ">
            <X size={24} />
          </button>
          <h1 className="flex-1 text-lg font-bold truncate">{original ? 'Sửa công thức' : 'Món mới'}</h1>
          <button onClick={save} disabled={saving || uploading} className="btn-primary h-10 px-5 rounded-full">
            {saving ? <LoaderCircle size={18} className="animate-spin" /> : 'Lưu'}
          </button>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-8">
        {/* Ảnh */}
        <section>
          <label
            className={cx(
              'relative flex flex-col items-center justify-center gap-2 w-full aspect-[16/10] rounded-3xl overflow-hidden cursor-pointer transition active:scale-[0.99]',
              form.image_url ? 'bg-surface-2' : 'border-2 border-dashed border-line text-muted',
            )}
          >
            <input type="file" accept="image/*" className="sr-only" onChange={pickImage} disabled={uploading} />
            {form.image_url ? (
              <img src={form.image_url} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <>
                <ImagePlus size={32} />
                <span className="text-sm font-medium">Thêm ảnh món ăn</span>
              </>
            )}
            {uploading && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                <LoaderCircle size={32} className="animate-spin" />
              </div>
            )}
            {form.image_url && !uploading && (
              <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur px-3 py-1.5 text-sm font-medium text-white">
                <ImagePlus size={16} /> Đổi ảnh
              </span>
            )}
          </label>
          {form.image_url && (
            <button onClick={() => set({ image_url: null })} className="mt-2 text-sm text-danger px-1">
              Xoá ảnh
            </button>
          )}
        </section>

        {/* Thông tin */}
        <section className="space-y-4">
          <div>
            <label className="label" htmlFor="title">Tên món *</label>
            <input
              id="title"
              ref={titleRef}
              className="input text-lg font-semibold"
              placeholder="VD: Thịt kho tàu"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              autoFocus={!original}
              enterKeyHint="next"
            />
          </div>
          <div>
            <label className="label" htmlFor="desc">Mô tả ngắn</label>
            <AutoTextarea id="desc" placeholder="Món này có gì đặc biệt…" value={form.description || ''} onChange={(v) => set({ description: v })} rows={2} />
          </div>

          <div>
            <p className="label">Danh mục</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
              <button type="button" onClick={() => set({ category_id: null })} className={cx('chip', !form.category_id && 'chip-active')}>
                Không
              </button>
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => set({ category_id: c.id })}
                  className={cx('chip', form.category_id === c.id && 'chip-active')}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MinutesInput label="Chuẩn bị" value={form.prep_time} onChange={(v) => set({ prep_time: v })} />
            <MinutesInput label="Nấu" value={form.cook_time} onChange={(v) => set({ cook_time: v })} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Khẩu phần</p>
              <p className="text-sm text-muted">số người ăn</p>
            </div>
            <Stepper value={form.servings || 1} onChange={(v) => set({ servings: v })} />
          </div>

          <div>
            <p className="label">Độ khó</p>
            <div className="flex rounded-2xl bg-surface-2 p-1">
              {Object.entries(DIFFICULTY).map(([key, d]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => set({ difficulty: key })}
                  className={cx(
                    'flex-1 h-10 rounded-xl text-sm font-semibold transition',
                    form.difficulty === key ? 'bg-surface shadow-sm text-ink' : 'text-muted',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Nguyên liệu */}
        <section>
          <SectionHeader title="Nguyên liệu" onBulk={() => setBulk('ing')} />
          <ul className="space-y-2">
            {form.ingredients.map((ing, index) =>
              ing.type === 'group' ? (
                <li key={ing.id} className="flex items-center gap-2 pt-3">
                  <Heading size={18} className="text-brand shrink-0 ml-1" />
                  <input
                    id={`name-${ing.id}`}
                    className="input h-11 font-semibold text-brand"
                    placeholder="Tên nhóm (VD: Nước sốt)"
                    value={ing.name}
                    onChange={(e) => updateList('ingredients', ing.id, { name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient(ing.id))}
                    enterKeyHint="next"
                  />
                  <RowActions onUp={() => move('ingredients', index, -1)} onRemove={() => removeFromList('ingredients', ing.id)} />
                </li>
              ) : (
                <li key={ing.id} className="flex items-center gap-1.5">
                  <input
                    id={`amount-${ing.id}`}
                    className="input h-11 w-[3.25rem] shrink-0 px-1.5 text-center"
                    placeholder="SL"
                    inputMode="decimal"
                    value={ing.amount}
                    onChange={(e) => updateList('ingredients', ing.id, { amount: e.target.value })}
                    enterKeyHint="next"
                  />
                  <input
                    className="input h-11 w-[5.25rem] shrink-0 px-1.5 text-center"
                    placeholder="Đơn vị"
                    list="units"
                    value={ing.unit}
                    onChange={(e) => updateList('ingredients', ing.id, { unit: e.target.value })}
                    enterKeyHint="next"
                  />
                  <input
                    id={`name-${ing.id}`}
                    className="input h-11 px-3"
                    placeholder="Nguyên liệu"
                    value={ing.name}
                    onChange={(e) => updateList('ingredients', ing.id, { name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient(ing.id))}
                    enterKeyHint="next"
                  />
                  <button
                    type="button"
                    onClick={() => removeFromList('ingredients', ing.id)}
                    className="icon-btn size-10 text-muted active:text-danger"
                    aria-label="Xoá"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ),
            )}
          </ul>
          <datalist id="units">
            {UNITS.split('|').map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn-soft" onClick={() => addIngredient(null)}>
              <Plus size={18} /> Nguyên liệu
            </button>
            <button type="button" className="btn-soft" onClick={() => addIngredient(null, 'group')}>
              <Heading size={18} /> Nhóm
            </button>
          </div>
        </section>

        {/* Các bước */}
        <section>
          <SectionHeader title="Cách làm" onBulk={() => setBulk('steps')} />
          <ol className="space-y-3">
            {form.steps.map((step, index) => (
              <li key={step.id} className="card p-3">
                <div className="flex items-center gap-1 mb-2">
                  <span className="grid place-items-center size-7 rounded-full bg-brand-soft text-brand text-sm font-bold">{index + 1}</span>
                  <span className="flex-1 ml-1 text-sm font-medium text-muted">Bước {index + 1}</span>
                  <button type="button" className="icon-btn size-9 text-muted disabled:opacity-30" disabled={index === 0} onClick={() => move('steps', index, -1)} aria-label="Lên">
                    <ArrowUp size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn size-9 text-muted disabled:opacity-30"
                    disabled={index === form.steps.length - 1}
                    onClick={() => move('steps', index, 1)}
                    aria-label="Xuống"
                  >
                    <ArrowDown size={18} />
                  </button>
                  <button type="button" className="icon-btn size-9 text-muted active:text-danger" onClick={() => removeFromList('steps', step.id)} aria-label="Xoá">
                    <Trash2 size={18} />
                  </button>
                </div>
                <AutoTextarea
                  id={`step-${step.id}`}
                  className="border-0 bg-surface-2 focus:ring-0"
                  placeholder="Mô tả bước này…"
                  value={step.text}
                  onChange={(v) => updateList('steps', step.id, { text: v })}
                  rows={2}
                />
              </li>
            ))}
          </ol>
          <button type="button" className="btn-soft w-full mt-3" onClick={addStep}>
            <Plus size={18} /> Thêm bước
          </button>
        </section>

        {/* Ghi chú & tag */}
        <section className="space-y-4">
          <div>
            <label className="label" htmlFor="notes">Ghi chú / mẹo</label>
            <AutoTextarea id="notes" placeholder="Mẹo nhỏ, biến tấu, nơi mua nguyên liệu…" value={form.notes || ''} onChange={(v) => set({ notes: v })} rows={3} />
          </div>
          <TagInput tags={form.tags} onChange={(tags) => set({ tags })} />
        </section>

        <button onClick={save} disabled={saving || uploading} className="btn-primary w-full h-14 text-base">
          {saving ? <LoaderCircle size={20} className="animate-spin" /> : 'Lưu công thức'}
        </button>

        {original && (
          <button onClick={() => setConfirm('delete')} className="btn-danger w-full">
            <Trash2 size={18} /> Xoá công thức này
          </button>
        )}
      </div>

      <ConfirmSheet
        open={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        onConfirm={leave}
        danger
        title="Bỏ các thay đổi?"
        message="Những gì bạn vừa nhập sẽ không được lưu."
        confirmText="Bỏ"
      />
      <ConfirmSheet
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        busy={saving}
        danger
        title={`Xoá "${original?.title}"?`}
        message="Không thể hoàn tác sau khi xoá."
        confirmText="Xoá"
      />
      <BulkSheet mode={bulk} onClose={() => setBulk(null)} onApply={applyBulk} />
    </div>
  )
}

function SectionHeader({ title, onBulk }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="section-title">{title}</h2>
      <button type="button" onClick={onBulk} className="flex items-center gap-1.5 text-sm font-medium text-brand p-1">
        <ClipboardPaste size={16} /> Nhập nhanh
      </button>
    </div>
  )
}

function RowActions({ onUp, onRemove }) {
  return (
    <>
      <button type="button" onClick={onUp} className="icon-btn size-10 text-muted" aria-label="Lên">
        <ArrowUp size={18} />
      </button>
      <button type="button" onClick={onRemove} className="icon-btn size-10 text-muted active:text-danger" aria-label="Xoá">
        <Trash2 size={18} />
      </button>
    </>
  )
}

function AutoTextarea({ value, onChange, className, ...props }) {
  const ref = useRef()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} className={cx('textarea', className)} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
}

function MinutesInput({ label, value, onChange }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="relative">
        <input
          className="input pr-14"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">phút</span>
      </div>
    </div>
  )
}

function TagInput({ tags, onChange }) {
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim().replace(/^#/, '').toLowerCase()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setText('')
  }
  return (
    <div>
      <label className="label" htmlFor="tag">Tag</label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="flex items-center gap-1 rounded-full bg-brand-soft text-brand pl-3 pr-2 py-1 text-sm"
            >
              #{t} <X size={14} />
            </button>
          ))}
        </div>
      )}
      <input
        id="tag"
        className="input"
        placeholder="Gõ tag rồi nhấn Enter (VD: ăn kiêng)"
        value={text}
        onChange={(e) => (e.target.value.endsWith(',') ? (setText(e.target.value.slice(0, -1)), setTimeout(add)) : setText(e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        onBlur={add}
        enterKeyHint="done"
      />
    </div>
  )
}

function BulkSheet({ mode, onClose, onApply }) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (mode) setText('')
  }, [mode])
  const isIng = mode === 'ing'
  return (
    <Sheet
      open={!!mode}
      onClose={onClose}
      title={isIng ? 'Nhập nhanh nguyên liệu' : 'Nhập nhanh các bước'}
      footer={
        <button className="btn-primary w-full" disabled={!text.trim()} onClick={() => onApply(text)}>
          Thêm vào công thức
        </button>
      }
    >
      <p className="text-sm text-muted pt-1 pb-3">
        {isIng ? (
          <>
            Mỗi dòng một nguyên liệu, VD: <b>200 g thịt bò</b>. Dòng kết thúc bằng dấu <b>:</b> sẽ thành tên nhóm.
          </>
        ) : (
          'Mỗi dòng là một bước. Số thứ tự ở đầu dòng sẽ tự bỏ.'
        )}
      </p>
      <textarea
        className="textarea min-h-56"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={isIng ? '500 g thịt ba chỉ\n3 tép tỏi\nGia vị:\n2 muỗng nước mắm' : '1. Sơ chế thịt\n2. Ướp gia vị 30 phút\n3. Kho lửa nhỏ'}
      />
    </Sheet>
  )
}
