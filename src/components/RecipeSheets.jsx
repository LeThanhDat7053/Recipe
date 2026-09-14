import { useEffect, useState } from 'react'
import { Check, Copy, Download, Globe, LoaderCircle, Plus, Share2 } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from './Toast'
import { ConfirmSheet, EmojiGrid, Sheet, Spinner, Switch } from './ui'
import { cx, nowISO, shareOrCopy } from '../lib/utils'

const pad = (n) => String(n).padStart(2, '0')
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* ---------------- Ghi lại lần nấu ---------------- */
export function LogSheet({ open, onClose, recipe, title = 'Ghi lại lần nấu', onSaved, onSkip }) {
  const { addCookLog } = useStore()
  const toast = useToast()
  const [date, setDate] = useState(todayStr)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(todayStr())
      setNote('')
    }
  }, [open])

  const save = async () => {
    setBusy(true)
    try {
      const cooked_at = date === todayStr() ? nowISO() : new Date(`${date}T12:00:00`).toISOString()
      await addCookLog({ recipe_id: recipe.id, cooked_at, note: note.trim() })
      toast('Đã ghi vào nhật ký nấu')
      onClose()
      onSaved?.()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          {onSkip && (
            <button className="btn-soft" onClick={onSkip}>
              Bỏ qua
            </button>
          )}
          <button className="btn-primary flex-1" onClick={save} disabled={busy}>
            {busy ? <LoaderCircle size={20} className="animate-spin" /> : 'Lưu vào nhật ký'}
          </button>
        </div>
      }
    >
      <div className="pt-3 space-y-4">
        <div>
          <label className="label" htmlFor="log-date">Ngày nấu</label>
          <input id="log-date" type="date" className="input" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} />
        </div>
        <div>
          <label className="label" htmlFor="log-note">Ghi chú lần này</label>
          <textarea
            id="log-note"
            className="textarea"
            rows={3}
            placeholder="VD: bớt đường, thêm ớt, cả nhà khen ngon…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Sheet>
  )
}

