import { useRef } from 'react'
import { useApp } from '../context/AppContext'
import { resultPercent } from '../lib/results'
import { BigButton, Card, ScreenShell, type MenuItem } from '../components/ui'

export function Home() {
  const { state, setView, addCatalog, importCatalog } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleCreate() {
    const name = window.prompt('Tên bộ sưu tập mới')
    if (!name?.trim()) return
    const catalog = addCatalog(name)
    setView({ name: 'catalog', catalogId: catalog.id })
  }

  async function handleImportFile(file: File) {
    const text = await file.text()
    const fallbackName = file.name.replace(/\.txt$/i, '') || 'Bộ sưu tập nhập'
    const { catalog, errors } = importCatalog(text, fallbackName)
    if (errors.length > 0) {
      window.alert(`Đã nhập ${catalog.words.length} từ.\nCảnh báo:\n${errors.slice(0, 5).join('\n')}`)
    }
    setView({ name: 'catalog', catalogId: catalog.id })
  }

  const menuItems: MenuItem[] = [
    { label: '+ Tạo bộ sưu tập', onClick: handleCreate },
    { label: 'Nhập từ file .txt', onClick: () => fileInputRef.current?.click() },
    { label: 'Cài đặt', onClick: () => setView({ name: 'settings' }) },
  ]

  const isEmpty = state.catalogs.length === 0

  return (
    <ScreenShell title="Bộ sưu tập" menuItems={menuItems}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void handleImportFile(file)
          }
          event.target.value = ''
        }}
      />

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
          <p className="text-teal-700">Chưa có bộ sưu tập nào.</p>
          <BigButton className="max-w-xs" onClick={handleCreate}>
            Tạo bộ sưu tập
          </BigButton>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {state.catalogs.map((catalog) => (
            <li key={catalog.id}>
              <Card className="p-4">
                <button
                  type="button"
                  onClick={() => setView({ name: 'catalog', catalogId: catalog.id })}
                  className="w-full text-left"
                >
                  <h2 className="text-xl font-semibold text-teal-950">{catalog.name}</h2>
                  <p className="mt-1 text-sm text-teal-700">
                    {catalog.words.length} từ
                    {catalog.lastResult
                      ? ` · lần trước ${catalog.lastResult.correct}/${catalog.lastResult.total} (${resultPercent(
                          catalog.lastResult,
                        )}%)`
                      : ''}
                  </p>
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </ScreenShell>
  )
}
