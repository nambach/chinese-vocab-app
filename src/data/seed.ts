import type { AppState, Catalog } from '../models/types'
import { CB2_FOLDER_ID, folderIdForBuiltinLesson } from '../models/types'
import { parseCatalogText } from '../lib/txt'
import { createCatalog, createWord, ensureBuiltinFolder, ensureCb2Folder } from './store'
import {
  LESSON_PACK,
  LESSON_PACK_VERSION,
  type BuiltinLesson,
} from './lessons'

/** Small stable fingerprint of a lesson's source text (reserved for future update flow). */
function hashText(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

export function buildCatalogFromLesson(lesson: BuiltinLesson): Catalog {
  const parsed = parseCatalogText(lesson.text)
  const folderId = folderIdForBuiltinLesson(lesson.id)
  const catalog = createCatalog(parsed.name || lesson.id, folderId)
  catalog.words = parsed.words.map((word) => createWord(word))
  catalog.builtinId = lesson.id
  catalog.seedHash = hashText(lesson.text)
  return catalog
}

function existingBuiltinIds(state: AppState): Set<string> {
  return new Set(
    state.catalogs
      .map((catalog) => catalog.builtinId)
      .filter((id): id is string => Boolean(id)),
  )
}

// ---- Pure core (pack injected for testability) ----

/** Lessons introduced after what the user has already been offered, and not already present. */
export function pendingLessons(
  state: AppState,
  pack: BuiltinLesson[],
): BuiltinLesson[] {
  const storedVersion = state.seededVersion ?? 0
  const present = existingBuiltinIds(state)
  return pack.filter(
    (lesson) => lesson.introducedIn > storedVersion && !present.has(lesson.id),
  )
}

/** Add the given lessons and mark the pack version as offered. */
export function seedLessons(
  state: AppState,
  lessons: BuiltinLesson[],
  packVersion: number,
): AppState {
  let withFolders = ensureBuiltinFolder(state)
  if (lessons.some((lesson) => folderIdForBuiltinLesson(lesson.id) === CB2_FOLDER_ID)) {
    withFolders = ensureCb2Folder(withFolders)
  }

  if (lessons.length === 0) {
    return { ...withFolders, seededVersion: packVersion }
  }

  return {
    ...withFolders,
    catalogs: [...withFolders.catalogs, ...lessons.map(buildCatalogFromLesson)],
    seededVersion: packVersion,
  }
}

/** User declined: mark the pack version offered without adding anything. */
export function acknowledgePack(state: AppState, packVersion: number): AppState {
  return { ...state, seededVersion: packVersion }
}

/** Re-add every bundled lesson that is currently missing (Settings escape hatch). */
export function restoreMissing(
  state: AppState,
  pack: BuiltinLesson[],
  packVersion: number,
): AppState {
  const present = existingBuiltinIds(state)
  const missing = pack.filter((lesson) => !present.has(lesson.id))
  return seedLessons(state, missing, packVersion)
}

// ---- Updating lessons the user already has ----

/**
 * Bundled lessons whose text changed since the user's copy was seeded.
 *
 * A copy seeded before `seedHash` existed has no baseline to compare against,
 * so it counts as current: offering an update we cannot verify would show every
 * lesson as changed.
 */
export function outdatedLessons(
  state: AppState,
  pack: BuiltinLesson[],
): BuiltinLesson[] {
  const byBuiltinId = new Map(
    state.catalogs
      .filter((catalog) => catalog.builtinId)
      .map((catalog) => [catalog.builtinId as string, catalog]),
  )
  return pack.filter((lesson) => {
    const catalog = byBuiltinId.get(lesson.id)
    if (!catalog?.seedHash) return false
    return catalog.seedHash !== hashText(lesson.text)
  })
}

/**
 * Folds new bundled text into a catalog the user may have edited: words are
 * matched by hanzi and refreshed in place (keeping their id, so practice
 * history stays attached), new words are appended, and words the catalog has
 * but the lesson no longer lists are left alone — they may be the user's own.
 */
function mergeLessonIntoCatalog(catalog: Catalog, lesson: BuiltinLesson): Catalog {
  const parsed = parseCatalogText(lesson.text)
  const words = [...catalog.words]
  const indexByHanzi = new Map(words.map((word, index) => [word.hanzi, index]))

  for (const incoming of parsed.words) {
    const index = indexByHanzi.get(incoming.hanzi)
    if (index === undefined) {
      indexByHanzi.set(incoming.hanzi, words.length)
      words.push(createWord(incoming))
      continue
    }
    // Rebuilt rather than spread so a note dropped upstream is dropped here too.
    words[index] = { id: words[index].id, ...incoming }
  }

  return {
    ...catalog,
    words,
    seedHash: hashText(lesson.text),
    updatedAt: Date.now(),
  }
}

function rewriteBuiltinCatalogs(
  state: AppState,
  lessons: BuiltinLesson[],
  rewrite: (catalog: Catalog, lesson: BuiltinLesson) => Catalog,
): AppState {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  if (byId.size === 0) return state
  return {
    ...state,
    catalogs: state.catalogs.map((catalog) => {
      const lesson = catalog.builtinId ? byId.get(catalog.builtinId) : undefined
      return lesson ? rewrite(catalog, lesson) : catalog
    }),
  }
}

/** Merge the new bundled text into the user's copies. */
export function applyLessonUpdates(
  state: AppState,
  lessons: BuiltinLesson[],
): AppState {
  return rewriteBuiltinCatalogs(state, lessons, mergeLessonIntoCatalog)
}

/**
 * User declined: adopt the new text as their baseline without touching any
 * words, so the same update is not offered again.
 */
export function dismissLessonUpdates(
  state: AppState,
  lessons: BuiltinLesson[],
): AppState {
  return rewriteBuiltinCatalogs(state, lessons, (catalog, lesson) => ({
    ...catalog,
    seedHash: hashText(lesson.text),
  }))
}

// ---- App-facing wrappers bound to the real pack ----

export function getPendingBuiltinLessons(state: AppState): BuiltinLesson[] {
  return pendingLessons(state, LESSON_PACK)
}

export function acceptPendingLessons(state: AppState): AppState {
  return seedLessons(state, getPendingBuiltinLessons(state), LESSON_PACK_VERSION)
}

export function declineLessonPack(state: AppState): AppState {
  return acknowledgePack(state, LESSON_PACK_VERSION)
}

export function restoreDefaultLessons(state: AppState): AppState {
  return restoreMissing(state, LESSON_PACK, LESSON_PACK_VERSION)
}

export function getOutdatedBuiltinLessons(state: AppState): BuiltinLesson[] {
  return outdatedLessons(state, LESSON_PACK)
}

export function acceptLessonUpdates(state: AppState): AppState {
  return applyLessonUpdates(state, getOutdatedBuiltinLessons(state))
}

export function declineLessonUpdates(state: AppState): AppState {
  return dismissLessonUpdates(state, getOutdatedBuiltinLessons(state))
}
