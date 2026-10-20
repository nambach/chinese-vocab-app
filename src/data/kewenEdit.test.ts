import { describe, expect, it, vi } from 'vitest'
import {
  deleteSegment,
  formatSegmentClock,
  newSegmentAt,
  parseSegmentClock,
  saveKewen,
  segmentErrors,
  sortSegments,
  upsertSegment,
} from './kewenEdit'
import { defaultAppState, type Catalog } from '../models/types'
import type { ShadowingSegment } from '../shadowing/types'

const base: ShadowingSegment[] = [
  { id: 's1', text: '你好', start: 0, end: 1, section: 'kewen', words: [{ text: '你', start: 0, end: 0.5 }] },
  { id: 's2', text: '谢谢', start: 1.5, end: 2.5, section: 'kewen' },
  { id: 's3', text: '再见', start: 3, end: 4, section: 'kewen' },
]

describe('sortSegments', () => {
  it('orders by start time', () => {
    expect(sortSegments([base[2], base[0], base[1]]).map((s) => s.id)).toEqual(['s1', 's2', 's3'])
  })
})

describe('newSegmentAt', () => {
  it('starts a blank user sentence at the cursor, five seconds long', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'abc' })
    expect(newSegmentAt(base, 1.2, undefined, 100)).toEqual({
      id: 'u-abc',
      text: '',
      start: 1.2,
      end: 6.2,
    })
    vi.unstubAllGlobals()
  })

  it('uses a selected range and clamps the end at the audio', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'abc' })
    expect(newSegmentAt(base, 1, 4, 100)).toMatchObject({ start: 1, end: 4 })
    expect(newSegmentAt(base, 8, undefined, 10).end).toBe(10)
    vi.unstubAllGlobals()
  })

  it('does not shift away from a sentence it overlaps', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'abc' })
    expect(newSegmentAt(base, 0.2, undefined, 100)).toMatchObject({ start: 0.2, end: 5.2 })
    vi.unstubAllGlobals()
  })
})

describe('segmentErrors', () => {
  const duration = 100

  it('reports overlap, order, bounds, and empty hanzi on the matching field', () => {
    expect(segmentErrors(base, { ...base[1], start: 0.5 }, duration).start).toBe('Trùng câu trước')
    expect(segmentErrors(base, { ...base[1], end: 3.2 }, duration).end).toBe('Trùng câu sau')
    expect(segmentErrors(base, { ...base[1], end: 1.5 }, duration).end).toBe('Kết thúc phải sau bắt đầu')
    expect(segmentErrors(base, { ...base[1], start: -1 }, duration).start).toBe('Ngoài audio')
    expect(segmentErrors(base, { ...base[1], end: 101 }, duration).end).toBe('Ngoài audio')
    expect(segmentErrors(base, { ...base[1], text: '  ' }, duration).text).toBe('Chưa có Hán tự')
  })

  it('allows a sentence that only touches its neighbors', () => {
    const draft: ShadowingSegment = { id: 'u-x', text: '好', start: 1, end: 1.5 }
    expect(segmentErrors(base, draft, duration)).toEqual({})
  })

  it('does not treat the saved copy of the same sentence as a neighbor', () => {
    expect(segmentErrors(base, { ...base[1], start: 1.6 }, duration).start).toBeUndefined()
  })

  it('prefers an impossible range over an overlap message', () => {
    expect(segmentErrors(base, { ...base[1], start: 3.5, end: 3 }, duration).end).toBe(
      'Kết thúc phải sau bắt đầu',
    )
  })
})

describe('upsertSegment', () => {
  it('drops word timings when hanzi or timing changes', () => {
    const text = upsertSegment(base, { ...base[0], text: '您好' })
    expect(text.find((s) => s.id === 's1')?.words).toBeUndefined()

    const timing = upsertSegment(base, { ...base[0], end: 1.2 })
    expect(timing.find((s) => s.id === 's1')?.words).toBeUndefined()
  })

  it('keeps word timings when only pinyin changes', () => {
    const next = upsertSegment(base, { ...base[0], pinyin: 'nín hǎo' })
    expect(next.find((s) => s.id === 's1')?.words).toHaveLength(1)
    expect(next.find((s) => s.id === 's1')?.pinyin).toBe('nín hǎo')
  })

  it('inserts a new sentence in time order without word timings', () => {
    const draft: ShadowingSegment = {
      id: 'u-new',
      text: '好',
      start: 1.1,
      end: 1.4,
      words: [{ text: '好', start: 1.1, end: 1.4 }],
    }
    const next = upsertSegment(base, draft)
    expect(next.map((s) => s.id)).toEqual(['s1', 'u-new', 's2', 's3'])
    expect(next.find((s) => s.id === 'u-new')?.words).toBeUndefined()
  })
})

describe('deleteSegment', () => {
  it('removes one sentence', () => {
    expect(deleteSegment(base, 's2').map((s) => s.id)).toEqual(['s1', 's3'])
  })
})

describe('saveKewen', () => {
  function catalog(overrides: Partial<Catalog> = {}): Catalog {
    return {
      id: 'cat-1',
      name: 'Bài 16',
      builtinId: 'bai-16',
      createdAt: 1,
      updatedAt: 1,
      words: [
        {
          id: 'w1',
          hanzi: '谢',
          pinyin: 'xiè',
          meaning: 'cảm ơn',
          sources: [{ lessonId: 'bai-16', segmentId: 's2' }],
        },
      ],
      kewen: {
        lessonId: 'bai-16',
        title: 'Bundled',
        audio: { type: 'file', src: 'audio/shadowing/bai-16.mp3' },
        segments: base,
      },
      ...overrides,
    }
  }

  it('rejects an invalid script', () => {
    const state = { ...defaultAppState(), catalogs: [catalog()] }
    expect(() => saveKewen(state, 'cat-1', [{ id: 's1', text: ' ', start: 0, end: 1 }])).toThrow()
  })

  it('persists segments and leaves word positions alone', () => {
    const next = saveKewen(
      { ...defaultAppState(), catalogs: [catalog()] },
      'cat-1',
      upsertSegment(base, { ...base[0], text: '您好' }),
    )
    expect(next.catalogs[0].kewen?.segments[0].text).toBe('您好')
    expect(next.catalogs[0].words[0].sources).toEqual([{ lessonId: 'bai-16', segmentId: 's2' }])
  })
})

describe('segment clock', () => {
  it('formats centiseconds', () => {
    expect(formatSegmentClock(0)).toBe('0:00.00')
    expect(formatSegmentClock(12.35)).toBe('0:12.35')
    expect(formatSegmentClock(62.35)).toBe('1:02.35')
  })

  it('parses a clock or a number of seconds', () => {
    expect(parseSegmentClock('0:12.35')).toBe(12.35)
    expect(parseSegmentClock('12.35')).toBe(12.35)
    expect(parseSegmentClock('1:02')).toBe(62)
    expect(parseSegmentClock('1:2.5')).toBe(62.5)
    expect(parseSegmentClock('1:')).toBeNull()
    expect(parseSegmentClock('1:60')).toBeNull()
    expect(parseSegmentClock('abc')).toBeNull()
  })
})
