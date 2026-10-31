import { useApp } from '../context/AppContext'
import { pinyinHighlightRanges } from '../data/search'
import { useHanziVariant } from '../lib/traditional'
import { highlightIndices } from '../shadowing/savedWords'

export function HighlightedText({
  text,
  query,
  mode = 'hanzi',
  className = '',
}: {
  text: string
  query: string
  mode?: 'hanzi' | 'pinyin'
  className?: string
}) {
  const { state } = useApp()
  const converted = useHanziVariant(state.settings.hanziVariant, mode === 'hanzi' ? text : '')
  const simplified = Array.from(text)
  const convertedChars = Array.from(converted)
  const display =
    mode === 'hanzi' && convertedChars.length === simplified.length ? convertedChars : simplified

  const marks = new Set<number>()
  if (mode === 'pinyin') {
    for (const [start, end] of pinyinHighlightRanges(text, query)) {
      for (let index = start; index < end; index += 1) marks.add(index)
    }
  } else if (query) {
    for (const index of highlightIndices(simplified, [query])) marks.add(index)
  }

  return (
    <span
      className={`block ${className}`}
      style={mode === 'hanzi' ? { fontFamily: 'var(--hanzi-font, inherit)' } : undefined}
    >
      {display.map((char, index) => (
        <span key={index} className={marks.has(index) ? 'rounded-sm bg-amber-300' : undefined}>
          {char}
        </span>
      ))}
    </span>
  )
}
