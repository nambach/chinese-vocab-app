import { WordList } from '../components/WordList'
import { Card, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'

type ManageWordsProps = {
  catalogId: string
}

export function ManageWords({ catalogId }: ManageWordsProps) {
  const { setView, removeWord, moveWord } = useApp()
  const catalog = useCatalog(catalogId)

  if (!catalog) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bộ sưu tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell
      title="Quản lý từ"
      subtitle={`${catalog.name} · ${catalog.words.length} từ`}
      onBack={() => setView({ name: 'catalog', catalogId })}
    >
      <WordList
        words={catalog.words}
        onEdit={(wordId) => setView({ name: 'editWord', catalogId, wordId })}
        onDelete={(wordId) => removeWord(catalogId, wordId)}
        onMove={(wordId, direction) => moveWord(catalogId, wordId, direction)}
      />
    </ScreenShell>
  )
}
