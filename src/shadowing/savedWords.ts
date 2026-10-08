import type { Catalog, Word, WordSource } from '../models/types'
import type { ShadowingLesson } from './types'

export type SavedWord = {
  word: Word
  catalogId: string
  catalogName: string
  segmentIndex: number
}

export function hasSource(word: Word, lessonId: string, segmentId: string): boolean {
  return (word.sources ?? []).some(
    (source) => source.lessonId === lessonId && source.segmentId === segmentId,
  )
}

export function withSource(word: Word, source: WordSource): WordSource[] {
  const sources = word.sources ?? []
  if (hasSource(word, source.lessonId, source.segmentId)) return sources
  return [...sources, source]
}

/** One entry per word and sentence, ordered by sentence, across every collection. */
export function savedWordsForLesson(
  catalogs: Catalog[],
  lesson: Pick<ShadowingLesson, 'id' | 'segments'>,
): SavedWord[] {
  const segmentIndex = new Map(lesson.segments.map((segment, index) => [segment.id, index]))
  const saved: SavedWord[] = []
  for (const catalog of catalogs) {
    for (const word of catalog.words) {
      for (const source of word.sources ?? []) {
        if (source.lessonId !== lesson.id) continue
        const index = segmentIndex.get(source.segmentId)
        if (index === undefined) continue
        saved.push({ word, catalogId: catalog.id, catalogName: catalog.name, segmentIndex: index })
      }
    }
  }
  return saved
    .map((entry, order) => ({ entry, order }))
    .sort((a, b) => a.entry.segmentIndex - b.entry.segmentIndex || a.order - b.order)
    .map(({ entry }) => entry)
}

/** Indices of every character covered by an occurrence of one of the words. */
export function highlightIndices(chars: string[], words: string[]): Set<number> {
  const marked = new Set<number>()
  for (const word of words) {
    const target = Array.from(word)
    if (target.length === 0) continue
    for (let start = 0; start + target.length <= chars.length; start += 1) {
      if (target.every((char, offset) => chars[start + offset] === char)) {
        for (let offset = 0; offset < target.length; offset += 1) marked.add(start + offset)
      }
    }
  }
  return marked
}
