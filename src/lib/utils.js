export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

/** Bỏ dấu tiếng Việt + lowercase để tìm kiếm */
export const normalize = (s = '') =>
  s
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

/** "1/2" | "1 1/2" | "1.5" | "1,5" -> number, không đọc được -> null */
export function parseAmount(str) {
  if (str == null) return null
  const s = String(str).trim().replace(',', '.')
  if (!s) return null
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

export const totalTime = (r) => (Number(r.prep_time) || 0) + (Number(r.cook_time) || 0)

export function formatMinutes(min) {
  if (!min) return ''
  if (min < 60) return `${min} phút`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}g ${m}p` : `${h} giờ`
}

export const DIFFICULTY = {
  easy: { label: 'Dễ', dots: 1 },
  medium: { label: 'Vừa', dots: 2 },
  hard: { label: 'Khó', dots: 3 },
}

/** Nén ảnh trước khi upload: resize cạnh dài <= maxSize, xuất WebP */
export async function compressImage(file, maxSize = 1280, quality = 0.8) {
  const bitmap = await createImageBitmap(file).catch(() => null)
  let source = bitmap
  let width, height
  if (bitmap) {
    width = bitmap.width
    height = bitmap.height
  } else {
    // Fallback cho trình duyệt cũ
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

export const cx = (...classes) => classes.filter(Boolean).join(' ')
