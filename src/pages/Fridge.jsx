import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../store'
import { RecipeRow } from '../components/RecipeCard'
import { EmptyState, PageHeader, Switch } from '../components/ui'
import { isPantryItem, normalize } from '../lib/utils'

const KEY = 'recipebook:fridge:v1'

export default function Fridge() {
  const { recipes, pantry } = useStore()
  const [have, setHave] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || []
    } catch {
      return []
    }
  })
  const [text, setText] = useState('')
  const [skipBasics, setSkipBasics] = useState(true)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(have))
    } catch { /* ignore */ }
  }, [have])

  const allNames = useMemo(() => {
    const map = new Map()
    recipes.forEach((r) =>
      (r.ingredients || []).forEach((i) => {
        if (i.type === 'group' || !i.name?.trim()) return
        const key = normalize(i.name)
        if (!map.has(key) && !isPantryItem(i.name, pantry)) map.set(key, i.name.trim())
      }),
    )
    return [...map.values()].sort((a, b) => a.localeCompare(b, 'vi'))
  }, [recipes, pantry])

  const haveKeys = have.map(normalize)
  const suggestions = text.trim()
    ? allNames.filter((n) => normalize(n).includes(normalize(text)) && !haveKeys.includes(normalize(n))).slice(0, 8)
    : []

  const add = (name) => {
    const n = name.trim()
    if (n && !haveKeys.includes(normalize(n))) setHave((list) => [...list, n])
    setText('')
  }

  const results = useMemo(() => {
    if (!haveKeys.length) return []
    const owns = (name) => {
      const a = normalize(name)
      return haveKeys.some((b) => a.includes(b) || b.includes(a))
    }
    return recipes
      .map((recipe) => {
        const items = (recipe.ingredients || []).filter(
          (i) => i.type !== 'group' && i.name?.trim() && !(skipBasics && isPantryItem(i.name, pantry)),
        )
        if (!items.length) return null
        const missing = items.filter((i) => !owns(i.name))
        const got = items.length - missing.length
        return got ? { recipe, got, total: items.length, missing } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.missing.length - b.missing.length || b.got - a.got)
  }, [recipes, haveKeys.join('|'), skipBasics, pantry]) // eslint-disable-line react-hooks/exhaustive-deps

  const ready = results.filter((r) => !r.missing.length)
  const almost = results.filter((r) => r.missing.length)

  return (
    <>
      <PageHeader back backTo="/search" title="Tủ lạnh còn gì?">
        <div className="px-4 pb-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              add(text)
            }}
            className="relative flex gap-2"
          >
            <input
              className="input"
              placeholder="Nhập nguyên liệu đang có… (VD: trứng)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              enterKeyHint="done"
              autoFocus={!have.length}
            />
            <button className="btn-primary px-4 shrink-0" disabled={!text.trim()} aria-label="Thêm">
              <Plus size={22} />
            </button>
            {suggestions.length > 0 && (
              <ul className="absolute left-0 right-14 top-full mt-1 z-10 card p-1 shadow-xl animate-fade-in">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => add(s)} className="w-full text-left px-3 py-2.5 rounded-xl active:bg-surface-2">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        </div>
      </PageHeader>

      <div className="px-4">
        {have.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {have.map((h) => (
              <button
                key={h}
                onClick={() => setHave((l) => l.filter((x) => x !== h))}
                className="flex items-center gap-1 rounded-full bg-brand-soft text-brand pl-3 pr-2 py-1.5 text-sm font-medium"
              >
                {h} <X size={14} />
              </button>
            ))}
            <button onClick={() => setHave([])} className="px-2 py-1.5 text-sm text-muted">
              Xoá hết
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <p className="flex-1 text-sm">
            Bỏ qua gia vị cơ bản
            <span className="block text-xs text-muted">muối, đường, tiêu, nước mắm, dầu ăn…</span>
          </p>
          <Switch checked={skipBasics} onChange={setSkipBasics} label="Bỏ qua gia vị cơ bản" />
        </div>
      </div>

      {!have.length ? (
        <EmptyState emoji="🧊" title="Bạn đang có nguyên liệu gì?" text="Nhập vài thứ trong tủ lạnh, mình gợi ý món nấu được ngay." />
      ) : !results.length ? (
        <EmptyState emoji="🤔" title="Chưa có món nào phù hợp" text="Thử thêm nguyên liệu khác xem." />
      ) : (
        <div className="px-2 pt-4">
          {ready.length > 0 && (
            <>
              <h2 className="section-title px-2 pb-1">✅ Nấu được ngay</h2>
              {ready.map((r) => (
                <RecipeRow key={r.recipe.id} recipe={r.recipe} extra={<span className="text-ok font-medium">Có đủ {r.total} nguyên liệu</span>} />
              ))}
            </>
          )}
          {almost.length > 0 && (
            <>
              <h2 className="section-title px-2 pb-1 pt-4">🛒 Thiếu một chút</h2>
              {almost.map((r) => (
                <RecipeRow
                  key={r.recipe.id}
                  recipe={r.recipe}
                  extra={
                    <span className="text-muted line-clamp-2">
                      <b className="text-ink">
                        Có {r.got}/{r.total}
                      </b>{' '}
                      · Thiếu: {r.missing.map((m) => m.name).join(', ')}
                    </span>
                  }
                />
              ))}
            </>
          )}
        </div>
      )}
    </>
  )
}
