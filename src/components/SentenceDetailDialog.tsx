import { useEffect, useState, type ReactNode } from 'react'
import { Hanzi } from './Hanzi'
import { WordCard } from './WordCard'
import { Select } from './ui'
import { useApp } from '../context/AppContext'
import { copyText } from '../lib/clipboard'
import { useHanziVariant } from '../lib/traditional'
import {
  buildContextNote,
  nextSelection,
  noteWithContext,
  selectedText,
  splitSentence,
  type CharSelection,
} from '../shadowing/selection'
import { hasSource, highlightIndices, withSource, type SavedWord } from '../shadowing/savedWords'
import type { ShadowingSegment } from '../shadowing/types'
import type { Word, WordDraft } from '../models/types'

const NEW_CATALOG = '__new__'
const DEFAULT_CATALOG_NAME = 'Từ trong hội thoại'

type CopyTarget = 'selection' | 'sentence'

export function SentenceDetailDialog({
  lessonId,
  segment,
  index,
  total,
  saved,
  onClose,
  onPlay,
}: {
  lessonId: string
  segment: ShadowingSegment
  index: number
  total: number
  /** Words already saved from this sentence. */
  saved: SavedWord[]
  onClose: () => void
  onPlay: () => void
}) {
  const { state, addCatalog, addWord, updateWord, patchSettings } = useApp()
  const variant = state.settings.hanziVariant
  const converted = useHanziVariant(variant, segment.text)
  const simplifiedCells = splitSentence(segment.text)
  const convertedCells = splitSentence(converted)
  const displayCells =
    convertedCells.length === simplifiedCells.length ? convertedCells : simplifiedCells
  const displayChars = displayCells.map((cell) => cell.char)
  const simplifiedChars = simplifiedCells.map((cell) => cell.char)
  const savedMarks = highlightIndices(
    simplifiedChars,
    saved.map((entry) => entry.word.hanzi),
  )

  const [selection, setSelection] = useState<CharSelection>(null)
  const [step, setStep] = useState<'sentence' | 'save'>('sentence')
  const [copied, setCopied] = useState<CopyTarget | null>(null)
  const [copyFailed, setCopyFailed] = useState<CopyTarget | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [catalogChoice, setCatalogChoice] = useState(NEW_CATALOG)
  const [newName, setNewName] = useState(DEFAULT_CATALOG_NAME)
  const [draft, setDraft] = useState<WordDraft>({
    hanzi: '',
    pinyin: '',
    meaning: '',
    note: '',
  })
  const [creatingNew, setCreatingNew] = useState(false)
  const [linkWordId, setLinkWordId] = useState<string | null>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!copied && !copyFailed) return undefined
    const timeout = window.setTimeout(() => {
      setCopied(null)
      setCopyFailed(null)
    }, 1500)
    return () => window.clearTimeout(timeout)
  }, [copied, copyFailed])

  useEffect(() => {
    if (!savedName) return undefined
    const timeout = window.setTimeout(() => setSavedName(null), 2000)
    return () => window.clearTimeout(timeout)
  }, [savedName])

  const shown = selectedText(displayChars, selection)
  const storedHanzi = selectedText(simplifiedChars, selection)
  const picked = Boolean(selection) && shown.length > 0
  const chosenCatalog = state.catalogs.find((catalog) => catalog.id === catalogChoice)
  const matches =
    chosenCatalog?.words.filter((word) => word.hanzi === draft.hanzi.trim()) ?? []
  const selectedMatch = matches.find((word) => word.id === linkWordId) ?? matches[0]
  const alreadyLinked = selectedMatch ? hasSource(selectedMatch, lessonId, segment.id) : false

  function defaultCatalogId() {
    const savedId = state.settings.shadowSaveCatalogId
    if (savedId && state.catalogs.some((catalog) => catalog.id === savedId)) return savedId
    return state.catalogs[0]?.id ?? NEW_CATALOG
  }

  function tapChar(charIndex: number) {
    setSelection((current) => nextSelection(current, charIndex, displayCells))
    setCopied(null)
    setCopyFailed(null)
  }

  async function copy(target: CopyTarget, text: string) {
    const ok = await copyText(text)
    setCopied(ok ? target : null)
    setCopyFailed(ok ? null : target)
  }

  function openSave() {
    setDraft({
      hanzi: storedHanzi,
      pinyin: '',
      meaning: '',
      note: buildContextNote(segment),
    })
    setCatalogChoice(defaultCatalogId())
    setNewName(DEFAULT_CATALOG_NAME)
    setCreatingNew(false)
    setLinkWordId(null)
    setStep('save')
  }

  function chooseCatalog(catalogId: string) {
    setCatalogChoice(catalogId)
    setCreatingNew(false)
    setLinkWordId(null)
  }

  function saveWord() {
    const catalog =
      catalogChoice === NEW_CATALOG
        ? addCatalog(newName.trim() || DEFAULT_CATALOG_NAME)
        : state.catalogs.find((item) => item.id === catalogChoice)
    if (!catalog) return

    const note = draft.note?.trim()
    addWord(catalog.id, {
      hanzi: draft.hanzi.trim(),
      pinyin: draft.pinyin.trim(),
      meaning: draft.meaning.trim(),
      ...(note ? { note } : {}),
      sources: [{ lessonId, segmentId: segment.id }],
    })
    patchSettings({ shadowSaveCatalogId: catalog.id })
    setSavedName(`Đã lưu vào ${catalog.name}`)
    setSelection(null)
    setCreatingNew(false)
    setStep('sentence')
  }

  function linkExisting() {
    if (!chosenCatalog || !selectedMatch || alreadyLinked) return
    updateWord(chosenCatalog.id, {
      ...selectedMatch,
      note: noteWithContext(selectedMatch.note, segment),
      sources: withSource(selectedMatch, { lessonId, segmentId: segment.id }),
    })
    patchSettings({ shadowSaveCatalogId: chosenCatalog.id })
    setSavedName(`Đã gắn vào ${chosenCatalog.name}`)
    setSelection(null)
    setCreatingNew(false)
    setStep('sentence')
  }

  function copyLabel(target: CopyTarget, idle: string) {
    if (copied === target) return 'Đã copy'
    if (copyFailed === target) return 'Không copy được'
    return idle
  }

  const catalogOptions = [
    ...state.catalogs.map((catalog) => ({ value: catalog.id, label: catalog.name })),
    { value: NEW_CATALOG, label: '+ Tạo bộ mới…' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 md:px-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sentence-detail-title"
        className="animate-dialog-in relative z-50 flex max-h-[75dvh] min-h-[55dvh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 px-5 pt-5">
          <h2 id="sentence-detail-title" className="text-sm font-semibold text-teal-700">
            Câu {index + 1}/{total}
          </h2>
          <button
            type="button"
            onClick={onPlay}
            className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800"
          >
            Nghe câu
          </button>
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
          {step === 'sentence' ? (
            <>
              <div
                className="flex flex-wrap text-4xl leading-relaxed text-teal-950"
                style={{ fontFamily: 'var(--hanzi-font, inherit)' }}
              >
                {displayCells.map((cell, charIndex) => {
                  const inRange = Boolean(
                    selection && charIndex >= selection.start && charIndex <= selection.end,
                  )
                  const tint = inRange
                    ? 'bg-amber-200 text-teal-950'
                    : savedMarks.has(charIndex)
                      ? 'bg-teal-100'
                      : ''
                  if (!cell.selectable) {
                    return (
                      <span key={charIndex} className={`rounded ${tint}`}>
                        {cell.char}
                      </span>
                    )
                  }
                  return (
                    <button
                      key={charIndex}
                      type="button"
                      aria-pressed={inRange}
                      onClick={() => tapChar(charIndex)}
                      className={`rounded ${tint}`}
                    >
                      {cell.char}
                    </button>
                  )
                })}
              </div>
              {segment.pinyin ? <p className="mt-4 text-lg text-teal-700">{segment.pinyin}</p> : null}
              {segment.meaning ? <p className="mt-1 text-lg text-teal-800">{segment.meaning}</p> : null}
              {saved.length > 0 ? (
                <section className="mt-5 border-t border-teal-100 pt-4">
                  <h3 className="text-sm font-semibold text-teal-700">
                    Đã lưu từ câu này ({saved.length})
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {saved.map((entry) => (
                      <li
                        key={`${entry.catalogId}:${entry.word.id}`}
                        className="flex items-baseline gap-3 rounded-2xl bg-teal-50 px-4 py-2"
                      >
                        <Hanzi className="text-2xl text-teal-950">{entry.word.hanzi}</Hanzi>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-teal-700">{entry.word.pinyin}</p>
                          <p className="text-sm text-teal-900">{entry.word.meaning}</p>
                        </div>
                        <span className="shrink-0 text-xs text-teal-600">{entry.catalogName}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <Select
                label="Lưu vào bộ"
                value={catalogChoice}
                options={catalogOptions}
                onChange={chooseCatalog}
              />
              {catalogChoice === NEW_CATALOG ? (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-teal-800">Tên bộ mới</span>
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-4 text-lg text-teal-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </label>
              ) : null}
              {matches.length > 0 && !creatingNew ? (
                <ExistingWordList
                  matches={matches}
                  selectedId={selectedMatch?.id ?? null}
                  alreadyLinked={alreadyLinked}
                  onSelect={setLinkWordId}
                  onLink={linkExisting}
                  onCreateNew={() => setCreatingNew(true)}
                  onCancel={() => setStep('sentence')}
                />
              ) : (
                <>
                  {matches.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setCreatingNew(false)}
                      className="self-start text-sm font-semibold text-teal-700"
                    >
                      Gắn vào từ đã có
                    </button>
                  ) : null}
                  <WordCard
                    value={draft}
                    onChange={setDraft}
                    onSave={saveWord}
                    onCancel={() => setStep('sentence')}
                    saveLabel="Lưu từ"
                    toneNumberInput={state.settings.toneNumberInput}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {step === 'sentence' ? (
          <div className="border-t border-teal-100 px-5 py-4">
            {picked ? (
              <>
                <p
                  className="text-3xl text-teal-950"
                  style={{ fontFamily: 'var(--hanzi-font, inherit)' }}
                >
                  {shown}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <FooterButton onClick={() => void copy('selection', shown)}>
                    {copyLabel('selection', 'Copy')}
                  </FooterButton>
                  <FooterButton onClick={openSave}>
                    <BookmarkIcon />
                    Lưu
                  </FooterButton>
                  <FooterButton tone="secondary" onClick={() => setSelection(null)}>
                    Bỏ chọn
                  </FooterButton>
                </div>
              </>
            ) : (
              <>
                {savedName ? (
                  <p className="text-sm font-semibold text-teal-800">{savedName}</p>
                ) : (
                  <p className="text-sm text-teal-600">Chạm từng chữ để chọn từ, chạm lại chữ ở đầu hoặc cuối để bỏ</p>
                )}
                <FooterButton
                  tone="secondary"
                  className="mt-3 w-full"
                  onClick={() => void copy('sentence', displayChars.join(''))}
                >
                  {copyLabel('sentence', 'Copy cả câu')}
                </FooterButton>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ExistingWordList({
  matches,
  selectedId,
  alreadyLinked,
  onSelect,
  onLink,
  onCreateNew,
  onCancel,
}: {
  matches: Word[]
  selectedId: string | null
  alreadyLinked: boolean
  onSelect: (wordId: string) => void
  onLink: () => void
  onCreateNew: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-teal-700">Bộ này đã có từ này</p>
      <div
        className="flex flex-col gap-2"
        role={matches.length > 1 ? 'radiogroup' : undefined}
        aria-label={matches.length > 1 ? 'Từ đã có' : undefined}
      >
        {matches.map((word) => {
          const selected = word.id === selectedId
          const className = `rounded-2xl px-4 py-3 text-left ring-1 ${
            selected ? 'bg-teal-50 ring-teal-500' : 'bg-white ring-teal-100'
          }`
          const body = (
            <>
              <Hanzi className="text-2xl text-teal-950">{word.hanzi}</Hanzi>
              <p className="text-sm text-teal-700">{word.pinyin}</p>
              <p className="text-sm text-teal-800">{word.meaning}</p>
            </>
          )
          if (matches.length === 1) {
            return (
              <div key={word.id} className={className}>
                {body}
              </div>
            )
          }
          return (
            <button
              key={word.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(word.id)}
              className={className}
            >
              {body}
            </button>
          )
        })}
      </div>
      <FooterButton onClick={onLink} disabled={alreadyLinked}>
        {alreadyLinked ? 'Đã gắn câu này' : 'Gắn câu này'}
      </FooterButton>
      <FooterButton tone="secondary" onClick={onCreateNew}>
        Lưu thành từ mới
      </FooterButton>
      <FooterButton tone="secondary" onClick={onCancel}>
        Hủy
      </FooterButton>
    </div>
  )
}

function FooterButton({
  children,
  onClick,
  tone = 'primary',
  className = '',
  disabled = false,
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'primary' | 'secondary'
  className?: string
  disabled?: boolean
}) {
  const colors =
    tone === 'primary' ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-800'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-sm font-semibold disabled:opacity-50 ${colors} ${className}`}
    >
      {children}
    </button>
  )
}

export function ExpandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BookmarkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
