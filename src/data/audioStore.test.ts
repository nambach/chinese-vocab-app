import { describe, expect, it } from 'vitest'
import { MemoryBlobStore, createAudioStore } from './audioStore'

describe('createAudioStore', () => {
  it('stores, lists, and deletes blobs', async () => {
    let n = 0
    const store = createAudioStore(new MemoryBlobStore(), {
      createId: () => `id-${++n}`,
    })
    const blob = new Blob([new Uint8Array([0, 255, 65])], { type: 'audio/mpeg' })

    const id = await store.putAudio(blob)
    const loaded = await store.getAudio(id)

    expect(id).toBe('id-1')
    expect(loaded).toBeInstanceOf(Blob)
    expect(new Uint8Array(await loaded!.arrayBuffer())).toEqual(new Uint8Array([0, 255, 65]))
    expect(await store.listAudio()).toEqual(['id-1'])
    expect(await store.getAudio('missing')).toBeUndefined()

    await store.deleteAudio(id)
    await store.deleteAudio(id)
    expect(await store.getAudio(id)).toBeUndefined()
    expect(await store.listAudio()).toEqual([])
  })

  it('asks the browser to persist storage once, even when two saves start together', async () => {
    let calls = 0
    let n = 0
    const store = createAudioStore(new MemoryBlobStore(), {
      createId: () => `id-${++n}`,
      persist: async () => {
        calls += 1
        await Promise.resolve()
        return false
      },
    })

    await Promise.all([store.putAudio(new Blob(['a'])), store.putAudio(new Blob(['b']))])
    await store.putAudio(new Blob(['c']))

    expect(calls).toBe(1)
    expect(await store.listAudio()).toEqual(['id-1', 'id-2', 'id-3'])
  })

  it('still stores the blob when persistence is refused', async () => {
    const store = createAudioStore(new MemoryBlobStore(), {
      createId: () => 'only',
      persist: async () => {
        throw new Error('denied')
      },
    })

    await expect(store.putAudio(new Blob(['a']))).resolves.toBe('only')
    expect(await store.getAudio('only')).toBeInstanceOf(Blob)
  })
})
