// Đọc công thức từ một trang web (dữ liệu chuẩn schema.org/Recipe mà đa số web nấu ăn có sẵn)
// Gọi: GET /.netlify/functions/import-recipe?url=<link>

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

export default async (req) => {
  let url
  try {
    url = new URL(new URL(req.url).searchParams.get('url') || '')
  } catch {
    return json(400, { error: 'Link không hợp lệ' })
  }
  if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname)) {
    return json(400, { error: 'Link không hợp lệ' })
  }

  let html
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'vi,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) return json(502, { error: `Trang web báo lỗi ${res.status}` })
    html = (await res.text()).slice(0, 3_000_000)
  } catch {
    return json(502, { error: 'Không tải được trang này' })
  }

  const meta = extractMeta(html, url)
  const recipe = extractRecipe(html)

  if (!recipe) {
    if (!meta.title) return json(422, { error: 'Không tìm thấy công thức trong trang này' })
    return json(200, {
      partial: true,
      title: meta.title,
      description: meta.description,
      image_url: meta.image,
      ingredients: [],
      steps: [],
      source_url: url.href,
    })
  }

  const total = isoMinutes(recipe.totalTime)
  let prep = isoMinutes(recipe.prepTime)
  let cook = isoMinutes(recipe.cookTime)
  if (!prep && !cook && total) cook = total

  return json(200, {
    partial: false,
    source_url: url.href,
    title: text(recipe.name) || meta.title,
    description: text(recipe.description) || meta.description,
    image_url: absolute(pickImage(recipe.image), url) || meta.image,
    prep_time: prep,
    cook_time: cook,
    servings: parseYield(recipe.recipeYield),
    ingredients: toArray(recipe.recipeIngredient || recipe.ingredients).map(text).filter(Boolean),
    steps: flattenSteps(recipe.recipeInstructions),
    tags: String(recipe.keywords || '')
      .split(',')
      .map((t) => text(t).toLowerCase())
      .filter((t) => t && t.length < 30)
      .slice(0, 5),
  })
}

/* ---------------- helpers ---------------- */

function isPrivateHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || h.startsWith('fe80:')) return true
  return false
}

const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', deg: '°', frac12: '½', frac14: '¼', frac34: '¾' }
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => named[n.toLowerCase()] ?? m)
}

function text(v) {
  if (v == null) return ''
  if (typeof v === 'object') v = v.text || v.name || ''
  return decodeEntities(String(v).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function extractRecipe(html) {
  const re = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    try {
      const found = findRecipe(JSON.parse(m[1].trim()))
      if (found) return found
    } catch { /* JSON lỗi -> bỏ qua */ }
  }
  return null
}

function findRecipe(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1)
      if (r) return r
    }
    return null
  }
  const type = node['@type']
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return node
  return findRecipe(node['@graph'], depth + 1) || findRecipe(node.mainEntity, depth + 1)
}

function flattenSteps(v) {
  const out = []
  const walk = (x) => {
    if (x == null) return
    if (typeof x === 'string') {
      x.replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n')
        .split(/\n+/)
        .map(text)
        .filter(Boolean)
        .forEach((s) => out.push(s))
    } else if (Array.isArray(x)) {
      x.forEach(walk)
    } else if (typeof x === 'object') {
      if (x.itemListElement) {
        if (x.name && x['@type'] === 'HowToSection') out.push(`— ${text(x.name)} —`)
        walk(x.itemListElement)
      } else {
        const t = text(x.text || x.name)
        if (t) out.push(t)
      }
    }
  }
  walk(v)
  return out
}

function isoMinutes(v) {
  if (!v || typeof v !== 'string') return null
  const m = v.match(/P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?)?/i)
  if (!m) return null
  const min = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0)
  return min > 0 ? Math.round(min) : null
}

function parseYield(v) {
  const first = toArray(v)[0]
  const n = String(first ?? '').match(/\d+/)
  return n ? Math.min(99, +n[0]) : null
}

function pickImage(v) {
  const first = toArray(v)[0]
  if (!first) return null
  return typeof first === 'string' ? first : first.url || first.contentUrl || null
}

function absolute(src, base) {
  if (!src) return null
  try {
    return new URL(src, base).href
  } catch {
    return null
  }
}

function extractMeta(html, base) {
  const get = (prop) => {
    const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))
    const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
    return text((a || b)?.[1] || '')
  }
  const title = get('og:title') || text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
  return {
    title,
    description: get('og:description') || get('description'),
    image: absolute(get('og:image'), base),
  }
}
