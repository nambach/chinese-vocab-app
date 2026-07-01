import { useEffect, useRef, useState } from 'react'

export type VisualViewportState = {
  height: number
  offsetTop: number
  keyboardInset: number
  keyboardOpen: boolean
}

function syncViewportCssVars(state: VisualViewportState) {
  const root = document.documentElement
  root.style.setProperty('--visual-viewport-height', `${state.height}px`)
  root.style.setProperty('--visual-viewport-offset-top', `${state.offsetTop}px`)
  root.style.setProperty('--keyboard-inset', `${state.keyboardInset}px`)
}

function readVisualViewport(baselineHeight: number): VisualViewportState {
  const vv = window.visualViewport
  if (!vv) {
    const height = window.innerHeight
    return { height, offsetTop: 0, keyboardInset: 0, keyboardOpen: false }
  }

  const height = vv.height
  const offsetTop = vv.offsetTop
  const keyboardInset = Math.max(0, baselineHeight - height - offsetTop)

  return {
    height,
    offsetTop,
    keyboardInset,
    keyboardOpen: keyboardInset > 50,
  }
}

export function useVisualViewport(): VisualViewportState {
  const baselineRef = useRef({
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
  })
  const frameRef = useRef<number | null>(null)

  const [state, setState] = useState<VisualViewportState>(() =>
    typeof window === 'undefined'
      ? { height: 0, offsetTop: 0, keyboardInset: 0, keyboardOpen: false }
      : readVisualViewport(baselineRef.current.height),
  )

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return undefined

    const updateBaselineIfNeeded = () => {
      const widthChanged = window.innerWidth !== baselineRef.current.width
      // iOS scrolls the visual viewport when the keyboard opens (offsetTop > 0).
      // Android resizes layout width only on true resizes/orientation changes.
      if (vv.offsetTop === 0 && widthChanged) {
        baselineRef.current = {
          height: window.innerHeight,
          width: window.innerWidth,
        }
      }
    }

    const update = () => {
      if (frameRef.current !== null) return
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        updateBaselineIfNeeded()
        const next = readVisualViewport(baselineRef.current.height)
        syncViewportCssVars(next)
        setState(next)
      })
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    update()

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.documentElement.style.removeProperty('--visual-viewport-height')
      document.documentElement.style.removeProperty('--visual-viewport-offset-top')
      document.documentElement.style.removeProperty('--keyboard-inset')
    }
  }, [])

  return state
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(max-width: 767px), (pointer: coarse)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px), (pointer: coarse)')
    const update = () => setIsMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isMobile
}

export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(pointer: coarse)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const update = () => setIsTouch(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isTouch
}
