import { useState } from 'react'
import { emptyWordDraft, WordCard } from '../components/WordCard'
import { BigButton, Card, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'

type GuidedAddProps = {
  catalogId: string
}

export function GuidedAdd({ catalogId }: GuidedAddProps) {
  const { setView, goBack, addWord, state } = useApp()
  const catalog = useCatalog(catalogId)
  const [draft, setDraft] = useState(emptyWordDraft())
  const [addedCount, setAddedCount] = useState(0)

  if (!catalog) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bộ sưu tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  const isDraftComplete = Boolean(
    draft.hanzi.trim() && draft.pinyin.trim() && draft.meaning.trim(),
  )

  function saveAndContinue() {
    if (!isDraftComplete) return
    addWord(catalogId, draft)
    setAddedCount((count) => count + 1)
    setDraft(emptyWordDraft())
  }

  function finish() {
    if (isDraftComplete) {
      addWord(catalogId, draft)
    }
    setView({ name: 'catalog', catalogId })
  }

  return (
    <ScreenShell
      title="Thêm từ"
      subtitle={`${catalog.name} · đã thêm ${addedCount} từ trong phiên này`}
      onBack={() => goBack({ name: 'manageWords', catalogId })}
      backLabel="Quản lý từ"
    >
      <WordCard
        value={draft}
        onChange={setDraft}
        onSave={saveAndContinue}
        saveLabel="Lưu & tiếp"
        toneNumberInput={state.settings.toneNumberInput}
      />

      <BigButton variant="secondary" onClick={finish}>
        Xong
      </BigButton>
    </ScreenShell>
  )
}
