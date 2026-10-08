import type { ShadowingSegment } from './types'

const NON_SELECTABLE = /[\p{P}\s]/u

export type CharCell = {
  char: string
  selectable: boolean
}

export type CharSelection = { start: number; end: number } | null

export function splitSentence(text: string): CharCell[] {
  return Array.from(text).map((char) => ({
    char,
    selectable: !NON_SELECTABLE.test(char),
  }))
}

/**
 * Tap outside the range grows it to the tapped character, tap on an edge
 * drops that character, tap inside starts over from the tapped character.
 */
export function nextSelection(
  current: CharSelection,
  index: number,
  cells: CharCell[],
): CharSelection {
  if (!current) return { start: index, end: index }
  const { start, end } = current
  if (index < start) return { start: index, end }
  if (index > end) return { start, end: index }
  if (start === end) return null
  if (index === start) {
    for (let next = start + 1; next <= end; next += 1) {
      if (cells[next]?.selectable) return { start: next, end }
    }
    return null
  }
  if (index === end) {
    for (let next = end - 1; next >= start; next -= 1) {
      if (cells[next]?.selectable) return { start, end: next }
    }
    return null
  }
  return { start: index, end: index }
}

export function selectedText(chars: string[], selection: CharSelection): string {
  if (!selection) return ''
  const raw = chars.slice(selection.start, selection.end + 1).join('')
  return raw.replace(/^[\p{P}\s]+/u, '').replace(/[\p{P}\s]+$/u, '')
}

export function buildContextNote(segment: Pick<ShadowingSegment, 'text' | 'meaning'>): string {
  const meaning = segment.meaning?.trim()
  if (!meaning) return segment.text
  return `${segment.text} — ${meaning}`
}

/** Keep an existing note, and add the sentence when it is not already there. */
export function noteWithContext(
  note: string | undefined,
  segment: Pick<ShadowingSegment, 'text' | 'meaning'>,
): string {
  const context = buildContextNote(segment)
  const current = note?.trim() ?? ''
  if (!current) return context
  if (current.includes(segment.text)) return current
  return `${current}\n${context}`
}
