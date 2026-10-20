import { describe, expect, it } from 'vitest'
import { attachKewen, exportLesson, importLesson, setWordSources } from './lessonTransfer'
import { createAudioStore, MemoryBlobStore } from './audioStore'
import { parseLessonFile } from '../shadowing/lessonSchema'
import { defaultAppState, type Catalog, type Kewen } from '../models/types'

const segments = [
  { id: 's3', text: '我现在去图书馆。', start: 1, end: 2, section: 'kewen' as const },
  { id: 's9', text: '现在', start: 3, end: 4, section: 'shengci' as const },
]

function lessonCatalog(overrides: Partial<Catalog> = {}): Catalog {
  return {
    id: 'cat-1',
    name: 'Bài của tôi',
    createdAt: 1,
    updatedAt: 1,
    lastResult: {
      id: 'result-keep',
      directionId: 'hanzi-to-vn',
      correct: 1,
      total: 2,
      durationMs: 10,
      finishedAt: 424242,
    },
    words: [
      {
        id: 'w1',
        hanzi: '现在',
        pinyin: 'xiànzài',
        meaning: 'bây giờ',
        note: 'đã học',
        sources: [
          { lessonId: 'lesson-a', segmentId: 's3' },
          { lessonId: 'other', segmentId: 's9' },
        ],
      },
      { id: 'w2', hanzi: '奶茶', pinyin: 'nǎichá', meaning: 'trà sữa', note: '   ' },
    ],
    kewen: {
      lessonId: 'lesson-a',
      title: 'Bài gốc',
      audio: { type: 'local', blobId: 'blob-1', name: 'bai.mp3', size: 4, mime: 'audio/mpeg' },
      segments,
    },
    ...overrides,
  }
}

function stateWith(catalog: Catalog) {
  return { ...defaultAppState(), catalogs: [catalog] }
}

describe('attachKewen / setWordSources', () => {
  const kewen: Kewen = {
    lessonId: 'lesson-a',
    title: 'Bài gốc',
    audio: { type: 'file', src: 'audio/shadowing/bai-16.mp3' },
    segments,
  }

  it('turns a word list into a lesson without touching words or practice history', () => {
    const { kewen: _lesson, ...wordList } = lessonCatalog()
    const state = stateWith(wordList)
    const next = attachKewen(state, 'cat-1', kewen)
    const catalog = next.catalogs[0]

    expect(catalog.kewen).toEqual(kewen)
    expect(catalog.words).toEqual(wordList.words)
    expect(catalog.lastResult?.finishedAt).toBe(424242)
    expect(attachKewen(state, 'missing', kewen)).toBe(state)
  })

  it('replaces positions, drops blanks and duplicates, and can clear them', () => {
    const state = stateWith(lessonCatalog())
    const assigned = setWordSources(state, 'cat-1', 'w1', [
      { lessonId: 'lesson-a', segmentId: 's3' },
      { lessonId: 'lesson-a', segmentId: 's3' },
      { lessonId: ' ', segmentId: 's1' },
      { lessonId: 'lesson-a', segmentId: 's9' },
    ])
    expect(assigned.catalogs[0].words[0].sources).toEqual([
      { lessonId: 'lesson-a', segmentId: 's3' },
      { lessonId: 'lesson-a', segmentId: 's9' },
    ])
    expect(assigned.catalogs[0].words[0].meaning).toBe('bây giờ')
    expect(assigned.catalogs[0].words[1]).toBe(state.catalogs[0].words[1])
    expect(setWordSources(assigned, 'cat-1', 'w1', assigned.catalogs[0].words[0].sources ?? [])).toBe(assigned)
    expect(setWordSources(state, 'cat-1', 'missing', [])).toBe(state)

    const cleared = setWordSources(assigned, 'cat-1', 'w1', [])
    expect(cleared.catalogs[0].words[0].sources).toBeUndefined()
    expect(cleared.catalogs[0].words[0].hanzi).toBe('现在')
  })
})

