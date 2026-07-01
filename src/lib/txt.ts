import { convertToneNumbers } from './pinyin'
import { createCatalog, createWord } from '../data/store'
import type { Catalog, Word } from '../models/types'

export type ParsedImport = {
  name?: string
  words: Omit<Word, 'id'>[]
  errors: string[]
  errorLines: number[]
}

function splitLine(line: string): string[] | null {
  if (line.includes('|')) {
    return line.split('|').map((part) => part.trim())
  }
  if (line.includes('\t')) {
    return line.split('\t').map((part) => part.trim())
  }
  const spaced = line.split(/\s{2,}/).map((part) => part.trim())
  if (spaced.length >= 3) {
    return spaced
  }
  return null
}

export function parseCatalogText(text: string): ParsedImport {
  const lines = text.split(/\r?\n/)
  const words: Omit<Word, 'id'>[] = []
  const errors: string[] = []
  const errorLines: number[] = []
  let name: string | undefined

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#')) {
      if (!name) {
        name = line.replace(/^#\s*/, '').trim()
      }
      continue
    }

    const parts = splitLine(line)
    if (!parts || parts.length < 3) {
      errors.push(`Dòng ${index + 1}: không đúng định dạng`)
      errorLines.push(index + 1)
      continue
    }

    const [hanzi, rawPinyin, ...meaningParts] = parts
    const pinyin = convertToneNumbers(rawPinyin)
    const meaning = meaningParts.join(' | ').trim()

    if (!hanzi || !pinyin || !meaning) {
      errors.push(`Dòng ${index + 1}: thiếu dữ liệu`)
      errorLines.push(index + 1)
      continue
    }

    words.push({ hanzi, pinyin, meaning })
  }

  return { name, words, errors, errorLines }
}

export function importCatalogFromText(
  text: string,
  fallbackName = 'Bộ sưu tập nhập',
): { catalog: Catalog; errors: string[] } {
  const parsed = parseCatalogText(text)
  const catalog = createCatalog(parsed.name || fallbackName)
  catalog.words = parsed.words.map((word) => createWord(word))
  return { catalog, errors: parsed.errors }
}

export function exportCatalogToText(catalog: Catalog): string {
  const header = `# ${catalog.name}\n`
  const body = catalog.words
    .map((word) => `${word.hanzi} | ${word.pinyin} | ${word.meaning}`)
    .join('\n')
  return `${header}${body}\n`
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const IMPORT_FORMAT_GUIDE_BODY = `你好 | nǐ hǎo | xin chào
谢谢 | xiè xiè | cảm ơn
学习 | xue2 xi2 | học tập, học hành`

export const IMPORT_FORMAT_GUIDE = `# Tên bộ sưu tập
${IMPORT_FORMAT_GUIDE_BODY}`
