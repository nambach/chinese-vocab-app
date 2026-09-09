import { pinyinMatches } from '../lib/pinyin'
import type { Word } from '../models/types'

export type WordField = 'hanzi' | 'pinyin' | 'meaning'

const WORD_FIELDS: WordField[] = ['hanzi', 'pinyin', 'meaning']

export const WORD_FIELD_LABELS: Record<WordField, string> = {
  hanzi: 'Hán tự',
  pinyin: 'Pinyin',
  meaning: 'Nghĩa',
}

export type QuizDirectionId =
  | 'hanzi-to-pinyin'
  | 'hanzi-to-vn'
  | 'vn-to-hanzi'
  | 'vn-to-pinyin'

export type QuizDirection = {
  id: QuizDirectionId
  label: string
  promptField: WordField
  answerField: WordField
  answerLabel: string
  inputLang?: string
  checkAnswer: (word: Word, userAnswer: string) => boolean
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

const MEANING_SEPARATORS = new Set(['/', ',', ';', '|'])

// Splits on separators only at paren depth 0, so a clarifier that contains a
// comma ("làm (+ nghề nghiệp, chức vụ)") stays one meaning instead of being
// torn into two unanswerable fragments.
function splitMeanings(value: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0

  for (const char of value) {
    if (char === '(') depth += 1
    else if (char === ')') depth = Math.max(0, depth - 1)

    if (depth === 0 && MEANING_SEPARATORS.has(char)) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)

  return parts.map((part) => normalizeText(part)).filter(Boolean)
}

/** Drops "(...)" clarifiers: "ra (hướng lại gần người nói)" -> "ra". */
function stripParentheticals(value: string): string {
  return value.replace(/\([^()]*\)/g, ' ')
}

// Meanings are stored separated by "/", ",", ";" or "|", and a meaning may
// carry a "(...)" clarifier that exists to disambiguate on screen rather than
// to be typed. Both spellings count: the literal one and the stripped one.
function acceptedMeanings(expected: string): Set<string> {
  return new Set([
    ...splitMeanings(expected),
    ...splitMeanings(stripParentheticals(expected)),
  ])
}

// The learner may answer with any subset — each meaning they enter must match
// one accepted option, but they do not need to enter every meaning.
function meaningMatches(userAnswer: string, expected: string): boolean {
  const accepted = acceptedMeanings(expected)
  const provided = splitMeanings(userAnswer)
  if (provided.length === 0) return false
  return provided.every(
    (part) =>
      accepted.has(part) || accepted.has(normalizeText(stripParentheticals(part))),
  )
}

export const QUIZ_DIRECTIONS: QuizDirection[] = [
  {
    id: 'hanzi-to-pinyin',
    label: '汉字 → pīnyīn',
    promptField: 'hanzi',
    answerField: 'pinyin',
    answerLabel: 'Nhập pinyin',
    inputLang: 'en',
    checkAnswer: (word, answer) => pinyinMatches(answer, word.pinyin),
  },
  {
    id: 'hanzi-to-vn',
    label: '汉字 → Tiếng Việt',
    promptField: 'hanzi',
    answerField: 'meaning',
    answerLabel: 'Nhập nghĩa tiếng Việt',
    checkAnswer: (word, answer) => meaningMatches(answer, word.meaning),
  },
  {
    id: 'vn-to-hanzi',
    label: 'Tiếng Việt → 汉字',
    promptField: 'meaning',
    answerField: 'hanzi',
    answerLabel: 'Nhập hán tự',
    inputLang: 'zh',
    checkAnswer: (word, answer) => normalizeText(answer) === normalizeText(word.hanzi),
  },
  {
    id: 'vn-to-pinyin',
    label: 'Tiếng Việt → pīnyīn',
    promptField: 'meaning',
    answerField: 'pinyin',
    answerLabel: 'Nhập pinyin',
    inputLang: 'en',
    checkAnswer: (word, answer) => pinyinMatches(answer, word.pinyin),
  },
]

export function findDirection(id: string): QuizDirection | undefined {
  return QUIZ_DIRECTIONS.find((item) => item.id === id)
}

export function getDirection(id: QuizDirectionId): QuizDirection {
  const direction = findDirection(id)
  if (!direction) {
    throw new Error(`Unknown direction: ${id}`)
  }
  return direction
}

export function getPromptText(word: Word, field: WordField): string {
  return word[field]
}

export function getAnswerText(word: Word, field: WordField): string {
  return word[field]
}

export function getSupplementaryFields(direction: QuizDirection): WordField[] {
  return WORD_FIELDS.filter(
    (field) => field !== direction.promptField && field !== direction.answerField,
  )
}