describe('exportLesson / importLesson', () => {
  it('exports a renamed lesson without history, foreign sentences, or the device blob id', async () => {
    const file = await exportLesson(lessonCatalog())
    expect(file).toMatchObject({
      format: 'cn-vocab-lesson',
      version: 1,
      id: 'lesson-a',
      title: 'Bài của tôi',
      audio: { type: 'local', name: 'bai.mp3', size: 4, mime: 'audio/mpeg' },
    })
    expect(file?.words).toEqual([
      { hanzi: '现在', pinyin: 'xiànzài', meaning: 'bây giờ', note: 'đã học', segments: ['s3'] },
      { hanzi: '奶茶', pinyin: 'nǎichá', meaning: 'trà sữa' },
    ])
    expect(file?.segments.map((segment) => segment.id)).toEqual(['s3', 's9'])
    const text = JSON.stringify(file)
    expect(text).not.toContain('424242')
    expect(text).not.toContain('blob-1')
    expect(text).not.toContain('other')
  })

  it('embeds local audio only when the bytes are passed', async () => {
    const bytes = new Uint8Array([0, 255, 10, 65])
    const blob = new Blob([bytes], { type: 'audio/mpeg' })
    const embedded = await exportLesson(lessonCatalog(), blob)
    expect(embedded?.audio).toMatchObject({
      type: 'embedded',
      mime: 'audio/mpeg',
      name: 'bai.mp3',
      size: bytes.byteLength,
    })
    if (embedded?.audio.type !== 'embedded') throw new Error('expected embedded audio')

    const remote = lessonCatalog({
      kewen: {
          lessonId: 'lesson-a',
        title: 'Bài gốc',
        audio: { type: 'url', src: 'https://example.com/a.mp3' },
        segments,
      },
    })
    expect((await exportLesson(remote, blob))?.audio).toEqual({
      type: 'url',
      src: 'https://example.com/a.mp3',
    })

    const bundled = lessonCatalog({
      kewen: {
          lessonId: 'lesson-a',
        title: 'Bài gốc',
        audio: { type: 'file', src: 'audio/shadowing/bai-16.mp3' },
        segments,
      },
    })
    expect((await exportLesson(bundled, blob))?.audio).toEqual({
      type: 'file',
      src: 'audio/shadowing/bai-16.mp3',
    })
  })

  it('exports the script stored on the device with the user word list', async () => {
    const edited = segments.map((segment) =>
      segment.id === 's3' ? { ...segment, text: '我现在去书店。' } : segment,
    )
    const catalog = lessonCatalog({
      name: 'Bài 16 đã sửa',
      kewen: {
        lessonId: 'bai-16',
        title: 'Bài 16',
        audio: { type: 'file', src: 'audio/shadowing/bai-16.mp3' },
        segments: edited,
      },
      words: [
        {
          id: 'w1',
          hanzi: '现在',
          pinyin: 'xiànzài',
          meaning: 'đã sửa',
          sources: [{ lessonId: 'bai-16', segmentId: 's3' }],
        },
      ],
    })

    const file = await exportLesson(catalog, new Blob(['nope']))
    expect(file?.id).toBe('bai-16')
    expect(file?.title).toBe('Bài 16 đã sửa')
    expect(file?.audio).toEqual({ type: 'file', src: 'audio/shadowing/bai-16.mp3' })
    expect(file?.segments).toEqual(edited)
    expect(file?.words).toEqual([
      { hanzi: '现在', pinyin: 'xiànzài', meaning: 'đã sửa', segments: ['s3'] },
    ])
    expect(await exportLesson(lessonCatalog({ kewen: undefined }))).toBeNull()
  })

  it('imports a new catalog and keeps segment ids', async () => {
    const bytes = new Uint8Array([0, 255, 10, 65])
    const exported = await exportLesson(lessonCatalog(), new Blob([bytes], { type: 'audio/mpeg' }))
    const parsed = parseLessonFile(exported)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok || !exported) return

    const ids = ['lesson', 'catalog', 'word-1', 'word-2']
    let cursor = 0
    const audio = createAudioStore(new MemoryBlobStore(), { createId: () => 'stored-blob' })
    const imported = await importLesson(parsed.file, {
      now: 50,
      createId: () => ids[cursor++],
      putAudio: (blob) => audio.putAudio(blob),
    })

    expect(imported.id).toBe('catalog')
    expect(imported.builtinId).toBeUndefined()
    expect(imported.lastResult).toBeUndefined()
    expect(imported.createdAt).toBe(50)
    expect(imported.kewen).toMatchObject({
      lessonId: 'custom-lesson',
      title: 'Bài của tôi',
      audio: { type: 'local', blobId: 'stored-blob', name: 'bai.mp3', size: 4, mime: 'audio/mpeg' },
    })
    expect(imported.kewen?.segments[0].text).toBe('我现在去图书馆。')
    parsed.file.segments[0].text = 'đổi sau khi nhập'
    expect(imported.kewen?.segments[0].text).toBe('我现在去图书馆。')
    expect(imported.words.map((word) => word.id)).toEqual(['word-1', 'word-2'])
    expect(imported.words[0]).toMatchObject({
      hanzi: '现在',
      note: 'đã học',
      sources: [{ lessonId: 'custom-lesson', segmentId: 's3' }],
    })
    expect(imported.words[1].sources).toBeUndefined()

    const stored = await audio.getAudio('stored-blob')
    expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(bytes)

    const again = await importLesson(parsed.file, {
      putAudio: (blob) => audio.putAudio(blob),
    })
    expect(again.id).not.toBe(imported.id)
    expect(again.kewen?.lessonId).not.toBe('custom-lesson')
  })

  it('keeps a detached file as a name and size until the recipient chooses it', async () => {
    const exported = await exportLesson(lessonCatalog())
    const parsed = parseLessonFile(exported)
    if (!parsed.ok) throw new Error('export did not parse')
    let puts = 0
    const imported = await importLesson(parsed.file, {
      createId: () => 'id',
      putAudio: async () => {
        puts += 1
        return 'unused'
      },
    })
    expect(puts).toBe(0)
    expect(imported.kewen?.audio).toEqual({
      type: 'local',
      name: 'bai.mp3',
      size: 4,
      mime: 'audio/mpeg',
    })
  })

  it('refuses embedded audio when there is nowhere to store it', async () => {
    const exported = await exportLesson(
      lessonCatalog(),
      new Blob([new Uint8Array([1])], { type: 'audio/mpeg' }),
    )
    const parsed = parseLessonFile(exported)
    if (!parsed.ok) throw new Error('export did not parse')
    await expect(importLesson(parsed.file, { createId: () => 'id' })).rejects.toThrow(/putAudio/)
  })
})
