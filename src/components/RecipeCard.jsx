import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Heart } from 'lucide-react'
import { useStore } from '../store'
import { cx, formatMinutes, totalTime } from '../lib/utils'

const GRADIENTS = [
  'from-orange-200 to-amber-100 dark:from-orange-950 dark:to-amber-900',
  'from-rose-200 to-orange-100 dark:from-rose-950 dark:to-orange-900',
  'from-lime-200 to-emerald-100 dark:from-lime-950 dark:to-emerald-900',
  'from-sky-200 to-teal-100 dark:from-sky-950 dark:to-teal-900',
  'from-yellow-200 to-orange-100 dark:from-yellow-950 dark:to-orange-900',
]
const hash = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)

export function RecipeImage({ recipe, emoji, className, eager }) {
  if (recipe.image_url) {
    return (
      <img
        src={recipe.image_url}
        alt={recipe.title}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={cx('object-cover bg-surface-2', className)}
      />
    )
  }
  return (
    <div
      className={cx(
        'grid place-items-center bg-gradient-to-br',
        GRADIENTS[hash(recipe.id) % GRADIENTS.length],
        className,
      )}
    >
      <span className="text-[2.5em] drop-shadow-sm">{emoji || '🍽️'}</span>
    </div>
  )
}

function Tile({ recipe }) {
  const { categoryMap } = useStore()
  const cat = categoryMap[recipe.category_id]
  const time = totalTime(recipe)
  return (
    <Link to={`/recipe/${recipe.id}`} className="block group active:scale-[0.98] transition">
      <div className="relative">
        <RecipeImage
          recipe={recipe}
          emoji={cat?.icon}
          className="w-full aspect-[4/5] rounded-3xl text-2xl"
        />
        {recipe.is_favorite && (
          <span className="absolute top-2 right-2 grid place-items-center size-8 rounded-full bg-black/30 backdrop-blur text-white">
            <Heart size={16} fill="currentColor" />
          </span>
        )}
      </div>
      <p className="mt-2 font-semibold leading-snug line-clamp-2">{recipe.title}</p>
      {time > 0 && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          <Clock size={12} /> {formatMinutes(time)}
        </p>
      )}
    </Link>
  )
}

function Row({ recipe }) {
  const { categoryMap } = useStore()
  const cat = categoryMap[recipe.category_id]
  const time = totalTime(recipe)
  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="flex items-center gap-3 p-2 pr-3 rounded-3xl active:bg-surface-2 transition"
    >
      <RecipeImage recipe={recipe} emoji={cat?.icon} className="size-20 shrink-0 rounded-2xl text-sm" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-snug line-clamp-2">{recipe.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          {cat && (
            <span className="truncate">
              {cat.icon} {cat.name}
            </span>
          )}
          {time > 0 && (
            <span className="flex items-center gap-1 shrink-0">
              <Clock size={12} /> {formatMinutes(time)}
            </span>
          )}
        </div>
      </div>
      {recipe.is_favorite && <Heart size={18} className="shrink-0 text-brand" fill="currentColor" />}
    </Link>
  )
}

export const RecipeTile = memo(Tile)
export const RecipeRow = memo(Row)

export function RecipeListSkeleton({ count = 5 }) {
  return (
    <div className="px-2 space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
          <div className="size-20 rounded-2xl bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded-full bg-surface-2" />
            <div className="h-3 w-1/3 rounded-full bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  )
}
