import { describe, expect, it } from 'vitest'
import {
  acknowledgePack,
  buildCatalogFromLesson,
  pendingLessons,
  restoreMissing,
  seedLessons,
} from './seed'
import { LESSON_PACK, LESSON_PACK_VERSION, type BuiltinLesson } from './lessons'
import type { AppState, Catalog } from '../models/types'
import { defaultSettings } from '../models/types'

const PACK_V1: BuiltinLesson[] = [
  { id: 'l1', order: 1, introducedIn: 1, text: '# One\n你 | nǐ | you' },
  { id: 'l2', order: 2, introducedIn: 1, text: '# Two\n好 | hǎo | good' },
]

const PACK_V2: BuiltinLesson[] = [
  ...PACK_V1,
  { id: 'l3', order: 3, introducedIn: 2, text: '# Three\n大 | dà | big' },
]

function makeState(catalogs: Catalog[] = [], seededVersion?: number): AppState {
  return { version: 1, catalogs, settings: defaultSettings(), seededVersion }
}

const ids = (lessons: BuiltinLesson[]) => lessons.map((l) => l.id)
const builtinIds = (state: AppState) =>
  state.catalogs.map((c) => c.builtinId).filter(Boolean)

describe('builtin lesson seeding', () => {
  it('offers all lessons on a fresh install', () => {
    expect(ids(pendingLessons(makeState(), PACK_V1))).toEqual(['l1', 'l2'])
  })

  it('seeds lessons and stamps the pack version', () => {
    const seeded = seedLessons(makeState(), PACK_V1, 1)
    expect(seeded.seededVersion).toBe(1)
    expect(builtinIds(seeded)).toEqual(['l1', 'l2'])
    expect(seeded.catalogs[0].words.length).toBe(1)
  })

  it('is a no-op once everything at the current version is present', () => {
    const seeded = seedLessons(makeState(), PACK_V1, 1)
    expect(pendingLessons(seeded, PACK_V1)).toEqual([])
  })

  it('offers only newly introduced lessons after a version bump', () => {
    const seeded = seedLessons(makeState(), PACK_V1, 1)
    expect(ids(pendingLessons(seeded, PACK_V2))).toEqual(['l3'])
  })

  it('does not re-add a lesson the user deleted at the current version', () => {
    // seeded v1, then user deleted l2 (builtinId gone), version still stamped 1
    const state = makeState(
      [seedLessons(makeState(), PACK_V1, 1).catalogs[0]],
      1,
    )
    expect(pendingLessons(state, PACK_V1)).toEqual([])
  })

  it('leaves user-edited lessons untouched (no duplicates)', () => {
    const seeded = seedLessons(makeState(), PACK_V1, 1)
    seeded.catalogs[0].words[0].meaning = 'edited'
    const after = seedLessons(seeded, pendingLessons(seeded, PACK_V1), 1)
    expect(builtinIds(after)).toEqual(['l1', 'l2'])
    expect(after.catalogs[0].words[0].meaning).toBe('edited')
  })

  it('acknowledgePack marks the version without seeding', () => {
    const state = acknowledgePack(makeState(), 1)
    expect(state.seededVersion).toBe(1)
    expect(state.catalogs).toEqual([])
  })

  it('restoreMissing re-adds deleted lessons regardless of version gate', () => {
    const declined = acknowledgePack(makeState(), 1)
    const restored = restoreMissing(declined, PACK_V1, 1)
    expect(builtinIds(restored)).toEqual(['l1', 'l2'])
  })
})

describe('bundled lesson pack', () => {
  it('ships 15 lessons with unique ids and valid versions', () => {
    expect(LESSON_PACK).toHaveLength(15)
    const uniqueIds = new Set(LESSON_PACK.map((l) => l.id))
    expect(uniqueIds.size).toBe(15)
    for (const lesson of LESSON_PACK) {
      expect(lesson.introducedIn).toBeLessThanOrEqual(LESSON_PACK_VERSION)
    }
  })

  it('is sorted in natural lesson order (bai-01 … bai-15)', () => {
    const orders = LESSON_PACK.map((l) => l.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(LESSON_PACK[0].id).toBe('bai-01')
    expect(LESSON_PACK[14].id).toBe('bai-15')
  })

  it('every lesson parses into a named catalog with words', () => {
    for (const lesson of LESSON_PACK) {
      const catalog = buildCatalogFromLesson(lesson)
      expect(catalog.name).toBeTruthy()
      expect(catalog.words.length).toBeGreaterThan(0)
      expect(catalog.builtinId).toBe(lesson.id)
    }
  })
})
