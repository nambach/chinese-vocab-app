import { useCallback, useEffect, useRef, useState } from 'react'
import { clampIndex, findSegmentIndexAt, formatClock, resolveAudioSrc } from './segments'
import { WaveSurferPlayer, type RegionTimingUpdate, type TimeRange } from './player/WaveSurferPlayer'
import type { ShadowingLesson } from './types'

export type ShadowingEditorOptions = {
  editableSegmentId: string | null
  onRegionUpdate?: (update: RegionTimingUpdate) => void
  onRegionUpdated?: (update: RegionTimingUpdate) => void
  onSelection?: (range: TimeRange | null) => void
  /** Waveform click in edit mode. `time` is seconds into the audio. */
  onSeek?: (time: number) => void
}

const CLOCK_INTERVAL_MS = 250

type Options = {
  initialRate: number
  onRateChange?: (rate: number) => void
  editor?: ShadowingEditorOptions
  /** Waveform bar height. The editor leaves this unset and keeps the taller default. */
  waveHeight?: number
  timelineHeight?: number
}

export type ShadowingPlayerController = ReturnType<typeof useShadowingPlayer>

export function useShadowingPlayer(
  lesson: ShadowingLesson,
  container: HTMLElement | null,
  { initialRate, onRateChange, editor, waveHeight, timelineHeight }: Options,
) {
  const segmentsRef = useRef(lesson.segments)
  segmentsRef.current = lesson.segments

  const playerRef = useRef<WaveSurferPlayer | null>(null)
  const playSegmentRef = useRef<(index: number) => void>(() => {})
  const onRateChangeRef = useRef(onRateChange)
  onRateChangeRef.current = onRateChange
  const editorRef = useRef(editor)
  editorRef.current = editor

  const lastClock = useRef(0)

  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)
  readyRef.current = ready
  const pendingFocusRef = useRef<number | null>(null)
  const [error, setError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loop, setLoop] = useState(false)
  const [rate, setRateState] = useState(initialRate)
  const [clock, setClock] = useState(0)
  const [duration, setDuration] = useState(0)
  const [zoomFactor, setZoomFactor] = useState(1)
  const rateRef = useRef(rate)
  rateRef.current = rate

  const audioSrc = lesson.audio.type === 'file' ? lesson.audio.src : null

  const publishTime = useCallback((time: number, forceClock: boolean) => {
    if (pendingFocusRef.current == null) {
      const index = findSegmentIndexAt(segmentsRef.current, time)
      setActiveIndex((current) => (current === index ? current : index))
    }
    const now = performance.now()
    if (forceClock || now - lastClock.current >= CLOCK_INTERVAL_MS) {
      lastClock.current = now
      setClock(time)
    }
  }, [])

  useEffect(() => {
    if (!container || !audioSrc) return undefined

    const player = new WaveSurferPlayer(container, resolveAudioSrc(audioSrc), {
      height: waveHeight,
      timelineHeight,
    })
    playerRef.current = player
    player.setPlaybackRate(rateRef.current)
    // Apply before the ready effect. A recreated player (StrictMode, a new
    // container) keeps `ready` true, so that effect would not run again.
    if (editorRef.current) player.setEditMode(true)
    player.setOnRegionClick((id) => {
      if (editorRef.current) return
      const index = segmentsRef.current.findIndex((segment) => segment.id === id)
      if (index >= 0) playSegmentRef.current(index)
    })

    const unsubscribers = [
      player.on('ready', (nextDuration) => {
        setReady(true)
        setDuration(nextDuration)
        player.setPlaybackRate(rateRef.current)
      }),
      player.on('timeupdate', (time) => publishTime(time, false)),
      player.on('seek', (time) => {
        publishTime(time, true)
        editorRef.current?.onSeek?.(time)
      }),
      player.on('play', () => setPlaying(true)),
      player.on('pause', () => setPlaying(false)),
      player.on('error', () => setError(true)),
    ]

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      player.destroy()
      if (playerRef.current === player) playerRef.current = null
      setReady(false)
    }
  }, [audioSrc, container, publishTime, waveHeight, timelineHeight])

  useEffect(() => {
    if (!ready || pendingFocusRef.current == null) return
    const index = pendingFocusRef.current
    const segment = segmentsRef.current[index]
    pendingFocusRef.current = null
    if (!segment) return
    playerRef.current?.seek(segment.start)
    setActiveIndex(index)
  }, [ready])

  const editing = editor != null
  const editableSegmentId = editor?.editableSegmentId ?? null

  useEffect(() => {
    const player = playerRef.current
    if (!player || !ready) return
    player.setEditMode(editing)
  }, [editing, ready])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !ready) return
    const activeId = editing ? null : (lesson.segments[activeIndex]?.id ?? null)
    player.setRegions(lesson.segments, activeId, { editableId: editableSegmentId })
  }, [activeIndex, editableSegmentId, editing, lesson.segments, ready])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !ready) return
    player.setOnRegionUpdate(editor?.onRegionUpdate ?? null)
    player.setOnRegionUpdated(editor?.onRegionUpdated ?? null)
    player.setOnSelection(editor?.onSelection ?? null)
  }, [editor?.onRegionUpdate, editor?.onRegionUpdated, editor?.onSelection, ready])

  const playSegment = useCallback((index: number) => {
    const segments = segmentsRef.current
    const next = clampIndex(index, segments.length)
    const segment = segments[next]
    if (!segment) return
    pendingFocusRef.current = null
    setActiveIndex(next)
    playerRef.current?.playRange(segment.start, segment.end)
  }, [])

  const focusSegment = useCallback((index: number) => {
    const segments = segmentsRef.current
    const next = clampIndex(index, segments.length)
    const segment = segments[next]
    if (!segment) return
    setActiveIndex(next)
    if (readyRef.current && playerRef.current) {
      pendingFocusRef.current = null
      playerRef.current.seek(segment.start)
      return
    }
    pendingFocusRef.current = next
  }, [])

  playSegmentRef.current = playSegment

  const replay = useCallback(() => {
    playSegmentRef.current(activeIndex)
  }, [activeIndex])

  const next = useCallback(() => {
    playSegmentRef.current(activeIndex + 1)
  }, [activeIndex])

  const prev = useCallback(() => {
    playSegmentRef.current(activeIndex - 1)
  }, [activeIndex])

  const pause = useCallback(() => {
    playerRef.current?.pause()
  }, [])

  const playRange = useCallback((start: number, end: number) => {
    if (end <= start) return
    playerRef.current?.playRange(start, end)
  }, [])

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (playing) player.pause()
    else player.play()
  }, [playing])

  const toggleLoop = useCallback(() => {
    setLoop((current) => {
      const nextLoop = !current
      playerRef.current?.setLoop(nextLoop)
      return nextLoop
    })
  }, [])

  const zoomIn = useCallback(() => {
    setZoomFactor(playerRef.current?.zoomIn() ?? 1)
  }, [])

  const zoomOut = useCallback(() => {
    setZoomFactor(playerRef.current?.zoomOut() ?? 1)
  }, [])

  const zoomReset = useCallback(() => {
    setZoomFactor(playerRef.current?.zoomReset() ?? 1)
  }, [])

  const scrollIntoView = useCallback((start: number, end: number) => {
    playerRef.current?.scrollIntoView(start, end)
  }, [])

  const clearSelection = useCallback(() => {
    playerRef.current?.clearSelection()
  }, [])

  const getCurrentTime = useCallback(() => playerRef.current?.getCurrentTime() ?? 0, [])

  const setRate = useCallback((nextRate: number) => {
    setRateState(nextRate)
    playerRef.current?.setPlaybackRate(nextRate)
    onRateChangeRef.current?.(nextRate)
  }, [])

  useEffect(() => {
    playerRef.current?.setPlaybackRate(rate)
  }, [rate, ready])

  return {
    ready,
    error,
    playing,
    activeIndex,
    loop,
    rate,
    timeLabel: formatClock(clock),
    currentTime: clock,
    duration,
    playSegment,
    focusSegment,
    playRange,
    replay,
    next,
    prev,
    pause,
    togglePlay,
    toggleLoop,
    setRate,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomed: zoomFactor > 1.001,
    scrollIntoView,
    clearSelection,
    getCurrentTime,
  }
}
