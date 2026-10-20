import { validateSegments } from './segments'
import type { ShadowingSegment, WordTiming } from './types'

export type LessonWord = {
  hanzi: string
  pinyin: string
  meaning: string
  note?: string
  /** Segment ids in this same file. Dialogue first, then the 生词 reading. */
  segments?: string[]
}

/**
 * Audio inside a lesson file. `embedded` carries the bytes. `local` carries only
 * the name and size, so the recipient can choose the file again. Neither form
 * stores a device-local `blobId`.
 */
export type LessonFileAudio =
  | { type: 'file'; src: string }
  | { type: 'url'; src: string }
  | { type: 'youtube'; videoId: string }
  | { type: 'embedded'; mime: string; data: string; name: string; size: number }
  | { type: 'local'; name: string; size: number; mime: string }

export type LessonFile = {
  format: 'cn-vocab-lesson'
  version: 1
  id: string
  title: string
  audio: LessonFileAudio
  segments: ShadowingSegment[]
  words: LessonWord[]
}

export type LessonFileParseResult =
  | { ok: true; file: LessonFile }
  | { ok: false; errors: string[] }

const SECTIONS = new Set(['heading', 'kewen', 'shengci'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(
  source: Record<string, unknown>,
  key: string,
  where: string,
  errors: string[],
): string {
  const value = source[key]
  if (typeof value === 'string' && value.trim()) return value
  errors.push(`${where}.${key} must be a non-empty string`)
  return ''
}

function optionalString(
  source: Record<string, unknown>,
  key: string,
  where: string,
  errors: string[],
): string | undefined {
  const value = source[key]
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  errors.push(`${where}.${key} must be a string`)
  return undefined
}

function requireNumber(
  source: Record<string, unknown>,
  key: string,
  where: string,
  errors: string[],
): number {
  const value = source[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  errors.push(`${where}.${key} must be a number`)
  return 0
}

function parseWords(value: unknown, where: string, errors: string[]): WordTiming[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    errors.push(`${where}.words must be an array`)
    return undefined
  }
  return value.map((entry, index) => {
    const label = `${where}.words[${index}]`
    if (!isRecord(entry)) {
      errors.push(`${label} must be an object`)
      return { text: '', start: 0, end: 0 }
    }
    return {
      text: requireString(entry, 'text', label, errors),
      start: requireNumber(entry, 'start', label, errors),
      end: requireNumber(entry, 'end', label, errors),
    }
  })
}

function parseSection(
  value: unknown,
  where: string,
  errors: string[],
): ShadowingSegment['section'] | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string' && SECTIONS.has(value)) {
    return value as ShadowingSegment['section']
  }
  errors.push(`${where}.section must be heading, kewen, or shengci`)
  return undefined
}

function parseSegments(value: unknown, errors: string[]): ShadowingSegment[] {
  if (!Array.isArray(value)) {
    errors.push('lesson.segments must be an array')
    return []
  }
  return value.map((entry, index) => {
    const label = `segments[${index}]`
    if (!isRecord(entry)) {
      errors.push(`${label} must be an object`)
      return { id: '', text: '', start: 0, end: 0 }
    }
    const section = parseSection(entry.section, label, errors)
    return {
      id: requireString(entry, 'id', label, errors),
      text: requireString(entry, 'text', label, errors),
      pinyin: optionalString(entry, 'pinyin', label, errors),
      meaning: optionalString(entry, 'meaning', label, errors),
      start: requireNumber(entry, 'start', label, errors),
      end: requireNumber(entry, 'end', label, errors),
      ...(section ? { section } : {}),
      words: parseWords(entry.words, label, errors),
    }
  })
}

