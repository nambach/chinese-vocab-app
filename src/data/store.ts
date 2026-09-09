import {
  defaultAppState,
  defaultSettings,
  CB2_FOLDER_ID,
  CB2_FOLDER_NAME,
  DEFAULT_BUILTIN_FOLDER_ID,
  DEFAULT_BUILTIN_FOLDER_NAME,
  folderIdForBuiltinLesson,
  SCHEMA_VERSION,
  STORAGE_KEY,
  type AppState,
  type Catalog,
  type Folder,
  type PracticeResult,
  type Settings,
  type Word,
} from '../models/types'

const MAX_PRACTICE_HISTORY = 50

function normalizePracticeResult(result: PracticeResult): PracticeResult {
  return {
    ...result,
    id: result.id || createId(),
  }
}

function normalizeCatalog(catalog: Catalog): Catalog {
  const history =
    catalog.practiceHistory?.map(normalizePracticeResult) ??
    (catalog.lastResult ? [normalizePracticeResult(catalog.lastResult)] : [])
  const lastResult = history[0] ?? catalog.lastResult
  return { ...catalog, practiceHistory: history, lastResult }
}

function migrateV1toV2(state: AppState): AppState {
  const hasBuiltinLessons = state.catalogs.some((catalog) => catalog.builtinId)
  let folders = state.folders ?? []

  if (hasBuiltinLessons && !folders.some((folder) => folder.id === DEFAULT_BUILTIN_FOLDER_ID)) {
    const now = Date.now()
    folders = [
      ...folders,
      {
        id: DEFAULT_BUILTIN_FOLDER_ID,
        name: DEFAULT_BUILTIN_FOLDER_NAME,
        createdAt: now,
        updatedAt: now,
      },
    ]
  }

  const catalogs = state.catalogs.map((catalog) => {
    if (catalog.builtinId && !catalog.folderId) {
      return { ...catalog, folderId: DEFAULT_BUILTIN_FOLDER_ID }
    }
    return catalog
  })

  return {
    ...state,
    version: 2,
    folders,
    catalogs: catalogs.map(normalizeCatalog),
  }
}

function migrateV2toV3(state: AppState): AppState {
  let folders = state.folders.map((folder) => {
    if (folder.id === DEFAULT_BUILTIN_FOLDER_ID && folder.name === 'Bài học mẫu') {
      return { ...folder, name: DEFAULT_BUILTIN_FOLDER_NAME, updatedAt: Date.now() }
    }
    return folder
  })

  const needsCb2Folder = state.catalogs.some(
    (catalog) => catalog.builtinId && folderIdForBuiltinLesson(catalog.builtinId) === CB2_FOLDER_ID,
  )

  if (needsCb2Folder && !folders.some((folder) => folder.id === CB2_FOLDER_ID)) {
    const now = Date.now()
    folders = [
      ...folders,
      {
        id: CB2_FOLDER_ID,
        name: CB2_FOLDER_NAME,
        createdAt: now,
        updatedAt: now,
      },
    ]
  }

  const catalogs = state.catalogs.map((catalog) => {
    if (!catalog.builtinId) {
      return catalog
    }

    const targetFolderId = folderIdForBuiltinLesson(catalog.builtinId)
    if (catalog.folderId === targetFolderId) {
      return catalog
    }

    return { ...catalog, folderId: targetFolderId }
  })

  return {
    ...state,
    version: 3,
    folders,
    catalogs: catalogs.map(normalizeCatalog),
  }
}

function migrate(state: AppState): AppState {
  let current: AppState = {
    ...state,
    folders: state.folders ?? [],
  }

  if (current.version < 2) {
    current = migrateV1toV2(current)
  }

  if (current.version < 3) {
    current = migrateV2toV3(current)
  }

  if (current.version === SCHEMA_VERSION) {
    return {
      ...current,
      catalogs: current.catalogs.map(normalizeCatalog),
    }
  }

  return {
    ...current,
    version: SCHEMA_VERSION,
    catalogs: current.catalogs.map(normalizeCatalog),
  }
}

