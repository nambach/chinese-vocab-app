import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Hanzi } from '../components/Hanzi'
import { BigButton, BottomDrawer, Card, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'
import { useMediaQuery } from '../lib/device'
import { useHanziVariant } from '../lib/traditional'
import { speak } from '../lib/speech'
import type { Catalog } from '../models/types'
import { highlightIndices, savedWordsForLesson } from '../shadowing/savedWords'
import { lessonFromKewen, positionsOf } from '../shadowing/lessonView'
import { isPlaybackRate } from '../shadowing/segments'
import { useShadowingPlayer } from '../shadowing/useShadowingPlayer'
import type { ShadowingLesson, ShadowingSegment } from '../shadowing/types'
import { LastResultCard, PracticeActions, useCatalogMenu } from './catalogChrome'
import { ShadowingPlayerBody } from './ShadowingPlayerBody'

const EMPTY_LESSON: ShadowingLesson = {
  id: 'missing',
  title: '',
  audio: { type: 'file', src: '' },
  segments: [],
}

type LessonTab = 'kewen' | 'words' | 'practice'

const TABS: { id: LessonTab; label: string }[] = [
  { id: 'kewen', label: 'Bài khóa' },
  { id: 'words', label: 'Từ vựng' },
  { id: 'practice', label: 'Luyện tập' },
]

export function LessonScreen({ catalogId }: { catalogId: string }) {
  const { setView } = useApp()
  const catalog = useCatalog(catalogId)

  if (!catalog?.kewen) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bộ sưu tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  return <LessonBody catalog={catalog} />
}

function LessonBody({ catalog }: { catalog: Catalog }) {
  const { state, goBack, patchSettings, setView } = useApp()
  const lesson = useMemo(
    () => (catalog.kewen ? lessonFromKewen(catalog.kewen) : undefined),
    [catalog.kewen],
  )
  const [tab, setTab] = useState<LessonTab>('kewen')
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const savedRate = isPlaybackRate(state.settings.shadowPlaybackRate)
    ? state.settings.shadowPlaybackRate
    : 1
  const narrow = useMediaQuery('(max-width: 767px)')
  const player = useShadowingPlayer(lesson ?? EMPTY_LESSON, lesson ? container : null, {
    initialRate: savedRate,
    onRateChange: (rate) => patchSettings({ shadowPlaybackRate: rate }),
    waveHeight: narrow ? 64 : undefined,
    timelineHeight: narrow ? 16 : undefined,
  })
  const saved = useMemo(
    () => (lesson ? savedWordsForLesson(state.catalogs, lesson) : []),
    [lesson, state.catalogs],
  )
  const { menuItems, folderDrawer } = useCatalogMenu(catalog, {
    kewen: {
      onEdit: () => setView({ name: 'editKewen', catalogId: catalog.id }),
    },
  })

  function openSegment(index: number) {
    player.playSegment(index)
    setTab('kewen')
  }

  return (
    <ScreenShell
      title={catalog.name}
      subtitle={
        catalog.kewen?.textTitle
          ? `${catalog.kewen.textTitle} · ${catalog.words.length} từ`
          : `${catalog.words.length} từ`
      }
      onBack={() => goBack({ name: 'home' })}
      backLabel="Trang chủ"
      fillViewport
      menuItems={menuItems}
    >
      <div className="shrink-0 px-4 pt-3 md:px-8">
        <div role="tablist" aria-label="Phần bài học" className="grid grid-cols-3 gap-1 rounded-2xl bg-teal-100 p-1">
          {TABS.map((item) => {
            const selected = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={`rounded-xl px-2 py-2 text-sm font-semibold ${
                  selected ? 'bg-white text-teal-900 shadow-sm' : 'text-teal-700'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {lesson ? (
        <div className={tab === 'kewen' ? 'contents' : 'hidden'}>
          <ShadowingPlayerBody
            lesson={lesson}
            player={player}
            setContainer={setContainer}
            saved={saved}
            visible={tab === 'kewen'}
            saveCatalogId={catalog.id}
            onEditSentence={(segmentId) =>
              setView({ name: 'editKewen', catalogId: catalog.id, segmentId })
            }
          />
        </div>
      ) : tab === 'kewen' ? (
        <p className="px-4 py-6 text-teal-700 md:px-8">Bài khóa này không có trong dữ liệu.</p>
      ) : null}

      <div className={tab === 'words' ? 'contents' : 'hidden'}>
        <LessonVocab
          catalog={catalog}
          lesson={lesson}
          lessonId={lesson?.id ?? catalog.kewen?.lessonId ?? ''}
          onPlay={(index) => player.playSegment(index)}
          onOpen={openSegment}
        />
      </div>

      {tab === 'practice' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
          <div className="grid gap-3">
            <PracticeActions catalog={catalog} />
            <LastResultCard catalog={catalog} />
            {catalog.words.length === 0 ? (
              <Card className="text-center text-teal-700">
                Bộ sưu tập trống. Thêm từ để bắt đầu luyện tập.
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {folderDrawer}
    </ScreenShell>
  )
}

/** Sentence linking stays in the code, off until the sheet comes back. */
const SHOW_SENTENCE_LINKING = false

function LessonVocab({
  catalog,
  lesson,
  lessonId,
  onPlay,
  onOpen,
}: {
  catalog: Catalog
  lesson: ShadowingLesson | undefined
  lessonId: string
  onPlay: (index: number) => void
  onOpen: (index: number) => void
}) {
  const { state, patchSettings } = useApp()
  const showPinyin = state.settings.shadowShowPinyin
  const showMeaning = state.settings.shadowShowMeaning
  const [sourcesWordId, setSourcesWordId] = useState<string | null>(null)
  const sourcesWord = catalog.words.find((word) => word.id === sourcesWordId)

  function play(index: number) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    onPlay(index)
  }

  if (catalog.words.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
        <Card className="text-center text-teal-700">Bộ sưu tập trống. Thêm từ để bắt đầu luyện tập.</Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 justify-end gap-1 px-4 pt-3 md:px-8">
        <ToggleChip
          label="Pinyin"
          pressed={showPinyin}
          onClick={() => patchSettings({ shadowShowPinyin: !showPinyin })}
        />
        <ToggleChip
          label="Nghĩa"
          pressed={showMeaning}
          onClick={() => patchSettings({ shadowShowMeaning: !showMeaning })}
        />
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-8">
        {catalog.words.map((word) => {
          const positions = lesson ? positionsOf(word, lesson) : []
          const reading = positions.find((position) => position.section === 'shengci')
          const sentences = positions.filter((position) => position.section !== 'shengci')
          return (
            <li key={word.id} className="rounded-2xl bg-white p-4 ring-1 ring-teal-100">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-2xl font-semibold text-teal-950">
                    <Hanzi>{word.hanzi}</Hanzi>
                  </span>
                  {word.pinyin ? <span className="text-teal-800">({word.pinyin})</span> : null}
                  <AudioIconButton
                    label={`Đọc từ ${word.hanzi}`}
                    onClick={() => {
                      if (reading) play(reading.segmentIndex)
                      else speak(word.hanzi)
                    }}
                  />
                  {SHOW_SENTENCE_LINKING && lesson ? (
                    <button
                      type="button"
                      onClick={() => setSourcesWordId(word.id)}
                      className="rounded-full bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Vị trí
                    </button>
                  ) : null}
                </div>
                {word.meaning ? (
                  <p className="ml-auto text-right text-sm text-teal-700">{word.meaning}</p>
                ) : null}
              </div>
              {sentences.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {sentences.map((position) => (
                    <li
                      key={position.segmentId}
                      className="rounded-xl bg-teal-50 px-3 py-2 ring-1 ring-teal-100"
                    >
                      <div className="flex items-end gap-1">
                        <HighlightedQuote text={position.text} word={word.hanzi} />
                        <AudioIconButton
                          label={`Nghe câu: ${position.text}`}
                          onClick={() => play(position.segmentIndex)}
                        />
                        <IconButton
                          label={`Đến câu trong bài khóa: ${position.text}`}
                          onClick={() => onOpen(position.segmentIndex)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M9 6l6 6-6 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </IconButton>
                      </div>
                      {showPinyin && position.pinyin ? (
                        <p className="mt-1 text-sm text-teal-700">{position.pinyin}</p>
                      ) : null}
                      {showMeaning && position.meaning ? (
                        <p className="text-sm text-teal-600">{position.meaning}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
      {SHOW_SENTENCE_LINKING && sourcesWord && lesson ? (
        <WordSourcesDrawer
          open
          onClose={() => setSourcesWordId(null)}
          catalogId={catalog.id}
          word={sourcesWord}
          lesson={lesson}
          lessonId={lessonId}
        />
      ) : null}
    </div>
  )
}

function WordSourcesDrawer({
  open,
  onClose,
  catalogId,
  word,
  lesson,
  lessonId,
}: {
  open: boolean
  onClose: () => void
  catalogId: string
  word: Catalog['words'][number]
  lesson: ShadowingLesson
  lessonId: string
}) {
  const { setWordSources } = useApp()

  const [picked, setPicked] = useState(() => new Set<string>())

  useEffect(() => {
    if (!open) return
    setPicked(
      new Set(
        (word.sources ?? [])
          .filter((source) => source.lessonId === lessonId)
          .map((source) => source.segmentId),
      ),
    )
  }, [lessonId, open, word.id, word.sources])

  const suggested = useMemo(
    () => lesson.segments.filter((segment) => segment.text.includes(word.hanzi)),
    [lesson.segments, word.hanzi],
  )

  function toggle(segmentId: string) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(segmentId)) next.delete(segmentId)
      else next.add(segmentId)
      return next
    })
  }

  function save() {
    const lessonSources = [...picked].map((segmentId) => ({ lessonId, segmentId }))
    const otherSources = (word.sources ?? []).filter((source) => source.lessonId !== lessonId)
    setWordSources(catalogId, word.id, [...otherSources, ...lessonSources])
    onClose()
  }

  return (
    <BottomDrawer open={open} onClose={onClose} title={`Vị trí: ${word.hanzi}`}>
      <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto">
        {suggested.length > 0 ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-600">Gợi ý</h3>
            <SegmentPickList
              segments={suggested}
              allSegments={lesson.segments}
              picked={picked}
              onToggle={toggle}
            />
          </section>
        ) : null}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-600">Tất cả câu</h3>
          <SegmentPickList
            segments={lesson.segments}
            allSegments={lesson.segments}
            picked={picked}
            onToggle={toggle}
          />
        </section>
        <BigButton onClick={save}>Lưu vị trí</BigButton>
      </div>
    </BottomDrawer>
  )
}

function SegmentPickList({
  segments,
  allSegments,
  picked,
  onToggle,
}: {
  segments: ShadowingSegment[]
  allSegments: ShadowingSegment[]
  picked: Set<string>
  onToggle: (segmentId: string) => void
}) {
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {segments.map((segment) => {
        const index = allSegments.findIndex((item) => item.id === segment.id)
        return (
          <li key={segment.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-teal-50 px-3 py-2.5 ring-1 ring-teal-100">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-teal-700"
                checked={picked.has(segment.id)}
                onChange={() => onToggle(segment.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="text-xs text-teal-600">Câu {index + 1}</span>
                <Hanzi className="block text-base text-teal-950">{segment.text}</Hanzi>
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

function ToggleChip({
  label,
  pressed,
  onClick,
}: {
  label: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm font-semibold ${
        pressed ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-500'
      }`}
    >
      {label}
    </button>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-teal-700 hover:bg-teal-50"
    >
      {children}
    </button>
  )
}

function AudioIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconButton label={label} onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 9v6h4l5 4V5L8 9H4z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 8.5a4 4 0 010 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </IconButton>
  )
}

function HighlightedQuote({ text, word }: { text: string; word: string }) {
  const { state } = useApp()
  const converted = useHanziVariant(state.settings.hanziVariant, text)
  const simplified = Array.from(text)
  const convertedChars = Array.from(converted)
  const display = convertedChars.length === simplified.length ? convertedChars : simplified
  const marks = highlightIndices(simplified, [word])

  return (
    <p className="min-w-0 flex-1 text-lg leading-relaxed text-teal-950" style={{ fontFamily: 'var(--hanzi-font, inherit)' }}>
      {display.map((char, index) => (
        <span key={index} className={marks.has(index) ? 'rounded-sm bg-amber-300' : undefined}>
          {char}
        </span>
      ))}
    </p>
  )
}
