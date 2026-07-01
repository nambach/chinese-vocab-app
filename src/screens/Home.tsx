import { useApp } from '../context/AppContext'
import { resultPercent } from '../lib/results'
import { BigButton, Card, ScreenShell, type MenuItem } from '../components/ui'

export function Home() {
  const { state, setView } = useApp()

  const menuItems: MenuItem[] = [
    { label: '+ Tạo bộ sưu tập', onClick: () => setView({ name: 'createCollection' }) },
    { label: 'Cài đặt', onClick: () => setView({ name: 'settings' }) },
  ]

  const catalogs = state.catalogs

  return (
    <ScreenShell title="Học từ vựng tiếng Trung" menuItems={menuItems}>
      <div className="grid gap-3 md:grid-cols-2">
        <BigButton onClick={() => setView({ name: 'quickPractice' })} className="py-6 text-xl md:col-span-2">
          Luyện tập ngay
        </BigButton>

        {catalogs.length >= 2 ? (
          <BigButton
            variant="secondary"
            onClick={() => setView({ name: 'combinePractice' })}
            className="md:col-span-2"
          >
            Luyện tập nhiều bài
          </BigButton>
        ) : null}
      </div>

      {catalogs.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="px-1 text-sm font-semibold text-teal-700 md:text-base">Bộ sưu tập đã lưu</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {catalogs.map((catalog) => (
              <li key={catalog.id}>
                <Card className="p-4">
                  <button
                    type="button"
                    onClick={() => setView({ name: 'catalog', catalogId: catalog.id })}
                    className="w-full text-left"
                  >
                    <h3 className="text-xl font-semibold text-teal-950">{catalog.name}</h3>
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
        </div>
      ) : (
        <p className="px-1 text-sm text-teal-600">
          Dán một bộ từ vựng để luyện ngay, hoặc tạo bộ sưu tập từ menu để lưu lại.
        </p>
      )}
    </ScreenShell>
  )
}
