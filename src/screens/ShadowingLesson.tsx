import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Hanzi } from '../components/Hanzi'
import { SavedWordsPanel } from '../components/SavedWordsPanel'
import {
  BookmarkIcon,
  ExpandIcon,
  SentenceDetailDialog,
} from '../components/SentenceDetailDialog'
import { ScreenShell } from '../components/ui'
import { useApp } from '../context/AppContext'
import { getShadowingLesson } from '../data/shadowing'
import { useIsDesktop } from '../lib/device'
import { savedWordsForLesson } from '../shadowing/savedWords'
import { PLAYBACK_RATES, formatClock, isPlaybackRate } from '../shadowing/segments'
import { useShadowingPlayer } from '../shadowing/useShadowingPlayer'
import type { ShadowingLesson as ShadowingLessonData } from '../shadowing/types'

type JumpButton = {
  phase: 'hidden' | 'shown' | 'leaving'
  direction: 'up' | 'down'
}

export function ShadowingLesson({ lessonId }: { lessonId: string }) {
  const lesson = getShadowingLesson(lessonId)
  if (!lesson) return <MissingLesson />
  return <ShadowingPlayerScreen lesson={lesson} />
}

function MissingLesson() {
  const { setView } = useApp()
  return (
    <ScreenShell title="Không thấy bài" onBack={() => setView({ name: 'shadowingList' })}>
      <p className="text-teal-700">Bài này không có trong dữ liệu shadowing.</p>
    </ScreenShell>
  )
}

