import { beforeAll, describe, expect, it } from 'vitest'
import { toTraditional, waitForTraditionalDataLoaded } from './traditional'

beforeAll(() => waitForTraditionalDataLoaded())

// human-verified — do not regenerate
// Every one of the 570 words across bai-01..bai-23 that contains one of the
// 53 simplified characters with an ambiguous (one-to-many) traditional
// mapping. Verified by hand against Taiwan-standard traditional Chinese.
const AMBIGUOUS_WORDS: [string, string][] = [
  ['大家', '大家'],
  ['大家好', '大家好'],
  ['邮局', '郵局'],
  ['几', '幾'],
  ['回', '回'],
  ['没关系', '沒關係'],
  ['坐', '坐'],
  ['发音', '發音'],
  ['杂志', '雜誌'],
  ['吃', '吃'],
  ['面条', '麵條'],
  ['一个人', '一個人'],
  ['一只狗', '一隻狗'],
  ['凌晨', '凌晨'],
  ['水果', '水果'],
  ['苹果', '蘋果'],
  ['斤', '斤'],
  ['公斤', '公斤'],
  ['了', '了'],
  ['别的', '別的'],
  ['两个人', '兩個人'],
  ['千', '千'],
  ['万', '萬'],
  ['家', '家'],
  ['大夫', '大夫'],
  ['同学', '同學'],
  ['同屋', '同屋'],
  ['茶叶', '茶葉'],
  ['药', '藥'],
  ['中药', '中藥'],
  ['西药', '西藥'],
  ['里', '裡'],
  ['杯', '杯'],
  ['摩托车', '摩托車'],
  ['出租车', '出租車'],
  ['只', '只'],
  ['借', '借'],
  ['复习', '複習'],
  ['收发', '收發'],
  ['发', '發'],
  ['宿舍', '宿舍'],
  ['出来', '出來'],
  ['出去', '出去'],
  ['录音', '錄音'],
  ['综合', '綜合'],
  ['拿', '拿'],
  ['代表', '代表'],
  ['团', '團'],
  ['参观', '參觀'],
  ['当', '當'],
  ['回来', '回來'],
  ['回去', '回去'],
  ['当然', '當然'],
  ['合适', '合適'],
  ['适合', '適合'],
  ['好吃', '好吃'],
  ['种', '種'],
  ['打折', '打折'],
  ['上个月', '上個月'],
  ['这个月', '這個月'],
  ['下个月', '下個月'],
  ['后年', '後年'],
  ['准备', '準備'],
  ['参加', '參加'],
  ['点钟', '點鐘'],
  ['中秋节', '中秋節'],
  ['以后', '以後'],
  ['然后', '然後'],
  ['后', '後'],
  ['分钟', '分鐘'],
  ['锻炼', '鍛鍊'],
  ['洗头发', '洗頭髮'],
  ['出发', '出發'],
  ['集合', '集合'],
  ['准时', '準時'],
  ['玩', '玩'],
  ['玩游戏', '玩遊戲'],
  ['业余', '業餘'],
  ['特别', '特別'],
  ['游戏', '遊戲'],
  ['幸福', '幸福'],
  ['累', '累'],
  ['后边', '後邊'],
  ['里边', '裡邊'],
  ['广场', '廣場'],
  ['拐', '拐'],
  ['公里', '公里'],
]

describe('toTraditional', () => {
  it.each(AMBIGUOUS_WORDS)('converts %s -> %s', (input, expected) => {
    expect(toTraditional(input)).toBe(expected)
  })

  // These 10 require the phrase-override table: mapping character-by-character
  // (without phrase overrides) produces a different, wrong result.
  it.each([
    ['分钟', '分鐘'],
    ['点钟', '點鐘'],
    ['公里', '公里'],
    ['复习', '複習'],
    ['杂志', '雜誌'],
    ['没关系', '沒關係'],
    ['洗头发', '洗頭髮'],
    ['锻炼', '鍛鍊'],
    ['一只狗', '一隻狗'],
    ['面条', '麵條'],
  ] satisfies [string, string][])(
    'phrase-table override: %s -> %s (char-by-char would be wrong)',
    (input, expected) => {
      expect(toTraditional(input)).toBe(expected)
    },
  )

  // These 5 require the TWVariants pass: without it, characters resolve to
  // mainland/other traditional variants (e.g. 吃 -> 喫, 里 -> 裏).
  it.each([
    ['吃', '吃'],
    ['面条', '麵條'],
    ['里', '裡'],
    ['里边', '裡邊'],
    ['好吃', '好吃'],
  ] satisfies [string, string][])('TWVariants-dependent: %s -> %s', (input, expected) => {
    expect(toTraditional(input)).toBe(expected)
  })

  it('handles edge cases', () => {
    expect(toTraditional('')).toBe('')
    expect(toTraditional('Hello, world! 123')).toBe('Hello, world! 123')
    // Already-traditional text should be idempotent.
    expect(toTraditional('麵條')).toBe('麵條')
    expect(toTraditional(toTraditional('面条'))).toBe('麵條')
  })
})
