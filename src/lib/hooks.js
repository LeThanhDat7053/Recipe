import { useEffect, useRef, useState } from 'react'

/** State lưu trong sessionStorage — giữ tick nguyên liệu khi chuyển tab */
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
export function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [on, setOn] = useState(false)
  const lock = useRef(null)

  useEffect(() => {
    if (!on || !supported) return
    let active = true
    const request = async () => {
      try {
        lock.current = await navigator.wakeLock.request('screen')
      } catch {
        if (active) setOn(false)
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
