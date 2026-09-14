import { createClient } from '@supabase/supabase-js'
import { createSeed } from './seed'
import { blobToDataURL, compressImage, uid } from './utils'

// Chỉ giữ phần gốc https://xxx.supabase.co (lỡ dán kèm /rest/v1/ vẫn chạy)
const URL_ = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/(rest|auth)\/v1.*$/, '').replace(/\/+$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const BUCKET = 'recipe-images'

export const supabase = URL_ && KEY ? createClient(URL_, KEY) : null
export const isCloud = !!supabase

const RECIPE_FIELDS = [
  'id', 'title', 'description', 'category_id', 'image_url', 'prep_time', 'cook_time',
  'servings', 'difficulty', 'ingredients', 'steps', 'notes', 'tags', 'is_favorite',
]
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))

const sortCategories = (list) => [...list].sort((a, b) => a.sort_order - b.sort_order)

/* ------------------------------------------------------------------ */
/* Chế độ cloud: Supabase                                              */
/* ------------------------------------------------------------------ */
const cloud = {
  async fetchAll() {
    const [c, r] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('recipes').select('*').order('created_at', { ascending: false }),
    ])
    if (c.error) throw c.error
    if (r.error) throw r.error
    return { categories: c.data, recipes: r.data }
  },
  async saveRecipe(recipe) {
    const { data, error } = await supabase
      .from('recipes')
      .upsert(pick(recipe, RECIPE_FIELDS))
      .select()
      .single()
    if (error) throw error
    return data
  },
  async deleteRecipe(recipe) {
    const { error } = await supabase.from('recipes').delete().eq('id', recipe.id)
    if (error) throw error
    await cloud.removeImage(recipe.image_url)
  },
  async saveCategory(cat) {
    const { data, error } = await supabase
      .from('categories')
      .upsert(pick(cat, ['id', 'name', 'icon', 'sort_order']))
      .select()
      .single()
    if (error) throw error
    return data
  },
  async deleteCategory(id) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error
  },
  async uploadImage(file) {
    const blob = await compressImage(file)
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const { data: auth } = await supabase.auth.getSession()
    if (!auth.session) throw new Error('Phiên đăng nhập đã hết, hãy đăng nhập lại')
    const path = `${auth.session.user.id}/${uid()}.${ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
    if (error) throw error
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  },
  async removeImage(url) {
    const marker = `/object/public/${BUCKET}/`
    if (!url || !url.includes(marker)) return
    await supabase.storage.from(BUCKET).remove([url.split(marker)[1]]).catch(() => {})
  },
}

/* ------------------------------------------------------------------ */
/* Chế độ local: lưu trong localStorage (khi chưa cấu hình Supabase)   */
/* ------------------------------------------------------------------ */
const LOCAL_KEY = 'recipebook:local:v1'

const readLocal = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  const seed = createSeed()
  writeLocal(seed)
  return seed
}
function writeLocal(db) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(db))
  } catch {
    throw new Error('Bộ nhớ trình duyệt đã đầy. Hãy xoá bớt ảnh hoặc chuyển sang Supabase.')
  }
}

const local = {
  async fetchAll() {
    const db = readLocal()
    return {
      categories: sortCategories(db.categories),
      recipes: [...db.recipes].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }
  },
  async saveRecipe(recipe) {
    const db = readLocal()
    const now = new Date().toISOString()
    const idx = db.recipes.findIndex((r) => r.id === recipe.id)
    const saved = {
      ...pick(recipe, RECIPE_FIELDS),
      id: recipe.id || uid(),
      created_at: idx >= 0 ? db.recipes[idx].created_at : now,
      updated_at: now,
    }
    if (idx >= 0) db.recipes[idx] = saved
    else db.recipes.unshift(saved)
    writeLocal(db)
    return saved
  },
  async deleteRecipe(recipe) {
    const db = readLocal()
    db.recipes = db.recipes.filter((r) => r.id !== recipe.id)
    writeLocal(db)
  },
  async saveCategory(cat) {
    const db = readLocal()
    const saved = { ...pick(cat, ['id', 'name', 'icon', 'sort_order']), id: cat.id || uid() }
    const idx = db.categories.findIndex((c) => c.id === saved.id)
    if (idx >= 0) db.categories[idx] = saved
    else db.categories.push(saved)
    writeLocal(db)
    return saved
  },
  async deleteCategory(id) {
    const db = readLocal()
    db.categories = db.categories.filter((c) => c.id !== id)
    db.recipes = db.recipes.map((r) => (r.category_id === id ? { ...r, category_id: null } : r))
    writeLocal(db)
  },
  async uploadImage(file) {
    // Ảnh nhỏ hơn để vừa localStorage (~5MB)
    return blobToDataURL(await compressImage(file, 800, 0.72))
  },
  async removeImage() {},
}

export const api = isCloud ? cloud : local

/* ------------------------------------------------------------------ */
/* Xác thực                                                            */
/* ------------------------------------------------------------------ */
export const auth = {
  async getSession() {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session
  },
  onChange(cb) {
    if (!supabase) return () => {}
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session))
    return () => data.subscription.unsubscribe()
  },
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw translateAuthError(error)
  },
  /** Trả về true nếu cần xác nhận email trước khi đăng nhập */
  async signUp(name, email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
    })
    if (error) throw translateAuthError(error)
    // Email đã tồn tại: Supabase trả user không có identity
    if (data.user && data.user.identities?.length === 0) throw new Error('Email này đã có tài khoản')
    return !data.session
  },
  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw translateAuthError(error)
  },
  async signOut() {
    await supabase?.auth.signOut({ scope: 'local' })
  },
}

function translateAuthError(error) {
  const msg = error.message || ''
  const map = [
    [/invalid login credentials/i, 'Sai email hoặc mật khẩu'],
    [/email not confirmed/i, 'Email chưa được xác nhận. Hãy mở email và bấm vào link xác nhận.'],
    [/already registered|already exists/i, 'Email này đã có tài khoản'],
    [/password should be at least|weak password/i, 'Mật khẩu quá yếu (tối thiểu 6 ký tự)'],
    [/rate limit|too many/i, 'Thao tác quá nhiều lần, hãy thử lại sau ít phút'],
    [/signups not allowed|signup is disabled/i, 'Hiện không cho phép tạo tài khoản mới'],
    [/unable to validate email|invalid email/i, 'Email không hợp lệ'],
    [/same password|different from the old/i, 'Mật khẩu mới phải khác mật khẩu cũ'],
    [/failed to fetch|network/i, 'Không có kết nối mạng'],
  ]
  const found = map.find(([re]) => re.test(msg))
  return new Error(found ? found[1] : msg)
}
