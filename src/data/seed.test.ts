import { describe, expect, it } from 'vitest'
import {
  acknowledgePack,
  applyLessonUpdates,
  buildCatalogFromLesson,
  dismissLessonUpdates,
  outdatedLessons,
  pendingLessons,
  restoreMissing,
  seedLessons,
} from './seed'
import { LESSON_PACK, LESSON_PACK_VERSION, type BuiltinLesson } from './lessons'
import { parseCatalogText } from '../lib/txt'
import { createWord } from './store'
import type { AppState, Catalog } from '../models/types'
import { CB2_FOLDER_ID, DEFAULT_BUILTIN_FOLDER_ID, defaultSettings } from '../models/types'

const PACK_V1: BuiltinLesson[] = [
  { id: 'l1', order: 1, introducedIn: 1, text: '# One\n你 | nǐ | you' },
  { id: 'l2', order: 2, introducedIn: 1, text: '# Two\n好 | hǎo | good' },
]

const PACK_V2: BuiltinLesson[] = [
  ...PACK_V1,
  { id: 'l3', order: 3, introducedIn: 2, text: '# Three\n大 | dà | big' },
]

function makeState(catalogs: Catalog[] = [], seededVersion?: number): AppState {
  return { version: 1, folders: [], catalogs, settings: defaultSettings(), seededVersion }
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
    expect(seeded.folders).toHaveLength(1)
    expect(seeded.catalogs.every((catalog) => catalog.folderId)).toBe(true)
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

describe('updating lessons the user already has', () => {
  const L1_V2: BuiltinLesson = {
    id: 'l1',
    order: 1,
    introducedIn: 1,
    // "you" gains a clarifier, a note is dropped, and a word is appended.
    text: '# One\n你 | nǐ | you (singular)\n们 | men | plural marker',
  }
  const packV2 = [L1_V2, PACK_V1[1]]

  /** A state where both PACK_V1 lessons are already seeded. */
  const seededState = () => seedLessons(makeState(), PACK_V1, 1)

  const catalogFor = (state: AppState, builtinId: string) =>
    state.catalogs.find((c) => c.builtinId === builtinId)!

  it('reports only the lesson whose text changed', () => {
    expect(ids(outdatedLessons(seededState(), packV2))).toEqual(['l1'])
    expect(outdatedLessons(seededState(), PACK_V1)).toEqual([])
  })

  it('treats a copy seeded before seedHash existed as current', () => {
    const state = seededState()
    const stripped = {
      ...state,
      catalogs: state.catalogs.map((c) => ({ ...c, seedHash: undefined })),
    }
    expect(outdatedLessons(stripped, packV2)).toEqual([])
  })

  it('ignores lessons the user never seeded', () => {
    expect(outdatedLessons(makeState(), packV2)).toEqual([])
  })

  it('refreshes a matching word in place and keeps its id', () => {
    const state = seededState()
    const before = catalogFor(state, 'l1').words[0]
    const after = catalogFor(applyLessonUpdates(state, [L1_V2]), 'l1').words[0]
    expect(after.id).toBe(before.id)
    expect(after.meaning).toBe('you (singular)')
  })

  it('appends words the lesson gained', () => {
    const catalog = catalogFor(applyLessonUpdates(seededState(), [L1_V2]), 'l1')
    expect(catalog.words.map((w) => w.hanzi)).toEqual(['你', '们'])
  })

  it('keeps words the user added themselves', () => {
    const state = seededState()
    const withOwn = {
      ...state,
      catalogs: state.catalogs.map((c) =>
        c.builtinId === 'l1'
          ? { ...c, words: [...c.words, createWord({ hanzi: '猫', pinyin: 'māo', meaning: 'cat' })] }
          : c,
      ),
    }
    const catalog = catalogFor(applyLessonUpdates(withOwn, [L1_V2]), 'l1')
    expect(catalog.words.map((w) => w.hanzi)).toContain('猫')
  })

  it('drops a note the lesson removed', () => {
    const withNote: BuiltinLesson = { ...PACK_V1[0], text: '# One\n你 | nǐ | you # a note' }
    const seeded = seedLessons(makeState(), [withNote, PACK_V1[1]], 1)
    expect(catalogFor(seeded, 'l1').words[0].note).toBe('a note')
    const updated = applyLessonUpdates(seeded, [PACK_V1[0]])
    expect(catalogFor(updated, 'l1').words[0].note).toBeUndefined()
  })

  it('preserves practice history and folder placement', () => {
    const state = seededState()
    const result = {
      id: 'r1',
      directionId: 'hanzi-to-vn' as const,
      correct: 1,
      total: 1,
      durationMs: 10,
      finishedAt: 1,
    }
    const withHistory = {
      ...state,
      catalogs: state.catalogs.map((c) =>
        c.builtinId === 'l1' ? { ...c, lastResult: result, practiceHistory: [result] } : c,
      ),
    }
    const catalog = catalogFor(applyLessonUpdates(withHistory, [L1_V2]), 'l1')
    expect(catalog.lastResult).toEqual(result)
    expect(catalog.practiceHistory).toEqual([result])
    expect(catalog.folderId).toBe(catalogFor(state, 'l1').folderId)
  })

  it('keeps the catalog name the user sees', () => {
    const state = seededState()
    const renamed = {
      ...state,
      catalogs: state.catalogs.map((c) =>
        c.builtinId === 'l1' ? { ...c, name: 'My own name' } : c,
      ),
    }
    expect(catalogFor(applyLessonUpdates(renamed, [L1_V2]), 'l1').name).toBe('My own name')
  })

  // Deletions are not tracked, so the merge cannot tell "user removed this"
  // from "never had it". Documented here so the behaviour is a choice.
  it('brings back a bundled word the user deleted', () => {
    const state = seededState()
    const emptied = {
      ...state,
      catalogs: state.catalogs.map((c) => (c.builtinId === 'l1' ? { ...c, words: [] } : c)),
    }
    const catalog = catalogFor(applyLessonUpdates(emptied, [L1_V2]), 'l1')
    expect(catalog.words.map((w) => w.hanzi)).toEqual(['你', '们'])
  })

  it('leaves untouched lessons alone', () => {
    const state = seededState()
    const updated = applyLessonUpdates(state, [L1_V2])
    expect(catalogFor(updated, 'l2')).toEqual(catalogFor(state, 'l2'))
  })

  it('stops offering the update once applied', () => {
    const updated = applyLessonUpdates(seededState(), [L1_V2])
    expect(outdatedLessons(updated, packV2)).toEqual([])
  })

  it('declining adopts the new text as baseline without changing words', () => {
    const dismissed = dismissLessonUpdates(seededState(), [L1_V2])
    expect(catalogFor(dismissed, 'l1').words.map((w) => w.meaning)).toEqual(['you'])
    expect(outdatedLessons(dismissed, packV2)).toEqual([])
  })
})

describe('bundled lesson pack', () => {
  it('ships 20 lessons with unique ids and valid versions', () => {
    expect(LESSON_PACK).toHaveLength(20)
    const uniqueIds = new Set(LESSON_PACK.map((l) => l.id))
    expect(uniqueIds.size).toBe(20)
    for (const lesson of LESSON_PACK) {
      expect(lesson.introducedIn).toBeLessThanOrEqual(LESSON_PACK_VERSION)
    }
  })

  it('is sorted in natural lesson order (bai-01 … bai-20)', () => {
    const orders = LESSON_PACK.map((l) => l.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(LESSON_PACK[0].id).toBe('bai-01')
    expect(LESSON_PACK[19].id).toBe('bai-20')
  })

  it('every lesson parses into a named catalog with words', () => {
    for (const lesson of LESSON_PACK) {
      expect(parseCatalogText(lesson.text).errors).toEqual([])
      const catalog = buildCatalogFromLesson(lesson)
      expect(catalog.name).toBeTruthy()
      expect(catalog.words.length).toBeGreaterThan(0)
      expect(catalog.builtinId).toBe(lesson.id)
    }
  })

  it('places bai-16 … bai-20 in the Căn bản 2 folder', () => {
    for (const id of ['bai-16', 'bai-17', 'bai-18', 'bai-19', 'bai-20']) {
      const lesson = LESSON_PACK.find((item) => item.id === id)
      expect(lesson).toBeDefined()
      const catalog = buildCatalogFromLesson(lesson!)
      expect(catalog.folderId).toBe(CB2_FOLDER_ID)
    }
  })

  it('keeps bai-01 in the Căn bản 1 folder', () => {
    const catalog = buildCatalogFromLesson(LESSON_PACK[0])
    expect(catalog.folderId).toBe(DEFAULT_BUILTIN_FOLDER_ID)
  })
})
