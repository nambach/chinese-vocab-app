import { normalizePinyin } from '../lib/pinyin'
import type { Catalog, Word } from '../models/types'
import type { ShadowingSegment } from '../shadowing/types'

const HANZI = /\p{Script=Han}/u

/** 0 exact, 1 prefix, 2 substring. */
export type SearchRank = 0 | 1 | 2

export type WordHit = {
  catalogId: string
  catalogName: string
  word: Word
  rank: SearchRank
}

export type SentenceHit = {
  catalogId: string
  catalogName: string
  segment: ShadowingSegment
  segmentIndex: number
  matchIn: 'hanzi' | 'pinyin'
}

function containsHanzi(text: string): boolean {
  return HANZI.test(text)
}

/** Lowercase, strip accents, and fold đ so "thu vien" matches "thư viện". */
export function foldVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactPinyin(input: string): string {
  return normalizePinyin(input).replace(/\s+/g, '')
}

function rankOf(haystack: string, needle: string): SearchRank | null {
  if (!needle || !haystack) return null
  if (haystack === needle) return 0
  if (haystack.startsWith(needle)) return 1
  return haystack.includes(needle) ? 2 : null
}

function better(a: SearchRank | null, b: SearchRank | null): SearchRank | null {
  if (a == null) return b
  if (b == null) return a
  return a < b ? a : b
}

function byLesson(a: { catalogName: string }, b: { catalogName: string }): number {
  return a.catalogName.localeCompare(b.catalogName, 'vi', { numeric: true })
}

export function searchWords(catalogs: readonly Catalog[], query: string): WordHit[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const hanzi = containsHanzi(trimmed)
  const needlePinyin = compactPinyin(trimmed)
  const needleMeaning = foldVietnamese(trimmed)

  const hits: WordHit[] = []
  for (const catalog of catalogs) {
    for (const word of catalog.words) {
      const rank = hanzi
        ? rankOf(word.hanzi, trimmed)
        : better(
            needlePinyin ? rankOf(compactPinyin(word.pinyin), needlePinyin) : null,
            needleMeaning ? rankOf(foldVietnamese(word.meaning), needleMeaning) : null,
          )
      if (rank == null) continue
      hits.push({ catalogId: catalog.id, catalogName: catalog.name, word, rank })
    }
  }

  return hits.sort((a, b) => a.rank - b.rank || byLesson(a, b))
}

/** Dialogue lines only, in lesson and script order. Headings and read-aloud 生词 are not a sentence context. */
export function searchSentences(catalogs: readonly Catalog[], query: string): SentenceHit[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const hanzi = containsHanzi(trimmed)
  const needlePinyin = compactPinyin(trimmed)

  const hits: SentenceHit[] = []
  for (const catalog of catalogs) {
    const segments = catalog.kewen?.segments
    if (!segments) continue
    segments.forEach((segment, segmentIndex) => {
      if (segment.section !== 'kewen') return
      if (hanzi) {
        if (!segment.text.includes(trimmed)) return
        hits.push({ catalogId: catalog.id, catalogName: catalog.name, segment, segmentIndex, matchIn: 'hanzi' })
        return
      }
      if (!needlePinyin || !segment.pinyin) return
      if (!compactPinyin(segment.pinyin).includes(needlePinyin)) return
      hits.push({ catalogId: catalog.id, catalogName: catalog.name, segment, segmentIndex, matchIn: 'pinyin' })
    })
  }

  return hits.sort((a, b) => byLesson(a, b) || a.segmentIndex - b.segmentIndex)
}

/**
 * Character ranges in `pinyin` covered by `query` once tones and spaces are ignored.
 * Each range is [start, end) in `Array.from(pinyin)` indexes.
 */
export function pinyinHighlightRanges(pinyin: string, query: string): Array<[number, number]> {
  const needle = compactPinyin(query)
  if (!needle) return []

  const chars = Array.from(pinyin)
  const origins: number[] = []
  let folded = ''
  for (let index = 0; index < chars.length; index += 1) {
    const plain = compactPinyin(chars[index])
    for (const char of plain) {
      folded += char
      origins.push(index)
    }
  }

  const ranges: Array<[number, number]> = []
  let from = 0
  while (from <= folded.length - needle.length) {
    const at = folded.indexOf(needle, from)
    if (at < 0) break
    ranges.push([origins[at], origins[at + needle.length - 1] + 1])
    from = at + needle.length
  }
  return ranges
}
