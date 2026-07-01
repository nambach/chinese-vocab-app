import { pinyinMatches } from '../lib/pinyin'
import type { Word } from '../models/types'

export type WordField = 'hanzi' | 'pinyin' | 'meaning'

export type QuizDirectionId = 'hanzi-to-pinyin' | 'hanzi-to-vn' | 'vn-to-hanzi'

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

function splitMeanings(value: string): string[] {
  return value
    .split(/[/,|]/)
    .map((part) => normalizeText(part))
    .filter(Boolean)
}

// Several accepted meanings, separated by "," when stored.
// The learner may answer with any subset — each meaning they enter must match
// one accepted option, but they do not need to enter every meaning.
function meaningMatches(userAnswer: string, expected: string): boolean {
  const accepted = new Set(splitMeanings(expected))
  const provided = splitMeanings(userAnswer)
  if (provided.length === 0) return false
  return provided.every((part) => accepted.has(part))
}

export const QUIZ_DIRECTIONS: QuizDirection[] = [
  {
    id: 'hanzi-to-pinyin',
    label: '汉字 → pīnyīn',
    promptField: 'hanzi',
    answerField: 'pinyin',
    answerLabel: 'Nhập pinyin',
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
