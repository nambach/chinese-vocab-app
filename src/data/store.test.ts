import { beforeEach, describe, expect, it } from 'vitest'
import { loadState, saveState } from './store'
import {
  acceptPendingLessons,
  declineLessonPack,
  getPendingBuiltinLessons,
  restoreDefaultLessons,
} from './seed'
import { LESSON_PACK } from './lessons'
import { defaultAppState } from '../models/types'

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
})
