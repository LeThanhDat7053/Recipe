import { NavLink, Link } from 'react-router-dom'
import { House, LayoutGrid, Plus, Search, UserRound } from 'lucide-react'
import { useStore } from '../store'
import { cx } from '../lib/utils'

const Item = ({ to, label, icon: Icon, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      cx(
        'flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium transition-colors',
        isActive ? 'text-brand' : 'text-muted',
      )
    }
  >
    {({ isActive }) => (
      <>
        <span className={cx('grid place-items-center h-8 w-14 rounded-full transition', isActive && 'bg-brand-soft')}>
          <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
        </span>
        {label}
      </>
    )}
  </NavLink>
)

export default function BottomNav() {
  const { canEdit } = useStore()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-safe bg-surface/90 backdrop-blur-xl border-t border-line">
      <div className={cx('mx-auto max-w-2xl grid', canEdit ? 'grid-cols-5' : 'grid-cols-4')}>
        <Item to="/" label="Trang chủ" icon={House} end />
        <Item to="/categories" label="Danh mục" icon={LayoutGrid} />
        {canEdit && (
          <div className="grid place-items-center">
            <Link
              to="/recipe/new"
              aria-label="Thêm món mới"
              className="grid place-items-center size-13 -mt-5 rounded-2xl bg-brand text-brand-ink shadow-lg shadow-brand/30 ring-4 ring-bg transition active:scale-90"
            >
              <Plus size={28} strokeWidth={2.5} />
            </Link>
          </div>
        )}
        <Item to="/search" label="Tìm kiếm" icon={Search} />
        <Item to="/account" label="Tài khoản" icon={UserRound} />
      </div>
    </nav>
  )
}
