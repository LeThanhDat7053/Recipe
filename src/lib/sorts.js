import { totalTime } from './utils'

// fn(a, b, cookStats)
export const SORTS = {
  new: { label: 'Mới nhất', fn: (a, b) => (b.created_at || '').localeCompare(a.created_at || '') },
  az: { label: 'A → Z', fn: (a, b) => a.title.localeCompare(b.title, 'vi') },
  fast: { label: 'Nhanh nhất', fn: (a, b) => (totalTime(a) || 9999) - (totalTime(b) || 9999) },
  rating: { label: 'Đánh giá cao', fn: (a, b) => (b.rating || 0) - (a.rating || 0) },
  cooked: { label: 'Nấu nhiều nhất', fn: (a, b, s) => (s[b.id]?.count || 0) - (s[a.id]?.count || 0) },
  stale: { label: 'Lâu chưa nấu', fn: (a, b, s) => (s[a.id]?.last || '').localeCompare(s[b.id]?.last || '') },
}

export const sortRecipes = (list, key, stats) => [...list].sort((a, b) => (SORTS[key] || SORTS.new).fn(a, b, stats))
