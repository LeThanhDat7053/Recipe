export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

export const nowISO = () => new Date().toISOString()

/** Bỏ dấu tiếng Việt + lowercase để tìm kiếm */
export const normalize = (s = '') =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()

export function matchRecipe(recipe, query) {
  const q = normalize(query)
  if (!q) return true
  const haystack = normalize(
    [
      recipe.title,
      recipe.description,
      (recipe.tags || []).join(' '),
      (recipe.ingredients || []).map((i) => i.name).join(' '),
    ].join(' '),
  )
  return q.split(/\s+/).every((word) => haystack.includes(word))
}

/* ---------------- Số lượng ---------------- */

const UNICODE_FRACTIONS = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }

/** "1/2" | "1 1/2" | "1.5" | "1,5" | "1½" -> number, không đọc được -> null */
export function parseAmount(str) {
  if (str == null) return null
  const s = String(str).trim().replace(',', '.')
  if (!s) return null
  const uni = s.match(/^(\d*)\s*([¼½¾⅓⅔])$/)
  if (uni) return (+uni[1] || 0) + UNICODE_FRACTIONS[uni[2]]
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return +mixed[1] + +mixed[2] / +mixed[3]
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return +frac[1] / +frac[2]
  return /^\d*\.?\d+$/.test(s) ? parseFloat(s) : null
}

const FRACTIONS = [
  [0.25, '¼'],
  [0.33, '⅓'],
  [0.5, '½'],
  [0.67, '⅔'],
  [0.75, '¾'],
]

export function formatAmount(n) {
  if (n == null || Number.isNaN(n)) return ''
  const whole = Math.floor(n)
  const rest = n - whole
  if (rest < 0.05) return String(whole)
  if (whole < 10) {
    const f = FRACTIONS.find(([v]) => Math.abs(rest - v) < 0.04)
    if (f) return whole ? `${whole}${f[1]}` : f[1]
  }
  return (Math.round(n * 10) / 10).toString().replace('.', ',')
}

export function scaleAmount(amount, factor) {
  if (factor === 1) return amount ?? ''
  const n = parseAmount(amount)
  return n == null ? amount ?? '' : formatAmount(n * factor)
}

/* ---------------- Nguyên liệu ---------------- */

export const UNITS = [
  'kg', 'g', 'mg', 'ml', 'lít', 'l', 'muỗng canh', 'muỗng cà phê', 'muỗng', 'thìa canh', 'thìa cà phê', 'thìa',
  'chén', 'bát', 'cốc', 'ly', 'quả', 'trái', 'củ', 'tép', 'cây', 'nhánh', 'lá', 'miếng', 'lát', 'con', 'gói',
  'hộp', 'túi', 'lon', 'nắm', 'bó', 'chút', 'ít', 'tbsp', 'tsp', 'cup', 'cups',
]
const INGREDIENT_RE = new RegExp(`^([\\d.,/½¼¾⅓⅔ ]+)?\\s*(${UNITS.join('|')})?\\s+(.+)$`, 'i')

/** "200 g thịt bò" -> { amount: '200', unit: 'g', name: 'thịt bò' }; "Gia vị:" -> nhóm */
export function parseIngredientLine(line) {
  const clean = String(line).trim().replace(/^[-•*▢☐✓]\s*/, '')
  if (!clean) return null
  if (clean.endsWith(':')) return { id: uid(), type: 'group', amount: '', unit: '', name: clean.slice(0, -1).trim() }
  const m = clean.match(INGREDIENT_RE)
  if (m && (m[1]?.trim() || m[2])) {
    return { id: uid(), type: 'item', amount: (m[1] || '').trim(), unit: m[2] || '', name: m[3].trim() }
  }
  return { id: uid(), type: 'item', amount: '', unit: '', name: clean }
}

/* ---------------- Gia vị có sẵn trong bếp ---------------- */

