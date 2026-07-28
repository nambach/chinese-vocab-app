import type { AppState, Catalog } from '../models/types'
import { parseCatalogText } from '../lib/txt'
import { createCatalog, createWord } from './store'
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
  const catalog = createCatalog(parsed.name || lesson.id)
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
  if (lessons.length === 0) {
    return { ...state, seededVersion: packVersion }
  }
  return {
    ...state,
    catalogs: [...state.catalogs, ...lessons.map(buildCatalogFromLesson)],
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
