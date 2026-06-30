import { useApp, useCatalog } from '../context/AppContext'
import { downloadTextFile, exportCatalogToText } from '../lib/txt'
import {
  formatResultDate,
  resultDirectionLabel,
  resultDurationLabel,
  resultPercent,
} from '../lib/results'
import { BigButton, Card, ScreenShell, type MenuItem } from '../components/ui'

type CatalogScreenProps = {
  catalogId: string
}

export function CatalogScreen({ catalogId }: CatalogScreenProps) {
  const { setView, removeCatalog } = useApp()
  const catalog = useCatalog(catalogId)

  if (!catalog) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bộ sưu tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  const currentCatalog = catalog

  function handleExport() {
    const content = exportCatalogToText(currentCatalog)
    downloadTextFile(`${currentCatalog.name}.txt`, content)
  }

  const menuItems: MenuItem[] = [
    { label: 'Xuất file .txt', onClick: handleExport },
    { label: 'Cài đặt', onClick: () => setView({ name: 'settings' }) },
    {
      label: 'Xóa bộ sưu tập',
      danger: true,
      onClick: () => {
        if (window.confirm(`Xóa bộ sưu tập "${currentCatalog.name}"?`)) {
          removeCatalog(catalogId)
        }
      },
    },
  ]

  return (
    <ScreenShell
      title={currentCatalog.name}
      subtitle={`${currentCatalog.words.length} từ`}
      onBack={() => setView({ name: 'home' })}
      backLabel="← Trang chủ"
      menuItems={menuItems}
    >
      <div className="grid gap-3">
        <BigButton
          onClick={() => setView({ name: 'practiceSetup', catalogId })}
          disabled={currentCatalog.words.length === 0}
        >
          Luyện tập
        </BigButton>
        <BigButton variant="secondary" onClick={() => setView({ name: 'guidedAdd', catalogId })}>
          + Thêm từ
        </BigButton>
        <BigButton variant="secondary" onClick={() => setView({ name: 'manageWords', catalogId })}>
          Quản lý từ
        </BigButton>
      </div>

      {currentCatalog.lastResult ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-teal-900">Kết quả lần trước</h2>
            <span className="text-xs text-teal-600">
              {formatResultDate(currentCatalog.lastResult.finishedAt)}
            </span>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-3xl font-bold text-teal-900">
              {resultPercent(currentCatalog.lastResult)}%
            </div>
            <div className="pb-1 text-teal-700">
              {currentCatalog.lastResult.correct}/{currentCatalog.lastResult.total} đúng
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${resultPercent(currentCatalog.lastResult)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-teal-600">
            {resultDirectionLabel(currentCatalog.lastResult)} · {resultDurationLabel(currentCatalog.lastResult)}
          </p>
        </Card>
      ) : null}

      {currentCatalog.words.length === 0 ? (
        <Card className="text-center text-teal-700">
          Bộ sưu tập trống. Thêm từ hoặc nhập file để bắt đầu luyện tập.
        </Card>
      ) : (
        <Card>
          <h2 className="text-sm font-semibold text-teal-900">Xem trước</h2>
          <ul className="mt-3 space-y-3">
            {currentCatalog.words.slice(0, 5).map((word) => (
              <li key={word.id} className="border-b border-teal-50 pb-3 last:border-none last:pb-0">
                <div className="text-xl font-semibold">{word.hanzi}</div>
                <div className="text-teal-800">{word.pinyin}</div>
                <div className="text-sm text-teal-700">{word.meaning}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </ScreenShell>
  )
}
