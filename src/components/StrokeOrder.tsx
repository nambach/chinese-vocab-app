import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
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

type CharHandle = {
  play: () => Promise<void>
  stop: () => void
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

const StrokeOrderChar = forwardRef<
  CharHandle,
  { char: string; size: number; mode: StrokeMode; playToken: number }
>(function StrokeOrderChar({ char, size, mode, playToken }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriter | null>(null)
  const [error, setError] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      play: () =>
        new Promise<void>((resolve) => {
          const writer = writerRef.current
          if (!writer) {
            resolve()
            return
          }
          writer.cancelQuiz()
          void writer.animateCharacter({ onComplete: () => resolve() })
        }),
      stop: () => {
        // Instantly cancel any running animation and reset to outline only.
        writerRef.current?.hideCharacter({ duration: 0 })
      },
    }),
    [],
  )

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
    if (mode === 'quiz') {
      writer.cancelQuiz()
      void writer.hideCharacter({ duration: 0 })
      void writer.quiz({ showHintAfterMisses: 3 })
    } else {
      // In animate mode the parent orchestrates playback; just reset to outline.
      writer.cancelQuiz()
      void writer.hideCharacter({ duration: 0 })
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
})

function PlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Phát nét chữ này"
      title="Phát nét chữ này"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200 transition active:scale-95"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  )
}

function CharCarousel({
  chars,
  index,
  onSelect,
}: {
  chars: string[]
  index: number
  onSelect: (index: number) => void
}) {
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    chipRefs.current[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [index])

  return (
    <div className="w-full">
      <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-teal-600">
        Chọn chữ để luyện
      </p>
      <div className="flex justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chars.map((char, i) => {
          const active = i === index
          return (
            <button
              key={`${char}-${i}`}
              ref={(element) => {
                chipRefs.current[i] = element
              }}
              type="button"
              onClick={() => onSelect(i)}
              className={`shrink-0 rounded-2xl px-3 py-2 text-center transition ${
                active
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-teal-800 ring-1 ring-teal-200 active:bg-teal-50'
              }`}
            >
              <span className="block text-lg font-medium">{char}</span>
              <span className={`mt-0.5 block text-[10px] ${active ? 'text-teal-100' : 'text-teal-500'}`}>
                {i + 1}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Renders animated stroke-order (or an interactive writing quiz) for each
 * Chinese character in `text`. In animate mode the characters auto-play in
 * order when opened, and each has its own play button that stops the others
 * and replays just that character. Boxes size themselves to fill the
 * available width. Character data is fetched on demand from the Hanzi Writer
 * CDN, so this requires a network connection.
 */
export function StrokeOrder({
  text,
  mode,
  playToken = 0,
}: {
  text: string
  mode: StrokeMode
  /** Bump this value to replay from the start / restart the quiz. */
  playToken?: number
}) {
  const chars = splitCjk(text)
  const rowRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const charRefs = useRef<Array<CharHandle | null>>([])
  const runIdRef = useRef(0)
  const [quizIndex, setQuizIndex] = useState(0)

  useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return undefined
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const charsKey = chars.join('')

  // Reset to the first character when the word or mode changes.
  useEffect(() => {
    setQuizIndex(0)
  }, [charsKey, mode])

  // Auto-play all characters in order whenever the drawer opens or replay is
  // requested (animate mode only).
  useEffect(() => {
    if (mode !== 'animate' || width === 0 || chars.length === 0) return
    const myRun = runIdRef.current + 1
    runIdRef.current = myRun

    let cancelled = false
    const timer = window.setTimeout(async () => {
      for (let i = 0; i < chars.length; i += 1) {
        if (cancelled || runIdRef.current !== myRun) return
        await charRefs.current[i]?.play()
      }
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, playToken, width, charsKey])

  const playOne = (index: number) => {
    // Invalidate any running auto-play sequence, stop the others, play this one.
    runIdRef.current += 1
    charRefs.current.forEach((handle, i) => {
      if (i !== index) handle?.stop()
    })
    void charRefs.current[index]?.play()
  }

  if (chars.length === 0) {
    return (
      <p className="text-center text-sm text-teal-600">
        Không có ký tự Hán để hiển thị thứ tự nét.
      </p>
    )
  }

  // Animate mode: fit multiple boxes per row, sized to fill the width.
  const cols = width > 0 ? Math.max(1, Math.min(chars.length, Math.floor(width / TARGET_BOX))) : 1
  const gridSize =
    width > 0 ? Math.min(MAX_BOX, Math.floor((width - GAP * (cols - 1)) / cols)) : TARGET_BOX
  // Quiz mode: one large box, sized to fill the width.
  const soloSize = width > 0 ? Math.min(MAX_BOX, width) : TARGET_BOX

  const quizCarousel = mode === 'quiz' && chars.length > 1

  return (
    <div ref={rowRef} className="flex w-full flex-col items-center gap-3">
      {width === 0 ? null : quizCarousel ? (
        <>
          <StrokeOrderChar
            key={`quiz-${quizIndex}-${chars[quizIndex]}`}
            char={chars[quizIndex]}
            size={soloSize}
            mode="quiz"
            playToken={playToken}
          />
          <CharCarousel chars={chars} index={quizIndex} onSelect={setQuizIndex} />
        </>
      ) : mode === 'quiz' ? (
        <StrokeOrderChar char={chars[0]} size={soloSize} mode="quiz" playToken={playToken} />
      ) : (
        <div className="flex w-full flex-wrap justify-center" style={{ gap: GAP }}>
          {chars.map((char, index) => (
            <div key={`${char}-${index}`} className="flex flex-col items-center gap-2">
              <StrokeOrderChar
                ref={(handle) => {
                  charRefs.current[index] = handle
                }}
                char={char}
                size={gridSize}
                mode={mode}
                playToken={playToken}
              />
              <PlayButton onClick={() => playOne(index)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
