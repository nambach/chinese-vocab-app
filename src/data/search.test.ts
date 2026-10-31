import { describe, expect, it } from 'vitest'
import { pinyinHighlightRanges, searchSentences, searchWords } from './search'
import type { Catalog, Word } from '../models/types'
import type { ShadowingSegment } from '../shadowing/types'

function word(partial: Pick<Word, 'hanzi' | 'pinyin' | 'meaning'> & { id?: string }): Word {
  return { id: partial.id ?? partial.hanzi, ...partial }
}

function catalog(
  partial: Pick<Catalog, 'id' | 'name'> & { words?: Word[]; segments?: ShadowingSegment[] },
): Catalog {
  return {
    id: partial.id,
    name: partial.name,
    words: partial.words ?? [],
    createdAt: 0,
    updatedAt: 0,
    ...(partial.segments
      ? {
          kewen: {
            lessonId: partial.id,
            title: partial.name,
            audio: { type: 'file', src: `${partial.id}.mp3` },
            segments: partial.segments,
          },
        }
      : {}),
  }
}

describe('searchWords', () => {
  const lessons = [
    catalog({
      id: 'c18',
      name: 'Bài 18',
      words: [
        word({ hanzi: '朋友', pinyin: 'péngyou', meaning: 'bạn bè' }),
        word({ hanzi: '图书馆', pinyin: 'túshūguǎn', meaning: 'thư viện' }),
      ],
    }),
    catalog({
      id: 'c2',
      name: 'Bài 2',
      words: [word({ hanzi: '朋友', pinyin: 'péngyou', meaning: 'bạn' })],
    }),
    catalog({
      id: 'c16',
      name: 'Bài 16',
      words: [word({ hanzi: '常', pinyin: 'cháng', meaning: 'thường' })],
    }),
  ]

  it('matches hanzi as a substring and ranks exact, then prefix, then middle', () => {
    const hits = searchWords(
      [
        catalog({
          id: 'c',
          name: 'Bài 1',
          words: [
            word({ hanzi: '图片', pinyin: 'túpiàn', meaning: 'tranh' }),
            word({ hanzi: '图书馆', pinyin: 'túshūguǎn', meaning: 'thư viện' }),
            word({ hanzi: '图书', pinyin: 'túshū', meaning: 'sách' }),
          ],
        }),
      ],
      '图书',
    )
    expect(hits.map((hit) => [hit.word.hanzi, hit.rank])).toEqual([
      ['图书', 0],
      ['图书馆', 1],
    ])
  })

  it('keeps catalog order when the rank and the lesson name tie', () => {
    const hits = searchWords(
      [
        catalog({
          id: 'c',
          name: 'Bài 1',
          words: [
            word({ hanzi: '图片', pinyin: 'túpiàn', meaning: 'tranh' }),
            word({ hanzi: '图书', pinyin: 'túshū', meaning: 'sách' }),
          ],
        }),
      ],
      '图',
    )
    expect(hits.map((hit) => hit.word.hanzi)).toEqual(['图片', '图书'])
  })

  it('matches pinyin with or without tones, spaces, or tone numbers', () => {
    for (const query of ['pengyou', 'peng you', 'péngyou', 'peng3you']) {
      const hits = searchWords(lessons, query)
      expect(hits.map((hit) => hit.catalogName)).toEqual(['Bài 2', 'Bài 18'])
      expect(hits.every((hit) => hit.word.hanzi === '朋友')).toBe(true)
    }
  })

  it('matches a Vietnamese meaning with accents removed', () => {
    expect(searchWords(lessons, 'thu vien').map((hit) => hit.word.hanzi)).toEqual(['图书馆'])
    expect(searchWords(lessons, 'BAN BE').map((hit) => hit.word.hanzi)).toEqual(['朋友'])
  })

  it('does not match pinyin or meaning when the query contains hanzi', () => {
    expect(searchWords(lessons, '常').map((hit) => hit.word.hanzi)).toEqual(['常'])
    expect(searchWords(lessons, '你')).toEqual([])
  })

  it('returns one hit per lesson when the same word is saved in several', () => {
    const hits = searchWords(lessons, '朋友')
    expect(hits.map((hit) => hit.catalogId)).toEqual(['c2', 'c18'])
  })

  it('returns nothing for a blank query', () => {
    expect(searchWords(lessons, '   ')).toEqual([])
  })
})

