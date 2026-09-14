import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Camera, ClipboardPaste, Heading, ImagePlus, Link2, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { ConfirmSheet, EmptyState, Sheet, Spinner, Stepper, useGoBack } from '../components/ui'
import { cx, DIFFICULTY, isSpiceGroup, parseIngredientLine, recipeImages, uid, UNITS } from '../lib/utils'

const emptyItem = (type = 'item') => ({ id: uid(), type, amount: '', unit: '', name: '' })
const emptyStep = () => ({ id: uid(), text: '', image_url: null })

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
  if (!id) return loading ? <Spinner className="pt-40" /> : <Editor />
  const recipe = recipes.find((r) => r.id === id)
  if (!recipe) return loading ? <Spinner className="pt-40" /> : <EmptyState emoji="🥲" title="Không tìm thấy món này" />
  return <Editor key={recipe.id} original={recipe} />
}

function buildInitial(original, source, categoryId) {
  if (original) {
    return {
      ...original,
      prep_time: original.prep_time ?? '',
      cook_time: original.cook_time ?? '',
      ingredients: original.ingredients?.length ? original.ingredients : [emptyItem()],
      steps: original.steps?.length ? original.steps : [emptyStep()],
      tags: original.tags || [],
    }
  }
  if (source) {
    return {
      title: `${source.title} (bản sao)`,
      description: source.description || '',
      category_id: source.category_id,
      image_url: source.image_url,
      prep_time: source.prep_time ?? '',
      cook_time: source.cook_time ?? '',
      servings: source.servings || 2,
      difficulty: source.difficulty || 'easy',
      ingredients: (source.ingredients || []).map((i) => ({ ...i, id: uid() })),
      steps: (source.steps || []).map((s) => ({ ...s, id: uid() })),
      notes: source.notes || '',
      tags: [...(source.tags || [])],
    }
  }
  return {
    title: '',
    description: '',
    category_id: categoryId || null,
    image_url: null,
    prep_time: '',
    cook_time: '',
    servings: 2,
    difficulty: 'easy',
    ingredients: [emptyItem(), emptyItem(), emptyItem()],
    steps: [emptyStep()],
    notes: '',
    tags: [],
  }
}

