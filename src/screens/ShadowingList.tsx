import { useApp } from '../context/AppContext'
import { SHADOWING_LESSONS } from '../data/shadowing'
import { formatClock } from '../shadowing/segments'
import { ScreenShell } from '../components/ui'

export function ShadowingList() {
  const { setView } = useApp()

  return (
    <ScreenShell title="Luyện shadowing" onBack={() => setView({ name: 'home' })}>
      {SHADOWING_LESSONS.length === 0 ? (
        <p className="px-1 text-sm text-teal-600">Chưa có bài shadowing nào.</p>
      ) : (
        <ul className="grid gap-3">
          {SHADOWING_LESSONS.map((lesson) => {
            const lastEnd = lesson.segments.at(-1)?.end ?? 0
            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  onClick={() => setView({ name: 'shadowingLesson', lessonId: lesson.id })}
                  className="w-full rounded-3xl bg-white px-6 py-5 text-left shadow-sm ring-1 ring-teal-100"
                >
                  <h2 className="text-xl font-semibold text-teal-950">{lesson.title}</h2>
                  <p className="mt-1 text-sm text-teal-700">
                    {lesson.segments.length} câu · {formatClock(lastEnd)}
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
