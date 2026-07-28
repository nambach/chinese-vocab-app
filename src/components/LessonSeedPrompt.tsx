import { useApp } from '../context/AppContext'
import { extractLeadingTitle } from '../lib/txt'
import { BigButton, Dialog } from './ui'

export function LessonSeedPrompt() {
  const { pendingBuiltinLessons, acceptDefaultLessons, declineDefaultLessons } = useApp()

  const count = pendingBuiltinLessons.length
  if (count === 0) return null

  const names = pendingBuiltinLessons
    .map((lesson) => extractLeadingTitle(lesson.text).title ?? lesson.id)
    .join(', ')

  return (
    <Dialog
      open
      // Require an explicit choice: a stray backdrop tap must not burn the offer.
      onClose={() => {}}
      title="Bài học mẫu"
      footer={
        <div className="grid gap-3">
          <BigButton onClick={acceptDefaultLessons}>Thêm {count} bài học</BigButton>
          <BigButton variant="secondary" onClick={declineDefaultLessons}>
            Không, cảm ơn
          </BigButton>
        </div>
      }
    >
      <p>
        Ứng dụng có sẵn {count} bài học mẫu để bạn bắt đầu luyện tập ngay. Thêm vào thư
        viện của bạn không?
      </p>
      <p className="mt-2 text-sm text-teal-600">{names}</p>
      <p className="mt-3 text-sm text-teal-500">
        Bạn có thể thêm lại bất cứ lúc nào trong phần Cài đặt.
      </p>
    </Dialog>
  )
}
