import { useState } from 'react'
import { Eye, EyeOff, LoaderCircle, MailCheck } from 'lucide-react'
import { useStore } from '../store'
import { cx } from '../lib/utils'

export default function Auth() {
  const { signIn, signUp } = useStore()
  const [mode, setMode] = useState('in') // 'in' | 'up'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  const isUp = mode === 'up'

  const switchMode = (m) => {
    setMode(m)
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (isUp && password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự')
    setBusy(true)
    try {
      if (isUp) {
        const needsConfirm = await signUp(name.trim(), email.trim(), password)
        if (needsConfirm) setSentTo(email.trim())
      } else {
        await signIn(email.trim(), password)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <Screen>
        <div className="card p-6 text-center animate-pop-in">
          <div className="mx-auto grid place-items-center size-16 rounded-full bg-brand-soft text-brand">
            <MailCheck size={32} />
          </div>
          <p className="mt-4 text-lg font-bold">Kiểm tra email của bạn</p>
          <p className="mt-2 text-muted leading-relaxed">
            Đã gửi link xác nhận tới <b className="text-ink">{sentTo}</b>. Bấm vào link đó rồi quay lại đăng nhập nhé.
          </p>
          <button
            className="btn-primary w-full mt-6"
            onClick={() => {
              setSentTo('')
              switchMode('in')
            }}
          >
            Về trang đăng nhập
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <div className="flex rounded-2xl bg-surface-2 p-1 mb-5">
        {[
          ['in', 'Đăng nhập'],
          ['up', 'Tạo tài khoản'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchMode(key)}
            className={cx(
              'flex-1 h-11 rounded-xl text-sm font-semibold transition',
              mode === key ? 'bg-surface text-ink shadow-sm' : 'text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3" key={mode}>
        {isUp && (
          <input
            className="input animate-fade-in"
            placeholder="Tên của bạn"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="relative">
          <input
            className="input pr-12"
            type={showPw ? 'text' : 'password'}
            autoComplete={isUp ? 'new-password' : 'current-password'}
            placeholder={isUp ? 'Mật khẩu (tối thiểu 6 ký tự)' : 'Mật khẩu'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-1 top-1/2 -translate-y-1/2 icon-btn text-muted"
            aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {error && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger animate-fade-in">{error}</p>}

        <button className="btn-primary w-full h-13 text-base" disabled={busy}>
          {busy ? <LoaderCircle size={22} className="animate-spin" /> : isUp ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isUp ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
        <button type="button" className="font-semibold text-brand" onClick={() => switchMode(isUp ? 'in' : 'up')}>
          {isUp ? 'Đăng nhập' : 'Tạo tài khoản mới'}
        </button>
      </p>
    </Screen>
  )
}

function Screen({ children }) {
  return (
    <div className="min-h-dvh flex flex-col justify-center px-5 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
          <img src="/favicon.svg" alt="" className="mx-auto size-20 rounded-[1.4rem] shadow-lg shadow-brand/25" />
          <h1 className="mt-5 text-[1.75rem] font-bold tracking-tight">Sổ Tay Nấu Ăn</h1>
          <p className="mt-1 text-muted">Công thức của riêng bạn, luôn trong túi</p>
        </div>
        {children}
      </div>
    </div>
  )
}
