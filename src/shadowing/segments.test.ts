import { describe, expect, it } from 'vitest'
import {
  clampIndex,
  findSegmentIndexAt,
  formatClock,
  isPlaybackRate,
  resolveAudioSrc,
  validateLesson,
} from './segments'
import type { ShadowingLesson, ShadowingSegment } from './types'

const segments: ShadowingSegment[] = [
  { id: 's1', text: '一', start: 0.4, end: 2.2 },
  { id: 's2', text: '二', start: 2.8, end: 5.1 },
  { id: 's3', text: '三', start: 6.0, end: 8.4 },
]

function lesson(overrides: Partial<ShadowingLesson> = {}): ShadowingLesson {
  return {
    id: 'lesson-01',
    title: 'Bài mẫu',
    audio: { type: 'file', src: 'audio/shadowing/lesson-01.mp3' },
    segments,
    ...overrides,
  }
}

describe('findSegmentIndexAt', () => {
  it('returns 0 before the first sentence', () => {
    expect(findSegmentIndexAt(segments, 0)).toBe(0)
    expect(findSegmentIndexAt(segments, 0.39)).toBe(0)
  })

  it('returns the sentence that contains the time, including both edges', () => {
    expect(findSegmentIndexAt(segments, 0.4)).toBe(0)
    expect(findSegmentIndexAt(segments, 1.5)).toBe(0)
    expect(findSegmentIndexAt(segments, 2.2)).toBe(0)
    expect(findSegmentIndexAt(segments, 6)).toBe(2)
    expect(findSegmentIndexAt(segments, 8.4)).toBe(2)
  })

  it('returns the previous sentence when time falls in a gap', () => {
    expect(findSegmentIndexAt(segments, 2.5)).toBe(0)
    expect(findSegmentIndexAt(segments, 5.5)).toBe(1)
  })

  it('returns the last sentence after the final end', () => {
    expect(findSegmentIndexAt(segments, 20)).toBe(2)
  })

  it('returns 0 for an empty lesson', () => {
    expect(findSegmentIndexAt([], 3)).toBe(0)
  })
})

describe('clampIndex', () => {
  it('clamps into range', () => {
    expect(clampIndex(-1, 4)).toBe(0)
    expect(clampIndex(2, 4)).toBe(2)
    expect(clampIndex(9, 4)).toBe(3)
  })

  it('returns 0 when there are no items', () => {
    expect(clampIndex(1, 0)).toBe(0)
  })
})

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(11.2)).toBe('0:11')
    expect(formatClock(65)).toBe('1:05')
  })

  it('treats invalid numbers as zero', () => {
    expect(formatClock(Number.NaN)).toBe('0:00')
    expect(formatClock(-1)).toBe('0:00')
  })
})

describe('resolveAudioSrc', () => {
  it('joins the vite base path with a relative audio path', () => {
    const src = resolveAudioSrc('audio/shadowing/lesson-01.mp3')
    const base = import.meta.env.BASE_URL || '/'
    expect(src.endsWith('audio/shadowing/lesson-01.mp3')).toBe(true)
    expect(src.startsWith(base.endsWith('/') ? base : `${base}/`)).toBe(true)
    expect(src.includes('//audio')).toBe(false)
  })
})

describe('isPlaybackRate', () => {
  it('accepts the supported speeds', () => {
    expect(isPlaybackRate(0.5)).toBe(true)
    expect(isPlaybackRate(0.75)).toBe(true)
    expect(isPlaybackRate(1)).toBe(true)
    expect(isPlaybackRate(1.25)).toBe(true)
    expect(isPlaybackRate(2)).toBe(false)
  })
})

describe('validateLesson', () => {
  it('accepts a well-formed lesson, including touching edges and gaps', () => {
    expect(validateLesson(lesson())).toEqual([])
    expect(
      validateLesson(
        lesson({
          segments: [
            { id: 's1', text: '一', start: 0, end: 1 },
            { id: 's2', text: '二', start: 1, end: 2 },
          ],
        }),
      ),
    ).toEqual([])
  })

  it('rejects overlap, empty text, duplicate ids, and non-file audio', () => {
    const errors = validateLesson(
      lesson({
        audio: { type: 'youtube', videoId: 'abc' },
        segments: [
          { id: 's1', text: '  ', start: 1, end: 1 },
          { id: 's1', text: '二', start: 0.5, end: 2 },
        ],
      }),
    )
    expect(errors).toContain('audio.type must be file')
    expect(errors.some((error) => error.includes('invalid range'))).toBe(true)
    expect(errors.some((error) => error.includes('text is empty'))).toBe(true)
    expect(errors.some((error) => error.includes('duplicate'))).toBe(true)
    expect(errors.some((error) => error.includes('overlaps or is out of order'))).toBe(true)
  })
})
