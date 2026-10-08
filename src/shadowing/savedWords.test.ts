import { describe, expect, it } from 'vitest'
import type { Catalog, Word } from '../models/types'
import { hasSource, highlightIndices, savedWordsForLesson, withSource } from './savedWords'

const lesson = {
  id: 'lesson-01',
  segments: [
    { id: 's1', text: '你好。', start: 0, end: 1 },
    { id: 's2', text: '这是书。', start: 1, end: 2 },
  ],
}

function word(id: string, hanzi: string, sources: Word['sources']): Word {
  return { id, hanzi, pinyin: '', meaning: '', ...(sources ? { sources } : {}) }
}

function catalog(id: string, words: Word[]): Catalog {
  return { id, name: `Bộ ${id}`, words, createdAt: 0, updatedAt: 0 }
}

describe('hasSource / withSource', () => {
  const linked = word('w1', '这', [{ lessonId: 'lesson-01', segmentId: 's2' }])

  it('finds a linked sentence', () => {
    expect(hasSource(linked, 'lesson-01', 's2')).toBe(true)
    expect(hasSource(linked, 'lesson-01', 's1')).toBe(false)
    expect(hasSource(word('w2', '这', undefined), 'lesson-01', 's2')).toBe(false)
  })

  it('adds a new sentence and keeps the old ones', () => {
    expect(withSource(linked, { lessonId: 'lesson-01', segmentId: 's1' })).toEqual([
      { lessonId: 'lesson-01', segmentId: 's2' },
      { lessonId: 'lesson-01', segmentId: 's1' },
    ])
  })

  it('does not add the same sentence twice', () => {
    expect(withSource(linked, { lessonId: 'lesson-01', segmentId: 's2' })).toEqual([
      { lessonId: 'lesson-01', segmentId: 's2' },
    ])
  })
})

describe('savedWordsForLesson', () => {
  it('collects words from every collection in sentence order', () => {
    const catalogs = [
      catalog('a', [
        word('w1', '书', [{ lessonId: 'lesson-01', segmentId: 's2' }]),
        word('w2', '猫', undefined),
      ]),
      catalog('b', [
        word('w3', '你好', [
          { lessonId: 'lesson-01', segmentId: 's1' },
          { lessonId: 'other', segmentId: 's1' },
        ]),
      ]),
    ]
    const saved = savedWordsForLesson(catalogs, lesson)
    expect(saved.map((entry) => [entry.word.id, entry.catalogName, entry.segmentIndex])).toEqual([
      ['w3', 'Bộ b', 0],
      ['w1', 'Bộ a', 1],
    ])
  })

  it('lists a word once for each sentence it is linked to', () => {
    const catalogs = [
      catalog('a', [
        word('w1', '这', [
          { lessonId: 'lesson-01', segmentId: 's2' },
          { lessonId: 'lesson-01', segmentId: 's1' },
        ]),
      ]),
    ]
    expect(savedWordsForLesson(catalogs, lesson).map((entry) => entry.segmentIndex)).toEqual([0, 1])
  })

  it('skips sentences that no longer exist in the lesson', () => {
    const catalogs = [catalog('a', [word('w1', '这', [{ lessonId: 'lesson-01', segmentId: 's9' }])])]
    expect(savedWordsForLesson(catalogs, lesson)).toEqual([])
  })
})

describe('highlightIndices', () => {
  const chars = Array.from('这是书，这本书。')

  it('marks every occurrence of each word', () => {
    expect([...highlightIndices(chars, ['书'])].sort((a, b) => a - b)).toEqual([2, 6])
    expect([...highlightIndices(chars, ['这本书'])].sort((a, b) => a - b)).toEqual([4, 5, 6])
  })

  it('ignores words that are not in the sentence', () => {
    expect(highlightIndices(chars, ['猫', '']).size).toBe(0)
  })
})
