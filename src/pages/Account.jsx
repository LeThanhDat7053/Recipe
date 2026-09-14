import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Cloud, Download, HardDrive, LoaderCircle, Plus, RefreshCw, Smartphone, Trash2, Upload, Volume2, X } from 'lucide-react'
import { DEFAULT_PANTRY, normalize } from '../lib/utils'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { VoiceSheet } from '../components/VoiceSheet'
import { PageHeader } from '../components/ui'
import { canPromptInstall, isIOS, isStandalone, onInstallAvailable, promptInstall } from '../lib/install'

export default function Account() {
  const store = useStore()
  const { isCloud, recipes, categories, trash, cookLogs, pendingCount } = store
  const toast = useToast()

  return (
    <>
      <PageHeader back title="Cài đặt" />
      <div className="px-4 pt-2 space-y-4">
        <div className="card p-4 flex gap-3">
          <div className="grid place-items-center size-11 shrink-0 rounded-2xl bg-brand-soft text-brand">
            {isCloud ? <Cloud size={22} /> : <HardDrive size={22} />}
          </div>
          <div className="flex-1">
            <p className="font-semibold">{isCloud ? 'Sổ tay chung của gia đình' : 'Lưu trên thiết bị này'}</p>
            <p className="text-sm text-muted mt-0.5">
              {isCloud
                ? 'Cả nhà cùng xem và sửa, máy nào cũng thấy. Mất mạng vẫn dùng được, có mạng lại tự đồng bộ.'
                : 'Chưa cấu hình Supabase. Dữ liệu chỉ nằm trong trình duyệt này, hãy sao lưu thường xuyên.'}
            </p>
            {pendingCount > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium">
                <RefreshCw size={12} /> {pendingCount} thay đổi đang chờ đồng bộ
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat value={recipes.length} label="Món" />
          <Stat value={categories.length} label="Danh mục" />
          <Stat value={cookLogs.length} label="Lần nấu" />
        </div>

        <PantryCard />

        <VoiceRow />

        <Link to="/trash" className="card flex items-center gap-3 px-4 h-14 active:bg-surface-2">
          <Trash2 size={20} className="text-muted" />
          <span className="flex-1 font-medium">Thùng rác</span>
          {trash.length > 0 && <span className="text-sm text-muted">{trash.length} món</span>}
          <ChevronRight size={18} className="text-muted" />
        </Link>

        <InstallCard />

        <Backup toast={toast} />

        {isCloud && (
          <button
            className="btn-ghost w-full text-muted"
            onClick={async () => {
              await store.refresh()
              toast('Đã làm mới dữ liệu')
            }}
          >
            <RefreshCw size={18} /> Làm mới dữ liệu
          </button>
        )}
      </div>
    </>
  )
}

const Stat = ({ value, label }) => (
  <div className="card py-3 text-center">
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs text-muted">{label}</p>
  </div>
)

function PantryCard() {
  const { pantry: list, savePantry } = useStore()
  const toast = useToast()
  const [text, setText] = useState('')

  const update = (next) => savePantry(next).catch((e) => toast(e.message, 'error'))
  const add = (e) => {
    e.preventDefault()
    const v = text.trim().toLowerCase()
    if (v && !list.some((x) => normalize(x) === normalize(v))) update([...list, v])
    setText('')
  }

  return (
    <div className="card p-4">
      <p className="font-semibold">🧂 Gia vị có sẵn trong bếp</p>
      <p className="text-sm text-muted mt-0.5">
        Không tự thêm vào đi chợ và không tính là "thiếu" ở Tủ lạnh còn gì. Dùng chung cả nhà. Chạm để bỏ.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {list.map((x) => (
          <button
            key={x}
            onClick={() => update(list.filter((y) => y !== x))}
            className="flex items-center gap-1 rounded-full bg-surface-2 pl-3 pr-2 py-1 text-sm active:scale-95 transition"
          >
            {x} <X size={14} className="text-muted" />
          </button>
        ))}
      </div>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input className="input h-11" placeholder="Thêm gia vị… (VD: ngũ vị hương)" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done" />
        <button className="btn-soft h-11 px-4 shrink-0" disabled={!text.trim()} aria-label="Thêm">
          <Plus size={18} />
        </button>
      </form>
      <button onClick={() => update(DEFAULT_PANTRY)} className="mt-2 text-sm text-muted">
        Khôi phục mặc định
      </button>
    </div>
  )
}

function VoiceRow() {
  const [open, setOpen] = useState(false)
  if (!('speechSynthesis' in window)) return null
  return (
    <>
      <button onClick={() => setOpen(true)} className="card w-full flex items-center gap-3 px-4 h-14 active:bg-surface-2">
        <Volume2 size={20} className="text-muted" />
        <span className="flex-1 text-left font-medium">Giọng đọc</span>
        <span className="text-sm text-muted">Tốc độ, chọn giọng</span>
        <ChevronRight size={18} className="text-muted" />
      </button>
      <VoiceSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function InstallCard() {
  const [available, setAvailable] = useState(canPromptInstall)
  useEffect(() => onInstallAvailable(setAvailable), [])
  if (isStandalone()) return null
  if (!available && !isIOS()) return null

  return (
    <div className="card p-4 flex gap-3">
      <div className="grid place-items-center size-11 shrink-0 rounded-2xl bg-brand-soft text-brand">
        <Smartphone size={22} />
      </div>
      <div className="flex-1">
        <p className="font-semibold">Cài lên màn hình chính</p>
        {available ? (
          <button className="btn-primary h-10 mt-2 px-4" onClick={promptInstall}>
            Cài đặt ứng dụng
          </button>
        ) : (
          <p className="text-sm text-muted mt-0.5">
            Trên Safari: bấm nút <b>Chia sẻ</b> rồi chọn <b>Thêm vào MH chính</b>.
          </p>
        )}
      </div>
    </div>
  )
}

function Backup({ toast }) {
  const { recipes, categories, saveCategory, saveRecipe } = useStore()
  const fileRef = useRef()
  const [busy, setBusy] = useState(false)

  const exportJson = () => {
    const data = { version: 2, exported_at: new Date().toISOString(), categories, recipes }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cong-thuc-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  // Nhập luôn tạo món mới (tránh ghi đè món đang có)
  const importJson = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data.recipes)) throw new Error('File không đúng định dạng')

      const idMap = {}
      let order = Math.max(0, ...categories.map((c) => c.sort_order))
      for (const c of data.categories || []) {
        const existing = categories.find((x) => x.name.trim().toLowerCase() === c.name?.trim().toLowerCase())
        idMap[c.id] = existing ? existing.id : (await saveCategory({ name: c.name, icon: c.icon, sort_order: ++order })).id
      }
      const list = data.recipes.filter((r) => !r.deleted_at)
      for (const r of [...list].reverse()) {
        const { id, user_id, created_at, updated_at, share_id, deleted_at, author_name, ...rest } = r
        await saveRecipe({ ...rest, category_id: idMap[r.category_id] ?? null })
      }
      toast(`Đã nhập ${list.length} món`)
    } catch (err) {
      toast(err.message || 'Nhập thất bại', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-4">
      <p className="font-semibold">Sao lưu</p>
      <p className="text-sm text-muted mt-0.5">Nên xuất file sao lưu định kỳ, phòng khi ai đó lỡ tay xoá nhầm.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn-soft" onClick={exportJson}>
          <Download size={18} /> Xuất
        </button>
        <button className="btn-soft" onClick={() => fileRef.current.click()} disabled={busy}>
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Upload size={18} />} Nhập
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importJson} />
      </div>
    </div>
  )
}
