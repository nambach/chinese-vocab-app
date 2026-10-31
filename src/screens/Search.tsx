import { useMemo, useState } from 'react'
import { Hanzi } from '../components/Hanzi'
import { HighlightedText } from '../components/HighlightedText'
import { ScreenShell } from '../components/ui'
import { useApp } from '../context/AppContext'
import { searchSentences, searchWords, type SentenceHit, type WordHit } from '../data/search'
import type { Catalog, Folder } from '../models/types'

type SearchMode = 'words' | 'kewen'

let rememberedQuery = ''
let rememberedMode: SearchMode = 'words'

function lessonCaption(catalogs: Catalog[], folders: Folder[], catalogId: string, fallback: string): string {
  const catalog = catalogs.find((item) => item.id === catalogId)
  if (!catalog) return fallback
  const folder = catalog.folderId ? folders.find((item) => item.id === catalog.folderId) : undefined
  return folder ? `${catalog.name} · ${folder.name}` : catalog.name
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-teal-400">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Search() {
  const { state, setView } = useApp()
  const [query, setQuery] = useState(rememberedQuery)
  const [mode, setMode] = useState<SearchMode>(rememberedMode)
  const trimmed = query.trim()
  const showPinyin = state.settings.shadowShowPinyin
  const showMeaning = state.settings.shadowShowMeaning

  const wordHits = useMemo(() => searchWords(state.catalogs, trimmed), [state.catalogs, trimmed])
  const sentenceHits = useMemo(
    () => searchSentences(state.catalogs, trimmed),
    [state.catalogs, trimmed],
  )

  function changeQuery(value: string) {
    rememberedQuery = value
    setQuery(value)
  }

  function changeMode(next: SearchMode) {
    rememberedMode = next
    setMode(next)
  }

  const hits = mode === 'words' ? wordHits : sentenceHits

  return (
    <ScreenShell
      title="Tra cứu"
      onBack={() => setView({ name: 'home' })}
      backLabel="Trang chủ"
      fillViewport
      headerExtra={
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teal-500">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Hán tự, pinyin hoặc nghĩa"
            aria-label="Tra cứu"
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="w-full rounded-2xl border border-teal-200 bg-teal-50 py-3 pl-10 pr-10 text-base text-teal-950 outline-none focus:border-teal-500"
          />
          {query ? (
            <button
              type="button"
              aria-label="Xóa"
              onClick={() => changeQuery('')}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-teal-500 active:bg-teal-100"
            >
              ×
            </button>
          ) : null}
        </div>
      }
    >
      <div className="shrink-0 px-4 pt-3 md:px-8">
        <div role="tablist" aria-label="Chỗ tìm" className="grid grid-cols-2 gap-1 rounded-2xl bg-teal-100 p-1">
          {(
            [
              ['words', 'Từ vựng', wordHits.length],
              ['kewen', 'Bài khóa', sentenceHits.length],
            ] as const
          ).map(([id, label, count]) => {
            const selected = mode === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => changeMode(id)}
                className={`rounded-xl px-2 py-2 text-sm font-semibold ${
                  selected ? 'bg-white text-teal-900 shadow-sm' : 'text-teal-700'
                }`}
              >
                {label}
                {trimmed ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {!trimmed ? (
        <p className="px-4 py-6 text-sm text-teal-700 md:px-8">
          Gõ Hán tự, pinyin hoặc nghĩa để xem từ đó nằm ở bài nào.
        </p>
      ) : hits.length === 0 ? (
        <p className="px-4 py-6 text-sm text-teal-700 md:px-8">Không thấy «{trimmed}».</p>
      ) : mode === 'words' ? (
        <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-8">
          {wordHits.map((hit) => (
            <li key={`${hit.catalogId}:${hit.word.id}`}>
              <WordHitButton
                hit={hit}
                caption={lessonCaption(state.catalogs, state.folders, hit.catalogId, hit.catalogName)}
                onOpen={() =>
                  setView({ name: 'catalog', catalogId: hit.catalogId, focus: { wordId: hit.word.id } })
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-8">
          {sentenceHits.map((hit) => (
            <li key={`${hit.catalogId}:${hit.segment.id}`}>
              <SentenceHitButton
                hit={hit}
                query={trimmed}
                caption={lessonCaption(state.catalogs, state.folders, hit.catalogId, hit.catalogName)}
                showPinyin={showPinyin || hit.matchIn === 'pinyin'}
                showMeaning={showMeaning}
                onOpen={() =>
                  setView({
                    name: 'catalog',
                    catalogId: hit.catalogId,
                    focus: { segmentId: hit.segment.id },
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </ScreenShell>
  )
}

function WordHitButton({ hit, caption, onOpen }: { hit: WordHit; caption: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-teal-100 active:bg-teal-50"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-semibold text-teal-950">
            <Hanzi>{hit.word.hanzi}</Hanzi>
          </span>
          {hit.word.pinyin ? <span className="text-teal-800">{hit.word.pinyin}</span> : null}
        </span>
        {hit.word.meaning ? <span className="mt-0.5 block text-sm text-teal-700">{hit.word.meaning}</span> : null}
        <span className="mt-1 block text-xs text-teal-500">{caption}</span>
      </span>
      <Chevron />
    </button>
  )
}

function SentenceHitButton({
  hit,
  query,
  caption,
  showPinyin,
  showMeaning,
  onOpen,
}: {
  hit: SentenceHit
  query: string
  caption: string
  showPinyin: boolean
  showMeaning: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-teal-100 active:bg-teal-50"
    >
      <span className="min-w-0 flex-1">
        <HighlightedText
          text={hit.segment.text}
          query={hit.matchIn === 'hanzi' ? query : ''}
          className="text-lg leading-relaxed text-teal-950"
        />
        {showPinyin && hit.segment.pinyin ? (
          <HighlightedText
            text={hit.segment.pinyin}
            query={hit.matchIn === 'pinyin' ? query : ''}
            mode="pinyin"
            className="mt-1 text-sm text-teal-700"
          />
        ) : null}
        {showMeaning && hit.segment.meaning ? (
          <span className="mt-0.5 block text-sm text-teal-600">{hit.segment.meaning}</span>
        ) : null}
        <span className="mt-1 block text-xs text-teal-500">{caption}</span>
      </span>
      <Chevron />
    </button>
  )
}
