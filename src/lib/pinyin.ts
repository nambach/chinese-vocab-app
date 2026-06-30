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

function normalizeVowel(char: string): string {
  return char === 'ü' ? 'ü' : char
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
  const match = syllable.match(/^([^0-9]*?)([1-5])?$/i)
  if (!match) return syllable

  const base = match[1]
  const toneDigit = tone || Number(match[2] ?? 0)
  if (!base || toneDigit === 0 || toneDigit === 5) {
    return base
  }

  const index = findToneVowelIndex(base)
  if (index < 0 || toneDigit < 1 || toneDigit > 4) {
    return base
  }

  const originalChar = base[index]
  const lowerChar = originalChar.toLowerCase()
  const mapped = TONE_MAP[normalizeVowel(lowerChar)]?.[toneDigit - 1]
  if (!mapped) return base

  const replacement =
    originalChar === originalChar.toUpperCase()
      ? mapped.toUpperCase()
      : mapped

  return base.slice(0, index) + replacement + base.slice(index + 1)
}

export function convertToneNumbers(input: string): string {
  // "v" is not used in pinyin, so treat it as the conventional way to type "ü".
  const withUmlaut = input.replace(/v/g, 'ü').replace(/V/g, 'Ü')

  // Replace only "<letters><tone-digit>" sequences, leaving spaces and other
  // characters untouched so the user can type multi-syllable pinyin with spaces.
  return withUmlaut.replace(/([a-zA-ZüÜ]+)([1-5])/g, (_match, letters: string, digit: string) =>
    applyToneToSyllable(letters + digit, 0),
  )
}

export function stripToneMarks(input: string): string {
  const decomposed = input.normalize('NFD')
  return decomposed.replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'v')
}

export function normalizePinyin(input: string): string {
  const converted = convertToneNumbers(input.trim())
  return stripToneMarks(converted).toLowerCase().replace(/\s+/g, ' ')
}

export function pinyinMatches(userInput: string, expected: string): boolean {
  return normalizePinyin(userInput) === normalizePinyin(expected)
}
