import { useMemo, useState } from 'react'
import { BigButton, Card } from './ui'
import { normalizePinyin } from '../lib/pinyin'
import type { Word } from '../models/types'

type WordListProps = {
  words: Word[]
  onEdit: (wordId: string) => void
  onDelete: (wordId: string) => void
  onMove: (wordId: string, direction: 'up' | 'down') => void
}

export function WordList({ words, onEdit, onDelete, onMove }: WordListProps) {
  const [query, setQuery] = useState('')

  const filteredWords = useMemo(() => {
    const raw = query.trim().toLowerCase()
    if (!raw) return words
    const normalizedQuery = normalizePinyin(raw)

    return words.filter(
      (word) =>
        word.hanzi.includes(query.trim()) ||
        word.pinyin.toLowerCase().includes(raw) ||
        normalizePinyin(word.pinyin).includes(normalizedQuery) ||
        word.meaning.toLowerCase().includes(raw),
    )
  }, [query, words])

  if (words.length === 0) {
    return (
      <Card className="text-center text-teal-700">
        Chưa có từ nào. Hãy thêm từ mới để bắt đầu.
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Tìm từ..."
        className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-base outline-none focus:border-teal-500"
      />

      <ul className="flex flex-col gap-3">
        {filteredWords.map((word) => {
          const index = words.findIndex((item) => item.id === word.id)
          return (
            <li key={word.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-2xl font-semibold text-teal-950">{word.hanzi}</div>
                    <div className="mt-1 text-base text-teal-800">{word.pinyin}</div>
                    <div className="mt-1 text-sm text-teal-700">{word.meaning}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => onMove(word.id, 'up')}
                      disabled={index === 0}
                      className="rounded-lg bg-teal-50 px-3 py-1 text-sm text-teal-800 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(word.id, 'down')}
                      disabled={index === words.length - 1}
                      className="rounded-lg bg-teal-50 px-3 py-1 text-sm text-teal-800 disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <BigButton variant="secondary" className="py-3 text-base" onClick={() => onEdit(word.id)}>
                    Sửa
                  </BigButton>
                  <BigButton
                    variant="danger"
                    className="py-3 text-base"
                    onClick={() => {
                      if (window.confirm(`Xóa từ "${word.hanzi}"?`)) {
                        onDelete(word.id)
                      }
                    }}
                  >
                    Xóa
                  </BigButton>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
