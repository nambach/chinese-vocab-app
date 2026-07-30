import { useState } from 'react'
import { splitCjk } from './StrokeOrder'
import { StrokeOrderDrawer } from './StrokeOrderDrawer'

/**
 * A pencil icon button that opens the stroke-order drawer for `text`.
 * Renders nothing when the text has no Chinese characters.
 */
export function StrokeOrderButton({
  text,
  label = 'Xem thứ tự nét',
  className = '',
  onOpenChange,
}: {
  text: string
  label?: string
  className?: string
  /** Notified whenever the stroke-order drawer opens or closes. */
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)

  const setDrawerOpen = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  if (splitCjk(text).length === 0) return null

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={(event) => {
          event.stopPropagation()
          setDrawerOpen(true)
        }}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-200 transition active:scale-95 ${className}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 20h4l10-10a2.828 2.828 0 10-4-4L4 16v4z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <StrokeOrderDrawer open={open} onClose={() => setDrawerOpen(false)} text={text} />
    </>
  )
}
