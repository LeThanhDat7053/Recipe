// Cài đặt giọng đọc + chuẩn hoá chữ cho giọng máy đọc dễ nghe hơn

const KEY = 'recipebook:voice:v1'
export const DEFAULT_VOICE = { voiceURI: '', rate: 0.8, pitch: 1 }

export function getVoiceSettings() {
  try {
    return { ...DEFAULT_VOICE, ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return { ...DEFAULT_VOICE }
  }
}

export function saveVoiceSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

export const isVietnameseVoice = (v) => /^vi/i.test((v.lang || '').replace('_', '-'))

export function pickVoice(voices, voiceURI) {
  return voices.find((v) => v.voiceURI === voiceURI) || voices.find(isVietnameseVoice) || null
}

const NOT_LETTER = '(?![\\p{L}])'
const REPLACEMENTS = [
  // Khoảng: 45-60 phút -> 45 đến 60 phút
  [/(\d)\s*[-–]\s*(\d)/g, '$1 đến $2'],
  // Phân số
  [/(\d)\s*½/g, '$1 rưỡi'],
  [/½|\b1\/2\b/g, 'nửa'],
  [/¼|\b1\/4\b/g, 'một phần tư'],
  [/¾|\b3\/4\b/g, 'ba phần tư'],
  [/⅓|\b1\/3\b/g, 'một phần ba'],
  [/(\d+)\/(\d+)/g, '$1 phần $2'],
  // Thời gian dạng 1g15p / 1h30 (phải đứng trước luật "g" = gam)
  [new RegExp(`(\\d)\\s*(h|g)\\s*(\\d+)\\s*(p|ph|phút)?${NOT_LETTER}`, 'giu'), '$1 giờ $3 phút'],
  // Đơn vị viết tắt
  [new RegExp(`(\\d)\\s*kg${NOT_LETTER}`, 'giu'), '$1 ký'],
  [new RegExp(`(\\d)\\s*mg${NOT_LETTER}`, 'giu'), '$1 mi li gam'],
  [new RegExp(`(\\d)\\s*ml${NOT_LETTER}`, 'giu'), '$1 mi li lít'],
  [new RegExp(`(\\d)\\s*g${NOT_LETTER}`, 'giu'), '$1 gam'],
  [new RegExp(`(\\d)\\s*l${NOT_LETTER}`, 'giu'), '$1 lít'],
  [new RegExp(`(\\d)\\s*(p|ph)${NOT_LETTER}`, 'giu'), '$1 phút'],
  [/(\d)\s*°\s*C/gi, '$1 độ C'],
  [new RegExp(`(\\d)\\s*tbsp${NOT_LETTER}`, 'giu'), '$1 muỗng canh'],
  [new RegExp(`(\\d)\\s*tsp${NOT_LETTER}`, 'giu'), '$1 muỗng cà phê'],
  [/&/g, ' và '],
  [/\s*\+\s*/g, ' và '],
  [/[—–]/g, ', '],
  [/[()[\]{}*#_~`"]/g, ' '],
]

/** Chuẩn hoá chữ rồi tách thành từng câu ngắn để đọc có ngắt nghỉ */
export function prepareSpeech(text) {
  let t = String(text || '')
  for (const [re, rep] of REPLACEMENTS) t = t.replace(re, rep)
  return t
    .split(/(?<=[.!?;:])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => /[\p{L}\d]/u.test(s))
}
