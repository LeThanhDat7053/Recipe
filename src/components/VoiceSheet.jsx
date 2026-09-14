import { useEffect, useState } from 'react'
import { Check, Square, Volume2 } from 'lucide-react'
import { Sheet } from './ui'
import { useSpeech, useVoices } from '../lib/hooks'
import { DEFAULT_VOICE, getVoiceSettings, isVietnameseVoice, pickVoice, saveVoiceSettings } from '../lib/speech'
import { cx } from '../lib/utils'

const SAMPLE = 'Bước một. Luộc 500g thịt ba chỉ khoảng 10-15 phút, rồi vớt ra để ráo. Thêm 1/2 muỗng đường.'

const cleanName = (v) =>
  v.name
    .replace(/^(Microsoft|Google|Samsung|Apple)\s*/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s*-\s*Vietnamese.*$/i, '')
    .trim() || v.name

export function VoiceSheet({ open, onClose }) {
  const voices = useVoices()
  const speech = useSpeech()
  const [settings, setSettings] = useState(getVoiceSettings)

  useEffect(() => {
    if (open) setSettings(getVoiceSettings())
    else speech.stop()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveVoiceSettings(next)
  }

  const viVoices = voices.filter(isVietnameseVoice)
  const current = pickVoice(voices, settings.voiceURI)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Giọng đọc"
      footer={
        <button
          className="btn-primary w-full"
          disabled={!speech.supported}
          onClick={() => (speech.speaking ? speech.stop() : speech.speak(SAMPLE, settings))}
        >
          {speech.speaking ? <Square size={18} fill="currentColor" /> : <Volume2 size={20} />}
          {speech.speaking ? 'Dừng' : 'Nghe thử'}
        </button>
      }
    >
      <div className="pt-2 space-y-5">
        {!speech.supported ? (
          <p className="text-muted">Trình duyệt này không hỗ trợ đọc to.</p>
        ) : (
          <>
            <div>
              <p className="label">Chọn giọng</p>
              {viVoices.length === 0 ? (
                <div className="rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed">
                  <p className="font-semibold">Máy chưa có giọng tiếng Việt</p>
                  <p className="mt-1 text-muted">
                    <b>Android:</b> Cài đặt → Quản lý chung → Chuyển văn bản thành giọng nói → chọn Google, cài dữ liệu giọng Tiếng Việt.
                  </p>
                  <p className="mt-1 text-muted">
                    <b>iPhone:</b> Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Việt → tải giọng.
                  </p>
                </div>
              ) : (
                <ul className="card divide-y divide-line overflow-hidden">
                  {viVoices.map((v) => {
                    const on = current?.voiceURI === v.voiceURI
                    return (
                      <li key={v.voiceURI}>
                        <button
                          onClick={() => {
                            update({ voiceURI: v.voiceURI })
                            speech.speak('Xin chào, mình sẽ đọc công thức cho bạn.', { ...settings, voiceURI: v.voiceURI })
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block font-medium truncate">{cleanName(v)}</span>
                            <span className="block text-xs text-muted">
                              {v.lang}
                              {!v.localService && ' · cần mạng'}
                            </span>
                          </span>
                          <span className={cx('grid place-items-center size-6 rounded-full border-2', on ? 'bg-brand border-brand text-brand-ink' : 'border-line')}>
                            {on && <Check size={14} strokeWidth={3} />}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <Slider
              label="Tốc độ"
              value={settings.rate}
              min={0.5}
              max={1.3}
              step={0.05}
              left="Chậm"
              right="Nhanh"
              format={(v) => `${v.toFixed(2).replace(/0$/, '')}x`}
              onChange={(rate) => update({ rate })}
            />
            <Slider
              label="Cao độ"
              value={settings.pitch}
              min={0.7}
              max={1.3}
              step={0.05}
              left="Trầm"
              right="Cao"
              format={(v) => v.toFixed(2).replace(/0$/, '')}
              onChange={(pitch) => update({ pitch })}
            />

            <button onClick={() => update({ ...DEFAULT_VOICE, voiceURI: settings.voiceURI })} className="text-sm text-muted">
              Về mặc định (tốc độ 0.8x)
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}

function Slider({ label, value, min, max, step, left, right, format, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="label mb-0">{label}</p>
        <span className="text-sm font-semibold tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-10 accent-[var(--color-brand)]"
      />
      <div className="flex justify-between text-xs text-muted -mt-1">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}
