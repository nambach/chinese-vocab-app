import { lazy, Suspense } from 'react'
import { useApp, useCatalog } from '../context/AppContext'
import { Hanzi } from '../components/Hanzi'
import { Card, ScreenShell } from '../components/ui'
import { LastResultCard, PracticeActions, useCatalogMenu } from './catalogChrome'
import type { Catalog, CatalogFocus } from '../models/types'

const LessonScreen = lazy(() => import('./LessonScreen').then((module) => ({ default: module.LessonScreen })))

type CatalogScreenProps = {
  catalogId: string
  focus?: CatalogFocus
}

export function CatalogScreen({ catalogId, focus }: CatalogScreenProps) {
  const { setView } = useApp()
  const catalog = useCatalog(catalogId)

  if (!catalog) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bộ sưu tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  if (catalog.kewen) {
    return (
      <Suspense
        fallback={
          <ScreenShell
            title={catalog.name}
            onBack={() => setView(focus ? { name: 'search' } : { name: 'home' })}
            backLabel={focus ? 'Tra cứu' : 'Trang chủ'}
          >
            <p className="text-teal-700">Đang mở bài…</p>
          </ScreenShell>
        }
      >
        <LessonScreen catalogId={catalogId} focus={focus} />
      </Suspense>
    )
  }

  return <WordSetScreen catalog={catalog} fromSearch={Boolean(focus)} />
}

function WordSetScreen({ catalog, fromSearch }: { catalog: Catalog; fromSearch: boolean }) {
  const { goBack } = useApp()
  const { menuItems, folderDrawer } = useCatalogMenu(catalog)

  return (
    <ScreenShell
      title={catalog.name}
      subtitle={`${catalog.words.length} từ`}
      onBack={() => goBack(fromSearch ? { name: 'search' } : { name: 'home' })}
      backLabel={fromSearch ? 'Tra cứu' : 'Trang chủ'}
      menuItems={menuItems}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start lg:gap-6">
        <PracticeActions catalog={catalog} />

        <div className="grid gap-3">
          <LastResultCard catalog={catalog} />

          {catalog.words.length === 0 ? (
            <Card className="text-center text-teal-700">
              Bộ sưu tập trống. Thêm từ để bắt đầu luyện tập.
            </Card>
          ) : (
            <Card>
              <h2 className="text-sm font-semibold text-teal-900 md:text-base">Xem trước</h2>
              <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                {catalog.words.slice(0, 5).map((word) => (
                  <li key={word.id} className="border-b border-teal-50 pb-3 last:border-none last:pb-0">
                    <div className="text-xl font-semibold">
                      <Hanzi>{word.hanzi}</Hanzi>
                    </div>
                    <div className="text-teal-800">{word.pinyin}</div>
                    <div className="text-sm text-teal-700">{word.meaning}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {folderDrawer}
    </ScreenShell>
  )
}