function parseLessonWords(
  value: unknown,
  segmentIds: ReadonlySet<string> | undefined,
  errors: string[],
): LessonWord[] {
  if (!Array.isArray(value)) {
    errors.push('lesson.words must be an array')
    return []
  }
  return value.map((entry, index) => {
    const label = `words[${index}]`
    if (!isRecord(entry)) {
      errors.push(`${label} must be an object`)
      return { hanzi: '', pinyin: '', meaning: '' }
    }
    const segments = parseSegmentRefs(entry.segments, label, segmentIds, errors)
    const note = optionalString(entry, 'note', label, errors)
    return {
      hanzi: requireString(entry, 'hanzi', label, errors),
      pinyin: requireString(entry, 'pinyin', label, errors),
      meaning: requireString(entry, 'meaning', label, errors),
      ...(note ? { note } : {}),
      ...(segments ? { segments } : {}),
    }
  })
}

function parseSegmentRefs(
  value: unknown,
  where: string,
  segmentIds: ReadonlySet<string> | undefined,
  errors: string[],
): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push(`${where}.segments must be an array of segment ids`)
    return undefined
  }
  const refs = value as string[]
  if (segmentIds) {
    for (const id of refs) {
      if (!segmentIds.has(id)) errors.push(`${where}.segments points at missing segment ${id}`)
    }
  }
  return refs
}

function requireByteSize(source: Record<string, unknown>, where: string, errors: string[]): number {
  const size = requireNumber(source, 'size', where, errors)
  if (size < 0) errors.push(`${where}.size must be a non-negative number`)
  return size
}

/**
 * Lesson-file audio. A `local` entry may include `blobId` from a careless export;
 * it is dropped because that id only means something on the machine that created it.
 */
function parseLessonAudio(value: unknown, errors: string[]): LessonFileAudio | null {
  if (!isRecord(value)) {
    errors.push('lesson.audio must be an object')
    return null
  }
  if (value.type === 'file') {
    return { type: 'file', src: requireString(value, 'src', 'audio', errors) }
  }
  if (value.type === 'url') {
    return { type: 'url', src: requireString(value, 'src', 'audio', errors) }
  }
  if (value.type === 'youtube') {
    return { type: 'youtube', videoId: requireString(value, 'videoId', 'audio', errors) }
  }
  if (value.type === 'embedded') {
    return {
      type: 'embedded',
      mime: requireString(value, 'mime', 'audio', errors),
      data: requireString(value, 'data', 'audio', errors),
      name: requireString(value, 'name', 'audio', errors),
      size: requireByteSize(value, 'audio', errors),
    }
  }
  if (value.type === 'local') {
    return {
      type: 'local',
      name: requireString(value, 'name', 'audio', errors),
      size: requireByteSize(value, 'audio', errors),
      mime: requireString(value, 'mime', 'audio', errors),
    }
  }
  errors.push("audio.type must be 'file', 'url', 'local', 'embedded', or 'youtube'")
  return null
}

/**
 * Bundled lesson file: a shadowing script plus the vocab list. Same document
 * export writes, so anything a user supplies goes through this check too.
 */
export function parseLessonFile(value: unknown): LessonFileParseResult {
  if (!isRecord(value)) return { ok: false, errors: ['lesson must be an object'] }

  const errors: string[] = []
  if (value.format !== 'cn-vocab-lesson') errors.push("format must be 'cn-vocab-lesson'")
  if (value.version !== 1) errors.push('version must be 1')

  const id = requireString(value, 'id', 'lesson', errors)
  const title = requireString(value, 'title', 'lesson', errors)
  const audio = parseLessonAudio(value.audio, errors)

  const beforeSegments = errors.length
  const segments = parseSegments(value.segments, errors)
  const segmentsOk = errors.length === beforeSegments
  if (segmentsOk) errors.push(...validateSegments(segments))

  const segmentIds = segmentsOk ? new Set(segments.map((segment) => segment.id)) : undefined
  const words = parseLessonWords(value.words, segmentIds, errors)
  if (!audio || errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    file: {
      format: 'cn-vocab-lesson',
      version: 1,
      id,
      title,
      audio,
      segments,
      words,
    },
  }
}
