import { pinyinMatches } from '../lib/pinyin'
import type { Word } from '../models/types'

export type WordField = 'hanzi' | 'pinyin' | 'meaning'

export type QuizDirectionId =
  | 'hanzi-to-pinyin'
  | 'pinyin-to-hanzi'
  | 'hanzi-to-vn'
  | 'pinyin-to-vn'

export type QuizDirection = {
  id: QuizDirectionId
  label: string
  description: string
  promptField: WordField
  answerField: WordField
  answerLabel: string
  inputLang?: string
  checkAnswer: (word: Word, userAnswer: string) => boolean
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function meaningMatches(userAnswer: string, expected: string): boolean {
  const normalizedAnswer = normalizeText(userAnswer)
  return expected
    .split(/[/,]/)
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .some((part) => part === normalizedAnswer)
}

export const QUIZ_DIRECTIONS: QuizDirection[] = [
  {
    id: 'hanzi-to-pinyin',
    label: '汉字 → pīnyīn',
    description: 'Nhìn chữ Hán, gõ pinyin',
    promptField: 'hanzi',
    answerField: 'pinyin',
    answerLabel: 'Nhập pinyin',
    checkAnswer: (word, answer) => pinyinMatches(answer, word.pinyin),
  },
  {
    id: 'pinyin-to-hanzi',
    label: 'pīnyīn → 汉字',
    description: 'Nhìn pinyin, gõ chữ Hán',
    promptField: 'pinyin',
    answerField: 'hanzi',
    answerLabel: 'Nhập hán tự',
    inputLang: 'zh',
    checkAnswer: (word, answer) => normalizeText(answer) === normalizeText(word.hanzi),
  },
  {
    id: 'hanzi-to-vn',
    label: '汉字 → Tiếng Việt',
    description: 'Nhìn chữ Hán, gõ nghĩa',
    promptField: 'hanzi',
    answerField: 'meaning',
    answerLabel: 'Nhập nghĩa tiếng Việt',
    checkAnswer: (word, answer) => meaningMatches(answer, word.meaning),
  },
  {
    id: 'pinyin-to-vn',
    label: 'pīnyīn → Tiếng Việt',
    description: 'Nhìn pinyin, gõ nghĩa',
    promptField: 'pinyin',
    answerField: 'meaning',
    answerLabel: 'Nhập nghĩa tiếng Việt',
    checkAnswer: (word, answer) => meaningMatches(answer, word.meaning),
  },
]

export function getDirection(id: QuizDirectionId): QuizDirection {
  const direction = QUIZ_DIRECTIONS.find((item) => item.id === id)
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
