import { useMemo, useState } from 'react'
import { emptyWordDraft, WordCard } from '../components/WordCard'
import { Card, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'

type EditWordProps = {
  catalogId: string
  wordId: string
}

export function EditWord({ catalogId, wordId }: EditWordProps) {
  const { setView, updateWord, state } = useApp()
  const catalog = useCatalog(catalogId)
  const word = catalog?.words.find((item) => item.id === wordId)

  const initialDraft = useMemo(
    () =>
      word
        ? { hanzi: word.hanzi, pinyin: word.pinyin, meaning: word.meaning }
        : emptyWordDraft(),
    [word],
  )
  const [draft, setDraft] = useState(initialDraft)

  if (!catalog || !word) {
    return (
      <ScreenShell
        title="Không tìm thấy"
        onBack={() => setView({ name: 'manageWords', catalogId })}
      >
        <Card className="text-center text-teal-700">Từ không tồn tại.</Card>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell
      title="Sửa từ"
      subtitle={catalog.name}
      onBack={() => setView({ name: 'manageWords', catalogId })}
    >
      <WordCard
        key={word.id}
        value={draft}
        onChange={setDraft}
        onSave={() => {
          updateWord(catalogId, { ...word, ...draft })
          setView({ name: 'manageWords', catalogId })
        }}
        onCancel={() => setView({ name: 'manageWords', catalogId })}
        saveLabel="Lưu thay đổi"
        toneNumberInput={state.settings.toneNumberInput}
      />
    </ScreenShell>
  )
}
