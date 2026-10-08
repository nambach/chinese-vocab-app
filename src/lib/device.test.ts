import { afterEach, describe, expect, it, vi } from 'vitest'
import { DESKTOP_MEDIA_QUERY, isDesktop, matchesMediaQuery } from './device'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isDesktop', () => {
  it('is false when there is no window', () => {
    vi.stubGlobal('window', undefined)
    expect(isDesktop()).toBe(false)
    expect(matchesMediaQuery(DESKTOP_MEDIA_QUERY)).toBe(false)
  })

  it('follows the fine-pointer hover query', () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query === DESKTOP_MEDIA_QUERY }))
    vi.stubGlobal('window', { matchMedia })

    expect(isDesktop()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith(DESKTOP_MEDIA_QUERY)
  })

  it('is false on a coarse pointer', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    })
    expect(isDesktop()).toBe(false)
  })
})
