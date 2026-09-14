import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { EmptyState, Spinner } from '../components/ui'
import { RecipeView } from './RecipeDetail'

export default function Shared() {
  const { shareId } = useParams()
  const { getShared } = useStore()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let cancelled = false
    getShared(shareId)
      .then((recipe) => !cancelled && setState({ recipe }))
      .catch((e) => !cancelled && setState({ error: e.message }))
    return () => {
      cancelled = true
    }
  }, [shareId, getShared])

  if (state.loading) return <Spinner className="pt-40" />

  if (!state.recipe) {
    return (
      <div className="pt-safe">
        <EmptyState
          emoji="🔗"
          title="Link không còn hiệu lực"
          text={state.error || 'Món này đã tắt chia sẻ hoặc đã bị xoá.'}
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
      <RecipeView recipe={state.recipe} shared />
    </div>
  )
}
