import { useEffect, useState } from 'react'

/** Mouse or trackpad: hover works and the primary pointer is fine. Phones use a coarse pointer. */
export const DESKTOP_MEDIA_QUERY = '(hover: hover) and (pointer: fine)'

export function matchesMediaQuery(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}

export function isDesktop(): boolean {
  return matchesMediaQuery(DESKTOP_MEDIA_QUERY)
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchesMediaQuery(query))

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_MEDIA_QUERY)
}
