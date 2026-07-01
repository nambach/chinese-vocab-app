import { useEffect, type ReactNode } from 'react'
import { useIsTouchDevice, useVisualViewport } from '../lib/useVisualViewport'

type KeyboardAvoidingViewProps = {
  children: ReactNode
  className?: string
  enabled?: boolean
}

/**
 * Web equivalent of React Native's KeyboardAvoidingView.
 * Pins children to the visual viewport so the on-screen keyboard
 * does not scroll fixed content off-screen on iOS Safari / mobile Chrome.
 */
export function KeyboardAvoidingView({
  children,
  className = '',
  enabled = true,
}: KeyboardAvoidingViewProps) {
  const isTouch = useIsTouchDevice()
  const { height, offsetTop } = useVisualViewport()
  const active = enabled && isTouch

  useEffect(() => {
    if (!active) return undefined

    const html = document.documentElement
    const body = document.body
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    }

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'

    const resetScroll = () => {
      window.scrollTo(0, 0)
    }

    resetScroll()
    window.visualViewport?.addEventListener('scroll', resetScroll)

    return () => {
      window.visualViewport?.removeEventListener('scroll', resetScroll)
      html.style.overflow = previous.htmlOverflow
      body.style.overflow = previous.bodyOverflow
      html.style.overscrollBehavior = previous.htmlOverscroll
      body.style.overscrollBehavior = previous.bodyOverscroll
    }
  }, [active])

  if (!active) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        top: offsetTop,
        left: 0,
        right: 0,
        height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'inherit',
      }}
    >
      {children}
    </div>
  )
}
