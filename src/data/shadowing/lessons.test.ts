import { describe, expect, it } from 'vitest'
import { parseLesson } from '../../shadowing/lessonSchema'
import { SHADOWING_LESSONS } from './index'

const files = import.meta.glob('./lesson-*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

describe('bundled shadowing lessons', () => {
  it('ships at least one lesson', () => {
    expect(SHADOWING_LESSONS.length).toBeGreaterThan(0)
  })

  it('every lesson file parses', () => {
    for (const [path, data] of Object.entries(files)) {
      const result = parseLesson(data)
      expect(result.ok ? [] : result.errors, path).toEqual([])
    }
  })

  it('loads every lesson file', () => {
    expect(SHADOWING_LESSONS.length).toBe(Object.keys(files).length)
  })
})
