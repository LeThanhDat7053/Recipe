import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PENDING_SHARE_KEY, useStore } from '../store'
import { useToast } from '../components/Toast'
import { EmptyState, Spinner } from '../components/ui'
import { RecipeView } from './RecipeDetail'

export default function Shared() {
  const { shareId } = useParams()
  const { getShared, copyRecipe, user, isCloud, authReady } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [state, setState] = useState({ loading: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    getShared(shareId)
      .then((recipe) => !cancelled && setState({ recipe }))
      .catch((e) => !cancelled && setState({ error: e.message }))
    return () => {
      cancelled = true
    }
  }, [shareId, getShared, authReady])

  const save = async () => {
    if (isCloud && !user) {
      // Đăng nhập xong sẽ tự lưu (xử lý ở Layout)
      sessionStorage.setItem(PENDING_SHARE_KEY, shareId)
      toast('Đăng nhập hoặc tạo tài khoản để lưu món này')
      navigate('/')
      return
    }
    setSaving(true)
    try {
      const saved = await copyRecipe(state.recipe)
      toast('Đã lưu vào sổ của bạn')
      navigate(`/recipe/${saved.id}`, { replace: true })
    } catch (e) {
      toast(e.message, 'error')
      setSaving(false)
    }
  }

  if (state.loading) return <Spinner className="pt-40" />

  if (!state.recipe) {
    return (
      <div className="pt-safe">
        <EmptyState
          emoji="🔗"
          title="Link không còn hiệu lực"
          text={state.error || 'Chủ công thức đã tắt chia sẻ hoặc đã xoá món này.'}
          action={
            <Link to="/" className="btn-primary px-6">
              Mở Sổ Tay Nấu Ăn
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl min-h-dvh">
      <RecipeView recipe={state.recipe} shared onSave={save} saving={saving} />
    </div>
  )
}
