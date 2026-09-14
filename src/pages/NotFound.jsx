import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui'

export default function NotFound() {
  return (
    <div className="pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <EmptyState
        emoji="🍽️"
        title="Trang không tồn tại"
        action={
          <Link to="/" className="btn-primary px-6">
            Về trang chủ
          </Link>
        }
      />
    </div>
  )
}
