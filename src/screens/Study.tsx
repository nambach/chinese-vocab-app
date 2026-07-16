import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'
import type { Word } from '../models/types'

type StudyProps = {
  catalogId: string
  wordIndex?: number
}

const SWIPE_THRESHOLD = 48

function StudyCard({ word }: { word: Word }) {
  return (
    <Card className="flex min-h-[min(52dvh,360px)] select-none flex-col items-center justify-center p-6 text-center md:min-h-[320px] md:p-10">
      <div className="text-5xl font-bold text-teal-950 md:text-6xl">{word.hanzi}</div>
      <div className="mt-5 text-2xl text-teal-800 md:text-3xl">{word.pinyin}</div>
      <div className="mt-3 text-lg text-teal-700 md:text-xl">{word.meaning}</div>
    </Card>
  )
}

function NavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const label = direction === 'prev' ? 'Từ trước' : 'Từ sau'

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-teal-800 ring-1 ring-teal-200 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 md:h-14 md:w-14"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {direction === 'prev' ? (
          <path
            d="M14 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M10 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}

export function Study({ catalogId, wordIndex = 0 }: StudyProps) {
  const { setView, goBack } = useApp()
  const catalog = useCatalog(catalogId)
  const words = catalog?.words ?? []
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(wordIndex, 0), Math.max(words.length - 1, 0)),
  )
  const touchStartX = useRef<number | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([])

  const currentWord = words[index]
  const hasWords = words.length > 0

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1))
  }, [])

  const goNext = useCallback(() => {
    setIndex((current) => Math.min(words.length - 1, current + 1))
  }, [words.length])

  useEffect(() => {
    if (!hasWords) return
    setIndex((current) => Math.min(current, words.length - 1))
  }, [hasWords, words.length])

  useEffect(() => {
    const chip = chipRefs.current[index]
    chip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [index])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') goPrev()
      if (event.key === 'ArrowRight') goNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev])

  if (!catalog) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bộ sưu tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  if (!hasWords) {
    return (
      <ScreenShell
        title="Học"
        subtitle={catalog.name}
        onBack={() => goBack({ name: 'catalog', catalogId })}
        backLabel={catalog.name}
      >
        <Card className="text-center text-teal-700">
          Bộ sưu tập trống. Thêm từ để bắt đầu học.
        </Card>
      </ScreenShell>
    )
  }

  function handleTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const startX = touchStartX.current
    const endX = event.changedTouches[0]?.clientX
    touchStartX.current = null
    if (startX === null || endX === undefined) return

    const delta = endX - startX
    if (Math.abs(delta) < SWIPE_THRESHOLD) return
    if (delta > 0) goPrev()
    else goNext()
  }

  return (
    <ScreenShell
      title="Học"
      subtitle={`${catalog.name} · ${index + 1}/${words.length}`}
      onBack={() => goBack({ name: 'catalog', catalogId })}
      backLabel={catalog.name}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex min-h-0 flex-1 items-center gap-3">
          <NavButton direction="prev" disabled={index === 0} onClick={goPrev} />

          <div
            className="min-w-0 flex-1 touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {currentWord ? <StudyCard word={currentWord} /> : null}
          </div>

          <NavButton direction="next" disabled={index === words.length - 1} onClick={goNext} />
        </div>

        <div className="shrink-0">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-teal-600">
            Vuốt hoặc chọn từ
          </p>
          <div
            ref={carouselRef}
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {words.map((word, wordIdx) => {
              const active = wordIdx === index
              return (
                <button
                  key={word.id}
                  ref={(element) => {
                    chipRefs.current[wordIdx] = element
                  }}
                  type="button"
                  onClick={() => setIndex(wordIdx)}
                  className={`shrink-0 rounded-2xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'bg-white text-teal-800 ring-1 ring-teal-200 active:bg-teal-50'
                  }`}
                >
                  <span className="block max-w-[4.5rem] truncate">{word.hanzi}</span>
                  <span
                    className={`mt-0.5 block text-[10px] ${
                      active ? 'text-teal-100' : 'text-teal-500'
                    }`}
                  >
                    {wordIdx + 1}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </ScreenShell>
  )
}
