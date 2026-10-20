import { describe, expect, it } from 'vitest'
import { textTitleFromSegments } from '../../shadowing/textTitle'
import { LESSON_PACK } from './index'

/** Readings after the 专名 heading are proper names and need no word. */
function properNameIds(segments: { id: string; text: string }[]): Set<string> {
  const start = segments.findIndex((segment) => segment.text.trim() === '专名')
  return new Set(start === -1 ? [] : segments.slice(start + 1).map((segment) => segment.id))
}

const snapshotModules = import.meta.glob('./published-segment-ids.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, string[]>>

describe('packaged lesson files', () => {
  const lessons = LESSON_PACK.filter((lesson) => lesson.kind === 'lesson' && lesson.file)

  it('points every word at a real segment, and at most two', () => {
    for (const lesson of lessons) {
      const file = lesson.file!
      const ids = new Set(file.segments.map((segment) => segment.id))
      for (const word of file.words) {
        const refs = word.segments ?? []
        expect(refs.length, `${file.id} ${word.hanzi}`).toBeLessThanOrEqual(2)
        for (const id of refs) {
          expect(ids.has(id), `${file.id} ${word.hanzi} ${id}`).toBe(true)
        }
      }
    }
  })

  it('gives every 生词 reading a word, except proper names', () => {
    for (const lesson of lessons) {
      const file = lesson.file!
      const covered = new Set(file.words.flatMap((word) => word.segments ?? []))
      const names = properNameIds(file.segments)
      for (const segment of file.segments) {
        if (segment.section !== 'shengci') continue
        const linked = covered.has(segment.id) || names.has(segment.id)
        expect(linked, `${file.id} ${segment.id} ${segment.text}`).toBe(true)
      }
    }
  })

  it('ships bai-16 … bai-30 with a bundled mp3 and a section on every segment', () => {
    expect(lessons.map((lesson) => lesson.id)).toEqual(
      Array.from({ length: 15 }, (_, index) => `bai-${16 + index}`),
    )
    for (const lesson of lessons) {
      const file = lesson.file!
      expect(file.audio).toEqual({ type: 'file', src: `audio/shadowing/${file.id}.mp3` })
      expect(file.segments.every((segment) => segment.section)).toBe(true)
    }
  })

  it('stores the first 课文 title, including a title that is not read aloud', () => {
    const titled = lessons.find((lesson) => lesson.id === 'bai-16')
    const unspoken = lessons.find((lesson) => lesson.id === 'bai-22')
    expect(titled?.file?.textTitle).toBe('Bạn có hay đến thư viện không')
    expect(unspoken?.file?.textTitle).toBe('Tôi định mời giáo viên dạy kinh kịch')
    expect(textTitleFromSegments(unspoken!.file!.segments)).toBeUndefined()
    expect(lessons.find((lesson) => lesson.id === 'bai-27')?.file?.textTitle).toBe('Mary khóc')
    for (const lesson of lessons) {
      if (lesson.id === 'bai-22' || lesson.id === 'bai-27') continue
      expect(lesson.file?.textTitle).toBe(textTitleFromSegments(lesson.file!.segments))
    }
  })

  it('keeps the published segment ids', () => {
    const published = Object.values(snapshotModules)[0]
    expect(lessons.map((lesson) => lesson.id)).toEqual(Object.keys(published))
    for (const lesson of lessons) {
      expect(lesson.file!.segments.map((segment) => segment.id)).toEqual(published[lesson.id])
    }
  })
})
