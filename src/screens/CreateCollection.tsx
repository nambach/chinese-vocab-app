import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { IMPORT_FORMAT_GUIDE_BODY, parseCatalogText } from '../lib/txt'
import { BigButton, Card, LineNumberedTextarea, ScreenShell } from '../components/ui'

export function CreateCollection() {
  const { setView, goBack, createCollection } = useApp()
  const [name, setName] = useState('')
  const [text, setText] = useState('')

  const parsed = useMemo(() => parseCatalogText(text), [text])
  const effectiveName = name.trim()
  const canCreate = effectiveName.length > 0

  function create() {
    if (!canCreate) return
    const catalog = createCollection(effectiveName, parsed.words)
    setView({ name: 'catalog', catalogId: catalog.id })
  }

  function startGuidedAdd() {
    if (!canCreate) {
      window.alert('Vui lòng nhập tên bộ sưu tập trước.')
      return
    }
    const catalog = createCollection(effectiveName, parsed.words)
    setView({ name: 'guidedAdd', catalogId: catalog.id })
  }

  return (
    <ScreenShell
      title="Tạo bộ sưu tập"
      onBack={() => goBack({ name: 'home' })}
      backLabel="Trang chủ"
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

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-teal-800">Bộ từ vựng</span>
        <LineNumberedTextarea
          value={text}
          onChange={setText}
          placeholder={IMPORT_FORMAT_GUIDE_BODY}
          rows={8}
          errorLines={new Set(parsed.errorLines)}
        />
        <p className="text-sm text-teal-700">
          Dán bộ từ vựng bạn vừa copy vào ô trên, hoặc{' '}
          <button
            type="button"
            onClick={startGuidedAdd}
            className="font-medium text-teal-800 underline underline-offset-2 active:text-teal-950"
          >
            nhập mới từng từ
          </button>
          .
        </p>
      </div>

      {text.trim() ? (
        <Card>
          <p className="text-sm text-teal-800">
            Đã nhận {parsed.words.length} từ
            {parsed.errors.length > 0 ? ` · ${parsed.errors.length} dòng lỗi` : ''}
          </p>
        </Card>
      ) : null}
    </ScreenShell>
  )
}
