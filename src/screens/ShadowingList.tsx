import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { ScreenShell } from '../components/ui'
import { lessonFromKewen } from '../shadowing/lessonView'
import { formatClock } from '../shadowing/segments'

export function ShadowingList() {
  const { state, setView } = useApp()
  const lessons = useMemo(
    () =>
      state.catalogs
        .filter((catalog) => catalog.kewen)
        .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true })),
    [state.catalogs],
  )

  return (
    <ScreenShell title="Luyện shadowing" onBack={() => setView({ name: 'home' })}>
      {lessons.length === 0 ? (
        <p className="px-1 text-sm text-teal-600">Chưa có bài học nào.</p>
      ) : (
        <ul className="grid gap-3">
          {lessons.map((catalog) => {
            const lesson = catalog.kewen ? lessonFromKewen(catalog.kewen) : undefined
            const lastEnd = lesson?.segments.at(-1)?.end ?? 0
            return (
              <li key={catalog.id}>
                <button
                  type="button"
                  onClick={() => setView({ name: 'catalog', catalogId: catalog.id })}
                  className="w-full rounded-3xl bg-white px-6 py-5 text-left shadow-sm ring-1 ring-teal-100"
                >
                  <h2 className="text-xl font-semibold text-teal-950">{catalog.name}</h2>
                  {catalog.kewen?.textTitle ? (
                    <p className="mt-1 text-sm font-medium text-teal-800">{catalog.kewen.textTitle}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-teal-700">
                    {catalog.words.length} từ
                    {lesson ? ` · ${lesson.segments.length} câu · ${formatClock(lastEnd)}` : ''}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ScreenShell>
  )
}