function ShadowingPlayerScreen({ lesson }: { lesson: ShadowingLessonData }) {
  const { state, setView, patchSettings } = useApp()
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const savedRate = isPlaybackRate(state.settings.shadowPlaybackRate)
    ? state.settings.shadowPlaybackRate
    : 1
  const showPinyin = state.settings.shadowShowPinyin
  const showMeaning = state.settings.shadowShowMeaning
  const desktop = useIsDesktop()

  const player = useShadowingPlayer(lesson, container, {
    initialRate: savedRate,
    onRateChange: (rate) => patchSettings({ shadowPlaybackRate: rate }),
  })

  const listRef = useRef<HTMLOListElement>(null)
  const itemRefs = useRef<Array<HTMLLIElement | null>>([])
  const detailButtonRef = useRef<HTMLButtonElement>(null)
  const savedButtonRef = useRef<HTMLButtonElement>(null)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const overlayOpenRef = useRef(false)
  overlayOpenRef.current = detailIndex !== null || savedOpen
  const saved = useMemo(() => savedWordsForLesson(state.catalogs, lesson), [state.catalogs, lesson])
  const actionsRef = useRef(player)
  actionsRef.current = player
  const activeIndexRef = useRef(player.activeIndex)
  activeIndexRef.current = player.activeIndex
  const followScroll = useRef(false)
  const scrollFrame = useRef<number | null>(null)
  const [jump, setJump] = useState<JumpButton>({ phase: 'hidden', direction: 'down' })

  const activePlacement = useCallback((): { outside: boolean; direction: 'up' | 'down' } | null => {
    const list = listRef.current
    const item = itemRefs.current[activeIndexRef.current]
    if (!list || !item) return null
    const listRect = list.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    const visibleHeight =
      Math.min(itemRect.bottom, listRect.bottom) - Math.max(itemRect.top, listRect.top)
    const outside = visibleHeight < itemRect.height * 0.5
    const direction = itemRect.top < listRect.top ? 'up' : 'down'
    return { outside, direction }
  }, [])

  const scrollIndexIntoView = useCallback((index: number, behavior: ScrollBehavior) => {
    const list = listRef.current
    const item = itemRefs.current[index]
    if (!list || !item) return
    const top = centeredScrollTop(list, item)
    if (Math.abs(top - list.scrollTop) < 1) return

    if (scrollFrame.current !== null) {
      cancelAnimationFrame(scrollFrame.current)
      scrollFrame.current = null
    }

    const instant =
      behavior === 'auto' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (instant) {
      followScroll.current = true
      list.scrollTop = top
      window.setTimeout(() => {
        followScroll.current = false
      }, 40)
      return
    }

    const start = list.scrollTop
    const delta = top - start
    const duration = centerScrollDuration(Math.abs(delta))
    const started = performance.now()
    let expected = start
    followScroll.current = true

    const step = (now: number) => {
      if (Math.abs(list.scrollTop - expected) > 1) {
        scrollFrame.current = null
        followScroll.current = false
        list.dispatchEvent(new Event('scroll'))
        return
      }
      const progress = Math.min(1, (now - started) / duration)
      const next = start + delta * easeInOutCubic(progress)
      if (progress < 1) {
        list.scrollTop = next
        expected = list.scrollTop
        scrollFrame.current = requestAnimationFrame(step)
        return
      }
      followScroll.current = false
      scrollFrame.current = null
      list.scrollTop = start + delta
      list.dispatchEvent(new Event('scroll'))
    }
    scrollFrame.current = requestAnimationFrame(step)
  }, [])

  const scrollActiveIntoView = useCallback(
    (behavior: ScrollBehavior) => scrollIndexIntoView(activeIndexRef.current, behavior),
    [scrollIndexIntoView],
  )

  useEffect(() => {
    scrollActiveIntoView('smooth')
  }, [player.activeIndex, scrollActiveIntoView])

  useEffect(
    () => () => {
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current)
    },
    [],
  )

  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined

    const update = () => {
      if (followScroll.current) return
      const placement = activePlacement()
      if (!placement) return
      setJump((current) => {
        if (placement.outside) return { phase: 'shown', direction: placement.direction }
        if (current.phase === 'shown') return { ...current, phase: 'leaving' }
        return current
      })
    }

    const onScrollEnd = () => {
      // Each frame of the centring animation is its own instant scroll and fires scrollend.
      if (scrollFrame.current !== null) return
      followScroll.current = false
      update()
    }

    update()
    list.addEventListener('scroll', update, { passive: true })
    list.addEventListener('scrollend', onScrollEnd)
    return () => {
      list.removeEventListener('scroll', update)
      list.removeEventListener('scrollend', onScrollEnd)
    }
  }, [activePlacement, player.activeIndex])

  useEffect(() => {
    if (jump.phase !== 'leaving') return undefined
    const timeout = window.setTimeout(() => {
      setJump((current) => (current.phase === 'leaving' ? { ...current, phase: 'hidden' } : current))
    }, 100)
    return () => window.clearTimeout(timeout)
  }, [jump.phase])

  function jumpToActive() {
    scrollActiveIntoView('auto')
    setJump((current) => ({ ...current, phase: 'leaving' }))
  }

  const closeDetail = useCallback(() => {
    setDetailIndex(null)
    window.setTimeout(() => detailButtonRef.current?.focus({ preventScroll: true }), 0)
  }, [])

  const closeSaved = useCallback(() => {
    setSavedOpen(false)
    window.setTimeout(() => savedButtonRef.current?.focus({ preventScroll: true }), 0)
  }, [])

  function playSavedSentence(index: number) {
    setSavedOpen(false)
    player.playSegment(index)
    window.setTimeout(() => scrollIndexIntoView(index, 'smooth'), 0)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (overlayOpenRef.current) return
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      }

      const actions = actionsRef.current
      const rates = PLAYBACK_RATES
      const rateIndex = rates.indexOf(actions.rate as (typeof rates)[number])

      switch (event.key) {
        case ' ':
          event.preventDefault()
          actions.togglePlay()
          break
        case 'r':
        case 'R':
        case 'Enter':
          event.preventDefault()
          actions.replay()
          break
        case 'ArrowLeft':
          event.preventDefault()
          actions.prev()
          break
        case 'ArrowRight':
          event.preventDefault()
          actions.next()
          break
        case 'l':
        case 'L':
          event.preventDefault()
          actions.toggleLoop()
          break
        case '[':
          event.preventDefault()
          if (rateIndex > 0) actions.setRate(rates[rateIndex - 1])
          break
        case ']':
          event.preventDefault()
          if (rateIndex >= 0 && rateIndex < rates.length - 1) actions.setRate(rates[rateIndex + 1])
          break
        case 'p':
        case 'P':
          event.preventDefault()
          patchSettings({ shadowShowPinyin: !showPinyin })
          break
        case 'm':
        case 'M':
          event.preventDefault()
          patchSettings({ shadowShowMeaning: !showMeaning })
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [patchSettings, showMeaning, showPinyin])

  return (
    <ScreenShell
      title={lesson.title}
      onBack={() => setView({ name: 'shadowingList' })}
      fillViewport
      headerAction={
        <button
          type="button"
          ref={savedButtonRef}
          onClick={() => setSavedOpen(true)}
          aria-label={`Từ đã lưu (${saved.length})`}
          title="Từ đã lưu"
          className="-mr-2 flex h-11 items-center gap-1 rounded-2xl px-2 text-teal-800 active:bg-teal-50"
        >
          <BookmarkIcon size={22} />
          <span className="min-w-4 text-sm font-semibold tabular-nums">{saved.length}</span>
        </button>
      }
      footer={
        <div className="relative">
          {jump.phase !== 'hidden' ? (
            <button
              type="button"
              onClick={jumpToActive}
              className={`absolute bottom-[calc(100%+0.75rem)] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white shadow-lg ${
                jump.phase === 'leaving' ? 'animate-jump-out' : 'animate-jump-in'
              }`}
            >
              <ChevronIcon direction={jump.direction} />
              Câu đang phát
            </button>
          ) : null}
          <div className="grid grid-cols-5 gap-2">
            <ControlButton label="Trước" onClick={player.prev}>
              <SkipIcon direction="prev" />
            </ControlButton>
            <ControlButton label="Nghe lại" onClick={player.replay}>
              <ReplayIcon />
            </ControlButton>
            <ControlButton label={player.playing ? 'Dừng' : 'Phát'} onClick={player.togglePlay} primary>
              {player.playing ? <PauseIcon /> : <PlayIcon />}
            </ControlButton>
            <ControlButton label="Sau" onClick={player.next}>
              <SkipIcon direction="next" />
            </ControlButton>
            <ControlButton label="Lặp" pressed={player.loop} onClick={player.toggleLoop}>
              <LoopIcon />
            </ControlButton>
          </div>
        </div>
      }
    >
      <div className="shrink-0 border-b border-teal-100 bg-white px-4 py-3 md:px-8">
        <div className="relative min-h-[106px]">
          <div ref={setContainer} className="w-full" />
          {!player.ready && !player.error ? (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-teal-600">
              Đang tải audio…
            </p>
          ) : null}
          {player.error ? (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-700">
              Không tải được audio.
            </p>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="min-w-24 text-sm font-medium tabular-nums text-teal-800">
            {player.timeLabel} / {formatClock(player.duration)}
          </p>
          <label className="relative">
            <span className="sr-only">Tốc độ phát</span>
            <select
              value={String(player.rate)}
              onChange={(event) => player.setRate(Number(event.target.value))}
              className="appearance-none rounded-full bg-teal-50 py-1 pl-3 pr-8 text-sm font-semibold text-teal-900 outline-none focus:ring-2 focus:ring-teal-300"
            >
              {PLAYBACK_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-teal-700"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </label>
          <div className="ml-auto flex gap-1">
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
        </div>
        {desktop ? (
          <p className="mt-2 text-xs text-teal-600">
            Phím tắt: Space phát/dừng, ← → câu, R nghe lại, L lặp, [ ] tốc độ, P pinyin, M nghĩa
          </p>
        ) : null}
      </div>

      <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4 md:px-8">
        {lesson.segments.map((segment, index) => {
          const active = index === player.activeIndex
          return (
            <li
              key={segment.id}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              className="relative"
            >
              <button
                type="button"
                onClick={() => player.playSegment(index)}
                className={`w-full rounded-2xl px-4 py-3 text-left ${
                  active
                    ? 'bg-teal-700 pr-14 text-white'
                    : 'bg-white text-teal-950 ring-1 ring-teal-100'
                }`}
              >
                <Hanzi className="text-2xl leading-snug">{segment.text}</Hanzi>
                {showPinyin && segment.pinyin ? (
                  <p className={`mt-1 text-sm ${active ? 'text-teal-100' : 'text-teal-700'}`}>
                    {segment.pinyin}
                  </p>
                ) : null}
                {showMeaning && segment.meaning ? (
                  <p className={`text-sm ${active ? 'text-teal-100' : 'text-teal-600'}`}>
                    {segment.meaning}
                  </p>
                ) : null}
              </button>
              {active ? (
                <button
                  type="button"
                  ref={detailButtonRef}
                  aria-label="Xem chi tiết câu"
                  title="Xem chi tiết câu"
                  onClick={() => {
                    player.pause()
                    setDetailIndex(index)
                  }}
                  className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                >
                  <ExpandIcon />
                </button>
              ) : null}
            </li>
          )
        })}
      </ol>
      {detailIndex !== null && lesson.segments[detailIndex] ? (
        <SentenceDetailDialog
          lessonId={lesson.id}
          segment={lesson.segments[detailIndex]}
          index={detailIndex}
          total={lesson.segments.length}
          saved={saved.filter((entry) => entry.segmentIndex === detailIndex)}
          onClose={closeDetail}
          onPlay={() => player.playSegment(detailIndex)}
        />
      ) : null}
      {savedOpen ? (
        <SavedWordsPanel
          segments={lesson.segments}
          saved={saved}
          onClose={closeSaved}
          onPlay={playSavedSentence}
        />
      ) : null}
    </ScreenShell>
  )
}

const CENTER_SCROLL_MIN_MS = 700
const CENTER_SCROLL_MAX_MS = 1200

/** Short hops still take the minimum, so moving one sentence does not snap. */
function centerScrollDuration(distance: number): number {
  return Math.min(CENTER_SCROLL_MAX_MS, Math.max(CENTER_SCROLL_MIN_MS, distance * 0.45))
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Scroll offset that centres `item` in `list`, clamped so the first and last items stay put. */
function centeredScrollTop(list: HTMLElement, item: HTMLElement): number {
  const listRect = list.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  const itemTop = itemRect.top - listRect.top + list.scrollTop
  const centered = itemTop + itemRect.height / 2 - list.clientHeight / 2
  return Math.max(0, Math.min(centered, list.scrollHeight - list.clientHeight))
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

function ControlButton({
  label,
  onClick,
  pressed,
  primary,
  children,
}: {
  label: string
  onClick: () => void
  pressed?: boolean
  primary?: boolean
  children: ReactNode
}) {
  const tone = primary
    ? 'bg-teal-700 text-white'
    : pressed
      ? 'bg-teal-700 text-white'
      : 'bg-teal-50 text-teal-900'
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-xs font-semibold ${tone}`}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}

function ReplayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 7.5A7 7 0 1 1 5.2 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M7 3.5v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17 3l3 3-3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 21l-3-3 3-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 6H8a5 5 0 0 0-5 5v1M4 18h12a5 5 0 0 0 5-5v-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === 'up' ? 'M6 14l6-6 6 6' : 'M6 10l6 6 6-6'}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SkipIcon({ direction }: { direction: 'prev' | 'next' }) {
  const previous = direction === 'prev'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {previous ? (
        <>
          <path d="M5 5h2.2v14H5V5z" />
          <path d="M18.5 6.2v11.6L8.5 12l10-5.8z" />
        </>
      ) : (
        <>
          <path d="M5.5 6.2v11.6L15.5 12 5.5 6.2z" />
          <path d="M16.8 5H19v14h-2.2V5z" />
        </>
      )}
    </svg>
  )
}
