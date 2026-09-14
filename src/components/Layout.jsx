import { Suspense } from 'react'
import { Outlet, ScrollRestoration, useMatches } from 'react-router-dom'
import BottomNav from './BottomNav'
import { Spinner } from './ui'
import { TimerDock } from '../timers'

export default function Layout() {
  const matches = useMatches()
  const hideNav = matches.some((m) => m.handle?.hideNav)
  const hideTimers = matches.some((m) => m.handle?.hideTimers)

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
