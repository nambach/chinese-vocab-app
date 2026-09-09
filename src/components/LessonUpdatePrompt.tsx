import { useApp } from '../context/AppContext'
import { extractLeadingTitle } from '../lib/txt'
import { BigButton, Dialog } from './ui'

export function LessonUpdatePrompt() {
  const {
    pendingBuiltinLessons,
    outdatedBuiltinLessons,
    acceptBuiltinLessonUpdates,
    declineBuiltinLessonUpdates,
  } = useApp()

  // The "new lessons" offer comes first; two stacked dialogs would be confusing.
  if (pendingBuiltinLessons.length > 0) return null

  const count = outdatedBuiltinLessons.length
  if (count === 0) return null

  const names = outdatedBuiltinLessons
    .map((lesson) => extractLeadingTitle(lesson.text).title ?? lesson.id)
    .join(', ')

  return (
    <Dialog
      open
      // Require an explicit choice, like the seed prompt.
      onClose={() => {}}
      title="Bài học đã cập nhật"
      footer={
        <div className="grid gap-3">
          <BigButton onClick={acceptBuiltinLessonUpdates}>Cập nhật {count} bài</BigButton>
          <BigButton variant="secondary" onClick={declineBuiltinLessonUpdates}>
            Giữ bản của tôi
          </BigButton>
        </div>
      }
    >
      <p>
        {count} bài học mẫu đã được sửa nghĩa hoặc ghi chú. Cập nhật bản của bạn không?
      </p>
      <p className="mt-2 text-sm text-teal-600">{names}</p>
      <p className="mt-3 text-sm text-teal-500">
        Từ bạn tự thêm sẽ được giữ lại, và lịch sử luyện tập không bị mất. Nếu bạn đã tự
        sửa một từ có sẵn, bản mới sẽ thay thế phần sửa đó, và từ bạn đã xoá sẽ quay lại.
      </p>
    </Dialog>
  )
}
