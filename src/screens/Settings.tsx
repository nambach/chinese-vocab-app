import { useApp } from '../context/AppContext'
import { IMPORT_FORMAT_GUIDE } from '../lib/txt'
import { Card, ScreenShell } from '../components/ui'

export function Settings() {
  const { state, goBack, patchSettings } = useApp()

  return (
    <ScreenShell
      title="Cài đặt"
      onBack={() => goBack({ name: 'home' })}
      backLabel="Trang chủ"
    >
      <Card>
        <h2 className="text-sm font-semibold text-teal-900">Nhập liệu</h2>
        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-teal-800">
            Gõ pinyin bằng số thanh điệu (ni3 → nǐ)
          </span>
          <input
            type="checkbox"
            checked={state.settings.toneNumberInput}
            onChange={(event) => patchSettings({ toneNumberInput: event.target.checked })}
            className="h-6 w-6 accent-teal-700"
          />
        </label>
        <p className="mt-2 text-xs text-teal-600">
          Khi luyện gõ pinyin, thêm số 1-4 ngay sau nguyên âm để tự động thêm dấu thanh.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-teal-900">Định dạng file nhập</h2>
        <p className="mt-2 text-xs text-teal-600">
          Mỗi dòng một từ, ngăn cách bằng dấu | theo thứ tự: Hán tự, pinyin, nghĩa.
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-teal-50 p-4 text-xs text-teal-800">
          {IMPORT_FORMAT_GUIDE}
        </pre>
      </Card>
    </ScreenShell>
  )
}