describe('searchSentences', () => {
  const dialogue: ShadowingSegment = {
    id: 's3',
    text: '我现在去图书馆。',
    pinyin: 'Wǒ xiànzài qù túshūguǎn.',
    meaning: 'Bây giờ mình đi thư viện.',
    start: 7,
    end: 10,
    section: 'kewen',
  }
  const later: ShadowingSegment = {
    id: 's6',
    text: '你常去图书馆吗？',
    pinyin: 'Nǐ cháng qù túshūguǎn ma?',
    meaning: 'Bạn có hay đến thư viện không?',
    start: 17,
    end: 20,
    section: 'kewen',
  }
  const lessons = [
    catalog({
      id: 'c18',
      name: 'Bài 18',
      segments: [
        { id: 'h', text: '一、课文', pinyin: 'Yī, kèwén', start: 0, end: 1, section: 'heading' },
        later,
        dialogue,
        { id: 'v', text: '图书馆', pinyin: 'túshūguǎn', start: 30, end: 31, section: 'shengci' },
      ],
    }),
    catalog({
      id: 'c2',
      name: 'Bài 2',
      segments: [
        {
          id: 'only',
          text: '图书馆',
          pinyin: 'Túshūguǎn.',
          meaning: 'Thư viện.',
          start: 0,
          end: 1,
          section: 'kewen',
        },
      ],
    }),
  ]

  it('searches dialogue lines and skips headings and 生词', () => {
    const hits = searchSentences(lessons, '图书馆')
    expect(hits.map((hit) => [hit.catalogName, hit.segment.id])).toEqual([
      ['Bài 2', 'only'],
      ['Bài 18', 's6'],
      ['Bài 18', 's3'],
    ])
    expect(hits.every((hit) => hit.matchIn === 'hanzi')).toBe(true)
  })

  it('matches sentence pinyin and ignores the Vietnamese gloss', () => {
    const hits = searchSentences(lessons, 'tu shu guan')
    expect(hits.map((hit) => hit.segment.id)).toEqual(['only', 's6', 's3'])
    expect(hits.every((hit) => hit.matchIn === 'pinyin')).toBe(true)
    expect(searchSentences(lessons, 'thu vien')).toEqual([])
  })

  it('keeps script order inside a lesson even when a later line starts with the word', () => {
    const opening: ShadowingSegment = { ...dialogue, id: 's9', text: '图书馆很大。', pinyin: 'Túshūguǎn hěn dà.' }
    const hits = searchSentences(
      [catalog({ id: 'c', name: 'Bài 16', segments: [dialogue, later, opening] })],
      '图书馆',
    )
    expect(hits.map((hit) => hit.segment.id)).toEqual(['s3', 's6', 's9'])
  })
})

describe('pinyinHighlightRanges', () => {
  it('marks the syllables that match once tones and spaces are ignored', () => {
    const pinyin = 'Wǒ yǒu yí ge péngyou.'
    const ranges = pinyinHighlightRanges(pinyin, 'peng you')
    const chars = Array.from(pinyin)
    const marked = ranges.flatMap(([start, end]) => chars.slice(start, end)).join('')
    expect(marked).toBe('péngyou')
  })

  it('marks every occurrence', () => {
    const pinyin = 'mā ma'
    const chars = Array.from(pinyin)
    const marked = pinyinHighlightRanges(pinyin, 'ma').map(([start, end]) => chars.slice(start, end).join(''))
    expect(marked).toEqual(['mā', 'ma'])
  })
})
