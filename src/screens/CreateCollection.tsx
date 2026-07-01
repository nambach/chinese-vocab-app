import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { IMPORT_FORMAT_GUIDE, parseCatalogText } from '../lib/txt'
import { BigButton, Card, ScreenShell } from '../components/ui'

export function CreateCollection() {
  const { setView, createCollection } = useApp()
  const [name, setName] = useState('')
  const [text, setText] = useState('')

  const parsed = useMemo(() => parseCatalogText(text), [text])
  const effectiveName = name.trim() || parsed.name || ''
  const canCreate = effectiveName.length > 0

  function create() {
    if (!canCreate) return
    const catalog = createCollection(effectiveName, parsed.words)
    setView({ name: 'catalog', catalogId: catalog.id })
  }

  return (
    <ScreenShell
      title="Tạo bộ sưu tập"
      onBack={() => setView({ name: 'home' })}
      backLabel="← Trang chủ"
      footer={
        <BigButton onClick={create} disabled={!canCreate}>
          Tạo bộ sưu tập
        </BigButton>
      }
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-teal-800">Tên bộ sưu tập</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ví dụ: HSK 1 - Bài 1"
          autoFocus
          className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-4 text-lg text-teal-950 outline-none focus:border-teal-500"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-teal-800">Dán từ vựng (không bắt buộc)</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={IMPORT_FORMAT_GUIDE}
          rows={8}
          className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 font-mono text-sm text-teal-950 outline-none focus:border-teal-500"
        />
      </label>

      {text.trim() ? (
        <Card>
          <p className="text-sm text-teal-800">
            Đã nhận {parsed.words.length} từ
            {parsed.errors.length > 0 ? ` · ${parsed.errors.length} dòng lỗi` : ''}
          </p>
        </Card>
      ) : (
        <p className="px-1 text-xs text-teal-600">
          Để trống ô từ vựng nếu bạn muốn tự thêm từng từ sau khi tạo.
        </p>
      )}
    </ScreenShell>
  )
}