export const DEFAULT_PANTRY = [
  'muối', 'đường', 'tiêu', 'hạt tiêu', 'bột ngọt', 'mì chính', 'hạt nêm', 'bột canh', 'nước mắm', 'dầu ăn',
  'dầu hào', 'xì dầu', 'nước tương', 'giấm', 'nước', 'nước lọc', 'nước sôi', 'đá', 'đá viên',
]
// Từ quá chung: chỉ tính khi trùng khớp hẳn ("nước" là gia vị, "nước dừa" thì không)
const GENERIC_PANTRY = new Set(['nuoc', 'dau', 'da', 'duong'])

/** Bản trước lưu danh sách gia vị riêng trên máy -> dùng để chuyển lên database một lần */
const LEGACY_PANTRY_KEY = 'recipebook:pantry:v1'
export function readLegacyPantry() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEGACY_PANTRY_KEY))
    return Array.isArray(saved) ? saved : null
  } catch {
    return null
  }
}
export function clearLegacyPantry() {
  try {
    localStorage.removeItem(LEGACY_PANTRY_KEY)
  } catch { /* ignore */ }
}

/** "Muối", "tiêu xay", "hạt nêm Knorr" -> true; "nước dừa" -> false */
export function isPantryItem(name, pantry = DEFAULT_PANTRY) {
  const n = normalize(name)
  return pantry.some((p) => {
    const k = normalize(p)
    return n === k || (!GENERIC_PANTRY.has(k) && n.startsWith(`${k} `))
  })
}

export const isSpiceGroup = (name) => /\bgia vi\b|\bseasoning/.test(normalize(name))

/** Chia nguyên liệu: cần mua / đã tick (có sẵn) / gia vị */
export function splitForShopping(ingredients = [], checkedIds = [], pantry = DEFAULT_PANTRY) {
  const need = []
  const have = []
  const spices = []
  let inSpiceGroup = false
  for (const i of ingredients) {
    if (i.type === 'group') {
      inSpiceGroup = isSpiceGroup(i.name)
      continue
    }
    if (!i.name?.trim()) continue
    if (inSpiceGroup || isPantryItem(i.name, pantry)) spices.push(i)
    else if (checkedIds.includes(i.id)) have.push(i)
    else need.push(i)
  }
  return { need, have, spices }
}

/** Gộp nguyên liệu vào danh sách đi chợ: cùng tên + đơn vị thì cộng dồn */
export function mergeShopping(existing, incoming) {
  const key = (i) => `${normalize(i.name)}|${normalize(i.unit)}`
  const pool = existing.filter((i) => !i.checked).map((i) => ({ ...i }))
  const changed = new Set()
  for (const inc of incoming) {
    const target = pool.find((i) => key(i) === key(inc))
    if (target) {
      const a = parseAmount(target.amount)
      const b = parseAmount(inc.amount)
      target.amount =
        a != null && b != null ? formatAmount(a + b) : [target.amount, inc.amount].filter(Boolean).join(' + ')
      const titles = (target.recipe_title || '').split(', ').filter(Boolean)
      if (inc.recipe_title && !titles.includes(inc.recipe_title)) target.recipe_title = [...titles, inc.recipe_title].join(', ')
      changed.add(target)
    } else {
      const item = { ...inc }
      pool.push(item)
      changed.add(item)
    }
  }
  return [...changed]
}

/* ---------------- Thời gian ---------------- */

export const totalTime = (r) => (Number(r.prep_time) || 0) + (Number(r.cook_time) || 0)

export function formatMinutes(min) {
  if (!min) return ''
  if (min < 60) return `${min} phút`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}g ${m}p` : `${h} giờ`
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`
}

