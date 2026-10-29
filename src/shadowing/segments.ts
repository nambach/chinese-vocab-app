import type { ShadowingSegment } from './types'

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25] as const

export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

export function isPlaybackRate(value: number): value is PlaybackRate {
  return (PLAYBACK_RATES as readonly number[]).includes(value)
}

/** Last segment whose start is at or before `time`. Before the first start, returns 0. */
export function findSegmentIndexAt(segments: readonly Pick<ShadowingSegment, 'start'>[], time: number): number {
  if (segments.length === 0) return 0
  if (time < segments[0].start) return 0

  let index = 0
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].start <= time) index = i
    else break
  }
  return index
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(length - 1, Math.max(0, index))
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function resolveAudioSrc(src: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${src.replace(/^\//, '')}`
}

/** Timing and identity checks for a script. */
export function validateSegments(segments: readonly ShadowingSegment[]): string[] {
  const errors: string[] = []

  if (segments.length === 0) errors.push('lesson has no segments')

  const ids = new Set<string>()
  let previousEnd = -Infinity

  for (const segment of segments) {
    const label = segment.id.trim() || '(missing id)'

    if (!segment.id.trim()) {
      errors.push('segment id is empty')
    } else if (ids.has(segment.id)) {
      errors.push(`duplicate segment id ${segment.id}`)
    }
    ids.add(segment.id)

    if (!segment.text.trim()) errors.push(`segment ${label} text is empty`)

    if (!(segment.start >= 0) || !(segment.end > segment.start)) {
      errors.push(`segment ${label} has invalid range`)
    }

    if (segment.start < previousEnd) {
      errors.push(`segment ${label} overlaps or is out of order`)
    }

    previousEnd = segment.end
  }

  return errors
}

const LEAD_CS = 20
const TAIL_CS = 10

function toCentiseconds(seconds: number): number {
  return Math.round(seconds * 100)
}

function fromCentiseconds(centiseconds: number): number {
  return centiseconds / 100
}

/**
 * Widen each sentence by up to 0.2s before it and 0.1s after it.
 * A gap shorter than 0.3s is shared in that 2:1 ratio. The range never
 * crosses 0, `duration`, or a neighboring sentence.
 */
export function padSegmentEdges(
  segments: readonly ShadowingSegment[],
  duration?: number,
): ShadowingSegment[] {
  if (segments.length === 0) return []

  const order = [...segments].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
  const starts = order.map((segment) => toCentiseconds(segment.start))
  const ends = order.map((segment) => toCentiseconds(segment.end))
  const nextStarts = starts.slice()
  const nextEnds = ends.slice()

  nextStarts[0] = starts[0] - Math.min(LEAD_CS, Math.max(0, starts[0]))

  for (let index = 0; index < order.length - 1; index++) {
    const gap = Math.max(0, starts[index + 1] - ends[index])
    const lead = gap >= LEAD_CS + TAIL_CS ? LEAD_CS : Math.round((gap * LEAD_CS) / (LEAD_CS + TAIL_CS))
    const tail = gap >= LEAD_CS + TAIL_CS ? TAIL_CS : gap - lead
    nextEnds[index] = ends[index] + tail
    nextStarts[index + 1] = starts[index + 1] - lead
  }

  const last = order.length - 1
  const endLimit =
    duration !== undefined && Number.isFinite(duration) ? toCentiseconds(duration) : ends[last] + TAIL_CS
  nextEnds[last] = ends[last] + Math.min(TAIL_CS, Math.max(0, endLimit - ends[last]))

  const placed = new Map(order.map((segment, index) => [segment.id, index]))
  return segments.map((segment) => {
    const index = placed.get(segment.id)
    if (index === undefined) return segment
    const start = fromCentiseconds(nextStarts[index])
    const end = fromCentiseconds(nextEnds[index])
    if (start === segment.start && end === segment.end) return segment
    return { ...segment, start, end }
  })
}

/** Length of each bundled lesson mp3, so the last sentence stays inside the file. */
export const BUNDLED_AUDIO_DURATION: Readonly<Record<string, number>> = {
  'audio/shadowing/bai-16.mp3': 190.09,
  'audio/shadowing/bai-17.mp3': 167.73,
  'audio/shadowing/bai-18.mp3': 173.66,
  'audio/shadowing/bai-19.mp3': 134.95,
  'audio/shadowing/bai-20.mp3': 156.84,
  'audio/shadowing/bai-21.mp3': 218.23,
  'audio/shadowing/bai-22.mp3': 156.06,
  'audio/shadowing/bai-23.mp3': 188.37,
  'audio/shadowing/bai-24.mp3': 182.96,
  'audio/shadowing/bai-25.mp3': 203.73,
  'audio/shadowing/bai-26.mp3': 227.4,
  'audio/shadowing/bai-27.mp3': 207.73,
  'audio/shadowing/bai-28.mp3': 264.2,
  'audio/shadowing/bai-29.mp3': 349.34,
  'audio/shadowing/bai-30.mp3': 372.38,
}
