import { beforeEach, describe, expect, it } from 'vitest'
import { loadState, saveState } from './store'
import {
  acceptPendingLessons,
  declineLessonPack,
  getPendingBuiltinLessons,
  restoreDefaultLessons,
} from './seed'
import { LESSON_PACK } from './lessons'
import {
  CB2_FOLDER_ID,
  CB2_FOLDER_NAME,
  DEFAULT_BUILTIN_FOLDER_ID,
  DEFAULT_BUILTIN_FOLDER_NAME,
  SCHEMA_VERSION,
  STORAGE_KEY,
  defaultAppState,
} from '../models/types'

function installLocalStorage() {
  const backing = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
    setItem: (key: string, value: string) => void backing.set(key, String(value)),
    removeItem: (key: string) => void backing.delete(key),
    clear: () => backing.clear(),
    key: () => null,
    length: 0,
  } as Storage
}

describe('persistence + seeding integration', () => {
  beforeEach(() => installLocalStorage())

  it('round-trips seededVersion and builtin catalog fields through localStorage', () => {
    const state = {
      ...defaultAppState(),
      seededVersion: 3,
      catalogs: [
        {
          id: 'c1',
          name: 'Bài 1',
          words: [{ id: 'w1', hanzi: '你', pinyin: 'nǐ', meaning: 'you' }],
          createdAt: 1,
          updatedAt: 1,
          builtinId: 'bai-01',
          seedHash: 'abc',
        },
      ],
    }
    saveState(state)
    const loaded = loadState()
    expect(loaded.seededVersion).toBe(3)
    expect(loaded.catalogs[0].builtinId).toBe('bai-01')
    expect(loaded.catalogs[0].seedHash).toBe('abc')
    expect(loaded.catalogs[0].words[0].hanzi).toBe('你')
  })

  it('accept → save → reload does not re-offer the pack', () => {
    const seeded = acceptPendingLessons(defaultAppState())
    saveState(seeded)
    const reloaded = loadState()
    expect(reloaded.catalogs).toHaveLength(LESSON_PACK.length)
    expect(getPendingBuiltinLessons(reloaded)).toEqual([])
  })

  it('decline → save → reload keeps zero catalogs and does not re-offer', () => {
    const declined = declineLessonPack(defaultAppState())
    saveState(declined)
    const reloaded = loadState()
    expect(reloaded.catalogs).toEqual([])
    expect(getPendingBuiltinLessons(reloaded)).toEqual([])
  })

  it('a deleted seeded lesson is not re-offered, but Restore brings it back', () => {
    const seeded = acceptPendingLessons(defaultAppState())
    const withoutFirst = {
      ...seeded,
      catalogs: seeded.catalogs.filter((c) => c.builtinId !== 'bai-01'),
    }
    saveState(withoutFirst)
    const reloaded = loadState()
    expect(getPendingBuiltinLessons(reloaded)).toEqual([])

    const restored = restoreDefaultLessons(reloaded)
    expect(restored.catalogs.some((c) => c.builtinId === 'bai-01')).toBe(true)
  })

  it('migrates v1 builtin catalogs into the default folder on reload', () => {
    const v1State = {
      version: 1,
      catalogs: LESSON_PACK.map((lesson, index) => ({
        id: `c-${index}`,
        name: `Bài ${index + 1}`,
        words: [{ id: `w-${index}`, hanzi: '你', pinyin: 'nǐ', meaning: 'you' }],
        createdAt: 1,
        updatedAt: 1,
        builtinId: lesson.id,
      })),
      settings: defaultAppState().settings,
      seededVersion: 1,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1State))
    const loaded = loadState()

    expect(loaded.version).toBe(SCHEMA_VERSION)
    expect(loaded.folders).toHaveLength(2)
    expect(loaded.folders.some((folder) => folder.id === DEFAULT_BUILTIN_FOLDER_ID)).toBe(true)
    expect(loaded.folders.some((folder) => folder.id === CB2_FOLDER_ID)).toBe(true)
    expect(loaded.folders.find((folder) => folder.id === DEFAULT_BUILTIN_FOLDER_ID)?.name).toBe(
      DEFAULT_BUILTIN_FOLDER_NAME,
    )
    expect(loaded.catalogs).toHaveLength(LESSON_PACK.length)
    const cb2Ids = ['bai-16', 'bai-17']
    expect(
      loaded.catalogs
        .filter((catalog) => !cb2Ids.includes(catalog.builtinId ?? ''))
        .every((catalog) => catalog.folderId === DEFAULT_BUILTIN_FOLDER_ID),
    ).toBe(true)
    expect(
      loaded.catalogs
        .filter((catalog) => cb2Ids.includes(catalog.builtinId ?? ''))
        .every((catalog) => catalog.folderId === CB2_FOLDER_ID),
    ).toBe(true)
  })

  it('renames the legacy builtin folder to Căn bản 1 on v3 migration', () => {
    const v2State = {
      version: 2,
      folders: [
        {
          id: DEFAULT_BUILTIN_FOLDER_ID,
          name: 'Bài học mẫu',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      catalogs: [
        {
          id: 'c1',
          name: 'Bài 1',
          words: [{ id: 'w1', hanzi: '你', pinyin: 'nǐ', meaning: 'you' }],
          createdAt: 1,
          updatedAt: 1,
          builtinId: 'bai-01',
          folderId: DEFAULT_BUILTIN_FOLDER_ID,
        },
      ],
      settings: defaultAppState().settings,
      seededVersion: 1,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2State))
    const loaded = loadState()

    expect(loaded.version).toBe(SCHEMA_VERSION)
    expect(loaded.folders[0].name).toBe(DEFAULT_BUILTIN_FOLDER_NAME)
  })

  it('creates Căn bản 2 and moves bai-16 on v3 migration', () => {
    const v2State = {
      version: 2,
      folders: [
        {
          id: DEFAULT_BUILTIN_FOLDER_ID,
          name: 'Bài học mẫu',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      catalogs: [
        {
          id: 'c16',
          name: 'Bài 16',
          words: [{ id: 'w16', hanzi: '现在', pinyin: 'xiànzài', meaning: 'now' }],
          createdAt: 1,
          updatedAt: 1,
          builtinId: 'bai-16',
          folderId: DEFAULT_BUILTIN_FOLDER_ID,
        },
      ],
      settings: defaultAppState().settings,
      seededVersion: 2,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2State))
    const loaded = loadState()

    expect(loaded.folders.some((folder) => folder.id === CB2_FOLDER_ID)).toBe(true)
    expect(loaded.folders.find((folder) => folder.id === CB2_FOLDER_ID)?.name).toBe(CB2_FOLDER_NAME)
    expect(loaded.catalogs[0].folderId).toBe(CB2_FOLDER_ID)
  })

  it('migration is idempotent after save and reload', () => {
    const seeded = acceptPendingLessons(defaultAppState())
    saveState(seeded)
    const first = loadState()
    saveState(first)
    const second = loadState()

    expect(second.folders).toEqual(first.folders)
    expect(second.catalogs.map((catalog) => catalog.folderId)).toEqual(
      first.catalogs.map((catalog) => catalog.folderId),
    )
  })
})
