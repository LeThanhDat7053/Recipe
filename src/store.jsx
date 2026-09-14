import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as api from './lib/api'
import { emptyDb, isCloud, isNetworkError } from './lib/api'
import { createSeed } from './lib/seed'
import {
  clearLegacyPantry, daysSince, DEFAULT_PANTRY, mergeShopping, nowISO, parseIngredientLine, readLegacyPantry, recipeImages, uid,
} from './lib/utils'
import { useToast } from './components/Toast'

const StoreContext = createContext(null)

// Một sổ tay chung cho cả gia đình
const DATA_KEY = isCloud ? 'recipebook:cache:family:v1' : 'recipebook:local:v1'
const QUEUE_KEY = 'recipebook:queue:family:v1'
const REFRESH_EVERY = 45000 // tự tải lại để thấy thay đổi của người khác

const readJSON = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** Bản cũ lưu cache & hàng đợi theo từng tài khoản -> dọn cache, gộp hàng đợi về một */
function migrateOldStorage() {
  try {
    const oldOps = []
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('recipebook:cache:v2:')) localStorage.removeItem(k)
      if (k.startsWith('recipebook:queue:v1:')) {
        oldOps.push(...(readJSON(k) || []))
        localStorage.removeItem(k)
      }
    })
    if (oldOps.length) writeJSON(QUEUE_KEY, [...(readJSON(QUEUE_KEY) || []), ...oldOps])
  } catch { /* ignore */ }
}

const normalizeDb = (raw) => ({ ...emptyDb(), ...(raw || {}) })
const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
const nextOrder = (list) => Math.max(0, ...list.map((x) => x.sort_order ?? 0)) + 1

const RECIPE_DEFAULTS = {
  title: '',
  description: '',
  category_id: null,
  image_url: null,
  prep_time: null,
  cook_time: null,
  servings: 2,
  difficulty: 'easy',
  ingredients: [],
  steps: [],
  notes: '',
  tags: [],
  is_favorite: false,
  rating: 0,
  share_id: null,
  deleted_at: null,
}

