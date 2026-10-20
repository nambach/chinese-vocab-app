import type { Kewen, Word, WordSource } from '../models/types'
import { noteWithContext } from './selection'
import { withSource } from './savedWords'
import type { ShadowingLesson, ShadowingSegment } from './types'

export type WordPosition = {
  segmentId: string
  segmentIndex: number
  section?: ShadowingSegment['section']
  text: string
  pinyin?: string
  meaning?: string
}

export type PositionGroup = {
  /** Null for words that have no sentence in this lesson. */
  segmentId: string | null
  segmentIndex: number | null
  section?: ShadowingSegment['section']
  text: string | null
  words: Word[]
}

type LessonRef = Pick<ShadowingLesson, 'id' | 'segments'>

/** Sentences of this lesson that the word points at, in script order. */
export function positionsOf(word: Word, lesson: LessonRef): WordPosition[] {
  const byId = new Map(lesson.segments.map((segment, index) => [segment.id, { segment, index }]))
  const positions: WordPosition[] = []
  for (const source of word.sources ?? []) {
    if (source.lessonId !== lesson.id) continue
    const found = byId.get(source.segmentId)
    if (!found) continue
    positions.push({
      segmentId: found.segment.id,
      segmentIndex: found.index,
      section: found.segment.section,
      text: found.segment.text,
      pinyin: found.segment.pinyin,
      meaning: found.segment.meaning,
    })
  }
  return positions.sort((a, b) => a.segmentIndex - b.segmentIndex)
}

/**
 * Words grouped under each sentence they point at. A word with two positions
 * appears in both groups. Words with no position in this lesson come last.
 */
export function groupWordsByPosition(words: Word[], lesson: LessonRef): PositionGroup[] {
  const groups = new Map<string, PositionGroup>()
  const unpositioned: Word[] = []

  for (const word of words) {
    const positions = positionsOf(word, lesson)
    if (positions.length === 0) {
      unpositioned.push(word)
      continue
    }
    for (const position of positions) {
      const existing = groups.get(position.segmentId)
      if (existing) {
        existing.words.push(word)
        continue
      }
      groups.set(position.segmentId, {
        segmentId: position.segmentId,
        segmentIndex: position.segmentIndex,
        section: position.section,
        text: position.text,
        words: [word],
      })
    }
  }

  const ordered = [...groups.values()].sort(
    (a, b) => (a.segmentIndex ?? 0) - (b.segmentIndex ?? 0),
  )
  if (unpositioned.length > 0) {
    ordered.push({
      segmentId: null,
      segmentIndex: null,
      text: null,
      words: unpositioned,
    })
  }
  return ordered
}

/** Dialogue sentence when the word has one, otherwise the first position. */
export function primaryPosition(positions: WordPosition[]): WordPosition | undefined {
  return positions.find((position) => position.section === 'kewen') ?? positions[0]
}

export function positionLabel(section: ShadowingSegment['section']): string {
  if (section === 'shengci') return 'Đọc từ'
  if (section === 'kewen') return 'Trong câu'
  return 'Đoạn'
}

/**
 * Catalog to pre-select when saving a word from a sentence.
 * A lesson screen saves into itself. Otherwise the last choice, then the first catalog.
 */
export function defaultSaveCatalogId(
  catalogIds: readonly string[],
  savedId: string | null | undefined,
  lessonCatalogId?: string,
): string | null {
  if (lessonCatalogId && catalogIds.includes(lessonCatalogId)) return lessonCatalogId
  if (savedId && catalogIds.includes(savedId)) return savedId
  return catalogIds[0] ?? null
}

export function findWordByHanzi(words: Word[], hanzi: string): Word | undefined {
  const target = hanzi.trim()
  if (!target) return undefined
  return words.find((word) => word.hanzi === target)
}

/** Add a sentence onto an existing word. The same sentence is not stored twice. */
export function attachSentence(
  word: Word,
  source: WordSource,
  segment?: Pick<ShadowingSegment, 'text' | 'meaning'>,
): Word {
  const note = segment ? noteWithContext(word.note, segment) : word.note
  return {
    ...word,
    ...(note ? { note } : {}),
    sources: withSource(word, source),
  }
}

export function lessonFromKewen(kewen: Kewen): ShadowingLesson {
  return {
    id: kewen.lessonId,
    title: kewen.title,
    audio: kewen.audio,
    segments: kewen.segments,
  }
}
