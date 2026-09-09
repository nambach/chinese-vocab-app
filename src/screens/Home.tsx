import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { resultPercent } from '../lib/results'
import { isCatalogPinned } from '../data/store'
import type { Catalog, Folder } from '../models/types'
import { BigButton, BottomDrawer, Card, Dialog, ScreenShell, type MenuItem } from '../components/ui'

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

function sortCatalogs(catalogs: Catalog[], sort: SortState): Catalog[] {
  const mul = sort.dir === 'asc' ? 1 : -1
  return [...catalogs].sort((a, b) => {
    if (sort.key === 'name') return mul * a.name.localeCompare(b.name, 'vi', { numeric: true })
    return mul * (a.updatedAt - b.updatedAt)
  })
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {filled ? (
        <path
          d="M16 3l5 5-3.2.8L12.5 14.1l1.4 5.4-1.8 1.8-3.5-7.1L4 18.5 2.6 17.1l4.3-4.6-7.1-3.5 1.8-1.8 5.4 1.4 5.3-5.3L16 3z"
          fill="currentColor"
        />
      ) : (
        <path
          d="M16 3l5 5-3.2.8L12.5 14.1l1.4 5.4-1.8 1.8-3.5-7.1L4 18.5 2.6 17.1l4.3-4.6-7.1-3.5 1.8-1.8 5.4 1.4 5.3-5.3L16 3z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

function CatalogCard({
  catalog,
  onOpen,
  onTogglePin,
}: {
  catalog: Catalog
  onOpen: () => void
  onTogglePin: () => void
}) {
  const pinned = isCatalogPinned(catalog)

  return (
    <Card className="relative p-4">
      <button
        type="button"
        aria-label={pinned ? 'Bỏ ghim' : 'Ghim bộ sưu tập'}
        aria-pressed={pinned}
        onClick={onTogglePin}
        className={`absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-xl ${
          pinned ? 'text-teal-800' : 'text-teal-400'
        } active:bg-teal-50`}
      >
        <PinIcon filled={pinned} />
      </button>
      <button type="button" onClick={onOpen} className="w-full pr-10 text-left">
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
  )
}

function FolderSection({
  folder,
  catalogs,
  expanded,
  onToggle,
  onRename,
  onDelete,
  onOpenCatalog,
  onTogglePin,
}: {
  folder: Folder
  catalogs: Catalog[]
  expanded: boolean
  onToggle: () => void
  onRename: () => void
  onDelete: () => void
  onOpenCatalog: (catalogId: string) => void
  onTogglePin: (catalogId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className={`rounded-3xl bg-white ring-1 ring-teal-100 ${menuOpen ? 'relative z-30' : ''}`}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={`shrink-0 text-teal-600 transition ${expanded ? 'rotate-90' : ''}`}
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-teal-950">{folder.name}</h3>
            <p className="text-xs text-teal-600">{catalogs.length} bộ sưu tập</p>
          </div>
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Tùy chọn thư mục"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-teal-700 active:bg-teal-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-2xl bg-white py-1 shadow-lg ring-1 ring-teal-100">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onRename()
                  }}
                  className="block w-full px-4 py-3 text-left text-sm text-teal-900 active:bg-teal-50"
                >
                  Đổi tên
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                  className="block w-full px-4 py-3 text-left text-sm text-red-600 active:bg-red-50"
                >
                  Xóa thư mục
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <ul className="grid gap-3 border-t border-teal-50 px-4 py-3 md:grid-cols-2">
          {catalogs.map((catalog) => (
            <li key={catalog.id}>
              <CatalogCard
                catalog={catalog}
                onOpen={() => onOpenCatalog(catalog.id)}
                onTogglePin={() => onTogglePin(catalog.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function Home() {
  const { state, setView, addFolder, renameFolderById, removeFolder, pinCatalog, patchSettings } =
    useApp()
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null)
  const [renameName, setRenameName] = useState('')

  const menuItems: MenuItem[] = [
    { label: '+ Tạo bộ sưu tập', onClick: () => setView({ name: 'createCollection' }) },
    { label: '+ Tạo thư mục', onClick: () => setCreateFolderOpen(true) },
    { label: 'Cài đặt', onClick: () => setView({ name: 'settings' }) },
  ]

  const pinnedCatalogs = useMemo(() => {
    return [...state.catalogs]
      .filter(isCatalogPinned)
      .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
  }, [state.catalogs])

  const sortedCatalogs = useMemo(
    () => sortCatalogs(state.catalogs.filter((catalog) => !isCatalogPinned(catalog)), sort),
    [state.catalogs, sort],
  )

  const catalogsByFolder = useMemo(() => {
    const grouped = new Map<string, Catalog[]>()
    const ungrouped: Catalog[] = []

    for (const catalog of sortedCatalogs) {
      if (catalog.folderId) {
        const list = grouped.get(catalog.folderId) ?? []
        list.push(catalog)
        grouped.set(catalog.folderId, list)
      } else {
        ungrouped.push(catalog)
      }
    }

    return { grouped, ungrouped }
  }, [sortedCatalogs])

  const sortedFolders = useMemo(
    () =>
      [...state.folders].sort((a, b) =>
        a.name.localeCompare(b.name, 'vi', { numeric: true }),
      ),
    [state.folders],
  )

  const DEFAULT_DIR: Record<SortKey, SortDir> = { name: 'asc', updatedAt: 'desc' }

  function handleSortOption(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: DEFAULT_DIR[key] },
    )
  }

  function isExpanded(folderId: string) {
    return state.settings.expandedFolderIds.includes(folderId)
  }

  function toggleFolder(folderId: string) {
    const expanded = isExpanded(folderId)
    patchSettings({
      expandedFolderIds: expanded
        ? state.settings.expandedFolderIds.filter((id) => id !== folderId)
        : [...state.settings.expandedFolderIds, folderId],
    })
  }

  function handleTogglePin(catalogId: string) {
    const catalog = state.catalogs.find((item) => item.id === catalogId)
    if (!catalog) return
    pinCatalog(catalogId, !isCatalogPinned(catalog))
  }

  function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    addFolder(name)
    setNewFolderName('')
    setCreateFolderOpen(false)
  }

  function handleRenameFolder() {
    if (!renameTarget) return
    const name = renameName.trim()
    if (!name) return
    renameFolderById(renameTarget.id, name)
    setRenameTarget(null)
    setRenameName('')
  }

  function handleDeleteFolder(folder: Folder) {
    if (
      window.confirm(
        `Xóa thư mục "${folder.name}"? Các bộ sưu tập bên trong sẽ được giữ lại.`,
      )
    ) {
      removeFolder(folder.id)
    }
  }

  const hasCatalogs = state.catalogs.length > 0
  const hasFolders = sortedFolders.length > 0

  return (
    <ScreenShell title="Học từ vựng tiếng Trung" menuItems={menuItems}>
      <div className="grid gap-3 md:grid-cols-2">
        <BigButton onClick={() => setView({ name: 'quickPractice' })} className="py-6 text-xl md:col-span-2">
          Luyện tập ngay
        </BigButton>

        {state.catalogs.length >= 2 ? (
          <BigButton
            variant="secondary"
            onClick={() => setView({ name: 'combinePractice' })}
            className="md:col-span-2"
          >
            Luyện tập nhiều bài
          </BigButton>
        ) : null}
      </div>

      {hasCatalogs ? (
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

          <div className="flex flex-col gap-3">
            {pinnedCatalogs.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-teal-600">
                  Đã ghim
                </h3>
                <ul className="grid gap-3 md:grid-cols-2">
                  {pinnedCatalogs.map((catalog) => (
                    <li key={catalog.id}>
                      <CatalogCard
                        catalog={catalog}
                        onOpen={() => setView({ name: 'catalog', catalogId: catalog.id })}
                        onTogglePin={() => handleTogglePin(catalog.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hasFolders
              ? sortedFolders.map((folder) => {
                  const catalogs = catalogsByFolder.grouped.get(folder.id) ?? []
                  if (catalogs.length === 0) return null

                  return (
                    <FolderSection
                      key={folder.id}
                      folder={folder}
                      catalogs={catalogs}
                      expanded={isExpanded(folder.id)}
                      onToggle={() => toggleFolder(folder.id)}
                      onRename={() => {
                        setRenameTarget(folder)
                        setRenameName(folder.name)
                      }}
                      onDelete={() => handleDeleteFolder(folder)}
                      onOpenCatalog={(catalogId) => setView({ name: 'catalog', catalogId })}
                      onTogglePin={handleTogglePin}
                    />
                  )
                })
              : null}

            {catalogsByFolder.ungrouped.length > 0 ? (
              <div className="flex flex-col gap-3">
                {hasFolders || pinnedCatalogs.length > 0 ? (
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-teal-600">
                    Khác
                  </h3>
                ) : null}
                <ul className="grid gap-3 md:grid-cols-2">
                  {catalogsByFolder.ungrouped.map((catalog) => (
                    <li key={catalog.id}>
                      <CatalogCard
                        catalog={catalog}
                        onOpen={() => setView({ name: 'catalog', catalogId: catalog.id })}
                        onTogglePin={() => handleTogglePin(catalog.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
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
                  active ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-900'
                }`}
              >
                <span className="font-medium">{SORT_LABELS[key]}</span>
                {active ? (
                  <span className="flex items-center gap-1 text-sm text-teal-100">
                    {key === 'name'
                      ? sort.dir === 'asc'
                        ? 'A → Z'
                        : 'Z → A'
                      : sort.dir === 'desc'
                        ? 'Mới → Cũ'
                        : 'Cũ → Mới'}
                    <SortIcon dir={sort.dir} />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </BottomDrawer>

      <Dialog
        open={createFolderOpen}
        onClose={() => {
          setCreateFolderOpen(false)
          setNewFolderName('')
        }}
        title="Tạo thư mục"
        footer={
          <BigButton onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
            Tạo
          </BigButton>
        }
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-teal-800">Tên thư mục</span>
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Ví dụ: HSK 1"
            autoFocus
            className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-lg text-teal-950 outline-none focus:border-teal-500"
          />
        </label>
      </Dialog>

      <Dialog
        open={Boolean(renameTarget)}
        onClose={() => {
          setRenameTarget(null)
          setRenameName('')
        }}
        title="Đổi tên thư mục"
        footer={
          <BigButton onClick={handleRenameFolder} disabled={!renameName.trim()}>
            Lưu
          </BigButton>
        }
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-teal-800">Tên thư mục</span>
          <input
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
            autoFocus
            className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-lg text-teal-950 outline-none focus:border-teal-500"
          />
        </label>
      </Dialog>
    </ScreenShell>
  )
}
