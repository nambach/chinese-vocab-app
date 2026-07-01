import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { BigButton, Card, ScreenShell } from '../components/ui'

export function CombinePractice() {
  const { state, setView, goBack, setQuickSuite } = useApp()
  const catalogs = state.catalogs
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const selectedCatalogs = useMemo(
    () => catalogs.filter((catalog) => selected.has(catalog.id)),
    [catalogs, selected],
  )

  const totalWords = useMemo(
    () => selectedCatalogs.reduce((sum, catalog) => sum + catalog.words.length, 0),
    [selectedCatalogs],
  )

  const canStart = selectedCatalogs.length >= 1 && totalWords > 0

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function start() {
    if (!canStart) return
    const words = selectedCatalogs.flatMap((catalog) => catalog.words)
    const title =
      selectedCatalogs.length === 1
        ? selectedCatalogs[0].name
        : `${selectedCatalogs.length} bài đã chọn`
    setQuickSuite({ title, words })
    setView({ name: 'practiceSetup' })
  }

  return (
    <ScreenShell
      title="Luyện tập nhiều bài"
      subtitle="Chọn các bộ sưu tập để luyện chung một lượt"
      onBack={() => goBack({ name: 'home' })}
      backLabel="Trang chủ"
      footer={
        <BigButton onClick={start} disabled={!canStart}>
          Luyện tập{canStart ? ` (${totalWords} từ)` : ''}
        </BigButton>
      }
    >
      {catalogs.length === 0 ? (
        <Card className="text-center text-teal-700">Chưa có bộ sưu tập nào được lưu.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {catalogs.map((catalog) => {
            const isSelected = selected.has(catalog.id)
            return (
              <li key={catalog.id}>
                <button
                  type="button"
                  onClick={() => toggle(catalog.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left ring-1 transition active:scale-[0.99] ${
                    isSelected
                      ? 'bg-teal-700 text-white ring-teal-700'
                      : 'bg-white text-teal-950 ring-teal-200'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                      isSelected ? 'border-white bg-white/20' : 'border-teal-300'
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 12l5 5 9-9"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{catalog.name}</span>
                    <span
                      className={`block text-sm ${isSelected ? 'text-teal-100' : 'text-teal-700'}`}
                    >
                      {catalog.words.length} từ
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ScreenShell>
  )
}
