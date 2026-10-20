import type { AppState } from '../models/types'
import { createId } from './ids'
import { getCatalog, upsertCatalog } from './store'
import { validateSegments } from '../shadowing/segments'
import type { ShadowingSegment } from '../shadowing/types'

const NEW_SEGMENT_SECONDS = 5

export function sortSegments(segments: readonly ShadowingSegment[]): ShadowingSegment[] {
  return [...segments].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
}

function userSegmentId(): string {
  return `u-${createId()}`
}

/**
 * Blank sentence at the playhead or over a selected range.
 * Neighbors are left alone: overlap is reported by `segmentErrors`, not fixed here.
 */
export function newSegmentAt(
  _segs: readonly ShadowingSegment[],
  start: number,
  end?: number,
  duration?: number,
): ShadowingSegment {
  let nextEnd = end ?? start + NEW_SEGMENT_SECONDS
  if (duration !== undefined && Number.isFinite(duration)) {
    nextEnd = Math.min(nextEnd, duration)
  }
  return {
    id: userSegmentId(),
    text: '',
    start,
    end: nextEnd,
  }
}

export type SegmentErrors = {
  start?: string
  end?: string
  text?: string
}

/** Field errors for the sentence being edited. `draft` may not be in `segs` yet. */
export function segmentErrors(
  segs: readonly ShadowingSegment[],
  draft: ShadowingSegment,
  duration: number,
): SegmentErrors {
  const errors: SegmentErrors = {}
  const others = segs.filter((segment) => segment.id !== draft.id)
  const ordered = sortSegments([...others, draft])
  const index = ordered.findIndex((segment) => segment.id === draft.id)
  const prev = index > 0 ? ordered[index - 1] : undefined
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined

  if (!Number.isFinite(draft.start) || draft.start < 0 || draft.start > duration) {
    errors.start = 'Ngoài audio'
  } else if (prev && prev.end > draft.start) {
    errors.start = 'Trùng câu trước'
  }

  if (!Number.isFinite(draft.end) || !(draft.end > draft.start)) {
    errors.end = 'Kết thúc phải sau bắt đầu'
  } else if (draft.end < 0 || draft.end > duration) {
    errors.end = 'Ngoài audio'
  } else if (next && next.start < draft.end) {
    errors.end = 'Trùng câu sau'
  }

  if (!draft.text.trim()) errors.text = 'Chưa có Hán tự'

  return errors
}

function withoutWords(segment: ShadowingSegment): ShadowingSegment {
  const next = { ...segment }
  delete next.words
  return next
}

/** Insert or replace one sentence, ordered by start. Drops per-character timings when time or hanzi changes. */
export function upsertSegment(
  segs: readonly ShadowingSegment[],
  draft: ShadowingSegment,
): ShadowingSegment[] {
  const index = segs.findIndex((segment) => segment.id === draft.id)
  if (index < 0) return sortSegments([...segs, withoutWords(draft)])

  const before = segs[index]
  const timingChanged = before.start !== draft.start || before.end !== draft.end
  const textChanged = before.text !== draft.text
  const next = timingChanged || textChanged ? withoutWords({ ...before, ...draft }) : { ...before, ...draft }
  const copy = segs.map((segment, itemIndex) => (itemIndex === index ? next : segment))
  return sortSegments(copy)
}

export function deleteSegment(segments: readonly ShadowingSegment[], id: string): ShadowingSegment[] {
  const sorted = sortSegments(segments)
  if (!sorted.some((segment) => segment.id === id)) return [...segments]
  return sorted.filter((segment) => segment.id !== id)
}

/** Persist one script. The caller has already applied the single-sentence edit. */
export function saveKewen(
  state: AppState,
  catalogId: string,
  segments: readonly ShadowingSegment[],
): AppState {
  const sorted = sortSegments(segments)
  const errors = validateSegments(sorted)
  if (errors.length) throw new Error(errors.join('; '))

  const catalog = getCatalog(state, catalogId)
  if (!catalog?.kewen) return state

  return upsertCatalog(state, {
    ...catalog,
    kewen: { ...catalog.kewen, segments: sorted.map((segment) => ({ ...segment })) },
    updatedAt: Date.now(),
  })
}

/** Words linked to a sentence anywhere in the app. */
export function countWordSourcesForSegment(
  state: AppState,
  lessonId: string,
  segmentId: string,
): number {
  let count = 0
  for (const catalog of state.catalogs) {
    for (const word of catalog.words) {
      for (const source of word.sources ?? []) {
        if (source.lessonId === lessonId && source.segmentId === segmentId) count++
      }
    }
  }
  return count
}

export function formatSegmentClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.00'
  const total = Math.round(seconds * 100)
  const minutes = Math.floor(total / 6000)
  const rest = total % 6000
  const whole = Math.floor(rest / 100)
  const frac = rest % 100
  return `${minutes}:${whole.toString().padStart(2, '0')}.${frac.toString().padStart(2, '0')}`
}

/** `m:ss.ss`, or a bare number of seconds (`12.35`). Incomplete text returns null. */
export function parseSegmentClock(input: string): number | null {
  const text = input.trim()
  if (!text) return null
  const parts = text.split(':')
  if (parts.length > 2) return null
  if (parts.length === 2) {
    const [minPart, secPart] = parts
    if (!/^\d+$/.test(minPart) || !/^\d+(\.\d+)?$/.test(secPart)) return null
    const seconds = Number(secPart)
    if (seconds >= 60) return null
    return Number(minPart) * 60 + seconds
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  return Number(text)
}
