import type { PracticeConfig } from '../practice/session'
import type { QuizDirectionId } from '../practice/directions'

export const STORAGE_KEY = 'cn-vocab:v1'
export const SCHEMA_VERSION = 1

export type Word = {
  id: string
  hanzi: string
  pinyin: string
  meaning: string
}

export type PracticeResult = {
  directionId: QuizDirectionId
  correct: number
  total: number
  durationMs: number
  finishedAt: number
}

export type Catalog = {
  id: string
  name: string
  words: Word[]
  createdAt: number
  updatedAt: number
  lastResult?: PracticeResult
}

export type Settings = {
  toneNumberInput: boolean
}

export type AppState = {
  version: number
  catalogs: Catalog[]
  settings: Settings
}

export const defaultSettings = (): Settings => ({
  toneNumberInput: true,
})

export const defaultAppState = (): AppState => ({
  version: SCHEMA_VERSION,
  catalogs: [],
  settings: defaultSettings(),
})

export type View =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'quickPractice' }
  | { name: 'createCollection' }
  | { name: 'catalog'; catalogId: string }
  | { name: 'guidedAdd'; catalogId: string }
  | { name: 'manageWords'; catalogId: string }
  | { name: 'editWord'; catalogId: string; wordId: string }
  | { name: 'practiceSetup'; catalogId?: string }
  | { name: 'practicePlay'; sessionId: string }
  | { name: 'results'; sessionId: string }

export type WordDraft = {
  hanzi: string
  pinyin: string
  meaning: string
}

export type QuickSuite = {
  title: string
  words: Word[]
}

export type PracticeSetupDraft = PracticeConfig
