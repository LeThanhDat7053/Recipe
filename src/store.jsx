import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, auth, isCloud } from './lib/api'

const StoreContext = createContext(null)

// Cache theo từng tài khoản để mở app là thấy ngay, không lẫn dữ liệu giữa các người dùng
const cacheKey = (userId) => `recipebook:cache:v2:${userId}`
const readCache = (userId) => {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(userId)))
  } catch {
    return null
  }
}
const writeCache = (userId, data) => {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(data))
  } catch { /* ignore */ }
}
const clearCaches = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('recipebook:cache:'))
      .forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

export function StoreProvider({ children }) {
  const [categories, setCategories] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // undefined = chưa biết (đang đọc phiên đăng nhập), null = chưa đăng nhập
  const [session, setSession] = useState(isCloud ? undefined : null)

  const userId = isCloud ? session?.user?.id : 'local'
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  const refresh = useCallback(async () => {
    const requestedFor = userIdRef.current
    if (!requestedFor) return
    try {
      const data = await api.fetchAll()
      if (userIdRef.current !== requestedFor) return // đã đổi tài khoản trong lúc tải
      setCategories(data.categories)
      setRecipes(data.recipes)
      setError(null)
    } catch (e) {
      if (userIdRef.current === requestedFor) setError(e.message || 'Không tải được dữ liệu')
    } finally {
      if (userIdRef.current === requestedFor) setLoading(false)
    }
  }, [])

  // Theo dõi phiên đăng nhập
  useEffect(() => {
    if (!isCloud) return
    auth.getSession().then((s) => setSession((prev) => (prev === undefined ? s ?? null : prev)))
    return auth.onChange((s) => setSession(s ?? null))
  }, [])

  // Đổi tài khoản -> nạp cache của người đó rồi tải mới
  useEffect(() => {
    if (!userId) {
      setCategories([])
      setRecipes([])
      setLoading(false)
      return
    }
    const cached = isCloud ? readCache(userId) : null
    setCategories(cached?.categories ?? [])
    setRecipes(cached?.recipes ?? [])
    setLoading(!cached)
    refresh()
  }, [userId, refresh])

  useEffect(() => {
    if (isCloud && userId && !loading) writeCache(userId, { categories, recipes })
  }, [categories, recipes, loading, userId])

  useEffect(() => {
    if (!isCloud) return
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const actions = useMemo(
    () => ({
      refresh,
      async saveRecipe(recipe) {
        const saved = await api.saveRecipe(recipe)
        setRecipes((list) => {
          const idx = list.findIndex((r) => r.id === saved.id)
          if (idx < 0) return [saved, ...list]
          const next = [...list]
          next[idx] = saved
          return next
        })
        return saved
      },
      async toggleFavorite(recipe) {
        const next = { ...recipe, is_favorite: !recipe.is_favorite }
        setRecipes((list) => list.map((r) => (r.id === recipe.id ? next : r)))
        try {
          await api.saveRecipe(next)
        } catch (e) {
          setRecipes((list) => list.map((r) => (r.id === recipe.id ? recipe : r)))
          throw e
        }
      },
      async deleteRecipe(recipe) {
        await api.deleteRecipe(recipe)
        setRecipes((list) => list.filter((r) => r.id !== recipe.id))
      },
      async saveCategory(cat) {
        const saved = await api.saveCategory(cat)
        setCategories((list) => {
          const exists = list.some((c) => c.id === saved.id)
          const next = exists ? list.map((c) => (c.id === saved.id ? saved : c)) : [...list, saved]
          return next.sort((a, b) => a.sort_order - b.sort_order)
        })
        return saved
      },
      async deleteCategory(id) {
        await api.deleteCategory(id)
        setCategories((list) => list.filter((c) => c.id !== id))
        setRecipes((list) => list.map((r) => (r.category_id === id ? { ...r, category_id: null } : r)))
      },
      uploadImage: (file) => api.uploadImage(file),
      removeImage: (url) => api.removeImage(url),
      signIn: auth.signIn,
      signUp: auth.signUp,
      updatePassword: auth.updatePassword,
      async signOut() {
        clearCaches()
        await auth.signOut()
        setSession(null)
      },
    }),
    [refresh],
  )

  const value = useMemo(() => {
    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]))
    return {
      categories,
      categoryMap,
      recipes,
      loading,
      error,
      session,
      user: session?.user ?? null,
      isCloud,
      authReady: session !== undefined,
      canEdit: !isCloud || !!session,
      ...actions,
    }
  }, [categories, recipes, loading, error, session, actions])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