function parseStored(raw: string | null): AppState {
  if (!raw) {
    return defaultAppState()
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>
    const state: AppState = {
      version: parsed.version ?? 1,
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      catalogs: Array.isArray(parsed.catalogs) ? parsed.catalogs : [],
      settings: {
        ...defaultSettings(),
        ...(parsed.settings ?? {}),
        practiceConfig: {
          ...defaultSettings().practiceConfig,
          ...(parsed.settings?.practiceConfig ?? {}),
        },
        expandedFolderIds: Array.isArray(parsed.settings?.expandedFolderIds)
          ? parsed.settings.expandedFolderIds
          : defaultSettings().expandedFolderIds,
      },
      seededVersion: parsed.seededVersion,
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

export function createCatalog(name: string, folderId?: string): Catalog {
  const now = Date.now()
  return {
    id: createId(),
    name: name.trim(),
    words: [],
    createdAt: now,
    updatedAt: now,
    ...(folderId ? { folderId } : {}),
  }
}

export function createFolder(name: string): Folder {
  const now = Date.now()
  return {
    id: createId(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
  }
}

export function ensureFolder(state: AppState, folderId: string, folderName: string): AppState {
  if (state.folders.some((folder) => folder.id === folderId)) {
    return state
  }

  const now = Date.now()
  return {
    ...state,
    folders: [
      ...state.folders,
      {
        id: folderId,
        name: folderName,
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

export function ensureBuiltinFolder(state: AppState): AppState {
  return ensureFolder(state, DEFAULT_BUILTIN_FOLDER_ID, DEFAULT_BUILTIN_FOLDER_NAME)
}

export function ensureCb2Folder(state: AppState): AppState {
  return ensureFolder(state, CB2_FOLDER_ID, CB2_FOLDER_NAME)
}

export function upsertFolder(state: AppState, folder: Folder): AppState {
  const exists = state.folders.some((item) => item.id === folder.id)
  const folders = exists
    ? state.folders.map((item) => (item.id === folder.id ? folder : item))
    : [...state.folders, folder]

  return { ...state, folders }
}

export function renameFolder(state: AppState, folderId: string, name: string): AppState {
  const trimmed = name.trim()
  if (!trimmed) return state

  return {
    ...state,
    folders: state.folders.map((folder) =>
      folder.id === folderId ? { ...folder, name: trimmed, updatedAt: Date.now() } : folder,
    ),
  }
}

export function deleteFolder(state: AppState, folderId: string): AppState {
  return {
    ...state,
    folders: state.folders.filter((folder) => folder.id !== folderId),
    catalogs: state.catalogs.map((catalog) =>
      catalog.folderId === folderId ? { ...catalog, folderId: undefined } : catalog,
    ),
    settings: {
      ...state.settings,
      expandedFolderIds: state.settings.expandedFolderIds.filter((id) => id !== folderId),
    },
  }
}

export function setCatalogPinned(
  state: AppState,
  catalogId: string,
  pinned: boolean,
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  if (pinned) {
    if (catalog.pinnedAt) return state
    return upsertCatalog(state, { ...catalog, pinnedAt: Date.now() })
  }

  if (!catalog.pinnedAt) return state
  const { pinnedAt: _removed, ...rest } = catalog
  return upsertCatalog(state, rest)
}

export function isCatalogPinned(catalog: Catalog): boolean {
  return Boolean(catalog.pinnedAt)
}

export function moveCatalogToFolder(
  state: AppState,
  catalogId: string,
  folderId: string | undefined,
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state
  if (folderId && !state.folders.some((folder) => folder.id === folderId)) {
    return state
  }

  return upsertCatalog(state, {
    ...catalog,
    folderId,
    updatedAt: Date.now(),
  })
}

export function createWord(input: Omit<Word, 'id'>): Word {
  const note = input.note?.trim()
  return {
    id: createId(),
    hanzi: input.hanzi.trim(),
    pinyin: input.pinyin.trim(),
    meaning: input.meaning.trim(),
    ...(note ? { note } : {}),
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
  result: Omit<PracticeResult, 'id'>,
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  const entry = normalizePracticeResult({ ...result, id: createId() })
  const history = [entry, ...(catalog.practiceHistory ?? [])].slice(0, MAX_PRACTICE_HISTORY)

  return upsertCatalog(state, { ...catalog, lastResult: entry, practiceHistory: history })
}

export function getPracticeHistory(catalog: Catalog): PracticeResult[] {
  return catalog.practiceHistory ?? (catalog.lastResult ? [catalog.lastResult] : [])
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
