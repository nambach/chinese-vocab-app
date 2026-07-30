import { useApp } from '../context/AppContext'
import { IMPORT_FORMAT_GUIDE_BODY } from '../lib/txt'
import { BigButton, Card, ScreenShell, Select } from '../components/ui'
import { Hanzi } from '../components/Hanzi'
import { HANZI_FONTS } from '../lib/fonts'
import type { HanziFontId } from '../models/types'

export function Settings() {
  const { state, goBack, patchSettings, restoreDefaultLessons } = useApp()

  return (
    <ScreenShell
      title="Cài đặt"
      onBack={() => goBack({ name: 'home' })}
      backLabel="Trang chủ"
    >
      <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold text-teal-900">Hiển thị</h2>
        <div className="mt-3">
          <Select
            label="Kiểu chữ Hán"
            value={state.settings.hanziFont}
            onChange={(value) => patchSettings({ hanziFont: value as HanziFontId })}
            options={HANZI_FONTS.map((font) => ({ value: font.id, label: font.label }))}
          />
        </div>
        <div className="mt-3 flex items-center justify-center rounded-2xl bg-teal-50 py-5">
          <Hanzi className="text-4xl font-semibold text-teal-950">学习中文</Hanzi>
        </div>
        <p className="mt-2 text-xs text-teal-600">
          Cần kết nối mạng để tải phông; khi ngoại tuyến sẽ tự dùng phông hệ thống.
        </p>

        <label className="mt-4 flex items-center justify-between gap-3 border-t border-teal-50 pt-4">
          <span className="text-sm text-teal-800">Tự động phát âm khi chuyển thẻ (màn hình Học)</span>
          <input
            type="checkbox"
            checked={state.settings.autoPronounce}
            onChange={(event) => patchSettings({ autoPronounce: event.target.checked })}
            className="h-6 w-6 accent-teal-700"
          />
        </label>
        <p className="mt-2 text-xs text-teal-600">
          Dùng giọng đọc tiếng Trung có sẵn trên thiết bị. Chất lượng tùy máy.
        </p>
      </Card>

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
        <h2 className="text-sm font-semibold text-teal-900">Bài học mẫu</h2>
        <p className="mt-2 text-xs text-teal-600">
          Thêm lại các bài học mẫu còn thiếu. Các bài đã có sẵn sẽ không bị thay đổi.
        </p>
        <div className="mt-3">
          <BigButton
            variant="secondary"
            onClick={() => {
              if (window.confirm('Thêm lại các bài học mẫu còn thiếu?')) {
                restoreDefaultLessons()
              }
            }}
          >
            Khôi phục bài học mẫu
          </BigButton>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-teal-900">Định dạng file nhập</h2>
        <p className="mt-2 text-xs text-teal-600">Mỗi dòng: Hán tự | pinyin | nghĩa</p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-teal-50 p-4 text-xs text-teal-800 md:text-sm">
          {IMPORT_FORMAT_GUIDE_BODY}
        </pre>
      </Card>
      </div>
    </ScreenShell>
  )
}
