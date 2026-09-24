import { useApp } from '../context/AppContext'
import type { HanziVariant } from '../models/types'

const OPTIONS: { id: HanziVariant; label: string; description: string }[] = [
  { id: 'simplified', label: '简', description: 'Giản thể' },
  { id: 'traditional', label: '繁', description: 'Phồn thể' },
]

/** Compact 简/繁 segmented toggle for the hanzi display variant. */
export function VariantToggle({ className = '' }: { className?: string }) {
  const { state, patchSettings } = useApp()
  const variant = state.settings.hanziVariant

  return (
    <div
      role="group"
      aria-label="Kiểu chữ Hán"
      className={`flex shrink-0 items-center gap-0.5 rounded-2xl bg-teal-50 p-0.5 ring-1 ring-teal-200 ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = option.id === variant
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            title={option.description}
            onClick={() => patchSettings({ hanziVariant: option.id })}
            className={`flex h-11 w-11 items-center justify-center rounded-[0.9rem] text-lg font-semibold transition active:scale-95 ${
              active ? 'bg-teal-700 text-white shadow-sm' : 'text-teal-700'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
