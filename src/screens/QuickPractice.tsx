import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { createWord } from '../data/store'
import { IMPORT_FORMAT_GUIDE, parseCatalogText } from '../lib/txt'
import { BigButton, Card, LineNumberedTextarea, ScreenShell } from '../components/ui'

export function QuickPractice() {
  const { setView, goBack, setQuickSuite, createCollection } = useApp()
  const [text, setText] = useState('')

  const parsed = useMemo(() => parseCatalogText(text), [text])
  const hasWords = parsed.words.length > 0
  const title = parsed.name || 'Luyện tập nhanh'

  function practiceNow() {
    if (!hasWords) return
    setQuickSuite({ title, words: parsed.words.map((word) => createWord(word)) })
    setView({ name: 'practiceSetup' })
  }

  function saveCollection() {
    if (!hasWords) return
    const name = window.prompt('Tên bộ sưu tập', title)?.trim()
    if (!name) return
    const catalog = createCollection(name, parsed.words)
    setView({ name: 'catalog', catalogId: catalog.id })
  }

  return (
    <ScreenShell
      title="Luyện tập ngay"
      subtitle="Dán bộ từ vựng vào ô bên dưới"
      onBack={() => goBack({ name: 'home' })}
      backLabel="Trang chủ"
      footer={
        <div className="grid gap-3">
          <BigButton onClick={practiceNow} disabled={!hasWords}>
            Luyện tập ngay{hasWords ? ` (${parsed.words.length} từ)` : ''}
          </BigButton>
          <BigButton variant="secondary" onClick={saveCollection} disabled={!hasWords}>
            Lưu để dùng sau
          </BigButton>
        </div>
      }
    >
      <LineNumberedTextarea
        value={text}
        onChange={setText}
        placeholder={IMPORT_FORMAT_GUIDE}
        rows={10}
        autoFocus
        errorLines={new Set(parsed.errorLines)}
      />

      {text.trim() ? (
        <Card>
          <p className="text-sm text-teal-800">
            Đã nhận {parsed.words.length} từ
            {parsed.errors.length > 0 ? ` · ${parsed.errors.length} dòng lỗi` : ''}
          </p>
          {parsed.errors.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-red-600">
              {parsed.errors.slice(0, 5).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : (
        <Card>
          <h2 className="text-sm font-semibold text-teal-900">Định dạng</h2>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-teal-50 p-3 text-xs text-teal-800">
            {IMPORT_FORMAT_GUIDE}
          </pre>
        </Card>
      )}
    </ScreenShell>
  )
}
