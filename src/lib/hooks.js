import { useCallback, useEffect, useRef, useState } from 'react'

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

/** Đọc to bằng giọng có sẵn trên máy */
export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text) => {
      if (!supported || !text) return
      const synth = window.speechSynthesis
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'vi-VN'
      const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('vi'))
      if (voice) u.voice = voice
      u.rate = 0.95
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      setSpeaking(true)
      synth.speak(u)
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
