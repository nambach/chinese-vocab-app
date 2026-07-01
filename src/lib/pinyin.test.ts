import { describe, expect, it } from 'vitest'
import {
  applyToneToSyllable,
  convertToneNumbers,
  normalizePinyin,
  normalizePinyinWithTones,
  pinyinMatches,
  toPlainSyllable,
} from './pinyin'

describe('applyToneToSyllable', () => {
  it('applies tone to plain letters', () => {
    expect(applyToneToSyllable('ma', 1)).toBe('mā')
    expect(applyToneToSyllable('ma', 2)).toBe('má')
    expect(applyToneToSyllable('ma', 3)).toBe('mǎ')
    expect(applyToneToSyllable('ma', 4)).toBe('mà')
  })

  it('replaces an existing tone mark when a new tone digit is provided', () => {
    expect(applyToneToSyllable('mā', 2)).toBe('má')
    expect(applyToneToSyllable('nǐ', 2)).toBe('ní')
  })

  it('strips tone 5 to neutral syllable', () => {
    expect(applyToneToSyllable('ma', 5)).toBe('ma')
  })
})

describe('convertToneNumbers', () => {
  it('converts basic tone-number input and removes digits from output', () => {
    expect(convertToneNumbers('ni3')).toBe('nǐ')
    expect(convertToneNumbers('hao3')).toBe('hǎo')
    expect(convertToneNumbers('ni3 hao3')).toBe('nǐ hǎo')
    expect(convertToneNumbers('ni3hao3')).toBe('nǐhǎo')
  })

  it('tones each syllable in multi-syllable words without spaces', () => {
    expect(convertToneNumbers('han2guo2')).toBe('hánguó')
    expect(convertToneNumbers('zhong1wen2')).toBe('zhōngwén')
  })

  it('replaces the previous tone when multiple digits are typed in one syllable', () => {
    expect(convertToneNumbers('a12')).toBe('á')
    expect(convertToneNumbers('ni132')).toBe('ní')
    expect(convertToneNumbers('ma14')).toBe('mà')
  })

  it('does not move tone to a later syllable when typing the next digit', () => {
    expect(convertToneNumbers('ni13hao3')).toBe('nǐhǎo')
    expect(convertToneNumbers('nǐhao3')).toBe('nǐhǎo')
  })

  it('changes tone on an already converted syllable when a new digit is typed', () => {
    expect(convertToneNumbers('ā2')).toBe('á')
    expect(convertToneNumbers('nǐ2')).toBe('ní')
    expect(convertToneNumbers('nǐ hao3')).toBe('nǐ hǎo')
  })

  it('maps v to ü before applying tone', () => {
    expect(convertToneNumbers('nv3')).toBe('nǚ')
    expect(convertToneNumbers('lv4')).toBe('lǜ')
  })

  it('leaves tokens without tone digits unchanged', () => {
    expect(convertToneNumbers('nǐ')).toBe('nǐ')
    expect(convertToneNumbers('hello')).toBe('hello')
  })

  it('never keeps raw tone digits in the converted output', () => {
    expect(convertToneNumbers('a1')).toBe('ā')
    expect(convertToneNumbers('a12')).toBe('á')
    expect(convertToneNumbers('a21')).toBe('ā')
    expect(convertToneNumbers('han2')).toBe('hán')
  })
})

describe('toPlainSyllable', () => {
  it('removes tone marks but keeps ü', () => {
    expect(toPlainSyllable('nǐ')).toBe('ni')
    expect(toPlainSyllable('lǚ')).toBe('lü')
  })
})

describe('pinyinMatches', () => {
  it('matches tone-number and toned variants', () => {
    expect(pinyinMatches('ni3', 'nǐ')).toBe(true)
    expect(pinyinMatches('nǐ2', 'ní')).toBe(true)
    expect(pinyinMatches('ma1', 'mā')).toBe(true)
    expect(pinyinMatches('han2guo2', 'hánguó')).toBe(true)
  })

  it('rejects missing or wrong tones when expected pinyin has tone marks', () => {
    expect(pinyinMatches('ni', 'nǐ')).toBe(false)
    expect(pinyinMatches('ni hao', 'nǐ hǎo')).toBe(false)
    expect(pinyinMatches('má', 'mā')).toBe(false)
    expect(pinyinMatches('hang guo', 'hánguó')).toBe(false)
  })

  it('still matches when expected pinyin has no tone marks', () => {
    expect(pinyinMatches('ni', 'ni')).toBe(true)
    expect(pinyinMatches('nǐ', 'ni')).toBe(true)
  })

  it('normalizes spacing and case', () => {
    expect(normalizePinyin('  Ni3 HAO3 ')).toBe('ni hao')
    expect(normalizePinyinWithTones('  Ni3 HAO3 ')).toBe('nǐ hǎo')
  })
})