export function StoreProvider({ children }) {
  const toast = useToast()
  const [initial] = useState(() => {
    migrateOldStorage()
    const cached = readJSON(DATA_KEY)
    return { data: cached || (isCloud ? null : createSeed()), cached: !!cached, queue: readJSON(QUEUE_KEY) || [] }
  })
  const [db, setDb] = useState(() => normalizeDb(initial.data))
  const [loading, setLoading] = useState(isCloud && !initial.cached)
  const [error, setError] = useState(null)
  const [pendingCount, setPendingCount] = useState(initial.queue.length)

  const dbRef = useRef(db)
  dbRef.current = db
  const queueRef = useRef(initial.queue)
  const flushingRef = useRef(false)
  const purgedRef = useRef(false)

  /* ---------------- Hàng đợi khi mất mạng ---------------- */
  const setQueue = useCallback((q) => {
    queueRef.current = q
    setPendingCount(q.length)
    writeJSON(QUEUE_KEY, q)
  }, [])

  const applyOp = useCallback((op) => {
    setDb((d) => {
      const list = d[op.table]
      if (op.type === 'upsert') {
        const map = new Map(list.map((r) => [r.id, r]))
        op.rows.forEach((r) => map.set(r.id, { ...map.get(r.id), ...r }))
        return { ...d, [op.table]: [...map.values()] }
      }
      const ids = new Set(op.ids)
      const next = { ...d, [op.table]: list.filter((r) => !ids.has(r.id)) }
      if (op.table === 'categories') {
        next.recipes = d.recipes.map((r) => (ids.has(r.category_id) ? { ...r, category_id: null } : r))
      }
      if (op.table === 'recipes') next.cook_logs = d.cook_logs.filter((l) => !ids.has(l.recipe_id))
      return next
    })
  }, [])

  /** Gửi các thay đổi đang chờ. true = xong, false = vẫn mất mạng, null = đang chạy */
  const flush = useCallback(async () => {
    if (!isCloud || !queueRef.current.length) return true
    if (flushingRef.current) return null
    flushingRef.current = true
    let dropped = 0
    try {
      while (queueRef.current.length) {
        try {
          await api.exec(queueRef.current[0])
        } catch (e) {
          if (isNetworkError(e)) return false
          dropped++
          console.error('Bỏ thay đổi lỗi:', e)
        }
        setQueue(queueRef.current.slice(1))
      }
      return true
    } finally {
      flushingRef.current = false
      if (dropped) toast(`${dropped} thay đổi không đồng bộ được`, 'error')
    }
  }, [setQueue, toast])

  const refresh = useCallback(async () => {
    if (!isCloud) return
    const synced = await flush()
    if (synced === null) return
    if (!synced) {
      setError('offline')
      setLoading(false)
      return
    }
    try {
      const data = await api.fetchAll()
      if (queueRef.current.length) return
      setDb(normalizeDb(data))
      setError(null)
    } catch (e) {
      setError(isNetworkError(e) ? 'offline' : e.message || 'Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [flush])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Lưu xuống máy (local: là dữ liệu chính, cloud: là cache để mở nhanh + xem offline)
  useEffect(() => {
    if (isCloud && loading) return
    if (!writeJSON(DATA_KEY, db) && !isCloud) toast('Bộ nhớ trình duyệt đã đầy. Hãy xoá bớt ảnh.', 'error')
  }, [db, loading, toast])

  useEffect(() => {
    if (!isCloud) return
    const onOnline = () => refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    const id = setInterval(() => document.visibilityState === 'visible' && navigator.onLine && refresh(), REFRESH_EVERY)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  // Còn thay đổi chưa gửi -> thử lại định kỳ
  useEffect(() => {
    if (!pendingCount) return
    const id = setInterval(() => navigator.onLine && refresh(), 20000)
    return () => clearInterval(id)
  }, [pendingCount, refresh])

  /* ---------------- Ghi dữ liệu ---------------- */
  const enqueue = useCallback(
    (op) => {
      if (!queueRef.current.length) toast('Đang offline · thay đổi sẽ tự đồng bộ khi có mạng')
      setQueue([...queueRef.current, op])
    },
    [setQueue, toast],
  )

  const write = useCallback(
    async (op) => {
      applyOp(op)
      if (!isCloud) return
      if (queueRef.current.length || !navigator.onLine) return enqueue(op)
      try {
        await api.exec(op)
      } catch (e) {
        if (isNetworkError(e)) return enqueue(op)
        refresh()
        throw new Error(e.message || 'Lưu thất bại')
      }
    },
    [applyOp, enqueue, refresh],
  )

  const actions = useMemo(() => {
    const upsert = (table, rows) => write({ type: 'upsert', table, rows })
    const remove = (table, ids) => (ids.length ? write({ type: 'remove', table, ids }) : Promise.resolve())
    const latestRecipe = (r) => dbRef.current.recipes.find((x) => x.id === r.id) || r

    const saveRecipe = async (recipe) => {
      const now = nowISO()
      const row = { ...RECIPE_DEFAULTS, ...recipe, id: recipe.id || uid(), created_at: recipe.created_at || now, updated_at: now }
      await upsert('recipes', [row])
      return row
    }
    const updateRecipe = (recipe, patch) => saveRecipe({ ...latestRecipe(recipe), ...patch })

    /** Xoá ảnh không còn món nào dùng (một ảnh có thể được dùng chung bởi bản sao) */
    const cleanupImages = (urls, { excludeIds = [], include = [] } = {}) => {
      if (!isCloud || !urls.length || !navigator.onLine) return
      const used = new Set([
        ...dbRef.current.recipes.filter((r) => !excludeIds.includes(r.id)).flatMap(recipeImages),
        ...include.flatMap(recipeImages),
      ])
      const unused = [...new Set(urls)].filter((u) => !used.has(u))
      if (unused.length) api.removeImages(unused)
    }

    const saveCollection = async (c) => {
      const row = {
        id: c.id || uid(),
        name: c.name,
        icon: c.icon || '📁',
        recipe_ids: c.recipe_ids || [],
        sort_order: c.sort_order ?? nextOrder(dbRef.current.collections),
        created_at: c.created_at || nowISO(),
      }
      await upsert('collections', [row])
      return row
    }

    const addShoppingItems = async (items, recipeTitle = '') => {
      const base = Date.now()
      const incoming = items
        .filter((i) => i && i.type !== 'group' && i.name?.trim())
        .map((i, idx) => ({
          id: uid(),
          name: i.name.trim(),
          amount: String(i.amount ?? '').trim(),
          unit: String(i.unit ?? '').trim(),
          checked: false,
          recipe_title: recipeTitle,
          sort_order: 0,
          created_at: new Date(base + idx).toISOString(),
        }))
      if (!incoming.length) return 0
      await upsert('shopping_items', mergeShopping(dbRef.current.shopping_items, incoming))
      return incoming.length
    }

    return {
      refresh,
      saveRecipe,
      updateRecipe,
      cleanupImages,
      toggleFavorite: (r) => updateRecipe(r, { is_favorite: !latestRecipe(r).is_favorite }),
      setRating: (r, rating) => updateRecipe(r, { rating }),
      setSharing: (r, on) => updateRecipe(r, { share_id: on ? uid() : null }),
      trashRecipe: (r) => updateRecipe(r, { deleted_at: nowISO() }),
      restoreRecipe: (r) => updateRecipe(r, { deleted_at: null }),
      async purgeRecipes(list) {
        const ids = list.map((r) => r.id)
        await remove('recipes', ids)
        cleanupImages(list.flatMap(recipeImages), { excludeIds: ids })
      },

      async saveCategory(c) {
        const row = {
          id: c.id || uid(),
          name: c.name,
          icon: c.icon || '🍽️',
          sort_order: c.sort_order ?? nextOrder(dbRef.current.categories),
        }
        await upsert('categories', [row])
        return row
      },
      saveCategories: (rows) => upsert('categories', rows),
      deleteCategory: (id) => remove('categories', [id]),

      saveCollection,
      toggleInCollection(collectionId, recipeId) {
        const col = dbRef.current.collections.find((c) => c.id === collectionId)
        if (!col) return
        const ids = col.recipe_ids || []
        return saveCollection({ ...col, recipe_ids: ids.includes(recipeId) ? ids.filter((x) => x !== recipeId) : [...ids, recipeId] })
      },
      deleteCollection: (id) => remove('collections', [id]),

      async addCookLog({ recipe_id, cooked_at, note }) {
        await upsert('cook_logs', [{ id: uid(), recipe_id, cooked_at: cooked_at || nowISO(), note: note || '' }])
      },
      deleteCookLog: (id) => remove('cook_logs', [id]),

      addShoppingItems,
      addShoppingText: (text) => addShoppingItems(text.split('\n').map(parseIngredientLine), ''),
      toggleShopping(item) {
        const latest = dbRef.current.shopping_items.find((i) => i.id === item.id) || item
        return upsert('shopping_items', [{ ...latest, checked: !latest.checked }])
      },
      removeShopping: (ids) => remove('shopping_items', ids),

      /** Danh sách gia vị có sẵn trong bếp (dùng chung cả nhà) */
      savePantry: (list) => upsert('settings', [{ id: 'pantry', value: list }]),

      async getShared(shareId) {
        if (!isCloud) return dbRef.current.recipes.find((r) => r.share_id === shareId && !r.deleted_at) || null
        return api.getSharedRecipe(shareId)
      },
      importFromUrl: api.importFromUrl,
      uploadImage: api.uploadImage,
    }
  }, [write, refresh])

  // Chuyển danh sách gia vị đã chỉnh trên máy (bản trước) lên database, chỉ một lần
  const pantryMigrated = useRef(false)
  useEffect(() => {
    if (loading || pantryMigrated.current) return
    pantryMigrated.current = true
    const legacy = readLegacyPantry()
    if (!legacy) return
    if (!db.settings.some((s) => s.id === 'pantry')) actions.savePantry(legacy).catch(() => {})
    clearLegacyPantry()
  }, [loading, db, actions])

  // Tự dọn món trong thùng rác quá 30 ngày
  useEffect(() => {
    if (loading || purgedRef.current) return
    purgedRef.current = true
    const expired = db.recipes.filter((r) => r.deleted_at && daysSince(r.deleted_at) > 30)
    if (expired.length) actions.purgeRecipes(expired).catch(() => {})
  }, [loading, db, actions])

  const value = useMemo(() => {
    const recipes = db.recipes
      .filter((r) => !r.deleted_at)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    const trash = db.recipes.filter((r) => r.deleted_at).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))
    const categories = [...db.categories].sort(bySort)
    const collections = [...db.collections].sort(bySort)
    const cookLogs = [...db.cook_logs].sort((a, b) => b.cooked_at.localeCompare(a.cooked_at))
    const cookStats = {}
    cookLogs.forEach((l) => {
      cookStats[l.recipe_id] ??= { count: 0, last: l.cooked_at }
      cookStats[l.recipe_id].count++
    })
    const shoppingItems = [...db.shopping_items].sort(
      (a, b) => bySort(a, b) || (a.created_at || '').localeCompare(b.created_at || ''),
    )
    const pantryRow = db.settings.find((s) => s.id === 'pantry')
    return {
      pantry: Array.isArray(pantryRow?.value) ? pantryRow.value : DEFAULT_PANTRY,
      recipes,
      trash,
      categories,
      categoryMap: Object.fromEntries(categories.map((c) => [c.id, c])),
      collections,
      cookLogs,
      cookStats,
      shoppingItems,
      loading,
      error,
      pendingCount,
      isCloud,
      canEdit: true,
      ...actions,
    }
  }, [db, loading, error, pendingCount, actions])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
