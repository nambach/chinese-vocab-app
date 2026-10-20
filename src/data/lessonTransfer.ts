import type { AppState, Catalog, Kewen, Word, WordSource } from '../models/types'
import type { AudioSource } from '../shadowing/types'
import type { LessonFile, LessonFileAudio } from '../shadowing/lessonSchema'
import { textTitleFromSegments } from '../shadowing/textTitle'
import { createId } from './ids'
import { getCatalog, upsertCatalog } from './store'

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Turn a loose word list into a lesson. Positions are assigned afterwards, per word. */
export function attachKewen(state: AppState, catalogId: string, kewen: Kewen): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  return upsertCatalog(state, {
    ...catalog,
    kewen,
    updatedAt: Date.now(),
  })
}

function dedupedSources(sources: readonly WordSource[]): WordSource[] {
  const seen = new Set<string>()
  const next: WordSource[] = []
  for (const source of sources) {
    if (!source.lessonId.trim() || !source.segmentId.trim()) continue
    const key = `${source.lessonId}\0${source.segmentId}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push({ lessonId: source.lessonId, segmentId: source.segmentId })
  }
  return next
}

function sameSources(current: readonly WordSource[] | undefined, next: readonly WordSource[]): boolean {
  const left = current ?? []
  if (left.length !== next.length) return false
  return left.every(
    (source, index) =>
      source.lessonId === next[index].lessonId && source.segmentId === next[index].segmentId,
  )
}

/** Replace one word's positions. An empty list clears them. */
export function setWordSources(
  state: AppState,
  catalogId: string,
  wordId: string,
  sources: readonly WordSource[],
): AppState {
  const catalog = getCatalog(state, catalogId)
  if (!catalog) return state

  const index = catalog.words.findIndex((word) => word.id === wordId)
  if (index < 0) return state

  const nextSources = dedupedSources(sources)
  const word = catalog.words[index]
  if (sameSources(word.sources, nextSources)) return state

  const nextWord: Word = { ...word }
  if (nextSources.length) nextWord.sources = nextSources
  else delete nextWord.sources
  const words = catalog.words.map((item, itemIndex) => (itemIndex === index ? nextWord : item))

  return upsertCatalog(state, {
    ...catalog,
    words,
    updatedAt: Date.now(),
  })
}

function segmentIdsForWord(word: Word, lessonId: string): string[] | undefined {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const source of word.sources ?? []) {
    if (source.lessonId !== lessonId || seen.has(source.segmentId)) continue
    seen.add(source.segmentId)
    ids.push(source.segmentId)
  }
  return ids.length ? ids : undefined
}

const CHUNK = 0x8000

function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = []
  for (let index = 0; index < bytes.length; index += CHUNK) {
    const end = Math.min(index + CHUNK, bytes.length)
    let binary = ''
    for (let cursor = index; cursor < end; cursor++) binary += String.fromCharCode(bytes[cursor])
    parts.push(binary)
  }
  return btoa(parts.join(''))
}

function base64ToBytes(data: string): Uint8Array<ArrayBuffer> {
  let binary: string
  try {
    binary = atob(data)
  } catch {
    throw new Error('embedded audio is not valid base64')
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function fileAudio(audio: AudioSource, audioBlob: Blob | undefined): Promise<LessonFileAudio> {
  if (audio.type !== 'local') {
    if (audio.type === 'file') return { type: 'file', src: audio.src }
    if (audio.type === 'url') return { type: 'url', src: audio.src }
    return { type: 'youtube', videoId: audio.videoId }
  }

  if (!audioBlob) {
    return { type: 'local', name: audio.name, size: audio.size, mime: audio.mime }
  }

  const bytes = new Uint8Array(await audioBlob.arrayBuffer())
  return {
    type: 'embedded',
    mime: audioBlob.type || audio.mime || 'application/octet-stream',
    data: bytesToBase64(bytes),
    name: audio.name,
    size: audioBlob.size,
  }
}

/**
 * Write a lesson file. Practice history stays on the device.
 * Pass `audioBlob` to embed a `local` recording; otherwise the file records name and size only.
 * Returns null when the catalog has no script to export.
 */
export async function exportLesson(catalog: Catalog, audioBlob?: Blob): Promise<LessonFile | null> {
  const kewen = catalog.kewen
  if (!kewen) return null

  const audio = await fileAudio(kewen.audio, audioBlob)
  const textTitle = kewen.textTitle?.trim() || textTitleFromSegments(kewen.segments)
  return {
    format: 'cn-vocab-lesson',
    version: 1,
    id: kewen.lessonId,
    title: catalog.name.trim() || kewen.title,
    ...(textTitle ? { textTitle } : {}),
    audio,
    segments: snapshot(kewen.segments),
    words: catalog.words.map((word) => {
      const segments = segmentIdsForWord(word, kewen.lessonId)
      const note = word.note?.trim()
      return {
        hanzi: word.hanzi,
        pinyin: word.pinyin,
        meaning: word.meaning,
        ...(note ? { note } : {}),
        ...(segments ? { segments } : {}),
      }
    }),
  }
}

export type ImportLessonOptions = {
  createId?: () => string
  putAudio?: (blob: Blob) => Promise<string>
  now?: number
}

async function runtimeAudio(
  audio: LessonFileAudio,
  putAudio: ((blob: Blob) => Promise<string>) | undefined,
): Promise<AudioSource> {
  if (audio.type === 'file') return { type: 'file', src: audio.src }
  if (audio.type === 'url') return { type: 'url', src: audio.src }
  if (audio.type === 'youtube') return { type: 'youtube', videoId: audio.videoId }
  if (audio.type === 'local') {
    return { type: 'local', name: audio.name, size: audio.size, mime: audio.mime }
  }
  if (!putAudio) throw new Error('importLesson needs putAudio to store embedded audio')
  const blob = new Blob([base64ToBytes(audio.data)], { type: audio.mime })
  const blobId = await putAudio(blob)
  return { type: 'local', blobId, name: audio.name, size: audio.size, mime: audio.mime }
}

/**
 * A new catalog, new word ids, and a new lesson id. Segment ids stay, and sources
 * are rewritten to the new lesson id. Nothing about practice history comes along.
 */
export async function importLesson(file: LessonFile, options: ImportLessonOptions = {}): Promise<Catalog> {
  const nextId = options.createId ?? createId
  const now = options.now ?? Date.now()
  const lessonId = `custom-${nextId()}`
  const audio = await runtimeAudio(file.audio, options.putAudio)
  const textTitle = file.textTitle?.trim() || textTitleFromSegments(file.segments)

  return {
    id: nextId(),
    name: file.title.trim(),
    createdAt: now,
    updatedAt: now,
    words: file.words.map((word) => {
      const note = word.note?.trim()
      return {
        id: nextId(),
        hanzi: word.hanzi.trim(),
        pinyin: word.pinyin.trim(),
        meaning: word.meaning.trim(),
        ...(note ? { note } : {}),
        ...(word.segments?.length
          ? {
              sources: word.segments.map((segmentId) => ({ lessonId, segmentId })),
            }
          : {}),
      }
    }),
    kewen: {
      lessonId,
      title: file.title.trim(),
      ...(textTitle ? { textTitle } : {}),
      audio,
      segments: snapshot(file.segments),
    },
  }
}
