import { Suspense, useEffect } from 'react'
import { Outlet, ScrollRestoration, useMatches, useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav'
import { Spinner } from './ui'
import { useToast } from './Toast'
import { PENDING_SHARE_KEY, useStore } from '../store'
import { TimerDock } from '../timers'
import Auth from '../pages/Auth'

export default function Layout() {
  const { isCloud, authReady, session, loading, importShared } = useStore()
  const matches = useMatches()
  const hideNav = matches.some((m) => m.handle?.hideNav)
  const hideTimers = matches.some((m) => m.handle?.hideTimers)
  const navigate = useNavigate()
  const toast = useToast()

  // Bấm "Lưu vào sổ" trên link chia sẻ khi chưa đăng nhập -> đăng nhập xong tự lưu
  useEffect(() => {
    if (!session || loading) return
    const pending = sessionStorage.getItem(PENDING_SHARE_KEY)
    if (!pending) return
    sessionStorage.removeItem(PENDING_SHARE_KEY)
    importShared(pending)
      .then((saved) => {
        toast('Đã lưu công thức vào sổ của bạn')
        navigate(`/recipe/${saved.id}`)
      })
      .catch((e) => toast(e.message, 'error'))
  }, [session, loading, importShared, navigate, toast])

  if (!authReady) return <Spinner className="pt-[40dvh]" />
  // Chưa đăng nhập -> chỉ hiện màn hình đăng nhập, không lộ dữ liệu nào
  if (isCloud && !session) return <Auth />

  return (
    <div className="mx-auto max-w-2xl min-h-dvh">
      <main className={hideNav ? '' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'}>
        <Suspense fallback={<Spinner className="pt-40" />}>
          <Outlet />
        </Suspense>
      </main>
      {!hideNav && <BottomNav />}
      <TimerDock hidden={hideTimers} />
      <ScrollRestoration />
    </div>
  )
}
