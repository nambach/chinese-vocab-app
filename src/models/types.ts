import type { PracticeConfig } from '../practice/session'
import { defaultPracticeConfig } from '../practice/session'
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
  id: string
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
  practiceHistory?: PracticeResult[]
}

export type Settings = {
  toneNumberInput: boolean
  practiceConfig: PracticeConfig
}

export type AppState = {
  version: number
  catalogs: Catalog[]
  settings: Settings
}

export const defaultSettings = (): Settings => ({
  toneNumberInput: true,
  practiceConfig: defaultPracticeConfig(),
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
  | { name: 'combinePractice' }
  | { name: 'createCollection' }
  | { name: 'catalog'; catalogId: string }
  | { name: 'practiceHistory'; catalogId: string }
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

export type CombineQueue = {
  catalogIds: string[]
  index: number
}

export type QuickSuite = {
  title: string
  words: Word[]
  source?: 'quick' | 'combine'
  combineQueue?: CombineQueue
}

export type PracticeSetupDraft = PracticeConfig