function Editor({ original }) {
  const { recipes, categories, saveRecipe, trashRecipe, uploadImage, cleanupImages } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const goBack = useGoBack(original ? `/recipe/${original.id}` : '/')
  const [params] = useSearchParams()
  const source = !original && params.get('from') ? recipes.find((r) => r.id === params.get('from')) : null

  const [initial] = useState(() => buildInitial(original, source, params.get('category')))
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null) // 'main' | stepId
  const [confirm, setConfirm] = useState(null) // 'leave' | 'trash'
  const [bulk, setBulk] = useState(null) // 'ing' | 'steps'
  const [importOpen, setImportOpen] = useState(false)
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

  useEffect(() => {
    if (!focusId.current) return
    document.getElementById(focusId.current)?.focus()
    focusId.current = null
  })

  /* ---------- Ảnh ---------- */
  const upload = async (file, target, maxSize) => {
    setUploading(target)
    try {
      const url = await uploadImage(file, maxSize)
      uploaded.current.push(url)
      return url
    } catch (err) {
      toast(err.message || 'Không tải ảnh lên được', 'error')
      return null
    } finally {
      setUploading(null)
    }
  }
  const pickImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await upload(file, 'main')
    if (url) set({ image_url: url })
  }
  const pickStepImage = (stepId) => async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await upload(file, stepId, 1080)
    if (url) updateList('steps', stepId, { image_url: url })
  }

  /* ---------- Danh sách ---------- */
  const updateList = (key, itemId, patch) =>
    setForm((f) => ({ ...f, [key]: f[key].map((x) => (x.id === itemId ? { ...x, ...patch } : x)) }))
  const removeFromList = (key, itemId) => setForm((f) => ({ ...f, [key]: f[key].filter((x) => x.id !== itemId) }))
  const insertAfter = (key, afterId, item) =>
    setForm((f) => {
      const list = [...f[key]]
      const idx = afterId ? list.findIndex((x) => x.id === afterId) : list.length - 1
      list.splice(idx + 1, 0, item)
      return { ...f, [key]: list }
    })
  const move = (key, index, dir) =>
    setForm((f) => {
      const list = [...f[key]]
      const target = index + dir
      if (target < 0 || target >= list.length) return f
      ;[list[index], list[target]] = [list[target], list[index]]
      return { ...f, [key]: list }
    })

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
  const hasSpiceGroup = form.ingredients.some((i) => i.type === 'group' && isSpiceGroup(i.name))
  const addSpiceGroup = () => {
    const group = { ...emptyItem('group'), name: 'Gia vị' }
    const item = emptyItem()
    focusId.current = `amount-${item.id}`
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, group, item] }))
  }

  const applyBulk = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (bulk === 'ing') {
      const items = lines.map(parseIngredientLine).filter(Boolean)
      setForm((f) => ({ ...f, ingredients: [...f.ingredients.filter((i) => i.name.trim() || i.amount.trim()), ...items] }))
    } else {
      const items = lines.map((l) => ({ ...emptyStep(), text: l.replace(/^(bước\s*)?\d+[.):-]\s*/i, '') }))
      setForm((f) => ({ ...f, steps: [...f.steps.filter((s) => s.text.trim() || s.image_url), ...items] }))
    }
    setBulk(null)
  }

  const applyImport = (d) => {
    setForm((f) => ({
      ...f,
      title: d.title || f.title,
      description: d.description || f.description,
      image_url: d.image_url || f.image_url,
      prep_time: d.prep_time ?? f.prep_time,
      cook_time: d.cook_time ?? f.cook_time,
      servings: d.servings || f.servings,
      ingredients: d.ingredients?.length ? d.ingredients.map(parseIngredientLine).filter(Boolean) : f.ingredients,
      steps: d.steps?.length ? d.steps.map((text) => ({ ...emptyStep(), text })) : f.steps,
      tags: [...new Set([...f.tags, ...(d.tags || [])])],
      notes: f.notes || (d.source_url ? `Nguồn: ${d.source_url}` : ''),
    }))
    setImportOpen(false)
    toast(d.partial ? 'Trang này chỉ lấy được tên và ảnh, bạn nhập thêm phần còn lại nhé' : 'Đã nhập, kiểm tra lại rồi bấm Lưu')
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
        steps: form.steps
          .filter((s) => s.text.trim() || s.image_url)
          .map((s) => ({ ...s, text: s.text.trim() })),
      })
      cleanupImages([...uploaded.current, ...(original ? recipeImages(original) : [])], { excludeIds: [saved.id], include: [saved] })
      toast('Đã lưu công thức')
      navigate(`/recipe/${saved.id}`, { replace: true })
    } catch (err) {
      toast(err.message || 'Lưu thất bại', 'error')
      setSaving(false)
    }
  }

  const leave = () => {
    cleanupImages(uploaded.current)
    goBack()
  }

  const trash = async () => {
    setSaving(true)
    try {
      await trashRecipe(original)
      cleanupImages(uploaded.current)
      toast('Đã chuyển vào thùng rác')
      navigate('/', { replace: true })
    } catch (err) {
      toast(err.message, 'error')
      setSaving(false)
    }
  }

  const busy = saving || !!uploading

  return (
    <div className="pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 pt-safe bg-bg/85 backdrop-blur-xl border-b border-line">
        <div className="flex items-center gap-2 h-14 px-2">
          <button onClick={() => (dirty ? setConfirm('leave') : leave())} className="icon-btn" aria-label="Huỷ">
            <X size={24} />
          </button>
          <h1 className="flex-1 text-lg font-bold truncate">{original ? 'Sửa công thức' : source ? 'Nhân bản món' : 'Món mới'}</h1>
          <button onClick={save} disabled={busy} className="btn-primary h-10 px-5 rounded-full">
            {saving ? <LoaderCircle size={18} className="animate-spin" /> : 'Lưu'}
          </button>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-8">
        {!original && !source && (
          <button onClick={() => setImportOpen(true)} className="card w-full flex items-center gap-3 p-3 text-left active:scale-[0.99] transition">
            <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-brand-soft text-brand">
              <Link2 size={22} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold">Nhập từ link</span>
              <span className="block text-sm text-muted truncate">Dán link bài công thức trên web để tự điền</span>
            </span>
          </button>
        )}

        {/* Ảnh */}
        <section>
          <label
            className={cx(
              'relative flex flex-col items-center justify-center gap-2 w-full aspect-[16/10] rounded-3xl overflow-hidden cursor-pointer transition active:scale-[0.99]',
              form.image_url ? 'bg-surface-2' : 'border-2 border-dashed border-line text-muted',
            )}
          >
            <input type="file" accept="image/*" className="sr-only" onChange={pickImage} disabled={!!uploading} />
            {form.image_url ? (
              <img src={form.image_url} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <>
                <ImagePlus size={32} />
                <span className="text-sm font-medium">Thêm ảnh món ăn</span>
              </>
            )}
            {uploading === 'main' && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                <LoaderCircle size={32} className="animate-spin" />
              </div>
            )}
            {form.image_url && uploading !== 'main' && (
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
                <button type="button" key={c.id} onClick={() => set({ category_id: c.id })} className={cx('chip', form.category_id === c.id && 'chip-active')}>
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
                  className={cx('flex-1 h-10 rounded-xl text-sm font-semibold transition', form.difficulty === key ? 'bg-surface shadow-sm text-ink' : 'text-muted')}
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
                  <button type="button" onClick={() => move('ingredients', index, -1)} className="icon-btn size-10 text-muted" aria-label="Lên">
                    <ArrowUp size={18} />
                  </button>
                  <button type="button" onClick={() => removeFromList('ingredients', ing.id)} className="icon-btn size-10 text-muted active:text-danger" aria-label="Xoá">
                    <Trash2 size={18} />
                  </button>
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
                  <button type="button" onClick={() => removeFromList('ingredients', ing.id)} className="icon-btn size-10 text-muted active:text-danger" aria-label="Xoá">
                    <Trash2 size={18} />
                  </button>
                </li>
              ),
            )}
          </ul>
          <datalist id="units">
            {UNITS.map((u) => (
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
          {!hasSpiceGroup && (
            <button type="button" className="btn-ghost w-full mt-1 h-11 text-brand" onClick={addSpiceGroup}>
              🧂 Thêm nhóm Gia vị
            </button>
          )}
          <p className="mt-2 text-xs text-muted leading-relaxed">
            Nguyên liệu trong nhóm <b>Gia vị</b> và gia vị cơ bản (muối, đường, nước mắm…) sẽ không tự thêm vào đi chợ.
          </p>
        </section>

        {/* Các bước */}
        <section>
          <SectionHeader title="Cách làm" onBulk={() => setBulk('steps')} />
          <ol className="space-y-3">
            {form.steps.map((step, index) => (
              <li key={step.id} className="card p-3">
                <div className="flex items-center gap-0.5 mb-2">
                  <span className="grid place-items-center size-7 rounded-full bg-brand-soft text-brand text-sm font-bold">{index + 1}</span>
                  <span className="flex-1 ml-2 text-sm font-medium text-muted">Bước {index + 1}</span>
                  <label className="icon-btn size-9 text-muted cursor-pointer" aria-label="Thêm ảnh cho bước">
                    <input type="file" accept="image/*" className="sr-only" onChange={pickStepImage(step.id)} disabled={!!uploading} />
                    {uploading === step.id ? <LoaderCircle size={18} className="animate-spin" /> : <Camera size={18} />}
                  </label>
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
                  placeholder="Mô tả bước này… (VD: luộc 10 phút → sẽ có nút hẹn giờ)"
                  value={step.text}
                  onChange={(v) => updateList('steps', step.id, { text: v })}
                  rows={2}
                />
                {step.image_url && (
                  <div className="relative mt-2">
                    <img src={step.image_url} alt="" className="w-full max-h-56 object-cover rounded-2xl" />
                    <button
                      type="button"
                      onClick={() => updateList('steps', step.id, { image_url: null })}
                      className="absolute top-2 right-2 icon-btn size-9 bg-black/50 text-white"
                      aria-label="Xoá ảnh bước"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
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

        <button onClick={save} disabled={busy} className="btn-primary w-full h-14 text-base">
          {saving ? <LoaderCircle size={20} className="animate-spin" /> : 'Lưu công thức'}
        </button>

        {original && (
          <button onClick={() => setConfirm('trash')} className="btn-danger w-full">
            <Trash2 size={18} /> Chuyển vào thùng rác
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
        open={confirm === 'trash'}
        onClose={() => setConfirm(null)}
        onConfirm={trash}
        busy={saving}
        danger
        title={`Chuyển "${original?.title}" vào thùng rác?`}
        message="Có thể khôi phục trong 30 ngày."
        confirmText="Chuyển"
      />
      <BulkSheet mode={bulk} onClose={() => setBulk(null)} onApply={applyBulk} />
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} onImported={applyImport} />
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
  const add = (raw = text) => {
    const t = raw.trim().replace(/^#/, '').toLowerCase()
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
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        onBlur={() => add()}
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

function ImportSheet({ open, onClose, onImported }) {
  const { importFromUrl } = useStore()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setUrl('')
      setError('')
    }
  }, [open])

  const paste = async () => {
    try {
      setUrl((await navigator.clipboard.readText()).trim())
    } catch {
      setError('Không đọc được bộ nhớ tạm, hãy dán thủ công')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const link = url.trim()
    if (!/^https?:\/\//i.test(link)) return setError('Link phải bắt đầu bằng http:// hoặc https://')
    setBusy(true)
    setError('')
    try {
      onImported(await importFromUrl(link))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nhập từ link"
      footer={
        <button form="import-form" className="btn-primary w-full" disabled={busy || !url.trim()}>
          {busy ? (
            <>
              <LoaderCircle size={20} className="animate-spin" /> Đang đọc trang…
            </>
          ) : (
            'Lấy công thức'
          )}
        </button>
      }
    >
      <form id="import-form" onSubmit={submit} className="pt-2 space-y-3">
        <p className="text-sm text-muted">Hỗ trợ đa số web nấu ăn (Cooky, Điện Máy Xanh, AllRecipes…). Blog cá nhân có thể chỉ lấy được tên và ảnh.</p>
        <div className="flex gap-2">
          <input
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          {navigator.clipboard?.readText && (
            <button type="button" onClick={paste} className="btn-soft px-3 shrink-0" aria-label="Dán">
              <ClipboardPaste size={20} />
            </button>
          )}
        </div>
        {error && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      </form>
    </Sheet>
  )
}
