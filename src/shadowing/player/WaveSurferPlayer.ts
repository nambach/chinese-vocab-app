import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import type { AudioPlayer, AudioPlayerEvent } from './AudioPlayer'
import type { ShadowingSegment } from '../types'

const ACTIVE_REGION = 'rgba(15, 118, 110, 0.18)'
const IDLE_REGION = 'rgba(15, 118, 110, 0.06)'
const EDITABLE_REGION = 'rgba(15, 118, 110, 0.32)'
const SELECTION_COLOR = 'rgba(217, 119, 6, 0.35)'
const SELECTION_ID = '__sel__'
const MIN_REGION = 0.01
const ZOOM_STEP = 1.5

export type RegionTimingUpdate = { id: string; start: number; end: number }
export type TimeRange = { start: number; end: number }

/**
 * WaveSurfer v7 backend. Sentence range and looping are tracked here so the
 * lesson UI does not depend on WaveSurfer's region playback.
 *
 * Outside edit mode, region overlays are visual only so a click seeks and
 * starts playback. In edit mode a click seeks and the editor selects the
 * sentence at that time. Playback stays as it was: paused stays paused,
 * and a click while playing keeps playing from the new time.
 */
export class WaveSurferPlayer implements AudioPlayer {
  private ws: WaveSurfer
  private regions: RegionsPlugin
  private range: { start: number; end: number } | null = null
  private loop = false
  private ending = false
  private rate = 1
  private editMode = false
  private zoomFactor = 1
  private selection: TimeRange | null = null
  private regionStructure = ''
  private stopDragSelection: (() => void) | null = null
  private onRegionClick: ((id: string) => void) | null = null
  private onRegionUpdate: ((update: RegionTimingUpdate) => void) | null = null
  private onRegionUpdated: ((update: RegionTimingUpdate) => void) | null = null
  private onSelection: ((range: TimeRange | null) => void) | null = null
  private suppressRegionEvents = false
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
        if (this.editMode) this.applyZoom()
        this.emit('ready', duration)
      }),
      this.ws.on('timeupdate', (time) => this.handleTime(time)),
      this.ws.on('play', () => this.emit('play', this.ws.getCurrentTime())),
      this.ws.on('pause', () => this.emit('pause', this.ws.getCurrentTime())),
      this.ws.on('interaction', (time) => {
        const keepPlaying = !this.editMode || this.ws.isPlaying()
        this.range = null
        this.ending = false
        if (this.editMode) this.clearSelection()
        this.emit('seek', time)
        if (keepPlaying) void this.ws.play().catch(() => {})
        else this.ws.pause()
      }),
      this.ws.on('resize', () => {
        if (this.editMode) this.applyZoom()
      }),
      this.ws.on('error', () => this.emit('error', 0)),
      this.regions.on('region-initialized', (region) => {
        if (region.id === SELECTION_ID) this.paintSelection(region)
      }),
      this.regions.on('region-created', (region) => {
        if (region.id !== SELECTION_ID) return
        this.adoptSelection(region)
      }),
      this.regions.on('region-clicked', (region, event) => {
        event.stopPropagation()
        if (region.id === SELECTION_ID) return
        this.onRegionClick?.(region.id)
      }),
      this.regions.on('region-update', (region) => {
        if (this.suppressRegionEvents || region.id === SELECTION_ID) return
        this.onRegionUpdate?.({ id: region.id, start: region.start, end: region.end })
      }),
      this.regions.on('region-updated', (region) => {
        if (this.suppressRegionEvents || region.id === SELECTION_ID) return
        this.onRegionUpdated?.({ id: region.id, start: region.start, end: region.end })
      }),
    )
  }

  /** Seek-only clicks, drag-to-select, and resize of the active sentence. */
  setEditMode(on: boolean): void {
    if (this.editMode === on) return
    this.editMode = on
    this.stopDragSelection?.()
    this.stopDragSelection = null
    this.regionStructure = ''
    if (!on) {
      this.clearSelection()
      return
    }
    this.stopDragSelection = this.regions.enableDragSelection({
      id: SELECTION_ID,
      color: SELECTION_COLOR,
      drag: false,
      resize: false,
    })
    if (this.ws.getDuration() > 0) this.applyZoom()
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

  setOnRegionUpdate(cb: ((update: RegionTimingUpdate) => void) | null): void {
    this.onRegionUpdate = cb
  }

  setOnRegionUpdated(cb: ((update: RegionTimingUpdate) => void) | null): void {
    this.onRegionUpdated = cb
  }

  setOnSelection(cb: ((range: TimeRange | null) => void) | null): void {
    this.onSelection = cb
  }

  clearSelection(): void {
    if (!this.selection && !this.regions.getRegions().some((region) => region.id === SELECTION_ID)) {
      return
    }
    this.selection = null
    this.suppressRegionEvents = true
    for (const region of [...this.regions.getRegions()]) {
      if (region.id === SELECTION_ID) region.remove()
    }
    this.suppressRegionEvents = false
    this.onSelection?.(null)
  }

  setRegions(
    segments: readonly ShadowingSegment[],
    activeId: string | null,
    options?: { editableId?: string | null },
  ): void {
    const editableId = options?.editableId ?? null
    const structure = this.structureKey(segments, activeId, editableId)
    if (structure === this.regionStructure) {
      if (editableId) {
        const segment = segments.find((item) => item.id === editableId)
        if (segment) this.setEditableRange(editableId, segment.start, segment.end)
      }
      return
    }
    this.regionStructure = structure

    const selection = this.selection
    this.suppressRegionEvents = true
    this.regions.clearRegions()
    for (const segment of segments) {
      const editable = editableId === segment.id
      const region = this.regions.addRegion({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        drag: false,
        resize: editable,
        minLength: MIN_REGION,
        color: editable ? EDITABLE_REGION : segment.id === activeId ? ACTIVE_REGION : IDLE_REGION,
      })
      this.styleRegion(region, editable)
    }
    if (selection && this.editMode) this.addSelectionRegion(selection)
    this.suppressRegionEvents = false
  }

  /** Move the active sentence's handles without redrawing every region. */
  setEditableRange(id: string, start: number, end: number): void {
    const region = this.regions.getRegions().find((item) => item.id === id)
    if (!region || (region.start === start && region.end === end)) return
    this.suppressRegionEvents = true
    region.setOptions({ start, end })
    this.suppressRegionEvents = false
  }

  zoom(pxPerSec: number): void {
    try {
      this.ws.zoom(pxPerSec)
    } catch {
      // Waveform not ready yet.
    }
  }

  zoomIn(): number {
    this.zoomFactor *= ZOOM_STEP
    this.applyZoom()
    return this.zoomFactor
  }

  zoomOut(): number {
    this.zoomFactor = Math.max(1, this.zoomFactor / ZOOM_STEP)
    this.applyZoom()
    return this.zoomFactor
  }

  zoomReset(): number {
    this.zoomFactor = 1
    this.applyZoom()
    return this.zoomFactor
  }

  /** Scroll so [start, end] is in frame. Zoom stays as the user set it. */
  scrollIntoView(start: number, end: number): void {
    const duration = this.ws.getDuration()
    const viewWidth = this.ws.getWidth()
    if (!(duration > 0) || !(viewWidth > 0)) return
    const scroll = this.ws.getWrapper().parentElement
    if (!scroll) return
    const full = scroll.scrollWidth
    if (full <= viewWidth + 1) return
    const left = (start / duration) * full
    const right = (end / duration) * full
    const margin = 16
    const visibleLeft = scroll.scrollLeft
    const visibleRight = visibleLeft + viewWidth
    if (left >= visibleLeft + margin && right <= visibleRight - margin) return
    const target = Math.max(0, Math.min(full - viewWidth, (left + right) / 2 - viewWidth / 2))
    this.ws.setScroll(target)
  }

  /** Widen minPxPerSec so the sentence span fills most of the viewport, then scroll to it. */
  focusSegment(segment: Pick<ShadowingSegment, 'start' | 'end'>, viewportWidth: number): void {
    const pad = 1.5
    const window = Math.max(4, segment.end - segment.start + pad * 2)
    const width = viewportWidth > 0 ? viewportWidth : 320
    const pxPerSec = Math.min(400, Math.max(50, (width * 0.85) / window))
    this.zoom(pxPerSec)
    const center = (segment.start + segment.end) / 2
    this.ws.setScrollTime(center)
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
    this.stopDragSelection?.()
    this.stopDragSelection = null
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    this.listeners.clear()
    this.ws.destroy()
  }

  private applyZoom(): void {
    const duration = this.ws.getDuration()
    const width = this.ws.getWidth()
    if (!(duration > 0) || !(width > 0)) return
    this.zoom((width / duration) * this.zoomFactor)
  }

  private structureKey(
    segments: readonly ShadowingSegment[],
    activeId: string | null,
    editableId: string | null,
  ): string {
    const body = segments
      .map((segment) =>
        segment.id === editableId ? segment.id : `${segment.id}@${segment.start},${segment.end}`,
      )
      .join('|')
    return `${activeId ?? ''}#${editableId ?? ''}#${body}`
  }

  private styleRegion(region: Region, editable: boolean): void {
    const element = region.element
    if (!element) return
    // Clicks pass through to the waveform. Only the active sentence's handles catch the pointer.
    element.style.pointerEvents = 'none'
    if (!editable) return
    element.querySelectorAll<HTMLElement>('[part*="region-handle"]').forEach((handle) => {
      handle.style.pointerEvents = 'auto'
      handle.style.width = '8px'
      handle.style.background = '#134e4a'
      handle.style.border = 'none'
    })
  }

  private paintSelection(region: Region): void {
    if (region.element) region.element.style.pointerEvents = 'none'
  }

  private adoptSelection(region: Region): void {
    this.paintSelection(region)
    for (const other of [...this.regions.getRegions()]) {
      if (other !== region && other.id === SELECTION_ID) other.remove()
    }
    this.selection = { start: region.start, end: region.end }
    if (!this.suppressRegionEvents) this.onSelection?.(this.selection)
  }

  private addSelectionRegion(range: TimeRange): void {
    const region = this.regions.addRegion({
      id: SELECTION_ID,
      start: range.start,
      end: range.end,
      drag: false,
      resize: false,
      color: SELECTION_COLOR,
    })
    this.paintSelection(region)
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
