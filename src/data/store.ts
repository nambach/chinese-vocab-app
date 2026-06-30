import {
  defaultAppState,
  defaultSettings,
  SCHEMA_VERSION,
  STORAGE_KEY,
  type AppState,
  type Catalog,
  type PracticeResult,
  type Settings,
  type Word,
} from '../models/types'

function migrate(state: AppState): AppState {
  if (state.version === SCHEMA_VERSION) {
    return state
  }

  // Future migrations go here.
  return { ...state, version: SCHEMA_VERSION }
}

function parseStored(raw: string | null): AppState {
  if (!raw) {
    return defaultAppState()
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>
    const state: AppState = {
      version: parsed.version ?? SCHEMA_VERSION,
      catalogs: Array.isArray(parsed.catalogs) ? parsed.catalogs : [],
      settings: {
        ...defaultSettings(),
        ...(parsed.settings ?? {}),
      },
    }
    return migrate(state)
  } catch {
    return defaultAppState()
  }
}

export function loadState(): AppState {
  if (typeof localStorage === 'undefined') {
    return defaultAppState()
  }
  return parseStored(localStorage.getItem(STORAGE_KEY))
}

export function saveState(state: AppState): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function createId(): string {
  return crypto.randomUUID()
}

export function createCatalog(name: string): Catalog {
  const now = Date.now()
  return {
    id: createId(),
    name: name.trim(),
    words: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createWord(input: Omit<Word, 'id'>): Word {
  return {
    id: createId(),
    hanzi: input.hanzi.trim(),
    pinyin: input.pinyin.trim(),
    meaning: input.meaning.trim(),
  }
}

export function updateSettings(
  state: AppState,
  patch: Partial<Settings>,
): AppState {
  return {
    ...state,
    settings: { ...state.settings, ...patch },
  }
}

export function upsertCatalog(
  state: AppState,
  catalog: Catalog,
): AppState {
  const exists = state.catalogs.some((item) => item.id === catalog.id)
  const catalogs = exists
    ? state.catalogs.map((item) => (item.id === catalog.id ? catalog : item))
    : [...state.catalogs, catalog]

  return { ...state, catalogs }
}

export function deleteCatalog(state: AppState, catalogId: string): AppState {
  return {
    ...state,
    catalogs: state.catalogs.filter((catalog) => catalog.id !== catalogId),
  }
}

export function getCatalog(
  state: AppState,
  catalogId: string,
): Catalog | undefined {
  return state.catalogs.find((catalog) => catalog.id === catalogId)
}

export function addWordToCatalog(
  state: AppState,
  catalogId: string,
  input: Omit<Word, 'id'>,
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  const updated: Catalog = {
    ...catalog,
    words: [...catalog.words, createWord(input)],
    updatedAt: Date.now(),
  }
  return upsertCatalog(state, updated)
}

export function updateWordInCatalog(
  state: AppState,
  catalogId: string,
  word: Word,
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  const updated: Catalog = {
    ...catalog,
    words: catalog.words.map((item) => (item.id === word.id ? word : item)),
    updatedAt: Date.now(),
  }
  return upsertCatalog(state, updated)
}

export function deleteWordFromCatalog(
  state: AppState,
  catalogId: string,
  wordId: string,
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  const updated: Catalog = {
    ...catalog,
    words: catalog.words.filter((word) => word.id !== wordId),
    updatedAt: Date.now(),
  }
  return upsertCatalog(state, updated)
}

export function reorderWordsInCatalog(
  state: AppState,
  catalogId: string,
  wordIds: string[],
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  const byId = new Map(catalog.words.map((word) => [word.id, word]))
  const reordered = wordIds
    .map((id) => byId.get(id))
    .filter((word): word is Word => Boolean(word))

  if (reordered.length !== catalog.words.length) {
    return state
  }

  const updated: Catalog = {
    ...catalog,
    words: reordered,
    updatedAt: Date.now(),
  }
  return upsertCatalog(state, updated)
}

export function setCatalogLastResult(
  state: AppState,
  catalogId: string,
  result: PracticeResult,
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  return upsertCatalog(state, { ...catalog, lastResult: result })
}

export function moveWordInCatalog(
  state: AppState,
  catalogId: string,
  wordId: string,
  direction: 'up' | 'down',
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  const index = catalog.words.findIndex((word) => word.id === wordId)
  if (index < 0) return state

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= catalog.words.length) {
    return state
  }

  const words = [...catalog.words]
  ;[words[index], words[targetIndex]] = [words[targetIndex], words[index]]

  return upsertCatalog(state, {
    ...catalog,
    words,
    updatedAt: Date.now(),
  })
}
