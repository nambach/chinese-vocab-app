export type AudioSource =
  | { type: 'file'; src: string }
  | { type: 'youtube'; videoId: string }

export type WordTiming = {
  text: string
  start: number
  end: number
}

export type ShadowingSegment = {
  id: string
  /** Simplified Hanzi. */
  text: string
  pinyin?: string
  /** Vietnamese meaning. */
  meaning?: string
  /** Seconds from the start of the audio. */
  start: number
  end: number
  words?: WordTiming[]
}

export type ShadowingLesson = {
  id: string
  title: string
  audio: AudioSource
  segments: ShadowingSegment[]
}
