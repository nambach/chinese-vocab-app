import { parseCatalogText } from '../lib/txt'
import type { AppState, Catalog, Kewen, Word } from '../models/types'
import type { LessonFile } from '../shadowing/lessonSchema'
import { withSource } from '../shadowing/savedWords'
import { BUNDLED_AUDIO_DURATION, padSegmentEdges } from '../shadowing/segments'
import { textTitleFromSegments } from '../shadowing/textTitle'
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
  const textTitle = file.textTitle?.trim() || textTitleFromSegments(file.segments)
  return {
    lessonId: file.id,
    title: file.title,
    ...(textTitle ? { textTitle } : {}),
    audio: { type: 'file', src: file.audio.src },
    segments: file.segments.map((segment) => ({ ...segment })),
    edgePad: 1,
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

/** Known mistranscriptions. Only a sentence that still contains the name is changed. */
function correctNames(kewen: Kewen): Kewen {
  let changed = false
  const segments = kewen.segments.map((segment) => {
    let meaning = segment.meaning
    if (!meaning) return segment
    if (segment.text.includes('田芳') && meaning.includes('Tiên Phương')) {
      meaning = meaning.replaceAll('Tiên Phương', 'Điền Phương')
    }
    if (segment.text.includes('罗兰') && meaning.includes('Luolan')) {
      meaning = meaning.replaceAll('Luolan', 'Roland')
    }
    if (meaning === segment.meaning) return segment
    changed = true
    return { ...segment, meaning }
  })
  let textTitle = kewen.textTitle
  if (textTitle?.includes('Tiên Phương')) {
    textTitle = textTitle.replaceAll('Tiên Phương', 'Điền Phương')
    changed = true
  }
  if (!changed) return kewen
  return { ...kewen, segments, ...(textTitle ? { textTitle } : {}) }
}

/**
 * Give a bundled catalog its 课文 the first time the bundle has one.
 * Word text is untouched; matching words only gain their sentence positions.
 * A script already on the device is the user's copy: text is left alone.
 * Sentence edges are padded once (0.2s before, 0.1s after) when that pad is missing.
 */
export function attachBundledKewen(state: AppState, pack: readonly BuiltinLesson[]): AppState {
  const byId = new Map(pack.map((lesson) => [lesson.id, lesson]))
  let changed = false
  const catalogs = state.catalogs.map((catalog) => {
    if (!catalog.builtinId) return catalog
    const lesson = byId.get(catalog.builtinId)
    const file = lesson?.file
    if (!lesson || !file || file.audio.type !== 'file') return catalog
    if (Array.isArray(catalog.kewen?.segments)) {
      const named = correctNames(catalog.kewen)
      const fromSegments = textTitleFromSegments(named.segments)
      const next = file.textTitle?.trim() || fromSegments
      const current = named.textTitle
      let kewen = named
      if (next && next !== current && (!current || current === fromSegments)) {
        kewen = { ...named, textTitle: next }
      }
      if (kewen.edgePad !== 1) {
        const duration = kewen.audio.type === 'file' ? BUNDLED_AUDIO_DURATION[kewen.audio.src] : undefined
        kewen = { ...kewen, segments: padSegmentEdges(kewen.segments, duration), edgePad: 1 }
      }
      if (kewen === catalog.kewen) return catalog
      changed = true
      return { ...catalog, kewen }
    }
    const kewen = kewenFromFile(file)
    if (!kewen) return catalog
    changed = true
    return withPositions(catalog, lesson, kewen)
  })
  return changed ? { ...state, catalogs } : state
}
