import { describe, expect, it } from 'vitest'
import { getDirection } from './directions'
import type { Word } from '../models/types'

const check = (meaning: string, answer: string): boolean =>
  getDirection('hanzi-to-vn').checkAnswer(
    { id: 'w', hanzi: '出来', pinyin: 'chūlái', meaning } as Word,
    answer,
  )

describe('hanzi-to-vn answer checking', () => {
  it('accepts a meaning without its "(...)" clarifier', () => {
    expect(check('ra (hướng lại gần người nói)', 'ra')).toBe(true)
    expect(check('báo (nói chung)', 'báo')).toBe(true)
    expect(check('làm (+ nghề nghiệp, chức vụ)', 'làm')).toBe(true)
  })

  it('still accepts the clarifier typed out in full', () => {
    expect(check('ra (hướng lại gần người nói)', 'ra (hướng lại gần người nói)')).toBe(true)
    expect(check('làm (+ nghề nghiệp, chức vụ)', 'làm (+ nghề nghiệp, chức vụ)')).toBe(true)
  })

  it('treats ";" as a meaning separator', () => {
    expect(check('chật chội; chen chúc', 'chật chội')).toBe(true)
    expect(check('chật chội; chen chúc', 'chen chúc')).toBe(true)
  })

  it('does not split on a comma inside a clarifier', () => {
    // The old rule accepted the fragment "chức vụ)" as a whole meaning.
    expect(check('làm (+ nghề nghiệp, chức vụ)', 'chức vụ')).toBe(false)
    expect(check('nhận và gửi (thư từ, công văn)', 'công văn')).toBe(false)
  })

  it('accepts any subset of several meanings, in any combination', () => {
    const m = 'nhóm, đoàn; nắm, đốm (lượng từ cho vật hình tròn)'
    expect(check(m, 'nhóm')).toBe(true)
    expect(check(m, 'đốm')).toBe(true)
    expect(check(m, 'nhóm, đoàn')).toBe(true)
    expect(check(m, 'đoàn; nắm')).toBe(true)
    expect(check(m, 'nhóm, đốm (lượng từ cho vật hình tròn)')).toBe(true)
  })

  it('rejects a wrong meaning even alongside a right one', () => {
    expect(check('nhóm, đoàn', 'nhóm, con chó')).toBe(false)
  })

  it('mixes clarifier-stripped meanings across a multi-sense entry', () => {
    const m = 'sâu (độ cao, mức độ); đậm (màu sắc)'
    expect(check(m, 'sâu')).toBe(true)
    expect(check(m, 'đậm')).toBe(true)
    expect(check(m, 'sâu, đậm')).toBe(true)
    expect(check(m, 'đậm (màu sắc)')).toBe(true)
  })

  it('ignores case and extra whitespace', () => {
    expect(check('ra (hướng lại gần người nói)', '  RA  ')).toBe(true)
    expect(check('nhóm, đoàn', 'ĐOÀN')).toBe(true)
  })

  it('rejects an empty answer', () => {
    expect(check('ra (hướng lại gần người nói)', '   ')).toBe(false)
    expect(check('ra (hướng lại gần người nói)', ',,')).toBe(false)
  })
})
