import type { Catalog, Word } from '../models/types'

export function createId(): string {
  return crypto.randomUUID()
}

export function createCatalog(name: string, folderId?: string): Catalog {
  const now = Date.now()
  return {
    id: createId(),
    name: name.trim(),
    words: [],
    createdAt: now,
    updatedAt: now,
    ...(folderId ? { folderId } : {}),
  }
}

export function createWord(input: Omit<Word, 'id'>): Word {
  const note = input.note?.trim()
  return {
    id: createId(),
    hanzi: input.hanzi.trim(),
    pinyin: input.pinyin.trim(),
    meaning: input.meaning.trim(),
    ...(note ? { note } : {}),
    ...(input.sources?.length ? { sources: input.sources } : {}),
  }
}
