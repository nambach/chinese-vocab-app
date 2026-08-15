import type { PracticeConfig } from '../practice/session'
import { defaultPracticeConfig } from '../practice/session'
import type { QuizDirectionId } from '../practice/directions'

export const STORAGE_KEY = 'cn-vocab:v1'
export const SCHEMA_VERSION = 3

/** Stable id for Căn bản 1 bundled lessons (bai-01 … bai-15). */
export const DEFAULT_BUILTIN_FOLDER_ID = 'builtin-lessons'
export const DEFAULT_BUILTIN_FOLDER_NAME = 'Căn bản 1'

/** Stable id for Căn bản 2 bundled lessons (bai-16+). */
export const CB2_FOLDER_ID = 'can-ban-2'
export const CB2_FOLDER_NAME = 'Căn bản 2'

export function folderIdForBuiltinLesson(lessonId: string): string {
  const match = lessonId.match(/(\d+)/)
  const num = match ? Number(match[1]) : 0
  return num >= 16 ? CB2_FOLDER_ID : DEFAULT_BUILTIN_FOLDER_ID
}

export type Word = {
  id: string
  hanzi: string
  pinyin: string
  meaning: string
  note?: string
}

export type PracticeResult = {
  id: string
  directionId: QuizDirectionId
  correct: number
  total: number
  durationMs: number
  finishedAt: number
}

export type Folder = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type Catalog = {
  id: string
  name: string
  words: Word[]
  createdAt: number
  updatedAt: number
  lastResult?: PracticeResult
  practiceHistory?: PracticeResult[]
  /** One-level group membership. Omitted when the catalog is ungrouped. */
  folderId?: string
  /** Set when this catalog originated from a bundled default lesson (e.g. "bai-01"). */
  builtinId?: string
  /** Content fingerprint at seed time. Reserved for a future "update unmodified lessons" flow. */
  seedHash?: string
}

export type HanziFontId = 'system' | 'kai' | 'kaiti' | 'mashan' | 'zhimang' | 'longcang'

export type Settings = {
  toneNumberInput: boolean
  practiceConfig: PracticeConfig
  /** Display font for Chinese characters. 'system' uses the device default. */
  hanziFont: HanziFontId
  /** Auto-play pronunciation when the study card changes. */
  autoPronounce: boolean
}

export type AppState = {
  version: number
  folders: Folder[]
  catalogs: Catalog[]
  settings: Settings
  /** Highest bundled lesson-pack version the user has already been offered (accepted or declined). */
  seededVersion?: number
}

export const defaultSettings = (): Settings => ({
  toneNumberInput: true,
  practiceConfig: defaultPracticeConfig(),
  hanziFont: 'system',
  autoPronounce: false,
})

export const defaultAppState = (): AppState => ({
  version: SCHEMA_VERSION,
  folders: [],
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
  | { name: 'study'; catalogId: string; wordIndex?: number }
  | { name: 'manageWords'; catalogId: string }
  | { name: 'editWord'; catalogId: string; wordId: string }
  | { name: 'practiceSetup'; catalogId?: string }
  | { name: 'practicePlay'; sessionId: string }
  | { name: 'results'; sessionId: string }

export type WordDraft = {
  hanzi: string
  pinyin: string
  meaning: string
  note?: string
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
