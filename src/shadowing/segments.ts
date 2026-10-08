import type { ShadowingLesson, ShadowingSegment } from './types'

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

export function validateLesson(lesson: ShadowingLesson): string[] {
  const errors: string[] = []

  if (!lesson.id.trim()) errors.push('lesson id is empty')
  if (!lesson.title.trim()) errors.push('lesson title is empty')

  if (lesson.audio.type !== 'file') {
    errors.push('audio.type must be file')
  } else if (!lesson.audio.src.trim()) {
    errors.push('audio src is empty')
  }

  if (lesson.segments.length === 0) errors.push('lesson has no segments')

  const ids = new Set<string>()
  let previousEnd = -Infinity

  for (const segment of lesson.segments) {
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