/* ---------------- Chia sẻ link công khai ---------------- */
export function ShareSheet({ open, onClose, recipe }) {
  const { isCloud, setSharing } = useStore()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const link = recipe.share_id ? `${window.location.origin}/s/${recipe.share_id}` : ''

  const toggle = async (on) => {
    setBusy(true)
    try {
      await setSharing(recipe, on)
      toast(on ? 'Đã bật chia sẻ' : 'Đã tắt chia sẻ, link cũ không còn xem được')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Chia sẻ công thức">
      <div className="pt-3 space-y-4">
        {!isCloud ? (
          <p className="text-muted">Cần kết nối Supabase để chia sẻ bằng link.</p>
        ) : (
          <>
            <div className="card p-4 flex items-center gap-3">
              <div className="grid place-items-center size-10 shrink-0 rounded-full bg-brand-soft text-brand">
                <Globe size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Chia sẻ bằng link</p>
                <p className="text-sm text-muted">Ai có link đều xem được món này, không cần tài khoản.</p>
              </div>
              <Switch checked={!!recipe.share_id} onChange={toggle} disabled={busy} label="Bật chia sẻ" />
            </div>
            {link && (
              <div className="animate-fade-in space-y-3">
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm break-all select-all">{link}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn-soft"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link)
                        toast('Đã sao chép link')
                      } catch {
                        toast('Không sao chép được, hãy giữ tay để chọn link', 'error')
                      }
                    }}
                  >
                    <Copy size={18} /> Sao chép
                  </button>
                  <button className="btn-primary" onClick={() => shareOrCopy({ title: recipe.title, text: `Công thức ${recipe.title}`, url: link }, toast)}>
                    <Share2 size={18} /> Gửi
                  </button>
                </div>
                <p className="text-xs text-muted">Người nhận có thể bấm "Lưu vào sổ của tôi" để chép món về tài khoản của họ.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}

/* ---------------- Thêm vào bộ sưu tập ---------------- */
export function CollectionSheet({ open, onClose, recipe }) {
  const { collections, toggleInCollection, saveCollection } = useStore()
  const toast = useToast()
  const [name, setName] = useState('')

  const run = async (fn) => {
    try {
      await fn()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const create = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    run(async () => {
      await saveCollection({ name: name.trim(), icon: '📁', recipe_ids: [recipe.id] })
      setName('')
      toast('Đã tạo bộ sưu tập')
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Bộ sưu tập">
      <div className="pt-2">
        {collections.length === 0 && <p className="py-3 text-muted">Chưa có bộ sưu tập nào. Tạo cái đầu tiên nhé!</p>}
        <ul>
          {collections.map((c) => {
            const on = (c.recipe_ids || []).includes(recipe.id)
            return (
              <li key={c.id}>
                <button
                  onClick={() => run(() => toggleInCollection(c.id, recipe.id))}
                  className="w-full flex items-center gap-3 py-3 text-left active:opacity-60"
                >
                  <span className="text-2xl w-9 text-center">{c.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{c.name}</span>
                    <span className="block text-xs text-muted">{(c.recipe_ids || []).length} món</span>
                  </span>
                  <span className={cx('grid place-items-center size-7 rounded-full border-2 transition', on ? 'bg-brand border-brand text-brand-ink' : 'border-line')}>
                    {on && <Check size={16} strokeWidth={3} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <form onSubmit={create} className="flex gap-2 pt-3 border-t border-line mt-2">
          <input className="input" placeholder="Tạo bộ sưu tập mới…" value={name} onChange={(e) => setName(e.target.value)} enterKeyHint="done" />
          <button className="btn-primary px-4 shrink-0" disabled={!name.trim()} aria-label="Tạo">
            <Plus size={20} />
          </button>
        </form>
      </div>
    </Sheet>
  )
}

/* ---------------- Tạo / sửa bộ sưu tập ---------------- */
export function CollectionFormSheet({ open, onClose, collection, onDeleted }) {
  const { saveCollection, deleteCollection } = useStore()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', icon: '📁' })
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setForm(collection ? { ...collection } : { name: '', icon: '📁' })
  }, [open, collection])

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    try {
      await saveCollection({ ...form, name: form.name.trim() })
      toast(collection ? 'Đã cập nhật' : 'Đã tạo bộ sưu tập')
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteCollection(collection.id)
      toast('Đã xoá bộ sưu tập')
      setConfirm(false)
      onClose()
      onDeleted?.()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Sheet
        open={open && !confirm}
        onClose={onClose}
        title={collection ? 'Sửa bộ sưu tập' : 'Bộ sưu tập mới'}
        footer={
          <div className="flex gap-3">
            {collection && (
              <button type="button" className="btn-danger" onClick={() => setConfirm(true)}>
                Xoá
              </button>
            )}
            <button form="col-form" className="btn-primary flex-1" disabled={busy || !form.name.trim()}>
              Lưu
            </button>
          </div>
        }
      >
        <form id="col-form" onSubmit={save} className="pt-3 space-y-4">
          <div className="flex gap-3">
            <div className="grid place-items-center size-12 shrink-0 rounded-2xl bg-surface-2 text-3xl">{form.icon || '📁'}</div>
            <input
              className="input"
              placeholder="VD: Mâm cỗ Tết, Món cho bé…"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus={!collection}
            />
          </div>
          <div>
            <p className="label">Biểu tượng</p>
            <EmojiGrid value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
          </div>
        </form>
      </Sheet>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        busy={busy}
        danger
        title={`Xoá "${form.name}"?`}
        message="Chỉ xoá bộ sưu tập, các công thức bên trong vẫn còn."
        confirmText="Xoá"
      />
    </>
  )
}

/* ---------------- Xuất ảnh thẻ công thức ---------------- */
export function CardSheet({ open, onClose, recipe, factor = 1, servings }) {
  const { categoryMap } = useStore()
  const toast = useToast()
  const [image, setImage] = useState(null) // { url, blob }
  const [error, setError] = useState('')
  const cat = categoryMap[recipe.category_id]
  const filename = `${recipe.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let url = null
    setImage(null)
    setError('')
    import('../lib/card')
      .then((m) => m.renderRecipeCard(recipe, { factor, servings: servings || recipe.servings || 1, categoryLabel: cat?.name || '', emoji: cat?.icon }))
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setImage({ url, blob })
      })
      .catch((e) => !cancelled && setError(e.message || 'Không tạo được ảnh'))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const download = () => {
    const a = document.createElement('a')
    a.href = image.url
    a.download = filename
    a.click()
  }

  const share = async () => {
    const file = new File([image.blob], filename, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: recipe.title })
      } catch (e) {
        if (e.name !== 'AbortError') toast('Không chia sẻ được', 'error')
      }
    } else {
      download()
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Ảnh thẻ công thức"
      footer={
        image && (
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-soft" onClick={download}>
              <Download size={18} /> Tải về
            </button>
            <button className="btn-primary" onClick={share}>
              <Share2 size={18} /> Chia sẻ
            </button>
          </div>
        )
      }
    >
      <div className="pt-3">
        {error ? (
          <p className="py-10 text-center text-danger">{error}</p>
        ) : image ? (
          <img src={image.url} alt="Thẻ công thức" className="w-full rounded-2xl border border-line animate-fade-in" />
        ) : (
          <div className="py-16 text-center text-muted">
            <Spinner />
            <p className="mt-3 text-sm">Đang tạo ảnh…</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}
