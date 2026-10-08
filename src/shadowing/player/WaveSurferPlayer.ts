import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import type { AudioPlayer, AudioPlayerEvent } from './AudioPlayer'
import type { ShadowingSegment } from '../types'

const ACTIVE_REGION = 'rgba(15, 118, 110, 0.18)'
const IDLE_REGION = 'rgba(15, 118, 110, 0.06)'

/**
 * WaveSurfer v7 backend. Sentence range and looping are tracked here so the
 * lesson UI does not depend on WaveSurfer's region playback.
 *
 * Region overlays are visual only (`pointer-events: none`) so a click anywhere
 * on the waveform seeks to that instant and leaves sentence-bounded playback.
 */
export class WaveSurferPlayer implements AudioPlayer {
  private ws: WaveSurfer
  private regions: RegionsPlugin
  private range: { start: number; end: number } | null = null
  private loop = false
  private ending = false
  private rate = 1
  private onRegionClick: ((id: string) => void) | null = null
  private listeners = new Map<AudioPlayerEvent, Set<(time: number) => void>>()
  private cleanups: Array<() => void> = []

  constructor(container: HTMLElement, url: string) {
    this.regions = RegionsPlugin.create()
    this.ws = WaveSurfer.create({
      container,
      url,
      height: 88,
      normalize: true,
      waveColor: '#14b8a6',
      progressColor: '#134e4a',
      cursorColor: '#134e4a',
      cursorWidth: 2,
      plugins: [
        this.regions,
        TimelinePlugin.create({
          height: 18,
          style: { color: '#0f766e', fontSize: '11px' },
        }),
      ],
    })

    this.cleanups.push(
      this.ws.on('ready', (duration) => {
        this.ws.setPlaybackRate(this.rate, true)
        this.emit('ready', duration)
      }),
      this.ws.on('timeupdate', (time) => this.handleTime(time)),
      this.ws.on('play', () => this.emit('play', this.ws.getCurrentTime())),
      this.ws.on('pause', () => this.emit('pause', this.ws.getCurrentTime())),
      this.ws.on('interaction', (time) => {
        this.range = null
        this.ending = false
        void this.ws.play().catch(() => {})
        this.emit('seek', time)
      }),
      this.ws.on('error', () => this.emit('error', 0)),
      this.regions.on('region-clicked', (region, event) => {
        event.stopPropagation()
        this.onRegionClick?.(region.id)
      }),
    )
  }

  play(): void {
    this.range = null
    this.ending = false
    void this.ws.play().catch(() => {})
  }

  pause(): void {
    this.ws.pause()
  }

  seek(time: number): void {
    this.range = null
    this.ending = false
    this.ws.setTime(time)
    this.emit('seek', time)
  }

  getCurrentTime(): number {
    return this.ws.getCurrentTime()
  }

  getDuration(): number {
    return this.ws.getDuration()
  }

  playRange(start: number, end: number): void {
    this.range = { start, end }
    this.ending = false
    this.ws.setTime(start)
    void this.ws.play().catch(() => {})
  }

  setLoop(loop: boolean): void {
    this.loop = loop
  }

  setPlaybackRate(rate: number): void {
    this.rate = rate
    this.ws.setPlaybackRate(rate, true)
  }

  setOnRegionClick(cb: (id: string) => void): void {
    this.onRegionClick = cb
  }

  setRegions(segments: readonly ShadowingSegment[], activeId: string | null): void {
    this.regions.clearRegions()
    for (const segment of segments) {
      const region = this.regions.addRegion({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        drag: false,
        resize: false,
        color: segment.id === activeId ? ACTIVE_REGION : IDLE_REGION,
      })
      if (region.element) region.element.style.pointerEvents = 'none'
    }
  }

  on(event: AudioPlayerEvent, cb: (time: number) => void): () => void {
    let bucket = this.listeners.get(event)
    if (!bucket) {
      bucket = new Set()
      this.listeners.set(event, bucket)
    }
    bucket.add(cb)
    return () => bucket.delete(cb)
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    this.listeners.clear()
    this.ws.destroy()
  }

  private handleTime(time: number): void {
    const range = this.range
    if (range && time >= range.end) {
      if (this.loop) {
        this.ending = false
        this.ws.setTime(range.start)
        this.emit('timeupdate', range.start)
        return
      }
      if (!this.ending) {
        this.ending = true
        const hold = Math.max(range.start, range.end - 0.001)
        this.ws.pause()
        this.ws.setTime(range.end)
        this.emit('timeupdate', hold)
      }
      return
    }

    this.ending = false
    this.emit('timeupdate', time)
  }

  private emit(event: AudioPlayerEvent, time: number): void {
    const bucket = this.listeners.get(event)
    if (!bucket) return
    for (const listener of bucket) listener(time)
  }
}
