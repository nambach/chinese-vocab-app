import { useState, type ReactNode } from 'react'
import { useApp } from '../context/AppContext'
import { useIsDesktop } from '../lib/device'
import { getPracticeHistory } from '../data/store'
import { exportLesson } from '../data/lessonTransfer'
import { downloadTextFile, exportCatalogToText } from '../lib/txt'
import {
  formatResultDate,
  resultDirectionLabel,
  resultDurationLabel,
  resultPercent,
} from '../lib/results'
import type { Catalog } from '../models/types'
import { BigButton, BottomDrawer, Card, Dialog, type MenuItem } from '../components/ui'

type KewenMenuOptions = {
  onEdit: () => void
}

export function useCatalogMenu(
  catalog: Catalog,
  options?: { kewen?: KewenMenuOptions },
): { menuItems: MenuItem[]; folderDrawer: ReactNode } {
  const { state, removeCatalog, moveCatalog, pinCatalog } = useApp()
  const desktop = useIsDesktop()
  const [folderOpen, setFolderOpen] = useState(false)

  const menuItems: MenuItem[] = [
    ...(options?.kewen && desktop
      ? [{ label: 'Sửa audio', onClick: options.kewen.onEdit }]
      : []),
    {
      label: catalog.pinnedAt ? 'Bỏ ghim' : 'Ghim bộ sưu tập',
      onClick: () => pinCatalog(catalog.id, !catalog.pinnedAt),
    },
    ...(state.folders.length > 0
      ? [
          {
            label: 'Chuyển vào thư mục',
            onClick: () => setFolderOpen(true),
          },
        ]
      : []),
    {
      label: 'Xóa bộ sưu tập',
      danger: true,
      onClick: () => {
        if (window.confirm(`Xóa bộ sưu tập "${catalog.name}"?`)) {
          removeCatalog(catalog.id)
        }
      },
    },
  ]

  const folderDrawer = (
    <BottomDrawer open={folderOpen} onClose={() => setFolderOpen(false)} title="Chuyển vào thư mục">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            moveCatalog(catalog.id, undefined)
            setFolderOpen(false)
          }}
          className={`rounded-2xl px-4 py-4 text-left transition active:scale-[0.98] ${
            !catalog.folderId ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-900'
          }`}
        >
          Không thuộc thư mục
        </button>
        {state.folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => {
              moveCatalog(catalog.id, folder.id)
              setFolderOpen(false)
            }}
            className={`rounded-2xl px-4 py-4 text-left transition active:scale-[0.98] ${
              catalog.folderId === folder.id ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-900'
            }`}
          >
            {folder.name}
          </button>
        ))}
      </div>
    </BottomDrawer>
  )

  return { menuItems, folderDrawer }
}

export function PracticeActions({ catalog }: { catalog: Catalog }) {
  const [shareOpen, setShareOpen] = useState(false)
  const [copiedOpen, setCopiedOpen] = useState(false)
  const { setView } = useApp()

  function handleDownload() {
    downloadTextFile(`${catalog.name}.txt`, exportCatalogToText(catalog))
    setShareOpen(false)
  }

  async function handleDownloadJson() {
    const file = await exportLesson(catalog)
    if (!file) return
    downloadTextFile(
      `${catalog.name}.json`,
      `${JSON.stringify(file, null, 2)}\n`,
      'application/json;charset=utf-8',
    )
    setShareOpen(false)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportCatalogToText(catalog))
      setShareOpen(false)
      setCopiedOpen(true)
    } catch {
      window.alert('Không thể sao chép. Hãy thử tải file .txt.')
    }
  }

  return (
    <div className="grid gap-3">
      <BigButton
        onClick={() => setView({ name: 'practiceSetup', catalogId: catalog.id })}
        disabled={catalog.words.length === 0}
      >
        Luyện tập
      </BigButton>
      <div className="grid grid-cols-2 gap-3">
        <BigButton
          variant="secondary"
          className="text-base"
          onClick={() => setView({ name: 'study', catalogId: catalog.id })}
          disabled={catalog.words.length === 0}
        >
          Học
        </BigButton>
        <BigButton
          variant="secondary"
          className="text-base"
          onClick={() => setView({ name: 'manageWords', catalogId: catalog.id })}
        >
          Quản lý từ
        </BigButton>
      </div>
      <BigButton variant="secondary" onClick={() => setShareOpen(true)}>
        Chia sẻ
      </BigButton>

      <BottomDrawer open={shareOpen} onClose={() => setShareOpen(false)} title="Chia sẻ bộ sưu tập">
        <div className="grid gap-3">
          <BigButton onClick={handleCopy}>Sao chép vào bộ nhớ tạm</BigButton>
          <BigButton variant="secondary" onClick={handleDownload}>
            Tải file .txt
          </BigButton>
          {catalog.kewen ? (
            <BigButton variant="secondary" onClick={() => void handleDownloadJson()}>
              Tải file .json
            </BigButton>
          ) : null}
        </div>
      </BottomDrawer>

      <Dialog
        open={copiedOpen}
        onClose={() => setCopiedOpen(false)}
        title="Đã sao chép!"
        footer={<BigButton onClick={() => setCopiedOpen(false)}>Đã hiểu</BigButton>}
      >
        <p className="text-sm">
          Dán vào <span className="font-semibold">Luyện tập ngay</span> hoặc{' '}
          <span className="font-semibold">Tạo bộ sưu tập</span> trên thiết bị khác.
        </p>
      </Dialog>
    </div>
  )
}

export function LastResultCard({ catalog }: { catalog: Catalog }) {
  const { setView } = useApp()
  const lastResult = catalog.lastResult
  if (!lastResult) return null
  const practiceHistory = getPracticeHistory(catalog)

  return (
    <button
      type="button"
      onClick={() => setView({ name: 'practiceHistory', catalogId: catalog.id })}
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
          <div className="text-3xl font-bold text-teal-900">{resultPercent(lastResult)}%</div>
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
  )
}
