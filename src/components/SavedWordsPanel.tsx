import { useEffect } from 'react'
import { Hanzi } from './Hanzi'
import { useApp } from '../context/AppContext'
import { useHanziVariant } from '../lib/traditional'
import { highlightIndices, type SavedWord } from '../shadowing/savedWords'
import type { ShadowingSegment } from '../shadowing/types'

export function SavedWordsPanel({
  segments,
  saved,
  onClose,
  onPlay,
}: {
  segments: ShadowingSegment[]
  saved: SavedWord[]
  onClose: () => void
  onPlay: (segmentIndex: number) => void
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 md:px-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-words-title"
        className="animate-dialog-in relative z-50 flex max-h-[80dvh] min-h-[55dvh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 px-5 pt-5">
          <h2 id="saved-words-title" className="text-base font-bold text-teal-900">
            Từ đã lưu ({saved.length})
          </h2>
          <button
            type="button"
            aria-label="Đóng"
            autoFocus
            onClick={onClose}
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-teal-800 hover:bg-teal-50"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {saved.length === 0 ? (
            <p className="text-sm text-teal-700">
              Chưa lưu từ nào từ bài này. Mở chi tiết câu, chọn chữ rồi bấm Lưu.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {saved.map((entry) => {
                const segment = segments[entry.segmentIndex]
                return (
                  <li
                    key={`${entry.catalogId}:${entry.word.id}:${segment.id}`}
                    className="rounded-2xl px-4 py-3 ring-1 ring-teal-100"
                  >
                    <div className="flex items-baseline gap-3">
                      <Hanzi className="text-3xl text-teal-950">{entry.word.hanzi}</Hanzi>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-teal-700">{entry.word.pinyin}</p>
                        <p className="text-base font-medium text-teal-900">{entry.word.meaning}</p>
                      </div>
                      <span className="shrink-0 text-xs text-teal-600">{entry.catalogName}</span>
                    </div>
                    <div className="mt-3 rounded-xl bg-teal-50 px-3 py-2">
                      <HighlightedSentence text={segment.text} word={entry.word.hanzi} />
                      {segment.meaning ? (
                        <p className="mt-1 text-sm text-teal-700">{segment.meaning}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onPlay(entry.segmentIndex)}
                      className="mt-3 flex items-center gap-1.5 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5.5v13l11-6.5-11-6.5z" />
                      </svg>
                      Nghe câu {entry.segmentIndex + 1}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function HighlightedSentence({ text, word }: { text: string; word: string }) {
  const { state } = useApp()
  const converted = useHanziVariant(state.settings.hanziVariant, text)
  const simplified = Array.from(text)
  const convertedChars = Array.from(converted)
  const display = convertedChars.length === simplified.length ? convertedChars : simplified
  const marks = highlightIndices(simplified, [word])

  return (
    <p
      className="text-xl leading-relaxed text-teal-950"
      style={{ fontFamily: 'var(--hanzi-font, inherit)' }}
    >
      {display.map((char, index) => (
        <span key={index} className={marks.has(index) ? 'rounded bg-amber-200' : undefined}>
          {char}
        </span>
      ))}
    </p>
  )
}
