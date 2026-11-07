import { useApp } from '../context/AppContext'
import { Card, ScreenShell } from '../components/ui'

export const CONTACT_EMAIL = 'nambach2@gmail.com'
export const COPYRIGHT_LINE = '© 2026 Nam Bach'

const MOCMOC_URL = 'https://www.facebook.com/tiengtrungmocmoc'

export function About() {
  const { goBack } = useApp()

  return (
    <ScreenShell title="Giới thiệu" onBack={() => goBack({ name: 'home' })} backLabel="Trang chủ">
      <Card className="flex flex-col gap-6 text-sm leading-relaxed text-teal-800 md:text-base">
        <p>Công cụ tự học từ vựng và luyện nghe tiếng Trung.</p>

        <section>
          <h2 className="font-semibold text-teal-950">Nguồn</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              Bài khóa, từ mới, audio: 《汉语教程》 Giáo trình Hán ngữ, Dương Ký Châu chủ biên. ©
              NXB Đại học Ngôn ngữ Bắc Kinh.
            </li>
            <li>
              Giải nghĩa tiếng Việt (một số bài): ©{' '}
              <a
                href={MOCMOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 underline underline-offset-2"
              >
                Trung tâm tiếng Trung Mộc Mộc
              </a>
              .
            </li>
          </ul>
          <p className="mt-2 text-teal-600">
            Trang này độc lập, không thuộc và không được bảo trợ bởi các đơn vị trên.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-teal-950">Bản quyền</h2>
          <p className="mt-1">
            {COPYRIGHT_LINE} ·{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-teal-700 underline underline-offset-2"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="mt-1">Mọi vấn đề liên quan đến nội dung, vui lòng liên hệ qua email trên.</p>
        </section>
      </Card>
    </ScreenShell>
  )
}
