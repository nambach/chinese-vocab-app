import { validateLesson } from './segments'
import type { AudioSource, ShadowingLesson, ShadowingSegment, WordTiming } from './types'

/**
 * Runtime check for lesson JSON. Bundled files and anything a user supplies later
 * (file import, pasted JSON, fetched pack) go through this before the player sees them.
 */
export type LessonParseResult =
  | { ok: true; lesson: ShadowingLesson }
  | { ok: false; errors: string[] }

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

function parseAudio(value: unknown, errors: string[]): AudioSource {
  if (!isRecord(value)) {
    errors.push('lesson.audio must be an object')
    return { type: 'file', src: '' }
  }
  if (value.type === 'youtube') {
    return { type: 'youtube', videoId: requireString(value, 'videoId', 'audio', errors) }
  }
  if (value.type !== 'file') {
    errors.push("audio.type must be 'file' or 'youtube'")
    return { type: 'file', src: '' }
  }
  return { type: 'file', src: requireString(value, 'src', 'audio', errors) }
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
    return {
      id: requireString(entry, 'id', label, errors),
      text: requireString(entry, 'text', label, errors),
      pinyin: optionalString(entry, 'pinyin', label, errors),
      meaning: optionalString(entry, 'meaning', label, errors),
      start: requireNumber(entry, 'start', label, errors),
      end: requireNumber(entry, 'end', label, errors),
      words: parseWords(entry.words, label, errors),
    }
  })
}

export function parseLesson(value: unknown): LessonParseResult {
  if (!isRecord(value)) return { ok: false, errors: ['lesson must be an object'] }

  const errors: string[] = []
  const lesson: ShadowingLesson = {
    id: requireString(value, 'id', 'lesson', errors),
    title: requireString(value, 'title', 'lesson', errors),
    audio: parseAudio(value.audio, errors),
    segments: parseSegments(value.segments, errors),
  }
  if (errors.length > 0) return { ok: false, errors }

  const invalid = validateLesson(lesson)
  if (invalid.length > 0) return { ok: false, errors: invalid }

  return { ok: true, lesson }
}

/** Same check, starting from raw JSON text. */
export function parseLessonText(text: string): LessonParseResult {
  try {
    return parseLesson(JSON.parse(text))
  } catch (error) {
    return { ok: false, errors: [`invalid JSON: ${(error as Error).message}`] }
  }
}
