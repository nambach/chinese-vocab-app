import { useMemo, useState } from 'react'
import { emptyWordDraft, WordCard } from '../components/WordCard'
import { Card, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'

type EditWordProps = {
  catalogId: string
  wordId: string
}

export function EditWord({ catalogId, wordId }: EditWordProps) {
  const { setView, goBack, updateWord, state } = useApp()
  const catalog = useCatalog(catalogId)
  const word = catalog?.words.find((item) => item.id === wordId)

  const initialDraft = useMemo(
    () =>
      word
        ? {
            hanzi: word.hanzi,
            pinyin: word.pinyin,
            meaning: word.meaning,
            note: word.note ?? '',
          }
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
      onBack={() => goBack({ name: 'manageWords', catalogId })}
      backLabel="Danh sách từ"
    >
      <WordCard
        key={word.id}
        value={draft}
        onChange={setDraft}
        onSave={() => {
          const note = draft.note?.trim()
          updateWord(catalogId, {
            ...word,
            hanzi: draft.hanzi.trim(),
            pinyin: draft.pinyin.trim(),
            meaning: draft.meaning.trim(),
            note: note || undefined,
          })
          setView({ name: 'manageWords', catalogId })
        }}
        onCancel={() => setView({ name: 'manageWords', catalogId })}
        saveLabel="Lưu thay đổi"
        toneNumberInput={state.settings.toneNumberInput}
      />
    </ScreenShell>
  )
}
