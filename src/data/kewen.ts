import { parseCatalogText } from '../lib/txt'
import type { AppState, Catalog, Kewen, Word } from '../models/types'
import type { LessonFile } from '../shadowing/lessonSchema'
import { withSource } from '../shadowing/savedWords'
import type { BuiltinLesson } from './lessons'

/** Words a bundled lesson ships, with sentence positions for a 课文 lesson. */
export function bundledWords(lesson: BuiltinLesson): Omit<Word, 'id'>[] {
  const file = lesson.file
  if (lesson.kind === 'lesson' && file) {
    return file.words.map((word) => ({
      hanzi: word.hanzi,
      pinyin: word.pinyin,
      meaning: word.meaning,
      ...(word.note ? { note: word.note } : {}),
      ...(word.segments?.length
        ? { sources: word.segments.map((segmentId) => ({ lessonId: file.id, segmentId })) }
        : {}),
    }))
  }
  return parseCatalogText(lesson.text).words
}

/** A device copy of a bundled script. Only a bundled mp3 can back it. */
export function kewenFromFile(file: LessonFile): Kewen | undefined {
  if (file.audio.type !== 'file') return undefined
  return {
    lessonId: file.id,
    title: file.title,
    audio: { type: 'file', src: file.audio.src },
    segments: file.segments.map((segment) => ({ ...segment })),
  }
}

function withPositions(catalog: Catalog, lesson: BuiltinLesson, kewen: Kewen): Catalog {
  const positions = new Map(
    bundledWords(lesson)
      .filter((word) => word.sources?.length)
      .map((word) => [word.hanzi, word.sources!]),
  )
  const words = catalog.words.map((word) => {
    const incoming = positions.get(word.hanzi)
    if (!incoming) return word
    let next = word
    for (const source of incoming) next = { ...next, sources: withSource(next, source) }
    return next
  })
  return { ...catalog, kewen, words }
}

/**
 * Give a bundled catalog its 课文 the first time the bundle has one.
 * Word text is untouched; matching words only gain their sentence positions.
 * A script already on the device is the user's copy and is left alone.
 */
export function attachBundledKewen(state: AppState, pack: readonly BuiltinLesson[]): AppState {
  const byId = new Map(pack.map((lesson) => [lesson.id, lesson]))
  let changed = false
  const catalogs = state.catalogs.map((catalog) => {
    if (!catalog.builtinId) return catalog
    const lesson = byId.get(catalog.builtinId)
    const file = lesson?.file
    if (!lesson || !file || file.audio.type !== 'file') return catalog
    if (Array.isArray(catalog.kewen?.segments)) return catalog
    const kewen = kewenFromFile(file)
    if (!kewen) return catalog
    changed = true
    return withPositions(catalog, lesson, kewen)
  })
  return changed ? { ...state, catalogs } : state
}