export function timeAgo(iso) {
  if (!iso) return ''
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86400000)
  if (days <= 0) return 'hôm nay'
  if (days === 1) return 'hôm qua'
  if (days < 7) return `${days} ngày trước`
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`
  return `${Math.floor(days / 365)} năm trước`
}

export const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity)

/** 5400 -> "1 giờ 30 phút" */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h && `${h} giờ`, m && `${m} phút`, sec && `${sec} giây`].filter(Boolean).join(' ') || '0 giây'
}

const NOT_WORD = '(?![\\p{L}\\d])'
const TIMER_RE = new RegExp(
  [
    // 1h30, 1g30p, 1 giờ 30 phút, 2 tiếng 15'  ("g" phải dính liền số phút để không nhầm với gam)
    `(?<!\\d)(\\d{1,2})\\s*(?:(?:h|giờ|tiếng)\\s*|g)(\\d{1,2})\\s*(?:phút|phut|ph|p|')?${NOT_WORD}`,
    // 1 tiếng rưỡi
    `(?<!\\d)(\\d{1,2})\\s*(?:tiếng|giờ|h)\\s*rưỡi${NOT_WORD}`,
    // 10 phút, 10p, 15', 45-60 phút, 2 tiếng, 1h, 30 giây
    `(\\d+(?:[.,]\\d+)?)(?:\\s*(?:-|–|đến|tới)\\s*(\\d+(?:[.,]\\d+)?))?\\s*(giây|phút|phut|ph|p|'|tiếng|giờ|h)${NOT_WORD}`,
  ].join('|'),
  'giu',
)

/** Tìm thời lượng trong bước nấu: "luộc 10 phút", "10p", "1h30", "kho 45-60 phút", "1 tiếng rưỡi" */
export function detectTimers(text = '') {
  const found = []
  const add = (seconds, label) => {
    if (seconds > 0 && seconds <= 24 * 3600 && !found.some((f) => f.seconds === seconds)) found.push({ seconds, label })
  }
  for (const m of String(text).normalize('NFC').matchAll(TIMER_RE)) {
    if (m[1]) {
      const seconds = +m[1] * 3600 + +m[2] * 60
      add(seconds, formatDuration(seconds))
    } else if (m[3]) {
      const seconds = +m[3] * 3600 + 1800
      add(seconds, formatDuration(seconds))
    } else {
      const unit = m[6].toLowerCase()
      const mult = unit === 'giây' ? 1 : ['tiếng', 'giờ', 'h'].includes(unit) ? 3600 : 60
      const word = mult === 1 ? 'giây' : mult === 60 ? 'phút' : unit === 'tiếng' ? 'tiếng' : 'giờ'
      const a = parseFloat(m[4].replace(',', '.'))
      const b = m[5] ? parseFloat(m[5].replace(',', '.')) : null
      add(Math.round((b ?? a) * mult), b != null ? `${m[4]}-${m[5]} ${word}` : `${m[4]} ${word}`)
    }
  }
  return found
}

export const DIFFICULTY = {
  easy: { label: 'Dễ', dots: 1 },
  medium: { label: 'Vừa', dots: 2 },
  hard: { label: 'Khó', dots: 3 },
}

/* ---------------- Ảnh ---------------- */

/** Nén ảnh trước khi upload: resize cạnh dài <= maxSize, xuất WebP */
export async function compressImage(file, maxSize = 1280, quality = 0.8) {
  const bitmap = await createImageBitmap(file).catch(() => null)
  let source = bitmap
  let width, height
  if (bitmap) {
    width = bitmap.width
    height = bitmap.height
  } else {
    source = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
    width = source.naturalWidth
    height = source.naturalHeight
  }
  const scale = Math.min(1, maxSize / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  bitmap?.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  if (blob && blob.type === 'image/webp') return blob
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

export const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

/** Tất cả link ảnh của một món (ảnh chính + ảnh từng bước) */
export const recipeImages = (r) => [r.image_url, ...(r.steps || []).map((s) => s.image_url)].filter(Boolean)

export async function shareOrCopy({ title, text, url }, toast) {
  try {
    if (navigator.share) {
      await navigator.share(Object.fromEntries(Object.entries({ title, text, url }).filter(([, v]) => v)))
      return
    }
    await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'))
    toast?.('Đã sao chép')
  } catch (e) {
    if (e?.name !== 'AbortError') toast?.('Không chia sẻ được', 'error')
  }
}

export const cx = (...classes) => classes.filter(Boolean).join(' ')
