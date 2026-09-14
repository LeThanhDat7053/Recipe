import { useState } from 'react'
import { Trash2, Undo2 } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { RecipeRow } from '../components/RecipeCard'
import { ConfirmSheet, EmptyState, PageHeader } from '../components/ui'
import { daysSince, timeAgo } from '../lib/utils'

export default function Trash() {
  const { trash, restoreRecipe, purgeRecipes } = useStore()
  const toast = useToast()
  const [confirm, setConfirm] = useState(null) // recipe | 'all'
  const [busy, setBusy] = useState(false)

  const run = async (fn, message) => {
    setBusy(true)
    try {
      await fn()
      if (message) toast(message)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <>
      <PageHeader
        back
        backTo="/account"
        title="Thùng rác"
        right={
          trash.length > 0 && (
            <button onClick={() => setConfirm('all')} className="btn-ghost h-10 px-3 text-danger">
              Dọn sạch
            </button>
          )
        }
      />

      {trash.length === 0 ? (
        <EmptyState emoji="🗑️" title="Thùng rác trống" text="Món bị xoá sẽ nằm ở đây 30 ngày trước khi xoá hẳn." />
      ) : (
        <div className="px-2">
          <p className="px-2 pb-1 text-sm text-muted">Món sẽ tự xoá vĩnh viễn sau 30 ngày.</p>
          {trash.map((r) => (
            <RecipeRow
              key={r.id}
              recipe={r}
              link={false}
              extra={
                <span className="text-muted">
                  Đã xoá {timeAgo(r.deleted_at)} · còn {Math.max(0, 30 - Math.floor(daysSince(r.deleted_at)))} ngày
                </span>
              }
              right={
                <div className="flex shrink-0">
                  <button
                    onClick={() => run(() => restoreRecipe(r), 'Đã khôi phục')}
                    disabled={busy}
                    className="icon-btn text-brand"
                    aria-label="Khôi phục"
                  >
                    <Undo2 size={20} />
                  </button>
                  <button onClick={() => setConfirm(r)} disabled={busy} className="icon-btn text-muted" aria-label="Xoá vĩnh viễn">
                    <Trash2 size={20} />
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      <ConfirmSheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        busy={busy}
        danger
        title={confirm === 'all' ? `Xoá vĩnh viễn ${trash.length} món?` : `Xoá vĩnh viễn "${confirm?.title}"?`}
        message="Không thể khôi phục sau khi xoá. Nhật ký nấu của món cũng bị xoá theo."
        confirmText="Xoá vĩnh viễn"
        onConfirm={() => run(() => purgeRecipes(confirm === 'all' ? trash : [confirm]), 'Đã xoá vĩnh viễn')}
      />
    </>
  )
}
