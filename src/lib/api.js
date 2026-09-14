import { createClient } from '@supabase/supabase-js'
import { blobToDataURL, compressImage, uid } from './utils'

// Chỉ giữ phần gốc https://xxx.supabase.co (lỡ dán kèm /rest/v1/ vẫn chạy)
const URL_ = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/(rest|auth)\/v1.*$/, '').replace(/\/+$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const BUCKET = 'recipe-images'

// Sổ tay dùng chung cả gia đình: không đăng nhập
export const supabase = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null
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
  settings: ['id', 'value'],
  purchases: ['id', 'shopping_item_id', 'name', 'amount', 'unit', 'price', 'recipe_title', 'note', 'bought_at', 'created_at'],
}
// Bảng mới thêm sau: chưa chạy lại schema.sql thì coi như trống, không làm hỏng cả app
const OPTIONAL_TABLES = new Set(['settings', 'purchases'])
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
    const table = TABLE_NAMES[i]
    if (res.error) {
      if (OPTIONAL_TABLES.has(table) && !isNetworkError(res.error)) {
        console.warn(`Chưa có bảng "${table}", hãy chạy lại supabase/schema.sql`)
        db[table] = []
        return
      }
      throw res.error
    }
    db[table] = res.data
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
  const path = `images/${uid()}.${ext}`
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
  let res
  try {
    res = await fetch(`/.netlify/functions/import-recipe?url=${encodeURIComponent(link)}`)
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
