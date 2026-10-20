import { splitCjk } from './StrokeOrder'

/** Hanzii dictionary search. `hl=vi` keeps the result page in Vietnamese. */
export function hanziiSearchUrl(text: string): string {
  return `https://hanzii.net/search/word/${encodeURIComponent(text)}?hl=vi`
}

/**
 * An open-book button that looks the word up on Hanzii in a new tab.
 * Renders nothing when the text has no Chinese characters.
 */
export function HanziiButton({
  text,
  label,
  className = '',
}: {
  text: string
  label?: string
  className?: string
}) {
  if (splitCjk(text).length === 0) return null

  const name = label ?? `Tra "${text}" trên Hanzii`

  return (
    <a
      href={hanziiSearchUrl(text)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={name}
      title={name}
      onClick={(event) => event.stopPropagation()}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-200 transition active:scale-95 ${className}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 6.2C10.4 4.8 8.2 4 5.5 4H4v14.2h1.6c2.4 0 4.4.7 6.4 2.2 2-1.5 4-2.2 6.4-2.2H20V4h-1.5c-2.7 0-4.9.8-6.5 2.2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 6.2v14.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </a>
  )
}
