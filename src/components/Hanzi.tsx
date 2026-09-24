import type { ReactNode } from 'react'
import { useApp } from '../context/AppContext'
import { useHanziVariant } from '../lib/traditional'

/**
 * Renders Chinese characters using the user-selected display font via the
 * `--hanzi-font` CSS variable, converted to the user's selected hanzi
 * variant (simplified/traditional). Falls back to the inherited font when
 * the variable is unset (system default) or when a web font fails to load.
 */
export function Hanzi({
  children,
  className = '',
  convert = true,
}: {
  children: ReactNode
  className?: string
  /** Set false to apply the display font without converting variant (e.g. text the user typed). */
  convert?: boolean
}) {
  const { state } = useApp()
  const variant = state.settings.hanziVariant
  const shouldConvert = convert && typeof children === 'string'
  // Hooks must run unconditionally; pass '' when there's nothing to convert.
  const converted = useHanziVariant(variant, shouldConvert ? children : '')
  const displayed = shouldConvert ? converted : children

  return (
    <span className={className} style={{ fontFamily: 'var(--hanzi-font, inherit)' }}>
      {displayed}
    </span>
  )
}
