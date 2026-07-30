import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import HanziWriter from 'hanzi-writer'

export type StrokeMode = 'animate' | 'quiz'

const GAP = 12
/** Target box width; used to decide how many boxes fit per row. */
const TARGET_BOX = 150
const MAX_BOX = 320

/** Matches CJK ideographs; other characters (punctuation, latin) are skipped. */
const CJK_REGEX = /[\u3400-\u9fff\uf900-\ufaff]/

export function splitCjk(text: string): string[] {
  return Array.from(text).filter((char) => CJK_REGEX.test(char))
}

function GuideGrid() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-teal-200"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="98" height="98" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="0.75" strokeDasharray="4 4" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.75" strokeDasharray="4 4" />
    </svg>
  )
}

function StrokeOrderChar({
  char,
  size,
  mode,
  playToken,
}: {
  char: string
  size: number
  mode: StrokeMode
  playToken: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriter | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    setError(false)
    container.innerHTML = ''

    const writer = HanziWriter.create(container, char, {
      width: size,
      height: size,
      padding: 5,
      showCharacter: false,
      showOutline: true,
      strokeColor: '#0f766e',
      outlineColor: '#d1d5db',
      highlightColor: '#14b8a6',
      drawingColor: '#0f766e',
      // Thicker line for the strokes the user draws while practicing (default 4).
      drawingWidth: 24,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 400,
      onLoadCharDataError: () => setError(true),
    })
    writerRef.current = writer

    return () => {
      writerRef.current = null
      writer.cancelQuiz()
      container.innerHTML = ''
    }
    // Recreate only when the character changes; size changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char])

  useEffect(() => {
    writerRef.current?.updateDimensions({ width: size, height: size, padding: 5 })
  }, [size])

  useEffect(() => {
    const writer = writerRef.current
    if (!writer || error) return
    writer.cancelQuiz()
    if (mode === 'quiz') {
      void writer.hideCharacter()
      void writer.quiz({ showHintAfterMisses: 3 })
    } else {
      void writer.animateCharacter()
    }
  }, [mode, playToken, error])

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-teal-50 font-semibold text-teal-400"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        title="Không có dữ liệu thứ tự nét cho ký tự này"
      >
        {char}
      </div>
    )
  }

  return (
    <div
      className="relative rounded-2xl bg-white ring-1 ring-teal-100"
      style={{ width: size, height: size }}
    >
      <GuideGrid />
      <div ref={containerRef} className="relative" />
    </div>
  )
}

/**
 * Renders animated stroke-order (or an interactive writing quiz) for each
 * Chinese character in `text`. Boxes size themselves to fill the available
 * width (with fixed gaps), so they're as large as the device allows.
 * Character data is fetched on demand from the Hanzi Writer CDN, so this
 * requires a network connection.
 */
export function StrokeOrder({
  text,
  mode,
  playToken = 0,
}: {
  text: string
  mode: StrokeMode
  /** Bump this value to replay the animation / restart the quiz. */
  playToken?: number
}) {
  const chars = splitCjk(text)
  const rowRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return undefined
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (chars.length === 0) {
    return (
      <p className="text-center text-sm text-teal-600">
        Không có ký tự Hán để hiển thị thứ tự nét.
      </p>
    )
  }

  // Fit as many boxes per row as possible while keeping each near TARGET_BOX,
  // then let each box grow to fill the remaining width.
  const cols = width > 0 ? Math.max(1, Math.min(chars.length, Math.floor(width / TARGET_BOX))) : 1
  const size =
    width > 0 ? Math.min(MAX_BOX, Math.floor((width - GAP * (cols - 1)) / cols)) : TARGET_BOX

  return (
    <div ref={rowRef} className="flex flex-wrap justify-center" style={{ gap: GAP }}>
      {width > 0
        ? chars.map((char, index) => (
            <StrokeOrderChar
              key={`${char}-${index}`}
              char={char}
              size={size}
              mode={mode}
              playToken={playToken}
            />
          ))
        : null}
    </div>
  )
}
