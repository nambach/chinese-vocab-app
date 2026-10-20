import { describe, expect, it } from 'vitest'
import { parseLessonFile } from './lessonSchema'

function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bai-01',
    title: 'Bài mẫu',
    audio: { type: 'file', src: 'audio/shadowing/bai-01.mp3' },
    segments: [
      { id: 's1', text: '一', pinyin: 'yī', meaning: 'một', start: 0.4, end: 2.2 },
      { id: 's2', text: '二', start: 2.8, end: 5.1 },
    ],
    ...overrides,
  }
}

function file(overrides: Record<string, unknown> = {}) {
  return {
    format: 'cn-vocab-lesson',
    version: 1,
    ...raw(),
    words: [{ hanzi: '一', pinyin: 'yī', meaning: 'một', segments: ['s1'] }],
    ...overrides,
  }
}

function errorsOf(value: unknown): string[] {
  const result = parseLessonFile(value)
  return result.ok ? [] : result.errors
}

describe('parseLessonFile', () => {
  it('keeps optional segment fields and word timings', () => {
    const result = parseLessonFile(
      file({
        segments: [
          { id: 's1', text: '一', pinyin: 'yī', start: 0.4, end: 2.2, words: [{ text: '一', start: 0.4, end: 1 }] },
          { id: 's2', text: '二', start: 2.8, end: 5.1 },
        ],
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.file.segments[0].pinyin).toBe('yī')
    expect(result.file.segments[0].words).toEqual([{ text: '一', start: 0.4, end: 1 }])
    expect(result.file.segments[1].pinyin).toBeUndefined()
  })

  it('rejects anything that is not an object', () => {
    expect(errorsOf(null)).toEqual(['lesson must be an object'])
    expect(errorsOf([file()])).toEqual(['lesson must be an object'])
  })

  it('names the field and the segment that is wrong', () => {
    expect(errorsOf(file({ title: '  ' }))).toEqual(['lesson.title must be a non-empty string'])
    expect(errorsOf(file({ segments: [{ id: 's1', text: '一', start: '0.4', end: 2.2 }], words: [] }))).toEqual([
      'segments[0].start must be a number',
    ])
  })

  it('still applies the timing checks once the shape is right', () => {
    expect(errorsOf(file({ segments: [{ id: 's1', text: '一', start: 5, end: 2 }], words: [] }))).toEqual([
      'segment s1 has invalid range',
    ])
    expect(errorsOf(file({ segments: [], words: [] }))).toEqual(['lesson has no segments'])
  })

  it('keeps words and section', () => {
    const result = parseLessonFile(
      file({
        segments: [
          { id: 's1', text: '一', start: 0.4, end: 2.2, section: 'shengci' },
        ],
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.file.words[0].segments).toEqual(['s1'])
    expect(result.file.segments[0].section).toBe('shengci')
  })

  it('rejects a word that points at a missing segment', () => {
    const result = parseLessonFile(file({ words: [{ hanzi: '一', pinyin: 'yī', meaning: 'một', segments: ['s9'] }] }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((error) => error.includes('s9'))).toBe(true)
  })

  it('rejects the wrong format', () => {
    const result = parseLessonFile(file({ format: 'other' }))
    expect(result.ok).toBe(false)
  })

  it('accepts a remote url, an embedded file, and a local file without a device id', () => {
    const url = parseLessonFile(file({ audio: { type: 'url', src: 'https://example.com/a.mp3' } }))
    const embedded = parseLessonFile(
      file({
        audio: { type: 'embedded', mime: 'audio/mpeg', data: 'YQ==', name: 'a.mp3', size: 1 },
      }),
    )
    const local = parseLessonFile(
      file({
        audio: { type: 'local', blobId: 'device-1', name: 'a.mp3', size: 4, mime: 'audio/mpeg' },
      }),
    )
    if (!url.ok || !embedded.ok || !local.ok) {
      throw new Error('expected the lesson files to parse')
    }
    expect(url.file.audio).toEqual({ type: 'url', src: 'https://example.com/a.mp3' })
    expect(embedded.file.audio).toEqual({
      type: 'embedded',
      mime: 'audio/mpeg',
      data: 'YQ==',
      name: 'a.mp3',
      size: 1,
    })
    expect(local.file.audio).toEqual({
      type: 'local',
      name: 'a.mp3',
      size: 4,
      mime: 'audio/mpeg',
    })
  })

  it('rejects an unknown audio type and a negative size', () => {
    expect(parseLessonFile(file({ audio: { type: 'vinyl' } })).ok).toBe(false)
    expect(parseLessonFile(file({ audio: { type: 'local', name: 'a.mp3', size: -1, mime: 'audio/mpeg' } })).ok).toBe(
      false,
    )
  })

  it('rejects a segment that overlaps', () => {
    const result = parseLessonFile(
      file({
        segments: [
          { id: 's1', text: '一', start: 0, end: 2 },
          { id: 's2', text: '二', start: 1, end: 3 },
        ],
      }),
    )
    expect(result.ok).toBe(false)
  })
})
