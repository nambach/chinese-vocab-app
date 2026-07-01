const TONE_MAP: Record<string, [string, string, string, string]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
  v: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

const VOWELS = ['a', 'e', 'o', 'i', 'u', 'ü', 'v'] as const
const SYLLABLE_LETTER = /^[a-zA-Z\u00C0-\u024FüÜ]$/
const TONE_DIGIT = /^[1-5]$/

const TONED_U_LOWER = /[ǖǘǚǜ]/g
const TONED_U_UPPER = /[ǕǗǙǛ]/g
const U_PLACEHOLDER = '\uE000'
const U_PLACEHOLDER_UPPER = '\uE001'

function normalizeVowel(char: string): string {
  return char === 'ü' ? 'ü' : char
}

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '')
}

/** Plain syllable letters for tone placement (keeps ü, unlike stripToneMarks). */
export function toPlainSyllable(input: string): string {
  const withPlainU = input
    .replace(TONED_U_LOWER, 'ü')
    .replace(TONED_U_UPPER, 'Ü')
    .replace(/ü/g, U_PLACEHOLDER)
    .replace(/Ü/g, U_PLACEHOLDER_UPPER)

  const stripped = stripDiacritics(withPlainU)

  return stripped
    .replaceAll(U_PLACEHOLDER, 'ü')
    .replaceAll(U_PLACEHOLDER_UPPER, 'Ü')
}

function isSyllableLetter(char: string): boolean {
  return SYLLABLE_LETTER.test(char)
}

function hasToneMark(char: string): boolean {
  return toPlainSyllable(char) !== char
}

function resolveSyllableStart(output: string, syllableStart: number): number {
  if (output.slice(syllableStart).length > 0) {
    return syllableStart
  }

  let index = output.length - 1
  while (index >= 0 && isSyllableLetter(output[index])) {
    if (hasToneMark(output[index])) {
      let start = index
      while (start > 0 && isSyllableLetter(output[start - 1]) && !hasToneMark(output[start - 1])) {
        start -= 1
      }
      return start
    }
    index -= 1
  }

  return syllableStart
}

function findToneVowelIndex(syllable: string): number {
  const lower = syllable.toLowerCase()
  const aIndex = lower.indexOf('a')
  if (aIndex >= 0) return aIndex

  const eIndex = lower.indexOf('e')
  if (eIndex >= 0) return eIndex

  const ouIndex = lower.indexOf('ou')
  if (ouIndex >= 0) return ouIndex

  for (let i = lower.length - 1; i >= 0; i -= 1) {
    const char = lower[i]
    if (VOWELS.includes(char as (typeof VOWELS)[number])) {
      return i
    }
  }

  return -1
}

export function applyToneToSyllable(syllable: string, tone: number): string {
  const base = toPlainSyllable(syllable)

  if (!base || tone === 0 || tone === 5) {
    return base
  }

  const index = findToneVowelIndex(base)
  if (index < 0 || tone < 1 || tone > 4) {
    return base
  }

  const originalChar = base[index]
  const lowerChar = originalChar.toLowerCase()
  const mapped = TONE_MAP[normalizeVowel(lowerChar)]?.[tone - 1]
  if (!mapped) return base

  const replacement =
    originalChar === originalChar.toUpperCase()
      ? mapped.toUpperCase()
      : mapped

  return base.slice(0, index) + replacement + base.slice(index + 1)
}

/**
 * Walk the input left-to-right. Each tone digit applies to the syllable letters
 * immediately before it, then the digit is removed from the output.
 */
export function convertToneNumbers(input: string): string {
  const source = input.replace(/v/g, 'ü').replace(/V/g, 'Ü')
  let output = ''
  let syllableStart = 0

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (TONE_DIGIT.test(char)) {
      const start = resolveSyllableStart(output, syllableStart)
      const syllable = output.slice(start)
      const toned = applyToneToSyllable(syllable, Number(char))
      output = output.slice(0, start) + toned
      syllableStart = output.length
      continue
    }

    if (/\s/.test(char)) {
      output += char
      syllableStart = output.length
      continue
    }

    output += char
    if (hasToneMark(char)) {
      syllableStart = output.length
    }
  }

  return output
}

export function stripToneMarks(input: string): string {
  const decomposed = input.normalize('NFD')
  return decomposed.replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'v')
}

export function normalizePinyin(input: string): string {
  return stripToneMarks(convertToneNumbers(input.trim()))
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function normalizePinyinWithTones(input: string): string {
  return convertToneNumbers(input.trim()).toLowerCase().replace(/\s+/g, ' ')
}

function expectedHasToneMarks(expected: string): boolean {
  const converted = convertToneNumbers(expected.trim()).toLowerCase()
  return stripToneMarks(converted) !== converted
}

export function pinyinMatches(userInput: string, expected: string): boolean {
  const userPlain = normalizePinyin(userInput)
  const expectedPlain = normalizePinyin(expected)

  if (userPlain !== expectedPlain) {
    return false
  }

  if (expectedHasToneMarks(expected)) {
    return normalizePinyinWithTones(userInput) === normalizePinyinWithTones(expected)
  }

  return true
}
