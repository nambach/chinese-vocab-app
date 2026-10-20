import { parseLessonFile, type LessonFile } from '../../shadowing/lessonSchema'

// Bundled lessons. A `bai-NN.txt` is a word list. A `bai-NN.json` is a lesson
// (课文 + vocab) and replaces the txt of the same id.
// To publish new lessons later:
//   1. Drop the file into this folder.
//   2. Set its `introducedIn` below to the NEW pack version.
//   3. Bump LESSON_PACK_VERSION to that same number.
// Existing users are then offered ONLY the newly introduced lessons.
// A txt that later becomes a json is not a new lesson: migration attaches the 课文.

export type BuiltinLesson = {
  /** Stable id derived from the file name, e.g. "bai-01". */
  id: string
  /** Sort order within the pack (natural, not lexical). */
  order: number
  /** Pack version in which this lesson was first shipped. */
  introducedIn: number
  kind: 'set' | 'lesson'
  /** Raw file contents for kind `set`. Empty for a lesson. */
  text: string
  /** Present for kind `lesson`. */
  file?: LessonFile
}

/** Highest pack version currently shipped. Bump when adding lessons. */
export const LESSON_PACK_VERSION = 8

// Per-lesson version overrides. Anything not listed defaults to 1.
const INTRODUCED_IN: Record<string, number> = {
  'bai-16': 2,
  'bai-17': 3,
  'bai-18': 4,
  'bai-19': 4,
  'bai-20': 4,
  'bai-21': 5,
  'bai-22': 6,
  'bai-23': 6,
  'bai-24': 7,
  'bai-25': 7,
  'bai-26': 8,
  'bai-27': 8,
  'bai-28': 8,
  'bai-29': 8,
  'bai-30': 8,
}

const textModules = import.meta.glob('./bai-*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const lessonModules = import.meta.glob('./bai-*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

function idFromPath(path: string): string {
  return path.replace(/^\.\//, '').replace(/\.(txt|json)$/, '')
}

function orderFromId(id: string): number {
  const match = id.match(/(\d+)/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

const lessons = new Map<string, BuiltinLesson>()

for (const [path, text] of Object.entries(textModules)) {
  const id = idFromPath(path)
  lessons.set(id, {
    id,
    order: orderFromId(id),
    introducedIn: INTRODUCED_IN[id] ?? 1,
    kind: 'set',
    text,
  })
}

for (const [path, data] of Object.entries(lessonModules)) {
  const id = idFromPath(path)
  const result = parseLessonFile(data)
  if (!result.ok) {
    throw new Error(`Invalid lesson ${path}: ${result.errors.join('; ')}`)
  }
  if (result.file.id !== id) {
    throw new Error(`${path} id is ${result.file.id}, expected ${id}`)
  }
  lessons.set(id, {
    id,
    order: orderFromId(id),
    introducedIn: INTRODUCED_IN[id] ?? 1,
    kind: 'lesson',
    text: '',
    file: result.file,
  })
}

export const LESSON_PACK: BuiltinLesson[] = [...lessons.values()].sort((a, b) => a.order - b.order)

export function builtinLessonTitle(lesson: BuiltinLesson): string {
  if (lesson.kind === 'lesson') return lesson.file?.title || lesson.id
  const heading = lesson.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('#'))
  const title = heading?.replace(/^#\s*/, '').trim()
  return title || lesson.id
}
