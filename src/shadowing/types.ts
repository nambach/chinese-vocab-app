export type AudioSource =
  | { type: 'file'; src: string }
  | { type: 'url'; src: string }
  | {
      type: 'local'
      /**
       * Key in IndexedDB. Absent when a lesson was imported without the file:
       * `name` and `size` are what the recipient matches when they choose it again.
       */
      blobId?: string
      name: string
      size: number
      mime: string
    }
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
  /** heading: 课文 / title / 生词 labels. kewen: dialogue. shengci: a read-aloud vocab item. */
  section?: 'heading' | 'kewen' | 'shengci'
  words?: WordTiming[]
}

export type ShadowingLesson = {
  id: string
  title: string
  audio: AudioSource
  segments: ShadowingSegment[]
}
