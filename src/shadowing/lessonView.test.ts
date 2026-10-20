import { describe, expect, it } from 'vitest'
import type { Word } from '../models/types'
import {
  attachSentence,
  defaultSaveCatalogId,
  findWordByHanzi,
  groupWordsByPosition,
  positionsOf,
  primaryPosition,
} from './lessonView'

const lesson = {
  id: 'bai-16',
  segments: [
    { id: 's1', text: '一、课文', section: 'heading' as const, start: 0, end: 1 },
    { id: 's3', text: '现在几点？', pinyin: 'Xiànzài jǐ diǎn?', meaning: 'Mấy giờ rồi?', section: 'kewen' as const, start: 1, end: 2 },
    { id: 's9', text: '现在', section: 'shengci' as const, start: 2, end: 3 },
  ],
}

function word(id: string, hanzi: string, sources: Word['sources']): Word {
  return { id, hanzi, pinyin: 'p', meaning: 'm', ...(sources ? { sources } : {}) }
}

describe('groupWordsByPosition', () => {
  const words = [
    word('w1', '现在', [
      { lessonId: 'bai-16', segmentId: 's9' },
      { lessonId: 'bai-16', segmentId: 's3' },
    ]),
    word('w2', '还是', undefined),
    word('w3', '走', [{ lessonId: 'bai-17', segmentId: 's3' }]),
    word('w4', '常', [{ lessonId: 'bai-16', segmentId: 'missing' }]),
  ]

  it('groups each word under its sentences and leaves the rest at the end', () => {
    const groups = groupWordsByPosition(words, lesson)
    expect(groups.map((group) => [group.segmentId, group.words.map((item) => item.id)])).toEqual([
      ['s3', ['w1']],
      ['s9', ['w1']],
      [null, ['w2', 'w3', 'w4']],
    ])
  })

  it('reads positions in script order', () => {
    expect(positionsOf(words[0], lesson).map((position) => position.segmentId)).toEqual(['s3', 's9'])
    expect(positionsOf(words[0], lesson)[0]).toMatchObject({
      pinyin: 'Xiànzài jǐ diǎn?',
      meaning: 'Mấy giờ rồi?',
    })
  })

  it('prefers the dialogue sentence when opening a word', () => {
    const positions = positionsOf(words[0], lesson)
    expect(primaryPosition(positions)?.segmentId).toBe('s3')
    expect(primaryPosition(positionsOf(words[1], lesson))).toBeUndefined()
  })
})

describe('defaultSaveCatalogId', () => {
  const ids = ['bai-16', 'extra']

  it('saves into the lesson itself', () => {
    expect(defaultSaveCatalogId(ids, 'extra', 'bai-16')).toBe('bai-16')
  })

  it('keeps the last choice when this screen is not a lesson', () => {
    expect(defaultSaveCatalogId(ids, 'extra')).toBe('extra')
  })

  it('falls back to the first catalog, then nothing', () => {
    expect(defaultSaveCatalogId(ids, 'gone')).toBe('bai-16')
    expect(defaultSaveCatalogId([], 'extra', 'missing')).toBeNull()
  })
})

describe('attachSentence', () => {
  const existing = word('w1', '现在', [{ lessonId: 'bai-16', segmentId: 's9' }])

  it('finds the word already in the lesson', () => {
    expect(findWordByHanzi([existing], '现在')?.id).toBe('w1')
    expect(findWordByHanzi([existing], '  ')).toBeUndefined()
  })

  it('adds the sentence without copying the word', () => {
    const attached = attachSentence(
      existing,
      { lessonId: 'bai-16', segmentId: 's3' },
      { text: '现在几点？', meaning: 'Mấy giờ rồi?' },
    )
    expect(attached.id).toBe('w1')
    expect(attached.hanzi).toBe('现在')
    expect(attached.sources).toEqual([
      { lessonId: 'bai-16', segmentId: 's9' },
      { lessonId: 'bai-16', segmentId: 's3' },
    ])
    expect(attached.note).toContain('现在几点？')
  })

  it('does not store the same sentence twice', () => {
    const attached = attachSentence(existing, { lessonId: 'bai-16', segmentId: 's9' })
    expect(attached.sources).toEqual([{ lessonId: 'bai-16', segmentId: 's9' }])
  })
})
