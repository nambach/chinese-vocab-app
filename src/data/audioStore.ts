/**
 * Audio bytes live in IndexedDB, never in localStorage.
 * Tests pass a MemoryBlobStore so they do not need IndexedDB or a fake-indexeddb package.
 */

export interface BlobStore {
  put(id: string, blob: Blob): Promise<void>
  get(id: string): Promise<Blob | undefined>
  delete(id: string): Promise<void>
  list(): Promise<string[]>
}

export class MemoryBlobStore implements BlobStore {
  private readonly records = new Map<string, Blob>()

  async put(id: string, blob: Blob): Promise<void> {
    this.records.set(id, blob)
  }

  async get(id: string): Promise<Blob | undefined> {
    return this.records.get(id)
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id)
  }

  async list(): Promise<string[]> {
    return [...this.records.keys()]
  }
}

const DB_NAME = 'cn-vocab-audio'
const DB_STORE = 'blobs'

export class IndexedDbBlobStore implements BlobStore {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'))
    })
  }

  private async run<T>(
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open()
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, mode)
        const request = body(tx.objectStore(DB_STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('indexedDB request failed'))
        tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'))
      })
    } finally {
      db.close()
    }
  }

  put(id: string, blob: Blob): Promise<void> {
    return this.run('readwrite', (store) => store.put(blob, id)).then(() => undefined)
  }

  async get(id: string): Promise<Blob | undefined> {
    const value = await this.run<Blob | undefined>('readonly', (store) => store.get(id))
    return value instanceof Blob ? value : undefined
  }

  delete(id: string): Promise<void> {
    return this.run('readwrite', (store) => store.delete(id)).then(() => undefined)
  }

  async list(): Promise<string[]> {
    const keys = await this.run<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
    return keys.filter((key): key is string => typeof key === 'string')
  }
}

export type AudioStore = {
  putAudio(blob: Blob): Promise<string>
  getAudio(id: string): Promise<Blob | undefined>
  deleteAudio(id: string): Promise<void>
  listAudio(): Promise<string[]>
}

/**
 * Safari may delete storage of a site that is not installed. The first save
 * asks the browser to keep it. A refusal still stores the blob for this session.
 */
export function createAudioStore(
  blobs: BlobStore,
  options?: {
    persist?: () => Promise<boolean>
    createId?: () => string
  },
): AudioStore {
  const persist = options?.persist
  const createId = options?.createId ?? (() => crypto.randomUUID())
  let persisting: Promise<void> | undefined

  return {
    async putAudio(blob) {
      if (persist && !persisting) {
        persisting = persist().then(
          () => undefined,
          () => undefined,
        )
      }
      if (persisting) await persisting
      const id = createId()
      await blobs.put(id, blob)
      return id
    },
    getAudio(id) {
      return blobs.get(id)
    },
    deleteAudio(id) {
      return blobs.delete(id)
    },
    listAudio() {
      return blobs.list()
    },
  }
}

export function browserAudioStore(): AudioStore {
  const persist = navigator.storage?.persist
  return createAudioStore(new IndexedDbBlobStore(), {
    persist: persist ? () => persist.call(navigator.storage) : undefined,
  })
}
