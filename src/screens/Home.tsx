import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { resultPercent } from '../lib/results'
import { BigButton, BottomDrawer, Card, ScreenShell, type MenuItem } from '../components/ui'

type SortKey = 'name' | 'updatedAt'
type SortDir = 'asc' | 'desc'

type SortState = { key: SortKey; dir: SortDir }

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Tên',
  updatedAt: 'Ngày sửa',
}

function SortIcon({ dir }: { dir: SortDir }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {dir === 'asc' ? (
        <path d="M12 5l-7 7h14l-7-7z" fill="currentColor" />
      ) : (
        <path d="M12 19l7-7H5l7 7z" fill="currentColor" />
      )}
    </svg>
  )
}

export function Home() {
  const { state, setView } = useApp()
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' })
  const [sheetOpen, setSheetOpen] = useState(false)

  const menuItems: MenuItem[] = [
    { label: '+ Tạo bộ sưu tập', onClick: () => setView({ name: 'createCollection' }) },
    { label: 'Cài đặt', onClick: () => setView({ name: 'settings' }) },
  ]

  const catalogs = [...state.catalogs].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1
    if (sort.key === 'name') return mul * a.name.localeCompare(b.name, 'vi', { numeric: true })
    return mul * (a.updatedAt - b.updatedAt)
  })

  const DEFAULT_DIR: Record<SortKey, SortDir> = { name: 'asc', updatedAt: 'desc' }

  function handleSortOption(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: DEFAULT_DIR[key] },
    )
  }

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
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-teal-700 md:text-base">Bộ sưu tập đã lưu</h2>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200 transition active:scale-95"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M7 12h10M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {SORT_LABELS[sort.key]}
              <SortIcon dir={sort.dir} />
            </button>
          </div>

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

      <BottomDrawer open={sheetOpen} onClose={() => setSheetOpen(false)} title="Sắp xếp">
        <div className="flex flex-col gap-2">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
            const active = sort.key === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  handleSortOption(key)
                  setSheetOpen(false)
                }}
                className={`flex items-center justify-between rounded-2xl px-4 py-4 text-left transition active:scale-[0.98] ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'bg-teal-50 text-teal-900'
                }`}
              >
                <span className="font-medium">{SORT_LABELS[key]}</span>
                {active ? (
                  <span className="flex items-center gap-1 text-sm text-teal-100">
                    {key === 'name'
                      ? sort.dir === 'asc' ? 'A → Z' : 'Z → A'
                      : sort.dir === 'desc' ? 'Mới → Cũ' : 'Cũ → Mới'}
                    <SortIcon dir={sort.dir} />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </BottomDrawer>
    </ScreenShell>
  )
}
