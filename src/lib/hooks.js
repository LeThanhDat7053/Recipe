import { useCallback, useEffect, useRef, useState } from 'react'
import { getVoiceSettings, pickVoice, prepareSpeech } from './speech'

/** State lưu trong sessionStorage — giữ tick nguyên liệu khi chuyển trang */
export function useSessionState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = sessionStorage.getItem(key)
      return saved ? JSON.parse(saved) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch { /* ignore */ }
  }, [key, value])
  return [value, setValue]
}

/** Giữ màn hình luôn sáng khi đang nấu */
export function useWakeLock(initial = false) {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [on, setOn] = useState(initial)
  const lock = useRef(null)

  useEffect(() => {
    if (!on || !supported) return
    let active = true
    const request = async () => {
      try {
        lock.current = await navigator.wakeLock.request('screen')
      } catch {
        if (active && document.visibilityState === 'visible') setOn(false)
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && request()
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      lock.current?.release().catch(() => {})
      lock.current = null
    }
  }, [on, supported])

  return { supported, on, toggle: () => setOn((v) => !v) }
}

const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Danh sách giọng trên máy (trình duyệt nạp bất đồng bộ) */
export function useVoices() {
  const [voices, setVoices] = useState(() => (speechSupported() ? window.speechSynthesis.getVoices() : []))
  useEffect(() => {
    if (!speechSupported()) return
    const update = () => setVoices(window.speechSynthesis.getVoices())
    update()
    window.speechSynthesis.addEventListener?.('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', update)
  }, [])
  return voices
}

/** Đọc to bằng giọng có sẵn trên máy, theo cài đặt giọng đọc của người dùng */
export function useSpeech() {
  const supported = speechSupported()
  const [speaking, setSpeaking] = useState(false)
  const session = useRef(0)

  const stop = useCallback(() => {
    if (!supported) return
    session.current++
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  /** overrides: { voiceURI, rate, pitch } để nghe thử trước khi lưu */
  const speak = useCallback(
    (text, overrides) => {
      if (!supported || !text) return
      const synth = window.speechSynthesis
      synth.cancel()
      const id = ++session.current
      const settings = { ...getVoiceSettings(), ...overrides }
      const voice = pickVoice(synth.getVoices(), settings.voiceURI)
      const chunks = prepareSpeech(text)
      if (!chunks.length) return
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk)
        u.lang = voice?.lang || 'vi-VN'
        if (voice) u.voice = voice
        u.rate = settings.rate
        u.pitch = settings.pitch
        if (i === chunks.length - 1) {
          u.onend = () => session.current === id && setSpeaking(false)
        }
        u.onerror = () => session.current === id && setSpeaking(false)
        synth.speak(u)
      })
      setSpeaking(true)
    },
    [supported],
  )

  useEffect(() => {
    if (!supported) return
    window.speechSynthesis.getVoices() // nạp trước danh sách giọng
    return () => window.speechSynthesis.cancel()
  }, [supported])

  return { supported, speaking, speak, stop }
}

/** Khoá cuộn trang nền khi mở bottom sheet */
export function useLockBody(locked) {
  useEffect(() => {
    if (!locked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}
