import { useEffect, useRef, useState } from 'react'
import { convertToneNumbers } from '../lib/pinyin'
import { useIsMobile, useVisualViewport } from '../lib/useVisualViewport'

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
  onFocus?: () => void
  onBlur?: () => void
  className?: string
  hint?: string
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
  onFocus,
  onBlur,
  className = '',
  hint,
}: SmartInputProps) {
  const [enabled, setEnabled] = useState(pinyin && toneNumberInput)
  const inputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const { keyboardOpen } = useVisualViewport()

  useEffect(() => {
    setEnabled(pinyin && toneNumberInput)
  }, [pinyin, toneNumberInput])

  const toneActive = pinyin && enabled

  function handleChange(nextValue: string) {
    onChange(toneActive ? convertToneNumbers(nextValue) : nextValue)
  }

  function insertAtCursor(text: string) {
    const input = inputRef.current
    if (!input) {
      handleChange(value + text)
      return
    }

    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? value.length
    const nextValue = value.slice(0, start) + text + value.slice(end)
    handleChange(nextValue)

    requestAnimationFrame(() => {
      input.focus()
      const cursor = start + text.length
      input.setSelectionRange(cursor, cursor)
    })
  }

  const toneKeys = ['1', '2', '3', '4', '5'] as const
  const showToneKeys = toneActive && isMobile

  const toneKeyRow = showToneKeys ? (
    <div className="flex gap-1.5" role="group" aria-label="Số thanh điệu">
      {toneKeys.map((tone) => (
        <button
          key={tone}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => insertAtCursor(tone)}
          className="min-w-0 flex-1 rounded-lg bg-white py-2 text-base font-semibold text-teal-900 ring-1 ring-teal-200 active:bg-teal-100"
        >
          {tone}
        </button>
      ))}
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => insertAtCursor('v')}
        className="min-w-0 flex-1 rounded-lg bg-white py-2 text-base font-semibold text-teal-900 ring-1 ring-teal-200 active:bg-teal-100"
      >
        v
      </button>
    </div>
  ) : null

  return (
    <label className={`flex shrink-0 flex-col gap-2 ${className}`}>
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
      {toneKeyRow}
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        lang={pinyin ? 'en' : lang}
        inputMode={pinyin ? 'text' : undefined}
        autoFocus={autoFocus}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint={onSubmit ? 'done' : undefined}
        onFocus={() => onFocus?.()}
        onBlur={() => onBlur?.()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onSubmit) {
            event.preventDefault()
            onSubmit()
          }
        }}
        className="w-full shrink-0 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-teal-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
      />
      {toneActive && !keyboardOpen ? (
        <span className="text-xs text-teal-600">
          {isMobile
            ? 'Gõ chữ trên bàn phím, chạm số để thêm thanh điệu (ni3 → nǐ) · v → ü'
            : 'Gõ thanh điệu bằng số (ni3 → nǐ) · Gõ v → ü'}
        </span>
      ) : hint ? (
        <span className="text-xs text-teal-600">{hint}</span>
      ) : null}
    </label>
  )
}
