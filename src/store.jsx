import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as api from './lib/api'
import { auth, emptyDb, isCloud, isNetworkError } from './lib/api'
import { createSeed } from './lib/seed'
import { daysSince, mergeShopping, nowISO, parseIngredientLine, recipeImages, uid } from './lib/utils'
import { useToast } from './components/Toast'

const StoreContext = createContext(null)

const LOCAL_KEY = 'recipebook:local:v1'
const dataKey = (userId) => (isCloud ? `recipebook:cache:v2:${userId}` : LOCAL_KEY)
const queueKey = (userId) => `recipebook:queue:v1:${userId}`
export const PENDING_SHARE_KEY = 'recipebook:pending-share'

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
const clearCaches = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('recipebook:cache:'))
      .forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

// _owner: dữ liệu đang hiển thị thuộc tài khoản nào (tránh ghi nhầm cache giữa các tài khoản)
const normalizeDb = (raw, owner) => ({ ...emptyDb(), ...(raw || {}), _owner: owner })
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
  const [db, setDb] = useState(() => normalizeDb(null, null))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // undefined = đang đọc phiên đăng nhập, null = chưa đăng nhập
  const [session, setSession] = useState(isCloud ? undefined : null)
  const [pendingCount, setPendingCount] = useState(0)

  const userId = isCloud ? session?.user?.id ?? null : 'local'
  const userRef = useRef(userId)
  userRef.current = userId
  const dbRef = useRef(db)
  dbRef.current = db
  const queueRef = useRef([])
  const flushingRef = useRef(false)
  const purgedRef = useRef(false)

  /* ---------------- Hàng đợi khi mất mạng ---------------- */
  const setQueue = useCallback((q) => {
    queueRef.current = q
    setPendingCount(q.length)
    if (userRef.current) writeJSON(queueKey(userRef.current), q)
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
    const owner = userRef.current
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
        if (userRef.current !== owner) return false
        setQueue(queueRef.current.slice(1))
      }
      return true
    } finally {
      flushingRef.current = false
      if (dropped) toast(`${dropped} thay đổi không đồng bộ được`, 'error')
    }
  }, [setQueue, toast])

  const refresh = useCallback(async () => {
    const owner = userRef.current
    if (!isCloud || !owner) return
    const synced = await flush()
    if (synced === null || userRef.current !== owner) return
    if (!synced) {
      setError('offline')
      setLoading(false)
      return
    }
    try {
      const data = await api.fetchAll()
      if (userRef.current !== owner || queueRef.current.length) return
      setDb(normalizeDb(data, owner))
      setError(null)
    } catch (e) {
      if (userRef.current === owner) setError(isNetworkError(e) ? 'offline' : e.message || 'Không tải được dữ liệu')
    } finally {
      if (userRef.current === owner) setLoading(false)
    }
  }, [flush])

  /* ---------------- Phiên đăng nhập ---------------- */
  useEffect(() => {
    if (!isCloud) return
    auth.getSession().then((s) => setSession((prev) => (prev === undefined ? s ?? null : prev)))
    return auth.onChange((s) => setSession(s ?? null))
  }, [])

  // Đổi tài khoản -> nạp dữ liệu đã lưu của người đó rồi tải mới
  useEffect(() => {
    purgedRef.current = false
    if (!userId) {
      setDb(normalizeDb(null, null))
      queueRef.current = []
      setPendingCount(0)
      setError(null)
      setLoading(false)
      return
    }
    let data = readJSON(dataKey(userId))
    if (!isCloud && !data) data = createSeed()
    setDb(normalizeDb(data, userId))
    queueRef.current = readJSON(queueKey(userId)) || []
    setPendingCount(queueRef.current.length)
    setError(null)
    setLoading(isCloud && !data)
    refresh()
  }, [userId, refresh])

  // Lưu xuống máy (local: là dữ liệu chính, cloud: là cache để mở nhanh + xem offline)
  useEffect(() => {
    if (!userId || db._owner !== userId || (isCloud && loading)) return
    const { _owner, ...data } = db
    if (!writeJSON(dataKey(userId), data) && !isCloud) {
      toast('Bộ nhớ trình duyệt đã đầy. Hãy xoá bớt ảnh.', 'error')
    }
  }, [db, userId, loading, toast])

  useEffect(() => {
    if (!isCloud) return
    const onOnline = () => refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
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

    const copyRecipe = (recipe) => {
      const { id, user_id, author_name, share_id, deleted_at, created_at, updated_at, category_id, is_favorite, rating, ...rest } = recipe
      return saveRecipe({ ...rest })
    }

    const getShared = async (shareId) => {
      if (!isCloud) return dbRef.current.recipes.find((r) => r.share_id === shareId && !r.deleted_at) || null
      return api.getSharedRecipe(shareId)
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
      copyRecipe,
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

      getShared,
      async importShared(shareId) {
        const recipe = await getShared(shareId)
        if (!recipe) throw new Error('Link chia sẻ không còn hiệu lực')
        return copyRecipe(recipe)
      },
      importFromUrl: api.importFromUrl,
      uploadImage: api.uploadImage,

      signIn: auth.signIn,
      signUp: auth.signUp,
      updatePassword: auth.updatePassword,
      async signOut() {
        clearCaches()
        await auth.signOut()
        setSession(null)
      },
    }
  }, [write, refresh])

  // Tự dọn món trong thùng rác quá 30 ngày
  useEffect(() => {
    if (loading || purgedRef.current || !userId || db._owner !== userId) return
    purgedRef.current = true
    const expired = db.recipes.filter((r) => r.deleted_at && daysSince(r.deleted_at) > 30)
    if (expired.length) actions.purgeRecipes(expired).catch(() => {})
  }, [loading, db, userId, actions])

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
    return {
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
      session,
      user: session?.user ?? null,
      isCloud,
      authReady: session !== undefined,
      canEdit: !isCloud || !!session,
      ...actions,
    }
  }, [db, loading, error, pendingCount, session, actions])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
