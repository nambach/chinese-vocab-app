type TitleSegment = {
  text: string
  meaning?: string
  section?: string
}

/** Drop the textbook's "Bài 1:" prefix. The lesson number is already "Bài 16". */
function glossTitle(meaning: string): string {
  return meaning.replace(/^Bài\s*\d+\s*[:：]\s*/, '').trim()
}

/**
 * Title of the first 课文 text. It is the heading that follows 一、课文,
 * within the next couple of lines. Lessons without that heading have no title.
 */
export function textTitleFromSegments(segments: readonly TitleSegment[]): string | undefined {
  const start = segments.findIndex((segment) => segment.text.trim() === '一、课文')
  const window = start === -1 ? segments.slice(0, 2) : segments.slice(start + 1, start + 3)
  for (const segment of window) {
    if (segment.section && segment.section !== 'heading') continue
    const text = segment.text.trim()
    if (!/^[一二三]、/.test(text) || /课文|生词|专名/.test(text)) continue
    const fromMeaning = segment.meaning ? glossTitle(segment.meaning) : ''
    if (fromMeaning) return fromMeaning
    const fromText = text.replace(/^[一二三]、/, '').trim()
    if (fromText) return fromText
  }
  return undefined
}
