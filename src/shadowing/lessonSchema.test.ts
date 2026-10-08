import { describe, expect, it } from 'vitest'
import { parseLesson, parseLessonText } from './lessonSchema'

function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'lesson-01',
    title: 'Bài mẫu',
    audio: { type: 'file', src: 'audio/shadowing/lesson-01.mp3' },
    segments: [
      { id: 's1', text: '一', pinyin: 'yī', meaning: 'một', start: 0.4, end: 2.2 },
      { id: 's2', text: '二', start: 2.8, end: 5.1 },
    ],
    ...overrides,
  }
}

function errorsOf(value: unknown): string[] {
  const result = parseLesson(value)
  return result.ok ? [] : result.errors
}

describe('parseLesson', () => {
  it('accepts a well formed lesson and keeps optional fields', () => {
    const result = parseLesson(raw())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lesson.segments[0].pinyin).toBe('yī')
    expect(result.lesson.segments[1].pinyin).toBeUndefined()
    expect(result.lesson.segments[1].words).toBeUndefined()
  })

  it('keeps word timings when present', () => {
    const result = parseLesson(
      raw({
        segments: [
          { id: 's1', text: '一', start: 0.4, end: 2.2, words: [{ text: '一', start: 0.4, end: 1 }] },
        ],
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lesson.segments[0].words).toEqual([{ text: '一', start: 0.4, end: 1 }])
  })

  it('rejects anything that is not an object', () => {
    expect(errorsOf(null)).toEqual(['lesson must be an object'])
    expect(errorsOf([raw()])).toEqual(['lesson must be an object'])
  })

  it('names the field and the segment that is wrong', () => {
    expect(errorsOf(raw({ title: '  ' }))).toEqual(['lesson.title must be a non-empty string'])
    expect(
      errorsOf(raw({ segments: [{ id: 's1', text: '一', start: '0.4', end: 2.2 }] })),
    ).toEqual(['segments[0].start must be a number'])
    expect(errorsOf(raw({ segments: [{ id: 's1', text: '一', start: 0.4, end: 2.2, pinyin: 7 }] })))
      .toEqual(['segments[0].pinyin must be a string'])
  })

  it('rejects a missing or unknown audio source', () => {
    expect(errorsOf(raw({ audio: undefined }))).toEqual(['lesson.audio must be an object'])
    expect(errorsOf(raw({ audio: { type: 'vinyl' } }))).toEqual([
      "audio.type must be 'file' or 'youtube'",
    ])
  })

  it('still applies the semantic checks once the shape is right', () => {
    expect(errorsOf(raw({ segments: [{ id: 's1', text: '一', start: 5, end: 2 }] }))).toEqual([
      'segment s1 has invalid range',
    ])
    expect(errorsOf(raw({ segments: [] }))).toEqual(['lesson has no segments'])
  })
})

describe('parseLessonText', () => {
  it('parses JSON text', () => {
    const result = parseLessonText(JSON.stringify(raw()))
    expect(result.ok).toBe(true)
  })

  it('reports broken JSON instead of throwing', () => {
    const result = parseLessonText('{ nope')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toMatch(/^invalid JSON: /)
  })
})
