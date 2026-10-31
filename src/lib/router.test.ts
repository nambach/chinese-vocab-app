import { describe, expect, it } from 'vitest'
import { parseHash, serializeView } from './router'

describe('search routes', () => {
  it('round-trips the search page', () => {
    expect(serializeView({ name: 'search' })).toBe('#/search')
    expect(parseHash('#/search')).toEqual({ name: 'search' })
  })

  it('round-trips a jump to a sentence or a word', () => {
    const sentence = { name: 'catalog' as const, catalogId: 'c1', focus: { segmentId: 's 3' } }
    expect(parseHash(serializeView(sentence))).toEqual(sentence)

    const word = { name: 'catalog' as const, catalogId: 'c1', focus: { wordId: 'w/1' } }
    expect(parseHash(serializeView(word))).toEqual(word)
  })

  it('keeps the word-management routes', () => {
    expect(parseHash('#/c/c1')).toEqual({ name: 'catalog', catalogId: 'c1' })
    expect(parseHash('#/c/c1/words')).toEqual({ name: 'manageWords', catalogId: 'c1' })
    expect(parseHash('#/c/c1/words/w1')).toEqual({ name: 'editWord', catalogId: 'c1', wordId: 'w1' })
  })
})
