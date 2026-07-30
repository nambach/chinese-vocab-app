const CHINESE_LANG = 'zh-CN'

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Pick the best available Chinese voice. Voices may load asynchronously, so
 * callers should also react to the `voiceschanged` event via
 * `onVoicesChanged` if they need up-to-date availability.
 */
function pickChineseVoice(): SpeechSynthesisVoice | undefined {
  if (!isSpeechSupported()) return undefined
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((voice) => voice.lang === CHINESE_LANG) ??
    voices.find((voice) => voice.lang.replace('_', '-').startsWith('zh-CN')) ??
    voices.find((voice) => voice.lang.replace('_', '-').startsWith('zh'))
  )
}

/** Whether a usable Chinese voice is currently available. */
export function hasChineseVoice(): boolean {
  return Boolean(pickChineseVoice())
}

/** Subscribe to voice-list changes; returns an unsubscribe function. */
export function onVoicesChanged(handler: () => void): () => void {
  if (!isSpeechSupported()) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', handler)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler)
}

/**
 * Speak the given Chinese text aloud using the Web Speech API. No-ops on
 * unsupported browsers. Cancels any in-flight utterance first so rapid taps
 * don't queue up.
 */
export const NORMAL_RATE = 0.8
export const SLOW_RATE = NORMAL_RATE / 4

export function speak(text: string, rate: number = NORMAL_RATE): void {
  if (!isSpeechSupported() || !text.trim()) return

  const synth = window.speechSynthesis
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = CHINESE_LANG
  const voice = pickChineseVoice()
  if (voice) {
    utterance.voice = voice
  }
  utterance.rate = rate
  synth.speak(utterance)
}
