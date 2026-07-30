import { useEffect, useRef, useState } from 'react'
import {
  hasChineseVoice,
  isSpeechSupported,
  NORMAL_RATE,
  onVoicesChanged,
  SLOW_RATE,
  speak,
} from '../lib/speech'

type SpeakButtonProps = {
  text: string
  /** Accessible label + tooltip. */
  label?: string
  className?: string
}

/**
 * A speaker icon button that pronounces Chinese text via the Web Speech API.
 * Renders nothing when speech synthesis or a Chinese voice is unavailable, so
 * it degrades gracefully on unsupported devices.
 */
export function SpeakButton({ text, label = 'Phát âm', className = '' }: SpeakButtonProps) {
  const [available, setAvailable] = useState(() => isSpeechSupported() && hasChineseVoice())
  const tapCount = useRef(0)

  useEffect(() => {
    if (!isSpeechSupported()) return undefined
    // Voices often load asynchronously (especially on first visit).
    setAvailable(hasChineseVoice())
    return onVoicesChanged(() => setAvailable(hasChineseVoice()))
  }, [])

  if (!available || !text.trim()) return null

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        // Alternate speed on each tap: normal, then half, then normal, ...
        const rate = tapCount.current % 2 === 0 ? NORMAL_RATE : SLOW_RATE
        tapCount.current += 1
        speak(text, rate)
      }}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-200 transition active:scale-95 ${className}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 9v6h4l5 4V5L8 9H4z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 8.5a4 4 0 010 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
