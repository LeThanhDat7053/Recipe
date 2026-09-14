// Vẽ "thẻ công thức" thành ảnh PNG để chia sẻ / in
import { DIFFICULTY, formatMinutes, scaleAmount, totalTime } from './utils'

const W = 1080
const P = 80
const CW = W - P * 2
const FONT = '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const C = { bg: '#fffaf5', ink: '#1f1a17', muted: '#7a6f68', line: '#ece3da', brand: '#ea580c', soft: '#ffedd5' }

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

function wrap(ctx, text, maxWidth) {
  const lines = []
  for (const para of String(text || '').split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      if (!word) continue
      const test = line ? `${line} ${word}` : word
      if (!line || ctx.measureText(test).width <= maxWidth) line = test
      else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

/** Chạy 2 lần: lần đầu chỉ đo chiều cao, lần sau mới vẽ */
function paint(ctx, recipe, opts, img, draw) {
  const font = (weight, size) => (ctx.font = `${weight} ${size}px ${FONT}`)
  const fill = (color, t, x, y) => {
    if (!draw) return
    ctx.fillStyle = color
    ctx.fillText(t, x, y)
  }
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  const heroH = img ? 720 : 420
  if (draw) {
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, W, ctx.canvas.height)
    if (img) {
      const scale = Math.max(W / img.naturalWidth, heroH / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, (W - dw) / 2, (heroH - dh) / 2, dw, dh)
    } else {
      const g = ctx.createLinearGradient(0, 0, W, heroH)
      g.addColorStop(0, '#fed7aa')
      g.addColorStop(1, '#fef3c7')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, heroH)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `200px ${FONT}`
      ctx.fillText(opts.emoji || '🍽️', W / 2, heroH / 2 + 10)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
    }
  }

  let y = heroH + 64

  if (opts.categoryLabel) {
    font(700, 30)
    fill(C.brand, opts.categoryLabel.toUpperCase(), P, y)
    y += 54
  }

  font(700, 68)
  for (const l of wrap(ctx, recipe.title, CW)) {
    fill(C.ink, l, P, y)
    y += 86
  }

  const total = totalTime(recipe)
  const meta = [
    total && `⏱ ${formatMinutes(total)}`,
    `👥 ${opts.servings} người`,
    DIFFICULTY[recipe.difficulty] && `👨‍🍳 ${DIFFICULTY[recipe.difficulty].label}`,
  ]
    .filter(Boolean)
    .join('     ')
  y += 8
  font(500, 34)
  fill(C.muted, meta, P, y)
  y += 60

  if (recipe.description) {
    font(400, 34)
    for (const l of wrap(ctx, recipe.description, CW)) {
      fill(C.muted, l, P, y)
      y += 50
    }
  }

  const section = (label) => {
    y += 30
    if (draw) {
      ctx.fillStyle = C.line
      ctx.fillRect(P, y, CW, 3)
    }
    y += 48
    font(700, 32)
    fill(C.brand, label, P, y)
    y += 66
  }

  const ingredients = recipe.ingredients || []
  if (ingredients.length) {
    section('NGUYÊN LIỆU')
    for (const ing of ingredients) {
      if (ing.type === 'group') {
        y += 14
        font(700, 30)
        fill(C.brand, ing.name.toUpperCase(), P, y)
        y += 54
        continue
      }
      const amt = [scaleAmount(ing.amount, opts.factor), ing.unit].filter(Boolean).join(' ').trim()
      font(700, 36)
      const aw = amt ? ctx.measureText(`${amt} `).width : 0
      if (draw) {
        ctx.fillStyle = C.brand
        ctx.beginPath()
        ctx.arc(P + 9, y + 25, 7, 0, Math.PI * 2)
        ctx.fill()
      }
      if (amt) fill(C.ink, amt, P + 40, y)
      font(400, 36)
      const lines = wrap(ctx, ing.name, CW - 40 - aw)
      lines.forEach((l, i) => fill(C.ink, l, P + 40 + aw, y + i * 54))
      y += lines.length * 54 + 8
    }
  }

  const steps = (recipe.steps || []).filter((s) => s.text?.trim())
  if (steps.length) {
    section('CÁCH LÀM')
    steps.forEach((s, i) => {
      if (draw) {
        ctx.fillStyle = C.soft
        ctx.beginPath()
        ctx.arc(P + 26, y + 26, 26, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = C.brand
        ctx.font = `700 28px ${FONT}`
        ctx.textAlign = 'center'
        ctx.fillText(String(i + 1), P + 26, y + 11)
        ctx.textAlign = 'left'
      }
      font(400, 36)
      const lines = wrap(ctx, s.text, CW - 80)
      lines.forEach((l, j) => fill(C.ink, l, P + 80, y + 2 + j * 54))
      y += Math.max(lines.length * 54, 56) + 24
    })
  }

  if (recipe.notes?.trim()) {
    section('GHI CHÚ')
    font(400, 34)
    for (const l of wrap(ctx, recipe.notes, CW)) {
      fill(C.muted, l, P, y)
      y += 50
    }
  }

  y += 40
  if (draw) {
    ctx.fillStyle = C.line
    ctx.fillRect(P, y, CW, 3)
  }
  y += 40
  font(600, 30)
  if (draw) {
    ctx.textAlign = 'center'
    ctx.fillStyle = C.muted
    ctx.fillText('🍲 Sổ Tay Nấu Ăn', W / 2, y)
    ctx.textAlign = 'left'
  }
  return y + 90
}

export async function renderRecipeCard(recipe, opts) {
  if (document.fonts?.load) {
    await Promise.all([400, 500, 700].map((w) => document.fonts.load(`${w} 36px "Be Vietnam Pro"`, 'Việt'))).catch(() => {})
  }
  const img = recipe.image_url ? await loadImage(recipe.image_url).catch(() => null) : null

  const make = (image) => {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = 10
    const height = paint(canvas.getContext('2d'), recipe, opts, image, false)
    canvas.height = Math.min(Math.ceil(height), 30000)
    paint(canvas.getContext('2d'), recipe, opts, image, true)
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), 'image/png')
      } catch (e) {
        reject(e)
      }
    })
  }

  try {
    return await make(img)
  } catch (e) {
    // Ảnh từ web khác chặn CORS -> vẽ lại không có ảnh
    if (img) return make(null)
    throw e
  }
}
