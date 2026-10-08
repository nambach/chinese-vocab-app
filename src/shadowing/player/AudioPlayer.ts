export type AudioPlayerEvent = 'ready' | 'timeupdate' | 'play' | 'pause' | 'seek' | 'error'

export interface AudioPlayer {
  /** Free playback from the current position. Clears any active sentence range. */
  play(): void
  pause(): void
  seek(time: number): void
  getCurrentTime(): number
  getDuration(): number
  /** Play [start, end], then pause or loop depending on setLoop. */
  playRange(start: number, end: number): void
  setLoop(loop: boolean): void
  /** `preservePitch` stays on so slowed speech does not drop in pitch. */
  setPlaybackRate(rate: number): void
  on(event: AudioPlayerEvent, cb: (time: number) => void): () => void
  destroy(): void
}
