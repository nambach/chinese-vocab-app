import type { ReactNode } from 'react'

/**
 * Renders Chinese characters using the user-selected display font via the
 * `--hanzi-font` CSS variable. Falls back to the inherited font when the
 * variable is unset (system default) or when a web font fails to load.
 */
export function Hanzi({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={className} style={{ fontFamily: 'var(--hanzi-font, inherit)' }}>
      {children}
    </span>
  )
}
