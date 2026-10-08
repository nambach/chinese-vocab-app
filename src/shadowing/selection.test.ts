import { describe, expect, it } from 'vitest'
import {
  buildContextNote,
  nextSelection,
  noteWithContext,
  selectedText,
  splitSentence,
} from './selection'

describe('splitSentence', () => {
  it('marks punctuation and whitespace as not selectable', () => {
    const cells = splitSentence('你 好。')
    expect(cells.map((cell) => cell.char)).toEqual(['你', ' ', '好', '。'])
    expect(cells.map((cell) => cell.selectable)).toEqual([true, false, true, false])
  })
})

describe('nextSelection', () => {
  const cells = splitSentence('我们，学习中文。')

  it('starts a selection on the tapped character', () => {
    expect(nextSelection(null, 3, cells)).toEqual({ start: 3, end: 3 })
  })

  it('grows the range when characters are tapped one by one', () => {
    let selection = nextSelection(null, 3, cells)
    selection = nextSelection(selection, 4, cells)
    selection = nextSelection(selection, 5, cells)
    expect(selection).toEqual({ start: 3, end: 5 })
  })

  it('fills the characters between the first and last tap', () => {
    expect(nextSelection({ start: 3, end: 3 }, 6, cells)).toEqual({ start: 3, end: 6 })
    expect(nextSelection({ start: 6, end: 6 }, 3, cells)).toEqual({ start: 3, end: 6 })
    expect(nextSelection({ start: 3, end: 4 }, 0, cells)).toEqual({ start: 0, end: 4 })
  })

  it('clears when the only selected character is tapped again', () => {
    expect(nextSelection({ start: 3, end: 3 }, 3, cells)).toBeNull()
  })

  it('drops the tapped edge character', () => {
    expect(nextSelection({ start: 3, end: 6 }, 3, cells)).toEqual({ start: 4, end: 6 })
    expect(nextSelection({ start: 3, end: 6 }, 6, cells)).toEqual({ start: 3, end: 5 })
  })

  it('skips punctuation when dropping an edge character', () => {
    expect(nextSelection({ start: 1, end: 3 }, 1, cells)).toEqual({ start: 3, end: 3 })
    expect(nextSelection({ start: 1, end: 3 }, 3, cells)).toEqual({ start: 1, end: 1 })
  })

  it('starts over from a character inside the range', () => {
    expect(nextSelection({ start: 3, end: 6 }, 4, cells)).toEqual({ start: 4, end: 4 })
  })
})

describe('selectedText', () => {
  const chars = ['你', '，', '好', '。']

  it('returns an empty string when nothing is selected', () => {
    expect(selectedText(chars, null)).toBe('')
  })

  it('trims punctuation on the edges and keeps punctuation in the middle', () => {
    expect(selectedText(chars, { start: 0, end: 3 })).toBe('你，好')
    expect(selectedText(chars, { start: 0, end: 2 })).toBe('你，好')
    expect(selectedText(['你', '好'], { start: 0, end: 1 })).toBe('你好')
  })
})

describe('buildContextNote', () => {
  it('joins the sentence and its meaning', () => {
    expect(buildContextNote({ text: '你好', meaning: 'xin chào' })).toBe('你好 — xin chào')
  })

  it('uses the sentence alone when there is no meaning', () => {
    expect(buildContextNote({ text: '你好' })).toBe('你好')
    expect(buildContextNote({ text: '你好', meaning: '   ' })).toBe('你好')
  })
})

describe('noteWithContext', () => {
  const segment = { text: '这是第1句。', meaning: 'Đây là câu 1.' }

  it('uses the sentence when the word has no note', () => {
    expect(noteWithContext(undefined, segment)).toBe('这是第1句。 — Đây là câu 1.')
    expect(noteWithContext('   ', segment)).toBe('这是第1句。 — Đây là câu 1.')
  })

  it('appends the sentence when the note does not mention it', () => {
    expect(noteWithContext('khẩu ngữ', segment)).toBe(
      'khẩu ngữ\n这是第1句。 — Đây là câu 1.',
    )
  })

  it('leaves the note unchanged when it already contains the sentence', () => {
    const note = '这是第1句。 — Đây là câu 1.'
    expect(noteWithContext(note, segment)).toBe(note)
  })
})
