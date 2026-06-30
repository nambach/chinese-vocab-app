import { useEffect, useState } from 'react'
import { convertToneNumbers } from '../lib/pinyin'

type SmartInputProps = {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  pinyin?: boolean
  toneNumberInput?: boolean
  lang?: string
  autoFocus?: boolean
  onSubmit?: () => void
  className?: string
}

export function SmartInput({
  value,
  onChange,
  label,
  placeholder,
  pinyin = false,
  toneNumberInput = false,
  lang,
  autoFocus,
  onSubmit,
  className = '',
}: SmartInputProps) {
  const [enabled, setEnabled] = useState(pinyin && toneNumberInput)

  useEffect(() => {
    setEnabled(pinyin && toneNumberInput)
  }, [pinyin, toneNumberInput])

  const toneActive = pinyin && enabled

  function handleChange(nextValue: string) {
    onChange(toneActive ? convertToneNumbers(nextValue) : nextValue)
  }

  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-teal-800">{label}</span>
        {pinyin ? (
          <button
            type="button"
            onClick={() => setEnabled((current) => !current)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              enabled ? 'bg-teal-700 text-white' : 'bg-teal-100 text-teal-800'
            }`}
          >
            Số thanh điệu
          </button>
        ) : null}
      </div>
      <input
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        lang={lang}
        autoFocus={autoFocus}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint={onSubmit ? 'done' : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onSubmit) {
            event.preventDefault()
            onSubmit()
          }
        }}
        className="w-full rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4 text-xl text-teal-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
      />
      {toneActive ? (
        <span className="text-xs text-teal-600">Gõ thanh điệu bằng số (ni3 → nǐ) · Gõ v → ü</span>
      ) : null}
    </label>
  )
}
