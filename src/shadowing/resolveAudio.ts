import { resolveAudioSrc } from './segments'
import type { AudioSource } from './types'

export type ResolvedAudio = {
  url: string
  /** `none` when WaveSurfer cannot fetch the bytes (a remote URL may lack CORS). */
  waveform: 'full' | 'none'
}

/**
 * Where the player should read audio from.
 * A remote URL stays on the `<audio>` element: drawing a waveform would require a CORS fetch.
 * Wiring that player is later; this only decides the URL and whether a waveform is possible.
 */
export function resolveAudio(
  source: AudioSource,
  blob?: Blob,
  createObjectURL: (blob: Blob) => string = URL.createObjectURL,
): ResolvedAudio | null {
  if (source.type === 'file') {
    if (!source.src.trim()) return null
    return { url: resolveAudioSrc(source.src), waveform: 'full' }
  }

  if (source.type === 'url') {
    if (!source.src.trim()) return null
    return { url: source.src, waveform: 'none' }
  }

  if (source.type === 'local') {
    if (!source.blobId || !blob) return null
    return { url: createObjectURL(blob), waveform: 'full' }
  }

  return null
}
