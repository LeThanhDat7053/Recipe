import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Cloud, Download, HardDrive, KeyRound, LoaderCircle, LogOut, RefreshCw, Smartphone, Upload } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { ConfirmSheet, PageHeader, Sheet } from '../components/ui'
import { canPromptInstall, isIOS, isStandalone, onInstallAvailable, promptInstall } from '../lib/install'

export default function Account() {
  const store = useStore()
  const { isCloud, user, recipes, categories } = store
  const toast = useToast()

  return (
    <>
      <PageHeader title="Tài khoản" />
      <div className="px-4 pt-2 space-y-4">
        {isCloud && user && <Profile />}

        <div className="card p-4 flex gap-3">
          <div className="grid place-items-center size-11 shrink-0 rounded-2xl bg-brand-soft text-brand">
            {isCloud ? <Cloud size={22} /> : <HardDrive size={22} />}
          </div>
          <div>
            <p className="font-semibold">{isCloud ? 'Đồng bộ đám mây' : 'Lưu trên thiết bị này'}</p>
            <p className="text-sm text-muted mt-0.5">
              {isCloud
                ? 'Công thức là của riêng tài khoản này, đăng nhập trên máy nào cũng thấy.'
                : 'Chưa cấu hình Supabase. Dữ liệu chỉ nằm trong trình duyệt này, hãy sao lưu thường xuyên.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat value={recipes.length} label="Món" />
          <Stat value={categories.length} label="Danh mục" />
          <Stat value={recipes.filter((r) => r.is_favorite).length} label="Yêu thích" />
        </div>

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

function Profile() {
  const { user, signOut, updatePassword } = useStore()
  const toast = useToast()
  const [confirmOut, setConfirmOut] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const name = user.user_metadata?.full_name

  const changePassword = async (e) => {
    e.preventDefault()
    if (password.length < 6) return toast('Mật khẩu cần ít nhất 6 ký tự', 'error')
    setBusy(true)
    try {
      await updatePassword(password)
      toast('Đã đổi mật khẩu')
      setPwOpen(false)
      setPassword('')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="grid place-items-center size-12 shrink-0 rounded-full bg-brand text-brand-ink text-lg font-bold uppercase">
          {(name || user.email)?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{name || 'Tài khoản của bạn'}</p>
          <p className="text-sm text-muted truncate">{user.email}</p>
        </div>
      </div>
      <button onClick={() => setPwOpen(true)} className="w-full flex items-center gap-3 px-4 h-14 border-t border-line active:bg-surface-2">
        <KeyRound size={20} className="text-muted" />
        <span className="flex-1 text-left font-medium">Đổi mật khẩu</span>
        <ChevronRight size={18} className="text-muted" />
      </button>
      <button onClick={() => setConfirmOut(true)} className="w-full flex items-center gap-3 px-4 h-14 border-t border-line text-danger active:bg-surface-2">
        <LogOut size={20} />
        <span className="flex-1 text-left font-medium">Đăng xuất</span>
      </button>

      <Sheet
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Đổi mật khẩu"
        footer={
          <button form="pw-form" className="btn-primary w-full" disabled={busy}>
            {busy ? <LoaderCircle size={20} className="animate-spin" /> : 'Lưu mật khẩu mới'}
          </button>
        }
      >
        <form id="pw-form" onSubmit={changePassword} className="pt-3">
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </form>
      </Sheet>

      <ConfirmSheet
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        onConfirm={signOut}
        title="Đăng xuất?"
        message="Công thức vẫn được lưu an toàn, đăng nhập lại là thấy."
        confirmText="Đăng xuất"
        danger
      />
    </div>
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
    const data = { version: 1, exported_at: new Date().toISOString(), categories, recipes }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cong-thuc-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  // Nhập luôn tạo bản ghi mới cho tài khoản hiện tại (file có thể là của người khác gửi)
  const importJson = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data.recipes)) throw new Error('File không đúng định dạng')

      const idMap = {}
      let maxOrder = Math.max(0, ...categories.map((c) => c.sort_order))
      for (const c of data.categories || []) {
        const existing = categories.find((x) => x.name.trim().toLowerCase() === c.name?.trim().toLowerCase())
        idMap[c.id] = existing
          ? existing.id
          : (await saveCategory({ name: c.name, icon: c.icon, sort_order: ++maxOrder })).id
      }
      for (const r of [...data.recipes].reverse()) {
        const { id, user_id, created_at, updated_at, ...rest } = r
        await saveRecipe({ ...rest, category_id: idMap[r.category_id] ?? null })
      }
      toast(`Đã nhập ${data.recipes.length} món`)
    } catch (err) {
      toast(err.message || 'Nhập thất bại', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-4">
      <p className="font-semibold">Sao lưu</p>
      <p className="text-sm text-muted mt-0.5">Xuất công thức ra file JSON để lưu trữ hoặc gửi cho người khác nhập vào tài khoản của họ.</p>
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
