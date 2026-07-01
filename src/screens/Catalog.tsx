import { useState } from 'react'
import { useApp, useCatalog } from '../context/AppContext'
import { downloadTextFile, exportCatalogToText } from '../lib/txt'
import { getPracticeHistory } from '../data/store'
import {
  formatResultDate,
  resultDirectionLabel,
  resultDurationLabel,
  resultPercent,
} from '../lib/results'
import { BigButton, BottomDrawer, Card, Dialog, ScreenShell, type MenuItem } from '../components/ui'

type CatalogScreenProps = {
  catalogId: string
}

export function CatalogScreen({ catalogId }: CatalogScreenProps) {
  const { setView, goBack, removeCatalog } = useApp()
  const catalog = useCatalog(catalogId)
  const [shareOpen, setShareOpen] = useState(false)
  const [copiedOpen, setCopiedOpen] = useState(false)

  if (!catalog) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bộ sưu tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  const currentCatalog = catalog
  const practiceHistory = getPracticeHistory(currentCatalog)
  const lastResult = currentCatalog.lastResult

  function handleDownload() {
    downloadTextFile(`${currentCatalog.name}.txt`, exportCatalogToText(currentCatalog))
    setShareOpen(false)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportCatalogToText(currentCatalog))
      setShareOpen(false)
      setCopiedOpen(true)
    } catch {
      window.alert('Không thể sao chép. Hãy thử tải file .txt.')
    }
  }

  const menuItems: MenuItem[] = [
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
      onBack={() => goBack({ name: 'home' })}
      backLabel="Trang chủ"
      menuItems={menuItems}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start lg:gap-6">
        <div className="grid gap-3">
          <BigButton
            onClick={() => setView({ name: 'practiceSetup', catalogId })}
            disabled={currentCatalog.words.length === 0}
          >
            Luyện tập
          </BigButton>
          <div className="grid grid-cols-2 gap-3">
            <BigButton variant="secondary" className="text-base" onClick={() => setView({ name: 'guidedAdd', catalogId })}>
              + Thêm từ
            </BigButton>
            <BigButton variant="secondary" className="text-base" onClick={() => setView({ name: 'manageWords', catalogId })}>
              Quản lý từ
            </BigButton>
          </div>
          <BigButton variant="secondary" onClick={() => setShareOpen(true)}>
            Chia sẻ
          </BigButton>
        </div>

        <div className="grid gap-3">
          {lastResult ? (
            <button
              type="button"
              onClick={() => setView({ name: 'practiceHistory', catalogId })}
              className="w-full text-left"
            >
              <Card className="transition active:scale-[0.99]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-teal-900 md:text-base">Kết quả lần trước</h2>
                  <span className="text-xs font-medium text-teal-600">
                    {practiceHistory.length > 1
                      ? `Xem ${practiceHistory.length} lần →`
                      : `${formatResultDate(lastResult.finishedAt)} →`}
                  </span>
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <div className="text-3xl font-bold text-teal-900">
                    {resultPercent(lastResult)}%
                  </div>
                  <div className="pb-1 text-teal-700">
                    {lastResult.correct}/{lastResult.total} đúng
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100">
                  <div
                    className="h-full rounded-full bg-teal-600"
                    style={{ width: `${resultPercent(lastResult)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-teal-600">
                  {resultDirectionLabel(lastResult)} · {resultDurationLabel(lastResult)}
                </p>
              </Card>
            </button>
          ) : null}

          {currentCatalog.words.length === 0 ? (
            <Card className="text-center text-teal-700">
              Bộ sưu tập trống. Thêm từ để bắt đầu luyện tập.
            </Card>
          ) : (
            <Card>
              <h2 className="text-sm font-semibold text-teal-900 md:text-base">Xem trước</h2>
              <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
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
        </div>
      </div>

      <BottomDrawer open={shareOpen} onClose={() => setShareOpen(false)} title="Chia sẻ bộ sưu tập">
        <div className="grid gap-3">
          <BigButton onClick={handleCopy}>Sao chép vào bộ nhớ tạm</BigButton>
          <BigButton variant="secondary" onClick={handleDownload}>
            Tải file .txt
          </BigButton>
        </div>
      </BottomDrawer>

      <Dialog
        open={copiedOpen}
        onClose={() => setCopiedOpen(false)}
        title="Đã sao chép!"
        footer={
          <BigButton onClick={() => setCopiedOpen(false)}>Đã hiểu</BigButton>
        }
      >
        <p className="text-sm">
          Dán vào <span className="font-semibold">Luyện tập ngay</span> hoặc{' '}
          <span className="font-semibold">Tạo bộ sưu tập</span> trên thiết bị khác.
        </p>
      </Dialog>
    </ScreenShell>
  )
}
