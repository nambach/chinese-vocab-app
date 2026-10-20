import { describe, expect, it } from 'vitest'
import { textTitleFromSegments } from './textTitle'

describe('textTitleFromSegments', () => {
  it('reads the heading that follows 一、课文', () => {
    expect(
      textTitleFromSegments([
        { text: '一、课文', meaning: 'Một. Bài khóa', section: 'heading' },
        { text: '一、你常去图书馆吗', meaning: 'Bài 1: Bạn có hay đến thư viện không', section: 'heading' },
        { text: '我现在去图书馆。', section: 'kewen' },
      ]),
    ).toBe('Bạn có hay đến thư viện không')
  })

  it('returns nothing when the first lines are dialogue', () => {
    expect(
      textTitleFromSegments([
        { text: '一、课文', section: 'heading' },
        { text: '今天想请大家谈谈自己的爱好。', section: 'kewen' },
        { text: '谁先说？', section: 'kewen' },
      ]),
    ).toBeUndefined()
  })

  it('uses the hanzi title when the heading has no gloss', () => {
    expect(
      textTitleFromSegments([
        { text: '一、课文', section: 'heading' },
        { text: '一、我的一天', section: 'heading' },
      ]),
    ).toBe('我的一天')
  })
})
