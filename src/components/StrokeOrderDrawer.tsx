import { useEffect, useState } from 'react'
import { BottomDrawer } from './ui'
import { StrokeOrder, splitCjk, type StrokeMode } from './StrokeOrder'

export function StrokeOrderDrawer({
  open,
  onClose,
  text,
}: {
  open: boolean
  onClose: () => void
  text: string
}) {
  const [mode, setMode] = useState<StrokeMode>('animate')
  const [playToken, setPlayToken] = useState(0)

  // Reset to animation mode and replay whenever a new word's drawer opens.
  useEffect(() => {
    if (open) {
      setMode('animate')
      setPlayToken((token) => token + 1)
    }
  }, [open, text])

  const hasChars = splitCjk(text).length > 0

  return (
    <BottomDrawer open={open} onClose={onClose} title="Thứ tự nét">
      <div className="flex flex-col gap-4">
        {hasChars ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('animate')
                setPlayToken((token) => token + 1)
              }}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition active:scale-[0.98] ${
                mode === 'animate'
                  ? 'bg-teal-700 text-white ring-teal-700'
                  : 'bg-white text-teal-800 ring-teal-200'
              }`}
            >
              Xem nét
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('quiz')
                setPlayToken((token) => token + 1)
              }}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition active:scale-[0.98] ${
                mode === 'quiz'
                  ? 'bg-teal-700 text-white ring-teal-700'
                  : 'bg-white text-teal-800 ring-teal-200'
              }`}
            >
              Luyện viết
            </button>
          </div>
        ) : null}

        <StrokeOrder text={text} mode={mode} playToken={playToken} />

        {hasChars ? (
          <button
            type="button"
            onClick={() => setPlayToken((token) => token + 1)}
            className="mx-auto rounded-2xl bg-teal-50 px-5 py-2 text-sm font-medium text-teal-700 ring-1 ring-teal-200 active:scale-95"
          >
            {mode === 'quiz' ? 'Làm lại' : 'Phát lại tất cả'}
          </button>
        ) : null}

        <p className="text-center text-xs text-teal-500">
          {mode === 'quiz'
            ? 'Dùng ngón tay hoặc chuột để viết theo thứ tự nét.'
            : 'Cần kết nối mạng để tải dữ liệu nét chữ.'}
        </p>
      </div>
    </BottomDrawer>
  )
}
