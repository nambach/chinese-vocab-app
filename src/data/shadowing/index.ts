import { parseLesson } from '../../shadowing/lessonSchema'
import type { ShadowingLesson } from '../../shadowing/types'

const modules = import.meta.glob('./lesson-*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

function orderFromId(id: string): number {
  const match = id.match(/(\d+)/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

/** A broken file is skipped rather than taking the whole lesson list down with it. */
function loadBundledLessons(): ShadowingLesson[] {
  const lessons: ShadowingLesson[] = []
  for (const [path, data] of Object.entries(modules)) {
    const result = parseLesson(data)
    if (result.ok) lessons.push(result.lesson)
    else console.error(`Skipped ${path}: ${result.errors.join('; ')}`)
  }
  return lessons.sort((a, b) => orderFromId(a.id) - orderFromId(b.id))
}

export const SHADOWING_LESSONS: ShadowingLesson[] = loadBundledLessons()

export function getShadowingLesson(id: string): ShadowingLesson | undefined {
  return SHADOWING_LESSONS.find((lesson) => lesson.id === id)
}
