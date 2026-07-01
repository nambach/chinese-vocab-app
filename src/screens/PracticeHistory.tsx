import { getPracticeHistory } from '../data/store'
import { Card, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'
import {
  formatResultDate,
  resultDirectionLabel,
  resultDurationLabel,
  resultPercent,
  resultScoreTone,
} from '../lib/results'

type PracticeHistoryProps = {
  catalogId: string
}

const scoreStyles = {
  good: {
    badge: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-600',
  },
  ok: {
    badge: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-500',
  },
  low: {
    badge: 'bg-red-100 text-red-800',
    bar: 'bg-red-500',
  },
}

export function PracticeHistory({ catalogId }: PracticeHistoryProps) {
  const { setView, goBack } = useApp()
  const catalog = useCatalog(catalogId)

  if (!catalog) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bộ sưu tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  const history = getPracticeHistory(catalog)

  return (
    <ScreenShell
      title="Lịch sử luyện tập"
      subtitle={catalog.name}
      onBack={() => goBack({ name: 'catalog', catalogId })}
      backLabel={catalog.name}
    >
      {history.length === 0 ? (
        <Card className="text-center text-teal-700">
          Chưa có lần luyện tập nào được lưu. Hoàn thành một phiên luyện tập để xem lịch sử ở đây.
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {history.map((result, index) => {
            const percent = resultPercent(result)
            const tone = resultScoreTone(result)
            const styles = scoreStyles[tone]

            return (
              <li key={result.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-teal-600">
                        {index === 0 ? 'Lần gần nhất' : formatResultDate(result.finishedAt)}
                      </p>
                      {index === 0 ? (
                        <p className="mt-0.5 text-xs text-teal-500">
                          {formatResultDate(result.finishedAt)}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-sm font-bold ${styles.badge}`}
                    >
                      {percent}%
                    </span>
                  </div>

                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-2xl font-bold text-teal-900">
                      {result.correct}/{result.total}
                    </span>
                    <span className="pb-0.5 text-sm text-teal-700">đúng</span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100">
                    <div
                      className={`h-full rounded-full ${styles.bar}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <p className="mt-3 text-xs text-teal-600">
                    {resultDirectionLabel(result)} · {resultDurationLabel(result)}
                  </p>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </ScreenShell>
  )
}
