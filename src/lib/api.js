import { createClient } from '@supabase/supabase-js'
import { blobToDataURL, compressImage, uid } from './utils'

// Chỉ giữ phần gốc https://xxx.supabase.co (lỡ dán kèm /rest/v1/ vẫn chạy)
const URL_ = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/(rest|auth)\/v1.*$/, '').replace(/\/+$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const BUCKET = 'recipe-images'

export const supabase = URL_ && KEY ? createClient(URL_, KEY) : null
export const isCloud = !!supabase

/** Các bảng và cột được phép ghi */
export const TABLES = {
  categories: ['id', 'name', 'icon', 'sort_order'],
  recipes: [
    'id', 'title', 'description', 'category_id', 'image_url', 'prep_time', 'cook_time', 'servings', 'difficulty',
    'ingredients', 'steps', 'notes', 'tags', 'is_favorite', 'rating', 'share_id', 'deleted_at', 'created_at', 'updated_at',
  ],
  cook_logs: ['id', 'recipe_id', 'cooked_at', 'note'],
  collections: ['id', 'name', 'icon', 'recipe_ids', 'sort_order', 'created_at'],
  shopping_items: ['id', 'name', 'amount', 'unit', 'checked', 'recipe_title', 'sort_order', 'created_at'],
}
export const TABLE_NAMES = Object.keys(TABLES)
export const emptyDb = () => Object.fromEntries(TABLE_NAMES.map((t) => [t, []]))

const pick = (table, row) => Object.fromEntries(TABLES[table].filter((k) => k in row).map((k) => [k, row[k]]))

export const isNetworkError = (e) =>
  (typeof navigator !== 'undefined' && !navigator.onLine) ||
  /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(e?.message || String(e))

/* ------------------------------------------------------------------ */
/* Dữ liệu (chỉ dùng ở chế độ cloud; chế độ local lưu thẳng trong store) */
/* ------------------------------------------------------------------ */
export async function fetchAll() {
  const results = await Promise.all(TABLE_NAMES.map((t) => supabase.from(t).select('*').range(0, 4999)))
  const db = {}
  results.forEach((res, i) => {
    if (res.error) throw res.error
    db[TABLE_NAMES[i]] = res.data
  })
  return db
}

/** op: { type: 'upsert', table, rows } | { type: 'remove', table, ids } */
export async function exec(op) {
  if (op.type === 'upsert') {
    const { error } = await supabase.from(op.table).upsert(op.rows.map((r) => pick(op.table, r)))
    if (error) throw error
  } else {
    const { error } = await supabase.from(op.table).delete().in('id', op.ids)
    if (error) throw error
  }
}

export async function uploadImage(file, maxSize = 1280) {
  if (!supabase) return blobToDataURL(await compressImage(file, Math.min(maxSize, 800), 0.72))
  const blob = await compressImage(file, maxSize)
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) throw new Error('Phiên đăng nhập đã hết, hãy đăng nhập lại')
  const path = `${auth.session.user.id}/${uid()}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (error) throw new Error(isNetworkError(error) ? 'Cần có mạng để tải ảnh lên' : error.message)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function removeImages(urls) {
  const marker = `/object/public/${BUCKET}/`
  const paths = urls.filter((u) => u?.includes(marker)).map((u) => u.split(marker)[1])
  if (!supabase || !paths.length) return
  await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
}

export async function getSharedRecipe(shareId) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_shared_recipe', { p_share_id: shareId })
  if (error) {
    if (/invalid input syntax/i.test(error.message)) return null
    throw new Error(isNetworkError(error) ? 'Không có kết nối mạng' : error.message)
  }
  return data
}

export async function importFromUrl(link) {
  const headers = {}
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  let res
  try {
    res = await fetch(`/.netlify/functions/import-recipe?url=${encodeURIComponent(link)}`, { headers })
  } catch {
    throw new Error('Không có kết nối mạng')
  }
  if (!(res.headers.get('content-type') || '').includes('json')) {
    throw new Error('Tính năng này chỉ chạy trên bản đã deploy lên Netlify (hoặc khi chạy "netlify dev").')
  }
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'Không đọc được trang này')
  return body
}

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
