import { Suspense } from 'react'
import { Outlet, ScrollRestoration, useMatches } from 'react-router-dom'
import BottomNav from './BottomNav'
import { Spinner } from './ui'
import { useStore } from '../store'
import Auth from '../pages/Auth'

export default function Layout() {
  const { isCloud, authReady, session } = useStore()
  const hideNav = useMatches().some((m) => m.handle?.hideNav)

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
      <ScrollRestoration />
    </div>
  )
}
