import { useCallback, useEffect, useRef, useState } from 'react'
import { clampIndex, findSegmentIndexAt, formatClock, resolveAudioSrc } from './segments'
import { WaveSurferPlayer } from './player/WaveSurferPlayer'
import type { ShadowingLesson } from './types'

const CLOCK_INTERVAL_MS = 250

type Options = {
  initialRate: number
  onRateChange?: (rate: number) => void
}

export function useShadowingPlayer(
  lesson: ShadowingLesson,
  container: HTMLElement | null,
  { initialRate, onRateChange }: Options,
) {
  const segmentsRef = useRef(lesson.segments)
  segmentsRef.current = lesson.segments

  const playerRef = useRef<WaveSurferPlayer | null>(null)
  const playSegmentRef = useRef<(index: number) => void>(() => {})
  const onRateChangeRef = useRef(onRateChange)
  onRateChangeRef.current = onRateChange

  const lastClock = useRef(0)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loop, setLoop] = useState(false)
  const [rate, setRateState] = useState(initialRate)
  const [clock, setClock] = useState(0)
  const [duration, setDuration] = useState(0)
  const rateRef = useRef(rate)
  rateRef.current = rate

  const audioSrc = lesson.audio.type === 'file' ? lesson.audio.src : null

  const publishTime = useCallback((time: number, forceClock: boolean) => {
    const index = findSegmentIndexAt(segmentsRef.current, time)
    setActiveIndex((current) => (current === index ? current : index))
    const now = performance.now()
    if (forceClock || now - lastClock.current >= CLOCK_INTERVAL_MS) {
      lastClock.current = now
      setClock(time)
    }
  }, [])

  useEffect(() => {
    if (!container || !audioSrc) return undefined

    const player = new WaveSurferPlayer(container, resolveAudioSrc(audioSrc))
    playerRef.current = player
    player.setPlaybackRate(rateRef.current)
    player.setOnRegionClick((id) => {
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
      player.on('seek', (time) => publishTime(time, true)),
      player.on('play', () => setPlaying(true)),
      player.on('pause', () => setPlaying(false)),
      player.on('error', () => setError(true)),
    ]

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      player.destroy()
      if (playerRef.current === player) playerRef.current = null
    }
  }, [audioSrc, container, publishTime])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !ready) return
    player.setRegions(lesson.segments, lesson.segments[activeIndex]?.id ?? null)
  }, [activeIndex, lesson.segments, ready])

  const playSegment = useCallback((index: number) => {
    const segments = segmentsRef.current
    const next = clampIndex(index, segments.length)
    const segment = segments[next]
    if (!segment) return
    setActiveIndex(next)
    playerRef.current?.playRange(segment.start, segment.end)
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
    duration,
    playSegment,
    replay,
    next,
    prev,
    pause,
    togglePlay,
    toggleLoop,
    setRate,
  }
}
