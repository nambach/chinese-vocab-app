import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Hanzi } from '../components/Hanzi'
import { SmartInput } from '../components/SmartInput'
import { Card, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'
import {
  countWordSourcesForSegment,
  deleteSegment,
  formatSegmentClock,
  newSegmentAt,
  parseSegmentClock,
  saveKewen,
  segmentErrors,
  sortSegments,
  upsertSegment,
} from '../data/kewenEdit'
import { saveState } from '../data/store'
import { useIsDesktop } from '../lib/device'
import { findSegmentIndexAt, formatClock, isPlaybackRate } from '../shadowing/segments'
import { lessonFromKewen } from '../shadowing/lessonView'
import type { RegionTimingUpdate } from '../shadowing/player/WaveSurferPlayer'
import type { ShadowingLesson, ShadowingSegment } from '../shadowing/types'
import { useShadowingPlayer } from '../shadowing/useShadowingPlayer'

const EMPTY_LESSON: ShadowingLesson = {
  id: 'missing',
  title: '',
  audio: { type: 'file', src: '' },
  segments: [],
}

type KewenEditorProps = {
  catalogId: string
  segmentId?: string
}

/** Wait until a burst of edits settles, then write once. Throttle would save mid-typing. */
const SAVE_AFTER_MS = 500

function differs(saved: ShadowingSegment | undefined, draft: ShadowingSegment | null): boolean {
  if (!draft) return false
  if (!saved || saved.id !== draft.id) return true
  return (
    saved.text !== draft.text ||
    (saved.pinyin ?? '') !== (draft.pinyin ?? '') ||
    (saved.meaning ?? '') !== (draft.meaning ?? '') ||
    saved.start !== draft.start ||
    saved.end !== draft.end
  )
}

export function KewenEditor({ catalogId, segmentId }: KewenEditorProps) {
  const { state, setView, saveKewenEdits, patchSettings } = useApp()
  const catalog = useCatalog(catalogId)
  const desktop = useIsDesktop()

  const saved = useMemo(
    () => (catalog?.kewen ? sortSegments(catalog.kewen.segments) : []),
    [catalog?.kewen],
  )
  const savedRef = useRef(saved)
  savedRef.current = saved
  const stateRef = useRef(state)
  stateRef.current = state

  const [selectedId, setSelectedId] = useState<string | null>(segmentId ?? null)
  const [draft, setDraft] = useState<ShadowingSegment | null>(null)
  const [live, setLive] = useState<RegionTimingUpdate | null>(null)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [startText, setStartText] = useState<string | null>(null)
  const [endText, setEndText] = useState<string | null>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const durationRef = useRef(Number.POSITIVE_INFINITY)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const savedSelected = saved.find((segment) => segment.id === selectedId)
  const selected = draft?.id === selectedId ? draft : (savedSelected ?? null)

  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  const displaySegments = useMemo(() => {
    if (!draft) return saved
    return upsertSegment(saved, draft)
  }, [draft, saved])

  const lesson = useMemo(
    () => (catalog?.kewen ? lessonFromKewen({ ...catalog.kewen, segments: displaySegments }) : undefined),
    [catalog?.kewen, displaySegments],
  )

  const cancelSave = useCallback(() => {
    if (!saveTimerRef.current) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
  }, [])

  const commitRef = useRef<() => void>(() => {})
  commitRef.current = () => {
    const current = draftRef.current
    if (!current) return
    const savedNow = savedRef.current
    const original = savedNow.find((segment) => segment.id === current.id)
    if (!differs(original, current)) return
    const problems = segmentErrors(savedNow, current, durationRef.current)
    if (problems.start || problems.end || problems.text) return
    try {
      const segments = upsertSegment(savedNow, current)
      const next = saveKewen(stateRef.current, catalogId, segments)
      stateRef.current = next
      saveState(next)
      saveKewenEdits(catalogId, segments)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không lưu được')
    }
  }

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      commitRef.current()
    }, SAVE_AFTER_MS)
  }, [])

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    commitRef.current()
  }, [])

  const onRegionUpdate = useCallback((update: RegionTimingUpdate) => {
    cancelSave()
    setLive(update)
    setStartText(null)
    setEndText(null)
  }, [cancelSave])

  const onRegionUpdated = useCallback((update: RegionTimingUpdate) => {
    setLive(null)
    setStartText(null)
    setEndText(null)
    setDraft((current) => {
      const base =
        current?.id === update.id
          ? current
          : savedRef.current.find((segment) => segment.id === update.id)
      if (!base || (base.start === update.start && base.end === update.end)) return current
      return { ...base, start: update.start, end: update.end }
    })
    scheduleSave()
  }, [scheduleSave])

  const onSelection = useCallback((range: { start: number; end: number } | null) => {
    setSelection(range)
  }, [])

  const onSeekRef = useRef<(time: number) => void>(() => {})

  const editor = useMemo(
    () => ({
      editableSegmentId: selectedId,
      onRegionUpdate,
      onRegionUpdated,
      onSelection,
      onSeek: (time: number) => onSeekRef.current(time),
    }),
    [onRegionUpdate, onRegionUpdated, onSelection, selectedId],
  )

  const savedRate = isPlaybackRate(state.settings.shadowPlaybackRate)
    ? state.settings.shadowPlaybackRate
    : 1
  const player = useShadowingPlayer(lesson ?? EMPTY_LESSON, lesson && desktop ? container : null, {
    initialRate: savedRate,
    onRateChange: (rate) => patchSettings({ shadowPlaybackRate: rate }),
    editor,
  })

  const duration = player.ready && player.duration > 0 ? player.duration : Number.POSITIVE_INFINITY
  durationRef.current = duration
  const timing = selected
    ? {
        start: live?.id === selected.id ? live.start : selected.start,
        end: live?.id === selected.id ? live.end : selected.end,
      }
    : null
  const preview = selected && timing ? { ...selected, ...timing } : null
  const errors = preview ? segmentErrors(saved, preview, duration) : {}
  const selectedIndex = displaySegments.findIndex((segment) => segment.id === selectedId)

  useEffect(() => {
    if (!player.playing) {
      setPlayhead(player.currentTime)
      return
    }
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last >= 100) {
        last = now
        setPlayhead(player.getCurrentTime())
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [player.playing, player.currentTime, player.getCurrentTime])

  useEffect(() => {
    if (!selectedId || !player.ready) return
    const segment = displaySegments.find((item) => item.id === selectedId)
    if (!segment) return
    player.scrollIntoView(segment.start, segment.end)
    const row = listRef.current?.querySelector(`[data-segment-id="${CSS.escape(selectedId)}"]`)
    row?.scrollIntoView({ block: 'nearest' })
    // Scroll when the selection changes, not when its times are edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, player.ready, player.scrollIntoView])

  useEffect(() => {
    if (!draft) return
    const original = saved.find((segment) => segment.id === draft.id)
    if (original && !differs(original, draft)) setDraft(null)
  }, [saved, draft])

  useEffect(() => {
    const flush = () => flushSave()
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flushSave()
    }
  }, [flushSave])

  useEffect(() => {
    if (desktop) return
    flushSave()
    setView({ name: 'catalog', catalogId })
  }, [desktop, catalogId, setView, flushSave])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, button')) return
      event.preventDefault()
      player.togglePlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player.togglePlay])

  const edit = useCallback((patch: Partial<Pick<ShadowingSegment, 'text' | 'pinyin' | 'meaning' | 'start' | 'end'>>) => {
    setDraft((current) => {
      const id = selectedIdRef.current
      const base = current?.id === id ? current : savedRef.current.find((segment) => segment.id === id)
      if (!base) return current
      return { ...base, ...patch }
    })
    scheduleSave()
  }, [scheduleSave])

  function select(id: string) {
    if (id === selectedId) return
    flushSave()
    setDraft(null)
    setLive(null)
    setStartText(null)
    setEndText(null)
    setSelectedId(id)
    setView({ name: 'editKewen', catalogId, segmentId: id }, { replace: true })
  }

  onSeekRef.current = (time: number) => {
    // Same lookup the practice player uses: the sentence that contains the
    // time, or the previous one when the click falls in a gap.
    const segment = displaySegments[findSegmentIndexAt(displaySegments, time)]
    if (segment) select(segment.id)
  }

  function addSentence() {
    if (!player.ready) return
    flushSave()
    const created = selection
      ? newSegmentAt(saved, selection.start, selection.end, player.duration)
      : newSegmentAt(saved, player.getCurrentTime(), undefined, player.duration)
    setDraft(created)
    setLive(null)
    setStartText(null)
    setEndText(null)
    setSelectedId(created.id)
    player.clearSelection()
    setView({ name: 'editKewen', catalogId, segmentId: created.id }, { replace: true })
  }

  function leave() {
    flushSave()
    setView({ name: 'catalog', catalogId })
  }

  function remove() {
    if (!selected) return
    const isNew = !saved.some((segment) => segment.id === selected.id)
    if (isNew) {
      cancelSave()
      setDraft(null)
      setLive(null)
      setSelectedId(null)
      setView({ name: 'editKewen', catalogId }, { replace: true })
      return
    }
    const linked = countWordSourcesForSegment(state, catalog?.kewen?.lessonId ?? '', selected.id)
    const message =
      linked > 0
        ? `Xóa câu này? ${linked} từ đang gắn câu này (sẽ không hiện nữa).`
        : 'Xóa câu này?'
    if (!window.confirm(message)) return
    cancelSave()
    try {
      saveKewenEdits(catalogId, deleteSegment(saved, selected.id))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không lưu được')
      return
    }
    setDraft(null)
    setLive(null)
    setSelectedId(null)
    setView({ name: 'editKewen', catalogId }, { replace: true })
  }

  if (!desktop) return null

  if (!catalog?.kewen || !lesson) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bài khóa không tồn tại.</Card>
      </ScreenShell>
    )
  }

  const savedIds = new Set(saved.map((segment) => segment.id))

  return (
    <ScreenShell title="Sửa audio" subtitle={catalog.name} onBack={leave} backLabel="Quay lại" fillViewport>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 md:px-8">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-teal-100">
          <div ref={setContainer} className="min-h-[7rem]" />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              aria-label={player.playing ? 'Dừng' : 'Phát'}
              onClick={player.togglePlay}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm text-white"
            >
              {player.playing ? '❚❚' : '▶'}
            </button>
            <span className="min-w-0 font-mono text-sm tabular-nums text-teal-800">
              {formatSegmentClock(playhead)} / {formatClock(player.duration)}
            </span>
            <ZoomButton label="Thu nhỏ" onClick={player.zoomOut}>
              <ZoomGlass minus />
            </ZoomButton>
            <ZoomButton label="Phóng to" onClick={player.zoomIn}>
              <ZoomGlass />
            </ZoomButton>
            {player.zoomed ? (
              <button
                type="button"
                onClick={player.zoomReset}
                className="h-9 rounded-xl bg-teal-50 px-2.5 text-xs font-semibold text-teal-800 ring-1 ring-teal-100"
              >
                100%
              </button>
            ) : null}
            <button
              type="button"
              onClick={addSentence}
              disabled={!player.ready}
              className="ml-auto rounded-full bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              + Thêm câu
            </button>
          </div>
          {player.error ? <p className="mt-2 text-center text-xs text-red-700">Không mở được audio.</p> : null}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          <div ref={listRef} className="min-h-0 overflow-y-auto overscroll-contain">
            <ol className="flex flex-col gap-1">
              {displaySegments.map((segment, index) => {
                const active = segment.id === selectedId
                const unsaved = !savedIds.has(segment.id)
                const rowStart = live?.id === segment.id ? live.start : segment.start
                const rowEnd = live?.id === segment.id ? live.end : segment.end
                return (
                  <li key={segment.id}>
                    <button
                      type="button"
                      data-segment-id={segment.id}
                      onClick={() => select(segment.id)}
                      className={`flex w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left ring-1 ${
                        active ? 'bg-teal-700 text-white ring-teal-800' : 'bg-white text-teal-950 ring-teal-100'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-6 shrink-0 text-xs tabular-nums ${active ? 'text-teal-100' : 'text-teal-500'}`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-xs tabular-nums ${active ? 'text-teal-100' : 'text-teal-600'}`}>
                          {formatSegmentClock(rowStart)}–{formatSegmentClock(rowEnd)}
                        </span>
                        {segment.text.trim() ? (
                          <Hanzi
                            convert={false}
                            className={`block truncate text-base ${active ? 'text-white' : 'text-teal-950'}`}
                          >
                            {segment.text}
                          </Hanzi>
                        ) : (
                          <span className={`block text-sm italic ${active ? 'text-teal-100' : 'text-teal-600'}`}>
                            chưa lưu
                          </span>
                        )}
                        {unsaved && segment.text.trim() ? (
                          <span className={`text-xs italic ${active ? 'text-teal-100' : 'text-teal-600'}`}>
                            chưa lưu
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          <Card className="flex min-h-0 flex-col overflow-y-auto">
            {selected && timing ? (
              <div className="flex min-h-full flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-teal-800">
                    Câu {selectedIndex + 1}/{displaySegments.length}
                  </p>
                  <button type="button" onClick={remove} className="text-sm font-semibold text-red-700">
                    Xóa
                  </button>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                  <TimeField
                    label="Bắt đầu"
                    value={startText ?? formatSegmentClock(timing.start)}
                    error={errors.start}
                    onChange={(value) => {
                      setStartText(value)
                      const parsed = parseSegmentClock(value)
                      if (parsed === null) return
                      edit({ start: parsed })
                    }}
                    onBlur={() => setStartText(null)}
                  />
                  <TimeField
                    label="Kết thúc"
                    value={endText ?? formatSegmentClock(timing.end)}
                    error={errors.end}
                    onChange={(value) => {
                      setEndText(value)
                      const parsed = parseSegmentClock(value)
                      if (parsed === null) return
                      edit({ end: parsed })
                    }}
                    onBlur={() => setEndText(null)}
                  />
                </div>
                <div>
                  <SmartInput
                    label="Hán tự"
                    value={selected.text}
                    onChange={(text) => edit({ text })}
                    multiline
                  />
                  {errors.text ? <p className="mt-1 text-xs text-red-700">{errors.text}</p> : null}
                </div>
                <SmartInput
                  label="Pinyin"
                  value={selected.pinyin ?? ''}
                  onChange={(pinyin) => edit({ pinyin })}
                  pinyin
                  toneNumberInput
                  multiline
                />
                <SmartInput
                  label="Nghĩa"
                  value={selected.meaning ?? ''}
                  onChange={(meaning) => edit({ meaning })}
                  multiline
                />
              </div>
            ) : (
              <p className="text-sm text-teal-700">Chọn một câu trong danh sách hoặc thêm câu mới.</p>
            )}
          </Card>
        </div>
      </div>
    </ScreenShell>
  )
}

function TimeField({
  label,
  value,
  error,
  onChange,
  onBlur,
}: {
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
  onBlur: () => void
}) {
  return (
    <label className="flex w-32 flex-col gap-1">
      <span className="text-sm font-medium text-teal-800">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={Boolean(error)}
        className="w-full rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 font-mono text-sm text-teal-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
      />
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </label>
  )
}

function ZoomButton({
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
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100"
    >
      {children}
    </button>
  )
}

function ZoomGlass({ minus = false }: { minus?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M14.5 14.5L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {minus ? (
        <path d="M7.5 10h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M10 7.5v5M7.5 10h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  )
}
