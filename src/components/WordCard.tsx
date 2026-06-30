import { SmartInput } from './SmartInput'
import { BigButton, Card } from './ui'
import type { WordDraft } from '../models/types'

type WordCardProps = {
  value: WordDraft
  onChange: (value: WordDraft) => void
  onSave: () => void
  onCancel?: () => void
  saveLabel?: string
  toneNumberInput?: boolean
  disabled?: boolean
}

export function WordCard({
  value,
  onChange,
  onSave,
  onCancel,
  saveLabel = 'Lưu',
  toneNumberInput = true,
  disabled,
}: WordCardProps) {
  const canSave =
    !disabled &&
    value.hanzi.trim() &&
    value.pinyin.trim() &&
    value.meaning.trim()

  return (
    <Card className="flex flex-col gap-5">
      <SmartInput
        label="Hán tự"
        value={value.hanzi}
        onChange={(hanzi) => onChange({ ...value, hanzi })}
        placeholder="你好"
        lang="zh"
      />
      <SmartInput
        label="Pinyin"
        value={value.pinyin}
        onChange={(pinyin) => onChange({ ...value, pinyin })}
        placeholder="nǐ hǎo hoặc ni3 hao3"
        pinyin
        toneNumberInput={toneNumberInput}
      />
      <SmartInput
        label="Nghĩa tiếng Việt"
        value={value.meaning}
        onChange={(meaning) => onChange({ ...value, meaning })}
        placeholder="xin chào"
      />

      <div className="grid gap-3">
        <BigButton onClick={onSave} disabled={!canSave}>
          {saveLabel}
        </BigButton>
        {onCancel ? (
          <BigButton variant="secondary" onClick={onCancel}>
            Hủy
          </BigButton>
        ) : null}
      </div>
    </Card>
  )
}

export const emptyWordDraft = (): WordDraft => ({
  hanzi: '',
  pinyin: '',
  meaning: '',
})
